import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bot, Mail, ArrowRight, AlertCircle, MessageCircle, Calendar, ShoppingBag } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { Button, Input } from '../components/ui';

/**
 * Login do cliente final (CLIENT, ADMINISTRADOR, VENDEDOR).
 */
export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const { login, error, isLoading, isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.perfil === 'ADMIN') {
        logout();
      } else if (['CLIENT', 'ADMINISTRADOR', 'VENDEDOR'].includes(user.perfil)) {
        navigate('/app/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate, logout]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(email, senha);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex">
      {/* Hero esquerda (so desktop) */}
      <div className="hidden lg:flex w-1/2 bg-[var(--bg-subtle)] relative overflow-hidden">
        <div className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full bg-[var(--accent-soft)]/50" />
        <div className="absolute -bottom-40 -right-20 w-96 h-96 rounded-full bg-[var(--primary-soft)]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center">
              <Bot size={18} className="text-[var(--text-on-primary)]" strokeWidth={2.25} />
            </div>
            <span className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              BotManager
            </span>
          </Link>

          <div>
            <h2 className="text-3xl xl:text-4xl font-semibold tracking-tight text-[var(--text-main)] leading-tight max-w-md">
              O atendimento da sua loja, no piloto automatico.
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-4 max-w-sm leading-relaxed">
              CRM, agenda, vendas, mensagens e estoque em um so lugar. Atendimento humano quando o bot precisar de voce.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Feature icon={MessageCircle} label="Inbox unificada" />
              <Feature icon={Calendar} label="Agenda integrada" />
              <Feature icon={ShoppingBag} label="Vendas + estoque" />
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] font-medium">
            Sua plataforma · {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center">
              <Bot size={18} className="text-[var(--text-on-primary)]" strokeWidth={2.25} />
            </div>
            <span className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              BotManager
            </span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1.5">
              Entre com seu e-mail e senha para acessar o painel da loja.
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
              placeholder="seuemail@email.com"
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
              to="/admin/login"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors font-medium"
            >
              Voce e administrador do sistema? Acesse aqui
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)]">
      <Icon size={14} strokeWidth={1.75} className="text-[var(--accent)]" />
      <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-tight">{label}</span>
    </div>
  );
}
