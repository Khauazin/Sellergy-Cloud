// Catalogo de modulos do sistema Sellergy Cloud.
// Mantem em sync com backend/src/controllers/CrmUsuariosController.js (MODULOS_CRM)
// e backend/src/middlewares/permissoes.middleware.js.

import {
  Bot,
  Kanban,
  Calendar,
  Package,
  Box,
  DollarSign,
  ShoppingBag,
  Users,
  AlertTriangle,
  BarChart3,
  MessageSquare,
} from 'lucide-react';

/**
 * Modulos liberados pelo ADMIN no nivel do CLIENTE (tenant).
 * Esses sao os modulos que o cliente "comprou" / tem acesso na assinatura.
 */
export const MODULOS_TENANT = [
  {
    id: 'BOTS',
    nome: 'Bots & Automacao',
    icone: Bot,
    descricao: 'Gerenciar bots de WhatsApp. Inclui o construtor visual de fluxos e variaveis.',
    rotaApp: '/admin/bots', // rota onde o cliente acessa
  },
  {
    id: 'CRM',
    nome: 'CRM & Leads',
    icone: Kanban,
    descricao: 'Funil de vendas em Kanban, gestao de leads, fases personalizaveis e historico de interacoes.',
    rotaApp: '/app/crm',
  },
  {
    id: 'MENSAGENS',
    nome: 'Mensagens',
    icone: MessageSquare,
    descricao: 'Inbox das conversas do bot. Atenda quando o cliente pede um humano. O escopo define se o usuario ve so as conversas atribuidas a ele ou todas.',
    rotaApp: '/app/mensagens',
  },
  {
    id: 'AGENDA',
    nome: 'Agenda',
    icone: Calendar,
    descricao: 'Agendamentos de servicos, calendario por dia/mes e integracao com leads.',
    rotaApp: '/app/agenda',
  },
  {
    id: 'CATALOGO',
    nome: 'Catalogo de Servicos',
    icone: Package,
    descricao: 'Cadastro de servicos prestados (corte, consulta, atendimento) com preco e duracao.',
    rotaApp: '/app/catalogo',
  },
  {
    id: 'ESTOQUE',
    nome: 'Estoque',
    icone: Box,
    descricao: 'Cadastro e gestao de produtos fisicos: quantidade, movimentacoes, alertas e reposicao.',
    rotaApp: '/app/estoque',
  },
  {
    id: 'FINANCEIRO',
    nome: 'Financeiro',
    icone: DollarSign,
    descricao: 'Lancamentos, contas a pagar (recorrentes/pontuais), caixa (abertura/fechamento, retiradas, entradas), categorias e fluxo de caixa.',
    rotaApp: '/app/financeiro/lancamentos',
  },
  {
    id: 'VENDAS',
    nome: 'Vendas',
    icone: ShoppingBag,
    descricao: 'Registro de vendas com baixa automatica de estoque e lancamento financeiro.',
    rotaApp: '/app/vendas',
  },
  {
    id: 'ALERTAS',
    nome: 'Alertas',
    icone: AlertTriangle,
    descricao: 'Notificacoes de eventos importantes do sistema (bots offline, estoque critico, falhas).',
    rotaApp: '/admin/alertas',
  },
  {
    id: 'RELATORIOS',
    nome: 'Relatorios',
    icone: BarChart3,
    descricao: 'Dashboards consolidados (Visao executiva, Financeiro, Vendas, Caixa, Estoque, Bots) + fechamento mensal + exportacao em CSV, Excel e PDF.',
    rotaApp: '/app/relatorios/visao-executiva',
  },
  {
    id: 'USUARIOS',
    nome: 'Equipe & Usuarios',
    icone: Users,
    descricao: 'Cadastro de colaboradores e gestao de permissoes dentro do CRM.',
    rotaApp: '/app/usuarios',
  },
];

/**
 * Modulos disponiveis para concessao a colaboradores (subset dos modulos do tenant).
 * Nao inclui USUARIOS (so o dono CLIENT e ADMINISTRADOR podem mexer em equipe).
 */
export const MODULOS_COLABORADOR = MODULOS_TENANT.filter((m) => m.id !== 'USUARIOS');

/**
 * Modulos auto-ativados por segmento ao CRIAR um cliente (onboarding sem atrito).
 * Espelha backend/src/utils/modulosSegmento.js — manter os dois em sync.
 *   - BASE: todo tenant precisa pra operar (servico tambem gera venda).
 *   - SERVICO -> + AGENDA · PRODUTO -> + ESTOQUE · HIBRIDO -> + AGENDA + ESTOQUE
 */
export const MODULOS_BASE_TENANT = [
  'BOTS', 'CRM', 'MENSAGENS', 'CATALOGO', 'FINANCEIRO', 'VENDAS', 'RELATORIOS', 'ALERTAS', 'USUARIOS',
];
export const MODULOS_EXTRA_POR_SEGMENTO = {
  SERVICO: ['AGENDA'],
  PRODUTO: ['ESTOQUE'],
  HIBRIDO: ['AGENDA', 'ESTOQUE'],
};

/** Lista de IDs de modulos que serao ativados pro segmento (BASE + extras). */
export function modulosDoSegmento(segmento) {
  const extras = MODULOS_EXTRA_POR_SEGMENTO[String(segmento || '').toUpperCase()] || [];
  return [...MODULOS_BASE_TENANT, ...extras];
}

/**
 * Acoes que podem ser concedidas dentro de cada modulo.
 */
export const ACOES = [
  {
    id: 'visualizar',
    nome: 'Visualizar',
    descricao: 'Pode acessar a tela e ver os dados em modo de leitura.',
  },
  {
    id: 'criar',
    nome: 'Criar',
    descricao: 'Pode adicionar novos registros (cadastrar produtos, lancamentos, leads, etc.).',
  },
  {
    id: 'editar',
    nome: 'Editar',
    descricao: 'Pode alterar registros existentes, mudar status e atualizar informacoes.',
  },
  {
    id: 'excluir',
    nome: 'Excluir',
    descricao: 'Pode remover registros permanentemente. Conceda com cautela.',
  },
];

/**
 * Acoes especificas de modulos que fogem do CRUD padrao.
 * MENSAGENS nao tem criar/excluir — tem responder e atribuir.
 */
export const ACOES_POR_MODULO = {
  MENSAGENS: [
    { id: 'visualizar', nome: 'Ver conversas', descricao: 'Acessa a inbox e le as conversas (dentro do escopo).' },
    { id: 'responder', nome: 'Responder', descricao: 'Envia mensagens ao cliente na conversa.' },
    { id: 'atribuir', nome: 'Atribuir', descricao: 'Assume e transfere conversas entre atendentes.' },
  ],
};

/** Retorna a lista de acoes de um modulo (CRUD padrao se nao houver override). */
export function acoesDoModulo(moduloId) {
  return ACOES_POR_MODULO[moduloId] || ACOES;
}

/**
 * Modulos com dimensao de ESCOPO: o usuario ve "proprias" (atribuidas a ele) ou
 * "todas". Reutilizavel — MENSAGENS agora; AGENDA entra quando o especialista
 * passar a ver so a propria agenda.
 */
export const MODULOS_COM_ESCOPO = new Set(['MENSAGENS', 'AGENDA']);

export const ESCOPOS = [
  { id: 'PROPRIAS', nome: 'Apenas as proprias', descricao: 'So as conversas atribuidas a este usuario.' },
  { id: 'TODAS', nome: 'Todas', descricao: 'Todas as conversas do negocio.' },
];

/** Indica se um modulo usa a dimensao de escopo. */
export function temEscopo(moduloId) {
  return MODULOS_COM_ESCOPO.has(moduloId);
}

/** Le o escopo concedido a um modulo (default PROPRIAS = mais restritivo). */
export function escopoDe(permissoes, modulo) {
  return permissoes?.[modulo]?.escopo === 'TODAS' ? 'TODAS' : 'PROPRIAS';
}

/**
 * Estrutura inicial vazia (todas as permissoes false) para um novo VENDEDOR.
 */
export function permissoesVazias() {
  const permissoes = {};
  for (const modulo of MODULOS_COLABORADOR) {
    const p = {};
    for (const acao of acoesDoModulo(modulo.id)) p[acao.id] = false;
    if (temEscopo(modulo.id)) p.escopo = 'PROPRIAS';
    permissoes[modulo.id] = p;
  }
  return permissoes;
}

/**
 * Estrutura completa (todas true) - usada visualmente para o preset ADMINISTRADOR.
 */
export function permissoesCompletas() {
  const permissoes = {};
  for (const modulo of MODULOS_COLABORADOR) {
    const p = {};
    for (const acao of acoesDoModulo(modulo.id)) p[acao.id] = true;
    if (temEscopo(modulo.id)) p.escopo = 'TODAS';
    permissoes[modulo.id] = p;
  }
  return permissoes;
}

/**
 * Helper para verificar se uma permissao esta concedida no objeto permissoes.
 */
export function temPermissao(permissoes, modulo, acao) {
  return permissoes?.[modulo]?.[acao] === true;
}

/**
 * Helper para verificar se um modulo esta liberado pelo admin.
 */
export function moduloLiberado(modulosLiberados, modulo) {
  return modulosLiberados?.[modulo] === true;
}
