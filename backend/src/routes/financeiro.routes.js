const express = require('express');
const FinanceiroController = require('../controllers/FinanceiroController');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('FINANCEIRO'));

const podeVer = requerPermissao('FINANCEIRO', 'visualizar');
const podeCriar = requerPermissao('FINANCEIRO', 'criar');
const podeEditar = requerPermissao('FINANCEIRO', 'editar');
const podeExcluir = requerPermissao('FINANCEIRO', 'excluir');

// ─── Dashboards e Resumos ──────────────────────────────────
roteador.get('/dashboard', podeVer, FinanceiroController.dashboard);
roteador.get('/resumo', podeVer, FinanceiroController.resumo);
roteador.get('/fluxo-caixa', podeVer, FinanceiroController.fluxoCaixa);
roteador.get('/inadimplencia', podeVer, FinanceiroController.inadimplencia);
roteador.get('/relatorio/dre', podeVer, FinanceiroController.relatorioDRE);

// ─── Saldo ────────────────────────────────────────────────
roteador.get('/saldo-atual', podeVer, FinanceiroController.saldoAtual);
roteador.post('/saldo-atual/ajuste', podeEditar, FinanceiroController.ajustarSaldo);

// ─── Lancamentos ───────────────────────────────────────────
roteador.get('/lancamentos', podeVer, FinanceiroController.listarLancamentos);
roteador.post('/lancamentos', podeCriar, FinanceiroController.criarLancamento);
roteador.put('/lancamentos/:id', podeEditar, FinanceiroController.editarLancamento);
roteador.post('/lancamentos/:id/cobrar', podeEditar, FinanceiroController.cobrarLancamento);
roteador.post('/lancamentos/:id/pausa', podeEditar, FinanceiroController.pausaAmigavel);
roteador.patch('/lancamentos/lote/status', podeEditar, FinanceiroController.atualizarStatusEmLote);
roteador.patch('/lancamentos/:id/status', podeEditar, FinanceiroController.atualizarStatus);
roteador.delete('/lancamentos/grupo/:idAgrupamento', podeExcluir, FinanceiroController.excluirGrupo);
roteador.delete('/lancamentos/:id/cancelar', podeExcluir, FinanceiroController.cancelarLancamento);
roteador.delete('/lancamentos/:id', podeExcluir, FinanceiroController.excluirLancamento);

// ─── Categorias ────────────────────────────────────────────
roteador.get('/categorias', podeVer, FinanceiroController.listarCategorias);
roteador.post('/categorias', podeCriar, FinanceiroController.criarCategoria);
roteador.patch('/categorias/:id', podeEditar, FinanceiroController.editarCategoria);
roteador.delete('/categorias/:id', podeExcluir, FinanceiroController.excluirCategoria);

module.exports = roteador;