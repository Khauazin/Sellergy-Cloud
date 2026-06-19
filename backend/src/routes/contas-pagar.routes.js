const express = require('express');
const ContaPagarController = require('../controllers/ContaPagarController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('FINANCEIRO'));

roteador.get('/', requerPermissao('FINANCEIRO', 'visualizar'), (req, res) =>
  ContaPagarController.listar(req, res)
);
roteador.post('/', requerPermissao('FINANCEIRO', 'criar'), (req, res) =>
  ContaPagarController.criar(req, res)
);
roteador.put('/:id', requerPermissao('FINANCEIRO', 'editar'), (req, res) =>
  ContaPagarController.editar(req, res)
);
roteador.delete('/:id', requerPermissao('FINANCEIRO', 'excluir'), (req, res) =>
  ContaPagarController.excluir(req, res)
);
// Pagar uma conta — cria LancamentoFinanceiro DESPESA PAGO + opcionalmente
// SaldoHistorico SANGRIA (se tirar do caixa). Numa transacao com lock.
roteador.post('/:id/pagar', requerPermissao('FINANCEIRO', 'editar'), (req, res) =>
  ContaPagarController.pagar(req, res)
);

module.exports = roteador;
