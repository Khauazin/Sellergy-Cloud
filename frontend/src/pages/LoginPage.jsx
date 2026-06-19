import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { Button, Input } from '../components/ui';
import SellergyLogo from '../components/SellergyLogo';

/**
 * Login do administrador do sistema. Layout split: lado esquerdo formulario,
 * lado direito apresentacao limpa com gradiente off-white.
 */
export default function LoginPage({ isAdmin = true }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { login, error, isLoading, isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.perfil === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (['CLIENT', 'ADMINISTRADOR', 'VENDEDOR'].includes(user.perfil)) {
        // Se um usuario de tenant entrou aqui por engano, desloga.
        logout();
      }
    }
  }, [isAuthenticated, user, navigate, logout]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, senha);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex">
      {/* Lado esquerdo - formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-2.5 mb-12 group">
            <SellergyLogo size={36} />
            <span className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              Sellergy Cloud
            </span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">
              Entrar no painel admin
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1.5">
              Acesso restrito a administradores do sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger-soft)]">
                <AlertCircle size={16} className="text-[var(--danger)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--danger-text)] font-medium">{error}</p>
              </div>
            )}

            <Input
              label="E-mail"
              type="email"
              icon={Mail}
              placeholder="admin@sellergy.cloud"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Senha"
              type="password"
              placeholder="Digite sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              icon={ArrowRight}
              iconPosition="right"
            >
              Entrar
            </Button>
          </form>

          <div className="mt-8 text-center">
            <Link
              to="/app/login"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors font-medium"
            >
              Nao e administrador? Acesse o portal do cliente
            </Link>
          </div>
        </div>
      </div>

      {/* Lado direito - hero (so desktop) */}
      <div className="hidden lg:flex w-1/2 bg-[var(--bg-subtle)] relative overflow-hidden">
        {/* Decorativo */}
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-[var(--accent-soft)]/40" />
        <div className="absolute -bottom-32 -left-20 w-[500px] h-[500px] rounded-full bg-[var(--primary-soft)]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <Sparkles size={12} className="text-[var(--accent)]" />
            Premium Admin
          </div>

          <div>
            <h2 className="text-3xl xl:text-4xl font-semibold tracking-tight text-[var(--text-main)] leading-tight max-w-md">
              Tudo o que voce precisa para operar centenas de bots em um unico painel.
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-4 max-w-sm leading-relaxed">
              Visao consolidada de clientes, atividades em tempo real, alertas criticos e relatorios financeiros.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--text-secondary)]">
            <Stat valor="99.9%" label="Uptime" />
            <Stat valor="< 200ms" label="Latencia" />
            <Stat valor="24/7" label="Suporte" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ valor, label }) {
  return (
    <div>
      <div className="text-lg font-semibold tracking-tight text-[var(--text-main)]">{valor}</div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</div>
    </div>
  );
}
