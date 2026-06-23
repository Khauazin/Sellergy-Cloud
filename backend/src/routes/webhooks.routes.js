// Webhooks externos — CASCA pre-semeada pela Frente 1 (Fundacao).
//
// Recebe callbacks de provedores externos (confirmacao de pagamento dos PSPs).
// NAO usa middlewareAutenticacao: quem chama e o provedor, nao um usuario
// logado. A autenticidade e validada por assinatura/segredo DENTRO do handler
// (Frente 2), e o processamento deve ser IDEMPOTENTE por provedorCobrancaId.
//
// Atencao Frente 2: verificacao de assinatura costuma exigir o corpo CRU
// (raw body). O index.js aplica express.json() global — se o PSP exigir HMAC
// sobre o raw, montar um parser raw especifico para esta rota.
//
// Frente 2 implementa o handler real:
//   POST /webhooks/pagamento/:provedor  -> baixa Cobranca + efeito (venda/agendamento PAGO).
// Ref: docs/erp-arquitetura-e-operacao.md §4.

const express = require('express');

const roteador = express.Router();

// Placeholder ate a Frente 2 implementar. Mantem o ponto de entrada vivo.
roteador.post('/pagamento/:provedor', (req, res) => {
  res.status(501).json({ erro: 'Webhook de pagamento ainda nao implementado (Frente 2).' });
});

module.exports = roteador;
