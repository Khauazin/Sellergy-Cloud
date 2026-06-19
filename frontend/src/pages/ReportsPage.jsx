import { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, Bot, DollarSign, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, Badge, EmptyState, KpiCard } from '../components/ui';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Relatorios consolidados para o admin: visao agregada de todos os tenants.
 */
export default function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [c, b, a] = await Promise.all([
        api.get('/clientes').catch(() => ({ data: [] })),
        api.get('/bots').catch(() => ({ data: [] })),
        api.get('/alertas').catch(() => ({ data: [] })),
      ]);
      const clientes = c.data || [];
      const bots = b.data || [];
      const alertas = a.data || [];

      const ativos = clientes.filter((x) => x.status === 'ACTIVE');
      setStats({
        totalClientes: clientes.length,
        clientesAtivos: ativos.length,
        clientesPlanos: clientes.reduce((acc, x) => {
          const p = x.plano || 'BASIC';
          acc[p] = (acc[p] || 0) + 1;
          return acc;
        }, {}),
        mrr: ativos.reduce((acc, x) => acc + Number(x.mensalidade || 0), 0),
        totalBots: bots.length,
        botsOnline: bots.filter((x) => x.status === 'ONLINE').length,
        msgsHoje: bots.reduce((acc, x) => acc + Number(x.mensagensHoje || 0), 0),
        msgsTotal: bots.reduce((acc, x) => acc + Number(x.totalMensagens || 0), 0),
        alertasAbertos: alertas.filter((x) => x.status === 'OPEN').length,
        alertasCriticos: alertas.filter((x) => x.status === 'OPEN' && x.severidade === 'CRITICAL').length,
      });
    } finally {
      setCarregando(false);
    }
  };

  if (carregando) {
    return (
      <Card padding="lg">
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando relatorios...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Visao geral */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Visao geral consolidada</CardTitle>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Metricas agregadas de todos os tenants</p>
          </div>
        </CardHeader>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Users} color="info" label="Clientes ativos" valor={stats.clientesAtivos} subvalor={`${stats.totalClientes} no total`} />
          <KpiCard icon={DollarSign} color="accent" label="MRR" valor={fmtBRL(stats.mrr)} />
          <KpiCard icon={Bot} color="success" label="Bots online" valor={stats.botsOnline} subvalor={`${stats.totalBots} cadastrados`} />
          <KpiCard icon={AlertCircle} color={stats.alertasAbertos > 0 ? 'warning' : 'neutral'} label="Alertas abertos" valor={stats.alertasAbertos} subvalor={`${stats.alertasCriticos} criticos`} />
        </div>
      </Card>

      {/* Distribuicao por plano */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Distribuicao por plano</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-3 gap-3">
          {['BASIC', 'PRO', 'PREMIUM'].map((plano) => (
            <div key={plano} className="border border-[var(--border-main)] rounded-xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{plano}</div>
              <div className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1 tabular-nums">
                {stats.clientesPlanos[plano] || 0}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Trafego do bot */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Trafego dos bots</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <KpiCard icon={TrendingUp} color="info" label="Mensagens hoje" valor={stats.msgsHoje.toLocaleString('pt-BR')} />
          <KpiCard icon={BarChart3} color="accent" label="Total acumulado" valor={stats.msgsTotal.toLocaleString('pt-BR')} />
        </div>
      </Card>

      {/* Em breve */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Em breve</CardTitle>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Relatorios avancados no roadmap</p>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FuturoCard titulo="Receita por mes" desc="Evolucao de MRR + churn + LTV" />
          <FuturoCard titulo="Performance por bot" desc="Taxa de resposta automatica vs humana" />
          <FuturoCard titulo="Conversao por funil" desc="Leads que viraram venda em cada etapa do CRM" />
          <FuturoCard titulo="Saude do sistema" desc="Latencia, erros, disponibilidade dos webhooks" />
        </div>
      </Card>
    </div>
  );
}

// Kpi local removido — usa KpiCard compartilhado do ui/.

function FuturoCard({ titulo, desc }) {
  return (
    <div className="border border-dashed border-[var(--border-main)] rounded-xl p-4 opacity-70">
      <div className="flex items-center gap-2 mb-1">
        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{titulo}</div>
        <Badge variant="warning" size="sm">Em breve</Badge>
      </div>
      <div className="text-xs text-[var(--text-muted)]">{desc}</div>
    </div>
  );
}
