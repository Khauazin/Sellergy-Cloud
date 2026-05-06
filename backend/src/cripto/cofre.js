// Cofre criptografico generico — cifra/decifra com chave derivada por tenant
// via HKDF. Cada caso de uso (mensagens, credenciais, ...) usa um SALT
// proprio para isolar dominios: comprometer a chave derivada de mensagens
// nao afeta credenciais e vice-versa.
//
// Em producao mover a master key para KMS/Vault. Hoje vem de
// process.env.MENSAGENS_MASTER_KEY (32 bytes em base64).
//
// O nome `MENSAGENS_MASTER_KEY` foi mantido por retrocompat com a 2.4 —
// a mesma master key serve a varios cofres porque cada um usa salt distinto.

const crypto = require('crypto');

const VERSAO_ATUAL = 1;
const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
const TAMANHO_CHAVE = 32;

let masterKeyCache = null;

function obterMasterKey() {
  if (masterKeyCache) return masterKeyCache;
  const raw = process.env.MENSAGENS_MASTER_KEY;
  if (!raw) {
    throw new Error('MENSAGENS_MASTER_KEY nao configurada.');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== TAMANHO_CHAVE) {
    throw new Error(`MENSAGENS_MASTER_KEY deve ter ${TAMANHO_CHAVE} bytes (base64). Atual: ${buf.length}.`);
  }
  masterKeyCache = buf;
  return buf;
}

// Deriva uma chave de tenant para um dominio especifico.
// `salt` deve ser uma string fixa do dominio (ex: 'sellergy-mensagens-v1',
// 'sellergy-credenciais-v1'). Trocar o salt invalida tudo que ja foi cifrado
// nesse dominio — equivale a rotacionar todas as chaves daquele cofre.
function derivarChave(salt, clienteId) {
  if (typeof salt !== 'string' || !salt) {
    throw new Error('salt obrigatorio.');
  }
  if (typeof clienteId !== 'string' || !clienteId) {
    throw new Error('clienteId obrigatorio.');
  }
  return Buffer.from(
    crypto.hkdfSync('sha256', obterMasterKey(), salt, clienteId, TAMANHO_CHAVE)
  );
}

// Cifra um texto. Retorna { conteudoCifrado, iv, tag, versaoChave } pronto
// pra persistir em colunas BYTEA + Int.
function cifrar({ salt, clienteId, texto }) {
  if (typeof texto !== 'string') {
    throw new Error('Texto a cifrar deve ser string.');
  }
  const chave = derivarChave(salt, clienteId);
  const iv = crypto.randomBytes(TAMANHO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, chave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    conteudoCifrado: cifrado,
    iv,
    tag,
    versaoChave: VERSAO_ATUAL,
  };
}

// Decifra um registro previamente cifrado.
function decifrar({ salt, clienteId, registro }) {
  if (!registro) throw new Error('Registro ausente.');
  const { conteudoCifrado, iv, tag, versaoChave } = registro;
  if (versaoChave !== VERSAO_ATUAL) {
    throw new Error(`Versao de chave nao suportada: ${versaoChave}.`);
  }
  const chave = derivarChave(salt, clienteId);
  const decipher = crypto.createDecipheriv(ALGORITMO, chave, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  const decifrado = Buffer.concat([
    decipher.update(Buffer.from(conteudoCifrado)),
    decipher.final(),
  ]);
  return decifrado.toString('utf8');
}

module.exports = {
  cifrar,
  decifrar,
  derivarChave,
  VERSAO_ATUAL,
  TAMANHO_IV,
  TAMANHO_TAG,
};
