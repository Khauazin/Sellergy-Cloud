// Infra de filas BullMQ (esqueleto pós-pivô ERP-first).
//
// A execução de fluxo do bot-vendedor foi removida na limpeza do pivô. Esta
// camada permanece como base para os jobs do ERP que entram nas próximas fases:
// lembrete de agendamento, disparo de campanha, emissão fiscal, conciliação de
// pagamento e expiração de cobrança (ver erp-arquitetura-e-operacao.md §8.4).
//
// Para adicionar um job: crie a Queue aqui, registre o consumidor no worker.js
// e exporte os helpers de enfileiramento.

const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

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

// Fecha as filas/conexões no shutdown. Sem filas ativas ainda — no-op seguro.
async function fecharFilas() {
  // Quando houver Queues registradas, fechá-las aqui antes de encerrar.
}

module.exports = {
  criarConexaoRedis,
  fecharFilas,
  REDIS_URL,
};
