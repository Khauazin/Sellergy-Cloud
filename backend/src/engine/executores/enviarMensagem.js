// Envia uma mensagem de texto pelo canal externo da conversa que disparou
// o fluxo (WhatsApp ou Telegram). Identifica a conversa via:
//   1. no.dados.conversaId (interpolado)  — caso voce queira fixar
//   2. contexto.dadosGatilho.conversaId   — caso comum, vindo do dispatcher
//
// O texto pode usar placeholders {{caminho}} resolvidos contra o contexto.
//
// Persiste a mensagem como SAIDA cifrada na conversa (espelha o que o
// agente/tool mensagens.enviar faz), pra ela aparecer no historico.

const prisma = require('../../prisma');
const { interpolar } = require('../expressoes');
const { cifrar } = require('../../cripto/cofreMensagens');
const { carregarCredencialDecifrada } = require('../../credenciais');
const whatsapp = require('../../canais/whatsapp');
const telegram = require('../../canais/telegram');

async function executar({ no, contexto }) {
  const dados = no.dados || {};
  const textoBruto = typeof dados.texto === 'string' ? dados.texto : '';
  const texto = interpolar(textoBruto, contexto).trim();
  if (!texto) {
    throw new Error('ENVIAR_MENSAGEM: texto vazio (verifique o campo "texto" do no).');
  }

  const conversaIdConfigurado = dados.conversaId
    ? interpolar(String(dados.conversaId), contexto).trim()
    : '';
  const conversaId = conversaIdConfigurado
    || contexto?.dadosGatilho?.conversaId
    || contexto?.entrada?.conversaId
    || null;
  if (!conversaId) {
    throw new Error('ENVIAR_MENSAGEM: conversaId nao encontrado. Esse no precisa ser disparado por um WEBHOOK de canal, ou ter conversaId fixo nos dados.');
  }

  const conversa = await prisma.conversa.findFirst({
    where: contexto.clienteId
      ? { id: conversaId, clienteId: contexto.clienteId }
      : { id: conversaId },
  });
  if (!conversa) throw new Error(`ENVIAR_MENSAGEM: conversa ${conversaId} nao encontrada.`);
  if (!conversa.botId) throw new Error('ENVIAR_MENSAGEM: conversa sem bot vinculado.');
  if (!conversa.identificador) throw new Error('ENVIAR_MENSAGEM: conversa sem identificador externo.');

  const bot = await prisma.bot.findUnique({ where: { id: conversa.botId } });
  if (!bot) throw new Error('ENVIAR_MENSAGEM: bot nao encontrado.');
  if (!bot.credencialCanalId) throw new Error('ENVIAR_MENSAGEM: bot sem credencial de canal configurada.');

  const credencial = await carregarCredencialDecifrada({
    credencialId: bot.credencialCanalId,
    clienteId: conversa.clienteId,
  });
  if (!credencial) throw new Error('ENVIAR_MENSAGEM: credencial nao encontrada.');

  let messageIdCanal = null;
  switch (conversa.canal) {
    case 'WHATSAPP': {
      if (credencial.tipo !== 'WHATSAPP_CLOUD_TOKEN') {
        throw new Error(`Conversa WhatsApp exige credencial WHATSAPP_CLOUD_TOKEN, recebido ${credencial.tipo}.`);
      }
      const phoneNumberId = credencial.dados.phoneNumberId || bot.identificadorCanal;
      if (!phoneNumberId) throw new Error('phoneNumberId nao configurado.');
      const r = await whatsapp.enviarTexto({
        accessToken: credencial.dados.accessToken,
        phoneNumberId,
        destinatario: conversa.identificador,
        texto,
      });
      messageIdCanal = r.messageIdCanal;
      break;
    }
    case 'TELEGRAM': {
      if (credencial.tipo !== 'TELEGRAM_BOT_TOKEN') {
        throw new Error(`Conversa Telegram exige credencial TELEGRAM_BOT_TOKEN, recebido ${credencial.tipo}.`);
      }
      const r = await telegram.enviarTexto({
        token: credencial.dados.token,
        chatId: conversa.identificador,
        texto,
      });
      messageIdCanal = r.messageIdCanal;
      break;
    }
    default:
      throw new Error(`Canal ${conversa.canal} ainda nao suportado para envio.`);
  }

  // Espelha SAIDA cifrada na conversa
  const cif = cifrar(conversa.clienteId, texto);
  const msg = await prisma.$transaction(async (tx) => {
    const m = await tx.mensagemConversa.create({
      data: {
        conversaId: conversa.id,
        clienteId: conversa.clienteId,
        sentido: 'SAIDA',
        autor: 'BOT',
        tipo: 'TEXTO',
        statusEntrega: 'ENVIADA',
        conteudoCifrado: cif.conteudoCifrado,
        iv: cif.iv,
        tag: cif.tag,
        versaoChave: cif.versaoChave,
        metadata: messageIdCanal ? { messageIdCanal } : null,
      },
    });
    await tx.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMsgEm: new Date() },
    });
    return m;
  });

  return {
    saida: {
      mensagemId: msg.id,
      conversaId: conversa.id,
      canal: conversa.canal,
      messageIdCanal,
      destinatario: conversa.identificador,
      texto,
    },
  };
}

module.exports = { executar };
