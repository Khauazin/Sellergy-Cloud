// KpiCard padrao da plataforma — usado em Dashboards/Relatorios/Vendas/etc.
// Layout: [icone colorido] + [label + ?info] + [valor grande] + [subvalor]
// Suporta delta (% mudanca vs periodo anterior, com seta colorida).
//
// Tamanhos pensados pra legibilidade em telas grandes — proporcoes maiores
// que o padrao anterior pra nao forcar a vista do usuario.
//
// Props:
//   - icon: componente lucide (ex: ShoppingBag)
//   - color: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
//   - label: rotulo curto
//   - valor: string ja formatada (ex: "R$ 1.234,56")
//   - subvalor: linha secundaria (opcional)
//   - delta: numero (% de variacao; positivo verde, negativo vermelho)
//   - carregando: bool (mostra skeleton no lugar do valor)
//   - info: string (texto do tooltip explicativo, opcional)
//   - acao: ReactNode (botao/link extra abaixo do valor, opcional)

import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import Card from './Card';
import Tooltip from './Tooltip';

const COR_CLASSES = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
};

export default function KpiCard({
  icon: Icon,
  color = 'neutral',
  label,
  valor,
  subvalor,
  delta,
  carregando,
  info,
  acao,
}) {
  const colorCls = COR_CLASSES[color] || COR_CLASSES.neutral;
  const deltaPositivo = delta !== null && delta !== undefined && delta > 0;
  const deltaNegativo = delta !== null && delta !== undefined && delta < 0;

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorCls}`}>
          {Icon && <Icon size={20} strokeWidth={2} />}
        </div>
        {delta !== null && delta !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${
            deltaPositivo ? 'text-[var(--success)]'
              : deltaNegativo ? 'text-[var(--danger)]'
              : 'text-[var(--text-muted)]'
          }`}>
            {deltaPositivo ? <TrendingUp size={13} /> : deltaNegativo ? <TrendingDown size={13} /> : null}
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 mt-4">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
        {info && (
          <Tooltip content={info}>
            <HelpCircle size={14} strokeWidth={2} className="text-[var(--text-muted)] opacity-70 hover:opacity-100 cursor-help" />
          </Tooltip>
        )}
      </div>
      <div className="text-2xl font-bold tracking-tight text-[var(--text-main)] mt-1.5 tabular-nums">
        {carregando && !valor ? <span className="inline-block w-24 h-6 bg-[var(--bg-subtle)] rounded animate-pulse" /> : valor}
      </div>
      {subvalor && <div className="text-xs text-[var(--text-muted)] mt-1.5">{subvalor}</div>}
      {acao && <div className="mt-2">{acao}</div>}
    </Card>
  );
}
