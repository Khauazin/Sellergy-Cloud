const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log(' Iniciando limpeza e seed simplificado...');

  // ─── 1. Criar Usuário Administrador ───────────────
  const senhaHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@botmanager.com' },
    update: { senha: senhaHash },
    create: {
      nome: 'Administrador',
      email: 'admin@botmanager.com',
      senha: senhaHash,
      perfil: 'ADMIN'
    }
  });

  console.log(` Usuário administrador configurado: ${admin.email}`);
  console.log(' Banco de dados pronto!');
}

main()
  .catch((e) => {
    console.error(' Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
