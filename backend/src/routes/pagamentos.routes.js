// Pagamentos (PSP) — CASCA pre-semeada pela Frente 1 (Fundacao).
//
// A logica real (adaptadores Mercado Pago / Asaas / Pagar.me, criacao de
// cobranca Pix/link, recorrencia, conciliacao) e responsabilidade da Frente 2.
// Aqui existe so o ponto de montagem, pra ninguem colidir em index.js: a
// Frente 2 PREENCHE este arquivo sem precisar tocar no index.
//
// Ao assumir, a Frente 2:
//   - aplica requerModuloLiberado('PAGAMENTOS') + requerPermissao(...) (gating);
//   - implementa config (escolher provedor + credencial no cofre) e cobrancas.
// Ref: docs/erp-arquitetura-e-operacao.md §4. Models: Cobranca / ConfiguracaoPagamento.

const express = require('express');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Placeholder ate a Frente 2 implementar. 501 deixa explicito que a rota
// existe (costura pronta) mas a feature ainda nao foi construida.
roteador.use((req, res) => {
  res.status(501).json({ erro: 'Modulo de pagamentos ainda nao implementado (Frente 2).' });
});

module.exports = roteador;
