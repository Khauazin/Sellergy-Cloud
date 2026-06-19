// Tooltip leve baseado em CSS (group-hover) — sem deps de JS pesado.
// Renderiza um wrapper relative que mostra o tooltip ao passar o mouse no
// trigger. Largura max compacta pra nao tomar a tela, animacao curta.
//
// Uso:
//   <Tooltip content="Explicacao curta aqui">
//     <Info size={12} className="text-[var(--text-muted)]" />
//   </Tooltip>
//
// Props:
//   - content: string (texto curto, 1-2 linhas, max ~120 chars)
//   - children: o trigger (icone, texto, qualquer elemento)
//   - position: 'top' (default) | 'bottom' | 'left' | 'right'
//   - className: classes extras pro wrapper

import clsx from 'clsx';

export default function Tooltip({ content, children, position = 'top', className = '' }) {
  if (!content) return children;

  // Posicionamento + offset maior (mb-2.5) pra nao colar no trigger.
  const posClasses = {
    top: 'left-1/2 -translate-x-1/2 bottom-full mb-2.5',
    bottom: 'left-1/2 -translate-x-1/2 top-full mt-2.5',
    left: 'right-full mr-2.5 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2.5 top-1/2 -translate-y-1/2',
  };

  return (
    <span className={clsx('relative inline-flex items-center group/tooltip', className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          'absolute z-50 pointer-events-none',
          // Padding maior + cantos arredondados pra parecer um card de info,
          // nao um chip apertado.
          'px-4 py-3 rounded-xl',
          'bg-[var(--bg-elevated)] border border-[var(--border-main)] shadow-[var(--shadow-lg)]',
          // text-sm (14px) + leading-relaxed pra leitura confortavel em 2-3 linhas.
          'text-sm font-medium text-[var(--text-secondary)] leading-relaxed',
          // Largura intermediaria: nao chip minusculo, nao tela inteira.
          'whitespace-normal w-max max-w-[300px] text-left',
          'opacity-0 group-hover/tooltip:opacity-100',
          'transition-opacity duration-150 delay-100',
          posClasses[position]
        )}
      >
        {content}
      </span>
    </span>
  );
}
