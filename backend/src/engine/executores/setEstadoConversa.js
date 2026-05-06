// Atualiza Conversa.estado a partir do contexto. Usado pra fluxos manuais
// multi-turno (ex.: gravar { passo: 'AGUARDANDO_CPF', nome: '...' } depois de
// uma pergunta).
//
// Forma:
//   no.dados.atribuicoes = [{ chave: string, valor: any }]   — interpoladas
//   no.dados.estrategia  = 'MERGE' (default) | 'SUBSTITUIR'
//
// MERGE: pega o estado atual e sobrescreve so as chaves passadas.
// SUBSTITUIR: descarta o estado atual e usa apenas as chaves passadas.
//
// Tambem atualiza contexto.dadosGatilho.estado pra que nos seguintes da MESMA
// execucao ja vejam o novo estado sem precisar reler o banco.

const prisma = require('../../prisma');
const { interpolarProfundo } = require('../expressoes');

async function executar({ no, contexto }) {
  const dados = no.dados || {};
  const conversaId = contexto?.dadosGatilho?.conversaId;
  if (!conversaId) {
    throw new Error('SET_ESTADO_CONVERSA: conversaId nao encontrado no contexto. Esse no precisa ser disparado por uma conversa de canal.');
  }

  const atribuicoes = Array.isArray(dados.atribuicoes) ? dados.atribuicoes : [];
  const novas = {};
  for (const item of atribuicoes) {
    if (!item || typeof item.chave !== 'string' || item.chave.trim() === '') continue;
    novas[item.chave.trim()] = interpolarProfundo(item.valor, contexto);
  }

  const estrategia = String(dados.estrategia || 'MERGE').toUpperCase();
  const estadoAtual = (contexto?.dadosGatilho?.estado && typeof contexto.dadosGatilho.estado === 'object')
    ? contexto.dadosGatilho.estado
    : {};
  const novoEstado = estrategia === 'SUBSTITUIR' ? novas : { ...estadoAtual, ...novas };

  // Filtro de tenant redundante por seguranca.
  const where = contexto?.clienteId
    ? { id: conversaId, clienteId: contexto.clienteId }
    : { id: conversaId };

  const conversa = await prisma.conversa.findFirst({ where });
  if (!conversa) {
    throw new Error(`SET_ESTADO_CONVERSA: conversa ${conversaId} nao encontrada.`);
  }

  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { estado: novoEstado },
  });

  // Propaga pro contexto da execucao corrente sem mutacao do objeto recebido.
  if (contexto && contexto.dadosGatilho) {
    contexto.dadosGatilho.estado = novoEstado;
  }

  return {
    saida: {
      ...(contexto.entrada || {}),
      estado: novoEstado,
    },
  };
}

module.exports = { executar };
