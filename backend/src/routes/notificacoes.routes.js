const express = require('express');
const NotificacaoController = require('../controllers/NotificacaoController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Não usa requerModuloLiberado nem requerPermissao: notificação é
// transversal ao app. Todo usuário autenticado vê as próprias.

roteador.get('/', (req, res) => NotificacaoController.listar(req, res));
roteador.patch('/todas-lidas', (req, res) => NotificacaoController.marcarTodasLidas(req, res));
roteador.patch('/:id/lida', (req, res) => NotificacaoController.marcarLida(req, res));

roteador.get('/preferencias', (req, res) => NotificacaoController.listarPreferencias(req, res));
roteador.put('/preferencias/:tipo', (req, res) => NotificacaoController.atualizarPreferencia(req, res));

module.exports = roteador;
