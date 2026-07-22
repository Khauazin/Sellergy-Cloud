// Helper unico de produto/preco. Toda criacao de venda, agenda ou listagem
// do catalogo deve usar `resolverPrecoVenda` em vez de ler `preco`
// diretamente — assim a regra de preco fica centralizada e auditavel.
//
// Regra (autoritativa, ver docs/regras-de-negocio.md):
//   preco = variacao.preco (preco unico de venda).

function resolverPrecoVenda(variacao) {
  if (!variacao) return 0;
  return typeof variacao.preco === 'number' ? variacao.preco : 0;
}

// Preco de venda DERIVADO do custo + lucro. VALOR = R$ fixo somado ao custo;
// PERCENTUAL = % sobre o custo. Regra unica usada pelo catalogo, pelo estoque e
// pela entrada de nota (custo muda -> preco recalcula mantendo o lucro).
// Arredonda a 2 casas.
function calcularPreco(precoCusto, lucroTipo, lucroValor) {
  const custo = Number(precoCusto) || 0;
  const lucro = Number(lucroValor) || 0;
  const bruto = lucroTipo === 'PERCENTUAL' ? custo * (1 + lucro / 100) : custo + lucro;
  return Math.round(bruto * 100) / 100;
}

// Retorna a "fonte" do preco. Mantido por compatibilidade com chamadores;
// hoje a unica fonte e o preco de venda da variacao (estoque).
function fontePrecoVenda(variacao) {
  if (!variacao) return 'INDEFINIDA';
  return 'ESTOQUE';
}

module.exports = {
  resolverPrecoVenda,
  fontePrecoVenda,
  calcularPreco,
};
