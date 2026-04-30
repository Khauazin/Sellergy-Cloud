import { useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, Search, Trash2, Edit2, X, ShieldCheck, ShieldAlert,
  Crown, BadgeCheck, Eye, EyeOff, Save, AlertCircle, CheckCircle2,
  Lock, Mail, User, ChevronDown, Info, Loader2, Sparkles
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import {
  MODULOS_COLABORADOR, ACOES, permissoesVazias, permissoesCompletas, moduloLiberado
} from '../constants/permissoes';
import clsx from 'clsx';

const MODO = { LISTA: 'lista', NOVO: 'novo', EDITAR: 'editar' };

const PRESETS = [
  {
    perfil: 'ADMINISTRADOR',
    titulo: 'Administrador',
    icone: Crown,
    descricao: 'Acesso total dentro do CRM. Pode visualizar, criar, editar e excluir em todos os modulos liberados. Nao pode mexer no dono da conta.',
    destaque: 'Apenas voce (dono) pode criar um Administrador.',
    cor: 'from-amber-500 to-orange-600',
    corBg: 'bg-amber-500/10',
    corBorda: 'border-amber-500/30',
    corTexto: 'text-amber-500',
  },
  {
    perfil: 'VENDEDOR',
    titulo: 'Vendedor',
    icone: BadgeCheck,
    descricao: 'Acesso customizado: voce escolhe modulo a modulo o que ele pode fazer. Ideal para colaboradores com responsabilidades especificas.',
    destaque: 'Voce define exatamente o que ele acessa.',
    cor: 'from-blue-500 to-indigo-600',
    corBg: 'bg-blue-500/10',
    corBorda: 'border-blue-500/30',
    corTexto: 'text-blue-500',
  },
];

export default function CrmUsersPage() {
  const usuarioLogado = useAuthStore((s) => s.user);
  const modulosLiberadosTenant = usuarioLogado?.modulosLiberados || {};
  const ehDono = usuarioLogado?.perfil === 'CLIENT';
  const ehAdministrador = usuarioLogado?.perfil === 'ADMINISTRADOR';
  const podeGerenciarUsuarios = ehDono || ehAdministrador;

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState(MODO.LISTA);
  const [editandoId, setEditandoId] = useState(null);

  // Form
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/crm/usuarios');
      setUsuarios(data || []);
    } catch (e) {
      console.error('Erro ao carregar usuarios', e);
    } finally {
      setCarregando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter(
      (u) => u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [usuarios, busca]);

  const abrirNovo = () => {
    setForm(formVazio());
    setEditandoId(null);
    setFeedback(null);
    setModo(MODO.NOVO);
  };

  const abrirEditar = (u) => {
    setEditandoId(u.id);
    setFeedback(null);
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '',
      perfil: u.perfil,
      permissoes: u.perfil === 'ADMINISTRADOR'
        ? permissoesCompletas()
        : { ...permissoesVazias(), ...(u.permissoes || {}) },
    });
    setModo(MODO.EDITAR);
  };

  const cancelar = () => {
    setModo(MODO.LISTA);
    setForm(formVazio());
    setEditandoId(null);
    setFeedback(null);
  };

  const onSalvar = async () => {
    setSalvando(true);
    setFeedback(null);
    try {
      const payload = {
        nome: form.nome,
        email: form.email,
        perfil: form.perfil,
      };

      if (form.senha) payload.senha = form.senha;

      // Se VENDEDOR, envia permissoes; se ADMINISTRADOR, backend ignora e gera todas.
      if (form.perfil === 'VENDEDOR') {
        payload.permissoes = form.permissoes;
      }

      if (modo === MODO.NOVO) {
        if (!form.senha) {
          setFeedback({ tipo: 'erro', mensagem: 'A senha eh obrigatoria.' });
          setSalvando(false);
          return;
        }
        await api.post('/crm/usuarios', payload);
      } else {
        await api.put(`/crm/usuarios/${editandoId}`, payload);
      }

      await carregar();
      setModo(MODO.LISTA);
      setForm(formVazio());
      setEditandoId(null);
    } catch (e) {
      setFeedback({
        tipo: 'erro',
        mensagem: e.response?.data?.error || 'Erro ao salvar usuario.'
      });
    } finally {
      setSalvando(false);
    }
  };

  const onExcluir = async (u) => {
    if (!window.confirm(`Excluir o usuario "${u.nome}"? Essa acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/crm/usuarios/${u.id}`);
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir.');
    }
  };

  if (!podeGerenciarUsuarios) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-12 text-center">
        <ShieldAlert className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-50" />
        <h2 className="text-lg font-black text-[var(--text-main)] mt-4 uppercase tracking-tight">
          Acesso restrito
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-2 font-medium">
          Apenas o dono da conta ou um Administrador pode gerenciar usuarios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header explicativo */}
      <header className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-3xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">
              Equipe & Permissoes
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-2 max-w-3xl leading-relaxed">
              Cadastre os colaboradores que terao acesso ao CRM. Para cada um, escolha um <strong className="text-[var(--text-main)]">nivel</strong>{' '}
              (Administrador ou Vendedor) e, se necessario, customize as permissoes detalhadamente.
            </p>
          </div>
        </div>

        {/* Mini cards informativos sobre niveis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
          {PRESETS.map((p) => {
            const Icone = p.icone;
            return (
              <div key={p.perfil} className={clsx('rounded-2xl p-4 border', p.corBg, p.corBorda)}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={clsx('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center', p.cor)}>
                    <Icone className="w-4 h-4 text-white" />
                  </div>
                  <span className={clsx('font-black uppercase tracking-tight text-sm', p.corTexto)}>
                    {p.titulo}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                  {p.descricao}
                </p>
              </div>
            );
          })}
        </div>
      </header>

      {modo === MODO.LISTA ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar usuario por nome ou email..."
                className="w-full bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 font-medium"
              />
            </div>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black uppercase text-sm tracking-tight shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-[0.99] transition-all"
            >
              <Plus className="w-4 h-4" />
              Cadastrar usuario
            </button>
          </div>

          {/* Lista */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl overflow-hidden">
            {carregando ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-50" />
                <p className="text-sm text-[var(--text-muted)] mt-3 font-medium">
                  {busca ? 'Nenhum usuario encontrado.' : 'Nenhum colaborador cadastrado ainda.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-main)]">
                {filtrados.map((u) => {
                  const preset = PRESETS.find((p) => p.perfil === u.perfil);
                  const Icone = preset?.icone || User;
                  return (
                    <div key={u.id} className="p-5 flex flex-wrap items-center gap-4 hover:bg-[var(--bg-app)]/40 transition-colors">
                      <div className={clsx('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', preset?.cor || 'from-gray-500 to-gray-600')}>
                        <Icone className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-base text-[var(--text-main)] tracking-tight">{u.nome}</h3>
                          <span className={clsx(
                            'text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg',
                            preset?.corBg, preset?.corTexto
                          )}>
                            {preset?.titulo || u.perfil}
                          </span>
                          {u.deveTrocarSenha && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500">
                              Senha pendente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1 font-medium truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-blue-500 hover:border-blue-500/30 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onExcluir(u)}
                          className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <FormularioUsuario
          modo={modo}
          form={form}
          setForm={setForm}
          mostrarSenha={mostrarSenha}
          setMostrarSenha={setMostrarSenha}
          onSalvar={onSalvar}
          onCancelar={cancelar}
          salvando={salvando}
          feedback={feedback}
          ehDono={ehDono}
          modulosLiberadosTenant={modulosLiberadosTenant}
        />
      )}
    </div>
  );
}

function formVazio() {
  return {
    nome: '',
    email: '',
    senha: '',
    perfil: 'VENDEDOR',
    permissoes: permissoesVazias(),
  };
}

function FormularioUsuario({
  modo, form, setForm, mostrarSenha, setMostrarSenha,
  onSalvar, onCancelar, salvando, feedback, ehDono,
  modulosLiberadosTenant,
}) {
  const [moduloAberto, setModuloAberto] = useState(null);

  const escolherPerfil = (perfil) => {
    setForm((prev) => ({
      ...prev,
      perfil,
      permissoes: perfil === 'ADMINISTRADOR' ? permissoesCompletas() : permissoesVazias(),
    }));
  };

  const togglePermissao = (modulo, acao) => {
    setForm((prev) => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [modulo]: {
          ...prev.permissoes[modulo],
          [acao]: !prev.permissoes[modulo]?.[acao],
        }
      }
    }));
  };

  const marcarTodoModulo = (modulo, valor) => {
    setForm((prev) => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [modulo]: {
          visualizar: valor,
          criar: valor,
          editar: valor,
          excluir: valor,
        }
      }
    }));
  };

  const eVendedor = form.perfil === 'VENDEDOR';
  const eAdministrador = form.perfil === 'ADMINISTRADOR';

  // Apenas modulos liberados pelo admin para o tenant podem ter permissao concedida.
  const modulosDisponiveis = MODULOS_COLABORADOR.filter((m) =>
    moduloLiberado(modulosLiberadosTenant, m.id)
  );

  return (
    <div className="space-y-6">
      {/* Header do form */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">
            {modo === 'novo' ? 'Cadastrar usuario' : 'Editar usuario'}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
            Preencha os dados, escolha um nivel e ajuste as permissoes.
          </p>
        </div>
        <button
          onClick={onCancelar}
          className="p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Card de dados pessoais */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Passo 1
          </span>
          <div className="h-px flex-1 bg-[var(--border-main)]" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-main)]">
            Dados de acesso
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo
            icone={User}
            label="Nome completo"
            value={form.nome}
            onChange={(v) => setForm((p) => ({ ...p, nome: v }))}
            placeholder="Ex: Maria Silva"
          />
          <Campo
            icone={Mail}
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            placeholder="usuario@empresa.com"
          />
          <CampoSenha
            label={modo === 'novo' ? 'Senha inicial' : 'Nova senha (opcional)'}
            value={form.senha}
            onChange={(v) => setForm((p) => ({ ...p, senha: v }))}
            mostrar={mostrarSenha}
            onToggleMostrar={() => setMostrarSenha((v) => !v)}
            placeholder={modo === 'novo' ? 'Minimo 6 caracteres' : 'Deixe em branco para manter'}
            ajuda={modo === 'novo' ? 'O usuario sera obrigado a trocar no primeiro acesso.' : null}
          />
        </div>
      </div>

      {/* Card de nivel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Passo 2
          </span>
          <div className="h-px flex-1 bg-[var(--border-main)]" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-main)]">
            Escolha o nivel
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRESETS.map((p) => {
            const Icone = p.icone;
            const ativo = form.perfil === p.perfil;
            const desabilitado = !ehDono && p.perfil === 'ADMINISTRADOR';
            return (
              <button
                key={p.perfil}
                onClick={() => !desabilitado && escolherPerfil(p.perfil)}
                disabled={desabilitado}
                className={clsx(
                  'text-left rounded-2xl p-5 border-2 transition-all relative overflow-hidden',
                  ativo && !desabilitado ? `${p.corBg} ${p.corBorda}` : 'bg-[var(--bg-app)]/50 border-[var(--border-main)] hover:border-[var(--text-muted)]',
                  desabilitado && 'opacity-50 cursor-not-allowed'
                )}
              >
                {ativo && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className={clsx('w-5 h-5', p.corTexto)} />
                  </div>
                )}
                <div className="flex items-start gap-3 mb-3">
                  <div className={clsx('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', p.cor)}>
                    <Icone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black uppercase tracking-tight text-[var(--text-main)] text-sm">
                      {p.titulo}
                    </h4>
                    {p.perfil === 'ADMINISTRADOR' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-500 mt-1">
                        <Sparkles className="w-3 h-3" /> Permissoes completas
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed mb-2">
                  {p.descricao}
                </p>
                {desabilitado && (
                  <p className="text-[11px] text-amber-500 font-bold mt-2">
                    Apenas o dono da conta pode criar Administrador.
                  </p>
                )}
                {!desabilitado && (
                  <p className={clsx('text-[11px] font-bold', p.corTexto)}>
                    {p.destaque}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card de permissoes detalhadas */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Passo 3
          </span>
          <div className="h-px flex-1 bg-[var(--border-main)]" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-main)]">
            {eAdministrador ? 'Permissoes (auto preenchidas)' : 'Customizar permissoes'}
          </h3>
        </div>

        {eAdministrador && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-500">
                Todas as permissoes foram marcadas automaticamente.
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-medium leading-relaxed">
                O nivel Administrador concede acesso completo dentro do CRM. Voce ainda eh o unico dono da conta - este usuario nunca podera te substituir, excluir ou rebaixar.
              </p>
            </div>
          </div>
        )}

        {modulosDisponiveis.length === 0 ? (
          <div className="text-center p-8">
            <Info className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
            <p className="text-sm text-[var(--text-muted)] mt-3 font-medium">
              Nenhum modulo foi liberado para a sua conta. Fale com o suporte.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {modulosDisponiveis.map((modulo) => {
              const Icone = modulo.icone;
              const aberto = moduloAberto === modulo.id;
              const acoesModulo = form.permissoes[modulo.id] || {};
              const totalMarcadas = Object.values(acoesModulo).filter(Boolean).length;

              return (
                <div
                  key={modulo.id}
                  className={clsx(
                    'border rounded-2xl transition-all',
                    aberto ? 'border-blue-500/30 bg-blue-500/5' : 'border-[var(--border-main)] bg-[var(--bg-app)]/30',
                    eAdministrador && 'opacity-90'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setModuloAberto(aberto ? null : modulo.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className={clsx(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                      totalMarcadas > 0 ? 'bg-blue-500/20 text-blue-500' : 'bg-[var(--border-main)] text-[var(--text-muted)]'
                    )}>
                      <Icone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black uppercase tracking-tight text-sm text-[var(--text-main)]">
                        {modulo.nome}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium truncate">
                        {totalMarcadas === 0 ? 'Sem permissoes' : `${totalMarcadas} de 4 acoes liberadas`}
                      </p>
                    </div>
                    <ChevronDown className={clsx('w-4 h-4 text-[var(--text-muted)] transition-transform', aberto && 'rotate-180')} />
                  </button>

                  {aberto && (
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-3">
                        {modulo.descricao}
                      </p>

                      {!eAdministrador && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => marcarTodoModulo(modulo.id, true)}
                            className="text-[10px] font-black uppercase tracking-tight px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                          >
                            Marcar todas
                          </button>
                          <button
                            type="button"
                            onClick={() => marcarTodoModulo(modulo.id, false)}
                            className="text-[10px] font-black uppercase tracking-tight px-3 py-1.5 rounded-xl bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-main)] hover:text-[var(--text-main)] transition-colors"
                          >
                            Limpar
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {ACOES.map((acao) => {
                          const marcado = acoesModulo[acao.id] === true;
                          return (
                            <button
                              key={acao.id}
                              type="button"
                              disabled={eAdministrador}
                              onClick={() => togglePermissao(modulo.id, acao.id)}
                              className={clsx(
                                'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all',
                                marcado ? 'bg-blue-500/5 border-blue-500/30' : 'bg-transparent border-[var(--border-main)] hover:border-[var(--text-muted)]',
                                eAdministrador && 'cursor-not-allowed'
                              )}
                            >
                              <div className={clsx(
                                'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                                marcado ? 'bg-blue-500 text-white' : 'bg-[var(--border-main)]'
                              )}>
                                {marcado && <CheckCircle2 className="w-4 h-4" />}
                              </div>
                              <div>
                                <h5 className="font-bold text-sm text-[var(--text-main)] capitalize">
                                  {acao.nome}
                                </h5>
                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-medium leading-relaxed">
                                  {acao.descricao}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer com acao */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-5 flex flex-wrap items-center justify-between gap-3 sticky bottom-4">
        <div className="flex-1 min-w-[200px]">
          {feedback?.tipo === 'erro' && (
            <div className="inline-flex items-center gap-2 text-sm text-red-500 font-medium">
              <AlertCircle className="w-4 h-4" /> {feedback.mensagem}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="px-5 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-black uppercase text-sm tracking-tight transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSalvar}
            disabled={salvando || !form.nome || !form.email}
            className={clsx(
              'flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-sm tracking-tight transition-all',
              !salvando && form.nome && form.email
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-[0.99]'
                : 'bg-[var(--border-main)] text-[var(--text-muted)] cursor-not-allowed'
            )}
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {salvando ? 'Salvando...' : (modo === 'novo' ? 'Criar usuario' : 'Salvar alteracoes')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ icone: Icone, label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
        {label}
      </label>
      <div className="relative">
        {Icone && <Icone className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={clsx(
            'w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded-2xl py-3 pr-3 text-sm text-[var(--text-main)] focus:outline-none focus:border-blue-500/50 transition-all font-medium',
            Icone ? 'pl-11' : 'pl-3'
          )}
        />
      </div>
    </div>
  );
}

function CampoSenha({ label, value, onChange, mostrar, onToggleMostrar, placeholder, ajuda }) {
  return (
    <div className="md:col-span-2">
      <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
        {label}
      </label>
      <div className="relative">
        <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type={mostrar ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded-2xl py-3 pl-11 pr-12 text-sm text-[var(--text-main)] focus:outline-none focus:border-blue-500/50 transition-all font-medium"
        />
        <button
          type="button"
          onClick={onToggleMostrar}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          tabIndex={-1}
        >
          {mostrar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {ajuda && <p className="text-[11px] text-[var(--text-muted)] mt-2 font-medium">{ajuda}</p>}
    </div>
  );
}
