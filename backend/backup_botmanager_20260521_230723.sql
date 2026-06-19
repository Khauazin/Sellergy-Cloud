--
-- PostgreSQL database dump
--

\restrict DazzARKin7q0FKwGFkHXXe9MAh2RchhUKuyldq4gyArDC5Q3Mmy2zKkmoNJbmCB

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AutorMensagem; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AutorMensagem" AS ENUM (
    'BOT',
    'CLIENTE_FINAL',
    'VENDEDOR',
    'SISTEMA'
);


ALTER TYPE public."AutorMensagem" OWNER TO postgres;

--
-- Name: Canal; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Canal" AS ENUM (
    'WHATSAPP',
    'INSTAGRAM',
    'WEBSITE',
    'TELEGRAM'
);


ALTER TYPE public."Canal" OWNER TO postgres;

--
-- Name: ModoExecucao; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ModoExecucao" AS ENUM (
    'MANUAL',
    'WEBHOOK',
    'SCHEDULE'
);


ALTER TYPE public."ModoExecucao" OWNER TO postgres;

--
-- Name: NivelLog; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."NivelLog" AS ENUM (
    'NENHUM',
    'METADATA',
    'COMPLETO'
);


ALTER TYPE public."NivelLog" OWNER TO postgres;

--
-- Name: OrigemAgendamento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrigemAgendamento" AS ENUM (
    'MANUAL',
    'AI'
);


ALTER TYPE public."OrigemAgendamento" OWNER TO postgres;

--
-- Name: Perfil; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Perfil" AS ENUM (
    'ADMIN',
    'VIEWER',
    'CLIENT',
    'ADMINISTRADOR',
    'VENDEDOR'
);


ALTER TYPE public."Perfil" OWNER TO postgres;

--
-- Name: Plano; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Plano" AS ENUM (
    'BASIC',
    'PRO',
    'PREMIUM'
);


ALTER TYPE public."Plano" OWNER TO postgres;

--
-- Name: Prioridade; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Prioridade" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH'
);


ALTER TYPE public."Prioridade" OWNER TO postgres;

--
-- Name: ProvedorIA; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProvedorIA" AS ENUM (
    'OPENAI',
    'ANTHROPIC',
    'DEEPSEEK',
    'CUSTOM',
    'GEMINI'
);


ALTER TYPE public."ProvedorIA" OWNER TO postgres;

--
-- Name: SentidoMensagem; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SentidoMensagem" AS ENUM (
    'ENTRADA',
    'SAIDA'
);


ALTER TYPE public."SentidoMensagem" OWNER TO postgres;

--
-- Name: Severidade; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Severidade" AS ENUM (
    'INFO',
    'WARNING',
    'ERROR',
    'CRITICAL'
);


ALTER TYPE public."Severidade" OWNER TO postgres;

--
-- Name: StatusAgendamento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusAgendamento" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELED',
    'COMPLETED'
);


ALTER TYPE public."StatusAgendamento" OWNER TO postgres;

--
-- Name: StatusAlerta; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusAlerta" AS ENUM (
    'OPEN',
    'RESOLVED',
    'IGNORED'
);


ALTER TYPE public."StatusAlerta" OWNER TO postgres;

--
-- Name: StatusBot; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusBot" AS ENUM (
    'ONLINE',
    'OFFLINE',
    'ERROR'
);


ALTER TYPE public."StatusBot" OWNER TO postgres;

--
-- Name: StatusCliente; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusCliente" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);


ALTER TYPE public."StatusCliente" OWNER TO postgres;

--
-- Name: StatusEntregaMensagem; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusEntregaMensagem" AS ENUM (
    'PENDENTE',
    'ENVIADA',
    'ENTREGUE',
    'LIDA',
    'ERRO'
);


ALTER TYPE public."StatusEntregaMensagem" OWNER TO postgres;

--
-- Name: StatusExecucao; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusExecucao" AS ENUM (
    'PENDENTE',
    'EM_EXECUCAO',
    'SUCESSO',
    'ERRO',
    'CANCELADA'
);


ALTER TYPE public."StatusExecucao" OWNER TO postgres;

--
-- Name: StatusFinanceiro; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusFinanceiro" AS ENUM (
    'PENDENTE',
    'PAGO',
    'ATRASADO',
    'CANCELADO'
);


ALTER TYPE public."StatusFinanceiro" OWNER TO postgres;

--
-- Name: StatusVenda; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."StatusVenda" AS ENUM (
    'PENDING',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED'
);


ALTER TYPE public."StatusVenda" OWNER TO postgres;

--
-- Name: TipoGatilho; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoGatilho" AS ENUM (
    'KEYWORD',
    'DEFAULT',
    'ALWAYS'
);


ALTER TYPE public."TipoGatilho" OWNER TO postgres;

--
-- Name: TipoLancamento; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoLancamento" AS ENUM (
    'RECEITA',
    'DESPESA'
);


ALTER TYPE public."TipoLancamento" OWNER TO postgres;

--
-- Name: TipoMensagem; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoMensagem" AS ENUM (
    'TEXTO',
    'IMAGEM',
    'AUDIO',
    'VIDEO',
    'ARQUIVO',
    'LOCALIZACAO',
    'CONTATO',
    'STICKER'
);


ALTER TYPE public."TipoMensagem" OWNER TO postgres;

--
-- Name: TipoMovimentacao; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoMovimentacao" AS ENUM (
    'VENDA',
    'AJUSTE',
    'DEVOLUCAO',
    'COMPRA_FORNECEDOR',
    'RESERVA'
);


ALTER TYPE public."TipoMovimentacao" OWNER TO postgres;

--
-- Name: TipoNo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoNo" AS ENUM (
    'MESSAGE',
    'QUESTION',
    'CONDITION',
    'DELAY',
    'HTTP_REQUEST',
    'UPDATE_LEAD',
    'MANUAL',
    'IF',
    'SET',
    'CODE',
    'WEBHOOK',
    'SCHEDULE'
);


ALTER TYPE public."TipoNo" OWNER TO postgres;

--
-- Name: TipoProduto; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoProduto" AS ENUM (
    'FISICO',
    'SERVICO'
);


ALTER TYPE public."TipoProduto" OWNER TO postgres;

--
-- Name: TipoVariavel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TipoVariavel" AS ENUM (
    'TEXT',
    'NUMBER',
    'BOOLEAN'
);


ALTER TYPE public."TipoVariavel" OWNER TO postgres;

--
-- Name: VisibilidadeProduto; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."VisibilidadeProduto" AS ENUM (
    'ATIVO',
    'PAUSADO',
    'ARQUIVADO'
);


ALTER TYPE public."VisibilidadeProduto" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamentos (
    id text NOT NULL,
    "clienteId" text NOT NULL,
    "leadId" text,
    "nomeCliente" text NOT NULL,
    "telefoneCliente" text,
    duracao integer DEFAULT 30 NOT NULL,
    origem public."OrigemAgendamento" DEFAULT 'MANUAL'::public."OrigemAgendamento" NOT NULL,
    data timestamp(3) without time zone NOT NULL,
    servico text,
    preco double precision,
    status public."StatusAgendamento" DEFAULT 'PENDING'::public."StatusAgendamento" NOT NULL,
    observacoes text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.agendamentos OWNER TO postgres;

--
-- Name: agendamentos_fluxo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamentos_fluxo (
    id text NOT NULL,
    "fluxoId" text NOT NULL,
    "noId" text NOT NULL,
    "expressaoCron" text NOT NULL,
    "fusoHorario" text DEFAULT 'America/Sao_Paulo'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "ultimoDisparoEm" timestamp(3) without time zone,
    "proximoDisparoEm" timestamp(3) without time zone,
    "totalDisparos" integer DEFAULT 0 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.agendamentos_fluxo OWNER TO postgres;

--
-- Name: alertas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alertas (
    id text NOT NULL,
    "botId" text NOT NULL,
    "clienteId" text NOT NULL,
    "usuarioId" text,
    severidade public."Severidade" DEFAULT 'ERROR'::public."Severidade" NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    status public."StatusAlerta" DEFAULT 'OPEN'::public."StatusAlerta" NOT NULL,
    "resolvidoEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.alertas OWNER TO postgres;

--
-- Name: auditoria_mensagens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria_mensagens (
    id text NOT NULL,
    "mensagemId" text NOT NULL,
    "usuarioId" text,
    acao text NOT NULL,
    ip text,
    "userAgent" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.auditoria_mensagens OWNER TO postgres;

--
-- Name: bot_variaveis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bot_variaveis (
    id text NOT NULL,
    "botId" text NOT NULL,
    chave text NOT NULL,
    valor text NOT NULL,
    descricao text,
    tipo public."TipoVariavel" DEFAULT 'TEXT'::public."TipoVariavel" NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.bot_variaveis OWNER TO postgres;

--
-- Name: bots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bots (
    id text NOT NULL,
    "apiKeyIa" text,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    canal public."Canal" DEFAULT 'WHATSAPP'::public."Canal" NOT NULL,
    "clienteId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "mensagensHoje" integer DEFAULT 0 NOT NULL,
    "modeloIa" text,
    nome text NOT NULL,
    "promptSistemaIa" text,
    "provedorIa" public."ProvedorIA",
    telefone text,
    "temperaturaIa" double precision DEFAULT 0.7,
    "totalMensagens" integer DEFAULT 0 NOT NULL,
    "ultimaAtividadeEm" timestamp(3) without time zone,
    status public."StatusBot" DEFAULT 'OFFLINE'::public."StatusBot" NOT NULL
);


ALTER TABLE public.bots OWNER TO postgres;

--
-- Name: categorias_financeiras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categorias_financeiras (
    id text NOT NULL,
    nome text NOT NULL,
    tipo public."TipoLancamento" NOT NULL,
    "clienteId" text NOT NULL
);


ALTER TABLE public.categorias_financeiras OWNER TO postgres;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clientes (
    id text NOT NULL,
    nome text NOT NULL,
    email text,
    telefone text,
    segmento text,
    plano public."Plano" DEFAULT 'BASIC'::public."Plano" NOT NULL,
    status public."StatusCliente" DEFAULT 'ACTIVE'::public."StatusCliente" NOT NULL,
    mensalidade double precision DEFAULT 0 NOT NULL,
    observacoes text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "modulosLiberados" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "brandLogo" text,
    "brandNome" text
);


ALTER TABLE public.clientes OWNER TO postgres;

--
-- Name: conexoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conexoes (
    id text NOT NULL,
    "fluxoId" text NOT NULL,
    "noOrigemId" text NOT NULL,
    "noDestinoId" text NOT NULL,
    "pontoOrigem" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.conexoes OWNER TO postgres;

--
-- Name: conversas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversas (
    id text NOT NULL,
    "clienteId" text NOT NULL,
    "leadId" text,
    "botId" text,
    canal public."Canal" DEFAULT 'WHATSAPP'::public."Canal" NOT NULL,
    identificador text,
    "ultimaMsgEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.conversas OWNER TO postgres;

--
-- Name: execucoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execucoes (
    id text NOT NULL,
    "fluxoId" text NOT NULL,
    status public."StatusExecucao" DEFAULT 'PENDENTE'::public."StatusExecucao" NOT NULL,
    modo public."ModoExecucao" DEFAULT 'MANUAL'::public."ModoExecucao" NOT NULL,
    "iniciadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finalizadaEm" timestamp(3) without time zone,
    "duracaoMs" integer,
    "dadosGatilho" jsonb,
    erro text,
    "iniciadaPorId" text,
    "noTriggerId" text
);


ALTER TABLE public.execucoes OWNER TO postgres;

--
-- Name: execucoes_nos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execucoes_nos (
    id text NOT NULL,
    "execucaoId" text NOT NULL,
    "noId" text NOT NULL,
    tipo public."TipoNo" NOT NULL,
    status public."StatusExecucao" DEFAULT 'PENDENTE'::public."StatusExecucao" NOT NULL,
    "iniciadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finalizadoEm" timestamp(3) without time zone,
    "duracaoMs" integer,
    entrada jsonb,
    saida jsonb,
    erro text
);


ALTER TABLE public.execucoes_nos OWNER TO postgres;

--
-- Name: fluxos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fluxos (
    id text NOT NULL,
    "botId" text NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    "tipoGatilho" public."TipoGatilho" DEFAULT 'KEYWORD'::public."TipoGatilho" NOT NULL,
    "palavraChaveGatilho" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "nivelLog" public."NivelLog" DEFAULT 'METADATA'::public."NivelLog" NOT NULL,
    "diasRetencaoSucesso" integer DEFAULT 30 NOT NULL,
    "diasRetencaoErro" integer DEFAULT 90 NOT NULL
);


ALTER TABLE public.fluxos OWNER TO postgres;

--
-- Name: lancamentos_financeiros; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lancamentos_financeiros (
    id text NOT NULL,
    "leadId" text,
    "vendaId" text,
    "categoriaId" text,
    descricao text NOT NULL,
    valor double precision NOT NULL,
    tipo public."TipoLancamento" NOT NULL,
    status public."StatusFinanceiro" DEFAULT 'PENDENTE'::public."StatusFinanceiro" NOT NULL,
    "dataVencimento" timestamp(3) without time zone NOT NULL,
    "dataPagamento" timestamp(3) without time zone,
    "dataCancelamento" timestamp(3) without time zone,
    "motivoCancelamento" text,
    "idAgrupamento" text,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "clienteId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    produto text,
    "metodoPagamento" text
);


ALTER TABLE public.lancamentos_financeiros OWNER TO postgres;

--
-- Name: lead_etapas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_etapas (
    id text NOT NULL,
    "clienteId" text NOT NULL,
    nome text NOT NULL,
    ordem integer NOT NULL,
    cor text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.lead_etapas OWNER TO postgres;

--
-- Name: lead_historico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_historico (
    id text NOT NULL,
    "leadId" text NOT NULL,
    acao text NOT NULL,
    "deEtapa" text,
    "paraEtapa" text,
    observacoes text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.lead_historico OWNER TO postgres;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id text NOT NULL,
    email text,
    tags text,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "clienteId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "etapaId" text,
    nome text NOT NULL,
    observacoes text,
    origem text,
    prioridade public."Prioridade" DEFAULT 'MEDIUM'::public."Prioridade" NOT NULL,
    telefone text,
    "ultimoContato" timestamp(3) without time zone,
    valor double precision
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: mensagens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mensagens (
    id text NOT NULL,
    "leadId" text NOT NULL,
    conteudo text NOT NULL,
    "doBot" boolean DEFAULT false NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.mensagens OWNER TO postgres;

--
-- Name: mensagens_conversa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mensagens_conversa (
    id text NOT NULL,
    "conversaId" text NOT NULL,
    "clienteId" text NOT NULL,
    sentido public."SentidoMensagem" NOT NULL,
    autor public."AutorMensagem" NOT NULL,
    "autorUsuarioId" text,
    tipo public."TipoMensagem" DEFAULT 'TEXTO'::public."TipoMensagem" NOT NULL,
    "statusEntrega" public."StatusEntregaMensagem" DEFAULT 'PENDENTE'::public."StatusEntregaMensagem" NOT NULL,
    "conteudoCifrado" bytea NOT NULL,
    iv bytea NOT NULL,
    tag bytea NOT NULL,
    "versaoChave" integer DEFAULT 1 NOT NULL,
    "midiaUrl" text,
    "midiaTipoMime" text,
    metadata jsonb,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.mensagens_conversa OWNER TO postgres;

--
-- Name: movimentacoes_estoque; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimentacoes_estoque (
    id text NOT NULL,
    "variacaoId" text NOT NULL,
    tipo public."TipoMovimentacao" NOT NULL,
    quantidade integer NOT NULL,
    motivo text,
    "vendaId" text,
    data timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.movimentacoes_estoque OWNER TO postgres;

--
-- Name: nos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nos (
    id text NOT NULL,
    "fluxoId" text NOT NULL,
    tipo public."TipoNo" NOT NULL,
    "posicaoX" double precision NOT NULL,
    "posicaoY" double precision NOT NULL,
    dados jsonb NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.nos OWNER TO postgres;

--
-- Name: produtos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produtos (
    id text NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo public."TipoProduto" DEFAULT 'FISICO'::public."TipoProduto" NOT NULL,
    visibilidade public."VisibilidadeProduto" DEFAULT 'ATIVO'::public."VisibilidadeProduto" NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "clienteId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "imagemUrl" text
);


ALTER TABLE public.produtos OWNER TO postgres;

--
-- Name: saldo_historico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.saldo_historico (
    id text NOT NULL,
    valor double precision NOT NULL,
    motivo text,
    data timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "clienteId" text NOT NULL
);


ALTER TABLE public.saldo_historico OWNER TO postgres;

--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios (
    id text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha text NOT NULL,
    perfil public."Perfil" DEFAULT 'ADMIN'::public."Perfil" NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "clienteId" text,
    permissoes jsonb DEFAULT '{}'::jsonb,
    "deveTrocarSenha" boolean DEFAULT false NOT NULL,
    foto text
);


ALTER TABLE public.usuarios OWNER TO postgres;

--
-- Name: variacoes_produto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.variacoes_produto (
    id text NOT NULL,
    "produtoId" text NOT NULL,
    nome text NOT NULL,
    sku text,
    preco double precision NOT NULL,
    "estoqueAtual" integer DEFAULT 0 NOT NULL,
    "estoqueIdeal" integer DEFAULT 0,
    "estoqueMinimo" integer DEFAULT 0,
    localizacao text,
    "precoCusto" double precision DEFAULT 0,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "precoCatalogo" double precision,
    "usarPrecoCatalogo" boolean DEFAULT false NOT NULL,
    "imagemUrl" text
);


ALTER TABLE public.variacoes_produto OWNER TO postgres;

--
-- Name: vendas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendas (
    id text NOT NULL,
    "clienteId" text NOT NULL,
    "leadId" text,
    valor double precision NOT NULL,
    "metodoPagamento" text,
    status public."StatusVenda" DEFAULT 'COMPLETED'::public."StatusVenda" NOT NULL,
    descricao text,
    data timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "dataCancelamento" timestamp(3) without time zone,
    "motivoCancelamento" text,
    "canceladaPorId" text
);


ALTER TABLE public.vendas OWNER TO postgres;

--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhooks (
    id text NOT NULL,
    "fluxoId" text NOT NULL,
    "noId" text NOT NULL,
    segredo text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "exigirHmac" boolean DEFAULT false NOT NULL,
    descricao text,
    "ultimaChamadaEm" timestamp(3) without time zone,
    "totalChamadas" integer DEFAULT 0 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.webhooks OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
943ba19b-8a34-4be2-91ed-c2563193eb00	69db20e94eabc3d9f50a9294be8504da6712ec263aa66cb0e16e6c32461d0c62	2026-05-01 03:23:41.312717+00	20260422185015_init	\N	\N	2026-05-01 03:23:41.070212+00	1
22629a39-c6ae-451f-a39d-d8d5e9972341	f3c86eb17b1b625d76cac4be7e8ca248410a9a361c88dad3d4827157ab0e620b	2026-05-01 03:23:41.417609+00	20260427174805_ajuste_financeiro_v7	\N	\N	2026-05-01 03:23:41.317471+00	1
49fc95ba-7bad-4394-afe4-8c6a2dcb65c7	3a044e17be558ce2ca704c58544eaaf7dc7ea2adee0f612d08af4977e6edac59	2026-05-01 03:48:36.173246+00	20260501100000_conversas_mensagens_retencao	\N	\N	2026-05-01 03:48:36.090172+00	1
6296dd2d-5781-4000-ba45-5fca514b9bf3	afde56bb11a5efc3cc3e8a66c1a5f25946535d4f1dd160ab45b2d3d2669f55e9	2026-05-01 03:23:41.45035+00	20260427180900_ajuste_financeiro_v7	\N	\N	2026-05-01 03:23:41.422292+00	1
6bb3235a-d6cf-408c-838c-c5676b5fc23b	91218837e677a3274f25fa2e84a0786357e9624eb713a5c0c954e9105acc2199	2026-05-01 03:23:41.471037+00	20260428011255_ajuste_estoque_v8	\N	\N	2026-05-01 03:23:41.455208+00	1
c437c33e-c2c1-428e-9e0c-8efc8766b187	6419441a6b13684022c2ee353c819d937fd7fe4eb620290bac1027b4364e45d8	2026-05-01 03:23:41.778099+00	20260428020033_finalize_portuguese_naming	\N	\N	2026-05-01 03:23:41.476151+00	1
49a1c031-d2bf-4fa8-a578-a233310b4641	a56f8367c623260e5b42f2b97744ef253c273094e0723ade36c00b78efd1449c	2026-05-01 18:56:30.122954+00	20260501120000_imagens_produto_variacao	\N	\N	2026-05-01 18:56:30.03655+00	1
d191347f-bb71-406c-b402-d19cb18ea876	5f36eb5dd56c1944e9656def330d84ae0f5518e0e395268973563294ea6e0e51	2026-05-01 03:23:41.792154+00	20260428235852_adicionar_permissoes_usuario	\N	\N	2026-05-01 03:23:41.782308+00	1
e93ae1e3-f1c2-4129-9ba2-7c7f318208a2	a7bdf01d94535293bfce5454f5c0aff09ff7ba87b5586cb8978a28a5585e6cd8	2026-05-01 03:23:41.806692+00	20260429120000_permissoes_modulos_e_troca_senha	\N	\N	2026-05-01 03:23:41.794997+00	1
9b03b769-c3fc-46ea-9e27-50240371cf61	e24f13e262495de6e52808b28b035c993066723204e522187e445fa8317f5d6a	2026-05-01 03:23:41.82232+00	20260430120000_lancamento_produto_metodo_pagamento	\N	\N	2026-05-01 03:23:41.810894+00	1
63b9d536-7ebb-45c9-8443-f61584077ae8	303ec2dbc902006c2e53477235821c646c5f107d1840b90df772557569030c0e	2026-05-01 19:09:36.314952+00	20260501130000_cancelamento_venda	\N	\N	2026-05-01 19:09:36.264951+00	1
bd59a506-59cb-4d7b-8f4b-c9e09035804b	bdcf696b09e2e36c411df14f8074c5d45d2838ab715b097ac1fbbf9d94fcf476	2026-05-01 03:23:41.837279+00	20260430130000_preco_catalogo_variacao	\N	\N	2026-05-01 03:23:41.827847+00	1
a58435bd-57f4-4269-9ac3-df714c46280d	07fdcd1340f1c374a97dd3687c950a97f09634ca47f957ce27b70e8d87573204	2026-05-01 03:23:41.853261+00	20260430140000_branding_e_foto	\N	\N	2026-05-01 03:23:41.841689+00	1
844b68ac-1d31-42f1-87e7-bc7334c96a1c	054d288bf531c0c76c6cc6806a6c8ff0ee0b517167a5e2e4b7aa6f3c8fcf28ae	2026-05-01 03:23:41.915417+00	20260430150000_engine_workflows_fase1	\N	\N	2026-05-01 03:23:41.855882+00	1
c6ac5ea9-7a1b-435c-82b5-8a623776a1af	a0dc35db6ddde4561443c6e1101e29cafc66da0e4ecf1e63fba80c7e24892fbd	2026-05-01 03:23:41.938584+00	20260430160000_webhooks_e_schedule	\N	\N	2026-05-01 03:23:41.91776+00	1
af1794c9-2ca3-40f5-aea7-21df49add3ef	29e129fabee9c3286637185c874fb542cacf19a59ba706fe4f4049c7088d6653	2026-05-01 03:23:41.965111+00	20260430170000_agendamento_fluxo	\N	\N	2026-05-01 03:23:41.942579+00	1
\.


--
-- Data for Name: agendamentos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agendamentos (id, "clienteId", "leadId", "nomeCliente", "telefoneCliente", duracao, origem, data, servico, preco, status, observacoes, "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: agendamentos_fluxo; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.agendamentos_fluxo (id, "fluxoId", "noId", "expressaoCron", "fusoHorario", ativo, "ultimoDisparoEm", "proximoDisparoEm", "totalDisparos", "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: alertas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alertas (id, "botId", "clienteId", "usuarioId", severidade, titulo, mensagem, status, "resolvidoEm", "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: auditoria_mensagens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auditoria_mensagens (id, "mensagemId", "usuarioId", acao, ip, "userAgent", "criadoEm") FROM stdin;
\.


--
-- Data for Name: bot_variaveis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bot_variaveis (id, "botId", chave, valor, descricao, tipo, "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: bots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bots (id, "apiKeyIa", "atualizadoEm", canal, "clienteId", "criadoEm", "mensagensHoje", "modeloIa", nome, "promptSistemaIa", "provedorIa", telefone, "temperaturaIa", "totalMensagens", "ultimaAtividadeEm", status) FROM stdin;
18822a0f-035f-41c5-ab29-281620f27f74	\N	2026-05-01 04:06:18.065	WHATSAPP	d0e0f77b-a497-43ec-bb24-93f06140c1ce	2026-05-01 04:06:18.065	0	gpt-4o-mini	Assistente de vendas 		OPENAI	+55 62 995732333	0.7	0	\N	OFFLINE
\.


--
-- Data for Name: categorias_financeiras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categorias_financeiras (id, nome, tipo, "clienteId") FROM stdin;
\.


--
-- Data for Name: clientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clientes (id, nome, email, telefone, segmento, plano, status, mensalidade, observacoes, "criadoEm", "atualizadoEm", "modulosLiberados", "brandLogo", "brandNome") FROM stdin;
d0e0f77b-a497-43ec-bb24-93f06140c1ce	João	joaovictor@gmail.com	62995732333	Assistencia tecnica	PRO	ACTIVE	150	\N	2026-05-01 04:05:04.084	2026-05-01 04:05:11.489	{"CRM": true, "BOTS": true, "AGENDA": true, "VENDAS": true, "ALERTAS": true, "ESTOQUE": true, "CATALOGO": true, "USUARIOS": true, "FINANCEIRO": true, "RELATORIOS": true}	\N	\N
\.


--
-- Data for Name: conexoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conexoes (id, "fluxoId", "noOrigemId", "noDestinoId", "pontoOrigem", "criadoEm") FROM stdin;
\.


--
-- Data for Name: conversas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversas (id, "clienteId", "leadId", "botId", canal, identificador, "ultimaMsgEm", "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: execucoes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.execucoes (id, "fluxoId", status, modo, "iniciadaEm", "finalizadaEm", "duracaoMs", "dadosGatilho", erro, "iniciadaPorId", "noTriggerId") FROM stdin;
\.


--
-- Data for Name: execucoes_nos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.execucoes_nos (id, "execucaoId", "noId", tipo, status, "iniciadoEm", "finalizadoEm", "duracaoMs", entrada, saida, erro) FROM stdin;
\.


--
-- Data for Name: fluxos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fluxos (id, "botId", nome, ativo, "tipoGatilho", "palavraChaveGatilho", "criadoEm", "atualizadoEm", "nivelLog", "diasRetencaoSucesso", "diasRetencaoErro") FROM stdin;
c6c7f0f5-a260-46cd-aee0-4e9f89ec6149	18822a0f-035f-41c5-ab29-281620f27f74	Webhook + Eco	f	DEFAULT	\N	2026-05-01 18:18:01.117	2026-05-01 18:18:01.117	METADATA	30	90
9aace835-c0fa-4026-8d92-222f9a7fa452	18822a0f-035f-41c5-ab29-281620f27f74	Lembrete diario via HTTP	f	DEFAULT	\N	2026-05-01 18:19:05.127	2026-05-01 18:19:05.127	METADATA	30	90
e3b05054-415c-465c-bf54-44af50232416	18822a0f-035f-41c5-ab29-281620f27f74	Lembrete diario via HTTP	f	KEYWORD	\N	2026-05-01 18:19:08.159	2026-05-01 18:19:08.159	METADATA	30	90
\.


--
-- Data for Name: lancamentos_financeiros; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lancamentos_financeiros (id, "leadId", "vendaId", "categoriaId", descricao, valor, tipo, status, "dataVencimento", "dataPagamento", "dataCancelamento", "motivoCancelamento", "idAgrupamento", "atualizadoEm", "clienteId", "criadoEm", produto, "metodoPagamento") FROM stdin;
\.


--
-- Data for Name: lead_etapas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_etapas (id, "clienteId", nome, ordem, cor, "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: lead_historico; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_historico (id, "leadId", acao, "deEtapa", "paraEtapa", observacoes, "criadoEm") FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (id, email, tags, "atualizadoEm", "clienteId", "criadoEm", "etapaId", nome, observacoes, origem, prioridade, telefone, "ultimoContato", valor) FROM stdin;
\.


--
-- Data for Name: mensagens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mensagens (id, "leadId", conteudo, "doBot", "criadoEm") FROM stdin;
\.


--
-- Data for Name: mensagens_conversa; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mensagens_conversa (id, "conversaId", "clienteId", sentido, autor, "autorUsuarioId", tipo, "statusEntrega", "conteudoCifrado", iv, tag, "versaoChave", "midiaUrl", "midiaTipoMime", metadata, "criadoEm") FROM stdin;
\.


--
-- Data for Name: movimentacoes_estoque; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.movimentacoes_estoque (id, "variacaoId", tipo, quantidade, motivo, "vendaId", data) FROM stdin;
\.


--
-- Data for Name: nos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nos (id, "fluxoId", tipo, "posicaoX", "posicaoY", dados, "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Data for Name: produtos; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.produtos (id, nome, descricao, tipo, visibilidade, "atualizadoEm", "clienteId", "criadoEm", "imagemUrl") FROM stdin;
\.


--
-- Data for Name: saldo_historico; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.saldo_historico (id, valor, motivo, data, "clienteId") FROM stdin;
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.usuarios (id, nome, email, senha, perfil, "criadoEm", "atualizadoEm", "clienteId", permissoes, "deveTrocarSenha", foto) FROM stdin;
3416181f-6b6c-4eb6-b7fd-5969336897f9	Administrador	admin@sellergy.cloud	$2b$10$EB07EoF7tHimipces4bPpuW1LpgZ65cBNj2LLIcUYOcxh9ibSj4Ky	ADMIN	2026-05-01 03:23:46.682	2026-05-01 03:23:46.682	\N	{}	f	\N
3a9a5a4b-f7f8-4117-9576-b3a80fa08c7c	João	joaovictor@gmail.com	$2b$12$.pubRdEh8pbVo2Qx4tQDJuQFB886BMWVCxqYfgn1d50fQUECtXPla	CLIENT	2026-05-01 04:05:04.084	2026-05-01 04:10:14.266	d0e0f77b-a497-43ec-bb24-93f06140c1ce	{}	f	\N
\.


--
-- Data for Name: variacoes_produto; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.variacoes_produto (id, "produtoId", nome, sku, preco, "estoqueAtual", "estoqueIdeal", "estoqueMinimo", localizacao, "precoCusto", "atualizadoEm", "criadoEm", "precoCatalogo", "usarPrecoCatalogo", "imagemUrl") FROM stdin;
\.


--
-- Data for Name: vendas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendas (id, "clienteId", "leadId", valor, "metodoPagamento", status, descricao, data, "criadoEm", "atualizadoEm", "dataCancelamento", "motivoCancelamento", "canceladaPorId") FROM stdin;
\.


--
-- Data for Name: webhooks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhooks (id, "fluxoId", "noId", segredo, ativo, "exigirHmac", descricao, "ultimaChamadaEm", "totalChamadas", "criadoEm", "atualizadoEm") FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: agendamentos_fluxo agendamentos_fluxo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos_fluxo
    ADD CONSTRAINT agendamentos_fluxo_pkey PRIMARY KEY (id);


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- Name: auditoria_mensagens auditoria_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria_mensagens
    ADD CONSTRAINT auditoria_mensagens_pkey PRIMARY KEY (id);


--
-- Name: bot_variaveis bot_variaveis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_variaveis
    ADD CONSTRAINT bot_variaveis_pkey PRIMARY KEY (id);


--
-- Name: bots bots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bots
    ADD CONSTRAINT bots_pkey PRIMARY KEY (id);


--
-- Name: categorias_financeiras categorias_financeiras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_financeiras
    ADD CONSTRAINT categorias_financeiras_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: conexoes conexoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conexoes
    ADD CONSTRAINT conexoes_pkey PRIMARY KEY (id);


--
-- Name: conversas conversas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversas
    ADD CONSTRAINT conversas_pkey PRIMARY KEY (id);


--
-- Name: execucoes_nos execucoes_nos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execucoes_nos
    ADD CONSTRAINT execucoes_nos_pkey PRIMARY KEY (id);


--
-- Name: execucoes execucoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execucoes
    ADD CONSTRAINT execucoes_pkey PRIMARY KEY (id);


--
-- Name: fluxos fluxos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fluxos
    ADD CONSTRAINT fluxos_pkey PRIMARY KEY (id);


--
-- Name: lancamentos_financeiros lancamentos_financeiros_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT lancamentos_financeiros_pkey PRIMARY KEY (id);


--
-- Name: lead_etapas lead_etapas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_etapas
    ADD CONSTRAINT lead_etapas_pkey PRIMARY KEY (id);


--
-- Name: lead_historico lead_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_historico
    ADD CONSTRAINT lead_historico_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: mensagens_conversa mensagens_conversa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensagens_conversa
    ADD CONSTRAINT mensagens_conversa_pkey PRIMARY KEY (id);


--
-- Name: mensagens mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_pkey PRIMARY KEY (id);


--
-- Name: movimentacoes_estoque movimentacoes_estoque_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimentacoes_estoque
    ADD CONSTRAINT movimentacoes_estoque_pkey PRIMARY KEY (id);


--
-- Name: nos nos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos
    ADD CONSTRAINT nos_pkey PRIMARY KEY (id);


--
-- Name: produtos produtos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT produtos_pkey PRIMARY KEY (id);


--
-- Name: saldo_historico saldo_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saldo_historico
    ADD CONSTRAINT saldo_historico_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: variacoes_produto variacoes_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variacoes_produto
    ADD CONSTRAINT variacoes_produto_pkey PRIMARY KEY (id);


--
-- Name: vendas vendas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT vendas_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: agendamentos_fluxo_fluxoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "agendamentos_fluxo_fluxoId_idx" ON public.agendamentos_fluxo USING btree ("fluxoId");


--
-- Name: agendamentos_fluxo_noId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "agendamentos_fluxo_noId_key" ON public.agendamentos_fluxo USING btree ("noId");


--
-- Name: auditoria_mensagens_mensagemId_criadoEm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auditoria_mensagens_mensagemId_criadoEm_idx" ON public.auditoria_mensagens USING btree ("mensagemId", "criadoEm" DESC);


--
-- Name: auditoria_mensagens_usuarioId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auditoria_mensagens_usuarioId_idx" ON public.auditoria_mensagens USING btree ("usuarioId");


--
-- Name: bot_variaveis_botId_chave_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "bot_variaveis_botId_chave_key" ON public.bot_variaveis USING btree ("botId", chave);


--
-- Name: clientes_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clientes_email_key ON public.clientes USING btree (email);


--
-- Name: conexoes_fluxoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "conexoes_fluxoId_idx" ON public.conexoes USING btree ("fluxoId");


--
-- Name: conversas_clienteId_ultimaMsgEm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "conversas_clienteId_ultimaMsgEm_idx" ON public.conversas USING btree ("clienteId", "ultimaMsgEm" DESC);


--
-- Name: conversas_leadId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "conversas_leadId_idx" ON public.conversas USING btree ("leadId");


--
-- Name: execucoes_fluxoId_iniciadaEm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "execucoes_fluxoId_iniciadaEm_idx" ON public.execucoes USING btree ("fluxoId", "iniciadaEm" DESC);


--
-- Name: execucoes_nos_execucaoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "execucoes_nos_execucaoId_idx" ON public.execucoes_nos USING btree ("execucaoId");


--
-- Name: execucoes_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX execucoes_status_idx ON public.execucoes USING btree (status);


--
-- Name: fluxos_botId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "fluxos_botId_idx" ON public.fluxos USING btree ("botId");


--
-- Name: mensagens_conversa_clienteId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "mensagens_conversa_clienteId_idx" ON public.mensagens_conversa USING btree ("clienteId");


--
-- Name: mensagens_conversa_conversaId_criadoEm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "mensagens_conversa_conversaId_criadoEm_idx" ON public.mensagens_conversa USING btree ("conversaId", "criadoEm");


--
-- Name: nos_fluxoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "nos_fluxoId_idx" ON public.nos USING btree ("fluxoId");


--
-- Name: usuarios_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX usuarios_email_key ON public.usuarios USING btree (email);


--
-- Name: variacoes_produto_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX variacoes_produto_sku_key ON public.variacoes_produto USING btree (sku);


--
-- Name: webhooks_fluxoId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "webhooks_fluxoId_idx" ON public.webhooks USING btree ("fluxoId");


--
-- Name: webhooks_noId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "webhooks_noId_key" ON public.webhooks USING btree ("noId");


--
-- Name: agendamentos agendamentos_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT "agendamentos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agendamentos_fluxo agendamentos_fluxo_fluxoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos_fluxo
    ADD CONSTRAINT "agendamentos_fluxo_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES public.fluxos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: agendamentos agendamentos_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT "agendamentos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: alertas alertas_botId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT "alertas_botId_fkey" FOREIGN KEY ("botId") REFERENCES public.bots(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alertas alertas_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT "alertas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: alertas alertas_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT "alertas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: bot_variaveis bot_variaveis_botId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bot_variaveis
    ADD CONSTRAINT "bot_variaveis_botId_fkey" FOREIGN KEY ("botId") REFERENCES public.bots(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bots bots_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bots
    ADD CONSTRAINT "bots_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: categorias_financeiras categorias_financeiras_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categorias_financeiras
    ADD CONSTRAINT "categorias_financeiras_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conexoes conexoes_fluxoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conexoes
    ADD CONSTRAINT "conexoes_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES public.fluxos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: execucoes execucoes_fluxoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execucoes
    ADD CONSTRAINT "execucoes_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES public.fluxos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: execucoes execucoes_iniciadaPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execucoes
    ADD CONSTRAINT "execucoes_iniciadaPorId_fkey" FOREIGN KEY ("iniciadaPorId") REFERENCES public.usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: execucoes_nos execucoes_nos_execucaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execucoes_nos
    ADD CONSTRAINT "execucoes_nos_execucaoId_fkey" FOREIGN KEY ("execucaoId") REFERENCES public.execucoes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fluxos fluxos_botId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fluxos
    ADD CONSTRAINT "fluxos_botId_fkey" FOREIGN KEY ("botId") REFERENCES public.bots(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lancamentos_financeiros lancamentos_financeiros_categoriaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT "lancamentos_financeiros_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES public.categorias_financeiras(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lancamentos_financeiros lancamentos_financeiros_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT "lancamentos_financeiros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lancamentos_financeiros lancamentos_financeiros_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT "lancamentos_financeiros_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lancamentos_financeiros lancamentos_financeiros_vendaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lancamentos_financeiros
    ADD CONSTRAINT "lancamentos_financeiros_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES public.vendas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: lead_etapas lead_etapas_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_etapas
    ADD CONSTRAINT "lead_etapas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: lead_historico lead_historico_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_historico
    ADD CONSTRAINT "lead_historico_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: leads leads_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: leads leads_etapaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES public.lead_etapas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: mensagens_conversa mensagens_conversa_conversaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensagens_conversa
    ADD CONSTRAINT "mensagens_conversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES public.conversas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mensagens mensagens_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT "mensagens_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: movimentacoes_estoque movimentacoes_estoque_variacaoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimentacoes_estoque
    ADD CONSTRAINT "movimentacoes_estoque_variacaoId_fkey" FOREIGN KEY ("variacaoId") REFERENCES public.variacoes_produto(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: movimentacoes_estoque movimentacoes_estoque_vendaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimentacoes_estoque
    ADD CONSTRAINT "movimentacoes_estoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES public.vendas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: nos nos_fluxoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nos
    ADD CONSTRAINT "nos_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES public.fluxos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: produtos produtos_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produtos
    ADD CONSTRAINT "produtos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: saldo_historico saldo_historico_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.saldo_historico
    ADD CONSTRAINT "saldo_historico_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios usuarios_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "usuarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: variacoes_produto variacoes_produto_produtoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.variacoes_produto
    ADD CONSTRAINT "variacoes_produto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES public.produtos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: vendas vendas_clienteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES public.clientes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: vendas vendas_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendas
    ADD CONSTRAINT "vendas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: webhooks webhooks_fluxoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT "webhooks_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES public.fluxos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict DazzARKin7q0FKwGFkHXXe9MAh2RchhUKuyldq4gyArDC5Q3Mmy2zKkmoNJbmCB

