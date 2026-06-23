// Catalogo de gating por segmento do tenant. Usado no onboarding (auto-ativar
// modulos ao criar cliente) e como base do gating da tela de Usuarios & Equipe
// (tipos de usuario + matriz de modulos×acoes por segmento — Frente 5).
//
// Mantem em sync com a lista canonica do frontend:
//   frontend/src/constants/permissoes.js (MODULOS_TENANT / modulosDoSegmento /
//   tiposUsuarioPorSegmento / moduloVisivelNoSegmento)
//
// Regra de negocio (modulos):
//   - BASE: todo tenant precisa pra operar. Inclui PAGAMENTOS e FISCAL —
//     recebimento e nota fazem sentido pros dois segmentos (doc erp-pivo §4).
//     (Atendimento humano in-app / MENSAGENS saiu no pivo ERP-first.)
//   - SERVICO  -> + AGENDA   (nucleo do servico)
//   - PRODUTO  -> + ESTOQUE  (nucleo do produto fisico)
//   - HIBRIDO  -> + AGENDA + ESTOQUE (faz os dois)

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
// Gating por segmento da tela de Usuarios & Equipe (base das Frentes 4/5).
// ---------------------------------------------------------------------------

// Tipos de usuario oferecidos ao criar alguem na equipe. ADMINISTRADOR e
// VENDEDOR valem pra qualquer segmento; ESPECIALISTA so aparece em servico
// (SERVICO/HIBRIDO), onde cria Usuario + Especialista numa transacao (doc
// erp-pivo §6.1). Retorna IDs de tipo; a Frente 5 mapeia pra rotulo/campos/perfil.
const TIPOS_USUARIO_BASE = ['ADMINISTRADOR', 'VENDEDOR'];

function tiposUsuarioPorSegmento(segmento) {
  const seg = String(segmento || '').toUpperCase();
  const ehServico = seg === 'SERVICO' || seg === 'HIBRIDO';
  return ehServico ? [...TIPOS_USUARIO_BASE, 'ESPECIALISTA'] : [...TIPOS_USUARIO_BASE];
}

// Modulos escondidos por segmento na matriz de permissoes / navegacao.
// Loja (PRODUTO) nao mexe com agenda/servico; clinica (SERVICO) nao mexe com
// estoque/varejo. HIBRIDO e segmento nulo nao escondem nada.
const MODULOS_OCULTOS_POR_SEGMENTO = {
  PRODUTO: ['AGENDA'],
  SERVICO: ['ESTOQUE'],
};

function modulosOcultosPorSegmento(segmento) {
  return MODULOS_OCULTOS_POR_SEGMENTO[String(segmento || '').toUpperCase()] || [];
}

function moduloVisivelNoSegmento(modulo, segmento) {
  return !modulosOcultosPorSegmento(segmento).includes(modulo);
}

module.exports = {
  modulosLiberadosPorSegmento,
  MODULOS_BASE,
  EXTRAS_POR_SEGMENTO,
  tiposUsuarioPorSegmento,
  TIPOS_USUARIO_BASE,
  modulosOcultosPorSegmento,
  moduloVisivelNoSegmento,
};
