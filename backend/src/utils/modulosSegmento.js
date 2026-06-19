// Modulos liberados por segmento — usado no onboarding (criar cliente) pra
// auto-ativar o conjunto certo de modulos, sem o admin precisar ligar tudo
// na mao. O admin pode ajustar depois pela matriz (PUT /clientes/:id/modulos).
//
// Mantem em sync com a lista canonica de modulos:
//   frontend/src/constants/permissoes.js (MODULOS_TENANT / modulosDoSegmento)
//
// Regra de negocio:
//   - BASE: todo tenant precisa pra operar (bot + atendimento + financeiro +
//     vendas + gestao). Servico tambem gera venda (concluir atendimento), por
//     isso VENDAS entra na base.
//   - SERVICO  -> + AGENDA   (nucleo do servico)
//   - PRODUTO  -> + ESTOQUE  (nucleo do produto fisico)
//   - HIBRIDO  -> + AGENDA + ESTOQUE (faz os dois)

const MODULOS_BASE = [
  'BOTS',
  'CRM',
  'MENSAGENS',
  'CATALOGO',
  'FINANCEIRO',
  'VENDAS',
  'RELATORIOS',
  'ALERTAS',
  'USUARIOS',
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

module.exports = { modulosLiberadosPorSegmento, MODULOS_BASE, EXTRAS_POR_SEGMENTO };
