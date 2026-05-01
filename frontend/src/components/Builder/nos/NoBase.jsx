import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import { configDoTipo } from '../catalogoNos';

const CLASSES_COR = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/30',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30',
  success: 'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/30',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-main)]',
};

const ALTURA_HANDLE_SAIDA = 22;
const OFFSET_INICIAL_HANDLE = 14;

function NoBase({ data, selected }) {
  const cfg = configDoTipo(data?.tipo);
  if (!cfg) return null;

  const Icone = cfg.icone;
  const corClasse = CLASSES_COR[cfg.cor] || CLASSES_COR.neutral;
  const saidas = cfg.handles.saidas;
  const multiplasSaidas = saidas.length > 1;

  return (
    <div
      className={clsx(
        'rounded-xl border bg-[var(--bg-card)] shadow-sm min-w-[200px]',
        'transition-all',
        selected
          ? 'shadow-md ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-app)] border-[var(--accent-border)]'
          : 'border-[var(--border-main)]'
      )}
    >
      {cfg.handles.entrada && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-[var(--accent)] !border-0 !w-3 !h-3"
        />
      )}

      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-main)]">
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center border', corClasse)}>
          <Icone size={14} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {cfg.rotulo}
          </div>
          <div className="text-sm font-semibold tracking-tight text-[var(--text-main)] truncate">
            {data?.label || cfg.rotulo}
          </div>
        </div>
      </div>

      <ResumoDados tipo={cfg.tipo} data={data} />

      {!multiplasSaidas && saidas.length === 1 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-[var(--accent)] !border-0 !w-3 !h-3"
        />
      )}

      {multiplasSaidas && (
        <div className="py-2">
          {saidas.map((s, i) => (
            <div key={s} className="flex items-center justify-end gap-2 pr-3 relative h-[22px]">
              <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-muted)]">
                {s}
              </span>
              <Handle
                id={s}
                type="source"
                position={Position.Right}
                style={{
                  top: OFFSET_INICIAL_HANDLE + i * ALTURA_HANDLE_SAIDA,
                  background: 'var(--accent)',
                  border: 0,
                  width: 12,
                  height: 12,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumoDados({ tipo, data }) {
  if (!data) return null;
  if (tipo === 'HTTP_REQUEST' && data.url) {
    return (
      <div className="px-3 py-2 text-[11px] text-[var(--text-secondary)] truncate">
        <span className="font-bold">{data.metodo || 'GET'}</span> {data.url}
      </div>
    );
  }
  if (tipo === 'IF' && data.condicao) {
    return (
      <div className="px-3 py-2 text-[11px] text-[var(--text-secondary)] truncate font-mono">
        {data.condicao}
      </div>
    );
  }
  if (tipo === 'SET' && Array.isArray(data.atribuicoes) && data.atribuicoes.length > 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">
        {data.atribuicoes.length} atribuicao{data.atribuicoes.length === 1 ? '' : 'oes'}
      </div>
    );
  }
  return null;
}

export default memo(NoBase);
