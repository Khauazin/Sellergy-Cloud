import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Plus, Edit2, Trash2, MoreHorizontal, Crown, BadgeCheck,
  ShieldAlert, Mail, Sparkles, ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import {
  Card, Button, IconButton, Input, Select, Badge, Avatar,
  EmptyState, SearchBar, Dropdown, DropdownItem, DropdownDivider, useToast
} from '../components/ui';
import Modal from '../components/Modal';
import {
  MODULOS_COLABORADOR, acoesDoModulo, temEscopo, ESCOPOS, permissoesVazias, permissoesCompletas, moduloLiberado
} from '../constants/permissoes';

const PERFIL_INFO = {
  ADMINISTRADOR: { label: 'Administrador', icon: Crown, variant: 'accent', desc: 'Acesso total dentro do CRM' },
  VENDEDOR: { label: 'Vendedor', icon: BadgeCheck, variant: 'info', desc: 'Permissoes customizadas' },
};

export default function CrmUsersPage() {
  const toast = useToast();
  const usuarioLogado = useAuthStore((s) => s.user);
  const ehDono = usuarioLogado?.perfil === 'CLIENT';
  const ehAdministrador = usuarioLogado?.perfil === 'ADMINISTRADOR';
  const podeGerenciar = ehDono || ehAdministrador;

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState({ open: false, data: null });

  useEffect(() => {
    if (podeGerenciar) carregar();
  }, [podeGerenciar]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/crm/usuarios');
      setUsuarios(r.data || []);
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
              Cadastre colaboradores e defina o que cada um pode fazer. Voce, como dono da conta, nao pode ser editado nem excluido por nenhum colaborador.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
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
              const info = PERFIL_INFO[u.perfil] || { label: u.perfil, icon: Users, variant: 'neutral' };
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
        onSalvar={handleSalvar}
      />
    </div>
  );
}

function ModalUsuario({ isOpen, onClose, usuario, ehDono, modulosLiberados, onSalvar }) {
  const [form, setForm] = useState({
    nome: '', email: '', senha: '', perfil: 'VENDEDOR', permissoes: permissoesVazias(),
  });

  useEffect(() => {
    if (usuario) {
      setForm({
        ...usuario,
        senha: '',
        permissoes: usuario.perfil === 'ADMINISTRADOR'
          ? permissoesCompletas()
          : { ...permissoesVazias(), ...(usuario.permissoes || {}) },
      });
    } else {
      setForm({ nome: '', email: '', senha: '', perfil: 'VENDEDOR', permissoes: permissoesVazias() });
    }
  }, [usuario, isOpen]);

  const escolherPerfil = (perfil) => {
    setForm({
      ...form,
      perfil,
      permissoes: perfil === 'ADMINISTRADOR' ? permissoesCompletas() : permissoesVazias(),
    });
  };

  const togglePermissao = (modulo, acao) => {
    setForm({
      ...form,
      permissoes: {
        ...form.permissoes,
        [modulo]: { ...form.permissoes[modulo], [acao]: !form.permissoes[modulo]?.[acao] },
      },
    });
  };

  const marcarTodoModulo = (modulo, valor) => {
    const atual = form.permissoes[modulo] || {};
    const novo = {};
    for (const acao of acoesDoModulo(modulo)) novo[acao.id] = valor;
    if (temEscopo(modulo)) novo.escopo = atual.escopo || 'PROPRIAS';
    setForm({ ...form, permissoes: { ...form.permissoes, [modulo]: novo } });
  };

  const definirEscopo = (modulo, valor) => {
    setForm({
      ...form,
      permissoes: {
        ...form.permissoes,
        [modulo]: { ...form.permissoes[modulo], escopo: valor },
      },
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!usuario && !form.senha) {
      alert('Senha eh obrigatoria para novo usuario');
      return;
    }
    const payload = {
      nome: form.nome,
      email: form.email,
      perfil: form.perfil,
    };
    if (form.senha) payload.senha = form.senha;
    if (form.id) payload.id = form.id;
    if (form.perfil === 'VENDEDOR') payload.permissoes = form.permissoes;
    onSalvar(payload);
  };

  const ehVendedor = form.perfil === 'VENDEDOR';
  const modulosDisponiveis = MODULOS_COLABORADOR.filter((m) => moduloLiberado(modulosLiberados, m.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={usuario ? 'Editar usuario' : 'Cadastrar usuario'}
      description="Defina nivel e permissoes."
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

        {/* Nivel */}
        <div>
          <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">
            Nivel de acesso
          </label>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(PERFIL_INFO).map(([key, info]) => {
              const Icone = info.icon;
              const ativo = form.perfil === key;
              const desabilitado = !ehDono && key === 'ADMINISTRADOR';
              return (
                <button
                  type="button"
                  key={key}
                  disabled={desabilitado}
                  onClick={() => !desabilitado && escolherPerfil(key)}
                  className={`text-left p-4 rounded-xl border-2 transition-colors ${
                    ativo ? 'border-[var(--accent)] bg-[var(--accent-soft)]/50' : 'border-[var(--border-main)] hover:border-[var(--text-muted)]'
                  } ${desabilitado ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icone size={16} className={ativo ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                    <span className="text-sm font-semibold text-[var(--text-main)]">{info.label}</span>
                    {key === 'ADMINISTRADOR' && (
                      <Badge variant="accent" size="sm" icon={Sparkles}>Tudo liberado</Badge>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{info.desc}</div>
                  {desabilitado && (
                    <div className="text-[11px] text-[var(--warning)] mt-1 font-semibold">
                      Apenas o dono pode criar
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permissoes */}
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
                          <label
                            key={acao.id}
                            title={acao.descricao}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs font-medium transition-colors ${
                              marcado ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => togglePermissao(modulo.id, acao.id)}
                              className="rounded"
                            />
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
                            <button
                              type="button"
                              key={esc.id}
                              title={esc.descricao}
                              onClick={() => definirEscopo(modulo.id, esc.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                ativo ? 'bg-[var(--accent)] text-[var(--text-on-primary)]' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                              }`}
                            >
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

        {form.perfil === 'ADMINISTRADOR' && (
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
