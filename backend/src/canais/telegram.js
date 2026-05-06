// Adaptador Telegram Bot API.
//
// Documentacao: https://core.telegram.org/bots/api
//
// Recebimento (webhook):
//   POST /canais/telegram/:botId  -> entrega de updates
//   Telegram nao tem GET de verificacao como o WhatsApp. A protecao eh feita
//   via secret_token enviado em cada request no header
//   X-Telegram-Bot-Api-Secret-Token (configurado pelo setWebhook).
//
// Envio:
//   POST https://api.telegram.org/bot{token}/sendMessage
//   Body: { chat_id, text, parse_mode? }
//
// Setup do webhook (chamado pelo backend quando o usuario clica em
// "Registrar webhook" na UI):
//   POST https://api.telegram.org/bot{token}/setWebhook
//   Body: { url, secret_token, allowed_updates: ['message'] }

const axios = require('axios');
const https = require('https');

const BASE_API = 'https://api.telegram.org';
const TIMEOUT_MS = 30_000;

// Forca IPv4. Em Windows o lookup de IPv6 pra api.telegram.org as vezes
// demora muito (depende de driver de rede / MTU / antivirus interceptando
// handshake TLS), causando timeout mesmo com a API saudavel.
const HTTPS_AGENT = new https.Agent({ family: 4, keepAlive: true });

/**
 * Envia uma mensagem de texto via Telegram Bot API.
 *
 * @param {object} p
 * @param {string} p.token        Bot token (formato 123456:ABC-DEF...)
 * @param {string|number} p.chatId  ID do chat (vem do update da telegram)
 * @param {string} p.texto        Conteudo da mensagem
 * @returns {Promise<object>} Resposta com message_id do telegram
 */
async function enviarTexto({ token, chatId, texto }) {
  if (!token) throw new Error('telegram.enviarTexto: token ausente.');
  if (chatId === undefined || chatId === null || chatId === '') {
    throw new Error('telegram.enviarTexto: chatId ausente.');
  }
  if (!texto) throw new Error('telegram.enviarTexto: texto vazio.');

  const url = `${BASE_API}/bot${token}/sendMessage`;
  const resp = await axios.post(
    url,
    { chat_id: chatId, text: texto },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
      httpsAgent: HTTPS_AGENT,
      validateStatus: () => true,
    }
  );
  if (resp.status >= 400 || resp.data?.ok === false) {
    const erro = resp.data?.description || JSON.stringify(resp.data || {}).slice(0, 500);
    throw new Error(`Telegram API ${resp.status}: ${erro}`);
  }
  return {
    messageIdCanal: resp.data?.result?.message_id ? String(resp.data.result.message_id) : null,
    raw: resp.data,
  };
}

/**
 * Extrai mensagens de um update do Telegram.
 * Retorna lista normalizada (mesmo formato do whatsapp.parsearWebhook).
 *
 * Telegram envia 1 update por request, mas mantemos array pra interface
 * uniforme com o whatsapp (que pode trazer varias).
 */
function parsearWebhook(corpo) {
  const out = [];
  const msg = corpo?.message || corpo?.edited_message;
  if (!msg) return out;

  const chatId = msg.chat?.id;
  const remetente = msg.from || {};
  const username = remetente.username || `${remetente.first_name || ''} ${remetente.last_name || ''}`.trim();

  out.push({
    messageIdCanal: msg.message_id ? String(msg.message_id) : null,
    // identificador do remetente = chatId. Eh o que precisamos pra responder
    // (sendMessage exige chat_id). Salvamos em string pra casar com o tipo
    // Conversa.identificador (String).
    telefoneRemetente: String(chatId),
    chatId: String(chatId),
    nomeRemetente: username || null,
    tipo: msg.text ? 'text' : (msg.photo ? 'photo' : msg.voice ? 'voice' : msg.document ? 'document' : 'outro'),
    texto: msg.text || msg.caption || null,
    midia: msg.text ? null : msg,
    recebidoEm: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
  });

  return out;
}

/**
 * Registra a URL do webhook na API do Telegram.
 * Chamado pelo endpoint do backend quando o usuario clica em
 * "Registrar webhook" na UI.
 */
async function registrarWebhook({ token, url, secretToken }) {
  if (!token) throw new Error('telegram.registrarWebhook: token ausente.');
  if (!url) throw new Error('telegram.registrarWebhook: url ausente.');
  if (!secretToken) throw new Error('telegram.registrarWebhook: secretToken ausente.');

  const apiUrl = `${BASE_API}/bot${token}/setWebhook`;
  const resp = await axios.post(
    apiUrl,
    {
      url,
      secret_token: secretToken,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: false,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
      httpsAgent: HTTPS_AGENT,
      validateStatus: () => true,
    }
  );
  if (resp.status >= 400 || resp.data?.ok === false) {
    const erro = resp.data?.description || JSON.stringify(resp.data || {}).slice(0, 500);
    throw new Error(`Telegram setWebhook ${resp.status}: ${erro}`);
  }
  return resp.data;
}

/**
 * Pergunta a API do Telegram qual webhook ta atualmente configurado.
 * Util pra UI mostrar status / detectar configuracao desatualizada.
 */
async function infoWebhook({ token }) {
  if (!token) throw new Error('telegram.infoWebhook: token ausente.');
  const url = `${BASE_API}/bot${token}/getWebhookInfo`;
  const resp = await axios.get(url, {
    timeout: TIMEOUT_MS,
    httpsAgent: HTTPS_AGENT,
    validateStatus: () => true,
  });
  if (resp.status >= 400 || resp.data?.ok === false) {
    const erro = resp.data?.description || JSON.stringify(resp.data || {}).slice(0, 500);
    throw new Error(`Telegram getWebhookInfo ${resp.status}: ${erro}`);
  }
  return resp.data?.result || null;
}

module.exports = {
  enviarTexto,
  parsearWebhook,
  registrarWebhook,
  infoWebhook,
};
