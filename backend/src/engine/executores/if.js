const { avaliarCondicaoIsolada } = require('../sandbox');

// Bifurca por condicao. A expressao e avaliada num isolate (sem acesso ao Node).
// Retorna `proximaSaida` "verdadeiro" ou "falso" para o motor seguir o handle correto.
async function executar({ no, contexto }) {
  const condicao = no.dados?.condicao;

  let resultado = false;
  if (typeof condicao === 'string' && condicao.trim() !== '') {
    resultado = await avaliarCondicaoIsolada({
      expressao: condicao,
      entrada: contexto.entrada,
      variaveis: contexto.variaveis,
    });
  }

  return {
    saida: contexto.entrada || {},
    proximaSaida: resultado ? 'verdadeiro' : 'falso',
  };
}

module.exports = { executar };
