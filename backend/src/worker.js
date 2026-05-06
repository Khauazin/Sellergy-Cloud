// Worker BullMQ. Roda tres consumidores no mesmo processo:
//  - `execucao-fluxo`: processa execucoes (engine sandbox + persistencia)
//  - `agendamento-disparo`: dispara execucoes de fluxos agendados
//  - `retencao-execucoes`: limpa registros de Execucao alem do prazo
// Carrega .env do CWD + da raiz do projeto (mesmo padrao do index.js).
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Worker } = require('bullmq');
const prisma = require('./prisma');
const {
  criarConexaoRedis,
  enfileirarExecucao,
  garantirJobRetencaoDiario,
  NOME_QUEUE_EXECUCAO,
  NOME_JOB_EXECUTAR,
  NOME_QUEUE_AGENDAMENTO,
  NOME_JOB_DISPARAR,
  NOME_QUEUE_RETENCAO,
  NOME_JOB_LIMPAR,
} = require('./filas');
const { processarExecucao, criarExecucaoPendente } = require('./engine');
const { proximoDisparo, reconciliarAgendamentos } = require('./agendamento');
const { aplicarRetencaoExecucoes } = require('./retencao');

const CONCORRENCIA = parseInt(process.env.WORKER_CONCORRENCIA || '5', 10);

console.log(`[worker] iniciando · execucao=${NOME_QUEUE_EXECUCAO} agendamento=${NOME_QUEUE_AGENDAMENTO} concorrencia=${CONCORRENCIA}`);

const conexaoExecucao = criarConexaoRedis({ paraWorker: true });
const conexaoAgendamento = criarConexaoRedis({ paraWorker: true });
const conexaoRetencao = criarConexaoRedis({ paraWorker: true });

const workerExecucao = new Worker(
  NOME_QUEUE_EXECUCAO,
  async (job) => {
    if (job.name !== NOME_JOB_EXECUTAR) {
      throw new Error(`Job desconhecido em ${NOME_QUEUE_EXECUCAO}: ${job.name}`);
    }
    const { execucaoId } = job.data || {};
    if (!execucaoId) throw new Error('Job sem execucaoId.');

    console.log(`[worker:exec] processando ${execucaoId} (job=${job.id} tentativa=${job.attemptsMade + 1})`);
    const resultado = await processarExecucao(execucaoId, {
      // O backend HTTP escuta `progress` events via QueueEvents e re-emite
      // via socket.io para os clientes que subscreveram em `execucao:<id>`.
      onProgresso: (evento) => job.updateProgress(evento),
    });
    return { execucaoId: resultado.id, status: resultado.status };
  },
  { connection: conexaoExecucao, concurrency: CONCORRENCIA }
);

const workerAgendamento = new Worker(
  NOME_QUEUE_AGENDAMENTO,
  async (job) => {
    if (job.name !== NOME_JOB_DISPARAR) {
      throw new Error(`Job desconhecido em ${NOME_QUEUE_AGENDAMENTO}: ${job.name}`);
    }
    const { agendamentoId } = job.data || {};
    if (!agendamentoId) throw new Error('Job sem agendamentoId.');

    const agendamento = await prisma.agendamentoFluxo.findUnique({
      where: { id: agendamentoId },
      include: { fluxo: { select: { ativo: true } } },
    });
    if (!agendamento || !agendamento.ativo) {
      console.log(`[worker:sched] ${agendamentoId} inativo, pulando.`);
      return { pulado: true };
    }
    if (!agendamento.fluxo?.ativo) {
      console.log(`[worker:sched] fluxo do agendamento ${agendamentoId} inativo, pulando.`);
      return { pulado: true };
    }

    const execucao = await criarExecucaoPendente({
      fluxoId: agendamento.fluxoId,
      modo: 'SCHEDULE',
      dadosGatilho: { disparoEm: new Date().toISOString() },
    });
    await prisma.execucao.update({
      where: { id: execucao.id },
      data: { noTriggerId: agendamento.noId },
    });
    await enfileirarExecucao({ execucaoId: execucao.id });

    const proximo = proximoDisparo(agendamento.expressaoCron, agendamento.fusoHorario);
    await prisma.agendamentoFluxo.update({
      where: { id: agendamentoId },
      data: {
        ultimoDisparoEm: new Date(),
        proximoDisparoEm: proximo,
        totalDisparos: { increment: 1 },
      },
    });

    console.log(`[worker:sched] disparou agendamento=${agendamentoId} execucao=${execucao.id}`);
    return { execucaoId: execucao.id };
  },
  { connection: conexaoAgendamento, concurrency: 2 }
);

const workerRetencao = new Worker(
  NOME_QUEUE_RETENCAO,
  async (job) => {
    if (job.name !== NOME_JOB_LIMPAR) {
      throw new Error(`Job desconhecido em ${NOME_QUEUE_RETENCAO}: ${job.name}`);
    }
    console.log('[worker:retencao] iniciando limpeza diaria...');
    const r = await aplicarRetencaoExecucoes();
    console.log(`[worker:retencao] removidas=${r.totalSucesso} sucessos, ${r.totalErro} erros`);
    return r;
  },
  { connection: conexaoRetencao, concurrency: 1 }
);

for (const [nome, w] of [['exec', workerExecucao], ['sched', workerAgendamento], ['retencao', workerRetencao]]) {
  w.on('completed', (job, ret) => console.log(`[worker:${nome}] completed job=${job.id} ret=${JSON.stringify(ret)}`));
  w.on('failed', (job, err) => console.error(`[worker:${nome}] failed job=${job?.id} erro=${err?.message}`));
  w.on('error', (err) => console.error(`[worker:${nome}] erro:`, err));
}

// Reconciliacao: garante que todo agendamento ativo tem repeatable na fila
// e que o job de retencao diario esta agendado.
setTimeout(() => {
  reconciliarAgendamentos()
    .then((r) => console.log(`[worker:sched] reconciliados=${r.ok}/${r.total} erros=${r.erros}`))
    .catch((e) => console.error('[worker:sched] erro na reconciliacao:', e));
  garantirJobRetencaoDiario()
    .then(() => console.log('[worker:retencao] job diario garantido (03:00 UTC)'))
    .catch((e) => console.error('[worker:retencao] erro ao agendar:', e));
}, 2_000);

async function shutdown(sinal) {
  console.log(`[worker] sinal ${sinal} recebido, encerrando...`);
  try {
    await workerExecucao.close();
    await workerAgendamento.close();
    await workerRetencao.close();
    await conexaoExecucao.quit();
    await conexaoAgendamento.quit();
    await conexaoRetencao.quit();
  } catch (err) {
    console.error('[worker] erro ao encerrar:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
