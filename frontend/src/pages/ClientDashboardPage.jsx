import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot, MessageCircle, Inbox, Sparkles, ArrowUpRight, AlertCircle,
  CheckCircle2, Activity, Send, Calendar, ShoppingBag, TrendingUp,
  Clock, Wifi, WifiOff
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { Card, CardHeader, CardTitle, Button, Badge, EmptyState, Avatar, KpiCard } from '../components/ui';
import { moduloLiberado } from '../constants/permissoes';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Visao geral do cliente — foco em ATENDIMENTO e VENDAS PELO BOT.
 *
 * Metricas centrais:
 *  - Conversas ativas / pendentes de atendimento humano
 *  - Mensagens trocadas hoje
 *  - Leads gerados pelo bot
 *  - Vendas atribuidas ao bot
 *  - Status dos bots (online/offline)
 *
 * NOTA: o modulo de Mensagens (chat) ainda nao foi implementado. Assim que
 * estiver pronto, esta tela puxa dados reais de conversas. Por enquanto,
 * usamos:
 *  - bots.totalMensagens / mensagensHoje / status para metricas de atividade
 *  - leads filtrados por origem (BOT) — futuro
 *  - vendas com leadId (vieram via lead, geralmente do bot)
 */
export default function ClientDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const modulos = user?.modulosLiberados || {};

  const [bots, setBots] = useState([]);
  const [leads, setLeads] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const promises = [];

      if (moduloLiberado(modulos, 'BOTS')) {
        promises.push(api.get('/bots').then((r) => setBots(r.data || [])).catch(() => setBots([])));
      }
      if (moduloLiberado(modulos, 'CRM')) {
        promises.push(api.get('/crm/leads').then((r) => setLeads(r.data || [])).catch(() => setLeads([])));
      }
      if (moduloLiberado(modulos, 'VENDAS')) {
        promises.push(api.get('/vendas').then((r) => setVendas(r.data || [])).catch(() => setVendas([])));
      }
      if (moduloLiberado(modulos, 'AGENDA')) {
        const hoje = new Date().toISOString().split('T')[0];
        promises.push(api.get(`/agenda?date=${hoje}`).then((r) => setAgendamentos(r.data || [])).catch(() => setAgendamentos([])));
      }

      await Promise.all(promises);
    } finally {
      setCarregando(false);
    }
  };

  // ─── Metricas focadas no BOT ──────────────────────────────
  const metricas = useMemo(() => {
    const botsOnline = bots.filter((b) => b.status === 'ONLINE').length;
    const totalBots = bots.length;
    const mensagensHoje = bots.reduce((acc, b) => acc + Number(b.mensagensHoje || 0), 0);
    const mensagensTotal = bots.reduce((acc, b) => acc + Number(b.totalMensagens || 0), 0);

    // Leads vindos pelo bot (origem == 'BOT' | 'WHATSAPP' | 'INSTAGRAM' etc.)
    // Como o backend nao normaliza isso, consideramos qualquer origem != 'MANUAL'
    const leadsBot = leads.filter((l) => l.origem && l.origem !== 'MANUAL');

    // Vendas atribuidas ao bot = vendas que tem leadId vinculado
    const vendasBot = vendas.filter((v) => v.leadId);
    const valorVendasBot = vendasBot.reduce((acc, v) => acc + Number(v.valor || 0), 0);

    // Conversas ativas = mock por enquanto (modulo Mensagens ainda em construcao)
    // TODO: integrar com /mensagens/conversas-ativas quando o backend estiver pronto
    const conversasAtivas = null;
    const conversasPendentes = null;

    return {
      botsOnline,
      totalBots,
      mensagensHoje,
      mensagensTotal,
      leadsBot,
      vendasBot,
      valorVendasBot,
      conversasAtivas,
      conversasPendentes,
    };
  }, [bots, leads, vendas]);

  const algumBotOnline = metricas.botsOnline > 0;
  const algumBotOffline = metricas.totalBots > 0 && metricas.botsOnline < metricas.totalBots;

  return (
    <div className="space-y-6">
      {/* Saudacao */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-1">
            Ola, {user?.nome?.split(' ')[0] || 'usuario'}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Acompanhe o atendimento e as vendas geradas pelo seu bot.
          </p>
        </div>
        <div className="flex gap-2">
          {moduloLiberado(modulos, 'CRM') && (
            <Link to="/app/mensagens">
              <Button variant="secondary" icon={MessageCircle}>Inbox</Button>
            </Link>
          )}
          {moduloLiberado(modulos, 'BOTS') && (
            <Link to="/app/bots">
              <Button variant="primary" icon={Bot}>Configurar bot</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status do bot — destaque no topo */}
      {moduloLiberado(modulos, 'BOTS') && metricas.totalBots > 0 && (
        <Card padding="lg" className={algumBotOffline ? 'border-[var(--warning-soft)]' : ''}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                algumBotOnline ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--danger-soft)] text-[var(--danger)]'
              }`}>
                {algumBotOnline ? <Wifi size={18} strokeWidth={2} /> : <WifiOff size={18} strokeWidth={2} />}
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
                  {algumBotOnline ? `${metricas.botsOnline} de ${metricas.totalBots} bots online` : 'Nenhum bot online'}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {algumBotOffline ? 'Verifique os bots offline para nao perder atendimentos.' : 'Tudo funcionando normalmente.'}
                </div>
              </div>
            </div>
            <Link to="/app/bots">
              <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">
                Gerenciar bots
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* KPIs - foco em BOT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={MessageCircle}
          color="accent"
          label="Mensagens hoje"
          valor={metricas.mensagensHoje}
          subvalor={`${metricas.mensagensTotal} no total`}
          carregando={carregando}
        />
        <KpiCard
          icon={Inbox}
          color="info"
          label="Conversas ativas"
          valor={metricas.conversasAtivas != null ? metricas.conversasAtivas : '—'}
          subvalor="Modulo de Mensagens em breve"
          carregando={carregando}
        />
        <KpiCard
          icon={Sparkles}
          color="success"
          label="Leads via bot"
          valor={metricas.leadsBot.length}
          subvalor={`${leads.length} leads totais`}
          carregando={carregando}
        />
        <KpiCard
          icon={ShoppingBag}
          color="warning"
          label="Vendas via bot"
          valor={fmtBRL(metricas.valorVendasBot)}
          subvalor={`${metricas.vendasBot.length} vendas atribuidas`}
          carregando={carregando}
        />
      </div>

      {/* Linha principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Conversas / atendimento humano necessario */}
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Atendimento</CardTitle>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Conversas que precisam de atencao humana
              </p>
            </div>
            <Link to="/app/mensagens">
              <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">
                Ver inbox
              </Button>
            </Link>
          </CardHeader>

          <EmptyState
            icon={MessageCircle}
            title="Modulo de Mensagens em construcao"
            description="Em breve voce vera aqui as conversas do bot em tempo real e podera intervir quando o cliente precisar de voce."
            action={
              <Link to="/app/mensagens">
                <Button variant="secondary" size="sm">
                  Saber mais
                </Button>
              </Link>
            }
          />
        </Card>

        {/* Performance do bot */}
        {moduloLiberado(modulos, 'BOTS') && (
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Performance do bot</CardTitle>
              </div>
            </CardHeader>

            {metricas.totalBots === 0 ? (
              <EmptyState
                icon={Bot}
                title="Nenhum bot ainda"
                description="Configure seu primeiro bot para comecar."
                action={
                  <Link to="/app/bots">
                    <Button variant="primary" size="sm" icon={Bot}>Criar bot</Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {bots.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--bg-subtle)]/50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      b.status === 'ONLINE' ? 'bg-[var(--success)]' :
                      b.status === 'ERROR' ? 'bg-[var(--danger)]' :
                      'bg-[var(--text-muted)]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">
                        {b.nome}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {b.canal} · {b.totalMensagens || 0} msgs
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-[var(--text-secondary)] tabular-nums">
                      +{b.mensagensHoje || 0}
                    </div>
                  </div>
                ))}
                {bots.length > 4 && (
                  <Link
                    to="/app/bots"
                    className="block text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors py-1"
                  >
                    + {bots.length - 4} bots
                  </Link>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Linha 2 - leads e vendas via bot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leads recentes via bot */}
        {moduloLiberado(modulos, 'CRM') && (
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Leads gerados pelo bot</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Contatos que o bot trouxe pra voce
                </p>
              </div>
              <Link to="/app/crm">
                <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">
                  Ver CRM
                </Button>
              </Link>
            </CardHeader>

            {metricas.leadsBot.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nenhum lead pelo bot ainda"
                description="Quando o bot conversar com clientes e capturar dados, eles aparecem aqui."
              />
            ) : (
              <div className="space-y-1.5">
                {metricas.leadsBot.slice(0, 5).map((l) => (
                  <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-subtle)]/60 transition-colors">
                    <Avatar name={l.nome} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight truncate">
                        {l.nome}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                        <Badge variant="accent" size="sm">{l.origem}</Badge>
                        <span>·</span>
                        <Clock size={10} />
                        {new Date(l.criadoEm).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    {l.valor > 0 && (
                      <div className="text-xs font-semibold text-[var(--text-main)] tabular-nums">
                        {fmtBRL(l.valor)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Agendamentos de hoje OU vendas via bot */}
        {moduloLiberado(modulos, 'AGENDA') ? (
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Agenda de hoje</CardTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Marcacoes confirmadas pelo bot
                </p>
              </div>
              <Link to="/app/agenda">
                <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">
                  Agenda
                </Button>
              </Link>
            </CardHeader>

            {agendamentos.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Nada agendado"
                description="Sem agendamentos para hoje."
              />
            ) : (
              <div className="space-y-2">
                {agendamentos.slice(0, 4).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40">
                    <div className="w-12 text-center flex-shrink-0">
                      <div className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
                        {new Date(a.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div className="w-px h-9 bg-[var(--border-main)]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-main)] truncate">
                        {a.servico || 'Servico'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {a.nomeCliente}
                      </div>
                    </div>
                    {a.origem === 'AI' && (
                      <Badge variant="accent" size="sm" icon={Sparkles}>Bot</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : moduloLiberado(modulos, 'VENDAS') && (
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Vendas via bot</CardTitle>
              </div>
              <Link to="/app/vendas">
                <Button variant="ghost" size="sm" icon={ArrowUpRight} iconPosition="right">Vendas</Button>
              </Link>
            </CardHeader>
            {metricas.vendasBot.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="Nenhuma venda atribuida ao bot ainda" />
            ) : (
              <div className="space-y-1.5">
                {metricas.vendasBot.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-subtle)]/60">
                    <div className="text-sm text-[var(--text-secondary)] truncate">
                      {v.descricao || 'Venda'}
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-main)] tabular-nums">
                      {fmtBRL(v.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Atalhos rapidos */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Atalhos rapidos</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {moduloLiberado(modulos, 'CRM') && <QuickAction to="/app/mensagens" icon={MessageCircle} label="Mensagens" desc="Atender clientes" />}
          {moduloLiberado(modulos, 'BOTS') && <QuickAction to="/app/campanhas" icon={Send} label="Campanhas" desc="Disparar mensagens" />}
          {moduloLiberado(modulos, 'BOTS') && <QuickAction to="/app/bots" icon={Bot} label="Configurar bot" desc="Prompt e canais" />}
          {moduloLiberado(modulos, 'RELATORIOS') && <QuickAction to="/app/relatorios" icon={TrendingUp} label="Relatorios" desc="Performance" />}
        </div>
      </Card>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 p-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)] hover:border-[var(--text-muted)] hover:shadow-[var(--shadow-xs)] transition-all"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--accent-soft)] transition-colors">
        <Icon size={16} strokeWidth={1.75} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{label}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</div>
      </div>
      <ArrowUpRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors" />
    </Link>
  );
}
