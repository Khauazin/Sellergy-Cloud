import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

/**
 * Dropdown / menu basico.
 * Uso:
 *  <Dropdown trigger={<button>...</button>}>
 *    <DropdownItem onClick={...}>Acao</DropdownItem>
 *    <DropdownDivider />
 *    <DropdownItem variant="danger">Excluir</DropdownItem>
 *  </Dropdown>
 */
export default function Dropdown({
  trigger,
  children,
  align = 'right',
  className,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={clsx('relative inline-block', className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute z-50 mt-2 min-w-[200px] py-1.5',
            'bg-[var(--bg-elevated)] border border-[var(--border-main)] rounded-xl shadow-[var(--shadow-lg)]',
            'animate-in fade-in zoom-in-95 duration-150',
            align === 'right' && 'right-0',
            align === 'left' && 'left-0',
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  icon: Icon,
  variant = 'default',
  disabled = false,
  className,
}) {
  const variants = {
    default: 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]',
    danger: 'text-[var(--danger)] hover:bg-[var(--danger-soft)]',
    accent: 'text-[var(--accent-text)] hover:bg-[var(--accent-soft)]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full text-left flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors',
        variants[variant],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} className="flex-shrink-0" />}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1.5 h-px bg-[var(--border-main)]" />;
}

export function DropdownLabel({ children }) {
  return (
    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </div>
  );
}
