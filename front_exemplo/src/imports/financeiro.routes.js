const express = require('express');
const FinanceiroController = require('../controllers/FinanceiroController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// ─── Resumo ────────────────────────────────────────────────
// DEVE vir antes de qualquer rota com /:id
// senão o Express lê "resumo" como parâmetro de ID
roteador.get('/resumo', FinanceiroController.resumo);

// ─── Lançamentos ───────────────────────────────────────────
roteador.get('/lancamentos', FinanceiroController.listarLancamentos);
roteador.post('/lancamentos', FinanceiroController.criarLancamento);
roteador.patch('/lancamentos/:id/status', FinanceiroController.atualizarStatus);
roteador.delete('/lancamentos/:id', FinanceiroController.cancelarLancamento);

// ─── Categorias ────────────────────────────────────────────
roteador.get('/categorias', FinanceiroController.listarCategorias);
roteador.post('/categorias', FinanceiroController.criarCategoria);

module.exports = roteador;