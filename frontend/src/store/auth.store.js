import { create } from 'zustand';
import api, { definirCsrf } from '../services/api';

// A sessao vive num cookie httpOnly gerenciado pela API. O front nao guarda (nem
// consegue ler) o token — quem responde "estou logado?" e sempre o servidor,
// via /perfil. Por isso nao ha mais campo `token` nem nada em localStorage.
export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  login: async (email, senha) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/autenticacao/login', { email, senha });
      const { usuario, csrfToken } = response.data;

      // O cookie de sessao ja veio na resposta; aqui so guardamos o segredo de
      // CSRF que acompanha as proximas requisicoes de escrita.
      definirCsrf(csrfToken);
      set({ user: usuario, isAuthenticated: true, isLoading: false });

      // Reforca o estado com /perfil para garantir modulosLiberados, branding, foto etc.
      try {
        const perfil = await api.get('/autenticacao/perfil');
        definirCsrf(perfil.data?.csrfToken);
        set({ user: perfil.data });
      } catch { /* ignora, ja temos o user do login */ }

      return true;
    } catch (error) {
      set({
        error: error.response?.data?.erro || 'Erro ao fazer login. Verifique suas credenciais.',
        isLoading: false
      });
      return false;
    }
  },

  // Precisa passar pelo servidor: o cookie e httpOnly, o front nao tem como
  // apaga-lo sozinho.
  //
  // A limpeza local vem ANTES da chamada de rede de proposito. Quem chama
  // navega para a tela de login logo em seguida (ver UserMenu); se o estado so
  // zerasse na volta da requisicao, a tela de login ainda veria a sessao ativa e
  // devolveria o usuario para dentro do sistema.
  logout: async () => {
    definirCsrf(null);
    set({ user: null, isAuthenticated: false });
    try {
      await api.post('/autenticacao/logout');
    } catch { /* rede fora ou sessao ja expirada: o estado local ja foi limpo */ }
  },

  checkAuth: async () => {
    try {
      const response = await api.get('/autenticacao/perfil');
      definirCsrf(response.data?.csrfToken);
      set({ user: response.data, isAuthenticated: true, isCheckingAuth: false });
    } catch (error) {
      definirCsrf(null);
      set({ user: null, isAuthenticated: false, isCheckingAuth: false });
    }
  },

  // Re-busca perfil do servidor (apos trocar senha, mudar permissoes, etc.)
  refreshUser: async () => {
    try {
      const response = await api.get('/autenticacao/perfil');
      definirCsrf(response.data?.csrfToken);
      set({ user: response.data });
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return null;
    }
  },

  // Mark password change as done locally (otimistic update apos endpoint sucesso).
  marcarSenhaTrocada: () => {
    const user = get().user;
    if (user) set({ user: { ...user, deveTrocarSenha: false } });
  },
}));
