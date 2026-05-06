// Helper para o ENGINE acessar credenciais do tenant just-in-time.
// Usado por executores de no (HTTP_REQUEST, futuro AI_AGENT, etc.).
//
// Filosofia: credenciais saem do banco em texto cifrado, sao decifradas
// no momento do uso, e o resultado em claro NUNCA e logado, persistido
// em ExecucaoNo.entrada/saida (registroLog ja trunca/sumariza), nem
// retornado pelas rotas de leitura.
//
// Ao usar uma credencial, atualizamos `ultimoUsoEm` em background
// (best-effort, nao bloqueia execucao).

const prisma = require('./prisma');
const { decifrarPayload } = require('./cripto/cofreCredenciais');

async function carregarCredencialDecifrada({ credencialId, clienteId }) {
  if (!credencialId) return null;
  const credencial = await prisma.credencial.findFirst({
    where: clienteId ? { id: credencialId, clienteId } : { id: credencialId },
  });
  if (!credencial) {
    throw new Error(`Credencial ${credencialId} nao encontrada (ou nao pertence ao tenant).`);
  }
  let dados;
  try {
    dados = decifrarPayload(credencial.clienteId, credencial);
  } catch (err) {
    throw new Error(`Falha ao decifrar credencial ${credencialId}: ${err.message}`);
  }

  // Stats em background — silencioso se falhar.
  prisma.credencial
    .update({ where: { id: credencial.id }, data: { ultimoUsoEm: new Date() } })
    .catch((e) => console.error('[credencial/stats]', e?.message || e));

  return { tipo: credencial.tipo, nome: credencial.nome, dados };
}

// Aplica a credencial ao objeto de cabecalhos HTTP conforme o tipo.
// Retorna NOVO objeto de cabecalhos — nao muta o original.
function aplicarCredencialEmCabecalhos(cabecalhos, credencialDecifrada) {
  if (!credencialDecifrada) return { ...cabecalhos };
  const out = { ...cabecalhos };
  const { tipo, dados } = credencialDecifrada;

  switch (tipo) {
    case 'HTTP_BEARER':
      out['Authorization'] = `Bearer ${dados.token}`;
      break;
    case 'HTTP_BASIC': {
      const b64 = Buffer.from(`${dados.usuario}:${dados.senha}`, 'utf8').toString('base64');
      out['Authorization'] = `Basic ${b64}`;
      break;
    }
    case 'HTTP_API_KEY':
      out[dados.headerName] = dados.key;
      break;
    case 'OPENAI_API_KEY':
      out['Authorization'] = `Bearer ${dados.apiKey}`;
      if (dados.organizationId) out['OpenAI-Organization'] = dados.organizationId;
      break;
    case 'ANTHROPIC_API_KEY':
      out['x-api-key'] = dados.apiKey;
      out['anthropic-version'] = '2023-06-01';
      break;
    case 'GEMINI_API_KEY':
      // Gemini usa query param, nao header — quem chama trata.
      break;
    default:
      // Tipos especificos de canal (Whatsapp, Telegram) usam credencial
      // direto no executor especifico, nao aqui.
      break;
  }
  return out;
}

module.exports = {
  carregarCredencialDecifrada,
  aplicarCredencialEmCabecalhos,
};
