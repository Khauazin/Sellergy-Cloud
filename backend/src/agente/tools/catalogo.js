const prisma = require('../../prisma');
const { resolverPrecoVenda, fontePrecoVenda } = require('../../produto');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

// Mapeia uma variacao para o formato consumivel pelo LLM (preco resolvido).
function variacaoParaSaida(produto, variacao) {
  return {
    produtoId: produto.id,
    variacaoId: variacao.id,
    nomeProduto: produto.nome,
    nomeVariacao: variacao.nome,
    sku: variacao.sku,
    preco: resolverPrecoVenda(variacao),
    fontePreco: fontePrecoVenda(variacao),
    estoqueAtual: variacao.estoqueAtual,
    descricao: produto.descricao,
    imagemUrl: variacao.imagemUrl || produto.imagemUrl || null,
  };
}

const buscarProduto = {
  nome: 'catalogo.buscarProduto',
  modulo: 'CATALOGO',
  descricao: 'Busca produtos do catalogo por trecho do nome. Retorna ate 10 variacoes com preco resolvido (regra catalogo vs estoque).',
  parametros: {
    tipo: 'object',
    propriedades: {
      termo: { tipo: 'string', descricao: 'Trecho do nome (case-insensitive)' },
    },
    obrigatorios: ['termo'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const termo = String(args.termo || '').trim();
    if (!termo) return { encontrados: [], total: 0 };

    const produtos = await prisma.produto.findMany({
      where: {
        clienteId: contexto.clienteId,
        visibilidade: 'ATIVO',
        nome: { contains: termo, mode: 'insensitive' },
      },
      include: { variacoes: true },
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
  descricao: 'Lista os produtos ativos do catalogo (ate 20 variacoes).',
  parametros: {
    tipo: 'object',
    propriedades: {},
    obrigatorios: [],
  },
  async executar({ contexto }) {
    exigirCliente(contexto);
    const produtos = await prisma.produto.findMany({
      where: { clienteId: contexto.clienteId, visibilidade: 'ATIVO' },
      include: { variacoes: true },
      take: 10,
      orderBy: { nome: 'asc' },
    });
    const itens = [];
    for (const p of produtos) {
      for (const v of p.variacoes) {
        itens.push(variacaoParaSaida(p, v));
        if (itens.length >= 20) break;
      }
      if (itens.length >= 20) break;
    }
    return { itens, total: itens.length };
  },
};

module.exports = [buscarProduto, listarProdutos];
