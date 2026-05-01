-- Sub-fase 2.2: trigger Webhook + preparacao para Schedule.

ALTER TYPE "TipoNo" ADD VALUE 'WEBHOOK';
ALTER TYPE "TipoNo" ADD VALUE 'SCHEDULE';

ALTER TABLE "execucoes" ADD COLUMN "noTriggerId" TEXT;

CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "noId" TEXT NOT NULL,
    "segredo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "exigirHmac" BOOLEAN NOT NULL DEFAULT false,
    "descricao" TEXT,
    "ultimaChamadaEm" TIMESTAMP(3),
    "totalChamadas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhooks_noId_key" ON "webhooks"("noId");
CREATE INDEX "webhooks_fluxoId_idx" ON "webhooks"("fluxoId");

ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
