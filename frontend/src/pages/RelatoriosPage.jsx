// Pagina de relatorios consolidados do tenant.
// Estrutura: Tabs (Visao Executiva, CRM, ...) + filtro de periodo GLOBAL.
// Cada aba e um componente que recebe o intervalo e busca seus dados.
//
// Filosofia do filtro de periodo:
//   - Default: ultimos 30 dias. Presets rapidos + custom.
//   - GLOBAL: vale pra todas as abas — quando troca, todas refazem queries.

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, AlertCircle, Image as ImageIcon, Calendar,
  Filter, Clock, Phone, Mail, Wallet, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';
import api from '../services/api';
import {
  Card, Badge, Select, Input,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '../components/ui';

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
  const [aba, setAba] = useState('executiva');
  const [preset, setPreset] = useState('30d');
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');

  const intervalo = useMemo(
    () => calcularIntervalo(preset, customInicio, customFim),
    [preset, customInicio, customFim]
  );

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

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="executiva">Visão executiva</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="executiva">
          <AbaVisaoExecutiva intervalo={intervalo} />
        </TabsContent>

        <TabsContent value="crm">
          <AbaCRM intervalo={intervalo} />
        </TabsContent>

        <TabsContent value="financeiro">
          <AbaFinanceiro intervalo={intervalo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// ABA: Visao Executiva
// ============================================================
function AbaVisaoExecutiva({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

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
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime()]);

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} color="success" label="Faturamento"
          valor={fmtBRL(dados?.faturamento.valor)} delta={dados?.faturamento.delta} carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Lucro líquido"
          valor={fmtBRL(dados?.lucroLiquido.valor)} delta={dados?.lucroLiquido.delta}
          subvalor={dados ? `Margem ${fmtPct(dados.lucroLiquido.margem)}` : null} carregando={carregando} />
        <KpiCard icon={Package} color="warning" label="CMV"
          valor={fmtBRL(dados?.cmv.valor)}
          subvalor={dados ? `${fmtPct(dados.cmv.percentual)} do faturamento` : null} carregando={carregando} />
        <KpiCard icon={AlertCircle} color={dados?.caixa.emRisco > 0 ? 'danger' : 'neutral'} label="A receber em atraso"
          valor={fmtBRL(dados?.caixa.emRisco)}
          subvalor={dados ? `${dados.caixa.emRiscoQtd} título(s)` : null} carregando={carregando} />
        <KpiCard icon={ShoppingCart} color="info" label="Vendas"
          valor={fmtNum(dados?.vendas.total)}
          subvalor={dados ? `Ticket médio ${fmtBRL(dados.vendas.ticketMedio)}` : null} carregando={carregando} />
        <KpiCard icon={Users} color="info" label="Leads criados"
          valor={fmtNum(dados?.leads.criados)} delta={dados?.leads.delta} carregando={carregando} />
        <KpiCard icon={TrendingUp} color="success" label="Lucro bruto"
          valor={fmtBRL(dados?.cmv.lucroBruto)}
          subvalor={dados?.faturamento.valor > 0
            ? `${fmtPct((dados.cmv.lucroBruto / dados.faturamento.valor) * 100)} margem bruta`
            : null} carregando={carregando} />
        <KpiCard icon={DollarSign} color="success" label="Saldo do período"
          valor={fmtBRL(dados?.caixa.saldoPeriodo)}
          subvalor={dados ? `Receita ${fmtBRL(dados.caixa.receitaPaga)}, despesa ${fmtBRL(dados.caixa.despesaPaga)}` : null}
          carregando={carregando} />
      </div>

      {/* Top produtos vendidos */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top produtos vendidos</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">No período selecionado</div>
          </div>
          {dados && <Badge variant="neutral" size="sm">{dados.topProdutos.length} produto(s)</Badge>}
        </div>
        <TabelaTopProdutos
          itens={dados?.topProdutos}
          carregando={carregando}
          colunas={[
            { label: 'Quantidade', valor: (p) => fmtNum(p.quantidade), align: 'right' },
            { label: 'Receita', valor: (p) => fmtBRL(p.valor), align: 'right', destaque: 'success' },
          ]}
        />
      </Card>
    </div>
  );
}

// ============================================================
// ABA: CRM
// ============================================================
function AbaCRM({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/crm', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime()]);

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      {/* KPIs do CRM */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} color="info" label="Leads abertos no funil"
          valor={fmtNum(dados?.totais.leadsAbertos)}
          subvalor={dados ? `Valor potencial ${fmtBRL(dados.totais.valorTotalFunil)}` : null}
          carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Leads criados (período)"
          valor={fmtNum(dados?.totais.criadosPeriodo)} carregando={carregando} />
        <KpiCard icon={ShoppingCart} color="success" label="Conversões (período)"
          valor={fmtNum(dados?.totais.conversoesPeriodo)}
          subvalor={dados?.totais.taxaConversao !== null && dados?.totais.taxaConversao !== undefined
            ? `Taxa ${fmtPct(dados.totais.taxaConversao)}` : null}
          carregando={carregando} />
        <KpiCard icon={AlertCircle} color="warning" label="Leads parados (>7d)"
          valor={fmtNum(dados?.leadsParados.length)}
          subvalor="Sem contato recente"
          carregando={carregando} />
      </div>

      {/* Funil de conversao */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Funil de conversão</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">
            Leads atualmente em cada etapa do CRM (independente do período)
          </div>
        </div>
        <FunilEtapas funil={dados?.funil} carregando={carregando} />
      </Card>

      {/* Origem dos leads + Tempo medio por etapa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Origem dos leads</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">No período selecionado</div>
          </div>
          <TabelaOrigens origens={dados?.origens} carregando={carregando} />
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Tempo médio por etapa</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Baseado nos últimos 60 dias</div>
          </div>
          <TabelaTempoEtapas tempos={dados?.tempoMedioPorEtapa} carregando={carregando} />
        </Card>
      </div>

      {/* Leads parados */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Leads parados</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">
            Sem contato registrado há mais de 7 dias — chame eles
          </div>
        </div>
        <TabelaLeadsParados leads={dados?.leadsParados} carregando={carregando} />
      </Card>

      {/* Top produtos no funil */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top produtos no funil</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">
              Produtos com mais interesse de leads (não convertidos)
            </div>
          </div>
          {dados && <Badge variant="neutral" size="sm">{dados.topProdutosNoFunil.length}</Badge>}
        </div>
        <TabelaTopProdutos
          itens={dados?.topProdutosNoFunil}
          carregando={carregando}
          mensagemVazia="Nenhum produto vinculado a leads ainda."
          colunas={[
            { label: 'Leads interessados', valor: (p) => fmtNum(p.leads), align: 'right' },
            { label: 'Qtd. total', valor: (p) => fmtNum(p.quantidadeTotal), align: 'right' },
            { label: 'Valor potencial', valor: (p) => fmtBRL(p.valorPotencial), align: 'right', destaque: 'success' },
          ]}
        />
      </Card>
    </div>
  );
}

// ============================================================
// ABA: Financeiro
// ============================================================
function AbaFinanceiro({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/financeiro', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime()]);

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      {/* KPIs do topo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} color="success" label="Resultado líquido"
          valor={fmtBRL(dados?.dre.resultadoLiquido)}
          subvalor={dados ? `Margem ${fmtPct(dados.dre.margemLiquida)}` : null}
          carregando={carregando} />
        <KpiCard icon={Wallet} color="info" label="Receita bruta"
          valor={fmtBRL(dados?.dre.receitaBruta)} carregando={carregando} />
        <KpiCard icon={AlertCircle} color={dados?.kpis.saldoEmRisco > 0 ? 'danger' : 'neutral'} label="A receber em atraso"
          valor={fmtBRL(dados?.kpis.saldoEmRisco)}
          subvalor={dados ? `${dados.kpis.saldoEmRiscoQtd} título(s)` : null}
          carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Índice de eficácia"
          valor={dados ? fmtPct(dados.kpis.indiceEficacia) : '—'}
          subvalor={dados ? `Previsão recuperar ${fmtBRL(dados.kpis.previsaoRecuperacao)}` : null}
          carregando={carregando} />
      </div>

      {/* DRE */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">DRE — Demonstrativo de resultado</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">No período selecionado (apenas lançamentos pagos)</div>
        </div>
        <BlocoDRE dre={dados?.dre} carregando={carregando} />
      </Card>

      {/* Fluxo de caixa diario */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Fluxo de caixa diário</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Entradas, saídas e saldo acumulado por dia</div>
        </div>
        <GraficoFluxoCaixa fluxo={dados?.fluxoDiario} carregando={carregando} />
      </Card>

      {/* Aging de inadimplencia */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Aging de inadimplência</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Receitas pendentes vencidas, separadas por tempo de atraso</div>
        </div>
        <BlocoAging aging={dados?.aging} carregando={carregando} />
      </Card>

      {/* Por categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Receitas por categoria</div>
          </div>
          <TabelaCategorias itens={dados?.porCategoriaReceita} cor="success" carregando={carregando} />
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Despesas por categoria</div>
          </div>
          <TabelaCategorias itens={dados?.porCategoriaDespesa} cor="danger" carregando={carregando} />
        </Card>
      </div>

      {/* Por metodo de pagamento */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Recebimentos por método de pagamento</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Apenas receitas pagas no período</div>
        </div>
        <TabelaMetodosPagamento itens={dados?.porMetodo} carregando={carregando} />
      </Card>
    </div>
  );
}

// ====== Componentes da aba Financeiro ======
function BlocoDRE({ dre, carregando }) {
  if (carregando && !dre) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!dre) return null;

  const linhas = [
    { label: 'Receita bruta', valor: dre.receitaBruta, cor: 'success', destaque: false },
    { label: '(−) Despesas variáveis', valor: -dre.despesasVariaveis, cor: 'danger', sublabel: 'Categorias com "venda" ou "imposto"' },
    { label: '(=) Margem de contribuição', valor: dre.receitaBruta - dre.despesasVariaveis, cor: 'neutral', destaque: true },
    { label: '(−) Despesas fixas', valor: -dre.despesasFixas, cor: 'danger', sublabel: 'Demais categorias de despesa' },
    { label: '(=) Resultado líquido', valor: dre.resultadoLiquido, cor: dre.resultadoLiquido >= 0 ? 'success' : 'danger', destaque: true },
  ];

  return (
    <div className="px-5 py-4 space-y-1">
      {linhas.map((l) => (
        <div
          key={l.label}
          className={`flex items-baseline justify-between gap-3 py-2 ${
            l.destaque ? 'border-t border-[var(--border-main)] mt-1 pt-3' : ''
          }`}
        >
          <div>
            <div className={`text-sm ${l.destaque ? 'font-bold text-[var(--text-main)]' : 'text-[var(--text-secondary)]'}`}>
              {l.label}
            </div>
            {l.sublabel && (
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{l.sublabel}</div>
            )}
          </div>
          <div className={`tabular-nums ${l.destaque ? 'text-base font-bold' : 'text-sm font-semibold'} ${
            l.cor === 'success' ? 'text-[var(--success)]' :
            l.cor === 'danger' ? 'text-[var(--danger)]' :
            'text-[var(--text-main)]'
          }`}>
            {l.valor < 0 ? '−' : ''}{fmtBRL(Math.abs(l.valor))}
          </div>
        </div>
      ))}
      <div className="text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-main)] mt-2">
        Margem líquida do período: <strong>{fmtPct(dre.margemLiquida)}</strong>
      </div>
    </div>
  );
}

function GraficoFluxoCaixa({ fluxo, carregando }) {
  if (carregando && !fluxo) return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!fluxo || fluxo.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem movimentações no período.</div>;
  }
  // Reformata a data pra DD/MM (mais legivel no eixo)
  const dadosGrafico = fluxo.map((f) => ({
    ...f,
    label: f.data.split('-').slice(1).reverse().join('/'),
  }));

  return (
    <div className="px-5 py-4">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => Number(v).toLocaleString('pt-BR', { notation: 'compact' })}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 8 }}
            formatter={(v, name) => [fmtBRL(v), name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="receita" stroke="var(--success)" name="Receita" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="despesa" stroke="var(--danger)" name="Despesa" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="saldoAcumulado" stroke="var(--accent)" name="Saldo acumulado" strokeWidth={2} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BlocoAging({ aging, carregando }) {
  if (carregando && !aging) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!aging) return null;
  const total = aging.reduce((acc, a) => acc + a.valor, 0);
  if (total === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">🎉 Nenhum vencido. Tudo em dia!</div>;
  }

  const CORES = ['var(--warning)', 'var(--accent)', 'var(--danger)', 'var(--danger)'];

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Grafico de barras das 4 faixas */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={aging}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
          <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(v) => Number(v).toLocaleString('pt-BR', { notation: 'compact' })}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 8 }}
            formatter={(v) => [fmtBRL(v), 'Valor']}
          />
          <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
            {aging.map((_, i) => (
              <Bar key={i} fill={CORES[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detalhamento por faixa (top 5 itens de cada) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {aging.map((bucket, idx) => (
          bucket.qtd > 0 && (
            <div key={bucket.faixa} className="border border-[var(--border-main)] rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-[var(--bg-subtle)]/50 border-b border-[var(--border-main)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">{bucket.faixa}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{bucket.qtd} título(s)</div>
                </div>
                <div className="text-sm font-bold tabular-nums" style={{ color: CORES[idx] }}>
                  {fmtBRL(bucket.valor)}
                </div>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {bucket.itens.map((item) => (
                  <div key={item.id} className="px-3 py-2 flex items-baseline justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[var(--text-main)] truncate">{item.descricao}</div>
                      {item.lead && <div className="text-[10px] text-[var(--text-muted)] truncate">{item.lead}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold tabular-nums">{fmtBRL(item.valor)}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{item.diasAtraso}d atraso</div>
                    </div>
                  </div>
                ))}
                {bucket.qtd > bucket.itens.length && (
                  <div className="px-3 py-1.5 text-[10px] text-[var(--text-muted)] text-center">
                    +{bucket.qtd - bucket.itens.length} a mais
                  </div>
                )}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function TabelaCategorias({ itens, cor = 'success', carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhum lançamento no período.</div>;
  }
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  const corHex = cor === 'success' ? 'var(--success)' : 'var(--danger)';
  return (
    <div className="px-5 py-4 space-y-2">
      {itens.map((c) => {
        const pct = total > 0 ? (c.valor / total) * 100 : 0;
        return (
          <div key={c.categoria} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <div className="truncate">
                <span className="font-semibold text-[var(--text-main)]">{c.categoria}</span>
                <span className="ml-2 text-[var(--text-muted)]">{c.qtd} lanç.</span>
              </div>
              <div className="flex-shrink-0">
                <span className="font-bold tabular-nums" style={{ color: corHex }}>{fmtBRL(c.valor)}</span>
                <span className="ml-2 text-[var(--text-muted)] tabular-nums">{fmtPct(pct)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: corHex }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabelaMetodosPagamento({ itens, carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem recebimentos no período.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Método</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Recebimentos</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Total</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((m) => (
          <tr key={m.metodo} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)]">{m.metodo}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums">{fmtNum(m.qtd)}</td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums text-[var(--success)]">{fmtBRL(m.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// COMPONENTES — funil
// ============================================================
function FunilEtapas({ funil, carregando }) {
  if (carregando && !funil) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!funil || funil.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Crie etapas no CRM pra ver o funil.</div>;
  }
  // Etapa com mais leads = base (largura 100%). Outras proporcionais.
  const max = Math.max(1, ...funil.map((e) => e.leads));

  return (
    <div className="px-5 py-4 space-y-2.5">
      {funil.map((e, idx) => {
        const pct = (e.leads / max) * 100;
        const corBg = e.cor || 'var(--accent)';
        return (
          <div key={e.etapaId} className="flex items-center gap-3">
            <div className="w-32 flex-shrink-0">
              <div className="text-sm font-semibold text-[var(--text-main)] truncate">{e.nome}</div>
              {idx < funil.length - 1 && e.taxaAvanco !== undefined && (
                <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                  <TrendingDown size={9} /> {fmtPct(e.taxaAvanco)} segue adiante
                </div>
              )}
            </div>
            <div className="flex-1 relative h-9 bg-[var(--bg-subtle)] rounded-lg overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all flex items-center px-3"
                style={{
                  width: `${Math.max(pct, e.leads > 0 ? 8 : 0)}%`,
                  backgroundColor: corBg,
                  opacity: 0.85,
                }}
              >
                <span className="text-xs font-bold text-white drop-shadow tabular-nums">{e.leads}</span>
              </div>
            </div>
            <div className="w-32 flex-shrink-0 text-right">
              <div className="text-sm font-bold text-[var(--text-main)] tabular-nums">{fmtBRL(e.valor)}</div>
              <div className="text-[10px] text-[var(--text-muted)]">valor agregado</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabelaOrigens({ origens, carregando }) {
  if (carregando && !origens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!origens || origens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhum lead no período.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Origem</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Leads</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Conversões</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Taxa</th>
        </tr>
      </thead>
      <tbody>
        {origens.map((o) => (
          <tr key={o.origem} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)]">{o.origem}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums">{fmtNum(o.leads)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--success)]">{fmtNum(o.conversoes)}</td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">
              {o.taxaConversao !== null ? fmtPct(o.taxaConversao) : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaTempoEtapas({ tempos, carregando }) {
  if (carregando && !tempos) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!tempos || tempos.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem movimentações suficientes ainda.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Etapa</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Tempo médio</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Amostra</th>
        </tr>
      </thead>
      <tbody>
        {tempos.map((t) => (
          <tr key={t.etapa} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)]">{t.etapa}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums font-bold">
              <Clock size={11} className="inline mr-1 -mt-0.5 text-[var(--text-muted)]" />
              {t.diasMedio.toFixed(1)} dias
            </td>
            <td className="py-3 px-5 text-right text-xs text-[var(--text-muted)] tabular-nums">{t.amostra} leads</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaLeadsParados({ leads, carregando }) {
  if (carregando && !leads) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!leads || leads.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Tudo em dia! Nenhum lead parado.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Lead</th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Etapa</th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Origem</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Sem contato</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((l) => (
          <tr key={l.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5">
              <div className="text-sm font-semibold text-[var(--text-main)]">{l.nome}</div>
              <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                {l.telefone && <span className="flex items-center gap-1"><Phone size={10} />{l.telefone}</span>}
                {l.email && <span className="flex items-center gap-1"><Mail size={10} />{l.email}</span>}
              </div>
            </td>
            <td className="py-3 px-5 text-xs">
              <Badge variant="neutral" size="sm">{l.etapa}</Badge>
            </td>
            <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">{l.origem}</td>
            <td className={`py-3 px-5 text-right text-sm font-bold tabular-nums ${
              l.diasParado > 30 ? 'text-[var(--danger)]' :
              l.diasParado > 14 ? 'text-[var(--warning)]' :
              'text-[var(--text-secondary)]'
            }`}>
              {l.diasParado} dia{l.diasParado === 1 ? '' : 's'}
            </td>
            <td className="py-3 px-5 text-right text-sm tabular-nums">{fmtBRL(l.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// COMPONENTES — compartilhados
// ============================================================
function TabelaTopProdutos({ itens, carregando, colunas, mensagemVazia = 'Nenhuma venda no período.' }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <Package className="mx-auto mb-2 text-[var(--text-muted)] opacity-50" size={32} />
        <div className="text-sm text-[var(--text-muted)]">{mensagemVazia}</div>
      </div>
    );
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-14"></th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
          {colunas.map((c) => (
            <th key={c.label} className={`text-${c.align || 'right'} text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {itens.map((p, idx) => (
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
            {colunas.map((c) => (
              <td key={c.label} className={`py-3 px-5 text-${c.align || 'right'} text-sm tabular-nums ${
                c.destaque === 'success' ? 'font-bold text-[var(--success)]' : 'text-[var(--text-main)]'
              }`}>{c.valor(p)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
          <Input size="sm" type="date" value={customInicio} onChange={(e) => onCustomInicio(e.target.value)} />
          <Input size="sm" type="date" value={customFim} onChange={(e) => onCustomFim(e.target.value)} />
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-3">{label}</div>
      <div className="text-xl font-bold tracking-tight text-[var(--text-main)] mt-1 tabular-nums">
        {carregando && !valor ? <span className="inline-block w-24 h-5 bg-[var(--bg-subtle)] rounded animate-pulse" /> : valor}
      </div>
      {subvalor && <div className="text-[11px] text-[var(--text-muted)] mt-1">{subvalor}</div>}
    </Card>
  );
}

function ErroBox({ mensagem }) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-2 text-sm text-[var(--danger)]">
        <AlertCircle size={16} />
        <span>{mensagem}</span>
      </div>
    </Card>
  );
}
