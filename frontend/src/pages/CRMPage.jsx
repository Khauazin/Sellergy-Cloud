import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Phone, Mail, Tag, ArrowRight, ArrowLeft,
  Clock, History, LayoutGrid, List, MoreHorizontal
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Textarea, Select, Badge, Avatar,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider,
  useToast, Tabs, TabsList, TabsTrigger
} from '../components/ui';
import Modal from '../components/Modal';
import { formatarTelefoneBR } from '../utils/formatTelefone';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PRIORIDADES = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
];

export default function CRMPage() {
  const toast = useToast();
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [view, setView] = useState('kanban');

  const [modalLead, setModalLead] = useState({ open: false, data: null });
  const [modalStage, setModalStage] = useState({ open: false, data: null });
  const [drawerLead, setDrawerLead] = useState({ open: false, lead: null });

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [s, l] = await Promise.all([
        api.get('/crm/stages').catch(() => ({ data: [] })),
        api.get('/crm/leads').catch(() => ({ data: [] })),
      ]);
      setStages(s.data || []);
      setLeads(l.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const leadsFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) => l.nome?.toLowerCase().includes(q) ||
             l.telefone?.includes(q) ||
             l.email?.toLowerCase().includes(q) ||
             l.tags?.toLowerCase().includes(q)
    );
  }, [leads, busca]);

  const leadsPorEtapa = useMemo(() => {
    const map = {};
    stages.forEach((s) => { map[s.id] = []; });
    map['_sem_etapa'] = [];
    leadsFiltered.forEach((l) => {
      if (l.etapaId && map[l.etapaId]) map[l.etapaId].push(l);
      else map['_sem_etapa'].push(l);
    });
    return map;
  }, [stages, leadsFiltered]);

  const handleSalvarLead = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/crm/leads/${dados.id}`, dados);
        toast.success('Lead atualizado');
      } else {
        await api.post('/crm/leads', dados);
        toast.success('Lead criado');
      }
      setModalLead({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleExcluirLead = async (lead) => {
    if (!confirm(`Excluir lead "${lead.nome}"?`)) return;
    try {
      await api.delete(`/crm/leads/${lead.id}`);
      toast.success('Lead excluido');
      setDrawerLead({ open: false, lead: null });
      carregar();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleMoverLead = async (lead, etapaId) => {
    try {
      await api.put(`/crm/leads/${lead.id}`, { ...lead, etapaId });
      toast.success('Lead movido');
      carregar();
    } catch {
      toast.error('Erro ao mover');
    }
  };

  const handleSalvarStage = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/crm/stages/${dados.id}`, dados);
        toast.success('Etapa atualizada');
      } else {
        await api.post('/crm/stages', dados);
        toast.success('Etapa criada');
      }
      setModalStage({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar etapa');
    }
  };

  const handleExcluirStage = async (stage) => {
    if (!confirm(`Excluir etapa "${stage.nome}"? Os leads ficarao sem etapa.`)) return;
    try {
      await api.delete(`/crm/stages/${stage.id}`);
      toast.success('Etapa excluida');
      carregar();
    } catch {
      toast.error('Erro ao excluir etapa');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px] max-w-md">
          <SearchBar
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone, email ou tag..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList variant="pills">
              <TabsTrigger value="kanban" variant="pills" icon={LayoutGrid}>Kanban</TabsTrigger>
              <TabsTrigger value="lista" variant="pills" icon={List}>Lista</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="secondary" icon={Plus} onClick={() => setModalStage({ open: true, data: null })}>
            Nova etapa
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setModalLead({ open: true, data: null })}>
            Novo lead
          </Button>
        </div>
      </div>

      {carregando ? (
        <Card padding="lg">
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div>
        </Card>
      ) : leads.length === 0 && stages.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={LayoutGrid}
            title="CRM ainda vazio"
            description="Comece criando suas etapas (ex: Novo, Qualificado, Negociacao, Fechado) e depois cadastre os primeiros leads."
            action={
              <div className="flex gap-2 justify-center">
                <Button variant="secondary" icon={Plus} onClick={() => setModalStage({ open: true, data: null })}>
                  Criar primeira etapa
                </Button>
                <Button variant="primary" icon={Plus} onClick={() => setModalLead({ open: true, data: null })}>
                  Criar primeiro lead
                </Button>
              </div>
            }
          />
        </Card>
      ) : view === 'kanban' ? (
        <KanbanView
          stages={stages}
          leadsPorEtapa={leadsPorEtapa}
          onSelecionarLead={(l) => setDrawerLead({ open: true, lead: l })}
          onEditarStage={(s) => setModalStage({ open: true, data: s })}
          onExcluirStage={handleExcluirStage}
          onMoverLead={handleMoverLead}
        />
      ) : (
        <ListaView
          leads={leadsFiltered}
          stages={stages}
          onSelecionarLead={(l) => setDrawerLead({ open: true, lead: l })}
        />
      )}

      <ModalLead
        isOpen={modalLead.open}
        onClose={() => setModalLead({ open: false, data: null })}
        lead={modalLead.data}
        stages={stages}
        onSalvar={handleSalvarLead}
      />

      <ModalStage
        isOpen={modalStage.open}
        onClose={() => setModalStage({ open: false, data: null })}
        stage={modalStage.data}
        onSalvar={handleSalvarStage}
      />

      <DrawerLead
        isOpen={drawerLead.open}
        onClose={() => setDrawerLead({ open: false, lead: null })}
        lead={drawerLead.lead}
        stages={stages}
        onEditar={() => {
          setModalLead({ open: true, data: drawerLead.lead });
          setDrawerLead({ open: false, lead: null });
        }}
        onExcluir={() => handleExcluirLead(drawerLead.lead)}
        onMover={(etapaId) => {
          handleMoverLead(drawerLead.lead, etapaId);
          setDrawerLead({ open: false, lead: null });
        }}
      />
    </div>
  );
}

function KanbanView({ stages, leadsPorEtapa, onSelecionarLead, onEditarStage, onExcluirStage, onMoverLead }) {
  const stagesOrdenadas = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const semEtapa = leadsPorEtapa['_sem_etapa'] || [];

  return (
    <div className="overflow-x-auto custom-scrollbar -mx-4 px-4 pb-4">
      <div className="flex gap-3 min-w-max">
        {semEtapa.length > 0 && (
          <KanbanColumn
            stage={{ id: '_sem_etapa', nome: 'Sem etapa', cor: null }}
            leads={semEtapa}
            stages={stages}
            onSelecionarLead={onSelecionarLead}
            onMoverLead={onMoverLead}
            isSemEtapa
          />
        )}
        {stagesOrdenadas.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={leadsPorEtapa[stage.id] || []}
            stages={stages}
            onSelecionarLead={onSelecionarLead}
            onMoverLead={onMoverLead}
            onEditarStage={() => onEditarStage(stage)}
            onExcluirStage={() => onExcluirStage(stage)}
          />
        ))}
      </div>
    </div>
  );
}

function KanbanColumn({ stage, leads, stages, onSelecionarLead, onMoverLead, onEditarStage, onExcluirStage, isSemEtapa }) {
  const totalValor = leads.reduce((acc, l) => acc + Number(l.valor || 0), 0);

  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between gap-2 px-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {stage.cor && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stage.cor }} />}
          <span className="text-sm font-semibold tracking-tight text-[var(--text-main)] truncate">{stage.nome}</span>
          <Badge variant="neutral" size="sm">{leads.length}</Badge>
        </div>
        {!isSemEtapa && (
          <Dropdown
            trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}
          >
            <DropdownItem icon={Edit2} onClick={onEditarStage}>Editar</DropdownItem>
            <DropdownDivider />
            <DropdownItem icon={Trash2} variant="danger" onClick={onExcluirStage}>Excluir</DropdownItem>
          </Dropdown>
        )}
      </div>
      {totalValor > 0 && (
        <div className="text-xs text-[var(--text-muted)] px-2 mb-2 tabular-nums">{fmtBRL(totalValor)}</div>
      )}

      <div className="bg-[var(--bg-subtle)]/50 rounded-xl p-2 flex-1 min-h-[200px] space-y-2">
        {leads.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--text-muted)]">Vazio</div>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              stages={stages}
              currentStageId={isSemEtapa ? null : stage.id}
              onClick={() => onSelecionarLead(lead)}
              onMover={onMoverLead}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({ lead, stages, currentStageId, onClick, onMover }) {
  const tags = lead.tags?.split(',').map((t) => t.trim()).filter(Boolean) || [];
  const stagesOrdenadas = [...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const idx = stagesOrdenadas.findIndex((s) => s.id === currentStageId);
  const proxima = idx >= 0 && idx < stagesOrdenadas.length - 1 ? stagesOrdenadas[idx + 1] : null;
  const anterior = idx > 0 ? stagesOrdenadas[idx - 1] : null;

  const prioridadeColor = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'neutral' }[lead.prioridade] || 'neutral';

  return (
    <div
      onClick={onClick}
      className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-3 cursor-pointer hover:border-[var(--text-muted)] hover:shadow-[var(--shadow-xs)] transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar name={lead.nome} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">{lead.nome}</div>
            {lead.telefone && <div className="text-[11px] text-[var(--text-muted)] truncate">{lead.telefone}</div>}
          </div>
        </div>
        {lead.prioridade && (
          <Badge variant={prioridadeColor} size="sm">
            {lead.prioridade === 'HIGH' ? 'Alta' : lead.prioridade === 'MEDIUM' ? 'Media' : 'Baixa'}
          </Badge>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-medium">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        {lead.valor > 0 ? (
          <span className="text-xs font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(lead.valor)}</span>
        ) : <span />}
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {anterior && (
            <button
              title={`Mover para ${anterior.nome}`}
              onClick={() => onMover(lead, anterior.id)}
              className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <ArrowLeft size={12} />
            </button>
          )}
          {proxima && (
            <button
              title={`Mover para ${proxima.nome}`}
              onClick={() => onMover(lead, proxima.id)}
              className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ListaView({ leads, stages, onSelecionarLead }) {
  if (leads.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState icon={List} title="Nenhum lead encontrado" description="Tente ajustar a busca ou criar um novo lead." />
      </Card>
    );
  }
  const getStageNome = (etapaId) => stages.find((s) => s.id === etapaId)?.nome || '—';

  return (
    <Card padding="none">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border-main)]">
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Lead</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Etapa</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Contato</th>
            <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Valor</th>
            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              onClick={() => onSelecionarLead(l)}
              className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-5">
                <div className="flex items-center gap-3">
                  <Avatar name={l.nome} size="sm" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{l.nome}</div>
                    {l.tags && <div className="text-[11px] text-[var(--text-muted)]">{l.tags}</div>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-5"><Badge variant="neutral" size="sm">{getStageNome(l.etapaId)}</Badge></td>
              <td className="py-3 px-5 text-xs text-[var(--text-secondary)]">{l.telefone || l.email || '—'}</td>
              <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(l.valor)}</td>
              <td className="py-3 px-5 text-xs text-[var(--text-muted)]">{new Date(l.atualizadoEm).toLocaleDateString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ModalLead({ isOpen, onClose, lead, stages, onSalvar }) {
  const [form, setForm] = useState({
    nome: '', telefone: '', email: '', valor: 0, etapaId: '', tags: '',
    prioridade: 'MEDIUM', origem: 'MANUAL', observacoes: '',
  });

  useEffect(() => {
    if (lead) setForm({ ...lead, valor: lead.valor || 0, tags: lead.tags || '', observacoes: lead.observacoes || '' });
    else setForm({ nome: '', telefone: '', email: '', valor: 0, etapaId: '', tags: '', prioridade: 'MEDIUM', origem: 'MANUAL', observacoes: '' });
  }, [lead, isOpen]);

  const handleSubmit = (e) => { e.preventDefault(); onSalvar(form); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={lead ? 'Editar lead' : 'Novo lead'} description="Cadastre as informacoes do contato." size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          <Input
            label="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: formatarTelefoneBR(e.target.value) })}
            placeholder="(11) 99999-9999"
            maxLength={15}
            inputMode="tel"
          />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Valor estimado (R$)" type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
          <Select label="Etapa" value={form.etapaId || ''} onChange={(e) => setForm({ ...form, etapaId: e.target.value })} placeholder="Sem etapa" options={stages.map((s) => ({ value: s.id, label: s.nome }))} />
          <Select label="Prioridade" value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} options={PRIORIDADES} placeholder="" />
          <Input label="Origem" value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} placeholder="MANUAL, BOT, INSTAGRAM..." />
          <Input label="Tags (separadas por virgula)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="cliente vip, lead quente" />
        </div>
        <Textarea label="Observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{lead ? 'Salvar' : 'Criar lead'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ModalStage({ isOpen, onClose, stage, onSalvar }) {
  const [form, setForm] = useState({ nome: '', ordem: 0, cor: '#C4704A' });

  useEffect(() => {
    if (stage) setForm({ nome: stage.nome, ordem: stage.ordem ?? 0, cor: stage.cor || '#C4704A' });
    else setForm({ nome: '', ordem: 0, cor: '#C4704A' });
  }, [stage, isOpen]);

  const handleSubmit = (e) => { e.preventDefault(); onSalvar(form); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={stage ? 'Editar etapa' : 'Nova etapa'} description="Etapas organizam o funil de vendas." size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Qualificacao, Proposta..." required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ordem"
            type="number"
            min={0}
            step={1}
            value={form.ordem}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setForm({ ...form, ordem: Number.isFinite(n) && n >= 0 ? n : 0 });
            }}
          />
          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">Cor</label>
            <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="w-full h-11 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] cursor-pointer" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{stage ? 'Salvar' : 'Criar etapa'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerLead({ isOpen, onClose, lead, stages, onEditar, onExcluir, onMover }) {
  const toast = useToast();
  const [historico, setHistorico] = useState([]);
  const [novaObs, setNovaObs] = useState('');
  const [carregandoObs, setCarregandoObs] = useState(false);

  useEffect(() => {
    if (lead?.id) {
      api.get(`/crm/leads/${lead.id}/history`)
        .then((r) => setHistorico(r.data || []))
        .catch(() => setHistorico([]));
    }
  }, [lead?.id]);

  const adicionarObs = async () => {
    if (!novaObs.trim()) return;
    setCarregandoObs(true);
    try {
      await api.post(`/crm/leads/${lead.id}/history`, { observacoes: novaObs });
      const r = await api.get(`/crm/leads/${lead.id}/history`);
      setHistorico(r.data || []);
      setNovaObs('');
      toast.success('Observacao adicionada');
    } catch {
      toast.error('Erro ao adicionar');
    } finally {
      setCarregandoObs(false);
    }
  };

  if (!lead) return null;
  const stageAtual = stages.find((s) => s.id === lead.etapaId);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={lead.nome}
      description={lead.email || lead.telefone}
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir</Button>
          <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar lead</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Avatar name={lead.nome} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {stageAtual && <Badge variant="neutral" size="sm">{stageAtual.nome}</Badge>}
              {lead.prioridade && (
                <Badge variant={lead.prioridade === 'HIGH' ? 'danger' : lead.prioridade === 'MEDIUM' ? 'warning' : 'neutral'} size="sm">
                  {lead.prioridade === 'HIGH' ? 'Alta' : lead.prioridade === 'MEDIUM' ? 'Media' : 'Baixa'} prioridade
                </Badge>
              )}
            </div>
            {lead.valor > 0 && <div className="text-lg font-semibold text-[var(--text-main)] mt-1 tabular-nums">{fmtBRL(lead.valor)}</div>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {lead.telefone && (
            <a href={`tel:${lead.telefone}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
              <Phone size={14} /> {lead.telefone}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
              <Mail size={14} /> {lead.email}
            </a>
          )}
        </div>

        {stages.length > 0 && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Mover para etapa</div>
            <div className="flex flex-wrap gap-1.5">
              {[...stages].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onMover(s.id)}
                  disabled={s.id === lead.etapaId}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    s.id === lead.etapaId
                      ? 'bg-[var(--primary)] text-[var(--text-on-primary)] border-[var(--primary)] cursor-default'
                      : 'border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  {s.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {lead.tags && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.split(',').map((t, i) => (<Badge key={i} variant="accent" size="sm" icon={Tag}>{t.trim()}</Badge>))}
            </div>
          </div>
        )}

        {lead.observacoes && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Observacoes</div>
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-subtle)] rounded-xl p-3">{lead.observacoes}</div>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 mb-2">
            <History size={14} className="text-[var(--text-muted)]" />
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">Historico ({historico.length})</div>
          </div>
          <div className="space-y-2 mb-3">
            <Textarea value={novaObs} onChange={(e) => setNovaObs(e.target.value)} placeholder="Adicionar observacao..." rows={2} />
            <Button variant="secondary" size="sm" onClick={adicionarObs} loading={carregandoObs} disabled={!novaObs.trim()}>Adicionar</Button>
          </div>
          {historico.length === 0 ? (
            <div className="text-xs text-[var(--text-muted)] text-center py-4">Sem registros ainda</div>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => (
                <div key={h.id} className="flex gap-2 text-xs border-l-2 border-[var(--border-main)] pl-3 py-1">
                  <Clock size={11} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[var(--text-secondary)]">{h.observacoes}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{h.acao} · {new Date(h.criadoEm).toLocaleString('pt-BR')}</div>
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
