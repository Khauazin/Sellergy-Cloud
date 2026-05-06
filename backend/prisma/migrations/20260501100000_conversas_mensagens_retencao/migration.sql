-- Sub-fase 2.4: cifragem de mensagens + retencao de logs.

CREATE TYPE "NivelLog" AS ENUM ('NENHUM', 'METADATA', 'COMPLETO');
CREATE TYPE "SentidoMensagem" AS ENUM ('ENTRADA', 'SAIDA');
CREATE TYPE "AutorMensagem" AS ENUM ('BOT', 'CLIENTE_FINAL', 'VENDEDOR', 'SISTEMA');
CREATE TYPE "TipoMensagem" AS ENUM ('TEXTO', 'IMAGEM', 'AUDIO', 'VIDEO', 'ARQUIVO', 'LOCALIZACAO', 'CONTATO', 'STICKER');
CREATE TYPE "StatusEntregaMensagem" AS ENUM ('PENDENTE', 'ENVIADA', 'ENTREGUE', 'LIDA', 'ERRO');

-- Fluxo: nivel de log + retencao por tipo
ALTER TABLE "fluxos" ADD COLUMN "nivelLog" "NivelLog" NOT NULL DEFAULT 'METADATA';
ALTER TABLE "fluxos" ADD COLUMN "diasRetencaoSucesso" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "fluxos" ADD COLUMN "diasRetencaoErro" INTEGER NOT NULL DEFAULT 90;

-- Conversa: agregador metadados em CLARO (canal, ultimaMsgEm, etc.)
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "leadId" TEXT,
    "botId" TEXT,
    "canal" "Canal" NOT NULL DEFAULT 'WHATSAPP',
    "identificador" TEXT,
    "ultimaMsgEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversas_clienteId_ultimaMsgEm_idx" ON "conversas"("clienteId", "ultimaMsgEm" DESC);
CREATE INDEX "conversas_leadId_idx" ON "conversas"("leadId");

-- MensagemConversa: conteudo CIFRADO (AES-256-GCM com chave derivada por tenant).
-- conteudoCifrado, iv, tag em BYTEA. Metadata em CLARO (sem PII).
CREATE TABLE "mensagens_conversa" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sentido" "SentidoMensagem" NOT NULL,
    "autor" "AutorMensagem" NOT NULL,
    "autorUsuarioId" TEXT,
    "tipo" "TipoMensagem" NOT NULL DEFAULT 'TEXTO',
    "statusEntrega" "StatusEntregaMensagem" NOT NULL DEFAULT 'PENDENTE',
    "conteudoCifrado" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "versaoChave" INTEGER NOT NULL DEFAULT 1,
    "midiaUrl" TEXT,
    "midiaTipoMime" TEXT,
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_conversa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mensagens_conversa_conversaId_criadoEm_idx" ON "mensagens_conversa"("conversaId", "criadoEm");
CREATE INDEX "mensagens_conversa_clienteId_idx" ON "mensagens_conversa"("clienteId");

ALTER TABLE "mensagens_conversa" ADD CONSTRAINT "mensagens_conversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditoriaMensagem: append-only de quem leu/criou/excluiu cada mensagem.
CREATE TABLE "auditoria_mensagens" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_mensagens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_mensagens_mensagemId_criadoEm_idx" ON "auditoria_mensagens"("mensagemId", "criadoEm" DESC);
CREATE INDEX "auditoria_mensagens_usuarioId_idx" ON "auditoria_mensagens"("usuarioId");
