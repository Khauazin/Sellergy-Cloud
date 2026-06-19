/*
  Warnings:

  - The values [INSTAGRAM,WEBSITE,TELEGRAM] on the enum `Canal` will be removed. If these variants are still used in the database, this will fail.
  - The values [TELEGRAM_BOT_TOKEN] on the enum `TipoCredencial` will be removed. If these variants are still used in the database, this will fail.
  - The `segmento` column on the `clientes` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SegmentoCliente" AS ENUM ('SERVICO', 'PRODUTO', 'HIBRIDO');

-- AlterEnum
BEGIN;
CREATE TYPE "Canal_new" AS ENUM ('WHATSAPP');
ALTER TABLE "bots" ALTER COLUMN "canal" DROP DEFAULT;
ALTER TABLE "conversas" ALTER COLUMN "canal" DROP DEFAULT;
ALTER TABLE "bots" ALTER COLUMN "canal" TYPE "Canal_new" USING ("canal"::text::"Canal_new");
ALTER TABLE "conversas" ALTER COLUMN "canal" TYPE "Canal_new" USING ("canal"::text::"Canal_new");
ALTER TYPE "Canal" RENAME TO "Canal_old";
ALTER TYPE "Canal_new" RENAME TO "Canal";
DROP TYPE "Canal_old";
ALTER TABLE "bots" ALTER COLUMN "canal" SET DEFAULT 'WHATSAPP';
ALTER TABLE "conversas" ALTER COLUMN "canal" SET DEFAULT 'WHATSAPP';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TipoCredencial_new" AS ENUM ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'WHATSAPP_CLOUD_TOKEN', 'HTTP_BEARER', 'HTTP_BASIC', 'HTTP_API_KEY', 'OUTRO');
ALTER TABLE "credenciais" ALTER COLUMN "tipo" TYPE "TipoCredencial_new" USING ("tipo"::text::"TipoCredencial_new");
ALTER TYPE "TipoCredencial" RENAME TO "TipoCredencial_old";
ALTER TYPE "TipoCredencial_new" RENAME TO "TipoCredencial";
DROP TYPE "TipoCredencial_old";
COMMIT;

-- AlterTable
ALTER TABLE "clientes" DROP COLUMN "segmento",
ADD COLUMN     "segmento" "SegmentoCliente";
