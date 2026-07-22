-- CreateEnum
CREATE TYPE "LucroTipo" AS ENUM ('VALOR', 'PERCENTUAL');

-- AlterTable
ALTER TABLE "movimentacoes_estoque" ADD COLUMN     "custoUnitario" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "variacoes_produto" ADD COLUMN     "lucroTipo" "LucroTipo" NOT NULL DEFAULT 'VALOR',
ADD COLUMN     "lucroValor" DOUBLE PRECISION NOT NULL DEFAULT 0;
