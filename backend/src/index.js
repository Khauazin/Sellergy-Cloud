require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const rotasAutenticacao = require('./routes/auth.routes');
const rotasClientes = require('./routes/clientes.routes');
const rotasBots = require('./routes/bots.routes');
const rotasAlertas = require('./routes/alertas.routes');
const rotasCRM = require('./routes/crm.routes');
const rotasBuilder = require('./routes/builder.routes');
const rotasBotVariables = require('./routes/bot-variables.routes');
const rotasUsuarios = require('./routes/usuarios.routes');
const rotasAgenda = require('./routes/agenda.routes');
const rotasCatalogo = require('./routes/catalogo.routes');
const rotasEstoque = require('./routes/estoque.routes');
const rotasFinanceiro = require('./routes/financeiro.routes');
const rotasVendas = require('./routes/vendas.routes');
const rotasCmv = require('./routes/cmv.routes');
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
app.use(express.json({ limit: '1mb' }));

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
app.use('/bot-variables', rotasBotVariables);
app.use('/agenda', rotasAgenda);
app.use('/catalogo', rotasCatalogo);
app.use('/estoque', rotasEstoque);
app.use('/financeiro', rotasFinanceiro);
app.use('/vendas', rotasVendas);

// Rota de Teste de Saude (Health Check)
app.get('/saude', (req, res) => {
  res.json({ status: 'ok', data: new Date() });
});

io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id, 'usuario:', socket.usuario?.id);
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORTA = process.env.BACKEND_PORT || 3333;

servidor.listen(PORTA, () => {
  console.log(`Servidor rodando na porta ${PORTA}`);
});
