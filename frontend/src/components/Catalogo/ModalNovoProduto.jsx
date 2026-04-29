import { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Package, Tag, ListPlus, Check } from 'lucide-react';
import catalogoService from '../../services/catalogoService';
import financeiroService from '../../services/financeiroService';
import clsx from 'clsx';

export default function ModalNovoProduto({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [creatingCat, setCreatingCat] = useState(false);
  const [novaCat, setNovaCat] = useState({ nome: '', tipo: 'RECEITA' });
  const [savingCat, setSavingCat] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'FISICO',
    visibilidade: 'ATIVO',
    categoriaId: '',
    variacoes: [
      { nome: 'Padrão', preco: '', estoqueAtual: 0, sku: '', estoqueMinimo: 0, estoqueIdeal: 0 }
    ]
  });

  useEffect(() => {
    if (isOpen) {
      carregarCategorias();
    }
  }, [isOpen]);

  const carregarCategorias = async () => {
    try {
      const data = await financeiroService.listarCategorias();
      setCategorias(data);
    } catch {
      setCategorias([]);
    }
  };

  const handleSalvarCategoria = async () => {
    if (!novaCat.nome.trim()) return;
    setSavingCat(true);
    try {
      const nova = await financeiroService.criarCategoria(novaCat);
      await carregarCategorias();
      setFormData(prev => ({ ...prev, categoriaId: nova.id }));
      setCreatingCat(false);
      setNovaCat({ nome: '', tipo: 'RECEITA' });
    } catch {
      alert('Erro ao criar categoria.');
    } finally {
      setSavingCat(false);
    }
  };

  const addVariacao = () => {
    setFormData({
      ...formData,
      variacoes: [...formData.variacoes, { nome: '', preco: '', estoqueAtual: 0, sku: '', estoqueMinimo: 0, estoqueIdeal: 0 }]
    });
  };

  const removeVariacao = (index) => {
    if (formData.variacoes.length === 1) return;
    const newVars = [...formData.variacoes];
    newVars.splice(index, 1);
    setFormData({ ...formData, variacoes: newVars });
  };

  const handleVariacaoChange = (index, field, value) => {
    const newVars = [...formData.variacoes];
    
    // Trava rigorosa contra valores negativos
    if (['preco', 'estoqueAtual', 'estoqueMinimo', 'estoqueIdeal'].includes(field)) {
      const val = parseFloat(value);
      newVars[index][field] = isNaN(val) ? 0 : Math.max(0, val);
    } else {
      newVars[index][field] = value;
    }
    
    setFormData({ ...formData, variacoes: newVars });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.categoriaId) {
      alert('Por favor, selecione ou crie uma categoria para o produto.');
      return;
    }

    try {
      setLoading(true);
      const dataToSave = {
        ...formData,
        variacoes: formData.variacoes.map(v => ({
          ...v,
          preco: parseFloat(v.preco) || 0,
          estoqueAtual: parseInt(v.estoqueAtual) || 0,
          estoqueMinimo: parseInt(v.estoqueMinimo) || 0,
          estoqueIdeal: parseInt(v.estoqueIdeal) || 0
        }))
      };
      await catalogoService.criar(dataToSave);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao salvar produto.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = "w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-bold shadow-sm placeholder:text-gray-400";
  const labelCls = "block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2 ml-1";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[var(--bg-card)] border border-[var(--border-main)] w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-sm">
              <Package className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Novo Registro de Item</h3>
              <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Catálogo & Inventário</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">
          
          {/* Categoria Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className={labelCls} style={{ marginBottom: 0 }}>Classificação do Produto</label>
              <button 
                type="button" 
                onClick={() => setCreatingCat(!creatingCat)}
                className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
              >
                {creatingCat ? 'CANCELAR' : <><Plus size={12}/> NOVA CATEGORIA</>}
              </button>
            </div>

            {creatingCat ? (
              <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-3xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                <input 
                  autoFocus
                  placeholder="Nome da nova categoria..." 
                  className={inputCls}
                  value={novaCat.nome}
                  onChange={e => setNovaCat({...novaCat, nome: e.target.value})}
                />
                <div className="flex gap-2">
                   <button 
                    type="button" 
                    onClick={handleSalvarCategoria}
                    disabled={savingCat || !novaCat.nome.trim()}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                   >
                     {savingCat ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14}/>}
                     CRIAR E SELECIONAR
                   </button>
                </div>
              </div>
            ) : (
              <select
                required
                className={inputCls}
                value={formData.categoriaId}
                onChange={e => setFormData({...formData, categoriaId: e.target.value})}
              >
                <option value="">Selecione uma categoria existente...</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelCls}>Nome Comercial do Produto</label>
              <input
                required
                type="text"
                placeholder="Ex: Camiseta Cotton Premium"
                className={inputCls}
                value={formData.nome}
                onChange={e => setFormData({...formData, nome: e.target.value})}
              />
            </div>
            
            <div>
              <label className={labelCls}>Descrição para Venda</label>
              <textarea
                placeholder="Destaque as principais características para o time de vendas..."
                className={clsx(inputCls, "h-24 resize-none font-medium")}
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Tipo de Recurso</label>
                <select
                  className={inputCls}
                  value={formData.tipo}
                  onChange={e => setFormData({...formData, tipo: e.target.value})}
                >
                  <option value="FISICO">📦 Estoque Físico</option>
                  <option value="SERVICO">⚡ Digital / Serviço</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Disponibilidade</label>
                <select
                  className={inputCls}
                  value={formData.visibilidade}
                  onChange={e => setFormData({...formData, visibilidade: e.target.value})}
                >
                  <option value="ATIVO">✅ Disponível para Venda</option>
                  <option value="PAUSADO">🟡 Pausado (Exibição apenas)</option>
                  <option value="ARQUIVADO">📁 Arquivado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grade de Variações */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <label className={labelCls} style={{ marginBottom: 0 }}>Modelos, Cores & Preços</label>
              <button 
                type="button" 
                onClick={addVariacao}
                className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 transition-all"
              >
                <ListPlus className="w-3.5 h-3.5" /> ADICIONAR MODELO
              </button>
            </div>

            <div className="space-y-4">
              {formData.variacoes.map((v, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-3xl p-5 space-y-4 relative group/v shadow-sm transition-all hover:border-blue-500/20">
                  {formData.variacoes.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeVariacao(idx)}
                      className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover/v:opacity-100 transition-all bg-white dark:bg-black/40 rounded-xl border border-[var(--border-main)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <p className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Identificador (Ex: Azul / G)</p>
                       <input
                        placeholder="Nome da variação..."
                        className="w-full bg-white dark:bg-black/20 border border-[var(--border-main)] rounded-xl py-2.5 px-4 text-sm text-[var(--text-main)] focus:border-blue-500 outline-none font-bold shadow-inner"
                        value={v.nome}
                        onChange={e => handleVariacaoChange(idx, 'nome', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                       <p className="text-[9px] font-black text-[var(--text-muted)] uppercase ml-1">Preço Sugerido</p>
                       <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px] font-black">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            className="w-full bg-white dark:bg-black/20 border border-[var(--border-main)] rounded-xl py-2.5 pl-10 pr-4 text-sm text-emerald-600 dark:text-emerald-400 focus:border-blue-500 outline-none font-black shadow-inner"
                            value={v.preco}
                            onChange={e => handleVariacaoChange(idx, 'preco', e.target.value)}
                            required
                          />
                       </div>
                    </div>
                  </div>

                  <div className={clsx("grid grid-cols-3 gap-4 pt-2 transition-opacity", formData.tipo !== 'FISICO' && "opacity-20 pointer-events-none")}>
                    <div>
                      <label className="block text-[9px] font-black text-[var(--text-muted)] uppercase mb-1.5 ml-1">Saldo em Mãos</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full bg-white dark:bg-black/20 border border-[var(--border-main)] rounded-xl py-2.5 px-4 text-sm text-[var(--text-main)] focus:border-blue-500 outline-none font-bold text-center"
                        value={v.estoqueAtual}
                        onChange={e => handleVariacaoChange(idx, 'estoqueAtual', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-[var(--text-muted)] uppercase mb-1.5 ml-1 text-red-500/70">Mínimo Crítico</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full bg-white dark:bg-black/20 border border-[var(--border-main)] rounded-xl py-2.5 px-4 text-sm text-red-600 dark:text-red-400 focus:border-red-500 outline-none font-bold text-center"
                        value={v.estoqueMinimo}
                        onChange={e => handleVariacaoChange(idx, 'estoqueMinimo', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-[var(--text-muted)] uppercase mb-1.5 ml-1 text-blue-500/70">Meta de Compra</label>
                      <input
                        type="number"
                        min="0"
                        className="w-full bg-white dark:bg-black/20 border border-[var(--border-main)] rounded-xl py-2.5 px-4 text-sm text-blue-600 dark:text-blue-400 focus:border-blue-500 outline-none font-bold text-center"
                        value={v.estoqueIdeal}
                        onChange={e => handleVariacaoChange(idx, 'estoqueIdeal', e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      placeholder="SKU / Código Interno"
                      className="w-full bg-white dark:bg-black/20 border border-[var(--border-main)] rounded-xl py-2.5 px-4 text-[10px] text-[var(--text-muted)] focus:border-blue-500 outline-none font-bold uppercase tracking-widest placeholder:text-gray-400"
                      value={v.sku}
                      onChange={e => handleVariacaoChange(idx, 'sku', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 pb-4">
            <button
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-[10px] uppercase tracking-[0.2em]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" /> EFETIVAR CADASTRO NO SISTEMA
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
