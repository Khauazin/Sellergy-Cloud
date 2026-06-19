// Tools de conversa — controle do fluxo de atendimento (handoff).
// A perna "escalar" do orquestrador: o agente passa a conversa pra um humano.

const prisma = require('../../prisma');

function exigirCliente(contexto) {
  if (!contexto?.clienteId) throw new Error('Contexto sem clienteId.');
}

const escalarHumano = {
  nome: 'conversa.escalarHumano',
  modulo: 'BOTS',
  descricao:
    'Passa a conversa para um atendente humano (handoff). Use quando: o cliente ' +
    'pedir para falar com uma pessoa, a acao estiver fora da sua alcada (ex.: ' +
    'cancelar venda, desconto fora da regra) ou voce nao conseguir resolver. ' +
    'Depois de escalar, NAO continue tentando resolver — avise o cliente, em uma ' +
    'mensagem curta, que um atendente vai assumir.',
  parametros: {
    tipo: 'object',
    propriedades: {
      motivo: {
        tipo: 'string',
        descricao: 'Motivo curto da escalada (ex.: "cliente quer cancelar", "pediu humano").',
        opcional: true,
      },
    },
    obrigatorios: [],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const conversaId = contexto?.dadosGatilho?.conversaId || contexto?.entrada?.conversaId || null;
    if (!conversaId) {
      throw new Error('Sem conversa no contexto — escalar so funciona em conversa de canal.');
    }

    const conversa = await prisma.conversa.findFirst({
      where: { id: conversaId, clienteId: contexto.clienteId },
      select: { id: true, estado: true, usuarioId: true },
    });
    if (!conversa) throw new Error('Conversa nao encontrada.');

    const estadoAtual = conversa.estado && typeof conversa.estado === 'object' ? conversa.estado : {};
    const motivo = args?.motivo ? String(args.motivo).trim().slice(0, 300) : null;
    const novoEstado = {
      ...estadoAtual,
      aguardandoHumano: true,
      escaladoEm: new Date().toISOString(),
      motivoEscalada: motivo,
    };

    await prisma.$transaction(async (tx) => {
      await tx.conversa.update({
        where: { id: conversa.id },
        data: { estado: novoEstado },
      });
      // Notifica o time (sino). usuarioId nulo = todos do tenant veem; se a
      // conversa ja tem um responsavel, direciona pra ele.
      await tx.notificacao.create({
        data: {
          clienteId: contexto.clienteId,
          usuarioId: conversa.usuarioId || null,
          tipo: 'GENERICA',
          titulo: 'Atendimento precisa de um humano',
          mensagem: motivo ? `Motivo: ${motivo}` : 'O bot passou uma conversa para atendimento humano.',
          link: '/app/mensagens',
        },
      });
    });

    return { ok: true, conversaId: conversa.id, aguardandoHumano: true };
  },
};

const lembrar = {
  nome: 'conversa.lembrar',
  modulo: 'BOTS',
  descricao:
    'Guarda na memoria da conversa os fatos importantes que o cliente disse, pra ' +
    'nao esquecer quando ela ficar longa. Use SEMPRE que captar algo critico: ' +
    'servico/produto desejado, data/horario de preferencia, restricoes (ex.: ' +
    'alergia), nome, ou qualquer detalhe que afete o atendimento. Passe so o que ' +
    'e novo ou mudou.',
  parametros: {
    tipo: 'object',
    propriedades: {
      dados: {
        tipo: 'object',
        descricao: 'Pares chave/valor com os fatos (ex.: {"servico":"corte","alergia":"tinta X","preferencia":"sexta de tarde"}).',
        opcional: true,
      },
      resumo: {
        tipo: 'string',
        descricao: 'Resumo curto e atualizado da conversa ate aqui (opcional).',
        opcional: true,
      },
    },
    obrigatorios: [],
  },
  async executar({ args, contexto }) {
    exigirCliente(contexto);
    const conversaId = contexto?.dadosGatilho?.conversaId || contexto?.entrada?.conversaId || null;
    if (!conversaId) {
      throw new Error('Sem conversa no contexto — memoria so funciona em conversa de canal.');
    }

    const conversa = await prisma.conversa.findFirst({
      where: { id: conversaId, clienteId: contexto.clienteId },
      select: { id: true, estado: true },
    });
    if (!conversa) throw new Error('Conversa nao encontrada.');

    const dadosNovos = args?.dados && typeof args.dados === 'object' && !Array.isArray(args.dados) ? args.dados : null;
    const resumo = args?.resumo ? String(args.resumo).trim().slice(0, 1500) : null;
    if (!dadosNovos && !resumo) {
      throw new Error('Nada para lembrar: informe "dados" e/ou "resumo".');
    }

    const estadoAtual = conversa.estado && typeof conversa.estado === 'object' ? conversa.estado : {};
    const memoriaAtual = estadoAtual.memoria && typeof estadoAtual.memoria === 'object' ? estadoAtual.memoria : {};
    const dadosMesclados = { ...(memoriaAtual.dados || {}), ...(dadosNovos || {}) };

    const novoEstado = {
      ...estadoAtual,
      memoria: {
        ...memoriaAtual,
        dados: dadosMesclados,
        ...(resumo ? { resumo } : {}),
        atualizadoEm: new Date().toISOString(),
      },
    };

    await prisma.conversa.update({ where: { id: conversa.id }, data: { estado: novoEstado } });
    return { ok: true, memoria: novoEstado.memoria };
  },
};

module.exports = [escalarHumano, lembrar];
