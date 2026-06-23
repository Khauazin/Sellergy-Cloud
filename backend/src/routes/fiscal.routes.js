// Fiscal (emissao terceirizada via API) — CASCA pre-semeada pela Frente 1.
//
// A logica real (adaptadores Focus NFe / Nuvem Fiscal, emissao assincrona de
// NFC-e/NFS-e por fila, estados + retry) e responsabilidade da Frente 3. Aqui
// existe so o ponto de montagem, pra ninguem colidir em index.js: a Frente 3
// PREENCHE este arquivo sem precisar tocar no index.
//
// Ao assumir, a Frente 3:
//   - aplica requerModuloLiberado('FISCAL') + requerPermissao(...) (gating);
//   - implementa config fiscal (provedor + certificado + regime) e documentos.
// Ref: docs/erp-arquitetura-e-operacao.md §5. Models: DocumentoFiscal / ConfiguracaoFiscal.

const express = require('express');
const middlewareAutenticacao = require('../middlewares/auth.middleware');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Placeholder ate a Frente 3 implementar. 501 deixa explicito que a rota
// existe (costura pronta) mas a feature ainda nao foi construida.
roteador.use((req, res) => {
  res.status(501).json({ erro: 'Modulo fiscal ainda nao implementado (Frente 3).' });
});

module.exports = roteador;
