import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Bot, Plus, Save, Trash2, Workflow,
  CircleAlert, Play,
} from 'lucide-react';
import api from '../services/api';
import {
  Badge, Button, Card, Input, Select, Switch, useToast,
  Drawer,
} from '../components/ui';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import CanvasFluxo from '../components/Builder/CanvasFluxo';
import PaletaNos from '../components/Builder/PaletaNos';
import PainelPropriedades from '../components/Builder/PainelPropriedades';
import DrawerExecucao from '../components/Builder/DrawerExecucao';
import CatalogoModal from '../components/Builder/CatalogoModal';
import { CATALOGO_NOS } from '../components/Builder/catalogoNos';
import {
  reactFlowParaApi,
  apiParaReactFlow,
  criarNoDoTipo,
  novoIdConexao,
} from '../components/Builder/utilCanvas';
import { TEMPLATES, obterTemplate } from '../components/Builder/templates';

const ESTADO_INICIAL_CANVAS = { nos: [], conexoes: [] };

export default function BuilderPage() {
  const { botId } = useParams();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [fluxos, setFluxos] = useState([]);
  const [fluxoAtivoId, setFluxoAtivoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoCanvas, setCarregandoCanvas] = useState(false);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [noSelecionadoId, setNoSelecionadoId] = useState(null);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [drawerNovoAberto, setDrawerNovoAberto] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
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
      setNodes([]);
      setEdges([]);
      setNoSelecionadoId(null);
      setSujo(false);
      return;
    }
    let ativo = true;
    setCarregandoCanvas(true);
    api
      .get(`/builder/fluxos/${fluxoAtivoId}/canvas`)
      .then((resp) => {
        if (!ativo) return;
        const dados = {
          nos: resp.data?.nos || [],
          conexoes: resp.data?.conexoes || [],
        };
        const rf = apiParaReactFlow(dados);
        setNodes(rf.nodes);
        setEdges(rf.edges);
        setSujo(false);
        setNoSelecionadoId(null);
      })
      .catch(() => {
        if (!ativo) return;
        setNodes([]);
        setEdges([]);
        toast.error('Falha ao carregar o canvas.');
      })
      .finally(() => ativo && setCarregandoCanvas(false));
    return () => { ativo = false; };
  }, [fluxoAtivoId, toast]);

  const trocarFluxo = (novoId) => {
    if (sujo && !window.confirm('Ha mudancas nao salvas. Trocar de fluxo mesmo assim?')) return;
    setFluxoAtivoId(novoId);
  };

  const criarFluxo = async ({ nome, templateId }) => {
    const template = templateId ? obterTemplate(templateId) : null;
    try {
      const resp = await api.post('/builder/fluxos', {
        botId,
        nome,
        tipoGatilho: template?.fluxo?.tipoGatilho || 'KEYWORD',
      });
      const novoId = resp.data.id;

      // Aplica canvas do template, gerando IDs novos para evitar colisao
      // entre instancias do mesmo template no mesmo bot.
      if (template) {
        const idMap = new Map();
        const nos = template.canvas.nos.map((n) => {
          const novoIdNo = `no_${crypto.randomUUID()}`;
          idMap.set(n.id, novoIdNo);
          return {
            id: novoIdNo,
            tipo: n.tipo,
            posicaoX: n.posicaoX,
            posicaoY: n.posicaoY,
            dados: n.dados || {},
          };
        });
        const conexoes = template.canvas.conexoes.map((c) => ({
          id: `con_${crypto.randomUUID()}`,
          noOrigemId: idMap.get(c.noOrigemId),
          noDestinoId: idMap.get(c.noDestinoId),
          pontoOrigem: c.pontoOrigem || null,
        }));
        await api.put(`/builder/fluxos/${novoId}/canvas`, { nos, conexoes });
      }

      setFluxos((atual) => [resp.data, ...atual]);
      setFluxoAtivoId(novoId);
      setDrawerNovoAberto(false);
      toast.success(template ? `Fluxo criado a partir do template "${template.nome}".` : 'Fluxo criado.');
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
    setNoSelecionadoId((prev) => (prev === idNo ? null : prev));
    setSujo(true);
  }, []);

  // Handlers do React Flow (canvas controlled). Mudancas como move/select/dimensions
  // sao puramente visuais, mas remove/add/replace marcam o canvas como sujo.
  const onNodesChange = useCallback((changes) => {
    setNodes((ns) => applyNodeChanges(changes, ns));

    const removidos = changes.filter((c) => c.type === 'remove');
    if (removidos.length > 0) {
      const idsRemovidos = new Set(removidos.map((c) => c.id));
      setEdges((es) => es.filter((e) => !idsRemovidos.has(e.source) && !idsRemovidos.has(e.target)));
      setNoSelecionadoId((prev) => (prev && idsRemovidos.has(prev) ? null : prev));
    }

    if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) {
      setSujo(true);
    }
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((es) => applyEdgeChanges(changes, es));
    if (changes.some((c) => c.type !== 'select')) setSujo(true);
  }, []);

  const onConnect = useCallback((params) => {
    setEdges((es) => addEdge({ ...params, id: novoIdConexao() }, es));
    setSujo(true);
  }, []);

  // Recebe (tipo, posicao) do drag-drop do canvas. Cria nó e seleciona.
  const adicionarNoPorPosicao = useCallback((tipo, posicao) => {
    const novo = criarNoDoTipo(tipo, posicao);
    if (!novo) return;
    setNodes((ns) => ns.concat(novo));
    setNoSelecionadoId(novo.id);
    setSujo(true);
  }, []);

  // Versao "no centro" usada pelo modal de catalogo.
  const adicionarNoCentro = useCallback(
    (tipo) => adicionarNoPorPosicao(tipo, { x: 200, y: 180 }),
    [adicionarNoPorPosicao]
  );

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
          <Card padding="sm" className="overflow-y-auto flex flex-col gap-3">
            <Button
              variant="accent"
              size="sm"
              icon={Plus}
              onClick={() => setCatalogoAberto(true)}
              fullWidth
            >
              Adicionar no
            </Button>
            <PaletaNos />
          </Card>

          <Card padding="none" className="overflow-hidden relative">
            {carregandoCanvas ? (
              <div className="h-full flex items-center justify-center text-sm text-[var(--text-muted)]">
                Carregando canvas...
              </div>
            ) : (
              <>
                <CanvasFluxo
                  nodes={nodes}
                  edges={edges}
                  noSelecionadoId={noSelecionadoId}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onAdicionarNoPorPosicao={adicionarNoPorPosicao}
                  onSelecionarNo={setNoSelecionadoId}
                />
                {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center pointer-events-auto bg-[var(--bg-card)]/95 backdrop-blur-sm border border-dashed border-[var(--border-strong)] rounded-2xl px-6 py-5 max-w-xs">
                      <Workflow size={26} strokeWidth={1.5} className="mx-auto text-[var(--text-muted)] opacity-60" />
                      <h3 className="text-sm font-semibold tracking-tight text-[var(--text-main)] mt-2.5">
                        Canvas vazio
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                        Comece arrastando da paleta ou clique abaixo.
                      </p>
                      <Button
                        variant="accent"
                        size="sm"
                        icon={Plus}
                        className="mt-3"
                        onClick={() => setCatalogoAberto(true)}
                      >
                        Adicionar primeiro no
                      </Button>
                    </div>
                  </div>
                )}
              </>
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

      <CatalogoModal
        isOpen={catalogoAberto}
        onClose={() => setCatalogoAberto(false)}
        onSelecionar={adicionarNoCentro}
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
            <Button
              variant="danger-soft"
              size="sm"
              icon={Trash2}
              onClick={onExcluir}
            >
              Excluir
            </Button>
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
  const [templateId, setTemplateId] = useState(null); // null = em branco

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa form ao fechar
      setNome('');
      setTemplateId(null);
    }
  }, [isOpen]);

  // Quando seleciona um template, sugere o nome dele.
  useEffect(() => {
    if (templateId) {
      const tpl = obterTemplate(templateId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill ao trocar template
      if (tpl) setNome(tpl.nome);
    }
  }, [templateId]);

  const submeter = (e) => {
    e.preventDefault();
    const limpo = nome.trim();
    if (limpo.length < 2) return;
    onCriar({ nome: limpo, templateId });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Novo fluxo"
      description="Comece em branco ou aplique um template pronto."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="accent" onClick={submeter} disabled={nome.trim().length < 2}>
            {templateId ? 'Criar a partir do template' : 'Criar em branco'}
          </Button>
        </div>
      }
    >
      <form onSubmit={submeter} className="space-y-5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Ponto de partida
          </div>
          <div className="grid grid-cols-1 gap-2">
            <CartaoTemplate
              ativo={!templateId}
              onClick={() => setTemplateId(null)}
              titulo="Em branco"
              descricao="Comece com um canvas vazio e monte tudo do zero."
              ehBranco
            />
            {TEMPLATES.map((tpl) => {
              const Icone = tpl.icone;
              return (
                <CartaoTemplate
                  key={tpl.id}
                  ativo={templateId === tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  titulo={tpl.nome}
                  descricao={tpl.descricao}
                  Icone={Icone}
                  rotuloCategoria={tpl.categoria}
                />
              );
            })}
          </div>
        </div>

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

function CartaoTemplate({ ativo, onClick, titulo, descricao, Icone, rotuloCategoria, ehBranco }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
        ativo
          ? 'border-[var(--accent-border)] bg-[var(--accent-soft)]'
          : 'border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] hover:border-[var(--border-strong)]'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${
          ativo
            ? 'bg-[var(--accent)] text-[var(--text-on-accent)] border-[var(--accent-border)]'
            : ehBranco
              ? 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-dashed border-[var(--border-strong)]'
              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-main)]'
        }`}
      >
        {Icone ? <Icone size={16} strokeWidth={1.75} /> : <span className="text-base font-bold">+</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
            {titulo}
          </span>
          {rotuloCategoria && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)]">
              {rotuloCategoria}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
          {descricao}
        </p>
      </div>
    </button>
  );
}
