import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Sistema de toast.
 * Uso:
 *   const toast = useToast();
 *   toast.success('Salvo com sucesso');
 *   toast.error('Falha ao carregar');
 *   toast('Mensagem neutra');
 *
 * Necessita <ToastProvider> no topo da arvore.
 */
const ToastContext = createContext({
  toast: () => {},
});

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remover = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const adicionar = useCallback((mensagem, opcoes = {}) => {
    const id = ++idCounter;
    const tipo = opcoes.tipo || 'default';
    const duracao = opcoes.duracao ?? 4000;
    setToasts((prev) => [...prev, { id, mensagem, tipo }]);
    if (duracao > 0) setTimeout(() => remover(id), duracao);
    return id;
  }, [remover]);

  const api = useCallback((msg, op) => adicionar(msg, op), [adicionar]);
  api.success = (msg, op) => adicionar(msg, { ...op, tipo: 'success' });
  api.error = (msg, op) => adicionar(msg, { ...op, tipo: 'error' });
  api.warning = (msg, op) => adicionar(msg, { ...op, tipo: 'warning' });
  api.info = (msg, op) => adicionar(msg, { ...op, tipo: 'info' });

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remover(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onClose }) {
  const tipos = {
    default: { Icon: Info, classe: 'bg-[var(--primary)] text-[var(--text-on-primary)]' },
    success: { Icon: CheckCircle2, classe: 'bg-[var(--primary)] text-[var(--text-on-primary)]' },
    error: { Icon: XCircle, classe: 'bg-[var(--danger)] text-white' },
    warning: { Icon: AlertCircle, classe: 'bg-[var(--warning)] text-white' },
    info: { Icon: Info, classe: 'bg-[var(--primary)] text-[var(--text-on-primary)]' },
  };

  const { Icon, classe } = tipos[toast.tipo] || tipos.default;
  const iconColor = toast.tipo === 'success' ? 'text-[#5DB17A]' : '';

  return (
    <div
      className={clsx(
        'pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-[var(--shadow-lg)] min-w-[300px] max-w-[480px]',
        'animate-in slide-in-from-top-2 fade-in duration-200',
        classe
      )}
    >
      <Icon size={18} className={clsx('flex-shrink-0', iconColor)} strokeWidth={2} />
      <span className="text-sm font-medium flex-1">{toast.mensagem}</span>
      <button
        onClick={onClose}
        className="opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={16} />
      </button>
    </div>
  );
}
