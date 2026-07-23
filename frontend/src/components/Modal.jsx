import { X } from 'lucide-react';
import { useEffect } from 'react';
import clsx from 'clsx';

/**
 * Modal do design system v2.
 * Tamanhos: sm | md | lg | xl | 2xl
 *
 * Use '2xl' pra modals de cadastro denso (varios campos lado a lado) onde
 * a UX precisa de labels maiores e mais ar entre os controles.
 */
export default function Modal({ isOpen, onClose, title, description, children, size = 'md', fecharAoClicarFora = false }) {
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
    '2xl': 'max-w-5xl',
  };

  // Modais grandes (xl/2xl) tem tipografia maior no header pra equilibrar
  // com a area de conteudo mais espacosa.
  const ehGrande = size === 'xl' || size === '2xl';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Clique fora NAO fecha por padrao (evita perder dados de formulario por
          clique acidental). Fecha so pelo X ou Cancelar. Passe fecharAoClicarFora
          se algum modal quiser o dismiss por clique fora. */}
      <div
        className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm animate-in fade-in duration-200"
        onClick={fecharAoClicarFora ? onClose : undefined}
      />

      <div className={clsx(
        'relative w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden',
        'flex flex-col max-h-[90vh]',
        'animate-in zoom-in-95 fade-in duration-200',
        sizes[size]
      )}>
        {(title || onClose) && (
          <div className={clsx(
            'flex items-start justify-between gap-4 border-b border-[var(--border-main)] flex-shrink-0',
            ehGrande ? 'px-8 py-6' : 'px-6 py-5'
          )}>
            <div className="flex-1">
              {title && (
                <h3 className={clsx(
                  'font-semibold tracking-tight text-[var(--text-main)]',
                  ehGrande ? 'text-xl' : 'text-base'
                )}>
                  {title}
                </h3>
              )}
              {description && (
                <p className={clsx(
                  'text-[var(--text-muted)] mt-1 font-medium',
                  ehGrande ? 'text-base' : 'text-sm'
                )}>
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

        <div className={clsx('overflow-y-auto flex-1', ehGrande ? 'px-8 py-6' : 'px-6 py-5')}>
          {children}
        </div>
      </div>
    </div>
  );
}
