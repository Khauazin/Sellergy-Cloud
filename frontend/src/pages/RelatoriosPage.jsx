// Pagina de relatorios consolidados do tenant.
// Estrutura: Tabs (Visao Executiva, CRM, ...) + filtro de periodo GLOBAL.
// Cada aba e um componente que recebe o intervalo e busca seus dados.
//
// Filosofia do filtro de periodo:
//   - Default: ultimos 30 dias. Presets rapidos + custom.
//   - GLOBAL: vale pra todas as abas — quando troca, todas refazem queries.

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import relatorioMensalService from '../services/relatorioMensalService';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Package, AlertCircle, Image as ImageIcon, Calendar,
  Filter, Clock, Phone, Mail, Wallet, ArrowUpRight, ArrowDownRight,
  Bot, MessageSquare, Sparkles, Wrench, CheckCircle2, XCircle, HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';
import api from '../services/api';
import {
  Card, Badge, Select, Input, KpiCard,
  Tooltip as InfoTooltip,
  BarraFiltros, FiltroRapido, Combobox, PeriodoPills, BotaoExportar,
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

// Mapeia o slug da URL pro componente da aba e seus metadados.
const ABAS = {
  'visao-executiva': {
    titulo: 'Visão executiva',
    descricao: 'Visão consolidada do que está acontecendo no seu negócio.',
    Componente: AbaVisaoExecutiva,
  },
  'crm': {
    titulo: 'CRM',
    descricao: 'Funil, origem dos leads, tempo médio por etapa e quem está parado.',
    Componente: AbaCRM,
  },
  'financeiro': {
    titulo: 'Financeiro',
    descricao: 'Resultado do período, fluxo de caixa, cobranças vencidas e detalhamento por categoria.',
    Componente: AbaFinanceiro,
  },
  'vendas': {
    titulo: 'Vendas',
    descricao: 'Por canal, quando você vende mais, categoria e ranking de lucratividade.',
    Componente: AbaVendas,
  },
  'estoque': {
    titulo: 'Estoque & CMV',
    descricao: 'Valor parado, produtos por importância, margem por produto e estoque sem giro.',
    Componente: AbaEstoque,
  },
  'bots': {
    titulo: 'Bots / IA',
    descricao: 'Mensagens, ferramentas usadas, custo de IA e atendimentos bem-sucedidos.',
    Componente: AbaBots,
  },
  'caixa': {
    titulo: 'Caixa',
    descricao: 'Sessões fechadas, retiradas, entradas e auditoria de diferenças de saldo.',
    Componente: AbaCaixa,
  },
  'mensais': {
    titulo: 'Fechamento mensal',
    descricao: 'Histórico dos meses fechados. Snapshots gerados automaticamente todo dia 7 ou disparados manualmente.',
    Componente: AbaMensais,
  },
};

export default function RelatoriosPage() {
  const { aba } = useParams();
  const config = ABAS[aba] || ABAS['visao-executiva'];
  const [preset, setPreset] = useState('30d');
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');

  const intervalo = useMemo(
    () => calcularIntervalo(preset, customInicio, customFim),
    [preset, customInicio, customFim]
  );

  const Componente = config.Componente;

  return (
    <div className="space-y-5">
      {/* Header: título + período em pills horizontais (substitui o
          antigo FiltroPeriodo em dropdown). Os filtros específicos de
          cada aba (categoria, tipo, etapa, etc.) vivem na BarraFiltros
          dentro de cada componente. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Relatório
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] mt-0.5">
            {config.titulo}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">{config.descricao}</p>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-2xl">
          <PeriodoPills
            preset={preset}
            onPresetChange={setPreset}
            customInicio={customInicio}
            customFim={customFim}
            onCustomInicio={setCustomInicio}
            onCustomFim={setCustomFim}
            intervalo={intervalo}
          />
        </div>
      </div>

      <Componente intervalo={intervalo} />
    </div>
  );
}

// Cabeçalho compacto que cada aba usa: contém apenas o botão de exportar
// alinhado à direita. Mantém consistência visual entre as 7 abas.
function CabecalhoAba({ montarDados, dados }) {
  return (
    <div className="flex justify-end" data-no-print>
      <BotaoExportar montarDados={montarDados} desabilitado={!dados} />
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

  const montarDados = () => ({
    nome: 'relatorio-visao-executiva',
    titulo: 'Relatório · Visão executiva',
    secoes: [
      {
        titulo: 'Resumo',
        colunas: [
          { chave: 'indicador', label: 'Indicador' },
          { chave: 'valor', label: 'Valor' },
        ],
        linhas: dados ? [
          { indicador: 'Faturamento', valor: fmtBRL(dados.faturamento.valor) },
          { indicador: 'Lucro líquido', valor: fmtBRL(dados.lucroLiquido.valor) },
          { indicador: 'Margem líquida', valor: fmtPct(dados.lucroLiquido.margem) },
          { indicador: 'CMV', valor: fmtBRL(dados.cmv.valor) },
          { indicador: 'Vendas no período', valor: fmtNum(dados.vendas.total) },
          { indicador: 'Ticket médio', valor: fmtBRL(dados.vendas.ticketMedio) },
          { indicador: 'Novos clientes', valor: fmtNum(dados.leads.criados) },
          { indicador: 'Atrasado a receber', valor: fmtBRL(dados.caixa.emRisco) },
          { indicador: 'Saldo do período', valor: fmtBRL(dados.caixa.saldoPeriodo) },
        ] : [],
      },
      {
        titulo: 'Top produtos vendidos',
        colunas: [
          { chave: 'nome', label: 'Produto' },
          { chave: 'quantidade', label: 'Quantidade', valor: (p) => fmtNum(p.quantidade) },
          { chave: 'valor', label: 'Receita', valor: (p) => fmtBRL(p.valor) },
        ],
        linhas: dados?.topProdutos || [],
      },
    ],
  });

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba montarDados={montarDados} dados={dados} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} color="success" label="Faturamento"
          valor={fmtBRL(dados?.faturamento.valor)} delta={dados?.faturamento.delta} carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Lucro líquido"
          info="Quanto sobrou depois de pagar tudo (vendas menos despesas)."
          valor={fmtBRL(dados?.lucroLiquido.valor)} delta={dados?.lucroLiquido.delta}
          subvalor={dados ? `Margem ${fmtPct(dados.lucroLiquido.margem)}` : null} carregando={carregando} />
        <KpiCard icon={Package} color="warning" label="Custo dos produtos"
          info="Quanto você gastou comprando o que vendeu (CMV — Custo da Mercadoria Vendida)."
          valor={fmtBRL(dados?.cmv.valor)}
          subvalor={dados ? `${fmtPct(dados.cmv.percentual)} do faturamento` : null} carregando={carregando} />
        <KpiCard icon={AlertCircle} color={dados?.caixa.emRisco > 0 ? 'danger' : 'neutral'} label="Atrasado a receber"
          info="Cobranças que venceram e o cliente ainda não pagou."
          valor={fmtBRL(dados?.caixa.emRisco)}
          subvalor={dados ? `${dados.caixa.emRiscoQtd} título(s)` : null} carregando={carregando} />
        <KpiCard icon={ShoppingCart} color="info" label="Vendas no período"
          valor={fmtNum(dados?.vendas.total)}
          subvalor={dados ? `Ticket médio ${fmtBRL(dados.vendas.ticketMedio)}` : null} carregando={carregando} />
        <KpiCard icon={Users} color="info" label="Novos clientes"
          info="Pessoas que entraram no funil no período."
          valor={fmtNum(dados?.leads.criados)} delta={dados?.leads.delta} carregando={carregando} />
        <KpiCard icon={TrendingUp} color="success" label="Lucro bruto"
          info="Vendas menos o custo dos produtos (sem contar despesas fixas)."
          valor={fmtBRL(dados?.cmv.lucroBruto)}
          subvalor={dados?.faturamento.valor > 0
            ? `${fmtPct((dados.cmv.lucroBruto / dados.faturamento.valor) * 100)} margem bruta`
            : null} carregando={carregando} />
        <KpiCard icon={DollarSign} color="success" label="Saldo do período"
          info="Tudo que entrou menos tudo que saiu no período."
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
  const [etapas, setEtapas] = useState([]);
  const [filtros, setFiltros] = useState({ etapaId: '', origem: '', filtroRapido: '' });

  // Carrega lista de etapas pro select.
  useEffect(() => {
    let ativo = true;
    api.get('/crm/stages').then((r) => {
      if (ativo) setEtapas(Array.isArray(r.data) ? r.data : []);
    }).catch(() => { if (ativo) setEtapas([]); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/crm', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
        ...(filtros.etapaId ? { etapaId: filtros.etapaId } : {}),
        ...(filtros.origem ? { origem: filtros.origem } : {}),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime(), filtros.etapaId, filtros.origem]);

  // Filtros rápidos do CRM: cada um responde a uma pergunta de negócio.
  // "Última etapa" = etapa final do funil (geralmente "Fechado"/"Convertido").
  // Quando o filtro é orientado a etapa, setamos `etapaId`; quando é por
  // origem (ex.: "Vindos do bot"), setamos `origem`.
  const ultimaEtapa = etapas[etapas.length - 1];
  const aplicarRapido = (chave) => {
    const presets = {
      'vindos-bot':     { etapaId: '', origem: 'AI' },
      'manuais':        { etapaId: '', origem: 'Manual' },
      'leads-quentes':  { etapaId: ultimaEtapa?.id || '', origem: '' },
    };
    if (!chave || !presets[chave]) {
      setFiltros({ etapaId: '', origem: '', filtroRapido: '' });
      return;
    }
    setFiltros({ ...presets[chave], filtroRapido: chave });
  };

  const mudarEtapa = (id) => setFiltros((f) => ({ ...f, etapaId: id || '', filtroRapido: '' }));
  const mudarOrigem = (origem) => setFiltros((f) => ({ ...f, origem: origem || '', filtroRapido: '' }));
  const limparTudo = () => setFiltros({ etapaId: '', origem: '', filtroRapido: '' });

  const etapaSelecionada = etapas.find((e) => e.id === filtros.etapaId);
  const filtrosAtivos = [
    filtros.filtroRapido && {
      rotulo: { 'vindos-bot': 'Vindos do bot', 'manuais': 'Cadastrados manualmente', 'leads-quentes': 'Leads quentes' }[filtros.filtroRapido],
      onRemover: () => aplicarRapido(null),
    },
    !filtros.filtroRapido && etapaSelecionada && {
      rotulo: `Etapa: ${etapaSelecionada.nome}`,
      onRemover: () => mudarEtapa(''),
    },
    !filtros.filtroRapido && filtros.origem && {
      rotulo: `Origem: ${filtros.origem}`,
      onRemover: () => mudarOrigem(''),
    },
  ].filter(Boolean);

  const contadorTotal = dados?.totais?.leadsAbertos;
  const contador = contadorTotal !== undefined ? `${contadorTotal} cliente(s) em negociação` : null;

  const montarDados = () => ({
    nome: 'relatorio-crm',
    titulo: 'Relatório · Clientes',
    filtrosAtivos: filtrosAtivos.map((f) => f.rotulo),
    secoes: [
      {
        titulo: 'Resumo',
        colunas: [{ chave: 'indicador', label: 'Indicador' }, { chave: 'valor', label: 'Valor' }],
        linhas: dados ? [
          { indicador: 'Clientes em negociação', valor: fmtNum(dados.totais.leadsAbertos) },
          { indicador: 'Valor potencial em vendas', valor: fmtBRL(dados.totais.valorTotalFunil) },
          { indicador: 'Novos clientes no período', valor: fmtNum(dados.totais.criadosPeriodo) },
          { indicador: 'Conversões no período', valor: fmtNum(dados.totais.conversoesPeriodo) },
        ] : [],
      },
      {
        titulo: 'Funil de conversão',
        colunas: [
          { chave: 'nome', label: 'Etapa' },
          { chave: 'leads', label: 'Clientes' },
          { chave: 'valor', label: 'Valor potencial', valor: (e) => fmtBRL(e.valor) },
        ],
        linhas: dados?.funil || [],
      },
      {
        titulo: 'Clientes sem contato',
        colunas: [
          { chave: 'nome', label: 'Nome' },
          { chave: 'etapa', label: 'Etapa' },
          { chave: 'diasParado', label: 'Dias sem contato' },
        ],
        linhas: dados?.leadsParados || [],
      },
      {
        titulo: 'De onde vieram os clientes',
        colunas: [
          { chave: 'origem', label: 'Origem' },
          { chave: 'qtd', label: 'Quantidade' },
        ],
        linhas: dados?.origens || [],
      },
    ],
  });

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba montarDados={montarDados} dados={dados} />

      <BarraFiltros
        contador={contador}
        filtrosAtivos={filtrosAtivos}
        onLimparTudo={limparTudo}
      >
        <FiltroRapido
          ativo={filtros.filtroRapido}
          onChange={aplicarRapido}
          opcoes={[
            { chave: 'vindos-bot', label: 'Vindos do bot' },
            { chave: 'manuais', label: 'Cadastrados manualmente' },
            { chave: 'leads-quentes', label: 'Leads quentes (etapa final)' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Combobox
            size="sm"
            label="Filtrar por etapa do funil"
            value={filtros.etapaId}
            onChange={(id) => mudarEtapa(id)}
            placeholder="Todas as etapas"
            options={etapas.map((e) => ({ value: e.id, label: e.nome }))}
            clearable
          />
          <Input
            size="sm"
            label="De onde veio o cliente"
            value={filtros.origem}
            onChange={(e) => mudarOrigem(e.target.value)}
            placeholder="Ex.: WhatsApp, Instagram, indicação..."
          />
        </div>
      </BarraFiltros>

      {/* KPIs do CRM */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} color="info" label="Clientes em negociação"
          info="Pessoas que ainda não compraram nem foram descartadas — estão em alguma etapa do funil."
          valor={fmtNum(dados?.totais.leadsAbertos)}
          subvalor={dados ? `Valor potencial ${fmtBRL(dados.totais.valorTotalFunil)}` : null}
          carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Novos clientes no período"
          valor={fmtNum(dados?.totais.criadosPeriodo)} carregando={carregando} />
        <KpiCard icon={ShoppingCart} color="success" label="Vendas fechadas"
          info="Clientes que viraram venda no período."
          valor={fmtNum(dados?.totais.conversoesPeriodo)}
          subvalor={dados?.totais.taxaConversao !== null && dados?.totais.taxaConversao !== undefined
            ? `Taxa ${fmtPct(dados.totais.taxaConversao)}` : null}
          carregando={carregando} />
        <KpiCard icon={AlertCircle} color="warning" label="Sem contato há 7+ dias"
          info="Clientes parados no funil que precisam de atenção."
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
          <TituloSecao titulo="Clientes sem contato" info="Clientes parados no funil há vários dias. Vale dar uma atenção pra não esfriar." />
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
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ categoriaId: '', tipo: '', subTipo: '', filtroRapido: '' });

  useEffect(() => {
    let ativo = true;
    api.get('/financeiro/categorias').then((r) => {
      if (ativo) setCategorias(Array.isArray(r.data) ? r.data : []);
    }).catch(() => { if (ativo) setCategorias([]); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/financeiro', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
        ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(filtros.subTipo ? { subTipo: filtros.subTipo } : {}),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime(), filtros.categoriaId, filtros.tipo, filtros.subTipo]);

  // Filtros rápidos: aplicam combinações pré-configuradas. Setam o flag
  // `filtroRapido` para marcar a pílula ativa visualmente.
  const aplicarRapido = (chave) => {
    const presets = {
      'recebidos':           { categoriaId: '', tipo: 'RECEITA', subTipo: '' },
      'despesas-todas':      { categoriaId: '', tipo: 'DESPESA', subTipo: '' },
      'despesas-fixas':      { categoriaId: '', tipo: 'DESPESA', subTipo: 'FIXA' },
      'despesas-variaveis':  { categoriaId: '', tipo: 'DESPESA', subTipo: 'VARIAVEL' },
    };
    if (!chave || !presets[chave]) {
      setFiltros({ categoriaId: '', tipo: '', subTipo: '', filtroRapido: '' });
      return;
    }
    setFiltros({ ...presets[chave], filtroRapido: chave });
  };

  const mudarCategoria = (id) => setFiltros((f) => ({ ...f, categoriaId: id || '', filtroRapido: '' }));
  const mudarTipo = (tipo) => setFiltros((f) => ({ ...f, tipo: tipo || '', subTipo: '', filtroRapido: '' }));
  const limparTudo = () => setFiltros({ categoriaId: '', tipo: '', subTipo: '', filtroRapido: '' });

  const categoriaSelecionada = categorias.find((c) => c.id === filtros.categoriaId);
  const filtrosAtivos = [
    filtros.filtroRapido && {
      rotulo: { 'recebidos': 'Recebimentos', 'despesas-todas': 'Despesas', 'despesas-fixas': 'Despesas fixas', 'despesas-variaveis': 'Despesas variáveis' }[filtros.filtroRapido],
      onRemover: () => aplicarRapido(null),
    },
    !filtros.filtroRapido && filtros.tipo && {
      rotulo: filtros.tipo === 'RECEITA' ? 'Apenas receitas' : 'Apenas despesas',
      onRemover: () => mudarTipo(''),
    },
    categoriaSelecionada && {
      rotulo: `Categoria: ${categoriaSelecionada.nome}`,
      onRemover: () => mudarCategoria(''),
    },
  ].filter(Boolean);

  const totalLancamentos = dados?.totalLancamentos ?? dados?.lancamentos?.length;
  const contador = totalLancamentos !== undefined ? `${totalLancamentos} lançamento(s)` : null;

  const montarDados = () => ({
    nome: 'relatorio-financeiro',
    titulo: 'Relatório · Financeiro',
    filtrosAtivos: filtrosAtivos.map((f) => f.rotulo),
    secoes: [
      {
        titulo: 'Resumo do resultado',
        colunas: [{ chave: 'item', label: 'Item' }, { chave: 'valor', label: 'Valor' }],
        linhas: dados ? [
          { item: 'Total que entrou', valor: fmtBRL(dados.dre.receitaBruta) },
          { item: 'Custos variáveis', valor: fmtBRL(dados.dre.despesasVariaveis) },
          { item: 'Sobra antes das despesas fixas', valor: fmtBRL(dados.dre.receitaBruta - dados.dre.despesasVariaveis) },
          { item: 'Despesas fixas', valor: fmtBRL(dados.dre.despesasFixas) },
          { item: 'Lucro do período', valor: fmtBRL(dados.dre.resultadoLiquido) },
          { item: 'Margem de lucro', valor: fmtPct(dados.dre.margemLiquida) },
        ] : [],
      },
      {
        titulo: 'Receitas por categoria',
        colunas: [
          { chave: 'categoria', label: 'Categoria' },
          { chave: 'valor', label: 'Valor', valor: (l) => fmtBRL(l.valor) },
        ],
        linhas: dados?.receitasPorCategoria || [],
      },
      {
        titulo: 'Despesas por categoria',
        colunas: [
          { chave: 'categoria', label: 'Categoria' },
          { chave: 'valor', label: 'Valor', valor: (l) => fmtBRL(l.valor) },
        ],
        linhas: dados?.despesasPorCategoria || [],
      },
      {
        titulo: 'Dívidas por tempo de atraso',
        colunas: [
          { chave: 'descricao', label: 'Descrição' },
          { chave: 'lead', label: 'Cliente', valor: (i) => i.lead?.nome || '—' },
          { chave: 'valor', label: 'Valor', valor: (i) => fmtBRL(i.valor) },
          { chave: 'dataVencimento', label: 'Venceu em', valor: (i) => new Date(i.dataVencimento).toLocaleDateString('pt-BR') },
        ],
        linhas: dados?.receitasPendentesVencidas || [],
      },
    ],
  });

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba montarDados={montarDados} dados={dados} />

      <BarraFiltros
        contador={contador}
        filtrosAtivos={filtrosAtivos}
        onLimparTudo={limparTudo}
      >
        <FiltroRapido
          ativo={filtros.filtroRapido}
          onChange={aplicarRapido}
          opcoes={[
            { chave: 'recebidos', label: 'Recebimentos do período' },
            { chave: 'despesas-todas', label: 'Todas as despesas' },
            { chave: 'despesas-fixas', label: 'Despesas fixas' },
            { chave: 'despesas-variaveis', label: 'Despesas variáveis' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Combobox
            size="sm"
            label="Filtrar por categoria"
            value={filtros.categoriaId}
            onChange={(id) => mudarCategoria(id)}
            placeholder="Todas as categorias"
            options={categorias.map((c) => ({
              value: c.id,
              label: c.nome,
              sublabel: c.tipo === 'RECEITA' ? 'Receita' : `Despesa${c.subTipo ? ` · ${c.subTipo === 'FIXA' ? 'Fixa' : 'Variável'}` : ''}`,
            }))}
            clearable
          />
          {!filtros.filtroRapido && (
            <div className="flex items-end gap-1.5">
              <span className="text-xs text-[var(--text-muted)] mr-1 pb-2">Tipo:</span>
              <button
                type="button"
                onClick={() => mudarTipo(filtros.tipo === 'RECEITA' ? '' : 'RECEITA')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                  filtros.tipo === 'RECEITA'
                    ? 'bg-[var(--primary)] text-[var(--text-on-primary)] border-[var(--primary)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Receitas
              </button>
              <button
                type="button"
                onClick={() => mudarTipo(filtros.tipo === 'DESPESA' ? '' : 'DESPESA')}
                className={`px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                  filtros.tipo === 'DESPESA'
                    ? 'bg-[var(--primary)] text-[var(--text-on-primary)] border-[var(--primary)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-main)] hover:border-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Despesas
              </button>
            </div>
          )}
        </div>
      </BarraFiltros>

      {/* KPIs do topo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} color="success" label="Lucro do período"
          info="Receita menos despesa no período (resultado líquido)."
          valor={fmtBRL(dados?.dre.resultadoLiquido)}
          subvalor={dados ? `Margem ${fmtPct(dados.dre.margemLiquida)}` : null}
          carregando={carregando} />
        <KpiCard icon={Wallet} color="info" label="Total recebido"
          valor={fmtBRL(dados?.dre.receitaBruta)} carregando={carregando} />
        <KpiCard icon={AlertCircle} color={dados?.kpis.saldoEmRisco > 0 ? 'danger' : 'neutral'} label="Atrasado a receber"
          info="Cobranças que venceram e o cliente ainda não pagou."
          valor={fmtBRL(dados?.kpis.saldoEmRisco)}
          subvalor={dados ? `${dados.kpis.saldoEmRiscoQtd} título(s)` : null}
          carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Taxa de recebimento"
          info="% das cobranças que foram pagas em dia."
          valor={dados ? fmtPct(dados.kpis.indiceEficacia) : '—'}
          subvalor={dados ? `Previsão recuperar ${fmtBRL(dados.kpis.previsaoRecuperacao)}` : null}
          carregando={carregando} />
      </div>

      {/* DRE */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <TituloSecao titulo="Resumo do resultado" info="DRE (Demonstrativo do Resultado) — mostra quanto entrou, quanto saiu e quanto sobrou de lucro no período." />
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Só o que foi pago no período</div>
        </div>
        <BlocoDRE dre={dados?.dre} carregando={carregando} />
      </Card>

      {/* Fluxo de caixa diario */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Fluxo de caixa diário</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Dia a dia: o que entrou, o que saiu e como ficou o saldo</div>
        </div>
        <GraficoFluxoCaixa fluxo={dados?.fluxoDiario} carregando={carregando} />
      </Card>

      {/* Aging de inadimplencia */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <TituloSecao titulo="Dívidas por tempo de atraso" info="Agrupa cobranças vencidas pelo tempo que estão paradas (até 30 dias, 30-60, 60-90, mais de 90)." />
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
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Só o que foi pago no período</div>
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
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ categoriaId: '' });

  useEffect(() => {
    let ativo = true;
    api.get('/financeiro/categorias').then((r) => {
      if (ativo) setCategorias(Array.isArray(r.data) ? r.data : []);
    }).catch(() => { if (ativo) setCategorias([]); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/estoque', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
        ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime(), filtros.categoriaId]);

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba
        dados={dados}
        montarDados={() => ({
          nome: 'relatorio-estoque',
          titulo: 'Relatório · Estoque & CMV',
          secoes: [
            {
              titulo: 'Resumo',
              colunas: [{ chave: 'indicador', label: 'Indicador' }, { chave: 'valor', label: 'Valor' }],
              linhas: dados ? [
                { indicador: 'Valor do estoque', valor: fmtBRL(dados.kpis.patrimonioImobilizado) },
                { indicador: 'Produtos físicos', valor: fmtNum(dados.kpis.totalFisicos) },
                { indicador: 'Índice de ruptura', valor: fmtPct(dados.kpis.indiceRuptura) },
                { indicador: 'Itens abaixo do mínimo', valor: fmtNum(dados.kpis.abaixoMinimo) },
              ] : [],
            },
            {
              titulo: 'Lista de reposição',
              colunas: [
                { chave: 'nome', label: 'Produto' },
                { chave: 'estoqueAtual', label: 'Atual' },
                { chave: 'estoqueMinimo', label: 'Mínimo' },
                { chave: 'sugestao', label: 'Comprar', valor: (i) => fmtNum(i.sugestao) },
              ],
              linhas: dados?.reposicao || [],
            },
            {
              titulo: 'Produtos por importância (Curva ABC)',
              colunas: [
                { chave: 'classe', label: 'Classe' },
                { chave: 'nome', label: 'Produto' },
                { chave: 'receita', label: 'Receita', valor: (i) => fmtBRL(i.receita) },
              ],
              linhas: dados?.curvaABC || [],
            },
            {
              titulo: 'Margem por produto',
              colunas: [
                { chave: 'nome', label: 'Produto' },
                { chave: 'precoCusto', label: 'Custo', valor: (i) => fmtBRL(i.precoCusto) },
                { chave: 'preco', label: 'Venda', valor: (i) => fmtBRL(i.preco) },
                { chave: 'margemAbsoluta', label: 'Margem R$', valor: (i) => fmtBRL(i.margemAbsoluta) },
                { chave: 'margemPercentual', label: 'Margem %', valor: (i) => fmtPct(i.margemPercentual) },
              ],
              linhas: dados?.margemPorProduto || [],
            },
            {
              titulo: 'Estoque parado (sem giro)',
              colunas: [
                { chave: 'nome', label: 'Produto' },
                { chave: 'estoqueAtual', label: 'Estoque' },
                { chave: 'diasSemMovimento', label: 'Dias sem giro' },
              ],
              linhas: dados?.estoqueParado || [],
            },
          ],
        })}
      />

      <BarraFiltros
        contador={dados?.kpis?.totalFisicos !== undefined ? `${dados.kpis.totalFisicos} produto(s) físico(s)` : null}
        filtrosAtivos={[
          (() => {
            const c = categorias.find((x) => x.id === filtros.categoriaId);
            return c && { rotulo: `Categoria: ${c.nome}`, onRemover: () => setFiltros({ categoriaId: '' }) };
          })(),
        ].filter(Boolean)}
        onLimparTudo={() => setFiltros({ categoriaId: '' })}
      >
        <Combobox
          size="sm"
          label="Filtrar por categoria"
          value={filtros.categoriaId}
          onChange={(id) => setFiltros({ categoriaId: id || '' })}
          placeholder="Todas as categorias"
          options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
          clearable
        />
      </BarraFiltros>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Package} color="info" label="Valor do estoque"
          info="Quanto vale tudo que você tem parado em estoque (pelo preço de custo)."
          valor={fmtBRL(dados?.kpis.patrimonioImobilizado)}
          subvalor={dados ? `${dados.kpis.totalFisicos} produtos físicos` : null}
          carregando={carregando} />
        <KpiCard icon={DollarSign} color="success" label="Lucro se vender tudo"
          info="Quanto você ganharia vendendo todo o estoque pelo preço de venda."
          valor={fmtBRL(dados?.kpis.lucroPotencial)}
          subvalor={dados ? `Se vender tudo: ${fmtBRL(dados.kpis.valorVarejo)}` : null}
          carregando={carregando} />
        <KpiCard icon={AlertCircle} color={dados?.kpis.itensAbaixoMinimo > 0 ? 'warning' : 'neutral'} label="Produtos pra repor"
          info="Produtos com estoque abaixo do mínimo configurado."
          valor={fmtNum(dados?.kpis.itensAbaixoMinimo)}
          subvalor={dados ? `${dados.kpis.itensZerados} zerados` : null}
          carregando={carregando} />
        <KpiCard icon={TrendingDown} color={dados?.kpis.indiceRuptura > 10 ? 'danger' : 'neutral'} label="% sem estoque"
          info="Quantos produtos estão zerados (sem unidades disponíveis pra venda)."
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
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Quantos produtos entraram e saíram do estoque por dia</div>
        </div>
        <GraficoMovimentoInventario movimento={dados?.movimentoDiario} carregando={carregando} />
      </Card>

      {/* Curva ABC */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <TituloSecao titulo="Produtos por importância" info="Curva ABC: A = produtos que trazem ~80% da sua receita (campeões); B = médios (15%); C = vendem pouco (5%)." />
        </div>
        <BlocoCurvaABC curva={dados?.curvaABC} resumo={dados?.resumoABC} carregando={carregando} />
      </Card>

      {/* Margem por produto */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Margem por produto</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Os 50 produtos com a melhor margem de lucro</div>
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
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-28"></th>
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
                <img src={r.imagemUrl} alt="" className="w-24 h-24 object-contain" />
              ) : (
                <div className="w-24 h-24 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                  <ImageIcon size={28} />
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
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-28"></th>
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
                <img src={p.imagemUrl} alt="" className="w-24 h-24 object-contain" />
              ) : (
                <div className="w-24 h-24 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                  <ImageIcon size={28} />
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
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-28"></th>
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
                  <img src={p.imagemUrl} alt="" className="w-24 h-24 object-contain" />
                ) : (
                  <div className="w-24 h-24 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                    <ImageIcon size={28} />
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
  const [filtros, setFiltros] = useState({ origem: '', metodoPagamento: '', filtroRapido: '' });

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/vendas', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
        ...(filtros.origem ? { origem: filtros.origem } : {}),
        ...(filtros.metodoPagamento ? { metodoPagamento: filtros.metodoPagamento } : {}),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime(), filtros.origem, filtros.metodoPagamento]);

  // Filtros rápidos das vendas — perguntas de negócio que o lojista faz.
  const aplicarRapido = (chave) => {
    const presets = {
      'via-bot':     { origem: 'AI', metodoPagamento: '' },
      'presenciais': { origem: 'Manual', metodoPagamento: '' },
      'cartao':      { origem: '', metodoPagamento: 'CREDITO' },
      'pix':         { origem: '', metodoPagamento: 'PIX' },
    };
    if (!chave || !presets[chave]) {
      setFiltros({ origem: '', metodoPagamento: '', filtroRapido: '' });
      return;
    }
    setFiltros({ ...presets[chave], filtroRapido: chave });
  };

  const mudarOrigem = (origem) => setFiltros((f) => ({ ...f, origem: origem || '', filtroRapido: '' }));
  const mudarMetodo = (m) => setFiltros((f) => ({ ...f, metodoPagamento: m || '', filtroRapido: '' }));
  const limparTudo = () => setFiltros({ origem: '', metodoPagamento: '', filtroRapido: '' });

  const filtrosAtivos = [
    filtros.filtroRapido && {
      rotulo: {
        'via-bot': 'Vendas via bot',
        'presenciais': 'Vendas presenciais',
        'cartao': 'Pagamento em cartão',
        'pix': 'Pagamento em PIX',
      }[filtros.filtroRapido],
      onRemover: () => aplicarRapido(null),
    },
    !filtros.filtroRapido && filtros.origem && { rotulo: `De onde veio: ${filtros.origem}`, onRemover: () => mudarOrigem('') },
    !filtros.filtroRapido && filtros.metodoPagamento && { rotulo: `Pagamento: ${filtros.metodoPagamento}`, onRemover: () => mudarMetodo('') },
  ].filter(Boolean);

  const contador = dados?.totais?.totalVendas !== undefined
    ? `${dados.totais.totalVendas} venda(s)`
    : null;

  const montarDados = () => ({
    nome: 'relatorio-vendas',
    titulo: 'Relatório · Vendas',
    filtrosAtivos: filtrosAtivos.map((f) => f.rotulo),
    secoes: [
      {
        titulo: 'Resumo',
        colunas: [{ chave: 'indicador', label: 'Indicador' }, { chave: 'valor', label: 'Valor' }],
        linhas: dados ? [
          { indicador: 'Total de vendas', valor: fmtNum(dados.totais.totalVendas) },
          { indicador: 'Faturamento', valor: fmtBRL(dados.totais.faturamentoTotal) },
          { indicador: 'Ticket médio', valor: fmtBRL(dados.totais.ticketMedio) },
          { indicador: 'Lucro bruto', valor: fmtBRL(dados.totais.lucroTotal) },
          { indicador: 'Margem média', valor: fmtPct(dados.totais.margemMedia) },
        ] : [],
      },
      {
        titulo: 'Vendas por canal',
        colunas: [
          { chave: 'origem', label: 'Canal' },
          { chave: 'qtd', label: 'Quantidade' },
          { chave: 'valor', label: 'Receita', valor: (c) => fmtBRL(c.valor) },
          { chave: 'lucro', label: 'Lucro', valor: (c) => fmtBRL(c.lucro) },
        ],
        linhas: dados?.porCanal || [],
      },
      {
        titulo: 'Vendas por categoria',
        colunas: [
          { chave: 'categoria', label: 'Categoria' },
          { chave: 'qtd', label: 'Quantidade' },
          { chave: 'receita', label: 'Receita', valor: (c) => fmtBRL(c.receita) },
          { chave: 'lucro', label: 'Lucro', valor: (c) => fmtBRL(c.lucro) },
          { chave: 'margem', label: 'Margem', valor: (c) => fmtPct(c.margem) },
        ],
        linhas: dados?.porCategoria || [],
      },
      {
        titulo: 'Vendas mais lucrativas',
        colunas: [
          { chave: 'descricao', label: 'Venda' },
          { chave: 'valor', label: 'Valor', valor: (v) => fmtBRL(v.valor) },
          { chave: 'lucro', label: 'Lucro', valor: (v) => fmtBRL(v.lucro) },
        ],
        linhas: dados?.topLucro || [],
      },
    ],
  });

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba montarDados={montarDados} dados={dados} />

      <BarraFiltros
        contador={contador}
        filtrosAtivos={filtrosAtivos}
        onLimparTudo={limparTudo}
      >
        <FiltroRapido
          ativo={filtros.filtroRapido}
          onChange={aplicarRapido}
          opcoes={[
            { chave: 'via-bot', label: 'Vendas via bot' },
            { chave: 'presenciais', label: 'Vendas presenciais' },
            { chave: 'cartao', label: 'Pagamento em cartão' },
            { chave: 'pix', label: 'Pagamento em PIX' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            size="sm"
            label="De onde veio o cliente"
            value={filtros.origem}
            onChange={(e) => mudarOrigem(e.target.value)}
            placeholder="Ex.: WhatsApp, Instagram, indicação..."
          />
          <Input
            size="sm"
            label="Como foi pago"
            value={filtros.metodoPagamento}
            onChange={(e) => mudarMetodo(e.target.value)}
            placeholder="Ex.: PIX, Cartão, Dinheiro..."
          />
        </div>
      </BarraFiltros>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={ShoppingCart} color="info" label="Vendas no período"
          valor={fmtNum(dados?.kpis.totalVendas)}
          subvalor={dados ? fmtBRL(dados.kpis.valorTotal) : null}
          carregando={carregando} />
        <KpiCard icon={DollarSign} color="success" label="Ticket médio"
          info="Quanto cada cliente gasta em média por venda."
          valor={fmtBRL(dados?.kpis.ticketMedio)} carregando={carregando} />
        <KpiCard icon={TrendingUp} color="accent" label="Lucro bruto"
          info="Vendas menos o custo dos produtos (não inclui despesas fixas)."
          valor={fmtBRL(dados?.kpis.lucroBruto)}
          subvalor={dados ? `Margem ${fmtPct(dados.kpis.margemBruta)}` : null}
          carregando={carregando} />
        <KpiCard icon={Users} color="warning" label="Clientes que compraram"
          info="% dos novos clientes do período que viraram venda."
          valor={dados?.kpis.taxaConversao !== null && dados?.kpis.taxaConversao !== undefined
            ? fmtPct(dados.kpis.taxaConversao) : '—'}
          subvalor={dados ? `${dados.kpis.vendasComLead} de ${dados.kpis.leadsCriadosPeriodo} leads` : null}
          carregando={carregando} />
      </div>

      {/* Por canal */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas por canal</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">De onde veio o cliente de cada venda</div>
        </div>
        <TabelaPorCanal porCanal={dados?.porCanal} carregando={carregando} />
      </Card>

      {/* Sazonalidade — heatmap */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <TituloSecao titulo="Quando você vende mais" info="Dias da semana e horários com mais movimento. Útil pra ajustar agenda, equipe e estoque." />
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Cor mais forte = mais vendas naquele horário</div>
        </div>
        <Heatmap sazonalidade={dados?.sazonalidade} carregando={carregando} />
      </Card>

      {/* Por categoria */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas por categoria</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Receita, custo, lucro e margem de cada categoria</div>
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
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">As 10 vendas que mais lucraram</div>
          </div>
          <TabelaTopVendas itens={dados?.top10MaisLucrativas} carregando={carregando} corLucro="success" />
        </Card>

        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vendas com menor lucro</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">As 10 com menor lucro — avalie se o preço está certo</div>
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

  // Labels coloquiais (sem sinais matematicos "(−)" "(=)" — tooltip explica a
  // operacao). Sinal negativo aparece so no valor (em vermelho). Linhas de
  // destaque (Sobra / Lucro) ficam em negrito. Divisorias separam cada linha.
  const linhas = [
    {
      label: 'Total que entrou',
      valor: dre.receitaBruta,
      cor: 'success',
      sublabel: 'Vendas pagas no período',
      info: 'Soma de todas as receitas pagas no período (Receita bruta).',
    },
    {
      label: 'Custos variáveis',
      valor: -dre.despesasVariaveis,
      cor: 'danger',
      sublabel: 'Impostos, taxas de cartão, comissão e similares',
      info: 'Despesas que sobem ou descem conforme o volume de vendas. Inclui categorias marcadas com "venda" ou "imposto".',
    },
    {
      label: 'Sobra antes das despesas fixas',
      valor: dre.receitaBruta - dre.despesasVariaveis,
      cor: 'neutral',
      destaque: true,
      info: 'Quanto sobra das vendas depois de descontar os custos variáveis. Esse valor precisa cobrir as despesas fixas (aluguel, salário, etc) pra você ter lucro. Termo contábil: Margem de contribuição.',
    },
    {
      label: 'Despesas fixas',
      valor: -dre.despesasFixas,
      cor: 'danger',
      sublabel: 'Aluguel, salário, internet, contas que pagam todo mês',
    },
    {
      label: 'Lucro do período',
      valor: dre.resultadoLiquido,
      cor: dre.resultadoLiquido >= 0 ? 'success' : 'danger',
      destaque: true,
      info: 'O que efetivamente sobrou no bolso depois de pagar tudo (custos variáveis e despesas fixas). Termo contábil: Resultado líquido.',
    },
  ];

  return (
    <div className="px-5 py-2 divide-y divide-[var(--border-main)]">
      {linhas.map((l) => (
        <div
          key={l.label}
          className="flex items-start justify-between gap-3 py-3"
        >
          <div className="flex-1 min-w-0">
            {/* Padrao uniforme — todos labels com mesmo peso/cor. O destaque
                das linhas-chave (Sobra / Lucro) vem pela cor forte do VALOR
                (verde/vermelho), nao pelo negrito do label. */}
            <div className="text-sm flex items-center gap-1.5 font-medium text-[var(--text-secondary)]">
              {l.label}
              {l.info && (
                <InfoTooltip content={l.info}>
                  <HelpCircle size={13} strokeWidth={2} className="text-[var(--text-muted)] opacity-70 hover:opacity-100 cursor-help" />
                </InfoTooltip>
              )}
            </div>
            {l.sublabel && (
              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{l.sublabel}</div>
            )}
          </div>
          {/* Valor sempre text-lg font-bold tabular-nums + leading-none pra
              ficar alinhado horizontalmente com o label (sem o sublabel
              empurrar visualmente). */}
          <div className={`text-lg font-bold tabular-nums leading-none flex-shrink-0 ${
            l.cor === 'success' ? 'text-[var(--success)]' :
            l.cor === 'danger' ? 'text-[var(--danger)]' :
            'text-[var(--text-main)]'
          }`}>
            {l.valor < 0 ? '−' : ''}{fmtBRL(Math.abs(l.valor))}
          </div>
        </div>
      ))}
      <div className="text-xs text-[var(--text-muted)] py-3 flex items-center gap-1.5">
        <span>Margem de lucro do período: <strong className="text-[var(--text-main)]">{fmtPct(dre.margemLiquida)}</strong></span>
        <InfoTooltip content="A cada R$ 100 que entram, quantos sobram de lucro depois de pagar tudo. Termo contábil: Margem líquida.">
          <HelpCircle size={12} strokeWidth={2} className="text-[var(--text-muted)] opacity-70 hover:opacity-100 cursor-help" />
        </InfoTooltip>
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
              <div className="text-[10px] text-[var(--text-muted)]">potencial em vendas</div>
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
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5 w-28"></th>
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
                <img src={p.imagemUrl} alt="" className="w-24 h-24 object-contain" />
              ) : (
                <div className="w-24 h-24 rounded-md bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                  <ImageIcon size={28} />
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
  const [bots, setBots] = useState([]);
  const [filtros, setFiltros] = useState({ botId: '', canal: '' });

  useEffect(() => {
    let ativo = true;
    api.get('/bots').then((r) => {
      if (ativo) setBots(Array.isArray(r.data) ? r.data : []);
    }).catch(() => { if (ativo) setBots([]); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/bots', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
        ...(filtros.botId ? { botId: filtros.botId } : {}),
        ...(filtros.canal ? { canal: filtros.canal } : {}),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime(), filtros.botId, filtros.canal]);

  const fmtMs = (ms) => {
    if (!ms || ms < 1000) return `${ms || 0}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba
        dados={dados}
        montarDados={() => ({
          nome: 'relatorio-bots',
          titulo: 'Relatório · Bots / IA',
          secoes: [
            {
              titulo: 'Resumo',
              colunas: [{ chave: 'indicador', label: 'Indicador' }, { chave: 'valor', label: 'Valor' }],
              linhas: dados ? [
                { indicador: 'Total de atendimentos', valor: fmtNum(dados.kpis.totalExecucoes) },
                { indicador: 'Mensagens trocadas', valor: fmtNum(dados.kpis.totalMensagens) },
                { indicador: 'Taxa de sucesso', valor: fmtPct(dados.kpis.taxaSucesso) },
                { indicador: 'Tempo médio de atendimento', valor: fmtMs(dados.kpis.duracaoMediaMs) },
                { indicador: 'Custo total de IA', valor: fmtBRL(dados.kpis.custoTotalIa) },
              ] : [],
            },
            {
              titulo: 'Por canal',
              colunas: [
                { chave: 'canal', label: 'Canal' },
                { chave: 'recebidas', label: 'Recebidas' },
                { chave: 'enviadas', label: 'Enviadas' },
              ],
              linhas: dados?.porCanal || [],
            },
            {
              titulo: 'Ferramentas usadas pelo bot',
              colunas: [
                { chave: 'tool', label: 'Ação' },
                { chave: 'qtd', label: 'Chamadas' },
                { chave: 'duracaoMediaMs', label: 'Tempo médio', valor: (t) => fmtMs(t.duracaoMediaMs) },
              ],
              linhas: dados?.toolsUsadas || [],
            },
            {
              titulo: 'Uso de IA por modelo',
              colunas: [
                { chave: 'modelo', label: 'Modelo' },
                { chave: 'chamadas', label: 'Chamadas' },
                { chave: 'tokensEntrada', label: 'Tokens entrada' },
                { chave: 'tokensSaida', label: 'Tokens saída' },
                { chave: 'custo', label: 'Custo', valor: (m) => fmtBRL(m.custo) },
              ],
              linhas: dados?.porModelo || [],
            },
          ],
        })}
      />

      <BarraFiltros
        contador={dados?.kpis?.totalExecucoes !== undefined ? `${dados.kpis.totalExecucoes} atendimento(s)` : null}
        filtrosAtivos={[
          (() => {
            const b = bots.find((x) => x.id === filtros.botId);
            return b && { rotulo: `Bot: ${b.nome}`, onRemover: () => setFiltros((f) => ({ ...f, botId: '' })) };
          })(),
          filtros.canal && {
            rotulo: `Canal: ${{ WHATSAPP: 'WhatsApp' }[filtros.canal] || filtros.canal}`,
            onRemover: () => setFiltros((f) => ({ ...f, canal: '' })),
          },
        ].filter(Boolean)}
        onLimparTudo={() => setFiltros({ botId: '', canal: '' })}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Combobox
            size="sm"
            label="Filtrar por bot"
            value={filtros.botId}
            onChange={(id) => setFiltros((f) => ({ ...f, botId: id || '' }))}
            placeholder="Todos os bots"
            options={bots.map((b) => ({ value: b.id, label: b.nome, sublabel: b.canal }))}
            clearable
          />
          <Combobox
            size="sm"
            label="Filtrar por canal"
            value={filtros.canal}
            onChange={(c) => setFiltros((f) => ({ ...f, canal: c || '' }))}
            placeholder="Todos os canais"
            options={[
              { value: 'WHATSAPP', label: 'WhatsApp' },
            ]}
            clearable
          />
        </div>
      </BarraFiltros>

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
        <KpiCard icon={Bot} color="success" label="Atendimentos do bot"
          info="Quantas vezes o bot atendeu um cliente de ponta a ponta."
          valor={fmtNum(dados?.kpis.totalExec)}
          subvalor={dados && dados.kpis.taxaSucesso !== null
            ? `${fmtPct(dados.kpis.taxaSucesso)} de sucesso` : null}
          carregando={carregando} />
        <KpiCard icon={Sparkles} color="warning" label="Uso de IA"
          info="Total consumido em chamadas pra inteligência artificial — impacta o custo do bot."
          valor={fmtNum(dados?.kpis.tokensTotal)}
          subvalor={dados ? `${fmtNum(dados.kpis.chamadasIA)} chamada(s) ao LLM` : null}
          carregando={carregando} />
      </div>

      {/* Mensagens por dia */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Mensagens por dia</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Mensagens recebidas e enviadas pelo bot, dia a dia</div>
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
            <TituloSecao titulo="Atendimentos bem-sucedidos" info="Quantos atendimentos do bot terminaram sem erro vs. falharam ou foram interrompidos." />
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">
              {dados ? `Tempo médio de cada atendimento: ${fmtMs(dados.kpis.duracaoMediaMs)}` : '—'}
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
            Ações que o bot executou durante os atendimentos (criar cliente, enviar mensagem, etc.)
          </div>
        </div>
        <TabelaToolsUsadas itens={dados?.toolsUsadas} carregando={carregando} fmtMs={fmtMs} />
      </Card>

      {/* Custo de IA por modelo */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Uso de IA por modelo</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Quanto cada modelo de IA foi usado (referência pra calcular custo)</div>
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

// ============================================================
// ABA: Caixa — sessoes, retiradas, entradas, divergencias
// ============================================================
function AbaCaixa({ intervalo }) {
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [filtros, setFiltros] = useState({ origem: '', comDivergencia: '', filtroRapido: '' });

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api.get('/relatorios/caixa', {
      params: {
        inicio: intervalo.inicio.toISOString(),
        fim: intervalo.fim.toISOString(),
        ...(filtros.origem ? { origem: filtros.origem } : {}),
        ...(filtros.comDivergencia ? { comDivergencia: filtros.comDivergencia } : {}),
      },
    })
      .then((r) => { if (ativo) setDados(r.data); })
      .catch((e) => { if (ativo) setErro(e?.response?.data?.error || 'Erro ao carregar.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [intervalo.inicio.getTime(), intervalo.fim.getTime(), filtros.origem, filtros.comDivergencia]);

  const fmtTempo = (ms) => {
    if (!ms || ms === 0) return '—';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  };

  // Filtros rápidos da aba Caixa — perguntas de auditoria do dia a dia.
  const aplicarRapido = (chave) => {
    const presets = {
      'apenas-bot':         { origem: 'AUTO_BOT', comDivergencia: '' },
      'apenas-manuais':     { origem: 'MANUAL', comDivergencia: '' },
      'com-divergencia':    { origem: '', comDivergencia: 'true' },
    };
    if (!chave || !presets[chave]) {
      setFiltros({ origem: '', comDivergencia: '', filtroRapido: '' });
      return;
    }
    setFiltros({ ...presets[chave], filtroRapido: chave });
  };

  const limparTudo = () => setFiltros({ origem: '', comDivergencia: '', filtroRapido: '' });

  const filtrosAtivos = [
    filtros.filtroRapido && {
      rotulo: {
        'apenas-bot': 'Apenas automáticas (bot)',
        'apenas-manuais': 'Apenas manuais',
        'com-divergencia': 'Com diferença de saldo',
      }[filtros.filtroRapido],
      onRemover: () => aplicarRapido(null),
    },
  ].filter(Boolean);

  const contador = dados?.kpis?.totalSessoes !== undefined
    ? `${dados.kpis.totalSessoes} sessão(ões) fechada(s)`
    : null;

  const montarDados = () => ({
    nome: 'relatorio-caixa',
    titulo: 'Relatório · Caixa',
    filtrosAtivos: filtrosAtivos.map((f) => f.rotulo),
    secoes: [
      {
        titulo: 'Resumo',
        colunas: [{ chave: 'indicador', label: 'Indicador' }, { chave: 'valor', label: 'Valor' }],
        linhas: dados ? [
          { indicador: 'Sessões fechadas', valor: fmtNum(dados.kpis.totalSessoes) },
          { indicador: 'Vendas em dinheiro', valor: fmtBRL(dados.kpis.vendasDinheiro.valor) },
          { indicador: 'Saldo médio ao fechar', valor: fmtBRL(dados.kpis.saldoMedioDiario) },
          { indicador: 'Total de retiradas', valor: fmtBRL(dados.kpis.totalSangrias) },
          { indicador: 'Total de entradas', valor: fmtBRL(dados.kpis.totalSuprimentos) },
          { indicador: 'Diferença acumulada', valor: fmtBRL(dados.kpis.diferencaAcumulada) },
          { indicador: 'Tempo médio aberto', valor: fmtTempo(dados.kpis.tempoMedioMs) },
        ] : [],
      },
      {
        titulo: 'Sessões fechadas',
        colunas: [
          { chave: 'fechadaEm', label: 'Fechada em', valor: (s) => new Date(s.fechadaEm).toLocaleString('pt-BR') },
          { chave: 'origem', label: 'Origem' },
          { chave: 'fundoCaixa', label: 'Fundo', valor: (s) => fmtBRL(s.fundoCaixa) },
          { chave: 'saldoEsperado', label: 'Esperado', valor: (s) => fmtBRL(s.saldoEsperado) },
          { chave: 'saldoReal', label: 'Real', valor: (s) => fmtBRL(s.saldoReal) },
          { chave: 'diferenca', label: 'Diferença', valor: (s) => fmtBRL(s.diferenca) },
          { chave: 'usuarioFechouNome', label: 'Fechou' },
        ],
        linhas: dados?.sessoes || [],
      },
      {
        titulo: 'Motivos de retirada',
        colunas: [
          { chave: 'motivo', label: 'Motivo' },
          { chave: 'valor', label: 'Total', valor: (m) => fmtBRL(m.valor) },
        ],
        linhas: dados?.topMotivosSangria || [],
      },
      {
        titulo: 'Motivos de entrada no caixa',
        colunas: [
          { chave: 'motivo', label: 'Motivo' },
          { chave: 'valor', label: 'Total', valor: (m) => fmtBRL(m.valor) },
        ],
        linhas: dados?.topMotivosSuprimento || [],
      },
    ],
  });

  return (
    <div className="space-y-5">
      {erro && <ErroBox mensagem={erro} />}

      <CabecalhoAba montarDados={montarDados} dados={dados} />

      <BarraFiltros
        contador={contador}
        filtrosAtivos={filtrosAtivos}
        onLimparTudo={limparTudo}
      >
        <FiltroRapido
          ativo={filtros.filtroRapido}
          onChange={aplicarRapido}
          opcoes={[
            { chave: 'apenas-bot', label: 'Apenas automáticas (bot)' },
            { chave: 'apenas-manuais', label: 'Apenas manuais' },
            { chave: 'com-divergencia', label: 'Com diferença de saldo' },
          ]}
        />
      </BarraFiltros>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Wallet}
          color="info"
          label="Sessões fechadas"
          valor={fmtNum(dados?.kpis.totalSessoes)}
          subvalor={dados?.kpis.sessoesComDivergencia > 0 ? `${dados.kpis.sessoesComDivergencia} com divergência` : 'Tudo bate'}
          carregando={carregando}
          info="Quantas vezes o caixa foi fechado no período (manual ou pelo cron automático às 00:01)."
        />
        <KpiCard
          icon={DollarSign}
          color="success"
          label="Vendas em dinheiro"
          valor={fmtBRL(dados?.kpis.vendasDinheiro.valor)}
          subvalor={dados ? `${dados.kpis.vendasDinheiro.qtd} venda(s)` : null}
          carregando={carregando}
          info="Soma das vendas pagas em dinheiro vivo no período (não inclui PIX, cartão, etc.)."
        />
        <KpiCard
          icon={Wallet}
          color="accent"
          label="Saldo médio ao fechar"
          valor={fmtBRL(dados?.kpis.saldoMedioDiario)}
          carregando={carregando}
          info="Em média, quanto sobrava no caixa físico em cada fechamento."
        />
        <KpiCard
          icon={AlertCircle}
          color={Math.abs(dados?.kpis.diferencaAcumulada || 0) > 0 ? 'warning' : 'success'}
          label="Diferença acumulada"
          valor={fmtBRL(dados?.kpis.diferencaAcumulada)}
          subvalor={dados?.kpis.diferencaAcumulada >= 0 ? 'Sobra (dinheiro a mais)' : 'Falta (dinheiro a menos)'}
          carregando={carregando}
          info="Soma de todas as diferenças (real − esperado). Positivo = sobrou dinheiro no caixa; negativo = faltou."
        />
        <KpiCard
          icon={ArrowUpRight}
          color="danger"
          label="Retiradas"
          valor={fmtBRL(dados?.kpis.totalSangrias)}
          subvalor={dados ? `${dados.kpis.qtdSangrias} retirada(s)` : null}
          carregando={carregando}
          info="Total tirado do caixa físico no período (ex.: depósito no banco)."
        />
        <KpiCard
          icon={ArrowDownRight}
          color="success"
          label="Entradas"
          valor={fmtBRL(dados?.kpis.totalSuprimentos)}
          subvalor={dados ? `${dados.kpis.qtdSuprimentos} entrada(s)` : null}
          carregando={carregando}
          info="Total colocado no caixa físico manualmente no período (ex.: troco extra)."
        />
        <KpiCard
          icon={Clock}
          color="info"
          label="Tempo médio aberto"
          valor={fmtTempo(dados?.kpis.tempoMedioMs)}
          carregando={carregando}
          info="Quanto tempo, em média, cada sessão ficou aberta entre abertura e fechamento."
        />
      </div>

      {/* Tabela de sessões fechadas */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-main)]">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sessões fechadas</div>
          <div className="text-sm text-[var(--text-secondary)] mt-0.5">Histórico do período (mais recentes primeiro)</div>
        </div>
        <TabelaSessoesCaixa sessoes={dados?.sessoes} carregando={carregando} />
      </Card>

      {/* Divergências */}
      {dados?.divergencias?.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)] flex items-center justify-between">
            <div>
              <TituloSecao titulo="Sessões com divergência" info="Sessões que fecharam com diferença entre o saldo esperado (calculado pelo sistema) e o saldo real (contado fisicamente). Vale investigar." />
              <div className="text-sm text-[var(--text-secondary)] mt-0.5">Saldo contado diferente do esperado</div>
            </div>
            <Badge variant="warning" size="sm">{dados.divergencias.length} sessão(ões)</Badge>
          </div>
          <TabelaDivergencias divergencias={dados.divergencias} />
        </Card>
      )}

      {/* Top motivos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Principais motivos de retirada</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Onde o dinheiro saiu do caixa</div>
          </div>
          <TabelaMotivosCaixa itens={dados?.topMotivosSangria} carregando={carregando} cor="danger" />
        </Card>
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-main)]">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Principais motivos de entrada</div>
            <div className="text-sm text-[var(--text-secondary)] mt-0.5">Por que o dinheiro foi reforçado</div>
          </div>
          <TabelaMotivosCaixa itens={dados?.topMotivosSuprimento} carregando={carregando} cor="success" />
        </Card>
      </div>
    </div>
  );
}

function TabelaSessoesCaixa({ sessoes, carregando }) {
  if (carregando && !sessoes) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!sessoes || sessoes.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhuma sessão fechada no período.</div>;
  }
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-[var(--border-main)]">
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Fechada em</th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Origem</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Fundo</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Esperado</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Real</th>
          <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Diferença</th>
          <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Fechou</th>
        </tr>
      </thead>
      <tbody>
        {sessoes.map((s) => {
          const dif = Number(s.diferenca || 0);
          return (
            <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
              <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">
                {s.fechadaEm ? new Date(s.fechadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
              </td>
              <td className="py-3 px-5 text-xs">
                <Badge variant={s.origem === 'AUTO_BOT' ? 'info' : 'neutral'} size="sm">
                  {s.origem === 'AUTO_BOT' ? 'Automático (bot)' : 'Manual'}
                </Badge>
              </td>
              <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-secondary)]">{fmtBRL(s.fundoCaixa)}</td>
              <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-main)]">{fmtBRL(s.saldoEsperado)}</td>
              <td className="py-3 px-5 text-right text-sm tabular-nums font-semibold text-[var(--text-main)]">{fmtBRL(s.saldoReal)}</td>
              <td className={`py-3 px-5 text-right text-sm tabular-nums font-bold ${
                dif > 0 ? 'text-[var(--success)]' : dif < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'
              }`}>
                {dif > 0 ? '+' : ''}{fmtBRL(dif)}
              </td>
              <td className="py-3 px-5 text-xs text-[var(--text-muted)]">{s.usuarioFechouNome || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TabelaDivergencias({ divergencias }) {
  return (
    <div className="px-5 py-3 space-y-2">
      {divergencias.map((d) => {
        const dif = Number(d.diferenca || 0);
        return (
          <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--bg-subtle)]/50">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[var(--text-main)]">
                {new Date(d.fechadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Esperado {fmtBRL(d.saldoEsperado)} · Real {fmtBRL(d.saldoReal)}
                {d.usuarioFechouNome && ` · fechado por ${d.usuarioFechouNome}`}
              </div>
            </div>
            <div className={`text-sm font-bold tabular-nums flex-shrink-0 ${
              dif > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}>
              {dif > 0 ? '+' : ''}{fmtBRL(dif)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabelaMotivosCaixa({ itens, carregando, cor }) {
  if (carregando && !itens) return <div className="px-5 py-6 text-center text-sm text-[var(--text-muted)]">Calculando…</div>;
  if (!itens || itens.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Nenhum motivo registrado.</div>;
  }
  const total = itens.reduce((acc, i) => acc + i.valor, 0);
  return (
    <div className="px-5 py-3 space-y-2">
      {itens.map((i) => {
        const pct = total > 0 ? (i.valor / total) * 100 : 0;
        return (
          <div key={i.motivo} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-[var(--text-main)] truncate">{i.motivo}</span>
              <span className={`font-bold tabular-nums flex-shrink-0 ${cor === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                {fmtBRL(i.valor)}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: cor === 'danger' ? 'var(--danger)' : 'var(--success)' }}
              />
            </div>
          </div>
        );
      })}
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
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Como terminaram</div>
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
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
          <span>Como o bot foi acionado</span>
          <InfoTooltip content="Se o atendimento foi disparado pelo cliente, por outro fluxo, ou automaticamente.">
            <HelpCircle size={11} strokeWidth={2} className="text-[var(--text-muted)] opacity-70 hover:opacity-100 cursor-help" />
          </InfoTooltip>
        </div>
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

// KpiCard agora vem do ui/ (compartilhado).

// Helper pra renderizar o titulo de uma secao com tooltip explicativo opcional.
// Padrao visual identico ao que ja era usado inline (text-xs uppercase muted).
// O icone HelpCircle so aparece se `info` for passado.
function TituloSecao({ titulo, info }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{titulo}</div>
      {info && (
        <InfoTooltip content={info}>
          <HelpCircle size={13} strokeWidth={2} className="text-[var(--text-muted)] opacity-70 hover:opacity-100 cursor-help" />
        </InfoTooltip>
      )}
    </div>
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

// (BlocoFiltros legado removido — substituído por BarraFiltros do design system)

// ============================================================
// ABA: Fechamento mensal — lista snapshots persistidos
// ============================================================
function AbaMensais() {
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);
  const { user } = useAuthStore();

  const podeGerar = user?.perfil === 'CLIENT' || user?.perfil === 'ADMINISTRADOR';

  useEffect(() => {
    carregar();
  }, []);

  const carregar = () => {
    setCarregando(true);
    setErro(null);
    relatorioMensalService.listar()
      .then(setItens)
      .catch(() => setErro('Não foi possível carregar os relatórios mensais.'))
      .finally(() => setCarregando(false));
  };

  const onGerarAnterior = async () => {
    setGerando(true);
    try {
      await relatorioMensalService.gerar();
      carregar();
    } catch (e) {
      setErro(e?.response?.data?.error || 'Não foi possível gerar agora.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-4">
      {erro && <ErroBox mensagem={erro} />}

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-[var(--text-muted)]">
          {itens.length === 0 && !carregando
            ? 'Nenhum mês fechado ainda.'
            : `${itens.length} mês(es) disponível(is)`}
        </div>
        {podeGerar && (
          <button
            type="button"
            onClick={onGerarAnterior}
            disabled={gerando}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-[var(--primary)] text-[var(--text-on-primary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {gerando ? 'Gerando…' : 'Gerar mês anterior agora'}
          </button>
        )}
      </div>

      {carregando ? (
        <Card padding="lg">
          <div className="text-sm text-[var(--text-muted)] text-center py-6">Carregando…</div>
        </Card>
      ) : itens.length === 0 ? (
        <Card padding="lg">
          <div className="text-sm text-[var(--text-secondary)] text-center py-10">
            <div className="font-semibold text-[var(--text-main)]">Sem relatórios mensais por aqui</div>
            <div className="mt-1 text-[var(--text-muted)]">
              O sistema gera automaticamente no dia 7 de cada mês. Você também pode gerar manualmente quando quiser.
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {itens.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/app/relatorios/mensais/${r.ano}-${String(r.mes).padStart(2, '0')}`)}
              className="text-left rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)] hover:bg-[var(--bg-subtle)]/40 transition-colors"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Fechamento</div>
              <div className="text-xl font-semibold tracking-tight text-[var(--text-main)] mt-1">
                {NOMES_MES_BR[r.mes]} de {r.ano}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-3">
                Gerado em {new Date(r.geradoEm).toLocaleDateString('pt-BR')}
                {r.geradoPor === 'CRON' ? ' (automático)' : ' (manual)'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NOMES_MES_BR = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
