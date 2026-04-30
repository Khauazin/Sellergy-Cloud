-- Branding (white-label) por tenant: logo + nome customizado
ALTER TABLE "clientes" ADD COLUMN "brandLogo" TEXT;
ALTER TABLE "clientes" ADD COLUMN "brandNome" TEXT;

-- Foto pessoal do usuario (avatar)
ALTER TABLE "usuarios" ADD COLUMN "foto" TEXT;
