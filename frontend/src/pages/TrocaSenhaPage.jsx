import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import clsx from 'clsx';

export default function TrocaSenhaPage() {
  const navigate = useNavigate();
  const { user, marcarSenhaTrocada, refreshUser } = useAuthStore();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Indicadores visuais de forca da nova senha.
  const validacoes = [
    { label: 'Pelo menos 6 caracteres', ok: novaSenha.length >= 6 },
    { label: 'Diferente da senha atual', ok: novaSenha.length > 0 && novaSenha !== senhaAtual },
    { label: 'Contem letra e numero', ok: /[a-zA-Z]/.test(novaSenha) && /\d/.test(novaSenha) },
    { label: 'Confirmacao confere', ok: novaSenha.length > 0 && novaSenha === confirmarSenha },
  ];

  const tudoOk = validacoes.every((v) => v.ok) && senhaAtual.length > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (!tudoOk) return;

    try {
      setSalvando(true);
      await api.post('/autenticacao/trocar-senha', { senhaAtual, novaSenha });
      marcarSenhaTrocada();
      setSucesso(true);

      // Re-busca perfil para garantir consistencia, e redireciona apos um beat.
      await refreshUser();

      setTimeout(() => {
        const destino = user?.perfil === 'ADMIN' ? '/admin/dashboard' : '/app/dashboard';
        navigate(destino, { replace: true });
      }, 1200);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao trocar a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorativos */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[30%] rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-xl relative">
        <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="p-8 border-b border-[var(--border-main)] bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ShieldCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">
                  Trocar Senha
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-1 font-medium">
                  Por seguranca, defina uma nova senha antes de continuar.
                </p>
              </div>
            </div>
          </div>

          {sucesso ? (
            <div className="p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <h2 className="text-xl font-black text-[var(--text-main)] tracking-tight mb-2">
                Senha atualizada!
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Redirecionando para o painel...
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="p-8 space-y-5">

              <CampoSenha
                label="Senha atual"
                value={senhaAtual}
                onChange={setSenhaAtual}
                mostrar={mostrarSenha}
                onToggleMostrar={() => setMostrarSenha((v) => !v)}
                placeholder="Sua senha atual"
                autoFocus
              />

              <CampoSenha
                label="Nova senha"
                value={novaSenha}
                onChange={setNovaSenha}
                mostrar={mostrarSenha}
                onToggleMostrar={() => setMostrarSenha((v) => !v)}
                placeholder="Crie uma nova senha forte"
              />

              <CampoSenha
                label="Confirmar nova senha"
                value={confirmarSenha}
                onChange={setConfirmarSenha}
                mostrar={mostrarSenha}
                onToggleMostrar={() => setMostrarSenha((v) => !v)}
                placeholder="Repita a nova senha"
              />

              {/* Checklist de seguranca */}
              <div className="bg-[var(--bg-app)]/50 border border-[var(--border-main)] rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
                  Checklist de seguranca
                </p>
                {validacoes.map((v) => (
                  <div key={v.label} className="flex items-center gap-2 text-sm">
                    <div className={clsx(
                      'w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                      v.ok ? 'bg-emerald-500/20 text-emerald-500' : 'bg-[var(--border-main)] text-[var(--text-muted)]'
                    )}>
                      {v.ok ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                    </div>
                    <span className={clsx('font-medium', v.ok ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]')}>
                      {v.label}
                    </span>
                  </div>
                ))}
              </div>

              {erro && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-500 font-medium">{erro}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!tudoOk || salvando}
                className={clsx(
                  'w-full py-4 rounded-2xl font-black uppercase tracking-tight text-sm transition-all',
                  tudoOk && !salvando
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.99]'
                    : 'bg-[var(--border-main)] text-[var(--text-muted)] cursor-not-allowed'
                )}
              >
                {salvando ? 'Salvando...' : 'Trocar senha e continuar'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function CampoSenha({ label, value, onChange, mostrar, onToggleMostrar, placeholder, autoFocus }) {
  return (
    <div>
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
          autoFocus={autoFocus}
          className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded-2xl py-3.5 pl-11 pr-12 text-sm text-[var(--text-main)] focus:outline-none focus:border-blue-500/50 transition-all font-medium"
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
    </div>
  );
}
