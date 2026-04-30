import { forwardRef, useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Input basico com suporte a:
 *  - icone a esquerda
 *  - acao a direita (botao)
 *  - tipo password com toggle de visibilidade
 *  - estado de erro
 */
const Input = forwardRef(function Input({
  type = 'text',
  label,
  hint,
  error,
  icon: Icon,
  rightSlot,
  size = 'md',
  fullWidth = true,
  className,
  ...props
}, ref) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const sizes = {
    sm: 'h-9 text-sm px-3',
    md: 'h-11 text-sm px-4',
    lg: 'h-12 text-base px-5',
  };

  const padLeft = Icon ? (size === 'sm' ? 'pl-9' : 'pl-11') : '';
  const padRight = (rightSlot || isPassword) ? 'pr-11' : '';

  return (
    <div className={clsx(fullWidth && 'w-full')}>
      {label && (
        <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} />
          </div>
        )}
        <input
          ref={ref}
          type={actualType}
          className={clsx(
            'w-full bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl',
            'border transition-all duration-150 font-medium',
            'focus:outline-none',
            sizes[size],
            padLeft,
            padRight,
            error
              ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_rgba(153,27,27,0.12)]'
              : 'border-[var(--border-main)] focus:border-[var(--primary)] focus:shadow-[var(--shadow-focus)]',
            'placeholder:text-[var(--text-muted)] placeholder:font-normal',
            className
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        ) : rightSlot ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</div>
        ) : null}
      </div>
      {(error || hint) && (
        <p className={clsx(
          'text-xs mt-1.5 font-medium',
          error ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
        )}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Input;
