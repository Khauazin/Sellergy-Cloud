-- Estado livre por conversa (pra fluxos manuais multi-turno).
-- Forma sugerida pelo builder: { passo: 'NOME' | 'CPF' | 'EMAIL' | 'PRONTO', ... }
-- mas o engine nao impoe schema — quem usa decide.
ALTER TABLE "conversas" ADD COLUMN "estado" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Novo no: SET_ESTADO_CONVERSA — atualiza Conversa.estado a partir do contexto.
ALTER TYPE "TipoNo" ADD VALUE 'SET_ESTADO_CONVERSA';

-- Novo no: TOOL — invoca uma tool do agente (mesma porta de permissao do AI_AGENT).
ALTER TYPE "TipoNo" ADD VALUE 'TOOL';
