/*
  Warnings:

  - You are about to drop the column `apiKeyIa` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `credencialIaId` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `fluxoPadraoId` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `modeloIa` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `politicasAgente` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `promptSistemaIa` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `provedorIa` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `temperaturaIa` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `toolsHabilitadas` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the `agendamentos_fluxo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `conexoes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `conversas` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execucoes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `execucoes_nos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `faq_bot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fluxos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mensagens_conversa` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `uso_ia` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhooks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "agendamentos_fluxo" DROP CONSTRAINT "agendamentos_fluxo_fluxoId_fkey";

-- DropForeignKey
ALTER TABLE "bots" DROP CONSTRAINT "bots_credencialIaId_fkey";

-- DropForeignKey
ALTER TABLE "bots" DROP CONSTRAINT "bots_fluxoPadraoId_fkey";

-- DropForeignKey
ALTER TABLE "conexoes" DROP CONSTRAINT "conexoes_fluxoId_fkey";

-- DropForeignKey
ALTER TABLE "conversas" DROP CONSTRAINT "conversas_especialistaId_fkey";

-- DropForeignKey
ALTER TABLE "conversas" DROP CONSTRAINT "conversas_leadId_fkey";

-- DropForeignKey
ALTER TABLE "conversas" DROP CONSTRAINT "conversas_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "execucoes" DROP CONSTRAINT "execucoes_fluxoId_fkey";

-- DropForeignKey
ALTER TABLE "execucoes" DROP CONSTRAINT "execucoes_iniciadaPorId_fkey";

-- DropForeignKey
ALTER TABLE "execucoes_nos" DROP CONSTRAINT "execucoes_nos_execucaoId_fkey";

-- DropForeignKey
ALTER TABLE "faq_bot" DROP CONSTRAINT "faq_bot_botId_fkey";

-- DropForeignKey
ALTER TABLE "fluxos" DROP CONSTRAINT "fluxos_botId_fkey";

-- DropForeignKey
ALTER TABLE "mensagens_conversa" DROP CONSTRAINT "mensagens_conversa_conversaId_fkey";

-- DropForeignKey
ALTER TABLE "nos" DROP CONSTRAINT "nos_fluxoId_fkey";

-- DropForeignKey
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_fluxoId_fkey";

-- AlterTable
ALTER TABLE "bots" DROP COLUMN "apiKeyIa",
DROP COLUMN "credencialIaId",
DROP COLUMN "fluxoPadraoId",
DROP COLUMN "modeloIa",
DROP COLUMN "politicasAgente",
DROP COLUMN "promptSistemaIa",
DROP COLUMN "provedorIa",
DROP COLUMN "temperaturaIa",
DROP COLUMN "toolsHabilitadas";

-- DropTable
DROP TABLE "agendamentos_fluxo";

-- DropTable
DROP TABLE "conexoes";

-- DropTable
DROP TABLE "conversas";

-- DropTable
DROP TABLE "execucoes";

-- DropTable
DROP TABLE "execucoes_nos";

-- DropTable
DROP TABLE "faq_bot";

-- DropTable
DROP TABLE "fluxos";

-- DropTable
DROP TABLE "mensagens_conversa";

-- DropTable
DROP TABLE "nos";

-- DropTable
DROP TABLE "uso_ia";

-- DropTable
DROP TABLE "webhooks";

-- DropEnum
DROP TYPE "AutorMensagem";

-- DropEnum
DROP TYPE "ModoExecucao";

-- DropEnum
DROP TYPE "NivelLog";

-- DropEnum
DROP TYPE "ProvedorIA";

-- DropEnum
DROP TYPE "SentidoMensagem";

-- DropEnum
DROP TYPE "StatusEntregaMensagem";

-- DropEnum
DROP TYPE "StatusExecucao";

-- DropEnum
DROP TYPE "TipoGatilho";

-- DropEnum
DROP TYPE "TipoMensagem";

-- DropEnum
DROP TYPE "TipoNo";
