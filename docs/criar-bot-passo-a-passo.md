# Manual — Criar um bot de atendimento (WhatsApp + IA)

> Tutorial prático de ponta-a-ponta. Sai do zero e termina com um bot que
> recebe mensagem no WhatsApp, conduz atendimento, registra lead e responde.
> Atualizado em 2026-05-02.

---

## Sumário

1. [Visão geral do que vai acontecer](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Configurar app na Meta (WhatsApp Cloud API)](#3-configurar-app-na-meta)
4. [Cadastrar credencial no Sellergy](#4-cadastrar-credencial-no-sellergy)
5. [Criar o bot](#5-criar-o-bot)
6. [Construir o fluxo de atendimento](#6-construir-o-fluxo)
7. [Habilitar tools do agente](#7-habilitar-tools)
8. [Configurar canal no bot](#8-configurar-canal-no-bot)
9. [Conectar a Meta ao webhook](#9-conectar-meta-ao-webhook)
10. [Testar de ponta a ponta](#10-testar)
11. [Troubleshooting](#11-troubleshooting)
12. [Receitas prontas (prompts e fluxos exemplo)](#12-receitas)

---

## 1. Visão geral

```
[Cliente WhatsApp]
       ↓ envia mensagem
[Meta Cloud API]
       ↓ POST webhook
[Sellergy Backend]  →  cria/atualiza Conversa
       ↓ enfileira execução
[BullMQ + Worker]
       ↓ executa fluxo
[Builder Fluxo]: Webhook → AI Agent (com tools)
       ↓ AI Agent decide
[Tools]: criarLead, buscarProduto, mensagens.enviar...
       ↓
[Cliente WhatsApp recebe resposta]
```

**O que precisa estar em pé** durante a execução:
- Postgres (Docker)
- Redis (Docker)
- MinIO (Docker, opcional pra mídias)
- Backend Node (`npm run dev`)
- Worker Node (`npm run worker:dev`)
- Frontend Vite (`npm run dev`)
- Cloudflared/ngrok (tunnel pra Meta acessar localhost)

---

## 2. Pré-requisitos

### Conta na Meta
- Acesso a https://developers.facebook.com (login Facebook)
- Você precisa ter um **Business Manager** (Meta cria automático na primeira vez)

### Tunnel HTTPS pro localhost
Em dev, Meta exige HTTPS público. Use **cloudflared** (sem cadastro):

```powershell
winget install Cloudflare.cloudflared
# Reinicia o terminal depois da instalação

# Em um terminal dedicado (deixa rodando):
cloudflared tunnel --url http://127.0.0.1:3333
```

Vai aparecer URL tipo `https://palavra-aleatoria.trycloudflare.com`. **Anota** — essa é a `BASE_URL_PUBLICA`.

⚠️ **Quick tunnel muda toda vez que reinicia**. Pra dev tá ótimo. Pra produção, hospede em servidor real.

### Sellergy rodando
Em 3 terminais separados:

```powershell
# Terminal 1 — backend
cd C:\Users\USER\Desktop\bot\botmanager\backend
npm run dev
# Esperar: "Servidor rodando na porta 3333"

# Terminal 2 — worker
cd C:\Users\USER\Desktop\bot\botmanager\backend
npm run worker:dev

# Terminal 3 — frontend
cd C:\Users\USER\Desktop\bot\botmanager\frontend
npm run dev
```

Login em http://localhost:5173.

### Provedor de IA
Um destes (escolha um):
- **OpenAI** — https://platform.openai.com → API Keys → cria
- **Anthropic** — https://console.anthropic.com → API Keys
- **Google Gemini** — https://aistudio.google.com → Get API Key

Crédito mínimo de US$5 cobre dezenas de milhares de mensagens em modelos pequenos (`gpt-4o-mini`, `claude-haiku-4-5`, `gemini-1.5-flash`).

---

## 3. Configurar app na Meta

> ⚠️ **A interface da Meta muda com frequência.** Esta seção foi conferida em
> 2026-05-02. Se a tela aparecer diferente, procure pelos termos em **negrito**
> (eles costumam permanecer mesmo após redesigns).

### 3.1. Criar o app

1. Abra https://developers.facebook.com/apps/
2. Clique em **Create App** (ou **Criar app**)
3. **Use case** / **Caso de uso**:
   - Se aparecer **"Other"**, escolha
   - Se a Meta pedir o objetivo, escolha algo equivalente a "Connect customers to WhatsApp" / **"Conectar-se com os clientes pelo WhatsApp"**
4. **App type** / **Tipo do app**: **Business** (sempre)
5. Dá um nome (ex.: "Sellergy Dev")
6. Cria

### 3.2. Ativar produto WhatsApp

A Meta agora apresenta o painel em formato de **casos de uso**. Você pode
ver cards como "Conectar-se com os clientes pelo WhatsApp", "Criar e
gerenciar anúncios...", etc. (interface antiga era "Add product → WhatsApp").

**Caminho atual (2026)**:

1. No painel principal do app, encontre o card **"Personalizar o caso de uso
   'Conectar-se com os clientes pelo WhatsApp'"** (geralmente o primeiro)
2. Clique nele
3. Aceita os termos do WhatsApp Business

A Meta cria automaticamente:
- Um **número de teste** (gratuito, limitado a 5 destinatários autorizados)
- Um **Business Account** vinculado
- O painel lateral ganha a seção **WhatsApp** com sub-itens **API Setup**,
  **Configuration**, etc.

**Caminho antigo (interface anterior)**:

1. Menu lateral → **Add product**
2. Encontra **WhatsApp** → **Set up**

### 3.3. Pegar credenciais (Configuração da API)

No menu lateral do caso de uso, clica em **Configuração da API** (no painel
em inglês: "API Setup"). Você vai ver:

| Campo na tela (PT-BR) | O que copiar | Pra onde vai |
|---|---|---|
| **De** → **ID do número de telefone** | string numérica | Será o `phoneNumberId` no Sellergy |
| **Token de acesso temporário** | string longa começando com `EAA...` | Será o `accessToken` no Sellergy |

⚠️ O token temporário **expira em 24h**. Pra produção crie um **token permanente** (Token de usuário do sistema):

- Acessa **business.facebook.com** → ⚙️ **Configurações de negócio**
- **Usuários → Usuários do sistema** → **Adicionar**
- Atribui o app + permissões `whatsapp_business_management` e `whatsapp_business_messaging`
- **Gerar token** (sem expiração)

### 3.4. Autorizar destinatários (sandbox)

Ainda em **Configuração da API**, no card **Para** (seção "enviar mensagens
para"):

- Adiciona seu próprio número (formato E.164 sem `+`: `5511988887777`)
- Meta envia código de verificação por WhatsApp — você confirma

Sem isso, **mensagens entrantes do seu número não chegam** — o sandbox da
Meta só aceita até 5 destinatários previamente autorizados.

> Pra produção sem essa restrição: precisa **Verificação de Negócio** +
> número próprio comprado/portado.

### 3.5. Onde fica o webhook (Configuração)

A configuração do webhook (Callback URL + Verify Token) **NÃO** fica em
"Configuração da API". Fica em **Configuração** (item **anterior** na
lista lateral, ou item separado dependendo da versão do painel).

| Campo na tela | O que colocar |
|---|---|
| **URL de retorno de chamada** | URL do tunnel + `/canais/whatsapp/<botId>` |
| **Token de verificação** | O verify token que você gerou no Sellergy |
| **Campos de webhook** → marcar | `messages` |

Vamos voltar nessa parte no passo 9 (depois de configurar o lado do Sellergy).

### 3.5. Quantos apps na Meta? Quantos bots?

| Cenário | O que fazer |
|---|---|
| 1 número WhatsApp atende 1 bot do Sellergy | 1 App na Meta + 1 bot no Sellergy. Webhook aponta pra `/canais/whatsapp/<botId>` desse bot. **Mais comum.** |
| Vários números, cada um com seu bot | 1 App na Meta com vários números + N bots no Sellergy (1:1 com os números). Cada bot tem sua config de canal própria |
| 1 número, vários bots **(não suportado)** | Cada webhook é amarrado a um único `botId`. Para roteamento condicional, use UM bot e dentro do fluxo bifurca com nó IF |

Você pode **reusar a mesma credencial WHATSAPP_CLOUD_TOKEN** em vários bots
desde que os números pertençam ao mesmo Business Account. O que **sempre** muda
por bot é: o `botId` na URL do webhook, o `verifyTokenCanal` (gera novo), e o
`fluxoPadraoId`.

---

## 4. Cadastrar credencial no Sellergy

No app (logado como tenant):

1. **Configurações → Credenciais**
2. **Nova credencial**
3. Preenche:
   - **Nome**: `WhatsApp Sellergy Dev` (ou o que preferir)
   - **Tipo**: `WHATSAPP_CLOUD_TOKEN`
   - **accessToken**: cola o **Temporary access token** da Meta
   - **phoneNumberId**: cola o **Phone Number ID** da Meta
4. **Criar credencial**

Faça o mesmo para o **provedor de IA**:

1. **Nova credencial**
2. Tipo: `OPENAI_API_KEY` (ou `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
3. **apiKey**: cola sua chave do provedor
4. **Criar**

> 🔒 Os dados são **cifrados em repouso** (AES-256-GCM com chave derivada por tenant). Admin do sistema não consegue ver pela API.

---

## 5. Criar o bot

1. **Bots → Novo bot**
2. **Nome**: ex.: "Atendente WhatsApp"
3. **Canal**: WhatsApp
4. **Telefone**: deixa em branco (vai vir da Meta)
5. **Provedor IA / Modelo IA / Prompt** podem ficar vazios — vamos configurar via fluxo
6. **Criar**

Anota o **botId** que aparece na URL ao abrir o bot (`/admin/builder/<botId>` por exemplo).

---

## 6. Construir o fluxo

Aqui é o coração do atendimento. Vamos montar um fluxo que:
1. Recebe mensagem via webhook
2. Aciona AI Agent com prompt customizado
3. AI Agent usa tools pra responder

### 6.1. Abrir Builder

**Bots → ⋯ → Construtor de fluxo**

Aperta **+ Novo fluxo**:

- **Ponto de partida**: "Em branco"
- **Nome**: `Atendimento WhatsApp principal`
- Botão **Criar em branco**

### 6.2. Adicionar nós

Estado vazio → clica **"Adicionar primeiro nó"** → catálogo abre.

Adiciona estes 2 nós:

#### Nó 1: Webhook
- Categoria **Disparadores** → **Webhook**
- Esse nó é o ponto de entrada quando uma mensagem chega via canal externo
- Não precisa configurar URL pública aqui (a configuração do canal é em outro lugar — você só precisa do nó WEBHOOK no fluxo)

#### Nó 2: AI Agent
- Categoria **Inteligência Artificial** → **AI Agent**

### 6.3. Conectar nós

Arrasta do círculo da direita do nó **Webhook** até o círculo da esquerda do **AI Agent**.

### 6.4. Configurar AI Agent

Clica no nó **AI Agent** — painel direito abre. Preenche:

| Campo | Valor sugerido |
|---|---|
| **Provedor** | OpenAI (ou outro) |
| **Modelo** | `gpt-4o-mini` (barato, rápido, bom o suficiente) |
| **Credencial** | a `OPENAI_API_KEY` que você cadastrou |
| **Prompt do sistema** | (ver abaixo) |
| **Mensagem do usuário** | `{{entrada.texto}}` |
| **Temperatura** | `0.4` (resposta consistente, pouco "criativa") |
| **Max tokens** | `800` |

#### Prompt do sistema sugerido

```
Você é o atendente virtual da [NOME DA LOJA]. O cliente acabou de mandar uma mensagem pelo WhatsApp.

DADOS DA CONVERSA (use exatamente estes valores):
- conversaId: {{entrada.conversaId}}
- telefone do cliente: {{entrada.telefone}}
- mensagem recebida: "{{entrada.texto}}"

REGRAS OBRIGATÓRIAS:
1. SEMPRE responda chamando a tool `mensagens.enviar` passando conversaId="{{entrada.conversaId}}". O cliente NÃO vê texto fora dessa tool.
2. Antes de criar lead, use `crm.buscarLead` pelo telefone "{{entrada.telefone}}" pra evitar duplicata.
3. Se não houver lead com esse telefone, use `crm.criarLead` com o nome que o cliente fornecer (pergunte se necessário).
4. Se o cliente perguntar de produto/preço, use `catalogo.buscarProduto` ou `catalogo.listarProdutos`.
5. Se quiser marcar agenda, use `agenda.criarAgendamento`.
6. NUNCA prometa preço sem buscar no catálogo.
7. Cumprimente sempre na primeira interação. Tom: simpático, direto, brasileiro, sem gírias forçadas.
8. Mensagens curtas (2-3 linhas no máximo). WhatsApp não comporta texto longo.

NUNCA use: cancelar venda (encaminhe pra atendente humano), apagar dados, deletar registros.
```

> Substitua `[NOME DA LOJA]` pelo nome real.

### 6.5. Salvar fluxo

Botão **Salvar** no topo. Aguarda o toast "Canvas salvo".

---

## 7. Habilitar tools

O agente só consegue invocar tools que você **autorizou neste bot específico**.

1. **Bots → ⋯ → Ferramentas do agente**
2. Marca pelo menos:
   - ✅ `crm.criarLead`
   - ✅ `crm.buscarLead`
   - ✅ `mensagens.enviar` ← **essencial** (sem isso o cliente não recebe nada)
   - ✅ `catalogo.buscarProduto`
   - ✅ `catalogo.listarProdutos`
   - ✅ `agenda.criarAgendamento` (se módulo Agenda liberado)
3. **Salvar**

> ⚠️ Tools cujo módulo não está liberado pro tenant aparecem com badge laranja "Módulo não liberado". Marcar não tem efeito.

---

## 8. Configurar canal no bot

**Bots → ⋯ → Canal externo**

Preenche:

| Campo | Valor |
|---|---|
| **Canal** | WhatsApp Cloud API |
| **Credencial do canal** | a credencial `WHATSAPP_CLOUD_TOKEN` cadastrada |
| **Phone Number ID (opcional)** | deixa vazio (vem da credencial) |
| **Fluxo padrão** | `Atendimento WhatsApp principal` (criado no passo 6) |
| **Verify Token** | clica **↻** pra gerar — copia esse valor |

**Salvar**.

Em seguida, um card "Webhook publico do WhatsApp" aparece com:
- **Callback URL** — algo tipo `https://abc.trycloudflare.com/canais/whatsapp/<botId>`
- **Verify Token** — o que você acabou de gerar

⚠️ Se a Callback URL mostra `localhost`, **edite o `VITE_API_URL` do `.env`** pra apontar pra URL pública (ou simplesmente monte manual: `<URL pública>/canais/whatsapp/<botId>`).

---

## 9. Conectar a Meta ao webhook

Volta no painel do app Meta (developers.facebook.com):

### 9.1. Configurar webhook

1. **WhatsApp → Configuration**
2. Card **Webhook** → **Edit**
3. **Callback URL**: cola exatamente o que aparece no Sellergy (a URL completa com `<botId>`)
4. **Verify token**: cola o verify token que você gerou no Sellergy
5. Clica **Verify and save**

#### O que acontece nessa hora

1. Meta faz `GET https://abc.trycloudflare.com/canais/whatsapp/<botId>?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
2. Backend Sellergy compara o `verify_token` recebido com o salvo no `Bot.verifyTokenCanal`
3. Se bate, devolve o `hub.challenge` — Meta marca como verificado ✅
4. Se não bate, retorna 403

### 9.2. Inscrever no campo `messages`

Logo abaixo, em "Webhook fields", clica **Subscribe** ao lado de **`messages`**.

Pronto — agora cada mensagem que chegar pro número vai disparar POST no seu backend.

---

## 10. Testar

### 10.1. Smoke test

Antes de mandar mensagem, confere que tudo conversa:

```powershell
# Backend respondendo via tunnel
curl https://abc.trycloudflare.com/saude
# Deve retornar: {"status":"ok","data":"..."}
```

### 10.2. Mensagem real

Do **seu celular** (o número que você autorizou na Meta):

> "Bom dia! Queria saber sobre os produtos."

Em alguns segundos:

1. **Tunnel terminal** mostra POST recebido
2. **Backend terminal** mostra log do dispatcher
3. **Worker terminal** mostra `[worker:exec] processando ...`
4. **Cliente recebe** a resposta no WhatsApp

### 10.3. Ver o que aconteceu

#### No Sellergy

- **CRM** → veja se um lead foi criado com o telefone do cliente
- **Mensagens** (futuro — UI ainda em construção): conversa cifrada
- **Bots → Construtor → seu fluxo → Executar/Histórico**: drawer com cada execução, lista de tools chamadas, args e resultado

#### Auditoria de tools (banco)

Toda chamada de tool grava em `auditoria_acoes_agente`:

```sql
SELECT toolNome, args, sucesso, criadoEm
FROM auditoria_acoes_agente
ORDER BY criadoEm DESC
LIMIT 20;
```

---

## 11. Troubleshooting

### Meta retorna erro ao **Verify and save**

| Causa provável | Conferir |
|---|---|
| Verify token salvo no Sellergy ≠ o digitado na Meta | Volta em **Bots → Canal externo**, copia exato |
| Callback URL com `localhost` | Cloudflare/ngrok não está rodando OU `VITE_API_URL` errado |
| Backend offline | `curl <URL>/saude` deve responder |
| `botId` errado na URL | Confere que o UUID corresponde ao bot |

### Mensagem chega mas bot não responde

#### A. Drawer da execução vazio
- Não chegou pra processar. Confere logs do **backend** — busca por `[canais/whatsapp]`.
- Confere **`fluxoPadraoId`** está setado no bot.

#### B. Drawer mostra execução mas sem `chamadasTools`
- LLM retornou texto direto sem chamar tool. **O cliente não vê esse texto** — só o que vai por `mensagens.enviar`.
- Solução: reforça no prompt: "SEMPRE chame mensagens.enviar para responder. NUNCA escreva resposta no texto."

#### C. Drawer mostra `mensagens.enviar` com `sucesso: false`
Lê o campo `erro`:

| Erro | Causa |
|---|---|
| "Conversa sem bot vinculado" | Conversa criada antes do botId existir; raro |
| "Bot sem credencial de canal configurada" | Volta em Canal externo e seleciona credencial |
| "Credencial nao encontrada" | Credencial foi excluída — recadastra |
| "WhatsApp API 401" | Token expirou. Gera novo na Meta e atualiza credencial |
| "WhatsApp API 400 — recipient phone number not in allowed list" | Você não autorizou seu próprio número como destinatário (sandbox limit) |

#### D. AI Agent retorna erro
- "credencial e do tipo X, mas provedor Y exige Z" → tipo da credencial não casa com provedor
- "OpenAI 401" → API key inválida
- "OpenAI 429" → rate limit. Espera ou troca de modelo

### Mensagem demora muito pra responder
- Worker travado? Olha o terminal do worker, deve mostrar logs por execução
- LLM lento? `gpt-4o-mini` é o mais rápido. `claude-opus-4-1` é o mais lento mas inteligente
- Muitas iterações de tools? Drawer mostra quantas. Limite atual = 10

### Tunnel quebrou
Quick tunnels do Cloudflare não têm SLA. Se cair:
```powershell
cloudflared tunnel --url http://127.0.0.1:3333
```
URL nova → atualiza no Sellergy E na Meta. Em prod use named tunnel ou hospede o backend.

---

## 12. Receitas

### Receita A — Bot recepcionista simples

**Fluxo**: Webhook → AI Agent → fim

**Tools habilitadas**: `mensagens.enviar`, `crm.criarLead`, `crm.buscarLead`

**Prompt**:
```
Você é o atendente da [LOJA]. Cumprimente o cliente, descubra o nome
e o que ele precisa. Se não houver lead com telefone {{entrada.telefone}},
crie um. Sempre responda via mensagens.enviar (conversaId={{entrada.conversaId}}).
Mensagens curtas, tom simpático.
```

### Receita B — Bot vendedor

**Fluxo**: Webhook → AI Agent → fim

**Tools**: A + `catalogo.buscarProduto`, `catalogo.listarProdutos`, `vendas.lancarVenda`

**Prompt** (acrescenta às regras de A):
```
Quando o cliente perguntar produto, use catalogo.buscarProduto.
Apresente até 3 opções com nome + preço (já em R$).
Se o cliente confirmar a compra, use vendas.lancarVenda passando
variacaoId, quantidade e leadId. Confirme o pedido com numero de venda.
NUNCA prometa preço sem buscar no catálogo.
```

### Receita C — Bot de agendamento

**Fluxo**: Webhook → AI Agent → fim

**Tools**: A + `agenda.criarAgendamento`, `agenda.listarAgendamentosDoDia`

**Prompt** (acrescenta):
```
Quando o cliente quiser marcar, pergunte data/hora preferida.
Use agenda.listarAgendamentosDoDia pra checar conflito.
Crie com agenda.criarAgendamento. Confirme a marcação.
Horário de funcionamento: 9h às 18h, seg a sex.
```

### Receita D — Bot full atendimento + venda + agenda

Combine A + B + C. Fica grande mas funciona — só amarra bem no prompt:

```
[Regras gerais de A]

Identifique a INTENÇÃO do cliente:
- "informações de produto" → use catalogo.buscarProduto
- "comprar / fechar pedido" → confirme produto/qtd e use vendas.lancarVenda
- "marcar / agendar" → use agenda.criarAgendamento
- "cancelar / reclamar" → diga que vai encaminhar pra um atendente humano

Sempre responda com mensagens.enviar(conversaId={{entrada.conversaId}}).
```

---

## Anexo — Cheat sheet de variáveis

Disponíveis no prompt e na mensagem do usuário (interpolação `{{...}}`):

| Variável | Conteúdo |
|---|---|
| `{{entrada}}` | Objeto inteiro com tudo que o webhook recebeu |
| `{{entrada.texto}}` | Texto da mensagem do cliente |
| `{{entrada.telefone}}` | Telefone do cliente (E.164: `5511988887777`) |
| `{{entrada.conversaId}}` | UUID da conversa atual (passa pra `mensagens.enviar`) |
| `{{entrada.canal}}` | `WHATSAPP` |
| `{{entrada.recebidoEm}}` | Timestamp ISO 8601 |
| `{{variaveis.NOME_VARIAVEL}}` | Variáveis criadas por nós SET anteriores |

---

## Anexo — Limites de segurança

- Mensagem cifrada em repouso (AES-256-GCM por tenant)
- Admin do sistema **não decifra** mensagens via API
- Tools auditadas em `auditoria_acoes_agente` (quem-bot, args, resultado, timestamp)
- Limite 10 iterações tool/LLM por execução
- Limite 4096 tokens output por chamada LLM
- Timeout 60s por chamada LLM
- HTTP node bloqueia IPs privados (proteção SSRF)

---

## Anexo — Custo aproximado por mensagem (provedor IA)

Estimativa (varia muito conforme o tamanho do prompt):

| Modelo | Custo por mensagem típica (atendimento curto, sem tools) |
|---|---|
| `gpt-4o-mini` | ~ US$ 0.0001 (1 décimo de centavo) |
| `claude-haiku-4-5` | ~ US$ 0.00015 |
| `gemini-1.5-flash` | ~ US$ 0.00005 (mais barato) |
| `gpt-4o` | ~ US$ 0.005 |
| `claude-sonnet-4-5` | ~ US$ 0.003 |

Com tool calling, multiplica por 2-4 (mais round-trips). 1000 mensagens/mês com `gpt-4o-mini` ≈ US$ 0.50.

---

Bons atendimentos. 🤖
