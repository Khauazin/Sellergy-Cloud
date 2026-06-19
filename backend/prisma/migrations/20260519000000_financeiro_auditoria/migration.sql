-- Auditoria financeira: quem fez cada acao
-- ============================================================

-- 1. Snapshot do usuario em SaldoHistorico (ajuste manual de saldo).
ALTER TABLE "saldo_historico" ADD COLUMN "usuarioId" TEXT;
ALTER TABLE "saldo_historico" ADD COLUMN "usuarioNome" TEXT;

-- 2. Novo log de mudancas em lancamentos financeiros.
-- lancamentoId nullable + SET NULL: log sobrevive ao delete do lancamento
-- (trilha de auditoria preservada via snapshot em alteracoes).
CREATE TABLE "lancamento_historico" (
    "id" TEXT NOT NULL,
    "lancamentoId" TEXT,
    "acao" TEXT NOT NULL,
    "alteracoes" JSONB,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamento_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lancamento_historico_lancamentoId_criadoEm_idx"
  ON "lancamento_historico"("lancamentoId", "criadoEm");

ALTER TABLE "lancamento_historico"
  ADD CONSTRAINT "lancamento_historico_lancamentoId_fkey"
  FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
