-- CreateEnum
CREATE TYPE "PeriodicidadeContaPagar" AS ENUM ('PONTUAL', 'MENSAL', 'ANUAL');

-- AlterTable
ALTER TABLE "lancamentos_financeiros" ADD COLUMN     "contaPagarId" TEXT;

-- CreateTable
CREATE TABLE "contas_pagar" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorPadrao" DOUBLE PRECISION NOT NULL,
    "categoriaId" TEXT,
    "periodicidade" "PeriodicidadeContaPagar" NOT NULL DEFAULT 'MENSAL',
    "diaVencimento" INTEGER,
    "mesVencimento" INTEGER,
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_pagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contas_pagar_clienteId_ativa_idx" ON "contas_pagar"("clienteId", "ativa");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_contaPagarId_idx" ON "lancamentos_financeiros"("contaPagarId");

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_contaPagarId_fkey" FOREIGN KEY ("contaPagarId") REFERENCES "contas_pagar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_pagar" ADD CONSTRAINT "contas_pagar_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_financeiras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
