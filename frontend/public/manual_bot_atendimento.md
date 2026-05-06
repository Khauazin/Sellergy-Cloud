# Manual: Como criar seu bot de atendimento

Bem-vindo! 👋

Esse manual te leva, do zero, até ter um **bot rodando no Telegram** que conversa com seus clientes, pega os dados deles e cria o cadastro automaticamente no seu CRM.

> **Tempo:** uns 20 minutinhos.
> **Dificuldade:** fácil — você só vai mexer no painel e no app do Telegram.
> **Não precisa saber programar.** Promessa.

Vai marcando os ✅ conforme avança. Se travar, dá uma olhada no [final](#quando-algo-der-errado).

---

## Antes de começar

### O que esse bot vai fazer?

Imagina que um cliente novo te manda mensagem no Telegram dizendo "oi". Em vez de você responder na mão, **o bot conversa por você**:

> 🤖 — "Olá! Bem-vindo. Qual seu nome?"
> 👤 — "João da Silva"
> 🤖 — "Prazer, João! Pode me passar seu CPF?"
> 👤 — "123.456.789-00"
> 🤖 — "E seu e-mail?"
> 👤 — "joao@email.com"
> 🤖 — "Perfeito! Já te cadastrei aqui. Em breve nossa equipe entra em contato."

Enquanto isso, **na sua tela do CRM, o lead apareceu sozinho**, com nome, telefone, CPF e e-mail. Sem você fazer nada.

### Você vai precisar de

- [ ] **Conta no Telegram** (no celular ou no computador)
- [ ] **Acesso a esse painel** (você já está nele 😄)
- [ ] **(Opcional)** Conta na OpenAI com saldo, **se você quiser que o bot seja "inteligente"** (entende perguntas fora do roteiro). Sem isso, o bot funciona, mas só segue um roteiro fixo.

> **Não tem conta na OpenAI?** Sem problema. Faz o caminho "Manual" no Passo 6 — funciona perfeitamente sem IA.

---

## Passo 1 — Criar o bot dentro do Telegram

Antes do bot aparecer aqui no nosso sistema, ele precisa **existir no Telegram**. Quem cria isso é o **BotFather** (sim, esse é o nome — é um bot oficial do Telegram que cria outros bots).

1. [ ] Abre o Telegram (celular ou web).
2. [ ] Na busca, procura **`@BotFather`** e abre a conversa.
3. [ ] Clica em **Iniciar** (ou manda `/start`).
4. [ ] Manda a mensagem `/newbot`.
5. [ ] Ele pergunta o **nome do seu bot**. Pode ser qualquer um, ex.: `Atendimento da Padaria do João`.
6. [ ] Ele pergunta o **usuário do bot**. Tem que ser único e terminar em `_bot`. Ex.: `padaria_joao_bot`.
7. [ ] Ele te manda uma mensagem com um **token** (parece com isso: `7654321:ABCdef-ghIJKLmn_opqRSTuv`). **Copia esse token e guarda** — você vai usar daqui a pouco.

> ⚠️ **Esse token é como a senha do bot.** Não posta em grupo, não cola em e-mail público. Se vazar, qualquer um pode usar seu bot.

✅ **Pronto pra ir pro Passo 2 quando:** você tem o token na mão (ou copiado em algum lugar).

---

## Passo 2 — Conectar o bot do Telegram ao Sellergy

Aqui você vai dar a "senha" (token) do seu bot pro Sellergy, pra que a gente consiga mandar mensagens em nome dele.

1. [ ] No menu lateral, vai em **Configurações → Credenciais**.
2. [ ] Clica em **+ Nova credencial**.
3. [ ] Escolhe o tipo **Telegram (Bot Token)**.
4. [ ] Dá um nome amigável, ex.: `Bot da Padaria`.
5. [ ] Cola o token que o BotFather te deu.
6. [ ] **Salvar**.

✅ A credencial aparece listada.

### Se você quiser usar IA (opcional)

Se você decidiu ir pelo caminho com IA:

1. [ ] Cria mais uma credencial — agora do tipo **OpenAI (API Key)** (ou Claude/Gemini se preferir).
2. [ ] Dá um nome, ex.: `OpenAI Atendimento`.
3. [ ] Cola sua API key (se você não tem, pega em **platform.openai.com → API keys**).

✅ As credenciais (1 ou 2, dependendo do caminho) aparecem na lista.

---

## Passo 3 — Criar o bot aqui no painel

Agora você vai criar o **registro do bot** dentro do Sellergy. É como dar um "cadastro" pro bot na sua empresa.

1. [ ] Menu lateral → **Bots → + Novo bot**.
2. [ ] **Nome:** algo identificável, ex.: `Atendimento Telegram`.
3. [ ] **Canal:** escolhe **Telegram**.
4. [ ] **Credencial do canal:** seleciona aquela do Telegram que você criou no Passo 2.
5. [ ] **Verify Token (chave secreta):** clica em **Gerar automaticamente** se tiver botão, ou inventa qualquer coisa difícil (ex.: `padaria-2026-xK9mP4`). É uma "senha" que o Telegram vai usar pra provar que é ele mesmo mandando mensagens. Você não precisa decorar — só salva.
6. [ ] **Salvar**.

✅ O bot aparece na sua lista de bots.

---

## Passo 4 — Avisar o Telegram pra entregar as mensagens aqui

O Telegram não sabe sozinho onde mandar as mensagens que chegam pro seu bot. A gente precisa **avisar ele**: "Ô, manda tudo que chegar pro meu bot pra esse endereço aqui ó".

Esse "endereço" é uma URL que o Sellergy gera pra você.

### O jeito fácil

Na tela do bot que você acabou de criar, **procura um botão chamado "Registrar webhook"** (ou "Conectar Telegram"). Clica nele.

✅ Se aparecer "Webhook registrado com sucesso", **pula pra o Passo 5**.

### Se não tiver esse botão

Aí precisa de ajuda do administrador do sistema (a pessoa de TI da sua empresa, ou o pessoal do Sellergy). Manda essa mensagem pra essa pessoa:

> "Preciso registrar o webhook do Telegram no bot que criei. Token e ID do bot estão no painel."

Eles vão configurar em ~5 minutos.

---

## Passo 5 — Liberar permissões pro bot criar leads

Por segurança, **bots não fazem nada sem permissão explícita**. Você precisa dizer: "esse bot pode criar leads no meu CRM".

1. [ ] Vai em **Bots → seu bot → Ferramentas do agente** (ou "Permissões").
2. [ ] Liga o switch da ferramenta **Criar lead** ✅.
3. [ ] **(Se for usar IA)** liga também **Enviar mensagem** ✅ — isso permite que a IA responda no chat sem você precisar configurar manualmente cada resposta.
4. [ ] **Salvar**.

> **Por que isso é importante?** Cada empresa que usa o Sellergy é dona dos próprios dados. O bot da sua empresa **só pode mexer nos seus leads** — nunca vê nem altera dados de outra empresa cliente. Essa configuração é o que garante isso.

✅ Os switches verdes aparecem ligados.

---

## Passo 6 — Montar a conversa do bot

Hora da parte legal: **definir como o bot conversa**.

Você tem dois caminhos. Eles fazem **a mesma coisa** no fim — diferença é como funcionam por dentro:

| | 🤖 Caminho A — IA | 🛠️ Caminho B — Manual |
|---|---|---|
| **Tempo pra montar** | 5 min | 15-20 min |
| **Custo por conversa** | ~R$ 0,10 (paga OpenAI) | grátis |
| **Funciona offline?** | Não (depende da OpenAI) | Sim |
| **Se o cliente fugir do roteiro?** | Bot improvisa e volta | Bot diz "não entendi" |
| **Pra quem é?** | Quer algo natural, conversacional | Quer roteiro previsível e barato |

> **Recomendação:** começa pelo **A (IA)**. É mais rápido pra ver funcionando. Depois você troca pro **B** se quiser mais controle.

---

### 🤖 Caminho A — Bot com IA

A ideia: você **explica em português** pro bot o que ele deve fazer, e a IA cuida do resto.

#### Montagem

1. [ ] Vai em **Construtor de fluxo** do seu bot.
2. [ ] Clica em **+ Novo fluxo** e dá o nome `Atendimento IA`.
3. [ ] Da paleta lateral, **arrasta esses 3 itens** pra tela, em ordem:
   - **Webhook** (é o "início")
   - **AI Agent** (a IA)
   - **Enviar Mensagem** (a resposta)
4. [ ] **Liga eles em sequência** (clica numa bolinha e arrasta até a próxima): Webhook → AI Agent → Enviar Mensagem.

#### Configurar a IA

Clica no nó **AI Agent** e preenche:

| Campo | Valor |
|---|---|
| Provedor | **OpenAI** |
| Modelo | `gpt-4o-mini` |
| Credencial | (a OpenAI que você criou no Passo 2) |
| Mensagem do usuário | `{{entrada}}` |
| Temperatura | `0.7` |

E no campo grande **Prompt do sistema**, cola isso (pode adaptar pra sua empresa):

```
Voce e um atendente da [NOME DA SUA EMPRESA]. Sua missao e fazer um pre-cadastro
do cliente coletando: nome completo, CPF e email. Faca uma pergunta por vez,
de forma cordial. Quando tiver as 3 informacoes, registra o cliente usando a
ferramenta criar lead, e em seguida agradece em 1 frase.

Se o cliente fugir do assunto, traz ele de volta gentilmente.
Sempre fale portugues do Brasil, em tom amigavel.
```

> **Troca `[NOME DA SUA EMPRESA]`** pelo nome real, ex.: "Padaria do João".

#### Configurar a resposta

Clica no nó **Enviar Mensagem** e preenche:

| Campo | Valor |
|---|---|
| Texto | `{{entrada.resposta}}` |
| Conversa ID | *(deixa em branco — o bot manda pra quem chamou)* |

#### Ativar o fluxo

1. [ ] No topo da tela, **liga o switch "Ativo"**.
2. [ ] **Salvar**.

✅ Pronto! Pula pra **Passo 7**.

---

### 🛠️ Caminho B — Bot com roteiro fixo (sem IA)

A ideia: você **monta cada pergunta e cada resposta** na mão, como um fluxograma. O bot vai seguir exatamente o roteiro, sem inventar nada.

#### Lógica

```
Cliente manda 1ª mensagem
   ↓
Bot pergunta o nome
   ↓
Cliente responde
   ↓
Bot pergunta o CPF
   ↓
Cliente responde
   ↓
Bot pergunta o e-mail
   ↓
Cliente responde
   ↓
Bot cria o lead e agradece
```

A "memória" do bot (saber em qual etapa está) fica salva numa "ficha" da conversa.

#### Os blocos que você vai usar

- **Switch** → "olha o valor da etapa atual e escolhe um caminho de N saídas"
- **Estado da Conversa** → "salva nessa ficha que estamos na etapa X"
- **Enviar Mensagem** → escreve o que o bot diz
- **Tool (Ação)** → executa uma ação, tipo "criar lead"

> 💡 **Por que Switch e não IF?** Pra esse caso, você teria que aninhar 4 IFs (vazio? → não → é NOME? → não → é CPF? → ...) e o canvas vira uma árvore confusa. Com Switch, **fica 1 nó com 5 saídas paralelas** — muito mais limpo.

#### Topologia

```
[Webhook] → [Switch passo]
                ├─ (vazio)  → [Estado: passo=NOME]   → [Enviar "qual seu nome?"]
                ├─ NOME     → [Estado: nome=texto, passo=CPF]   → [Enviar "qual CPF?"]
                ├─ CPF      → [Estado: cpf=texto, passo=EMAIL]  → [Enviar "qual email?"]
                ├─ EMAIL    → [Estado: email=texto] → [Tool criarLead] → [Estado: passo=PRONTO] → [Enviar "pronto!"]
                └─ default  → [Enviar "ja cadastrei voce!"]
```

#### Configurando o nó Switch

Clica no nó **Switch** e preenche:

| Campo | Valor |
|---|---|
| Expressão | `{{dadosGatilho.estado.passo}}` |
| Casos | adiciona 4 casos: |

| valor | label (opcional) |
|---|---|
| *(deixa vazio)* | `inicio` |
| `NOME` | |
| `CPF` | |
| `EMAIL` | |

> Quando você adiciona/remove casos, **as bolinhas de saída do nó no canvas mudam automaticamente**. Cada caso vira uma saída labelada — você liga ela ao próximo bloco do caminho dela. A saída `default` aparece sempre no fim — é pra "nenhum caso bateu" (ex.: cliente já está em `passo=PRONTO`).

#### Cada caminho do Switch faz

**Caminho `(vazio)` — primeira mensagem do cliente:**
- → **Estado da Conversa**: `passo = NOME`
- → **Enviar Mensagem**: `Olá! Qual seu nome completo?`

**Caminho `NOME` — cliente respondeu o nome:**
- → **Estado**: `nome = {{dadosGatilho.texto}}`, `passo = CPF`
- → **Enviar Mensagem**: `Prazer, {{dadosGatilho.estado.nome}}! Qual seu CPF?`

**Caminho `CPF` — cliente respondeu o CPF:**
- → **Estado**: `cpf = {{dadosGatilho.texto}}`, `passo = EMAIL`
- → **Enviar Mensagem**: `E qual seu e-mail?`

**Caminho `EMAIL` — cliente respondeu o email (último passo):**
- → **Estado**: `email = {{dadosGatilho.texto}}`
- → **Tool**: `crm.criarLead` (configuração mais abaixo)
- → **Estado** (estratégia **SUBSTITUIR**): `passo = PRONTO`
- → **Enviar Mensagem**: `Pronto, {{dadosGatilho.estado.nome}}! Já te cadastrei.`

**Caminho `default` — qualquer outra etapa (ex.: cliente volta depois de cadastrado):**
- → **Enviar Mensagem**: `Você já está cadastrado, {{dadosGatilho.estado.nome}}! Em breve nossa equipe entra em contato.`

#### Configurar o bloco Tool (criar lead)

Quando você adicionar o bloco **Tool** no roteiro, configura assim:

| Campo | Valor |
|---|---|
| Nome da tool | `crm.criarLead` |
| Permitir falha | desmarcado |
| Argumentos (JSON) | (cola abaixo) |

```json
{
  "nome": "{{dadosGatilho.estado.nome}}",
  "telefone": "{{dadosGatilho.telefone}}",
  "email": "{{dadosGatilho.estado.email}}",
  "observacoes": "CPF: {{dadosGatilho.estado.cpf}}"
}
```

#### Por que o bot "espera" o cliente responder?

Quando o bloco **Enviar Mensagem** termina, o fluxo **acaba**. Quando o cliente responder, **uma nova execução começa**. Mas como a "etapa atual" foi salva na ficha da conversa, o bloco **IF** sabe pra onde mandar.

> Pensa assim: cada mensagem que chega é uma "rodada nova". A ficha da conversa é o que conecta as rodadas.

#### Ativar

1. [ ] **Liga o switch "Ativo"** no topo.
2. [ ] **Salvar**.

✅ Bora testar.

---

## Passo 7 — Apontar esse fluxo como o "padrão" do bot

O bot pode ter vários fluxos (boas-vindas, vendas, suporte...). Você precisa dizer: **"quando chegar mensagem nova, usa ESSE fluxo aqui"**.

1. [ ] **Bots → seu bot → Editar**.
2. [ ] Campo **Fluxo padrão** → seleciona o `Atendimento IA` (ou o do Caminho B).
3. [ ] **Salvar**.

✅ É isso.

---

## Passo 8 — Testa com você mesmo

> ⚠️ **Importante:** o botão **"Executar"** lá no canto do builder **não serve pra testar bot de atendimento**. Ele dispara o fluxo simulando que veio de você (admin), sem cliente nem conversa real. Se você clicar nele, vai dar erro tipo `"conversaId nao encontrado"` no nó **Enviar Mensagem** — isso é normal: o nó precisa de uma conversa de verdade pra saber pra quem responder.
>
> **A forma certa de testar é mandar mensagem pelo Telegram.** É isso que a gente vai fazer agora:

1. [ ] No Telegram, busca pelo **usuário do seu bot** (ex.: `@padaria_joao_bot`).
2. [ ] Abre a conversa, clica **Iniciar** ou manda `oi`.
3. [ ] Em ~2 segundos, o bot responde pedindo seu nome.
4. [ ] Vai respondendo conforme ele pergunta: nome → CPF → e-mail.
5. [ ] No final, ele confirma o cadastro.

### Confere no CRM

1. [ ] No painel, vai em **CRM → Leads**.
2. [ ] **O lead que você acabou de criar tá lá**, com seu nome, telefone (ID do Telegram), e-mail e CPF nas observações.

🎉 **Funcionou!** Seu bot tá pronto pra atender clientes de verdade.

---

## Quando algo der errado

### "O bot recebe minha mensagem mas não responde"

99% das vezes é uma das 3 coisas:

- **Esqueceu de marcar o fluxo como "Ativo"** no topo da tela. Volta lá e liga o switch.
- **Esqueceu de definir o "Fluxo padrão" do bot** no Passo 7.
- **Esqueceu de habilitar a ferramenta "Criar lead"** no Passo 5.

Se nenhum desses, chama o pessoal do Sellergy passando o **ID do bot** (vê na URL da página do bot) e o horário aproximado do teste.

### "Cliquei em Executar e deu `conversaId nao encontrado`"

Isso é **comportamento normal**, não é bug. ✅

O botão **"Executar"** do canto superior dispara o fluxo simulando que veio de você (admin) — sem conversa, sem cliente, sem canal. Como o nó **Enviar Mensagem** precisa de uma conversa real pra saber pra quem responder, ele dá erro nesse modo.

**Pra testar de verdade, manda mensagem pelo Telegram pro seu bot.** O fluxo dispara sozinho do jeito certo.

> O botão "Executar" é útil só pra testar partes técnicas (HTTP Request, Code, IF) — não pra simular conversa de cliente.

### "missing ) after argument list" no IF

Esse erro acontece quando uma condição do nó **IF** vira código JavaScript inválido depois que o sistema substitui as variáveis `{{...}}`.

**Causa comum:** condição tipo `!{{dadosGatilho.estado.passo}}`. Quando o valor não existe (ex.: primeira mensagem do cliente), o `{{...}}` vira string vazia e a expressão fica só `!` — incompleta.

**Correção:** sempre **envolva o `{{...}}` em aspas simples**:

```
'{{dadosGatilho.estado.passo}}' === ''
```

Assim, mesmo quando vazio, vira `'' === ''` (válido). Vale pra qualquer comparação:

```
'{{dadosGatilho.estado.passo}}' === 'NOME'
'{{dadosGatilho.estado.passo}}' === 'CPF'
```

> **Regra de bolso:** se o `{{...}}` representa **texto/string**, embrulha em aspas. Se é número, deixa solto: `{{entrada.contador}} > 0`.

### "Aparece uma mensagem de erro tipo 'Modulo CRM nao liberado'"

A sua empresa não tá com o módulo de CRM ativado. Fala com a pessoa que cuida do contrato com o Sellergy — eles liberam em segundos.

### "A IA está respondendo coisas estranhas"

Volta no nó **AI Agent** e melhora o **Prompt do sistema**. Seja mais específico sobre o que ela deve e não deve fazer. Ex.: "Não invente preços. Se o cliente perguntar valores, diga que vai passar pra equipe."

### "Quero que o bot fale só em horário comercial"

Funcionalidade boa! Ainda não tem direto na interface — fala com o pessoal do Sellergy, eles podem te ajudar a configurar usando o bloco **Schedule** ou **IF**.

### "Vou usar no WhatsApp também"

Vamos! O processo é idêntico, mudando o **canal** de Telegram pra WhatsApp no Passo 3, e usando uma credencial **WhatsApp Cloud Token** em vez de Telegram. Só que pra isso você precisa de uma **conta de WhatsApp Business verificada pela Meta** — esse é o pulo do gato.

---

## Como testar sem ficar no vai-e-vem do Telegram

Pegou o jeito mas tá cansado de mandar `/start` no Telegram toda vez que muda uma vírgula no fluxo? Tem como testar mais rápido:

### Hoje — abre 2 conversas no Telegram

A maneira mais simples é ter **duas conversas** com o mesmo bot:
- **Conversa real** (você de cliente) — testa do começo
- **Outro número/conta** — pra simular um segundo cliente sem misturar histórico

Ou, no celular, abre o Telegram em **modo anônimo** num browser pra ter uma 2ª "identidade" sem precisar criar conta nova.

> Cada conversa tem sua própria "ficha" (estado). Resetar uma não afeta a outra.

### Em breve — chat de teste embutido

Estamos planejando um botão **"Testar conversa simulada"** dentro do builder, que abre um mini-chat na sua tela:

- Você digita do lado "cliente"
- O fluxo roda de verdade, com tudo funcionando (estado, IFs, IA, criação de lead)
- Você vê a resposta no mini-chat
- No fim, dá pra resetar e começar de novo num clique

**Sem precisar do Telegram, sem ficar criando contas falsas.** Vai ser ideal pra desenvolver e ajustar prompts.

> Não tem ainda. Se for muito importante pra você, fala com a equipe — ajuda a priorizar.

---

## Como ver o que o bot fez (debug)

Quando algo dá errado e você quer entender, tem 2 lugares pra olhar:

### 1. Drawer de execuções no builder

Toda vez que o bot é disparado (mensagem chega), gera uma **execução**. No builder, perto do topo, deve ter uma forma de ver as últimas execuções (geralmente um ícone de histórico ou abrindo o nó). Lá você vê:

- Qual nó executou
- O que entrou e o que saiu de cada nó
- Quanto tempo demorou
- Se algum deu erro

É a forma mais visual de entender "por que o bot foi pra esse caminho".

### 2. Histórico da conversa

Em **CRM → Conversas** (ou similar), você vê todas as mensagens de cada cliente, ordenadas. Útil pra revisar o que o cliente mandou e como o bot respondeu.

---

## Dicas pra impressionar

### 1. Personaliza a saudação

Em vez de "Olá! Qual seu nome?", usa o nome que o Telegram já te dá:

```
Olá {{dadosGatilho.nome}}! Bem-vindo à Padaria do João. Pode confirmar seu nome completo?
```

O `{{dadosGatilho.nome}}` é substituído pelo nome do contato no Telegram.

### 2. Combina IA + Manual

Você pode ter **2 bots**: um com roteiro fixo pra coletar dados (rápido e barato), e outro com IA pra responder dúvidas. Cada um num número/canal diferente.

### 3. Habilita mais ferramentas

Conforme for evoluindo, você pode liberar mais ferramentas pro bot:
- **Buscar produtos no catálogo** → "qual o preço do pão?"
- **Agendar atendimento** → "quero marcar pra amanhã"
- **Criar pedido** → o bot recebe o pedido inteiro

Vai um passo de cada vez.

---

## Glossário (só pra entender as palavras estranhas)

- **Token** = senha de robô. Não é a sua senha — é a do bot.
- **Webhook** = endereço onde o Telegram entrega as mensagens. Tipo o número da sua casa pra entregar correspondência.
- **Lead** = cliente em potencial. Alguém que demonstrou interesse mas ainda não comprou.
- **Tool / Ferramenta** = ação que o bot pode executar (criar lead, agendar, enviar mensagem...).
- **Prompt** = as instruções que você dá pra IA, em texto livre.
- **Fluxo** = o roteiro / fluxograma da conversa.
- **Estado da conversa** = a "ficha" que o bot mantém sobre cada cliente, com os dados já coletados.

---

Boa sorte! Qualquer dúvida, fala com a gente. ✨
