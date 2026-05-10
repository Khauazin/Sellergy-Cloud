// Controller dos relatorios consolidados do tenant.
// Filosofia: 1 endpoint por aba do UI (visao-executiva, financeiro, vendas...).
// Cada um faz queries em paralelo e devolve um JSON pronto pro front consumir.
// Nunca expoe dados de outro tenant — todas as queries filtram por clienteId
// do JWT (ou do query.clienteId quando o solicitante e ADMIN).

const prisma = require('../prisma');

// =====================================================================
// Helpers de periodo
// =====================================================================
// O front passa `?inicio=ISO&fim=ISO` (ou um dos presets).
// Default: ultimos 30 dias (incluindo hoje), exclusive de fim+1d.
function resolverPeriodo(query) {
  const fim = query.fim ? new Date(query.fim) : new Date();
  const inicio = query.inicio ? new Date(query.inicio) : (() => {
    const d = new Date(fim);
    d.setDate(d.getDate() - 29); // 30 dias inclusivos
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  // fim sempre vai ate fim do dia
  const fimDia = new Date(fim);
  fimDia.setHours(23, 59, 59, 999);
  return { inicio, fim: fimDia };
}

// Calcula periodo anterior do mesmo tamanho (pra comparar "vs anterior").
function periodoAnterior({ inicio, fim }) {
  const ms = fim.getTime() - inicio.getTime();
  return {
    inicio: new Date(inicio.getTime() - ms - 1),
    fim: new Date(inicio.getTime() - 1),
  };
}

// =====================================================================
// VISAO EXECUTIVA — KPIs consolidados de todos os modulos
// =====================================================================
async function visaoExecutiva(req, res) {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Tenant indefinido.' });

    const periodo = resolverPeriodo(req.query);
    const anterior = periodoAnterior(periodo);
    const hoje = new Date();

    // ============== Queries em paralelo ==============
    const [
      receitaPeriodo, despesaPeriodo,
      receitaAnterior, despesaAnterior,
      saldoEmRisco,
      cmvPeriodo,
      leadsCriados, leadsAnterior,
      vendasPeriodo,
      topProdutos,
    ] = await Promise.all([
      // 1. Receita PAGA no periodo
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          clienteId,
          tipo: 'RECEITA',
          status: 'PAGO',
          dataPagamento: { gte: periodo.inicio, lte: periodo.fim },
        },
        _sum: { valor: true },
        _count: true,
      }),

      // 2. Despesa PAGA no periodo
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          clienteId,
          tipo: 'DESPESA',
          status: 'PAGO',
          dataPagamento: { gte: periodo.inicio, lte: periodo.fim },
        },
        _sum: { valor: true },
      }),

      // 3-4. Receita/Despesa do periodo anterior (pra delta)
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          clienteId,
          tipo: 'RECEITA',
          status: 'PAGO',
          dataPagamento: { gte: anterior.inicio, lte: anterior.fim },
        },
        _sum: { valor: true },
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          clienteId,
          tipo: 'DESPESA',
          status: 'PAGO',
          dataPagamento: { gte: anterior.inicio, lte: anterior.fim },
        },
        _sum: { valor: true },
      }),

      // 5. Saldo em risco (receitas pendentes vencidas, hoje)
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          clienteId,
          tipo: 'RECEITA',
          status: 'PENDENTE',
          dataVencimento: { lt: hoje },
        },
        _sum: { valor: true },
        _count: true,
      }),

      // 6. CMV no periodo: soma de (qtd × precoCusto) das movimentacoes VENDA.
      // Como groupBy nao calcula expressao, busca raw e soma no JS.
      prisma.movimentacaoEstoque.findMany({
        where: {
          tipo: 'VENDA',
          data: { gte: periodo.inicio, lte: periodo.fim },
          variacao: { produto: { clienteId } },
        },
        select: {
          quantidade: true,
          variacao: { select: { precoCusto: true } },
        },
      }),

      // 7. Leads criados no periodo
      prisma.lead.count({
        where: { clienteId, criadoEm: { gte: periodo.inicio, lte: periodo.fim } },
      }),

      // 8. Leads do periodo anterior (delta)
      prisma.lead.count({
        where: { clienteId, criadoEm: { gte: anterior.inicio, lte: anterior.fim } },
      }),

      // 9. Vendas COMPLETED no periodo (com lead/canal pra agregacoes futuras)
      prisma.venda.findMany({
        where: {
          clienteId,
          status: 'COMPLETED',
          data: { gte: periodo.inicio, lte: periodo.fim },
        },
        select: { id: true, valor: true },
      }),

      // 10. Top produtos vendidos (qtd e valor) — agrega no JS
      prisma.movimentacaoEstoque.findMany({
        where: {
          tipo: 'VENDA',
          data: { gte: periodo.inicio, lte: periodo.fim },
          variacao: { produto: { clienteId } },
        },
        select: {
          quantidade: true,
          variacao: {
            select: {
              id: true,
              nome: true,
              preco: true,
              precoCusto: true,
              imagemUrl: true,
              produto: { select: { id: true, nome: true, imagemUrl: true } },
            },
          },
        },
      }),
    ]);

    // ============== Agregacoes/calculos ==============
    const totalReceita = receitaPeriodo._sum.valor || 0;
    const totalDespesa = despesaPeriodo._sum.valor || 0;
    const lucroLiquido = totalReceita - totalDespesa;
    const margemLiquida = totalReceita > 0 ? (lucroLiquido / totalReceita) * 100 : 0;

    const totalReceitaAnterior = receitaAnterior._sum.valor || 0;
    const totalDespesaAnterior = despesaAnterior._sum.valor || 0;
    const lucroAnterior = totalReceitaAnterior - totalDespesaAnterior;
    const deltaReceita = calcularDelta(totalReceita, totalReceitaAnterior);
    const deltaLucro = calcularDelta(lucroLiquido, lucroAnterior);
    const deltaLeads = calcularDelta(leadsCriados, leadsAnterior);

    // CMV: soma absoluta (qtd e negativa em VENDA, abs) × precoCusto
    let cmvTotal = 0;
    for (const m of cmvPeriodo) {
      const qtd = Math.abs(m.quantidade || 0);
      const custo = Number(m.variacao?.precoCusto || 0);
      cmvTotal += qtd * custo;
    }
    const cmvPercentual = totalReceita > 0 ? (cmvTotal / totalReceita) * 100 : 0;
    const lucroBruto = totalReceita - cmvTotal;

    // Vendas: contagem + ticket medio
    const totalVendas = vendasPeriodo.length;
    const valorTotalVendas = vendasPeriodo.reduce((acc, v) => acc + Number(v.valor || 0), 0);
    const ticketMedio = totalVendas > 0 ? valorTotalVendas / totalVendas : 0;

    // Top 5 produtos: agrega por variacaoId
    const mapaProdutos = new Map();
    for (const m of topProdutos) {
      const v = m.variacao;
      if (!v) continue;
      const qtd = Math.abs(m.quantidade || 0);
      const valor = qtd * Number(v.preco || 0);
      const key = v.id;
      if (!mapaProdutos.has(key)) {
        mapaProdutos.set(key, {
          variacaoId: v.id,
          produtoId: v.produto?.id,
          nome: v.produto?.nome || '—',
          variacao: v.nome === 'Padrão' || v.nome === 'Padrao' ? null : v.nome,
          imagemUrl: v.imagemUrl || v.produto?.imagemUrl || null,
          quantidade: 0,
          valor: 0,
        });
      }
      const item = mapaProdutos.get(key);
      item.quantidade += qtd;
      item.valor += valor;
    }
    const top5 = [...mapaProdutos.values()]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    res.json({
      periodo: {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString(),
      },
      faturamento: {
        valor: totalReceita,
        delta: deltaReceita,
      },
      lucroLiquido: {
        valor: lucroLiquido,
        margem: Number(margemLiquida.toFixed(2)),
        delta: deltaLucro,
      },
      cmv: {
        valor: cmvTotal,
        percentual: Number(cmvPercentual.toFixed(2)),
        lucroBruto,
      },
      caixa: {
        receitaPaga: totalReceita,
        despesaPaga: totalDespesa,
        saldoPeriodo: lucroLiquido,
        emRisco: saldoEmRisco._sum.valor || 0,
        emRiscoQtd: saldoEmRisco._count || 0,
      },
      leads: {
        criados: leadsCriados,
        delta: deltaLeads,
      },
      vendas: {
        total: totalVendas,
        valor: valorTotalVendas,
        ticketMedio: Number(ticketMedio.toFixed(2)),
      },
      topProdutos: top5,
    });
  } catch (erro) {
    console.error('[relatorios/visao-executiva]', erro);
    res.status(500).json({ error: 'Erro ao gerar visao executiva.' });
  }
}

// Delta percentual entre dois numeros, com tratamento de divisao por zero.
function calcularDelta(atual, anterior) {
  if (anterior === 0) {
    return atual === 0 ? 0 : null; // null = "sem comparacao" (anterior zerado)
  }
  return Number((((atual - anterior) / Math.abs(anterior)) * 100).toFixed(1));
}

module.exports = {
  visaoExecutiva,
};
