import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Moon, Upload, ImageIcon, Trash2, Save, User, ShieldCheck,
  Building2, ExternalLink, AlertCircle, Key
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Badge,
  Tabs, TabsList, TabsTrigger, TabsContent, useToast
} from '../components/ui';

const MAX_LOGO_SIZE = 1024 * 1024; // 1 MB

/**
 * Configuracoes do CLIENTE.
 *
 * 3 abas compactas:
 *  - Aparencia: tema (light/dark) + branding (logo + nome customizado)
 *  - Conta: links pra Perfil, Equipe, Permissoes
 *  - Plano: modulos liberados
 *
 * IMPORTANTE: a edicao da identidade visual (logo + nome) eh diferente
 * de "Meu perfil" (foto + dados pessoais).
 */
export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refreshUser } = useAuthStore();
  const { theme, setTheme } = useUiStore();

  const [tab, setTab] = useState('aparencia');

  return (
    <div className="space-y-5 max-w-3xl">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="pills">
          <TabsTrigger value="aparencia" variant="pills">Aparencia</TabsTrigger>
          <TabsTrigger value="conta" variant="pills">Conta</TabsTrigger>
          <TabsTrigger value="plano" variant="pills">Plano</TabsTrigger>
        </TabsList>

        <TabsContent value="aparencia" className="mt-5 space-y-5">
          <BlocoTema theme={theme} setTheme={setTheme} />
          {user?.perfil === 'CLIENT' ? (
            <BlocoBranding user={user} refreshUser={refreshUser} toast={toast} />
          ) : (
            <Card padding="lg">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--text-muted)]">
                  Apenas o dono da conta pode personalizar a marca da plataforma.
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="conta" className="mt-5 space-y-2">
          <ConfigLink icon={User} titulo="Meu perfil" descricao="Editar foto, nome, e-mail e senha" onClick={() => navigate('/app/configuracoes/perfil')} />
          <ConfigLink icon={ShieldCheck} titulo="Equipe" descricao="Cadastrar colaboradores e definir permissoes" onClick={() => navigate('/app/usuarios')} />
          <ConfigLink icon={Key} titulo="Credenciais" descricao="Chaves de API (OpenAI, WhatsApp, etc.) cifradas em repouso" onClick={() => navigate('/app/configuracoes/credenciais')} />
        </TabsContent>

        <TabsContent value="plano" className="mt-5">
          <Card padding="lg">
            <CardHeader>
              <div>
                <CardTitle>Modulos do plano</CardTitle>
                <CardDescription>Modulos liberados pelo administrador para sua conta.</CardDescription>
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(user?.modulosLiberados || {}).map(([modulo, liberado]) => (
                <div key={modulo} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                  liberado ? 'border-[var(--success-soft)] bg-[var(--success-soft)]/30' : 'border-[var(--border-main)] bg-[var(--bg-subtle)]/50'
                }`}>
                  <span className="text-xs font-semibold text-[var(--text-main)] tracking-tight">{modulo}</span>
                  <Badge variant={liberado ? 'success' : 'neutral'} size="sm">
                    {liberado ? 'Liberado' : 'Bloqueado'}
                  </Badge>
                </div>
              ))}
              {Object.keys(user?.modulosLiberados || {}).length === 0 && (
                <div className="col-span-full text-xs text-[var(--text-muted)] text-center py-4">
                  Nenhum modulo configurado. Fale com o suporte.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlocoTema({ theme, setTheme }) {
  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Tema</CardTitle>
          <CardDescription>Escolha como o sistema aparece pra voce.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3">
        <ThemeOption value="light" current={theme} onChange={setTheme} icon={Sun} label="Claro" desc="Padrao premium light" />
        <ThemeOption value="dark" current={theme} onChange={setTheme} icon={Moon} label="Escuro" desc="Estilo Linear/Vercel" />
      </div>
    </Card>
  );
}

function BlocoBranding({ user, refreshUser, toast }) {
  const fileInput = useRef(null);
  const [logo, setLogo] = useState(user?.branding?.logo || '');
  const [nome, setNome] = useState(user?.branding?.nome || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setLogo(user?.branding?.logo || '');
    setNome(user?.branding?.nome || '');
  }, [user]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas arquivos de imagem.');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Imagem muito grande. Maximo 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      await api.put('/autenticacao/branding', { brandLogo: logo || null, brandNome: nome || null });
      await refreshUser();
      toast.success('Marca atualizada');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleRemoverLogo = () => {
    setLogo('');
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <CardTitle>Identidade visual</CardTitle>
          <CardDescription>Personalize logo e nome que sua equipe ve no menu lateral.</CardDescription>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-5 items-start">
        <div className="flex flex-col items-center gap-2">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] flex items-center justify-center overflow-hidden">
            {logo ? (
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={28} className="text-[var(--text-muted)] opacity-50" strokeWidth={1.5} />
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button variant="ghost" size="sm" icon={Upload} onClick={() => fileInput.current?.click()}>
            Enviar
          </Button>
          {logo && (
            <button
              type="button"
              onClick={handleRemoverLogo}
              className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-muted)] hover:text-[var(--danger)] flex items-center gap-1"
            >
              <Trash2 size={10} /> Remover
            </button>
          )}
        </div>

        <div className="space-y-3">
          <Input
            label="Nome customizado"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Boutique Bella, Barbearia do Joao"
            hint="Substitui 'Sellergy Cloud' no menu lateral. Deixe em branco para usar o padrao."
          />

          <div className="bg-[var(--bg-subtle)] rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Pre-visualizacao</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center overflow-hidden flex-shrink-0">
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={14} className="text-[var(--text-on-primary)]" strokeWidth={2.25} />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-main)]">{nome || 'Sellergy Cloud'}</div>
                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Plataforma</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" icon={Save} onClick={handleSalvar} loading={salvando}>
              Salvar marca
            </Button>
          </div>
        </div>
      </div>
    </Card>
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

function ConfigLink({ icon: Icon, titulo, descricao, onClick }) {
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
        <div className="text-xs text-[var(--text-muted)]">{descricao}</div>
      </div>
      <ExternalLink size={14} className="text-[var(--text-muted)]" />
    </button>
  );
}
