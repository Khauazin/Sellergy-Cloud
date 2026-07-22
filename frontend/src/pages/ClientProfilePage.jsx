import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, Calendar, DollarSign, Bot, Activity, Trash2, PauseCircle, PlayCircle, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { Card, CardHeader, CardTitle, Button, Badge, Avatar, EmptyState, IconButton } from '../components/ui';

export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);

  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    carregarPerfilCliente();
  }, [id]);

  const carregarPerfilCliente = async () => {
    try {
      const response = await api.get(`/clientes/${id}`);
      setClient(response.data);
    } catch (error) {
      console.error('Erro ao buscar cliente', error);
      alert('Cliente não encontrado');
      navigate('/clientes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsTogglingStatus(true);
    const newStatus = client.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await api.patch(`/clientes/${id}/status`, { status: newStatus });
      setClient({ ...client, status: res.data.status });
    } catch (error) {
      alert('Erro ao alterar status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!client) return null;

  const isAtivo = client.status === 'ACTIVE';

  return (
    <div className="space-y-5">

      {/* Botão Voltar */}
      <button
        onClick={() => navigate('/clientes')}
        className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para clientes
      </button>

      {/* Cabeçalho do Perfil */}
      <Card padding="lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">{client.nome}</h1>
                <Badge variant={isAtivo ? 'success' : 'warning'} size="sm">
                  {isAtivo ? 'Ativo' : 'Suspenso'}
                </Badge>
              </div>
              <p className="text-sm text-[var(--text-muted)]">{client.segmento || 'Sem segmento definido'}</p>
            </div>
          </div>

          {currentUser?.perfil === 'ADMIN' && (
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                loading={isTogglingStatus}
                variant={isAtivo ? 'danger-soft' : 'primary'}
                icon={isTogglingStatus ? undefined : (isAtivo ? PauseCircle : PlayCircle)}
                fullWidth
                className="md:w-auto"
              >
                {isAtivo ? 'Suspender cliente' : 'Reativar cliente'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-8 border-t border-[var(--border-subtle)] pt-6">
          <InfoLinha icon={Mail} label="E-mail" valor={client.email || 'Não informado'} truncate />
          <InfoLinha icon={Phone} label="Telefone" valor={client.telefone || 'Não informado'} />
          <InfoLinha
            icon={DollarSign}
            label="Mensalidade"
            valor={`R$ ${(client.mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            forte
          />
          <InfoLinha icon={Calendar} label="Criado em" valor={new Date(client.criadoEm).toLocaleDateString('pt-BR')} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Painel Central: Automações/Bots */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--text-muted)]" />
              Robôs ativos ({client.bots?.length || 0})
            </h2>
            {currentUser?.perfil === 'ADMIN' && (
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Visão de admin
              </span>
            )}
          </div>

          {client.bots?.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={Bot}
                title="Nenhum bot associado a este cliente"
                description="Crie um bot na aba Bots (IA) e vincule a ele."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {client.bots.map(bot => (
                <Card key={bot.id} padding="md" className="hover:border-[var(--border-strong)] transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                      {bot.nome}
                    </h3>
                    <Badge
                      variant={bot.status === 'ONLINE' ? 'success' : bot.status === 'ERROR' ? 'danger' : 'neutral'}
                      size="sm"
                    >
                      {bot.status === 'ONLINE' ? 'ONLINE' : bot.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs text-[var(--text-muted)]">Canal: {bot.canal}</p>
                    {currentUser?.perfil === 'ADMIN' && (
                      <IconButton
                        icon={Bot}
                        variant="ghost"
                        size="sm"
                        ariaLabel="Abrir construtor de fluxo"
                        title="Abrir construtor de fluxo"
                        onClick={() => navigate(`/admin/builder/${bot.id}`)}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Msgs hoje</p>
                      <p className="text-sm font-medium text-[var(--text-main)] tabular-nums">{bot.mensagensHoje}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">Total tráfego</p>
                      <p className="text-sm font-medium text-[var(--text-main)] tabular-nums">{bot.totalMensagens}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Painel Lateral: Insights (Mockados para Fase Atual) */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--text-muted)]" />
            Plano e faturamento
          </h2>

          <Card padding="lg">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-[var(--text-secondary)]">Plano contratado</span>
              <Badge variant="neutral" size="sm">{client.plano}</Badge>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-[var(--text-secondary)]">Limite de disparos</span>
                  <span className="text-[var(--text-main)] font-medium tabular-nums">
                    {client.bots?.reduce((acc, b) => acc + b.mensagensHoje, 0) || 0} / {client.plano === 'PREMIUM' ? 'Ilimitado' : '10.000'}
                  </span>
                </div>
                <div className="w-full bg-[var(--bg-subtle)] rounded-full h-2 overflow-hidden">
                  <div className="bg-[var(--text-secondary)] h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-sm text-[var(--text-secondary)] mb-2">Última fatura</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--success-soft)] flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-[var(--success-text)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-main)]">Paga via Pix</p>
                    <p className="text-xs text-[var(--text-muted)]">Há 12 dias</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

function InfoLinha({ icon: Icon, label, valor, truncate, forte }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{label}</p>
        <p className={`text-sm ${forte ? 'font-semibold text-[var(--text-main)] tabular-nums' : 'text-[var(--text-secondary)]'} ${truncate ? 'truncate' : ''}`}>{valor}</p>
      </div>
    </div>
  );
}
