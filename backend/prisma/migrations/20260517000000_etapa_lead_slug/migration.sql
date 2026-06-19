-- Adiciona slug em EtapaLead pra rastrear quais etapas do catalogo pre-definido
-- ja foram habilitadas pelo tenant. Nullable pra preservar etapas legadas
-- criadas com nome livre antes do catalogo.
ALTER TABLE "lead_etapas" ADD COLUMN "slug" TEXT;

-- Unique (clienteId, slug) — impede habilitar a mesma etapa do catalogo duas
-- vezes pro mesmo tenant. Postgres trata NULL como distinto em unique, entao
-- multiplas etapas legadas com slug NULL convivem sem problema.
CREATE UNIQUE INDEX "lead_etapas_clienteId_slug_key" ON "lead_etapas"("clienteId", "slug");
