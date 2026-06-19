// =====================================================================
// Advisory locks por tenant — serializa operacoes concorrentes
// =====================================================================
// Usa pg_advisory_xact_lock do Postgres pra garantir que operacoes
// criticas do mesmo cliente (clienteId) nao rodem em paralelo. O lock
// e auto-liberado quando a transacao termina (commit ou rollback) —
// muito mais seguro que session-level lock que pode vazar.
//
// Caso de uso principal: garantir que so existe 1 SessaoCaixa ABERTA
// por tenant — sem isso, o bot pode criar AUTO_BOT em paralelo com o
// cron 00:01 fechando e abrindo, resultando em 2 sessoes simultaneas.
//
// Uso:
//   await prisma.$transaction(async (tx) => {
//     await lockClienteAdvisory(tx, clienteId);
//     // ... operacoes que precisam ser serializadas pelo cliente ...
//   });

const crypto = require('crypto');

// Gera bigint de 63 bits estavel a partir do clienteId (UUID string).
// SHA-256 primeiros 8 bytes -> BigUInt64 -> masked pra positivo signed bigint
// (Postgres advisory lock aceita signed bigint).
function clienteLockKey(clienteId) {
  const hash = crypto.createHash('sha256').update(String(clienteId)).digest();
  return hash.readBigUInt64BE(0) & 0x7fffffffffffffffn;
}

// Adquire lock transacional pelo clienteId. Bloqueia ate o lock liberar.
// Use SEMPRE dentro de prisma.$transaction.
async function lockClienteAdvisory(tx, clienteId) {
  if (!clienteId) throw new Error('lockClienteAdvisory: clienteId obrigatorio.');
  const key = clienteLockKey(clienteId);
  // BigInt nao serializa direto via prisma.$executeRaw — usa Unsafe com numero
  // literal (sem injecao porque key vem de hash deterministico interno).
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${key.toString()})`);
}

module.exports = { lockClienteAdvisory, clienteLockKey };
