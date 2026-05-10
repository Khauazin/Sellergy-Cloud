// Rotas de relatorios consolidados do tenant.
// Todas exigem o modulo RELATORIOS liberado pelo cliente.
// Permissao granular: visualizar (todas as abas).

const express = require('express');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const RelatoriosController = require('../controllers/RelatoriosController');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('RELATORIOS'));

const podeVer = requerPermissao('RELATORIOS', 'visualizar');

roteador.get('/visao-executiva', podeVer, RelatoriosController.visaoExecutiva);
roteador.get('/crm', podeVer, RelatoriosController.relatorioCRM);

module.exports = roteador;
