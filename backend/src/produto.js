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

// Retorna a "fonte" do preco. Mantido por compatibilidade com chamadores;
// hoje a unica fonte e o preco de venda da variacao (estoque).
function fontePrecoVenda(variacao) {
  if (!variacao) return 'INDEFINIDA';
  return 'ESTOQUE';
}

module.exports = {
  resolverPrecoVenda,
  fontePrecoVenda,
};
