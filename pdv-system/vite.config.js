import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 🔥 CORREÇÃO: Força o Hot Reload a usar o protocolo WS normal e a porta correta
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    }
  }
})