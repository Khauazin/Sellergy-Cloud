// =====================================================================
// INPUT DURACAO — HORAS + MINUTOS
// =====================================================================
// Componente controlado que aceita duracao em MINUTOS no `value` e devolve
// MINUTOS no `onChange`. Internamente exibe 2 inputs (horas e min) pro usuario
// nao precisar fazer conta — '1h30' = 90min.
//
// Uso:
//   <InputDuracao
//     label="Quanto tempo leva?"
//     value={form.duracaoMin}          // numero (minutos) ou '' ou null
//     onChange={(min) => setForm({ ...form, duracaoMin: min })}
//     hint="A Agenda usa isso pra nao marcar 2 clientes ao mesmo tempo."
//   />
//
// value = null/'' -> ambos campos vazios. onChange recebe null quando ambos vazios.

import clsx from 'clsx';

function parseNum(v) {
  if (v === '' || v == null) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function InputDuracao({ label, value, onChange, hint, required, disabled, size = 'md' }) {
  // value em minutos -> divide em horas e min pra exibir
  const totalMin = value === '' || value == null ? null : parseInt(value, 10);
  const horas = totalMin == null || Number.isNaN(totalMin) ? '' : Math.floor(totalMin / 60);
  const mins  = totalMin == null || Number.isNaN(totalMin) ? '' : totalMin % 60;

  const emitir = (novasHoras, novosMin) => {
    const h = parseNum(novasHoras);
    const m = parseNum(novosMin);
    // Se ambos vazios, devolve '' pro form tratar como "nao definido".
    if (novasHoras === '' && novosMin === '') {
      onChange?.('');
      return;
    }
    onChange?.(h * 60 + m);
  };

  // Variante lg: alinhada com Input/Select pra usar em modais grandes.
  const ehLg = size === 'lg';
  const labelCls = ehLg
    ? 'block text-sm font-semibold tracking-wide text-[var(--text-secondary)] mb-2'
    : 'block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5';
  const inputCls = ehLg
    ? 'w-full bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl border border-[var(--border-main)] py-3 px-4 text-base font-medium tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30'
    : 'w-full bg-[var(--bg-card)] text-[var(--text-main)] rounded-xl border border-[var(--border-main)] py-2.5 px-3 text-sm font-medium tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30';
  const sufCls = ehLg ? 'text-sm font-semibold text-[var(--text-muted)] uppercase' : 'text-xs font-semibold text-[var(--text-muted)] uppercase';
  const hintCls = ehLg ? 'mt-1.5 text-sm text-[var(--text-muted)]' : 'mt-1 text-xs text-[var(--text-muted)]';

  return (
    <div className="w-full">
      {label && (
        <label className={labelCls}>
          {label}{required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="number"
            min={0}
            max={24}
            value={horas}
            onChange={(e) => emitir(e.target.value, mins === '' ? '' : String(mins))}
            disabled={disabled}
            placeholder="0"
            className={clsx(
              inputCls,
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="Horas"
          />
          <span className={sufCls}>h</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="number"
            min={0}
            max={59}
            value={mins}
            onChange={(e) => emitir(horas === '' ? '' : String(horas), e.target.value)}
            disabled={disabled}
            placeholder="0"
            className={clsx(
              inputCls,
              disabled && 'opacity-50 cursor-not-allowed',
            )}
            aria-label="Minutos"
          />
          <span className={sufCls}>min</span>
        </div>
      </div>
      {hint && (
        <p className={hintCls}>{hint}</p>
      )}
    </div>
  );
}
