// Tools de mensagens — envio para o cliente final via canal externo.
// Suporta WhatsApp Cloud API.

const prisma = require('../../prisma');
const { cifrar } = require('../../cripto/cofreMensagens');
const { carregarCredencialDecifrada } = require('../../credenciais');
const whatsapp = require('../../canais/whatsapp');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

const enviarMensagem = {
  nome: 'mensagens.enviar',
  modulo: 'CRM',
  descricao:
    'Envia uma mensagem de texto para o cliente final na conversa indicada. ' +
    'Use esta tool sempre que precisar responder ao cliente. O canal e detectado pela conversa.',
  parametros: {
    tipo: 'object',
    propriedades: {
      conversaId: { tipo: 'string', descricao: 'ID da conversa ativa (vem dos dadosGatilho).' },
      texto: { tipo: 'string', descricao: 'Conteudo da mensagem.' },
    },
    obrigatorios: ['conversaId', 'texto'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const texto = String(args.texto || '').trim();
    if (!texto) throw new Error('texto vazio.');

    const conversa = await prisma.conversa.findFirst({
      where: { id: args.conversaId, clienteId: contexto.clienteId },
    });
    if (!conversa) throw new Error('Conversa nao encontrada.');
    if (!conversa.botId) throw new Error('Conversa sem bot vinculado.');
    if (!conversa.identificador) throw new Error('Conversa sem identificador externo (telefone/chatId).');

    const bot = await prisma.bot.findUnique({ where: { id: conversa.botId } });
    if (!bot) throw new Error('Bot nao encontrado.');
    if (!bot.credencialCanalId) throw new Error('Bot sem credencial de canal configurada.');

    const credencial = await carregarCredencialDecifrada({
      credencialId: bot.credencialCanalId,
      clienteId: contexto.clienteId,
    });
    if (!credencial) throw new Error('Credencial do canal nao encontrada.');

    let messageIdCanal = null;

    switch (conversa.canal) {
      case 'WHATSAPP': {
        if (credencial.tipo !== 'WHATSAPP_CLOUD_TOKEN') {
          throw new Error(`Conversa WhatsApp exige credencial WHATSAPP_CLOUD_TOKEN, recebido ${credencial.tipo}.`);
        }
        const phoneNumberId = credencial.dados.phoneNumberId || bot.identificadorCanal;
        if (!phoneNumberId) throw new Error('phoneNumberId nao configurado (na credencial nem no bot).');
        const r = await whatsapp.enviarTexto({
          accessToken: credencial.dados.accessToken,
          phoneNumberId,
          destinatario: conversa.identificador,
          texto,
        });
        messageIdCanal = r.messageIdCanal;
        break;
      }
      default:
        throw new Error(`Canal ${conversa.canal} ainda nao suportado para envio.`);
    }

    // Persiste a mensagem SAIDA cifrada
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
      mensagemId: msg.id,
      conversaId: conversa.id,
      canal: conversa.canal,
      messageIdCanal,
      destinatario: conversa.identificador,
    };
  },
};

module.exports = [enviarMensagem];
