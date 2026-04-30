-- AlterEnum
ALTER TYPE "Perfil" ADD VALUE 'ADMINISTRADOR';
ALTER TYPE "Perfil" ADD VALUE 'VENDEDOR';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "modulosLiberados" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT false;
