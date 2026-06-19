-- Sessoes de caixa + tipo de movimentacao no SaldoHistorico
-- ============================================================
-- Modelagem:
--   SessaoCaixa: 1 sessao aberta por vez (constraint indireta no app).
--     - MANUAL: aberta pelo usuario com fundo inicial
--     - AUTO_BOT: criada pelo cron 00:00 ou ao chegar venda do bot
--   SaldoHistorico ganha tipo (SUPRIMENTO/SANGRIA/AJUSTE) + sessaoCaixaId
--   Venda e LancamentoFinanceiro ganham sessaoCaixaId nullable

-- 1. Enums
CREATE TYPE "StatusSessaoCaixa" AS ENUM ('ABERTA', 'FECHADA');
CREATE TYPE "OrigemSessaoCaixa" AS ENUM ('MANUAL', 'AUTO_BOT');
CREATE TYPE "TipoMovimentoCaixa" AS ENUM ('SUPRIMENTO', 'SANGRIA', 'AJUSTE');

-- 2. Tabela SessaoCaixa
CREATE TABLE "sessoes_caixa" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fundoCaixa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoFinalEsperado" DOUBLE PRECISION,
    "saldoFinalReal" DOUBLE PRECISION,
    "diferenca" DOUBLE PRECISION,
    "observacaoAbertura" TEXT,
    "observacaoFechamento" TEXT,
    "usuarioAbriuId" TEXT,
    "usuarioAbriuNome" TEXT,
    "usuarioFechouId" TEXT,
    "usuarioFechouNome" TEXT,
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),
    "status" "StatusSessaoCaixa" NOT NULL DEFAULT 'ABERTA',
    "origem" "OrigemSessaoCaixa" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "sessoes_caixa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sessoes_caixa_clienteId_status_idx" ON "sessoes_caixa"("clienteId", "status");
CREATE INDEX "sessoes_caixa_clienteId_abertaEm_idx" ON "sessoes_caixa"("clienteId", "abertaEm");

ALTER TABLE "sessoes_caixa"
  ADD CONSTRAINT "sessoes_caixa_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. SaldoHistorico: tipo + sessaoCaixaId
ALTER TABLE "saldo_historico" ADD COLUMN "tipo" "TipoMovimentoCaixa" NOT NULL DEFAULT 'AJUSTE';
ALTER TABLE "saldo_historico" ADD COLUMN "sessaoCaixaId" TEXT;

CREATE INDEX "saldo_historico_sessaoCaixaId_data_idx" ON "saldo_historico"("sessaoCaixaId", "data");

ALTER TABLE "saldo_historico"
  ADD CONSTRAINT "saldo_historico_sessaoCaixaId_fkey"
  FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Venda ganha sessaoCaixaId
ALTER TABLE "vendas" ADD COLUMN "sessaoCaixaId" TEXT;
CREATE INDEX "vendas_sessaoCaixaId_idx" ON "vendas"("sessaoCaixaId");

ALTER TABLE "vendas"
  ADD CONSTRAINT "vendas_sessaoCaixaId_fkey"
  FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. LancamentoFinanceiro ganha sessaoCaixaId
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "sessaoCaixaId" TEXT;
CREATE INDEX "lancamentos_financeiros_sessaoCaixaId_idx" ON "lancamentos_financeiros"("sessaoCaixaId");

ALTER TABLE "lancamentos_financeiros"
  ADD CONSTRAINT "lancamentos_financeiros_sessaoCaixaId_fkey"
  FOREIGN KEY ("sessaoCaixaId") REFERENCES "sessoes_caixa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Cliente ganha horarioFuncionamento (JSON nullable)
ALTER TABLE "clientes" ADD COLUMN "horarioFuncionamento" JSONB;
