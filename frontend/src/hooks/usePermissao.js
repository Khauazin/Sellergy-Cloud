// =====================================================================
// Hook usePermissao — checagem de permissão no frontend
// =====================================================================
// Espelha a lógica do middleware `requerPermissao` do backend:
//   - ADMIN do sistema: tudo liberado.
//   - CLIENT (dono do tenant): tudo liberado.
//   - ADMINISTRADOR (colaborador): tudo liberado.
//   - VENDEDOR: precisa ter `permissoes[modulo][acao] === true`.
//
// Uso típico — esconder botão de "Excluir" pra quem não pode:
//
//   const podeExcluir = usePermissao('FINANCEIRO', 'excluir');
//   {podeExcluir && <Button onClick={remover}>Excluir</Button>}
//
// IMPORTANTE: essa checagem é só pra UX (esconder o que o usuário não
// pode). A segurança real fica no middleware do backend (defense in
// depth). Nunca substitua a checagem de servidor por essa.

import { useAuthStore } from '../store/auth.store';

export function usePermissao(modulo, acao) {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  // ADMIN do sistema passa em tudo
  if (user.perfil === 'ADMIN') return true;
  // CLIENT (dono) e ADMINISTRADOR (preset cheio) também passam em tudo
  if (user.perfil === 'CLIENT' || user.perfil === 'ADMINISTRADOR') return true;
  // VENDEDOR e demais: consulta o JSON de permissões
  return user.permissoes?.[modulo]?.[acao] === true;
}

// Helper pra checagem múltipla: ehAdminOuDono.
// Ações estruturais que SÓ podem ser feitas por CLIENT ou ADMINISTRADOR
// (mesmo VENDEDOR com permissão `excluir` no módulo é bloqueado).
export function useEhAdminOuDono() {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return user.perfil === 'ADMIN'
      || user.perfil === 'CLIENT'
      || user.perfil === 'ADMINISTRADOR';
}
