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
    descricao: 'Gerenciar bots de WhatsApp, Telegram, Instagram. Inclui o construtor visual de fluxos e variaveis.',
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
    id: 'AGENDA',
    nome: 'Agenda',
    icone: Calendar,
    descricao: 'Agendamentos de servicos, calendario por dia/mes e integracao com leads.',
    rotaApp: '/app/agenda',
  },
  {
    id: 'CATALOGO',
    nome: 'Catalogo de Produtos',
    icone: Package,
    descricao: 'Cadastro de produtos, variacoes, precos e categorias.',
    rotaApp: '/app/catalogo',
  },
  {
    id: 'ESTOQUE',
    nome: 'Estoque',
    icone: Box,
    descricao: 'Movimentacoes de entrada e saida, ajustes, balancos e alertas de reposicao.',
    rotaApp: '/app/estoque',
  },
  {
    id: 'FINANCEIRO',
    nome: 'Financeiro',
    icone: DollarSign,
    descricao: 'Contas a pagar e receber, fluxo de caixa, DRE, categorias financeiras e CMV.',
    rotaApp: '/app/financeiro',
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
    descricao: 'Dashboards consolidados, exportacoes e analises gerenciais.',
    rotaApp: '/admin/relatorios',
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
 * Estrutura inicial vazia (todas as permissoes false) para um novo VENDEDOR.
 */
export function permissoesVazias() {
  const permissoes = {};
  for (const modulo of MODULOS_COLABORADOR) {
    permissoes[modulo.id] = {
      visualizar: false,
      criar: false,
      editar: false,
      excluir: false,
    };
  }
  return permissoes;
}

/**
 * Estrutura completa (todas true) - usada visualmente para o preset ADMINISTRADOR.
 */
export function permissoesCompletas() {
  const permissoes = {};
  for (const modulo of MODULOS_COLABORADOR) {
    permissoes[modulo.id] = {
      visualizar: true,
      criar: true,
      editar: true,
      excluir: true,
    };
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
