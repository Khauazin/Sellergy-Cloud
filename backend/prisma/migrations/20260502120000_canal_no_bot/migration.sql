-- Sub-fase 3.7: configuracao de canal no bot.
-- Bot ganha:
--   credencialCanalId  -> FK pra Credencial (token do canal)
--   identificadorCanal -> ex: phoneNumberId WhatsApp, chatId Telegram
--   verifyTokenCanal   -> usado pelo GET de verificacao da Meta
--   fluxoPadraoId      -> fluxo disparado quando uma mensagem entra

ALTER TABLE "bots" ADD COLUMN "credencialCanalId" TEXT;
ALTER TABLE "bots" ADD COLUMN "identificadorCanal" TEXT;
ALTER TABLE "bots" ADD COLUMN "verifyTokenCanal" TEXT;
ALTER TABLE "bots" ADD COLUMN "fluxoPadraoId" TEXT;

-- A FK pra fluxo precisa ser SET NULL pra nao quebrar quando o fluxo for excluido.
ALTER TABLE "bots" ADD CONSTRAINT "bots_fluxoPadraoId_fkey" FOREIGN KEY ("fluxoPadraoId") REFERENCES "fluxos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
