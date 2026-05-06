-- Sub-fase 3.4: nó AI_AGENT (LLM call simples).
-- O nó usa o campo `dados` (JSONB) com forma:
--   { provedor, modelo, credencialId, prompt, mensagemUsuario, temperatura, maxTokens }

ALTER TYPE "TipoNo" ADD VALUE 'AI_AGENT';
