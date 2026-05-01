import { configDoTipo } from './catalogoNos';

// Tipo unico registrado no React Flow. O comportamento visual depende
// do `data.tipo` carregado dentro do node.
export const TIPO_RF_NO = 'noBase';

export function novoIdNo() {
  return `no_${crypto.randomUUID()}`;
}

export function novoIdConexao() {
  return `con_${crypto.randomUUID()}`;
}

// API -> React Flow.
export function apiParaReactFlow({ nos = [], conexoes = [] }) {
  return {
    nodes: nos.map((n) => ({
      id: n.id,
      type: TIPO_RF_NO,
      position: { x: n.posicaoX, y: n.posicaoY },
      data: { tipo: n.tipo, ...(n.dados || {}) },
    })),
    edges: conexoes.map((c) => ({
      id: c.id,
      source: c.noOrigemId,
      target: c.noDestinoId,
      sourceHandle: c.pontoOrigem || null,
    })),
  };
}

// React Flow -> API.
export function reactFlowParaApi({ nodes = [], edges = [] }) {
  return {
    nos: nodes.map((n) => {
      const { tipo, ...dados } = n.data || {};
      return {
        id: n.id,
        tipo: tipo || 'MANUAL',
        posicaoX: n.position?.x ?? 0,
        posicaoY: n.position?.y ?? 0,
        dados,
      };
    }),
    conexoes: edges.map((e) => ({
      id: e.id,
      noOrigemId: e.source,
      noDestinoId: e.target,
      pontoOrigem: e.sourceHandle || null,
    })),
  };
}

// Cria um node React Flow novo a partir de um tipo do catalogo.
export function criarNoDoTipo(tipo, posicao) {
  const cfg = configDoTipo(tipo);
  if (!cfg) return null;
  return {
    id: novoIdNo(),
    type: TIPO_RF_NO,
    position: posicao,
    data: { tipo, ...cfg.dadosPadrao() },
  };
}
