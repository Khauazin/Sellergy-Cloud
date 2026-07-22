import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Mail, Lock, Save, AlertCircle, CheckCircle2, ShieldCheck,
  Upload, Trash2, ImageIcon, ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import {
  Card, CardHeader, CardTitle, CardDescription, Avatar, Button, Input,
  Badge, useToast
} from '../components/ui';

const MAX_FOTO_SIZE = 1024 * 1024; // 1 MB
const PERFIL_LABEL = {
  ADMIN: 'Administrador do sistema',
  CLIENT: 'Dono da conta',
  ADMINISTRADOR: 'Administrador do CRM',
  VENDEDOR: 'Vendedor',
};

export default function PerfilPage() {
  const toast = useToast();
  const fileInput = useRef(null);
  const { user, refreshUser } = useAuthStore();

  const [dados, setDados] = useState({ nome: '', email: '', foto: '' });
  const [salvandoDados, setSalvandoDados] = useState(false);

  const [senha, setSenha] = useState({ atual: '', nova: '', confirmar: '' });
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  useEffect(() => {
    if (user) setDados({ nome: user.nome || '', email: user.email || '', foto: user.foto || '' });
  }, [user]);

  const handleUploadFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens.');
      return;
    }
    if (file.size > MAX_FOTO_SIZE) {
      toast.error('Imagem muito grande. Maximo 1MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDados((d) => ({ ...d, foto: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleRemoverFoto = () => {
    setDados((d) => ({ ...d, foto: '' }));
  };

  const handleSalvarDados = async (e) => {
    e.preventDefault();
    setSalvandoDados(true);
    try {
      await api.put('/autenticacao/perfil', dados);
      await refreshUser();
      toast.success('Perfil atualizado');
    } catch (err) {
      toast.error(err.response?.data?.erro || 'Erro ao salvar');
    } finally {
      setSalvandoDados(false);
    }
  };

  const validacoesSenha = [
    { label: 'Pelo menos 6 caracteres', ok: senha.nova.length >= 6 },
    { label: 'Diferente da senha atual', ok: senha.nova.length > 0 && senha.nova !== senha.atual },
    { label: 'Confirmacao confere', ok: senha.nova.length > 0 && senha.nova === senha.confirmar },
  ];
  const senhaOk = validacoesSenha.every((v) => v.ok) && senha.atual.length > 0;

  const handleTrocarSenha = async (e) => {
    e.preventDefault();
    setErroSenha('');
    if (!senhaOk) return;
    setSalvandoSenha(true);
    try {
      await api.post('/autenticacao/trocar-senha', { senhaAtual: senha.atual, novaSenha: senha.nova });
      setSenha({ atual: '', nova: '', confirmar: '' });
      toast.success('Senha atualizada');
      await refreshUser();
    } catch (err) {
      setErroSenha(err.response?.data?.erro || 'Erro ao trocar senha.');
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/app/configuracoes" className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 hover:text-[var(--text-main)]">
          <ArrowLeft size={12} /> Configurações
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] mt-2">Meu perfil</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Seus dados pessoais e segurança da conta.</p>
      </div>

      <div className="space-y-5 max-w-3xl">
      {/* Header com avatar real */}
      <Card padding="lg">
        <div className="flex items-center gap-4">
          <Avatar name={user?.nome} src={user?.foto} size="xl" />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--text-main)]">{user?.nome}</h2>
              <Badge variant="neutral" size="sm" icon={ShieldCheck}>
                {PERFIL_LABEL[user?.perfil] || user?.perfil}
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">{user?.email}</p>
          </div>
        </div>
      </Card>

      {/* Foto + dados pessoais */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>Sua foto, nome e e-mail. Diferente do logo da empresa.</CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleSalvarDados} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-5 items-start">
            <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-[var(--border-main)] bg-[var(--bg-subtle)] flex items-center justify-center overflow-hidden">
                {dados.foto ? (
                  <img src={dados.foto} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={26} className="text-[var(--text-muted)] opacity-50" strokeWidth={1.5} />
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleUploadFoto} />
              <Button variant="ghost" size="sm" icon={Upload} type="button" onClick={() => fileInput.current?.click()}>
                Enviar
              </Button>
              {dados.foto && (
                <button
                  type="button"
                  onClick={handleRemoverFoto}
                  className="text-[10px] font-bold uppercase tracking-tight text-[var(--text-muted)] hover:text-[var(--danger)] flex items-center gap-1"
                >
                  <Trash2 size={10} /> Remover
                </button>
              )}
            </div>
            <div className="space-y-3">
              <Input
                label="Nome"
                icon={User}
                value={dados.nome}
                onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                required
              />
              <Input
                label="E-mail"
                type="email"
                icon={Mail}
                value={dados.email}
                onChange={(e) => setDados({ ...dados, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--border-main)]">
            <Button type="submit" variant="primary" icon={Save} loading={salvandoDados}>
              Salvar alteracoes
            </Button>
          </div>
        </form>
      </Card>

      {/* Trocar senha */}
      <Card padding="lg">
        <CardHeader>
          <div>
            <CardTitle>Trocar senha</CardTitle>
            <CardDescription>Mantenha sua senha forte e atualizada.</CardDescription>
          </div>
        </CardHeader>

        <form onSubmit={handleTrocarSenha} className="space-y-4">
          <Input
            label="Senha atual"
            type="password"
            value={senha.atual}
            onChange={(e) => setSenha({ ...senha, atual: e.target.value })}
            required
          />
          <Input
            label="Nova senha"
            type="password"
            value={senha.nova}
            onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
            required
          />
          <Input
            label="Confirmar nova senha"
            type="password"
            value={senha.confirmar}
            onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })}
            required
          />

          <div className="bg-[var(--bg-subtle)] rounded-xl p-3 space-y-1.5">
            {validacoesSenha.map((v) => (
              <div key={v.label} className="flex items-center gap-2 text-xs">
                <CheckCircle2
                  size={14}
                  className={v.ok ? 'text-[var(--success)]' : 'text-[var(--text-muted)] opacity-40'}
                  strokeWidth={2}
                />
                <span className={v.ok ? 'text-[var(--text-main)] font-medium' : 'text-[var(--text-muted)]'}>
                  {v.label}
                </span>
              </div>
            ))}
          </div>

          {erroSenha && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--danger-soft)]">
              <AlertCircle size={16} className="text-[var(--danger)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--danger-text)] font-medium">{erroSenha}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" icon={Lock} loading={salvandoSenha} disabled={!senhaOk}>
              Trocar senha
            </Button>
          </div>
        </form>
      </Card>
      </div>
    </div>
  );
}
