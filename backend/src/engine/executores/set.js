const { interpolarProfundo } = require('../expressoes');

// Define variaveis no contexto que ficam disponiveis para os proximos nos.
async function executar({ no, contexto }) {
  const atribuicoes = Array.isArray(no.dados?.atribuicoes) ? no.dados.atribuicoes : [];
  const novas = {};
  for (const item of atribuicoes) {
    if (!item || typeof item.chave !== 'string' || item.chave.trim() === '') continue;
    novas[item.chave] = interpolarProfundo(item.valor, contexto);
  }
  return {
    saida: contexto.entrada || {},
    novasVariaveis: novas,
  };
}

module.exports = { executar };
