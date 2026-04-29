import { useState, useEffect } from 'react';
import { X, ShoppingCart, Save, User, Package, DollarSign, CreditCard, Loader2 } from 'lucide-react';
import catalogoService from '../../services/catalogoService';
import vendaService from '../../services/vendaService';
import clsx from 'clsx';

export default function ModalVendaLead({ isOpen, onClose, lead, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [formData, setFormData] = useState({
    variacaoId: '',
    quantidade: 1,
    valorTotal: 0,
    metodoPagamento: 'PIX',
    observacoes: ''
  });

  useEffect(() => {
    let ignore = false;
    const carregar = async () => {
      try {
        const data = await catalogoService.listar();
        if (!ignore) setProdutos(data);
      } catch (e) {
        console.error(e);
      }
    };
    if (isOpen) carregar();
    return () => { ignore = true; };
  }, [isOpen]);

  // Atualiza o valor total quando seleciona variação ou muda quantidade
  useEffect(() => {
    const v = produtos.flatMap(p => p.variacoes || []).find(v => v.id === formData.variacaoId);
    if (v) {
      setFormData(prev => ({ ...prev, valorTotal: v.preco * prev.quantidade }));
    }
  }, [formData.variacaoId, formData.quantidade, produtos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await vendaService.registrar({
        ...formData,
        leadId: lead.id,
        valorTotal: parseFloat(formData.valorTotal),
        quantidade: parseInt(formData.quantidade)
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Erro ao registrar venda: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = "w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] focus:outline-none focus:border-emerald-500 transition-all font-bold appearance-none shadow-sm placeholder:text-gray-400";
  const labelCls = "block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1.5 ml-1";

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-[var(--bg-card)] border border-[var(--border-main)] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-sm">
                <ShoppingCart className="w-6 h-6 text-emerald-500" />
             </div>
             <div>
                <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Terminal de Vendas</h3>
                <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Conversão Direta de Lead</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">
          
          <div className="bg-blue-500/5 border border-blue-500/10 p-5 rounded-3xl flex items-center gap-4 animate-in fade-in duration-500 shadow-sm">
             <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
             </div>
             <div>
                <p className="text-[var(--text-muted)] text-[9px] font-black uppercase tracking-[0.2em]">Cliente Identificado</p>
                <p className="text-[var(--text-main)] font-black uppercase tracking-tight text-sm italic">{lead.nome}</p>
             </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Item Selecionado do Catálogo</label>
            <select
              required
              className={inputCls}
              value={formData.variacaoId}
              onChange={e => setFormData({ ...formData, variacaoId: e.target.value })}
            >
              <option value="">Selecione o produto...</option>
              {produtos.map(p => (
                <optgroup key={p.id} label={p.nome.toUpperCase()}>
                  {p.variacoes?.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.nome} — {v.preco.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})} (Estoque: {v.estoqueAtual})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelCls}>Qtd Vendida</label>
              <input
                required
                type="number"
                min="1"
                className={clsx(inputCls, "text-center")}
                value={formData.quantidade}
                onChange={e => setFormData({ ...formData, quantidade: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Valor Total do Pedido</label>
              <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px] font-black">R$</span>
                 <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  className={clsx(inputCls, "pl-11 font-black text-emerald-600 dark:text-emerald-400")}
                  value={formData.valorTotal}
                  onChange={e => setFormData({ ...formData, valorTotal: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Forma de Pagamento</label>
            <select
              className={inputCls}
              value={formData.metodoPagamento}
              onChange={e => setFormData({ ...formData, metodoPagamento: e.target.value })}
            >
              <option value="PIX">PIX (Instantâneo)</option>
              <option value="CARTAO_CREDITO">Cartão de Crédito</option>
              <option value="CARTAO_DEBITO">Cartão de Débito</option>
              <option value="DINHEIRO">Dinheiro em Espécie</option>
              <option value="TRANSFERENCIA">Transferência Bancária</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Observações Internas</label>
            <textarea
              placeholder="Detalhes sobre a entrega, brindes ou acordos..."
              className={clsx(inputCls, "h-20 resize-none font-medium text-sm")}
              value={formData.observacoes}
              onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
            />
          </div>

          <div className="pt-4">
            <button
              disabled={loading || !formData.variacaoId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 text-[10px] uppercase tracking-[0.2em]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" /> EFETIVAR VENDA E BAIXAR ESTOQUE
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
