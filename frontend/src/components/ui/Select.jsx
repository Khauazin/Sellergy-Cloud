import { forwardRef } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';

/**
 * Select padronizado (HTML <select> estilizado).
 * Para opcoes complexas com busca/avatar, criar um Combobox custom no futuro.
 */
const Select = forwardRef(function Select({
  label,
  hint,
  error,
  options = [],
  placeholder = 'Selecione...',
  size = 'md',
  fullWidth = true,
  className,
  ...props
}, ref) {
  const sizes = {
    sm: 'h-9 text-sm pl-3 pr-9',
    md: 'h-11 text-sm pl-4 pr-10',
    lg: 'h-12 text-base pl-5 pr-11',
  };

  // Label e hint maiores quando size=lg, pra acompanhar a tipografia.
  const labelCls = size === 'lg'
    ? 'block text-sm font-semibold tracking-wide text-[var(--text-secondary)] mb-2'
    : 'block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5';
  const hintCls = size === 'lg' ? 'text-sm mt-1.5 font-medium' : 'text-xs mt-1.5 font-medium';

  return (
    <div className={clsx(fullWidth && 'w-full')}>
      {label && (
        <label className={labelCls}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={clsx(
            'w-full appearance-none bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl',
            'border transition-all duration-150 font-medium',
            'focus:outline-none cursor-pointer',
            sizes[size],
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_rgba(153,27,27,0.12)]'
              : 'border-[var(--border-main)] focus:border-[var(--primary)] focus:shadow-[var(--shadow-focus)]',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value ?? opt} value={opt.value ?? opt}>
              {opt.label ?? opt}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
      </div>
      {(error || hint) && (
        <p className={clsx(
          hintCls,
          error ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
        )}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Select;
