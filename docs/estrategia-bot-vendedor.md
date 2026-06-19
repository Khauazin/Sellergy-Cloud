> ⚠️ **DOCUMENTO HISTÓRICO — descontinuado.** Registra a estratégia do **bot-vendedor de
> IA**, que foi **abandonada** no pivô para ERP-first (2026-06-19). Mantido só como
> registro. Fonte de verdade atual: [erp-pivo.md](erp-pivo.md).

# Sellergy Cloud — Estratégia do Bot Vendedor

> Documento vivo. Registra o debate de visão de produto sobre o agente de
> vendas (o "bot que sabe vender"). Distingue o que está **DECIDIDO**, o que
> está **EM DEBATE** e as **HIPÓTESES** levantadas. Iniciado em 2026-05-28.

---

## 0. Tese central (DECIDIDO)

O mercado tem muitos chatbots, mas **nenhum vende de verdade**. Eles param na
conversa ou em árvores de decisão engessadas. A oportunidade do Sellergy:

> **Um vendedor de IA que conversa, conduz a venda do jeito certo, FECHA — e a
> venda já cai no estoque, no caixa, na agenda e no CRM. A loja gerencia tudo
> num painel.**

Diferencial defensável: o Sellergy já tem o sistema de gestão (CRM, agenda,
catálogo, estoque, vendas, financeiro) embaixo do bot. Concorrente de chatbot
teria que construir um ERP; um ERP teria que construir o agente. Estamos no
cruzamento.

---

## 1. Diagnóstico de mercado (DECIDIDO — pesquisa feita em 2026-05-28)

| Player | Origem | Foco | Fecha venda? | Integra gestão? | Preço aprox. |
|---|---|---|---|---|---|
| BotConversa | BR | Fluxos WhatsApp PME/infoproduto | Parcial, sem checkout | Não nativo (Zapier) | ~R$ 129/mês |
| Leadster | BR | Captura/qualificação de lead | Não, passa p/ humano | Não | Sob consulta |
| Blip (Take) | BR | Conversacional enterprise | Depende de integração | Via projeto | ~R$ 650/mês+ |
| Zenvia | BR | CPaaS/campanhas multicanal | Não nativo | Não | ~R$ 40/mês+ |
| Huggy | BR | Atendimento omnichannel | Não nativo | Via integração | Sob consulta |
| ManyChat | Global | Marketing IG/WA/TikTok | Parcial | Não | Por contato ativo |
| Kommo (amoCRM) | Global | CRM vendas + WA + IA | No CRM, sem checkout in-chat | CRM sim; ERP não | US$ 15/usuário/mês |
| WATI | Global | Inbox + chatbot PME | Parcial (catálogo) | Não | ~US$ 99/5 users |
| Tidio/Lyro, Intercom Fin | Global | Suporte com IA | Não (suporte) | Não | US$ 29+ / US$ 0,07–0,10 por sessão |

**Buraco confirmado:** ninguém entrega, num pacote nativo, *venda fechada no
WhatsApp + baixa de estoque + lançamento no caixa + agenda + CRM* para PME física
BR. O mais próximo (Tiny, Conta Azul, Nuvemshop) é **e-commerce** e depende de ERP
externo. Players de **agenda** (serviço físico) e de **venda no WhatsApp** vivem
separados.

**Sinal forte de 2026:** a Meta lançou o **Business AI gratuito** para PMEs no
Brasil (responde FAQ, catálogo, horários). Isso **comoditiza o "atender"** — logo
o diferencial defensável NÃO é conversar, é **vender + operar**.

**Recomendação da pesquisa:** atacar a vertical **PME física de serviço**
(salão/barbearia/clínica), onde a venda no WhatsApp é fraca e a dor de
agenda+caixa+estoque é aguda. Evitar competir de frente com e-commerce/enterprise.

---

## 2. Método de venda — funil conversacional (DECIDIDO como direção)

O bot não responde: ele **conduz**. Versão enxuta de SPIN/AIDA para varejo e
serviço local, mapeada no funil que já existe no CRM:

```
 ATRAÇÃO        DESCOBERTA       APRESENTAÇÃO     FECHAMENTO       PÓS-VENDA
(1º contato)  (entender a dor)  (oferta certa)  (tirar o sim)   (recompra)
     │              │                │               │               │
 Novo →       Em contato →     Qualificado →   Em negociação → Fechado-Ganho
                                                Proposta enviada
```

O "bot que sabe vender" = agente que **move o lead pelas etapas com a abordagem
certa em cada uma e registra cada avanço**. O dono vê a máquina de vendas
trabalhando no Kanban.

**Espectro de maturidade (um só agente, não dois produtos):**
- **Básico (MVP testável):** atração + descoberta + apresentação com preço real
  (catálogo) + agendamento. Move até "Qualificado/Em negociação".
- **Robusto (visão):** + fechamento real (`vendas.lancarVenda` → baixa estoque +
  caixa) + tratamento de objeção + pós-venda. Move até "Fechado-Ganho" e além.

Viabilizado pelo **Desenho 2 (agente autônomo com tools)**, não pelo Desenho 1.

---

## FRENTES EM DEBATE

### 3. Segmentação — tipos e fluxos diferentes (EM DEBATE)

O alvo (PMEs físicas) tem lógicas de venda distintas:

| Segmento | Venda = | Recompra = | Peça crítica |
|---|---|---|---|
| Serviço com agenda (salão, barbearia, clínica, estética) | agendamento | retorno periódico | agenda + duração |
| Produto físico (loja, boutique) | pedido/checkout | reposição/novidade | estoque |
| Híbrido (clínica que vende cosmético) | os dois | ambos | os dois |

**DECIDIDO (2026-05-28):**
- **MVP foca só SERVIÇO** (salão/barbearia/clínica). Produto/loja entra na fase 2.
- **Motor único + perfis de segmento (preset).** Um só agente; o segmento é um
  preset que preenche tools ativas, CTA, cadência de recompra e prompt base. O
  método de venda (descoberta→apresentação→fechamento→pós) é o mesmo pra todos;
  só muda a configuração, não a lógica → sem código duplicado.

### Perfil "Serviço com agenda" (MVP) — definição

| Aspecto | Definição |
|---|---|
| Tools ativas | `catalogo.buscarProduto`, `catalogo.listarProdutos`, `agenda.listarHorariosLivres`, `agenda.criarAgendamento`, `crm.criarLead`, `crm.moverEtapa`, `mensagens.enviar` |
| Tools OFF (fase 2) | `vendas.lancarVenda` (produto/estoque), campanhas |
| CTA de fechamento | agendamento ("reservo seu horário?") |
| Campos a extrair sempre | nome, serviço desejado, preferência de data/hora, profissional (se houver), observações críticas (alergia, histórico) |
| Cadência de recompra | configurável pelo tenant; default por sub-tipo: clínica ~6 meses, salão/barbearia ~30 dias |
| Funil (CRM) | Novo (chegou) → Em contato (bot respondeu) → Qualificado (entendeu a dor) → Em negociação (apresentou serviço+preço) → Proposta enviada (ofereceu horário) → Fechado-Ganho (agendou) |
| Regras do prompt | nunca prometa preço sem buscar no catálogo; ofereça até 3 horários livres; cliente novo → `crm.criarLead`; não cancele agendamento → escala humano |

Sub-tipos (salão/barbearia/clínica) variam só em **cadência de recompra** e
**tom/vocabulário** — tratados como variação do mesmo perfil, não perfis novos.

**DECIDIDO (2026-05-28):** no MVP, **1 perfil "Serviço" único + campo de cadência**
configurável (sem sub-presets por enquanto).

### 3.1 Agenda: capacidade e profissionais (EM DEBATE)

**Estado atual (verificado no código):** o model `Agendamento` é plano —
`{nomeCliente, data, duracao, servico, preco, status, observacoes}`. **NÃO há
profissional, NÃO há capacidade, NÃO existe tool `listarHorariosLivres`.** O bot
hoje marcaria em qualquer horário, sem checar conflito nem lotação. Gap a resolver
antes de "agendar de verdade".

**Problema levantado pelo usuário:**
- Salão/barbearia: 3+ profissionais atendem no MESMO horário → precisa de regra de
  capacidade (quantos atendimentos simultâneos).
- Clínica: 5 profissionais de ÁREAS DIFERENTES → capacidade não é um número único;
  um slot de "limpeza de pele" não pode ser atendido pelo dentista.

**Por que "nº de atendentes" (campo único) não basta:** cobre barbearia homogênea,
mas quebra na clínica — marcaria 5 dentistas no mesmo horário sendo que só há 1.

**DECIDIDO (2026-05-28): modelar Especialistas como recursos agendáveis.**
- Novo conceito `Especialista` (nome, ativo) por tenant.
- Cada especialista declara **quais serviços do catálogo executa**.
- Cada especialista tem **disponibilidade** (a definir — ver pergunta abaixo).
- `Agendamento` passa a referenciar `especialistaId`.
- Capacidade num horário = nº de especialistas **aptos àquele serviço** e livres.
- Cobre os dois casos com o mesmo modelo: barbearia (todos fazem tudo) é o caso
  particular onde todos os especialistas executam todos os serviços.
- A "quantidade de atendentes" deixa de ser um número e vira o **cadastro de
  especialistas**.

**Nomenclatura DECIDIDA:** "**Especialista**". Ideia futura: tornar o rótulo
exibido configurável por tenant (barbearia veria "Barbeiro"), mantendo "Especialista"
como termo interno.

**Implicações técnicas (a construir):** novo model `Especialista` + tabela de
vínculo especialista↔serviço (M:N); FK `especialistaId` em `Agendamento`; nova tool
`agenda.listarHorariosLivres` (considera especialista apto + duração + conflito);
UI de cadastro de especialistas; ajuste no perfil de serviço (bot escolhe/pergunta
o especialista ao agendar).

**DECIDIDO (2026-05-28): jornada por especialista.** Cada especialista tem seus
dias/horários de atendimento. Na criação, **herda o expediente da loja por padrão**
e o dono ajusta só quem foge (ex.: dentista seg/qua, esteticista ter–sáb). Implica:
configurar um expediente da loja (global) + jornada por especialista; a tool
`listarHorariosLivres` cruza jornada do especialista apto × duração do serviço ×
agendamentos existentes pra gerar os slots reais.

✅ **Frente de Segmentação (incl. agenda) — CONCLUÍDA.**

### 4. Interação do bot com o sistema (EM DEBATE)

Como o agente age na operação com segurança:
- Tools com permissão dupla: módulo liberado + habilitada no bot (JÁ EXISTE).
- **Ações que mexem em dinheiro/estoque exigem confirmação explícita do cliente**
  antes de executar ("repito o resumo e peço o sim").
- **Idempotência:** a Meta reenvia webhook; a IA pode chamar tool 2x. Precisa de
  chave idempotente pra não duplicar venda/agendamento. (RISCO — a resolver)
- Limites de alçada: bot não dá desconto fora de regra, não cancela venda → humano.
- Auditoria de toda ação (`auditoria_acoes_agente` — previsto no MD).
- Human handoff: quando e como escalar.

> PERGUNTAS ABERTAS:
> - Toda venda pelo bot exige confirmação do cliente? E valor mínimo/máximo?
> - O bot pode dar desconto? Dentro de qual regra?

### 5. Segurança estrutural e de dados — "risco de perder detalhes" (EM DEBATE)

- Mensagens cifradas em repouso AES-256-GCM por tenant (JÁ EXISTE).
- **Memória/contexto:** histórico limitado a 20 mensagens (`HISTORICO_MAX_MENSAGENS`).
  Conversa longa perde o começo. RISCO REAL. Solução possível: resumo de conversa
  + estado estruturado persistido na `Conversa.estado`.
- **Perder detalhes importantes:** cliente diz "quero sexta 15h, sou alérgico a X".
  Se fica só no chat e some do histórico, perde. Solução: agente **extrai dados
  estruturados e salva** (observação no lead/agendamento), não confia só no chat.
- **Resiliência:** mensagem é salva antes de enfileirar (bom), mas execução do
  fluxo pode falhar silenciosa. Precisa retry/dead-letter.
- Multi-tenant: tudo filtra por `clienteId` (JÁ EXISTE).
- LGPD: dados do cliente final (telefone, nome) — consentimento e retenção.

> PERGUNTAS ABERTAS:
> - Como tratar conversas longas (resumo automático? janela maior?)
> - Quais dados o agente DEVE sempre extrair e persistir (não deixar só no chat)?

### 6. Retenção — cliente único → recorrente (EM DEBATE)

- Pós-venda automático: após Fechado-Ganho, agendar follow-up.
- Gatilhos de recompra por segmento: clínica (retorno em N meses), salão (próximo
  corte em ~30d), loja (reposição/novidade).
- Histórico de compra → recomendação personalizada.
- Reativação de leads parados (já há "leads parados" no relatório de CRM).

> PERGUNTAS ABERTAS:
> - O bot dispara o follow-up sozinho ou sugere e o dono aprova?
> - Cadência por segmento — quem define (preset Sellergy vs config do tenant)?

### 7. Campanhas (EM DEBATE — hoje é só placeholder, greenfield)

Estado atual: rota `/app/campanhas` é placeholder ("Disparos em massa via bot").
Sem backend. Desenhar do zero.

**Restrições técnicas (Meta/WhatsApp) — fatos atuais (pesquisa 2026-05-28):**
- **Janela de 24h:** resposta livre (sem template) só dentro de 24h da última
  mensagem do cliente; reinicia a cada nova mensagem dele. Service msgs dentro da
  janela são gratuitas.
- **Templates (HSM):** fora da janela, só com template aprovado. ~100 templates/h;
  250/WABA sem carteira verificada, 6.000 se verificada.
- **Cobrança (desde jul/2025):** **por mensagem** (não mais por conversa).
  Categorias: Marketing (~US$ 0,025–0,14), Utility/Authentication (~US$ 0,004–0,046),
  Service (grátis na janela 24h).
- **Tiers de envio:** 250 → 1.000 → 10.000 → 100.000 → ilimitado, por Business
  Portfolio (não por número). Upgrade automático conforme qualidade.
- **Pagamento BR (jan/2026):** cartão direto saiu; valem **Pix, boleto e link de
  pagamento** (link desde fev/2026). Desenhar checkout in-chat em torno de Pix+link.

**Tipos de campanha efetivos (hipótese):**
| Campanha | Gatilho | Objetivo |
|---|---|---|
| Reativação | lead parado / cliente sumido | trazer de volta ao funil |
| Recompra/retorno | data da última compra/visita | nova venda |
| Promoção segmentada | etapa do funil / categoria comprada | acelerar fechamento |
| Aniversário / datas | data cadastrada | relacionamento + venda |
| Atendimento abandonado | parou de responder em negociação | recuperar venda |
| Pós-venda / avaliação | X dias após Fechado-Ganho | NPS + recompra |

**Estrutura genérica de campanha (hipótese):**
`segmento (quem) + gatilho (quando) + mensagem/template (o quê) + objetivo (mover
etapa/vender) + medição (conversão)`.

> PERGUNTAS ABERTAS:
> - Campanhas automáticas (gatilho) + manuais (disparo pontual), ou só um tipo?
> - Quais 2-3 campanhas entram primeiro (maior impacto x menor esforço)?

---

### 8. Mensagens / Inbox e papéis operacionais (EM DEBATE)

Estado atual: aba `/app/campanhas` e a inbox de Mensagens são placeholders. Sistema
de usuários já tem `Usuario.perfil` (enum) + `Usuario.permissoes` (JSON modular
módulo×ação) + `clienteId`. `Cliente` já guarda horário de funcionamento (JSON).

**Princípio-guia (do usuário):** "tudo que é feito manual tem que entrar no processo."
Mapear cada tarefa manual (atender, rotear, responder, agendar) e estruturar.

**Decisão de modelagem (a validar): `Especialista` ≠ `Usuario`, vínculo 1:1 opcional.**
Casos que isso resolve:
- Dentista que atende E loga → Especialista + Usuario vinculados.
- Barbeiro que só atende, não loga → Especialista sem Usuario.
- Secretária/recepção → Usuario sem Especialista.
- Dono/admin → Usuario, às vezes Especialista.

**Inbox com visibilidade por ESCOPO (peça nova):**
- Dono/admin/secretária → veem TODAS as conversas.
- Especialista (com login) → vê só as conversas ATRIBUÍDAS a ele.
- Isso é mais fino que o modelo atual (módulo×ação). Introduz o conceito de
  **escopo "todas" vs "próprias"** dentro do módulo MENSAGENS.

**Secretária NÃO é perfil fixo:** é um Usuario com módulo MENSAGENS no escopo
"todas". Especialista = MENSAGENS escopo "próprias" (ou sem o módulo). Reaproveita
o sistema modular existente + escopo.

**Roteamento de conversa:** ao escolher o serviço, o bot atribui a conversa ao
especialista apto (`Conversa.especialistaId`). Cliente passa a falar "com o
profissional"; a secretária assume quando preciso.

**Decorrências:**
- Filtro por especialista na agenda (após `Agendamento.especialistaId`).
- Novo módulo de permissão `MENSAGENS` (hoje não existe em MODULOS_TENANT).

> PERGUNTAS ABERTAS:
> - Confirmar `Especialista` ≠ `Usuario` com vínculo 1:1 opcional.
> - Escopo de mensagens ("todas" vs "próprias") como extensão do modelo de
>   permissões, em vez de perfil fixo "Secretária".
> - Atribuição de conversa: automática (pelo serviço escolhido) + reatribuição
>   manual pela secretária? Conversa pode ter mais de um especialista?

---

## 8. Pessoas, Mensagens e Acesso (EM DEBATE)

Conecta Especialista ↔ Usuário ↔ aba Mensagens ↔ Permissões ↔ handoff.

**Estado atual (verificado):** `Usuario {perfil, permissoes JSON, clienteId}`;
perfis ADMIN/VIEWER/CLIENT/ADMINISTRADOR/VENDEDOR; permissões por módulo+ação.
Aba **Mensagens é greenfield** (placeholder "Pacote 4"). Não há Especialista.

**Pontos levantados pelo usuário:**
- Vincular o Especialista ao usuário (vendedor/profissional) que o admin do tenant cria.
- Roteamento: quando o cliente escolhe serviço/produto, a conversa vai pro profissional certo.
- Mensagens com acesso restrito: usuário não-admin não vê todas as conversas.
- Caso secretária/recepção: quem responde muitas vezes não é o profissional; criar
  usuário que vê TODAS as mensagens e atende quando o cliente precisa.
- Permissão modular: "se o usuário é profissional, não tem acesso a mensagens" (ou
  só às próprias). Resolver via permissões, não hardcode.
- Agenda com filtro por especialista (ver os atendimentos de cada um).
- Princípio: mapear tudo que hoje é manual e trazer pro processo.

**Tese de modelagem (a validar):**
1. **Especialista ↔ Usuário = vínculo OPCIONAL** (`Especialista.usuarioId` nullable).
   - Nem todo especialista tem login (barbeiro só agendável; secretária cuida).
   - Nem todo usuário é especialista (secretária, dono).
   - Especialista com login vê a própria agenda e as próprias conversas.
2. **Novo módulo de permissão `MENSAGENS`** com dimensão de **escopo**: ver
   "próprias" (conversas onde é responsável) vs "todas". Os módulos de hoje só têm
   visualizar/criar/editar/excluir — Mensagens precisa do escopo a mais.
3. **Secretária = papel montado por permissão**, não perfil novo hardcoded: um
   colaborador com `MENSAGENS: ver todas + responder`. Profissional fica com
   `MENSAGENS: próprias` (ou nenhuma). Mantém o sistema granular que já existe.
4. **Conversa ganha responsável** (`especialistaId`/`usuarioId`) → roteamento e
   filtro de acesso.
5. **Agenda com filtro por especialista** (backlog de agenda).

**DECIDIDO (2026-05-28) — Roteamento e alocação:**
- O **vínculo está no serviço**: cada especialista declara os serviços que faz.
- **Bot sempre decide** o especialista (cliente NÃO escolhe um específico no MVP).
  > Nota de revisão futura: cliente fiel a um profissional ("quero com a Dra. Ana")
  > é comum em salão/clínica; reavaliar permitir escolha quando houver demanda.
- **Algoritmo de alocação:** entre os especialistas (a) aptos ao serviço e (b)
  livres no horário (jornada + sem conflito), o bot escolhe o de **MENOR carga no
  dia** (menos atendimentos agendados) — balanceamento de carga. Empate → qualquer.
- Se ninguém livre no horário pedido → oferece próximos horários livres dos aptos.

**Conceito separado de segmento (esclarecido):** `Especialista` é uma camada do
**perfil de serviço** — cadastrado na tela de Agenda/Serviços e visível só pra
tenants de serviço. Loja (produto) nunca vê "dentista". `Usuario` continua
genérico; o vínculo `Especialista.usuarioId` é opcional e feito na ficha do
especialista (não transforma "cadastro de usuário" em "cadastro de dentista").

**DECIDIDO (2026-05-28):**
- Especialista e Usuário como **entidades separadas + vínculo opcional**.
- **Mensagens** como módulo de permissão novo, com **escopo (próprias × todas)**.
- **Secretária = papel via permissão** (ver todas), não perfil novo no enum.

**Visibilidade por segmento (DECIDIDO o mecanismo):** o que cada tenant enxerga é
controlado em 3 níveis: **Plano** (paga), **Módulos liberados** (o que tem) e
**Segmento** (o "sabor"). O ADMIN do sistema define o segmento ao criar o tenant no
painel admin. Hoje `Cliente.segmento` é **texto livre/decorativo** — precisa virar
**escolha estruturada** (Serviço/Produto/Híbrido) que ativa o perfil e controla
telas/conceitos (Especialista só aparece em Serviço; Loja não vê).
- Oportunidade: ao escolher o segmento, **auto-ativar módulos certos + setar o
  perfil de serviço do bot** (reduz config manual — princípio "tirar o trabalho").
- Backlog: migrar `Cliente.segmento` de String livre → segmento estruturado.

✅ **Frente Pessoas/Mensagens/Acesso — CONCLUÍDA.**

## Log de decisões

| Data | Decisão |
|---|---|
| 2026-05-28 | Foco atual: integração WhatsApp + estrutura do bot vendedor. Demais tarefas do CRM adiadas. |
| 2026-05-28 | Tese e diferencial (seção 0) validados pelo usuário. |
| 2026-05-28 | Método de venda mapeado no funil do CRM (seção 2) — direção aceita. |
| 2026-05-28 | Pesquisa de mercado feita. Confirmado: ninguém une "venda no WhatsApp + ERP (estoque+caixa+agenda) + CRM" para PME física BR. Meta comoditizou o "atender" (Business AI grátis). Diferencial = vender + operar. |
| 2026-05-28 | MVP foca só SERVIÇO (salão/barbearia/clínica). Modelo: motor único + perfis de segmento (preset). Perfil "Serviço com agenda" definido na seção 3. |
| 2026-05-28 | MVP: 1 perfil "Serviço" + campo de cadência (sem sub-presets). |
| 2026-05-28 | Agenda: modelar Especialistas (recurso agendável com serviços que executa + disponibilidade); Agendamento ganha especialistaId; criar tool listarHorariosLivres. Nomenclatura: "Especialista" (rótulo configurável por tenant = ideia futura). |
| 2026-05-28 | Disponibilidade = jornada por especialista, herdando expediente da loja por padrão. Frente de Segmentação concluída. |
| 2026-05-28 | Roteamento: vínculo no serviço; bot sempre decide (cliente não escolhe específico no MVP); alocação pelo especialista apto+livre de MENOR carga no dia. |
| 2026-05-28 | Pessoas/Mensagens concluída: Especialista≠Usuário (vínculo opcional); Mensagens=módulo com escopo próprias/todas; secretária via permissão. Visibilidade por Segmento estruturado (definido no painel admin ao criar tenant); migrar Cliente.segmento de texto livre → estruturado. |
| 2026-05-28 | Pessoas/Mensagens concluída: Especialista≠Usuário (vínculo opcional); Mensagens=módulo com escopo próprias/todas; secretária via permissão. Visibilidade por Segmento estruturado (definido no painel admin ao criar tenant); migrar Cliente.segmento de texto livre → estruturado. |

## Perguntas abertas (consolidado)
- Recorte do MVP: quais segmentos, quais campanhas, qual escopo do fechamento.
- Checkout in-chat: usar Pix + link de pagamento (cartão direto saiu do BR em jan/2026).
