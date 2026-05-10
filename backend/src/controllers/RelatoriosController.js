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

// =====================================================================
// CRM — Funil, origem, leads parados, top produtos no funil
// =====================================================================
async function relatorioCRM(req, res) {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Tenant indefinido.' });

    const periodo = resolverPeriodo(req.query);
    const hoje = new Date();
    const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
    const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      etapas,
      leadsTodos,
      leadsCriadosNoPeriodo,
      leadsParados,
      vendasComLead,
      topProdutosFunil,
      historicoMovimentos,
    ] = await Promise.all([
      // 1. Etapas do funil (pra dar nome+ordem)
      prisma.etapaLead.findMany({
        where: { clienteId },
        orderBy: { ordem: 'asc' },
        select: { id: true, nome: true, ordem: true, cor: true },
      }),

      // 2. Todos os leads ATUAIS — pra montar o funil
      prisma.lead.findMany({
        where: { clienteId },
        select: {
          id: true,
          etapaId: true,
          valor: true,
          origem: true,
          criadoEm: true,
          atualizadoEm: true,
          ultimoContato: true,
        },
      }),

      // 3. Leads criados NO PERIODO (pra origem por periodo)
      prisma.lead.findMany({
        where: {
          clienteId,
          criadoEm: { gte: periodo.inicio, lte: periodo.fim },
        },
        select: { id: true, origem: true, valor: true },
      }),

      // 4. Leads parados — sem ultimoContato (ou criadoEm) em > 7 dias
      // Limita a 50 pra UI nao explodir.
      prisma.lead.findMany({
        where: {
          clienteId,
          OR: [
            { ultimoContato: null, criadoEm: { lt: seteDiasAtras } },
            { ultimoContato: { lt: seteDiasAtras } },
          ],
        },
        orderBy: [{ ultimoContato: 'asc' }, { criadoEm: 'asc' }],
        take: 50,
        select: {
          id: true, nome: true, telefone: true, email: true,
          etapaId: true, origem: true, valor: true,
          criadoEm: true, ultimoContato: true,
        },
      }),

      // 5. Vendas associadas a leads (pra calcular conversao por origem)
      prisma.venda.findMany({
        where: {
          clienteId,
          status: 'COMPLETED',
          leadId: { not: null },
          data: { gte: periodo.inicio, lte: periodo.fim },
        },
        select: {
          leadId: true, valor: true,
          lead: { select: { origem: true } },
        },
      }),

      // 6. Top produtos no funil (LeadVariacao) — qual produto mais aparece
      // como interesse de leads ABERTOS (sem etapa "fechada"/"perdida" — nao temos
      // status, entao por enquanto: todos os leads com produtos vinculados).
      prisma.leadVariacao.findMany({
        where: { lead: { clienteId } },
        select: {
          quantidade: true,
          variacao: {
            select: {
              id: true, nome: true, preco: true, precoCatalogo: true,
              usarPrecoCatalogo: true, imagemUrl: true,
              produto: { select: { nome: true, imagemUrl: true } },
            },
          },
        },
      }),

      // 7. Historico — pra calcular tempo medio que leads ficam em cada etapa.
      // Pega so MOVIDO (entradas em etapa) das ultimas 60 dias.
      prisma.historicoLead.findMany({
        where: {
          lead: { clienteId },
          acao: 'MOVIDO',
          criadoEm: { gte: new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { criadoEm: 'asc' },
        select: {
          leadId: true, deEtapa: true, paraEtapa: true, criadoEm: true,
        },
      }),
    ]);

    // ============== FUNIL ==============
    const funilPorEtapa = new Map();
    for (const e of etapas) {
      funilPorEtapa.set(e.id, {
        etapaId: e.id,
        nome: e.nome,
        ordem: e.ordem,
        cor: e.cor,
        leads: 0,
        valor: 0,
      });
    }
    let leadsSemEtapa = 0;
    let valorSemEtapa = 0;
    for (const l of leadsTodos) {
      if (!l.etapaId || !funilPorEtapa.has(l.etapaId)) {
        leadsSemEtapa += 1;
        valorSemEtapa += Number(l.valor || 0);
        continue;
      }
      const item = funilPorEtapa.get(l.etapaId);
      item.leads += 1;
      item.valor += Number(l.valor || 0);
    }
    const funil = [...funilPorEtapa.values()].sort((a, b) => a.ordem - b.ordem);

    // Taxa de avanco entre etapas adjacentes (etapa[i] -> etapa[i+1]):
    // % = leads_atualmente_na_etapa_seguinte / total_leads_que_passaram_pela_etapa
    // Simplificacao: usa os leads atuais (i+1) / leads em (i ou maior). Pra primeira versao.
    for (let i = 0; i < funil.length - 1; i++) {
      const aFrente = funil.slice(i + 1).reduce((acc, e) => acc + e.leads, 0);
      const total = funil.slice(i).reduce((acc, e) => acc + e.leads, 0);
      funil[i].taxaAvanco = total > 0 ? Number(((aFrente / total) * 100).toFixed(1)) : 0;
    }

    // ============== ORIGEM ==============
    // Agrega por `origem` (Telegram/WhatsApp/Manual/AI/etc.). NULL/empty -> "Manual".
    const origemMap = new Map();
    for (const l of leadsCriadosNoPeriodo) {
      const orig = (l.origem || 'Manual').trim() || 'Manual';
      if (!origemMap.has(orig)) {
        origemMap.set(orig, { origem: orig, leads: 0, valor: 0, conversoes: 0, valorConversoes: 0 });
      }
      const item = origemMap.get(orig);
      item.leads += 1;
      item.valor += Number(l.valor || 0);
    }

    // Conversao: pra cada venda do periodo com lead, marca a origem do lead
    for (const v of vendasComLead) {
      const orig = (v.lead?.origem || 'Manual').trim() || 'Manual';
      if (!origemMap.has(orig)) {
        // Pode acontecer se a venda foi feita mas o lead foi criado em periodo anterior.
        origemMap.set(orig, { origem: orig, leads: 0, valor: 0, conversoes: 0, valorConversoes: 0 });
      }
      const item = origemMap.get(orig);
      item.conversoes += 1;
      item.valorConversoes += Number(v.valor || 0);
    }
    const origens = [...origemMap.values()]
      .map((o) => ({
        ...o,
        taxaConversao: o.leads > 0 ? Number(((o.conversoes / o.leads) * 100).toFixed(1)) : null,
      }))
      .sort((a, b) => b.leads - a.leads);

    // ============== LEADS PARADOS ==============
    const etapaPorId = new Map(etapas.map((e) => [e.id, e]));
    const parados = leadsParados.map((l) => {
      const ultimo = l.ultimoContato || l.criadoEm;
      const diasParado = Math.floor((hoje.getTime() - new Date(ultimo).getTime()) / (24 * 60 * 60 * 1000));
      return {
        id: l.id,
        nome: l.nome,
        telefone: l.telefone,
        email: l.email,
        etapa: etapaPorId.get(l.etapaId)?.nome || '—',
        origem: l.origem || 'Manual',
        valor: Number(l.valor || 0),
        diasParado,
        ultimoContato: ultimo,
      };
    });

    // ============== TOP PRODUTOS NO FUNIL ==============
    const produtosFunilMap = new Map();
    for (const lv of topProdutosFunil) {
      const v = lv.variacao;
      if (!v) continue;
      const preco = v.usarPrecoCatalogo && v.precoCatalogo != null ? Number(v.precoCatalogo) : Number(v.preco || 0);
      const qtd = Math.max(1, Number(lv.quantidade) || 1);
      const valor = preco * qtd;
      const key = v.id;
      if (!produtosFunilMap.has(key)) {
        produtosFunilMap.set(key, {
          variacaoId: v.id,
          nome: v.produto?.nome || '—',
          variacao: v.nome === 'Padrão' || v.nome === 'Padrao' ? null : v.nome,
          imagemUrl: v.imagemUrl || v.produto?.imagemUrl || null,
          leads: 0,
          quantidadeTotal: 0,
          valorPotencial: 0,
        });
      }
      const item = produtosFunilMap.get(key);
      item.leads += 1;
      item.quantidadeTotal += qtd;
      item.valorPotencial += valor;
    }
    const topProdutosNoFunil = [...produtosFunilMap.values()]
      .sort((a, b) => b.valorPotencial - a.valorPotencial)
      .slice(0, 10);

    // ============== TEMPO MEDIO POR ETAPA ==============
    // Calcula com base no historico: pra cada lead, o tempo que ficou em cada
    // etapa = diferenca entre o MOVIDO de entrada na etapa e o proximo MOVIDO.
    // Pra leads ainda na etapa, conta ate hoje.
    const tempoEtapa = new Map(); // etapaNome -> { somaDias, count }
    const movPorLead = new Map();
    for (const h of historicoMovimentos) {
      if (!movPorLead.has(h.leadId)) movPorLead.set(h.leadId, []);
      movPorLead.get(h.leadId).push(h);
    }
    for (const [, lista] of movPorLead) {
      // Cada movimento define: entrada em paraEtapa em criadoEm.
      for (let i = 0; i < lista.length; i++) {
        const entrada = lista[i];
        const saida = lista[i + 1];
        const fimNaEtapa = saida ? new Date(saida.criadoEm) : hoje;
        const dias = (fimNaEtapa.getTime() - new Date(entrada.criadoEm).getTime()) / (24 * 60 * 60 * 1000);
        const nomeEtapa = entrada.paraEtapa || '—';
        if (!tempoEtapa.has(nomeEtapa)) tempoEtapa.set(nomeEtapa, { soma: 0, count: 0 });
        const t = tempoEtapa.get(nomeEtapa);
        t.soma += dias;
        t.count += 1;
      }
    }
    const tempoMedioPorEtapa = [...tempoEtapa.entries()]
      .map(([nome, { soma, count }]) => ({
        etapa: nome,
        diasMedio: count > 0 ? Number((soma / count).toFixed(1)) : 0,
        amostra: count,
      }))
      .sort((a, b) => b.diasMedio - a.diasMedio);

    // ============== TOTAIS ==============
    const totalLeadsAbertos = leadsTodos.length;
    const valorTotalFunil = leadsTodos.reduce((acc, l) => acc + Number(l.valor || 0), 0);
    const totalCriadosPeriodo = leadsCriadosNoPeriodo.length;
    const totalConversoesPeriodo = vendasComLead.length;
    const taxaConversaoGeral = totalCriadosPeriodo > 0
      ? Number(((totalConversoesPeriodo / totalCriadosPeriodo) * 100).toFixed(1))
      : null;

    res.json({
      periodo: {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString(),
      },
      totais: {
        leadsAbertos: totalLeadsAbertos,
        valorTotalFunil,
        criadosPeriodo: totalCriadosPeriodo,
        conversoesPeriodo: totalConversoesPeriodo,
        taxaConversao: taxaConversaoGeral,
        leadsSemEtapa,
        valorSemEtapa,
      },
      funil,
      origens,
      leadsParados: parados,
      topProdutosNoFunil,
      tempoMedioPorEtapa,
    });
  } catch (erro) {
    console.error('[relatorios/crm]', erro);
    res.status(500).json({ error: 'Erro ao gerar relatorio de CRM.' });
  }
}

module.exports = {
  visaoExecutiva,
  relatorioCRM,
};
