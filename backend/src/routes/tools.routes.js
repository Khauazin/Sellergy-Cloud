// Rotas read-only do catalogo de tools. Util pra UI listar tools disponiveis
// e mostrar checkboxes de habilitacao em cada bot.
const express = require('express');
const middlewareAutenticacao = require('../middlewares/auth.middleware');
const { listarTools } = require('../agente/tools');

const roteador = express.Router();
roteador.use(middlewareAutenticacao);

// Lista todas as tools registradas (sem filtrar por modulo liberado).
// O frontend exibe e marca quais o bot pode usar.
roteador.get('/', (_req, res) => {
  res.json(listarTools());
});

module.exports = roteador;
