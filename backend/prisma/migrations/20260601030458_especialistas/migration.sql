-- AlterTable
ALTER TABLE "conversas" ADD COLUMN     "especialistaId" TEXT,
ADD COLUMN     "usuarioId" TEXT;

-- CreateIndex
CREATE INDEX "conversas_especialistaId_idx" ON "conversas"("especialistaId");

-- CreateIndex
CREATE INDEX "conversas_usuarioId_idx" ON "conversas"("usuarioId");

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_especialistaId_fkey" FOREIGN KEY ("especialistaId") REFERENCES "especialistas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
