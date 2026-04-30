const express = require('express');
const CatalogoController = require('../controllers/CatalogoController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('CATALOGO'));

roteador.get('/', requerPermissao('CATALOGO', 'visualizar'), CatalogoController.listar);
roteador.post('/', requerPermissao('CATALOGO', 'criar'), CatalogoController.criar);
roteador.get('/:id', requerPermissao('CATALOGO', 'visualizar'), CatalogoController.buscarPorId);
roteador.put('/:id', requerPermissao('CATALOGO', 'editar'), CatalogoController.atualizar);
roteador.delete('/:id', requerPermissao('CATALOGO', 'excluir'), CatalogoController.excluir);

// Rotas de Variacoes
roteador.post('/:produtoId/variacoes', requerPermissao('CATALOGO', 'criar'), (req, res) => CatalogoController.criarVariacao(req, res));
roteador.put('/variacoes/:id', requerPermissao('CATALOGO', 'editar'), (req, res) => CatalogoController.editarVariacao(req, res));
roteador.delete('/variacoes/:id', requerPermissao('CATALOGO', 'excluir'), (req, res) => CatalogoController.excluirVariacao(req, res));

module.exports = roteador;
