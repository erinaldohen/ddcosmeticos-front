import axios from 'axios';
import { toast } from 'react-toastify';

// Flag para evitar múltiplos redirecionamentos simultâneos se várias requisições falharem ao mesmo tempo
let isRedirecting = false;

// Cria a instância do Axios
const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1', // URL Base correta
  timeout: 10000,
  withCredentials: true // CRÍTICO: Permite que o browser envie/receba cookies HttpOnly
});

// Interceptor de Resposta (Mantemos para tratar sessão expirada)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("Sessão expirada. Redirecionando para login.");
      localStorage.removeItem('user'); // Limpa dados do usuário
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    // Remove aspas duplas caso o token tenha sido salvo com JSON.stringify
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

    // 1. Erro de Conexão ou Timeout
    if (error.code === 'ECONNABORTED' || !error.response) {
      toast.error("Servidor indisponível ou tempo limite excedido.");
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;
    // Tenta pegar a mensagem amigável enviada pelo Spring Boot (ex: "Saldo insuficiente")
    const backendMessage = error.response.data?.message || error.response.data?.error;

    // 2. Erro 401 (Não Autorizado / Token Expirado)
    if (status === 401 && !originalRequest.url.includes('/auth/login')) {
       if (!isRedirecting) {
           isRedirecting = true;
           console.warn("Sessão expirada.");

           localStorage.removeItem('token');
           localStorage.removeItem('user');

           toast.error("Sessão expirada. Faça login novamente.");

           setTimeout(() => {
               window.location.href = '/login';
               isRedirecting = false; // Reseta flag (embora a página vá recarregar)
           }, 1500);
       }
       return Promise.reject(error);
    }

    // 3. Erro 403 (Permissão)
    if (status === 403) {
      toast.error("Acesso negado: Perfil sem permissão.");
    }

    // 4. Erro 404 (Rota não encontrada - Útil para debug)
    if (status === 404) {
      console.error(`Rota não encontrada: ${originalRequest.url}`);
      // Não damos toast aqui pois as vezes o frontend trata o 404 (ex: busca sem resultados)
    }

    // 5. Erro 500 (Erro no Java/Backend)
    if (status === 500) {
      toast.error("Erro interno no servidor. Contate o suporte.");
      console.error("Erro 500 Detalhes:", error.response.data);
    }

    // 6. Erro 400 (Bad Request - Regra de Negócio)
    // Se o backend mandou uma mensagem específica, mostramos ela no Toast para facilitar
    if (status === 400 && backendMessage) {
        // Evita mostrar toasts genéricos se o componente já for tratar
        // Mas se quiser garantir que o erro apareça:
        // toast.warning(backendMessage);
    }

    return Promise.reject(error);
  }
);

export default api;