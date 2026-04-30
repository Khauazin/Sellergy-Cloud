import { forwardRef } from 'react';
import clsx from 'clsx';

const Textarea = forwardRef(function Textarea({
  label,
  hint,
  error,
  rows = 4,
  fullWidth = true,
  className,
  ...props
}, ref) {
  return (
    <div className={clsx(fullWidth && 'w-full')}>
      {label && (
        <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm',
          'border transition-all duration-150 font-medium resize-y',
          'focus:outline-none',
          error
            ? 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_rgba(153,27,27,0.12)]'
            : 'border-[var(--border-main)] focus:border-[var(--primary)] focus:shadow-[var(--shadow-focus)]',
          'placeholder:text-[var(--text-muted)] placeholder:font-normal',
          className
        )}
        {...props}
      />
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

export default Textarea;
