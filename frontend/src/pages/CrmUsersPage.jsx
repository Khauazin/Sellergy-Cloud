import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Plus, Edit2, Trash2, MoreHorizontal, Crown, BadgeCheck,
  ShieldAlert, Mail, Sparkles, ArrowLeft, UserCog, Clock, Briefcase,
} from 'lucide-react';
import api from '../services/api';
import catalogoService from '../services/catalogoService';
import { useAuthStore } from '../store/auth.store';
import {
  Card, Button, IconButton, Input, Select, Badge, Avatar, Switch,
  EmptyState, SearchBar, Dropdown, DropdownItem, DropdownDivider, useToast
} from '../components/ui';
import Modal from '../components/Modal';
import {
  MODULOS_COLABORADOR, acoesDoModulo, temEscopo, ESCOPOS, permissoesVazias, permissoesCompletas, moduloLiberado
} from '../constants/permissoes';

// Tipos de usuario da equipe. Especialista so aparece em segmento de servico
// (proxy: modulo AGENDA liberado) e, ao ser criado, gera Usuario + Especialista
// numa transacao no backend (doc erp-pivo §6.1).
const PERFIL_INFO = {
  ADMINISTRADOR: { label: 'Administrador', icon: Crown, variant: 'accent', desc: 'Acesso total dentro do CRM' },
  VENDEDOR: { label: 'Vendedor', icon: BadgeCheck, variant: 'info', desc: 'Permissoes customizadas' },
  ESPECIALISTA: { label: 'Especialista', icon: UserCog, variant: 'success', desc: 'Atende e e agendavel; ve a propria agenda' },
};

// --- Jornada do especialista (reaproveitado da antiga tela de Especialistas) ---
const DIAS = [
  { n: 1, label: 'Segunda' }, { n: 2, label: 'Terça' }, { n: 3, label: 'Quarta' },
  { n: 4, label: 'Quinta' }, { n: 5, label: 'Sexta' }, { n: 6, label: 'Sábado' }, { n: 7, label: 'Domingo' },
];
function jornadaPadrao() {
  const j = {};
  for (const d of DIAS) j[d.n] = { ativo: d.n <= 5, inicio: '08:00', fim: '18:00' };
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
    out[String(d.n)] = (v?.ativo && v.inicio && v.fim && v.fim > v.inicio) ? [{ inicio: v.inicio, fim: v.fim }] : [];
  }
  return out;
}

export default function CrmUsersPage() {
  const toast = useToast();
  const usuarioLogado = useAuthStore((s) => s.user);
  const ehDono = usuarioLogado?.perfil === 'CLIENT';
  const ehAdministrador = usuarioLogado?.perfil === 'ADMINISTRADOR';
  const podeGerenciar = ehDono || ehAdministrador;

  const [usuarios, setUsuarios] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState({ open: false, data: null });

  useEffect(() => {
    if (podeGerenciar) carregar();
  }, [podeGerenciar]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [r, listaCatalogo] = await Promise.all([
        api.get('/crm/usuarios'),
        catalogoService.listar().catch(() => []),
      ]);
      setUsuarios(r.data || []);
      const produtos = Array.isArray(listaCatalogo) ? listaCatalogo : [];
      setServicos(produtos.filter((p) => p.tipo === 'SERVICO'));
    } finally {
      setCarregando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [usuarios, busca]);

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/crm/usuarios/${dados.id}`, dados);
        toast.success('Usuario atualizado');
      } else {
        await api.post('/crm/usuarios', dados);
        toast.success('Usuario criado');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (u) => {
    if (!confirm(`Excluir usuario "${u.nome}"?`)) return;
    try {
      await api.delete(`/crm/usuarios/${u.id}`);
      toast.success('Usuario excluido');
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao excluir');
    }
  };

  if (!podeGerenciar) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Apenas o dono da conta ou um Administrador pode gerenciar a equipe."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/app/configuracoes" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
        <ArrowLeft size={12} /> Voltar para configurações
      </Link>

      {/* Cabecalho explicativo */}
      <Card padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <Users size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              Equipe & Permissoes
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
              Cadastre colaboradores (incluindo especialistas que atendem) e defina o que cada um pode fazer.
              Voce, como dono da conta, nao pode ser editado nem excluido por nenhum colaborador.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          {Object.entries(PERFIL_INFO).map(([key, info]) => {
            const Icone = info.icon;
            return (
              <div key={key} className="border border-[var(--border-main)] rounded-xl p-3 flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                  <Icone size={14} className="text-[var(--accent)]" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{info.label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{info.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] max-w-md">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou email..." />
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
          Cadastrar usuario
        </Button>
      </div>

      {/* Lista */}
      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Users}
            title={usuarios.length === 0 ? 'Nenhum colaborador' : 'Nenhum usuario encontrado'}
            description={usuarios.length === 0 ? 'Cadastre o primeiro membro da equipe.' : 'Tente outra busca.'}
            action={usuarios.length === 0 && (
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
                Cadastrar usuario
              </Button>
            )}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtrados.map((u) => {
              const info = PERFIL_INFO[u.tipo] || PERFIL_INFO[u.perfil] || { label: u.perfil, icon: Users, variant: 'neutral' };
              const Icone = info.icon;
              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <Avatar name={u.nome} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{u.nome}</span>
                      <Badge variant={info.variant} size="sm" icon={Icone}>{info.label}</Badge>
                      {u.deveTrocarSenha && (
                        <Badge variant="warning" size="sm">Senha pendente</Badge>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                      <Mail size={11} /> {u.email}
                    </div>
                  </div>
                  <Dropdown trigger={<IconButton icon={MoreHorizontal} variant="ghost" size="sm" ariaLabel="Acoes" />}>
                    <DropdownItem icon={Edit2} onClick={() => setModal({ open: true, data: u })}>Editar</DropdownItem>
                    <DropdownDivider />
                    <DropdownItem icon={Trash2} variant="danger" onClick={() => handleExcluir(u)}>Excluir</DropdownItem>
                  </Dropdown>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ModalUsuario
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        usuario={modal.data}
        ehDono={ehDono}
        modulosLiberados={usuarioLogado?.modulosLiberados || {}}
        servicos={servicos}
        onSalvar={handleSalvar}
      />
    </div>
  );
}

function ModalUsuario({ isOpen, onClose, usuario, ehDono, modulosLiberados, servicos, onSalvar }) {
  const editando = !!usuario;
  const agendaLiberada = moduloLiberado(modulosLiberados, 'AGENDA');

  const [form, setForm] = useState({
    nome: '', email: '', senha: '', tipo: 'VENDEDOR', permissoes: permissoesVazias(),
    // campos de especialista
    servicosIds: [], usaExpedienteLoja: true, jornada: jornadaPadrao(), espAtivo: true,
  });

  useEffect(() => {
    if (usuario) {
      const tipo = usuario.tipo || (usuario.perfil === 'ADMINISTRADOR' ? 'ADMINISTRADOR' : 'VENDEDOR');
      const esp = usuario.especialista;
      setForm({
        ...usuario,
        senha: '',
        tipo,
        permissoes: usuario.perfil === 'ADMINISTRADOR'
          ? permissoesCompletas()
          : { ...permissoesVazias(), ...(usuario.permissoes || {}) },
        servicosIds: Array.isArray(esp?.servicosIds) ? esp.servicosIds : [],
        usaExpedienteLoja: !esp?.jornada,
        jornada: jornadaDoEspecialista(esp?.jornada),
        espAtivo: esp ? esp.ativo !== false : true,
      });
    } else {
      setForm({
        nome: '', email: '', senha: '', tipo: 'VENDEDOR', permissoes: permissoesVazias(),
        servicosIds: [], usaExpedienteLoja: true, jornada: jornadaPadrao(), espAtivo: true,
      });
    }
  }, [usuario, isOpen]);

  // Especialista so e selecionavel em segmento de servico, e nao se converte um
  // usuario existente em especialista (so na criacao). Editando um especialista,
  // o tipo fica travado.
  const editandoEspecialista = editando && (usuario?.tipo === 'ESPECIALISTA');
  const tiposDisponiveis = editandoEspecialista
    ? ['ESPECIALISTA']
    : ['ADMINISTRADOR', 'VENDEDOR', ...((!editando && agendaLiberada) ? ['ESPECIALISTA'] : [])];

  const escolherTipo = (tipo) => {
    setForm((f) => ({
      ...f,
      tipo,
      permissoes: tipo === 'ADMINISTRADOR' ? permissoesCompletas() : permissoesVazias(),
    }));
  };

  const togglePermissao = (modulo, acao) => {
    setForm({ ...form, permissoes: { ...form.permissoes, [modulo]: { ...form.permissoes[modulo], [acao]: !form.permissoes[modulo]?.[acao] } } });
  };
  const marcarTodoModulo = (modulo, valor) => {
    const atual = form.permissoes[modulo] || {};
    const novo = {};
    for (const acao of acoesDoModulo(modulo)) novo[acao.id] = valor;
    if (temEscopo(modulo)) novo.escopo = atual.escopo || 'PROPRIAS';
    setForm({ ...form, permissoes: { ...form.permissoes, [modulo]: novo } });
  };
  const definirEscopo = (modulo, valor) => {
    setForm({ ...form, permissoes: { ...form.permissoes, [modulo]: { ...form.permissoes[modulo], escopo: valor } } });
  };
  const toggleServico = (id) => {
    setForm((f) => ({ ...f, servicosIds: f.servicosIds.includes(id) ? f.servicosIds.filter((x) => x !== id) : [...f.servicosIds, id] }));
  };
  const setDia = (n, patch) => {
    setForm((f) => ({ ...f, jornada: { ...f.jornada, [n]: { ...f.jornada[n], ...patch } } }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!usuario && !form.senha) {
      alert('Senha eh obrigatoria para novo usuario');
      return;
    }
    const payload = { nome: form.nome, email: form.email };
    if (form.senha) payload.senha = form.senha;
    if (form.id) payload.id = form.id;

    if (form.tipo === 'ESPECIALISTA') {
      // Backend cria/atualiza Usuario + Especialista e garante a agenda-propria.
      payload.especialista = {
        servicosIds: form.servicosIds,
        jornada: form.usaExpedienteLoja ? null : montarJornadaJson(form.jornada),
        ativo: form.espAtivo,
      };
    } else {
      payload.perfil = form.tipo;
      if (form.tipo === 'VENDEDOR') payload.permissoes = form.permissoes;
    }
    onSalvar(payload);
  };

  const ehVendedor = form.tipo === 'VENDEDOR';
  const ehEspecialista = form.tipo === 'ESPECIALISTA';
  const modulosDisponiveis = MODULOS_COLABORADOR.filter((m) => moduloLiberado(modulosLiberados, m.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={usuario ? 'Editar usuario' : 'Cadastrar usuario'}
      description="Defina o tipo e o que ele pode fazer."
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dados basicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
          <Input label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input
            label={usuario ? 'Nova senha (opcional)' : 'Senha inicial'}
            type="password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            placeholder={usuario ? 'Deixe em branco para manter' : 'Minimo 6 caracteres'}
            hint={!usuario ? 'O usuario sera obrigado a trocar no primeiro login' : null}
          />
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">
            Tipo de usuario
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {tiposDisponiveis.map((key) => {
              const info = PERFIL_INFO[key];
              const Icone = info.icon;
              const ativo = form.tipo === key;
              const desabilitado = !ehDono && key === 'ADMINISTRADOR';
              return (
                <button
                  type="button"
                  key={key}
                  disabled={desabilitado}
                  onClick={() => !desabilitado && escolherTipo(key)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    ativo ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50' : 'border-[var(--border-main)] hover:border-[var(--text-muted)]'
                  } ${desabilitado ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icone size={16} className={ativo ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                    <span className="text-sm font-semibold text-[var(--text-main)]">{info.label}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{info.desc}</div>
                  {desabilitado && (
                    <div className="text-[11px] text-[var(--warning)] mt-1 font-semibold">Apenas o dono pode criar</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Campos do Especialista */}
        {ehEspecialista && (
          <div className="space-y-4 border border-[var(--border-main)] rounded-xl p-4">
            <label className="flex items-center gap-3">
              <Switch checked={form.espAtivo} onChange={(v) => setForm({ ...form, espAtivo: v })} />
              <span className="text-sm font-medium text-[var(--text-main)]">Ativo (pode receber agendamentos)</span>
            </label>

            <div>
              <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2 inline-flex items-center gap-1.5">
                <Briefcase size={12} /> Serviços que executa
              </label>
              {servicos.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">Nenhum serviço no catálogo ainda. Cadastre serviços para vincular.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {servicos.map((s) => {
                    const marcado = form.servicosIds.includes(s.id);
                    return (
                      <label key={s.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                        marcado ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                      }`}>
                        <input type="checkbox" checked={marcado} onChange={() => toggleServico(s.id)} className="rounded" />
                        {s.nome}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

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
                        <input type="time" value={v.inicio} disabled={!v.ativo} onChange={(ev) => setDia(d.n, { inicio: ev.target.value })}
                          className="bg-[var(--bg-app)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-sm text-[var(--text-main)] disabled:opacity-40" />
                        <span className="text-[var(--text-muted)] text-sm">até</span>
                        <input type="time" value={v.fim} disabled={!v.ativo} onChange={(ev) => setDia(d.n, { fim: ev.target.value })}
                          className="bg-[var(--bg-app)] border border-[var(--border-main)] rounded-lg px-2 py-1 text-sm text-[var(--text-main)] disabled:opacity-40" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              O especialista entra com acesso à plataforma e vê a própria agenda. Senha inicial trocada no primeiro login.
            </p>
          </div>
        )}

        {/* Permissoes (Vendedor) */}
        {ehVendedor && modulosDisponiveis.length > 0 && (
          <div>
            <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">
              Permissoes por modulo
            </label>
            <div className="space-y-2">
              {modulosDisponiveis.map((modulo) => {
                const Icone = modulo.icone;
                const permModulo = form.permissoes[modulo.id] || {};
                const acoes = acoesDoModulo(modulo.id);
                const total = acoes.filter((a) => permModulo[a.id] === true).length;
                return (
                  <div key={modulo.id} className="border border-[var(--border-main)] rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Icone size={14} className="text-[var(--text-secondary)]" />
                        <span className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{modulo.nome}</span>
                        <Badge variant="neutral" size="sm">{total}/{acoes.length}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => marcarTodoModulo(modulo.id, true)} className="text-[10px] font-bold uppercase tracking-tight text-[var(--accent)] hover:underline">Tudo</button>
                        <span className="text-[var(--text-muted)]">·</span>
                        <button type="button" onClick={() => marcarTodoModulo(modulo.id, false)} className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-muted)] hover:underline">Limpar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {acoes.map((acao) => {
                        const marcado = permModulo[acao.id] === true;
                        return (
                          <label key={acao.id} title={acao.descricao}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                              marcado ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                            }`}>
                            <input type="checkbox" checked={marcado} onChange={() => togglePermissao(modulo.id, acao.id)} className="rounded" />
                            {acao.nome}
                          </label>
                        );
                      })}
                    </div>
                    {temEscopo(modulo.id) && (
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">Pode ver:</span>
                        {ESCOPOS.map((esc) => {
                          const ativo = (permModulo.escopo || 'PROPRIAS') === esc.id;
                          return (
                            <button type="button" key={esc.id} title={esc.descricao} onClick={() => definirEscopo(modulo.id, esc.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                ativo ? 'bg-[var(--accent)] text-[var(--text-on-primary)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                              }`}>
                              {esc.nome}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {form.tipo === 'ADMINISTRADOR' && (
          <div className="bg-[var(--accent-soft)] border border-[var(--accent-border)] rounded-xl p-3 text-xs text-[var(--accent-text)] flex items-start gap-2">
            <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
            Administrador tem acesso total a todos os modulos liberados pelo admin do sistema. Nao pode mexer no dono da conta.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-main)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{usuario ? 'Salvar' : 'Criar usuario'}</Button>
        </div>
      </form>
    </Modal>
  );
}
