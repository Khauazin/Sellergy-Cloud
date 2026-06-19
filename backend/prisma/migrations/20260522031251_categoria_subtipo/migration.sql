-- CreateEnum
CREATE TYPE "SubTipoCategoria" AS ENUM ('VARIAVEL', 'FIXA');

-- AlterTable
ALTER TABLE "categorias_financeiras" ADD COLUMN     "subTipo" "SubTipoCategoria";
