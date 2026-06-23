// Catalogo de gating por segmento do tenant. FONTE UNICA pra:
//   - onboarding: auto-ativar modulos ao criar cliente (modulosLiberadosPorSegmento);
//   - tela de Usuarios & Equipe: tipos de usuario + matriz de modulos×acoes
//     concediveis por segmento (Frente 5).
//
// Consolidou o antigo constants/gatingSegmento.js (contrato provisorio da
// Frente 5, agora apagado). Mantem em sync com frontend/src/constants/permissoes.js.
//
// Regra de negocio (modulos de onboarding):
//   - BASE: todo tenant precisa pra operar. Inclui PAGAMENTOS e FISCAL (doc
//     erp-pivo §4). Atendimento humano in-app / MENSAGENS saiu no pivo ERP-first.
//   - SERVICO -> + AGENDA · PRODUTO -> + ESTOQUE · HIBRIDO -> + AGENDA + ESTOQUE.

const MODULOS_BASE = [
  'BOTS',
  'CRM',
  'CATALOGO',
  'FINANCEIRO',
  'VENDAS',
  'RELATORIOS',
  'ALERTAS',
  'USUARIOS',
  'PAGAMENTOS',
  'FISCAL',
];

const EXTRAS_POR_SEGMENTO = {
  SERVICO: ['AGENDA'],
  PRODUTO: ['ESTOQUE'],
  HIBRIDO: ['AGENDA', 'ESTOQUE'],
};

// Retorna o objeto modulosLiberados ({ MODULO: true }) pro segmento.
// Sem segmento (null) -> so a BASE: o tenant ja nasce operavel e o admin liga
// AGENDA/ESTOQUE conforme o caso.
function modulosLiberadosPorSegmento(segmento) {
  const seg = String(segmento || '').toUpperCase();
  const extras = EXTRAS_POR_SEGMENTO[seg] || [];
  const liberados = {};
  for (const modulo of [...MODULOS_BASE, ...extras]) {
    liberados[modulo] = true;
  }
  return liberados;
}

// ---------------------------------------------------------------------------
// Gating da tela de Usuarios & Equipe por segmento (erp-pivo §6.1 / §2.5).
// ---------------------------------------------------------------------------

const norm = (segmento) => String(segmento || '').toUpperCase();

// Tipos de usuario (conceito de UI/negocio). Mapeiam pra Perfil + (Especialista):
//   ADMINISTRADOR -> perfil ADMINISTRADOR
//   VENDEDOR      -> perfil VENDEDOR (operador de loja)
//   RECEPCAO      -> perfil VENDEDOR + preset de recepcao (persiste como VENDEDOR)
//   ESPECIALISTA  -> perfil VENDEDOR + registro Especialista (AGENDA-proprias)
// Loja so tem Administrador/Vendedor; clinica tem Administrador/Especialista/
// Recepcao (sem "vendedor"); hibrido tem todos.
const TIPOS_POR_SEGMENTO = {
  PRODUTO: ['ADMINISTRADOR', 'VENDEDOR'],
  SERVICO: ['ADMINISTRADOR', 'ESPECIALISTA', 'RECEPCAO'],
  HIBRIDO: ['ADMINISTRADOR', 'VENDEDOR', 'ESPECIALISTA', 'RECEPCAO'],
};
// Fallback permissivo: sem segmento, libera todos (tenant recem-criado).
const TODOS_OS_TIPOS = ['ADMINISTRADOR', 'VENDEDOR', 'ESPECIALISTA', 'RECEPCAO'];

/** Tipos de usuario que podem ser criados num tenant deste segmento. */
function tiposPorSegmento(segmento) {
  return TIPOS_POR_SEGMENTO[norm(segmento)] || TODOS_OS_TIPOS;
}

/** Se este segmento aceita o tipo Especialista (clinica/servico e hibrido). */
function segmentoPermiteEspecialista(segmento) {
  return tiposPorSegmento(segmento).includes('ESPECIALISTA');
}

// Modulos concediveis a um colaborador, por segmento. Loja esconde modulos
// so-de-servico (AGENDA); clinica esconde so-de-loja (ESTOQUE). VENDAS e
// compartilhado (servico tambem gera venda ao concluir atendimento).
// MENSAGENS saiu no pivo (sem inbox).
const MODULOS_COMPARTILHADOS = ['CRM', 'CATALOGO', 'FINANCEIRO', 'VENDAS', 'RELATORIOS', 'ALERTAS'];
const MODULOS_SO_SERVICO = ['AGENDA'];
const MODULOS_SO_LOJA = ['ESTOQUE'];

const MODULOS_POR_SEGMENTO = {
  PRODUTO: [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_LOJA],
  SERVICO: [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_SERVICO],
  HIBRIDO: [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_SERVICO, ...MODULOS_SO_LOJA],
};
const TODOS_OS_MODULOS = [...MODULOS_COMPARTILHADOS, ...MODULOS_SO_SERVICO, ...MODULOS_SO_LOJA];

/** IDs de modulos que podem ser concedidos a um colaborador deste segmento. */
function modulosPorSegmento(segmento) {
  return MODULOS_POR_SEGMENTO[norm(segmento)] || TODOS_OS_MODULOS;
}

module.exports = {
  // onboarding
  modulosLiberadosPorSegmento,
  MODULOS_BASE,
  EXTRAS_POR_SEGMENTO,
  // gating da tela de Usuarios & Equipe
  tiposPorSegmento,
  segmentoPermiteEspecialista,
  modulosPorSegmento,
  TIPOS_POR_SEGMENTO,
  MODULOS_POR_SEGMENTO,
};
