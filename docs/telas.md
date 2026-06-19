# Telas do ERP — diagramas e estrutura (pós-pivô)

> Mapa de telas do produto **ERP-first**. Substitui `telas-e-fluxos.md` (histórico).
> Cada tela tem **propósito + diagrama de layout (blocos) + elementos + notas de
> segmento**. Os diagramas são wireframes (estrutura, não pixel). Visuais detalhados da
> **Agenda** já existem (mockups Dia/Semana/Mês). Posso gerar mockup visual de qualquer
> tela sob demanda. Criado em 2026-06-19.

**Layout base (todas as telas do app):** Sidebar à esquerda (módulos liberados, filtrados
por segmento) + Topbar (título, busca global, notificações, usuário). O conteúdo abaixo é
o miolo de cada tela.

**Padrão recorrente "lista":**
```
┌──────────────────────────────────────────────┐
│  KPIs / faixa de resumo (opcional)            │
│  [busca]   [filtro ▾] [filtro ▾]    [+ Novo]  │
│  ┌────────────────────────────────────────┐  │
│  │  tabela / cards                        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
        clique → Drawer/Modal de detalhe
```

---

# A) Telas do App (tenant)

## 1. Início / Dashboard  (`/app/dashboard`) — ambos
Propósito: visão do dia e atalhos.
```
┌─────────────── KPIs do dia ───────────────┐
│ Agendados | Vendas | A receber | Caixa    │
├───────────────────────────────────────────┤
│ Próximos atendimentos   │ Atalhos rápidos  │
│ (lista curta)           │ (+venda, +agenda)│
└───────────────────────────────────────────┘
```
Notas: KPIs variam por segmento (clínica destaca agenda; loja destaca vendas/caixa).
**Sem faturamento** detalhado aqui pra perfis sem acesso a Financeiro.

## 2. Clientes / CRM  (`/app/crm`) — ambos
Propósito: base de clientes/leads + funil.
- Visão **Kanban** (etapas) ou **lista**; busca; filtro por etapa/tag.
- Card do cliente → Drawer: dados, histórico (compras/agendamentos), ações.
- **Histórico do cliente** (compras + agendamentos) vive aqui.

## 3. Agenda  (`/app/agenda`) — clínica/serviço *(mockups visuais prontos)*
Propósito: operar a agenda por profissional.
- Topo: navegação de data · **Dia / Semana / Mês** · **+ Novo agendamento**.
- Filtros: especialista, status. Resumo: agendados/concluídos/cancelados (**sem faturamento**).
- **Dia** = coluna por profissional, linhas por hora; **Semana** = 7 colunas; **Mês** = grade.
- Drawer do agendamento: detalhe + **Concluir e gerar venda** / **Não compareceu** + histórico.
- Modal de novo: cliente (busca) → serviço (busca, traz valor/duração/especialista) → horário.

## 4. Vendas / PDV  (`/app/vendas`) — loja
Propósito: registrar venda e ver histórico.
```
┌─ KPIs (vendas, faturado, no mês, via cliente) ─┐
│ [busca] [filtro status ▾]         [+ Nova venda]│
│  tabela de vendas (nº, data, valor, status)     │
└─────────────────────────────────────────────────┘
```
- Modal **Nova venda (PDV):** itens (busca produto) → quantidade → método → **exige caixa
  aberto** → fecha venda (baixa estoque + lançamento + cobrança Pix/maquininha).
- Drawer: detalhe + **Cancelar** (com motivo) + vincular cliente. **Sem excluir.**
- Modal "Caixa fechado" quando não há caixa aberto.

## 5. Catálogo  (`/app/catalogo`) — ambos
Propósito: cadastrar produtos (loja) e serviços (clínica).
- Lista filtrável por tipo; **+ Novo** + **Categoria de serviço/produto** (criação contextual).
- Modal do item: nome, descrição, **categoria (filtrada por uso)**, preço, imagem;
  serviço → **duração + especialistas que atendem** (multi-select).

## 6. Estoque  (`/app/estoque/:aba`) — loja
Propósito: gestão de produtos físicos.
- Abas: Visão geral · Produtos · Movimentações · Reposição · Categorias.
- Saldos, alertas de estoque crítico, entradas/ajustes, curva ABC/CMV.

## 7. Financeiro  (`/app/financeiro/:aba`) — ambos
Propósito: dinheiro do negócio.
- Abas: **Lançamentos** · **Caixa** (abrir/fechar, sangria/suprimento) · **Contas a pagar** ·
  **Categorias** (gestão geral, com **uso**).
- Lançamento: receita/despesa, status, categoria (filtrada por uso/tipo).

## 8. Relatórios  (`/app/relatorios/:aba`) — ambos
Propósito: consolidação (leitura — vê todas as categorias).
- Abas: Visão executiva · Financeiro · Vendas · Caixa · Estoque/CMV · Fechamento mensal.
- Exportação CSV/Excel/PDF.

## 9. Pagamentos  (`/app/pagamentos`) — ambos *(nova)*
Propósito: configurar recebimento e acompanhar cobranças.
```
┌─ Configuração ──────────────────────────────┐
│ Provedor: ( ) Mercado Pago ( ) Asaas ( ) Pagar.me │
│ [credencial / conectar]      [testar]        │
├─ Cobranças ─────────────────────────────────┤
│ tabela: origem, valor, método, status, data  │
└──────────────────────────────────────────────┘
```
- Status da `Cobranca`: pendente/pago/expirado/cancelado/estornado. Ações: gerar link/Pix, estornar.

## 10. Fiscal  (`/app/fiscal`) — ambos *(nova)*
Propósito: configurar emissão e ver documentos.
```
┌─ Configuração fiscal ───────────────────────┐
│ Provedor: ( ) Focus NFe ( ) Nuvem Fiscal     │
│ Regime · CNPJ · Inscrição · Certificado · CSC│
├─ Documentos ────────────────────────────────┤
│ tabela: tipo (NFC-e/NFS-e), nº, status, PDF  │
└──────────────────────────────────────────────┘
```
- Status do `DocumentoFiscal`: pendente/processando/emitida/erro/cancelada. Reprocessar em erro.

## 11. Bot WhatsApp  (`/app/bot`) — ambos *(remontada, sem IA)*
Propósito: conectar o WhatsApp e configurar o bot automatizado.
```
┌─ Conexão ───────────────────────────────────┐
│ [ Conectar WhatsApp ]  (Embedded Signup Meta) │
│ status: conectado · número · (desconectar)   │
├─ Agendamento (clínica) ─────────────────────┤
│ ativar · mensagem de boas-vindas · menu      │
├─ Atendimento básico (loja) ─────────────────┤
│ respostas fixas: horário/endereço/pagamento  │
└──────────────────────────────────────────────┘
```
- Sem builder de fluxo, sem IA, sem inbox humano. Menu fixo.

## 12. Campanhas  (`/app/campanhas`) — ambos
Propósito: trazer cliente de volta.
- **Fila de recompra** (quem comprou há N dias e não voltou) + filtro de janela.
- Disparo via **template HSM** aprovado; ação por cliente (WhatsApp).

## 13. Usuários & Equipe  (`/app/usuarios`) — ambos *(unificada)*
Propósito: criar e gerir **todos** os usuários, incluindo especialista.
```
┌─ [busca]                         [+ Novo usuário] ┐
│  lista: nome, tipo, e-mail, status               │
└──────────────────────────────────────────────────┘
   Modal novo usuário:
   ┌──────────────────────────────────────────┐
   │ Nome · E-mail · Tipo ▾                    │
   │   (tipos filtrados por SEGMENTO)          │
   │   ── se Tipo = Especialista (clínica): ── │
   │   Jornada · Serviços que atende (multi)   │
   │ Matriz de permissões (módulos×ações,      │
   │   filtrada por segmento) + escopo         │
   └──────────────────────────────────────────┘
```
- **Gating por segmento:** loja não mostra "Especialista" nem módulos de serviço; clínica
  esconde módulos de varejo. Especialista cria `Usuario` + `Especialista` em transação.
- Senha inicial `123456` + troca obrigatória.

## 14. Configurações  (`/app/configuracoes`) — ambos
Propósito: dados do negócio + acessos.
- Perfil/negócio, horário de funcionamento, branding, credenciais (pagamento/fiscal/WhatsApp),
  avisos/notificações.

---

# B) Telas do Admin (plataforma)

## 15. Dashboard admin  (`/admin/dashboard`)
KPIs da plataforma: tenants, ativos, MRR, status geral.

## 16. Clientes/Tenants  (`/admin/clientes`)
Lista de tenants; criar (nome, e-mail, **segmento** → auto-ativa módulos); status; drawer com módulos.

## 17. Permissões por cliente  (`/admin/clientes/permissoes`)
Matriz de **módulos liberados** por tenant (o que cada um "comprou").

## 18. Equipe admin  (`/admin/usuarios`)
Usuários internos da plataforma.

## 19. Configurações admin  (`/admin/configuracoes`)
Config da plataforma (sem a parte de IA, que morreu).

---

## Telas que MORRERAM (não existem mais)
`/admin/ia` (IA de plataforma) · `/admin/bots/:id/config` e `/tools` (config de bot-IA) ·
`/admin/builder/:id` (builder de fluxo) · `/app/mensagens` (inbox) ·
`/app/especialistas` (virou tipo de usuário em Usuários).

## Pendências
- [ ] Validar os diagramas tela a tela.
- [ ] Quer mockup **visual** (não só wireframe) de alguma específica? (ex.: Usuários com
      gating, Pagamentos, Fiscal) — gero como fiz na Agenda.
