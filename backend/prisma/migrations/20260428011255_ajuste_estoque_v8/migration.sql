/*
  Warnings:

  - You are about to drop the column `estoqueMinimo` on the `produtos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "produtos" DROP COLUMN "estoqueMinimo";

-- AlterTable
ALTER TABLE "variacoes_produto" ADD COLUMN     "estoqueIdeal" INTEGER DEFAULT 0,
ADD COLUMN     "estoqueMinimo" INTEGER DEFAULT 0,
ADD COLUMN     "localizacao" TEXT,
ADD COLUMN     "precoCusto" DOUBLE PRECISION DEFAULT 0;
