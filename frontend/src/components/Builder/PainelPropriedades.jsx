import { useEffect, useState } from 'react';
import { Trash2, Plus, MousePointer2, Copy, Eye, EyeOff, RefreshCw, Lock } from 'lucide-react';
import { Input, Select, Textarea, Button, IconButton, Switch, useToast } from '../ui';
import api, { urlPublica } from '../../services/api';
import credenciaisService from '../../services/credenciaisService';
import { configDoTipo } from './catalogoNos';

// Credenciais que fazem sentido em HTTP Request — HTTP_* genericas + LLMs
// (que tambem injetam Authorization). Canais (WhatsApp/Telegram) tem fluxo
// proprio em outros nos.
const TIPOS_CREDENCIAL_HTTP = new Set([
  'HTTP_BEARER',
  'HTTP_BASIC',
  'HTTP_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
]);

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
      {no.data?.tipo === 'AI_AGENT' && <FormAiAgent data={no.data} setData={setData} />}
      {no.data?.tipo === 'ENVIAR_MENSAGEM' && <FormEnviarMensagem data={no.data} setData={setData} />}
      {no.data?.tipo === 'SET_ESTADO_CONVERSA' && <FormSetEstadoConversa data={no.data} setData={setData} />}
      {no.data?.tipo === 'TOOL' && <FormTool data={no.data} setData={setData} />}
      {no.data?.tipo === 'SWITCH' && <FormSwitch data={no.data} setData={setData} />}
    </div>
  );
}

function FormEnviarMensagem({ data, setData }) {
  return (
    <>
      <Textarea
        size="sm"
        label="Texto da mensagem"
        rows={4}
        value={data?.texto || ''}
        onChange={(e) => setData({ texto: e.target.value })}
        placeholder="Recebi sua mensagem: {{dadosGatilho.texto}}"
        hint='Suporta {{caminho.dot}}. Exemplos: {{dadosGatilho.texto}}, {{dadosGatilho.nome}}, {{dadosGatilho.telefone}}, {{entrada.qualquerCoisa}}.'
      />
      <Input
        size="sm"
        label="Conversa ID (opcional)"
        value={data?.conversaId || ''}
        onChange={(e) => setData({ conversaId: e.target.value })}
        placeholder="Deixe vazio pra usar o gatilho do webhook"
        hint="Por padrao usa a conversa que disparou o fluxo. So preencha se quiser mandar pra outra."
      />
      <p className="text-[10px] text-[var(--text-muted)] leading-snug">
        Envia pelo canal vinculado ao bot (WhatsApp/Telegram). A credencial e o destinatario sao resolvidos automaticamente a partir da conversa.
      </p>
    </>
  );
}

function FormHttp({ data, setData }) {
  const cabecalhos = data?.cabecalhos || [];
  const [credenciais, setCredenciais] = useState([]);

  useEffect(() => {
    let ativo = true;
    credenciaisService
      .listar()
      .then((lista) => {
        if (!ativo) return;
        setCredenciais((lista || []).filter((c) => TIPOS_CREDENCIAL_HTTP.has(c.tipo)));
      })
      .catch(() => ativo && setCredenciais([]));
    return () => { ativo = false; };
  }, []);

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

      <Select
        size="sm"
        label="Credencial (opcional)"
        value={data?.credencialId || ''}
        onChange={(e) => setData({ credencialId: e.target.value || null })}
        options={credenciais.map((c) => ({ value: c.id, label: `${c.nome} · ${c.tipo}` }))}
        placeholder="— Sem credencial —"
        hint={
          credenciais.length === 0
            ? 'Nenhuma credencial HTTP cadastrada. Crie em Configuracoes > Credenciais.'
            : 'Injetada como header Authorization no momento da execucao (cifragem just-in-time).'
        }
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

function FormSetEstadoConversa({ data, setData }) {
  const ats = data?.atribuicoes || [];
  const setAtr = (i, campo, valor) => {
    setData({
      atribuicoes: ats.map((x, idx) => (idx === i ? { ...x, [campo]: valor } : x)),
    });
  };

  return (
    <>
      <div className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-lg p-2.5 leading-snug border border-[var(--border-main)]">
        Salva variaveis na conversa pra fluxos multi-turno. O proximo disparo
        do fluxo (proxima mensagem do usuario) recebe esse estado em
        <code className="ml-1">{`{{dadosGatilho.estado.*}}`}</code>.
      </div>

      <Select
        size="sm"
        label="Estrategia"
        value={data?.estrategia || 'MERGE'}
        onChange={(e) => setData({ estrategia: e.target.value })}
        options={[
          { value: 'MERGE', label: 'Merge (sobrescreve so as chaves passadas)' },
          { value: 'SUBSTITUIR', label: 'Substituir (descarta estado anterior)' },
        ]}
      />

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
                placeholder="chave (ex.: passo, nome, cpf)"
                value={a.chave || ''}
                onChange={(e) => setAtr(i, 'chave', e.target.value)}
              />
              <Input
                size="sm"
                placeholder="valor (ex.: AGUARDANDO_CPF, {{dadosGatilho.texto}})"
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
    </>
  );
}

function FormSwitch({ data, setData }) {
  const casos = Array.isArray(data?.casos) ? data.casos : [];
  const setCaso = (i, campo, valor) => {
    setData({
      casos: casos.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)),
    });
  };

  return (
    <>
      <div className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-lg p-2.5 leading-snug border border-[var(--border-main)]">
        Avalia uma expressao e envia o fluxo pra saida do caso que bate.
        Substitui IF aninhados — 1 Switch com 5 casos em vez de 4 IFs.
      </div>

      <Input
        size="sm"
        label="Expressao"
        value={data?.expressao || ''}
        onChange={(e) => setData({ expressao: e.target.value })}
        placeholder="{{dadosGatilho.estado.passo}}"
        hint="Suporta {{interpolacao}}. O resultado e comparado com cada caso (string ===)."
        className="font-mono"
      />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold tracking-wide text-[var(--text-secondary)]">
            Casos
          </label>
          <Button
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => setData({ casos: [...casos, { valor: '', label: '' }] })}
          >
            Adicionar
          </Button>
        </div>
        <div className="space-y-1.5">
          {casos.length === 0 && (
            <p className="text-[11px] text-[var(--text-muted)]">Nenhum caso. Adiciona pelo menos um.</p>
          )}
          {casos.map((c, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                size="sm"
                placeholder="valor (ex.: NOME)"
                value={c.valor || ''}
                onChange={(e) => setCaso(i, 'valor', e.target.value)}
              />
              <Input
                size="sm"
                placeholder="label (opcional)"
                value={c.label || ''}
                onChange={(e) => setCaso(i, 'label', e.target.value)}
              />
              <IconButton
                icon={Trash2}
                variant="danger"
                size="sm"
                ariaLabel="Remover caso"
                onClick={() => setData({ casos: casos.filter((_, idx) => idx !== i) })}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-snug">
          A saida <strong>default</strong> e usada quando nenhum caso bate.
          Pra testar valor vazio (ex.: estado nao iniciado), deixa o campo "valor" em branco — vira o caso "(vazio)".
        </p>
      </div>
    </>
  );
}

const TOOLS_SUGERIDAS = [
  'crm.criarLead',
  'crm.buscarLead',
  'crm.moverEtapaLead',
  'agenda.criarAgendamento',
  'agenda.listarAgendamentosDoDia',
  'catalogo.buscarProduto',
  'catalogo.listarProdutos',
  'mensagens.enviar',
  'vendas.lancarVenda',
];

function FormTool({ data, setData }) {
  const argsTexto = (() => {
    if (typeof data?.args === 'string') return data.args;
    try { return JSON.stringify(data?.args || {}, null, 2); }
    catch { return '{}'; }
  })();

  const onArgsChange = (texto) => {
    // Salva sempre como objeto se parseavel; senao, deixa string pra o usuario
    // continuar editando sem perder o texto.
    try {
      const obj = JSON.parse(texto);
      setData({ args: obj });
    } catch {
      setData({ args: texto });
    }
  };

  return (
    <>
      <div className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-lg p-2.5 leading-snug border border-[var(--border-main)]">
        Invoca uma tool do agente diretamente. Mesma camada de permissao do
        AI Agent (modulo liberado + tool habilitada no bot + auditoria).
      </div>

      <Input
        size="sm"
        label="Nome da tool"
        list="tools-sugeridas"
        value={data?.toolNome || ''}
        onChange={(e) => setData({ toolNome: e.target.value })}
        placeholder="ex.: crm.criarLead"
        hint="Habilite em Bots > Ferramentas do agente."
      />
      <datalist id="tools-sugeridas">
        {TOOLS_SUGERIDAS.map((t) => <option key={t} value={t} />)}
      </datalist>

      <Textarea
        label="Argumentos (JSON)"
        rows={6}
        value={argsTexto}
        onChange={(e) => onArgsChange(e.target.value)}
        placeholder={'{\n  "nome": "{{dadosGatilho.estado.nome}}",\n  "telefone": "{{dadosGatilho.telefone}}"\n}'}
        hint="Suporta {{interpolacao}} em strings (recursivo em arrays/objetos)."
        className="font-mono"
      />

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <Switch
          checked={!!data?.permitirFalha}
          onChange={(v) => setData({ permitirFalha: v })}
          ariaLabel="Permitir falha"
        />
        <span className="text-xs text-[var(--text-secondary)]">
          Permitir falha (continua o fluxo se a tool falhar)
        </span>
      </label>
    </>
  );
}

// =====================================================================
// FORM: AI_AGENT (Sub-fase 3.4)
// =====================================================================

const PROVEDORES_LLM = [
  { value: 'OPENAI', label: 'OpenAI', tipoCredencial: 'OPENAI_API_KEY' },
  { value: 'ANTHROPIC', label: 'Anthropic Claude', tipoCredencial: 'ANTHROPIC_API_KEY' },
  { value: 'GEMINI', label: 'Google Gemini', tipoCredencial: 'GEMINI_API_KEY' },
];

const MODELOS_SUGERIDOS = {
  OPENAI: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  ANTHROPIC: ['claude-sonnet-4-5', 'claude-sonnet-4', 'claude-haiku-4-5', 'claude-opus-4-1'],
  GEMINI: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'],
};

function FormAiAgent({ data, setData }) {
  const [credenciais, setCredenciais] = useState([]);

  useEffect(() => {
    let ativo = true;
    credenciaisService
      .listar()
      .then((lista) => { if (ativo) setCredenciais(lista || []); })
      .catch(() => ativo && setCredenciais([]));
    return () => { ativo = false; };
  }, []);

  const provedor = data?.provedor || 'OPENAI';
  const tipoEsperado = PROVEDORES_LLM.find((p) => p.value === provedor)?.tipoCredencial;
  const credenciaisCompativeis = credenciais.filter((c) => c.tipo === tipoEsperado);

  const trocarProvedor = (novo) => {
    const sugerido = MODELOS_SUGERIDOS[novo]?.[0] || '';
    setData({
      provedor: novo,
      modelo: sugerido,
      credencialId: '', // limpa credencial ao trocar provedor
    });
  };

  return (
    <>
      <div className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-lg p-2.5 leading-snug border border-[var(--border-main)]">
        <strong className="text-[var(--text-secondary)]">Function calling:</strong> as tools que o agente
        pode invocar saem do bot deste fluxo (configurado em <em>Bots → Ferramentas do agente</em>).
        Sem tools habilitadas, o agente só responde texto.
      </div>

      <Select
        size="sm"
        label="Provedor"
        value={provedor}
        onChange={(e) => trocarProvedor(e.target.value)}
        options={PROVEDORES_LLM.map((p) => ({ value: p.value, label: p.label }))}
        placeholder=""
      />

      <Select
        size="sm"
        label="Modelo"
        value={data?.modelo || ''}
        onChange={(e) => setData({ modelo: e.target.value })}
        options={(MODELOS_SUGERIDOS[provedor] || []).map((m) => ({ value: m, label: m }))}
        placeholder="— Selecione um modelo —"
        hint="Lista de sugeridos. Se quiser um modelo especifico, edite o campo abaixo."
      />
      <Input
        size="sm"
        label="Modelo (manual)"
        placeholder="Ex.: gpt-4o, claude-sonnet-4-5, gemini-1.5-flash"
        value={data?.modelo || ''}
        onChange={(e) => setData({ modelo: e.target.value })}
      />

      <Select
        size="sm"
        label="Credencial"
        value={data?.credencialId || ''}
        onChange={(e) => setData({ credencialId: e.target.value || null })}
        options={credenciaisCompativeis.map((c) => ({ value: c.id, label: c.nome }))}
        placeholder={
          credenciaisCompativeis.length === 0
            ? `— Nenhuma credencial ${tipoEsperado} cadastrada —`
            : '— Selecione uma credencial —'
        }
        hint={
          credenciaisCompativeis.length === 0
            ? `Crie em Configuracoes > Credenciais (tipo ${tipoEsperado}).`
            : 'Decifrada apenas no momento da execucao no worker.'
        }
      />

      <Textarea
        label="Prompt do sistema"
        rows={4}
        value={data?.prompt || ''}
        onChange={(e) => setData({ prompt: e.target.value })}
        placeholder="Voce e um assistente prestativo. Responda em portugues..."
        hint="Define a persona/regras do agente. Suporta {{interpolacao}}."
      />

      <Textarea
        label="Mensagem do usuario"
        rows={3}
        value={data?.mensagemUsuario || ''}
        onChange={(e) => setData({ mensagemUsuario: e.target.value })}
        placeholder="{{entrada}}"
        hint="Conteudo enviado como mensagem do usuario. Geralmente {{entrada}} ou {{entrada.texto}}."
        className="font-mono"
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          size="sm"
          label="Temperatura"
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={data?.temperatura ?? 0.7}
          onChange={(e) => setData({ temperatura: parseFloat(e.target.value) || 0 })}
          hint="0 = deterministico, 2 = bem criativo"
        />
        <Input
          size="sm"
          label="Max tokens"
          type="number"
          min={1}
          max={4096}
          step={1}
          value={data?.maxTokens ?? 1024}
          onChange={(e) => setData({ maxTokens: parseInt(e.target.value, 10) || 1024 })}
          hint="Limite duro: 4096"
        />
      </div>
    </>
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

  const urlWebhook = webhook
    ? `${urlPublica()}/webhooks/${webhook.id}`
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
          <Input size="sm" value={urlWebhook} readOnly />
          <IconButton icon={Copy} variant="secondary" size="sm" ariaLabel="Copiar URL" onClick={() => copiar(urlWebhook, 'URL')} />
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
