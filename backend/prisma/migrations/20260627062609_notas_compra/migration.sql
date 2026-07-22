-- CreateEnum
CREATE TYPE "OrigemNotaCompra" AS ENUM ('MANUAL', 'XML', 'SEM_NOTA');

-- AlterTable
ALTER TABLE "movimentacoes_estoque" ADD COLUMN     "notaCompraId" TEXT;

-- CreateTable
CREATE TABLE "notas_compra" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "numero" TEXT,
    "chaveAcesso" TEXT,
    "origem" "OrigemNotaCompra" NOT NULL DEFAULT 'MANUAL',
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "emitidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_compra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_compra_clienteId_idx" ON "notas_compra"("clienteId");

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_notaCompraId_fkey" FOREIGN KEY ("notaCompraId") REFERENCES "notas_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_compra" ADD CONSTRAINT "notas_compra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_compra" ADD CONSTRAINT "notas_compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
