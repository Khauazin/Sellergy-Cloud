# Manual Interativo — Bot de Atendimento (Telegram/WhatsApp + IA + CRM)

> **Quanto demora:** ~30 min na primeira vez.
> **O que você vai ter no fim:** um bot que recebe mensagens no Telegram, conduz uma conversa multi-turno (perguntando nome → CPF → email) e cria o lead no CRM automaticamente. Funciona também no WhatsApp Cloud API (mesmo fluxo).
>
> **Marca os checkpoints `[ ]` conforme avança** — se travar, vai pro [Troubleshooting](#troubleshooting) no fim.

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar o bot no Telegram (BotFather)](#2-criar-o-bot-no-telegram-botfather)
3. [Cadastrar credenciais no Sellergy](#3-cadastrar-credenciais-no-sellergy)
4. [Criar o bot no Sellergy e vincular ao canal](#4-criar-o-bot-no-sellergy-e-vincular-ao-canal)
5. [Registrar o webhook do Telegram](#5-registrar-o-webhook-do-telegram)
6. [Liberar módulo CRM e habilitar tools](#6-liberar-módulo-crm-e-habilitar-tools)
7. [Construir o fluxo (escolha A ou B)](#7-construir-o-fluxo-escolha-a-ou-b)
8. [Apontar o fluxo padrão do bot](#8-apontar-o-fluxo-padrão-do-bot)
9. [Testar ponta a ponta](#9-testar-ponta-a-ponta)
10. [Troubleshooting](#troubleshooting)
11. [Apêndice: WhatsApp Cloud API](#apêndice-whatsapp-cloud-api)

---

## 1. Pré-requisitos

- [ ] Stack do Sellergy Cloud rodando (`docker compose up -d` na raiz do projeto)
- [ ] Backend acessível externamente (ngrok, Cloudflare Tunnel, ou domínio próprio com HTTPS) — **o Telegram exige HTTPS válido** pra aceitar webhook
- [ ] Conta de admin do Sellergy logada
- [ ] Conta da OpenAI/Anthropic/Gemini com API key (somente se for usar o **Fluxo A — IA**)

> **Sobre a URL pública:** durante o desenvolvimento, abre um túnel:
> ```powershell
> ngrok http 3333
> ```
> Anota a URL `https://xxxx.ngrok-free.app` — você vai usar como base do webhook.

**Checkpoint 1 ✅** — `docker compose ps` mostra todos os serviços `running`/`healthy` e você tem uma URL HTTPS pública apontando pra porta 3333.

---

## 2. Criar o bot no Telegram (BotFather)

1. No Telegram, abre o chat com **[@BotFather](https://t.me/BotFather)**.
2. Manda `/newbot`.
3. BotFather pergunta o **nome** do bot (qualquer string) → responde.
4. BotFather pergunta o **username** (precisa terminar em `_bot`) → responde.
5. BotFather devolve um **token** no formato `123456789:ABCdef...XYZ`.

**Checkpoint 2 ✅** — Você tem o token do bot guardado.

> **Cuidado:** esse token é equivalente à senha do bot. Não cola em chat público nem commita no git.

---

## 3. Cadastrar credenciais no Sellergy

Vai em **Configurações → Credenciais**. Você precisa de **2 credenciais** (1 se for fluxo determinístico).

### 3.1 Credencial do Telegram

- [ ] Botão **+ Nova credencial**
- [ ] **Tipo:** `TELEGRAM_BOT_TOKEN`
- [ ] **Nome:** ex. `Telegram - Bot Atendimento`
- [ ] **Token:** cola o token do BotFather
- [ ] **Salvar**

### 3.2 Credencial da IA *(pula se for fluxo manual puro)*

- [ ] Botão **+ Nova credencial**
- [ ] **Tipo:** `OPENAI_API_KEY` (ou `ANTHROPIC_API_KEY` / `GEMINI_API_KEY`)
- [ ] **Nome:** ex. `OpenAI - Atendimento`
- [ ] **API key:** cola a chave (formato `sk-...` na OpenAI)
- [ ] **Salvar**

**Checkpoint 3 ✅** — As 2 credenciais aparecem listadas em Configurações → Credenciais.

---

## 4. Criar o bot no Sellergy e vincular ao canal

Vai em **Bots → + Novo bot**:

- [ ] **Nome:** ex. `Atendimento Telegram`
- [ ] **Canal:** `TELEGRAM`
- [ ] **Cliente** (se você for ADMIN do sistema): seleciona a empresa-tenant que vai receber os leads
- [ ] **Credencial do canal:** seleciona a credencial Telegram criada no passo 3.1
- [ ] **Verify Token:** **gere um valor aleatório** (ex.: 32 caracteres, qualquer string). Pode usar:
  ```powershell
  -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 32 | % {[char]$_})
  ```
  Esse valor o Telegram envia em cada webhook no header `X-Telegram-Bot-Api-Secret-Token` — é o que protege seu endpoint.
- [ ] **Salvar**

**Checkpoint 4 ✅** — O bot aparece na lista com canal `TELEGRAM`. Anota o **`botId`** (UUID na URL ao abrir o bot).

---

## 5. Registrar o webhook do Telegram

O Sellergy precisa avisar ao Telegram em qual URL ele deve entregar as mensagens.

### Opção 5A — Pelo painel (se tiver botão "Registrar webhook")

- [ ] Na tela do bot, clica em **Registrar webhook**.
- [ ] Confirma a URL pública (ex.: `https://xxxx.ngrok-free.app/canais/telegram/<botId>`).

### Opção 5B — Manualmente via curl/PowerShell

```powershell
$token  = "COLE_O_TOKEN_DO_BOTFATHER"
$secret = "COLE_O_VERIFY_TOKEN_QUE_VOCE_GEROU"
$url    = "https://xxxx.ngrok-free.app/canais/telegram/COLE_O_BOTID"

curl.exe -X POST "https://api.telegram.org/bot$token/setWebhook" `
  -H "Content-Type: application/json" `
  -d "{`"url`":`"$url`",`"secret_token`":`"$secret`",`"allowed_updates`":[`"message`",`"edited_message`"]}"
```

Resposta esperada: `{"ok":true,"result":true,"description":"Webhook was set"}`.

### Verificação

```powershell
curl.exe "https://api.telegram.org/bot$token/getWebhookInfo"
```

Procure por:
- `"url":"https://...seu domínio.../canais/telegram/..."` ✅
- `"pending_update_count":0` ✅
- `"last_error_message":...` → se aparecer, leia a mensagem (geralmente HTTPS inválido ou URL fora do ar)

**Checkpoint 5 ✅** — `getWebhookInfo` mostra sua URL e zero erros.

---

## 6. Liberar módulo CRM e habilitar tools

### 6.1 Módulo CRM liberado pro tenant

> Só ADMIN do sistema faz isso, uma vez por empresa-cliente.

- [ ] **Admin → Clientes → seleciona o cliente → Permissões/Módulos**
- [ ] Marca o switch **CRM** como ✅
- [ ] Salva

### 6.2 Tools habilitadas no bot

- [ ] **Bots → seu bot → Ferramentas do agente**
- [ ] Habilita **`crm.criarLead`** ✅
- [ ] *(se for usar IA)* habilita **`mensagens.enviar`** ✅
- [ ] Salva

**Checkpoint 6 ✅** — A tela do bot mostra as tools com switches verdes.

---

## 7. Construir o fluxo (escolha A ou B)

> **Recomendado:** começa pelo **A** porque tem 3 nós e te dá feedback imediato. Depois você reconstrói como **B** se quiser determinismo.

### 7.A — Fluxo IA (3 nós)

```
[Webhook]  →  [AI Agent]  →  [Enviar Mensagem]
```

#### Passo a passo

1. [ ] **Bots → Construtor de fluxo → + Novo fluxo**
2. [ ] **Nome:** `Atendimento IA`
3. [ ] Arrasta **Webhook** pro canvas (sem configurar nada — só serve como trigger)
4. [ ] Arrasta **AI Agent** ao lado e conecta `Webhook → AI Agent`
5. [ ] Configura o AI Agent:

   | Campo | Valor |
   |---|---|
   | Provedor | `OPENAI` |
   | Modelo | `gpt-4o-mini` |
   | Credencial | (a do passo 3.2) |
   | Mensagem do usuário | `{{entrada}}` |
   | Temperatura | `0.7` |
   | Max tokens | `1024` |

6. [ ] No campo **Prompt do sistema**, cola:

   ```
   Voce e um atendente de pre-cadastro. Sua tarefa e coletar tres
   informacoes do cliente, na ordem: nome completo, CPF e e-mail.

   REGRAS:
   - Faca UMA pergunta por vez. Espere a resposta antes de seguir.
   - O nome do cliente no Telegram pode ser "{{dadosGatilho.nome}}".
     Cumprimente pelo nome se ele estiver disponivel.
   - Se o cliente ja deu uma informacao no historico, NAO pergunte de novo.
   - Quando tiver os tres dados, chame a tool crm.criarLead com:
       nome: o nome completo
       telefone: "{{dadosGatilho.telefone}}"
       email: o email
       observacoes: "CPF: " + o CPF
   - Apos criar o lead com sucesso, agradeca em uma frase curta.
   - Se sair do tema, redirecione gentilmente.

   Sempre em portugues do Brasil, em tom cordial e direto.
   ```

7. [ ] Arrasta **Enviar Mensagem** e conecta `AI Agent → Enviar Mensagem`
8. [ ] Configura:
   - Texto: `{{entrada.resposta}}`
   - Conversa ID: *(deixa vazio — usa a conversa que disparou o fluxo)*
9. [ ] **Liga o switch "Ativo"** no topo
10. [ ] **Salvar**

> **Variação sem o nó 3:** se você habilitou `mensagens.enviar` no passo 6.2, a IA pode responder sozinha. Adicione no prompt: `Para responder ao cliente, use a tool mensagens.enviar.` Daí o fluxo fica só `Webhook → AI Agent`.

**Checkpoint 7.A ✅** — Fluxo salvo, `Ativo`, com 3 nós conectados em sequência.

---

### 7.B — Fluxo Manual (determinístico)

> Mais nós, mais controle, sem custo de LLM. Indicado quando o roteiro é fixo.

#### Topologia geral

```
[Webhook]
   └── [IF passo == null] ──sim──> [Estado: passo=NOME] ──> [Enviar "ola, qual seu nome?"]
                          └─não─> [IF passo == 'NOME'] ──sim──> [Estado: nome=texto, passo=CPF] ──> [Enviar "qual CPF?"]
                                              └─não─> [IF passo == 'CPF'] ──sim──> [Estado: cpf=texto, passo=EMAIL] ──> [Enviar "qual email?"]
                                                              └─não─> [IF passo == 'EMAIL'] ──sim──> [Estado: email=texto] ──> [TOOL crm.criarLead] ──> [Estado SUBSTITUIR: passo=PRONTO] ──> [Enviar "Pronto!"]
                                                                              └─não─> [Enviar "nao entendi"]
```

#### Configuração de cada nó

##### IF — 4 deles

| Rótulo | Condição |
|---|---|
| `passo == null` | `!{{dadosGatilho.estado.passo}}` |
| `passo == NOME` | `'{{dadosGatilho.estado.passo}}' === 'NOME'` |
| `passo == CPF` | `'{{dadosGatilho.estado.passo}}' === 'CPF'` |
| `passo == EMAIL` | `'{{dadosGatilho.estado.passo}}' === 'EMAIL'` |

> Cada IF tem 2 saídas: `verdadeiro` (sim) e `falso` (não).

##### Estado da Conversa — 5 deles

| Onde | Estratégia | Atribuições |
|---|---|---|
| Após boas-vindas | `MERGE` | `passo = NOME` |
| Após receber nome | `MERGE` | `nome = {{dadosGatilho.texto}}` + `passo = CPF` |
| Após receber CPF | `MERGE` | `cpf = {{dadosGatilho.texto}}` + `passo = EMAIL` |
| Após receber email | `MERGE` | `email = {{dadosGatilho.texto}}` |
| Pós-criação | `SUBSTITUIR` | `passo = PRONTO` |

##### Enviar Mensagem — 5 deles

| Onde | Texto |
|---|---|
| Boas-vindas | `Ola {{dadosGatilho.nome}}, qual seu nome completo?` |
| Pergunta CPF | `Obrigado, {{dadosGatilho.estado.nome}}! Qual seu CPF?` |
| Pergunta email | `Perfeito. Qual seu e-mail?` |
| Confirmação | `Pronto, {{dadosGatilho.estado.nome}}! Cadastro criado.` |
| Fallback "não entendi" | `Desculpa, nao entendi. Pode repetir?` |

##### Tool — 1 só, antes da confirmação

| Campo | Valor |
|---|---|
| toolNome | `crm.criarLead` |
| permitirFalha | `false` |
| **args (JSON)** | abaixo |

```json
{
  "nome": "{{dadosGatilho.estado.nome}}",
  "telefone": "{{dadosGatilho.telefone}}",
  "email": "{{dadosGatilho.estado.email}}",
  "observacoes": "CPF: {{dadosGatilho.estado.cpf}} (cadastrado via Telegram)"
}
```

#### Como o "esperar resposta" funciona aqui

> Você **não conecta nada depois do `Enviar Mensagem`**. Quando a execução chega num `Enviar Mensagem`, ela **termina**. A próxima mensagem do usuário **dispara uma nova execução** que entra do `[Webhook]` — mas como o `passo` foi salvo na conversa, o IF correto desvia pro ramo certo. **É o estado salvo que faz a "memória".**

**Checkpoint 7.B ✅** — Fluxo salvo, `Ativo`, todos os ramos conectados.

---

## 8. Apontar o fluxo padrão do bot

> Esse é **o passo que faz a mensagem do Telegram disparar o fluxo**. Sem ele, nada acontece.

- [ ] **Bots → seu bot → Editar**
- [ ] **Fluxo padrão:** seleciona o fluxo do passo 7
- [ ] **Salvar**

**Checkpoint 8 ✅** — Tela do bot mostra "Fluxo padrão: Atendimento IA" (ou Manual).

---

## 9. Testar ponta a ponta

1. [ ] No Telegram, abra o chat com seu bot (`@seu_username_bot`)
2. [ ] Manda `/start` (ou só "oi")
3. [ ] Bot deve responder em ~2 segundos pedindo o nome

### Casos a testar

| Caso | Esperado |
|---|---|
| Manda "oi" pela primeira vez | Bot pede o nome (cumprimentando pelo nome do Telegram se você tiver) |
| Responde com o nome | Bot pede o CPF |
| Responde com CPF | Bot pede o email |
| Responde com email | Bot confirma cadastro |
| Vai em **CRM → Leads** no Sellergy | Lead aparece com nome, telefone, email e observações com o CPF |
| Manda "oi" de novo (depois do PRONTO) | (No fluxo IA) começa nova conversa do zero — porque o LLM vê histórico mas você zerou o estado. (No fluxo manual) o IF vê `passo == 'PRONTO'`, cai no fallback "não entendi". Você pode tratar isso adicionando um IF extra. |

**Checkpoint 9 ✅** — O lead aparece no CRM com os dados corretos.

---

## Troubleshooting

### "service backend is not running" no `docker compose exec`
Sobe o stack primeiro:
```powershell
docker compose up -d
docker compose ps
```

### Migration não aplicou / coluna `estado` não existe
```powershell
cd backend
npx prisma migrate deploy
```

### Telegram não chama o webhook
- Conferir HTTPS válido: `curl https://seu-dominio/saude` deve retornar `{"status":"ok"}`
- Conferir registro: `curl https://api.telegram.org/bot$token/getWebhookInfo` — campo `last_error_message` mostra a causa
- Conferir secret token igual ao `Verify Token` cadastrado no bot

### Bot recebe mensagem mas não responde
1. Olhar log do worker:
   ```powershell
   docker compose logs worker --tail 100
   ```
2. Erros comuns:
   - **`Tipo de no nao suportado: ...`** → migration não aplicada (passo 6) ou frontend desatualizado (rebuild com `docker compose up -d --build frontend`)
   - **`AI_AGENT: credencial nao encontrada`** → credencial deletada ou tenant errado
   - **`TOOL crm.criarLead: Modulo "CRM" nao esta liberado`** → passo 6.1 esquecido
   - **`TOOL crm.criarLead: Tool ... nao esta habilitada`** → passo 6.2 esquecido
   - **`ENVIAR_MENSAGEM: bot sem credencial de canal`** → credencial Telegram não vinculada (passo 4)

### IA esquece o que perguntou na mensagem anterior
- Conferir que você está na versão do `aiAgent.js` que carrega histórico (commit `feat(ia): aiAgent carrega historico...`)
- Conferir nos logs do worker: deveria aparecer um array de `messages` com várias entradas, não só 1

### Lead não cria mas o resto funciona
- Olha **`auditoriaAcaoAgente`** no banco — toda invocação de tool é auditada com `sucesso` e `erro`:
  ```sql
  SELECT * FROM auditoria_acoes_agente
  ORDER BY duracao_ms DESC LIMIT 10;
  ```

### Múltiplos clientes (multi-tenancy)
Cada bot pertence a 1 cliente-tenant. Lead criado pelo bot da empresa A **nunca** aparece pra empresa B. Se você é o operador SaaS:
- Cada empresa cliente tem seu próprio bot do Telegram
- Cada empresa só vê os leads que **vieram pelo seu próprio bot**
- A empresa A configura no painel dela, B no dela

---

## Apêndice: WhatsApp Cloud API

A configuração é equivalente, com 3 diferenças:

1. **Credencial:** tipo `WHATSAPP_CLOUD_TOKEN` em vez de `TELEGRAM_BOT_TOKEN`. Campos: `accessToken` (token permanente do Meta), `phoneNumberId`.
2. **URL do webhook:** `https://seu-dominio/canais/whatsapp/<botId>`. O Meta exige um GET de verificação (`hub.challenge`) antes de aceitar — o Sellergy responde automaticamente usando o `verifyTokenCanal` do bot.
3. **`allowed_updates`:** o WhatsApp Cloud entrega só os tipos que você assinou no painel do Meta. Confirme `messages` está marcado.

O **fluxo no canvas é o mesmo** — não duplica. O dispatcher do Sellergy é agnóstico de canal: detecta `Bot.canal == 'WHATSAPP'` e roteia o `Enviar Mensagem` pra API certa automaticamente.

---

## Referências internas

- [docs_sistema_completo.md](docs_sistema_completo.md) — regras de negócio e módulos
- [README.md](README.md) — setup do ambiente
- [backend/src/canais/dispatcher.js](backend/src/canais/dispatcher.js) — código do roteamento entrante
- [backend/src/engine/executores/aiAgent.js](backend/src/engine/executores/aiAgent.js) — execução do AI Agent
- [backend/src/agente/tools/crm.js](backend/src/agente/tools/crm.js) — definição da tool `crm.criarLead`
