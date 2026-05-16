-- Duracao em minutos para variacoes do tipo SERVICO.
-- Nullable porque produtos fisicos nao tem duracao.
-- Agenda usa esse campo pra:
--   1. Pre-preencher duracao quando seleciona o servico
--   2. Calcular sobreposicao de horarios (conflito de agendamento)
ALTER TABLE "variacoes_produto" ADD COLUMN "duracaoMin" INTEGER;
