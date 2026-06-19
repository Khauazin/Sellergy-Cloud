const prisma = require('../../prisma');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

// =====================================================================
// HELPERS DE TIMEZONE — BRT (UTC-3) ASSUMIDO
// =====================================================================
// Sistema e Brasil-only. Quando o LLM passa data sem offset, interpretamos
// como BRT (em vez do TZ do processo, que pode ser UTC em prod).
//
// Aceita:
//   2026-05-16T14:30:00Z         → como UTC
//   2026-05-16T14:30:00-03:00    → como BRT explicito
//   2026-05-16T14:30:00          → assume BRT
//   2026-05-16T14:30             → assume BRT
//   2026-05-16                   → 00:00 BRT desse dia
function parseDataBRT(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Ja tem Z ou offset explicito? usa direto.
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // So data (YYYY-MM-DD) → 00:00 BRT
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00-03:00`);
  }
  // Tem hora mas sem offset → assume BRT
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
    return new Date(`${s}-03:00`);
  }
  // Fallback
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Calcula a janela [00:00, 23:59:59.999] do dia BRT correspondente a uma
// data ISO arbitraria. Retorna { inicio, fim } como Date em UTC.
function janelaDoDiaBRT(str) {
  const d = parseDataBRT(str);
  if (!d) return null;
  const dataStr = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return {
    inicio: new Date(`${dataStr}T00:00:00-03:00`),
    fim: new Date(`${dataStr}T23:59:59.999-03:00`),
  };
}

// =====================================================================
// HELPERS DE DISPONIBILIDADE (jornada x agendamentos)
// =====================================================================
// "HH:MM" -> minutos desde meia-noite (null se invalido).
function horaParaMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// Dia da semana em BRT no padrao ISO (1=segunda .. 7=domingo).
const DIAS_ISO = { Sun: 7, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function weekdayBRT(date) {
  const wd = date.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
  return DIAS_ISO[wd] || 1;
}

// Minutos desde 00:00 BRT de uma Date (UTC) qualquer.
function minutosDoDiaBRT(date) {
  const [h, m] = date
    .toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false })
    .split(':')
    .map(Number);
  return h * 60 + m;
}

// Intervalos de trabalho {ini, fim} (minutos) de um weekday (1..7).
// Prioridade: jornada do especialista > horario da loja > default 08:00-18:00 seg-sex.
// Jornada do especialista: { "1": [{inicio,fim}], ... }. Loja: { abertura, fechamento, dias }.
function intervalosDoDia(jornadaEspecialista, horarioLoja, weekday) {
  if (jornadaEspecialista && typeof jornadaEspecialista === 'object') {
    const dia = jornadaEspecialista[String(weekday)];
    if (Array.isArray(dia)) {
      return dia
        .map((it) => ({ ini: horaParaMin(it.inicio), fim: horaParaMin(it.fim) }))
        .filter((it) => it.ini != null && it.fim != null && it.fim > it.ini);
    }
    if (dia !== undefined) return []; // jornada definida e nao trabalha nesse dia
  }
  if (horarioLoja && typeof horarioLoja === 'object') {
    const dias = Array.isArray(horarioLoja.dias) ? horarioLoja.dias : [1, 2, 3, 4, 5];
    if (!dias.includes(weekday)) return [];
    const ini = horaParaMin(horarioLoja.abertura);
    const fim = horaParaMin(horarioLoja.fechamento);
    if (ini == null || fim == null || fim <= ini) return [];
    return [{ ini, fim }];
  }
  return [1, 2, 3, 4, 5].includes(weekday) ? [{ ini: 8 * 60, fim: 18 * 60 }] : [];
}

const criarAgendamento = {
  nome: 'agenda.criarAgendamento',
  modulo: 'AGENDA',
  descricao: 'Cria um agendamento (compromisso) para o cliente. Use quando o lead pedir para marcar.',
  parametros: {
    tipo: 'object',
    propriedades: {
      nomeCliente: { tipo: 'string' },
      telefoneCliente: { tipo: 'string', opcional: true },
      data: { tipo: 'string', descricao: 'ISO 8601 (ex: 2026-05-10T14:30:00-03:00)' },
      duracaoMinutos: { tipo: 'number', descricao: 'Default 30', opcional: true },
      servico: { tipo: 'string', opcional: true },
      preco: { tipo: 'number', opcional: true },
      observacoes: { tipo: 'string', opcional: true },
      leadId: { tipo: 'string', opcional: true },
      especialistaId: { tipo: 'string', descricao: 'Especialista que vai atender (use o sugerido por listarHorariosLivres).', opcional: true },
    },
    obrigatorios: ['nomeCliente', 'data'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    // parseDataBRT: aceita ISO com/sem offset. Quando o LLM esquece o offset,
    // assume BRT (em vez do TZ do processo, que costuma ser UTC).
    const data = parseDataBRT(args.data);
    if (!data || Number.isNaN(data.getTime())) throw new Error('data invalida (use ISO 8601).');

    // Valida que leadId (se fornecido) pertence ao mesmo tenant — sem isso,
    // bot comprometido poderia vincular agendamento a lead de outro cliente.
    let leadIdValidado = null;
    if (args.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: args.leadId, clienteId: contexto.clienteId },
        select: { id: true },
      });
      if (!lead) throw new Error('leadId nao pertence ao tenant ou nao existe.');
      leadIdValidado = lead.id;
    }

    // Valida especialista (se informado) — precisa ser do tenant e estar ativo.
    let especialistaIdValidado = null;
    if (args.especialistaId) {
      const esp = await prisma.especialista.findFirst({
        where: { id: String(args.especialistaId), clienteId: contexto.clienteId, ativo: true },
        select: { id: true },
      });
      if (!esp) throw new Error('especialistaId nao pertence ao tenant, nao existe ou esta inativo.');
      especialistaIdValidado = esp.id;
    }

    // Trava de duplo-agendamento: se ha especialista, garante que ele esta livre
    // nesse horario (re-checa conflito mesmo que o bot tenha "alucinado" o slot).
    if (especialistaIdValidado) {
      const duracaoNova = Number.isFinite(args.duracaoMinutos) ? Math.max(5, args.duracaoMinutos) : 30;
      const janela = janelaDoDiaBRT(data.toISOString());
      const novoIni = minutosDoDiaBRT(data);
      const novoFim = novoIni + duracaoNova;
      const doDia = await prisma.agendamento.findMany({
        where: {
          clienteId: contexto.clienteId,
          especialistaId: especialistaIdValidado,
          status: { in: ['PENDING', 'CONFIRMED'] },
          data: { gte: janela.inicio, lte: janela.fim },
        },
        select: { data: true, duracao: true },
      });
      const conflito = doDia.some((a) => {
        const ini = minutosDoDiaBRT(a.data);
        return novoIni < ini + (a.duracao || 30) && novoFim > ini;
      });
      if (conflito) {
        throw new Error('Esse especialista ja tem um compromisso que conflita com esse horario. Use agenda.listarHorariosLivres para ver os livres.');
      }
    }

    const ag = await prisma.agendamento.create({
      data: {
        clienteId: contexto.clienteId,
        leadId: leadIdValidado,
        especialistaId: especialistaIdValidado,
        nomeCliente: String(args.nomeCliente).trim(),
        telefoneCliente: args.telefoneCliente ? String(args.telefoneCliente).trim() : null,
        data,
        duracao: Number.isFinite(args.duracaoMinutos) ? Math.max(5, args.duracaoMinutos) : 30,
        servico: args.servico ? String(args.servico).trim() : null,
        preco: Number.isFinite(args.preco) ? args.preco : null,
        observacoes: args.observacoes ? String(args.observacoes).trim() : null,
        origem: 'AI',
        status: 'PENDING',
      },
    });
    return {
      id: ag.id,
      data: ag.data.toISOString(),
      duracao: ag.duracao,
      especialistaId: ag.especialistaId,
      status: ag.status,
    };
  },
};

const listarAgendamentosDoDia = {
  nome: 'agenda.listarAgendamentosDoDia',
  modulo: 'AGENDA',
  descricao: 'Lista os agendamentos de uma data especifica (apenas o dia, ignora hora). Util para informar disponibilidade.',
  parametros: {
    tipo: 'object',
    propriedades: {
      data: { tipo: 'string', descricao: 'ISO 8601 — apenas a parte da data e usada' },
    },
    obrigatorios: ['data'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    // janelaDoDiaBRT: calcula [00:00, 23:59:59.999] BRT em UTC. Indep do TZ
    // do processo. Sem isso, "2026-05-16" no servidor UTC era interpretado
    // como UTC midnight e o getDate() shiftava de dia.
    const janela = janelaDoDiaBRT(args.data);
    if (!janela) throw new Error('data invalida.');

    const ags = await prisma.agendamento.findMany({
      where: {
        clienteId: contexto.clienteId,
        data: { gte: janela.inicio, lte: janela.fim },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      orderBy: { data: 'asc' },
      select: { id: true, nomeCliente: true, data: true, duracao: true, servico: true, status: true },
    });
    // Devolve a parte da data formatada em BRT pra resposta ser consistente
    // com o que o usuario pediu (em vez de toISOString().slice que e UTC).
    const dataLabel = janela.inicio.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return {
      data: dataLabel,
      total: ags.length,
      itens: ags.map((a) => ({ ...a, data: a.data.toISOString() })),
    };
  },
};

const listarHorariosLivres = {
  nome: 'agenda.listarHorariosLivres',
  modulo: 'AGENDA',
  descricao:
    'Lista horarios livres REAIS para agendar um servico num dia, cruzando os ' +
    'especialistas aptos, a jornada deles e os agendamentos ja marcados. Ofereca ' +
    'ate 3 destes ao cliente. Cada horario ja vem com um especialista sugerido ' +
    '(o de menor carga no dia). Nunca invente horario — use sempre esta tool.',
  parametros: {
    tipo: 'object',
    propriedades: {
      data: { tipo: 'string', descricao: 'Dia desejado (ISO; so a data e usada).' },
      duracaoMinutos: { tipo: 'number', descricao: 'Duracao do servico em minutos (pegue do catalogo). Default 30.', opcional: true },
      produtoId: { tipo: 'string', descricao: 'ID do produto/servico — filtra so especialistas aptos. Omitir = qualquer especialista ativo.', opcional: true },
      especialistaId: { tipo: 'string', descricao: 'Forca um especialista especifico (opcional).', opcional: true },
    },
    obrigatorios: ['data'],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const janela = janelaDoDiaBRT(args.data);
    if (!janela) throw new Error('data invalida.');
    const duracao = Number.isFinite(args.duracaoMinutos) ? Math.max(5, args.duracaoMinutos) : 30;
    const GRADE_MIN = 30; // passo da grade de horarios oferecidos
    const MAX_SLOTS = 12;
    const dataStr = janela.inicio.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const weekday = weekdayBRT(janela.inicio);

    // 1) Especialistas aptos ao servico (ou todos os ativos).
    const whereEsp = { clienteId: contexto.clienteId, ativo: true };
    if (args.especialistaId) whereEsp.id = String(args.especialistaId);
    if (args.produtoId) whereEsp.servicos = { some: { produtoId: String(args.produtoId) } };
    let especialistas = await prisma.especialista.findMany({
      where: whereEsp,
      select: { id: true, nome: true, jornada: true },
    });

    // Sem nenhum especialista cadastrado (e sem filtro): modo "loja" = 1 recurso
    // usando o horario de funcionamento. Mantem a agenda usavel antes do cadastro.
    const modoLoja = especialistas.length === 0 && !args.especialistaId && !args.produtoId;
    if (modoLoja) especialistas = [{ id: null, nome: 'Loja', jornada: null }];
    if (especialistas.length === 0) {
      return { data: dataStr, duracaoMinutos: duracao, total: 0, horarios: [], aviso: 'Nenhum especialista apto a esse servico.' };
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: contexto.clienteId },
      select: { horarioFuncionamento: true },
    });
    const horarioLoja = cliente?.horarioFuncionamento || null;

    // 2) Agendamentos do dia -> ocupacao e carga por especialista.
    const ags = await prisma.agendamento.findMany({
      where: {
        clienteId: contexto.clienteId,
        data: { gte: janela.inicio, lte: janela.fim },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { especialistaId: true, data: true, duracao: true },
    });
    const ocupadosPorEsp = new Map();
    const cargaPorEsp = new Map();
    for (const a of ags) {
      const chave = a.especialistaId || '_loja';
      const ini = minutosDoDiaBRT(a.data);
      if (!ocupadosPorEsp.has(chave)) ocupadosPorEsp.set(chave, []);
      ocupadosPorEsp.get(chave).push({ ini, fim: ini + (a.duracao || 30) });
      cargaPorEsp.set(chave, (cargaPorEsp.get(chave) || 0) + 1);
    }

    // 3) Gera a grade e cruza jornada x conflito.
    const livresPorHora = new Map(); // minutoInicio -> [{id, nome, carga}]
    for (const esp of especialistas) {
      const chaveOcup = esp.id || '_loja';
      const intervalos = intervalosDoDia(modoLoja ? null : esp.jornada, horarioLoja, weekday);
      const ocupados = ocupadosPorEsp.get(chaveOcup) || [];
      for (const intv of intervalos) {
        let t = Math.ceil(intv.ini / GRADE_MIN) * GRADE_MIN;
        for (; t + duracao <= intv.fim; t += GRADE_MIN) {
          const conflito = ocupados.some((o) => t < o.fim && t + duracao > o.ini);
          if (conflito) continue;
          if (!livresPorHora.has(t)) livresPorHora.set(t, []);
          livresPorHora.get(t).push({ id: esp.id, nome: esp.nome, carga: cargaPorEsp.get(chaveOcup) || 0 });
        }
      }
    }

    // 4) Ordena por hora; sugere o especialista de menor carga em cada slot.
    const horarios = [...livresPorHora.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(0, MAX_SLOTS)
      .map(([min, esps]) => {
        const hh = String(Math.floor(min / 60)).padStart(2, '0');
        const mm = String(min % 60).padStart(2, '0');
        const sugerido = esps.slice().sort((a, b) => a.carga - b.carga)[0];
        return {
          hora: `${hh}:${mm}`,
          inicioISO: new Date(`${dataStr}T${hh}:${mm}:00-03:00`).toISOString(),
          especialistaSugerido: modoLoja ? null : { id: sugerido.id, nome: sugerido.nome },
          totalDisponiveis: esps.length,
        };
      });

    return { data: dataStr, duracaoMinutos: duracao, total: horarios.length, horarios };
  },
};

module.exports = [criarAgendamento, listarAgendamentosDoDia, listarHorariosLivres];
