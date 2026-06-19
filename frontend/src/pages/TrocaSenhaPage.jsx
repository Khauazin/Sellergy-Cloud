import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { Button, Input, Card, useToast } from '../components/ui';
import SellergyLogo from '../components/SellergyLogo';

export default function TrocaSenhaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, marcarSenhaTrocada, refreshUser } = useAuthStore();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const validacoes = [
    { label: 'Pelo menos 6 caracteres', ok: novaSenha.length >= 6 },
    { label: 'Diferente da senha atual', ok: novaSenha.length > 0 && novaSenha !== senhaAtual },
    { label: 'Letra e numero', ok: /[a-zA-Z]/.test(novaSenha) && /\d/.test(novaSenha) },
    { label: 'Confirmacao confere', ok: novaSenha.length > 0 && novaSenha === confirmar },
  ];

  const tudoOk = validacoes.every((v) => v.ok) && senhaAtual.length > 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!tudoOk) return;

    try {
      setSalvando(true);
      await api.post('/autenticacao/trocar-senha', { senhaAtual, novaSenha });
      marcarSenhaTrocada();
      await refreshUser();
      toast.success('Senha atualizada com sucesso');
      setTimeout(() => {
        navigate(user?.perfil === 'ADMIN' ? '/admin/dashboard' : '/app/dashboard', { replace: true });
      }, 600);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Erro ao trocar a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <SellergyLogo size={36} />
          <span className="text-base font-semibold tracking-tight text-[var(--text-main)]">
            Sellergy Cloud
          </span>
        </div>

        <Card padding="lg">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={18} className="text-[var(--accent)]" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text-main)]">
                Defina uma nova senha
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                Por seguranca, troque a senha padrao antes de continuar.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Senha atual"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              placeholder="Sua senha atual"
              autoFocus
              required
            />
            <Input
              label="Nova senha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Crie uma nova senha forte"
              required
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Repita a nova senha"
              required
            />

            <div className="bg-[var(--bg-subtle)] rounded-xl p-3.5 space-y-1.5">
              {validacoes.map((v) => (
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

            {erro && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--danger-soft)]">
                <AlertCircle size={16} className="text-[var(--danger)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--danger-text)] font-medium">{erro}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={salvando}
              disabled={!tudoOk}
            >
              {salvando ? 'Salvando...' : 'Trocar senha e continuar'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
