// Rotas de relatorios consolidados do tenant.
// Todas exigem o modulo RELATORIOS liberado pelo cliente.
// Permissao granular: visualizar (todas as abas).

const express = require('express');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const {
  requerModuloLiberado,
  requerPermissao,
} = require('../middlewares/permissoes.middleware');
const RelatoriosController = require('../controllers/RelatoriosController');
const { cacheResposta } = require('../middlewares/cache.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);
roteador.use(requerModuloLiberado('RELATORIOS'));

const podeVer = requerPermissao('RELATORIOS', 'visualizar');

// Relatorios sao agregacoes caras e mudam devagar -> cache curto (60s) por
// tenant+usuario+filtros. Reduz o banco e corta flood no endpoint.
const TTL = 60;
roteador.get('/visao-executiva', podeVer, cacheResposta('relatorios:visao-executiva', TTL), RelatoriosController.visaoExecutiva);
roteador.get('/crm', podeVer, cacheResposta('relatorios:crm', TTL), RelatoriosController.relatorioCRM);
roteador.get('/financeiro', podeVer, cacheResposta('relatorios:financeiro', TTL), RelatoriosController.relatorioFinanceiro);
roteador.get('/vendas', podeVer, cacheResposta('relatorios:vendas', TTL), RelatoriosController.relatorioVendas);
roteador.get('/estoque', podeVer, cacheResposta('relatorios:estoque', TTL), RelatoriosController.relatorioEstoque);
roteador.get('/caixa', podeVer, cacheResposta('relatorios:caixa', TTL), RelatoriosController.relatorioCaixa);

module.exports = roteador;
