import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, User, Search, Plus, Minus, Trash2, ImageIcon, Package } from 'lucide-react';
import clsx from 'clsx';
import catalogoService from '../services/catalogoService';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Resolve o preco efetivo da variacao respeitando a regra de catalogo.
function precoEfetivo(variacao) {
  if (!variacao) return 0;
  if (variacao.usarPrecoCatalogo && variacao.precoCatalogo != null) {
    return Number(variacao.precoCatalogo);
  }
  return Number(variacao.preco) || 0;
}

export default function LeadFormModal({ lead, stages, clienteId, onClose, onSave }) {
  const isEditing = !!lead?.id;
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', tags: '', prioridade: 'MEDIUM',
    origem: '', observacoes: '', etapaId: stages[0]?.id || ''
  });
  // [{ variacaoId, quantidade, observacao?, _snapshot: { variacao, produto } }]
  // _snapshot guarda os dados pra renderizar o chip sem precisar refazer query.
  const [produtos, setProdutos] = useState([]);
  const [catalogo, setCatalogo] = useState([]); // [{ produto, variacoes: [{ ..., produto }] }] achatado
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [busca, setBusca] = useState('');
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [saving, setSaving] = useState(false);
  const seletorRef = useRef(null);

  // Carrega catalogo do tenant ao abrir modal.
  useEffect(() => {
    let ativo = true;
    setCarregandoCatalogo(true);
    catalogoService.listar()
      .then((lista) => {
        if (!ativo) return;
        // Achata em lista de variacoes com referencia ao produto.
        const variacoes = [];
        for (const p of lista || []) {
          for (const v of p.variacoes || []) {
            variacoes.push({ ...v, produto: p });
          }
        }
        setCatalogo(variacoes);
      })
      .catch(() => { if (ativo) setCatalogo([]); })
      .finally(() => { if (ativo) setCarregandoCatalogo(false); });
    return () => { ativo = false; };
  }, []);

  // Pre-popula com vinculos do lead em edicao.
  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        tags: lead.tags || '',
        prioridade: lead.prioridade || 'MEDIUM',
        origem: lead.origem || '',
        observacoes: lead.observacoes || '',
        etapaId: lead.etapaId || stages[0]?.id || ''
      });
      const vinculos = Array.isArray(lead.variacoes) ? lead.variacoes : [];
      setProdutos(vinculos.map((v) => ({
        variacaoId: v.variacaoId,
        quantidade: v.quantidade,
        observacao: v.observacao || '',
        _snapshot: v.variacao ? { ...v.variacao, produto: v.variacao.produto } : null,
      })));
    } else {
      setProdutos([]);
    }
  }, [lead, stages]);

  // Fecha o seletor ao clicar fora.
  useEffect(() => {
    if (!seletorAberto) return;
    const handler = (e) => {
      if (seletorRef.current && !seletorRef.current.contains(e.target)) {
        setSeletorAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [seletorAberto]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Filtro: ignora variacoes ja selecionadas + busca por nome.
  const variacoesFiltradas = useMemo(() => {
    const idsJa = new Set(produtos.map((p) => p.variacaoId));
    const termo = busca.trim().toLowerCase();
    return catalogo
      .filter((v) => !idsJa.has(v.id))
      .filter((v) => {
        if (!termo) return true;
        const nomeProd = v.produto?.nome?.toLowerCase() || '';
        const nomeVar = v.nome?.toLowerCase() || '';
        const cat = v.produto?.categoria?.nome?.toLowerCase() || '';
        return nomeProd.includes(termo) || nomeVar.includes(termo) || cat.includes(termo);
      })
      .slice(0, 12);
  }, [catalogo, produtos, busca]);

  const valorTotal = useMemo(() => {
    return produtos.reduce((acc, p) => {
      const preco = precoEfetivo(p._snapshot);
      const qtd = Math.max(1, Number(p.quantidade) || 1);
      return acc + preco * qtd;
    }, 0);
  }, [produtos]);

  const adicionarProduto = (variacao) => {
    setProdutos((prev) => [
      ...prev,
      { variacaoId: variacao.id, quantidade: 1, observacao: '', _snapshot: variacao },
    ]);
    setBusca('');
    setSeletorAberto(false);
  };

  const ajustarQuantidade = (variacaoId, delta) => {
    setProdutos((prev) => prev.map((p) =>
      p.variacaoId === variacaoId
        ? { ...p, quantidade: Math.max(1, (Number(p.quantidade) || 1) + delta) }
        : p
    ));
  };

  const removerProduto = (variacaoId) => {
    setProdutos((prev) => prev.filter((p) => p.variacaoId !== variacaoId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        clienteId,
        // valor nao vai mais — backend recalcula a partir das variacoes.
        variacoes: produtos.map((p) => ({
          variacaoId: p.variacaoId,
          quantidade: Math.max(1, Number(p.quantidade) || 1),
          observacao: p.observacao || null,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3 px-4 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium text-sm placeholder:text-gray-400 shadow-sm";
  const labelCls = "block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1.5 ml-1";

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 transition-colors duration-300">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-[var(--bg-card)] border border-[var(--border-main)] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-sm">
                <User className="w-6 h-6 text-blue-500" />
             </div>
             <div>
                <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">
                  {isEditing ? 'Configurar Perfil' : 'Novo Atendimento'}
                </h2>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Gerenciamento de Lead</p>
             </div>
          </div>
          <button type="button" onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">

          <div className="space-y-2">
            <label className={labelCls}>Nome Completo / Razão Social *</label>
            <input className={inputCls} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Identifique o lead..." required />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelCls}>Telefone de Contato</label>
              <input className={inputCls} value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>E-mail</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelCls}>Etapa Operacional</label>
              <select className={clsx(inputCls, "appearance-none font-bold")} value={form.etapaId} onChange={e => set('etapaId', e.target.value)}>
                {stages.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Nível de Prioridade</label>
              <select className={clsx(inputCls, "appearance-none font-bold")} value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
                <option value="LOW">🔵 Baixa</option>
                <option value="MEDIUM">🟡 Média</option>
                <option value="HIGH">🔴 Alta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
             <div className="space-y-2">
                <label className={labelCls}>Canal de Origem</label>
                <input className={inputCls} value={form.origem} onChange={e => set('origem', e.target.value)} placeholder="Ex: WhatsApp" />
             </div>
             <div className="space-y-2">
                <label className={labelCls}>Tags livres</label>
                <input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Ex: cliente vip, lead quente" />
             </div>
          </div>

          {/* ========================================================== */}
          {/* PRODUTOS DE INTERESSE — substitui o antigo "Valor estimado" */}
          {/* ========================================================== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls} style={{ marginBottom: 0 }}>Produtos de interesse</label>
              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                {valorTotal > 0 ? `Total: ${fmtBRL(valorTotal)}` : '—'}
              </span>
            </div>

            {/* Lista de produtos selecionados (chips) */}
            {produtos.length > 0 && (
              <div className="space-y-2">
                {produtos.map((p) => (
                  <CardProdutoSelecionado
                    key={p.variacaoId}
                    item={p}
                    onIncrementar={() => ajustarQuantidade(p.variacaoId, +1)}
                    onDecrementar={() => ajustarQuantidade(p.variacaoId, -1)}
                    onRemover={() => removerProduto(p.variacaoId)}
                  />
                ))}
              </div>
            )}

            {/* Combobox de busca */}
            <div className="relative" ref={seletorRef}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                <input
                  className={clsx(inputCls, "pl-11")}
                  placeholder={carregandoCatalogo ? 'Carregando catalogo...' : 'Buscar produto pra vincular...'}
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setSeletorAberto(true); }}
                  onFocus={() => setSeletorAberto(true)}
                  disabled={carregandoCatalogo}
                />
              </div>

              {seletorAberto && (
                <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                  {variacoesFiltradas.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                      {busca.trim()
                        ? 'Nenhum produto encontrado.'
                        : catalogo.length === 0
                          ? 'Catalogo vazio. Cadastre produtos antes.'
                          : 'Digite pra buscar ou veja sugestoes acima.'}
                    </div>
                  ) : (
                    variacoesFiltradas.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => adicionarProduto(v)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-500/5 transition-colors text-left border-b border-[var(--border-main)] last:border-b-0"
                      >
                        <ThumbProduto variacao={v} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[var(--text-main)] truncate">
                            {v.produto?.nome}
                            {v.nome && v.nome !== 'Padrão' && v.nome !== 'Padrao' && (
                              <span className="text-[var(--text-muted)] font-medium"> · {v.nome}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5">
                            {v.produto?.categoria?.nome || 'sem categoria'}
                          </div>
                        </div>
                        <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                          {fmtBRL(precoEfetivo(v))}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Notas de Atendimento</label>
            <textarea className={clsx(inputCls, "resize-none h-24")} rows={3} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Anotações estratégicas..." />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 text-[var(--text-muted)] hover:text-[var(--text-main)] font-black text-[10px] uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all">
              Descartar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {saving ? 'PROCESSANDO...' : isEditing ? 'ATUALIZAR PERFIL' : 'EFETIVAR REGISTRO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ThumbProduto({ variacao, size = 48 }) {
  const url = variacao?.imagemUrl || variacao?.produto?.imagemUrl;
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="rounded-xl object-cover flex-shrink-0 border border-[var(--border-main)]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] flex items-center justify-center flex-shrink-0 text-[var(--text-muted)]"
      style={{ width: size, height: size }}
    >
      <ImageIcon size={size * 0.4} />
    </div>
  );
}

function CardProdutoSelecionado({ item, onIncrementar, onDecrementar, onRemover }) {
  const v = item._snapshot;
  if (!v) {
    // Fallback: vinculo sem snapshot (ex.: backend nao incluiu). Mostra so o ID.
    return (
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-[var(--border-main)]">
        <Package size={20} className="text-[var(--text-muted)]" />
        <div className="flex-1 text-xs text-[var(--text-muted)]">
          Variacao {item.variacaoId.slice(0, 8)}...
        </div>
        <button type="button" onClick={onRemover} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg">
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  const preco = precoEfetivo(v);
  const subtotal = preco * Math.max(1, Number(item.quantidade) || 1);
  const nomeProd = v.produto?.nome || '—';
  const variacaoEhPadrao = !v.nome || v.nome === 'Padrão' || v.nome === 'Padrao';
  const cat = v.produto?.categoria?.nome;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] hover:border-blue-500/30 transition-colors">
      <ThumbProduto variacao={v} size={48} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-[var(--text-main)] truncate">
          {nomeProd}
          {!variacaoEhPadrao && <span className="text-[var(--text-muted)] font-medium"> · {v.nome}</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] mt-0.5">
          {cat && <span className="text-[var(--text-muted)] uppercase tracking-wider">{cat}</span>}
          {cat && <span className="text-[var(--text-muted)]">·</span>}
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{fmtBRL(preco)}</span>
        </div>
      </div>

      {/* Quantidade */}
      <div className="flex items-center gap-1.5 bg-white dark:bg-black/40 border border-[var(--border-main)] rounded-xl px-1 py-1">
        <button type="button" onClick={onDecrementar} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-[var(--text-muted)]">
          <Minus size={12} />
        </button>
        <span className="text-xs font-black w-6 text-center">{item.quantidade}</span>
        <button type="button" onClick={onIncrementar} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-[var(--text-muted)]">
          <Plus size={12} />
        </button>
      </div>

      {/* Subtotal */}
      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0 min-w-[68px] text-right">
        {fmtBRL(subtotal)}
      </div>

      <button type="button" onClick={onRemover} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg flex-shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  );
}
