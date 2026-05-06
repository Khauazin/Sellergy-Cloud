// Cliente MinIO/S3-compatible para upload de midias (imagens de produto,
// variacao, futuramente avatares, anexos de mensagens, etc.).
//
// Uso:
//   const { upload, urlPublica } = require('../storage/minio');
//   const url = await upload({ key: `produtos/${clienteId}/${id}.jpg`, body: buffer, contentType: mime });
//
// Configurar no MinIO console (uma vez): bucket `sellergy-midia` com policy
// de leitura PUBLICA (anonymous read) — assim a URL retornada pode ser
// embutida direto no <img src> sem autenticacao.

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

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

module.exports = {
  cliente,
  upload,
  remover,
  urlPublica,
  chaveDeUrl,
  pingar,
  BUCKET,
  ENDPOINT,
};
