import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Wrench, AlertCircle, Save, Bot as BotIcon } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Badge, Switch, useToast,
} from '../components/ui';
import api from '../services/api';
import toolsService from '../services/toolsService';

const ROTULOS_MODULO = {
  CRM: 'CRM (Leads)',
  AGENDA: 'Agenda',
  CATALOGO: 'Catalogo',
  VENDAS: 'Vendas',
  FINANCEIRO: 'Financeiro',
  ESTOQUE: 'Estoque',
  BOTS: 'Bots',
  CAMPANHAS: 'Campanhas',
};

export default function BotToolsPage() {
  const { botId } = useParams();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [tools, setTools] = useState([]);
  const [habilitadas, setHabilitadas] = useState(new Set());
  const [habilitadasOriginal, setHabilitadasOriginal] = useState(new Set());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    setCarregando(true);
    Promise.all([
      api.get(`/bots/${botId}`).catch(() => ({ data: null })),
      toolsService.listarTools().catch(() => []),
    ])
      .then(([respBot, listaTools]) => {
        if (!ativo) return;
        setBot(respBot.data);
        setTools(listaTools);
        const set = new Set(Array.isArray(respBot.data?.toolsHabilitadas) ? respBot.data.toolsHabilitadas : []);
        setHabilitadas(new Set(set));
        setHabilitadasOriginal(new Set(set));
      })
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [botId]);

  const modulosLiberados = useMemo(() => {
    return bot?.cliente?.modulosLiberados || {};
  }, [bot]);

  const toolsPorModulo = useMemo(() => {
    const out = {};
    for (const t of tools) {
      if (!out[t.modulo]) out[t.modulo] = [];
      out[t.modulo].push(t);
    }
    return out;
  }, [tools]);

  const sujo = useMemo(() => {
    if (habilitadas.size !== habilitadasOriginal.size) return true;
    for (const n of habilitadas) if (!habilitadasOriginal.has(n)) return true;
    return false;
  }, [habilitadas, habilitadasOriginal]);

  const toggleTool = (nome, ativo) => {
    setHabilitadas((prev) => {
      const nova = new Set(prev);
      if (ativo) nova.add(nome);
      else nova.delete(nome);
      return nova;
    });
  };

  const toggleModulo = (modulo, ativo) => {
    const tipos = toolsPorModulo[modulo] || [];
    setHabilitadas((prev) => {
      const nova = new Set(prev);
      tipos.forEach((t) => (ativo ? nova.add(t.nome) : nova.delete(t.nome)));
      return nova;
    });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const lista = Array.from(habilitadas);
      await toolsService.atualizarToolsBot(botId, lista);
      setHabilitadasOriginal(new Set(lista));
      toast.success(`${lista.length} tool${lista.length === 1 ? '' : 's'} habilitada${lista.length === 1 ? '' : 's'}.`);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="text-sm text-[var(--text-muted)]">Carregando...</div>;
  }

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-center gap-3">
        <Link to="/admin/bots">
          <Button variant="ghost" icon={ArrowLeft} size="sm">Voltar para bots</Button>
        </Link>
        <div className="flex-1" />
        {sujo && (
          <Badge variant="warning" size="sm">Mudancas nao salvas</Badge>
        )}
        <Button
          variant="primary"
          icon={Save}
          loading={salvando}
          disabled={!sujo}
          onClick={salvar}
        >
          Salvar
        </Button>
      </div>

      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <BotIcon size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Bot</div>
            <div className="text-sm font-semibold text-[var(--text-main)] truncate">{bot?.nome || botId}</div>
          </div>
          <Badge variant="neutral" size="sm">
            <Wrench size={11} className="mr-1" /> {habilitadas.size} / {tools.length} tools habilitadas
          </Badge>
        </div>
      </Card>

      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Acoes que o agente pode tomar</CardTitle>
            <CardDescription>
              Escolha quais tools o agente IA deste bot esta autorizado a invocar. Marcar uma tool
              cujo modulo nao esta liberado ao tenant nao tera efeito em runtime.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-5">
          {Object.entries(toolsPorModulo).map(([modulo, lista]) => {
            const moduloLiberado = modulosLiberados[modulo] === true;
            const todosHabilitados = lista.every((t) => habilitadas.has(t.nome));
            return (
              <div key={modulo}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    {ROTULOS_MODULO[modulo] || modulo}
                  </h3>
                  {!moduloLiberado && (
                    <Badge variant="warning" size="sm" icon={AlertCircle}>Modulo nao liberado</Badge>
                  )}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => toggleModulo(modulo, !todosHabilitados)}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-main)] uppercase font-semibold"
                  >
                    {todosHabilitados ? 'desmarcar tudo' : 'marcar tudo'}
                  </button>
                </div>
                <div className="space-y-2">
                  {lista.map((t) => (
                    <div
                      key={t.nome}
                      className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-main)] bg-[var(--bg-card)]"
                    >
                      <Switch
                        checked={habilitadas.has(t.nome)}
                        onChange={(v) => toggleTool(t.nome, v)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-semibold text-[var(--text-main)]">{t.nome}</code>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">{t.descricao}</p>
                        {t.parametros?.obrigatorios?.length > 0 && (
                          <div className="text-[10px] text-[var(--text-muted)] mt-1">
                            Obrigatorios: {t.parametros.obrigatorios.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
