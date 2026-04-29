const express = require('express');
const EstoqueController = require('../controllers/EstoqueController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/dashboard', EstoqueController.dashboard);
roteador.get('/reposicao', EstoqueController.listaReposicao);
roteador.get('/movimentacoes', EstoqueController.listarMovimentacoes);
roteador.get('/saldo/:variacaoId', EstoqueController.buscarSaldoPorVariacao);
roteador.post('/movimentar', (req, res) => EstoqueController.registrarMovimentacao(req, res));
roteador.post('/ajuste-lote', (req, res) => EstoqueController.ajusteLote(req, res));
roteador.post('/ajuste-balanco', (req, res) => EstoqueController.ajusteBalanco(req, res));
roteador.post('/reservar', (req, res) => EstoqueController.reservarEstoque(req, res));

module.exports = roteador;
