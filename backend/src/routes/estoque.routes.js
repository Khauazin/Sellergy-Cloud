const express = require('express');
const EstoqueController = require('../controllers/EstoqueController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { cacheResposta } = require('../middlewares/cache.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('ESTOQUE'));

// Agregacoes (percorrem todas as variacoes) -> cache curto por tenant+usuario.
roteador.get('/dashboard', requerPermissao('ESTOQUE', 'visualizar'), cacheResposta('estoque:dashboard', 60), EstoqueController.dashboard);
roteador.get('/reposicao', requerPermissao('ESTOQUE', 'visualizar'), cacheResposta('estoque:reposicao', 60), EstoqueController.listaReposicao);
roteador.get('/movimentacoes', requerPermissao('ESTOQUE', 'visualizar'), EstoqueController.listarMovimentacoes);
roteador.get('/saldo/:variacaoId', requerPermissao('ESTOQUE', 'visualizar'), EstoqueController.buscarSaldoPorVariacao);
roteador.post('/movimentar', requerPermissao('ESTOQUE', 'criar'), (req, res) => EstoqueController.registrarMovimentacao(req, res));
roteador.post('/ajuste-lote', requerPermissao('ESTOQUE', 'editar'), (req, res) => EstoqueController.ajusteLote(req, res));
roteador.post('/ajuste-balanco', requerPermissao('ESTOQUE', 'editar'), (req, res) => EstoqueController.ajusteBalanco(req, res));
roteador.post('/reservar', requerPermissao('ESTOQUE', 'editar'), (req, res) => EstoqueController.reservarEstoque(req, res));

module.exports = roteador;
