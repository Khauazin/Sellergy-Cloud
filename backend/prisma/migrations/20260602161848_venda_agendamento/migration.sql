/*
  Warnings:

  - A unique constraint covering the columns `[agendamentoId]` on the table `vendas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "agendamentoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vendas_agendamentoId_key" ON "vendas"("agendamentoId");

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
