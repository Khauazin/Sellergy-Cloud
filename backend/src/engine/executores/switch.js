// Bifurca em N saidas baseado no valor de uma expressao.
// Substitui o padrao "IF aninhado" — 1 SWITCH com 5 casos em vez de 4 IFs.
//
// Forma do no:
//   no.dados.expressao = '{{dadosGatilho.estado.passo}}'   — string interpolada
//   no.dados.casos     = [{ valor: 'NOME' }, { valor: 'CPF' }, ...]
//
// Saidas (proximaSaida):
//   - Para um caso que bate: o `valor` do caso (ou '__vazio__' se valor === '').
//   - Quando nada bate: '__default__' — o ramo fallback.
//
// Comparacao: igualdade de string (===). Se quiser numerico, use IF/Code.

const { interpolar } = require('../expressoes');

function idDoCaso(valor) {
  if (valor === '' || valor === null || valor === undefined) return '__vazio__';
  return String(valor);
}

async function executar({ no, contexto }) {
  const dados = no.dados || {};
  const expressaoBruta = typeof dados.expressao === 'string' ? dados.expressao : '';
  const casos = Array.isArray(dados.casos) ? dados.casos : [];

  // Interpola a expressao contra o contexto (resolve {{caminho.dot}}).
  const valor = interpolar(expressaoBruta, contexto);

  // Procura o primeiro caso cujo `valor` casa com o resultado.
  const casoBatido = casos.find((c) => {
    const alvo = c?.valor === undefined || c?.valor === null ? '' : String(c.valor);
    return alvo === valor;
  });

  const proximaSaida = casoBatido ? idDoCaso(casoBatido.valor) : '__default__';

  return {
    saida: {
      ...(contexto.entrada || {}),
      valor,
      caso: casoBatido?.label || casoBatido?.valor || 'default',
    },
    proximaSaida,
  };
}

module.exports = { executar, idDoCaso };
