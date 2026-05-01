// Filas BullMQ do BotManager (Sub-fase 2.1).
// O backend HTTP enfileira jobs aqui; o processo `worker.js` os processa.

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const NOME_QUEUE_EXECUCAO = 'execucao-fluxo';
const NOME_JOB_EXECUTAR = 'executar';
const NOME_QUEUE_AGENDAMENTO = 'agendamento-disparo';
const NOME_JOB_DISPARAR = 'disparar';

// Producer e Worker exigem opcoes de connection diferentes:
//  - Producer: aceita defaults
//  - Worker  : exige `maxRetriesPerRequest: null` (BullMQ usa BLOCKING commands)
function criarConexaoRedis({ paraWorker = false } = {}) {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: paraWorker ? null : 3,
    enableReadyCheck: !paraWorker,
    lazyConnect: false,
  });
}

const conexaoProducer = criarConexaoRedis();

const filaExecucao = new Queue(NOME_QUEUE_EXECUCAO, {
  connection: conexaoProducer,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2_000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7, count: 5_000 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
});

// Fila de schedulings: agendamentos cadastrados viram repeatable jobs aqui.
// Quando disparam, o worker cria Execucao e enfileira em `execucao-fluxo`.
const filaAgendamento = new Queue(NOME_QUEUE_AGENDAMENTO, {
  connection: conexaoProducer,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 },
    removeOnFail: { age: 60 * 60 * 24 * 30 },
  },
});

// `jobId: execucaoId` evita enfileirar a mesma execucao duas vezes (idempotencia).
async function enfileirarExecucao({ execucaoId, prioridade }) {
  return filaExecucao.add(
    NOME_JOB_EXECUTAR,
    { execucaoId },
    { jobId: execucaoId, priority: prioridade }
  );
}

// Adiciona/atualiza um repeatable job para um agendamento.
// O `jobId` (`agendamento:<id>`) e a `repeatJobKey` ficam estaveis: se o
// agendamento ja existir, BullMQ atualiza o pattern em vez de duplicar.
async function adicionarRepeatableAgendamento({ agendamentoId, expressaoCron, fusoHorario }) {
  const jobId = `agendamento:${agendamentoId}`;
  // Remove eventual job anterior pra forcar nova programacao com o pattern atual.
  await removerRepeatableAgendamento({ agendamentoId });
  return filaAgendamento.add(
    NOME_JOB_DISPARAR,
    { agendamentoId },
    {
      jobId,
      repeat: { pattern: expressaoCron, tz: fusoHorario },
      removeOnComplete: true,
    }
  );
}

async function removerRepeatableAgendamento({ agendamentoId }) {
  const repeatables = await filaAgendamento.getRepeatableJobs();
  const alvos = repeatables.filter((r) => {
    const id = r.id || '';
    return id === `agendamento:${agendamentoId}` || id.startsWith(`agendamento:${agendamentoId}:`);
  });
  for (const r of alvos) {
    await filaAgendamento.removeRepeatableByKey(r.key);
  }
}

async function fecharFilas() {
  await filaExecucao.close();
  await filaAgendamento.close();
  await conexaoProducer.quit();
}

module.exports = {
  filaExecucao,
  filaAgendamento,
  enfileirarExecucao,
  adicionarRepeatableAgendamento,
  removerRepeatableAgendamento,
  criarConexaoRedis,
  fecharFilas,
  NOME_QUEUE_EXECUCAO,
  NOME_JOB_EXECUTAR,
  NOME_QUEUE_AGENDAMENTO,
  NOME_JOB_DISPARAR,
  REDIS_URL,
};
