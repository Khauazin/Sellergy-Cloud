-- AlterTable
ALTER TABLE "agendamentos" ADD COLUMN     "especialistaId" TEXT;

-- CreateTable
CREATE TABLE "especialistas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "jornada" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "especialistas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialista_servicos" (
    "id" TEXT NOT NULL,
    "especialistaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "especialista_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "especialistas_usuarioId_key" ON "especialistas"("usuarioId");

-- CreateIndex
CREATE INDEX "especialistas_clienteId_ativo_idx" ON "especialistas"("clienteId", "ativo");

-- CreateIndex
CREATE INDEX "especialista_servicos_produtoId_idx" ON "especialista_servicos"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "especialista_servicos_especialistaId_produtoId_key" ON "especialista_servicos"("especialistaId", "produtoId");

-- CreateIndex
CREATE INDEX "agendamentos_especialistaId_data_idx" ON "agendamentos"("especialistaId", "data");

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_especialistaId_fkey" FOREIGN KEY ("especialistaId") REFERENCES "especialistas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialistas" ADD CONSTRAINT "especialistas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialistas" ADD CONSTRAINT "especialistas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialista_servicos" ADD CONSTRAINT "especialista_servicos_especialistaId_fkey" FOREIGN KEY ("especialistaId") REFERENCES "especialistas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "especialista_servicos" ADD CONSTRAINT "especialista_servicos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
