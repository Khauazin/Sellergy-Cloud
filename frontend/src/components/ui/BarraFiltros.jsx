// =====================================================================
// BarraFiltros — container padronizado para filtros de relatórios e listas
// =====================================================================
// Renderiza os filtros que vêm via `children` dentro de um Card limpo e
// adiciona o rodapé com:
//   - Contador de resultados (string, ex.: "42 lançamentos")
//   - Chips removíveis dos filtros ativos
//   - Botão "Limpar tudo" (só aparece quando há ao menos 1 filtro ativo)
//
// Uso:
//   <BarraFiltros
//     contador="42 lançamentos"
//     filtrosAtivos={[
//       { rotulo: 'Últimos 30 dias', onRemover: () => setPreset('30d') },
//       { rotulo: 'Categoria: Aluguel', onRemover: () => setCategoria('') },
//     ]}
//     onLimparTudo={() => limparTudo()}
//   >
//     <PeriodoPills ... />
//     <FiltroRapido ... />
//     ...
//   </BarraFiltros>

import { X } from 'lucide-react';
import Card from './Card';

export default function BarraFiltros({ children, contador, filtrosAtivos = [], onLimparTudo }) {
  const temFiltrosAtivos = filtrosAtivos.filter(Boolean).length > 0;

  return (
    <Card padding="md">
      <div className="space-y-3">
        {children}

        {(contador || temFiltrosAtivos) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {contador && (
                <span className="text-xs font-semibold text-[var(--text-secondary)] mr-2">
                  {contador}
                </span>
              )}
              {filtrosAtivos.filter(Boolean).map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={f.onRemover}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-text)] hover:bg-[var(--accent-soft)]/70 transition-colors"
                >
                  {f.rotulo}
                  <X size={11} strokeWidth={2.5} />
                </button>
              ))}
            </div>

            {temFiltrosAtivos && onLimparTudo && (
              <button
                type="button"
                onClick={onLimparTudo}
                className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] hover:underline transition-colors"
              >
                Limpar tudo
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
