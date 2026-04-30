-- Adiciona suporte a preco diferenciado para o catalogo publico (preco que o bot mostra ao cliente)
-- e flag para indicar qual preco eh o "principal" usado em vendas e agendamentos.

ALTER TABLE "variacoes_produto" ADD COLUMN "precoCatalogo" DOUBLE PRECISION;
ALTER TABLE "variacoes_produto" ADD COLUMN "usarPrecoCatalogo" BOOLEAN NOT NULL DEFAULT false;
