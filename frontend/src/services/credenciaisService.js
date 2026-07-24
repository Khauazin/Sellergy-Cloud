// Service de credenciais — somente leitura. Os endpoints NUNCA retornam
// dadosCifrados/iv/tag, só metadata.
//
// Serve às telas que precisam ESCOLHER uma credencial já cadastrada (bot,
// provedor de pagamento, emissor fiscal). Cadastrar e alterar é atribuição do
// admin: use adminCredenciaisService, que fala com /admin/clientes/:id/credenciais.
// O backend recusa escrita por aqui, então funções de criação não teriam efeito.

import api from './api';

export async function listarTipos() {
  const r = await api.get('/credenciais/tipos');
  return r.data;
}

export async function listar() {
  const r = await api.get('/credenciais');
  return r.data;
}

export default { listarTipos, listar };
