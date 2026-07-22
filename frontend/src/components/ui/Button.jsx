import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

/**
 * Botao do design system.
 *
 * Variantes:
 *  - primary  : preto solido, texto branco (acao principal)
 *  - secondary: branco com borda, texto escuro
 *  - ghost    : sem fundo, hover sutil
 *  - accent   : terracota solida (acao destacada)
 *  - danger   : vermelho discreto (acao destrutiva)
 *
 * Tamanhos: sm | md | lg
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon,
  iconPosition = 'left',
  className,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all duration-150 rounded-lg select-none';

  const variants = {
    primary: 'bg-[var(--primary)] text-[var(--text-on-primary)] hover:bg-[var(--primary-hover)] active:bg-[var(--primary-active)] disabled:opacity-40 disabled:cursor-not-allowed',
    secondary: 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)] disabled:opacity-40 disabled:cursor-not-allowed',
    accent: 'bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:opacity-40 disabled:cursor-not-allowed',
    danger: 'bg-[var(--danger)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed',
    'danger-soft': 'bg-[var(--danger-soft)] text-[var(--danger-text)] hover:bg-[var(--danger-soft)]/80 disabled:opacity-40 disabled:cursor-not-allowed',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs h-8',
    md: 'px-4 py-2 text-sm h-10',
    lg: 'px-6 py-3 text-base h-12',
  };

  const iconSize = { sm: 14, md: 16, lg: 18 }[size];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        base,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={iconSize} className="animate-spin" />}
      {!loading && Icon && iconPosition === 'left' && <Icon size={iconSize} />}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon size={iconSize} />}
    </button>
  );
}
