-- Fase 1 do engine de workflows: nos do MVP, execucao e indices.

-- AlterEnum: novos tipos de no do MVP (MANUAL, IF, SET, CODE).
ALTER TYPE "TipoNo" ADD VALUE 'MANUAL';
ALTER TYPE "TipoNo" ADD VALUE 'IF';
ALTER TYPE "TipoNo" ADD VALUE 'SET';
ALTER TYPE "TipoNo" ADD VALUE 'CODE';

-- CreateEnum
CREATE TYPE "StatusExecucao" AS ENUM ('PENDENTE', 'EM_EXECUCAO', 'SUCESSO', 'ERRO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ModoExecucao" AS ENUM ('MANUAL', 'WEBHOOK', 'SCHEDULE');

-- CreateTable
CREATE TABLE "execucoes" (
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "status" "StatusExecucao" NOT NULL DEFAULT 'PENDENTE',
    "modo" "ModoExecucao" NOT NULL DEFAULT 'MANUAL',
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),
    "duracaoMs" INTEGER,
    "dadosGatilho" JSONB,
    "erro" TEXT,
    "iniciadaPorId" TEXT,

    CONSTRAINT "execucoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execucoes_nos" (
    "id" TEXT NOT NULL,
    "execucaoId" TEXT NOT NULL,
    "noId" TEXT NOT NULL,
    "tipo" "TipoNo" NOT NULL,
    "status" "StatusExecucao" NOT NULL DEFAULT 'PENDENTE',
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),
    "duracaoMs" INTEGER,
    "entrada" JSONB,
    "saida" JSONB,
    "erro" TEXT,

    CONSTRAINT "execucoes_nos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fluxos_botId_idx" ON "fluxos"("botId");

-- CreateIndex
CREATE INDEX "nos_fluxoId_idx" ON "nos"("fluxoId");

-- CreateIndex
CREATE INDEX "conexoes_fluxoId_idx" ON "conexoes"("fluxoId");

-- CreateIndex
CREATE INDEX "execucoes_fluxoId_iniciadaEm_idx" ON "execucoes"("fluxoId", "iniciadaEm" DESC);

-- CreateIndex
CREATE INDEX "execucoes_status_idx" ON "execucoes"("status");

-- CreateIndex
CREATE INDEX "execucoes_nos_execucaoId_idx" ON "execucoes_nos"("execucaoId");

-- AddForeignKey
ALTER TABLE "execucoes" ADD CONSTRAINT "execucoes_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes" ADD CONSTRAINT "execucoes_iniciadaPorId_fkey" FOREIGN KEY ("iniciadaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execucoes_nos" ADD CONSTRAINT "execucoes_nos_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES "execucoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
