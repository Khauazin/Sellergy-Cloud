// =====================================================================
// Categorias financeiras padrão — seed por tenant
// =====================================================================
// Lista curada para PME. Aplicada quando:
//   - Um novo tenant é criado (chamada explícita do ClienteController).
//   - O usuário aciona "Restaurar padrões" na UI (rota dedicada).
//
// Estratégia: nunca duplica. Se já existe categoria com mesmo NOME para
// o tenant, pula. Cria apenas as faltantes.

const PADROES = [
  // Receita
  { nome: 'Venda de serviços', tipo: 'RECEITA', subTipo: null },
  { nome: 'Venda de produtos', tipo: 'RECEITA', subTipo: null },
  { nome: 'Outras receitas', tipo: 'RECEITA', subTipo: null },

  // Despesa fixa (paga todo mês independente das vendas)
  { nome: 'Aluguel', tipo: 'DESPESA', subTipo: 'FIXA' },
  { nome: 'Salário', tipo: 'DESPESA', subTipo: 'FIXA' },
  { nome: 'Internet', tipo: 'DESPESA', subTipo: 'FIXA' },
  { nome: 'Energia', tipo: 'DESPESA', subTipo: 'FIXA' },
  { nome: 'Água', tipo: 'DESPESA', subTipo: 'FIXA' },
  { nome: 'Contador', tipo: 'DESPESA', subTipo: 'FIXA' },
  { nome: 'Marketing', tipo: 'DESPESA', subTipo: 'FIXA' },

  // Despesa variável (depende do volume de vendas)
  { nome: 'Imposto sobre vendas', tipo: 'DESPESA', subTipo: 'VARIAVEL' },
  { nome: 'Taxa de cartão', tipo: 'DESPESA', subTipo: 'VARIAVEL' },
  { nome: 'Comissão de vendedor', tipo: 'DESPESA', subTipo: 'VARIAVEL' },
  { nome: 'Frete', tipo: 'DESPESA', subTipo: 'VARIAVEL' },
];

// Cria as categorias padrão que ainda não existem no tenant.
// Retorna { criadas: N, total: N_padrao }.
async function seedCategoriasPadrao(client, clienteId) {
  if (!clienteId) throw new Error('seedCategoriasPadrao: clienteId obrigatório.');

  // Carrega nomes já existentes (case-insensitive) para evitar duplicar.
  const existentes = await client.categoriaFinanceira.findMany({
    where: { clienteId },
    select: { nome: true },
  });
  const nomesExistentes = new Set(existentes.map((c) => c.nome.toLowerCase()));

  const aFaltarem = PADROES.filter((p) => !nomesExistentes.has(p.nome.toLowerCase()));
  if (aFaltarem.length === 0) {
    return { criadas: 0, total: PADROES.length };
  }

  await client.categoriaFinanceira.createMany({
    data: aFaltarem.map((p) => ({ ...p, clienteId })),
    skipDuplicates: true,
  });

  return { criadas: aFaltarem.length, total: PADROES.length };
}

module.exports = { seedCategoriasPadrao, PADROES };
