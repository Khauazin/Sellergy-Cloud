// Cliente MinIO/S3-compatible para upload de midias (imagens de produto,
// variacao, futuramente avatares, anexos de mensagens, etc.).
//
// Uso:
//   const { upload, assinar } = require('../storage/minio');
//   const url = await upload({ key: `produtos/${clienteId}/${id}.jpg`, body: buffer, contentType: mime });
//   // `url` retornado e a URL "canonica" (publica do MinIO) — grava-se no banco.
//   // Pra exibir no front, o controller troca por uma URL assinada via
//   // transformarUrlsAssinadas(obj).
//
// O bucket e PRIVADO. Imagens so sao acessadas via URL assinada (pre-signed)
// com expiracao curta — gerada no momento da resposta da API. Isso garante:
//   - Multi-tenant: backend so assina o que o user pode ver.
//   - Sem leaks: URL nao funciona pra terceiros, expira sozinha.
//   - Performance: MinIO serve direto (sem proxy), só o backend assina.

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const REGION = process.env.MINIO_REGION || 'us-east-1';
const BUCKET = process.env.MINIO_BUCKET_MIDIA || 'sellergy-midia';
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const SECRET_KEY = process.env.MINIO_SECRET_KEY;
const USE_SSL = process.env.MINIO_USE_SSL === 'true';

if (!ACCESS_KEY || !SECRET_KEY) {
  console.warn('[storage/minio] MINIO_ACCESS_KEY/SECRET_KEY nao configuradas — uploads vao falhar.');
}

const cliente = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY || '',
    secretAccessKey: SECRET_KEY || '',
  },
  forcePathStyle: true, // Necessario para MinIO (compativel S3 path-style)
  tls: USE_SSL,
});

async function upload({ key, body, contentType, cacheControl = 'public, max-age=31536000, immutable' }) {
  if (!key || !body) throw new Error('upload: `key` e `body` sao obrigatorios.');
  await cliente.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
  return urlPublica(key);
}

async function remover(key) {
  if (!key) return;
  await cliente.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// URL publica direta. Funciona porque o bucket esta em "anonymous read".
function urlPublica(key) {
  const base = ENDPOINT.replace(/\/$/, '');
  return `${base}/${BUCKET}/${encodeURI(key)}`;
}

// Util pra extrair a key (caminho dentro do bucket) de uma URL publica.
function chaveDeUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  const base = ENDPOINT.replace(/\/$/, '');
  const prefixo = `${base}/${BUCKET}/`;
  if (!url.startsWith(prefixo)) return null;
  return decodeURI(url.slice(prefixo.length));
}

async function pingar() {
  try {
    await cliente.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return true;
  } catch (err) {
    console.error('[storage/minio] ping falhou:', err.message);
    return false;
  }
}

// =====================================================================
// PRE-SIGNED URLs (acesso autenticado a objetos do bucket privado)
// =====================================================================
// Cache em memoria pra evitar regerar a mesma URL N vezes na mesma sessao.
// Chave: key do objeto. Valor: { url, expiraEm (timestamp ms) }.
// Quando a URL ainda tem >5min de vida, reusa.
const cacheUrlsAssinadas = new Map();
const TTL_PRE_SIGNED_SEGUNDOS = 60 * 60 * 24; // 24h
const MARGEM_REUSO_MS = 5 * 60 * 1000; // 5min — se a URL expira em <5min, regera

/**
 * Gera uma URL temporaria assinada pra ler um objeto do bucket privado.
 * Cacheia em memoria — chamadas repetidas pra mesma key reusam a URL.
 *
 * @param {string} key — caminho dentro do bucket (ex.: "produtos/<clienteId>/abc.jpg")
 * @param {object} [opts]
 * @param {number} [opts.expiraEm=86400] — segundos de vida da URL
 * @returns {Promise<string>}
 */
async function urlAssinada(key, { expiraEm = TTL_PRE_SIGNED_SEGUNDOS } = {}) {
  if (!key) return null;

  const agora = Date.now();
  const cache = cacheUrlsAssinadas.get(key);
  if (cache && cache.expiraEm - agora > MARGEM_REUSO_MS) {
    return cache.url;
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(cliente, command, { expiresIn: expiraEm });

  cacheUrlsAssinadas.set(key, {
    url,
    expiraEm: agora + expiraEm * 1000,
  });
  return url;
}

/**
 * Recebe uma URL "canonica" do MinIO (a que esta gravada no banco) e
 * devolve a versao assinada. Se a URL nao for do nosso storage, retorna
 * ela mesma sem mexer (defensivo — permite URLs externas se um dia rolar).
 */
async function assinarSeFor(url) {
  if (typeof url !== 'string' || !url) return url;
  const key = chaveDeUrl(url);
  if (!key) return url; // URL externa — passa direto
  try {
    return await urlAssinada(key);
  } catch (e) {
    console.error('[storage/minio] falha ao assinar URL:', e.message);
    return url; // fallback — devolve o que veio
  }
}

/**
 * Percorre um objeto/array recursivamente e troca toda string em campo
 * chamado `imagemUrl` por sua versao assinada. Usado nos controllers pra
 * preparar a resposta — sem precisar saber a estrutura exata do retorno.
 *
 * NUNCA muta o input — retorna copia transformada.
 */
async function transformarUrlsAssinadas(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => transformarUrlsAssinadas(item)));
  }

  const resultado = {};
  for (const [chave, valor] of Object.entries(obj)) {
    if (chave === 'imagemUrl' && typeof valor === 'string') {
      resultado[chave] = await assinarSeFor(valor);
    } else if (valor && typeof valor === 'object') {
      resultado[chave] = await transformarUrlsAssinadas(valor);
    } else {
      resultado[chave] = valor;
    }
  }
  return resultado;
}

// =====================================================================
// SETUP AUTOMATICO DO BUCKET
// =====================================================================
// Garante que o bucket existe no boot. NAO aplica policy publica —
// o bucket fica privado de proposito (acesso via URL assinada).
async function garantirBucket() {
  try {
    await cliente.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { ok: true, criado: false };
  } catch (err) {
    // 404 ou NoSuchBucket — cria.
    const codigo = err?.$metadata?.httpStatusCode || err?.Code;
    if (codigo === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
      try {
        await cliente.send(new CreateBucketCommand({ Bucket: BUCKET }));
        console.log(`[storage/minio] bucket '${BUCKET}' criado (privado).`);
        return { ok: true, criado: true };
      } catch (errCriar) {
        console.error(`[storage/minio] falha ao criar bucket '${BUCKET}':`, errCriar.message);
        return { ok: false, erro: errCriar.message };
      }
    }
    console.error(`[storage/minio] erro ao verificar bucket '${BUCKET}':`, err.message);
    return { ok: false, erro: err.message };
  }
}

module.exports = {
  cliente,
  upload,
  remover,
  urlPublica,
  chaveDeUrl,
  pingar,
  urlAssinada,
  assinarSeFor,
  transformarUrlsAssinadas,
  garantirBucket,
  BUCKET,
  ENDPOINT,
};
