// Pagina de relatorios consolidados do tenant. Comeca com a aba "Visao
// Executiva" (KPIs do periodo + top produtos). Outras abas (Financeiro,
// Vendas, CRM, Estoque/CMV, Bots) entram em fases proximas.
//
// Filosofia do filtro de periodo:
//   - Default: ultimos 30 dias.
//   - Presets rapidos: hoje, 7d, 30d, 90d, este mes, mes passado.
//   - Custom: 2 inputs de data.
//   - O periodo e GLOBAL (vale pra todas as abas) — quando trocar, todas
//     as abas refazem queries com o novo intervalo.

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, AlertCircle, Image as ImageIcon, Calendar, RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { Card, Button, Badge, Select, Input } from '../components/ui';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v) => `${Number(v ?? 0).toFixed(1)}%`;
const fmtNum = (v) => Number(v ?? 0).toLocaleString('pt-BR');

const PRESETS = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'mes_atual', label: 'Este mês' },
  { value: 'mes_anterior', label: 'Mês passado' },
  { value: 'custom', label: 'Personalizado' },
];

// Calcula intervalo a partir do preset.
function calcularIntervalo(preset, customInicio, customFim) {
  const fim = new Date();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'hoje':
      return { inicio, fim };
    case '7d':
      inicio.setDate(inicio.getDate() - 6);
      return { inicio, fim };
    case '30d':
      inicio.setDate(inicio.getDate() - 29);
      return { inicio, fim };
    case '90d':
      inicio.setDate(inicio.getDate() - 89);
      return { inicio, fim };
    case 'mes_atual':
      return {
        inicio: new Date(fim.getFullYear(), fim.getMonth(), 1, 0, 0, 0),
        fim,
      };
    case 'mes_anterior': {
      const ini = new Date(fim.getFullYear(), fim.getMonth() - 1, 1, 0, 0, 0);
      const f = new Date(fim.getFullYear(), fim.getMonth(), 0, 23, 59, 59, 999);
      return { inicio: ini, fim: f };
    }
    case 'custom':
      return {
        inicio: customInicio ? new Date(customInicio + 'T00:00:00') : inicio,
        fim: customFim ? new Date(customFim + 'T23:59:59') : fim,
      };
    default:
      return { inicio, fim };
  }
}

export default function RelatoriosPage() {
  const [preset, setPreset] = useState('30d');
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  const intervalo = useMemo(
    () => calcularIntervalo(preset, customInicio, customFim),
    [preset, customInicio, customFim]
  );

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/visao-executiva', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => {
        if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar relatórios.');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime()]);

  return (
    <div className="space-y-5">
      {/* Header com filtro de periodo */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">Relatórios</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Visão consolidada do que está acontecendo no seu negócio.
          </p>
        </div>
        <FiltroPeriodo
          preset={preset}
          onPresetChange={setPreset}
          customInicio={customInicio}
          customFim={customFim}
          onCustomInicio={setCustomInicio}
          onCustomFim={setCustomFim}
          intervalo={intervalo}
        />
      </div>

      {erro && (
        <Card padding="md">
          <div className="flex items-center gap-2 text-sm text-[var(--danger)]">
            <AlertCircle size={16} />
            <span>{erro}</span>
          </div>
        </Card>
      )}

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={DollarSign}
          color="success"
          label="Faturamento"
          valor={fmtBRL(dados?.faturamento.valor)}
          delta={dados?.faturamento.delta}
          carregando={carregando}
        />
        <KpiCard
          icon={TrendingUp}
          color="accent"
          label="Lucro líquido"
          valor={fmtBRL(dados?.lucroLiquido.valor)}
          delta={dados?.lucroLiquido.delta}
          subvalor={dados ? `Margem ${fmtPct(dados.lucroLiquido.margem)}` : null}
          carregando={carregando}
        />
        <KpiCard
          icon={Package}
          color="warning"
          label="CMV"
          valor={fmtBRL(dados?.cmv.valor)}
          subvalor={dados ? `${fmtPct(dados.cmv.percentual)} do faturamento` : null}
          carregando={carregando}
        />
        <KpiCard
          icon={AlertCircle}
          color={dados?.caixa.emRisco > 0 ? 'danger' : 'neutral'}
          label="A receber em atraso"
          valor={fmtBRL(dados?.caixa.emRisco)}
          subvalor={dados ? `${dados.caixa.emRiscoQtd} título(s)` : null}
          carregando={carregando}
        />
        <KpiCard
          icon={ShoppingCart}
          color="info"
          label="Vendas"
          valor={fmtNum(dados?.vendas.total)}
          subvalor={dados ? `Ticket médio ${fmtBRL(dados.vendas.ticketMedio)}` : null}
          carregando={carregando}
        />
        <KpiCard
          icon={Users}
          color="info"
          label="Leads criados"
          valor={fmtNum(dados?.leads.criados)}
          delta={dados?.leads.delta}
          carregando={carregando}
        />
        <KpiCard
          icon={TrendingUp}
          color="success"
          label="Lucro bruto"
          valor={fmtBRL(dados?.cmv.lucroBruto)}
          subvalor={dados?.faturamento.valor > 0
            ? `${fmtPct((dados.cmv.lucroBruto / dados.faturamento.valor) * 100)} margem bruta`
            : null}
          carregando={carregando}
        />
        <KpiCard
          icon={DollarSign}
          color="success"
          label="Saldo do período"
          valor={fmtBRL(dados?.caixa.saldoPeriodo)}
          subvalor={dados ? `Receita ${fmtBRL(dados.caixa.receitaPaga)}, despesa ${fmtBRL(dados.caixa.despesaPaga)}` : null}
          carregando={carregando}
        />
      </div>

      {/* Top produtos */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top produtos vendidos</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">No período selecionado</div>
          </div>
          {dados && (
            <Badge variant="neutral" size="sm">{dados.topProdutos.length} produto(s)</Badge>
          )}
        </div>
        {carregando && !dados ? (
          <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>
        ) : !dados || dados.topProdutos.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Package className="mx-auto mb-2 text-[var(--text-muted)] opacity-50" size={32} />
            <div className="text-sm text-[var(--text-muted)]">Nenhuma venda no período.</div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-14"></th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Quantidade</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Receita</th>
              </tr>
            </thead>
            <tbody>
              {dados.topProdutos.map((p, idx) => (
                <tr key={p.variacaoId} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  <td className="py-3 px-5">
                    {p.imagemUrl ? (
                      <img src={p.imagemUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-[var(--border-main)]" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-muted)]">
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
                      <span className="text-[var(--text-muted)] mr-2">#{idx + 1}</span>
                      {p.nome}
                      {p.variacao && <span className="text-[var(--text-muted)] font-medium"> · {p.variacao}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--text-main)]">
                    {fmtNum(p.quantidade)}
                  </td>
                  <td className="py-3 px-5 text-right text-sm font-bold tabular-nums text-[var(--success)]">
                    {fmtBRL(p.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Placeholder de outras abas (transparencia: aviso o que vem) */}
      <Card padding="md">
        <div className="text-xs text-[var(--text-muted)]">
          <strong className="text-[var(--text-secondary)]">Em breve nas próximas abas:</strong>{' '}
          Financeiro detalhado (DRE, fluxo de caixa, aging de inadimplência), Vendas (por canal, sazonalidade),
          CRM (funil de conversão, tempo médio por etapa), Estoque & CMV (margem por produto, curva ABC),
          Bots/IA (mensagens/dia, custo de tokens).
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Componentes auxiliares
// ============================================================

function FiltroPeriodo({
  preset, onPresetChange,
  customInicio, customFim, onCustomInicio, onCustomFim,
  intervalo,
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[180px]">
        <Select
          size="sm"
          label=""
          value={preset}
          onChange={(e) => onPresetChange(e.target.value)}
          options={PRESETS}
          placeholder=""
        />
      </div>
      {preset === 'custom' && (
        <>
          <Input
            size="sm"
            type="date"
            value={customInicio}
            onChange={(e) => onCustomInicio(e.target.value)}
          />
          <Input
            size="sm"
            type="date"
            value={customFim}
            onChange={(e) => onCustomFim(e.target.value)}
          />
        </>
      )}
      <div className="text-[10px] text-[var(--text-muted)] pb-2.5 flex items-center gap-1">
        <Calendar size={11} />
        {intervalo.inicio.toLocaleDateString('pt-BR')} a {intervalo.fim.toLocaleDateString('pt-BR')}
      </div>
    </div>
  );
}

const COR_CLASSES = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
};

function KpiCard({ icon: Icon, color = 'neutral', label, valor, subvalor, delta, carregando }) {
  const colorCls = COR_CLASSES[color] || COR_CLASSES.neutral;
  const deltaPositivo = delta !== null && delta !== undefined && delta > 0;
  const deltaNegativo = delta !== null && delta !== undefined && delta < 0;

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorCls}`}>
          <Icon size={16} strokeWidth={2} />
        </div>
        {delta !== null && delta !== undefined && (
          <div className={`flex items-center gap-0.5 text-[11px] font-bold ${
            deltaPositivo ? 'text-[var(--success)]' : deltaNegativo ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
          }`}>
            {deltaPositivo ? <TrendingUp size={11} /> : deltaNegativo ? <TrendingDown size={11} /> : null}
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-3">
        {label}
      </div>
      <div className="text-xl font-bold tracking-tight text-[var(--text-main)] mt-1 tabular-nums">
        {carregando && !valor ? <span className="inline-block w-24 h-5 bg-[var(--bg-subtle)] rounded animate-pulse" /> : valor}
      </div>
      {subvalor && (
        <div className="text-[11px] text-[var(--text-muted)] mt-1">{subvalor}</div>
      )}
    </Card>
  );
}
