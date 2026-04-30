import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Plus, MoreHorizontal,
  Edit2, Trash2, CheckCircle2, XCircle, Tag, Filter, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';
import api from '../services/api';
import {
  Card, CardHeader, CardTitle, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider, useToast,
  Tabs, TabsList, TabsTrigger, TabsContent
} from '../components/ui';
import Modal from '../components/Modal';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABELS = {
  PENDENTE: { label: 'Pendente', variant: 'warning' },
  PAGO: { label: 'Pago', variant: 'success' },
  ATRASADO: { label: 'Atrasado', variant: 'danger' },
  CANCELADO: { label: 'Cancelado', variant: 'neutral' },
};

export default function FinanceiroPage() {
  const toast = useToast();
  const [tab, setTab] = useState('lancamentos');
  const [resumo, setResumo] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [modalLanc, setModalLanc] = useState({ open: false, data: null });
  const [modalCat, setModalCat] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, lanc: null });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo, filtroStatus, busca]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroTipo) params.set('tipo', filtroTipo);
      if (filtroStatus) params.set('status', filtroStatus);
      if (busca) params.set('buscar', busca);
      params.set('limite', '100');

      const [r, l, c] = await Promise.all([
        api.get('/financeiro/resumo').catch(() => ({ data: null })),
        api.get(`/financeiro/lancamentos?${params}`).catch(() => ({ data: { dados: [] } })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
      ]);
      setResumo(r.data);
      setLancamentos(l.data?.dados || l.data || []);
      setCategorias(c.data || []);
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

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={ArrowDownToLine}
          label="Receitas (pago)"
          valor={fmtBRL(resumo?.totalReceitas || 0)}
          tone="success"
        />
        <Kpi
          icon={ArrowUpFromLine}
          label="Despesas (pago)"
          valor={fmtBRL(resumo?.totalDespesas || 0)}
          tone="danger"
        />
        <Kpi
          icon={DollarSign}
          label="Saldo"
          valor={fmtBRL((resumo?.totalReceitas || 0) - (resumo?.totalDespesas || 0))}
          accent
        />
        <Kpi
          icon={AlertCircle}
          label="A receber pendente"
          valor={fmtBRL(resumo?.aReceber || 0)}
          tone="warning"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList variant="pills">
            <TabsTrigger value="lancamentos" variant="pills">Lancamentos</TabsTrigger>
            <TabsTrigger value="categorias" variant="pills">Categorias ({categorias.length})</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {tab === 'lancamentos' && (
              <Button variant="primary" icon={Plus} onClick={() => setModalLanc({ open: true, data: null })}>
                Novo lancamento
              </Button>
            )}
            {tab === 'categorias' && (
              <Button variant="primary" icon={Plus} onClick={() => setModalCat({ open: true, data: null })}>
                Nova categoria
              </Button>
            )}
          </div>
        </div>

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
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Descricao</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Categoria</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Vencimento</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map((l) => {
                    const status = STATUS_LABELS[l.status] || { label: l.status, variant: 'neutral' };
                    return (
                      <tr
                        key={l.id}
                        onClick={() => setDrawer({ open: true, lanc: l })}
                        className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-8 rounded-full ${l.tipo === 'RECEITA' ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                            <div>
                              <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{l.descricao}</div>
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
                          l.tipo === 'RECEITA' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                        }`}>
                          {l.tipo === 'RECEITA' ? '+' : '-'} {fmtBRL(l.valor)}
                        </td>
                        <td className="py-3 px-5">
                          <Badge variant={status.variant} size="sm">{status.label}</Badge>
                        </td>
                        <td onClick={(e) => e.stopPropagation()} className="py-3 px-3">
                          <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                            <DropdownItem icon={Edit2} onClick={() => setModalLanc({ open: true, data: l })}>Editar</DropdownItem>
                            {l.status !== 'PAGO' && (
                              <DropdownItem icon={CheckCircle2} onClick={() => handleStatus(l, 'PAGO')}>Marcar como pago</DropdownItem>
                            )}
                            {l.status !== 'CANCELADO' && (
                              <DropdownItem icon={XCircle} onClick={() => handleStatus(l, 'CANCELADO')}>Cancelar</DropdownItem>
                            )}
                            <DropdownDivider />
                            <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(l)}>Excluir</DropdownItem>
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
                        <Badge variant={c.tipo === 'RECEITA' ? 'success' : 'danger'} size="sm">
                          {c.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                        </Badge>
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
      </Tabs>

      <ModalLancamento
        isOpen={modalLanc.open}
        onClose={() => setModalLanc({ open: false, data: null })}
        lanc={modalLanc.data}
        categorias={categorias}
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
      />
    </div>
  );
}

function Kpi({ icon: Icon, label, valor, accent, tone }) {
  const toneCls = {
    neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  };
  return (
    <Card padding="lg">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${
        accent ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : (toneCls[tone] || toneCls.neutral)
      }`}>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1 tabular-nums">{valor}</div>
    </Card>
  );
}

const METODOS_PAGAMENTO = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Cartao de debito' },
  { value: 'CARTAO_CREDITO', label: 'Cartao de credito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
];

function ModalLancamento({ isOpen, onClose, lanc, categorias, onSalvar }) {
  const [form, setForm] = useState({
    descricao: '', valor: 0, tipo: 'RECEITA', dataVencimento: '',
    dataPagamento: '', categoriaId: '', status: 'PENDENTE', parcelas: 1,
    produto: '', metodoPagamento: '',
  });

  useEffect(() => {
    if (lanc) setForm({
      ...lanc,
      dataVencimento: lanc.dataVencimento?.split('T')[0] || '',
      dataPagamento: lanc.dataPagamento?.split('T')[0] || '',
      categoriaId: lanc.categoriaId || '',
      produto: lanc.produto || '',
      metodoPagamento: lanc.metodoPagamento || '',
    });
    else {
      setForm({
        descricao: '', valor: 0, tipo: 'RECEITA',
        dataVencimento: new Date().toISOString().split('T')[0],
        dataPagamento: '', categoriaId: '', status: 'PENDENTE', parcelas: 1,
        produto: '', metodoPagamento: '',
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
    if (!form.dataPagamento) delete dados.dataPagamento;
    if (!form.categoriaId) delete dados.categoriaId;
    if (!form.produto) delete dados.produto;
    if (!form.metodoPagamento) delete dados.metodoPagamento;
    if (!lanc) dados.parcelas = parseInt(form.parcelas) || 1;
    onSalvar(dados);
  };

  const categoriasFiltradas = categorias.filter((c) => c.tipo === form.tipo);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lanc ? 'Editar lancamento' : 'Novo lancamento'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required autoFocus />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value, categoriaId: '' })}
            options={[
              { value: 'RECEITA', label: 'Receita (entrada)' },
              { value: 'DESPESA', label: 'Despesa (saida)' },
            ]}
            placeholder=""
          />
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0.01"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            required
          />
          <Input label="Vencimento" type="date" value={form.dataVencimento} onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })} required />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
            placeholder=""
          />
          <Select
            label="Categoria"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            placeholder="Sem categoria"
            options={categoriasFiltradas.map((c) => ({ value: c.id, label: c.nome }))}
          />
          <Input
            label="Produto / servico (opcional)"
            value={form.produto}
            onChange={(e) => setForm({ ...form, produto: e.target.value })}
            placeholder="Ex: Camisa branca M, Corte de cabelo"
            hint="Use para lancamento manual de venda sem estoque cadastrado"
          />
          <Select
            label="Metodo de pagamento"
            value={form.metodoPagamento}
            onChange={(e) => setForm({ ...form, metodoPagamento: e.target.value })}
            placeholder="Selecione..."
            options={METODOS_PAGAMENTO}
          />
          {form.status === 'PAGO' && (
            <Input
              label="Data pagamento"
              type="date"
              value={form.dataPagamento}
              onChange={(e) => setForm({ ...form, dataPagamento: e.target.value })}
              required
            />
          )}
          {!lanc && (
            <Input
              label="Parcelas"
              type="number"
              min="1"
              value={form.parcelas}
              onChange={(e) => setForm({ ...form, parcelas: e.target.value })}
              hint="Cria N lancamentos com vencimentos mensais"
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{lanc ? 'Salvar' : 'Criar lancamento'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCategoria({ isOpen, onClose, cat, onSalvar }) {
  const [form, setForm] = useState({ nome: '', tipo: 'RECEITA' });

  useEffect(() => {
    if (cat) setForm({ nome: cat.nome, tipo: cat.tipo });
    else setForm({ nome: '', tipo: 'RECEITA' });
  }, [cat, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar(form);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cat ? 'Editar categoria' : 'Nova categoria'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
        <Select
          label="Tipo"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          options={[
            { value: 'RECEITA', label: 'Receita' },
            { value: 'DESPESA', label: 'Despesa' },
          ]}
          placeholder=""
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{cat ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerLancamento({ isOpen, onClose, lanc, onEditar, onExcluir, onStatus }) {
  if (!lanc) return null;
  const status = STATUS_LABELS[lanc.status] || { label: lanc.status, variant: 'neutral' };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={lanc.descricao}
      description={lanc.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir</Button>
          <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="text-center py-4">
          <div className={`text-4xl font-semibold tracking-tight tabular-nums ${
            lanc.tipo === 'RECEITA' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
          }`}>
            {lanc.tipo === 'RECEITA' ? '+' : '-'} {fmtBRL(lanc.valor)}
          </div>
          <div className="mt-2">
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Vencimento" valor={new Date(lanc.dataVencimento).toLocaleDateString('pt-BR')} />
          <InfoBox label="Pagamento" valor={lanc.dataPagamento ? new Date(lanc.dataPagamento).toLocaleDateString('pt-BR') : '—'} />
          <InfoBox label="Categoria" valor={lanc.categoria?.nome || '—'} />
          <InfoBox label="Metodo" valor={lanc.metodoPagamento || '—'} />
          {lanc.produto && <InfoBox label="Produto" valor={lanc.produto} />}
          <InfoBox label="Lead" valor={lanc.lead?.nome || '—'} />
        </div>

        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Mudar status</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={lanc.status === 'PAGO' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('PAGO')}>Pago</Button>
            <Button variant={lanc.status === 'PENDENTE' ? 'primary' : 'secondary'} size="sm" onClick={() => onStatus('PENDENTE')}>Pendente</Button>
            <Button variant={lanc.status === 'ATRASADO' ? 'primary' : 'secondary'} size="sm" onClick={() => onStatus('ATRASADO')}>Atrasado</Button>
            <Button variant={lanc.status === 'CANCELADO' ? 'danger' : 'secondary'} size="sm" icon={XCircle} onClick={() => onStatus('CANCELADO')}>Cancelado</Button>
          </div>
        </div>
      </div>
    </Drawer>
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
