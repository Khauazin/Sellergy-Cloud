import { Play, Globe, GitBranch, Variable, Code, Webhook, Clock } from 'lucide-react';

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
};

export const TIPOS_NO_PALETA = Object.values(CATALOGO_NOS);

export function configDoTipo(tipo) {
  return CATALOGO_NOS[tipo] || null;
}
