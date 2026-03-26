import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
    // ❌ Removemos o basicSsl() para que o Cloudflare consiga ler o servidor localmente via HTTP
  ],
  server: {
    host: true, // Permite acesso por outros dispositivos na mesma rede Wi-Fi
    port: 5173,
    strictPort: true,
    allowedHosts: true, // ✅ A SOLUÇÃO AQUI: Permite que o Vite aceite o link externo da Cloudflare

    // O PROXY: Encaminha as chamadas do Frontend para o Backend (Java)
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  }
})