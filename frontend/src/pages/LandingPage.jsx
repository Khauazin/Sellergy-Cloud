import { Link } from 'react-router-dom';
import { Bot, ArrowRight, MessageCircle, Calendar, ShoppingBag, BarChart3, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '../components/ui';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)]">
      {/* Header */}
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between max-w-[1400px] mx-auto">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Bot size={18} className="text-[var(--text-on-primary)]" strokeWidth={2.25} />
          </div>
          <span className="text-base font-semibold tracking-tight text-[var(--text-main)]">
            Sellergy Cloud
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/app/login">
            <Button variant="primary" size="md">Entrar</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 lg:px-12 pt-12 pb-20 max-w-[1400px] mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-semibold tracking-tight mb-6">
            <Sparkles size={12} />
            Plataforma premium de atendimento via bots
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-[var(--text-main)] leading-[1.05]">
            Atendimento automatizado.<br />
            Vendas humanizadas.
          </h1>
          <p className="text-base md:text-lg text-[var(--text-secondary)] mt-6 max-w-xl mx-auto leading-relaxed">
            Bots inteligentes integrados a CRM, agenda, estoque e financeiro. Tudo o que sua loja precisa em um unico painel premium.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link to="/app/login">
              <Button variant="primary" size="lg" icon={ArrowRight} iconPosition="right">
                Acessar minha loja
              </Button>
            </Link>
          </div>
        </div>

        {/* Recursos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-20">
          <Recurso
            icon={MessageCircle}
            titulo="Inbox unificada"
            desc="Atenda whatsapp, instagram e site por um painel so. Bot responde sozinho ou passa pra voce."
          />
          <Recurso
            icon={Calendar}
            titulo="Agenda integrada"
            desc="Agendamentos automaticos via bot. Confirma, cancela e lembra os clientes pra voce."
          />
          <Recurso
            icon={ShoppingBag}
            titulo="Vendas e estoque"
            desc="Cada venda baixa estoque e gera lancamento financeiro. Sem planilha paralela."
          />
          <Recurso
            icon={BarChart3}
            titulo="Relatorios premium"
            desc="DRE, fluxo de caixa, CMV e dashboards. Saiba o que ta dando lucro de verdade."
          />
          <Recurso
            icon={ShieldCheck}
            titulo="Multi-usuario com permissoes"
            desc="Cadastre vendedores e administradores com permissoes granulares por modulo."
          />
          <Recurso
            icon={Sparkles}
            titulo="Premium por padrao"
            desc="Interface limpa, light/dark, mobile-first. Sua equipe vai querer usar."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-main)] px-6 lg:px-12 py-8">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-muted)]">
          <div>© {new Date().getFullYear()} Sellergy Cloud — Todos os direitos reservados</div>
          <div className="flex gap-4">
            <Link to="/app/login" className="hover:text-[var(--text-main)] transition-colors">Acessar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Recurso({ icon: Icon, titulo, desc }) {
  return (
    <div className="p-6 rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)] hover:border-[var(--text-muted)] hover:shadow-[var(--shadow-sm)] transition-all">
      <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center mb-4">
        <Icon size={18} strokeWidth={1.75} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)]">{titulo}</h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">{desc}</p>
    </div>
  );
}
