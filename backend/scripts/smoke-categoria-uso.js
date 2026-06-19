// Smoke da "Categoria por uso" (Frente B). Roda CONTRA O BANCO depois da
// migração `categoria_uso` aplicada (cd backend; npx prisma migrate dev).
//
// Prova:
//   1. filtro por uso (?uso=SERVICO / PRODUTO) traz só as do contexto certo;
//   2. sem filtro, lista todas (gestão/relatórios) — inclui as sem uso;
//   3. categoria sem uso fica null (não aparece nos dropdowns filtrados).
//
// Cliente descartável + cascade no fim. Uso: cd backend; node scripts/smoke-categoria-uso.js

const prisma = require('../src/prisma');

async function main() {
  let cid = null;
  const falhas = [];
  const ok = (c, m) => { console.log(`${c ? 'PASS ' : 'FALHA'} — ${m}`); if (!c) falhas.push(m); };

  try {
    const cli = await prisma.cliente.create({
      data: { nome: `__SMOKE_CATUSO__ ${new Date().toISOString()}`, segmento: 'SERVICO' },
    });
    cid = cli.id;

    const catServ = await prisma.categoriaFinanceira.create({ data: { clienteId: cid, nome: 'Cortes', tipo: 'RECEITA', uso: 'SERVICO' } });
    const catProd = await prisma.categoriaFinanceira.create({ data: { clienteId: cid, nome: 'Bebidas', tipo: 'RECEITA', uso: 'PRODUTO' } });
    const catNull = await prisma.categoriaFinanceira.create({ data: { clienteId: cid, nome: 'Antiga (sem uso)', tipo: 'RECEITA' } });

    const soServ = await prisma.categoriaFinanceira.findMany({ where: { clienteId: cid, uso: { in: ['SERVICO'] } } });
    ok(soServ.length === 1 && soServ[0].id === catServ.id, 'filtro uso=SERVICO traz só a de serviço');

    const soProd = await prisma.categoriaFinanceira.findMany({ where: { clienteId: cid, uso: { in: ['PRODUTO'] } } });
    ok(soProd.length === 1 && soProd[0].id === catProd.id, 'filtro uso=PRODUTO traz só a de produto');

    const caixaDespesa = await prisma.categoriaFinanceira.findMany({ where: { clienteId: cid, uso: { in: ['CAIXA', 'DESPESA'] } } });
    ok(caixaDespesa.length === 0, 'nada de SERVICO/PRODUTO aparece no filtro CAIXA/DESPESA');

    const todas = await prisma.categoriaFinanceira.findMany({ where: { clienteId: cid } });
    ok(todas.length === 3, 'sem filtro, lista todas (gestão/relatórios) — inclui a sem uso');

    ok(catNull.uso === null, 'categoria sem uso fica null (some dos dropdowns filtrados)');
  } catch (e) {
    console.error('ERRO inesperado:', e.code ? `${e.code} ${e.message}` : e.message);
    falhas.push('exceção: ' + e.message);
  } finally {
    if (cid) {
      await prisma.cliente.delete({ where: { id: cid } })
        .then(() => console.log('limpeza: cliente de teste removido (cascade).'))
        .catch((e) => console.error('ATENÇÃO: limpeza falhou, remova manualmente', cid, '-', e.message));
    }
    await prisma.$disconnect();
  }

  console.log(falhas.length === 0 ? '\n>>> SMOKE PASSOU ✅' : `\n>>> SMOKE FALHOU (${falhas.length}) ❌`);
  process.exitCode = falhas.length === 0 ? 0 : 1;
}

main();
