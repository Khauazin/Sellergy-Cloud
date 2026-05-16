import { useState, useEffect, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Calendar, Clock, Phone, Edit2, Trash2,
  CheckCircle2, XCircle, Sparkles, Lock, History
} from 'lucide-react';
import api from '../services/api';
import {
  Card, Button, IconButton, Input, Textarea, Select, Badge,
  EmptyState, Drawer, useToast, Tabs, TabsList, TabsTrigger, Combobox
} from '../components/ui';
import Modal from '../components/Modal';
import { formatarTelefoneBR } from '../utils/formatTelefone';

const fmtBRL = (v) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS_LABELS = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  CONFIRMED: { label: 'Confirmado', variant: 'success' },
  CANCELED: { label: 'Cancelado', variant: 'danger' },
  COMPLETED: { label: 'Concluido', variant: 'info' },
};

// Cores por status. soft = fundo do card/pill; text = cor do texto; solid = barra
// lateral mais saturada. Mantemos consistente com o sistema de design (mesmas
// vars usadas em Badge). CANCELED tambem ganha line-through pra reforcar visual.
const STATUS_CORES = {
  PENDING:   { soft: 'var(--warning-soft)', text: 'var(--warning-text)', solid: 'var(--warning)' },
  CONFIRMED: { soft: 'var(--success-soft)', text: 'var(--success-text)', solid: 'var(--success)' },
  CANCELED:  { soft: 'var(--danger-soft)',  text: 'var(--danger-text)',  solid: 'var(--danger)'  },
  COMPLETED: { soft: 'var(--info-soft)',    text: 'var(--info-text)',    solid: 'var(--info)'    },
};
const coresPorStatus = (s) => STATUS_CORES[s] || STATUS_CORES.PENDING;

// Regra de imutabilidade (espelha o backend em agenda.routes.js):
// agendamento passado + status != PENDING fica travado pra editar/excluir.
// PENDING passado continua editavel pra usuario poder atualizar o status
// retroativamente (ex: marcar como Concluido). Assim que atualiza, trava.
function ehAgendamentoImutavel(ag) {
  if (!ag) return false;
  if (ag.status === 'PENDING') return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return new Date(ag.data) < hoje;
}

export default function AgendaPage() {
  const toast = useToast();
  const [view, setView] = useState('dia');
  const [dataAtual, setDataAtual] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState([]);
  const [variacoes, setVariacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState({ open: false, data: null });
  const [drawer, setDrawer] = useState({ open: false, ag: null });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dataAtual]);

  useEffect(() => {
    carregarVariacoes();
  }, []);

  const carregarVariacoes = async () => {
    try {
      const r = await api.get('/catalogo');
      const flat = [];
      (r.data || []).forEach((p) => {
        (p.variacoes || []).forEach((v) => flat.push({ ...v, produto: p }));
      });
      setVariacoes(flat);
    } catch {
      setVariacoes([]);
    }
  };

  const carregar = async () => {
    setCarregando(true);
    try {
      // IMPORTANTE: calculamos a janela [inicio, fim] no fuso LOCAL do navegador
      // e mandamos pro backend em ISO (ja em UTC). Assim o backend nao precisa
      // saber o fuso do cliente nem manipular Date com setHours (que tem efeito
      // dependente do TZ do processo).
      //
      // Bug que isso corrige: agendamento criado pras 09:00 BRT (= 12:00Z)
      // aparecia no filtro do dia seguinte quando o servidor rodava em UTC
      // mas o cliente em BRT, porque a janela do backend era [00:00Z, 23:59Z]
      // do dia "string" e o setHours embaralhava ainda mais.
      let inicio, fim;
      if (view === 'dia') {
        inicio = new Date(dataAtual);
        inicio.setHours(0, 0, 0, 0);
        fim = new Date(dataAtual);
        fim.setHours(23, 59, 59, 999);
      } else {
        inicio = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1, 0, 0, 0, 0);
        fim = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0, 23, 59, 59, 999);
      }
      const url = `/agenda?inicio=${encodeURIComponent(inicio.toISOString())}&fim=${encodeURIComponent(fim.toISOString())}`;
      const r = await api.get(url);
      setAgendamentos(r.data || []);
    } catch {
      setAgendamentos([]);
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvar = async (dados) => {
    try {
      if (dados.id) {
        await api.put(`/agenda/${dados.id}`, dados);
        toast.success('Agendamento atualizado');
      } else {
        await api.post('/agenda', dados);
        toast.success('Agendamento criado');
      }
      setModal({ open: false, data: null });
      carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Erro ao salvar');
    }
  };

  const handleExcluir = async (ag) => {
    if (!confirm(`Excluir agendamento de ${ag.nomeCliente}?`)) return;
    try {
      await api.delete(`/agenda/${ag.id}`);
      toast.success('Agendamento excluido');
      setDrawer({ open: false, ag: null });
      carregar();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleMudarStatus = async (ag, status) => {
    try {
      await api.patch(`/agenda/${ag.id}/status`, { status });
      toast.success(`Marcado como ${STATUS_LABELS[status]?.label?.toLowerCase()}`);
      setDrawer({ open: false, ag: null });
      carregar();
    } catch {
      toast.error('Erro ao mudar status');
    }
  };

  const navegar = (dir) => {
    const nova = new Date(dataAtual);
    if (view === 'dia') nova.setDate(nova.getDate() + dir);
    else nova.setMonth(nova.getMonth() + dir);
    setDataAtual(nova);
  };

  const irHoje = () => setDataAtual(new Date());

  const fmtData = view === 'dia'
    ? dataAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : dataAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} variant="secondary" size="md" onClick={() => navegar(-1)} ariaLabel="Anterior" />
          <Button variant="ghost" size="md" onClick={irHoje}>Hoje</Button>
          <IconButton icon={ChevronRight} variant="secondary" size="md" onClick={() => navegar(1)} ariaLabel="Proximo" />
          <div className="ml-2 text-base font-semibold tracking-tight text-[var(--text-main)] capitalize">
            {fmtData}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={setView}>
            <TabsList variant="pills">
              <TabsTrigger value="dia" variant="pills">Dia</TabsTrigger>
              <TabsTrigger value="mes" variant="pills">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
            Novo agendamento
          </Button>
        </div>
      </div>

      {/* Conteudo */}
      {carregando ? (
        <Card padding="lg">
          <div className="text-center py-12 text-[var(--text-muted)] text-sm">Carregando...</div>
        </Card>
      ) : agendamentos.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={Calendar}
            title="Nada agendado para esse periodo"
            description="Os agendamentos do bot ou cadastrados manualmente aparecem aqui."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setModal({ open: true, data: null })}>
                Novo agendamento
              </Button>
            }
          />
        </Card>
      ) : view === 'dia' ? (
        <ViewDia agendamentos={agendamentos} onSelecionar={(ag) => setDrawer({ open: true, ag })} />
      ) : (
        <ViewMes agendamentos={agendamentos} dataReferencia={dataAtual} onSelecionar={(ag) => setDrawer({ open: true, ag })} />
      )}

      <ModalAgendamento
        isOpen={modal.open}
        onClose={() => setModal({ open: false, data: null })}
        ag={modal.data}
        variacoes={variacoes}
        onSalvar={handleSalvar}
      />

      <DrawerAg
        isOpen={drawer.open}
        onClose={() => setDrawer({ open: false, ag: null })}
        ag={drawer.ag}
        onEditar={() => {
          setModal({ open: true, data: drawer.ag });
          setDrawer({ open: false, ag: null });
        }}
        onExcluir={() => handleExcluir(drawer.ag)}
        onStatus={(s) => handleMudarStatus(drawer.ag, s)}
      />
    </div>
  );
}

function ViewDia({ agendamentos, onSelecionar }) {
  const ordenados = [...agendamentos].sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <Card padding="none">
      <div className="divide-y divide-[var(--border-subtle)]">
        {ordenados.map((ag) => {
          const data = new Date(ag.data);
          const status = STATUS_LABELS[ag.status] || { label: ag.status, variant: 'neutral' };
          const cores = coresPorStatus(ag.status);
          const ehCancelado = ag.status === 'CANCELED';
          return (
            <div
              key={ag.id}
              onClick={() => onSelecionar(ag)}
              className="flex items-stretch gap-4 px-5 py-4 hover:bg-[var(--bg-subtle)]/50 cursor-pointer transition-colors"
            >
              {/* Barra lateral colorida pelo status — leitura rapida do estado */}
              <div
                className="w-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: cores.solid }}
                aria-hidden="true"
              />
              <div className="text-center w-16 flex-shrink-0 self-center">
                <div className={`text-xl font-semibold tracking-tight tabular-nums ${ehCancelado ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                  {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-bold mt-0.5">
                  {ag.duracao}min
                </div>
              </div>
              <div className="w-px self-stretch bg-[var(--border-main)]" />
              <div className="flex-1 min-w-0 self-center">
                <div className={`text-base font-semibold tracking-tight ${ehCancelado ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                  {ag.servico || 'Servico'}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{ag.nomeCliente}</span>
                  {ag.telefoneCliente && <><span className="text-[var(--text-muted)]">·</span><span>{ag.telefoneCliente}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 self-center flex-shrink-0">
                {ag.preco > 0 && (
                  <div className={`text-base font-semibold tabular-nums ${ehCancelado ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                    {fmtBRL(ag.preco)}
                  </div>
                )}
                {ag.origem === 'AI' && <Badge variant="accent" size="sm" icon={Sparkles}>Bot</Badge>}
                <Badge variant={status.variant} size="sm">{status.label}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ViewMes({ agendamentos, dataReferencia, onSelecionar }) {
  // Agrupa por dia
  const porDia = useMemo(() => {
    const map = {};
    agendamentos.forEach((ag) => {
      const dia = new Date(ag.data).getDate();
      if (!map[dia]) map[dia] = [];
      map[dia].push(ag);
    });
    return map;
  }, [agendamentos]);

  const totalDias = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0).getDate();
  const primeiroDiaSemana = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1).getDay();
  const dias = [];
  for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
  for (let i = 1; i <= totalDias; i++) dias.push(i);

  const semanas = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <Card padding="md">
      <div className="grid grid-cols-7 gap-px bg-[var(--border-main)] rounded-xl overflow-hidden">
        {semanas.map((s) => (
          <div key={s} className="bg-[var(--bg-subtle)] text-center py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {s}
          </div>
        ))}
        {dias.map((dia, i) => {
          const ags = dia ? (porDia[dia] || []) : [];
          const hoje = new Date();
          const ehHoje = dia &&
            hoje.getDate() === dia &&
            hoje.getMonth() === dataReferencia.getMonth() &&
            hoje.getFullYear() === dataReferencia.getFullYear();

          return (
            <div
              key={i}
              className={`bg-[var(--bg-card)] min-h-[180px] p-2.5 ${dia ? '' : 'opacity-40'}`}
            >
              {dia && (
                <>
                  <div className={`text-base font-semibold mb-2 ${ehHoje ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                    {dia}
                  </div>
                  <div className="space-y-1.5">
                    {ags.slice(0, 4).map((ag) => {
                      const cores = coresPorStatus(ag.status);
                      const ehCancelado = ag.status === 'CANCELED';
                      const data = new Date(ag.data);
                      return (
                        <button
                          key={ag.id}
                          onClick={() => onSelecionar(ag)}
                          className={`w-full text-left px-2 py-1.5 rounded-md hover:opacity-80 transition-opacity border-l-2 ${ehCancelado ? 'line-through' : ''}`}
                          style={{
                            backgroundColor: cores.soft,
                            color: cores.text,
                            borderLeftColor: cores.solid,
                          }}
                          title={`${ag.nomeCliente}${ag.servico ? ' · ' + ag.servico : ''} · ${ag.duracao}min`}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-bold tabular-nums opacity-90">
                            <span>{data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="opacity-60">·</span>
                            <span>{ag.duracao}min</span>
                          </div>
                          <div className="text-xs font-semibold truncate mt-0.5">{ag.nomeCliente}</div>
                          {ag.servico && (
                            <div className="text-[11px] truncate opacity-80">{ag.servico}</div>
                          )}
                        </button>
                      );
                    })}
                    {ags.length > 4 && (
                      <div className="text-xs text-[var(--text-muted)] px-2 font-medium">+{ags.length - 4} mais</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// Helper: retorna o preco efetivo da variacao (catalogo se ativo, senao estoque)
function precoEfetivoVariacao(v) {
  if (!v) return 0;
  if (v.usarPrecoCatalogo && v.precoCatalogo != null) return v.precoCatalogo;
  return v.preco || 0;
}

function ModalAgendamento({ isOpen, onClose, ag, variacoes = [], onSalvar }) {
  // tipoItem controla o filtro da lista de catalogo. Em UX:
  //   1. usuario escolhe se quer agendar um SERVICO ou um PRODUTO
  //   2. so depois aparece o combobox com a lista daquele tipo
  //   3. se for SERVICO e a variacao tiver duracaoMin, auto-preenche duracao
  const [tipoItem, setTipoItem] = useState('SERVICO');
  const [form, setForm] = useState({
    nomeCliente: '', telefoneCliente: '', data: '', hora: '', duracao: 30,
    variacaoId: '', servico: '', preco: 0,
    observacoes: '', status: 'PENDING', origem: 'MANUAL',
  });

  useEffect(() => {
    if (ag) {
      const d = new Date(ag.data);
      setForm({
        ...ag,
        data: d.toISOString().split('T')[0],
        hora: d.toTimeString().slice(0, 5),
        preco: ag.preco || 0,
        variacaoId: '', // edicao mantem o servico em texto livre, sem ligar variacao
        observacoes: ag.observacoes || '',
      });
      // Edicao: default pra SERVICO ja que e o caso mais comum em agenda.
      setTipoItem('SERVICO');
    } else {
      const agora = new Date();
      setForm({
        nomeCliente: '', telefoneCliente: '',
        data: agora.toISOString().split('T')[0],
        hora: '09:00',
        duracao: 30, variacaoId: '', servico: '', preco: 0, observacoes: '',
        status: 'PENDING', origem: 'MANUAL',
      });
      setTipoItem('SERVICO');
    }
  }, [ag, isOpen]);

  // Filtra variacoes pelo tipo selecionado.
  const variacoesFiltradas = useMemo(
    () => variacoes.filter((v) => v.produto?.tipo === tipoItem),
    [variacoes, tipoItem]
  );

  const variacaoSel = variacoes.find((v) => v.id === form.variacaoId);

  // Mudou o tipo? Reseta a variacao escolhida (a lista vai ser outra).
  const handleMudarTipo = (novoTipo) => {
    setTipoItem(novoTipo);
    setForm((f) => ({ ...f, variacaoId: '', servico: '', preco: 0 }));
  };

  // Quando seleciona variacao, atualiza servico, preco e — se for SERVICO
  // com duracaoMin cadastrado — tambem a duracao.
  const handleSelectVariacao = (id) => {
    if (id) {
      const v = variacoes.find((x) => x.id === id);
      if (v) {
        setForm((f) => ({
          ...f,
          variacaoId: id,
          servico: `${v.produto?.nome} - ${v.nome}`,
          preco: precoEfetivoVariacao(v),
          // Auto-preenche duracao so se for servico com duracaoMin cadastrado.
          // Se nao tiver, mantem o que o usuario digitou.
          duracao: v.produto?.tipo === 'SERVICO' && v.duracaoMin
            ? v.duracaoMin
            : f.duracao,
        }));
      }
    } else {
      setForm((f) => ({ ...f, variacaoId: '', servico: '', preco: 0 }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataCompleta = new Date(`${form.data}T${form.hora}`);
    onSalvar({
      ...form,
      data: dataCompleta.toISOString(),
      duracao: parseInt(form.duracao) || 30,
      preco: parseFloat(form.preco) || 0,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ag ? 'Editar agendamento' : 'Novo agendamento'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nome do cliente" value={form.nomeCliente} onChange={(e) => setForm({ ...form, nomeCliente: e.target.value })} required />
          <Input
            label="Telefone"
            value={form.telefoneCliente}
            onChange={(e) => setForm({ ...form, telefoneCliente: formatarTelefoneBR(e.target.value) })}
            placeholder="(11) 99999-9999"
            maxLength={15}
            inputMode="tel"
          />
          <Input label="Data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          <Input label="Hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} required />
        </div>

        {/* Item agendado — escolhe Tipo primeiro, dai filtra o catalogo. */}
        <div className="border border-[var(--border-main)] rounded-xl p-4 space-y-3 bg-[var(--bg-subtle)]/40">
          <div className="text-sm font-semibold text-[var(--text-main)]">Item agendado</div>

          {/* Toggle Tipo: Servico vs Produto */}
          <Tabs value={tipoItem} onValueChange={handleMudarTipo}>
            <TabsList variant="pills">
              <TabsTrigger value="SERVICO" variant="pills">Servico</TabsTrigger>
              <TabsTrigger value="FISICO" variant="pills">Produto fisico</TabsTrigger>
            </TabsList>
          </Tabs>

          <Combobox
            label={tipoItem === 'SERVICO' ? 'Buscar servico do catalogo' : 'Buscar produto do catalogo'}
            value={form.variacaoId}
            onChange={handleSelectVariacao}
            options={variacoesFiltradas.map((v) => ({
              value: v.id,
              label: `${v.produto?.nome} - ${v.nome}`,
              sublabel: [
                precoEfetivoVariacao(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                v.produto?.tipo === 'FISICO' ? `${v.estoqueAtual} em estoque` : null,
                v.produto?.tipo === 'SERVICO' && v.duracaoMin ? `${v.duracaoMin}min` : null,
              ].filter(Boolean).join(' · '),
              badge: v.usarPrecoCatalogo ? 'Catalogo' : null,
            }))}
            placeholder={
              variacoesFiltradas.length === 0
                ? `Nenhum ${tipoItem === 'SERVICO' ? 'servico' : 'produto'} cadastrado`
                : 'Selecione um item cadastrado'
            }
            clearable
            hint="Ou preencha manualmente abaixo"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={tipoItem === 'SERVICO' ? 'Servico (texto livre)' : 'Produto (texto livre)'}
              value={form.servico}
              onChange={(e) => setForm({ ...form, servico: e.target.value, variacaoId: '' })}
              placeholder={tipoItem === 'SERVICO' ? 'Ex: Corte de cabelo' : 'Ex: Caixa de chocolate'}
              disabled={!!form.variacaoId}
              hint={form.variacaoId ? 'Vinculado a um item cadastrado' : 'Edite se precisar'}
            />
            <Input
              label="Preco (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
              disabled={!!form.variacaoId}
              hint={form.variacaoId ? `Puxado do ${variacaoSel?.usarPrecoCatalogo ? 'catalogo' : 'estoque'}` : 'Manual'}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Duracao (min)"
            type="number"
            min="1"
            value={form.duracao}
            onChange={(e) => setForm({ ...form, duracao: e.target.value })}
            hint={
              variacaoSel?.duracaoMin && tipoItem === 'SERVICO'
                ? `Puxado do servico cadastrado (${variacaoSel.duracaoMin}min)`
                : 'Tempo total do atendimento'
            }
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            placeholder=""
            options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v.label }))}
          />
        </div>

        <Textarea label="Observacoes" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button variant="primary" type="submit">{ag ? 'Salvar' : 'Criar agendamento'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DrawerAg({ isOpen, onClose, ag, onEditar, onExcluir, onStatus }) {
  const [historico, setHistorico] = useState([]);
  const [carregandoHist, setCarregandoHist] = useState(false);

  // Carrega historico ao abrir o drawer; reset quando muda de agendamento.
  useEffect(() => {
    if (!isOpen || !ag?.id) {
      setHistorico([]);
      return;
    }
    setCarregandoHist(true);
    api.get(`/agenda/${ag.id}/historico`)
      .then((r) => setHistorico(r.data || []))
      .catch(() => setHistorico([]))
      .finally(() => setCarregandoHist(false));
  }, [isOpen, ag?.id]);

  if (!ag) return null;
  const status = STATUS_LABELS[ag.status] || { label: ag.status, variant: 'neutral' };
  const data = new Date(ag.data);
  const travado = ehAgendamentoImutavel(ag);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={ag.servico || 'Agendamento'}
      description={ag.nomeCliente}
      size="md"
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="danger-soft" icon={Trash2} onClick={onExcluir} disabled={travado}>Excluir</Button>
          <Button variant="primary" icon={Edit2} onClick={onEditar} disabled={travado}>Editar</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Banner de aviso quando o agendamento esta travado pra preservar historico */}
        {travado && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)]">
            <Lock size={16} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong>Agendamento travado.</strong> Itens passados com status atualizado ficam imutaveis pra preservar o historico. Edicao e exclusao bloqueadas.
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <Calendar size={20} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold tracking-tight text-[var(--text-main)]">
              {data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Clock size={12} className="text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)] tabular-nums">
                {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ({ag.duracao}min)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={status.variant}>{status.label}</Badge>
          {ag.origem === 'AI' && <Badge variant="accent" icon={Sparkles}>Agendado pelo bot</Badge>}
          {travado && <Badge variant="info" icon={Lock}>Imutavel</Badge>}
          {ag.preco > 0 && (
            <span className="text-sm font-semibold text-[var(--text-main)] ml-auto tabular-nums">{fmtBRL(ag.preco)}</span>
          )}
        </div>

        {ag.telefoneCliente && (
          <a href={`tel:${ag.telefoneCliente}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--border-main)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
            <Phone size={14} /> {ag.telefoneCliente}
          </a>
        )}

        {ag.observacoes && (
          <div>
            <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Observacoes</div>
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-subtle)] rounded-xl p-3">{ag.observacoes}</div>
          </div>
        )}

        {/* Botoes de status: desabilitados quando travado */}
        <div>
          <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-2">Mudar status</div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={ag.status === 'CONFIRMED' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('CONFIRMED')} disabled={travado}>Confirmar</Button>
            <Button variant={ag.status === 'COMPLETED' ? 'primary' : 'secondary'} size="sm" icon={CheckCircle2} onClick={() => onStatus('COMPLETED')} disabled={travado}>Concluir</Button>
            <Button variant={ag.status === 'PENDING' ? 'primary' : 'secondary'} size="sm" onClick={() => onStatus('PENDING')} disabled={travado}>Pendente</Button>
            <Button variant={ag.status === 'CANCELED' ? 'danger' : 'secondary'} size="sm" icon={XCircle} onClick={() => onStatus('CANCELED')} disabled={travado}>Cancelar</Button>
          </div>
        </div>

        {/* Historico de alteracoes — sempre visivel, ate em itens travados */}
        <HistoricoAgendamento itens={historico} carregando={carregandoHist} />
      </div>
    </Drawer>
  );
}

// =====================================================================
// HISTORICO DE ALTERACOES
// =====================================================================
// Renderiza a timeline de mudancas (CRIADO, EDITADO, STATUS_MUDADO, EXCLUIDO)
// com diff campo a campo. Usuario que fez aparece se nao for acao do bot.
function HistoricoAgendamento({ itens, carregando }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <History size={14} className="text-[var(--text-muted)]" />
        <div className="text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
          Historico de alteracoes
        </div>
      </div>
      {carregando ? (
        <div className="text-xs text-[var(--text-muted)] italic py-2">Carregando...</div>
      ) : itens.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] italic py-2">Sem alteracoes registradas.</div>
      ) : (
        <div className="space-y-2">
          {itens.map((h) => (
            <ItemHistorico key={h.id} item={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemHistorico({ item }) {
  const data = new Date(item.criadoEm);
  const cfg = ACAO_CFG[item.acao] || { label: item.acao, cor: 'neutral' };
  const quemFez = item.usuarioNome || (item.origem === 'AI' ? 'Bot' : 'Sistema');

  return (
    <div className="border border-[var(--border-subtle)] rounded-lg p-2.5 bg-[var(--bg-card)]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Badge variant={cfg.cor} size="sm">{cfg.label}</Badge>
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">{quemFez}</span>
        </div>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
          {data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
          {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {item.alteracoes && <DiffAlteracoes alteracoes={item.alteracoes} acao={item.acao} />}
    </div>
  );
}

const ACAO_CFG = {
  CRIADO:        { label: 'Criado',         cor: 'success' },
  EDITADO:       { label: 'Editado',        cor: 'info' },
  STATUS_MUDADO: { label: 'Mudou status',   cor: 'warning' },
  EXCLUIDO:      { label: 'Excluido',       cor: 'danger' },
};

const CAMPOS_LABEL = {
  nomeCliente: 'Nome', telefoneCliente: 'Telefone', data: 'Data/hora',
  duracao: 'Duracao', servico: 'Servico', preco: 'Preco',
  observacoes: 'Obs.', status: 'Status',
};

function fmtValor(campo, v) {
  if (v == null || v === '') return '—';
  if (campo === 'data') return new Date(v).toLocaleString('pt-BR');
  if (campo === 'preco') return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (campo === 'status') return STATUS_LABELS[v]?.label || v;
  return String(v);
}

function DiffAlteracoes({ alteracoes, acao }) {
  // Snapshot (CRIADO/EXCLUIDO): so mostra os valores, sem de→para
  if (alteracoes.snapshot) {
    const snap = alteracoes.snapshot;
    return (
      <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5 mt-1">
        {Object.entries(snap)
          .filter(([_, v]) => v != null && v !== '')
          .slice(0, 4)
          .map(([campo, v]) => (
            <div key={campo}>
              <span className="text-[var(--text-muted)]">{CAMPOS_LABEL[campo] || campo}:</span>{' '}
              <span className="font-medium">{fmtValor(campo, v)}</span>
            </div>
          ))}
      </div>
    );
  }
  // Diff (EDITADO/STATUS_MUDADO)
  return (
    <div className="text-[11px] space-y-0.5 mt-1">
      {Object.entries(alteracoes).map(([campo, { de, para }]) => (
        <div key={campo}>
          <span className="text-[var(--text-muted)]">{CAMPOS_LABEL[campo] || campo}:</span>{' '}
          <span className="text-[var(--text-secondary)] line-through opacity-70">{fmtValor(campo, de)}</span>
          {' → '}
          <span className="font-semibold text-[var(--text-main)]">{fmtValor(campo, para)}</span>
        </div>
      ))}
    </div>
  );
}
