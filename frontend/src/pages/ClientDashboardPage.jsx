import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Calendar, ArrowUpRight, Clock } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { Card, CardHeader, CardTitle, EmptyState, Badge } from '../components/ui';
import { moduloLiberado } from '../constants/permissoes';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const horaDe = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// Status de venda -> rotulo + variante de badge (sobrio: semantico, sem accent).
const STATUS_VENDA = {
  COMPLETED: { rotulo: 'Concluída', variant: 'success' },
  PENDING: { rotulo: 'Pendente', variant: 'warning' },
  CANCELLED: { rotulo: 'Cancelada', variant: 'danger' },
  REFUNDED: { rotulo: 'Estornada', variant: 'neutral' },
};

/**
 * Visao geral do tenant — painel de GESTAO (pos-pivo ERP-first).
 * Usa dados ja disponiveis: vendas, agendamentos e leads. Sem metricas de
 * "bot/inbox" (aquele era o produto antigo).
 */
export default function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const modulos = user?.modulosLiberados || {};

  const [vendas, setVendas] = useState([]);
  const [leads, setLeads] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);

  useEffect(() => {
    const carregar = async () => {
      const promises = [];
      if (moduloLiberado(modulos, 'VENDAS')) {
        promises.push(api.get('/vendas').then((r) => setVendas(r.data || [])).catch(() => setVendas([])));
      }
      if (moduloLiberado(modulos, 'CRM')) {
        promises.push(api.get('/crm/leads').then((r) => setLeads(r.data || [])).catch(() => setLeads([])));
      }
      if (moduloLiberado(modulos, 'AGENDA')) {
        const hoje = new Date().toISOString().split('T')[0];
        promises.push(api.get(`/agenda?date=${hoje}`).then((r) => setAgendamentos(r.data || [])).catch(() => setAgendamentos([])));
      }
      await Promise.all(promises);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = useMemo(() => {
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const vendasHoje = vendas.filter((v) => new Date(v.data) >= inicioHoje && v.status !== 'CANCELLED');
    const totalHoje = vendasHoje.reduce((acc, v) => acc + Number(v.valor || 0), 0);
    const ticket = vendasHoje.length ? totalHoje / vendasHoje.length : 0;
    const recentes = [...vendas].sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 5);
    const agendaDoDia = [...agendamentos].sort((a, b) => new Date(a.data) - new Date(b.data));
    const agendPendentes = agendamentos.filter((a) => a.status === 'PENDING').length;

    return {
      totalHoje, qtdHoje: vendasHoje.length, ticket, recentes,
      agendaDoDia, agendHoje: agendamentos.length, agendPendentes,
      totalLeads: leads.length,
    };
  }, [vendas, agendamentos, leads]);

  const temVendas = moduloLiberado(modulos, 'VENDAS');
  const temAgenda = moduloLiberado(modulos, 'AGENDA');
  const temCrm = moduloLiberado(modulos, 'CRM');
  const primeiroNome = (user?.nome || user?.name || 'você').split(' ')[0];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1">Olá, {primeiroNome}</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Como está o seu negócio hoje.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {temVendas && <Kpi label="Vendas hoje" valor={fmtBRL(m.totalHoje)} sub={`${m.qtdHoje} ${m.qtdHoje === 1 ? 'venda' : 'vendas'}`} />}
        {temVendas && <Kpi label="Ticket médio" valor={fmtBRL(m.ticket)} sub="por venda hoje" />}
        {temAgenda && <Kpi label="Agendamentos hoje" valor={m.agendHoje} sub={`${m.agendPendentes} pendentes`} />}
        {temCrm && <Kpi label="Leads no funil" valor={m.totalLeads} sub="em aberto" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* Vendas recentes */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Vendas recentes</CardTitle>
            <Link to="/app/vendas" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
              Ver vendas <ArrowUpRight size={13} />
            </Link>
          </CardHeader>
          {m.recentes.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Nenhuma venda ainda" description="As vendas registradas aparecem aqui." />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {m.recentes.map((v) => {
                const st = STATUS_VENDA[v.status] || { rotulo: v.status, variant: 'neutral' };
                return (
                  <div key={v.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[var(--text-main)]">{v.numero ? `Venda #${v.numero}` : 'Venda'}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {v.descricao || v.metodoPagamento || '—'} · {horaDe(v.data)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-main)] tabular-nums">{fmtBRL(v.valor)}</div>
                    <Badge variant={st.variant} size="sm">{st.rotulo}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Agenda do dia */}
        <Card padding="md">
          <CardHeader>
            <CardTitle>Agenda de hoje</CardTitle>
            {temAgenda && (
              <Link to="/app/agenda" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
                Abrir <ArrowUpRight size={13} />
              </Link>
            )}
          </CardHeader>
          {!temAgenda ? (
            <EmptyState icon={Calendar} title="Agenda não ativa" description="Disponível para negócios de serviço." />
          ) : m.agendaDoDia.length === 0 ? (
            <EmptyState icon={Clock} title="Dia livre" description="Nenhum agendamento para hoje." />
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {m.agendaDoDia.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="text-sm font-semibold text-[var(--text-main)] tabular-nums w-12 flex-shrink-0">{horaDe(a.data)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--text-main)] truncate">{a.nomeCliente || 'Cliente'}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate">{a.servico || 'Atendimento'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, valor, sub }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1 tabular-nums">{valor}</div>
      {sub && <div className="text-xs text-[var(--text-muted)] mt-1.5">{sub}</div>}
    </div>
  );
}
