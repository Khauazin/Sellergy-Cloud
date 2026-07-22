import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { Settings, Save, Loader2, MessageSquare, Type, Hash, ToggleLeft, CheckCircle } from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, Input, Textarea, Switch, EmptyState,
} from '../components/ui';

export default function BotSettingsPage() {
  const { user } = useAuthStore();
  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [variables, setVariables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      loadVariables(selectedBotId);
    }
  }, [selectedBotId]);

  const loadBots = async () => {
    try {
      const response = await api.get('/bots');
      setBots(response.data);
      if (response.data.length > 0) {
        setSelectedBotId(response.data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar bots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVariables = async (botId) => {
    try {
      const response = await api.get(`/bot-variables/${botId}`);
      setVariables(response.data);
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
    }
  };

  const handleSaveVariable = async (variable) => {
    setSavingId(variable.id);
    try {
      await api.put(`/bot-variables/${variable.id}`, {
        value: variable.value
      });
      setSavedId(variable.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (error) {
      console.error('Erro ao salvar variável:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setSavingId(null);
    }
  };

  const handleChangeValue = (id, newValue) => {
    setVariables(prev => prev.map(v =>
      v.id === id ? { ...v, value: newValue } : v
    ));
  };

  const getVarIcon = (type) => {
    switch(type) {
      case 'TEXT': return <Type className="w-4 h-4 text-[var(--text-secondary)]" />;
      case 'NUMBER': return <Hash className="w-4 h-4 text-[var(--text-secondary)]" />;
      case 'BOOLEAN': return <ToggleLeft className="w-4 h-4 text-[var(--text-secondary)]" />;
      default: return <Type className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-[var(--text-muted)]" strokeWidth={1.75} />
          Configurações do bot
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Personalize as mensagens e configurações do seu chatbot. Alterações avançadas no fluxo devem ser solicitadas ao suporte.
        </p>
      </div>

      {/* Seletor de bot */}
      {bots.length > 1 && (
        <Card padding="md">
          <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Selecione o bot</label>
          <div className="flex flex-wrap gap-2">
            {bots.map(bot => (
              <button
                key={bot.id}
                onClick={() => setSelectedBotId(bot.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  selectedBotId === bot.id
                    ? 'bg-[var(--bg-subtle)] text-[var(--text-main)] border-[var(--border-main)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]'
                }`}
              >
                {bot.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Variáveis */}
      {variables.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma configuração disponível"
            description="O administrador ainda não liberou configurações editáveis para este bot. Entre em contato com o suporte se precisar alterar alguma mensagem."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {variables.map(variable => (
            <Card key={variable.id} padding="md">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-subtle)]">
                    {getVarIcon(variable.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">{variable.description || variable.key}</h3>
                    <p className="text-xs text-[var(--text-muted)] font-mono">{variable.key}</p>
                  </div>
                </div>

                {savedId === variable.id ? (
                  <Button variant="secondary" size="sm" icon={CheckCircle} disabled>
                    Salvo
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Save}
                    loading={savingId === variable.id}
                    onClick={() => handleSaveVariable(variable)}
                  >
                    Salvar
                  </Button>
                )}
              </div>

              {variable.type === 'BOOLEAN' ? (
                <div className="flex items-center gap-3">
                  <Switch
                    checked={variable.value === 'true'}
                    onChange={(next) => handleChangeValue(variable.id, next ? 'true' : 'false')}
                    ariaLabel={variable.description || variable.key}
                  />
                  <span className={`text-sm font-medium ${variable.value === 'true' ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'}`}>
                    {variable.value === 'true' ? 'Ativado' : 'Desativado'}
                  </span>
                </div>
              ) : variable.type === 'NUMBER' ? (
                <Input
                  type="number"
                  value={variable.value}
                  onChange={(e) => handleChangeValue(variable.id, e.target.value)}
                />
              ) : (
                <Textarea
                  value={variable.value}
                  onChange={(e) => handleChangeValue(variable.id, e.target.value)}
                  rows={3}
                  placeholder="Digite o valor..."
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
