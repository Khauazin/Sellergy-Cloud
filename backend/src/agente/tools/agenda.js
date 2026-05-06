const prisma = require('../../prisma');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
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
    const data = new Date(args.data);
    if (Number.isNaN(data.getTime())) throw new Error('data invalida (use ISO 8601).');

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
    const dia = new Date(args.data);
    if (Number.isNaN(dia.getTime())) throw new Error('data invalida.');
    const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 0, 0);
    const fim = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 23, 59, 59);

    const ags = await prisma.agendamento.findMany({
      where: {
        clienteId: contexto.clienteId,
        data: { gte: inicio, lte: fim },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { data: 'asc' },
      select: { id: true, nomeCliente: true, data: true, duracao: true, servico: true, status: true },
    });
    return {
      data: dia.toISOString().slice(0, 10),
      total: ags.length,
      itens: ags.map((a) => ({ ...a, data: a.data.toISOString() })),
    };
  },
};

module.exports = [criarAgendamento, listarAgendamentosDoDia];
