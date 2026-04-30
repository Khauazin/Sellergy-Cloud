-- AlterTable: adiciona campos `produto` e `metodoPagamento` em lancamentos_financeiros
-- para suportar lancamento manual de venda (quando produto nao tem estoque cadastrado).

ALTER TABLE "lancamentos_financeiros" ADD COLUMN "produto" TEXT;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "metodoPagamento" TEXT;
