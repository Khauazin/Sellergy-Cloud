import clsx from 'clsx';

/**
 * Toggle switch (on/off).
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  ariaLabel,
}) {
  const sizes = {
    sm: { track: 'w-8 h-4.5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-3.5' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5', translate: 'translate-x-5' },
  };
  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={clsx(
        'relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200',
        s.track,
        checked ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          s.thumb,
          checked && s.translate
        )}
      />
    </button>
  );
}
