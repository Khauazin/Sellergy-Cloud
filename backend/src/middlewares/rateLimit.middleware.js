// Rate limiting GERAL da API — defesa direta contra flood/DoS.
//
// Antes disto, so o login/registro tinham limite; os endpoints de agregacao
// (dashboard, relatorios) rodavam sem teto — um atacante podia floodar consulta
// cara e derrubar o banco. Aqui poe um teto por IP na API inteira.
//
// Fora do limite geral (skip):
//  - /webhooks (o chamador e o provedor externo — Mercado Pago, Meta, fiscal);
//  - /saude (health-check de uptime).
// O login ja tem limitadores proprios, mais estritos, em auth.routes.

const rateLimit = require('express-rate-limit');

const limitadorApi = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: Number(process.env.RATE_LIMIT_MAX || 300), // req/min por IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/webhooks') || req.path === '/saude',
  message: { erro: 'Muitas requisicoes em pouco tempo. Tente de novo em instantes.' },
});

module.exports = { limitadorApi };
