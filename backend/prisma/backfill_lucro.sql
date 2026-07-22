-- Backfill: alinha os produtos existentes ao modelo "custo + lucro".
-- Define lucroValor = preco - precoCusto (modo VALOR), preservando o preco atual.
-- Rodar UMA vez, logo apos a migracao `produto_custo_lucro`.
UPDATE variacoes_produto
SET "lucroValor" = GREATEST("preco" - COALESCE("precoCusto", 0), 0)
WHERE "lucroTipo" = 'VALOR' AND COALESCE("lucroValor", 0) = 0;
