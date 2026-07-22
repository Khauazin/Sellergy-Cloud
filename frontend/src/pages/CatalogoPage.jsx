import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Package, Edit2, Trash2, MoreHorizontal, Tag
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider, useToast,
  UploadImagem, InputDuracao, LabelAjuda
} from '../components/ui';
import Modal from '../components/Modal';
import catalogoService from '../services/catalogoService';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Catalogo cadastra so servicos. Constante TIPOS removida — filtro de tipo
// nao faz mais sentido na UI.
const VISIBILIDADES = [
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'PAUSADO', label: 'Pausado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

export default function CatalogoPage() {
  const toast = useToast();
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  // filtroTipo removido — Catalogo cadastra so servicos.
  const [filtroVis, setFiltroVis] = useState('');

  const [modalProduto, setModalProduto] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, produto: null });
  const [modalVariacao, setModalVariacao] = useState({ open: false, data: null, produtoId: null });
  const [modalCatServico, setModalCatServico] = useState(false);

  useEffect(() => {
    carregar();
    carregarCategorias();
    carregarEspecialistas();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/catalogo');
      // Catalogo so lista servicos. Produtos fisicos sao no Estoque.
      // Filtro local pra blindar contra dados legados/criados por outras vias.
      setProdutos((r.data || []).filter((p) => p.tipo === 'SERVICO'));
    } catch {
      setProdutos([]);
    } finally {
      setCarregando(false);
    }
  };

  const carregarCategorias = async () => {
    try {
      // Só categorias de uso SERVICO aparecem no cadastro de serviço.
      const r = await api.get('/financeiro/categorias?uso=SERVICO');
      setCategorias(r.data || []);
    } catch {
      setCategorias([]);
    }
  };

  // Especialistas ativos pra vincular ao servico (a agenda reserva o horario deles).
  const carregarEspecialistas = async () => {
    try {
      const r = await api.get('/especialistas');
      setEspecialistas((r.data || []).filter((e) => e.ativo));
    } catch {
      setEspecialistas([]);
    }
  };

  // Cria categoria contextual de serviço (uso=SERVICO automático; sem dropdown).
  const handleSalvarCategoriaServico = async (nome) => {
    try {
      await api.post('/financeiro/categorias', { nome, tipo: 'RECEITA', uso: 'SERVICO' });
      toast.success('Categoria de serviço criada');
      setModalCatServico(false);
      carregarCategorias();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao criar categoria');
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (q && !p.nome?.toLowerCase().includes(q) && !p.descricao?.toLowerCase().includes(q)) return false;
      if (filtroVis && p.visibilidade !== filtroVis) return false;
      return true;
    });
  }, [produtos, busca, filtroVis]);

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
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Catálogo de serviços</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Cadastre os serviços que você oferece (corte, consulta, atendimento). Produtos físicos com estoque ficam em Estoque.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar serviços..." />
        </div>
        <Select
          value={filtroVis}
          onChange={(e) => setFiltroVis(e.target.value)}
          placeholder="Toda visibilidade"
          options={VISIBILIDADES}
          fullWidth={false}
          className="w-44"
        />
        <Button variant="secondary" icon={Tag} onClick={() => setModalCatServico(true)}>
          Categoria de serviço
        </Button>
        <Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>
          Novo serviço
        </Button>
      </div>

      {/* Lista */}
      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Package}
            title="Nenhum serviço"
            description={produtos.length === 0 ? "Cadastre seu primeiro serviço." : "Nenhum serviço bate com os filtros."}
            action={produtos.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModalProduto({ open: true, data: null })}>
                Cadastrar serviço
              </Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Serviço</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Visibilidade</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Variações</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setDrawer({ open: true, produto: p })}
                  className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                >
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                        <Package size={16} strokeWidth={1.75} className="text-[var(--text-muted)]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{p.nome}</div>
                        {p.descricao && <div className="text-[11px] text-[var(--text-muted)] line-clamp-1">{p.descricao}</div>}
                      </div>
                    </div>
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
        especialistas={especialistas}
        onSalvar={handleSalvar}
      />

      <ModalCategoriaServico
        isOpen={modalCatServico}
        onClose={() => setModalCatServico(false)}
        onSalvar={handleSalvarCategoriaServico}
      />

      {/* Modal Variacao — Catalogo so lida com servicos, sem condicional de tipo. */}
      <ModalVariacao
        isOpen={modalVariacao.open}
        onClose={() => setModalVariacao({ open: false, data: null, produtoId: null })}
        variacao={modalVariacao.data}
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

// Modal contextual de categoria de serviço — só o nome; o uso (SERVICO) é
// automático porque estamos no módulo de Serviços.
function ModalCategoriaServico({ isOpen, onClose, onSalvar }) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o campo ao abrir
    if (isOpen) setNome('');
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onSalvar(nome.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova categoria de serviço" description="Vai aparecer só no cadastro de serviços." size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={<LabelAjuda texto="Nome" ajuda="Ex.: Cabelo, Estética, Consultas." />}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">Criar</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalProduto({ isOpen, onClose, produto, categorias, especialistas = [], onSalvar }) {
  const [form, setForm] = useState({
    nome: '', descricao: '', tipo: 'FISICO', visibilidade: 'ATIVO',
    categoriaId: '', imagemUrl: '', duracaoMin: '', especialistasIds: [],
  });

  const toggleEspecialista = (id) => setForm((f) => ({
    ...f,
    especialistasIds: f.especialistasIds.includes(id)
      ? f.especialistasIds.filter((x) => x !== id)
      : [...f.especialistasIds, id],
  }));
  // Track imagens temp subidas neste modal pra cleanup em caso de cancelar.
  // Em modo de edicao isso fica vazio porque o upload e direto no produto existente.
  const [tempsParaLimpar, setTempsParaLimpar] = useState([]);

  useEffect(() => {
    if (produto) {
      // Em edicao puxa duracao da 1a variacao "Padrao" se existir.
      const variacaoPadrao = produto.variacoes?.[0];
      setForm({
        ...produto,
        descricao: produto.descricao || '',
        categoriaId: produto.categoriaId || '',
        imagemUrl: produto.imagemUrl || '',
        duracaoMin: variacaoPadrao?.duracaoMin ?? '',
        especialistasIds: (produto.especialistas || []).map((e) => e.id),
      });
    } else {
      // Default SERVICO porque Catalogo so cadastra servicos.
      setForm({
        nome: '', descricao: '', tipo: 'SERVICO', visibilidade: 'ATIVO',
        categoriaId: '', imagemUrl: '', duracaoMin: '', especialistasIds: [],
      });
    }
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
    if (!form.especialistasIds || form.especialistasIds.length === 0) {
      alert('Selecione ao menos um especialista que atende este serviço.');
      return;
    }
    // Catalogo cadastra SO servicos. Forcar tipo=SERVICO no payload pra
    // blindar contra qualquer estado inesperado.
    const duracao = form.duracaoMin === '' || form.duracaoMin == null
      ? null
      : (parseInt(form.duracaoMin, 10) || null);
    onSalvar({
      ...form,
      tipo: 'SERVICO',
      imagemUrl: form.imagemUrl || null,
      duracaoMin: duracao,
    });
    setTempsParaLimpar([]);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={produto ? 'Editar serviço' : 'Novo serviço'} description={produto ? null : 'Cadastre o serviço com nome, foto, preço e duração.'} size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <UploadImagem
            imagemUrl={form.imagemUrl || null}
            onUpload={handleUpload}
            onRemover={handleRemoverImagem}
            tamanho="md"
          />
          <div className="flex-1 space-y-4 min-w-0">
            <Input
              size="lg"
              label={<LabelAjuda texto="Nome do serviço" ajuda="Ex.: Corte de cabelo, Consulta nutricional." />}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
              autoFocus
            />
            <Textarea
              size="lg"
              label={<LabelAjuda texto="Descrição" ajuda="O que está incluído no atendimento." />}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        {/* Sem seletor de Tipo: Catalogo cadastra so servicos.
            Produtos fisicos sao cadastrados no Estoque. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            size="lg"
            label="Visibilidade"
            value={form.visibilidade}
            onChange={(e) => setForm({ ...form, visibilidade: e.target.value })}
            options={VISIBILIDADES}
            placeholder=""
          />
          <Select
            size="lg"
            label={<LabelAjuda texto="Categoria financeira" ajuda="Necessária para vincular vendas e CMV." />}
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
            placeholder="Selecione..."
            options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
          />
        </div>

        {/* Duracao sempre visivel — Catalogo so trata servicos.
            Persiste na variacao Padrao via backend. */}
        <InputDuracao
          size="lg"
          label={<LabelAjuda texto="Quanto tempo leva o atendimento?" ajuda="A Agenda usa isso pra não marcar 2 clientes no mesmo horário." />}
          value={form.duracaoMin}
          onChange={(min) => setForm({ ...form, duracaoMin: min })}
        />

        {/* Especialistas que atendem — obrigatório. A agenda usa este vínculo
            pra reservar o horário do profissional escolhido. */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Especialistas que atendem este serviço
          </label>
          {especialistas.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-xl p-3 leading-relaxed">
              Cadastre um especialista antes (na tela <strong>Especialistas</strong>). O serviço precisa de pelo menos um profissional que o execute.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {especialistas.map((esp) => {
                  const sel = form.especialistasIds.includes(esp.id);
                  return (
                    <button
                      type="button"
                      key={esp.id}
                      onClick={() => toggleEspecialista(esp.id)}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        sel
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--text-on-primary)]'
                          : 'border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                      }`}
                    >
                      {esp.nome}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                Selecione um ou mais. Na agenda você escolhe qual deles vai atender.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{produto ? 'Salvar' : 'Criar serviço'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Catalogo so lida com servicos — modal de variacao nao tem campos de estoque
// (nao faz sentido pra servico). Duracao sempre visivel.
function ModalVariacao({ isOpen, onClose, variacao, onSalvar }) {
  const [form, setForm] = useState({
    nome: '', sku: '', preco: '', precoCusto: 0,
    duracaoMin: '', imagemUrl: '',
  });
  const [tempsParaLimpar, setTempsParaLimpar] = useState([]);

  useEffect(() => {
    if (variacao) setForm({
      nome: variacao.nome || '',
      sku: variacao.sku || '',
      preco: variacao.preco || 0,
      precoCusto: variacao.precoCusto || 0,
      duracaoMin: variacao.duracaoMin ?? '',
      imagemUrl: variacao.imagemUrl || '',
    });
    else setForm({
      nome: '', sku: '', preco: 0, precoCusto: 0,
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
      // Catalogo so trata servicos: sem campos de estoque, sempre tem duracao.
      duracaoMin: form.duracaoMin === '' || form.duracaoMin == null
        ? null
        : (parseInt(form.duracaoMin, 10) || null),
      imagemUrl: form.imagemUrl || null,
    });
    setTempsParaLimpar([]);
  };

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
            <Input label={<LabelAjuda texto="Nome da variação" ajuda="Ex.: Tamanho P, Cor Azul." />} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
        </div>
        <Input label={<LabelAjuda texto="Preço do serviço (R$)" ajuda="O valor que o cliente paga pelo atendimento." />} type="number" step="0.01" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} required />

        {/* Campos de estoque (atual/min/ideal/localizacao) removidos —
            Catalogo so lida com servicos, esses nao se aplicam. */}

        {/* Duracao do atendimento — sempre visivel pra servicos. */}
        <InputDuracao
          label={<LabelAjuda texto="Duração do atendimento" ajuda="Tempo médio do atendimento. Usado pela Agenda pra evitar conflito de horário." />}
          value={form.duracaoMin}
          onChange={(min) => setForm({ ...form, duracaoMin: min })}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{variacao ? 'Salvar' : 'Criar variação'}</Button>
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
