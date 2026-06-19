-- Remove o conceito de "preco de catalogo publico" (precoCatalogo / usarPrecoCatalogo).
-- Nao existe mais catalogo publico: produtos fisicos (estoque) e servicos (catalogo)
-- passam a usar um unico preco de venda (`preco`). A regra de resolucao de preco
-- foi simplificada no backend (produto.resolverPrecoVenda) para retornar `preco`.

ALTER TABLE "variacoes_produto" DROP COLUMN IF EXISTS "precoCatalogo";
ALTER TABLE "variacoes_produto" DROP COLUMN IF EXISTS "usarPrecoCatalogo";
