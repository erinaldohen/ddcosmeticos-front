import axios from 'axios';
import { toast } from 'react-toastify';

// Cria a instância do Axios
const api = axios.create({
  // Tenta pegar do arquivo .env, senão usa o localhost como fallback
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    // Garante que o token vá limpo (sem aspas extras que o JSON.stringify possa ter deixado)
    const cleanToken = token.replace(/['"]+/g, '').trim();
    config.headers.Authorization = `Bearer ${cleanToken}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- INTERCEPTOR DE RESPOSTA ---
api.interceptors.response.use(
  (response) => response,
  (error) => {

    // 1. Erro de Conexão (Servidor Offline / Sem Internet)
    if (!error.response) {
      toast.error("Erro de conexão: Servidor indisponível.");
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;

    // 2. Erro 401 (Não Autorizado / Token Expirado)
    // Importante: Não redirecionar se o erro for na própria tentativa de login (evita loop)
    if (status === 401 && !originalRequest.url.includes('/auth/login')) {
       console.warn("Sessão expirada ou token inválido.");

       // Limpa dados sensíveis
       localStorage.removeItem('token');
       localStorage.removeItem('user');

       toast.error("Sessão expirada. Faça login novamente.");

       // Redireciona após breve delay para o usuário ler o toast
       setTimeout(() => {
           window.location.href = '/login';
       }, 1000);
    }

    // 3. Erro 403 (Proibido / Sem Permissão)
    if (status === 403) {
      toast.error("Acesso negado: Você não tem permissão para realizar esta ação.");
    }

    // Retorna o erro para ser tratado no catch específico do componente se necessário
    return Promise.reject(error);
  }
);

export default api;