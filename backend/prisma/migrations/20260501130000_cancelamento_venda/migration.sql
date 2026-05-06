-- Bloco A2: cancelamento de venda. Campos para auditoria + estado fica
-- preservado em Venda.status = CANCELLED.
--
-- Efeitos colaterais (ver docs/regras-de-negocio.md):
--   1. Estorna estoque (cria MovimentacaoEstoque tipo DEVOLUCAO)
--   2. Cancela lancamentos financeiros vinculados (status=CANCELADO)
-- Tudo em transacao na rota POST /vendas/:id/cancelar.

ALTER TABLE "vendas" ADD COLUMN "dataCancelamento" TIMESTAMP(3);
ALTER TABLE "vendas" ADD COLUMN "motivoCancelamento" TEXT;
ALTER TABLE "vendas" ADD COLUMN "canceladaPorId" TEXT;
