import { useState, useEffect } from 'react';
import { X, ArrowRight, Plus, User, Mail, Phone, DollarSign, Tag, Globe, Flag, Edit2, Trash2, ShoppingCart, Loader2 } from 'lucide-react';
import api from '../services/api';
import ModalVendaLead from './Vendas/ModalVendaLead';
import clsx from 'clsx';

const PRIORITY_LABEL = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
const PRIORITY_COLOR_CLS = { LOW: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10', MEDIUM: 'text-amber-500 border-amber-500/20 bg-amber-500/10', HIGH: 'text-red-500 border-red-500/20 bg-red-500/10' };

const ACTION_ICON = {
  CRIADO: { bg: 'bg-blue-500/10', color: 'text-blue-500', symbol: '✦' },
  MOVIDO: { bg: 'bg-purple-500/10', color: 'text-purple-500', symbol: '→' },
  EDITADO: { bg: 'bg-amber-500/10', color: 'text-amber-500', symbol: '✎' },
  OBSERVACAO: { bg: 'bg-emerald-500/10', color: 'text-emerald-500', symbol: '💬' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? 's' : ''}`;
}

export default function LeadDetailPanel({ lead, stages, onClose, onUpdate, onDelete }) {
  const [history, setHistory] = useState([]);
  const [obs, setObs] = useState('');
  const [addingObs, setAddingObs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isVendaModalOpen, setIsVendaModalOpen] = useState(false);

  useEffect(() => {
    if (!lead?.id) return;
    api.get(`/crm/leads/${lead.id}/history`).then(r => setHistory(r.data)).catch(() => {});
  }, [lead]);

  const handleAddObs = async () => {
    if (!obs.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/crm/leads/${lead.id}/history`, { observacoes: obs });
      setHistory(prev => [res.data, ...prev]);
      setObs('');
      setAddingObs(false);
    } finally {
      setSaving(false);
    }
  };

  const handleVendaSucesso = () => {
    api.get(`/crm/leads/${lead.id}/history`).then(r => setHistory(r.data));
  };

  if (!lead) return null;

  const stageName = stages.find(s => s.id === lead.etapaId)?.nome || '—';
  const priorityCls = PRIORITY_COLOR_CLS[lead.prioridade] || PRIORITY_COLOR_CLS.MEDIUM;

  return (
    <div className="fixed top-0 right-0 h-screen w-full sm:w-[450px] bg-[var(--bg-card)] backdrop-blur-2xl border-l border-[var(--border-main)] flex flex-col z-[9999] shadow-2xl animate-in slide-in-from-right duration-300 transition-colors">
      
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-main)] bg-gray-50/50 dark:bg-black/20 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-xl shadow-blue-500/20 flex-shrink-0">
              {lead.nome?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tighter truncate leading-none mb-2">{lead.nome}</h2>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {stageName}
                </span>
                <span className={clsx("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shadow-sm", priorityCls)}>
                  {PRIORITY_LABEL[lead.prioridade]}
                </span>
              </div>
            </div>
          </div>
          {lead.tags && (
            <div className="flex gap-1.5 flex-wrap">
              {lead.tags.split(',').map(t => (
                <span key={t} className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-white/5 text-[var(--text-muted)] border border-[var(--border-main)]">
                  {t.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex gap-1.5">
          <button onClick={() => setIsVendaModalOpen(true)} className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:scale-105 transition-all shadow-sm">
            <ShoppingCart size={18} />
          </button>
          <button onClick={() => onDelete(lead)} className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:scale-105 transition-all shadow-sm">
            <Trash2 size={18} />
          </button>
          <button onClick={() => onUpdate(lead)} className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-[var(--text-muted)] border border-[var(--border-main)] hover:text-[var(--text-main)] transition-all shadow-sm">
            <Edit2 size={18} />
          </button>
          <button onClick={onClose} className="p-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-[var(--text-muted)] border border-[var(--border-main)] hover:text-[var(--text-main)] transition-all shadow-sm">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-[var(--bg-card)]">

        {/* Histórico Ativo */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-1.5 h-5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Activity Log</h3>
             </div>
             <button onClick={() => setAddingObs(v => !v)} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-1.5 transition-all hover:bg-blue-500/10">
               <Plus size={12} /> Registrar Ação
             </button>
          </div>

          {addingObs && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Detalhe o próximo passo ou contato..."
                rows={3}
                className="w-full bg-gray-50 dark:bg-black/40 border border-[var(--border-main)] rounded-2xl p-4 text-[var(--text-main)] text-sm focus:outline-none focus:border-blue-500 transition-all resize-none shadow-inner font-medium placeholder:text-gray-400"
              />
              <div className="flex gap-2">
                <button onClick={handleAddObs} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save size={12} />} SALVAR LOG
                </button>
                <button onClick={() => setAddingObs(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-white/5 text-[var(--text-muted)] text-[10px] font-black uppercase rounded-xl border border-[var(--border-main)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {history.length === 0 && (
              <div className="text-center py-10 opacity-30">
                 <Loader2 size={24} className="mx-auto mb-2 text-[var(--text-muted)]" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma atividade registrada.</p>
              </div>
            )}
            {history.map(h => {
              const hStyle = ACTION_ICON[h.acao] || ACTION_ICON.EDITADO;
              return (
                <div key={h.id} className="flex gap-4 group">
                  <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm", hStyle.bg, hStyle.color)}>
                    {hStyle.symbol}
                  </div>
                  <div className="flex-1 pb-4 border-b border-[var(--border-main)] last:border-0">
                    <p className="text-sm text-[var(--text-main)] font-medium leading-relaxed opacity-90">{h.observacoes}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-tighter opacity-60 italic">{timeAgo(h.criadoEm)}</span>
                       <div className="w-1 h-1 rounded-full bg-[var(--border-main)]" />
                       <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{h.acao}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info do Negócio */}
        <div className="bg-gray-50 dark:bg-white/5 rounded-[2rem] p-6 border border-[var(--border-main)] space-y-4 shadow-sm">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">Business Intel</h3>
          <div className="space-y-4">
            {[
              { icon: <DollarSign size={14}/>, label: 'Potencial', value: lead.valor ? `R$ ${Number(lead.valor).toLocaleString('pt-BR')}` : 'R$ 0,00', valColor: 'text-emerald-600 dark:text-emerald-400' },
              { icon: <Tag size={14}/>, label: 'Funil', value: stageName },
              { icon: <Globe size={14}/>, label: 'Canal', value: lead.origem || 'Direto' },
              { icon: <Flag size={14}/>, label: 'Score', value: PRIORITY_LABEL[lead.prioridade] },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3 text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-tighter">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <span className={clsx("text-xs font-black italic uppercase tracking-tight", item.valColor || "text-[var(--text-main)]")}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info do Contato */}
        <div className="bg-gray-50 dark:bg-white/5 rounded-[2rem] p-6 border border-[var(--border-main)] space-y-4 shadow-sm">
          <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] ml-1">Contact Data</h3>
          <div className="space-y-4">
            {[
              { icon: <Mail size={14}/>, value: lead.email || 'Não informado' },
              { icon: <Phone size={14}/>, value: lead.telefone || 'Não informado' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-1">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-black/20 border border-[var(--border-main)] flex items-center justify-center text-[var(--text-muted)]">
                  {item.icon}
                </div>
                <span className="text-sm font-black text-[var(--text-main)] tracking-tight opacity-80">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ModalVendaLead
        isOpen={isVendaModalOpen}
        onClose={() => setIsVendaModalOpen(false)}
        lead={lead}
        onSuccess={handleVendaSucesso}
      />
    </div>
  );
}
