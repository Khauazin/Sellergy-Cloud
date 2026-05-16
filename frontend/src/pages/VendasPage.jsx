import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Plus, Calendar, User, Package, Ban } from 'lucide-react';
import api from '../services/api';
import vendaService from '../services/vendaService';
import {
  Card, CardHeader, CardTitle, Button, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, Drawer, useToast, Combobox
} from '../components/ui';
import Modal from '../components/Modal';

const STATUS_BADGE = {
  COMPLETED: { variant: 'success', label: 'Concluida' },
  PENDING: { variant: 'warning', label: 'Pendente' },
  CANCELLED: { variant: 'danger', label: 'Cancelada' },
  REFUNDED: { variant: 'neutral', label: 'Reembolsada' },
};

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function VendasPage() {
  const toast = useToast();
  const [vendas, setVendas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [leads, setLeads] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState({ open: false });
  const [drawer, setDrawer] = useState({ open: false, venda: null });

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [v, p, l, c] = await Promise.all([
        api.get('/vendas').catch(() => ({ data: [] })),
        api.get('/catalogo').catch(() => ({ data: [] })),
        api.get('/crm/leads').catch(() => ({ data: [] })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
      ]);
      setVendas(v.data || []);
      setProdutos(p.data || []);
      setLeads(l.data || []);
      setCategorias(c.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const variacoes = useMemo(() => {
    const out = [];
    produtos.forEach((p) => {
      (p.variacoes || []).forEach((v) => out.push({ ...v, produto: p }));
    });
    return out;
  }, [produtos]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return vendas;
    return vendas.filter(
      (v) => v.descricao?.toLowerCase().includes(q) ||
             v.lead?.nome?.toLowerCase().includes(q)
    );
  }, [vendas, busca]);

  const handleRegistrar = async (dados) => {
    try {
      await api.post('/vendas', dados);
      toast.success('Venda registrada');
      setModal({ open: false });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao registrar venda');
    }
  };

  const handleCancelar = async (venda) => {
    if (!venda) return;
    if (venda.status === 'CANCELLED') {
      toast.info('Venda ja esta cancelada.');
      return;
    }
    const motivo = window.prompt(
      `Cancelar venda ${fmtBRL(venda.valor)}?\n\nIsto vai estornar o estoque e cancelar o lancamento financeiro. Digite o motivo (opcional):`,
      ''
    );
    // null = clicou em Cancelar; '' = OK sem digitar -> prossegue sem motivo
    if (motivo === null) return;
    try {
      await vendaService.cancelar(venda.id, motivo);
      toast.success('Venda cancelada. Estoque estornado e lancamento financeiro cancelado.');
      setDrawer({ open: false, venda: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao cancelar venda.');
    }
  };

  const totalMes = useMemo(() => {
    const agora = new Date();
    return vendas
      .filter((v) => {
        const d = new Date(v.criadoEm);
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      })
      .reduce((acc, v) => acc + Number(v.valor || 0), 0);
  }, [vendas]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={ShoppingBag} label="Vendas (total)" valor={vendas.length} />
        <Kpi icon={ShoppingBag} label="Faturado total" valor={fmtBRL(vendas.reduce((acc, v) => acc + Number(v.valor || 0), 0))} accent />
        <Kpi icon={Calendar} label="Vendas no mes" valor={fmtBRL(totalMes)} />
        <Kpi
          icon={User}
          label="Vendas via lead"
          valor={vendas.filter((v) => v.leadId).length}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descricao ou cliente..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true })}>
          Registrar venda
        </Button>
      </div>

      {/* Lista */}
      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtradas.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma venda"
            description="Registre sua primeira venda. O sistema vai dar baixa no estoque e gerar o lancamento financeiro automaticamente."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true })}>
                Registrar venda
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Venda</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cliente</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Pagamento</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((v) => {
                const cancelada = v.status === 'CANCELLED';
                const cfgStatus = STATUS_BADGE[v.status] || { variant: 'neutral', label: v.status || '—' };
                return (
                  <tr
                    key={v.id}
                    onClick={() => setDrawer({ open: true, venda: v })}
                    className={`border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors ${cancelada ? 'opacity-60' : ''}`}
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cancelada ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--success-soft)] text-[var(--success)]'}`}>
                          <ShoppingBag size={16} strokeWidth={1.75} />
                        </div>
                        <div>
                          <div className={`text-sm font-semibold tracking-tight ${cancelada ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                            {v.descricao || `Venda #${v.numero ?? v.id.slice(0, 8)}`}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {v.movimentacoesEstoque?.length || 0} itens
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">
                      {v.lead?.nome || '—'}
                    </td>
                    <td className="py-3 px-5 text-xs">
                      {v.metodoPagamento ? <Badge variant="neutral" size="sm">{v.metodoPagamento}</Badge> : '—'}
                    </td>
                    <td className="py-3 px-5 text-xs">
                      <Badge variant={cfgStatus.variant} size="sm">{cfgStatus.label}</Badge>
                    </td>
                    <td className={`py-3 px-5 text-right text-sm font-semibold tabular-nums ${cancelada ? 'text-[var(--text-muted)] line-through' : 'text-[var(--success)]'}`}>
                      {fmtBRL(v.valor)}
                    </td>
                    <td className="py-3 px-5 text-xs text-[var(--text-muted)]">
                      {new Date(v.criadoEm).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal de registrar venda */}
      <ModalVenda
        isOpen={modal.open}
        onClose={() => setModal({ open: false })}
        variacoes={variacoes}
        leads={leads}
        categorias={categorias}
        onSalvar={handleRegistrar}
      />

      {/* Drawer detalhes */}
      <DrawerVenda
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, venda: null })}
        venda={drawer.venda}
        onCancelar={handleCancelar}
      />
    </div>
  );
}

function Kpi({ icon: Icon, label, valor, accent }) {
  return (
    <Card padding="lg">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${
        accent ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
      }`}>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1 tabular-nums">{valor}</div>
    </Card>
  );
}

// Helper: retorna o preco efetivo da variacao
function precoEfetivoVariacao(v) {
  if (!v) return 0;
  if (v.usarPrecoCatalogo && v.precoCatalogo != null) return v.precoCatalogo;
  return v.preco || 0;
}

function ModalVenda({ isOpen, onClose, variacoes, leads, categorias, onSalvar }) {
  const [form, setForm] = useState({
    variacaoId: '', quantidade: 1,
    metodoPagamento: 'PIX', observacoes: '', leadId: '', categoriaId: '',
  });

  useEffect(() => {
    if (isOpen) setForm({
      variacaoId: '', quantidade: 1,
      metodoPagamento: 'PIX', observacoes: '', leadId: '', categoriaId: '',
    });
  }, [isOpen]);

  const variacaoSel = variacoes.find((v) => v.id === form.variacaoId);
  const precoUnitario = precoEfetivoVariacao(variacaoSel);
  const valorTotal = precoUnitario * (parseInt(form.quantidade) || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.variacaoId) { alert('Selecione um produto'); return; }
    if (variacaoSel?.produto?.tipo === 'FISICO' && parseInt(form.quantidade) > variacaoSel.estoqueAtual) {
      alert(`Estoque insuficiente. Disponivel: ${variacaoSel.estoqueAtual}`);
      return;
    }
    onSalvar({
      variacaoId: form.variacaoId,
      quantidade: parseInt(form.quantidade),
      valorTotal: parseFloat(valorTotal.toFixed(2)),
      metodoPagamento: form.metodoPagamento,
      observacoes: form.observacoes,
      leadId: form.leadId || undefined,
      categoriaId: form.categoriaId || undefined,
    });
  };

  const maxQtd = variacaoSel?.produto?.tipo === 'FISICO' ? variacaoSel.estoqueAtual : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar venda" description="Da baixa no estoque e gera lancamento financeiro automaticamente." size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Combobox
          label="Produto"
          value={form.variacaoId}
          onChange={(id) => setForm({ ...form, variacaoId: id })}
          placeholder="Buscar produto cadastrado..."
          options={variacoes.map((v) => ({
            value: v.id,
            label: `${v.produto?.nome} - ${v.nome}`,
            sublabel: `${fmtBRL(precoEfetivoVariacao(v))}${v.produto?.tipo === 'FISICO' ? ` · ${v.estoqueAtual} em estoque` : ''}`,
            badge: v.usarPrecoCatalogo ? 'Catalogo' : null,
          }))}
          hint={variacaoSel?.produto?.tipo === 'FISICO' ? `Disponivel: ${variacaoSel.estoqueAtual} unidades` : null}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantidade"
            type="number"
            min="1"
            max={maxQtd ?? undefined}
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
            required
          />
          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
              Valor total
            </label>
            <div className="h-11 px-4 flex items-center bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-xl text-sm font-semibold text-[var(--text-main)] tabular-nums">
              {fmtBRL(valorTotal)}
            </div>
            {variacaoSel && (
              <p className="text-xs text-[var(--text-muted)] mt-1.5">
                {fmtBRL(precoUnitario)} × {form.quantidade || 0} ({variacaoSel.usarPrecoCatalogo ? 'catalogo' : 'estoque'})
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Pagamento"
            value={form.metodoPagamento}
            onChange={(e) => setForm({ ...form, metodoPagamento: e.target.value })}
            options={[
              { value: 'PIX', label: 'PIX' },
              { value: 'DINHEIRO', label: 'Dinheiro' },
              { value: 'DEBITO', label: 'Cartao de debito' },
              { value: 'CREDITO', label: 'Cartao de credito' },
              { value: 'BOLETO', label: 'Boleto' },
              { value: 'TRANSFERENCIA', label: 'Transferencia' },
            ]}
            placeholder=""
          />
          <Select
            label="Categoria financeira"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            placeholder="Sem categoria"
            options={categorias.filter((c) => c.tipo === 'RECEITA').map((c) => ({ value: c.id, label: c.nome }))}
          />
        </div>

        <Combobox
          label="Lead (opcional)"
          value={form.leadId}
          onChange={(id) => setForm({ ...form, leadId: id })}
          placeholder="Sem lead vinculado"
          options={leads.map((l) => ({ value: l.id, label: l.nome, sublabel: l.telefone || l.email }))}
          clearable
        />

        <Textarea
          label="Observacoes"
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          rows={2}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit" disabled={!form.variacaoId}>Registrar venda</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerVenda({ isOpen, onClose, venda, onCancelar }) {
  if (!venda) return null;

  const cancelada = venda.status === 'CANCELLED';
  const cfgStatus = STATUS_BADGE[venda.status] || { variant: 'neutral', label: venda.status || '—' };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Venda · ${fmtBRL(venda.valor)}`}
      description={venda.descricao}
      size="md"
      footer={
        !cancelada && onCancelar ? (
          <div className="flex justify-end">
            <Button
              variant="danger-soft"
              icon={Ban}
              size="sm"
              onClick={() => onCancelar(venda)}
            >
              Cancelar venda
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="text-center py-4">
          <div className={`text-4xl font-semibold tracking-tight tabular-nums ${cancelada ? 'text-[var(--text-muted)] line-through' : 'text-[var(--success)]'}`}>
            {fmtBRL(venda.valor)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-2">
            {new Date(venda.criadoEm).toLocaleString('pt-BR')}
          </div>
          <div className="mt-2">
            <Badge variant={cfgStatus.variant} size="sm">{cfgStatus.label}</Badge>
          </div>
        </div>

        {cancelada && (
          <div className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--danger-text)] mb-1">
              Cancelada
            </div>
            {venda.dataCancelamento && (
              <div className="text-xs text-[var(--danger-text)]">
                em {new Date(venda.dataCancelamento).toLocaleString('pt-BR')}
              </div>
            )}
            {venda.motivoCancelamento && (
              <div className="text-xs text-[var(--danger-text)] mt-1 italic">
                "{venda.motivoCancelamento}"
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Pagamento" valor={venda.metodoPagamento || '—'} />
          <InfoBox label="Status" valor={cfgStatus.label} />
          <InfoBox label="Cliente" valor={venda.lead?.nome || '—'} />
          <InfoBox label="Itens" valor={`${venda.movimentacoesEstoque?.length || 0}`} />
        </div>

        {venda.movimentacoesEstoque?.length > 0 && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Itens vendidos</div>
            <div className="space-y-2">
              {venda.movimentacoesEstoque.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-main)]">
                  <Package size={16} className="text-[var(--text-muted)]" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
                      {m.variacao?.produto?.nome} · {m.variacao?.nome}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-[var(--text-main)]">
                    {Math.abs(m.quantidade)} un.
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {venda.lancamentosFinanceiros?.length > 0 && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Lancamento financeiro</div>
            {venda.lancamentosFinanceiros.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-main)]">
                <div className="text-sm text-[var(--text-secondary)]">{l.descricao}</div>
                <Badge variant="success" size="sm">{l.status}</Badge>
              </div>
            ))}
          </div>
        )}
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
