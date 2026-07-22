-- AlterTable
ALTER TABLE "configuracoes_fiscal" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cnae" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "emailEmitente" TEXT,
ADD COLUMN     "inscricaoMunicipal" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "municipio" TEXT,
ADD COLUMN     "nomeFantasia" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "razaoSocial" TEXT,
ADD COLUMN     "telefoneEmitente" TEXT,
ADD COLUMN     "uf" TEXT;

-- AlterTable
ALTER TABLE "documentos_fiscais" ADD COLUMN     "baseValor" TEXT,
ADD COLUMN     "valorTotal" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "documento_fiscal_itens" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "variacaoId" TEXT,
    "descricao" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "valorUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ncm" TEXT,
    "cfop" TEXT,
    "cest" TEXT,

    CONSTRAINT "documento_fiscal_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documento_fiscal_itens_documentoId_idx" ON "documento_fiscal_itens"("documentoId");

-- AddForeignKey
ALTER TABLE "documento_fiscal_itens" ADD CONSTRAINT "documento_fiscal_itens_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos_fiscais"("id") ON DELETE CASCADE ON UPDATE CASCADE;
