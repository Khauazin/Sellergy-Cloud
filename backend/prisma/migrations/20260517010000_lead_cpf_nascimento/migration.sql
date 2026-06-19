-- Adiciona cpf e dataNascimento em Lead.
-- Ambos nullable: lead pode chegar pelo bot sem essas infos e ser completado depois.
-- cpf armazenado so com digitos (sem mascara) — front aplica formatacao na exibicao.
ALTER TABLE "leads" ADD COLUMN "cpf" TEXT;
ALTER TABLE "leads" ADD COLUMN "dataNascimento" TIMESTAMP(3);
