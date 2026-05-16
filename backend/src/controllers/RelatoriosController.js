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

// Agrega lancamentos PAGOS de um tipo (RECEITA/DESPESA) num intervalo.
// Retorna a Promise do prisma.aggregate — pode ser usado em Promise.all.
// Se `contar=true`, inclui `_count: true` (usado em KPIs que mostram qtd).
function somarLancamentosPagos({ clienteId, tipo, inicio, fim, contar = false }) {
  return prisma.lancamentoFinanceiro.aggregate({
    where: {
      clienteId,
      tipo,
      status: 'PAGO',
      dataPagamento: { gte: inicio, lte: fim },
    },
    _sum: { valor: true },
    ...(contar ? { _count: true } : {}),
  });
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
      // 1-4. Receita/Despesa PAGAS — periodo atual (com _count) + anterior (pra delta)
      somarLancamentosPagos({ clienteId, tipo: 'RECEITA', inicio: periodo.inicio, fim: periodo.fim, contar: true }),
      somarLancamentosPagos({ clienteId, tipo: 'DESPESA', inicio: periodo.inicio, fim: periodo.fim }),
      somarLancamentosPagos({ clienteId, tipo: 'RECEITA', inicio: anterior.inicio, fim: anterior.fim }),
      somarLancamentosPagos({ clienteId, tipo: 'DESPESA', inicio: anterior.inicio, fim: anterior.fim }),

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

    // Filtros extras (opcionais).
    const filtroEtapa = typeof req.query.etapaId === 'string' && req.query.etapaId ? req.query.etapaId : null;
    const filtroOrigem = typeof req.query.origem === 'string' && req.query.origem ? req.query.origem : null;

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
        where: {
          clienteId,
          ...(filtroEtapa ? { etapaId: filtroEtapa } : {}),
          ...(filtroOrigem ? { origem: filtroOrigem } : {}),
        },
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
          ...(filtroEtapa ? { etapaId: filtroEtapa } : {}),
          ...(filtroOrigem ? { origem: filtroOrigem } : {}),
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
          ...(filtroEtapa ? { etapaId: filtroEtapa } : {}),
          ...(filtroOrigem ? { origem: filtroOrigem } : {}),
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

// =====================================================================
// FINANCEIRO — DRE, fluxo de caixa diario, aging, por categoria
// =====================================================================
async function relatorioFinanceiro(req, res) {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Tenant indefinido.' });

    const periodo = resolverPeriodo(req.query);
    const hoje = new Date();

    // Filtros extras
    const filtroCategoria = typeof req.query.categoriaId === 'string' && req.query.categoriaId ? req.query.categoriaId : null;
    const filtroTipo = req.query.tipo === 'RECEITA' || req.query.tipo === 'DESPESA' ? req.query.tipo : null;

    const [
      lancamentosPagos,        // tudo que foi PAGO no periodo (DRE + por categoria + fluxo)
      receitasPendentesVencidas, // pra aging (vence em datas passadas, nao paga)
      kpis,                     // contadores resumidos
    ] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where: {
          clienteId,
          status: 'PAGO',
          dataPagamento: { gte: periodo.inicio, lte: periodo.fim },
          ...(filtroCategoria ? { categoriaId: filtroCategoria } : {}),
          ...(filtroTipo ? { tipo: filtroTipo } : {}),
        },
        include: { categoria: true },
        orderBy: { dataPagamento: 'asc' },
      }),

      // Aging so faz sentido pra receitas — nao filtra por tipo aqui, mas
      // categoria filtra se passada.
      prisma.lancamentoFinanceiro.findMany({
        where: {
          clienteId,
          tipo: 'RECEITA',
          status: 'PENDENTE',
          dataVencimento: { lt: hoje },
          ...(filtroCategoria ? { categoriaId: filtroCategoria } : {}),
        },
        select: {
          id: true,
          descricao: true,
          valor: true,
          dataVencimento: true,
          lead: { select: { nome: true } },
        },
      }),

      // Indice de eficacia (mesma logica do dashboard financeiro)
      (async () => {
        const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [recuperados, totalVencidosSemana, saldoEmRiscoAg] = await Promise.all([
          prisma.lancamentoFinanceiro.count({
            where: { clienteId, status: 'PAGO', atualizadoEm: { gte: seteDiasAtras }, dataVencimento: { lt: hoje } },
          }),
          prisma.lancamentoFinanceiro.count({
            where: { clienteId, tipo: 'RECEITA', dataVencimento: { gte: seteDiasAtras, lt: hoje } },
          }),
          prisma.lancamentoFinanceiro.aggregate({
            where: { clienteId, tipo: 'RECEITA', status: 'PENDENTE', dataVencimento: { lt: hoje } },
            _sum: { valor: true }, _count: true,
          }),
        ]);
        const indiceEficacia = totalVencidosSemana > 0 ? (recuperados / totalVencidosSemana) * 100 : 0;
        const saldoEmRisco = saldoEmRiscoAg._sum.valor || 0;
        return {
          saldoEmRisco,
          saldoEmRiscoQtd: saldoEmRiscoAg._count || 0,
          indiceEficacia: Number(indiceEficacia.toFixed(1)),
          previsaoRecuperacao: Number((saldoEmRisco * (indiceEficacia / 100)).toFixed(2)),
        };
      })(),
    ]);

    // ============== DRE ==============
    // Categorias com "venda" ou "imposto" no nome viram despesa variavel.
    // O resto vira despesa fixa. (Mesma regra do FinanceiroController.relatorioDRE.)
    const dre = { receitaBruta: 0, despesasVariaveis: 0, despesasFixas: 0, resultadoLiquido: 0 };
    for (const l of lancamentosPagos) {
      const cat = l.categoria?.nome?.toLowerCase() || '';
      const valor = Number(l.valor || 0);
      if (l.tipo === 'RECEITA') dre.receitaBruta += valor;
      else if (cat.includes('venda') || cat.includes('imposto')) dre.despesasVariaveis += valor;
      else dre.despesasFixas += valor;
    }
    dre.resultadoLiquido = dre.receitaBruta - dre.despesasVariaveis - dre.despesasFixas;
    dre.margemLiquida = dre.receitaBruta > 0 ? Number(((dre.resultadoLiquido / dre.receitaBruta) * 100).toFixed(2)) : 0;

    // ============== FLUXO DE CAIXA POR DIA ==============
    // Agrega receita/despesa por dia (formato YYYY-MM-DD). Saldo acumulado
    // a partir do inicio do periodo.
    const fluxoMap = new Map();
    for (const l of lancamentosPagos) {
      const data = new Date(l.dataPagamento || l.dataVencimento);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
      if (!fluxoMap.has(chave)) {
        fluxoMap.set(chave, { data: chave, receita: 0, despesa: 0 });
      }
      const item = fluxoMap.get(chave);
      const valor = Number(l.valor || 0);
      if (l.tipo === 'RECEITA') item.receita += valor;
      else item.despesa += valor;
    }
    const fluxoOrdenado = [...fluxoMap.values()].sort((a, b) => a.data.localeCompare(b.data));
    let acumulado = 0;
    for (const f of fluxoOrdenado) {
      f.saldoDia = f.receita - f.despesa;
      acumulado += f.saldoDia;
      f.saldoAcumulado = acumulado;
    }

    // ============== AGING DE INADIMPLENCIA ==============
    // Agrupa receitas pendentes vencidas em faixas de dias.
    const aging = {
      'Vencidas 1-7 dias': { faixa: '1-7 dias', valor: 0, qtd: 0, itens: [] },
      'Vencidas 8-30 dias': { faixa: '8-30 dias', valor: 0, qtd: 0, itens: [] },
      'Vencidas 31-60 dias': { faixa: '31-60 dias', valor: 0, qtd: 0, itens: [] },
      'Vencidas 60+ dias': { faixa: '60+ dias', valor: 0, qtd: 0, itens: [] },
    };
    for (const r of receitasPendentesVencidas) {
      const dias = Math.floor((hoje.getTime() - new Date(r.dataVencimento).getTime()) / (24 * 60 * 60 * 1000));
      let bucket;
      if (dias <= 7) bucket = aging['Vencidas 1-7 dias'];
      else if (dias <= 30) bucket = aging['Vencidas 8-30 dias'];
      else if (dias <= 60) bucket = aging['Vencidas 31-60 dias'];
      else bucket = aging['Vencidas 60+ dias'];
      bucket.valor += Number(r.valor || 0);
      bucket.qtd += 1;
      // Mantem so os primeiros 5 de cada faixa pra resposta nao explodir
      if (bucket.itens.length < 5) {
        bucket.itens.push({
          id: r.id,
          descricao: r.descricao,
          valor: Number(r.valor || 0),
          dataVencimento: r.dataVencimento,
          lead: r.lead?.nome || null,
          diasAtraso: dias,
        });
      }
    }
    const agingArray = [
      aging['Vencidas 1-7 dias'],
      aging['Vencidas 8-30 dias'],
      aging['Vencidas 31-60 dias'],
      aging['Vencidas 60+ dias'],
    ];

    // ============== POR CATEGORIA ==============
    // Top categorias receita e top categorias despesa.
    const catReceita = new Map();
    const catDespesa = new Map();
    for (const l of lancamentosPagos) {
      const nome = l.categoria?.nome || 'Sem categoria';
      const mapa = l.tipo === 'RECEITA' ? catReceita : catDespesa;
      if (!mapa.has(nome)) mapa.set(nome, { categoria: nome, valor: 0, qtd: 0 });
      const item = mapa.get(nome);
      item.valor += Number(l.valor || 0);
      item.qtd += 1;
    }
    const porCategoriaReceita = [...catReceita.values()].sort((a, b) => b.valor - a.valor);
    const porCategoriaDespesa = [...catDespesa.values()].sort((a, b) => b.valor - a.valor);

    // ============== POR METODO DE PAGAMENTO ==============
    // So receitas (mais util pra entender mix de cobranca).
    const metodoMap = new Map();
    for (const l of lancamentosPagos) {
      if (l.tipo !== 'RECEITA') continue;
      const m = l.metodoPagamento || 'Não informado';
      if (!metodoMap.has(m)) metodoMap.set(m, { metodo: m, valor: 0, qtd: 0 });
      const item = metodoMap.get(m);
      item.valor += Number(l.valor || 0);
      item.qtd += 1;
    }
    const porMetodo = [...metodoMap.values()].sort((a, b) => b.valor - a.valor);

    res.json({
      periodo: {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString(),
      },
      kpis,
      dre,
      fluxoDiario: fluxoOrdenado,
      aging: agingArray,
      porCategoriaReceita,
      porCategoriaDespesa,
      porMetodo,
    });
  } catch (erro) {
    console.error('[relatorios/financeiro]', erro);
    res.status(500).json({ error: 'Erro ao gerar relatorio financeiro.' });
  }
}

// =====================================================================
// VENDAS — KPIs, canal, sazonalidade (dia x hora), categorias, lucro
// =====================================================================
async function relatorioVendas(req, res) {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Tenant indefinido.' });

    const periodo = resolverPeriodo(req.query);

    // Filtros extras
    const filtroOrigem = typeof req.query.origem === 'string' && req.query.origem ? req.query.origem : null;
    const filtroMetodo = typeof req.query.metodoPagamento === 'string' && req.query.metodoPagamento ? req.query.metodoPagamento : null;

    // Pra filtrar por origem da venda (que vem do lead): precisa join com Lead.
    const filtroLead = filtroOrigem ? { lead: { is: { origem: filtroOrigem } } } : {};

    const [vendas, movimentacoesVenda, leadsCriadosPeriodo] = await Promise.all([
      // Todas vendas COMPLETED no periodo, com lead pra agregar por origem.
      prisma.venda.findMany({
        where: {
          clienteId,
          status: 'COMPLETED',
          data: { gte: periodo.inicio, lte: periodo.fim },
          ...(filtroMetodo ? { metodoPagamento: filtroMetodo } : {}),
          ...filtroLead,
        },
        include: {
          lead: { select: { id: true, origem: true } },
        },
        orderBy: { data: 'asc' },
      }),

      // Movimentacoes VENDA do periodo — usadas pra CMV e categoria.
      prisma.movimentacaoEstoque.findMany({
        where: {
          tipo: 'VENDA',
          vendaId: { not: null },
          data: { gte: periodo.inicio, lte: periodo.fim },
          variacao: { produto: { clienteId } },
          ...(filtroOrigem || filtroMetodo
            ? { venda: {
                ...(filtroMetodo ? { metodoPagamento: filtroMetodo } : {}),
                ...filtroLead,
              } }
            : {}),
        },
        include: {
          variacao: {
            select: {
              id: true, nome: true, preco: true, precoCusto: true, imagemUrl: true,
              produto: {
                select: {
                  id: true, nome: true, imagemUrl: true,
                  categoria: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
      }),

      // Leads criados no periodo — pra calcular taxa de conversao
      prisma.lead.count({
        where: { clienteId, criadoEm: { gte: periodo.inicio, lte: periodo.fim } },
      }),
    ]);

    // ============== KPIs ==============
    const totalVendas = vendas.length;
    const valorTotalVendas = vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0);
    const ticketMedio = totalVendas > 0 ? valorTotalVendas / totalVendas : 0;

    // CMV por venda — soma (qtd × precoCusto) das movimentacoes de cada vendaId.
    const cmvPorVenda = new Map();
    for (const m of movimentacoesVenda) {
      if (!m.vendaId) continue;
      const qtd = Math.abs(m.quantidade || 0);
      const custo = Number(m.variacao?.precoCusto || 0);
      const cmv = qtd * custo;
      cmvPorVenda.set(m.vendaId, (cmvPorVenda.get(m.vendaId) || 0) + cmv);
    }

    // Lucro bruto = receita - CMV
    let lucroBrutoTotal = 0;
    let cmvTotal = 0;
    for (const v of vendas) {
      const cmv = cmvPorVenda.get(v.id) || 0;
      lucroBrutoTotal += Number(v.valor || 0) - cmv;
      cmvTotal += cmv;
    }
    const margemBruta = valorTotalVendas > 0 ? (lucroBrutoTotal / valorTotalVendas) * 100 : 0;

    // Conversao lead -> venda. Vendas com leadId vinculado / leads criados.
    const vendasComLead = vendas.filter((v) => v.leadId).length;
    const taxaConversao = leadsCriadosPeriodo > 0
      ? Number(((vendasComLead / leadsCriadosPeriodo) * 100).toFixed(1))
      : null;

    // ============== POR CANAL/ORIGEM ==============
    const canalMap = new Map();
    for (const v of vendas) {
      const origem = (v.lead?.origem || 'Manual').trim() || 'Manual';
      if (!canalMap.has(origem)) {
        canalMap.set(origem, { origem, qtd: 0, valor: 0, lucro: 0 });
      }
      const item = canalMap.get(origem);
      item.qtd += 1;
      item.valor += Number(v.valor || 0);
      item.lucro += Number(v.valor || 0) - (cmvPorVenda.get(v.id) || 0);
    }
    const porCanal = [...canalMap.values()].sort((a, b) => b.valor - a.valor);

    // ============== SAZONALIDADE — dia da semana x hora ==============
    // Matriz 7 (dom-sab) x 24 (0-23). Cada celula: qtd e valor.
    const matriz = [];
    for (let d = 0; d < 7; d++) {
      const linha = [];
      for (let h = 0; h < 24; h++) {
        linha.push({ diaSemana: d, hora: h, qtd: 0, valor: 0 });
      }
      matriz.push(linha);
    }
    for (const v of vendas) {
      const data = new Date(v.data);
      const dia = data.getDay();   // 0 = domingo
      const hora = data.getHours();
      matriz[dia][hora].qtd += 1;
      matriz[dia][hora].valor += Number(v.valor || 0);
    }
    // Achata e devolve. Tambem calcula maxValor pra UI normalizar a cor.
    let maxValorCelula = 0;
    const celulas = [];
    for (const linha of matriz) {
      for (const cel of linha) {
        if (cel.valor > maxValorCelula) maxValorCelula = cel.valor;
        celulas.push(cel);
      }
    }

    // ============== POR CATEGORIA ==============
    const catMap = new Map();
    for (const m of movimentacoesVenda) {
      const cat = m.variacao?.produto?.categoria?.nome || 'Sem categoria';
      const qtd = Math.abs(m.quantidade || 0);
      const valor = qtd * Number(m.variacao?.preco || 0);
      const custo = qtd * Number(m.variacao?.precoCusto || 0);
      if (!catMap.has(cat)) {
        catMap.set(cat, { categoria: cat, qtd: 0, valor: 0, custo: 0 });
      }
      const item = catMap.get(cat);
      item.qtd += qtd;
      item.valor += valor;
      item.custo += custo;
    }
    const porCategoria = [...catMap.values()]
      .map((c) => ({
        ...c,
        lucro: c.valor - c.custo,
        margem: c.valor > 0 ? Number((((c.valor - c.custo) / c.valor) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // ============== POR METODO DE PAGAMENTO ==============
    const metodoMap = new Map();
    for (const v of vendas) {
      const m = v.metodoPagamento || 'Não informado';
      if (!metodoMap.has(m)) metodoMap.set(m, { metodo: m, qtd: 0, valor: 0 });
      const item = metodoMap.get(m);
      item.qtd += 1;
      item.valor += Number(v.valor || 0);
    }
    const porMetodo = [...metodoMap.values()].sort((a, b) => b.valor - a.valor);

    // ============== TOP 10 VENDAS MAIS LUCRATIVAS ==============
    // Agrupa info da venda + cmv pra ordenar por lucro absoluto.
    // Faz 1 lookup extra de produtos vinculados pra mostrar nome.
    const movMap = new Map();
    for (const m of movimentacoesVenda) {
      if (!m.vendaId) continue;
      if (!movMap.has(m.vendaId)) movMap.set(m.vendaId, []);
      movMap.get(m.vendaId).push(m);
    }
    const topVendas = vendas.map((v) => {
      const cmv = cmvPorVenda.get(v.id) || 0;
      const lucro = Number(v.valor || 0) - cmv;
      const margem = v.valor > 0 ? (lucro / Number(v.valor)) * 100 : 0;
      const itens = movMap.get(v.id) || [];
      // Resumo dos produtos da venda (primeiro item ou "X produtos")
      let descricao = '—';
      if (itens.length === 1) {
        const v0 = itens[0].variacao;
        const ehPad = !v0?.nome || v0.nome === 'Padrão' || v0.nome === 'Padrao';
        descricao = `${v0?.produto?.nome}${ehPad ? '' : ' · ' + v0.nome}`;
      } else if (itens.length > 1) {
        descricao = `${itens.length} produtos`;
      }
      return {
        id: v.id,
        data: v.data,
        valor: Number(v.valor || 0),
        cmv,
        lucro,
        margem: Number(margem.toFixed(1)),
        descricao,
      };
    });
    const top10MaisLucrativas = [...topVendas].sort((a, b) => b.lucro - a.lucro).slice(0, 10);
    const top10MenosLucrativas = [...topVendas].sort((a, b) => a.lucro - b.lucro).slice(0, 10);

    res.json({
      periodo: {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString(),
      },
      kpis: {
        totalVendas,
        valorTotal: valorTotalVendas,
        ticketMedio: Number(ticketMedio.toFixed(2)),
        lucroBruto: lucroBrutoTotal,
        cmvTotal,
        margemBruta: Number(margemBruta.toFixed(2)),
        leadsCriadosPeriodo,
        vendasComLead,
        taxaConversao,
      },
      porCanal,
      sazonalidade: {
        celulas,
        maxValor: maxValorCelula,
      },
      porCategoria,
      porMetodo,
      top10MaisLucrativas,
      top10MenosLucrativas,
    });
  } catch (erro) {
    console.error('[relatorios/vendas]', erro);
    res.status(500).json({ error: 'Erro ao gerar relatorio de vendas.' });
  }
}

// =====================================================================
// ESTOQUE & CMV — patrimonio, margem, curva ABC, parado, reposicao
// =====================================================================
async function relatorioEstoque(req, res) {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Tenant indefinido.' });

    const periodo = resolverPeriodo(req.query);
    const hoje = new Date();

    // Filtros extras — categoria do produto
    const filtroCategoria = typeof req.query.categoriaId === 'string' && req.query.categoriaId ? req.query.categoriaId : null;
    const filtroProduto = filtroCategoria ? { categoriaId: filtroCategoria } : {};

    const [variacoes, movimentacoesPeriodo, ultimasMovimentacoes] = await Promise.all([
      // Todas variacoes do tenant + categoria
      prisma.variacaoProduto.findMany({
        where: { produto: { clienteId, ...filtroProduto } },
        include: {
          produto: {
            select: {
              id: true, nome: true, tipo: true, imagemUrl: true, visibilidade: true,
              categoria: { select: { id: true, nome: true } },
            },
          },
        },
      }),

      // Movimentacoes no periodo (pra ABC, lucro, fluxo)
      prisma.movimentacaoEstoque.findMany({
        where: {
          data: { gte: periodo.inicio, lte: periodo.fim },
          variacao: { produto: { clienteId, ...filtroProduto } },
        },
        select: {
          tipo: true, quantidade: true, data: true, vendaId: true,
          variacao: {
            select: {
              id: true, nome: true, preco: true, precoCusto: true, imagemUrl: true,
              produto: { select: { id: true, nome: true, imagemUrl: true } },
            },
          },
        },
      }),

      // Ultima movimentacao por variacao (pra "estoque parado")
      // Pega a mais recente de cada variacao do tenant.
      prisma.movimentacaoEstoque.groupBy({
        by: ['variacaoId'],
        where: { variacao: { produto: { clienteId, ...filtroProduto } } },
        _max: { data: true },
      }),
    ]);

    // ============== KPIs ==============
    const fisicos = variacoes.filter((v) => v.produto?.tipo === 'FISICO');
    let patrimonioImobilizado = 0;
    let valorVarejo = 0;
    let itensAbaixoMinimo = 0;
    let itensZerados = 0;
    for (const v of fisicos) {
      const qtd = Number(v.estoqueAtual || 0);
      const custo = Number(v.precoCusto || 0);
      patrimonioImobilizado += qtd * custo;
      valorVarejo += qtd * Number(v.preco || 0);
      if (v.estoqueMinimo != null && qtd < v.estoqueMinimo) itensAbaixoMinimo += 1;
      if (qtd <= 0) itensZerados += 1;
    }
    const indiceRuptura = fisicos.length > 0
      ? Number(((itensZerados / fisicos.length) * 100).toFixed(1))
      : 0;
    const lucroPotencialEstoque = valorVarejo - patrimonioImobilizado;

    // ============== MARGEM POR PRODUTO ==============
    const margemPorVariacao = variacoes.map((v) => {
      const preco = Number(v.preco || 0);
      const custo = Number(v.precoCusto || 0);
      const margem = preco - custo;
      const margemPct = preco > 0 ? (margem / preco) * 100 : 0;
      const ehVar = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
      return {
        variacaoId: v.id,
        produtoId: v.produto?.id,
        nome: v.produto?.nome,
        variacao: ehVar ? null : v.nome,
        categoria: v.produto?.categoria?.nome || 'Sem categoria',
        imagemUrl: v.imagemUrl || v.produto?.imagemUrl || null,
        preco,
        precoCusto: custo,
        margemAbsoluta: Number(margem.toFixed(2)),
        margemPercentual: Number(margemPct.toFixed(1)),
        estoqueAtual: v.estoqueAtual,
      };
    });
    margemPorVariacao.sort((a, b) => b.margemPercentual - a.margemPercentual);

    // ============== CURVA ABC ==============
    // Agrupa vendas por variacao no periodo, ordena por receita.
    // Acumula percentual: ate 80% = A, 80-95% = B, 95-100% = C.
    const vendaPorVariacao = new Map();
    for (const m of movimentacoesPeriodo) {
      if (m.tipo !== 'VENDA') continue;
      const v = m.variacao;
      if (!v) continue;
      const qtd = Math.abs(m.quantidade || 0);
      const valor = qtd * Number(v.preco || 0);
      const custo = qtd * Number(v.precoCusto || 0);
      const key = v.id;
      if (!vendaPorVariacao.has(key)) {
        vendaPorVariacao.set(key, {
          variacaoId: v.id,
          nome: v.produto?.nome,
          variacao: v.nome === 'Padrão' || v.nome === 'Padrao' ? null : v.nome,
          imagemUrl: v.imagemUrl || v.produto?.imagemUrl || null,
          quantidade: 0,
          receita: 0,
          custo: 0,
        });
      }
      const item = vendaPorVariacao.get(key);
      item.quantidade += qtd;
      item.receita += valor;
      item.custo += custo;
    }
    const ordenadoABC = [...vendaPorVariacao.values()].sort((a, b) => b.receita - a.receita);
    const totalReceitaABC = ordenadoABC.reduce((acc, i) => acc + i.receita, 0);
    let acumulado = 0;
    const curvaABC = ordenadoABC.map((item) => {
      acumulado += item.receita;
      const pctAcumulado = totalReceitaABC > 0 ? (acumulado / totalReceitaABC) * 100 : 0;
      let classe;
      if (pctAcumulado <= 80) classe = 'A';
      else if (pctAcumulado <= 95) classe = 'B';
      else classe = 'C';
      return {
        ...item,
        lucro: item.receita - item.custo,
        pctReceita: totalReceitaABC > 0 ? Number(((item.receita / totalReceitaABC) * 100).toFixed(2)) : 0,
        pctAcumulado: Number(pctAcumulado.toFixed(2)),
        classe,
      };
    });
    const resumoABC = {
      A: { qtd: 0, receita: 0 },
      B: { qtd: 0, receita: 0 },
      C: { qtd: 0, receita: 0 },
    };
    for (const item of curvaABC) {
      resumoABC[item.classe].qtd += 1;
      resumoABC[item.classe].receita += item.receita;
    }

    // ============== ESTOQUE PARADO ==============
    // Variacoes sem movimentacao em > 60 dias (ou nunca movimentadas).
    const ultimaMovMap = new Map(
      ultimasMovimentacoes.map((u) => [u.variacaoId, u._max.data])
    );
    const estoqueParado = fisicos
      .filter((v) => Number(v.estoqueAtual || 0) > 0)
      .map((v) => {
        const ultimaMov = ultimaMovMap.get(v.id);
        const diasParado = ultimaMov
          ? Math.floor((hoje.getTime() - new Date(ultimaMov).getTime()) / (24 * 60 * 60 * 1000))
          : null; // null = nunca movimentada
        const ehVar = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
        const valorParado = Number(v.estoqueAtual) * Number(v.precoCusto || 0);
        return {
          variacaoId: v.id,
          nome: v.produto?.nome,
          variacao: ehVar ? null : v.nome,
          categoria: v.produto?.categoria?.nome || 'Sem categoria',
          imagemUrl: v.imagemUrl || v.produto?.imagemUrl || null,
          estoqueAtual: v.estoqueAtual,
          valorParado,
          diasParado, // null = nunca movimentada
        };
      })
      .filter((v) => v.diasParado === null || v.diasParado > 60)
      .sort((a, b) => {
        // Nunca movimentada em primeiro
        if (a.diasParado === null && b.diasParado !== null) return -1;
        if (b.diasParado === null && a.diasParado !== null) return 1;
        if (a.diasParado === null && b.diasParado === null) return b.valorParado - a.valorParado;
        return b.diasParado - a.diasParado;
      })
      .slice(0, 30);

    // ============== LISTA DE REPOSICAO ==============
    const reposicao = fisicos
      .filter((v) => v.estoqueMinimo != null && Number(v.estoqueAtual || 0) < v.estoqueMinimo)
      .map((v) => {
        const ehVar = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
        const ideal = Number(v.estoqueIdeal || 0);
        const atual = Number(v.estoqueAtual || 0);
        const necessidade = Math.max(1, ideal - atual);
        const custoReposicao = necessidade * Number(v.precoCusto || 0);
        const urgencia = atual <= 0 ? 'CRITICO' : atual <= (v.estoqueMinimo / 2) ? 'ALTA' : 'MEDIA';
        return {
          variacaoId: v.id,
          nome: v.produto?.nome,
          variacao: ehVar ? null : v.nome,
          imagemUrl: v.imagemUrl || v.produto?.imagemUrl || null,
          estoqueAtual: atual,
          estoqueMinimo: v.estoqueMinimo,
          estoqueIdeal: ideal,
          necessidade,
          custoReposicao,
          urgencia,
        };
      })
      .sort((a, b) => {
        const ordemUrg = { CRITICO: 0, ALTA: 1, MEDIA: 2 };
        if (ordemUrg[a.urgencia] !== ordemUrg[b.urgencia]) {
          return ordemUrg[a.urgencia] - ordemUrg[b.urgencia];
        }
        return b.custoReposicao - a.custoReposicao;
      });

    const custoTotalReposicao = reposicao.reduce((acc, r) => acc + r.custoReposicao, 0);

    // ============== MOVIMENTO DE INVENTARIO POR DIA ==============
    const fluxoMap = new Map();
    for (const m of movimentacoesPeriodo) {
      const data = new Date(m.data);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
      if (!fluxoMap.has(chave)) {
        fluxoMap.set(chave, { data: chave, entradas: 0, saidas: 0 });
      }
      const item = fluxoMap.get(chave);
      const qtd = Number(m.quantidade || 0);
      if (qtd > 0) item.entradas += qtd;
      else item.saidas += Math.abs(qtd);
    }
    const movimentoDiario = [...fluxoMap.values()].sort((a, b) => a.data.localeCompare(b.data));

    res.json({
      periodo: {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString(),
      },
      kpis: {
        patrimonioImobilizado: Number(patrimonioImobilizado.toFixed(2)),
        valorVarejo: Number(valorVarejo.toFixed(2)),
        lucroPotencial: Number(lucroPotencialEstoque.toFixed(2)),
        totalProdutos: variacoes.length,
        totalFisicos: fisicos.length,
        itensAbaixoMinimo,
        itensZerados,
        indiceRuptura,
      },
      margemPorVariacao: margemPorVariacao.slice(0, 50), // top + bottom 50 por margem
      curvaABC,
      resumoABC,
      estoqueParado,
      reposicao,
      custoTotalReposicao,
      movimentoDiario,
    });
  } catch (erro) {
    console.error('[relatorios/estoque]', erro);
    res.status(500).json({ error: 'Erro ao gerar relatorio de estoque.' });
  }
}

// =====================================================================
// BOTS / IA — mensagens, execucoes, tools usadas, custo de IA
// =====================================================================
async function relatorioBots(req, res) {
  try {
    const { clienteId } = req.usuario;
    if (!clienteId) return res.status(403).json({ error: 'Tenant indefinido.' });

    const periodo = resolverPeriodo(req.query);

    // Filtros extras
    const filtroBot = typeof req.query.botId === 'string' && req.query.botId ? req.query.botId : null;
    const canaisValidos = ['WHATSAPP', 'INSTAGRAM', 'TELEGRAM', 'WEBSITE'];
    const filtroCanal = canaisValidos.includes(req.query.canal) ? req.query.canal : null;

    // Mapeamento dos filtros pra cada query.
    const filtroConversaWhere = {
      ...(filtroBot ? { botId: filtroBot } : {}),
      ...(filtroCanal ? { canal: filtroCanal } : {}),
    };
    const filtroBotWhere = filtroBot ? { id: filtroBot } : {};

    const [
      mensagens,
      conversasComMsg,
      execucoes,
      execucoesNos,
    ] = await Promise.all([
      // Mensagens do periodo (entrada + saida)
      prisma.mensagemConversa.findMany({
        where: {
          clienteId,
          criadoEm: { gte: periodo.inicio, lte: periodo.fim },
          ...(Object.keys(filtroConversaWhere).length > 0 ? { conversa: filtroConversaWhere } : {}),
        },
        select: {
          sentido: true, autor: true, criadoEm: true,
          conversa: { select: { id: true, canal: true, identificador: true } },
        },
      }),

      // Conversas com pelo menos 1 msg no periodo (pra contar ativas)
      prisma.conversa.findMany({
        where: {
          clienteId,
          ultimaMsgEm: { gte: periodo.inicio, lte: periodo.fim },
          ...filtroConversaWhere,
        },
        select: {
          id: true, canal: true, identificador: true,
          leadId: true, ultimaMsgEm: true,
          _count: { select: { mensagens: true } },
        },
        orderBy: { ultimaMsgEm: 'desc' },
        take: 100,
      }),

      // Execucoes do tenant no periodo — via fluxo.bot.clienteId
      prisma.execucao.findMany({
        where: {
          iniciadaEm: { gte: periodo.inicio, lte: periodo.fim },
          fluxo: { bot: { clienteId, ...filtroBotWhere } },
        },
        select: {
          id: true, status: true, modo: true, duracaoMs: true,
          iniciadaEm: true, fluxoId: true,
        },
      }),

      // ExecucaoNo do periodo, tipo AI_AGENT — pra somar tokens
      prisma.execucaoNo.findMany({
        where: {
          tipo: 'AI_AGENT',
          iniciadoEm: { gte: periodo.inicio, lte: periodo.fim },
          execucao: { fluxo: { bot: { clienteId, ...filtroBotWhere } } },
        },
        select: {
          status: true, saida: true, duracaoMs: true, iniciadoEm: true,
        },
      }),
    ]);

    // Auditoria das tools usadas — filtra pelas execucoes do tenant no periodo
    const idsExec = execucoes.map((e) => e.id);
    const auditoria = idsExec.length > 0
      ? await prisma.auditoriaAcaoAgente.findMany({
          where: { execucaoId: { in: idsExec } },
          select: { toolNome: true, sucesso: true, duracaoMs: true },
        })
      : [];

    // ============== KPIs DE MENSAGENS ==============
    let msgsEntrada = 0;
    let msgsSaida = 0;
    let msgsBot = 0;
    let msgsHumano = 0;
    for (const m of mensagens) {
      if (m.sentido === 'ENTRADA') msgsEntrada += 1;
      else msgsSaida += 1;
      if (m.autor === 'BOT') msgsBot += 1;
      else if (m.autor === 'AGENTE_HUMANO' || m.autor === 'AGENTE') msgsHumano += 1;
    }
    const totalMsgs = msgsEntrada + msgsSaida;
    const conversasAtivas = conversasComMsg.length;
    const conversasComLead = conversasComMsg.filter((c) => c.leadId).length;

    // ============== MENSAGENS POR DIA ==============
    const porDiaMap = new Map();
    for (const m of mensagens) {
      const data = new Date(m.criadoEm);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
      if (!porDiaMap.has(chave)) {
        porDiaMap.set(chave, { data: chave, entrada: 0, saida: 0 });
      }
      const item = porDiaMap.get(chave);
      if (m.sentido === 'ENTRADA') item.entrada += 1;
      else item.saida += 1;
    }
    const mensagensPorDia = [...porDiaMap.values()].sort((a, b) => a.data.localeCompare(b.data));

    // ============== POR CANAL ==============
    const canalMsgMap = new Map();
    for (const m of mensagens) {
      const c = m.conversa?.canal || 'OUTRO';
      if (!canalMsgMap.has(c)) {
        canalMsgMap.set(c, { canal: c, entrada: 0, saida: 0 });
      }
      const item = canalMsgMap.get(c);
      if (m.sentido === 'ENTRADA') item.entrada += 1;
      else item.saida += 1;
    }
    const porCanal = [...canalMsgMap.values()]
      .map((c) => ({ ...c, total: c.entrada + c.saida }))
      .sort((a, b) => b.total - a.total);

    // ============== TOP CONVERSAS MAIS ATIVAS ==============
    const topConversas = conversasComMsg.slice(0, 10).map((c) => ({
      id: c.id,
      canal: c.canal,
      identificador: c.identificador,
      mensagens: c._count?.mensagens || 0,
      temLead: !!c.leadId,
      ultimaMsg: c.ultimaMsgEm,
    }));

    // ============== EXECUCOES ==============
    const statusExec = { PENDENTE: 0, EM_EXECUCAO: 0, SUCESSO: 0, ERRO: 0, CANCELADA: 0 };
    const modoExec = { MANUAL: 0, WEBHOOK: 0, SCHEDULE: 0 };
    let duracaoTotalMs = 0;
    let duracaoCount = 0;
    for (const e of execucoes) {
      statusExec[e.status] = (statusExec[e.status] || 0) + 1;
      modoExec[e.modo] = (modoExec[e.modo] || 0) + 1;
      if (e.duracaoMs && e.status === 'SUCESSO') {
        duracaoTotalMs += e.duracaoMs;
        duracaoCount += 1;
      }
    }
    const duracaoMediaMs = duracaoCount > 0 ? duracaoTotalMs / duracaoCount : 0;
    const totalExec = execucoes.length;
    const taxaSucesso = totalExec > 0
      ? Number(((statusExec.SUCESSO / totalExec) * 100).toFixed(1))
      : null;

    // ============== TOOLS MAIS USADAS ==============
    const toolMap = new Map();
    for (const a of auditoria) {
      const nome = a.toolNome;
      if (!toolMap.has(nome)) {
        toolMap.set(nome, { tool: nome, total: 0, sucesso: 0, erro: 0, duracaoMediaMs: 0, somaDuracao: 0 });
      }
      const item = toolMap.get(nome);
      item.total += 1;
      if (a.sucesso) item.sucesso += 1;
      else item.erro += 1;
      if (a.duracaoMs) item.somaDuracao += a.duracaoMs;
    }
    const toolsUsadas = [...toolMap.values()].map((t) => ({
      ...t,
      duracaoMediaMs: t.total > 0 ? Math.round(t.somaDuracao / t.total) : 0,
      taxaSucesso: t.total > 0 ? Number(((t.sucesso / t.total) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.total - a.total);

    // ============== CUSTO DE IA (TOKENS) ==============
    // Lê tokensUsados do campo saida de cada ExecucaoNo tipo AI_AGENT.
    // Saida tem formato { resposta, modelo, tokensUsados, finalizadoPor, chamadasTools }.
    let totalTokens = 0;
    let chamadasIA = 0;
    let chamadasIASucesso = 0;
    const modeloMap = new Map();
    for (const en of execucoesNos) {
      chamadasIA += 1;
      if (en.status === 'SUCESSO') chamadasIASucesso += 1;
      const saida = en.saida || {};
      const tokens = Number(saida.tokensUsados || 0);
      totalTokens += tokens;
      const modelo = saida.modelo || 'desconhecido';
      if (!modeloMap.has(modelo)) {
        modeloMap.set(modelo, { modelo, chamadas: 0, tokens: 0 });
      }
      const item = modeloMap.get(modelo);
      item.chamadas += 1;
      item.tokens += tokens;
    }
    const porModelo = [...modeloMap.values()].sort((a, b) => b.tokens - a.tokens);

    res.json({
      periodo: {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString(),
      },
      kpis: {
        totalMsgs,
        msgsEntrada,
        msgsSaida,
        msgsBot,
        msgsHumano,
        conversasAtivas,
        conversasComLead,
        totalExec,
        taxaSucesso,
        duracaoMediaMs: Math.round(duracaoMediaMs),
        chamadasIA,
        tokensTotal: totalTokens,
      },
      mensagensPorDia,
      porCanal,
      topConversas,
      execucoes: {
        status: statusExec,
        modo: modoExec,
      },
      toolsUsadas,
      ia: {
        chamadas: chamadasIA,
        chamadasSucesso: chamadasIASucesso,
        tokensTotal: totalTokens,
        porModelo,
      },
    });
  } catch (erro) {
    console.error('[relatorios/bots]', erro);
    res.status(500).json({ error: 'Erro ao gerar relatorio de bots/IA.' });
  }
}

module.exports = {
  visaoExecutiva,
  relatorioCRM,
  relatorioFinanceiro,
  relatorioVendas,
  relatorioEstoque,
  relatorioBots,
};
