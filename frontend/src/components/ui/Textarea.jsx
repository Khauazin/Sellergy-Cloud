import { forwardRef } from 'react';
import clsx from 'clsx';

const Textarea = forwardRef(function Textarea({
  label,
  hint,
  error,
  rows = 4,
  size = 'md',
  fullWidth = true,
  className,
  ...props
}, ref) {
  const ehLg = size === 'lg';
  const labelCls = ehLg
    ? 'block text-sm font-semibold tracking-wide text-[var(--text-secondary)] mb-2'
    : 'block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5';
  const hintCls = ehLg ? 'text-sm mt-1.5 font-medium' : 'text-xs mt-1.5 font-medium';
  const textareaText = ehLg ? 'text-base px-5 py-3.5' : 'text-sm px-4 py-3';

  return (
    <div className={clsx(fullWidth && 'w-full')}>
      {label && (
        <label className={labelCls}>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={clsx(
          'w-full bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl',
          textareaText,
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
          hintCls,
          error ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
        )}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

export default Textarea;
