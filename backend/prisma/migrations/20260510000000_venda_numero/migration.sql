-- Numero sequencial humano por tenant na tabela `vendas`.
-- Cada cliente comeca em 1. O `id` UUID continua sendo a PK tecnica.

-- 1. Adiciona a coluna como NULLABLE (permite o backfill).
ALTER TABLE "vendas" ADD COLUMN "numero" INTEGER;

-- 2. BACKFILL: numera vendas existentes por tenant, ordenadas por criadoEm asc.
-- Cada cliente recebe sua propria sequencia comecando em 1.
WITH numerado AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "clienteId" ORDER BY "criadoEm" ASC, id ASC) AS rn
  FROM "vendas"
)
UPDATE "vendas" v
SET "numero" = n.rn
FROM numerado n
WHERE v.id = n.id;

-- 3. Torna NOT NULL (todos preenchidos pelo backfill).
ALTER TABLE "vendas" ALTER COLUMN "numero" SET NOT NULL;

-- 4. Constraint de unicidade por tenant — garante numeracao consistente
-- e evita duplicacao em race conditions (insert paralelo de mesma empresa
-- vai falhar; o controller faz retry).
CREATE UNIQUE INDEX "vendas_clienteId_numero_key" ON "vendas"("clienteId", "numero");
