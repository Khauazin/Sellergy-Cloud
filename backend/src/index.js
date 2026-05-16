// Carrega .env de duas localizacoes (sem sobrescrever):
//   1) CWD — caminho que cobre `cd backend; npm run dev` se houver um .env aqui
//   2) raiz do projeto — onde o .env real vive em dev local
// Em producao (Docker) as vars ja vem do `env_file` do compose; ambas sao no-op.
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { QueueEvents } = require('bullmq');
const { criarConexaoRedis, NOME_QUEUE_EXECUCAO } = require('./filas');

const rotasAutenticacao = require('./routes/auth.routes');
const rotasClientes = require('./routes/clientes.routes');
const rotasBots = require('./routes/bots.routes');
const rotasAlertas = require('./routes/alertas.routes');
const rotasCRM = require('./routes/crm.routes');
const rotasBuilder = require('./routes/builder.routes');
const rotasExecucoes = require('./routes/execucoes.routes');
const rotasWebhooksAdmin = require('./routes/webhooks-admin.routes');
const rotasWebhooksPublico = require('./routes/webhooks-publico.routes');
const rotasCanaisPublico = require('./routes/canais-publico.routes');
const rotasAgendamentosAdmin = require('./routes/agendamentos-admin.routes');
const rotasConversas = require('./routes/conversas.routes');
const rotasCredenciais = require('./routes/credenciais.routes');
const rotasTools = require('./routes/tools.routes');
const rotasBotVariables = require('./routes/bot-variables.routes');
const rotasUsuarios = require('./routes/usuarios.routes');
const rotasAgenda = require('./routes/agenda.routes');
const rotasCatalogo = require('./routes/catalogo.routes');
const rotasEstoque = require('./routes/estoque.routes');
const rotasFinanceiro = require('./routes/financeiro.routes');
const rotasVendas = require('./routes/vendas.routes');
const rotasCmv = require('./routes/cmv.routes');
const rotasRelatorios = require('./routes/relatorios.routes');
const CrmUsuariosController = require('./controllers/CrmUsuariosController');
const middlewareAutenticacao = require('./middlewares/auth.middleware');
const { SEGREDO_JWT } = require('./middlewares/auth.middleware');

// Origens permitidas por CORS. Em desenvolvimento, libera localhost.
// Em producao, exige a variavel CORS_ORIGINS (lista separada por virgula).
const origensPermitidas = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

const opcoesCors = {
  origin: (origem, callback) => {
    // Requisicoes sem origem (ex.: curl, mobile, server-to-server) sao permitidas.
    if (!origem) return callback(null, true);
    if (origensPermitidas.includes(origem)) return callback(null, true);
    return callback(new Error(`Origem nao permitida pelo CORS: ${origem}`));
  },
  credentials: true,
};

const app = express();
// Atras de proxy/tunel (ngrok, nginx, load balancer): confia no
// primeiro hop pra que req.ip e X-Forwarded-For funcionem corretamente.
// Necessario pro express-rate-limit nao reclamar e identificar o cliente real.
app.set('trust proxy', 1);
const servidor = http.createServer(app);
const io = new Server(servidor, {
  cors: opcoesCors,
});

// Autenticacao do Socket.IO via JWT no handshake.
io.use((socket, next) => {
  const token = socket.handshake?.auth?.token
    || socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return next(new Error('Token nao fornecido'));
  }

  try {
    const dados = jwt.verify(token, SEGREDO_JWT);
    socket.usuario = dados;
    return next();
  } catch (erro) {
    return next(new Error('Token invalido ou expirado'));
  }
});

app.use(helmet());
app.use(cors(opcoesCors));

// Webhooks publicos: registrados ANTES do express.json para que possam
// validar HMAC sobre o byte-stream original.
app.use('/webhooks', rotasWebhooksPublico);
// Canais externos (WhatsApp/Telegram) — registrado ANTES do express.json
// global. Cada rota usa parser proprio quando necessario.
app.use('/canais', rotasCanaisPublico);

app.use(express.json({ limit: '1mb' }));

// Imagens — intercepta `res.json` e troca `imagemUrl` por URL assinada
// (bucket privado + pre-signed URL). Plugado APOS o parser e ANTES das
// rotas autenticadas pra cobrir todas elas.
const imagensAssinadasMiddleware = require('./middlewares/imagensAssinadas.middleware');
app.use(imagensAssinadasMiddleware);

// Injecao do Socket.io nas requisicoes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rotas Base
app.use('/autenticacao', rotasAutenticacao);
app.use('/usuarios', rotasUsuarios);

// Gerenciamento de Usuarios do Cliente (CRM)
const routerCrmUsuarios = express.Router();
routerCrmUsuarios.use(middlewareAutenticacao);
routerCrmUsuarios.get('/', (req, res) => CrmUsuariosController.listar(req, res));
routerCrmUsuarios.post('/', (req, res) => CrmUsuariosController.criar(req, res));
routerCrmUsuarios.put('/:id', (req, res) => CrmUsuariosController.atualizar(req, res));
routerCrmUsuarios.delete('/:id', (req, res) => CrmUsuariosController.excluir(req, res));
app.use('/crm/usuarios', routerCrmUsuarios);

app.use('/clientes', rotasClientes);
app.use('/bots', rotasBots);
app.use('/alertas', rotasAlertas);
app.use('/crm', rotasCRM);
app.use('/builder', rotasBuilder);
app.use('/execucoes', rotasExecucoes);
app.use('/webhooks-admin', rotasWebhooksAdmin);
app.use('/agendamentos-admin', rotasAgendamentosAdmin);
app.use('/conversas', rotasConversas);
app.use('/credenciais', rotasCredenciais);
app.use('/tools', rotasTools);
app.use('/bot-variables', rotasBotVariables);
app.use('/agenda', rotasAgenda);
app.use('/catalogo', rotasCatalogo);
app.use('/estoque', rotasEstoque);
app.use('/financeiro', rotasFinanceiro);
app.use('/vendas', rotasVendas);
app.use('/relatorios', rotasRelatorios);

// Rota de Teste de Saude (Health Check)
app.get('/saude', (req, res) => {
  res.json({ status: 'ok', data: new Date() });
});

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id, 'usuario:', socket.usuario?.id);

  // O cliente entra na room `execucao:<id>` para receber atualizacoes em tempo
  // real. Pelo socket trafegam apenas metadados (status/duracao/IDs), sem
  // payload sensivel — para detalhes o cliente refaz GET /execucoes/:id.
  socket.on('execucao:subscribe', ({ execucaoId } = {}) => {
    if (typeof execucaoId === 'string' && execucaoId) {
      socket.join(`execucao:${execucaoId}`);
    }
  });
  socket.on('execucao:unsubscribe', ({ execucaoId } = {}) => {
    if (typeof execucaoId === 'string' && execucaoId) {
      socket.leave(`execucao:${execucaoId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// QueueEvents: escuta o progresso emitido pelo worker via job.updateProgress
// e re-emite via socket.io para os subscribers da room `execucao:<id>`.
const conexaoEventos = criarConexaoRedis({ paraWorker: true });
const eventosExecucao = new QueueEvents(NOME_QUEUE_EXECUCAO, { connection: conexaoEventos });

eventosExecucao.on('progress', ({ jobId, data }) => {
  if (!jobId || !data) return;
  io.to(`execucao:${jobId}`).emit('execucao:evento', data);
});

eventosExecucao.on('completed', ({ jobId }) => {
  if (!jobId) return;
  io.to(`execucao:${jobId}`).emit('execucao:fim', { execucaoId: jobId });
});

eventosExecucao.on('failed', ({ jobId, failedReason }) => {
  if (!jobId) return;
  io.to(`execucao:${jobId}`).emit('execucao:fim', { execucaoId: jobId, erro: failedReason });
});

const PORTA = process.env.BACKEND_PORT || 3333;

servidor.listen(PORTA, async () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
  // Garante que o bucket de midias existe (privado — acesso via URL assinada).
  try {
    const { garantirBucket } = require('./storage/minio');
    const r = await garantirBucket();
    if (r.criado) console.log('[boot] Bucket de midias criado.');
  } catch (e) {
    console.error('[boot] Falha ao garantir bucket:', e?.message);
  }
});

const { fecharFilas } = require('./filas');

async function encerrar(sinal) {
  console.log(`Sinal ${sinal} recebido, encerrando servidor...`);
  servidor.close(() => console.log('HTTP fechado.'));
  try {
    await eventosExecucao.close();
    await conexaoEventos.quit();
    await fecharFilas();
  } catch (erro) {
    console.error('Erro ao fechar filas:', erro);
  }
  process.exit(0);
}

process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
