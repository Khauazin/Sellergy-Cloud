const express = require('express');
const router = express.Router();
const CmvController = require('../controllers/CmvController');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/custos', (req, res) => CmvController.relatorioCustos(req, res));
router.get('/margens', (req, res) => CmvController.relatorioMargens(req, res));
router.get('/lucratividade', (req, res) => CmvController.relatorioLucratividade(req, res));

module.exports = router;
