import clsx from 'clsx';

/**
 * Avatar circular, fundo accent-soft + inicial OU foto.
 * Tons sutis, accent terracota suave (combina com a paleta).
 */
export default function Avatar({
  name = '',
  src,
  size = 'md',
  variant = 'accent',
  className,
}) {
  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const variants = {
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-text)]',
    neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
    primary: 'bg-[var(--primary)] text-[var(--text-on-primary)]',
  };

  const inicial = name?.trim()?.charAt(0)?.toUpperCase() || '?';

  return (
    <div
      className={clsx(
        'rounded-full inline-flex items-center justify-center font-semibold flex-shrink-0 overflow-hidden',
        sizes[size],
        !src && variants[variant],
        className
      )}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{inicial}</span>
      )}
    </div>
  );
}
