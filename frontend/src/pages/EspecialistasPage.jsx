import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, UserCog, ShieldAlert, KeyRound, Clock, Briefcase, CheckCircle2,
} from 'lucide-react';
import {
  Card, Button, IconButton, Input, Switch, Badge, Avatar, EmptyState, SearchBar, useToast,
} from '../components/ui';
import Modal from '../components/Modal';
import { useAuthStore } from '../store/auth.store';
import api from '../services/api';
import catalogoService from '../services/catalogoService';

const DIAS = [
  { n: 1, label: 'Segunda' },
  { n: 2, label: 'Terça' },
  { n: 3, label: 'Quarta' },
  { n: 4, label: 'Quinta' },
  { n: 5, label: 'Sexta' },
  { n: 6, label: 'Sábado' },
  { n: 7, label: 'Domingo' },
];

function jornadaPadrao() {
  const j = {};
  for (const d of DIAS) {
    j[d.n] = { ativo: d.n <= 5, inicio: '08:00', fim: '18:00' };
  }
  return j;
}

function jornadaDoEspecialista(jornada) {
  const base = jornadaPadrao();
  if (jornada && typeof jornada === 'object') {
    for (const d of DIAS) {
      const intervalos = jornada[String(d.n)];
      if (Array.isArray(intervalos) && intervalos[0]) {
        base[d.n] = { ativo: true, inicio: intervalos[0].inicio || '08:00', fim: intervalos[0].fim || '18:00' };
      } else if (intervalos !== undefined) {
        base[d.n] = { ...base[d.n], ativo: false };
      }
    }
  }
  return base;
}

function montarJornadaJson(jornadaState) {
  const out = {};
  for (const d of DIAS) {
    const v = jornadaState[d.n];
    if (v?.ativo && v.inicio && v.fim && v.fim > v.inicio) {
      out[String(d.n)] = [{ inicio: v.inicio, fim: v.fim }];
    } else {
      out[String(d.n)] = [];
    }
  }
  return out;
}

export default function EspecialistasPage() {
  const toast = useToast();
  const usuarioLogado = useAuthStore((s) => s.user);
  const podeGerenciar = usuarioLogado?.perfil === 'CLIENT' || usuarioLogado?.perfil === 'ADMINISTRADOR';

  const [especialistas, setEspecialistas] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState({ open: false, data: null });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [respEsp, listaCatalogo] = await Promise.all([
        api.get('/especialistas'),
        catalogoService.listar().catch(() => []),
      ]);
      setEspecialistas(Array.isArray(respEsp.data) ? respEsp.data : []);
      const produtos = Array.isArray(listaCatalogo) ? listaCatalogo : [];
      setServicos(produtos.filter((p) => p.tipo === 'SERVICO'));
    } catch {
      toast.error('Falha ao carregar especialistas.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao montar
    if (podeGerenciar) carregar();
  }, [podeGerenciar, carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return especialistas;
    return especialistas.filter((e) => e.nome?.toLowerCase().includes(q));
  }, [especialistas, busca]);

  const nomeServico = useCallback((id) => servicos.find((s) => s.id === id)?.nome || '—', [servicos]);

  const salvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/especialistas/${dados.id}`, dados);
        toast.success('Especialista atualizado.');
      } else {
        await api.post('/especialistas', dados);
        toast.success(dados.acesso ? 'Especialista criado com acesso (senha inicial 123456).' : 'Especialista criado.');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar.');
    }
  };

  const excluir = async (e) => {
    if (!confirm(`Excluir o especialista "${e.nome}"? Os agendamentos dele são preservados.`)) return;
    try {
      await api.delete(`/especialistas/${e.id}`);
      toast.success('Especialista excluído.');
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Falha ao excluir.');
    }
  };

  if (!podeGerenciar) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Apenas o dono da conta ou um Administrador pode gerenciar especialistas."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <UserCog size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">Especialistas</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
              Cadastre quem atende, os serviços que cada um faz e a jornada. O bot agenda no especialista apto e livre. Com acesso, o especialista vê a própria agenda.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar especialista..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
          Novo especialista
        </Button>
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={UserCog}
            title={especialistas.length === 0 ? 'Nenhum especialista' : 'Sem resultados'}
            description={especialistas.length === 0 ? 'Cadastre o primeiro profissional que atende.' : 'Tente outra busca.'}
            action={especialistas.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>Novo especialista</Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtrados.map((e) => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar name={e.nome} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{e.nome}</span>
                    {!e.ativo && <Badge variant="neutral" size="sm">Inativo</Badge>}
                    {e.usuarioId && <Badge variant="success" size="sm" icon={KeyRound}>Com acesso</Badge>}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5">
                    <Briefcase size={11} />
                    {(e.servicosIds?.length || 0) === 0
                      ? 'Nenhum serviço vinculado'
                      : `${e.servicosIds.length} serviço(s): ${e.servicosIds.slice(0, 3).map(nomeServico).join(', ')}${e.servicosIds.length > 3 ? '…' : ''}`}
                  </div>
                </div>
                <IconButton icon={Edit2} variant="ghost" size="sm" ariaLabel="Editar" onClick={() => setModal({ open: true, data: e })} />
                <IconButton icon={Trash2} variant="ghost" size="sm" ariaLabel="Excluir" onClick={() => excluir(e)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <ModalEspecialista
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        especialista={modal.data}
        servicos={servicos}
        onSalvar={salvar}
      />
    </div>
  );
}

function ModalEspecialista({ isOpen, onClose, especialista, servicos, onSalvar }) {
  const editando = !!especialista;
  const [form, setForm] = useState({
    nome: '', ativo: true, servicosIds: [],
    usaExpedienteLoja: true, jornada: jornadaPadrao(),
    criarAcesso: false, email: '',
  });

  useEffect(() => {
    const next = especialista ? {
      nome: especialista.nome || '',
      ativo: especialista.ativo !== false,
      servicosIds: Array.isArray(especialista.servicosIds) ? especialista.servicosIds : [],
      usaExpedienteLoja: !especialista.jornada,
      jornada: jornadaDoEspecialista(especialista.jornada),
      criarAcesso: false,
      email: '',
    } : {
      nome: '', ativo: true, servicosIds: [],
      usaExpedienteLoja: true, jornada: jornadaPadrao(),
      criarAcesso: false, email: '',
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o form ao abrir
    setForm(next);
  }, [especialista, isOpen]);

  const toggleServico = (id) => {
    setForm((f) => ({
      ...f,
      servicosIds: f.servicosIds.includes(id) ? f.servicosIds.filter((x) => x !== id) : [...f.servicosIds, id],
    }));
  };

  const setDia = (n, patch) => {
    setForm((f) => ({ ...f, jornada: { ...f.jornada, [n]: { ...f.jornada[n], ...patch } } }));
  };

  const submeter = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    if (!editando && form.criarAcesso && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      alert('Informe um e-mail válido para o acesso.');
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      ativo: form.ativo,
      servicosIds: form.servicosIds,
      jornada: form.usaExpedienteLoja ? null : montarJornadaJson(form.jornada),
    };
    if (editando) payload.id = especialista.id;
    if (!editando && form.criarAcesso) payload.acesso = { email: form.email.trim().toLowerCase() };
    onSalvar(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editando ? 'Editar especialista' : 'Novo especialista'}
      description="Serviços que faz, jornada e acesso à plataforma."
      size="xl"
    >
      <form onSubmit={submeter} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          <label className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-main)]">
            <Switch checked={form.ativo} onChange={(v) => setForm({ ...form, ativo: v })} />
            <span className="text-sm font-medium text-[var(--text-main)]">Ativo (pode receber agendamentos)</span>
          </label>
        </div>

        {/* Serviços */}
        <div>
          <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">
            Serviços que este especialista executa
          </label>
          {servicos.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">Nenhum serviço no catálogo ainda. Cadastre serviços para vincular.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {servicos.map((s) => {
                const marcado = form.servicosIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                      marcado ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <input type="checkbox" checked={marcado} onChange={() => toggleServico(s.id)} className="rounded" />
                    {s.nome}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Jornada */}
        <div>
          <label className="flex items-center gap-3 mb-2">
            <Switch checked={form.usaExpedienteLoja} onChange={(v) => setForm({ ...form, usaExpedienteLoja: v })} />
            <span className="text-sm font-medium text-[var(--text-main)] inline-flex items-center gap-1.5">
              <Clock size={14} /> Usar o expediente da loja
            </span>
          </label>
          {!form.usaExpedienteLoja && (
            <div className="space-y-1.5 border border-[var(--border-main)] rounded-xl p-3">
              {DIAS.map((d) => {
                const v = form.jornada[d.n];
                return (
                  <div key={d.n} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-32 flex-shrink-0">
                      <input type="checkbox" checked={v.ativo} onChange={(ev) => setDia(d.n, { ativo: ev.target.checked })} className="rounded" />
                      <span className="text-sm text-[var(--text-main)]">{d.label}</span>
                    </label>
                    <input
                      type="time" value={v.inicio} disabled={!v.ativo}
                      onChange={(ev) => setDia(d.n, { inicio: ev.target.value })}
                      className="bg-[var(--bg-app)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-sm text-[var(--text-main)] disabled:opacity-40"
                    />
                    <span className="text-[var(--text-muted)] text-sm">até</span>
                    <input
                      type="time" value={v.fim} disabled={!v.ativo}
                      onChange={(ev) => setDia(d.n, { fim: ev.target.value })}
                      className="bg-[var(--bg-app)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-sm text-[var(--text-main)] disabled:opacity-40"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acesso (só na criação) */}
        {!editando ? (
          <div className="border-t border-[var(--border-main)] pt-4">
            <label className="flex items-center gap-3 mb-2">
              <Switch checked={form.criarAcesso} onChange={(v) => setForm({ ...form, criarAcesso: v })} />
              <span className="text-sm font-medium text-[var(--text-main)] inline-flex items-center gap-1.5">
                <KeyRound size={14} /> Criar acesso à plataforma para este especialista
              </span>
            </label>
            {form.criarAcesso && (
              <div className="pl-1 space-y-2">
                <Input
                  label="E-mail de acesso"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="especialista@email.com"
                />
                <p className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1">
                  <CheckCircle2 size={12} /> Senha inicial <b className="font-mono">123456</b> — ele troca no primeiro login. Já entra com acesso à própria agenda.
                </p>
              </div>
            )}
          </div>
        ) : especialista?.usuarioId ? (
          <div className="border-t border-[var(--border-main)] pt-3 text-xs text-[var(--text-muted)] inline-flex items-center gap-1.5">
            <KeyRound size={12} /> Este especialista já tem acesso à plataforma.
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-main)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{editando ? 'Salvar' : 'Criar especialista'}</Button>
        </div>
      </form>
    </Modal>
  );
}
