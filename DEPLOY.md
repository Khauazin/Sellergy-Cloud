# Deploy — Sellergy Cloud (Docker, produção)

Sobe a stack inteira num servidor (VPS Linux com Docker): **postgres, redis, minio**
(internos), **backend** (API), **worker** e **frontend** (build estático via nginx).

> O `docker-compose.yml` original continua sendo o de **desenvolvimento** (hot reload,
> ngrok, pgadmin). Produção usa o `docker-compose.prod.yml`.

## 1. Pré-requisitos
- Docker + Docker Compose no servidor.
- (Recomendado) 3 subdomínios apontando pro servidor: `app.` (front), `api.` (backend), `cdn.` (minio).

## 2. Variáveis
```bash
cp .env.production.example .env
# preencha; gere segredos fortes:  openssl rand -hex 32
```
Pontos que importam: `JWT_SECRET` e `MENSAGENS_MASTER_KEY` fortes (nunca os de dev),
`CORS_ORIGINS` = domínio real do front (sem localhost), `VITE_API_URL` = URL pública da API,
`MINIO_ENDPOINT` = URL pública do MinIO.

## 3. Subir
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
O backend roda **`prisma migrate deploy`** sozinho no start (aplica as migrações). Logs:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
```
Seed inicial (categorias padrão etc.), se precisar:
```bash
docker compose -f docker-compose.prod.yml exec backend npm run -s prisma:seed || \
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

## 4. HTTPS / domínio (reverse proxy)
O compose expõe o front na porta 80 e a API na `BACKEND_PORT`, **sem TLS**. Em produção,
coloque um reverse proxy com HTTPS automático na frente, roteando:
- `app.seu-dominio` → `frontend:80`
- `api.seu-dominio` → `backend:3333`
- `cdn.seu-dominio` → `minio:9000`

Recomendo **Caddy** (TLS Let's Encrypt automático). Posso gerar o `Caddyfile` + o serviço no
compose se você quiser — é o passo que fecha o HTTPS.

## 5. MinIO / imagens
As imagens usam **URLs assinadas** geradas com `MINIO_ENDPOINT`. Esse endpoint precisa ser
**público** (ex.: `cdn.seu-dominio`) pro navegador conseguir abrir as imagens. Sem proxy
público pro MinIO, as fotos não carregam de fora.

## 6. Atualizar (nova versão)
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
As migrações pendentes rodam sozinhas no start do backend.

## 7. Segurança (já aplicada aqui)
- Postgres / Redis / MinIO **sem porta pública** (só a rede interna do Docker).
- `.env` fora das imagens (`.dockerignore` no back e no front).
- `NODE_ENV=production`, `helmet` ativo, **CORS restrito** a `CORS_ORIGINS`.
- `FISCAL_LIVE=false` (emissão real só depois da homologação SEFAZ).

Checklist antes de expor: segredos fortes ✓ · `CORS_ORIGINS` = domínio real ✓ · TLS na frente ✓.

## Alternativa: front na Vercel (em vez do Docker)
Se preferir o front na **Vercel** (deploy automático do git, CDN, HTTPS grátis):
1. Vercel → novo projeto no repo, **Root Directory = `frontend/`**, build `npm run build`, output `dist`.
2. Env vars na Vercel: `VITE_API_URL=https://api.seu-dominio.com` (e `VITE_URL_PUBLICA`).
3. No `docker-compose.prod.yml`, **remova o serviço `frontend`** (sobe só back/worker/db/redis/minio).
4. Ajuste `CORS_ORIGINS` do backend pro domínio da Vercel.

> Só o **front** cabe bem na Vercel (estático). O backend (Express + Postgres + Redis + BullMQ +
> Socket.io + MinIO) é stateful/long-running — **não** roda em serverless; fica no Docker/VPS.
> Renomear o repo (para "sellergy cloud") não afeta o Docker; só importa pro nome do projeto na Vercel.
