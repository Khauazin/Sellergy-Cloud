-- Sub-fase 2.3: trigger Schedule. Tabela 1:1 com nos do tipo SCHEDULE.

CREATE TABLE "agendamentos_fluxo" (
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "noId" TEXT NOT NULL,
    "expressaoCron" TEXT NOT NULL,
    "fusoHorario" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoDisparoEm" TIMESTAMP(3),
    "proximoDisparoEm" TIMESTAMP(3),
    "totalDisparos" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_fluxo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agendamentos_fluxo_noId_key" ON "agendamentos_fluxo"("noId");
CREATE INDEX "agendamentos_fluxo_fluxoId_idx" ON "agendamentos_fluxo"("fluxoId");

ALTER TABLE "agendamentos_fluxo" ADD CONSTRAINT "agendamentos_fluxo_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
