import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, Check, Loader2 } from 'lucide-react';
import financeiroService from '../../services/financeiroService';
import clsx from 'clsx';

const TIPO_CLS = {
  RECEITA: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  DESPESA: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
};

export default function ModalCategorias({ isOpen, onClose }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [erro, setErro] = useState('');

  const [nova, setNova] = useState({ nome: '', tipo: 'RECEITA' });

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await financeiroService.listarCategorias();
      setCategorias(data);
    } catch {
      setErro('Erro ao carregar categorias.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setErro('');
    setNova({ nome: '', tipo: 'RECEITA' });
    carregar();
  }, [isOpen]);

  const handleCriar = async () => {
    if (!nova.nome.trim()) return;
    setErro('');
    setSaving(true);
    try {
      await financeiroService.criarCategoria(nova);
      setNova({ nome: '', tipo: 'RECEITA' });
      await carregar();
    } catch {
      setErro('Erro ao criar categoria.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluir = async (id) => {
    setDeleting(id);
    try {
      await financeiroService.excluirCategoria(id);
      await carregar();
    } catch {
      setErro('Não foi possível excluir. A categoria pode estar em uso.');
    } finally {
      setDeleting(null);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-xl py-2.5 px-4 text-[var(--text-main)] placeholder:text-gray-400 focus:outline-none focus:border-blue-500 transition-all text-sm font-bold shadow-sm';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-colors duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--bg-card)] border border-[var(--border-main)] w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-6 border-b border-[var(--border-main)] flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
          <div>
             <h3 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter italic flex items-center gap-3">
                <Tag className="w-5 h-5 text-blue-500" /> Classificações
             </h3>
             <p className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Estrutura de Contas</p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar bg-[var(--bg-card)]">

          {/* Formulário de nova categoria */}
          <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-[2rem] space-y-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-[0.2em] ml-1">Registrar Nova Classificação</p>

            <input
              type="text"
              placeholder="Nome da categoria..."
              className={clsx("w-full", inputCls)}
              value={nova.nome}
              onChange={(e) => setNova((p) => ({ ...p, nome: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleCriar()}
            />

            <div className="grid grid-cols-2 gap-3">
              {['RECEITA', 'DESPESA'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNova((p) => ({ ...p, tipo: t }))}
                  className={clsx(
                    "py-2.5 rounded-xl text-[9px] font-black border transition-all shadow-sm uppercase tracking-widest",
                    nova.tipo === t
                      ? t === 'RECEITA'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                      : 'bg-white dark:bg-black/20 border-[var(--border-main)] text-[var(--text-muted)]'
                  )}
                >
                  {t === 'RECEITA' ? '↑ Receita' : '↓ Despesa'}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={saving || !nova.nome.trim()}
              onClick={handleCriar}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/20"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><Plus className="w-4 h-4" /> Efetivar Registro</>
              )}
            </button>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest px-5 py-4 rounded-2xl">
              {erro}
            </div>
          )}

          {/* Lista de categorias */}
          <div className="space-y-4">
            <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] px-1">
              Classificações Ativas ({categorias.length})
            </p>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : categorias.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] text-sm italic py-10 opacity-60 font-medium">
                Nenhuma categoria identificada na base.
              </p>
            ) : (
              <div className="space-y-2.5">
                {categorias.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl hover:border-blue-500/20 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <span className={clsx("text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest shadow-sm", TIPO_CLS[cat.tipo])}>
                        {cat.tipo}
                      </span>
                      <span className="text-[var(--text-main)] text-sm font-black italic uppercase opacity-90">{cat.nome}</span>
                    </div>
                    <button
                      onClick={() => handleExcluir(cat.id)}
                      disabled={deleting === cat.id}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100"
                      title="Excluir categoria"
                    >
                      {deleting === cat.id ? (
                        <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
