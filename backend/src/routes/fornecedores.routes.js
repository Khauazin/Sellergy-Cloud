const express = require('express');
const FornecedorController = require('../controllers/FornecedorController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { aceitarUmCsv } = require('../middlewares/upload.middleware');

// Fornecedores fazem parte do dominio de Estoque/Compras — reusam o gating
// do modulo ESTOQUE (sem criar um modulo novo na matriz de permissoes).
const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('ESTOQUE'));

roteador.get('/', requerPermissao('ESTOQUE', 'visualizar'), (req, res) => FornecedorController.listar(req, res));
roteador.post('/', requerPermissao('ESTOQUE', 'criar'), (req, res) => FornecedorController.criar(req, res));
roteador.post(
  '/importar',
  requerPermissao('ESTOQUE', 'criar'),
  aceitarUmCsv('arquivo'),
  (req, res) => FornecedorController.importar(req, res),
);
roteador.get('/:id', requerPermissao('ESTOQUE', 'visualizar'), (req, res) => FornecedorController.buscarPorId(req, res));
roteador.put('/:id', requerPermissao('ESTOQUE', 'editar'), (req, res) => FornecedorController.atualizar(req, res));
roteador.delete('/:id', requerPermissao('ESTOQUE', 'excluir'), (req, res) => FornecedorController.excluir(req, res));

module.exports = roteador;
