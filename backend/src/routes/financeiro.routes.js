const express = require('express');
const FinanceiroController = require('../controllers/FinanceiroController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// ─── Dashboards e Resumos ──────────────────────────────────
roteador.get('/dashboard', FinanceiroController.dashboard);
roteador.get('/resumo', FinanceiroController.resumo);
roteador.get('/fluxo-caixa', FinanceiroController.fluxoCaixa);
roteador.get('/inadimplencia', FinanceiroController.inadimplencia);
roteador.get('/relatorio/dre', FinanceiroController.relatorioDRE);

// ─── Saldo ────────────────────────────────────────────────
roteador.get('/saldo-atual', FinanceiroController.saldoAtual);
roteador.post('/saldo-atual/ajuste', FinanceiroController.ajustarSaldo);

// ─── Lançamentos ───────────────────────────────────────────
roteador.get('/lancamentos', FinanceiroController.listarLancamentos);
roteador.post('/lancamentos', FinanceiroController.criarLancamento);
roteador.put('/lancamentos/:id', FinanceiroController.editarLancamento);
roteador.post('/lancamentos/:id/cobrar', FinanceiroController.cobrarLancamento);
roteador.post('/lancamentos/:id/pausa', FinanceiroController.pausaAmigavel);
roteador.patch('/lancamentos/lote/status', FinanceiroController.atualizarStatusEmLote);
roteador.patch('/lancamentos/:id/status', FinanceiroController.atualizarStatus);
roteador.delete('/lancamentos/grupo/:idAgrupamento', FinanceiroController.excluirGrupo);
roteador.delete('/lancamentos/:id/cancelar', FinanceiroController.cancelarLancamento);
roteador.delete('/lancamentos/:id', FinanceiroController.excluirLancamento);

// ─── Categorias ────────────────────────────────────────────
roteador.get('/categorias', FinanceiroController.listarCategorias);
roteador.post('/categorias', FinanceiroController.criarCategoria);
roteador.patch('/categorias/:id', FinanceiroController.editarCategoria);
roteador.delete('/categorias/:id', FinanceiroController.excluirCategoria);

module.exports = roteador;