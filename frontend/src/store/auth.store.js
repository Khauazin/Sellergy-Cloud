import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('@sellergy:token') || null,
  isAuthenticated: !!localStorage.getItem('@sellergy:token'),
  isLoading: false,
  isCheckingAuth: true,
  error: null,

  login: async (email, senha) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/autenticacao/login', { email, senha });
      const { usuario, token } = response.data;

      localStorage.setItem('@sellergy:token', token);
      set({ user: usuario, token, isAuthenticated: true, isLoading: false });

      // Reforca o estado com /perfil para garantir modulosLiberados, branding, foto etc.
      try {
        const perfil = await api.get('/autenticacao/perfil');
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

  logout: () => {
    localStorage.removeItem('@sellergy:token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('@sellergy:token');
    if (!token) {
      set({ isAuthenticated: false, isCheckingAuth: false });
      return;
    }

    try {
      const response = await api.get('/autenticacao/perfil');
      set({ user: response.data, isAuthenticated: true, isCheckingAuth: false });
    } catch (error) {
      localStorage.removeItem('@sellergy:token');
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
