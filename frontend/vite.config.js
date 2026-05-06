import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Le o .env da raiz do projeto (compartilhado com o backend e docker-compose)
  // em vez do default frontend/.env.
  envDir: '..',
});
