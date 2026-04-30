import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Drawer lateral (painel direito). Para detalhes, formularios secundarios.
 *
 * Tamanhos: sm | md | lg | xl
 */
export default function Drawer({ isOpen, onClose, title, description, children, size = 'md', footer }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        className={clsx(
          'absolute right-0 top-0 bottom-0 w-full bg-[var(--bg-card)] border-l border-[var(--border-main)] shadow-[var(--shadow-lg)] flex flex-col',
          'animate-in slide-in-from-right fade-in duration-200',
          sizes[size]
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border-main)] flex-shrink-0">
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)] truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-[var(--text-muted)] mt-0.5 font-medium">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 -m-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="border-t border-[var(--border-main)] px-5 py-4 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
