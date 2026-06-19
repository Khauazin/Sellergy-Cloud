// Helpers de produtos vinculados ao Lead.
//
// Conceito: o `valor` exibido no card do CRM e a SOMA dos produtos vinculados
// (qtd * preco). O preco vem de `resolverPrecoVenda` (preco unico de venda da
// variacao). Esse calculo e centralizado aqui pra UI, agente IA e dashboards
// verem o mesmo numero.

const prisma = require('./prisma');
const { resolverPrecoVenda } = require('./produto');

/**
 * Soma o valor agregado de uma lista de vinculos (`LeadVariacao` com a
 * relacao `variacao` carregada). Retorna `{ valorTotal, itensComPreco }`.
 */
function calcularValorAgregado(vinculos) {
  let valorTotal = 0;
  let itensComPreco = 0;
  for (const v of vinculos || []) {
    const preco = resolverPrecoVenda(v?.variacao);
    if (preco === null || preco === undefined || Number.isNaN(preco)) continue;
    const qtd = Math.max(1, Number(v.quantidade) || 0);
    valorTotal += preco * qtd;
    itensComPreco += 1;
  }
  return { valorTotal, itensComPreco };
}

/**
 * Substitui o conjunto de vinculos de um lead numa transacao Prisma.
 * Recalcula e atualiza `Lead.valor` ao final, baseado no preco efetivo
 * de cada variacao. Faz validacao multi-tenant: variacoes referenciadas
 * precisam pertencer ao mesmo `clienteId` do lead.
 *
 * Aceita `tx` (transacao Prisma) opcional pra compor com create/update.
 *
 * `vinculos` formato: [{ variacaoId, quantidade?, observacao? }]
 */
async function substituirVinculosDoLead({ leadId, clienteId, vinculos, tx = prisma }) {
  const lista = Array.isArray(vinculos) ? vinculos : [];

  // Deduplica por variacaoId — soma as quantidades.
  const mapa = new Map();
  for (const v of lista) {
    if (!v?.variacaoId) continue;
    const qtd = Math.max(1, Number(v.quantidade) || 1);
    if (mapa.has(v.variacaoId)) {
      const existente = mapa.get(v.variacaoId);
      mapa.set(v.variacaoId, {
        variacaoId: v.variacaoId,
        quantidade: existente.quantidade + qtd,
        observacao: v.observacao ?? existente.observacao ?? null,
      });
    } else {
      mapa.set(v.variacaoId, {
        variacaoId: v.variacaoId,
        quantidade: qtd,
        observacao: v.observacao ?? null,
      });
    }
  }
  const normalizado = [...mapa.values()];

  // Validacao multi-tenant: todas as variacoes referenciadas precisam
  // pertencer a um produto do mesmo `clienteId` do lead.
  if (normalizado.length > 0) {
    const variacoes = await tx.variacaoProduto.findMany({
      where: { id: { in: normalizado.map((v) => v.variacaoId) } },
      select: { id: true, produto: { select: { clienteId: true } } },
    });
    if (variacoes.length !== normalizado.length) {
      throw new Error('Uma ou mais variacoes nao foram encontradas.');
    }
    for (const v of variacoes) {
      if (v.produto.clienteId !== clienteId) {
        throw new Error('Variacao nao pertence ao tenant do lead.');
      }
    }
  }

  // Substitui: deleta tudo que existir e recria.
  await tx.leadVariacao.deleteMany({ where: { leadId } });
  if (normalizado.length > 0) {
    await tx.leadVariacao.createMany({
      data: normalizado.map((v) => ({
        leadId,
        variacaoId: v.variacaoId,
        quantidade: v.quantidade,
        observacao: v.observacao,
      })),
    });
  }

  // Recalcula valor agregado e atualiza Lead.valor.
  const vinculosCarregados = await tx.leadVariacao.findMany({
    where: { leadId },
    include: { variacao: true },
  });
  const { valorTotal } = calcularValorAgregado(vinculosCarregados);
  await tx.lead.update({ where: { id: leadId }, data: { valor: valorTotal } });

  return { vinculos: vinculosCarregados, valorTotal };
}

/**
 * Adiciona um vinculo ao lead (ou incrementa quantidade se ja existir).
 * Recalcula `Lead.valor`. Validacao de tenant.
 */
async function adicionarVinculo({ leadId, clienteId, variacaoId, quantidade = 1, observacao = null, tx = prisma }) {
  if (!variacaoId) throw new Error('variacaoId obrigatorio.');
  const qtd = Math.max(1, Number(quantidade) || 1);

  const variacao = await tx.variacaoProduto.findUnique({
    where: { id: variacaoId },
    select: { id: true, produto: { select: { clienteId: true } } },
  });
  if (!variacao) throw new Error('Variacao nao encontrada.');
  if (variacao.produto.clienteId !== clienteId) throw new Error('Variacao nao pertence ao tenant.');

  const existente = await tx.leadVariacao.findUnique({
    where: { leadId_variacaoId: { leadId, variacaoId } },
  });

  if (existente) {
    await tx.leadVariacao.update({
      where: { id: existente.id },
      data: { quantidade: existente.quantidade + qtd, observacao: observacao ?? existente.observacao },
    });
  } else {
    await tx.leadVariacao.create({
      data: { leadId, variacaoId, quantidade: qtd, observacao },
    });
  }

  // Recalcula valor.
  const vinculos = await tx.leadVariacao.findMany({
    where: { leadId },
    include: { variacao: true },
  });
  const { valorTotal } = calcularValorAgregado(vinculos);
  await tx.lead.update({ where: { id: leadId }, data: { valor: valorTotal } });
  return { vinculos, valorTotal };
}

async function removerVinculo({ leadId, variacaoId, tx = prisma }) {
  await tx.leadVariacao.deleteMany({ where: { leadId, variacaoId } });
  const vinculos = await tx.leadVariacao.findMany({
    where: { leadId },
    include: { variacao: true },
  });
  const { valorTotal } = calcularValorAgregado(vinculos);
  await tx.lead.update({ where: { id: leadId }, data: { valor: valorTotal } });
  return { vinculos, valorTotal };
}

module.exports = {
  calcularValorAgregado,
  substituirVinculosDoLead,
  adicionarVinculo,
  removerVinculo,
};
