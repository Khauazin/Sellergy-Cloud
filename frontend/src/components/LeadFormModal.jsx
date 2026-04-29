import { useState, useEffect } from 'react';
import { X, Save, User, Phone, Mail, DollarSign, Tag, Info } from 'lucide-react';
import clsx from 'clsx';

export default function LeadFormModal({ lead, stages, clienteId, onClose, onSave }) {
  const isEditing = !!lead?.id;
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', valor: '', tags: '', prioridade: 'MEDIUM',
    origem: '', observacoes: '', etapaId: stages[0]?.id || ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) setForm({
      nome: lead.nome || '',
      telefone: lead.telefone || '',
      email: lead.email || '',
      valor: lead.valor || '',
      tags: lead.tags || '',
      prioridade: lead.prioridade || 'MEDIUM',
      origem: lead.origem || '',
      observacoes: lead.observacoes || '',
      etapaId: lead.etapaId || stages[0]?.id || ''
    });
  }, [lead, stages]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        clienteId,
        valor: form.valor ? parseFloat(form.valor) : 0,
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
          <button onClick={onClose} className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition-all text-[var(--text-muted)]">
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
              <label className={labelCls}>Valor Estimado (R$)</label>
              <input className={clsx(inputCls, "font-black text-emerald-600 dark:text-emerald-400")} type="number" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>E-mail Principal</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
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
                <label className={labelCls}>Serviços / Tags</label>
                <input className={inputCls} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Ex: Botox, Lipo..." />
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
