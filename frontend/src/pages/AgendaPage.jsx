import { useState, useEffect, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Calendar, Clock, Phone, Edit2, Trash2,
  CheckCircle2, XCircle, Sparkles
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, Drawer, useToast, Tabs, TabsList, TabsTrigger, Combobox
} from '../components/ui';
import Modal from '../components/Modal';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABELS = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  CONFIRMED: { label: 'Confirmado', variant: 'success' },
  CANCELED: { label: 'Cancelado', variant: 'danger' },
  COMPLETED: { label: 'Concluido', variant: 'neutral' },
};

export default function AgendaPage() {
  const toast = useToast();
  const [view, setView] = useState('dia');
  const [dataAtual, setDataAtual] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState([]);
  const [variacoes, setVariacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, ag: null });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dataAtual]);

  useEffect(() => {
    carregarVariacoes();
  }, []);

  const carregarVariacoes = async () => {
    try {
      const r = await api.get('/catalogo');
      const flat = [];
      (r.data || []).forEach((p) => {
        (p.variacoes || []).forEach((v) => flat.push({ ...v, produto: p }));
      });
      setVariacoes(flat);
    } catch {
      setVariacoes([]);
    }
  };

  const carregar = async () => {
    setCarregando(true);
    try {
      let url = '/agenda';
      if (view === 'dia') {
        url += `?date=${dataAtual.toISOString().split('T')[0]}`;
      } else {
        url += `?month=${dataAtual.getMonth() + 1}&year=${dataAtual.getFullYear()}`;
      }
      const r = await api.get(url);
      setAgendamentos(r.data || []);
    } catch {
      setAgendamentos([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/agenda/${dados.id}`, dados);
        toast.success('Agendamento atualizado');
      } else {
        await api.post('/agenda', dados);
        toast.success('Agendamento criado');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (ag) => {
    if (!confirm(`Excluir agendamento de ${ag.nomeCliente}?`)) return;
    try {
      await api.delete(`/agenda/${ag.id}`);
      toast.success('Agendamento excluido');
      setDrawer({ open: false, ag: null });
      carregar();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleMudarStatus = async (ag, status) => {
    try {
      await api.patch(`/agenda/${ag.id}/status`, { status });
      toast.success(`Marcado como ${STATUS_LABELS[status]?.label?.toLowerCase()}`);
      setDrawer({ open: false, ag: null });
      carregar();
    } catch {
      toast.error('Erro ao mudar status');
    }
  };

  const navegar = (dir) => {
    const nova = new Date(dataAtual);
    if (view === 'dia') nova.setDate(nova.getDate() + dir);
    else nova.setMonth(nova.getMonth() + dir);
    setDataAtual(nova);
  };

  const irHoje = () => setDataAtual(new Date());

  const fmtData = view === 'dia'
    ? dataAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : dataAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} variant="secondary" size="md" onClick={() => navegar(-1)} ariaLabel="Anterior" />
          <Button variant="ghost" size="md" onClick={irHoje}>Hoje</Button>
          <IconButton icon={ChevronRight} variant="secondary" size="md" onClick={() => navegar(1)} ariaLabel="Proximo" />
          <div className="ml-2 text-base font-semibold tracking-tight text-[var(--text-main)] capitalize">
            {fmtData}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList variant="pills">
              <TabsTrigger value="dia" variant="pills">Dia</TabsTrigger>
              <TabsTrigger value="mes" variant="pills">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
            Novo agendamento
          </Button>
        </div>
      </div>

      {/* Conteudo */}
      {carregando ? (
        <Card padding="lg">
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div>
        </Card>
      ) : agendamentos.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Calendar}
            title="Nada agendado para esse periodo"
            description="Os agendamentos do bot ou cadastrados manualmente aparecem aqui."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
                Novo agendamento
              </Button>
            }
          />
        </Card>
      ) : view === 'dia' ? (
        <ViewDia agendamentos={agendamentos} onSelecionar={(ag) => setDrawer({ open: true, ag })} />
      ) : (
        <ViewMes agendamentos={agendamentos} dataReferencia={dataAtual} onSelecionar={(ag) => setDrawer({ open: true, ag })} />
      )}

      <ModalAgendamento
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        ag={modal.data}
        variacoes={variacoes}
        onSalvar={handleSalvar}
      />

      <DrawerAg
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, ag: null })}
        ag={drawer.ag}
        onEditar={() => {
          setModal({ open: true, data: drawer.ag });
          setDrawer({ open: false, ag: null });
        }}
        onExcluir={() => handleExcluir(drawer.ag)}
        onStatus={(s) => handleMudarStatus(drawer.ag, s)}
      />
    </div>
  );
}

function ViewDia({ agendamentos, onSelecionar }) {
  const ordenados = [...agendamentos].sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <Card padding="none">
      <div className="divide-y divide-[var(--border-subtle)]">
        {ordenados.map((ag) => {
          const data = new Date(ag.data);
          const status = STATUS_LABELS[ag.status] || { label: ag.status, variant: 'neutral' };
          return (
            <div
              key={ag.id}
              onClick={() => onSelecionar(ag)}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors"
            >
              <div className="text-center w-16 flex-shrink-0">
                <div className="text-lg font-semibold tracking-tight text-[var(--text-main)] tabular-nums">
                  {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-bold">
                  {ag.duracao}min
                </div>
              </div>
              <div className="w-px self-stretch bg-[var(--border-main)]" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
                  {ag.servico || 'Servico'}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                  <span>{ag.nomeCliente}</span>
                  {ag.telefoneCliente && <><span>·</span><span>{ag.telefoneCliente}</span></>}
                </div>
              </div>
              {ag.preco > 0 && (
                <div className="text-sm font-semibold text-[var(--text-main)] tabular-nums">
                  {fmtBRL(ag.preco)}
                </div>
              )}
              {ag.origem === 'AI' && <Badge variant="accent" size="sm" icon={Sparkles}>Bot</Badge>}
              <Badge variant={status.variant} size="sm">{status.label}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ViewMes({ agendamentos, dataReferencia, onSelecionar }) {
  // Agrupa por dia
  const porDia = useMemo(() => {
    const map = {};
    agendamentos.forEach((ag) => {
      const dia = new Date(ag.data).getDate();
      if (!map[dia]) map[dia] = [];
      map[dia].push(ag);
    });
    return map;
  }, [agendamentos]);

  const totalDias = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0).getDate();
  const primeiroDiaSemana = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1).getDay();
  const dias = [];
  for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
  for (let i = 1; i <= totalDias; i++) dias.push(i);

  const semanas = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <Card padding="md">
      <div className="grid grid-cols-7 gap-px bg-[var(--border-main)] rounded-xl overflow-hidden">
        {semanas.map((s) => (
          <div key={s} className="bg-[var(--bg-subtle)] text-center py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {s}
          </div>
        ))}
        {dias.map((dia, i) => {
          const ags = dia ? (porDia[dia] || []) : [];
          const hoje = new Date();
          const ehHoje = dia &&
            hoje.getDate() === dia &&
            hoje.getMonth() === dataReferencia.getMonth() &&
            hoje.getFullYear() === dataReferencia.getFullYear();

          return (
            <div
              key={i}
              className={`bg-[var(--bg-card)] min-h-[100px] p-2 ${dia ? '' : 'opacity-40'}`}
            >
              {dia && (
                <>
                  <div className={`text-xs font-semibold mb-1 ${ehHoje ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                    {dia}
                  </div>
                  <div className="space-y-1">
                    {ags.slice(0, 3).map((ag) => (
                      <button
                        key={ag.id}
                        onClick={() => onSelecionar(ag)}
                        className="w-full text-left text-[10px] px-1.5 py-1 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] truncate hover:bg-[var(--accent-soft)]/80 font-medium"
                      >
                        {new Date(ag.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {ag.nomeCliente}
                      </button>
                    ))}
                    {ags.length > 3 && (
                      <div className="text-[10px] text-[var(--text-muted)] px-1.5">+{ags.length - 3}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Helper: retorna o preco efetivo da variacao (catalogo se ativo, senao estoque)
function precoEfetivoVariacao(v) {
  if (!v) return 0;
  if (v.usarPrecoCatalogo && v.precoCatalogo != null) return v.precoCatalogo;
  return v.preco || 0;
}

function ModalAgendamento({ isOpen, onClose, ag, variacoes = [], onSalvar }) {
  const [form, setForm] = useState({
    nomeCliente: '', telefoneCliente: '', data: '', hora: '', duracao: 30,
    variacaoId: '', servico: '', preco: 0,
    observacoes: '', status: 'PENDING', origem: 'MANUAL',
  });

  useEffect(() => {
    if (ag) {
      const d = new Date(ag.data);
      setForm({
        ...ag,
        data: d.toISOString().split('T')[0],
        hora: d.toTimeString().slice(0, 5),
        preco: ag.preco || 0,
        variacaoId: '', // edicao mantem o servico em texto livre, sem ligar variacao
        observacoes: ag.observacoes || '',
      });
    } else {
      const agora = new Date();
      setForm({
        nomeCliente: '', telefoneCliente: '',
        data: agora.toISOString().split('T')[0],
        hora: '09:00',
        duracao: 30, variacaoId: '', servico: '', preco: 0, observacoes: '',
        status: 'PENDING', origem: 'MANUAL',
      });
    }
  }, [ag, isOpen]);

  const variacaoSel = variacoes.find((v) => v.id === form.variacaoId);

  // Quando seleciona variacao, atualiza servico e preco automaticamente
  const handleSelectVariacao = (id, opt) => {
    if (id) {
      const v = variacoes.find((x) => x.id === id);
      if (v) {
        setForm((f) => ({
          ...f,
          variacaoId: id,
          servico: `${v.produto?.nome} - ${v.nome}`,
          preco: precoEfetivoVariacao(v),
        }));
      }
    } else {
      setForm((f) => ({ ...f, variacaoId: '', servico: '', preco: 0 }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataCompleta = new Date(`${form.data}T${form.hora}`);
    onSalvar({
      ...form,
      data: dataCompleta.toISOString(),
      duracao: parseInt(form.duracao) || 30,
      preco: parseFloat(form.preco) || 0,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ag ? 'Editar agendamento' : 'Novo agendamento'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nome do cliente" value={form.nomeCliente} onChange={(e) => setForm({ ...form, nomeCliente: e.target.value })} required />
          <Input label="Telefone" value={form.telefoneCliente} onChange={(e) => setForm({ ...form, telefoneCliente: e.target.value })} />
          <Input label="Data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          <Input label="Hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required />
        </div>

        {/* Servico vinculado a variacao */}
        <div className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]/40">
          <div className="text-sm font-semibold text-[var(--text-main)]">Servico / Produto</div>
          <Combobox
            label="Buscar produto/servico do catalogo"
            value={form.variacaoId}
            onChange={handleSelectVariacao}
            options={variacoes.map((v) => ({
              value: v.id,
              label: `${v.produto?.nome} - ${v.nome}`,
              sublabel: `${precoEfetivoVariacao(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${v.produto?.tipo === 'FISICO' ? ` · ${v.estoqueAtual} em estoque` : ''}`,
              badge: v.usarPrecoCatalogo ? 'Catalogo' : null,
            }))}
            placeholder="Selecione um produto cadastrado"
            clearable
            hint="Ou preencha manualmente abaixo"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Servico (texto livre)"
              value={form.servico}
              onChange={(e) => setForm({ ...form, servico: e.target.value, variacaoId: '' })}
              placeholder="Ex: Corte de cabelo"
              disabled={!!form.variacaoId}
              hint={form.variacaoId ? 'Vinculado a um produto' : 'Edite se precisar'}
            />
            <Input
              label="Preco (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
              disabled={!!form.variacaoId}
              hint={form.variacaoId ? `Puxado do ${variacaoSel?.usarPrecoCatalogo ? 'catalogo' : 'estoque'}` : 'Manual'}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Duracao (min)" type="number" min="1" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            placeholder=""
            options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </div>

        <Textarea label="Observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{ag ? 'Salvar' : 'Criar agendamento'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerAg({ isOpen, onClose, ag, onEditar, onExcluir, onStatus }) {
  if (!ag) return null;
  const status = STATUS_LABELS[ag.status] || { label: ag.status, variant: 'neutral' };
  const data = new Date(ag.data);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={ag.servico || 'Agendamento'}
      description={ag.nomeCliente}
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir}>Excluir</Button>
          <Button variant="primary" icon={Edit2} onClick={onEditar}>Editar</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <Calendar size={20} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              {data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Clock size={12} className="text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)] tabular-nums">
                {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ({ag.duracao}min)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={status.variant}>{status.label}</Badge>
          {ag.origem === 'AI' && <Badge variant="accent" icon={Sparkles}>Agendado pelo bot</Badge>}
          {ag.preco > 0 && (
            <span className="text-sm font-semibold text-[var(--text-main)] ml-auto tabular-nums">{fmtBRL(ag.preco)}</span>
          )}
        </div>

        {ag.telefoneCliente && (
          <a href={`tel:${ag.telefoneCliente}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
            <Phone size={14} /> {ag.telefoneCliente}
          </a>
        )}

        {ag.observacoes && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Observacoes</div>
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-subtle)] rounded-xl p-3">{ag.observacoes}</div>
          </div>
        )}

        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Mudar status</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={ag.status === 'CONFIRMED' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('CONFIRMED')}>Confirmar</Button>
            <Button variant={ag.status === 'COMPLETED' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('COMPLETED')}>Concluir</Button>
            <Button variant={ag.status === 'PENDING' ? 'primary' : 'secondary'} size="sm" onClick={() => onStatus('PENDING')}>Pendente</Button>
            <Button variant={ag.status === 'CANCELED' ? 'danger' : 'secondary'} size="sm" icon={XCircle} onClick={() => onStatus('CANCELED')}>Cancelar</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
