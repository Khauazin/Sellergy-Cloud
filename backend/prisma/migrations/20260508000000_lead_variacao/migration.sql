-- Tabela M:N entre Lead e VariacaoProduto.
-- Lead pode ter N variacoes "de interesse", cada uma com quantidade.
-- Usado pelo CRM (manual + bot) pra calcular valor estimado agregado.
CREATE TABLE "lead_variacoes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "variacaoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_variacoes_pkey" PRIMARY KEY ("id")
);

-- Um lead nao pode ter o mesmo SKU duas vezes — agrega na quantidade.
CREATE UNIQUE INDEX "lead_variacoes_leadId_variacaoId_key" ON "lead_variacoes"("leadId", "variacaoId");
CREATE INDEX "lead_variacoes_leadId_idx" ON "lead_variacoes"("leadId");

ALTER TABLE "lead_variacoes" ADD CONSTRAINT "lead_variacoes_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_variacoes" ADD CONSTRAINT "lead_variacoes_variacaoId_fkey"
  FOREIGN KEY ("variacaoId") REFERENCES "variacoes_produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
