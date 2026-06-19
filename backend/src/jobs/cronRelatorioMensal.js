// =====================================================================
// CRON DIÁRIO DO RELATÓRIO MENSAL — roda às 03:00 todo dia
// =====================================================================
// Em datas específicas, dispara ações:
//   - Dia 1 (BRT): notificação "lance suas despesas — relatório fecha em
//     6 dias"
//   - Dia 5 (BRT): notificação "faltam 2 dias — verifique vendas e
//     despesas"
//   - Dia 7 (BRT): gera snapshots do mês anterior pra todos os tenants e
//     notifica que está pronto
//
// Em outros dias do mês, faz nada (mas continua reagendado).
//
// Cron implementado com setTimeout encadeado (mesma estratégia do
// cronCaixaDiario). Próxima execução = próximo dia 03:00 BRT.

const prisma = require('../prisma');
const { gerarTodosTenants, mesAnterior } = require('./gerarRelatorioMensal');
const { criarNotificacaoTenant } = require('../utils/notificacoes');

const TZ = 'America/Sao_Paulo';

// Calcula o próximo 03:00 BRT em ms.
function proximaExecucaoMs() {
  const agora = new Date();
  // Pega data atual em BRT
  const agoraBRT = agora.toLocaleDateString('en-CA', { timeZone: TZ });
  const [ano, mes, dia] = agoraBRT.split('-').map(Number);
  // 03:00 BRT = 06:00 UTC
  const hojeAs3 = new Date(Date.UTC(ano, mes - 1, dia, 6, 0, 0, 0));
  if (hojeAs3.getTime() > agora.getTime()) return hojeAs3.getTime() - agora.getTime();
  // Já passou — agenda amanhã
  const amanhaAs3 = new Date(Date.UTC(ano, mes - 1, dia + 1, 6, 0, 0, 0));
  return amanhaAs3.getTime() - agora.getTime();
}

// Retorna o dia do mês atual em BRT (1-31).
function diaAtualBRT() {
  return parseInt(new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(8, 10), 10);
}

// Nome do mês em pt-BR pra usar em títulos de notificação.
const NOMES_MES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

async function executar() {
  const dia = diaAtualBRT();
  console.log(`[cronRelatorioMensal] Tick às 03:00 BRT — dia ${dia}`);
  try {
    if (dia === 1) {
      await avisarTodosTenants({
        titulo: 'Hora de organizar o mês',
        mensagem: 'O relatório do mês anterior será fechado no dia 7. Lance suas despesas e confira as vendas com calma.',
      });
    } else if (dia === 5) {
      await avisarTodosTenants({
        titulo: 'Faltam 2 dias pro fechamento',
        mensagem: 'Verifique se todas as vendas e despesas do mês anterior já foram lançadas. Dia 7 o relatório é fechado.',
      });
    } else if (dia === 7) {
      const { ano, mes } = mesAnterior();
      console.log(`[cronRelatorioMensal] Gerando relatórios de ${NOMES_MES[mes]}/${ano}…`);
      const resultados = await gerarTodosTenants({ ano, mes, geradoPor: 'CRON' });
      const ok = resultados.filter((r) => r.ok).length;
      console.log(`[cronRelatorioMensal] OK ${ok}/${resultados.length} tenants`);
      // Notifica cada tenant que o relatório está pronto
      for (const r of resultados) {
        if (!r.ok) continue;
        try {
          await criarNotificacaoTenant(prisma, {
            clienteId: r.clienteId,
            tipo: 'RELATORIO_MENSAL_PRONTO',
            titulo: `Relatório de ${NOMES_MES[mes]} pronto`,
            mensagem: 'Veja como foi seu mês: receitas, despesas, vendas e lucro consolidados.',
            link: `/app/relatorios/mensais/${ano}-${String(mes).padStart(2, '0')}`,
            dados: { ano, mes, relatorioId: r.id },
          });
        } catch (e) {
          console.error(`[cronRelatorioMensal] notificação tenant ${r.nome}:`, e?.message);
        }
      }
    } else {
      // Dia comum — não faz nada.
      console.log('[cronRelatorioMensal] Dia comum, sem ação.');
    }
  } catch (e) {
    console.error('[cronRelatorioMensal] Falha geral:', e?.message);
  }
}

async function avisarTodosTenants({ titulo, mensagem }) {
  const tenants = await prisma.cliente.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, nome: true },
  });
  for (const t of tenants) {
    try {
      await criarNotificacaoTenant(prisma, {
        clienteId: t.id,
        tipo: 'LEMBRETE_FECHAMENTO_MES',
        titulo,
        mensagem,
        link: '/app/financeiro/lancamentos',
      });
    } catch (e) {
      console.error(`[cronRelatorioMensal] aviso tenant ${t.nome}:`, e?.message);
    }
  }
}

function agendar() {
  const ms = proximaExecucaoMs();
  const horas = (ms / 1000 / 60 / 60).toFixed(2);
  console.log(`[cronRelatorioMensal] Próxima execução em ~${horas}h`);
  setTimeout(async () => {
    await executar();
    agendar();
  }, ms);
}

function iniciar() {
  console.log('[cronRelatorioMensal] Inicializado.');
  agendar();
}

module.exports = { iniciar, executar };
