// Helper unico de produto/preco. Toda criacao de venda, agenda ou listagem
// publica do catalogo deve usar `resolverPrecoVenda` em vez de ler `preco`
// diretamente — assim a regra de "catalogo sobrescreve estoque" fica
// centralizada e auditavel.
//
// Regra (autoritativa, ver docs/regras-de-negocio.md):
//   SE  variacao.usarPrecoCatalogo === true
//       E  variacao.precoCatalogo != null e > 0
//   THEN preco = variacao.precoCatalogo
//   ELSE preco = variacao.preco

function resolverPrecoVenda(variacao) {
  if (!variacao) return 0;
  const usaCat = variacao.usarPrecoCatalogo === true;
  const precoCat = typeof variacao.precoCatalogo === 'number' ? variacao.precoCatalogo : 0;
  if (usaCat && precoCat > 0) return precoCat;
  return typeof variacao.preco === 'number' ? variacao.preco : 0;
}

// Retorna a "fonte" do preco (util pra UI mostrar de onde veio).
function fontePrecoVenda(variacao) {
  if (!variacao) return 'INDEFINIDA';
  const usaCat = variacao.usarPrecoCatalogo === true;
  const precoCat = typeof variacao.precoCatalogo === 'number' ? variacao.precoCatalogo : 0;
  if (usaCat && precoCat > 0) return 'CATALOGO';
  return 'ESTOQUE';
}

module.exports = {
  resolverPrecoVenda,
  fontePrecoVenda,
};
