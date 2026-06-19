import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Bot as BotIcon, Sparkles, BookOpen, ShieldCheck, Wrench,
  MessageCircle, Workflow, Plus, Trash2, KeyRound, ExternalLink, Wand2, Power,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Select, Textarea,
  Switch, Badge, IconButton, Combobox, EmptyState, useToast,
} from '../components/ui';
import api from '../services/api';
import credenciaisService from '../services/credenciaisService';

const PROVEDORES = [
  { value: 'OPENAI', label: 'OpenAI (GPT)' },
  { value: 'ANTHROPIC', label: 'Anthropic (Claude)' },
  { value: 'GEMINI', label: 'Google Gemini' },
];
const TIPO_CREDENCIAL_POR_PROVEDOR = {
  OPENAI: 'OPENAI_API_KEY',
  ANTHROPIC: 'ANTHROPIC_API_KEY',
  GEMINI: 'GEMINI_API_KEY',
};
const SEGMENTO_LABELS = { SERVICO: 'Serviço', PRODUTO: 'Produto', HIBRIDO: 'Híbrido' };

const POLITICAS_PADRAO = {
  exigirConfirmacaoVenda: true,
  valorMaxVendaAuto: '',
  permiteDesconto: false,
  descontoMaxPercent: 0,
  cadenciaRecompraDias: '',
  handoffPalavras: 'humano, atendente, pessoa',
  handoffMaxTurnos: 3,
};

export default function BotConfigPage() {
  const { botId } = useParams();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [credenciais, setCredenciais] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [ia, setIa] = useState({
    nome: '', provedorIa: 'OPENAI', modeloIa: '', temperaturaIa: 0.7, promptSistemaIa: '', credencialIaId: '',
  });
  const [salvandoIa, setSalvandoIa] = useState(false);

  const [pol, setPol] = useState(POLITICAS_PADRAO);
  const [salvandoPol, setSalvandoPol] = useState(false);

  const [aplicandoPreset, setAplicandoPreset] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [respBot, listaCreds, respFaq] = await Promise.all([
        api.get(`/bots/${botId}`),
        credenciaisService.listar().catch(() => []),
        api.get(`/bots/${botId}/faq`).catch(() => ({ data: [] })),
      ]);
      const b = respBot.data;
      setBot(b);
      setCredenciais(Array.isArray(listaCreds) ? listaCreds : []);
      setFaqs(Array.isArray(respFaq.data) ? respFaq.data : []);
      if (b) {
        setIa({
          nome: b.nome || '',
          provedorIa: b.provedorIa || 'OPENAI',
          modeloIa: b.modeloIa || '',
          temperaturaIa: b.temperaturaIa ?? 0.7,
          promptSistemaIa: b.promptSistemaIa || '',
          credencialIaId: b.credencialIaId || '',
        });
        const p = b.politicasAgente && typeof b.politicasAgente === 'object' ? b.politicasAgente : {};
        setPol({
          exigirConfirmacaoVenda: p.exigirConfirmacaoVenda !== false,
          valorMaxVendaAuto: p.valorMaxVendaAuto ?? '',
          permiteDesconto: p.permiteDesconto === true,
          descontoMaxPercent: p.descontoMaxPercent ?? 0,
          cadenciaRecompraDias: p.cadenciaRecompraDias ?? '',
          handoffPalavras: Array.isArray(p.handoff?.palavrasChave)
            ? p.handoff.palavrasChave.join(', ')
            : POLITICAS_PADRAO.handoffPalavras,
          handoffMaxTurnos: p.handoff?.maxTurnosSemResolver ?? 3,
        });
      }
    } catch {
      toast.error('Falha ao carregar o bot.');
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao montar
  useEffect(() => { carregar(); }, [carregar]);

  const segmento = bot?.cliente?.segmento || null;
  const tipoEsperado = TIPO_CREDENCIAL_POR_PROVEDOR[ia.provedorIa] || null;

  const credenciaisElegiveis = useMemo(() => credenciais.filter((c) => {
    if (bot?.clienteId && c.clienteId && c.clienteId !== bot.clienteId) return false;
    if (tipoEsperado && c.tipo !== tipoEsperado) return false;
    return true;
  }), [credenciais, bot, tipoEsperado]);

  const salvarIa = async () => {
    setSalvandoIa(true);
    try {
      const r = await api.put(`/bots/${botId}`, {
        nome: ia.nome,
        provedorIa: ia.provedorIa,
        modeloIa: ia.modeloIa,
        temperaturaIa: parseFloat(ia.temperaturaIa) || 0.7,
        promptSistemaIa: ia.promptSistemaIa,
        credencialIaId: ia.credencialIaId || null,
      });
      setBot((b) => ({ ...b, ...r.data }));
      toast.success('Configuração da IA salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar.');
    } finally {
      setSalvandoIa(false);
    }
  };

  const salvarPoliticas = async () => {
    setSalvandoPol(true);
    try {
      await api.patch(`/bots/${botId}/politicas`, {
        politicasAgente: {
          exigirConfirmacaoVenda: pol.exigirConfirmacaoVenda,
          valorMaxVendaAuto: pol.valorMaxVendaAuto === '' || pol.valorMaxVendaAuto === null ? null : Number(pol.valorMaxVendaAuto),
          permiteDesconto: pol.permiteDesconto,
          descontoMaxPercent: Number(pol.descontoMaxPercent) || 0,
          cadenciaRecompraDias: pol.cadenciaRecompraDias === '' || pol.cadenciaRecompraDias === null ? null : Number(pol.cadenciaRecompraDias),
          handoff: {
            palavrasChave: pol.handoffPalavras.split(',').map((s) => s.trim()).filter(Boolean),
            maxTurnosSemResolver: Number(pol.handoffMaxTurnos) || 3,
          },
        },
      });
      toast.success('Comportamento salvo.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar.');
    } finally {
      setSalvandoPol(false);
    }
  };

  const aplicarPreset = async () => {
    if (!confirm('Aplicar o preset do segmento SOBRESCREVE as ferramentas habilitadas, o prompt base e as políticas deste bot. Continuar?')) return;
    setAplicandoPreset(true);
    try {
      const r = await api.post(`/bots/${botId}/aplicar-preset`);
      toast.success(`Preset "${SEGMENTO_LABELS[r.data?.segmento] || r.data?.segmento}" aplicado (${r.data?.totalTools} ferramentas).`);
      await carregar();
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao aplicar preset.');
    } finally {
      setAplicandoPreset(false);
    }
  };

  const adicionarFaq = async (dados) => {
    const r = await api.post(`/bots/${botId}/faq`, dados);
    setFaqs((l) => [...l, r.data]);
  };
  const removerFaq = async (id) => {
    await api.delete(`/bots/${botId}/faq/${id}`);
    setFaqs((l) => l.filter((f) => f.id !== id));
  };
  const alternarFaq = async (faq) => {
    const r = await api.put(`/bots/${botId}/faq/${faq.id}`, { ativo: !faq.ativo });
    setFaqs((l) => l.map((f) => (f.id === faq.id ? r.data : f)));
  };

  if (carregando) return <div className="text-sm text-[var(--text-muted)]">Carregando...</div>;
  if (!bot) return <div className="text-sm text-[var(--text-muted)]">Bot não encontrado.</div>;

  return (
    <div className="space-y-5 max-w-[1100px]">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/bots">
          <Button variant="ghost" icon={ArrowLeft} size="sm">Voltar para bots</Button>
        </Link>
        <div className="flex-1" />
      </div>

      <Card padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
            <BotIcon size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Configuração do bot</div>
            <div className="text-sm font-semibold text-[var(--text-main)] truncate">{bot.nome}</div>
          </div>
          {segmento ? (
            <Badge variant="accent" size="sm">Segmento: {SEGMENTO_LABELS[segmento] || segmento}</Badge>
          ) : (
            <Badge variant="warning" size="sm">Sem segmento</Badge>
          )}
          <Button
            variant="secondary"
            icon={Wand2}
            loading={aplicandoPreset}
            disabled={!segmento}
            onClick={aplicarPreset}
            title={segmento ? 'Preenche tools, prompt e políticas com o padrão do segmento' : 'Defina o segmento do cliente antes'}
          >
            Aplicar preset
          </Button>
        </div>
        {!segmento && (
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            O preset usa o segmento do cliente (Serviço/Produto/Híbrido). Defina o segmento na ficha do cliente para liberar.
          </p>
        )}
      </Card>

      {/* Cérebro IA */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle><span className="inline-flex items-center gap-2"><Sparkles size={15} /> Cérebro de IA</span></CardTitle>
            <CardDescription>Provedor, modelo e a personalidade (prompt) do agente. Deixe a credencial vazia para usar a IA da plataforma.</CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nome do bot" value={ia.nome} onChange={(e) => setIa({ ...ia, nome: e.target.value })} />
            <Select label="Provedor" value={ia.provedorIa} onChange={(e) => setIa({ ...ia, provedorIa: e.target.value, credencialIaId: '' })} options={PROVEDORES} placeholder="" />
            <Input label="Modelo" value={ia.modeloIa} onChange={(e) => setIa({ ...ia, modeloIa: e.target.value })} placeholder="gpt-4o-mini, claude-sonnet-4, ..." />
            <Input label="Temperatura" type="number" step="0.1" min="0" max="2" value={ia.temperaturaIa} onChange={(e) => setIa({ ...ia, temperaturaIa: e.target.value })} hint="0 = determinístico · 1 = balanceado · 2 = criativo" />
          </div>

          <div>
            <Combobox
              label="Credencial da IA (opcional)"
              value={ia.credencialIaId}
              onChange={(id) => setIa({ ...ia, credencialIaId: id || '' })}
              placeholder={credenciaisElegiveis.length === 0 ? 'Nenhuma credencial compatível — usará a IA da plataforma' : 'Vazio = IA da plataforma'}
              options={credenciaisElegiveis.map((c) => ({ value: c.id, label: c.nome, sublabel: c.tipo.replace(/_/g, ' ') }))}
            />
            <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1">
                <KeyRound size={11} /> {tipoEsperado ? `Tipo esperado: ${tipoEsperado.replace(/_/g, ' ')}` : 'Qualquer tipo'}
              </span>
              <Link to="/app/configuracoes/credenciais" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                Cadastrar credencial <ExternalLink size={11} />
              </Link>
            </div>
          </div>

          <Textarea
            label="Prompt do sistema (personalidade e regras do agente)"
            value={ia.promptSistemaIa}
            onChange={(e) => setIa({ ...ia, promptSistemaIa: e.target.value })}
            rows={8}
            placeholder="Você é o atendente da loja X. Atenda em português, seja cordial..."
          />

          <div className="flex justify-end">
            <Button variant="primary" icon={Save} loading={salvandoIa} onClick={salvarIa}>Salvar IA</Button>
          </div>
        </div>
      </Card>

      {/* Base de conhecimento (FAQ) */}
      <FaqSection faqs={faqs} onAdd={adicionarFaq} onRemove={removerFaq} onToggle={alternarFaq} toast={toast} />

      {/* Comportamento / Alçada */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle><span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> Comportamento e alçada</span></CardTitle>
            <CardDescription>Até onde o bot pode ir sozinho, e quando passar pra um humano.</CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <ToggleLinha
            titulo="Confirmar antes de fechar venda/agendamento"
            descricao="O bot pede o 'sim' do cliente antes de mexer em dinheiro, estoque ou agenda."
            checked={pol.exigirConfirmacaoVenda}
            onChange={(v) => setPol({ ...pol, exigirConfirmacaoVenda: v })}
          />
          <ToggleLinha
            titulo="Permitir desconto"
            descricao="Se ligado, o bot pode oferecer desconto até o teto abaixo."
            checked={pol.permiteDesconto}
            onChange={(v) => setPol({ ...pol, permiteDesconto: v })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Teto de venda automática (R$)"
              type="number" min="0" step="0.01"
              value={pol.valorMaxVendaAuto}
              onChange={(e) => setPol({ ...pol, valorMaxVendaAuto: e.target.value })}
              placeholder="Vazio = sem teto"
              hint="Acima disso, o bot escala pra um humano."
            />
            {pol.permiteDesconto && (
              <Input
                label="Desconto máximo (%)"
                type="number" min="0" max="100" step="1"
                value={pol.descontoMaxPercent}
                onChange={(e) => setPol({ ...pol, descontoMaxPercent: e.target.value })}
              />
            )}
            <Input
              label="Cadência de recompra (dias)"
              type="number" min="0" step="1"
              value={pol.cadenciaRecompraDias}
              onChange={(e) => setPol({ ...pol, cadenciaRecompraDias: e.target.value })}
              placeholder="Ex.: 30 (salão) · vazio = sem recompra"
            />
            <Input
              label="Escalar após N turnos sem resolver"
              type="number" min="1" max="20" step="1"
              value={pol.handoffMaxTurnos}
              onChange={(e) => setPol({ ...pol, handoffMaxTurnos: e.target.value })}
            />
          </div>

          <Input
            label="Palavras que disparam o handoff"
            value={pol.handoffPalavras}
            onChange={(e) => setPol({ ...pol, handoffPalavras: e.target.value })}
            placeholder="humano, atendente, pessoa"
            hint="Separe por vírgula. Se o cliente disser uma delas, o bot passa pra um humano."
          />

          <div className="flex justify-end">
            <Button variant="primary" icon={Save} loading={salvandoPol} onClick={salvarPoliticas}>Salvar comportamento</Button>
          </div>
        </div>
      </Card>

      {/* Atalhos */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Mais configurações</CardTitle>
            <CardDescription>Ferramentas, canal e o construtor de fluxo ficam em telas próprias.</CardDescription>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to={`/admin/bots/${botId}/tools`}>
            <Button variant="secondary" icon={Wrench} fullWidth>Ferramentas</Button>
          </Link>
          <Link to={`/admin/bots/${botId}/canal`}>
            <Button variant="secondary" icon={MessageCircle} fullWidth>Canal (WhatsApp)</Button>
          </Link>
          <Link to={`/admin/builder/${botId}`}>
            <Button variant="secondary" icon={Workflow} fullWidth>Construtor de fluxo</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function ToggleLinha({ titulo, descricao, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl border border-[var(--border-main)]">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--text-main)] tracking-tight">{titulo}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-snug">{descricao}</div>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function FaqSection({ faqs, onAdd, onRemove, onToggle, toast }) {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [salvando, setSalvando] = useState(false);

  const adicionar = async () => {
    if (!pergunta.trim() || !resposta.trim()) {
      toast.error('Preencha a pergunta e a resposta.');
      return;
    }
    setSalvando(true);
    try {
      await onAdd({ pergunta: pergunta.trim(), resposta: resposta.trim() });
      setPergunta('');
      setResposta('');
      toast.success('Pergunta adicionada.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao adicionar.');
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (f) => {
    if (!confirm('Remover esta pergunta da base?')) return;
    try { await onRemove(f.id); } catch { toast.error('Falha ao remover.'); }
  };

  return (
    <Card padding="md">
      <CardHeader>
        <div>
          <CardTitle><span className="inline-flex items-center gap-2"><BookOpen size={15} /> Base de conhecimento (FAQ)</span></CardTitle>
          <CardDescription>Perguntas e respostas que o bot usa para tirar dúvidas antes de responder por conta própria.</CardDescription>
        </div>
      </CardHeader>

      <div className="space-y-3">
        {faqs.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nenhuma pergunta cadastrada" description="Adicione as dúvidas mais comuns dos seus clientes abaixo." />
        ) : (
          <div className="space-y-2">
            {faqs.map((f) => (
              <div key={f.id} className={`p-3 rounded-xl border border-[var(--border-main)] ${f.ativo ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[var(--text-main)]">{f.pergunta}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed whitespace-pre-wrap">{f.resposta}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <IconButton
                      icon={Power}
                      variant={f.ativo ? 'ghost' : 'secondary'}
                      size="sm"
                      ariaLabel={f.ativo ? 'Desativar' : 'Ativar'}
                      onClick={() => onToggle(f)}
                    />
                    <IconButton icon={Trash2} variant="ghost" size="sm" ariaLabel="Remover" onClick={() => remover(f)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form de adicionar */}
        <div className="border-t border-[var(--border-main)] pt-3 space-y-3">
          <Input label="Pergunta" value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Ex.: Qual o horário de funcionamento?" />
          <Textarea label="Resposta" value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} placeholder="Ex.: Atendemos de segunda a sábado, das 9h às 19h." />
          <div className="flex justify-end">
            <Button variant="secondary" icon={Plus} loading={salvando} onClick={adicionar}>Adicionar pergunta</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
