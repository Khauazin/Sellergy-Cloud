import { useState, useEffect } from 'react';
import { X, Save, ArrowLeftRight } from 'lucide-react';
import estoqueService from '../../services/estoqueService';
import catalogoService from '../../services/catalogoService';
import clsx from 'clsx';

export default function ModalMovimentarEstoque({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [formData, setFormData] = useState({
    variacaoId: '',
    tipo: 'AJUSTE',
    quantidade: '',
    sentido: 'ENTRADA', // 'ENTRADA' ou 'SAIDA'
    motivo: ''
  });

  const inputCls = "w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] focus:outline-none focus:border-amber-500 transition-all font-bold appearance-none shadow-sm placeholder:text-gray-400";

  // ... (useEffect remains same)

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const qtd = parseInt(formData.quantidade);
      const valorFinal = formData.sentido === 'SAIDA' ? -Math.abs(qtd) : Math.abs(qtd);

      await estoqueService.movimentar({
        ...formData,
        quantidade: valorFinal
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao realizar movimentação.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--bg-card)] border border-[var(--border-main)] w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-sm">
              <ArrowLeftRight className="w-6 h-6 text-amber-500" />
            </div>
            <div>
               <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Logística</h3>
               <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Movimentar Estoque</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-[var(--bg-card)]">
          
          {/* Sentido da Movimentação */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-100 dark:bg-black/20 rounded-2xl border border-[var(--border-main)] shadow-inner">
             <button
               type="button"
               onClick={() => setFormData({...formData, sentido: 'ENTRADA'})}
               className={clsx(
                 "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                 formData.sentido === 'ENTRADA' ? "bg-emerald-500 text-white shadow-lg" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
               )}
             >
               ↑ Entrada (+)
             </button>
             <button
               type="button"
               onClick={() => setFormData({...formData, sentido: 'SAIDA'})}
               className={clsx(
                 "py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                 formData.sentido === 'SAIDA' ? "bg-red-500 text-white shadow-lg" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
               )}
             >
               ↓ Saída (−)
             </button>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1 ml-1">Item / Variação</label>
            <select
              required
              className="w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] focus:outline-none focus:border-amber-500 transition-all font-bold appearance-none shadow-sm"
              value={formData.variacaoId}
              onChange={e => setFormData({ ...formData, variacaoId: e.target.value })}
            >
              <option value="">Selecione o item...</option>
              {produtos.map(p => (
                <optgroup key={p.id} label={p.nome.toUpperCase()}>
                  {p.variacoes?.map(v => (
                    <option key={v.id} value={v.id}>{v.nome} (Saldo: {v.estoqueAtual})</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1 ml-1">Tipo de Evento</label>
              <select
                className="w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] focus:outline-none focus:border-amber-500 transition-all font-bold appearance-none shadow-sm"
                value={formData.tipo}
                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
              >
                <option value="AJUSTE">Ajuste Manual</option>
                <option value="COMPRA_FORNECEDOR">Compra Fornecedor</option>
                <option value="DEVOLUCAO">Devolução</option>
                <option value="VENDA">Saída Manual</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1 ml-1">Quantidade</label>
              <input
                required
                type="number"
                min="1"
                className={clsx(inputCls, "text-center font-black")}
                value={formData.quantidade}
                onChange={e => setFormData({ ...formData, quantidade: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1 ml-1">Justificativa da Auditoria</label>
            <textarea
              placeholder="Descreva o motivo desta alteração de inventário..."
              className="w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] focus:outline-none focus:border-amber-500 transition-all h-24 resize-none font-medium shadow-sm"
              value={formData.motivo}
              onChange={e => setFormData({ ...formData, motivo: e.target.value })}
            />
          </div>

          <div className="pt-4">
            <button
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-amber-500/20 active:scale-95 text-[10px] uppercase tracking-[0.2em]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" /> Confirmar Alteração
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
