import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // ou o plugin que já lá estiver

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    cors: true,
    allowedHosts: true, // Impede que o Vite bloqueie o domínio da Cloudflare
    hmr: {
      clientPort: 443 // A MAGIA: Diz ao Vite para usar a porta segura do Cloudflare para o auto-refresh
    }
  }
})