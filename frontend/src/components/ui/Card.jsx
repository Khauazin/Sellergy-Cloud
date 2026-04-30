import clsx from 'clsx';

/**
 * Container basico do design system. Bg branco, borda sutil, raio 16px.
 *
 * Variantes:
 *  - default : card padrao com borda
 *  - flat    : sem borda, apenas fundo
 *  - elevated: com sombra leve (modais inline, popovers)
 */
export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  className,
  ...props
}) {
  const variants = {
    default: 'bg-[var(--bg-card)] border border-[var(--border-main)]',
    flat: 'bg-[var(--bg-card)]',
    elevated: 'bg-[var(--bg-card)] border border-[var(--border-main)] shadow-[var(--shadow-md)]',
    subtle: 'bg-[var(--bg-subtle)]',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        'rounded-2xl',
        variants[variant],
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={clsx('flex items-center justify-between gap-4 mb-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={clsx('text-base font-semibold tracking-tight text-[var(--text-main)]', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }) {
  return (
    <p className={clsx('text-sm text-[var(--text-muted)] mt-1', className)} {...props}>
      {children}
    </p>
  );
}
