/*
  Warnings:

  - The values [OPENAI_API_KEY,ANTHROPIC_API_KEY,GEMINI_API_KEY] on the enum `TipoCredencial` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProvedorPagamento" AS ENUM ('MERCADO_PAGO', 'ASAAS', 'PAGARME');

-- CreateEnum
CREATE TYPE "OrigemCobranca" AS ENUM ('VENDA', 'AGENDAMENTO', 'AVULSA');

-- CreateEnum
CREATE TYPE "MetodoCobranca" AS ENUM ('PIX', 'LINK', 'CARTAO', 'RECORRENCIA');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGO', 'EXPIRADO', 'CANCELADO', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "ProvedorFiscal" AS ENUM ('FOCUS_NFE', 'NUVEM_FISCAL');

-- CreateEnum
CREATE TYPE "TipoDocumentoFiscal" AS ENUM ('NFCE', 'NFSE');

-- CreateEnum
CREATE TYPE "StatusDocumentoFiscal" AS ENUM ('PENDENTE', 'PROCESSANDO', 'EMITIDA', 'ERRO', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AmbienteFiscal" AS ENUM ('HOMOLOGACAO', 'PRODUCAO');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoCredencial_new" AS ENUM ('WHATSAPP_CLOUD_TOKEN', 'MERCADO_PAGO_KEY', 'ASAAS_KEY', 'PAGARME_KEY', 'FOCUS_NFE_KEY', 'NUVEM_FISCAL_KEY', 'HTTP_BEARER', 'HTTP_BASIC', 'HTTP_API_KEY', 'OUTRO');
ALTER TABLE "credenciais" ALTER COLUMN "tipo" TYPE "TipoCredencial_new" USING ("tipo"::text::"TipoCredencial_new");
ALTER TYPE "TipoCredencial" RENAME TO "TipoCredencial_old";
ALTER TYPE "TipoCredencial_new" RENAME TO "TipoCredencial";
DROP TYPE "TipoCredencial_old";
COMMIT;

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "menuConfig" JSONB;

-- CreateTable
CREATE TABLE "configuracoes_pagamento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "provedor" "ProvedorPagamento" NOT NULL,
    "credencialId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "origem" "OrigemCobranca" NOT NULL,
    "refId" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" "MetodoCobranca" NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "provedor" "ProvedorPagamento" NOT NULL,
    "provedorCobrancaId" TEXT,
    "qrCode" TEXT,
    "linkUrl" TEXT,
    "vencimento" TIMESTAMP(3),
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_fiscal" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "provedor" "ProvedorFiscal" NOT NULL,
    "credencialId" TEXT,
    "regime" TEXT,
    "cnpj" TEXT,
    "inscricao" TEXT,
    "certificadoRef" TEXT,
    "csc" TEXT,
    "serie" TEXT,
    "ambiente" "AmbienteFiscal" NOT NULL DEFAULT 'HOMOLOGACAO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_fiscais" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "vendaId" TEXT,
    "tipo" "TipoDocumentoFiscal" NOT NULL,
    "status" "StatusDocumentoFiscal" NOT NULL DEFAULT 'PENDENTE',
    "provedor" "ProvedorFiscal" NOT NULL,
    "provedorDocId" TEXT,
    "numero" TEXT,
    "chave" TEXT,
    "urlPdf" TEXT,
    "urlXml" TEXT,
    "mensagemErro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_pagamento_clienteId_key" ON "configuracoes_pagamento"("clienteId");

-- CreateIndex
CREATE INDEX "cobrancas_clienteId_status_idx" ON "cobrancas"("clienteId", "status");

-- CreateIndex
CREATE INDEX "cobrancas_clienteId_origem_refId_idx" ON "cobrancas"("clienteId", "origem", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_provedor_provedorCobrancaId_key" ON "cobrancas"("provedor", "provedorCobrancaId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_fiscal_clienteId_key" ON "configuracoes_fiscal"("clienteId");

-- CreateIndex
CREATE INDEX "documentos_fiscais_clienteId_status_idx" ON "documentos_fiscais"("clienteId", "status");

-- CreateIndex
CREATE INDEX "documentos_fiscais_clienteId_vendaId_idx" ON "documentos_fiscais"("clienteId", "vendaId");

-- CreateIndex
CREATE INDEX "faqs_clienteId_ativo_ordem_idx" ON "faqs"("clienteId", "ativo", "ordem");

-- AddForeignKey
ALTER TABLE "configuracoes_pagamento" ADD CONSTRAINT "configuracoes_pagamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_fiscal" ADD CONSTRAINT "configuracoes_fiscal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
