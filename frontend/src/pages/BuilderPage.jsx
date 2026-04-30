import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Workflow, ArrowLeft, Construction, Sparkles, Webhook, Clock, MousePointerClick,
  GitBranch, Code as CodeIcon, MessageSquare, Bot, Database, Filter,
  Layers, AlertTriangle, CheckCircle2, Globe
} from 'lucide-react';
import api from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, Button, Badge, useToast } from '../components/ui';

/**
 * Builder placeholder — preparacao para o engine completo (escopo tecnico
 * inspirado no n8n com engine proprio).
 *
 * Esta tela mostra o que ja existe (Bot atual, Fluxos cadastrados) e
 * apresenta o roadmap do construtor visual completo.
 */
export default function BuilderPage() {
  const { botId } = useParams();
  const toast = useToast();
  const [bot, setBot] = useState(null);
  const [fluxos, setFluxos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [b, f] = await Promise.all([
        api.get(`/bots/${botId}`).catch(() => ({ data: null })),
        api.get(`/builder/flows/${botId}`).catch(() => ({ data: [] })),
      ]);
      setBot(b.data);
      setFluxos(f.data || []);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-5 max-w-[1200px]">
      {/* Header com volta */}
      <div className="flex items-center gap-3">
        <Link to="/admin/bots">
          <Button variant="ghost" icon={ArrowLeft} size="sm">Voltar para bots</Button>
        </Link>
      </div>

      {/* Bot atual */}
      <Card padding="lg">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <Bot size={20} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text-main)]">
                {carregando ? 'Carregando...' : (bot?.nome || 'Bot nao encontrado')}
              </h1>
              {bot && <Badge variant="neutral">{bot.canal}</Badge>}
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Construtor visual de fluxo de atendimento
            </p>
          </div>
        </div>
      </Card>

      {/* Aviso de roadmap */}
      <Card padding="lg" className="border-[var(--accent-border)] bg-[var(--accent-soft)]/30">
        <div className="flex items-start gap-3">
          <Construction size={20} className="text-[var(--accent)] flex-shrink-0 mt-1" strokeWidth={1.75} />
          <div className="flex-1">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              Construtor visual em desenvolvimento
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              A tela de canvas drag-and-drop completa (estilo n8n) esta no roadmap.
              O engine proprio sera construido em 4 fases conforme escopo tecnico aprovado.
              Por enquanto, a estrutura de fluxos abaixo ja esta no banco e pode ser
              consumida pelo motor do bot.
            </p>
            <div className="flex gap-2 mt-3">
              <Badge variant="success" size="sm" icon={CheckCircle2}>Backend pronto</Badge>
              <Badge variant="warning" size="sm">Canvas: Fase 1</Badge>
              <Badge variant="neutral" size="sm">Engine BullMQ: Fase 2</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Roadmap de Fases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FaseCard
          numero="Fase 1"
          duracao="4-6 semanas"
          status="next"
          titulo="MVP do canvas"
          itens={[
            'Auth + RBAC + Projects',
            'CRUD de Workflow',
            'Engine sincrono single-process',
            '5 nos basicos: Manual, HTTP, IF, Set, Code',
            'Canvas React Flow basico',
          ]}
        />
        <FaseCard
          numero="Fase 2"
          duracao="3-4 semanas"
          status="planned"
          titulo="Execucao distribuida"
          itens={[
            'BullMQ + Worker separado',
            'Webhook e Schedule triggers',
            'Execution log com WebSocket',
            'Sistema de credenciais com criptografia AES-256',
          ]}
        />
        <FaseCard
          numero="Fase 3"
          duracao="4-6 semanas"
          status="planned"
          titulo="IA e integracoes"
          itens={[
            'Nos proprietarios do CRM',
            'AI Agent + vector store (pgvector)',
            'Chat trigger',
            'WhatsApp (Meta Cloud API), Telegram',
          ]}
        />
        <FaseCard
          numero="Fase 4"
          duracao="Continuo"
          status="planned"
          titulo="Recursos avancados"
          itens={[
            'Sub-workflows e error workflows',
            'Retry policies avancadas',
            'Versionamento + Git sync',
            'Evaluations de IA',
            'MCP server/client',
          ]}
        />
      </div>

      {/* Catalogo de nos do MVP */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Catalogo de nos do MVP</CardTitle>
            <CardDescription>~27 nos + pacote proprietario do CRM</CardDescription>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <CategoriaCard
            icon={Webhook}
            titulo="Triggers"
            count={5}
            cor="info"
            nos={['Webhook', 'Schedule', 'Manual', 'Form', 'Chat']}
          />
          <CategoriaCard
            icon={GitBranch}
            titulo="Logica e Controle"
            count={10}
            cor="primary"
            nos={['HTTP Request', 'IF', 'Switch', 'Merge', 'Loop', 'Set', 'Code', 'Wait', 'Respond', 'Sub-workflow']}
          />
          <CategoriaCard
            icon={Filter}
            titulo="Dados"
            count={4}
            cor="neutral"
            nos={['Filter', 'Aggregate', 'Sort', 'Limit']}
          />
          <CategoriaCard
            icon={MessageSquare}
            titulo="Comunicacao"
            count={4}
            cor="success"
            nos={['Email SMTP', 'WhatsApp', 'Telegram', 'Slack']}
          />
          <CategoriaCard
            icon={Sparkles}
            titulo="IA (LangChain)"
            count={4}
            cor="accent"
            nos={['AI Agent', 'LLM Chain', 'Vector Store', 'Embeddings']}
          />
          <CategoriaCard
            icon={Database}
            titulo="CRM (custom)"
            count="—"
            cor="warning"
            nos={['Nos proprietarios — diferencial competitivo']}
          />
        </div>
      </Card>

      {/* Fluxos ja cadastrados (do backend atual) */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Fluxos cadastrados</CardTitle>
            <CardDescription>Estrutura ja existente no banco (modelo simples atual)</CardDescription>
          </div>
        </CardHeader>

        {fluxos.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[var(--border-main)] rounded-xl">
            <Layers size={28} className="mx-auto text-[var(--text-muted)] opacity-50" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-muted)] mt-3">Nenhum fluxo cadastrado para este bot</p>
          </div>
        ) : (
          <div className="space-y-2">
            {fluxos.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-main)]">
                <Workflow size={16} className="text-[var(--text-secondary)]" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{f.name || f.nome}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {f.nodes?.length || 0} nos · {f.edges?.length || 0} conexoes · Gatilho: {f.triggerType || f.tipoGatilho}
                  </div>
                </div>
                <Badge variant={f.isActive || f.ativo ? 'success' : 'neutral'} size="sm">
                  {f.isActive || f.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Stack proposta */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Stack proposta</CardTitle>
            <CardDescription>Tecnologias do engine proprio</CardDescription>
          </div>
        </CardHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <StackChip label="NestJS + Fastify" desc="HTTP + WS" />
          <StackChip label="PostgreSQL 16" desc="JSONB + pgvector" />
          <StackChip label="Redis 7 + BullMQ" desc="Filas e cache" />
          <StackChip label="React 18 + React Flow" desc="Canvas" />
          <StackChip label="isolated-vm" desc="Sandbox Code node" />
          <StackChip label="OpenTelemetry + Pino" desc="Observabilidade" />
        </div>
      </Card>
    </div>
  );
}

function FaseCard({ numero, duracao, status, titulo, itens }) {
  const statusCfg = {
    next: { label: 'Proxima', variant: 'accent' },
    planned: { label: 'Planejado', variant: 'neutral' },
    done: { label: 'Concluida', variant: 'success' },
  };
  const s = statusCfg[status] || statusCfg.planned;

  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{numero}</div>
          <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)] mt-0.5">{titulo}</h3>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">{duracao}</div>
        </div>
        <Badge variant={s.variant} size="sm">{s.label}</Badge>
      </div>
      <ul className="space-y-1.5">
        {itens.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <div className="w-1 h-1 rounded-full bg-[var(--text-muted)] mt-1.5 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CategoriaCard({ icon: Icon, titulo, count, nos, cor }) {
  const corMap = {
    info: 'bg-[var(--info-soft)] text-[var(--info)]',
    primary: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
    neutral: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
    success: 'bg-[var(--success-soft)] text-[var(--success)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  };

  return (
    <div className="border border-[var(--border-main)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${corMap[cor]}`}>
          <Icon size={14} strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{titulo}</div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{count} {typeof count === 'number' ? 'nos' : ''}</div>
        </div>
      </div>
      <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        {nos.join(' · ')}
      </div>
    </div>
  );
}

function StackChip({ label, desc }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-subtle)]">
      <div>
        <div className="text-xs font-semibold text-[var(--text-main)]">{label}</div>
        <div className="text-[10px] text-[var(--text-muted)]">{desc}</div>
      </div>
    </div>
  );
}
