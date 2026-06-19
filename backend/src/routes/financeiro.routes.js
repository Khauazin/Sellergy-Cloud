const express = require('express');
const FinanceiroController = require('../controllers/FinanceiroController');
const CaixaController = require('../controllers/CaixaController');
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
roteador.get('/saldo-historico', podeVer, FinanceiroController.saldoHistorico);
roteador.post('/saldo-atual/ajuste', podeEditar, FinanceiroController.ajustarSaldo);

// ─── Caixa (sessoes) ───────────────────────────────────────
roteador.get('/caixa/atual', podeVer, (req, res) => CaixaController.atual(req, res));
roteador.get('/caixa/sessoes', podeVer, (req, res) => CaixaController.listarSessoes(req, res));
roteador.get('/caixa/sessoes/:id', podeVer, (req, res) => CaixaController.detalheSessao(req, res));
roteador.post('/caixa/abrir', podeCriar, (req, res) => CaixaController.abrir(req, res));
roteador.post('/caixa/fechar', podeEditar, (req, res) => CaixaController.fechar(req, res));
roteador.post('/caixa/sangria', podeCriar, (req, res) => CaixaController.sangria(req, res));
roteador.post('/caixa/suprimento', podeCriar, (req, res) => CaixaController.suprimento(req, res));

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
roteador.get('/lancamentos/:id/historico', podeVer, FinanceiroController.historicoLancamento);

// ─── Categorias ────────────────────────────────────────────
roteador.get('/categorias', podeVer, FinanceiroController.listarCategorias);
roteador.post('/categorias', podeCriar, FinanceiroController.criarCategoria);
roteador.patch('/categorias/:id', podeEditar, FinanceiroController.editarCategoria);
roteador.delete('/categorias/:id', podeExcluir, FinanceiroController.excluirCategoria);

module.exports = roteador;