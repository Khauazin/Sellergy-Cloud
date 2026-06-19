// Tools do modulo CRM. Multi-tenant: contexto.clienteId obrigatorio.

const prisma = require('../../prisma');
const { adicionarVinculo, removerVinculo } = require('../../leadProdutos');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) {
    throw new Error('Contexto sem clienteId — agente nao pode operar fora de um tenant.');
  }
}

function trim(s) {
  return typeof s === 'string' ? s.trim() : s;
}

const criarLead = {
  nome: 'crm.criarLead',
  modulo: 'CRM',
  descricao: 'Cria um novo lead no funil. Use ao iniciar atendimento de um cliente novo. Retorna o ID criado.',
  parametros: {
    tipo: 'object',
    propriedades: {
      nome: { tipo: 'string', descricao: 'Nome do cliente' },
      telefone: { tipo: 'string', descricao: 'Telefone (opcional)', opcional: true },
      email: { tipo: 'string', descricao: 'E-mail (opcional)', opcional: true },
      cpf: { tipo: 'string', descricao: 'CPF do cliente (so digitos ou formatado, opcional)', opcional: true },
      dataNascimento: { tipo: 'string', descricao: 'Data de nascimento em ISO 8601 (ex: 1990-05-15) — opcional', opcional: true },
      observacoes: { tipo: 'string', descricao: 'Observacoes iniciais', opcional: true },
      etapaId: { tipo: 'string', descricao: 'ID da etapa do funil onde colocar o lead (opcional)', opcional: true },
    },
    obrigatorios: ['nome'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const nome = trim(args.nome);
    if (!nome) throw new Error('nome obrigatorio.');

    // CPF: limpa pra so digitos; vazio vira null.
    const cpfLimpo = args.cpf ? String(args.cpf).replace(/\D/g, '') : null;
    // Data de nascimento: aceita ISO, se invalido vira null (nao quebra).
    let dataNasc = null;
    if (args.dataNascimento) {
      const d = new Date(args.dataNascimento);
      if (!Number.isNaN(d.getTime())) dataNasc = d;
    }

    const lead = await prisma.lead.create({
      data: {
        clienteId: contexto.clienteId,
        nome,
        telefone: trim(args.telefone) || null,
        email: trim(args.email) || null,
        cpf: cpfLimpo || null,
        dataNascimento: dataNasc,
        observacoes: trim(args.observacoes) || null,
        etapaId: args.etapaId || null,
      },
    });
    return { id: lead.id, nome: lead.nome, criadoEm: lead.criadoEm };
  },
};

const buscarLead = {
  nome: 'crm.buscarLead',
  modulo: 'CRM',
  descricao: 'Busca um lead existente por telefone, email ou trecho do nome. Use antes de criar para evitar duplicatas.',
  parametros: {
    tipo: 'object',
    propriedades: {
      telefone: { tipo: 'string', opcional: true },
      email: { tipo: 'string', opcional: true },
      nomeContem: { tipo: 'string', descricao: 'Trecho do nome (case-insensitive)', opcional: true },
    },
    obrigatorios: [],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const where = { clienteId: contexto.clienteId };
    if (args.telefone) where.telefone = String(args.telefone).trim();
    if (args.email) where.email = String(args.email).trim().toLowerCase();
    if (args.nomeContem) where.nome = { contains: String(args.nomeContem).trim(), mode: 'insensitive' };
    if (Object.keys(where).length === 1) return { encontrados: [], total: 0 };

    const leads = await prisma.lead.findMany({
      where,
      take: 10,
      orderBy: { atualizadoEm: 'desc' },
      select: { id: true, nome: true, telefone: true, email: true, etapaId: true, criadoEm: true },
    });
    return { encontrados: leads, total: leads.length };
  },
};

const moverEtapaLead = {
  nome: 'crm.moverEtapaLead',
  modulo: 'CRM',
  descricao: 'Move um lead para outra etapa do funil. Use quando o cliente avancou no relacionamento.',
  parametros: {
    tipo: 'object',
    propriedades: {
      leadId: { tipo: 'string' },
      etapaId: { tipo: 'string', descricao: 'ID da etapa destino' },
    },
    obrigatorios: ['leadId', 'etapaId'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const lead = await prisma.lead.findFirst({
      where: { id: args.leadId, clienteId: contexto.clienteId },
    });
    if (!lead) throw new Error('Lead nao encontrado.');

    const etapa = await prisma.etapaLead.findFirst({
      where: { id: args.etapaId, clienteId: contexto.clienteId },
    });
    if (!etapa) throw new Error('Etapa nao encontrada.');

    const atualizado = await prisma.lead.update({
      where: { id: lead.id },
      data: { etapaId: etapa.id },
    });
    return { id: atualizado.id, etapaId: atualizado.etapaId };
  },
};

// =====================================================================
// VINCULOS DE PRODUTOS NO LEAD
// =====================================================================
const vincularProdutoAoLead = {
  nome: 'crm.vincularProdutoAoLead',
  modulo: 'CRM',
  descricao: 'Vincula uma variacao de produto ao lead, com quantidade. Use quando o cliente demonstrar interesse em produtos especificos. O valor estimado do lead e recalculado automaticamente.',
  parametros: {
    tipo: 'object',
    propriedades: {
      leadId: { tipo: 'string', descricao: 'ID do lead' },
      variacaoId: { tipo: 'string', descricao: 'ID da variacao do produto (use catalogo.buscarProduto antes pra encontrar)' },
      quantidade: { tipo: 'number', descricao: 'Quantidade desejada (default: 1)', opcional: true },
      observacao: { tipo: 'string', descricao: 'Observacao livre (ex.: cor preferida)', opcional: true },
    },
    obrigatorios: ['leadId', 'variacaoId'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    // Confirma que o lead pertence ao tenant antes de chamar o helper.
    const lead = await prisma.lead.findFirst({
      where: { id: args.leadId, clienteId: contexto.clienteId },
    });
    if (!lead) throw new Error('Lead nao encontrado.');

    const { vinculos, valorTotal } = await adicionarVinculo({
      leadId: lead.id,
      clienteId: contexto.clienteId,
      variacaoId: args.variacaoId,
      quantidade: args.quantidade,
      observacao: args.observacao || null,
    });
    return {
      leadId: lead.id,
      valorTotal,
      totalProdutos: vinculos.length,
    };
  },
};

const desvincularProdutoDoLead = {
  nome: 'crm.desvincularProdutoDoLead',
  modulo: 'CRM',
  descricao: 'Remove uma variacao previamente vinculada ao lead. O valor estimado e recalculado.',
  parametros: {
    tipo: 'object',
    propriedades: {
      leadId: { tipo: 'string' },
      variacaoId: { tipo: 'string' },
    },
    obrigatorios: ['leadId', 'variacaoId'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const lead = await prisma.lead.findFirst({
      where: { id: args.leadId, clienteId: contexto.clienteId },
    });
    if (!lead) throw new Error('Lead nao encontrado.');
    const { valorTotal } = await removerVinculo({ leadId: lead.id, variacaoId: args.variacaoId });
    return { leadId: lead.id, valorTotal };
  },
};

module.exports = [criarLead, buscarLead, moverEtapaLead, vincularProdutoAoLead, desvincularProdutoDoLead];
