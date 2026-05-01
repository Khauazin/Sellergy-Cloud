import { useState } from 'react';
import {
  Plus, Save, Trash2, Edit2, Search, Send, ArrowRight, ArrowLeft, Mail, User,
  Sun, Moon, Settings, LogOut, MoreHorizontal, FileText, Download, Upload,
  Calendar, Bell, CheckCircle2, AlertCircle, Inbox, Sparkles
} from 'lucide-react';
import {
  Button, IconButton, Input, Card, CardHeader, CardTitle, CardDescription,
  Avatar, Badge, Dropdown, DropdownItem, DropdownDivider, DropdownLabel,
  useToast, Tabs, TabsList, TabsTrigger, TabsContent, EmptyState, SearchBar, Switch
} from '../components/ui';
import { useUiStore } from '../store/ui.store';
import Modal from '../components/Modal';

/**
 * Pagina de catalogo do design system. Acessivel apenas pelo ADMIN
 * em /admin/_design. Use para revisar todos os primitivos em ambos os temas.
 */
export default function DesignShowcasePage() {
  const { theme, toggleTheme } = useUiStore();
  const toast = useToast();
  const [tab, setTab] = useState('botoes');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Badge variant="accent" size="sm">v2 — Premium Light</Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-3">
            Design System
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-xl leading-relaxed">
            Catalogo de tokens e primitivos do Sellergy Cloud. Use esta pagina para revisar consistencia visual, contraste e comportamento em light e dark.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={theme === 'dark' ? Sun : Moon}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <Button variant="primary" size="md" icon={Save}>
            Salvar configuracoes
          </Button>
        </div>
      </div>

      {/* Paleta */}
      <section>
        <SectionTitle>Paleta</SectionTitle>
        <Card padding="md">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <Swatch token="primary" label="Primary" />
            <Swatch token="accent" label="Accent" />
            <Swatch token="text-main" label="Text" />
            <Swatch token="text-muted" label="Muted" />
            <Swatch token="border-main" label="Border" />
            <Swatch token="bg-subtle" label="Subtle" />
            <Swatch token="success" label="Success" />
            <Swatch token="warning" label="Warning" />
            <Swatch token="danger" label="Danger" />
            <Swatch token="info" label="Info" />
            <Swatch token="accent-soft" label="Accent soft" border />
            <Swatch token="bg-card" label="Card" border />
          </div>
        </Card>
      </section>

      {/* Tipografia */}
      <section>
        <SectionTitle>Tipografia · Inter</SectionTitle>
        <Card padding="lg" className="space-y-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Display</div>
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-main)]">A maneira premium de gerenciar bots</h1>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Heading</div>
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Operacoes globais</h2>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Subtitle</div>
            <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)]">Lancamentos do dia</h3>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Body</div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
              Texto de corpo, usado em paragrafos e descricoes longas. Pesos 400 a 500. Contraste AA garantido com o background atual.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Caption</div>
            <p className="text-xs text-[var(--text-muted)]">Helper text, hint, footer.</p>
          </div>
        </Card>
      </section>

      {/* Tabs principais */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="pills">
          <TabsTrigger value="botoes" variant="pills">Botoes</TabsTrigger>
          <TabsTrigger value="forms" variant="pills">Formularios</TabsTrigger>
          <TabsTrigger value="dados" variant="pills">Dados</TabsTrigger>
          <TabsTrigger value="feedback" variant="pills">Feedback</TabsTrigger>
        </TabsList>

        {/* BOTOES */}
        <TabsContent value="botoes" className="space-y-6 mt-6">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Variantes</CardTitle>
                <CardDescription>Use primary para acoes destacadas, secondary para secundarias, ghost para terciarias.</CardDescription>
              </div>
            </CardHeader>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" icon={Save}>Primary</Button>
              <Button variant="secondary" icon={Edit2}>Secondary</Button>
              <Button variant="ghost" icon={MoreHorizontal}>Ghost</Button>
              <Button variant="accent" icon={Sparkles}>Accent</Button>
              <Button variant="danger" icon={Trash2}>Danger</Button>
              <Button variant="danger-soft" icon={Trash2}>Danger soft</Button>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Tamanhos</CardTitle>
              </div>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm">Pequeno</Button>
              <Button variant="primary" size="md">Medio (padrao)</Button>
              <Button variant="primary" size="lg">Grande</Button>
              <Button variant="primary" loading>Carregando</Button>
              <Button variant="primary" disabled>Desabilitado</Button>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Icon buttons</CardTitle>
                <CardDescription>Use em headers, listas, inputs.</CardDescription>
              </div>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <IconButton icon={Search} ariaLabel="Buscar" />
              <IconButton icon={Bell} ariaLabel="Notificacoes" />
              <IconButton icon={Settings} ariaLabel="Configuracoes" />
              <IconButton icon={Edit2} variant="secondary" ariaLabel="Editar" />
              <IconButton icon={Trash2} variant="danger" ariaLabel="Excluir" />
              <IconButton icon={Plus} variant="primary" ariaLabel="Adicionar" />
            </div>
          </Card>
        </TabsContent>

        {/* FORMS */}
        <TabsContent value="forms" className="space-y-6 mt-6">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Inputs</CardTitle>
                <CardDescription>Sempre com label. Hint opcional. Erro substitui hint.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input label="Nome" placeholder="Digite seu nome" />
              <Input label="E-mail" placeholder="email@empresa.com" icon={Mail} />
              <Input label="Senha" type="password" placeholder="Minimo 6 caracteres" />
              <Input
                label="Campo com erro"
                placeholder="Digite algo"
                error="Campo obrigatorio"
              />
              <Input
                label="Com hint"
                placeholder="usuario_loja"
                hint="Sera usado para acessos do bot"
              />
              <SearchBar
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar clientes, leads, pedidos..."
              />
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Switch</CardTitle>
              </div>
            </CardHeader>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <Switch checked={switchOn} onChange={setSwitchOn} />
                <span className="text-sm font-medium text-[var(--text-main)]">
                  {switchOn ? 'Ativado' : 'Desativado'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={false} onChange={() => {}} disabled />
                <span className="text-sm text-[var(--text-muted)]">Desabilitado</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* DADOS */}
        <TabsContent value="dados" className="space-y-6 mt-6">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Avatares</CardTitle>
              </div>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Ana Silva" size="xs" />
              <Avatar name="Bruno Souza" size="sm" />
              <Avatar name="Carla Mendes" size="md" />
              <Avatar name="Daniel Pereira" size="lg" />
              <Avatar name="Elena Costa" size="xl" />
              <Avatar name="F" variant="primary" size="md" />
              <Avatar name="G" variant="neutral" size="md" />
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Badges</CardTitle>
                <CardDescription>Para status, categorias, contadores.</CardDescription>
              </div>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="primary">Primary</Badge>
              <Badge variant="accent">Accent</Badge>
              <Badge variant="success" icon={CheckCircle2}>Pago</Badge>
              <Badge variant="warning">Atrasado</Badge>
              <Badge variant="danger">Cancelado</Badge>
              <Badge variant="info">Pendente</Badge>
              <Badge variant="solid">Solid</Badge>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Tabela enxuta</CardTitle>
              </div>
            </CardHeader>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-main)]">
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3">Cliente</th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3">Status</th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { nome: 'Ana Silva', email: 'ana@loja.com', status: 'success', statusLabel: 'Pago', valor: 'R$ 1.240,00' },
                  { nome: 'Bruno Souza', email: 'bruno@loja.com', status: 'warning', statusLabel: 'Atrasado', valor: 'R$ 890,00' },
                  { nome: 'Carla Mendes', email: 'carla@loja.com', status: 'neutral', statusLabel: 'Pendente', valor: 'R$ 2.100,00' },
                ].map((row) => (
                  <tr key={row.email} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]/50 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.nome} size="sm" />
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-main)]">{row.nome}</div>
                          <div className="text-xs text-[var(--text-muted)]">{row.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3"><Badge variant={row.status} size="sm">{row.statusLabel}</Badge></td>
                    <td className="py-3 text-right text-sm font-semibold text-[var(--text-main)]">{row.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* FEEDBACK */}
        <TabsContent value="feedback" className="space-y-6 mt-6">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Toasts</CardTitle>
                <CardDescription>Notificacoes que aparecem no rodape, auto-dismiss em 4s.</CardDescription>
              </div>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => toast.success('Salvo com sucesso')}>Sucesso</Button>
              <Button variant="secondary" size="sm" onClick={() => toast.error('Falha ao carregar dados')}>Erro</Button>
              <Button variant="secondary" size="sm" onClick={() => toast.warning('Verifique sua conexao')}>Aviso</Button>
              <Button variant="secondary" size="sm" onClick={() => toast.info('Nova versao disponivel')}>Info</Button>
              <Button variant="secondary" size="sm" onClick={() => toast('Mensagem neutra')}>Default</Button>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Modal</CardTitle>
              </div>
            </CardHeader>
            <Button variant="primary" onClick={() => setModalAberto(true)}>Abrir modal</Button>
            <Modal
              isOpen={modalAberto}
              onClose={() => setModalAberto(false)}
              title="Confirmar acao"
              description="Esta acao nao pode ser desfeita."
            >
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Voce esta prestes a excluir 3 registros. Tem certeza que deseja continuar?
              </p>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={() => setModalAberto(false)}>Cancelar</Button>
                <Button variant="danger" onClick={() => { toast.success('Excluido'); setModalAberto(false); }}>Excluir</Button>
              </div>
            </Modal>
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Empty state</CardTitle>
              </div>
            </CardHeader>
            <EmptyState
              icon={Inbox}
              title="Nenhuma mensagem ainda"
              description="Quando seus clientes interagirem com o bot, as conversas aparecerao aqui."
              action={<Button variant="primary" icon={Plus}>Criar primeiro fluxo</Button>}
            />
          </Card>

          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Dropdown</CardTitle>
              </div>
            </CardHeader>
            <Dropdown
              trigger={
                <Button variant="secondary" icon={MoreHorizontal} iconPosition="right">Acoes</Button>
              }
            >
              <DropdownLabel>Conta</DropdownLabel>
              <DropdownItem icon={User}>Meu perfil</DropdownItem>
              <DropdownItem icon={Settings}>Configuracoes</DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={Download}>Exportar</DropdownItem>
              <DropdownItem icon={Upload}>Importar</DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={LogOut} variant="danger">Sair</DropdownItem>
            </Dropdown>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">{children}</h2>
      <div className="h-px flex-1 bg-[var(--border-main)]" />
    </div>
  );
}

function Swatch({ token, label, border = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="aspect-square rounded-xl"
        style={{
          backgroundColor: `var(--${token})`,
          border: border ? '1px solid var(--border-main)' : 'none',
        }}
      />
      <div className="text-[11px] font-semibold text-[var(--text-main)] tracking-tight">{label}</div>
      <div className="text-[10px] text-[var(--text-muted)] font-mono">--{token}</div>
    </div>
  );
}
