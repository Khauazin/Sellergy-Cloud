// Adaptador WhatsApp Cloud API (Meta).
//
// Documentacao: https://developers.facebook.com/docs/whatsapp/cloud-api/
//
// Recebimento (webhook):
//   GET /canais/whatsapp/:botId    -> verificacao Meta (echo do hub.challenge)
//   POST /canais/whatsapp/:botId   -> entrega de mensagens
//
// Envio:
//   POST https://graph.facebook.com/v21.0/{phoneNumberId}/messages
//   Headers: Authorization: Bearer {accessToken}
//   Body: { messaging_product: 'whatsapp', to: '<E.164>', type: 'text', text: { body: '...' } }
//
// Esse arquivo isola toda a logica especifica do WhatsApp. Se trocarmos
// pra outro provedor (Z-API, Twilio, etc.), criamos outro arquivo aqui
// com a mesma interface (`enviarTexto`, `parsearWebhook`).

const axios = require('axios');

const VERSAO_API = 'v21.0';
const TIMEOUT_MS = 30_000;

/**
 * Envia uma mensagem de texto via WhatsApp Cloud.
 *
 * @param {object} p
 * @param {string} p.accessToken      Token do app Meta
 * @param {string} p.phoneNumberId    ID do numero (vem do dashboard Meta)
 * @param {string} p.destinatario     Telefone do destinatario em E.164 (ex: 5511999999999)
 * @param {string} p.texto            Conteudo da mensagem
 * @returns {Promise<object>} Resposta da API com message id
 */
async function enviarTexto({ accessToken, phoneNumberId, destinatario, texto }) {
  if (!accessToken) throw new Error('whatsapp.enviarTexto: accessToken ausente.');
  if (!phoneNumberId) throw new Error('whatsapp.enviarTexto: phoneNumberId ausente.');
  if (!destinatario) throw new Error('whatsapp.enviarTexto: destinatario ausente.');
  if (!texto) throw new Error('whatsapp.enviarTexto: texto vazio.');

  const url = `https://graph.facebook.com/${VERSAO_API}/${phoneNumberId}/messages`;
  const resp = await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: destinatario,
      type: 'text',
      text: { body: texto },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: TIMEOUT_MS,
      validateStatus: () => true,
    }
  );
  if (resp.status >= 400) {
    const erro = resp.data?.error?.message || JSON.stringify(resp.data || {}).slice(0, 500);
    throw new Error(`WhatsApp API ${resp.status}: ${erro}`);
  }
  return {
    messageIdCanal: resp.data?.messages?.[0]?.id,
    raw: resp.data,
  };
}

/**
 * Extrai mensagens de um payload de webhook do WhatsApp Cloud.
 * Retorna lista normalizada (apenas o que importa pra o engine).
 *
 * O payload pode trazer multiplas entries -> changes -> messages. Aqui
 * achatamos tudo e ignoramos statuses (ack, delivered, read) por enquanto.
 */
function parsearWebhook(corpo) {
  const out = [];
  for (const entry of corpo?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      const meuNumero = value?.metadata?.display_phone_number;

      for (const msg of value?.messages || []) {
        out.push({
          messageIdCanal: msg.id,
          telefoneRemetente: msg.from,
          phoneNumberIdReceptor: phoneNumberId,
          meuNumero,
          tipo: msg.type,
          texto: msg.type === 'text' ? msg.text?.body : null,
          // Mais tipos (image, audio, document) viram em sub-fase futura
          // junto com download de midia pro MinIO.
          midia: msg.type !== 'text' ? msg : null,
          recebidoEm: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString(),
        });
      }
    }
  }
  return out;
}

module.exports = {
  enviarTexto,
  parsearWebhook,
};
