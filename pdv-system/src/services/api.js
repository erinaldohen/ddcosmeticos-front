import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

// Cria a instância do Axios
const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 10000,
  withCredentials: true
});

// --- INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token && token !== 'null' && token !== 'undefined') {
      const cleanToken = token.replace(/['"]+/g, '').trim();

      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// --- INTERCEPTOR DE RESPOSTA ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 1. Erro de Conexão (Backend desligado ou sem internet)
    if (error.code === 'ECONNABORTED' || !error.response) {
      toast.error("Servidor indisponível ou sem conexão.", { toastId: 'network-error' });
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;
    const isLoginRequest = originalRequest.url && originalRequest.url.includes('/auth/login');

    // 2. Erro 401: Token Expirado ou Inválido
    if (status === 401 && !isLoginRequest) {
      if (!isRedirecting) {
        isRedirecting = true;

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        toast.error("Sessão expirada. Faça login novamente.", { toastId: 'session-expired' });

        setTimeout(() => {
          window.location.href = '/login';
          isRedirecting = false;
        }, 1500);
      }
      return Promise.reject(error);
    }

    // 3. Erro 403: Sem Permissão
    if (status === 403 && !isLoginRequest) {
      toast.error("Acesso negado: Perfil sem permissão para esta ação.", { toastId: 'forbidden-error' });
      console.warn("Bloqueio 403 na rota:", originalRequest.url);
    }

    // 4. Erro 404: Endpoint não encontrado
    if (status === 404 && !isLoginRequest) {
      console.error(`Rota não encontrada no backend: ${originalRequest.url}`);
    }

    // 5. Erro 500: Erro Crítico no Java
    if (status === 500) {
      // O toastId garante que esta mensagem só apareça 1x, mesmo se 10 chamadas derem erro 500 juntas
      toast.error("Erro interno no servidor. Contate o suporte.", { toastId: 'server-error-500' });
      console.error("Erro 500 Detalhes:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;