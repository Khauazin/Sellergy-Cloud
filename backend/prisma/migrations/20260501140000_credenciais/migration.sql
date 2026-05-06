-- Sub-fase 3.3: credenciais cifradas (chaves de API).
-- Cifra AES-256-GCM com chave derivada por tenant (HKDF do mesmo cofre que
-- cifra mensagens, mas com salt 'sellergy-credenciais-v1').

CREATE TYPE "TipoCredencial" AS ENUM (
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
    'WHATSAPP_CLOUD_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'HTTP_BEARER',
    'HTTP_BASIC',
    'HTTP_API_KEY',
    'OUTRO'
);

CREATE TABLE "credenciais" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCredencial" NOT NULL,
    "descricao" TEXT,
    "dadosCifrados" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "tag" BYTEA NOT NULL,
    "versaoChave" INTEGER NOT NULL DEFAULT 1,
    "ultimoUsoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credenciais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "credenciais_clienteId_tipo_idx" ON "credenciais"("clienteId", "tipo");

ALTER TABLE "credenciais" ADD CONSTRAINT "credenciais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credenciais" ADD CONSTRAINT "credenciais_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
