// Tool de conhecimento — base de FAQ do bot (alimenta o "atender").
// Le os pares pergunta/resposta cadastrados no FaqBot do bot da conversa.
// Sem RAG/embeddings no v1: busca por trecho (contains) ou lista as principais.

const prisma = require('../../prisma');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

const buscarConhecimento = {
  nome: 'conhecimento.buscar',
  modulo: 'BOTS',
  descricao:
    'Busca respostas na base de conhecimento (FAQ) deste bot. Use SEMPRE que o ' +
    'cliente tiver uma duvida de suporte (horario, politica, localizacao, "como ' +
    'funciona", etc.) ANTES de responder por conta propria. Sem termo, retorna as ' +
    'principais perguntas cadastradas.',
  parametros: {
    tipo: 'object',
    propriedades: {
      termo: {
        tipo: 'string',
        descricao: 'Palavras-chave da duvida do cliente (case-insensitive). Omitir pra listar as FAQs principais.',
        opcional: true,
      },
    },
    obrigatorios: [],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    if (!contexto.botId) {
      return { encontrados: [], total: 0, aviso: 'Conversa sem bot no contexto — FAQ indisponivel.' };
    }

    const termo = String(args?.termo || '').trim();
    const where = { botId: contexto.botId, ativo: true };
    if (termo) {
      where.OR = [
        { pergunta: { contains: termo, mode: 'insensitive' } },
        { resposta: { contains: termo, mode: 'insensitive' } },
      ];
    }

    const faqs = await prisma.faqBot.findMany({
      where,
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
      take: termo ? 5 : 8,
      select: { pergunta: true, resposta: true },
    });

    return { encontrados: faqs, total: faqs.length };
  },
};

module.exports = [buscarConhecimento];
