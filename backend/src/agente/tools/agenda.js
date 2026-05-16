const prisma = require('../../prisma');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

// =====================================================================
// HELPERS DE TIMEZONE — BRT (UTC-3) ASSUMIDO
// =====================================================================
// Sistema e Brasil-only. Quando o LLM passa data sem offset, interpretamos
// como BRT (em vez do TZ do processo, que pode ser UTC em prod).
//
// Aceita:
//   2026-05-16T14:30:00Z         → como UTC
//   2026-05-16T14:30:00-03:00    → como BRT explicito
//   2026-05-16T14:30:00          → assume BRT
//   2026-05-16T14:30             → assume BRT
//   2026-05-16                   → 00:00 BRT desse dia
function parseDataBRT(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Ja tem Z ou offset explicito? usa direto.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // So data (YYYY-MM-DD) → 00:00 BRT
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00-03:00`);
  }
  // Tem hora mas sem offset → assume BRT
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
    return new Date(`${s}-03:00`);
  }
  // Fallback
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Calcula a janela [00:00, 23:59:59.999] do dia BRT correspondente a uma
// data ISO arbitraria. Retorna { inicio, fim } como Date em UTC.
function janelaDoDiaBRT(str) {
  const d = parseDataBRT(str);
  if (!d) return null;
  const dataStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return {
    inicio: new Date(`${dataStr}T00:00:00-03:00`),
    fim: new Date(`${dataStr}T23:59:59.999-03:00`),
  };
}

const criarAgendamento = {
  nome: 'agenda.criarAgendamento',
  modulo: 'AGENDA',
  descricao: 'Cria um agendamento (compromisso) para o cliente. Use quando o lead pedir para marcar.',
  parametros: {
    tipo: 'object',
    propriedades: {
      nomeCliente: { tipo: 'string' },
      telefoneCliente: { tipo: 'string', opcional: true },
      data: { tipo: 'string', descricao: 'ISO 8601 (ex: 2026-05-10T14:30:00-03:00)' },
      duracaoMinutos: { tipo: 'number', descricao: 'Default 30', opcional: true },
      servico: { tipo: 'string', opcional: true },
      preco: { tipo: 'number', opcional: true },
      observacoes: { tipo: 'string', opcional: true },
      leadId: { tipo: 'string', opcional: true },
    },
    obrigatorios: ['nomeCliente', 'data'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    // parseDataBRT: aceita ISO com/sem offset. Quando o LLM esquece o offset,
    // assume BRT (em vez do TZ do processo, que costuma ser UTC).
    const data = parseDataBRT(args.data);
    if (!data || Number.isNaN(data.getTime())) throw new Error('data invalida (use ISO 8601).');

    const ag = await prisma.agendamento.create({
      data: {
        clienteId: contexto.clienteId,
        leadId: args.leadId || null,
        nomeCliente: String(args.nomeCliente).trim(),
        telefoneCliente: args.telefoneCliente ? String(args.telefoneCliente).trim() : null,
        data,
        duracao: Number.isFinite(args.duracaoMinutos) ? Math.max(5, args.duracaoMinutos) : 30,
        servico: args.servico ? String(args.servico).trim() : null,
        preco: Number.isFinite(args.preco) ? args.preco : null,
        observacoes: args.observacoes ? String(args.observacoes).trim() : null,
        origem: 'AI',
        status: 'PENDING',
      },
    });
    return {
      id: ag.id,
      data: ag.data.toISOString(),
      duracao: ag.duracao,
      status: ag.status,
    };
  },
};

const listarAgendamentosDoDia = {
  nome: 'agenda.listarAgendamentosDoDia',
  modulo: 'AGENDA',
  descricao: 'Lista os agendamentos de uma data especifica (apenas o dia, ignora hora). Util para informar disponibilidade.',
  parametros: {
    tipo: 'object',
    propriedades: {
      data: { tipo: 'string', descricao: 'ISO 8601 — apenas a parte da data e usada' },
    },
    obrigatorios: ['data'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    // janelaDoDiaBRT: calcula [00:00, 23:59:59.999] BRT em UTC. Indep do TZ
    // do processo. Sem isso, "2026-05-16" no servidor UTC era interpretado
    // como UTC midnight e o getDate() shiftava de dia.
    const janela = janelaDoDiaBRT(args.data);
    if (!janela) throw new Error('data invalida.');

    const ags = await prisma.agendamento.findMany({
      where: {
        clienteId: contexto.clienteId,
        data: { gte: janela.inicio, lte: janela.fim },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { data: 'asc' },
      select: { id: true, nomeCliente: true, data: true, duracao: true, servico: true, status: true },
    });
    // Devolve a parte da data formatada em BRT pra resposta ser consistente
    // com o que o usuario pediu (em vez de toISOString().slice que e UTC).
    const dataLabel = janela.inicio.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return {
      data: dataLabel,
      total: ags.length,
      itens: ags.map((a) => ({ ...a, data: a.data.toISOString() })),
    };
  },
};

module.exports = [criarAgendamento, listarAgendamentosDoDia];
