-- CreateEnum
CREATE TYPE "UsoCategoria" AS ENUM ('SERVICO', 'PRODUTO', 'CAIXA', 'DESPESA');

-- AlterTable
ALTER TABLE "categorias_financeiras" ADD COLUMN     "uso" "UsoCategoria";
