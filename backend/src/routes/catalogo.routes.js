const express = require('express');
const CatalogoController = require('../controllers/CatalogoController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', CatalogoController.listar);
roteador.post('/', CatalogoController.criar);
roteador.get('/:id', CatalogoController.buscarPorId);
roteador.put('/:id', CatalogoController.atualizar);
roteador.delete('/:id', CatalogoController.excluir);

// Rotas de Variações
roteador.post('/:produtoId/variacoes', (req, res) => CatalogoController.criarVariacao(req, res));
roteador.put('/variacoes/:id', (req, res) => CatalogoController.editarVariacao(req, res));
roteador.delete('/variacoes/:id', (req, res) => CatalogoController.excluirVariacao(req, res));

module.exports = roteador;
