const { PrismaClient } = require('@prisma/client');

// Carrega variáveis de ambiente se ainda não foram carregadas
require('dotenv').config();

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

module.exports = prisma;
