import { useState, useEffect } from 'react';
import { X, Save, Plus, Check } from 'lucide-react';
import financeiroService from '../../services/financeiroService';
import clsx from 'clsx';

const CAMPOS_INICIAIS = {
  descricao: '',
  valor: '',
  tipo: 'RECEITA',
  status: 'PENDENTE',
  dataVencimento: new Date().toISOString().split('T')[0],
  dataPagamento: '',
  categoriaId: '',
  parcelas: 1,
};

export default function ModalNovoLancamento({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState(CAMPOS_INICIAIS);

  // Criação inline de categoria
  const [creatingCat, setCreatingCat] = useState(false);
  const [novaCat, setNovaCat] = useState({ nome: '', tipo: 'RECEITA' });
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(CAMPOS_INICIAIS);
    setErro('');
    setCreatingCat(false);
    setNovaCat({ nome: '', tipo: 'RECEITA' });

    financeiroService.listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, [isOpen]);

  const recarregarCategorias = async () => {
    const lista = await financeiroService.listarCategorias().catch(() => []);
    setCategorias(lista);
  };

  const salvarCategoria = async () => {
    if (!novaCat.nome.trim()) return;
    setSavingCat(true);
    try {
      const nova = await financeiroService.criarCategoria(novaCat);
      await recarregarCategorias();
      set('categoriaId', nova.id);
      setCreatingCat(false);
      setNovaCat({ nome: '', tipo: 'RECEITA' });
    } catch {
      setErro('Erro ao criar categoria.');
    } finally {
      setSavingCat(false);
    }
  };

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    // Validação: status PAGO exige dataPagamento
    if (form.status === 'PAGO' && !form.dataPagamento) {
      setErro('Informe a data de pagamento para status "Pago".');
      return;
    }

    const payload = {
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      tipo: form.tipo,
      status: form.status,
      dataVencimento: form.dataVencimento,
      dataPagamento: form.status === 'PAGO' ? form.dataPagamento : undefined,
      categoriaId: form.categoriaId || undefined,
      parcelas: parseInt(form.parcelas) || 1,
    };

    try {
      setLoading(true);
      await financeiroService.criarLancamento(payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Erro ao salvar lançamento.';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl py-3.5 px-5 text-[var(--text-main)] placeholder:text-gray-400 focus:outline-none focus:border-blue-500 transition-all font-bold shadow-sm';
  const labelCls = 'block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1.5 ml-1';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--bg-card)] border border-[var(--border-main)] w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div>
             <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic">Novo Lançamento</h3>
             <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Fluxo de Caixa</p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">

          {/* Tipo */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { v: 'RECEITA', label: 'RECEITA (+)', active: 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400' },
              { v: 'DESPESA', label: 'DESPESA (−)', active: 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400' },
            ].map(({ v, label, active }) => (
              <button
                key={v}
                type="button"
                onClick={() => set('tipo', v)}
                className={clsx(
                  "py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm",
                  form.tipo === v ? active : 'bg-gray-50 dark:bg-black/20 border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <label className={labelCls}>Descrição da Operação</label>
            <input
              required
              type="text"
              placeholder="Ex: Mensalidade, Aluguel, Fornecedor..."
              className={inputCls}
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
            />
          </div>

          {/* Valor + Parcelas */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className={labelCls}>Valor (R$)</label>
              <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[10px] font-black">R$</span>
                 <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  className={clsx(inputCls, "pl-11 font-black", form.tipo === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}
                  value={form.valor}
                  onChange={(e) => set('valor', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Parcelas</label>
              <input
                type="number"
                min="1"
                max="60"
                className={clsx(inputCls, "text-center font-black")}
                value={form.parcelas}
                onChange={(e) => set('parcelas', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
             {/* Vencimento */}
             <div className="space-y-2">
                <label className={labelCls}>Vencimento</label>
                <input
                  required
                  type="date"
                  className={clsx(inputCls, "text-xs")}
                  value={form.dataVencimento}
                  onChange={(e) => set('dataVencimento', e.target.value)}
                />
             </div>

             {/* Status */}
             <div className="space-y-2">
                <label className={labelCls}>Status</label>
                <select
                  className={clsx(inputCls, "appearance-none font-bold")}
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="PENDENTE">⏳ Pendente</option>
                  <option value="PAGO">✅ Pago / Recebido</option>
                  <option value="ATRASADO">⚠️ Atrasado</option>
                </select>
             </div>
          </div>

          {/* Data de Pagamento — aparece só quando PAGO */}
          {form.status === 'PAGO' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
              <label className={labelCls}>Confirmação de Liquidação</label>
              <input
                required
                type="date"
                className={clsx(inputCls, "text-xs border-emerald-500/30")}
                value={form.dataPagamento}
                onChange={(e) => set('dataPagamento', e.target.value)}
              />
            </div>
          )}

          {/* Categoria */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className={labelCls} style={{ margin: 0 }}>Classificação</label>
              <button
                type="button"
                onClick={() => setCreatingCat((v) => !v)}
                className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 transition-all"
              >
                {creatingCat ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {creatingCat ? 'CANCELAR' : 'NOVA CATEGORIA'}
              </button>
            </div>

            {creatingCat ? (
              <div className="flex flex-col gap-3 p-5 bg-blue-500/5 border border-blue-500/20 rounded-3xl animate-in slide-in-from-top-2 duration-300 shadow-sm">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome da categoria..."
                  className={inputCls}
                  value={novaCat.nome}
                  onChange={(e) => setNovaCat((p) => ({ ...p, nome: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), salvarCategoria())}
                />
                <div className="grid grid-cols-2 gap-3">
                  {['RECEITA', 'DESPESA'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNovaCat((p) => ({ ...p, tipo: t }))}
                      className={clsx(
                        "py-2.5 rounded-xl text-[9px] font-black border transition-all shadow-sm",
                        novaCat.tipo === t
                          ? t === 'RECEITA'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                          : 'bg-white dark:bg-black/20 border-[var(--border-main)] text-[var(--text-muted)]'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={savingCat || !novaCat.nome.trim()}
                  onClick={salvarCategoria}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                >
                  {savingCat
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Check className="w-3.5 h-3.5" /> Criar e selecionar</>}
                </button>
              </div>
            ) : (
              <select
                className={clsx(inputCls, "appearance-none font-bold")}
                value={form.categoriaId}
                onChange={(e) => set('categoriaId', e.target.value)}
              >
                <option value="">📁 Selecionar Classificação...</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nome} ({cat.tipo})</option>
                ))}
              </select>
            )}
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest px-5 py-4 rounded-2xl animate-shake">
              {erro}
            </div>
          )}

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 text-[10px] uppercase tracking-[0.2em]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {form.parcelas > 1 ? `Efetivar ${form.parcelas} Parcelas` : 'Efetivar Lançamento'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
