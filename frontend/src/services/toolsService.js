import api from './api';

export async function listarTools() {
  const r = await api.get('/tools');
  return r.data;
}

export async function atualizarToolsBot(botId, toolsHabilitadas) {
  const r = await api.patch(`/bots/${botId}/tools`, { toolsHabilitadas });
  return r.data;
}

export default { listarTools, atualizarToolsBot };
