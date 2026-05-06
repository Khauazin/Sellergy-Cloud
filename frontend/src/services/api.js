import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@sellergy:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// URL publica do backend para colar em servicos externos (Meta, MP, etc).
// Em dev, vem do tunel ngrok; em prod, do dominio publico real.
// Fallback para a baseURL da API quando nao definida.
export function urlPublica() {
  const publica = import.meta.env.VITE_URL_PUBLICA;
  const base = publica || api.defaults.baseURL || '';
  return base.replace(/\/$/, '');
}

export default api;
