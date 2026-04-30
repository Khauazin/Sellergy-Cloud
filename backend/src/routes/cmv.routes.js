const express = require('express');
const router = express.Router();
const CmvController = require('../controllers/CmvController');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

router.use(authMiddleware);
router.use(requerModuloLiberado('FINANCEIRO'));

const podeVer = requerPermissao('FINANCEIRO', 'visualizar');

router.get('/custos', podeVer, (req, res) => CmvController.relatorioCustos(req, res));
router.get('/margens', podeVer, (req, res) => CmvController.relatorioMargens(req, res));
router.get('/lucratividade', podeVer, (req, res) => CmvController.relatorioLucratividade(req, res));

module.exports = router;
