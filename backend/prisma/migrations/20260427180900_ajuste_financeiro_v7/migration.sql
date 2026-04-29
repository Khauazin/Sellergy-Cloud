-- CreateTable
CREATE TABLE "saldo_historico" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldo_historico_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "saldo_historico" ADD CONSTRAINT "saldo_historico_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
