import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('@botmanager:token') || null,
  isAuthenticated: !!localStorage.getItem('@botmanager:token'),
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  login: async (email, senha) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/autenticacao/login', { email, senha });
      const { usuario, token } = response.data;

      localStorage.setItem('@botmanager:token', token);
      set({ user: usuario, token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.erro || 'Erro ao fazer login. Verifique suas credenciais.',
        isLoading: false
      });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('@botmanager:token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('@botmanager:token');
    if (!token) {
      set({ isAuthenticated: false, isCheckingAuth: false });
      return;
    }

    try {
      const response = await api.get('/autenticacao/perfil');
      set({ user: response.data, isAuthenticated: true, isCheckingAuth: false });
    } catch (error) {
      localStorage.removeItem('@botmanager:token');
      set({ user: null, token: null, isAuthenticated: false, isCheckingAuth: false });
    }
  },

  // Re-busca perfil do servidor (apos trocar senha, mudar permissoes, etc.)
  refreshUser: async () => {
    try {
      const response = await api.get('/autenticacao/perfil');
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
