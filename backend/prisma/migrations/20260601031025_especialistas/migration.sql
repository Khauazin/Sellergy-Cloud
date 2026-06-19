-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "politicasAgente" JSONB;

-- CreateTable
CREATE TABLE "faq_bot" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_bot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_bot_botId_ativo_idx" ON "faq_bot"("botId", "ativo");

-- AddForeignKey
ALTER TABLE "faq_bot" ADD CONSTRAINT "faq_bot_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
