// Worker BullMQ (esqueleto pós-pivô ERP-first).
//
// Os consumidores de execução de fluxo (execucao-fluxo / agendamento-disparo /
// retencao-execucoes) foram removidos na limpeza do pivô. Este processo segue
// vivo como base para os jobs do ERP das próximas fases (lembrete de
// agendamento, disparo de campanha, emissão fiscal, conciliação de pagamento,
// expiração de cobrança — ver erp-arquitetura-e-operacao.md §8.4).
//
// Para registrar um job: crie a Queue em ./filas, instancie um `new Worker(...)`
// aqui com sua conexão própria, e trate o shutdown abaixo.
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { criarConexaoRedis } = require('./filas');

// Conexão base mantida viva para o processo continuar disponível ao orquestrador
// (Docker Compose) enquanto ainda não há consumidores registrados.
const conexao = criarConexaoRedis({ paraWorker: true });

console.log('[worker] iniciado · sem consumidores registrados (esqueleto pós-pivô).');

const consumidores = [];

async function shutdown(sinal) {
  console.log(`[worker] sinal ${sinal} recebido, encerrando...`);
  try {
    for (const w of consumidores) await w.close();
    await conexao.quit();
  } catch (err) {
    console.error('[worker] erro ao encerrar:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
