# Documentação Completa do Sistema - Sellergy Cloud

Este documento detalha as funcionalidades, APIs e a estrutura do frontend do sistema Sellergy Cloud, servindo como guia para a profissionalização e otimização da plataforma.

---

## 1. Visão Geral do Sistema

O **Sellergy Cloud** é uma plataforma integrada de gestão empresarial e automação de atendimento. Ele une um CRM inteligente, automação de bots com IA, gestão de estoque e um módulo financeiro robusto.

---


## 2. Funcionalidades Principais

### 💰 Módulo Financeiro (Business Intelligence Financeiro)
*   **Gestão de Fluxo de Caixa:** Lançamentos de Receitas e Despesas com suporte a parcelamento automático.
*   **Painel de KPIs Avançado:**
    *   **Saldo em Risco:** Total vencido não pago.
    *   **Índice de Eficácia:** Percentual de recuperação de dívidas vencidas na última semana.
    *   **Previsão de Recuperação:** Cálculo preditivo de quanto do saldo em risco deve entrar no caixa.
*   **Análise de Inadimplência:** Identificação automática de leads devedores com classificação de risco (Baixo, Alto, Crítico) e sugestão de ações.
*   **Ferramentas de Cobrança:**
    *   **Pausa Amigável:** Extensão de vencimento com um clique.
    *   **Link de Cobrança WhatsApp:** Geração automática de mensagem de cobrança com link para o cliente.
*   **Relatório DRE Simplicado:** Visão de Receita Bruta, Despesas Variáveis e Fixas para cálculo de Resultado Líquido.

### 📦 Módulo de Estoque e Catálogo
*   **Controle de Inventário:** Gestão de produtos físicos e serviços com suporte a múltiplas variações (cor, tamanho, etc.).
*   **Movimentações Inteligentes:** Registro de Entradas (Compras), Saídas (Vendas), Ajustes e Reservas.
*   **Integração Financeira Automática:** Ao registrar uma compra de fornecedor ou venda, o sistema gera automaticamente o lançamento financeiro correspondente.
*   **Dashboard de Saúde do Estoque:**
    *   **Patrimônio Imobilizado:** Valor total em estoque a preço de custo.
    *   **Índice de Ruptura:** Percentual de itens zerados no catálogo.
    *   **Alertas de Reposição:** Lista automática de itens abaixo do estoque mínimo ou ideal.
*   **Ajuste de Balanço:** Interface para inventário físico (sobrescrever estoque atual com o contado).

### 🤖 Automação e CRM
*   **Flow Builder Visual:** Interface para criação de fluxos de atendimento (Nós de mensagem, pergunta, condição, requisição HTTP).
*   **Integração Multicanal:** WhatsApp, Instagram e Telegram.
*   **IA Generativa:** Suporte a OpenAI, Anthropic, Gemini e DeepSeek para respostas inteligentes e agendamentos.
*   **Pipeline de Vendas:** Kanban de leads com histórico completo de interações e mensagens.

---

## 3. Detalhamento das APIs (Backend)

O backend é construído em Node.js com Prisma ORM e PostgreSQL.

### Endpoints Financeiros (`/api/financeiro`)
| Rota | Método | Descrição |
| :--- | :--- | :--- |
| `/lancamentos` | GET | Lista lançamentos com filtros (tipo, status, busca, data). |
| `/dashboard` | GET | Retorna KPIs de desempenho e saúde financeira. |
| `/inadimplencia` | GET | Lista clientes devedores com níveis de risco. |
| `/pausa-amigavel/:id` | POST | Posterga o vencimento de um título. |
| `/cobrar/:id` | GET | Gera link de ação para cobrança via WhatsApp. |
| `/dre` | GET | Retorna dados para o relatório de Demonstração de Resultado. |
| `/lote/status` | PATCH | Atualiza status de múltiplos lançamentos de uma vez. |

### Endpoints de Estoque (`/api/estoque`)
| Rota | Método | Descrição |
| :--- | :--- | :--- |
| `/movimentar` | POST | Registra entrada/saída e integra com financeiro. |
| `/dashboard` | GET | KPIs de valor de inventário e ruptura. |
| `/reposicao` | GET | Lista de produtos que precisam de compra urgente. |
| `/balanco` | POST | Ajuste de inventário físico em lote. |

---

## 4. Estrutura do Frontend (Arquitetura Atual)

O frontend utiliza **React + Vite** com **Tailwind CSS**.

### Organização de Arquivos
- `src/pages/`: Contém as visualizações principais (`FinanceiroPage.jsx`, `EstoquePage.jsx`, etc.).
- `src/components/`: Componentes reutilizáveis e modais específicos.
- `src/services/api.js`: Configuração do Axios para comunicação com o backend.
- `src/store/`: Gerenciamento de estado global (Zustand/Context API).

### Pontos de Melhoria para Profissionalização (UI/UX)
1.  **Sistemas de Design (Design System):** Atualmente utiliza Tailwind puro. A transição para componentes baseados em **Shadcn/UI** (Radix UI) traria uma consistência de "Enterprise Software".
2.  **Visualização de Dados:** Substituir listas simples por gráficos interativos (**Recharts**) no dashboard financeiro e de estoque.
3.  **Feedback Visual:** Implementar **Skeletons** para estados de carregamento e **Toasts** para notificações de sucesso/erro.
4.  **UX de Tabelas:** Adicionar ordenação por colunas, paginação robusta e filtros avançados persistentes.
5.  **Micro-interações:** Uso de **Framer Motion** para transições de página e feedbacks de botões.

---

## 5. Próximos Passos Sugeridos

1.  **Refatoração do Layout Principal:** Adotar uma Sidebar colapsável e um Header mais limpo.
2.  **Dashboard Executivo:** Criar uma página inicial consolidada com os principais KPIs de todos os módulos.
3.  **Relatórios Exportáveis:** Adicionar funcionalidade de exportar DRE e Lista de Reposição para PDF/Excel.
4.  **Auditoria:** Implementar log de atividades visível para o admin (quem mudou o estoque ou deletou um lançamento).
