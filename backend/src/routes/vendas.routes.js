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

// Handlers sempre invocados via arrow (consistente e à prova de perda de `this`).
roteador.get('/', requerPermissao('VENDAS', 'visualizar'), (req, res) => VendaController.listarVendas(req, res));
roteador.post('/', requerPermissao('VENDAS', 'criar'), (req, res) => VendaController.registrarVenda(req, res));
roteador.post('/:id/cancelar', requerPermissao('VENDAS', 'editar'), (req, res) => VendaController.cancelarVenda(req, res));
// Vinculo retroativo de lead (cliente). Util quando a venda foi feita sem
// identificar o cliente e dps a equipe descobre quem era. Mantem auditoria.
roteador.put('/:id/lead', requerPermissao('VENDAS', 'editar'), (req, res) => VendaController.vincularLead(req, res));

module.exports = roteador;
