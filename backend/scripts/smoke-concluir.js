// Smoke test do "Concluir atendimento" (Task #1) — exercita o caminho do
// dinheiro CONTRA O BANCO. Pre-requisitos: banco no ar + migracao
// `venda_agendamento` aplicada (cd backend; npx prisma migrate dev).
//
// Prova, em runtime:
//   1. concluir cria venda (vinculada ao agendamento) + lancamento + marca
//      o agendamento como COMPLETED;
//   2. o `@unique` em Venda.agendamentoId BLOQUEIA uma 2a venda no mesmo
//      agendamento (a trava de dupla-conclusao funciona no nivel do banco).
//
// Usa um cliente DESCARTAVEL e apaga tudo no fim (cascade pelo cliente) —
// nao deixa lixo no banco.
//
// Uso:  cd backend; node scripts/smoke-concluir.js

const prisma = require('../src/prisma');

async function main() {
  const marca = `__SMOKE_CONCLUIR__ ${new Date().toISOString()}`;
  let clienteId = null;
  const falhas = [];
  const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS ' : 'FALHA'} — ${msg}`);
    if (!cond) falhas.push(msg);
  };

  try {
    // --- monta cenario: cliente + lead + agendamento PENDING (preco 75.5) ---
    const cliente = await prisma.cliente.create({ data: { nome: marca, segmento: 'SERVICO' } });
    clienteId = cliente.id;
    const lead = await prisma.lead.create({ data: { clienteId, nome: 'Lead Smoke' } });
    const ag = await prisma.agendamento.create({
      data: {
        clienteId, leadId: lead.id, nomeCliente: 'Lead Smoke',
        servico: 'Corte', preco: 75.5, data: new Date(), duracao: 30, status: 'PENDING',
      },
    });

    // --- replica a transacao do endpoint /agenda/:id/concluir ---
    const venda = await prisma.$transaction(async (tx) => {
      const sessao = await tx.sessaoCaixa.create({
        data: { clienteId, fundoCaixa: 0, status: 'ABERTA', origem: 'AUTO_BOT' },
      });
      const v = await tx.venda.create({
        data: {
          clienteId, numero: 1, leadId: lead.id, sessaoCaixaId: sessao.id,
          valor: 75.5, descricao: 'Atendimento: Corte', status: 'COMPLETED', agendamentoId: ag.id,
        },
      });
      await tx.lancamentoFinanceiro.create({
        data: {
          clienteId, leadId: lead.id, vendaId: v.id, sessaoCaixaId: sessao.id,
          descricao: 'Receita Venda #1: Atendimento: Corte', valor: 75.5,
          tipo: 'RECEITA', status: 'PAGO', dataVencimento: new Date(), dataPagamento: new Date(),
        },
      });
      await tx.agendamento.update({ where: { id: ag.id }, data: { status: 'COMPLETED' } });
      return v;
    });

    // --- asserts de integridade ---
    const vendaCheck = await prisma.venda.findUnique({
      where: { id: venda.id },
      include: { lancamentosFinanceiros: true },
    });
    ok(vendaCheck?.agendamentoId === ag.id, 'venda vinculada ao agendamento (agendamentoId)');
    ok(vendaCheck?.valor === 75.5, 'venda com valor correto (75.5)');
    ok(vendaCheck?.lancamentosFinanceiros?.length === 1, 'lancamento financeiro criado (RECEITA/PAGO)');

    const agCheck = await prisma.agendamento.findUnique({ where: { id: ag.id } });
    ok(agCheck?.status === 'COMPLETED', 'agendamento marcado como COMPLETED');

    // --- trava de dupla-conclusao: 2a venda no MESMO agendamento deve falhar ---
    // numero=2 (nao colide com [clienteId,numero]); o P2002 so pode vir do
    // @unique de agendamentoId.
    let travouP2002 = false;
    try {
      await prisma.venda.create({
        data: { clienteId, numero: 2, valor: 75.5, status: 'COMPLETED', agendamentoId: ag.id },
      });
    } catch (e) {
      travouP2002 = e?.code === 'P2002';
      if (travouP2002) console.log('       (P2002 em:', JSON.stringify(e.meta?.target), ')');
    }
    ok(travouP2002, 'segunda venda no mesmo agendamento BLOQUEADA pelo @unique (P2002)');
  } catch (e) {
    console.error('ERRO inesperado:', e.code ? `${e.code} ${e.message}` : e.message);
    falhas.push('excecao: ' + e.message);
  } finally {
    if (clienteId) {
      await prisma.cliente
        .delete({ where: { id: clienteId } })
        .then(() => console.log('limpeza: cliente de teste removido (cascade).'))
        .catch((e) => console.error('ATENCAO: limpeza falhou, remova manualmente o cliente', clienteId, '-', e.message));
    }
    await prisma.$disconnect();
  }

  console.log(falhas.length === 0 ? '\n>>> SMOKE PASSOU ✅' : `\n>>> SMOKE FALHOU (${falhas.length}) ❌`);
  process.exitCode = falhas.length === 0 ? 0 : 1;
}

main();
