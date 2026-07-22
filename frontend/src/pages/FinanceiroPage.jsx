import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, MoreHorizontal,
  Edit2, Trash2, CheckCircle2, XCircle, Tag, Filter, ArrowDownToLine, ArrowUpFromLine,
  Lock, ShoppingCart, MessageCircle, CalendarClock, ExternalLink, Wallet, Pencil,
  History, ArrowRight
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import contaPagarService from '../services/contaPagarService';
import { usePermissao } from '../hooks/usePermissao';
import {
  Card, CardHeader, CardTitle, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider, useToast,
  Tabs, TabsList, TabsTrigger, TabsContent, Combobox, KpiCard,
} from '../components/ui';
import Modal from '../components/Modal';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABELS = {
  PENDENTE: { label: 'Pendente', variant: 'warning' },
  PAGO: { label: 'Pago', variant: 'success' },
  ATRASADO: { label: 'Atrasado', variant: 'danger' },
  CANCELADO: { label: 'Cancelado', variant: 'neutral' },
};

// Mapeia slug da URL -> value usado nos Tabs internos. Mantemos os values
// originais (lancamentos/categorias/caixa) pra compatibilidade.
const SLUG_TAB = {
  lancamentos: 'lancamentos',
  categorias: 'categorias',
  caixa: 'caixa',
  'contas-pagar': 'contas-pagar',
};

export default function FinanceiroPage() {
  const toast = useToast();
  const { aba } = useParams();
  // Tab vem da URL. Default 'lancamentos' se slug invalido — App ja redireciona.
  const tab = SLUG_TAB[aba] || 'lancamentos';
  // Permissões granulares — ADMIN/CLIENT/ADMINISTRADOR passam direto.
  // VENDEDOR sem permissão tem botões críticos escondidos. Backend valida sempre.
  const podeCriarFinanceiro = usePermissao('FINANCEIRO', 'criar');
  const podeEditarFinanceiro = usePermissao('FINANCEIRO', 'editar');
  const podeExcluirFinanceiro = usePermissao('FINANCEIRO', 'excluir');
  const [resumo, setResumo] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  // Catalogo flat (produto + variacoes) — usado no modal de lancamento pra
  // selecionar item em vez de digitar nome livre. Carregado 1x ao montar.
  const [catalogo, setCatalogo] = useState([]);
  // Sessao de caixa atual (aberta) ou null. Substitui o conceito antigo de
  // "saldo manual" — agora caixa tem ciclo de vida (aberto/fechado) com
  // saldo esperado calculado dinamicamente.
  const [sessaoCaixa, setSessaoCaixa] = useState(null);
  // Historico de sessoes fechadas — carregado so quando aba=caixa.
  const [sessoesCaixa, setSessoesCaixa] = useState([]);
  // Modais especificos do caixa
  const [modalAbrirCaixa, setModalAbrirCaixa] = useState(false);
  const [modalFecharCaixa, setModalFecharCaixa] = useState(false);
  // ModalMovimentacao: { open, tipo: 'SANGRIA' | 'SUPRIMENTO' }
  const [modalMovCaixa, setModalMovCaixa] = useState({ open: false, tipo: null });
  // Cancelamento com motivo — soft-delete que preserva o lancamento no banco
  // (status=CANCELADO + motivo). Diferente de excluir (hard-delete).
  const [modalCancelar, setModalCancelar] = useState({ open: false, lanc: null });
  // Modal de cobranca com mensagem editavel — abre antes do wa.me pra usuario
  // customizar antes de enviar. Dados vem de POST /:id/cobrar.
  const [modalCobranca, setModalCobranca] = useState({ open: false, dados: null });
  // Selecao multipla pra acao em lote (marcar varios como pago).
  // Set<lancamentoId>. Lancamentos de venda nao entram aqui — backend filtra
  // mesmo se o front mandar (vendaId != null e ignorado).
  const [selecionados, setSelecionados] = useState(new Set());
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [modalLanc, setModalLanc] = useState({ open: false, data: null });
  const [modalCat, setModalCat] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, lanc: null });

  // Contas a pagar — lista + modais (cadastro/edicao + pagar).
  const [contasPagar, setContasPagar] = useState([]);
  const [modalContaPagar, setModalContaPagar] = useState({ open: false, data: null });
  // Modal "Pagar conta": valor editavel + opcao de tirar do caixa.
  const [modalPagarConta, setModalPagarConta] = useState({ open: false, conta: null });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroStatus, busca]);

  // Carrega catalogo so 1x (independente dos filtros de lancamento) e achata
  // produto+variacoes em uma lista plana pro Combobox do modal.
  useEffect(() => {
    api.get('/catalogo').then((r) => {
      const flat = [];
      (r.data || []).forEach((p) => {
        (p.variacoes || []).forEach((v) => flat.push({ ...v, produto: p }));
      });
      setCatalogo(flat);
    }).catch(() => setCatalogo([]));
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroStatus) params.set('status', filtroStatus);
      if (busca) params.set('buscar', busca);
      params.set('limite', '100');

      const [r, l, c, caixaResp, cp] = await Promise.all([
        api.get('/financeiro/resumo').catch(() => ({ data: null })),
        api.get(`/financeiro/lancamentos?${params}`).catch(() => ({ data: { dados: [] } })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
        api.get('/financeiro/caixa/atual').catch(() => ({ data: { sessao: null } })),
        contaPagarService.listar().catch(() => []),
      ]);
      setResumo(r.data);
      setLancamentos(l.data?.dados || l.data || []);
      setCategorias(c.data || []);
      setSessaoCaixa(caixaResp.data?.sessao ?? null);
      setContasPagar(cp || []);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarLanc = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/financeiro/lancamentos/${dados.id}`, dados);
        toast.success('Lancamento atualizado');
      } else {
        await api.post('/financeiro/lancamentos', dados);
        toast.success('Lancamento criado');
      }
      setModalLanc({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (l) => {
    if (!confirm(`Excluir lancamento "${l.descricao}"?`)) return;
    try {
      await api.delete(`/financeiro/lancamentos/${l.id}`);
      toast.success('Excluido');
      setDrawer({ open: false, lanc: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  const handleStatus = async (l, status) => {
    try {
      await api.patch(`/financeiro/lancamentos/${l.id}/status`, { status });
      toast.success('Status atualizado');
      setDrawer({ open: false, lanc: null });
      carregar();
    } catch {
      toast.error('Erro ao mudar status');
    }
  };

  // Cobranca via WhatsApp: backend retorna template com variaveis substituidas.
  // Abre modal pro usuario revisar/editar a mensagem antes de enviar.
  // Quando ele confirma, a mensagem editada vira o ?text= do wa.me.
  const handleCobrar = async (l) => {
    try {
      const r = await api.post(`/financeiro/lancamentos/${l.id}/cobrar`);
      if (!r.data?.linkBase) {
        // Resposta legada — fallback abre o link direto.
        if (r.data?.link) window.open(r.data.link, '_blank', 'noopener,noreferrer');
        return;
      }
      setModalCobranca({ open: true, dados: { ...r.data, lanc: l } });
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao gerar cobrança');
    }
  };

  // Confirma envio: monta wa.me com a mensagem final (editada ou padrao)
  // e abre em nova aba. Fecha o modal.
  const handleConfirmarCobranca = (mensagemFinal) => {
    const { linkBase } = modalCobranca.dados || {};
    if (!linkBase) return;
    const url = `${linkBase}?text=${encodeURIComponent(mensagemFinal)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('Abrindo WhatsApp...');
    setModalCobranca({ open: false, dados: null });
  };

  // Limpa selecao sempre que muda a lista (filtros ou recarga).
  useEffect(() => { setSelecionados(new Set()); }, [filtroTipo, filtroStatus, busca]);

  // Carrega historico de sessoes fechadas quando entra na aba 'caixa'.
  useEffect(() => {
    if (tab !== 'caixa') return;
    api.get('/financeiro/caixa/sessoes?limite=30')
      .then((r) => setSessoesCaixa(r.data?.sessoes || []))
      .catch(() => setSessoesCaixa([]));
  }, [tab, sessaoCaixa?.id, sessaoCaixa?.status]);

  // Lancamentos elegiveis pra acao em lote: nao podem ser de venda nem estar
  // ja pagos/cancelados nem imutaveis (mes fechado). Backend tambem filtra,
  // mas validamos no front pra UX.
  const lancamentosElegiveis = useMemo(
    () => lancamentos.filter((l) => !l.vendaId && l.status !== 'PAGO' && l.status !== 'CANCELADO' && !l.imutavel),
    [lancamentos]
  );
  const todosSelecionados = lancamentosElegiveis.length > 0 && lancamentosElegiveis.every((l) => selecionados.has(l.id));
  const algunsSelecionados = selecionados.size > 0 && !todosSelecionados;

  const toggleSelecao = (id) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const toggleSelecaoTodos = () => {
    if (todosSelecionados) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(lancamentosElegiveis.map((l) => l.id)));
    }
  };

  // Aplica acao em lote (hoje so 'marcar como pago'). Backend PATCH
  // /lote/status filtra venda e retorna count alterado + ignorado.
  const handleAcaoLote = async (status) => {
    const ids = [...selecionados];
    if (ids.length === 0) return;
    try {
      const r = await api.patch('/financeiro/lancamentos/lote/status', { ids, status });
      const msg = r.data?.mensagem || `${ids.length} lançamento(s) atualizado(s)`;
      toast.success(msg);
      setSelecionados(new Set());
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao atualizar em lote');
    }
  };

  // Cancelar lancamento com motivo. Endpoint POST /:id/cancelar (mesmo path
  // do DELETE, mas com motivo no body) — soft-delete que mantem trilha.
  // Diferente do PATCH /status que so muda status sem registrar o porque.
  const handleCancelarComMotivo = async (lanc, motivo) => {
    try {
      await api.delete(`/financeiro/lancamentos/${lanc.id}/cancelar`, { data: { motivo } });
      toast.success('Lançamento cancelado');
      setModalCancelar({ open: false, lanc: null });
      setDrawer({ open: false, lanc: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao cancelar');
    }
  };

  // Exclui um grupo inteiro de parcelas (idAgrupamento). Backend ja filtra
  // fora as pagas e as de venda — retorna count alterado.
  const handleExcluirGrupo = async (lanc) => {
    if (!lanc.idAgrupamento) return;
    if (!confirm(`Excluir TODAS as parcelas em aberto deste lançamento? Parcelas já pagas serão mantidas.`)) return;
    try {
      const r = await api.delete(`/financeiro/lancamentos/grupo/${lanc.idAgrupamento}`);
      toast.success(`${r.data?.count || 'Parcelas'} excluídas`);
      setDrawer({ open: false, lanc: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir grupo');
    }
  };

  // CAIXA — handlers de abrir/fechar/retirada/entrada (rotas e enum no backend
  // mantêm os termos SANGRIA/SUPRIMENTO por compatibilidade com dado histórico).
  const handleAbrirCaixa = async ({ fundoCaixa, observacao }) => {
    try {
      await api.post('/financeiro/caixa/abrir', { fundoCaixa, observacao });
      toast.success('Caixa aberto');
      setModalAbrirCaixa(false);
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao abrir caixa');
    }
  };

  const handleFecharCaixa = async ({ saldoFinalReal, observacao }) => {
    try {
      const r = await api.post('/financeiro/caixa/fechar', { saldoFinalReal, observacao });
      const dif = r.data?.sessao?.diferenca ?? 0;
      const txt = dif === 0 ? 'Caixa fechado · bateu certinho' :
                  dif > 0  ? `Caixa fechado · sobra de ${fmtBRL(dif)}` :
                             `Caixa fechado · falta de ${fmtBRL(Math.abs(dif))}`;
      toast.success(txt);
      setModalFecharCaixa(false);
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao fechar caixa');
    }
  };

  const handleMovimentacaoCaixa = async ({ tipo, valor, motivo }) => {
    try {
      const url = tipo === 'SANGRIA' ? '/financeiro/caixa/sangria' : '/financeiro/caixa/suprimento';
      await api.post(url, { valor, motivo });
      toast.success(tipo === 'SANGRIA' ? 'Retirada registrada' : 'Entrada registrada');
      setModalMovCaixa({ open: false, tipo: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao registrar movimentação');
    }
  };

  // Adia o vencimento em N dias. Backend default e 3 — passamos explicito.
  const handleAdiar = async (l, dias) => {
    try {
      const r = await api.post(`/financeiro/lancamentos/${l.id}/pausa`, { dias });
      const novoVenc = new Date(r.data?.novoVencimento || Date.now()).toLocaleDateString('pt-BR');
      toast.success(`Vencimento adiado pra ${novoVenc}`);
      setDrawer({ open: false, lanc: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao adiar');
    }
  };

  const handleSalvarCat = async (dados) => {
    try {
      if (dados.id) {
        await api.patch(`/financeiro/categorias/${dados.id}`, dados);
        toast.success('Categoria atualizada');
      } else {
        await api.post('/financeiro/categorias', dados);
        toast.success('Categoria criada');
      }
      setModalCat({ open: false, data: null });
      carregar();
    } catch {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleExcluirCat = async (c) => {
    if (!confirm(`Excluir categoria "${c.nome}"?`)) return;
    try {
      await api.delete(`/financeiro/categorias/${c.id}`);
      toast.success('Categoria excluida');
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  // ---------- Contas a Pagar ----------
  const handleSalvarContaPagar = async (dados) => {
    try {
      if (dados.id) {
        await contaPagarService.editar(dados.id, dados);
        toast.success('Conta a pagar atualizada');
      } else {
        await contaPagarService.criar(dados);
        toast.success('Conta a pagar criada');
      }
      setModalContaPagar({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar conta a pagar');
    }
  };

  const handleExcluirContaPagar = async (c) => {
    if (!confirm(`Excluir conta "${c.nome}"?`)) return;
    try {
      await contaPagarService.excluir(c.id);
      toast.success('Conta excluida');
      carregar();
    } catch (e) {
      // Se houver pagamentos vinculados, backend retorna 409 — sugere desativar.
      if (e.response?.data?.codigo === 'TEM_PAGAMENTOS') {
        if (confirm(`${e.response.data.error}\n\nDesativar essa conta agora?`)) {
          await contaPagarService.editar(c.id, { ativa: false });
          toast.success('Conta desativada');
          carregar();
        }
        return;
      }
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  const handleAtivarContaPagar = async (c) => {
    try {
      await contaPagarService.editar(c.id, { ativa: !c.ativa });
      toast.success(c.ativa ? 'Conta desativada' : 'Conta reativada');
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro');
    }
  };

  const handlePagarConta = async ({ conta, valor, motivo, tirarDoCaixa }) => {
    // A conta pode vir de dois lugares:
    //   1. Pré-selecionada na lista de contas (modalPagarConta.conta != null)
    //   2. Escolhida no combobox do modal quando aberto pelo header do caixa
    //      (o modal passa o objeto `conta` no callback nesse caso)
    const contaAlvo = conta || modalPagarConta.conta;
    if (!contaAlvo) {
      toast.error('Selecione uma conta antes de confirmar.');
      return;
    }
    try {
      await contaPagarService.pagar(contaAlvo.id, { valor, motivo, tirarDoCaixa });
      toast.success('Pagamento registrado');
      setModalPagarConta({ open: false, conta: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao pagar conta');
    }
  };

  return (
    <div className="space-y-5">
      {/* KPIs — Caixa atual saiu daqui (vira aba dedicada). Sao 4 cards focados
          em fluxo do mes; o saldo de caixa real fica em /financeiro/caixa. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ArrowDownToLine}
          color="success"
          label="Receitas (pago)"
          valor={fmtBRL(resumo?.totalReceitas || 0)}
        />
        <KpiCard
          icon={ArrowUpFromLine}
          color="danger"
          label="Despesas (pago)"
          valor={fmtBRL(resumo?.totalDespesas || 0)}
        />
        <KpiCard
          icon={DollarSign}
          color="neutral"
          label="Saldo do mês"
          valor={fmtBRL((resumo?.totalReceitas || 0) - (resumo?.totalDespesas || 0))}
        />
        <KpiCard
          icon={AlertCircle}
          color="warning"
          label="A receber pendente"
          valor={fmtBRL(resumo?.aReceber || 0)}
        />
      </div>

      {/* Header so com botoes condicionais por aba — Tabs internos sao
          invisiveis porque a navegacao vem do sidebar/URL. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {tab === 'lancamentos' && (
          <Button variant="primary" icon={Plus} onClick={() => setModalLanc({ open: true, data: null })}>
            Novo lançamento
          </Button>
        )}
        {tab === 'categorias' && (
          <Button variant="primary" icon={Plus} onClick={() => setModalCat({ open: true, data: null })}>
            Nova categoria
          </Button>
        )}
        {/* Botoes do caixa mudam conforme o estado: aberto/fechado.
            - Fechado: 'Abrir caixa' (acao primaria)
            - Aberto: Retirada + Entrada + Pagar despesa + Fechar caixa */}
        {tab === 'caixa' && !sessaoCaixa && podeCriarFinanceiro && (
          <Button variant="primary" icon={Wallet} onClick={() => setModalAbrirCaixa(true)}>
            Abrir caixa
          </Button>
        )}
        {tab === 'caixa' && sessaoCaixa && podeEditarFinanceiro && (
          <>
            <Button
              variant="secondary"
              icon={ArrowUpFromLine}
              title="Tirar dinheiro do caixa (ex.: depositar no banco)"
              onClick={() => setModalMovCaixa({ open: true, tipo: 'SANGRIA' })}
            >
              Retirada
            </Button>
            <Button
              variant="secondary"
              icon={ArrowDownToLine}
              title="Colocar dinheiro no caixa (ex.: troco extra)"
              onClick={() => setModalMovCaixa({ open: true, tipo: 'SUPRIMENTO' })}
            >
              Entrada
            </Button>
            <Button
              variant="secondary"
              icon={DollarSign}
              title="Pagar uma despesa cadastrada (cria lançamento + retirada do caixa)"
              onClick={() => {
                // Se houver contas ativas, abre seletor. Se não, alerta + leva pra cadastro.
                const ativas = (contasPagar || []).filter((c) => c.ativa);
                if (ativas.length === 0) {
                  toast.info('Cadastre uma conta a pagar primeiro.');
                  return;
                }
                // Abre modal sem conta pré-selecionada — ModalPagarConta tem combobox.
                setModalPagarConta({ open: true, conta: null });
              }}
            >
              Pagar despesa
            </Button>
            <Button variant="primary" icon={Lock} onClick={() => setModalFecharCaixa(true)}>
              Fechar caixa
            </Button>
          </>
        )}
        {tab === 'contas-pagar' && podeCriarFinanceiro && (
          <Button variant="primary" icon={Plus} onClick={() => setModalContaPagar({ open: true, data: null })}>
            Nova conta a pagar
          </Button>
        )}
      </div>

      <Tabs value={tab}>

        <TabsContent value="lancamentos" className="mt-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex-1 min-w-[240px] max-w-md">
              <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descricao..." />
            </div>
            <Select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              placeholder="Todos tipos"
              options={[
                { value: 'RECEITA', label: 'Receita' },
                { value: 'DESPESA', label: 'Despesa' },
              ]}
              fullWidth={false}
              className="w-40"
            />
            <Select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              placeholder="Todos status"
              options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
              fullWidth={false}
              className="w-40"
            />
          </div>

          {/* Barra de acoes em lote — aparece quando >=1 selecionado.
              Permite marcar varios como pagos numa tacada so. */}
          {selecionados.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 mb-3 rounded-xl bg-[var(--bg-subtle)] text-[var(--text-main)] border border-[var(--border-main)]">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} strokeWidth={2} className="text-[var(--accent)]" />
                <span className="text-sm font-semibold tabular-nums">
                  {selecionados.size} {selecionados.size === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelecionados(new Set())}>
                  Limpar
                </Button>
                <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => handleAcaoLote('PAGO')}>
                  Marcar como pagos
                </Button>
              </div>
            </div>
          )}

          {carregando ? (
            <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
          ) : lancamentos.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={DollarSign}
                title="Nenhum lancamento"
                description="Cadastre receitas e despesas pra acompanhar o financeiro."
                action={<Button variant="primary" icon={Plus} onClick={() => setModalLanc({ open: true, data: null })}>Novo lancamento</Button>}
              />
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-main)]">
                    {/* Checkbox 'selecionar todos elegiveis' (nao-venda, nao-pago, nao-cancelado).
                        Indeterminate quando alguns mas nao todos. */}
                    <th className="w-12 px-5 py-3">
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        ref={(el) => { if (el) el.indeterminate = algunsSelecionados; }}
                        onChange={toggleSelecaoTodos}
                        disabled={lancamentosElegiveis.length === 0}
                        className="w-4 h-4 rounded border-[var(--border-main)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Descrição</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Categoria</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Vencimento</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => {
                    // Usa statusEfetivo quando disponivel (ATRASADO derivado pelo backend).
                    const statusReal = l.statusEfetivo || l.status;
                    const status = STATUS_LABELS[statusReal] || { label: statusReal, variant: 'neutral' };
                    // Elegivel pra acao em lote = nao venda, nao pago, nao cancelado, nao imutavel.
                    const ehElegivel = !l.vendaId && l.status !== 'PAGO' && l.status !== 'CANCELADO' && !l.imutavel;
                    const estaSelecionado = selecionados.has(l.id);
                    return (
                      <tr
                        key={l.id}
                        onClick={() => setDrawer({ open: true, lanc: l })}
                        className={`border-b border-[var(--border-subtle)] cursor-pointer transition-colors ${
                          estaSelecionado
                            ? 'bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle)]'
                            : 'hover:bg-[var(--bg-subtle)]/50'
                        }`}
                      >
                        {/* Checkbox por linha — bloqueado pra lancamentos de venda
                            ou ja resolvidos (pago/cancelado). stopPropagation pra
                            nao abrir o drawer ao clicar. */}
                        <td onClick={(e) => e.stopPropagation()} className="px-5 py-3">
                          <input
                            type="checkbox"
                            checked={estaSelecionado}
                            onChange={() => toggleSelecao(l.id)}
                            disabled={!ehElegivel}
                            className="w-4 h-4 rounded border-[var(--border-main)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`Selecionar ${l.descricao}`}
                            title={
                              l.vendaId ? 'Lançamento de venda — gerenciado em Vendas' :
                              l.imutavel ? 'Mês fechado — não pode mais ser alterado' :
                              l.status === 'PAGO' ? 'Já está pago' :
                              l.status === 'CANCELADO' ? 'Está cancelado' :
                              'Selecionar'
                            }
                          />
                        </td>
                        {/* Cancelado: cinza + tachado em descricao e valor.
                            Sinal +/- some pra nao parecer movimento ativo. */}
                        <td className="py-3 px-5">
                          <div className={`flex items-center gap-2 ${l.status === 'CANCELADO' ? 'opacity-60' : ''}`}>
                            <div className={`w-1.5 h-8 rounded-full ${
                              l.status === 'CANCELADO' ? 'bg-[var(--text-muted)]' :
                              l.tipo === 'RECEITA' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
                            }`} />
                            <div>
                              <div className={`text-sm font-semibold tracking-tight ${
                                l.status === 'CANCELADO' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'
                              }`}>
                                {l.descricao}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)]">{l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">
                          {l.categoria?.nome || '—'}
                        </td>
                        <td className="py-3 px-5 text-xs text-[var(--text-muted)]">
                          {new Date(l.dataVencimento).toLocaleDateString('pt-BR')}
                        </td>
                        <td className={`py-3 px-5 text-right text-sm font-semibold tabular-nums ${
                          l.status === 'CANCELADO' ? 'text-[var(--text-muted)] line-through' :
                          l.tipo === 'RECEITA' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                        }`}>
                          {l.status === 'CANCELADO'
                            ? fmtBRL(l.valor)
                            : `${l.tipo === 'RECEITA' ? '+' : '-'} ${fmtBRL(l.valor)}`}
                        </td>
                        <td className="py-3 px-5">
                          <Badge variant={status.variant} size="sm">{status.label}</Badge>
                        </td>
                        <td onClick={(e) => e.stopPropagation()} className="py-3 px-3">
                          <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Ações" />}>
                            {/* Imutavel (mes fechado): so visualizar */}
                            {l.imutavel && (
                              <DropdownItem icon={Lock} disabled>Mês fechado</DropdownItem>
                            )}
                            {!l.imutavel && (
                              <>
                                <DropdownItem icon={Edit2} onClick={() => setModalLanc({ open: true, data: l })}>Editar</DropdownItem>
                                {l.status !== 'PAGO' && (
                                  <DropdownItem icon={CheckCircle2} onClick={() => handleStatus(l, 'PAGO')}>Marcar como pago</DropdownItem>
                                )}
                                {/* Cobrar via WhatsApp — so quando faz sentido (receita em aberto com telefone) */}
                                {l.tipo === 'RECEITA' && l.status !== 'PAGO' && l.lead?.telefone && (
                                  <DropdownItem icon={MessageCircle} onClick={() => handleCobrar(l)}>
                                    Cobrar via WhatsApp
                                  </DropdownItem>
                                )}
                                {/* Atalho de adiar 7 dias direto — pra adiar com outros prazos, abre o drawer */}
                                {l.status !== 'PAGO' && l.status !== 'CANCELADO' && !l.vendaId && (
                                  <DropdownItem icon={CalendarClock} onClick={() => handleAdiar(l, 7)}>
                                    Adiar 7 dias
                                  </DropdownItem>
                                )}
                                {/* Cancelar agora abre modal pedindo motivo — preserva auditoria */}
                                {l.status !== 'CANCELADO' && !l.vendaId && (
                                  <DropdownItem icon={XCircle} onClick={() => setModalCancelar({ open: true, lanc: l })}>
                                    Cancelar com motivo
                                  </DropdownItem>
                                )}
                                {/* Excluir grupo de parcelas — so quando o lancamento e parte de um agrupamento */}
                                {l.idAgrupamento && (
                                  <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluirGrupo(l)}>
                                    Excluir todas parcelas
                                  </DropdownItem>
                                )}
                                <DropdownDivider />
                                <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(l)}>Excluir</DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="categorias" className="mt-4">
          {categorias.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Tag}
                title="Nenhuma categoria"
                description="Categorias organizam receitas e despesas (ex: Alimentacao, Salarios, Vendas online)."
                action={<Button variant="primary" icon={Plus} onClick={() => setModalCat({ open: true, data: null })}>Nova categoria</Button>}
              />
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-main)]">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Nome</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Tipo</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 transition-colors">
                      <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <Badge variant={c.tipo === 'RECEITA' ? 'success' : 'danger'} size="sm">
                            {c.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                          </Badge>
                          {c.tipo === 'DESPESA' && c.subTipo && (
                            <Badge variant="neutral" size="sm">
                              {c.subTipo === 'FIXA' ? 'Fixa' : 'Variável'}
                            </Badge>
                          )}
                          {c.tipo === 'DESPESA' && !c.subTipo && (
                            <span className="text-[10px] text-[var(--text-muted)] italic">Sem classificação</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                          <DropdownItem icon={Edit2} onClick={() => setModalCat({ open: true, data: c })}>Editar</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluirCat(c)}>Excluir</DropdownItem>
                        </Dropdown>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Aba Caixa: sessao aberta (se houver) com saldo + acoes; senao tela
            de abertura. Historico de sessoes fechadas como cards separados. */}
        <TabsContent value="caixa" className="mt-4">
          <CaixaTela
            sessao={sessaoCaixa}
            sessoesFechadas={sessoesCaixa}
            onAbrir={() => setModalAbrirCaixa(true)}
          />
        </TabsContent>

        {/* Aba Contas a pagar: cadastro de despesas recorrentes/pontuais. */}
        <TabsContent value="contas-pagar" className="mt-4">
          <ListaContasPagar
            contas={contasPagar}
            carregando={carregando}
            podeCriar={podeCriarFinanceiro}
            podeEditar={podeEditarFinanceiro}
            podeExcluir={podeExcluirFinanceiro}
            onNova={() => setModalContaPagar({ open: true, data: null })}
            onEditar={(c) => setModalContaPagar({ open: true, data: c })}
            onExcluir={handleExcluirContaPagar}
            onAtivar={handleAtivarContaPagar}
            onPagar={(c) => setModalPagarConta({ open: true, conta: c })}
          />
        </TabsContent>
      </Tabs>

      <ModalLancamento
        isOpen={modalLanc.open}
        onClose={() => setModalLanc({ open: false, data: null })}
        lanc={modalLanc.data}
        categorias={categorias}
        catalogo={catalogo}
        onSalvar={handleSalvarLanc}
      />

      <ModalCategoria
        isOpen={modalCat.open}
        onClose={() => setModalCat({ open: false, data: null })}
        cat={modalCat.data}
        onSalvar={handleSalvarCat}
      />

      <DrawerLancamento
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, lanc: null })}
        lanc={drawer.lanc}
        onEditar={() => {
          setModalLanc({ open: true, data: drawer.lanc });
          setDrawer({ open: false, lanc: null });
        }}
        onExcluir={() => handleExcluir(drawer.lanc)}
        onStatus={(s) => handleStatus(drawer.lanc, s)}
        onCancelarComMotivo={() => setModalCancelar({ open: true, lanc: drawer.lanc })}
        onExcluirGrupo={() => handleExcluirGrupo(drawer.lanc)}
        onCobrar={() => handleCobrar(drawer.lanc)}
        onAdiar={(dias) => handleAdiar(drawer.lanc, dias)}
      />

      {/* Modais do caixa */}
      <ModalAbrirCaixa
        isOpen={modalAbrirCaixa}
        onClose={() => setModalAbrirCaixa(false)}
        onConfirmar={handleAbrirCaixa}
      />
      <ModalFecharCaixa
        isOpen={modalFecharCaixa}
        onClose={() => setModalFecharCaixa(false)}
        sessao={sessaoCaixa}
        onConfirmar={handleFecharCaixa}
      />
      <ModalMovimentacaoCaixa
        isOpen={modalMovCaixa.open}
        tipo={modalMovCaixa.tipo}
        onClose={() => setModalMovCaixa({ open: false, tipo: null })}
        onConfirmar={(dados) => handleMovimentacaoCaixa({ ...dados, tipo: modalMovCaixa.tipo })}
      />

      <ModalContaPagar
        isOpen={modalContaPagar.open}
        onClose={() => setModalContaPagar({ open: false, data: null })}
        conta={modalContaPagar.data}
        categorias={categorias.filter((c) => c.tipo === 'DESPESA' && c.uso === 'DESPESA')}
        onSalvar={handleSalvarContaPagar}
      />

      <ModalPagarConta
        isOpen={modalPagarConta.open}
        onClose={() => setModalPagarConta({ open: false, conta: null })}
        contaSelecionada={modalPagarConta.conta}
        contas={(contasPagar || []).filter((c) => c.ativa)}
        sessaoCaixaAberta={!!sessaoCaixa}
        onConfirmar={handlePagarConta}
      />

      <ModalCancelar
        isOpen={modalCancelar.open}
        onClose={() => setModalCancelar({ open: false, lanc: null })}
        lanc={modalCancelar.lanc}
        onConfirmar={(motivo) => handleCancelarComMotivo(modalCancelar.lanc, motivo)}
      />

      <ModalCobranca
        isOpen={modalCobranca.open}
        onClose={() => setModalCobranca({ open: false, dados: null })}
        dados={modalCobranca.dados}
        onEnviar={handleConfirmarCobranca}
      />
    </div>
  );
}

// KPI compacto — mesmo padrao do Estoque/Visao geral (layout horizontal:
// icone + label + valor em linha, padding md em vez de lg).
// Aceita `acao` opcional (botao ou link logo abaixo do valor) pra cards
// interativos (ex: "Caixa atual" tem botao "Ajustar").
// Kpi local removido — usa KpiCard compartilhado do ui/.

const METODOS_PAGAMENTO = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
];

// Helper: preco de venda da variacao.
function precoEfetivoVar(v) {
  if (!v) return 0;
  return Number(v.preco) || 0;
}

function ModalLancamento({ isOpen, onClose, lanc, categorias, catalogo = [], onSalvar }) {
  const [form, setForm] = useState({
    descricao: '', valor: 0, tipo: 'RECEITA', dataVencimento: '',
    dataPagamento: '', categoriaId: '', status: 'PENDENTE', parcelas: 1,
    produto: '', metodoPagamento: '',
    // variacaoId nao vai pro backend — guardamos so pra o Combobox manter
    // selecao visual e pra auto-preenchimento de descricao/valor.
    variacaoId: '',
  });

  useEffect(() => {
    if (lanc) setForm({
      ...lanc,
      dataVencimento: lanc.dataVencimento?.split('T')[0] || '',
      dataPagamento: lanc.dataPagamento?.split('T')[0] || '',
      categoriaId: lanc.categoriaId || '',
      produto: lanc.produto || '',
      metodoPagamento: lanc.metodoPagamento || '',
      // Edicao nao vincula variacao retroativamente — produto fica como texto.
      variacaoId: '',
    });
    else {
      setForm({
        descricao: '', valor: 0, tipo: 'RECEITA',
        dataVencimento: new Date().toISOString().split('T')[0],
        dataPagamento: '', categoriaId: '', status: 'PENDENTE', parcelas: 1,
        produto: '', metodoPagamento: '',
        variacaoId: '',
      });
    }
  }, [lanc, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const valorNumber = parseFloat(form.valor);
    if (isNaN(valorNumber) || valorNumber <= 0) {
      alert('O valor deve ser maior que zero');
      return;
    }
    const dados = { ...form, valor: valorNumber };
    // variacaoId so existe no front pra UX do Combobox — backend nao usa.
    delete dados.variacaoId;
    if (!form.dataPagamento) delete dados.dataPagamento;
    if (!form.categoriaId) delete dados.categoriaId;
    if (!form.produto) delete dados.produto;
    if (!form.metodoPagamento) delete dados.metodoPagamento;
    if (!lanc) dados.parcelas = parseInt(form.parcelas) || 1;
    onSalvar(dados);
  };

  // Selecionou item do catalogo: preenche nome do produto + valor (se ainda
  // zero) + descricao (se vazia) + categoria (do produto, respeitando o tipo).
  // Usuario pode trocar tudo manualmente depois.
  const handleSelecionarCatalogo = (id) => {
    if (!id) {
      setForm((f) => ({ ...f, variacaoId: '', produto: '' }));
      return;
    }
    const v = catalogo.find((x) => x.id === id);
    if (!v) return;
    const ehVarPadrao = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
    const nomeCompleto = ehVarPadrao ? v.produto?.nome : `${v.produto?.nome} · ${v.nome}`;
    const preco = precoEfetivoVar(v);

    // Categoria do produto: backend retorna `categoria` ou so `categoriaId`.
    // Resolve a categoria completa pra checar compatibilidade com o tipo do
    // lancamento — so atribui se ela existe e bate com o tipo (RECEITA/DESPESA).
    const catIdDoProduto = v.produto?.categoriaId || v.produto?.categoria?.id;
    const catDoProduto = catIdDoProduto
      ? categorias.find((c) => c.id === catIdDoProduto)
      : null;

    setForm((f) => {
      // Produto vendido normalmente e RECEITA. Se a categoria do produto e
      // de RECEITA e o usuario ainda nao mudou o tipo manualmente, ajusta
      // automaticamente pra evitar mismatch.
      const tipoSugerido = catDoProduto?.tipo || f.tipo;

      // So preenche categoria se ela e compatível com o tipo final.
      const categoriaIdNova = catDoProduto && catDoProduto.tipo === tipoSugerido
        ? catDoProduto.id
        : f.categoriaId;

      return {
        ...f,
        variacaoId: id,
        produto: nomeCompleto,
        tipo: tipoSugerido,
        categoriaId: categoriaIdNova,
        valor: (parseFloat(f.valor) || 0) === 0 ? preco : f.valor,
        descricao: f.descricao?.trim() ? f.descricao : `Venda de ${nomeCompleto}`,
      };
    });
  };

  // Lançamento avulso do caixa: só categorias de uso CAIXA ou DESPESA (não as
  // de serviço/produto, que vêm dos respectivos cadastros), e do mesmo tipo.
  const categoriasFiltradas = categorias.filter(
    (c) => c.tipo === form.tipo && (c.uso === 'CAIXA' || c.uso === 'DESPESA')
  );

  // Catalogo filtrado pela categoria selecionada: se o usuario ja escolheu
  // "Dentista-procedimentos", nao faz sentido oferecer "Cabo Iphone" no
  // combobox. Sem categoria selecionada, mostra tudo.
  const catalogoFiltrado = form.categoriaId
    ? catalogo.filter((v) => v.produto?.categoriaId === form.categoriaId)
    : catalogo;

  // Banner amigavel quando o usuario tenta criar lancamento sem nenhuma
  // categoria cadastrada — link direto pra aba Categorias.
  const naoTemCategoria = categorias.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lanc ? 'Editar lançamento' : 'Novo lançamento'}
      description={lanc ? null : 'Receita (entrada) ou despesa (saída) do seu caixa.'}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {naoTemCategoria && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
            <Tag size={18} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed flex-1">
              <strong>Você ainda não tem categorias.</strong> Sem categoria fica difícil ver de onde vem seu dinheiro. Cadastre uma rapidinho — basta nome e tipo (Receita/Despesa).
            </div>
          </div>
        )}

        <Input
          size="lg"
          label="O que é esse lançamento?"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          placeholder="Ex.: Aluguel de maio, Venda de produto avulso"
          required
          autoFocus
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            size="lg"
            label="É entrada ou saída de dinheiro?"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value, categoriaId: '' })}
            options={[
              { value: 'RECEITA', label: 'Entrada (dinheiro chegando)' },
              { value: 'DESPESA', label: 'Saída (dinheiro saindo)' },
            ]}
            placeholder=""
          />
          <Input
            size="lg"
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            required
          />
          <Input
            size="lg"
            label="Quando vence?"
            type="date"
            value={form.dataVencimento}
            onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })}
            required
          />
          <Select
            size="lg"
            label="Situação"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
            placeholder=""
          />
          <Select
            size="lg"
            label="Categoria"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            placeholder={naoTemCategoria ? 'Cadastre uma categoria primeiro' : 'Sem categoria'}
            options={categoriasFiltradas.map((c) => ({ value: c.id, label: c.nome }))}
            disabled={naoTemCategoria}
            hint={categoriasFiltradas.length === 0 && !naoTemCategoria
              ? `Nenhuma categoria de ${form.tipo === 'RECEITA' ? 'entrada' : 'saída'} cadastrada. Crie na aba "Categorias".`
              : null}
          />
          <Select
            size="lg"
            label="Como foi/será pago?"
            value={form.metodoPagamento}
            onChange={(e) => setForm({ ...form, metodoPagamento: e.target.value })}
            placeholder="Selecione..."
            options={METODOS_PAGAMENTO}
          />
          {/* Combobox: busca produto/servico do catalogo, filtrado pela
              categoria selecionada (quando ela existe). Selecionando, preenche
              automaticamente nome + valor (se vazio) + descricao (se vazia). */}
          <Combobox
            size="lg"
            label="Produto ou serviço do catálogo"
            value={form.variacaoId}
            onChange={handleSelecionarCatalogo}
            options={catalogoFiltrado.map((v) => {
              const ehVarPadrao = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
              return {
                value: v.id,
                label: ehVarPadrao ? v.produto?.nome : `${v.produto?.nome} · ${v.nome}`,
                sublabel: [
                  precoEfetivoVar(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                  v.produto?.tipo === 'FISICO' ? `${v.estoqueAtual} em estoque` : null,
                  v.produto?.tipo === 'SERVICO' && v.duracaoMin ? `${v.duracaoMin}min` : null,
                ].filter(Boolean).join(' · '),
                badge: v.produto?.tipo === 'SERVICO' ? 'Serviço' : 'Produto',
              };
            })}
            placeholder={
              catalogo.length === 0 ? 'Catálogo vazio' :
              catalogoFiltrado.length === 0 ? 'Nenhum item nesta categoria' :
              'Buscar produto ou serviço...'
            }
            clearable
            hint={
              form.categoriaId
                ? 'Mostrando só itens da categoria selecionada acima.'
                : 'Selecione uma categoria pra filtrar, ou busque livre.'
            }
          />
          <Input
            size="lg"
            label="Produto (texto livre)"
            value={form.produto}
            onChange={(e) => setForm({ ...form, produto: e.target.value, variacaoId: '' })}
            placeholder="Ex.: Camisa branca M, Corte de cabelo"
            disabled={!!form.variacaoId}
            hint={form.variacaoId ? 'Vinculado ao catálogo' : 'Pra venda avulsa sem cadastro'}
          />
          {form.status === 'PAGO' && (
            <Input
              size="lg"
              label="Quando foi pago?"
              type="date"
              value={form.dataPagamento}
              onChange={(e) => setForm({ ...form, dataPagamento: e.target.value })}
              required
            />
          )}
          {!lanc && (
            <Input
              size="lg"
              label="Dividir em quantas parcelas?"
              type="number"
              min="1"
              max="60"
              value={form.parcelas}
              onChange={(e) => setForm({ ...form, parcelas: e.target.value })}
              hint="1 = não parcelar. 2+ cria várias linhas com vencimento mês a mês."
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{lanc ? 'Salvar' : 'Criar lançamento'}</Button>
        </div>
      </form>
    </Modal>
  );
}

const USOS_CATEGORIA = [
  { value: 'SERVICO', label: 'Serviço (aparece no cadastro de serviços)' },
  { value: 'PRODUTO', label: 'Produto / Estoque (aparece em produtos e vendas)' },
  { value: 'CAIXA', label: 'Caixa (lançamentos avulsos: sangria, suprimento)' },
  { value: 'DESPESA', label: 'Despesa / Contas a pagar' },
];

function ModalCategoria({ isOpen, onClose, cat, onSalvar }) {
  const [form, setForm] = useState({ nome: '', tipo: 'RECEITA', subTipo: '', uso: '' });

  useEffect(() => {
    if (cat) setForm({ nome: cat.nome, tipo: cat.tipo, subTipo: cat.subTipo || '', uso: cat.uso || '' });
    else setForm({ nome: '', tipo: 'RECEITA', subTipo: '', uso: '' });
  }, [cat, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.uso) {
      alert('Escolha onde esta categoria será usada.');
      return;
    }
    // Limpa subTipo se voltar pra RECEITA (consistência com o backend).
    const payload = {
      nome: form.nome,
      tipo: form.tipo,
      uso: form.uso,
      subTipo: form.tipo === 'DESPESA' && form.subTipo ? form.subTipo : null,
    };
    onSalvar(payload);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cat ? 'Editar categoria' : 'Nova categoria'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
        <Select
          label="Onde esta categoria aparece"
          value={form.uso}
          onChange={(e) => setForm({ ...form, uso: e.target.value })}
          options={USOS_CATEGORIA}
          placeholder="Selecione..."
          hint="Define em quais telas esta categoria fica disponível. Relatórios mostram todas."
        />
        <Select
          label="Tipo"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value, subTipo: '' })}
          options={[
            { value: 'RECEITA', label: 'Receita (entrada de dinheiro)' },
            { value: 'DESPESA', label: 'Despesa (saída de dinheiro)' },
          ]}
          placeholder=""
        />
        {form.tipo === 'DESPESA' && (
          <Select
            label="Tipo da despesa"
            value={form.subTipo}
            onChange={(e) => setForm({ ...form, subTipo: e.target.value })}
            options={[
              { value: '', label: 'Não classificar agora' },
              { value: 'FIXA', label: 'Fixa (paga todo mês — aluguel, internet, salário)' },
              { value: 'VARIAVEL', label: 'Variável (muda conforme as vendas — impostos, taxas, comissões)' },
            ]}
            placeholder=""
            hint="Ajuda o relatório de lucro a separar custos que dependem do volume de vendas dos que não dependem."
          />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{cat ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerLancamento({ isOpen, onClose, lanc, onEditar, onExcluir, onStatus, onCobrar, onAdiar, onCancelarComMotivo, onExcluirGrupo }) {
  const [historico, setHistorico] = useState([]);
  const [carregandoHist, setCarregandoHist] = useState(false);

  // Carrega historico de mudancas do lancamento ao abrir.
  useEffect(() => {
    if (!isOpen || !lanc?.id) {
      setHistorico([]);
      return;
    }
    setCarregandoHist(true);
    api.get(`/financeiro/lancamentos/${lanc.id}/historico`)
      .then((r) => setHistorico(r.data?.itens || []))
      .catch(() => setHistorico([]))
      .finally(() => setCarregandoHist(false));
  }, [isOpen, lanc?.id]);

  if (!lanc) return null;
  // Usa statusEfetivo (ATRASADO virtual) quando disponivel.
  const statusReal = lanc.statusEfetivo || lanc.status;
  const status = STATUS_LABELS[statusReal] || { label: statusReal, variant: 'neutral' };
  // Lancamento gerado por venda — backend bloqueia edicao/exclusao/status.
  const ehDeVenda = !!lanc.vendaId;
  const ehImutavel = !!lanc.imutavel;
  const podeCobrar = lanc.tipo === 'RECEITA' && lanc.status !== 'PAGO' && lanc.lead?.telefone && !ehImutavel;
  const podeAdiar = !ehDeVenda && !ehImutavel && lanc.status !== 'PAGO' && lanc.status !== 'CANCELADO';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={lanc.descricao}
      description={lanc.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
      size="md"
      footer={
        ehDeVenda ? (
          <div className="text-[11px] text-[var(--text-muted)] text-center w-full">
            Lançamento de venda · gerenciado pelo módulo Vendas
          </div>
        ) : ehImutavel ? (
          <div className="text-[11px] text-[var(--text-muted)] text-center w-full flex items-center justify-center gap-1.5">
            <Lock size={11} /> Mês fechado · só leitura
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir</Button>
            <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar</Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        <div className="text-center py-4">
          {/* Cancelado: tira sinal +/-, cor cinza e tachado pra deixar claro
              que nao e movimento ativo no caixa. */}
          <div className={`text-4xl font-semibold tracking-tight tabular-nums ${
            lanc.status === 'CANCELADO' ? 'text-[var(--text-muted)] line-through' :
            lanc.tipo === 'RECEITA' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          }`}>
            {lanc.status === 'CANCELADO'
              ? fmtBRL(lanc.valor)
              : `${lanc.tipo === 'RECEITA' ? '+' : '-'} ${fmtBRL(lanc.valor)}`}
          </div>
          <div className="mt-2">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>

        {ehDeVenda && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--info-soft)] border border-[var(--info)]/30">
            <ShoppingCart className="w-5 h-5 flex-shrink-0 text-[var(--info)] mt-0.5" />
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-main)]">Este lançamento veio de uma venda.</strong>
              {' '}Pra alterar valor ou cancelar, vá em <strong>Vendas</strong> e cancele a venda — isso reverte estoque e este lançamento juntos. <Lock size={11} className="inline -mt-0.5" />
            </div>
          </div>
        )}

        {ehImutavel && !ehDeVenda && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
            <Lock size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong>Mês fechado — só leitura.</strong> Lançamento pago em mês anterior é imutável pra preservar relatórios. Pra ajustar, crie um lançamento compensatório no mês atual.
            </div>
          </div>
        )}

        {/* Acoes rapidas: Cobrar (manda WhatsApp) e Adiar vencimento.
            So aparecem quando fazem sentido (receita pendente com telefone / nao venda). */}
        {(podeCobrar || podeAdiar) && (
          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">Ações rápidas</div>
            <div className="grid grid-cols-2 gap-2">
              {podeCobrar && (
                <Button variant="secondary" size="sm" icon={MessageCircle} onClick={onCobrar}>
                  Cobrar via WhatsApp
                </Button>
              )}
              {podeAdiar && (
                <Dropdown
                  trigger={
                    <Button variant="secondary" size="sm" icon={CalendarClock} fullWidth>
                      Adiar vencimento
                    </Button>
                  }
                >
                  <DropdownItem onClick={() => onAdiar(3)}>+3 dias</DropdownItem>
                  <DropdownItem onClick={() => onAdiar(7)}>+7 dias (1 semana)</DropdownItem>
                  <DropdownItem onClick={() => onAdiar(15)}>+15 dias</DropdownItem>
                  <DropdownItem onClick={() => onAdiar(30)}>+30 dias (1 mês)</DropdownItem>
                </Dropdown>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Vencimento" valor={new Date(lanc.dataVencimento).toLocaleDateString('pt-BR')} />
          <InfoBox label="Pagamento" valor={lanc.dataPagamento ? new Date(lanc.dataPagamento).toLocaleDateString('pt-BR') : '—'} />
          <InfoBox label="Categoria" valor={lanc.categoria?.nome || '—'} />
          <InfoBox label="Método" valor={lanc.metodoPagamento || '—'} />
          {lanc.produto && <InfoBox label="Produto" valor={lanc.produto} />}
          {/* Lead com hyperlink — leva pro CRM filtrando pelo nome do lead. */}
          {lanc.lead?.nome ? (
            <Link
              to="/app/crm"
              className="block p-3 rounded-xl bg-[var(--bg-subtle)] hover:bg-[var(--bg-subtle)] hover:brightness-95 transition-all group"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Lead</div>
              <div className="text-sm font-medium text-[var(--text-main)] mt-0.5 flex items-center gap-1.5">
                <span className="truncate">{lanc.lead.nome}</span>
                <ExternalLink size={12} className="flex-shrink-0 opacity-50 group-hover:opacity-100" />
              </div>
            </Link>
          ) : (
            <InfoBox label="Lead" valor="—" />
          )}
        </div>

        {!ehDeVenda && !ehImutavel && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Mudar status</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={lanc.status === 'PAGO' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('PAGO')}>Pago</Button>
              <Button variant={lanc.status === 'PENDENTE' ? 'primary' : 'secondary'} size="sm" onClick={() => onStatus('PENDENTE')}>Pendente</Button>
              {/* 'Atrasado' nao e mais um status manual — e calculado automaticamente
                  pelo backend quando vencimento < hoje + status PENDENTE. Removido daqui. */}
              {/* Cancelar agora abre modal pedindo motivo (preserva auditoria).
                  Se ja esta cancelado, mostra como ativo + permite reabrir pra PENDENTE. */}
              {lanc.status === 'CANCELADO' ? (
                <Button variant="danger" size="sm" icon={XCircle} onClick={() => onStatus('PENDENTE')}>Reabrir</Button>
              ) : (
                <Button variant="secondary" size="sm" icon={XCircle} onClick={onCancelarComMotivo}>Cancelar...</Button>
              )}
            </div>

            {/* Mostra o motivo do cancelamento quando aplicavel */}
            {lanc.status === 'CANCELADO' && lanc.motivoCancelamento && (
              <div className="mt-3 p-3 rounded-xl bg-[var(--danger-soft)] text-[var(--danger-text)] text-xs leading-relaxed">
                <strong>Motivo do cancelamento:</strong> {lanc.motivoCancelamento}
              </div>
            )}

            {/* Excluir grupo de parcelas — so visivel quando o lancamento e parte de um agrupamento */}
            {lanc.idAgrupamento && (
              <Button
                variant="danger-soft"
                size="sm"
                icon={Trash2}
                onClick={onExcluirGrupo}
                className="mt-3"
                fullWidth
              >
                Excluir todas parcelas em aberto
              </Button>
            )}
          </div>
        )}

        {/* Historico de alteracoes — auditoria. Sempre visivel, ate em imutaveis. */}
        <HistoricoLancamento itens={historico} carregando={carregandoHist} />
      </div>
    </Drawer>
  );
}

// =====================================================================
// HISTORICO DE LANCAMENTO
// =====================================================================
// Timeline de mudancas: CRIADO, EDITADO, STATUS_MUDADO, CANCELADO, EXCLUIDO,
// ADIADO. Cada item mostra quem fez, quando e o diff campo a campo.
const ACAO_LANC_CFG = {
  CRIADO:        { label: 'Criado',         cor: 'success' },
  EDITADO:       { label: 'Editado',        cor: 'info' },
  STATUS_MUDADO: { label: 'Mudou status',   cor: 'warning' },
  CANCELADO:     { label: 'Cancelado',      cor: 'danger' },
  EXCLUIDO:      { label: 'Excluído',       cor: 'danger' },
  ADIADO:        { label: 'Adiado',         cor: 'info' },
};

const CAMPOS_LANC_LABEL = {
  descricao: 'Descrição', valor: 'Valor', tipo: 'Tipo',
  dataVencimento: 'Vencimento', categoriaId: 'Categoria',
  leadId: 'Lead', produto: 'Produto', metodoPagamento: 'Pagamento',
  status: 'Status', motivo: 'Motivo', dias: 'Dias adiados',
};

function fmtValorLanc(campo, v) {
  if (v == null || v === '') return '—';
  if (campo === 'valor') return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (campo === 'dataVencimento') return new Date(v).toLocaleDateString('pt-BR');
  if (campo === 'status') return STATUS_LABELS[v]?.label || v;
  return String(v);
}

function HistoricoLancamento({ itens, carregando }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <History size={14} className="text-[var(--text-muted)]" />
        <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
          Histórico de alterações
        </div>
      </div>
      {carregando ? (
        <div className="text-xs text-[var(--text-muted)] italic py-2">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] italic py-2">Sem alterações registradas.</div>
      ) : (
        <div className="space-y-2">
          {itens.map((h) => {
            const cfg = ACAO_LANC_CFG[h.acao] || { label: h.acao, cor: 'neutral' };
            const data = new Date(h.criadoEm);
            const quemFez = h.usuarioNome || 'Sistema';
            return (
              <div key={h.id} className="border border-[var(--border-subtle)] rounded-lg p-2.5 bg-[var(--bg-card)]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={cfg.cor} size="sm">{cfg.label}</Badge>
                    <span className="text-[11px] text-[var(--text-secondary)] font-medium truncate">{quemFez}</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums flex-shrink-0">
                    {data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                    {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {h.alteracoes && <DiffLanc alteracoes={h.alteracoes} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiffLanc({ alteracoes }) {
  // CRIADO/EXCLUIDO: tem snapshot — mostra so os valores
  if (alteracoes.snapshot) {
    const snap = alteracoes.snapshot;
    return (
      <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5 mt-1">
        {Object.entries(snap)
          .filter(([_, v]) => v != null && v !== '')
          .slice(0, 4)
          .map(([campo, v]) => (
            <div key={campo}>
              <span className="text-[var(--text-muted)]">{CAMPOS_LANC_LABEL[campo] || campo}:</span>{' '}
              <span className="font-medium">{fmtValorLanc(campo, v)}</span>
            </div>
          ))}
      </div>
    );
  }
  // Diff campo a campo
  return (
    <div className="text-[11px] space-y-0.5 mt-1">
      {Object.entries(alteracoes).map(([campo, val]) => {
        // Caso especial: { de, para }
        if (val && typeof val === 'object' && 'de' in val && 'para' in val) {
          return (
            <div key={campo}>
              <span className="text-[var(--text-muted)]">{CAMPOS_LANC_LABEL[campo] || campo}:</span>{' '}
              <span className="line-through text-[var(--text-secondary)] opacity-70">{fmtValorLanc(campo, val.de)}</span>
              {' → '}
              <span className="font-semibold text-[var(--text-main)]">{fmtValorLanc(campo, val.para)}</span>
            </div>
          );
        }
        // Outros (motivo, dias, etc.)
        return (
          <div key={campo}>
            <span className="text-[var(--text-muted)]">{CAMPOS_LANC_LABEL[campo] || campo}:</span>{' '}
            <span className="font-medium">{String(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

function InfoBox({ label, valor }) {
  return (
    <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-main)] mt-0.5">{valor}</div>
    </div>
  );
}

// =====================================================================
// TELA DE CAIXA
// =====================================================================
// Mostra saldo atual em destaque + historico completo de ajustes manuais.
// Cada ajuste registra o novo valor + motivo + data. O delta (variacao em
// relacao ao ajuste anterior) e calculado aqui pra UX clara.
// =====================================================================
// TELA DO CAIXA
// =====================================================================
// 2 estados:
//   1. Sem caixa aberto: empty state com botao "Abrir caixa"
//   2. Com caixa aberto: hero com saldo esperado + info da sessao
// Histórico de sessões fechadas sempre visivel embaixo.
function CaixaTela({ sessao, sessoesFechadas, onAbrir }) {
  return (
    <div className="space-y-4">
      {/* Estado: sem caixa aberto */}
      {!sessao && (
        <Card padding="lg">
          <EmptyState
            icon={Wallet}
            title="Caixa fechado"
            description="Abra o caixa pra começar a registrar vendas manuais. Informe o fundo de caixa (dinheiro inicial pra troco) e a abertura fica registrada com seu nome."
            action={
              <Button variant="primary" icon={Wallet} onClick={onAbrir}>
                Abrir caixa
              </Button>
            }
          />
        </Card>
      )}

      {/* Estado: caixa aberto */}
      {sessao && (
        <>
          {/* Hero compacto */}
          <Card padding="md">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--success-soft)] text-[var(--success)] flex items-center justify-center flex-shrink-0">
                <Wallet size={18} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Saldo esperado no caixa
                  </div>
                  <Badge variant="success" size="sm">Aberto</Badge>
                  {sessao.origem === 'AUTO_BOT' && (
                    <Badge variant="neutral" size="sm">Auto-bot</Badge>
                  )}
                </div>
                <div className="text-2xl font-semibold tracking-tight text-[var(--text-main)] tabular-nums">
                  {fmtBRL(sessao.saldoEsperado ?? sessao.fundoCaixa ?? 0)}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-1">
                  Aberto em <strong>{new Date(sessao.abertaEm).toLocaleString('pt-BR')}</strong>
                  {sessao.usuarioAbriuNome && <> · por <strong>{sessao.usuarioAbriuNome}</strong></>}
                  {' · fundo: '}{fmtBRL(sessao.fundoCaixa || 0)}
                </div>
              </div>
            </div>
          </Card>

        </>
      )}

      {/* Historico de sessoes fechadas */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <div className="text-sm font-semibold text-[var(--text-main)]">Sessões anteriores</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {sessoesFechadas.length} {sessoesFechadas.length === 1 ? 'sessão fechada' : 'sessões fechadas'}
          </div>
        </div>
        {sessoesFechadas.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhuma sessão fechada ainda"
            description="O histórico aparece aqui quando você fechar a 1ª sessão."
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {sessoesFechadas.map((s) => {
              const dif = s.diferenca ?? 0;
              const corDif = dif === 0 ? 'text-[var(--text-muted)]' : dif > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]';
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--bg-subtle)]/50">
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center flex-shrink-0">
                    <Lock size={12} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-main)] tabular-nums">
                        {fmtBRL(s.saldoFinalReal ?? 0)}
                      </span>
                      {s.origem === 'AUTO_BOT' && <Badge variant="neutral" size="sm">Auto</Badge>}
                      <span className={`text-[11px] font-medium tabular-nums ${corDif}`}>
                        {dif === 0 ? 'bateu' : `${dif > 0 ? '+' : ''}${fmtBRL(dif)}`}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Fundo {fmtBRL(s.fundoCaixa || 0)} · Esperado {fmtBRL(s.saldoFinalEsperado ?? 0)}
                      {s.usuarioFechouNome && <> · fechou {s.usuarioFechouNome}</>}
                    </div>
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums flex-shrink-0 text-right">
                    <div>{new Date(s.abertaEm).toLocaleDateString('pt-BR')}</div>
                    {s.fechadaEm && (
                      <div className="opacity-70">
                        → {new Date(s.fechadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// =====================================================================
// MODAL DE ABRIR CAIXA
// =====================================================================
// Inicia uma sessao MANUAL. Fundo de caixa = dinheiro inicial pro troco.
// Backend fecha automaticamente qualquer sessao AUTO_BOT que esteja aberta.
function ModalAbrirCaixa({ isOpen, onClose, onConfirmar }) {
  const [fundoCaixa, setFundoCaixa] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFundoCaixa('');
      setObservacao('');
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = parseFloat(fundoCaixa);
    if (Number.isNaN(v) || v < 0) {
      alert('Fundo de caixa precisa ser um número ≥ 0.');
      return;
    }
    onConfirmar({ fundoCaixa: v, observacao: observacao.trim() || null });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Abrir caixa" description="Informe o dinheiro inicial no caixa físico (troco)." size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)]">
          <Wallet size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Fundo de caixa</strong> é o dinheiro físico que você deixa no caixa pra dar troco no início do expediente. Pode ser <strong>R$ 0</strong> se você não usa.
          </div>
        </div>

        <Input
          label="Fundo de caixa (R$)"
          type="number"
          step="0.01"
          min="0"
          value={fundoCaixa}
          onChange={(e) => setFundoCaixa(e.target.value)}
          placeholder="Ex.: 100.00"
          autoFocus
          required
        />

        <Textarea
          label="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          placeholder="Algo que vale anotar sobre a abertura..."
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" icon={Wallet}>Abrir caixa</Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL DE FECHAR CAIXA
// =====================================================================
// Pede o saldo real contado fisicamente. Sistema calcula diferenca vs
// esperado. Diferenca != 0 nao impede fechar — fica registrada.
function ModalFecharCaixa({ isOpen, onClose, sessao, onConfirmar }) {
  const [saldoReal, setSaldoReal] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Pre-preenche com esperado pra facilitar quando bate certinho
      setSaldoReal(sessao?.saldoEsperado != null ? String(sessao.saldoEsperado) : '');
      setObservacao('');
    }
  }, [isOpen, sessao?.saldoEsperado]);

  if (!sessao) return null;

  const saldoEsperado = sessao.saldoEsperado ?? sessao.fundoCaixa ?? 0;
  const saldoRealNum = parseFloat(saldoReal);
  const diferenca = !Number.isNaN(saldoRealNum) ? Number((saldoRealNum - saldoEsperado).toFixed(2)) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number.isNaN(saldoRealNum)) {
      alert('Informe o saldo real contado no caixa.');
      return;
    }
    onConfirmar({ saldoFinalReal: saldoRealNum, observacao: observacao.trim() || null });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fechar caixa" description="Conte o dinheiro físico do caixa e informe abaixo." size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[var(--bg-subtle)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Esperado</div>
            <div className="text-base font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(saldoEsperado)}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--bg-subtle)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Fundo</div>
            <div className="text-base font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(sessao.fundoCaixa || 0)}</div>
          </div>
        </div>

        <Input
          label="Saldo real contado no caixa (R$)"
          type="number"
          step="0.01"
          value={saldoReal}
          onChange={(e) => setSaldoReal(e.target.value)}
          placeholder="Conte o dinheiro físico"
          autoFocus
          required
          hint={
            diferenca === null
              ? 'O sistema vai calcular a diferença automaticamente.'
              : diferenca === 0
                ? '✓ Bateu certinho.'
                : diferenca > 0
                  ? `Sobra de ${fmtBRL(diferenca)} (entrada não registrada).`
                  : `Falta de ${fmtBRL(Math.abs(diferenca))} (saída ou divergência).`
          }
        />

        <Textarea
          label="Observação (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          placeholder="Anote algo se a diferença tiver explicação..."
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" icon={Lock}>Fechar caixa</Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// LISTA DE CONTAS A PAGAR
// =====================================================================
function ListaContasPagar({ contas, carregando, podeCriar = true, podeEditar = true, podeExcluir = true, onNova, onEditar, onExcluir, onAtivar, onPagar }) {
  if (carregando) {
    return <Card padding="lg"><div className="text-center text-sm text-[var(--text-muted)] py-12">Carregando...</div></Card>;
  }
  if (!contas || contas.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={DollarSign}
          title="Nenhuma conta cadastrada"
          description={podeCriar
            ? 'Cadastre suas despesas recorrentes (aluguel, internet, fornecedor) pra pagar com 1 clique pelo caixa.'
            : 'Ainda não há contas cadastradas. Peça ao dono da conta ou administrador para cadastrar.'}
          action={podeCriar ? <Button variant="primary" icon={Plus} onClick={onNova}>Nova conta a pagar</Button> : null}
        />
      </Card>
    );
  }

  const PERIODICIDADES = { PONTUAL: 'Pontual', MENSAL: 'Mensal', ANUAL: 'Anual' };

  return (
    <Card padding="none">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-main)]">
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Nome</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Categoria</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Periodicidade</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Vencimento</th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor padrão</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {contas.map((c) => (
            <tr key={c.id} className={`border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-subtle)]/30 transition-colors ${!c.ativa ? 'opacity-50' : ''}`}>
              <td className="py-3 px-5">
                <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</div>
                {c.observacoes && <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate max-w-xs">{c.observacoes}</div>}
              </td>
              <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">{c.categoria?.nome || '—'}</td>
              <td className="py-3 px-5 text-xs">
                <Badge variant="neutral" size="sm">{PERIODICIDADES[c.periodicidade] || c.periodicidade}</Badge>
              </td>
              <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">
                {c.diaVencimento ? `Dia ${c.diaVencimento}${c.mesVencimento ? `/${String(c.mesVencimento).padStart(2, '0')}` : ''}` : '—'}
              </td>
              <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--text-main)]">
                {Number(c.valorPadrao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="py-3 px-5 text-xs">
                <Badge variant={c.ativa ? 'success' : 'neutral'} size="sm">{c.ativa ? 'Ativa' : 'Inativa'}</Badge>
              </td>
              <td className="py-3 px-2">
                {(podeEditar || podeExcluir) && (
                  <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Ações" />}>
                    {c.ativa && podeEditar && (
                      <DropdownItem icon={DollarSign} onClick={() => onPagar(c)}>Pagar agora</DropdownItem>
                    )}
                    {podeEditar && (
                      <DropdownItem icon={Edit2} onClick={() => onEditar(c)}>Editar</DropdownItem>
                    )}
                    {podeEditar && (
                      <DropdownItem icon={c.ativa ? Lock : Plus} onClick={() => onAtivar(c)}>
                        {c.ativa ? 'Desativar' : 'Reativar'}
                      </DropdownItem>
                    )}
                    {podeExcluir && (
                      <>
                        <DropdownDivider />
                        <DropdownItem icon={Trash2} variant="danger" onClick={() => onExcluir(c)}>Excluir</DropdownItem>
                      </>
                    )}
                  </Dropdown>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

// =====================================================================
// MODAL: cadastrar/editar Conta a Pagar
// =====================================================================
function ModalContaPagar({ isOpen, onClose, conta, categorias, onSalvar }) {
  const ehEdicao = !!conta?.id;
  const [form, setForm] = useState({
    nome: '',
    valorPadrao: '',
    categoriaId: '',
    periodicidade: 'MENSAL',
    diaVencimento: '',
    mesVencimento: '',
    observacoes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setForm({
        nome: conta?.nome || '',
        valorPadrao: conta?.valorPadrao ?? '',
        categoriaId: conta?.categoriaId || '',
        periodicidade: conta?.periodicidade || 'MENSAL',
        diaVencimento: conta?.diaVencimento ?? '',
        mesVencimento: conta?.mesVencimento ?? '',
        observacoes: conta?.observacoes || '',
      });
    }
  }, [isOpen, conta]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const valor = parseFloat(form.valorPadrao);
    if (!form.nome.trim() || Number.isNaN(valor) || valor < 0) {
      alert('Preencha nome e valor padrão corretamente.');
      return;
    }
    const dados = {
      nome: form.nome.trim(),
      valorPadrao: valor,
      categoriaId: form.categoriaId || null,
      periodicidade: form.periodicidade,
      diaVencimento: form.diaVencimento ? parseInt(form.diaVencimento, 10) : null,
      mesVencimento: form.periodicidade === 'ANUAL' && form.mesVencimento
        ? parseInt(form.mesVencimento, 10) : null,
      observacoes: form.observacoes.trim() || null,
    };
    if (ehEdicao) dados.id = conta.id;
    onSalvar(dados);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ehEdicao ? 'Editar conta a pagar' : 'Nova conta a pagar'} description="Despesas recorrentes ou pontuais que você precisa pagar." size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input size="lg" label="Nome da conta" placeholder="Ex.: Aluguel, Internet, Fornecedor X" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input size="lg" type="number" step="0.01" min="0" label="Valor padrão (R$)" value={form.valorPadrao} onChange={(e) => setForm({ ...form, valorPadrao: e.target.value })} hint="Valor sugerido. Você pode editar na hora do pagamento." required />
          <Select size="lg" label="Categoria (despesa)" value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} placeholder="Sem categoria" options={categorias.map((c) => ({ value: c.id, label: c.nome }))} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select size="lg" label="Periodicidade" value={form.periodicidade} onChange={(e) => setForm({ ...form, periodicidade: e.target.value })} placeholder="" options={[
            { value: 'PONTUAL', label: 'Pontual (uma vez)' },
            { value: 'MENSAL', label: 'Mensal' },
            { value: 'ANUAL', label: 'Anual' },
          ]} />
          <Input size="lg" type="number" min="1" max="31" label="Dia do vencimento" placeholder="1-31" value={form.diaVencimento} onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })} hint="Opcional. Útil pra lembrar." />
          {form.periodicidade === 'ANUAL' && (
            <Input size="lg" type="number" min="1" max="12" label="Mês do vencimento" placeholder="1-12" value={form.mesVencimento} onChange={(e) => setForm({ ...form, mesVencimento: e.target.value })} />
          )}
        </div>

        <Textarea size="lg" label="Observações" rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Anotações sobre essa conta (opcional)" />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">{ehEdicao ? 'Salvar alterações' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL: pagar Conta a Pagar
// =====================================================================
// Aceita conta pre-selecionada (vindo da lista) ou abre combobox de contas
// ativas (vindo do header do caixa). Valor herda do valorPadrao mas e editavel.
function ModalPagarConta({ isOpen, onClose, contaSelecionada, contas, sessaoCaixaAberta, onConfirmar }) {
  const [contaId, setContaId] = useState('');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tirarDoCaixa, setTirarDoCaixa] = useState(true);

  const conta = contaSelecionada || contas.find((c) => c.id === contaId);

  useEffect(() => {
    if (isOpen) {
      if (contaSelecionada) {
        setContaId(contaSelecionada.id);
        setValor(String(contaSelecionada.valorPadrao || ''));
      } else {
        setContaId('');
        setValor('');
      }
      setMotivo('');
      setTirarDoCaixa(true);
    }
  }, [isOpen, contaSelecionada]);

  // Quando troca a conta no combobox, preenche valor automaticamente.
  useEffect(() => {
    if (!contaSelecionada && contaId) {
      const c = contas.find((x) => x.id === contaId);
      if (c) setValor(String(c.valorPadrao || ''));
    }
  }, [contaId, contas, contaSelecionada]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = parseFloat(valor);
    if (!conta || Number.isNaN(v) || v <= 0) {
      alert('Selecione a conta e informe um valor > 0.');
      return;
    }
    // Passa a conta resolvida (pré-selecionada ou escolhida no combobox)
    // pra o handler do pai não precisar adivinhar.
    onConfirmar({ conta, valor: v, motivo: motivo.trim() || undefined, tirarDoCaixa });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pagar conta" description="Cria um lançamento de despesa pago e, opcionalmente, retira do caixa." size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!contaSelecionada && (
          <Select
            size="lg"
            label="Qual conta está pagando?"
            value={contaId}
            onChange={(e) => setContaId(e.target.value)}
            placeholder="Selecione a conta..."
            options={contas.map((c) => ({
              value: c.id,
              label: `${c.nome} (${Number(c.valorPadrao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`,
            }))}
            required
          />
        )}

        {conta && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-subtle)]/60">
            <DollarSign size={16} strokeWidth={2} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <div className="font-semibold text-[var(--text-main)]">{conta.nome}</div>
              {conta.categoria && <div className="text-[var(--text-muted)]">Categoria: {conta.categoria.nome}</div>}
              <div className="text-[var(--text-muted)]">Valor sugerido: <strong className="text-[var(--text-main)]">{Number(conta.valorPadrao || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
            </div>
          </div>
        )}

        <Input
          size="lg"
          type="number"
          step="0.01"
          min="0.01"
          label="Quanto está pagando? (R$)"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          hint="Pode editar pra cima ou pra baixo do valor padrão"
          required
        />

        <Textarea
          size="lg"
          label="Observação (opcional)"
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: Pago em dinheiro, recibo nº 123"
        />

        {/* Toggle: tirar do caixa ou não */}
        <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${tirarDoCaixa ? 'border-[var(--text-main)] bg-[var(--bg-subtle)]' : 'border-[var(--border-main)]'}`}>
          <input
            type="checkbox"
            checked={tirarDoCaixa}
            onChange={(e) => setTirarDoCaixa(e.target.checked)}
            className="mt-0.5"
          />
          <div className="text-xs leading-relaxed">
            <div className="font-semibold text-[var(--text-main)]">Pagar com dinheiro do caixa (retirada)</div>
            <div className="text-[var(--text-muted)] mt-0.5">
              {tirarDoCaixa
                ? 'Vai criar uma retirada no caixa + o lançamento de despesa. Exige caixa aberto.'
                : 'Só cria o lançamento de despesa. Use quando pagou direto do banco (PIX, boleto debitado).'}
            </div>
          </div>
        </label>

        {tirarDoCaixa && !sessaoCaixaAberta && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
            <AlertCircle size={14} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              Você precisa abrir o caixa antes de tirar dinheiro dele. Vá em <strong>Caixa → Abrir caixa</strong>, ou desmarque a opção acima pra registrar como pagamento via banco.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={tirarDoCaixa && !sessaoCaixaAberta}>Confirmar pagamento</Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL DE RETIRADA / ENTRADA
// =====================================================================
// 1 modal compartilhado com tipo dinamico. SANGRIA (backend) = retirada (UI);
// SUPRIMENTO (backend) = entrada (UI). Motivo obrigatorio (>=3 chars).
function ModalMovimentacaoCaixa({ isOpen, tipo, onClose, onConfirmar }) {
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValor('');
      setMotivo('');
    }
  }, [isOpen]);

  if (!tipo) return null;

  const ehSangria = tipo === 'SANGRIA';
  const motivoValido = motivo.trim().length >= 3;

  const handleSubmit = (e) => {
    e.preventDefault();
    const v = parseFloat(valor);
    if (Number.isNaN(v) || v <= 0) {
      alert('Valor precisa ser > 0.');
      return;
    }
    if (!motivoValido) return;
    onConfirmar({ valor: v, motivo: motivo.trim() });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ehSangria ? 'Registrar retirada do caixa' : 'Registrar entrada no caixa'}
      description={ehSangria ? 'Tire dinheiro do caixa (ex.: depósito no banco).' : 'Coloque dinheiro no caixa (ex.: reforço de troco).'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={`flex items-start gap-3 p-3 rounded-xl ${
          ehSangria
            ? 'bg-[var(--warning-soft)] text-[var(--warning-text)]'
            : 'bg-[var(--success-soft)] text-[var(--success-text)]'
        }`}>
          {ehSangria
            ? <ArrowUpFromLine size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            : <ArrowDownToLine size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />}
          <div className="text-xs leading-relaxed">
            <strong>{ehSangria ? 'Retirada' : 'Entrada'}:</strong>{' '}
            {ehSangria
              ? 'reduz o saldo do caixa. Exemplo comum: tirar dinheiro para depositar no banco.'
              : 'aumenta o saldo do caixa. Exemplo: colocar mais notas para dar troco.'}
          </div>
        </div>

        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
          required
        />

        <Textarea
          label="Motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder={ehSangria ? 'Ex.: Depósito no banco, retirada do sócio...' : 'Ex.: Reforço de troco, devolução em dinheiro...'}
          required
          hint={motivoValido ? '✓ Motivo válido' : 'Mínimo 3 caracteres.'}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={!motivoValido}>
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL DE CANCELAMENTO COM MOTIVO
// =====================================================================
// Soft-cancel: muda status pra CANCELADO + grava motivo + dataCancelamento.
// Diferente do excluir (hard-delete) — o registro fica no banco pra
// auditoria/historico. Pra reverter, basta abrir o lancamento e marcar
// pendente de novo no drawer.
function ModalCancelar({ isOpen, onClose, lanc, onConfirmar }) {
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (isOpen) setMotivo('');
  }, [isOpen]);

  if (!lanc) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!motivo.trim()) {
      alert('Explique o motivo do cancelamento pra rastrear depois.');
      return;
    }
    onConfirmar(motivo.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancelar lançamento"
      description={`"${lanc.descricao}" será marcado como cancelado, mas continua no histórico.`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--warning-soft)] text-[var(--warning-text)]">
          <AlertCircle size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Cancelamento diferente de exclusão.</strong> O lançamento fica no banco com status "Cancelado" e o motivo abaixo — útil pra entender o histórico depois.
          </div>
        </div>

        <Textarea
          label="Por que está cancelando?"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          placeholder="Ex.: Cliente desistiu, valor lançado errado, duplicado..."
          autoFocus
          required
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Voltar</Button>
          <Button variant="danger" type="submit" icon={XCircle}>Confirmar cancelamento</Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
// MODAL DE COBRANCA VIA WHATSAPP
// =====================================================================
// Abre antes do wa.me pra usuario revisar/editar a mensagem. Backend manda
// template padrao com variaveis ja substituidas + lista de variaveis (caso
// usuario queira reescrever do zero usando placeholders {nome}, {valor}, etc).
function ModalCobranca({ isOpen, onClose, dados, onEnviar }) {
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (isOpen && dados?.mensagemPadrao) {
      setMensagem(dados.mensagemPadrao);
    }
  }, [isOpen, dados]);

  if (!dados) return null;

  const lanc = dados.lanc;
  const variaveis = dados.variaveis || {};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!mensagem.trim()) {
      alert('A mensagem não pode estar vazia.');
      return;
    }
    // Substitui placeholders {var} caso o usuario tenha digitado.
    const final = mensagem.replace(/\{(\w+)\}/g, (_, chave) => variaveis[chave] ?? `{${chave}}`);
    onEnviar(final);
  };

  // Insere placeholder no cursor — UX util pra usuario reusar variavel.
  const inserirVariavel = (chave) => {
    setMensagem((m) => `${m}${m.endsWith(' ') || m === '' ? '' : ' '}{${chave}}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cobrar via WhatsApp"
      description={lanc?.lead?.nome ? `Mensagem pra ${lanc.lead.nome}` : 'Revise antes de enviar.'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)]">
          <MessageCircle size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong>Edite à vontade.</strong> Você pode reescrever a mensagem ou usar variáveis tipo <code className="px-1 rounded bg-[var(--bg-card)]/50">{'{nome}'}</code> que serão substituídas automaticamente ao enviar.
          </div>
        </div>

        <Textarea
          size="lg"
          label="Mensagem"
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          rows={6}
          autoFocus
        />

        {/* Variaveis disponiveis — clicaveis pra inserir no cursor */}
        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">
            Variáveis disponíveis (clique pra inserir)
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(variaveis).map(([chave, valor]) => (
              <button
                key={chave}
                type="button"
                onClick={() => inserirVariavel(chave)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] hover:border-[var(--text-muted)] transition-colors text-left"
                title={`Sera substituido por: ${valor}`}
              >
                <span className="text-[var(--text-secondary)]">{'{'}{chave}{'}'}</span>
                <span className="text-[var(--text-muted)] ml-1">→ {valor}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-2 pt-2">
          <div className="text-[11px] text-[var(--text-muted)]">
            Envia pelo telefone: <strong>{dados.telefone}</strong>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" icon={MessageCircle}>
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
