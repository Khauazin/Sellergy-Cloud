import { Search, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * Barra de busca padronizada.
 */
export default function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Buscar...',
  size = 'md',
  fullWidth = true,
  className,
}) {
  const sizes = {
    sm: 'h-9 text-sm',
    md: 'h-11 text-sm',
    lg: 'h-12 text-base',
  };

  const handleClear = () => {
    if (onClear) onClear();
    else if (onChange) onChange({ target: { value: '' } });
  };

  return (
    <div className={clsx('relative', fullWidth && 'w-full', className)}>
      <Search
        size={size === 'sm' ? 14 : 16}
        strokeWidth={1.75}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={clsx(
          'w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl',
          'pl-10 pr-10 transition-all duration-150 font-medium',
          'focus:outline-none focus:border-[var(--primary)] focus:shadow-[var(--shadow-focus)]',
          'placeholder:text-[var(--text-muted)] placeholder:font-normal',
          'text-[var(--text-main)]',
          sizes[size]
        )}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
