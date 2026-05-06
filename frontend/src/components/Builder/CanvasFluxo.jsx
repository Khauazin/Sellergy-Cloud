import { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import NoBase from './nos/NoBase';
import { MIME_TIPO_NO } from './PaletaNos';
import { TIPO_RF_NO } from './utilCanvas';

const TIPOS_NO_RF = { [TIPO_RF_NO]: NoBase };

// Wrapper que injeta o ReactFlowProvider (necessario pra useReactFlow funcionar).
export default function CanvasFluxo(props) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}

/**
 * Componente CONTROLLED. A fonte da verdade dos `nodes` e `edges` esta no pai
 * (BuilderPage). Aqui apenas renderizamos e despachamos eventos do React Flow
 * de volta via callbacks. Isso evita state duplicado e garante que exclusoes
 * disparadas pelo painel direito sejam refletidas no canvas imediatamente.
 */
function CanvasInterno({
  nodes,
  edges,
  noSelecionadoId,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAdicionarNoPorPosicao,
  onSelecionarNo,
}) {
  const wrapperRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

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
      onAdicionarNoPorPosicao?.(tipo, posicao);
    },
    [screenToFlowPosition, onAdicionarNoPorPosicao]
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
