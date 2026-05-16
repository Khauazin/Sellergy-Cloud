-- Log auditavel de mudancas em agendamentos.
-- Cada acao (criar/editar/mudar status/excluir) gera 1 linha aqui.
-- alteracoes: JSON { campo: { de, para } } registrando o diff.
-- usuarioId/usuarioNome: snapshot pra preservar mesmo se usuario for deletado.
-- agendamentoId nullable + SET NULL: log sobrevive a delete do agendamento
-- (auditoria preserva o trail; snapshot guardado em alteracoes identifica).
CREATE TABLE "agendamento_historico" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT,
    "acao" TEXT NOT NULL,
    "alteracoes" JSONB,
    "usuarioId" TEXT,
    "usuarioNome" TEXT,
    "origem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamento_historico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agendamento_historico_agendamentoId_criadoEm_idx"
  ON "agendamento_historico"("agendamentoId", "criadoEm");

ALTER TABLE "agendamento_historico"
  ADD CONSTRAINT "agendamento_historico_agendamentoId_fkey"
  FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
