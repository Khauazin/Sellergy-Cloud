// Cofre de credenciais (chaves de API). Cifra um objeto JSON com formato livre
// por tipo, ex.:
//   OPENAI_API_KEY        -> { apiKey, organizationId? }
//   ANTHROPIC_API_KEY     -> { apiKey }
//   WHATSAPP_CLOUD_TOKEN  -> { accessToken, phoneNumberId, businessAccountId }
//   TELEGRAM_BOT_TOKEN    -> { token }
//   HTTP_BEARER           -> { token }
//   HTTP_BASIC            -> { usuario, senha }
//   HTTP_API_KEY          -> { headerName, key }
//   OUTRO                 -> { ... }  (livre)
//
// O proprio JSON serializado e cifrado em AES-256-GCM com chave derivada do
// tenant via HKDF (cofre.js).

const { cifrar, decifrar } = require('./cofre');

const SALT = 'sellergy-credenciais-v1';

function cifrarPayload(clienteId, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload deve ser objeto JSON.');
  }
  return cifrar({ salt: SALT, clienteId, texto: JSON.stringify(payload) });
}

function decifrarPayload(clienteId, registro) {
  // O modelo Prisma `Credencial` chama o campo de `dadosCifrados`, mas o
  // cofre generico (cofre.js) espera `conteudoCifrado`. Traduzimos aqui.
  const json = decifrar({
    salt: SALT,
    clienteId,
    registro: {
      conteudoCifrado: registro.dadosCifrados,
      iv: registro.iv,
      tag: registro.tag,
      versaoChave: registro.versaoChave,
    },
  });
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Payload de credencial corrompido.');
  }
}

// Pequena sanitizacao: remove undefined e trim de strings antes de cifrar.
function normalizarPayload(payload) {
  const limpo = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (v === undefined || v === null) continue;
    limpo[k] = typeof v === 'string' ? v.trim() : v;
  }
  return limpo;
}

module.exports = {
  cifrarPayload,
  decifrarPayload,
  normalizarPayload,
};
