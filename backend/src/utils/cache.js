/**
 * Cache leve em Redis (cache-aside) — com SEGURANÇA como requisito.
 *
 * Regras de segurança/robustez:
 *  - ISOLAMENTO POR TENANT: toda chave inclui o clienteId (e o usuarioId). Sem
 *    clienteId, `chaveTenant` LANÇA — nunca se cacheia dado sem escopo (evita um
 *    tenant ler o cache do outro). Isso é a parte crítica e é testável isolada.
 *  - FAIL-OPEN: qualquer erro do Redis (fora do ar, timeout) é engolido e a
 *    requisição segue no banco. Cache nunca derruba o request.
 *  - Não cacheia payload gigante (limite de bytes) nem dado sensível (o chamador
 *    decide o que cacheia — aqui só reads de negócio por tenant).
 *  - Desligável por env (CACHE_DISABLED=true) pra depurar.
 */

const IORedis = require('ioredis');
const crypto = require('crypto');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DESLIGADO = String(process.env.CACHE_DISABLED || '').toLowerCase() === 'true';
const MAX_BYTES = 256 * 1024; // não cacheia resposta > 256KB

let cliente = null;
let jaAvisou = false;

function getCliente() {
  if (DESLIGADO) return null;
  if (cliente) return cliente;
  try {
    cliente = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: false,
      // Desiste de reconectar rápido pra não travar comandos quando o Redis some.
      retryStrategy: (tentativas) => (tentativas > 3 ? null : 200),
    });
    // Sem listener de 'error', o ioredis derruba o processo. Aqui só logamos 1x.
    cliente.on('error', (e) => {
      if (!jaAvisou) { console.error('[cache] Redis indisponivel, seguindo sem cache:', e.message); jaAvisou = true; }
    });
    cliente.on('ready', () => { jaAvisou = false; });
  } catch (e) {
    console.error('[cache] falha ao criar cliente Redis:', e.message);
    cliente = null;
  }
  return cliente;
}

// Hash curto e estável da parte variável (path/query) — evita injeção de chave
// e chaves gigantes. PURA.
function hashParte(parte) {
  return crypto.createHash('sha1').update(String(parte ?? '')).digest('hex').slice(0, 16);
}

/**
 * Monta a chave SEMPRE isolada por tenant (+ usuário). Lança se faltar tenant.
 * PURA e testável — é a garantia de que um cliente nunca lê o cache do outro.
 */
function chaveTenant(namespace, { clienteId, usuarioId } = {}, variavel = '') {
  if (!namespace || typeof namespace !== 'string') throw new Error('cache: namespace obrigatorio.');
  if (!clienteId) throw new Error('cache: clienteId obrigatorio (isolamento por tenant).');
  const u = usuarioId ? String(usuarioId) : 'anon';
  return `cache:${namespace}:${clienteId}:${u}:${hashParte(variavel)}`;
}

async function ler(chave) {
  const c = getCliente();
  if (!c) return null;
  try {
    const bruto = await c.get(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null; // fail-open
  }
}

async function gravar(chave, valor, ttlSegundos) {
  const c = getCliente();
  if (!c) return;
  try {
    const json = JSON.stringify(valor);
    if (json.length > MAX_BYTES) return; // não cacheia payload gigante
    await c.set(chave, json, 'EX', Math.max(1, ttlSegundos | 0));
  } catch {
    /* fail-open */
  }
}

/**
 * Invalida por prefixo (ex.: `cache:estoque:dashboard:{clienteId}`). Usa SCAN
 * (não KEYS) pra não travar o Redis. Best-effort — falha não quebra a escrita.
 */
async function invalidarPrefixo(prefixo) {
  const c = getCliente();
  if (!c || !prefixo) return;
  try {
    let cursor = '0';
    do {
      const [prox, chaves] = await c.scan(cursor, 'MATCH', `${prefixo}*`, 'COUNT', 200);
      cursor = prox;
      if (chaves.length) await c.del(...chaves);
    } while (cursor !== '0');
  } catch {
    /* best-effort */
  }
}

module.exports = { chaveTenant, hashParte, ler, gravar, invalidarPrefixo };
