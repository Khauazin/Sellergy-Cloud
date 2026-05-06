import { Play, Globe, GitBranch, Variable, Code, Webhook, Clock, Sparkles, Send, Database, Wrench, ListTree } from 'lucide-react';

// Saidas reservadas pro SWITCH:
//  - id de cada caso = String(valor) ou '__vazio__' se valor === ''
//  - id do default = '__default__'
// Mantenha em sincronia com backend/src/engine/executores/switch.js (idDoCaso).
export function idDoCasoSwitch(valor) {
  if (valor === '' || valor === null || valor === undefined) return '__vazio__';
  return String(valor);
}
export const ID_DEFAULT_SWITCH = '__default__';

// Catalogo dos 5 nos da Sub-fase 1.1 do engine de workflows.
// Cada entrada define metadados visuais, handles e formato inicial dos dados.
export const CATALOGO_NOS = {
  MANUAL: {
    tipo: 'MANUAL',
    rotulo: 'Manual',
    descricao: 'Inicia a execucao manualmente.',
    categoria: 'TRIGGERS',
    icone: Play,
    cor: 'accent',
    handles: { entrada: false, saidas: ['default'] },
    dadosPadrao: () => ({ label: 'Inicio' }),
  },
  WEBHOOK: {
    tipo: 'WEBHOOK',
    rotulo: 'Webhook',
    descricao: 'Trigger via URL publica (HTTP POST).',
    categoria: 'TRIGGERS',
    icone: Webhook,
    cor: 'info',
    handles: { entrada: false, saidas: ['default'] },
    dadosPadrao: () => ({ label: 'Webhook' }),
  },
  SCHEDULE: {
    tipo: 'SCHEDULE',
    rotulo: 'Schedule',
    descricao: 'Trigger por expressao cron.',
    categoria: 'TRIGGERS',
    icone: Clock,
    cor: 'success',
    handles: { entrada: false, saidas: ['default'] },
    dadosPadrao: () => ({ label: 'Schedule' }),
  },
  HTTP_REQUEST: {
    tipo: 'HTTP_REQUEST',
    rotulo: 'HTTP Request',
    descricao: 'Faz uma chamada HTTP.',
    categoria: 'CORE',
    icone: Globe,
    cor: 'info',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({
      label: 'HTTP Request',
      metodo: 'GET',
      url: '',
      cabecalhos: [],
      corpo: '',
      timeoutMs: 10000,
    }),
  },
  IF: {
    tipo: 'IF',
    rotulo: 'IF',
    descricao: 'Bifurca a execucao por condicao.',
    categoria: 'CORE',
    icone: GitBranch,
    cor: 'warning',
    handles: { entrada: true, saidas: ['verdadeiro', 'falso'] },
    dadosPadrao: () => ({ label: 'IF', condicao: '' }),
  },
  SET: {
    tipo: 'SET',
    rotulo: 'Set',
    descricao: 'Define variaveis para os proximos nos.',
    categoria: 'CORE',
    icone: Variable,
    cor: 'neutral',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({ label: 'Set', atribuicoes: [] }),
  },
  CODE: {
    tipo: 'CODE',
    rotulo: 'Code',
    descricao: 'Executa JavaScript em sandbox.',
    categoria: 'CORE',
    icone: Code,
    cor: 'success',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({ label: 'Code', codigo: 'return entrada;' }),
  },
  ENVIAR_MENSAGEM: {
    tipo: 'ENVIAR_MENSAGEM',
    rotulo: 'Enviar Mensagem',
    descricao: 'Envia texto pela conversa que disparou o fluxo (WhatsApp/Telegram).',
    categoria: 'CANAIS',
    icone: Send,
    cor: 'success',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({
      label: 'Enviar Mensagem',
      texto: 'Recebi sua mensagem: {{dadosGatilho.texto}}',
      conversaId: '',
    }),
  },
  AI_AGENT: {
    tipo: 'AI_AGENT',
    rotulo: 'AI Agent',
    descricao: 'Chama um LLM (OpenAI, Claude ou Gemini) com prompt e mensagem.',
    categoria: 'IA',
    icone: Sparkles,
    cor: 'accent',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({
      label: 'AI Agent',
      provedor: 'OPENAI',
      modelo: 'gpt-4o-mini',
      credencialId: '',
      prompt: 'Voce e um assistente prestativo. Responda de forma clara e concisa.',
      mensagemUsuario: '{{entrada}}',
      temperatura: 0.7,
      maxTokens: 1024,
    }),
  },
  SET_ESTADO_CONVERSA: {
    tipo: 'SET_ESTADO_CONVERSA',
    rotulo: 'Estado da Conversa',
    descricao: 'Salva variaveis na conversa pra fluxos multi-turno (memoria entre mensagens).',
    categoria: 'CONVERSA',
    icone: Database,
    cor: 'info',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({
      label: 'Estado da Conversa',
      atribuicoes: [{ chave: 'passo', valor: 'AGUARDANDO_NOME' }],
      estrategia: 'MERGE',
    }),
  },
  TOOL: {
    tipo: 'TOOL',
    rotulo: 'Tool (Acao)',
    descricao: 'Executa uma tool do agente (ex.: criar lead) respeitando permissoes do bot.',
    categoria: 'CORE',
    icone: Wrench,
    cor: 'success',
    handles: { entrada: true, saidas: ['default'] },
    dadosPadrao: () => ({
      label: 'Tool',
      toolNome: 'crm.criarLead',
      args: { nome: '{{dadosGatilho.estado.nome}}', telefone: '{{dadosGatilho.telefone}}' },
      permitirFalha: false,
    }),
  },
  SWITCH: {
    tipo: 'SWITCH',
    rotulo: 'Switch',
    descricao: 'Bifurca em N saidas baseado no valor de uma expressao (substitui IF aninhado).',
    categoria: 'CORE',
    icone: ListTree,
    cor: 'warning',
    handles: { entrada: true, saidas: ['__vazio__', '__default__'] }, // fallback estatico se data ainda nao tem casos
    // Saidas dependem dos casos configurados. NoBase prioriza essa funcao
    // sobre o `handles.saidas` estatico quando ela existe.
    saidasDinamicas: (dados) => {
      const casos = Array.isArray(dados?.casos) ? dados.casos : [];
      const ids = casos.map((c) => idDoCasoSwitch(c?.valor));
      return [...ids, ID_DEFAULT_SWITCH];
    },
    // Renderiza um label legivel pra cada handle no canvas.
    rotuloDaSaida: (saidaId, dados) => {
      if (saidaId === ID_DEFAULT_SWITCH) return 'default';
      const casos = Array.isArray(dados?.casos) ? dados.casos : [];
      const c = casos.find((x) => idDoCasoSwitch(x?.valor) === saidaId);
      if (!c) return saidaId;
      return c.label || (c.valor === '' ? '(vazio)' : String(c.valor));
    },
    dadosPadrao: () => ({
      label: 'Switch',
      expressao: '{{dadosGatilho.estado.passo}}',
      casos: [
        { valor: '', label: 'inicio' },
      ],
    }),
  },
};

export const TIPOS_NO_PALETA = Object.values(CATALOGO_NOS);

export function configDoTipo(tipo) {
  return CATALOGO_NOS[tipo] || null;
}
