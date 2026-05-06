-- Sub-fase 3.5: tools do agente IA + auditoria de acoes.

ALTER TABLE "bots" ADD COLUMN "toolsHabilitadas" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "auditoria_acoes_agente" (
    "id" TEXT NOT NULL,
    "execucaoId" TEXT NOT NULL,
    "noId" TEXT,
    "toolNome" TEXT NOT NULL,
    "args" JSONB,
    "sucesso" BOOLEAN NOT NULL,
    "resultado" JSONB,
    "erro" TEXT,
    "duracaoMs" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_acoes_agente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_acoes_agente_execucaoId_criadoEm_idx" ON "auditoria_acoes_agente"("execucaoId", "criadoEm");
CREATE INDEX "auditoria_acoes_agente_toolNome_idx" ON "auditoria_acoes_agente"("toolNome");
