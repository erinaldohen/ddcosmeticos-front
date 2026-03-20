import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,

    // A SOLUÇÃO AQUI: Permite que o Vite aceite o link da Cloudflare
    allowedHosts: true,

    // O PROXY: Encaminha secretamente as chamadas da API para o Java
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  }
})