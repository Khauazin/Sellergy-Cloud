import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Bot as BotIcon, MessageCircle, Copy, RefreshCw, Lock, AlertCircle,
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, Button, Input, Select, Badge, IconButton, useToast,
} from '../components/ui';
import api, { urlPublica } from '../services/api';
import credenciaisService from '../services/credenciaisService';

function gerarVerifyToken() {
  // 32 chars hex pseudo-aleatorios — suficiente como verify token publico.
  let s = '';
  const arr = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  for (const b of arr) s += b.toString(16).padStart(2, '0');
  return s;
}

export default function BotCanalPage() {
  const { botId } = useParams();
  const toast = useToast();

  const [bot, setBot] = useState(null);
  const [credenciais, setCredenciais] = useState([]);
  const [fluxos, setFluxos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [registrandoTelegram, setRegistrandoTelegram] = useState(false);

  const [form, setForm] = useState({
    canal: 'WHATSAPP',
    credencialCanalId: '',
    identificadorCanal: '',
    verifyTokenCanal: '',
    fluxoPadraoId: '',
  });

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    setCarregando(true);
    Promise.all([
      api.get(`/bots/${botId}`).catch(() => ({ data: null })),
      credenciaisService.listar().catch(() => []),
      api.get(`/builder/fluxos/${botId}`).catch(() => ({ data: [] })),
    ])
      .then(([respBot, listaCreds, respFluxos]) => {
        if (!ativo) return;
        const b = respBot.data;
        setBot(b);
        setCredenciais(listaCreds || []);
        setFluxos(Array.isArray(respFluxos.data) ? respFluxos.data : []);
        if (b) {
          setForm({
            canal: b.canal || 'WHATSAPP',
            credencialCanalId: b.credencialCanalId || '',
            identificadorCanal: b.identificadorCanal || '',
            verifyTokenCanal: b.verifyTokenCanal || '',
            fluxoPadraoId: b.fluxoPadraoId || '',
          });
        }
      })
      .finally(() => ativo && setCarregando(false));
    return () => { ativo = false; };
  }, [botId]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const body = {
        canal: form.canal,
        credencialCanalId: form.credencialCanalId || null,
        identificadorCanal: form.identificadorCanal.trim() || null,
        verifyTokenCanal: form.verifyTokenCanal.trim() || null,
        fluxoPadraoId: form.fluxoPadraoId || null,
      };
      const r = await api.patch(`/bots/${botId}/canal`, body);
      setBot(r.data);
      toast.success('Configuracao do canal salva.');
    } catch (e) {
      toast.error(e.response?.data?.erro || e.response?.data?.error || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const copiar = (texto, label) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error('Falha ao copiar.'),
    );
  };

  if (carregando) {
    return <div className="text-sm text-[var(--text-muted)]">Carregando...</div>;
  }

  const credenciaisDoCanal = credenciais.filter((c) =>
    form.canal === 'WHATSAPP' ? c.tipo === 'WHATSAPP_CLOUD_TOKEN' :
    form.canal === 'TELEGRAM' ? c.tipo === 'TELEGRAM_BOT_TOKEN' : true
  );

  const urlReceiver = form.canal === 'WHATSAPP'
    ? `${urlPublica()}/canais/whatsapp/${botId}`
    : form.canal === 'TELEGRAM'
      ? `${urlPublica()}/canais/telegram/${botId}`
      : null;

  // Detecta se o form tem mudancas nao salvas. Comparamos string-vazio
  // com null porque Select retorna '' quando nada esta selecionado e o
  // banco guarda null quando nao configurado.
  const formNaoSalvo = !!bot && (
    (bot.canal || '') !== (form.canal || '') ||
    (bot.credencialCanalId || '') !== (form.credencialCanalId || '') ||
    (bot.verifyTokenCanal || '') !== (form.verifyTokenCanal || '') ||
    (bot.identificadorCanal || '') !== (form.identificadorCanal || '') ||
    (bot.fluxoPadraoId || '') !== (form.fluxoPadraoId || '')
  );

  const registrarWebhookTelegram = async () => {
    if (!form.verifyTokenCanal?.trim()) {
      toast.error('Gere e salve o Verify Token antes de registrar o webhook.');
      return;
    }
    if (!form.credencialCanalId) {
      toast.error('Selecione uma credencial TELEGRAM_BOT_TOKEN antes.');
      return;
    }
    setRegistrandoTelegram(true);
    try {
      const r = await api.post(`/bots/${botId}/canal/telegram/registrar-webhook`, {
        urlPublica: urlPublica(),
      });
      toast.success(`Webhook registrado: ${r.data?.urlWebhook || 'ok'}`);
    } catch (e) {
      toast.error(e.response?.data?.erro || 'Falha ao registrar webhook no Telegram.');
    } finally {
      setRegistrandoTelegram(false);
    }
  };

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-center gap-3">
        <Link to="/admin/bots">
          <Button variant="ghost" icon={ArrowLeft} size="sm">Voltar para bots</Button>
        </Link>
        <div className="flex-1" />
        <Button variant="primary" icon={Save} loading={salvando} onClick={salvar}>
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
          <Badge variant="neutral" size="sm" icon={MessageCircle}>{form.canal}</Badge>
        </div>
      </Card>

      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Configuracao do canal</CardTitle>
            <CardDescription>
              Vincule este bot a um canal externo (WhatsApp, Telegram). Mensagens entrantes
              disparam o fluxo padrao escolhido. Respostas saem com a credencial vinculada.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="space-y-4">
          <Select
            label="Canal"
            value={form.canal}
            onChange={(e) => setForm({ ...form, canal: e.target.value, credencialCanalId: '' })}
            options={[
              { value: 'WHATSAPP', label: 'WhatsApp Cloud API' },
              { value: 'TELEGRAM', label: 'Telegram Bot API' },
              { value: 'WEBSITE', label: 'Website (custom)' },
              { value: 'INSTAGRAM', label: 'Instagram (em breve)' },
            ]}
            placeholder=""
          />

          <Select
            label="Credencial do canal"
            value={form.credencialCanalId}
            onChange={(e) => setForm({ ...form, credencialCanalId: e.target.value })}
            options={credenciaisDoCanal.map((c) => ({ value: c.id, label: `${c.nome} · ${c.tipo}` }))}
            placeholder={
              credenciaisDoCanal.length === 0
                ? `— Nenhuma credencial ${form.canal} cadastrada —`
                : '— Selecione uma credencial —'
            }
            hint={
              credenciaisDoCanal.length === 0
                ? `Crie em Configuracoes > Credenciais (tipo ${form.canal === 'TELEGRAM' ? 'TELEGRAM_BOT_TOKEN' : 'WHATSAPP_CLOUD_TOKEN'}).`
                : undefined
            }
          />

          {form.canal === 'WHATSAPP' && (
            <Input
              label="Phone Number ID (opcional)"
              value={form.identificadorCanal}
              onChange={(e) => setForm({ ...form, identificadorCanal: e.target.value })}
              placeholder="Pode vir tambem da credencial"
              hint="Se a credencial ja contem phoneNumberId, deixe vazio."
            />
          )}

          <Select
            label="Fluxo padrao (disparado a cada mensagem entrante)"
            value={form.fluxoPadraoId}
            onChange={(e) => setForm({ ...form, fluxoPadraoId: e.target.value })}
            options={fluxos.map((f) => ({ value: f.id, label: f.nome }))}
            placeholder={
              fluxos.length === 0
                ? '— Nenhum fluxo cadastrado para este bot —'
                : '— Sem fluxo padrao —'
            }
            hint="O fluxo deve comecar com no MANUAL ou WEBHOOK."
          />
        </div>
      </Card>

      {form.canal === 'TELEGRAM' && (
        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle>Webhook publico do Telegram</CardTitle>
              <CardDescription>
                Diferente do WhatsApp, o Telegram nao tem painel: o webhook eh registrado
                via API. Salve a configuracao primeiro, depois clique em "Registrar webhook".
              </CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
                Callback URL (registrada automaticamente)
              </label>
              <div className="flex gap-1.5">
                <Input value={urlReceiver || ''} readOnly />
                <IconButton
                  icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar URL"
                  onClick={() => copiar(urlReceiver, 'URL')}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Telegram exige HTTPS publico. Use ngrok/cloudflared em dev.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
                Secret Token
              </label>
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  value={form.verifyTokenCanal}
                  onChange={(e) => setForm({ ...form, verifyTokenCanal: e.target.value })}
                  placeholder="Gerar e salvar antes de registrar"
                />
                <IconButton
                  icon={RefreshCw} variant="secondary" size="sm" ariaLabel="Gerar novo"
                  onClick={() => setForm({ ...form, verifyTokenCanal: gerarVerifyToken() })}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                <Lock size={10} className="inline" /> Telegram envia esse token no header
                <code className="font-mono"> X-Telegram-Bot-Api-Secret-Token</code> em cada request.
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)] text-xs leading-snug">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                Fluxo: <b>1.</b> Crie credencial <code className="font-mono">TELEGRAM_BOT_TOKEN</code> (token do @BotFather)
                {' '}<b>2.</b> Selecione ela acima <b>3.</b> Gere o secret e clique em <b>Salvar</b>
                {' '}<b>4.</b> Clique em "Registrar webhook" abaixo.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {formNaoSalvo && (
                <span className="text-[11px] text-[var(--warning-text,#b45309)]">
                  Salve as alteracoes antes de registrar.
                </span>
              )}
              <Button
                variant="primary"
                onClick={registrarWebhookTelegram}
                loading={registrandoTelegram}
                disabled={!form.credencialCanalId || !form.verifyTokenCanal || formNaoSalvo}
              >
                Registrar webhook na Telegram API
              </Button>
            </div>
          </div>
        </Card>
      )}

      {form.canal === 'WHATSAPP' && (
        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle>Webhook publico do WhatsApp</CardTitle>
              <CardDescription>
                Use estes valores no painel da Meta (Configuracao do app, secao Webhooks).
              </CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
                Callback URL
              </label>
              <div className="flex gap-1.5">
                <Input value={urlReceiver || ''} readOnly />
                <IconButton
                  icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar URL"
                  onClick={() => copiar(urlReceiver, 'URL')}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Em producao precisa ser HTTPS publico. Use ngrok/cloudflared em dev.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
                Verify Token
              </label>
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  value={form.verifyTokenCanal}
                  onChange={(e) => setForm({ ...form, verifyTokenCanal: e.target.value })}
                  placeholder="Defina um valor secreto para a verificacao da Meta"
                />
                <IconButton
                  icon={RefreshCw} variant="secondary" size="sm" ariaLabel="Gerar novo"
                  onClick={() => setForm({ ...form, verifyTokenCanal: gerarVerifyToken() })}
                />
                <IconButton
                  icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar token"
                  onClick={() => copiar(form.verifyTokenCanal, 'Verify token')}
                />
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                <Lock size={10} className="inline" /> Cole exatamente o mesmo no painel da Meta.
              </p>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--info-soft)] text-[var(--info-text)] text-xs leading-snug">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                Webhook fields a marcar na Meta: <code className="font-mono">messages</code>.
                A Meta envia GET de verificacao primeiro. Depois envia POST a cada mensagem
                entrante (mensagens fluem em segundos).
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
