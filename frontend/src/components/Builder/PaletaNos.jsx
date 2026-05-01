import clsx from 'clsx';
import { TIPOS_NO_PALETA } from './catalogoNos';

// MIME interno usado pra transferir o tipo do no durante drag-and-drop.
export const MIME_TIPO_NO = 'application/x-bot-no-tipo';

export default function PaletaNos() {
  const onDragStart = (e, tipo) => {
    e.dataTransfer.setData(MIME_TIPO_NO, tipo);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 px-1">
        Arraste para o canvas
      </div>
      {TIPOS_NO_PALETA.map((cfg) => {
        const Icone = cfg.icone;
        return (
          <div
            key={cfg.tipo}
            draggable
            onDragStart={(e) => onDragStart(e, cfg.tipo)}
            className={clsx(
              'flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-main)]',
              'bg-[var(--bg-card)] cursor-grab hover:border-[var(--accent-border)] hover:bg-[var(--bg-subtle)]',
              'transition-colors active:cursor-grabbing'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
              <Icone size={14} strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--text-main)] tracking-tight">
                {cfg.rotulo}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">{cfg.descricao}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
