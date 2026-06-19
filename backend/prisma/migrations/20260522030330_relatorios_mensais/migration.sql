-- CreateTable
CREATE TABLE "relatorios_mensais" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dados" JSONB NOT NULL,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geradoPor" TEXT,

    CONSTRAINT "relatorios_mensais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "relatorios_mensais_clienteId_ano_mes_idx" ON "relatorios_mensais"("clienteId", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "relatorios_mensais_clienteId_ano_mes_key" ON "relatorios_mensais"("clienteId", "ano", "mes");

-- AddForeignKey
ALTER TABLE "relatorios_mensais" ADD CONSTRAINT "relatorios_mensais_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
