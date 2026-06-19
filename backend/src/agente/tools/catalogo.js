const prisma = require('../../prisma');
const { resolverPrecoVenda, fontePrecoVenda } = require('../../produto');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

// Mapeia uma variacao para o formato consumivel pelo LLM (preco resolvido).
// Inclui tipo do produto e duracao (servicos) pro bot decidir formatacao.
function variacaoParaSaida(produto, variacao) {
  return {
    produtoId: produto.id,
    variacaoId: variacao.id,
    nomeProduto: produto.nome,
    nomeVariacao: variacao.nome,
    sku: variacao.sku,
    preco: resolverPrecoVenda(variacao),
    fontePreco: fontePrecoVenda(variacao),
    tipo: produto.tipo, // FISICO ou SERVICO
    estoqueAtual: produto.tipo === 'FISICO' ? variacao.estoqueAtual : null,
    duracaoMin: produto.tipo === 'SERVICO' ? variacao.duracaoMin : null,
    descricao: produto.descricao,
    categoria: produto.categoria?.nome || null,
    imagemUrl: variacao.imagemUrl || produto.imagemUrl || null,
  };
}

// Normaliza filtro de tipo. Aceita 'FISICO', 'SERVICO', 'TODOS' ou ausente.
function normalizarTipo(tipo) {
  if (!tipo) return null;
  const t = String(tipo).toUpperCase();
  if (t === 'FISICO' || t === 'SERVICO') return t;
  return null; // qualquer outro valor = sem filtro
}

const buscarProduto = {
  nome: 'catalogo.buscarProduto',
  modulo: 'CATALOGO',
  descricao: 'Busca produto ou servico do catalogo por trecho do nome. Retorna ate 10 variacoes com preco resolvido. Aceita filtro de tipo (FISICO/SERVICO).',
  parametros: {
    tipo: 'object',
    propriedades: {
      termo: { tipo: 'string', descricao: 'Trecho do nome (case-insensitive)' },
      tipo: {
        tipo: 'string',
        descricao: 'Filtro opcional: "FISICO" ou "SERVICO". Omitir pra buscar nos dois.',
        opcional: true,
      },
    },
    obrigatorios: ['termo'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const termo = String(args.termo || '').trim();
    if (!termo) return { encontrados: [], total: 0 };
    const filtroTipo = normalizarTipo(args?.tipo);

    const where = {
      clienteId: contexto.clienteId,
      visibilidade: 'ATIVO',
      nome: { contains: termo, mode: 'insensitive' },
    };
    if (filtroTipo) where.tipo = filtroTipo;

    const produtos = await prisma.produto.findMany({
      where,
      include: { variacoes: true, categoria: true },
      take: 5,
      orderBy: { nome: 'asc' },
    });

    const encontrados = [];
    for (const p of produtos) {
      for (const v of p.variacoes) {
        encontrados.push(variacaoParaSaida(p, v));
        if (encontrados.length >= 10) break;
      }
      if (encontrados.length >= 10) break;
    }
    return { encontrados, total: encontrados.length };
  },
};

const listarProdutos = {
  nome: 'catalogo.listarProdutos',
  modulo: 'CATALOGO',
  descricao: 'Lista produtos/servicos ativos AGRUPADOS POR CATEGORIA. Use quando o cliente pedir "me envia o catalogo" ou "quais servicos voce oferece". Aceita filtro de tipo (FISICO=produtos, SERVICO=servicos).',
  parametros: {
    tipo: 'object',
    propriedades: {
      tipo: {
        tipo: 'string',
        descricao: 'Filtro opcional: "FISICO" (so produtos com estoque), "SERVICO" (so servicos prestados), ou omitir pra trazer ambos',
        opcional: true,
      },
    },
    obrigatorios: [],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const filtroTipo = normalizarTipo(args?.tipo);

    const where = { clienteId: contexto.clienteId, visibilidade: 'ATIVO' };
    if (filtroTipo) where.tipo = filtroTipo;

    const produtos = await prisma.produto.findMany({
      where,
      include: { variacoes: true, categoria: true },
      take: 30,
      orderBy: [{ categoria: { nome: 'asc' } }, { nome: 'asc' }],
    });

    // Agrupa por categoria pra resposta legivel no WhatsApp.
    // Cada grupo: { categoria, tipo, itens: [...] }. Itens sem categoria
    // vao pra "Sem categoria".
    const gruposPorChave = new Map();
    let totalItens = 0;
    const LIMITE = 40;

    for (const p of produtos) {
      for (const v of p.variacoes) {
        if (totalItens >= LIMITE) break;
        const chave = `${p.categoria?.id || '_sem'}__${p.tipo}`;
        if (!gruposPorChave.has(chave)) {
          gruposPorChave.set(chave, {
            categoria: p.categoria?.nome || 'Sem categoria',
            tipo: p.tipo,
            itens: [],
          });
        }
        gruposPorChave.get(chave).itens.push(variacaoParaSaida(p, v));
        totalItens += 1;
      }
      if (totalItens >= LIMITE) break;
    }

    return {
      filtroTipo: filtroTipo || 'TODOS',
      grupos: [...gruposPorChave.values()],
      totalItens,
      truncado: totalItens >= LIMITE,
    };
  },
};

module.exports = [buscarProduto, listarProdutos];
