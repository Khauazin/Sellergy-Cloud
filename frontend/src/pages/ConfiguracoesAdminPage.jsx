import { useNavigate } from 'react-router-dom';
import {
  Sun, Moon, ShieldCheck, Users, Sparkles, Database, Server, Lock
} from 'lucide-react';
import { useUiStore } from '../store/ui.store';
import {
  Card, CardHeader, CardTitle, CardDescription, Tabs, TabsList, TabsTrigger,
  TabsContent, Badge
} from '../components/ui';

/**
 * Configuracoes do painel admin (sistema). Diferente de Configuracoes do cliente.
 * Aqui o admin gerencia comportamento global do produto, integracoes do sistema,
 * limites, ajustes tecnicos.
 */
export default function ConfiguracoesAdminPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useUiStore();

  return (
    <div className="space-y-5 max-w-3xl">
      <Tabs defaultValue="aparencia">
        <TabsList variant="pills">
          <TabsTrigger value="aparencia" variant="pills">Aparencia</TabsTrigger>
          <TabsTrigger value="acessos" variant="pills">Acessos</TabsTrigger>
          <TabsTrigger value="sistema" variant="pills">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="aparencia" className="mt-5 space-y-5">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Tema do painel</CardTitle>
                <CardDescription>Aparencia da sua interface administrativa.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3">
              <ThemeOption value="light" current={theme} onChange={setTheme} icon={Sun} label="Claro" desc="Padrao premium light" />
              <ThemeOption value="dark" current={theme} onChange={setTheme} icon={Moon} label="Escuro" desc="Estilo Linear/Vercel" />
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Design system
                  <Badge variant="neutral" size="sm">Dev only</Badge>
                </CardTitle>
                <CardDescription>Catalogo de tokens, cores e primitivos do design system v2.</CardDescription>
              </div>
            </CardHeader>
            <button
              onClick={() => navigate('/admin/_design')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-[var(--border-main)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-subtle)]/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">Abrir showcase</div>
                <div className="text-xs text-[var(--text-muted)]">Revisar paleta, primitivos e padroes em /admin/_design</div>
              </div>
            </button>
          </Card>
        </TabsContent>

        <TabsContent value="acessos" className="mt-5 space-y-2">
          <ConfigLink icon={ShieldCheck} titulo="Permissoes por cliente" desc="Liberar/bloquear modulos por tenant" onClick={() => navigate('/admin/clientes/permissoes')} />
          <ConfigLink icon={Users} titulo="Equipe administrativa" desc="Outros administradores do sistema" onClick={() => navigate('/admin/usuarios')} />
        </TabsContent>

        <TabsContent value="sistema" className="mt-5 space-y-3">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Configuracoes de sistema</CardTitle>
                <CardDescription>Ajustes tecnicos do produto. Em breve.</CardDescription>
              </div>
            </CardHeader>
            <div className="space-y-2">
              <FuturoItem icon={Database} titulo="Backup e snapshots" desc="Politica de backup automatizado do banco" />
              <FuturoItem icon={Server} titulo="Limites por plano" desc="Quotas de bots, mensagens e armazenamento por tier" />
              <FuturoItem icon={Lock} titulo="Auditoria" desc="Audit log de acoes sensiveis com filtros e export" />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThemeOption({ value, current, onChange, icon: Icon, label, desc }) {
  const ativo = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`p-4 rounded-xl border-2 transition-colors text-left ${
        ativo ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40' : 'border-[var(--border-main)] hover:border-[var(--text-muted)]'
      }`}
    >
      <Icon size={18} className={ativo ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} strokeWidth={1.75} />
      <div className="text-sm font-semibold text-[var(--text-main)] mt-2">{label}</div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</div>
    </button>
  );
}

function ConfigLink({ icon: Icon, titulo, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-subtle)]/50 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-[var(--text-secondary)]" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{titulo}</div>
        <div className="text-xs text-[var(--text-muted)]">{desc}</div>
      </div>
    </button>
  );
}

function FuturoItem({ icon: Icon, titulo, desc }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-[var(--border-main)] opacity-70">
      <div className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center flex-shrink-0">
        <Icon size={14} strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{titulo}</div>
          <Badge variant="warning" size="sm">Em breve</Badge>
        </div>
        <div className="text-xs text-[var(--text-muted)]">{desc}</div>
      </div>
    </div>
  );
}
