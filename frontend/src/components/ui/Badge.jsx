import clsx from 'clsx';

/**
 * Badge / pill / tag.
 * Variantes semanticas com fundo soft + texto escuro.
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  icon: Icon,
  className,
}) {
  const variants = {
    neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-main)]',
    primary: 'bg-[var(--primary-soft)] text-[var(--text-main)] border border-[var(--border-main)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]',
    success: 'bg-[var(--success-soft)] text-[var(--success-text)] border border-[var(--success-soft)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning-text)] border border-[var(--warning-soft)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger-text)] border border-[var(--danger-soft)]',
    info: 'bg-[var(--info-soft)] text-[var(--info-text)] border border-[var(--info-soft)]',
    solid: 'bg-[var(--primary)] text-[var(--text-on-primary)]',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 h-5 gap-1',
    md: 'text-xs px-2.5 py-1 h-6 gap-1.5',
    lg: 'text-sm px-3 py-1 h-7 gap-1.5',
  };

  const iconSize = { sm: 10, md: 12, lg: 14 }[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full font-semibold tracking-wide',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {Icon && <Icon size={iconSize} strokeWidth={2} />}
      {children}
    </span>
  );
}
