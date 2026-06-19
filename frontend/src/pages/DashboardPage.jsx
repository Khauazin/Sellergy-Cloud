import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Bot, Bell, DollarSign, ArrowUpRight, Plus, ShieldCheck,
  Activity, AlertCircle, CheckCircle2, TrendingUp
} from 'lucide-react';
import api from '../services/api';
import {
  Card, CardHeader, CardTitle, Avatar, Badge, Button, EmptyState, KpiCard,
} from '../components/ui';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DashboardPage() {
  const [clientes, setClientes] = useState([]);
  const [bots, setBots] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [resClientes, resBots, resAlertas] = await Promise.all([
        api.get('/clientes').catch(() => ({ data: [] })),
        api.get('/bots').catch(() => ({ data: [] })),
        api.get('/alertas').catch(() => ({ data: [] })),
      ]);
      setClientes(resClientes.data || []);
      setBots(resBots.data || []);
      setAlertas(resAlertas.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const totalAtivos = clientes.filter((c) => c.status === 'ACTIVE').length;
  const mrr = clientes.reduce((acc, c) => acc + Number(c.mensalidade || 0), 0);
  const botsOnline = bots.filter((b) => b.status === 'ONLINE').length;
  const alertasAbertos = alertas.filter((a) => a.status === 'OPEN').length;
  const ultimosClientes = [...clientes]
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))
    .slice(0, 5);
  const ultimosAlertas = alertas.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          color="info"
          label="Clientes ativos"
          valor={`${totalAtivos}`}
          subvalor={`${clientes.length} no total`}
          carregando={carregando}
        />
        <KpiCard
          icon={DollarSign}
          color="accent"
          label="MRR"
          valor={fmtBRL(mrr)}
          subvalor="Receita mensal recorrente"
          carregando={carregando}
        />
        <KpiCard
          icon={Bot}
          color="success"
          label="Bots online"
          valor={`${botsOnline}`}
          subvalor={`${bots.length} cadastrados`}
          carregando={carregando}
        />
        <KpiCard
          icon={Bell}
          color={alertasAbertos > 0 ? 'warning' : 'success'}
          label="Alertas abertos"
          valor={`${alertasAbertos}`}
          subvalor={alertasAbertos > 0 ? 'Precisa de atencao' : 'Tudo certo'}
          carregando={carregando}
        />
      </div>

      {/* Linha principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ultimos clientes */}
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Ultimos clientes cadastrados</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Os 5 clientes mais recentes
              </p>
            </div>
            <Link to="/admin/clientes">
              <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">
                Ver todos
              </Button>
            </Link>
          </CardHeader>

          {ultimosClientes.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum cliente cadastrado"
              description="Comece adicionando seu primeiro cliente assinante."
              action={
                <Link to="/admin/clientes">
                  <Button variant="primary" icon={Plus}>Adicionar cliente</Button>
                </Link>
              }
            />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] -mx-2">
              {ultimosClientes.map((c) => (
                <Link
                  to={`/admin/clientes/${c.id}`}
                  key={c.id}
                  className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-[var(--bg-subtle)]/60 transition-colors"
                >
                  <Avatar name={c.nome} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">
                      {c.nome}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate">
                      {c.email || 'Sem email'} · {c.plano || 'BASIC'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
                      {fmtBRL(c.mensalidade)}
                    </div>
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'warning'} size="sm">
                      {c.status === 'ACTIVE' ? 'Ativo' : c.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Ultimos alertas */}
        <Card padding="lg">
          <CardHeader>
            <div>
              <CardTitle>Alertas recentes</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Ultimos eventos do sistema
              </p>
            </div>
            <Link to="/admin/alertas">
              <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">
                Todos
              </Button>
            </Link>
          </CardHeader>

          {ultimosAlertas.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={28} className="mx-auto text-[var(--success)] opacity-60" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-secondary)] font-medium mt-3">Nenhum alerta ativo</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Tudo funcionando</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ultimosAlertas.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-subtle)]/60 border border-[var(--border-subtle)]"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    a.severidade === 'CRITICAL' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' :
                    a.severidade === 'WARNING'  ? 'bg-[var(--warning-soft)] text-[var(--warning)]' :
                                                  'bg-[var(--info-soft)] text-[var(--info)]'
                  }`}>
                    <AlertCircle size={14} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">
                      {a.titulo}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] truncate">
                      {a.cliente?.nome || 'Sistema'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Acoes rapidas */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Acoes rapidas</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction to="/admin/clientes" icon={Plus} label="Novo cliente" desc="Cadastrar assinante" />
          <QuickAction to="/admin/clientes/permissoes" icon={ShieldCheck} label="Permissoes" desc="Liberar modulos" />
          <QuickAction to="/admin/bots" icon={Bot} label="Configurar bot" desc="IA e canais" />
          <QuickAction to="/admin/relatorios" icon={TrendingUp} label="Relatorios" desc="Visao consolidada" />
        </div>
      </Card>
    </div>
  );
}

// Kpi local removido — usa KpiCard compartilhado do ui/.

function QuickAction({ to, icon: Icon, label, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] hover:border-[var(--text-muted)] hover:shadow-[var(--shadow-xs)] transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)] transition-colors">
        <Icon size={16} strokeWidth={1.75} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">
          {label}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</div>
      </div>
      <ArrowUpRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" />
    </Link>
  );
}
