// Helper de retencao de execucoes.
//
// Apaga registros de Execucao mais antigos que `diasRetencaoSucesso` (status
// SUCESSO) ou `diasRetencaoErro` (status ERRO/CANCELADA), agrupado por fluxo.
// FK CASCADE em `execucoes_nos` limpa os filhos automaticamente.
// Job sob risco de timeout em volumes grandes — fazemos em lotes.

const prisma = require('./prisma');

const TAMANHO_LOTE = 500;

async function apagarLote(where) {
  let total = 0;
  // Loop ate nao haver mais ids para apagar.
  while (true) {
    const ids = await prisma.execucao.findMany({
      where,
      select: { id: true },
      take: TAMANHO_LOTE,
    });
    if (ids.length === 0) break;
    const r = await prisma.execucao.deleteMany({
      where: { id: { in: ids.map((e) => e.id) } },
    });
    total += r.count;
    if (ids.length < TAMANHO_LOTE) break;
  }
  return total;
}

async function aplicarRetencaoExecucoes() {
  const fluxos = await prisma.fluxo.findMany({
    select: { id: true, diasRetencaoSucesso: true, diasRetencaoErro: true, nome: true },
  });

  let totalSucesso = 0;
  let totalErro = 0;

  for (const fluxo of fluxos) {
    const limiteSucesso = new Date(Date.now() - fluxo.diasRetencaoSucesso * 86_400_000);
    const limiteErro = new Date(Date.now() - fluxo.diasRetencaoErro * 86_400_000);

    totalSucesso += await apagarLote({
      fluxoId: fluxo.id,
      status: 'SUCESSO',
      iniciadaEm: { lt: limiteSucesso },
    });

    totalErro += await apagarLote({
      fluxoId: fluxo.id,
      status: { in: ['ERRO', 'CANCELADA'] },
      iniciadaEm: { lt: limiteErro },
    });
  }

  return { totalSucesso, totalErro };
}

module.exports = { aplicarRetencaoExecucoes };
