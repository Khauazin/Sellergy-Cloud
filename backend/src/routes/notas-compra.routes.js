const express = require('express');
const NotaCompraController = require('../controllers/NotaCompraController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const { aceitarUmXml } = require('../middlewares/upload.middleware');

// Entrada de nota faz parte do dominio de Estoque/Compras — reusa o gating ESTOQUE.
const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('ESTOQUE'));

roteador.get('/', requerPermissao('ESTOQUE', 'visualizar'), (req, res) => NotaCompraController.listar(req, res));
roteador.post('/', requerPermissao('ESTOQUE', 'criar'), (req, res) => NotaCompraController.criar(req, res));
roteador.post(
  '/importar-xml',
  requerPermissao('ESTOQUE', 'criar'),
  aceitarUmXml('arquivo'),
  (req, res) => NotaCompraController.importarXml(req, res),
);
roteador.get('/:id', requerPermissao('ESTOQUE', 'visualizar'), (req, res) => NotaCompraController.buscarPorId(req, res));

module.exports = roteador;
