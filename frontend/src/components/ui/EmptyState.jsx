import clsx from 'clsx';

/**
 * Estado vazio. Usar quando lista nao tem itens, busca sem resultados, etc.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}) {
  return (
    <div className={clsx(
      'flex flex-col items-center justify-center text-center py-16 px-6',
      className
    )}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center mb-4">
          <Icon size={24} strokeWidth={1.5} className="text-[var(--text-muted)]" />
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
