import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Combobox: dropdown com busca textual.
 *
 * Props:
 *  - value: id selecionado
 *  - onChange: (id, item) => void
 *  - options: array de { value, label, sublabel?, badge? }
 *  - placeholder, label, hint, error, size, fullWidth
 *  - clearable: mostra botao de limpar (X)
 *  - disabled: bloqueia
 */
export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = 'Selecione...',
  label,
  hint,
  error,
  size = 'md',
  fullWidth = true,
  clearable = false,
  disabled = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selecionado = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setBusca('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.label?.toLowerCase().includes(q) ||
      o.sublabel?.toLowerCase().includes(q)
    );
  }, [options, busca]);

  const sizes = {
    sm: 'h-9 text-sm',
    md: 'h-11 text-sm',
    lg: 'h-12 text-base',
  };

  const handleSelect = (opt) => {
    onChange?.(opt.value, opt);
    setOpen(false);
    setBusca('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('', null);
  };

  return (
    <div className={clsx(fullWidth && 'w-full', className)}>
      {label && (
        <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={clsx(
            'w-full flex items-center justify-between gap-2 bg-[var(--bg-card)] rounded-xl px-4',
            'border transition-all duration-150 font-medium text-left',
            'focus:outline-none',
            sizes[size],
            error
              ? 'border-[var(--danger)]'
              : 'border-[var(--border-main)] hover:border-[var(--text-muted)]',
            open && 'border-[var(--primary)] shadow-[var(--shadow-focus)]',
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        >
          <div className="flex-1 min-w-0">
            {selecionado ? (
              <div className="text-[var(--text-main)] truncate">
                {selecionado.label}
                {selecionado.sublabel && (
                  <span className="text-[var(--text-muted)] ml-2 text-xs">{selecionado.sublabel}</span>
                )}
              </div>
            ) : (
              <span className="text-[var(--text-muted)] font-normal">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {clearable && selecionado && !disabled && (
              <span
                onClick={handleClear}
                className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X size={14} />
              </span>
            )}
            <ChevronDown
              size={16}
              className={clsx('text-[var(--text-muted)] transition-transform', open && 'rotate-180')}
            />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full bg-[var(--bg-elevated)] border border-[var(--border-main)] rounded-xl shadow-[var(--shadow-lg)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-2 border-b border-[var(--border-main)]">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
              {filtradas.length === 0 ? (
                <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                  Nenhum resultado
                </div>
              ) : (
                filtradas.map((opt) => {
                  const ativo = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                        ativo
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-xs text-[var(--text-muted)] truncate">{opt.sublabel}</div>
                        )}
                      </div>
                      {opt.badge && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-muted)] flex-shrink-0">
                          {opt.badge}
                        </span>
                      )}
                      {ativo && <Check size={14} className="text-[var(--accent)] flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {(error || hint) && (
        <p className={clsx(
          'text-xs mt-1.5 font-medium',
          error ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
        )}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
