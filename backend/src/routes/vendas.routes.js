const express = require('express');
const VendaController = require('../controllers/VendaController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('VENDAS'));

roteador.get('/', requerPermissao('VENDAS', 'visualizar'), VendaController.listarVendas);
roteador.post('/', requerPermissao('VENDAS', 'criar'), VendaController.registrarVenda);

module.exports = roteador;
