import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import NoBase from './nos/NoBase';
import { MIME_TIPO_NO } from './PaletaNos';
import {
  apiParaReactFlow,
  criarNoDoTipo,
  novoIdConexao,
  TIPO_RF_NO,
} from './utilCanvas';

const TIPOS_NO_RF = { [TIPO_RF_NO]: NoBase };

// Wrapper que injeta o ReactFlowProvider (necessario pra useReactFlow funcionar).
export default function CanvasFluxo(props) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInterno({
  fluxoId,
  canvasInicial,
  noSelecionadoId,
  onSelecionarNo,
  onAlterarNos,
  onAlterarConexoes,
  onSujo,
}) {
  const inicial = useMemo(() => apiParaReactFlow(canvasInicial), [canvasInicial]);
  const [nodes, setNodes, baseNodesChange] = useNodesState(inicial.nodes);
  const [edges, setEdges, baseEdgesChange] = useEdgesState(inicial.edges);
  const wrapperRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const inicializadoRef = useRef(false);

  // Quando o fluxo abre/troca, reinicia o canvas com o estado vindo da API.
  useEffect(() => {
    setNodes(inicial.nodes);
    setEdges(inicial.edges);
    inicializadoRef.current = false;
  }, [fluxoId, inicial, setNodes, setEdges]);

  // Repassa estado pro pai sempre que muda. O pai persiste no save.
  useEffect(() => {
    onAlterarNos?.(nodes);
  }, [nodes, onAlterarNos]);

  useEffect(() => {
    onAlterarConexoes?.(edges);
  }, [edges, onAlterarConexoes]);

  const marcarSujo = useCallback(() => {
    if (!inicializadoRef.current) {
      inicializadoRef.current = true;
      return;
    }
    onSujo?.();
  }, [onSujo]);

  const onNodesChange = useCallback(
    (changes) => {
      baseNodesChange(changes);
      // "select" e "dimensions" sao puramente visuais e nao alteram o snapshot.
      if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) {
        marcarSujo();
      }
    },
    [baseNodesChange, marcarSujo]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      baseEdgesChange(changes);
      if (changes.some((c) => c.type !== 'select')) {
        marcarSujo();
      }
    },
    [baseEdgesChange, marcarSujo]
  );

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          { ...params, id: novoIdConexao() },
          eds
        )
      );
      marcarSujo();
    },
    [setEdges, marcarSujo]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const tipo = e.dataTransfer.getData(MIME_TIPO_NO);
      if (!tipo) return;

      const posicao = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const novo = criarNoDoTipo(tipo, posicao);
      if (!novo) return;

      setNodes((ns) => ns.concat(novo));
      marcarSujo();
      onSelecionarNo?.(novo.id);
    },
    [screenToFlowPosition, setNodes, marcarSujo, onSelecionarNo]
  );

  const onNodeClick = useCallback(
    (_e, node) => onSelecionarNo?.(node.id),
    [onSelecionarNo]
  );

  const onPaneClick = useCallback(() => onSelecionarNo?.(null), [onSelecionarNo]);

  const nodesComSelecao = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === noSelecionadoId })),
    [nodes, noSelecionadoId]
  );

  return (
    <div ref={wrapperRef} className="w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodesComSelecao}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={TIPOS_NO_RF}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          style: { stroke: 'var(--text-muted)', strokeWidth: 2 },
        }}
      >
        <Background color="var(--border-main)" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-[var(--bg-card)] !border !border-[var(--border-main)] !rounded-xl !overflow-hidden"
        />
        <MiniMap
          pannable
          zoomable
          maskColor="var(--bg-overlay)"
          className="!bg-[var(--bg-card)] !border !border-[var(--border-main)] !rounded-xl"
        />
      </ReactFlow>
    </div>
  );
}

