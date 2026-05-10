import { useState, useEffect, useMemo } from 'react';
import {
  Box, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, TrendingUp,
  Plus, Edit2, Trash2, MoreHorizontal, Activity, Tag
} from 'lucide-react';
import api from '../services/api';
import {
  Card, CardHeader, CardTitle, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, useToast, Tabs, TabsList, TabsTrigger, TabsContent,
  Dropdown, DropdownItem, DropdownDivider, Switch, UploadImagem
} from '../components/ui';
import Modal from '../components/Modal';
import catalogoService from '../services/catalogoService';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TIPO_MOV_LABELS = {
  COMPRA_FORNECEDOR: { label: 'Compra', variant: 'info', sentido: 'in' },
  VENDA: { label: 'Venda', variant: 'success', sentido: 'out' },
  AJUSTE: { label: 'Ajuste', variant: 'warning', sentido: 'in' },
  DEVOLUCAO: { label: 'Devolucao', variant: 'neutral', sentido: 'in' },
  RESERVA: { label: 'Reserva', variant: 'neutral', sentido: 'out' },
};

export default function EstoquePage() {
  const toast = useToast();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [reposicao, setReposicao] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  const [modalMov, setModalMov] = useState({ open: false });
  const [modalProduto, setModalProduto] = useState({ open: false, data: null });
  const [modalCategoria, setModalCategoria] = useState({ open: false, data: null });

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [s, m, r, p, c] = await Promise.all([
        api.get('/estoque/dashboard').catch(() => ({ data: null })),
        api.get('/estoque/movimentacoes').catch(() => ({ data: [] })),
        api.get('/estoque/reposicao').catch(() => ({ data: [] })),
        api.get('/catalogo').catch(() => ({ data: [] })),
        api.get('/financeiro/categorias').catch(() => ({ data: [] })),
      ]);
      setStats(s.data);
      setMovimentacoes(m.data || []);
      setReposicao(r.data || []);
      setProdutos(p.data || []);
      setCategorias(c.data || []);
    } finally {
      setCarregando(false);
    }
  };

  // Categorias do estoque = categorias financeiras de tipo RECEITA (produtos vendidos viram receita)
  const categoriasProdutos = useMemo(
    () => categorias.filter((c) => c.tipo === 'RECEITA'),
    [categorias]
  );

  const variacoesFlat = useMemo(() => {
    const out = [];
    produtos.forEach((p) => {
      (p.variacoes || []).forEach((v) => out.push({ ...v, produto: p }));
    });
    return out;
  }, [produtos]);

  const variacoesFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return variacoesFlat;
    return variacoesFlat.filter(
      (v) => v.nome?.toLowerCase().includes(q) ||
             v.produto?.nome?.toLowerCase().includes(q) ||
             v.sku?.toLowerCase().includes(q)
    );
  }, [variacoesFlat, busca]);

  const handleMovimentar = async (dados) => {
    try {
      await api.post('/estoque/movimentar', dados);
      toast.success('Movimentacao registrada');
      setModalMov({ open: false });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao movimentar');
    }
  };

  const handleSalvarProduto = async (dados) => {
    try {
      // Cria produto + variacao em sequencia (uma chamada de catalogo POST com variacoes inline)
      await api.post('/catalogo', dados);
      toast.success('Produto criado');
      setModalProduto({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao criar produto');
    }
  };

  const handleSalvarCategoria = async (dados) => {
    try {
      if (dados.id) {
        await api.patch(`/financeiro/categorias/${dados.id}`, dados);
        toast.success('Categoria atualizada');
      } else {
        await api.post('/financeiro/categorias', { ...dados, tipo: 'RECEITA' });
        toast.success('Categoria criada');
      }
      setModalCategoria({ open: false, data: null });
      carregar();
    } catch {
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleExcluirCategoria = async (c) => {
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="pills">
            <TabsTrigger value="dashboard" variant="pills" icon={Activity}>Visao geral</TabsTrigger>
            <TabsTrigger value="estoque" variant="pills" icon={Box}>Produtos</TabsTrigger>
            <TabsTrigger value="movimentacoes" variant="pills" icon={TrendingUp}>Movimentacoes</TabsTrigger>
            <TabsTrigger value="reposicao" variant="pills" icon={AlertTriangle}>Reposicao ({reposicao.length})</TabsTrigger>
            <TabsTrigger value="categorias" variant="pills" icon={Tag}>Categorias ({categoriasProdutos.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>
            Novo produto
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setModalMov({ open: true })}>
            Nova movimentacao
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <Kpi icon={TrendingUp} label="Valor inventario" valor={stats ? fmtBRL(stats.valorTotalInventario) : '—'} accent />
            <Kpi icon={Box} label="Total variacoes" valor={stats?.totalProdutos ?? '—'} />
            <Kpi icon={AlertTriangle} label="Abaixo do minimo" valor={stats?.itensAbaixoMinimo ?? '—'} tone={stats?.itensAbaixoMinimo > 0 ? 'warning' : 'neutral'} />
            <Kpi icon={Activity} label="Indice ruptura" valor={stats ? `${stats.indiceRuptura}%` : '—'} tone={(stats?.indiceRuptura || 0) > 5 ? 'danger' : 'neutral'} />
          </div>

          <Card padding="lg">
            <CardHeader>
              <div><CardTitle>Movimentacoes recentes</CardTitle></div>
            </CardHeader>
            {movimentacoes.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Nenhuma movimentacao" description="Registre entradas e saidas." />
            ) : (
              <ListaMovimentacoes movimentacoes={movimentacoes.slice(0, 10)} />
            )}
          </Card>
        </TabsContent>

        {/* Produtos */}
        <TabsContent value="estoque">
          <div className="mb-4">
            <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, variacao, SKU..." />
          </div>

          {variacoesFiltered.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Box}
                title="Nenhum produto"
                description="Cadastre seus produtos pra controlar estoque."
                action={<Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>Novo produto</Button>}
              />
            </Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-main)]">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Categoria</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Variacao / SKU</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Estoque</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Custo</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Venda</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {variacoesFiltered.map((v) => {
                    const abaixo = v.estoqueAtual < (v.estoqueMinimo || 0);
                    const cat = categorias.find((c) => c.id === v.produto?.categoriaId);
                    return (
                      <tr key={v.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50">
                        <td className="py-3 px-5 text-sm font-semibold text-[var(--text-main)] tracking-tight">{v.produto?.nome}</td>
                        <td className="py-3 px-5 text-xs">{cat ? <Badge variant="neutral" size="sm">{cat.nome}</Badge> : '—'}</td>
                        <td className="py-3 px-5 text-xs">
                          <div className="text-[var(--text-secondary)]">{v.nome}</div>
                          {v.sku && <div className="text-[var(--text-muted)]">SKU: {v.sku}</div>}
                        </td>
                        <td className={`py-3 px-5 text-right text-sm font-semibold tabular-nums ${abaixo ? 'text-[var(--danger)]' : 'text-[var(--text-main)]'}`}>
                          {v.estoqueAtual}
                          {abaixo && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                        </td>
                        <td className="py-3 px-5 text-right text-sm text-[var(--text-secondary)] tabular-nums">{fmtBRL(v.precoCusto)}</td>
                        <td className="py-3 px-5 text-right text-sm text-[var(--text-main)] tabular-nums">{fmtBRL(v.preco)}</td>
                        <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(v.estoqueAtual * (v.precoCusto || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Movimentacoes */}
        <TabsContent value="movimentacoes">
          {movimentacoes.length === 0 ? (
            <Card padding="lg"><EmptyState icon={TrendingUp} title="Nenhuma movimentacao" /></Card>
          ) : (
            <Card padding="none"><ListaMovimentacoes movimentacoes={movimentacoes} /></Card>
          )}
        </TabsContent>

        {/* Reposicao */}
        <TabsContent value="reposicao">
          {reposicao.length === 0 ? (
            <Card padding="lg"><EmptyState icon={AlertTriangle} title="Nada para repor" description="Tudo acima do minimo." /></Card>
          ) : (
            <Card padding="none">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-main)]">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto / Variacao</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Atual</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Min</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Ideal</th>
                    <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Repor</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Urgencia</th>
                  </tr>
                </thead>
                <tbody>
                  {reposicao.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--border-subtle)]">
                      <td className="py-3 px-5">
                        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{r.produto}</div>
                        <div className="text-xs text-[var(--text-muted)]">{r.variacao}</div>
                      </td>
                      <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--danger)]">{r.estoqueAtual}</td>
                      <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">{r.estoqueMinimo || 0}</td>
                      <td className="py-3 px-5 text-right text-sm tabular-nums text-[var(--text-muted)]">{r.estoqueIdeal || 0}</td>
                      <td className="py-3 px-5 text-right text-sm font-semibold tabular-nums text-[var(--text-main)]">{r.necessidade}</td>
                      <td className="py-3 px-5"><Badge variant={r.urgencia === 'ALTA' ? 'danger' : 'warning'} size="sm">{r.urgencia}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        {/* Categorias */}
        <TabsContent value="categorias">
          <div className="flex justify-end mb-4">
            <Button variant="primary" icon={Plus} onClick={() => setModalCategoria({ open: true, data: null })}>
              Nova categoria
            </Button>
          </div>
          {categoriasProdutos.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Tag}
                title="Nenhuma categoria"
                description="Categorias agrupam seus produtos (ex: Bebidas, Roupas, Cabelo, Equipamentos). Vincule cada produto a uma categoria pra organizar relatorios e CMV."
                action={<Button variant="primary" icon={Plus} onClick={() => setModalCategoria({ open: true, data: null })}>Criar primeira categoria</Button>}
              />
            </Card>
          ) : (
            <Card padding="none">
              <div className="divide-y divide-[var(--border-subtle)]">
                {categoriasProdutos.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                      <Tag size={14} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {variacoesFlat.filter((v) => v.produto?.categoriaId === c.id).length} variacoes vinculadas
                      </div>
                    </div>
                    <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                      <DropdownItem icon={Edit2} onClick={() => setModalCategoria({ open: true, data: c })}>Editar</DropdownItem>
                      <DropdownDivider />
                      <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluirCategoria(c)}>Excluir</DropdownItem>
                    </Dropdown>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ModalMovimentacao
        isOpen={modalMov.open}
        onClose={() => setModalMov({ open: false })}
        variacoes={variacoesFlat}
        onSalvar={handleMovimentar}
      />
      <ModalProduto
        isOpen={modalProduto.open}
        onClose={() => setModalProduto({ open: false, data: null })}
        categorias={categoriasProdutos}
        onSalvar={handleSalvarProduto}
      />
      <ModalCategoria
        isOpen={modalCategoria.open}
        onClose={() => setModalCategoria({ open: false, data: null })}
        cat={modalCategoria.data}
        onSalvar={handleSalvarCategoria}
      />
    </div>
  );
}

function ListaMovimentacoes({ movimentacoes }) {
  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      {movimentacoes.map((m) => {
        const tipo = TIPO_MOV_LABELS[m.tipo] || { label: m.tipo, variant: 'neutral', sentido: 'in' };
        const Icon = tipo.sentido === 'in' ? ArrowDownToLine : ArrowUpFromLine;
        return (
          <div key={m.id} className="flex items-center gap-4 px-5 py-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              tipo.sentido === 'in' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'
            }`}>
              <Icon size={16} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">
                {m.variacao?.produto?.nome} · {m.variacao?.nome}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {m.motivo || 'Sem motivo'} · {new Date(m.data).toLocaleString('pt-BR')}
              </div>
            </div>
            <Badge variant={tipo.variant} size="sm">{tipo.label}</Badge>
            <div className={`text-sm font-semibold tabular-nums w-16 text-right ${
              m.quantidade > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
            }`}>
              {m.quantidade > 0 ? '+' : ''}{m.quantidade}
            </div>
          </div>
        );
      })}
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

function ModalMovimentacao({ isOpen, onClose, variacoes, onSalvar }) {
  const [form, setForm] = useState({
    variacaoId: '', tipo: 'COMPRA_FORNECEDOR', quantidade: 1, motivo: '',
    precoCusto: '', precoVenda: '',
  });

  useEffect(() => {
    if (isOpen) setForm({ variacaoId: '', tipo: 'COMPRA_FORNECEDOR', quantidade: 1, motivo: '', precoCusto: '', precoVenda: '' });
  }, [isOpen]);

  // Variacao selecionada para travar quantidade no estoque atual quando for VENDA
  const variacaoSel = variacoes.find((v) => v.id === form.variacaoId);
  const ehSaida = ['VENDA', 'RESERVA'].includes(form.tipo);
  const maxQtd = ehSaida && variacaoSel ? variacaoSel.estoqueAtual : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.variacaoId) { alert('Selecione uma variacao'); return; }

    let quantidade = parseInt(form.quantidade);
    if (isNaN(quantidade) || quantidade < 1) {
      alert('Quantidade deve ser maior que zero');
      return;
    }

    if (ehSaida) {
      if (maxQtd !== null && quantidade > maxQtd) {
        alert(`Estoque insuficiente. Disponivel: ${maxQtd}`);
        return;
      }
      quantidade = -Math.abs(quantidade);
    } else {
      quantidade = Math.abs(quantidade);
    }

    onSalvar({
      variacaoId: form.variacaoId,
      tipo: form.tipo,
      quantidade,
      motivo: form.motivo,
      precoCusto: form.precoCusto || undefined,
      precoVenda: form.precoVenda || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova movimentacao" description="Entrada, saida ou ajuste de estoque." size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Variacao"
          value={form.variacaoId}
          onChange={(e) => setForm({ ...form, variacaoId: e.target.value })}
          placeholder="Selecione..."
          options={variacoes.map((v) => ({
            value: v.id,
            label: `${v.produto?.nome} - ${v.nome} (${v.estoqueAtual} em estoque)`
          }))}
          required
        />

        <Select
          label="Tipo"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          options={[
            { value: 'COMPRA_FORNECEDOR', label: 'Compra fornecedor (entrada)' },
            { value: 'AJUSTE', label: 'Ajuste positivo' },
            { value: 'DEVOLUCAO', label: 'Devolucao (entrada)' },
            { value: 'VENDA', label: 'Venda (saida)' },
          ]}
          placeholder=""
        />

        <Input
          label="Quantidade"
          type="number"
          min="1"
          max={maxQtd ?? undefined}
          value={form.quantidade}
          onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
          required
          hint={ehSaida && maxQtd !== null ? `Disponivel: ${maxQtd}` : undefined}
        />

        {form.tipo === 'COMPRA_FORNECEDOR' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preco custo (atualizar)" type="number" step="0.01" min="0" value={form.precoCusto} onChange={(e) => setForm({ ...form, precoCusto: e.target.value })} hint="Opcional" />
            <Input label="Preco venda (atualizar)" type="number" step="0.01" min="0" value={form.precoVenda} onChange={(e) => setForm({ ...form, precoVenda: e.target.value })} hint="Opcional" />
          </div>
        )}

        <Textarea label="Motivo / observacao" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} rows={2} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">Registrar</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalProduto({ isOpen, onClose, categorias, onSalvar }) {
  const [form, setForm] = useState({
    nome: '', descricao: '', categoriaId: '', tipo: 'FISICO', imagemUrl: '',
    nomeVariacao: 'Padrao', sku: '', preco: 0, precoCusto: 0,
    precoCatalogo: '', usarPrecoCatalogo: false,
    estoqueAtual: 0, estoqueMinimo: 0, estoqueIdeal: 0, imagemVariacaoUrl: '',
  });
  const [tempsParaLimpar, setTempsParaLimpar] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setForm({
        nome: '', descricao: '', categoriaId: '', tipo: 'FISICO', imagemUrl: '',
        nomeVariacao: 'Padrao', sku: '', preco: 0, precoCusto: 0,
        precoCatalogo: '', usarPrecoCatalogo: false,
        estoqueAtual: 0, estoqueMinimo: 0, estoqueIdeal: 0, imagemVariacaoUrl: '',
      });
      setTempsParaLimpar([]);
    }
  }, [isOpen]);

  const handleClose = () => {
    for (const url of tempsParaLimpar) catalogoService.removerImagemTemp(url);
    setTempsParaLimpar([]);
    onClose();
  };

  const handleUploadProduto = async (file) => {
    const url = await catalogoService.uploadImagemTemp(file);
    setTempsParaLimpar((prev) => [...prev, url]);
    setForm((prev) => ({ ...prev, imagemUrl: url }));
  };

  const handleRemoverImagemProduto = async () => {
    if (form.imagemUrl) {
      await catalogoService.removerImagemTemp(form.imagemUrl);
      setTempsParaLimpar((prev) => prev.filter((u) => u !== form.imagemUrl));
    }
    setForm((prev) => ({ ...prev, imagemUrl: '' }));
  };

  const handleUploadVariacao = async (file) => {
    const url = await catalogoService.uploadImagemTemp(file);
    setTempsParaLimpar((prev) => [...prev, url]);
    setForm((prev) => ({ ...prev, imagemVariacaoUrl: url }));
  };

  const handleRemoverImagemVariacao = async () => {
    if (form.imagemVariacaoUrl) {
      await catalogoService.removerImagemTemp(form.imagemVariacaoUrl);
      setTempsParaLimpar((prev) => prev.filter((u) => u !== form.imagemVariacaoUrl));
    }
    setForm((prev) => ({ ...prev, imagemVariacaoUrl: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.categoriaId) {
      alert('Selecione uma categoria. Crie uma na aba Categorias se ainda nao tiver.');
      return;
    }

    onSalvar({
      nome: form.nome,
      descricao: form.descricao,
      categoriaId: form.categoriaId,
      tipo: form.tipo,
      visibilidade: 'ATIVO',
      imagemUrl: form.imagemUrl || null,
      variacoes: [{
        nome: form.nomeVariacao || 'Padrao',
        sku: form.sku || null,
        preco: parseFloat(form.preco) || 0,
        precoCusto: parseFloat(form.precoCusto) || 0,
        precoCatalogo: form.precoCatalogo === '' ? null : (parseFloat(form.precoCatalogo) || null),
        usarPrecoCatalogo: !!form.usarPrecoCatalogo,
        estoqueAtual: parseInt(form.estoqueAtual) || 0,
        estoqueMinimo: parseInt(form.estoqueMinimo) || 0,
        estoqueIdeal: parseInt(form.estoqueIdeal) || 0,
        imagemUrl: form.imagemVariacaoUrl || null,
      }],
    });
    setTempsParaLimpar([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Novo produto" description="Cadastra produto + primeira variacao em uma operacao." size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <UploadImagem
            imagemUrl={form.imagemUrl || null}
            onUpload={handleUploadProduto}
            onRemover={handleRemoverImagemProduto}
            tamanho="md"
          />
          <div className="flex-1 min-w-0 space-y-3">
            <Input label="Nome do produto" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            <Select
              label="Categoria"
              value={form.categoriaId}
              onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              placeholder="Selecione..."
              options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
              required
              hint={categorias.length === 0 ? 'Crie uma categoria na aba "Categorias" antes' : null}
            />
          </div>
        </div>

        <Textarea
          label="Descrição (opcional)"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          rows={2}
          placeholder="Detalhes que ajudam na venda (ex.: 100% algodão, fabricado em SP)"
        />

        <Select
          label="Tipo de produto"
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          options={[
            { value: 'FISICO', label: 'Físico (controla estoque)' },
            { value: 'SERVICO', label: 'Serviço (sem estoque)' },
          ]}
          placeholder=""
          hint="Físico tem estoque (ex.: camiseta). Serviço não (ex.: corte de cabelo)."
        />

        <div className="border-t border-[var(--border-main)] pt-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Detalhes do produto</div>

          <div className="flex items-start gap-4 mb-3">
            <UploadImagem
              imagemUrl={form.imagemVariacaoUrl || null}
              onUpload={handleUploadVariacao}
              onRemover={handleRemoverImagemVariacao}
              tamanho="sm"
            />
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Versão / Modelo"
                value={form.nomeVariacao}
                onChange={(e) => setForm({ ...form, nomeVariacao: e.target.value })}
                placeholder="Padrão, Tamanho M, Cor azul..."
                required
                hint="Deixe 'Padrão' se o produto não tem versões."
              />
              <Input
                label="Código interno (opcional)"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="Ex.: CAM-AZUL-M"
                hint="Identificador interno seu (SKU)."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Preço de venda (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
              required
              hint="Preço que você cobra normalmente."
            />
            <Input
              label="Preço de custo (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.precoCusto}
              onChange={(e) => setForm({ ...form, precoCusto: e.target.value })}
              hint="Quanto você paga ao fornecedor por unidade."
            />
          </div>

          {/* Preco diferente no catalogo publico */}
          <div className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]/40 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text-main)]">Preço diferente no catálogo público</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Ative se vende em 2 lugares com preços diferentes (ex.: balcão R$ 10, site R$ 12).
                </div>
              </div>
              <Switch
                checked={form.usarPrecoCatalogo}
                onChange={(v) => setForm({ ...form, usarPrecoCatalogo: v })}
                ariaLabel="Usar preço diferente no catálogo público"
              />
            </div>
            <Input
              label="Preço para o catálogo público (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.precoCatalogo}
              onChange={(e) => setForm({ ...form, precoCatalogo: e.target.value })}
              disabled={!form.usarPrecoCatalogo}
              placeholder="Em branco = usa o mesmo preço acima"
            />
          </div>

          {form.tipo === 'FISICO' && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Input
                label="Estoque atual"
                type="number"
                min="0"
                value={form.estoqueAtual}
                onChange={(e) => setForm({ ...form, estoqueAtual: e.target.value })}
                hint="Quantidade que tem hoje."
              />
              <Input
                label="Estoque mínimo"
                type="number"
                min="0"
                value={form.estoqueMinimo}
                onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
                hint="Quando avisar que está acabando."
              />
              <Input
                label="Estoque ideal"
                type="number"
                min="0"
                value={form.estoqueIdeal}
                onChange={(e) => setForm({ ...form, estoqueIdeal: e.target.value })}
                hint="Quanto comprar quando faltar."
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">Criar produto</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCategoria({ isOpen, onClose, cat, onSalvar }) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (cat) setNome(cat.nome);
    else setNome('');
  }, [cat, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar({ id: cat?.id, nome });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cat ? 'Editar categoria' : 'Nova categoria de produto'} description="Agrupa seus produtos para organizar relatorios e CMV." size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Bebidas, Roupas, Cabelo, Equipamentos..."
          required
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{cat ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
