import { X } from 'lucide-react';
import { useEffect } from 'react';
import clsx from 'clsx';

/**
 * Modal do design system v2.
 * Tamanhos: sm | md | lg | xl
 */
export default function Modal({ isOpen, onClose, title, description, children, size = 'md' }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className={clsx(
        'relative w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden',
        'flex flex-col max-h-[90vh]',
        'animate-in zoom-in-95 fade-in duration-200',
        sizes[size]
      )}>
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--border-main)] flex-shrink-0">
            <div className="flex-1">
              {title && (
                <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
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

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
