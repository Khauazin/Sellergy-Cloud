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
  Bot, MessageSquare, Sparkles, Wrench, CheckCircle2, XCircle,
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
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="estoque">Estoque & CMV</TabsTrigger>
          <TabsTrigger value="bots">Bots / IA</TabsTrigger>
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

        <TabsContent value="vendas">
          <AbaVendas intervalo={intervalo} />
        </TabsContent>

        <TabsContent value="estoque">
          <AbaEstoque intervalo={intervalo} />
        </TabsContent>

        <TabsContent value="bots">
          <AbaBots intervalo={intervalo} />
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

// ============================================================
// ABA: Estoque & CMV
// ============================================================
function AbaEstoque({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/estoque', {
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} color="info" label="Patrimônio em estoque"
          valor={fmtBRL(dados?.kpis.patrimonioImobilizado)}
          subvalor={dados ? `${dados.kpis.totalFisicos} produtos físicos` : null}
          carregando={carregando} />
        <KpiCard icon={DollarSign} color="success" label="Lucro potencial"
          valor={fmtBRL(dados?.kpis.lucroPotencial)}
          subvalor={dados ? `Se vender tudo: ${fmtBRL(dados.kpis.valorVarejo)}` : null}
          carregando={carregando} />
        <KpiCard icon={AlertCircle} color={dados?.kpis.itensAbaixoMinimo > 0 ? 'warning' : 'neutral'} label="Itens abaixo do mínimo"
          valor={fmtNum(dados?.kpis.itensAbaixoMinimo)}
          subvalor={dados ? `${dados.kpis.itensZerados} zerados` : null}
          carregando={carregando} />
        <KpiCard icon={TrendingDown} color={dados?.kpis.indiceRuptura > 10 ? 'danger' : 'neutral'} label="Índice de ruptura"
          valor={dados ? fmtPct(dados.kpis.indiceRuptura) : '—'}
          subvalor="% itens zerados"
          carregando={carregando} />
      </div>

      {/* Lista de reposicao */}
      {dados?.reposicao && dados.reposicao.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Lista de reposição</div>
              <div className="text-sm text-[var(--text-secondary)] mt-0.5">
                Comprar: {fmtBRL(dados.custoTotalReposicao)} ({dados.reposicao.length} produto{dados.reposicao.length === 1 ? '' : 's'})
              </div>
            </div>
            <Badge variant="warning" size="sm">Atenção</Badge>
          </div>
          <TabelaReposicao itens={dados.reposicao} />
        </Card>
      )}

      {/* Movimento de inventario por dia */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Movimento de inventário</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Entradas e saídas por dia (em unidades)</div>
        </div>
        <GraficoMovimentoInventario movimento={dados?.movimentoDiario} carregando={carregando} />
      </Card>

      {/* Curva ABC */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Curva ABC</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">
            <strong>A</strong> = produtos que geram 80% da receita ·
            <strong> B</strong> = próximos 15% ·
            <strong> C</strong> = últimos 5%
          </div>
        </div>
        <BlocoCurvaABC curva={dados?.curvaABC} resumo={dados?.resumoABC} carregando={carregando} />
      </Card>

      {/* Margem por produto */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Margem por produto</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Top 50 ordenados por margem percentual (maior pra menor)</div>
        </div>
        <TabelaMargem itens={dados?.margemPorVariacao} carregando={carregando} />
      </Card>

      {/* Estoque parado */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Estoque parado</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Produtos sem movimentação há mais de 60 dias</div>
        </div>
        <TabelaEstoqueParado itens={dados?.estoqueParado} carregando={carregando} />
      </Card>
    </div>
  );
}

// ====== Componentes da aba Estoque ======
function TabelaReposicao({ itens }) {
  const corUrgencia = {
    CRITICO: 'var(--danger)',
    ALTA: 'var(--warning)',
    MEDIA: 'var(--accent)',
  };
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-14"></th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Atual / Mín</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Comprar</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Custo estimado</th>
          <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Urgência</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((r) => (
          <tr key={r.variacaoId} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5">
              {r.imagemUrl ? (
                <img src={r.imagemUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-[var(--border-main)]" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-muted)]">
                  <ImageIcon size={14} />
                </div>
              )}
            </td>
            <td className="py-3 px-5 text-sm">
              <div className="font-semibold text-[var(--text-main)]">{r.nome}</div>
              {r.variacao && <div className="text-[11px] text-[var(--text-muted)]">{r.variacao}</div>}
            </td>
            <td className="py-3 px-5 text-right text-sm tabular-nums">
              <span className={r.estoqueAtual <= 0 ? 'text-[var(--danger)] font-bold' : 'text-[var(--text-main)]'}>
                {r.estoqueAtual}
              </span>
              <span className="text-[var(--text-muted)]"> / {r.estoqueMinimo}</span>
            </td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">
              +{fmtNum(r.necessidade)}
            </td>
            <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--text-main)]">
              {fmtBRL(r.custoReposicao)}
            </td>
            <td className="py-3 px-5 text-center">
              <span
                className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `color-mix(in srgb, ${corUrgencia[r.urgencia]} 15%, transparent)`,
                  color: corUrgencia[r.urgencia],
                }}
              >
                {r.urgencia}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GraficoMovimentoInventario({ movimento, carregando }) {
  if (carregando && !movimento) return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!movimento || movimento.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem movimentações no período.</div>;
  }
  const dadosGrafico = movimento.map((m) => ({
    ...m,
    label: m.data.split('-').slice(1).reverse().join('/'),
  }));

  return (
    <div className="px-5 py-4">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 8 }}
            formatter={(v, name) => [fmtNum(v) + ' un.', name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="entradas" name="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="saidas" name="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BlocoCurvaABC({ curva, resumo, carregando }) {
  if (carregando && !curva) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!curva || curva.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem vendas no período.</div>;
  }
  const totalReceita = (resumo?.A?.receita || 0) + (resumo?.B?.receita || 0) + (resumo?.C?.receita || 0);
  const corClasse = { A: 'var(--success)', B: 'var(--accent)', C: 'var(--text-muted)' };

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Resumo das classes */}
      <div className="grid grid-cols-3 gap-3">
        {['A', 'B', 'C'].map((c) => {
          const r = resumo[c] || { qtd: 0, receita: 0 };
          const pct = totalReceita > 0 ? (r.receita / totalReceita) * 100 : 0;
          return (
            <div key={c} className="p-3 rounded-xl border border-[var(--border-main)]">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-white"
                  style={{ backgroundColor: corClasse[c] }}
                >
                  {c}
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">{r.qtd} produto{r.qtd === 1 ? '' : 's'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{fmtPct(pct)} da receita</div>
                </div>
              </div>
              <div className="text-sm font-bold tabular-nums mt-2" style={{ color: corClasse[c] }}>
                {fmtBRL(r.receita)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="border-t border-[var(--border-main)] -mx-5">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-main)]">
              <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-12">Classe</th>
              <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Receita</th>
              <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {curva.slice(0, 30).map((p) => (
              <tr key={p.variacaoId} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <td className="py-3 px-5 text-center">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-black text-white"
                    style={{ backgroundColor: corClasse[p.classe] }}
                  >
                    {p.classe}
                  </span>
                </td>
                <td className="py-3 px-5 text-sm">
                  <div className="font-semibold text-[var(--text-main)]">{p.nome}</div>
                  {p.variacao && <div className="text-[11px] text-[var(--text-muted)]">{p.variacao}</div>}
                </td>
                <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">{fmtBRL(p.receita)}</td>
                <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">
                  {fmtPct(p.pctAcumulado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {curva.length > 30 && (
          <div className="px-5 py-2 text-[10px] text-center text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
            +{curva.length - 30} produtos a mais (não exibidos)
          </div>
        )}
      </div>
    </div>
  );
}

function TabelaMargem({ itens, carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Cadastre produtos pra ver margens.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-14"></th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Custo</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Venda</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Margem</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">%</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((p) => (
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
            <td className="py-3 px-5 text-sm">
              <div className="font-semibold text-[var(--text-main)]">{p.nome}</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {p.variacao && <span className="mr-2">{p.variacao}</span>}
                <span>{p.categoria}</span>
              </div>
            </td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-secondary)]">{fmtBRL(p.precoCusto)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-main)]">{fmtBRL(p.preco)}</td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums text-[var(--success)]">{fmtBRL(p.margemAbsoluta)}</td>
            <td className={`py-3 px-5 text-right text-sm tabular-nums font-bold ${
              p.margemPercentual < 20 ? 'text-[var(--warning)]' :
              p.margemPercentual >= 50 ? 'text-[var(--success)]' :
              'text-[var(--text-main)]'
            }`}>
              {fmtPct(p.margemPercentual)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaEstoqueParado({ itens, carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">🎉 Nenhum produto parado!</div>;
  }
  const valorTotal = itens.reduce((acc, i) => acc + i.valorParado, 0);
  return (
    <>
      <div className="px-5 py-2.5 bg-[var(--bg-subtle)]/30 border-b border-[var(--border-main)] flex items-baseline justify-between text-xs">
        <span className="text-[var(--text-muted)]">Capital travado em estoque parado:</span>
        <span className="font-bold tabular-nums text-[var(--warning)]">{fmtBRL(valorTotal)}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-main)]">
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-14"></th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Estoque</th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Capital travado</th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Tempo parado</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((p) => (
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
              <td className="py-3 px-5 text-sm">
                <div className="font-semibold text-[var(--text-main)]">{p.nome}</div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {p.variacao && <span className="mr-2">{p.variacao}</span>}
                  <span>{p.categoria}</span>
                </div>
              </td>
              <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums">{fmtNum(p.estoqueAtual)}</td>
              <td className="py-3 px-5 text-right text-sm font-bold tabular-nums text-[var(--warning)]">{fmtBRL(p.valorParado)}</td>
              <td className="py-3 px-5 text-right text-sm tabular-nums">
                {p.diasParado === null ? (
                  <span className="text-[var(--danger)] font-bold">Nunca movimentado</span>
                ) : (
                  <span className={p.diasParado > 180 ? 'text-[var(--danger)] font-bold' : 'text-[var(--text-secondary)]'}>
                    {p.diasParado} dias
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ============================================================
// ABA: Vendas
// ============================================================
function AbaVendas({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/vendas', {
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ShoppingCart} color="info" label="Total de vendas"
          valor={fmtNum(dados?.kpis.totalVendas)}
          subvalor={dados ? fmtBRL(dados.kpis.valorTotal) : null}
          carregando={carregando} />
        <KpiCard icon={DollarSign} color="success" label="Ticket médio"
          valor={fmtBRL(dados?.kpis.ticketMedio)} carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Lucro bruto"
          valor={fmtBRL(dados?.kpis.lucroBruto)}
          subvalor={dados ? `Margem ${fmtPct(dados.kpis.margemBruta)}` : null}
          carregando={carregando} />
        <KpiCard icon={Users} color="warning" label="Conversão lead → venda"
          valor={dados?.kpis.taxaConversao !== null && dados?.kpis.taxaConversao !== undefined
            ? fmtPct(dados.kpis.taxaConversao) : '—'}
          subvalor={dados ? `${dados.kpis.vendasComLead} de ${dados.kpis.leadsCriadosPeriodo} leads` : null}
          carregando={carregando} />
      </div>

      {/* Por canal */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas por canal</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Origem do lead que originou cada venda</div>
        </div>
        <TabelaPorCanal porCanal={dados?.porCanal} carregando={carregando} />
      </Card>

      {/* Sazonalidade — heatmap */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sazonalidade</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Dia da semana × hora do dia (cor = volume de receita)</div>
        </div>
        <Heatmap sazonalidade={dados?.sazonalidade} carregando={carregando} />
      </Card>

      {/* Por categoria */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas por categoria</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Inclui receita, CMV, lucro e margem por categoria</div>
        </div>
        <TabelaCategoriasVendas itens={dados?.porCategoria} carregando={carregando} />
      </Card>

      {/* Por metodo */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Por método de pagamento</div>
        </div>
        <TabelaMetodosPagamento itens={dados?.porMetodo} carregando={carregando} />
      </Card>

      {/* Top vendas mais lucrativas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas mais lucrativas</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Top 10 por lucro absoluto</div>
          </div>
          <TabelaTopVendas itens={dados?.top10MaisLucrativas} carregando={carregando} corLucro="success" />
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas com menor lucro</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Top 10 — pra revisar precificação</div>
          </div>
          <TabelaTopVendas itens={dados?.top10MenosLucrativas} carregando={carregando} corLucro="warning" />
        </Card>
      </div>
    </div>
  );
}

// ====== Componentes da aba Vendas ======
function TabelaPorCanal({ porCanal, carregando }) {
  if (carregando && !porCanal) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!porCanal || porCanal.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma venda no período.</div>;
  }
  const totalValor = porCanal.reduce((acc, c) => acc + c.valor, 0);
  return (
    <div className="px-5 py-4 space-y-3">
      {porCanal.map((c) => {
        const pct = totalValor > 0 ? (c.valor / totalValor) * 100 : 0;
        return (
          <div key={c.origem} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="font-semibold text-[var(--text-main)]">{c.origem}</span>
                <span className="text-[var(--text-muted)]">{c.qtd} venda{c.qtd === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[var(--text-muted)] tabular-nums">{fmtPct(pct)}</span>
                <span className="font-bold tabular-nums text-[var(--text-main)]">{fmtBRL(c.valor)}</span>
                <span className="text-[var(--success)] tabular-nums text-[11px]">+{fmtBRL(c.lucro)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function Heatmap({ sazonalidade, carregando }) {
  if (carregando && !sazonalidade) return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!sazonalidade || sazonalidade.celulas.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem vendas no período.</div>;
  }
  const max = sazonalidade.maxValor;
  if (max === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem vendas no período.</div>;
  }

  // Agrupa em matriz 7x24
  const matriz = Array.from({ length: 7 }, () => Array(24).fill(null));
  for (const c of sazonalidade.celulas) matriz[c.diaSemana][c.hora] = c;

  return (
    <div className="px-5 py-4 overflow-x-auto">
      <div className="min-w-[720px]">
        {/* Cabecalho de horas */}
        <div className="flex gap-0.5 ml-10 mb-1">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-[var(--text-muted)] font-semibold tabular-nums">
              {h.toString().padStart(2, '0')}
            </div>
          ))}
        </div>
        {matriz.map((linha, d) => (
          <div key={d} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-9 text-[10px] text-[var(--text-muted)] font-bold uppercase">{DIAS_SEMANA[d]}</div>
            {linha.map((cel, h) => {
              const intensidade = cel.valor > 0 ? cel.valor / max : 0;
              const opacidade = intensidade === 0 ? 0 : Math.max(0.15, intensidade);
              return (
                <div
                  key={h}
                  className="flex-1 h-7 rounded relative group cursor-help"
                  style={{
                    backgroundColor: cel.valor === 0
                      ? 'var(--bg-subtle)'
                      : `color-mix(in srgb, var(--accent) ${opacidade * 100}%, transparent)`,
                    border: cel.valor === 0 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  title={`${DIAS_SEMANA[d]} ${h.toString().padStart(2, '0')}h: ${cel.qtd} venda(s) · ${fmtBRL(cel.valor)}`}
                >
                  {cel.qtd > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[var(--text-on-primary)] tabular-nums">
                      {cel.qtd}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {/* Legenda */}
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-[var(--text-muted)]">
          <span>Menos</span>
          {[0.15, 0.3, 0.5, 0.7, 0.9].map((op) => (
            <div
              key={op}
              className="w-4 h-3 rounded"
              style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${op * 100}%, transparent)` }}
            />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </div>
  );
}

function TabelaCategoriasVendas({ itens, carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma venda no período.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Categoria</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Qtd</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Receita</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">CMV</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Lucro</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Margem</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((c) => (
          <tr key={c.categoria} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)]">{c.categoria}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums">{fmtNum(c.qtd)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-main)]">{fmtBRL(c.valor)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-secondary)]">{fmtBRL(c.custo)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums font-bold text-[var(--success)]">{fmtBRL(c.lucro)}</td>
            <td className={`py-3 px-5 text-right text-sm tabular-nums font-bold ${
              c.margem < 20 ? 'text-[var(--warning)]' : 'text-[var(--text-main)]'
            }`}>{fmtPct(c.margem)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaTopVendas({ itens, carregando, corLucro = 'success' }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem dados.</div>;
  }
  const corLucroVar = corLucro === 'warning' ? 'var(--warning)' : 'var(--success)';
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-4">Venda</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-4">Valor</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-2.5 px-4">Lucro</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((v) => (
          <tr key={v.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-2.5 px-4">
              <div className="font-semibold text-[var(--text-main)] truncate max-w-[200px]">{v.descricao}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{new Date(v.data).toLocaleDateString('pt-BR')}</div>
            </td>
            <td className="py-2.5 px-4 text-right tabular-nums">{fmtBRL(v.valor)}</td>
            <td className="py-2.5 px-4 text-right tabular-nums">
              <div className="font-bold" style={{ color: corLucroVar }}>{fmtBRL(v.lucro)}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{fmtPct(v.margem)}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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

// ============================================================
// ABA: Bots / IA
// ============================================================
function AbaBots({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/bots', {
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

  const fmtMs = (ms) => {
    if (!ms || ms < 1000) return `${ms || 0}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={MessageSquare} color="info" label="Mensagens trocadas"
          valor={fmtNum(dados?.kpis.totalMsgs)}
          subvalor={dados ? `${fmtNum(dados.kpis.msgsEntrada)} entrada · ${fmtNum(dados.kpis.msgsSaida)} saída` : null}
          carregando={carregando} />
        <KpiCard icon={Users} color="accent" label="Conversas ativas"
          valor={fmtNum(dados?.kpis.conversasAtivas)}
          subvalor={dados ? `${dados.kpis.conversasComLead} vinculadas a lead` : null}
          carregando={carregando} />
        <KpiCard icon={Bot} color="success" label="Execuções de fluxo"
          valor={fmtNum(dados?.kpis.totalExec)}
          subvalor={dados?.kpis.taxaSucesso !== null
            ? `${fmtPct(dados.kpis.taxaSucesso)} de sucesso` : null}
          carregando={carregando} />
        <KpiCard icon={Sparkles} color="warning" label="Tokens de IA"
          valor={fmtNum(dados?.kpis.tokensTotal)}
          subvalor={dados ? `${fmtNum(dados.kpis.chamadasIA)} chamada(s) ao LLM` : null}
          carregando={carregando} />
      </div>

      {/* Mensagens por dia */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Mensagens por dia</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Entradas (cliente → bot) e saídas (bot → cliente)</div>
        </div>
        <GraficoMensagensPorDia mensagens={dados?.mensagensPorDia} carregando={carregando} />
      </Card>

      {/* Por canal + status execucao */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Por canal</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Volume de mensagens por canal</div>
          </div>
          <TabelaCanaisBot porCanal={dados?.porCanal} carregando={carregando} />
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Saúde das execuções</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">
              {dados ? `Duração média de execução bem-sucedida: ${fmtMs(dados.kpis.duracaoMediaMs)}` : '—'}
            </div>
          </div>
          <BlocoStatusExec
            status={dados?.execucoes.status}
            modo={dados?.execucoes.modo}
            carregando={carregando}
          />
        </Card>
      </div>

      {/* Tools mais usadas */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Ferramentas usadas pelo bot</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">
            Ações que a IA executou (crm.criarLead, mensagens.enviar, etc.)
          </div>
        </div>
        <TabelaToolsUsadas itens={dados?.toolsUsadas} carregando={carregando} fmtMs={fmtMs} />
      </Card>

      {/* Custo de IA por modelo */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Uso de IA por modelo</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Tokens usados em cada modelo (referência pra custos)</div>
        </div>
        <TabelaModelosIA itens={dados?.ia.porModelo} carregando={carregando} />
      </Card>

      {/* Top conversas */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Top conversas mais ativas</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Maior volume total de mensagens</div>
        </div>
        <TabelaTopConversas itens={dados?.topConversas} carregando={carregando} />
      </Card>
    </div>
  );
}

// ====== Componentes da aba Bots ======
function GraficoMensagensPorDia({ mensagens, carregando }) {
  if (carregando && !mensagens) return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!mensagens || mensagens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem mensagens no período.</div>;
  }
  const dadosGrafico = mensagens.map((m) => ({
    ...m,
    label: m.data.split('-').slice(1).reverse().join('/'),
  }));
  return (
    <div className="px-5 py-4">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 8 }}
            formatter={(v, name) => [`${v} msg`, name]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="entrada" stroke="var(--info)" name="Recebidas" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="saida" stroke="var(--accent)" name="Enviadas" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TabelaCanaisBot({ porCanal, carregando }) {
  if (carregando && !porCanal) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!porCanal || porCanal.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Sem mensagens.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Canal</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Recebidas</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Enviadas</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Total</th>
        </tr>
      </thead>
      <tbody>
        {porCanal.map((c) => (
          <tr key={c.canal} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)]">{c.canal}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--info)]">{fmtNum(c.entrada)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--accent)]">{fmtNum(c.saida)}</td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">{fmtNum(c.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BlocoStatusExec({ status, modo, carregando }) {
  if (carregando && !status) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!status) return null;

  const total = Object.values(status).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma execução no período.</div>;
  }

  const corStatus = {
    SUCESSO: 'var(--success)',
    ERRO: 'var(--danger)',
    EM_EXECUCAO: 'var(--info)',
    PENDENTE: 'var(--text-muted)',
    CANCELADA: 'var(--warning)',
  };

  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Por status</div>
        <div className="space-y-1.5">
          {Object.entries(status).filter(([, v]) => v > 0).map(([k, v]) => {
            const pct = (v / total) * 100;
            return (
              <div key={k} className="space-y-0.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-[var(--text-main)]">{k}</span>
                  <span className="tabular-nums">
                    <span className="font-bold" style={{ color: corStatus[k] }}>{v}</span>
                    <span className="text-[var(--text-muted)] ml-2">{fmtPct(pct)}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: corStatus[k] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Por modo de disparo</div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(modo).filter(([, v]) => v > 0).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] text-xs">
              <span className="font-semibold text-[var(--text-main)]">{k}</span>
              <span className="font-bold tabular-nums text-[var(--accent)]">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabelaToolsUsadas({ itens, carregando, fmtMs }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma ferramenta usada no período.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Ferramenta</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Chamadas</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Sucesso</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Erros</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Taxa</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Tempo médio</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((t) => (
          <tr key={t.tool} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5">
              <div className="flex items-center gap-2">
                <Wrench size={14} className="text-[var(--text-muted)]" />
                <span className="text-sm font-semibold text-[var(--text-main)] font-mono">{t.tool}</span>
              </div>
            </td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">{fmtNum(t.total)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--success)]">{fmtNum(t.sucesso)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--danger)]">{fmtNum(t.erro)}</td>
            <td className={`py-3 px-5 text-right text-sm tabular-nums font-bold ${
              t.taxaSucesso < 80 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
            }`}>{fmtPct(t.taxaSucesso)}</td>
            <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">{fmtMs(t.duracaoMediaMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaModelosIA({ itens, carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma chamada de IA no período.</div>;
  }
  const totalTokens = itens.reduce((a, m) => a + m.tokens, 0);
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Modelo</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Chamadas</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Tokens</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">% do total</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((m) => {
          const pct = totalTokens > 0 ? (m.tokens / totalTokens) * 100 : 0;
          return (
            <tr key={m.modelo} className="border-b border-[var(--border-subtle)] last:border-b-0">
              <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)] font-mono">
                <Sparkles size={12} className="inline mr-2 -mt-0.5 text-[var(--accent)]" />
                {m.modelo}
              </td>
              <td className="py-3 px-5 text-right text-sm tabular-nums">{fmtNum(m.chamadas)}</td>
              <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">{fmtNum(m.tokens)}</td>
              <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">{fmtPct(pct)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TabelaTopConversas({ itens, carregando }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma conversa no período.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Canal</th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Identificador</th>
          <th className="text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Lead?</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Mensagens</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Última</th>
        </tr>
      </thead>
      <tbody>
        {itens.map((c, idx) => (
          <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
            <td className="py-3 px-5">
              <Badge variant="neutral" size="sm">{c.canal}</Badge>
            </td>
            <td className="py-3 px-5 text-sm font-mono text-[var(--text-secondary)]">
              <span className="text-[var(--text-muted)] mr-2">#{idx + 1}</span>
              {c.identificador}
            </td>
            <td className="py-3 px-5 text-center">
              {c.temLead
                ? <CheckCircle2 size={14} className="inline text-[var(--success)]" />
                : <XCircle size={14} className="inline text-[var(--text-muted)]" />}
            </td>
            <td className="py-3 px-5 text-right text-sm font-bold tabular-nums">{fmtNum(c.mensagens)}</td>
            <td className="py-3 px-5 text-right text-xs tabular-nums text-[var(--text-muted)]">
              {c.ultimaMsg ? new Date(c.ultimaMsg).toLocaleString('pt-BR') : '—'}
            </td>
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
