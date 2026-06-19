-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "credencialIaId" TEXT;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_credencialIaId_fkey" FOREIGN KEY ("credencialIaId") REFERENCES "credenciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
