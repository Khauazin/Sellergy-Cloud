import clsx from 'clsx';

/**
 * Botao apenas com icone (square).
 * Usar para acoes secundarias em listas, headers, dropdowns.
 */
export default function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  ariaLabel,
  className,
  ...props
}) {
  const base = 'inline-flex items-center justify-center rounded-xl transition-all duration-150';

  const variants = {
    ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]',
    secondary: 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]',
    primary: 'bg-[var(--primary)] text-[var(--text-on-primary)] hover:bg-[var(--primary-hover)]',
    danger: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]',
  };

  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSize = { sm: 16, md: 18, lg: 20 }[size];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={clsx(
        base,
        variants[variant],
        sizes[size],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...props}
    >
      <Icon size={iconSize} strokeWidth={1.75} />
    </button>
  );
}
