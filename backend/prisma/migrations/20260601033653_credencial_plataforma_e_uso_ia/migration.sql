-- AlterTable
ALTER TABLE "credenciais" ALTER COLUMN "clienteId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "uso_ia" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "botId" TEXT,
    "execucaoId" TEXT,
    "provedor" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uso_ia_clienteId_criadoEm_idx" ON "uso_ia"("clienteId", "criadoEm");
