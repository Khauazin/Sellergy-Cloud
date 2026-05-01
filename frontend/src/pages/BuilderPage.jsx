import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Bot, Plus, Save, Trash2, Workflow,
  CircleAlert, Play,
} from 'lucide-react';
import api from '../services/api';
import {
  Badge, Button, Card, IconButton, Input, Select, Switch, useToast,
  Drawer,
} from '../components/ui';
import CanvasFluxo from '../components/Builder/CanvasFluxo';
import PaletaNos from '../components/Builder/PaletaNos';
import PainelPropriedades from '../components/Builder/PainelPropriedades';
import DrawerExecucao from '../components/Builder/DrawerExecucao';
import { CATALOGO_NOS } from '../components/Builder/catalogoNos';
import { reactFlowParaApi } from '../components/Builder/utilCanvas';

const ESTADO_INICIAL_CANVAS = { nos: [], conexoes: [] };

export default function BuilderPage() {
  const { botId } = useParams();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [fluxos, setFluxos] = useState([]);
  const [fluxoAtivoId, setFluxoAtivoId] = useState(null);
  const [canvasInicial, setCanvasInicial] = useState(ESTADO_INICIAL_CANVAS);
  const [carregando, setCarregando] = useState(true);
  const [carregandoCanvas, setCarregandoCanvas] = useState(false);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [noSelecionadoId, setNoSelecionadoId] = useState(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [drawerNovoAberto, setDrawerNovoAberto] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [execucaoVisivelId, setExecucaoVisivelId] = useState(null);

  const fluxoAtivo = useMemo(
    () => fluxos.find((f) => f.id === fluxoAtivoId) || null,
    [fluxos, fluxoAtivoId]
  );

  const noSelecionado = useMemo(
    () => nodes.find((n) => n.id === noSelecionadoId) || null,
    [nodes, noSelecionadoId]
  );

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-when-param-changes
    setCarregando(true);
    Promise.all([
      api.get(`/bots/${botId}`).catch(() => ({ data: null })),
      api.get(`/builder/fluxos/${botId}`).catch(() => ({ data: [] })),
    ])
      .then(([respBot, respFluxos]) => {
        if (!ativo) return;
        setBot(respBot.data);
        const lista = Array.isArray(respFluxos.data) ? respFluxos.data : [];
        setFluxos(lista);
        setFluxoAtivoId((atual) => atual ?? lista[0]?.id ?? null);
      })
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [botId]);

  useEffect(() => {
    if (!fluxoAtivoId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on dep change
      setCanvasInicial(ESTADO_INICIAL_CANVAS);
      setSujo(false);
      return;
    }
    let ativo = true;
    setCarregandoCanvas(true);
    api
      .get(`/builder/fluxos/${fluxoAtivoId}/canvas`)
      .then((resp) => {
        if (!ativo) return;
        setCanvasInicial({
          nos: resp.data?.nos || [],
          conexoes: resp.data?.conexoes || [],
        });
        setSujo(false);
        setNoSelecionadoId(null);
      })
      .catch(() => {
        if (!ativo) return;
        setCanvasInicial(ESTADO_INICIAL_CANVAS);
        toast.error('Falha ao carregar o canvas.');
      })
      .finally(() => ativo && setCarregandoCanvas(false));
    return () => { ativo = false; };
  }, [fluxoAtivoId, toast]);

  const trocarFluxo = (novoId) => {
    if (sujo && !window.confirm('Ha mudancas nao salvas. Trocar de fluxo mesmo assim?')) return;
    setFluxoAtivoId(novoId);
  };

  const criarFluxo = async (nome) => {
    try {
      const resp = await api.post('/builder/fluxos', { botId, nome });
      setFluxos((atual) => [resp.data, ...atual]);
      setFluxoAtivoId(resp.data.id);
      setDrawerNovoAberto(false);
      toast.success('Fluxo criado.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao criar fluxo.');
    }
  };

  const alterarMetaFluxo = async (mudancas) => {
    if (!fluxoAtivoId) return;
    try {
      const resp = await api.put(`/builder/fluxos/${fluxoAtivoId}`, mudancas);
      setFluxos((atual) =>
        atual.map((f) => (f.id === fluxoAtivoId ? { ...f, ...resp.data } : f))
      );
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao atualizar fluxo.');
    }
  };

  const excluirFluxo = async () => {
    if (!fluxoAtivoId) return;
    if (!window.confirm(`Excluir o fluxo "${fluxoAtivo?.nome}"? Esta acao nao pode ser desfeita.`)) {
      return;
    }
    try {
      await api.delete(`/builder/fluxos/${fluxoAtivoId}`);
      setFluxos((atual) => {
        const novos = atual.filter((f) => f.id !== fluxoAtivoId);
        setFluxoAtivoId(novos[0]?.id ?? null);
        return novos;
      });
      toast.success('Fluxo excluido.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao excluir fluxo.');
    }
  };

  const salvarCanvas = useCallback(async () => {
    if (!fluxoAtivoId) return;
    setSalvando(true);
    try {
      const payload = reactFlowParaApi({ nodes, edges });
      await api.put(`/builder/fluxos/${fluxoAtivoId}/canvas`, payload);
      setSujo(false);
      toast.success('Canvas salvo.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao salvar canvas.');
    } finally {
      setSalvando(false);
    }
  }, [fluxoAtivoId, nodes, edges, toast]);

  const executar = useCallback(async () => {
    if (!fluxoAtivoId) return;
    if (sujo && !window.confirm('Ha mudancas nao salvas. Executar com a versao salva mesmo assim?')) {
      return;
    }
    setExecutando(true);
    try {
      const resp = await api.post(`/execucoes/fluxo/${fluxoAtivoId}`);
      setExecucaoVisivelId(resp.data.execucaoId);
      toast.info('Execucao enfileirada. O log atualiza ao vivo.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao enfileirar execucao.');
    } finally {
      setExecutando(false);
    }
  }, [fluxoAtivoId, sujo, toast]);

  const atualizarNo = useCallback((noAtualizado) => {
    setNodes((ns) => ns.map((n) => (n.id === noAtualizado.id ? noAtualizado : n)));
    setSujo(true);
  }, []);

  const excluirNo = useCallback((idNo) => {
    setNodes((ns) => ns.filter((n) => n.id !== idNo));
    setEdges((es) => es.filter((e) => e.source !== idNo && e.target !== idNo));
    setNoSelecionadoId(null);
    setSujo(true);
  }, []);

  if (carregando) {
    return <div className="text-sm text-[var(--text-muted)]">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/admin/bots">
          <Button variant="ghost" icon={ArrowLeft} size="sm">Voltar para bots</Button>
        </Link>
        <div className="flex-1" />
        {sujo && (
          <Badge variant="warning" size="sm" icon={CircleAlert}>
            Mudancas nao salvas
          </Badge>
        )}
      </div>

      <CabecalhoBuilder
        bot={bot}
        fluxos={fluxos}
        fluxoAtivo={fluxoAtivo}
        sujo={sujo}
        salvando={salvando}
        executando={executando}
        onTrocarFluxo={trocarFluxo}
        onAbrirNovoFluxo={() => setDrawerNovoAberto(true)}
        onSalvar={salvarCanvas}
        onExecutar={executar}
        onAlterarMeta={alterarMetaFluxo}
        onExcluir={excluirFluxo}
      />

      {!fluxoAtivoId ? (
        <Card padding="lg">
          <EstadoSemFluxo onCriar={() => setDrawerNovoAberto(true)} />
        </Card>
      ) : (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: '220px 1fr 320px', height: 'calc(100vh - 280px)', minHeight: 540 }}
        >
          <Card padding="sm" className="overflow-y-auto">
            <PaletaNos />
          </Card>

          <Card padding="none" className="overflow-hidden relative">
            {carregandoCanvas ? (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
                Carregando canvas...
              </div>
            ) : (
              <CanvasFluxo
                fluxoId={fluxoAtivoId}
                canvasInicial={canvasInicial}
                noSelecionadoId={noSelecionadoId}
                onSelecionarNo={setNoSelecionadoId}
                onAlterarNos={setNodes}
                onAlterarConexoes={setEdges}
                onSujo={() => setSujo(true)}
              />
            )}
          </Card>

          <Card padding="md" className="overflow-y-auto">
            <PainelPropriedades
              no={noSelecionado}
              fluxoId={fluxoAtivoId}
              onAlterar={atualizarNo}
              onExcluir={excluirNo}
            />
          </Card>
        </div>
      )}

      <DrawerNovoFluxo
        isOpen={drawerNovoAberto}
        onClose={() => setDrawerNovoAberto(false)}
        onCriar={criarFluxo}
      />

      <DrawerExecucao
        isOpen={!!execucaoVisivelId}
        onClose={() => setExecucaoVisivelId(null)}
        execucaoId={execucaoVisivelId}
      />
    </div>
  );
}

function CabecalhoBuilder({
  bot, fluxos, fluxoAtivo, sujo, salvando, executando,
  onTrocarFluxo, onAbrirNovoFluxo, onSalvar, onExecutar, onAlterarMeta, onExcluir,
}) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
          <Bot size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Bot
          </div>
          <div className="text-sm font-semibold text-[var(--text-main)] truncate">
            {bot?.nome || '—'}
          </div>
        </div>

        <div className="w-px h-8 bg-[var(--border-main)] mx-2" />

        <div className="min-w-[240px] flex-1 max-w-sm">
          <Select
            size="sm"
            value={fluxoAtivo?.id || ''}
            onChange={(e) => onTrocarFluxo(e.target.value)}
            options={fluxos.map((f) => ({
              value: f.id,
              label: `${f.nome}${f.ativo ? ' · ativo' : ''}`,
            }))}
            placeholder={fluxos.length ? 'Selecione um fluxo' : 'Nenhum fluxo'}
          />
        </div>

        <Button variant="secondary" size="sm" icon={Plus} onClick={onAbrirNovoFluxo}>
          Novo fluxo
        </Button>

        <div className="flex-1" />

        {fluxoAtivo && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-main)]">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Ativo</span>
              <Switch
                checked={!!fluxoAtivo.ativo}
                onChange={(v) => onAlterarMeta({ ativo: v })}
              />
            </div>
            <Button
              variant="accent"
              size="sm"
              icon={Play}
              loading={executando}
              onClick={onExecutar}
            >
              Executar
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Save}
              loading={salvando}
              disabled={!sujo}
              onClick={onSalvar}
            >
              Salvar
            </Button>
            <IconButton
              icon={Trash2}
              variant="danger"
              size="sm"
              ariaLabel="Excluir fluxo"
              onClick={onExcluir}
            />
          </>
        )}
      </div>
    </Card>
  );
}

function EstadoSemFluxo({ onCriar }) {
  return (
    <div className="text-center py-12">
      <Workflow size={36} strokeWidth={1.5} className="mx-auto text-[var(--text-muted)] opacity-50" />
      <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)] mt-4">
        Nenhum fluxo cadastrado
      </h3>
      <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-md mx-auto">
        Crie o primeiro fluxo deste bot para comecar a montar o canvas com {Object.keys(CATALOGO_NOS).length} tipos de no.
      </p>
      <div className="mt-5">
        <Button variant="accent" icon={Plus} onClick={onCriar}>
          Criar fluxo
        </Button>
      </div>
    </div>
  );
}

function DrawerNovoFluxo({ isOpen, onClose, onCriar }) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa form ao fechar
    if (!isOpen) setNome('');
  }, [isOpen]);

  const submeter = (e) => {
    e.preventDefault();
    const limpo = nome.trim();
    if (limpo.length < 2) return;
    onCriar(limpo);
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Novo fluxo"
      description="Cada fluxo e disparado por um gatilho proprio do bot."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" onClick={submeter} disabled={nome.trim().length < 2}>
            Criar
          </Button>
        </div>
      }
    >
      <form onSubmit={submeter} className="space-y-4">
        <Input
          label="Nome do fluxo"
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: Atendimento inicial"
          maxLength={200}
        />
        <p className="text-xs text-[var(--text-muted)]">
          Voce podera ajustar o gatilho e ativar o fluxo apos criado.
        </p>
      </form>
    </Drawer>
  );
}
