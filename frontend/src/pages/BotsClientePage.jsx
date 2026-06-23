import { useEffect, useState } from 'react';
import { Bot as BotIcon, MessageCircle, Plus, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Select, Badge, EmptyState, useToast,
} from '../components/ui';
import api from '../services/api';
import credenciaisService from '../services/credenciaisService';
import faqService from '../services/faqService';

// Tela do tenant pro bot WhatsApp (pos-pivo, sem IA): conexao do canal +
// gestao da FAQ do atendimento automatico (menu fixo). Substitui o placeholder.
const TIPO_CRED_WHATSAPP = 'WHATSAPP_CLOUD_TOKEN';

function gerarVerifyToken() {
  let s = '';
  const arr = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  for (const b of arr) s += b.toString(16).padStart(2, '0');
  return s;
}

export default function BotsClientePage() {
  const toast = useToast();
  const [bot, setBot] = useState(null);
  const [credenciais, setCredenciais] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoCanal, setSalvandoCanal] = useState(false);
  const [conexao, setConexao] = useState({ credencialCanalId: '', identificadorCanal: '', verifyTokenCanal: '' });
  const [novaFaq, setNovaFaq] = useState({ pergunta: '', resposta: '' });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [bots, creds, listaFaq] = await Promise.all([
        api.get('/bots').then((r) => r.data).catch(() => []),
        credenciaisService.listar().catch(() => []),
        faqService.listar().catch(() => []),
      ]);
      const b = Array.isArray(bots) ? bots[0] : null;
      setBot(b || null);
      setCredenciais(creds || []);
      setFaqs(listaFaq || []);
      if (b) {
        setConexao({
          credencialCanalId: b.credencialCanalId || '',
          identificadorCanal: b.identificadorCanal || '',
          verifyTokenCanal: b.verifyTokenCanal || '',
        });
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    carregar();
  }, []);

  const credsWhatsapp = credenciais.filter((c) => c.tipo === TIPO_CRED_WHATSAPP);
  const online = bot?.status === 'ONLINE';

  const criarBot = async () => {
    try {
      const r = await api.post('/bots', { nome: 'WhatsApp', canal: 'WHATSAPP' });
      setBot(r.data);
      toast.success('Bot criado. Configure a conexao abaixo.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao criar bot.');
    }
  };

  const salvarCanal = async () => {
    if (!bot) return;
    setSalvandoCanal(true);
    try {
      const r = await api.patch(`/bots/${bot.id}/canal`, {
        canal: 'WHATSAPP',
        credencialCanalId: conexao.credencialCanalId || null,
        identificadorCanal: conexao.identificadorCanal.trim() || null,
        verifyTokenCanal: conexao.verifyTokenCanal.trim() || null,
      });
      setBot((b) => ({ ...b, ...r.data }));
      toast.success('Conexao salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao salvar conexao.');
    } finally {
      setSalvandoCanal(false);
    }
  };

  const alternarStatus = async () => {
    if (!bot) return;
    const novo = online ? 'OFFLINE' : 'ONLINE';
    try {
      const r = await api.patch(`/bots/${bot.id}/status`, { status: novo });
      setBot((b) => ({ ...b, ...r.data }));
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao mudar status.');
    }
  };

  const adicionarFaq = async () => {
    if (!novaFaq.pergunta.trim() || !novaFaq.resposta.trim()) return toast.error('Preencha pergunta e resposta.');
    try {
      const f = await faqService.criar({ pergunta: novaFaq.pergunta, resposta: novaFaq.resposta, ordem: faqs.length });
      setFaqs((l) => [...l, f]);
      setNovaFaq({ pergunta: '', resposta: '' });
      toast.success('Pergunta adicionada.');
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao adicionar.');
    }
  };

  const alternarFaqAtivo = async (f) => {
    try {
      const at = await faqService.atualizar(f.id, { ativo: !f.ativo });
      setFaqs((l) => l.map((x) => (x.id === f.id ? at : x)));
    } catch {
      toast.error('Falha ao atualizar.');
    }
  };

  const excluirFaq = async (f) => {
    if (!window.confirm(`Excluir "${f.pergunta}"?`)) return;
    try {
      await faqService.excluir(f.id);
      setFaqs((l) => l.filter((x) => x.id !== f.id));
    } catch {
      toast.error('Falha ao excluir.');
    }
  };

  if (carregando) {
    return <div className="text-sm text-[var(--text-muted)] py-10 text-center">Carregando...</div>;
  }

  return (
    <div className="space-y-5 max-w-[1000px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-main)]">Bot WhatsApp</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Conecte seu numero do WhatsApp e configure o atendimento automatico por menu (sem IA):
          o bot responde com base nas perguntas e respostas abaixo.
        </p>
      </div>

      {!bot ? (
        <Card padding="md">
          <EmptyState
            icon={BotIcon}
            title="Nenhum bot ainda"
            description="Crie o bot do seu WhatsApp para comecar a configurar a conexao e o atendimento."
            action={<Button variant="accent" icon={Plus} onClick={criarBot}>Criar bot</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Conexao */}
          <Card padding="md">
            <CardHeader>
              <div>
                <CardTitle>Conexao do WhatsApp</CardTitle>
                <CardDescription>Numero (phoneNumberId), verify token e a credencial do canal.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={online ? 'success' : 'neutral'} size="sm">
                  {online ? <Wifi size={12} /> : <WifiOff size={12} />} {online ? 'Online' : 'Offline'}
                </Badge>
                <Button variant={online ? 'secondary' : 'accent'} size="sm" onClick={alternarStatus}>
                  {online ? 'Desligar' : 'Ligar'}
                </Button>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="phoneNumberId"
                value={conexao.identificadorCanal}
                onChange={(e) => setConexao({ ...conexao, identificadorCanal: e.target.value })}
                placeholder="Ex: 123456789012345"
              />
              <Select
                label="Credencial (token do canal)"
                value={conexao.credencialCanalId}
                onChange={(e) => setConexao({ ...conexao, credencialCanalId: e.target.value })}
                options={[
                  { value: '', label: credsWhatsapp.length ? 'Selecione...' : 'Nenhuma credencial WhatsApp' },
                  ...credsWhatsapp.map((c) => ({ value: c.id, label: c.nome })),
                ]}
              />
            </div>

            <div className="mt-4">
              <Input
                label="Verify token"
                value={conexao.verifyTokenCanal}
                onChange={(e) => setConexao({ ...conexao, verifyTokenCanal: e.target.value })}
                placeholder="Use no painel da Meta ao configurar o webhook"
              />
              <button
                type="button"
                className="text-xs text-[var(--accent)] mt-1 hover:underline"
                onClick={() => setConexao({ ...conexao, verifyTokenCanal: gerarVerifyToken() })}
              >
                Gerar verify token
              </button>
            </div>

            <div className="flex justify-end mt-5">
              <Button variant="accent" onClick={salvarCanal} loading={salvandoCanal}>Salvar conexao</Button>
            </div>
          </Card>

          {/* FAQ / atendimento */}
          <Card padding="md">
            <CardHeader>
              <div>
                <CardTitle>Atendimento automatico (FAQ)</CardTitle>
                <CardDescription>Perguntas e respostas que viram o menu do bot. Sem IA.</CardDescription>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <Input
                label="Pergunta"
                value={novaFaq.pergunta}
                onChange={(e) => setNovaFaq({ ...novaFaq, pergunta: e.target.value })}
                placeholder="Ex: Qual o horario?"
              />
              <Input
                label="Resposta"
                value={novaFaq.resposta}
                onChange={(e) => setNovaFaq({ ...novaFaq, resposta: e.target.value })}
                placeholder="Ex: Seg a Sex, 9h as 18h."
              />
              <Button variant="secondary" icon={Plus} onClick={adicionarFaq}>Adicionar</Button>
            </div>

            {faqs.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={MessageCircle}
                  title="Sem perguntas ainda"
                  description="Adicione a primeira pergunta para o bot comecar a responder."
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)] mt-4">
                {faqs.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[var(--text-main)]">{f.pergunta}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{f.resposta}</div>
                    </div>
                    <button
                      type="button"
                      className="text-xs hover:underline"
                      onClick={() => alternarFaqAtivo(f)}
                    >
                      <Badge variant={f.ativo ? 'success' : 'neutral'} size="sm">{f.ativo ? 'Ativa' : 'Inativa'}</Badge>
                    </button>
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => excluirFaq(f)}>Excluir</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
