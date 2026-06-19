const express = require('express');
const RelatorioMensalController = require('../controllers/RelatorioMensalController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
  requerPapelPrivilegiado,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('RELATORIOS'));

roteador.get('/', requerPermissao('RELATORIOS', 'visualizar'), (req, res) =>
  RelatorioMensalController.listar(req, res)
);
roteador.get('/:ano/:mes', requerPermissao('RELATORIOS', 'visualizar'), (req, res) =>
  RelatorioMensalController.detalhe(req, res)
);
// Disparo manual — ação estrutural (gera snapshot imutável que entra na
// auditoria do tenant). Defesa em duas camadas: middleware bloqueia
// VENDEDOR aqui, e o controller revalida (defense in depth).
roteador.post('/gerar', requerPapelPrivilegiado, (req, res) =>
  RelatorioMensalController.gerarManual(req, res)
);

module.exports = roteador;
