// Receiver publico de mensagens dos canais externos.
// Sem autenticacao JWT — protecao por:
//  - URL com botId opaco (UUID)
//  - GET de verificacao com verifyTokenCanal especifico do bot
//  - Rate limit por IP

const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const whatsapp = require('../canais/whatsapp');
const telegram = require('../canais/telegram');
const { processarMensagemEntrante } = require('../canais/dispatcher');

const roteador = express.Router();

const TAMANHO_MAX_BYTES = 1_000_000;

const limitador = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisicoes.' },
});

// =================================================================
// WhatsApp Cloud API
// =================================================================

// GET /canais/whatsapp/:botId  -> verificacao Meta
//   Meta envia: ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//   Devolvemos hub.challenge se o token bater com bot.verifyTokenCanal.
roteador.get('/whatsapp/:botId', limitador, async (req, res) => {
  try {
    const { botId } = req.params;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe') return res.status(400).send('mode invalido');

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { id: true, verifyTokenCanal: true },
    });
    if (!bot || !bot.verifyTokenCanal || bot.verifyTokenCanal !== token) {
      return res.status(403).send('verify token invalido');
    }
    return res.status(200).send(challenge || '');
  } catch (erro) {
    console.error('[canais/whatsapp/verify]', erro);
    res.status(500).send('erro');
  }
});

// POST /canais/whatsapp/:botId  -> entrega de mensagens
// Importante: por padrao o express.json esta DEPOIS desta rota no index.js
// (registramos antes do parser global). Aqui usamos um parser local pra
// receber JSON com tamanho controlado.
roteador.post('/whatsapp/:botId', limitador, express.json({ limit: TAMANHO_MAX_BYTES }), async (req, res) => {
  // Meta espera 200 RAPIDO (senao reenfileira). Respondemos antes de
  // processar — o processamento real fica em background.
  res.status(200).send('OK');

  try {
    const { botId } = req.params;
    const corpo = req.body;
    if (!corpo || corpo.object !== 'whatsapp_business_account') return;

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { id: true, clienteId: true, fluxoPadraoId: true },
    });
    if (!bot) {
      console.warn('[canais/whatsapp] bot nao encontrado:', botId);
      return;
    }

    const mensagens = whatsapp.parsearWebhook(corpo);
    for (const msg of mensagens) {
      try {
        await processarMensagemEntrante({
          bot,
          canal: 'WHATSAPP',
          identificadorRemetente: msg.telefoneRemetente,
          texto: msg.texto || '',
          metadata: {
            messageIdCanal: msg.messageIdCanal,
            tipo: msg.tipo,
            phoneNumberIdReceptor: msg.phoneNumberIdReceptor,
            recebidoEm: msg.recebidoEm,
          },
        });
      } catch (e) {
        console.error('[canais/whatsapp/dispatch]', e?.message || e);
      }
    }
  } catch (erro) {
    console.error('[canais/whatsapp/webhook]', erro);
  }
});

// =================================================================
// Telegram Bot API
// =================================================================
//
// Telegram nao tem GET de verificacao. A protecao eh via secret_token
// enviado pelo Telegram em todo POST no header
// X-Telegram-Bot-Api-Secret-Token. Comparamos com bot.verifyTokenCanal.

roteador.post('/telegram/:botId', limitador, express.json({ limit: TAMANHO_MAX_BYTES }), async (req, res) => {
  // Telegram tambem reenfileira em caso de timeout/5xx — responder rapido.
  res.status(200).send('OK');

  try {
    const { botId } = req.params;
    const corpo = req.body;
    if (!corpo) return;

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      select: { id: true, clienteId: true, fluxoPadraoId: true, verifyTokenCanal: true },
    });
    if (!bot) {
      console.warn('[canais/telegram] bot nao encontrado:', botId);
      return;
    }

    // Validacao do secret_token. Se o bot nao tem verifyTokenCanal configurado,
    // recusamos por seguranca (qualquer um conseguiria postar updates falsos).
    const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (!bot.verifyTokenCanal || headerSecret !== bot.verifyTokenCanal) {
      console.warn('[canais/telegram] secret_token invalido para bot:', botId);
      return;
    }

    const mensagens = telegram.parsearWebhook(corpo);
    for (const msg of mensagens) {
      try {
        await processarMensagemEntrante({
          bot,
          canal: 'TELEGRAM',
          identificadorRemetente: msg.chatId,
          texto: msg.texto || '',
          metadata: {
            messageIdCanal: msg.messageIdCanal,
            tipo: msg.tipo,
            nomeRemetente: msg.nomeRemetente,
            recebidoEm: msg.recebidoEm,
          },
        });
      } catch (e) {
        console.error('[canais/telegram/dispatch]', e?.message || e);
      }
    }
  } catch (erro) {
    console.error('[canais/telegram/webhook]', erro);
  }
});

module.exports = roteador;
