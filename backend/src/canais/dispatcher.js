const prisma = require('../prisma');
const { cifrar } = require('../cripto/cofreMensagens');
const { criarExecucaoPendente } = require('../engine');
const { enfileirarExecucao } = require('../filas');

async function acharOuCriarConversa({ clienteId, botId, canal, identificadorRemetente }) {
  const existente = await prisma.conversa.findFirst({
    where: { clienteId, botId, canal, identificador: identificadorRemetente },
    orderBy: { criadoEm: 'desc' },
  });
  if (existente) return existente;
  return prisma.conversa.create({
    data: { clienteId, botId, canal, identificador: identificadorRemetente },
  });
}

async function persistirMensagemEntrante({ conversa, texto, autor = 'CLIENTE_FINAL', tipo = 'TEXTO', metadata }) {
  const cif = cifrar(conversa.clienteId, texto || '');
  const m = await prisma.$transaction(async (tx) => {
    const msg = await tx.mensagemConversa.create({
      data: {
        conversaId: conversa.id,
        clienteId: conversa.clienteId,
        sentido: 'ENTRADA',
        autor,
        tipo,
        statusEntrega: 'ENTREGUE',
        conteudoCifrado: cif.conteudoCifrado,
        iv: cif.iv,
        tag: cif.tag,
        versaoChave: cif.versaoChave,
        metadata: metadata || null,
      },
    });
    await tx.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMsgEm: new Date() },
    });
    return msg;
  });
  return m;
}

/**
 * Processa uma mensagem entrante:
 *   - cria/atualiza conversa
 *   - cifra e persiste a mensagem
 *   - dispara o fluxo padrao do bot (se houver)
 *
 * Retorna `{ conversaId, mensagemId, execucaoId? }`.
 */
async function processarMensagemEntrante({ bot, canal, identificadorRemetente, texto, metadata }) {
  if (!bot?.id || !bot?.clienteId) {
    throw new Error('processarMensagemEntrante: bot invalido.');
  }
  const conversa = await acharOuCriarConversa({
    clienteId: bot.clienteId,
    botId: bot.id,
    canal,
    identificadorRemetente,
  });
  const mensagem = await persistirMensagemEntrante({
    conversa,
    texto,
    metadata,
  });

  let execucaoId = null;
  if (bot.fluxoPadraoId) {
    try {
      const exec = await criarExecucaoPendente({
        fluxoId: bot.fluxoPadraoId,
        modo: 'WEBHOOK',
        dadosGatilho: {
          canal,
          conversaId: conversa.id,
          mensagemId: mensagem.id,
          telefone: identificadorRemetente,
          nome: metadata?.nomeRemetente || null,
          texto,
          // Estado livre persistido na conversa — fluxo determinístico usa pra
          // saber em que passo está (ex.: { passo: 'AGUARDANDO_CPF' }).
          estado: conversa.estado && typeof conversa.estado === 'object' ? conversa.estado : {},
          recebidoEm: new Date().toISOString(),
        },
      });
      await enfileirarExecucao({ execucaoId: exec.id });
      execucaoId = exec.id;
    } catch (e) {
      console.error('[dispatcher/enfileirar]', e?.message || e);
      // Nao re-lanca — a mensagem ja foi salva. Bot nao responder e melhor
      // que perder o registro.
    }
  }

  return {
    conversaId: conversa.id,
    mensagemId: mensagem.id,
    execucaoId,
  };
}

module.exports = {
  processarMensagemEntrante,
  acharOuCriarConversa,
  persistirMensagemEntrante,
};
