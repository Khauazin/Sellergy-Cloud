/*
  Warnings:

  - You are about to drop the column `aiApiKey` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `aiModel` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `aiProvider` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `aiSystemPrompt` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `aiTemperature` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `channel` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `lastActivityAt` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `messagesToday` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `messagesTotal` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `bots` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `bots` table. All the data in the column will be lost.
  - The `status` column on the `bots` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `clientId` on the `categorias_financeiras` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `lancamentos_financeiros` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `lancamentos_financeiros` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `lancamentos_financeiros` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `lastContact` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `origin` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `stageId` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `produtos` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `produtos` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `produtos` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `saldo_historico` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `variacoes_produto` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `variacoes_produto` table. All the data in the column will be lost.
  - You are about to drop the `alerts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `appointments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bot_variables` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `clients` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `edges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `flows` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lead_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lead_stages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nodes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sales` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `atualizadoEm` to the `bots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `bots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `bots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `categorias_financeiras` table without a default value. This is not possible if the table is not empty.
  - Added the required column `atualizadoEm` to the `lancamentos_financeiros` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `lancamentos_financeiros` table without a default value. This is not possible if the table is not empty.
  - Added the required column `atualizadoEm` to the `leads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `leads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `leads` table without a default value. This is not possible if the table is not empty.
  - Added the required column `atualizadoEm` to the `produtos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `produtos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clienteId` to the `saldo_historico` table without a default value. This is not possible if the table is not empty.
  - Added the required column `atualizadoEm` to the `variacoes_produto` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMIN', 'VIEWER', 'CLIENT');

-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('BASIC', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StatusBot" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "TipoGatilho" AS ENUM ('KEYWORD', 'DEFAULT', 'ALWAYS');

-- CreateEnum
CREATE TYPE "TipoNo" AS ENUM ('MESSAGE', 'QUESTION', 'CONDITION', 'DELAY', 'HTTP_REQUEST', 'UPDATE_LEAD');

-- CreateEnum
CREATE TYPE "TipoVariavel" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "ProvedorIA" AS ENUM ('OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'CUSTOM', 'GEMINI');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "OrigemAgendamento" AS ENUM ('MANUAL', 'AI');

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_botId_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_clientId_fkey";

-- DropForeignKey
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_userId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_clientId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_leadId_fkey";

-- DropForeignKey
ALTER TABLE "bot_variables" DROP CONSTRAINT "bot_variables_botId_fkey";

-- DropForeignKey
ALTER TABLE "bots" DROP CONSTRAINT "bots_clientId_fkey";

-- DropForeignKey
ALTER TABLE "categorias_financeiras" DROP CONSTRAINT "categorias_financeiras_clientId_fkey";

-- DropForeignKey
ALTER TABLE "edges" DROP CONSTRAINT "edges_flowId_fkey";

-- DropForeignKey
ALTER TABLE "flows" DROP CONSTRAINT "flows_botId_fkey";

-- DropForeignKey
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT "lancamentos_financeiros_clientId_fkey";

-- DropForeignKey
ALTER TABLE "lancamentos_financeiros" DROP CONSTRAINT "lancamentos_financeiros_vendaId_fkey";

-- DropForeignKey
ALTER TABLE "lead_history" DROP CONSTRAINT "lead_history_leadId_fkey";

-- DropForeignKey
ALTER TABLE "lead_stages" DROP CONSTRAINT "lead_stages_clientId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_clientId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_stageId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_leadId_fkey";

-- DropForeignKey
ALTER TABLE "movimentacoes_estoque" DROP CONSTRAINT "movimentacoes_estoque_vendaId_fkey";

-- DropForeignKey
ALTER TABLE "nodes" DROP CONSTRAINT "nodes_flowId_fkey";

-- DropForeignKey
ALTER TABLE "produtos" DROP CONSTRAINT "produtos_clientId_fkey";

-- DropForeignKey
ALTER TABLE "saldo_historico" DROP CONSTRAINT "saldo_historico_clientId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_clientId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_leadId_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_clientId_fkey";

-- AlterTable
ALTER TABLE "bots" DROP COLUMN "aiApiKey",
DROP COLUMN "aiModel",
DROP COLUMN "aiProvider",
DROP COLUMN "aiSystemPrompt",
DROP COLUMN "aiTemperature",
DROP COLUMN "channel",
DROP COLUMN "clientId",
DROP COLUMN "createdAt",
DROP COLUMN "lastActivityAt",
DROP COLUMN "messagesToday",
DROP COLUMN "messagesTotal",
DROP COLUMN "name",
DROP COLUMN "phoneNumber",
DROP COLUMN "updatedAt",
ADD COLUMN     "apiKeyIa" TEXT,
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "canal" "Canal" NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mensagensHoje" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "modeloIa" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "promptSistemaIa" TEXT,
ADD COLUMN     "provedorIa" "ProvedorIA",
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "temperaturaIa" DOUBLE PRECISION DEFAULT 0.7,
ADD COLUMN     "totalMensagens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimaAtividadeEm" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "StatusBot" NOT NULL DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE "categorias_financeiras" DROP COLUMN "clientId",
ADD COLUMN     "clienteId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "lancamentos_financeiros" DROP COLUMN "clientId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "clientId",
DROP COLUMN "createdAt",
DROP COLUMN "lastContact",
DROP COLUMN "name",
DROP COLUMN "notes",
DROP COLUMN "origin",
DROP COLUMN "phone",
DROP COLUMN "priority",
DROP COLUMN "stageId",
DROP COLUMN "updatedAt",
DROP COLUMN "value",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "etapaId" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "ultimoContato" TIMESTAMP(3),
ADD COLUMN     "valor" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "produtos" DROP COLUMN "clientId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "saldo_historico" DROP COLUMN "clientId",
ADD COLUMN     "clienteId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "variacoes_produto" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "atualizadoEm" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "alerts";

-- DropTable
DROP TABLE "appointments";

-- DropTable
DROP TABLE "bot_variables";

-- DropTable
DROP TABLE "clients";

-- DropTable
DROP TABLE "edges";

-- DropTable
DROP TABLE "flows";

-- DropTable
DROP TABLE "lead_history";

-- DropTable
DROP TABLE "lead_stages";

-- DropTable
DROP TABLE "messages";

-- DropTable
DROP TABLE "nodes";

-- DropTable
DROP TABLE "sales";

-- DropTable
DROP TABLE "users";

-- DropEnum
DROP TYPE "AIProvider";

-- DropEnum
DROP TYPE "AlertStatus";

-- DropEnum
DROP TYPE "AppointmentOrigin";

-- DropEnum
DROP TYPE "AppointmentStatus";

-- DropEnum
DROP TYPE "BotStatus";

-- DropEnum
DROP TYPE "Channel";

-- DropEnum
DROP TYPE "ClientStatus";

-- DropEnum
DROP TYPE "NodeType";

-- DropEnum
DROP TYPE "Plan";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "SaleStatus";

-- DropEnum
DROP TYPE "Severity";

-- DropEnum
DROP TYPE "TriggerType";

-- DropEnum
DROP TYPE "VarType";

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'ADMIN',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "clienteId" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "segmento" TEXT,
    "plano" "Plano" NOT NULL DEFAULT 'BASIC',
    "status" "StatusCliente" NOT NULL DEFAULT 'ACTIVE',
    "mensalidade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_variaveis" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoVariavel" NOT NULL DEFAULT 'TEXT',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_variaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fluxos" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "tipoGatilho" "TipoGatilho" NOT NULL DEFAULT 'KEYWORD',
    "palavraChaveGatilho" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fluxos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nos" (
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "tipo" "TipoNo" NOT NULL,
    "posicaoX" DOUBLE PRECISION NOT NULL,
    "posicaoY" DOUBLE PRECISION NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conexoes" (
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "noOrigemId" TEXT NOT NULL,
    "noDestinoId" TEXT NOT NULL,
    "pontoOrigem" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conexoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_etapas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "cor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_historico" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "deEtapa" TEXT,
    "paraEtapa" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "doBot" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "leadId" TEXT,
    "nomeCliente" TEXT NOT NULL,
    "telefoneCliente" TEXT,
    "duracao" INTEGER NOT NULL DEFAULT 30,
    "origem" "OrigemAgendamento" NOT NULL DEFAULT 'MANUAL',
    "data" TIMESTAMP(3) NOT NULL,
    "servico" TEXT,
    "preco" DOUBLE PRECISION,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'PENDING',
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "leadId" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodoPagamento" TEXT,
    "status" "StatusVenda" NOT NULL DEFAULT 'COMPLETED',
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "severidade" "Severidade" NOT NULL DEFAULT 'ERROR',
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" "StatusAlerta" NOT NULL DEFAULT 'OPEN',
    "resolvidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bot_variaveis_botId_chave_key" ON "bot_variaveis"("botId", "chave");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_historico" ADD CONSTRAINT "saldo_historico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bots" ADD CONSTRAINT "bots_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_variaveis" ADD CONSTRAINT "bot_variaveis_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fluxos" ADD CONSTRAINT "fluxos_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nos" ADD CONSTRAINT "nos_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conexoes" ADD CONSTRAINT "conexoes_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_etapas" ADD CONSTRAINT "lead_etapas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "lead_etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_historico" ADD CONSTRAINT "lead_historico_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_financeiras" ADD CONSTRAINT "categorias_financeiras_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
