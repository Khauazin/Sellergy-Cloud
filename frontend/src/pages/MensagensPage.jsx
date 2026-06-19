import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import clsx from 'clsx';
import {
  Send, ArrowLeft, Bot, UserCheck, Undo2, MessageCircle,
  Image as ImageIcon, Mic, FileText, MapPin, User as UserIcon,
} from 'lucide-react';
import { SearchBar, Button, Badge, Avatar, EmptyState, useToast } from '../components/ui';
import api from '../services/api';

// Inbox estilo WhatsApp Web. Sem socket de mensagens no backend (ainda), entao
// atualiza por POLLING — robusto e sem risco. Lista a cada 8s, conversa aberta
// a cada 5s. Quando houver socket, troca o polling por eventos sem mudar a UI.
const POLL_LISTA_MS = 8000;
const POLL_THREAD_MS = 5000;

const ICONE_TIPO = {
  IMAGEM: ImageIcon, VIDEO: ImageIcon, AUDIO: Mic, ARQUIVO: FileText,
  LOCALIZACAO: MapPin, CONTATO: UserIcon, STICKER: ImageIcon,
};

function fmtHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mesmoDia = d.toDateString() === new Date().toDateString();
  return mesmoDia
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function nomeConversa(c) {
  return c?.lead?.nome || c?.identificador || 'Sem identificação';
}
function aguardandoHumano(estado) {
  return !!(estado && typeof estado === 'object' && estado.aguardandoHumano === true);
}

export default function MensagensPage() {
  const toast = useToast();

  const [conversas, setConversas] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [busca, setBusca] = useState('');

  const [selecionadaId, setSelecionadaId] = useState(null);
  const [conversa, setConversa] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [carregandoThread, setCarregandoThread] = useState(false);

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [acaoHandoff, setAcaoHandoff] = useState(false);

  const fimRef = useRef(null);

  const carregarLista = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregandoLista(true);
    try {
      const r = await api.get('/conversas', { params: { limite: 100 } });
      setConversas(Array.isArray(r.data?.itens) ? r.data.itens : []);
    } catch (e) {
      if (!silencioso) toast.error(e.response?.data?.erro || 'Falha ao carregar conversas.');
    } finally {
      if (!silencioso) setCarregandoLista(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao montar
    carregarLista();
    const t = setInterval(() => carregarLista(true), POLL_LISTA_MS);
    return () => clearInterval(t);
  }, [carregarLista]);

  const carregarThread = useCallback(async (id, silencioso = false) => {
    if (!id) return;
    if (!silencioso) setCarregandoThread(true);
    try {
      const [respConv, respMsg] = await Promise.all([
        api.get(`/conversas/${id}`),
        api.get(`/conversas/${id}/mensagens`, { params: { incluirConteudo: true, limite: 100 } }),
      ]);
      setConversa(respConv.data);
      setMensagens(Array.isArray(respMsg.data?.itens) ? respMsg.data.itens : []);
    } catch (e) {
      if (!silencioso) toast.error(e.response?.data?.erro || 'Falha ao abrir a conversa.');
    } finally {
      if (!silencioso) setCarregandoThread(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selecionadaId) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega ao selecionar
    carregarThread(selecionadaId);
    const t = setInterval(() => carregarThread(selecionadaId, true), POLL_THREAD_MS);
    return () => clearInterval(t);
  }, [selecionadaId, carregarThread]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return conversas;
    return conversas.filter((c) => nomeConversa(c).toLowerCase().includes(q)
      || (c.identificador || '').toLowerCase().includes(q));
  }, [conversas, busca]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || !selecionadaId || enviando) return;
    setEnviando(true);
    try {
      await api.post(`/conversas/${selecionadaId}/mensagens`, {
        sentido: 'SAIDA', autor: 'VENDEDOR', conteudo, tipo: 'TEXTO',
      });
      setTexto('');
      await carregarThread(selecionadaId, true);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  };

  const handoff = async (acao) => {
    if (!selecionadaId || acaoHandoff) return;
    setAcaoHandoff(true);
    try {
      const r = await api.patch(`/conversas/${selecionadaId}/${acao}`);
      setConversa(r.data);
      toast.success(acao === 'assumir'
        ? 'Você assumiu a conversa — o bot está pausado.'
        : 'Conversa devolvida ao bot.');
      carregarLista(true);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Não foi possível concluir a ação.');
    } finally {
      setAcaoHandoff(false);
    }
  };

  const emHandoff = aguardandoHumano(conversa?.estado);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] rounded-2xl border border-[var(--border-main)] overflow-hidden bg-[var(--bg-card)]">
      {/* COLUNA ESQUERDA — lista de conversas */}
      <aside className={clsx(
        'w-full md:w-[340px] md:flex-shrink-0 border-r border-[var(--border-main)] flex flex-col',
        selecionadaId ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-3 border-b border-[var(--border-main)] flex-shrink-0">
          <h1 className="text-sm font-semibold text-[var(--text-main)] px-1 mb-2">Conversas</h1>
          <SearchBar
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
          />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {carregandoLista ? (
            <div className="text-center text-sm text-[var(--text-muted)] py-10">Carregando...</div>
          ) : listaFiltrada.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={MessageCircle}
                title={conversas.length === 0 ? 'Nenhuma conversa' : 'Sem resultados'}
                description={conversas.length === 0 ? 'As conversas do bot aparecem aqui.' : 'Tente outra busca.'}
              />
            </div>
          ) : (
            listaFiltrada.map((c) => (
              <ConversaItem key={c.id} c={c} ativa={c.id === selecionadaId} onClick={() => setSelecionadaId(c.id)} />
            ))
          )}
        </div>
      </aside>

      {/* COLUNA DIREITA — conversa ativa */}
      <section className={clsx(
        'flex-1 flex-col min-w-0',
        selecionadaId ? 'flex' : 'hidden md:flex'
      )}>
        {!conversa ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={MessageCircle}
              title="Selecione uma conversa"
              description="Escolha uma conversa à esquerda para ver as mensagens e responder."
            />
          </div>
        ) : (
          <>
            {/* Cabeçalho da conversa */}
            <header className="flex items-center gap-3 p-3 border-b border-[var(--border-main)] flex-shrink-0">
              <button
                type="button"
                onClick={() => { setSelecionadaId(null); setConversa(null); setMensagens([]); }}
                className="md:hidden text-[var(--text-muted)] hover:text-[var(--text-main)]"
                aria-label="Voltar"
              >
                <ArrowLeft size={20} />
              </button>
              <Avatar name={nomeConversa(conversa)} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-main)] truncate">{nomeConversa(conversa)}</div>
                <div className="text-[11px] text-[var(--text-muted)] truncate">
                  {conversa.identificador || 'WhatsApp'}
                  {conversa.especialista?.nome ? ` · ${conversa.especialista.nome}` : ''}
                </div>
              </div>
              {emHandoff ? (
                <>
                  <Badge variant="warning" size="sm">Atendimento humano</Badge>
                  <Button variant="secondary" size="sm" icon={Undo2} loading={acaoHandoff} onClick={() => handoff('devolver')}>
                    Devolver ao bot
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="success" size="sm" icon={Bot}>Bot atendendo</Badge>
                  <Button variant="primary" size="sm" icon={UserCheck} loading={acaoHandoff} onClick={() => handoff('assumir')}>
                    Assumir
                  </Button>
                </>
              )}
            </header>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-[var(--bg-subtle)]/30">
              {carregandoThread && mensagens.length === 0 ? (
                <div className="text-center text-sm text-[var(--text-muted)] py-8">Carregando mensagens...</div>
              ) : mensagens.length === 0 ? (
                <div className="text-center text-sm text-[var(--text-muted)] py-8">Sem mensagens nesta conversa ainda.</div>
              ) : (
                mensagens.map((m) => <Bolha key={m.id} m={m} />)
              )}
              <div ref={fimRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[var(--border-main)] flex items-end gap-2 flex-shrink-0">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
                }}
                rows={1}
                placeholder="Digite uma mensagem... (Enter envia, Shift+Enter quebra linha)"
                className="flex-1 resize-none bg-[var(--bg-app)] text-[var(--text-main)] rounded-xl px-4 py-3 text-sm border border-[var(--border-main)] focus:outline-none focus:border-[var(--primary)] max-h-32 placeholder:text-[var(--text-muted)]"
              />
              <Button variant="primary" icon={Send} loading={enviando} disabled={!texto.trim()} onClick={enviar}>
                Enviar
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ConversaItem({ c, ativa, onClick }) {
  const espera = aguardandoHumano(c.estado);
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-[var(--border-subtle)] transition-colors',
        ativa ? 'bg-[var(--bg-subtle)]' : 'hover:bg-[var(--bg-subtle)]/60'
      )}
    >
      <Avatar name={nomeConversa(c)} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-main)] truncate flex-1">{nomeConversa(c)}</span>
          <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{fmtHora(c.ultimaMsgEm)}</span>
        </div>
        <div className="mt-0.5">
          {espera ? (
            <Badge variant="warning" size="sm">Aguardando humano</Badge>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)] truncate block">{c.identificador || 'WhatsApp'}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function Bolha({ m }) {
  const entrada = m.sentido === 'ENTRADA';
  const Icone = m.tipo && m.tipo !== 'TEXTO' ? ICONE_TIPO[m.tipo] : null;
  const autorLabel = !entrada
    ? (m.autor === 'BOT' ? 'Bot' : m.autor === 'VENDEDOR' ? 'Você' : m.autor === 'SISTEMA' ? 'Sistema' : '')
    : '';

  return (
    <div className={clsx('flex', entrada ? 'justify-start' : 'justify-end')}>
      <div className={clsx(
        'max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-[var(--shadow-xs,0_1px_2px_rgba(0,0,0,0.05))]',
        entrada
          ? 'bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-main)]'
          : 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
      )}>
        {autorLabel && (
          <div className="text-[10px] font-bold uppercase tracking-wide opacity-70 mb-0.5">{autorLabel}</div>
        )}
        {Icone && (
          <div className="inline-flex items-center gap-1 text-xs opacity-80 mb-1">
            <Icone size={13} /> {String(m.tipo).toLowerCase()}
          </div>
        )}
        {m.conteudo ? (
          <div className="whitespace-pre-wrap break-words">{m.conteudo}</div>
        ) : m.cifrado ? (
          <em className="opacity-60 text-xs">[mensagem protegida]</em>
        ) : null}
        <div className="text-[10px] opacity-60 text-right mt-0.5">{fmtHora(m.criadoEm)}</div>
      </div>
    </div>
  );
}
