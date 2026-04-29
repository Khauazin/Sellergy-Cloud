const express = require('express');
const VendaController = require('../controllers/VendaController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

roteador.get('/', VendaController.listarVendas);
roteador.post('/', VendaController.registrarVenda);

module.exports = roteador;
