import { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import {
  AlertCircle, AlertTriangle, Info, CheckCircle2, XCircle, Bell, Bot
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, Badge, EmptyState, SearchBar, Tabs, TabsList, TabsTrigger,
  Select, useToast
} from '../components/ui';

const SEVERIDADE_CFG = {
  CRITICAL: { label: 'Critico', variant: 'danger', icon: AlertCircle },
  ERROR: { label: 'Erro', variant: 'danger', icon: XCircle },
  WARNING: { label: 'Aviso', variant: 'warning', icon: AlertTriangle },
  INFO: { label: 'Info', variant: 'info', icon: Info },
};

const STATUS_CFG = {
  OPEN: { label: 'Aberto', variant: 'warning' },
  RESOLVED: { label: 'Resolvido', variant: 'success' },
  IGNORED: { label: 'Ignorado', variant: 'neutral' },
};

export default function AlertsPage() {
  const toast = useToast();
  const [alertas, setAlertas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('OPEN');
  const [filtroSeveridade, setFiltroSeveridade] = useState('');

  useEffect(() => { carregar(); }, []);

  // Socket.IO real-time
  useEffect(() => {
    const token = localStorage.getItem('@botmanager:token');
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3333', { auth: { token } });

    socket.on('novo_alerta', (a) => {
      setAlertas((prev) => [a, ...prev]);
      toast.warning(`Novo alerta: ${a.titulo}`);
    });
    socket.on('alerta_atualizado', (a) => {
      setAlertas((prev) => prev.map((x) => x.id === a.id ? { ...x, ...a } : x));
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await api.get('/alertas');
      setAlertas(r.data || []);
    } finally {
      setCarregando(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alertas.filter((a) => {
      if (filtroStatus && a.status !== filtroStatus) return false;
      if (filtroSeveridade && a.severidade !== filtroSeveridade) return false;
      if (q && !a.titulo?.toLowerCase().includes(q) && !a.mensagem?.toLowerCase().includes(q) && !a.cliente?.nome?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [alertas, busca, filtroStatus, filtroSeveridade]);

  const stats = useMemo(() => ({
    abertos: alertas.filter((a) => a.status === 'OPEN').length,
    criticos: alertas.filter((a) => a.status === 'OPEN' && a.severidade === 'CRITICAL').length,
    resolvidos: alertas.filter((a) => a.status === 'RESOLVED').length,
  }), [alertas]);

  const handleResolver = async (a) => {
    try {
      await api.patch(`/alertas/${a.id}/resolver`);
      toast.success('Alerta resolvido');
      setAlertas((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'RESOLVED' } : x));
    } catch {
      toast.error('Erro ao resolver');
    }
  };

  const handleIgnorar = async (a) => {
    try {
      await api.patch(`/alertas/${a.id}/ignorar`);
      toast.success('Alerta ignorado');
      setAlertas((prev) => prev.map((x) => x.id === a.id ? { ...x, status: 'IGNORED' } : x));
    } catch {
      toast.error('Erro ao ignorar');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Abertos" valor={stats.abertos} variant={stats.abertos > 0 ? 'warning' : 'neutral'} />
        <Kpi label="Criticos abertos" valor={stats.criticos} variant={stats.criticos > 0 ? 'danger' : 'neutral'} />
        <Kpi label="Resolvidos" valor={stats.resolvidos} variant="success" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
          <TabsList variant="pills">
            <TabsTrigger value="OPEN" variant="pills">Abertos</TabsTrigger>
            <TabsTrigger value="RESOLVED" variant="pills">Resolvidos</TabsTrigger>
            <TabsTrigger value="IGNORED" variant="pills">Ignorados</TabsTrigger>
            <TabsTrigger value="" variant="pills">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." />
        </div>
        <Select
          value={filtroSeveridade}
          onChange={(e) => setFiltroSeveridade(e.target.value)}
          placeholder="Toda severidade"
          options={Object.entries(SEVERIDADE_CFG).map(([k, v]) => ({ value: k, label: v.label }))}
          fullWidth={false}
          className="w-44"
        />
      </div>

      {carregando ? (
        <Card padding="lg"><div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div></Card>
      ) : filtrados.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={CheckCircle2}
            title={alertas.length === 0 ? 'Nenhum alerta' : 'Sem resultados'}
            description={alertas.length === 0 ? 'Tudo funcionando normalmente.' : null}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[var(--border-subtle)]">
            {filtrados.map((a) => {
              const sev = SEVERIDADE_CFG[a.severidade] || SEVERIDADE_CFG.INFO;
              const status = STATUS_CFG[a.status] || STATUS_CFG.OPEN;
              const SevIcone = sev.icon;
              return (
                <div key={a.id} className="px-5 py-4 hover:bg-[var(--bg-subtle)]/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      a.severidade === 'CRITICAL' || a.severidade === 'ERROR' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' :
                      a.severidade === 'WARNING' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' :
                      'bg-[var(--info-soft)] text-[var(--info)]'
                    }`}>
                      <SevIcone size={16} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{a.titulo}</h3>
                        <Badge variant={sev.variant} size="sm">{sev.label}</Badge>
                        <Badge variant={status.variant} size="sm">{status.label}</Badge>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">{a.mensagem}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-muted)]">
                        {a.cliente?.nome && (
                          <span className="font-semibold">{a.cliente.nome}</span>
                        )}
                        {a.bot?.nome && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1"><Bot size={10} /> {a.bot.nome}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(a.criadoEm).toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                    {a.status === 'OPEN' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handleIgnorar(a)}>Ignorar</Button>
                        <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => handleResolver(a)}>Resolver</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, valor, variant }) {
  return (
    <Card padding="lg">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 tabular-nums ${
        variant === 'danger' ? 'text-[var(--danger)]' :
        variant === 'warning' ? 'text-[var(--warning)]' :
        variant === 'success' ? 'text-[var(--success)]' :
        'text-[var(--text-main)]'
      }`}>{valor}</div>
    </Card>
  );
}
