import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Edit2, Trash2, MoreHorizontal, Mail, Phone,
  ShieldCheck, CheckCircle2, XCircle, Pause
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Select, Badge, Avatar,
  EmptyState, SearchBar, Drawer, Dropdown, DropdownItem, DropdownDivider, useToast
} from '../components/ui';
import Modal from '../components/Modal';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PLANOS = [
  { value: 'BASIC', label: 'Basic' },
  { value: 'PRO', label: 'Pro' },
  { value: 'PREMIUM', label: 'Premium' },
];
const STATUS_LABELS = {
  ACTIVE: { label: 'Ativo', variant: 'success', icon: CheckCircle2 },
  INACTIVE: { label: 'Inativo', variant: 'neutral', icon: XCircle },
  SUSPENDED: { label: 'Suspenso', variant: 'warning', icon: Pause },
};

export default function ClientsPage() {
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  const [modal, setModal] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, cliente: null });

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/clientes');
      setClientes(r.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filtroStatus && c.status !== filtroStatus) return false;
      if (q && !c.nome?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q) && !c.telefone?.includes(q)) return false;
      return true;
    });
  }, [clientes, busca, filtroStatus]);

  const stats = useMemo(() => {
    const ativos = clientes.filter((c) => c.status === 'ACTIVE');
    const mrr = ativos.reduce((acc, c) => acc + Number(c.mensalidade || 0), 0);
    return { total: clientes.length, ativos: ativos.length, mrr };
  }, [clientes]);

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/clientes/${dados.id}`, dados);
        toast.success('Cliente atualizado');
      } else {
        await api.post('/clientes', dados);
        toast.success('Cliente criado. Senha padrao 123456 (sera trocada no 1o login)');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleStatus = async (c, status) => {
    try {
      await api.patch(`/clientes/${c.id}/status`, { status });
      toast.success('Status atualizado');
      carregar();
    } catch {
      toast.error('Erro ao mudar status');
    }
  };

  const handleExcluir = async (c) => {
    if (!confirm(`Excluir cliente "${c.nome}"?\nIsso remove TODOS os dados (bots, leads, vendas...).`)) return;
    try {
      await api.delete(`/clientes/${c.id}`);
      toast.success('Cliente excluido');
      setDrawer({ open: false, cliente: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Nao foi possivel excluir');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total" valor={stats.total} />
        <KpiCard label="Ativos" valor={stats.ativos} variant="success" />
        <KpiCard label="MRR" valor={fmtBRL(stats.mrr)} variant="accent" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." />
        </div>
        <Select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          placeholder="Todos status"
          options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
          fullWidth={false}
          className="w-44"
        />
        <Link to="/admin/clientes/permissoes">
          <Button variant="secondary" icon={ShieldCheck}>Permissoes</Button>
        </Link>
        <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Novo cliente</Button>
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Plus}
            title={clientes.length === 0 ? 'Nenhum cliente' : 'Sem resultados'}
            action={clientes.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Cadastrar</Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-main)]">
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cliente</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Plano</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Status</th>
                <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Mensalidade</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3 px-5">Cadastro</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const status = STATUS_LABELS[c.status] || { label: c.status, variant: 'neutral' };
                const Icone = status.icon;
                return (
                  <tr key={c.id} onClick={() => setDrawer({ open: true, cliente: c })} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.nome} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{c.nome}</div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate">{c.email || c.telefone || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5"><Badge variant="neutral" size="sm">{c.plano || 'BASIC'}</Badge></td>
                    <td className="py-3 px-5"><Badge variant={status.variant} size="sm" icon={Icone}>{status.label}</Badge></td>
                    <td className="py-3 px-5 text-right text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(c.mensalidade)}</td>
                    <td className="py-3 px-5 text-xs text-[var(--text-muted)]">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
                    <td onClick={(e) => e.stopPropagation()} className="py-3 px-3">
                      <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                        <DropdownItem icon={Edit2} onClick={() => setModal({ open: true, data: c })}>Editar</DropdownItem>
                        <DropdownDivider />
                        {c.status !== 'ACTIVE' && <DropdownItem icon={CheckCircle2} onClick={() => handleStatus(c, 'ACTIVE')}>Ativar</DropdownItem>}
                        {c.status !== 'SUSPENDED' && <DropdownItem icon={Pause} onClick={() => handleStatus(c, 'SUSPENDED')}>Suspender</DropdownItem>}
                        {c.status !== 'INACTIVE' && <DropdownItem icon={XCircle} onClick={() => handleStatus(c, 'INACTIVE')}>Inativar</DropdownItem>}
                        <DropdownDivider />
                        <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(c)}>Excluir</DropdownItem>
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ModalCliente
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        cliente={modal.data}
        onSalvar={handleSalvar}
      />

      <DrawerCliente
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, cliente: null })}
        cliente={drawer.cliente}
        onEditar={() => { setModal({ open: true, data: drawer.cliente }); setDrawer({ open: false, cliente: null }); }}
        onExcluir={() => handleExcluir(drawer.cliente)}
        onStatus={(s) => { handleStatus(drawer.cliente, s); setDrawer({ open: false, cliente: null }); }}
      />
    </div>
  );
}

function KpiCard({ label, valor, variant }) {
  return (
    <Card padding="lg">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 tabular-nums ${
        variant === 'success' ? 'text-[var(--success)]' :
        variant === 'accent' ? 'text-[var(--accent)]' :
        'text-[var(--text-main)]'
      }`}>{valor}</div>
    </Card>
  );
}

function ModalCliente({ isOpen, onClose, cliente, onSalvar }) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', segmento: '', plano: 'BASIC', mensalidade: 0 });

  useEffect(() => {
    if (cliente) setForm({
      ...cliente,
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      segmento: cliente.segmento || '',
      mensalidade: cliente.mensalidade || 0,
    });
    else setForm({ nome: '', email: '', telefone: '', segmento: '', plano: 'BASIC', mensalidade: 0 });
  }, [cliente, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar({ ...form, mensalidade: parseFloat(form.mensalidade) || 0 });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={cliente ? 'Editar cliente' : 'Novo cliente'} description={cliente ? null : 'Sera criado um usuario CLIENT com senha padrao 123456.'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nome / Razao social" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!cliente} />
          <Input label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <Input label="Segmento" value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} placeholder="Ex: Loja, Clinica, Barbearia" />
          <Select label="Plano" value={form.plano} onChange={(e) => setForm({ ...form, plano: e.target.value })} options={PLANOS} placeholder="" />
          <Input label="Mensalidade (R$)" type="number" step="0.01" min="0" value={form.mensalidade} onChange={(e) => setForm({ ...form, mensalidade: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{cliente ? 'Salvar' : 'Criar cliente'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerCliente({ isOpen, onClose, cliente, onEditar, onExcluir, onStatus }) {
  if (!cliente) return null;
  const status = STATUS_LABELS[cliente.status] || { label: cliente.status, variant: 'neutral' };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={cliente.nome}
      description={cliente.segmento}
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
          <Avatar name={cliente.nome} size="lg" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="neutral">{cliente.plano || 'BASIC'}</Badge>
              <Badge variant={status.variant} icon={status.icon}>{status.label}</Badge>
            </div>
            <div className="text-base font-semibold text-[var(--text-main)] mt-1 tabular-nums">{fmtBRL(cliente.mensalidade)}/mes</div>
          </div>
        </div>

        <div className="space-y-2">
          {cliente.email && (
            <a href={`mailto:${cliente.email}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
              <Mail size={14} /> {cliente.email}
            </a>
          )}
          {cliente.telefone && (
            <a href={`tel:${cliente.telefone}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
              <Phone size={14} /> {cliente.telefone}
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="Cadastro" valor={new Date(cliente.criadoEm).toLocaleDateString('pt-BR')} />
          <InfoBox label="Atualizado" valor={new Date(cliente.atualizadoEm).toLocaleDateString('pt-BR')} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">Modulos liberados</div>
            <Link to={`/admin/clientes/permissoes?cliente=${cliente.id}`} className="text-xs font-bold uppercase tracking-tight text-[var(--accent)] hover:underline">Gerenciar</Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(cliente.modulosLiberados || {}).filter(([_, v]) => v).map(([k]) => (
              <Badge key={k} variant="success" size="sm">{k}</Badge>
            ))}
            {Object.values(cliente.modulosLiberados || {}).filter(Boolean).length === 0 && (
              <span className="text-xs text-[var(--text-muted)]">Nenhum modulo liberado</span>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Status</div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant={cliente.status === 'ACTIVE' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('ACTIVE')}>Ativar</Button>
            <Button variant={cliente.status === 'SUSPENDED' ? 'primary' : 'secondary'} size="sm" icon={Pause} onClick={() => onStatus('SUSPENDED')}>Suspender</Button>
            <Button variant={cliente.status === 'INACTIVE' ? 'primary' : 'secondary'} size="sm" icon={XCircle} onClick={() => onStatus('INACTIVE')}>Inativar</Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function InfoBox({ label, valor }) {
  return (
    <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-semibold text-[var(--text-main)] mt-0.5">{valor}</div>
    </div>
  );
}
