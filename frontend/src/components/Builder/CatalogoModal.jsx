import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';
import { TIPOS_NO_PALETA } from './catalogoNos';

const ROTULOS_CATEGORIA = {
  TRIGGERS: 'Disparadores',
  CORE: 'Logica e Acoes',
  IA: 'Inteligencia Artificial',
  INTEGRACAO: 'Integracoes',
};

const CLASSES_COR = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)] border-[var(--info)]/30',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/30',
  success: 'bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/30',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-main)]',
};

export default function CatalogoModal({ isOpen, onClose, onSelecionar }) {
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa busca ao abrir
    setBusca('');
    const fechar = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', fechar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fechar);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = TIPOS_NO_PALETA.filter((cfg) => {
      if (!termo) return true;
      return (
        cfg.rotulo.toLowerCase().includes(termo) ||
        cfg.descricao.toLowerCase().includes(termo) ||
        cfg.tipo.toLowerCase().includes(termo)
      );
    });
    const out = {};
    for (const cfg of filtrados) {
      const cat = cfg.categoria || 'CORE';
      if (!out[cat]) out[cat] = [];
      out[cat].push(cfg);
    }
    return out;
  }, [busca]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110]">
      <div
        className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-start justify-center p-4 sm:p-8 pointer-events-none">
        <div
          className={clsx(
            'pointer-events-auto bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--border-main)]',
            'w-full max-w-2xl mt-12 sm:mt-20 overflow-hidden flex flex-col max-h-[80vh]',
            'animate-in slide-in-from-top-4 fade-in duration-200'
          )}
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-main)] flex-shrink-0">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nó por nome, descricao ou tipo..."
                className="w-full bg-transparent border-0 outline-none text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] py-2 pl-9 pr-3"
              />
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {Object.keys(grupos).length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--text-muted)]">
                Nenhum nó encontrado para "{busca}".
              </div>
            ) : (
              Object.entries(grupos).map(([cat, itens]) => (
                <div key={cat} className="mb-4 last:mb-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1 mb-2">
                    {ROTULOS_CATEGORIA[cat] || cat}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {itens.map((cfg) => {
                      const Icone = cfg.icone;
                      const corClasse = CLASSES_COR[cfg.cor] || CLASSES_COR.neutral;
                      return (
                        <button
                          key={cfg.tipo}
                          type="button"
                          onClick={() => {
                            onSelecionar?.(cfg.tipo);
                            onClose?.();
                          }}
                          className={clsx(
                            'flex items-start gap-3 p-3 rounded-xl border border-[var(--border-main)]',
                            'bg-[var(--bg-card)] hover:border-[var(--accent-border)] hover:bg-[var(--bg-subtle)]',
                            'transition-all text-left'
                          )}
                        >
                          <div className={clsx(
                            'w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0',
                            corClasse
                          )}>
                            <Icone size={16} strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
                              {cfg.rotulo}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
                              {cfg.descricao}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t border-[var(--border-main)] flex items-center justify-between text-[10px] text-[var(--text-muted)] flex-shrink-0">
            <span>
              {TIPOS_NO_PALETA.length} tipos disponiveis
            </span>
            <span>Esc para fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
