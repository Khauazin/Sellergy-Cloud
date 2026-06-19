// =====================================================================
// JOB DIARIO DO CAIXA
// =====================================================================
// Roda todo dia as 00:01 (margem de 1min pra evitar borda do dia).
// Pra cada cliente ativo:
//   - Se tem sessao MANUAL aberta -> deixa quieta (usuario precisa fechar).
//   - Se tem sessao AUTO_BOT aberta -> fecha (saldo final = esperado) e cria
//     nova AUTO_BOT com fundo = saldo final anterior. Garante que bot tem
//     caixa 24h sem intervencao manual.
//   - Se nao tem nenhuma sessao aberta -> nao faz nada (espera 1a venda do
//     bot pra criar AUTO_BOT, ou usuario abrir manual).
//
// IMPORTANTE: usamos setTimeout encadeado em vez de node-cron porque o
// projeto ainda nao tem essa dep e e so 1 trigger diario.

const prisma = require('../prisma');
const { lockClienteAdvisory } = require('../utils/locks');

// Calcula proxima execucao (proxima 00:01 do dia seguinte) em ms.
function proximaExecucaoMs() {
  const agora = new Date();
  const proximo = new Date(agora);
  proximo.setDate(proximo.getDate() + 1);
  proximo.setHours(0, 1, 0, 0);
  return proximo.getTime() - agora.getTime();
}

// Calcula saldo esperado da sessao olhando vendas + suprimentos - sangrias.
// Espelha logica do CaixaController (pra evitar dep ciclica). Aceita client
// opcional (prisma global ou tx) — usar tx quando dentro de transacao.
async function calcularSaldoEsperado(sessaoId, client = prisma) {
  const sessao = await client.sessaoCaixa.findUnique({
    where: { id: sessaoId },
    select: { fundoCaixa: true },
  });
  if (!sessao) return 0;

  const lancAgreg = await client.lancamentoFinanceiro.aggregate({
    where: { sessaoCaixaId: sessaoId, tipo: 'RECEITA', status: 'PAGO' },
    _sum: { valor: true },
  });
  const totalVendas = lancAgreg._sum.valor || 0;

  const movs = await client.saldoHistorico.findMany({
    where: { sessaoCaixaId: sessaoId, tipo: { in: ['SUPRIMENTO', 'SANGRIA'] } },
    select: { valor: true, tipo: true },
  });
  let totalSup = 0;
  let totalSan = 0;
  for (const m of movs) {
    if (m.tipo === 'SUPRIMENTO') totalSup += m.valor;
    else if (m.tipo === 'SANGRIA') totalSan += m.valor;
  }
  return sessao.fundoCaixa + totalVendas + totalSup - totalSan;
}

async function executarRotinaDiaria() {
  console.log('[cronCaixaDiario] Iniciando rotina diaria das 00:01...');
  try {
    // So clientes ativos. Pra cada, processa sessao AUTO_BOT aberta.
    const clientes = await prisma.cliente.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, nome: true },
    });

    let fechadas = 0;
    let abertas = 0;

    for (const cliente of clientes) {
      try {
        // Tudo num bloco transacional com advisory lock pelo clienteId. Sem
        // isso, o bot pode criar AUTO_BOT em paralelo ao cron fechando, e
        // sobram 2 sessoes ABERTA no fim. O lock e liberado no commit/rollback.
        const r = await prisma.$transaction(async (tx) => {
          await lockClienteAdvisory(tx, cliente.id);

          const sessao = await tx.sessaoCaixa.findFirst({
            where: { clienteId: cliente.id, status: 'ABERTA' },
            orderBy: { abertaEm: 'desc' },
          });

          // Sessao MANUAL aberta — deixa quieta (usuario nao fechou).
          if (sessao && sessao.origem === 'MANUAL') return { acao: 'skip-manual' };

          // Sem sessao aberta — nao faz nada. Bot cria AUTO quando vier 1a venda.
          if (!sessao) return { acao: 'skip-vazio' };

          // Sessao AUTO_BOT aberta — fecha e abre nova com fundo = saldo final.
          const esperado = await calcularSaldoEsperado(sessao.id, tx);
          await tx.sessaoCaixa.update({
            where: { id: sessao.id },
            data: {
              status: 'FECHADA',
              fechadaEm: new Date(),
              saldoFinalEsperado: esperado,
              saldoFinalReal: esperado, // auto = sem contagem fisica
              diferenca: 0,
              observacaoFechamento: 'Fechada automaticamente as 00:01 pelo cron diario.',
            },
          });
          await tx.sessaoCaixa.create({
            data: {
              clienteId: cliente.id,
              fundoCaixa: esperado,
              status: 'ABERTA',
              origem: 'AUTO_BOT',
              observacaoAbertura: `Aberta automaticamente as 00:01. Fundo = saldo final da sessao anterior (${esperado.toFixed(2)}).`,
            },
          });
          return { acao: 'rotacionou' };
        });

        if (r.acao === 'rotacionou') {
          fechadas += 1;
          abertas += 1;
        }
      } catch (errCliente) {
        console.error(`[cronCaixaDiario] Erro processando cliente ${cliente.id} (${cliente.nome}):`, errCliente?.message);
      }
    }

    console.log(`[cronCaixaDiario] OK — ${fechadas} sessoes AUTO_BOT fechadas + ${abertas} novas abertas.`);
  } catch (e) {
    console.error('[cronCaixaDiario] Falha geral:', e?.message);
  }
}

// Agenda a proxima execucao e se reagenda recursivamente.
function agendar() {
  const ms = proximaExecucaoMs();
  const horas = (ms / 1000 / 60 / 60).toFixed(2);
  console.log(`[cronCaixaDiario] Proxima execucao em ~${horas}h`);
  setTimeout(async () => {
    await executarRotinaDiaria();
    agendar(); // re-agenda pra proxima 00:01
  }, ms);
}

// Inicializa: agenda a 1a execucao. Chamado pelo index.js no boot.
function iniciar() {
  console.log('[cronCaixaDiario] Inicializado.');
  agendar();
}

module.exports = {
  iniciar,
  // Exposto pra testes / chamada manual via endpoint admin se precisar.
  executarRotinaDiaria,
};
