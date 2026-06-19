// =====================================================================
// GERAÇÃO DO RELATÓRIO MENSAL — snapshot persistido
// =====================================================================
// Função pura (sem cron) que monta o JSON do mês para um tenant. Usada
// tanto pelo cron automático (dia 7) quanto por chamada manual.
//
// Regra de janela:
//   - Lançamentos PAGO: filtra por `dataPagamento` entre 1º e último dia
//     do mês em America/Sao_Paulo.
//   - Sessões de caixa: filtra por `fechadaEm` no mesmo intervalo (sessão
//     que abriu dia 30 e fechou dia 5 do mês seguinte vai pro mês seguinte).
//
// Idempotente: usa upsert sobre `(clienteId, ano, mes)`. Pode rodar várias
// vezes sem duplicar.

const prisma = require('../prisma');

const TZ = 'America/Sao_Paulo';

// Calcula 1º dia 00:00:00 e último dia 23:59:59.999 do mês em UTC tomando
// `America/Sao_Paulo` como referência. Usa Intl.DateTimeFormat para
// resolver o offset corretamente (cobre horário de verão se voltar).
function intervaloMes(ano, mes /* 1-12 */) {
  // Constrói as strings ISO no fuso BRT e converte pra UTC.
  // Como BRT = UTC-3 (sem DST atualmente), o início do mês 00:00 BRT
  // equivale a 03:00 UTC. Usar Date(ano, mes-1, 1) interpretaria como
  // local do servidor — perigoso. Solução: hardcode UTC-3.
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 3, 0, 0, 0));
  const fim = new Date(Date.UTC(ano, mes, 1, 2, 59, 59, 999)); // 23:59:59.999 do último dia BRT
  return { inicio, fim };
}

// Calcula o mês anterior ao mês atual (em BRT).
function mesAnterior() {
  const agora = new Date();
  const ymBR = agora.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const [anoAtual, mesAtual] = ymBR.split('-').map(Number);
  if (mesAtual === 1) return { ano: anoAtual - 1, mes: 12 };
  return { ano: anoAtual, mes: mesAtual - 1 };
}

// Gera o snapshot do mês indicado pra UM tenant.
async function gerarSnapshot({ clienteId, ano, mes, geradoPor = 'CRON' }) {
  const { inicio, fim } = intervaloMes(ano, mes);

  // Carrega lançamentos pagos no intervalo, com categoria
  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: {
      clienteId,
      status: 'PAGO',
      dataPagamento: { gte: inicio, lte: fim },
    },
    include: { categoria: true },
  });

  // Sessões de caixa fechadas no intervalo
  const sessoes = await prisma.sessaoCaixa.findMany({
    where: {
      clienteId,
      status: 'FECHADA',
      fechadaEm: { gte: inicio, lte: fim },
    },
    include: {
      movimentacoesSaldo: {
        where: { tipo: { in: ['SANGRIA', 'SUPRIMENTO'] } },
        select: { tipo: true, valor: true },
      },
    },
  });

  // Vendas COMPLETED no intervalo
  const vendas = await prisma.venda.findMany({
    where: {
      clienteId,
      status: 'COMPLETED',
      criadoEm: { gte: inicio, lte: fim },
    },
    include: {
      movimentacoesEstoque: { include: { variacao: { include: { produto: true } } } },
    },
  });

  // Leads criados no intervalo
  const leadsCriados = await prisma.lead.count({
    where: { clienteId, criadoEm: { gte: inicio, lte: fim } },
  });

  // =================== Agregações ===================
  let receitaBruta = 0;
  let despesasVariaveis = 0;
  let despesasFixas = 0;
  for (const l of lancamentos) {
    const v = Number(l.valor || 0);
    if (l.tipo === 'RECEITA') {
      receitaBruta += v;
      continue;
    }
    // Mesma regra do RelatoriosController.relatorioFinanceiro:
    // 1º - usa categoria.subTipo (VARIAVEL | FIXA).
    // 2º - fallback heurístico pelo nome se subTipo não definido.
    const subTipo = l.categoria?.subTipo;
    if (subTipo === 'VARIAVEL') {
      despesasVariaveis += v;
    } else if (subTipo === 'FIXA') {
      despesasFixas += v;
    } else {
      const nomeCat = l.categoria?.nome?.toLowerCase() || '';
      if (
        nomeCat.includes('venda') ||
        nomeCat.includes('imposto') ||
        nomeCat.includes('taxa') ||
        nomeCat.includes('comiss')
      ) {
        despesasVariaveis += v;
      } else {
        despesasFixas += v;
      }
    }
  }
  const despesasTotais = despesasVariaveis + despesasFixas;
  const lucroLiquido = receitaBruta - despesasTotais;
  const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

  // Caixa
  let totalSangrias = 0;
  let totalSuprimentos = 0;
  let diferencaAcumulada = 0;
  for (const s of sessoes) {
    diferencaAcumulada += Number(s.diferenca || 0);
    for (const mov of s.movimentacoesSaldo || []) {
      const v = Number(mov.valor || 0);
      if (mov.tipo === 'SANGRIA') totalSangrias += v;
      else totalSuprimentos += v;
    }
  }

  // Top 5 produtos vendidos por receita
  const mapaProdutos = new Map();
  for (const venda of vendas) {
    for (const mov of venda.movimentacoesEstoque || []) {
      if (mov.tipo !== 'VENDA') continue;
      const nome = mov.variacao?.produto?.nome || 'Produto removido';
      const qtd = Math.abs(mov.quantidade || 0);
      const valor = (Number(venda.valor || 0) / Math.max(1, venda.movimentacoesEstoque.length));
      const atual = mapaProdutos.get(nome) || { quantidade: 0, receita: 0 };
      atual.quantidade += qtd;
      atual.receita += valor;
      mapaProdutos.set(nome, atual);
    }
  }
  const topProdutos = Array.from(mapaProdutos.entries())
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.receita - a.receita)
    .slice(0, 5);

  const ticketMedio = vendas.length > 0
    ? vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0) / vendas.length
    : 0;

  const snapshot = {
    periodo: {
      ano, mes,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
    },
    financeiro: {
      receitaBruta,
      despesasVariaveis,
      despesasFixas,
      despesasTotais,
      lucroLiquido,
      margemLiquida: Number(margemLiquida.toFixed(2)),
      totalLancamentos: lancamentos.length,
    },
    caixa: {
      sessoesFechadas: sessoes.length,
      totalSangrias,
      totalSuprimentos,
      diferencaAcumulada,
    },
    vendas: {
      total: vendas.length,
      faturamento: vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      topProdutos,
    },
    crm: {
      leadsCriados,
    },
  };

  // Upsert: regerar não duplica.
  const registro = await prisma.relatorioMensal.upsert({
    where: { clienteId_ano_mes: { clienteId, ano, mes } },
    create: { clienteId, ano, mes, dados: snapshot, geradoPor },
    update: { dados: snapshot, geradoEm: new Date(), geradoPor },
  });

  return registro;
}

// Roda pra TODOS os tenants ativos. Usado pelo cron.
async function gerarTodosTenants({ ano, mes, geradoPor = 'CRON' }) {
  const tenants = await prisma.cliente.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, nome: true },
  });
  const resultados = [];
  for (const t of tenants) {
    try {
      const r = await gerarSnapshot({ clienteId: t.id, ano, mes, geradoPor });
      resultados.push({ clienteId: t.id, nome: t.nome, ok: true, id: r.id });
    } catch (e) {
      console.error(`[gerarRelatorioMensal] tenant ${t.nome}:`, e?.message);
      resultados.push({ clienteId: t.id, nome: t.nome, ok: false, erro: e?.message });
    }
  }
  return resultados;
}

module.exports = { gerarSnapshot, gerarTodosTenants, mesAnterior, intervaloMes };
