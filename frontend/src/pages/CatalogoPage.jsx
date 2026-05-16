import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Package, Edit2, Trash2, MoreHorizontal, Filter
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider, useToast,
  Switch, UploadImagem
} from '../components/ui';
import Modal from '../components/Modal';
import catalogoService from '../services/catalogoService';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TIPOS = [
  { value: 'FISICO', label: 'Fisico' },
  { value: 'SERVICO', label: 'Servico' },
];
const VISIBILIDADES = [
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

export default function CatalogoPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroVis, setFiltroVis] = useState('');

  const [modalProduto, setModalProduto] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, produto: null });
  const [modalVariacao, setModalVariacao] = useState({ open: false, data: null, produtoId: null });

  useEffect(() => {
    carregar();
    carregarCategorias();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/catalogo');
      setProdutos(r.data || []);
    } catch {
      setProdutos([]);
    } finally {
      setCarregando(false);
    }
  };

  const carregarCategorias = async () => {
    try {
      const r = await api.get('/financeiro/categorias');
      setCategorias(r.data || []);
    } catch {
      setCategorias([]);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (q && !p.nome?.toLowerCase().includes(q) && !p.descricao?.toLowerCase().includes(q)) return false;
      if (filtroTipo && p.tipo !== filtroTipo) return false;
      if (filtroVis && p.visibilidade !== filtroVis) return false;
      return true;
    });
  }, [produtos, busca, filtroTipo, filtroVis]);

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/catalogo/${dados.id}`, dados);
        toast.success('Produto atualizado');
      } else {
        await api.post('/catalogo', dados);
        toast.success('Produto criado');
      }
      setModalProduto({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (p) => {
    if (!confirm(`Excluir produto "${p.nome}"?`)) return;
    try {
      await api.delete(`/catalogo/${p.id}`);
      toast.success('Produto excluido');
      setDrawer({ open: false, produto: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Nao foi possivel excluir');
    }
  };

  const handleSalvarVariacao = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/catalogo/variacoes/${dados.id}`, dados);
        toast.success('Variacao atualizada');
      } else {
        await api.post(`/catalogo/${modalVariacao.produtoId}/variacoes`, dados);
        toast.success('Variacao criada');
      }
      setModalVariacao({ open: false, data: null, produtoId: null });
      carregar();
    } catch {
      toast.error('Erro ao salvar variacao');
    }
  };

  const handleExcluirVariacao = async (v) => {
    if (!confirm(`Excluir variacao "${v.nome}"?`)) return;
    try {
      await api.delete(`/catalogo/variacoes/${v.id}`);
      toast.success('Variacao excluida');
      carregar();
      if (drawer.produto) {
        const p = produtos.find((x) => x.id === drawer.produto.id);
        if (p) setDrawer({ open: true, produto: p });
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-5">
      {/* Aviso explicativo */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[var(--info-soft)] text-[var(--info-text)]">
        <Filter size={18} strokeWidth={1.75} className="flex-shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed">
          <strong>Sobre o catalogo:</strong> produtos cadastrados aqui podem ou nao ter estoque vinculado. Produtos <strong>sem estoque</strong> exigem lancamento manual no Financeiro a cada venda. Produtos <strong>com estoque</strong> baixam automaticamente e geram lancamento financeiro.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produtos..." />
        </div>
        <Select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          placeholder="Todos tipos"
          options={TIPOS}
          fullWidth={false}
          className="w-40"
        />
        <Select
          value={filtroVis}
          onChange={(e) => setFiltroVis(e.target.value)}
          placeholder="Toda visibilidade"
          options={VISIBILIDADES}
          fullWidth={false}
          className="w-44"
        />
        <Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>
          Novo produto
        </Button>
      </div>

      {/* Lista */}
      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Package}
            title="Nenhum produto"
            description={produtos.length === 0 ? "Cadastre seu primeiro produto." : "Nenhum produto bate com os filtros."}
            action={produtos.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>
                Cadastrar produto
              </Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Produto</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Tipo</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Visibilidade</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Variacoes</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setDrawer({ open: true, produto: p })}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                        <Package size={16} strokeWidth={1.75} className="text-[var(--text-muted)]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{p.nome}</div>
                        {p.descricao && <div className="text-[11px] text-[var(--text-muted)] line-clamp-1">{p.descricao}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <Badge variant="neutral" size="sm">{p.tipo === 'FISICO' ? 'Fisico' : 'Servico'}</Badge>
                  </td>
                  <td className="py-3 px-5">
                    <Badge variant={
                      p.visibilidade === 'ATIVO' ? 'success' :
                      p.visibilidade === 'PAUSADO' ? 'warning' : 'neutral'
                    } size="sm">
                      {VISIBILIDADES.find((v) => v.value === p.visibilidade)?.label || p.visibilidade}
                    </Badge>
                  </td>
                  <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">
                    {p.variacoes?.length || 0}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} className="py-3 px-3">
                    <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                      <DropdownItem icon={Edit2} onClick={() => setModalProduto({ open: true, data: p })}>Editar</DropdownItem>
                      <DropdownItem icon={Plus} onClick={() => setModalVariacao({ open: true, data: null, produtoId: p.id })}>Adicionar variacao</DropdownItem>
                      <DropdownDivider />
                      <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(p)}>Excluir</DropdownItem>
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Produto */}
      <ModalProduto
        isOpen={modalProduto.open}
        onClose={() => setModalProduto({ open: false, data: null })}
        produto={modalProduto.data}
        categorias={categorias}
        onSalvar={handleSalvar}
      />

      {/* Modal Variacao — passa o tipo do produto pai pra controlar campos
          condicionais (duracaoMin so aparece pra SERVICO). */}
      <ModalVariacao
        isOpen={modalVariacao.open}
        onClose={() => setModalVariacao({ open: false, data: null, produtoId: null })}
        variacao={modalVariacao.data}
        tipoProduto={produtos.find((p) => p.id === modalVariacao.produtoId)?.tipo || modalVariacao.data?.produto?.tipo}
        onSalvar={handleSalvarVariacao}
      />

      {/* Drawer detalhes */}
      <DrawerProduto
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, produto: null })}
        produto={drawer.produto}
        onEditar={() => {
          setModalProduto({ open: true, data: drawer.produto });
          setDrawer({ open: false, produto: null });
        }}
        onExcluir={() => handleExcluir(drawer.produto)}
        onAddVariacao={() => setModalVariacao({ open: true, data: null, produtoId: drawer.produto.id })}
        onEditarVariacao={(v) => setModalVariacao({ open: true, data: v, produtoId: drawer.produto.id })}
        onExcluirVariacao={handleExcluirVariacao}
      />
    </div>
  );
}

function ModalProduto({ isOpen, onClose, produto, categorias, onSalvar }) {
  const [form, setForm] = useState({
    nome: '', descricao: '', tipo: 'FISICO', visibilidade: 'ATIVO', categoriaId: '', imagemUrl: '',
  });
  // Track imagens temp subidas neste modal pra cleanup em caso de cancelar.
  // Em modo de edicao isso fica vazio porque o upload e direto no produto existente.
  const [tempsParaLimpar, setTempsParaLimpar] = useState([]);

  useEffect(() => {
    if (produto) setForm({ ...produto, descricao: produto.descricao || '', categoriaId: produto.categoriaId || '', imagemUrl: produto.imagemUrl || '' });
    else setForm({ nome: '', descricao: '', tipo: 'FISICO', visibilidade: 'ATIVO', categoriaId: '', imagemUrl: '' });
    setTempsParaLimpar([]);
  }, [produto, isOpen]);

  // Quando o modal fecha sem salvar, remove as imagens temp orfas (best-effort).
  const handleClose = async () => {
    // Em modo CRIACAO: as URLs sao temp; remove. Em EDICAO: nao toca.
    if (!produto) {
      for (const url of tempsParaLimpar) {
        catalogoService.removerImagemTemp(url);
      }
    }
    onClose();
  };

  const handleUpload = async (file) => {
    try {
      let url;
      if (produto) {
        // Edicao: upload direto no produto existente
        url = await catalogoService.uploadImagemProduto(produto.id, file);
      } else {
        // Criacao: upload temp; URL vai no body do submit
        url = await catalogoService.uploadImagemTemp(file);
        setTempsParaLimpar((prev) => [...prev, url]);
      }
      setForm((prev) => ({ ...prev, imagemUrl: url }));
    } catch (e) {
      throw e; // o componente UploadImagem mostra o erro
    }
  };

  const handleRemoverImagem = async () => {
    if (produto) {
      // Edicao: remove no backend
      await catalogoService.removerImagemProduto(produto.id);
    } else if (form.imagemUrl) {
      // Criacao: a URL atual e temp; remove no backend
      await catalogoService.removerImagemTemp(form.imagemUrl);
      setTempsParaLimpar((prev) => prev.filter((u) => u !== form.imagemUrl));
    }
    setForm((prev) => ({ ...prev, imagemUrl: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.categoriaId) {
      alert('Selecione uma categoria financeira (necessaria para CMV/relatorios).');
      return;
    }
    // Em criacao, a imagemUrl atual e a "definitiva" — ela vai pro body.
    // Remove ela da lista de temps a limpar (ja foi commitada).
    onSalvar({ ...form, imagemUrl: form.imagemUrl || null });
    setTempsParaLimpar([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={produto ? 'Editar produto' : 'Novo produto'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <UploadImagem
            imagemUrl={form.imagemUrl || null}
            onUpload={handleUpload}
            onRemover={handleRemoverImagem}
            tamanho="md"
          />
          <div className="flex-1 space-y-3 min-w-0">
            <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            <Textarea label="Descricao" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select label="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} options={TIPOS} placeholder="" />
          <Select label="Visibilidade" value={form.visibilidade} onChange={(e) => setForm({ ...form, visibilidade: e.target.value })} options={VISIBILIDADES} placeholder="" />
          <Select
            label="Categoria financeira"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            placeholder="Selecione..."
            options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
            hint="Necessaria para vincular vendas e CMV."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{produto ? 'Salvar' : 'Criar produto'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalVariacao({ isOpen, onClose, variacao, tipoProduto, onSalvar }) {
  const ehServico = tipoProduto === 'SERVICO';
  const [form, setForm] = useState({
    nome: '', sku: '', preco: 0, precoCusto: 0,
    precoCatalogo: '', usarPrecoCatalogo: false,
    estoqueAtual: 0, estoqueMinimo: 0, estoqueIdeal: 0, localizacao: '',
    duracaoMin: '', imagemUrl: '',
  });
  const [tempsParaLimpar, setTempsParaLimpar] = useState([]);

  useEffect(() => {
    if (variacao) setForm({
      ...variacao,
      sku: variacao.sku || '',
      precoCusto: variacao.precoCusto || 0,
      precoCatalogo: variacao.precoCatalogo ?? '',
      usarPrecoCatalogo: variacao.usarPrecoCatalogo || false,
      estoqueMinimo: variacao.estoqueMinimo || 0,
      estoqueIdeal: variacao.estoqueIdeal || 0,
      localizacao: variacao.localizacao || '',
      duracaoMin: variacao.duracaoMin ?? '',
      imagemUrl: variacao.imagemUrl || '',
    });
    else setForm({
      nome: '', sku: '', preco: 0, precoCusto: 0,
      precoCatalogo: '', usarPrecoCatalogo: false,
      estoqueAtual: 0, estoqueMinimo: 0, estoqueIdeal: 0, localizacao: '',
      duracaoMin: '', imagemUrl: '',
    });
    setTempsParaLimpar([]);
  }, [variacao, isOpen]);

  const handleClose = async () => {
    if (!variacao) {
      for (const url of tempsParaLimpar) {
        catalogoService.removerImagemTemp(url);
      }
    }
    onClose();
  };

  const handleUpload = async (file) => {
    let url;
    if (variacao) {
      url = await catalogoService.uploadImagemVariacao(variacao.id, file);
    } else {
      url = await catalogoService.uploadImagemTemp(file);
      setTempsParaLimpar((prev) => [...prev, url]);
    }
    setForm((prev) => ({ ...prev, imagemUrl: url }));
  };

  const handleRemoverImagem = async () => {
    if (variacao) {
      await catalogoService.removerImagemVariacao(variacao.id);
    } else if (form.imagemUrl) {
      await catalogoService.removerImagemTemp(form.imagemUrl);
      setTempsParaLimpar((prev) => prev.filter((u) => u !== form.imagemUrl));
    }
    setForm((prev) => ({ ...prev, imagemUrl: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar({
      ...form,
      preco: parseFloat(form.preco) || 0,
      precoCusto: parseFloat(form.precoCusto) || 0,
      precoCatalogo: form.precoCatalogo === '' ? null : parseFloat(form.precoCatalogo) || null,
      usarPrecoCatalogo: !!form.usarPrecoCatalogo,
      estoqueAtual: parseInt(form.estoqueAtual) || 0,
      estoqueMinimo: parseInt(form.estoqueMinimo) || 0,
      estoqueIdeal: parseInt(form.estoqueIdeal) || 0,
      // duracaoMin so e enviada quando o produto pai e SERVICO; em produto
      // fisico vai null pra nao poluir o banco.
      duracaoMin: ehServico && form.duracaoMin !== '' ? (parseInt(form.duracaoMin, 10) || null) : null,
      imagemUrl: form.imagemUrl || null,
    });
    setTempsParaLimpar([]);
  };

  const precoEfetivo = form.usarPrecoCatalogo && form.precoCatalogo
    ? parseFloat(form.precoCatalogo)
    : parseFloat(form.preco);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={variacao ? 'Editar variacao' : 'Nova variacao'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <UploadImagem
            imagemUrl={form.imagemUrl || null}
            onUpload={handleUpload}
            onRemover={handleRemoverImagem}
            tamanho="sm"
          />
          <div className="flex-1 space-y-3 min-w-0">
            <Input label="Nome da variacao" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Tamanho P, Cor Azul" required autoFocus />
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Preco de venda (R$)" type="number" step="0.01" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} required hint="Preco padrao do estoque" />
          <Input label="Preco de custo (R$)" type="number" step="0.01" min="0" value={form.precoCusto} onChange={(e) => setForm({ ...form, precoCusto: e.target.value })} />
        </div>

        {/* Preco para catalogo */}
        <div className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-main)]">Preco para catalogo (publico)</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                Pode ser diferente do preco do estoque (ex: catalogo digital com markup).
              </div>
            </div>
            <Switch
              checked={form.usarPrecoCatalogo}
              onChange={(v) => setForm({ ...form, usarPrecoCatalogo: v })}
              ariaLabel="Usar preco de catalogo como principal"
            />
          </div>
          <Input
            label="Preco catalogo (R$)"
            type="number"
            step="0.01"
            min="0"
            value={form.precoCatalogo}
            onChange={(e) => setForm({ ...form, precoCatalogo: e.target.value })}
            disabled={!form.usarPrecoCatalogo}
            placeholder="Deixe em branco para usar o preco do estoque"
          />
          <div className={`text-xs px-3 py-2 rounded-lg ${form.usarPrecoCatalogo ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'}`}>
            <strong>Preco usado em vendas e agenda:</strong> {form.usarPrecoCatalogo && form.precoCatalogo ? `${fmtBRL(precoEfetivo)} (catalogo)` : `${fmtBRL(form.preco)} (estoque)`}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Estoque atual" type="number" min="0" value={form.estoqueAtual} onChange={(e) => setForm({ ...form, estoqueAtual: e.target.value })} />
          <Input label="Estoque minimo" type="number" min="0" value={form.estoqueMinimo} onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })} hint="Alerta de falta" />
          <Input label="Estoque ideal" type="number" min="0" value={form.estoqueIdeal} onChange={(e) => setForm({ ...form, estoqueIdeal: e.target.value })} hint="Alvo de reposicao" />
        </div>
        <Input label="Localizacao" value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Ex: Corredor A, Prateleira 2" />

        {/* Duracao do atendimento — so aparece quando o produto pai e SERVICO.
            Usada pela Agenda pra pre-preencher e calcular conflito de horario. */}
        {ehServico && (
          <Input
            label="Duração do atendimento (min)"
            type="number"
            min="5"
            max="600"
            step="5"
            value={form.duracaoMin}
            onChange={(e) => setForm({ ...form, duracaoMin: e.target.value })}
            placeholder="Ex.: 30, 45, 60"
            hint="Tempo médio do atendimento. Usado pela Agenda pra evitar conflito de horário."
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{variacao ? 'Salvar' : 'Criar variacao'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerProduto({ isOpen, onClose, produto, onEditar, onExcluir, onAddVariacao, onEditarVariacao, onExcluirVariacao }) {
  if (!produto) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={produto.nome}
      description={produto.descricao}
      size="lg"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir produto</Button>
          <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{produto.tipo === 'FISICO' ? 'Fisico' : 'Servico'}</Badge>
          <Badge variant={produto.visibilidade === 'ATIVO' ? 'success' : 'neutral'}>
            {VISIBILIDADES.find((v) => v.value === produto.visibilidade)?.label}
          </Badge>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
              Variacoes ({produto.variacoes?.length || 0})
            </div>
            <Button variant="ghost" size="sm" icon={Plus} onClick={onAddVariacao}>Adicionar</Button>
          </div>

          {!produto.variacoes || produto.variacoes.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sem variacoes"
              description="Cadastre tamanhos, cores ou variantes deste produto."
              action={<Button variant="secondary" size="sm" icon={Plus} onClick={onAddVariacao}>Nova variacao</Button>}
            />
          ) : (
            <div className="space-y-2">
              {produto.variacoes.map((v) => (
                <div key={v.id} className="border border-[var(--border-main)] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{v.nome}</div>
                      {v.sku && <div className="text-[11px] text-[var(--text-muted)]">SKU: {v.sku}</div>}
                    </div>
                    <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                      <DropdownItem icon={Edit2} onClick={() => onEditarVariacao(v)}>Editar</DropdownItem>
                      <DropdownDivider />
                      <DropdownItem icon={Trash2} variant="danger" onClick={() => onExcluirVariacao(v)}>Excluir</DropdownItem>
                    </Dropdown>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                    <div>
                      <div className="text-[var(--text-muted)]">Preco</div>
                      <div className="font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(v.preco)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Custo</div>
                      <div className="font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(v.precoCusto)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-muted)]">Estoque</div>
                      <div className={`font-semibold tabular-nums ${
                        v.estoqueAtual <= (v.estoqueMinimo || 0) ? 'text-[var(--danger)]' : 'text-[var(--text-main)]'
                      }`}>
                        {v.estoqueAtual} un.
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
