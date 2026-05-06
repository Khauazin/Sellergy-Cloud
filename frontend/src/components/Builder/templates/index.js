import { Webhook, Clock } from 'lucide-react';

// Templates de fluxo prontos. Cada um define o nome do fluxo, o gatilho
// (tipoGatilho/palavraChaveGatilho) e o canvas (nos + conexoes) no formato
// que o backend `/builder/fluxos/:id/canvas` aceita.
//
// Para registrar um template novo:
//  1. Adicione um objeto na lista TEMPLATES com `id`, `nome`, `descricao`,
//     `icone`, `categoria` e `fluxo` (que cria o registro Fluxo) +
//     `canvas` (que vai no PUT /canvas).
//  2. Os IDs dos nos e conexoes precisam ser unicos dentro do template,
//     mas o BuilderPage gera novos IDs ao aplicar (utilCanvas).
//
// Quando criarmos AI Agent / WhatsApp Send / Telegram Send, criamos
// templates mais ricos (ex.: "Atendente WhatsApp com IA").

export const TEMPLATES = [
  {
    id: 'webhook-eco',
    nome: 'Webhook + Eco',
    descricao:
      'Recebe um POST publico, registra os dados num campo `recebido` e finaliza. Util para testar integracoes externas.',
    icone: Webhook,
    cor: 'info',
    categoria: 'Integracao',
    fluxo: {
      nome: 'Webhook + Eco',
      tipoGatilho: 'DEFAULT',
    },
    canvas: {
      nos: [
        {
          id: 'tpl_webhook_1',
          tipo: 'WEBHOOK',
          posicaoX: 80,
          posicaoY: 200,
          dados: { label: 'Webhook' },
        },
        {
          id: 'tpl_set_1',
          tipo: 'SET',
          posicaoX: 360,
          posicaoY: 200,
          dados: {
            label: 'Eco',
            atribuicoes: [
              { chave: 'recebido', valor: '{{entrada.corpo}}' },
              { chave: 'origem_ip', valor: '{{entrada.ip}}' },
            ],
          },
        },
        {
          id: 'tpl_code_1',
          tipo: 'CODE',
          posicaoX: 640,
          posicaoY: 200,
          dados: {
            label: 'Resposta',
            codigo:
              "return {\n  ok: true,\n  recebidoEm: new Date().toISOString(),\n  corpo: variaveis.recebido,\n};",
          },
        },
      ],
      conexoes: [
        {
          id: 'tpl_c_1',
          noOrigemId: 'tpl_webhook_1',
          noDestinoId: 'tpl_set_1',
          pontoOrigem: null,
        },
        {
          id: 'tpl_c_2',
          noOrigemId: 'tpl_set_1',
          noDestinoId: 'tpl_code_1',
          pontoOrigem: null,
        },
      ],
    },
  },

  {
    id: 'cron-http-diario',
    nome: 'Lembrete diario via HTTP',
    descricao:
      'Roda todo dia as 09:00 (America/Sao_Paulo), faz um GET numa API publica e processa a resposta. Modelo para sincronizacoes ou dispatchers.',
    icone: Clock,
    cor: 'success',
    categoria: 'Agendamento',
    fluxo: {
      nome: 'Lembrete diario via HTTP',
      tipoGatilho: 'DEFAULT',
    },
    canvas: {
      nos: [
        {
          id: 'tpl_schedule_1',
          tipo: 'SCHEDULE',
          posicaoX: 80,
          posicaoY: 200,
          dados: { label: 'Diario 09h' },
        },
        {
          id: 'tpl_http_1',
          tipo: 'HTTP_REQUEST',
          posicaoX: 360,
          posicaoY: 200,
          dados: {
            label: 'Buscar dados',
            metodo: 'GET',
            url: 'https://worldtimeapi.org/api/timezone/America/Sao_Paulo',
            cabecalhos: [{ chave: 'Accept', valor: 'application/json' }],
            corpo: '',
            timeoutMs: 10000,
          },
        },
        {
          id: 'tpl_if_1',
          tipo: 'IF',
          posicaoX: 640,
          posicaoY: 200,
          dados: {
            label: 'Status 200?',
            condicao: 'entrada.status === 200',
          },
        },
        {
          id: 'tpl_code_ok',
          tipo: 'CODE',
          posicaoX: 920,
          posicaoY: 80,
          dados: {
            label: 'Sucesso',
            codigo:
              "return {\n  ok: true,\n  hora: entrada.corpo?.datetime,\n};",
          },
        },
        {
          id: 'tpl_code_err',
          tipo: 'CODE',
          posicaoX: 920,
          posicaoY: 320,
          dados: {
            label: 'Falha',
            codigo:
              "return {\n  ok: false,\n  status: entrada.status,\n};",
          },
        },
      ],
      conexoes: [
        {
          id: 'tpl_c_1',
          noOrigemId: 'tpl_schedule_1',
          noDestinoId: 'tpl_http_1',
          pontoOrigem: null,
        },
        {
          id: 'tpl_c_2',
          noOrigemId: 'tpl_http_1',
          noDestinoId: 'tpl_if_1',
          pontoOrigem: null,
        },
        {
          id: 'tpl_c_3',
          noOrigemId: 'tpl_if_1',
          noDestinoId: 'tpl_code_ok',
          pontoOrigem: 'verdadeiro',
        },
        {
          id: 'tpl_c_4',
          noOrigemId: 'tpl_if_1',
          noDestinoId: 'tpl_code_err',
          pontoOrigem: 'falso',
        },
      ],
    },
  },
];

export function obterTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}
