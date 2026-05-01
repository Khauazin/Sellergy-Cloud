import { useEffect, useState } from 'react';
import { Trash2, Plus, MousePointer2, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Input, Select, Textarea, Button, IconButton, Switch, useToast } from '../ui';
import api from '../../services/api';
import { configDoTipo } from './catalogoNos';

const METODOS_HTTP = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function PainelPropriedades({ no, fluxoId, onAlterar, onExcluir }) {
  if (!no) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--text-muted)]">
        <MousePointer2 size={28} strokeWidth={1.5} className="opacity-50 mb-3" />
        <div className="text-sm">Selecione um no para editar.</div>
        <div className="text-xs mt-1">Arraste tipos da paleta para o canvas.</div>
      </div>
    );
  }

  const cfg = configDoTipo(no.data?.tipo);
  if (!cfg) return null;

  const Icone = cfg.icone;
  const setData = (mudancas) => {
    onAlterar({ ...no, data: { ...no.data, ...mudancas } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-main)]">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center flex-shrink-0">
          <Icone size={16} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {cfg.rotulo}
          </div>
          <div className="text-sm font-semibold text-[var(--text-main)] truncate">
            {no.data?.label || cfg.rotulo}
          </div>
        </div>
        <IconButton
          icon={Trash2}
          variant="danger"
          size="sm"
          ariaLabel="Excluir no"
          onClick={() => onExcluir(no.id)}
        />
      </div>

      <Input
        size="sm"
        label="Rotulo"
        value={no.data?.label || ''}
        onChange={(e) => setData({ label: e.target.value })}
        placeholder={cfg.rotulo}
      />

      {no.data?.tipo === 'HTTP_REQUEST' && <FormHttp data={no.data} setData={setData} />}
      {no.data?.tipo === 'IF' && <FormIf data={no.data} setData={setData} />}
      {no.data?.tipo === 'SET' && <FormSet data={no.data} setData={setData} />}
      {no.data?.tipo === 'CODE' && <FormCode data={no.data} setData={setData} />}
      {no.data?.tipo === 'MANUAL' && (
        <p className="text-xs text-[var(--text-muted)]">
          Trigger manual nao tem configuracao adicional. Conecte a saida ao primeiro no do fluxo.
        </p>
      )}
      {no.data?.tipo === 'WEBHOOK' && <FormWebhook noId={no.id} fluxoId={fluxoId} />}
      {no.data?.tipo === 'SCHEDULE' && <FormSchedule noId={no.id} fluxoId={fluxoId} />}
    </div>
  );
}

function FormHttp({ data, setData }) {
  const cabecalhos = data?.cabecalhos || [];

  const setCab = (i, campo, valor) => {
    setData({
      cabecalhos: cabecalhos.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)),
    });
  };

  return (
    <>
      <Select
        size="sm"
        label="Metodo"
        value={data?.metodo || 'GET'}
        onChange={(e) => setData({ metodo: e.target.value })}
        options={METODOS_HTTP.map((m) => ({ value: m, label: m }))}
        placeholder=""
      />
      <Input
        size="sm"
        label="URL"
        placeholder="https://api.exemplo.com/recurso"
        value={data?.url || ''}
        onChange={(e) => setData({ url: e.target.value })}
      />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
            Cabecalhos
          </label>
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => setData({ cabecalhos: [...cabecalhos, { chave: '', valor: '' }] })}
          >
            Adicionar
          </Button>
        </div>
        <div className="space-y-1.5">
          {cabecalhos.length === 0 && (
            <p className="text-[11px] text-[var(--text-muted)]">Nenhum cabecalho.</p>
          )}
          {cabecalhos.map((c, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                size="sm"
                placeholder="Chave"
                value={c.chave || ''}
                onChange={(e) => setCab(i, 'chave', e.target.value)}
              />
              <Input
                size="sm"
                placeholder="Valor"
                value={c.valor || ''}
                onChange={(e) => setCab(i, 'valor', e.target.value)}
              />
              <IconButton
                icon={Trash2}
                variant="danger"
                size="sm"
                ariaLabel="Remover cabecalho"
                onClick={() =>
                  setData({ cabecalhos: cabecalhos.filter((_, idx) => idx !== i) })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <Textarea
        label="Corpo (JSON ou texto)"
        rows={4}
        value={data?.corpo || ''}
        onChange={(e) => setData({ corpo: e.target.value })}
        placeholder='{"chave": "valor"}'
      />

      <Input
        size="sm"
        label="Timeout (ms)"
        type="number"
        min={1000}
        max={120000}
        step={1000}
        value={data?.timeoutMs ?? 10000}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          setData({ timeoutMs: Number.isFinite(n) ? n : 10000 });
        }}
        hint="Entre 1000 e 120000."
      />
    </>
  );
}

function FormIf({ data, setData }) {
  return (
    <Textarea
      label="Condicao (expressao)"
      rows={3}
      placeholder="ex.: {{entrada.status}} === 200"
      value={data?.condicao || ''}
      onChange={(e) => setData({ condicao: e.target.value })}
      hint="Avaliada em runtime. Saidas: verdadeiro / falso."
    />
  );
}

function FormSet({ data, setData }) {
  const ats = data?.atribuicoes || [];
  const setAtr = (i, campo, valor) => {
    setData({
      atribuicoes: ats.map((x, idx) => (idx === i ? { ...x, [campo]: valor } : x)),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
          Atribuicoes
        </label>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          onClick={() => setData({ atribuicoes: [...ats, { chave: '', valor: '' }] })}
        >
          Adicionar
        </Button>
      </div>
      <div className="space-y-1.5">
        {ats.length === 0 && (
          <p className="text-[11px] text-[var(--text-muted)]">Nenhuma atribuicao.</p>
        )}
        {ats.map((a, i) => (
          <div key={i} className="flex gap-1.5">
            <Input
              size="sm"
              placeholder="chave"
              value={a.chave || ''}
              onChange={(e) => setAtr(i, 'chave', e.target.value)}
            />
            <Input
              size="sm"
              placeholder="valor"
              value={a.valor || ''}
              onChange={(e) => setAtr(i, 'valor', e.target.value)}
            />
            <IconButton
              icon={Trash2}
              variant="danger"
              size="sm"
              ariaLabel="Remover atribuicao"
              onClick={() => setData({ atribuicoes: ats.filter((_, idx) => idx !== i) })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FormCode({ data, setData }) {
  return (
    <Textarea
      label="Codigo JavaScript"
      rows={10}
      placeholder="return entrada;"
      value={data?.codigo || ''}
      onChange={(e) => setData({ codigo: e.target.value })}
      hint="Sandbox via isolated-vm (Sub-fase 1.3). Use a variavel `entrada`."
      className="font-mono"
    />
  );
}

const FUSOS_COMUNS = [
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (BRT)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon (WET)' },
  { value: 'UTC', label: 'UTC' },
];

const EXEMPLOS_CRON = [
  { expr: '*/5 * * * *', label: 'A cada 5 min' },
  { expr: '0 * * * *', label: 'A cada hora cheia' },
  { expr: '0 8 * * *', label: 'Todo dia as 08:00' },
  { expr: '0 9 * * 1-5', label: 'Seg-Sex as 09:00' },
  { expr: '0 0 1 * *', label: 'Dia 1 do mes' },
];

function FormSchedule({ noId, fluxoId }) {
  const toast = useToast();
  const [agendamento, setAgendamento] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [expressaoCron, setExpressaoCron] = useState('0 8 * * *');
  const [fusoHorario, setFusoHorario] = useState('America/Sao_Paulo');

  useEffect(() => {
    if (!noId) return;
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on noId change
    setCarregando(true);
    api
      .get(`/agendamentos-admin/no/${noId}`)
      .then((r) => {
        if (!ativo) return;
        setAgendamento(r.data);
        setExpressaoCron(r.data.expressaoCron);
        setFusoHorario(r.data.fusoHorario);
      })
      .catch((e) => { if (ativo && e.response?.status === 404) setAgendamento(null); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [noId]);

  const criar = async () => {
    if (!fluxoId) {
      toast.error('Salve o fluxo antes de criar o agendamento.');
      return;
    }
    setAcaoEmCurso(true);
    try {
      const r = await api.post(`/agendamentos-admin/fluxo/${fluxoId}`, {
        noId,
        expressaoCron: expressaoCron.trim(),
        fusoHorario,
      });
      setAgendamento(r.data);
      toast.success('Agendamento criado.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao criar agendamento.');
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const atualizar = async (mudancas) => {
    if (!agendamento) return;
    try {
      const r = await api.patch(`/agendamentos-admin/${agendamento.id}`, mudancas);
      setAgendamento(r.data);
      setExpressaoCron(r.data.expressaoCron);
      setFusoHorario(r.data.fusoHorario);
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao atualizar.');
    }
  };

  const salvarExpressao = async () => {
    if (!agendamento) return;
    setAcaoEmCurso(true);
    try {
      await atualizar({ expressaoCron: expressaoCron.trim(), fusoHorario });
      toast.success('Agendamento atualizado.');
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const excluir = async () => {
    if (!agendamento) return;
    if (!window.confirm('Excluir agendamento? O fluxo deixa de disparar nos horarios programados.')) return;
    setAcaoEmCurso(true);
    try {
      await api.delete(`/agendamentos-admin/${agendamento.id}`);
      setAgendamento(null);
      toast.success('Agendamento excluido.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao excluir.');
    } finally {
      setAcaoEmCurso(false);
    }
  };

  if (carregando) {
    return <p className="text-xs text-[var(--text-muted)]">Carregando agendamento...</p>;
  }

  const sujo = agendamento && (agendamento.expressaoCron !== expressaoCron.trim() || agendamento.fusoHorario !== fusoHorario);

  return (
    <div className="space-y-3">
      <Input
        size="sm"
        label="Expressao cron"
        value={expressaoCron}
        onChange={(e) => setExpressaoCron(e.target.value)}
        placeholder="0 8 * * *"
        className="font-mono"
        hint="Formato padrao de cron (5 campos): minuto hora dia-mes mes dia-semana."
      />

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
          Atalhos
        </div>
        <div className="flex flex-wrap gap-1">
          {EXEMPLOS_CRON.map((ex) => (
            <button
              key={ex.expr}
              type="button"
              onClick={() => setExpressaoCron(ex.expr)}
              className="text-[10px] px-2 py-1 rounded-md border border-[var(--border-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <Select
        size="sm"
        label="Fuso horario"
        value={fusoHorario}
        onChange={(e) => setFusoHorario(e.target.value)}
        options={FUSOS_COMUNS}
        placeholder=""
      />

      {!agendamento && (
        <Button size="sm" variant="accent" onClick={criar} loading={acaoEmCurso} disabled={!fluxoId}>
          Criar agendamento
        </Button>
      )}

      {agendamento && (
        <>
          {sujo && (
            <Button size="sm" variant="primary" onClick={salvarExpressao} loading={acaoEmCurso}>
              Salvar alteracao
            </Button>
          )}
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--border-main)]">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--text-main)]">Ativo</div>
              <div className="text-[10px] text-[var(--text-muted)]">Quando inativo o cron fica suspenso.</div>
            </div>
            <Switch checked={agendamento.ativo} onChange={(v) => atualizar({ ativo: v })} />
          </div>

          <div className="text-[11px] text-[var(--text-muted)]">
            {agendamento.proximoDisparoEm && (
              <div>Proximo: {new Date(agendamento.proximoDisparoEm).toLocaleString('pt-BR')}</div>
            )}
            {agendamento.ultimoDisparoEm && (
              <div>Ultimo: {new Date(agendamento.ultimoDisparoEm).toLocaleString('pt-BR')}</div>
            )}
            <div>{agendamento.totalDisparos} disparo{agendamento.totalDisparos === 1 ? '' : 's'} no total.</div>
          </div>

          <Button size="sm" variant="danger-soft" onClick={excluir} loading={acaoEmCurso}>
            Excluir agendamento
          </Button>
        </>
      )}
    </div>
  );
}

function FormWebhook({ noId, fluxoId }) {
  const toast = useToast();
  const [webhook, setWebhook] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [revelarSegredo, setRevelarSegredo] = useState(false);

  useEffect(() => {
    if (!noId) return;
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on noId change
    setCarregando(true);
    api
      .get(`/webhooks-admin/no/${noId}`)
      .then((r) => { if (ativo) setWebhook(r.data); })
      .catch((e) => { if (ativo) setWebhook(e.response?.status === 404 ? null : null); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [noId]);

  const urlPublica = webhook
    ? `${api.defaults.baseURL?.replace(/\/$/, '') || ''}/webhooks/${webhook.id}`
    : '';

  const gerar = async () => {
    if (!fluxoId) {
      toast.error('Salve o fluxo antes de gerar o webhook.');
      return;
    }
    setAcaoEmCurso(true);
    try {
      const r = await api.post(`/webhooks-admin/fluxo/${fluxoId}`, { noId });
      setWebhook(r.data);
      toast.success('Webhook gerado.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao gerar webhook.');
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const regenerarSegredo = async () => {
    if (!webhook) return;
    if (!window.confirm('Regenerar o segredo invalida assinaturas anteriores. Continuar?')) return;
    setAcaoEmCurso(true);
    try {
      const r = await api.post(`/webhooks-admin/${webhook.id}/regenerar-segredo`);
      setWebhook(r.data);
      toast.success('Segredo regenerado.');
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao regenerar segredo.');
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const alternarCampo = async (campo, valor) => {
    if (!webhook) return;
    try {
      const r = await api.patch(`/webhooks-admin/${webhook.id}`, { [campo]: valor });
      setWebhook(r.data);
    } catch (erro) {
      toast.error(erro.response?.data?.erro || 'Falha ao atualizar.');
    }
  };

  const copiar = (texto, label) => {
    navigator.clipboard?.writeText(texto).then(
      () => toast.success(`${label} copiado.`),
      () => toast.error('Falha ao copiar.')
    );
  };

  if (carregando) {
    return <p className="text-xs text-[var(--text-muted)]">Carregando webhook...</p>;
  }

  if (!webhook) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-[var(--text-muted)]">
          Este no ainda nao tem URL publica. Salve o fluxo e gere o webhook para receber chamadas.
        </p>
        <Button size="sm" variant="accent" onClick={gerar} loading={acaoEmCurso} disabled={!fluxoId}>
          Gerar URL publica
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
          URL publica (POST)
        </label>
        <div className="flex gap-1.5">
          <Input size="sm" value={urlPublica} readOnly />
          <IconButton icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar URL" onClick={() => copiar(urlPublica, 'URL')} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)] mb-1.5">
          Segredo (HMAC SHA-256)
        </label>
        <div className="flex gap-1.5">
          <Input
            size="sm"
            type={revelarSegredo ? 'text' : 'password'}
            value={webhook.segredo}
            readOnly
          />
          <IconButton
            icon={revelarSegredo ? EyeOff : Eye}
            variant="secondary"
            size="sm"
            ariaLabel="Mostrar/ocultar segredo"
            onClick={() => setRevelarSegredo((v) => !v)}
          />
          <IconButton icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar segredo" onClick={() => copiar(webhook.segredo, 'Segredo')} />
          <IconButton
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            ariaLabel="Regenerar segredo"
            onClick={regenerarSegredo}
          />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1">
          Header: <code className="font-mono">X-Webhook-Signature: sha256=&lt;hex&gt;</code>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--border-main)]">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[var(--text-main)]">Ativo</div>
          <div className="text-[10px] text-[var(--text-muted)]">Quando inativo a URL retorna 404.</div>
        </div>
        <Switch checked={webhook.ativo} onChange={(v) => alternarCampo('ativo', v)} />
      </div>

      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-[var(--border-main)]">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[var(--text-main)]">Exigir HMAC</div>
          <div className="text-[10px] text-[var(--text-muted)]">Recusa chamadas sem assinatura valida.</div>
        </div>
        <Switch checked={webhook.exigirHmac} onChange={(v) => alternarCampo('exigirHmac', v)} />
      </div>

      <div className="text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-main)]">
        {webhook.totalChamadas} chamada{webhook.totalChamadas === 1 ? '' : 's'}
        {webhook.ultimaChamadaEm && ` · ultima ${new Date(webhook.ultimaChamadaEm).toLocaleString('pt-BR')}`}
      </div>
    </div>
  );
}
