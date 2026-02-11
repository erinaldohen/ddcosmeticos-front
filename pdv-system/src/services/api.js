import axios from 'axios';
import { toast } from 'react-toastify';

// Flag para evitar múltiplos redirecionamentos simultâneos
let isRedirecting = false;

// Cria a instância do Axios
const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 10000,
  withCredentials: true
});

// --- INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
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
    const backendMessage = error.response.data?.mensagem || error.response.data?.message;

    // VERIFICAÇÃO CRUCIAL: Se a requisição veio da rota de autenticação
    const isLoginRequest = originalRequest.url.includes('/auth/login');

    // 2. Erro 401 (Não Autorizado / Senha Errada)
    if (status === 401) {
      // Se NÃO for login, tratamos como sessão expirada (Redireciona)
      if (!isLoginRequest) {
        if (!isRedirecting) {
          isRedirecting = true;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          toast.error("Sessão expirada. Faça login novamente.");

          setTimeout(() => {
            window.location.href = '/login';
            isRedirecting = false;
          }, 1500);
        }
      }
      // Se FOR login, apenas rejeitamos para o Login.jsx tratar o erro 401 (Senha Errada)
      return Promise.reject(error);
    }

    // 3. Erro 404 (Não Encontrado / Usuário Inexistente)
    if (status === 404) {
      // Se for login, não fazemos nada aqui, deixamos o Login.jsx exibir "Usuário não encontrado"
      if (isLoginRequest) {
        return Promise.reject(error);
      }
      console.error(`Rota não encontrada: ${originalRequest.url}`);
    }

    // 4. Erro 403 (Permissão / Conta Bloqueada)
    if (status === 403) {
      // Se não for login (tentativa de acessar rota proibida)
      if (!isLoginRequest) {
        toast.error("Acesso negado: Perfil sem permissão.");
      }
      // Se for login, o erro 403 (Conta Bloqueada) será tratado no componente
    }

    // 5. Erro 500 (Erro no Java/Backend)
    if (status === 500) {
      toast.error("Erro interno no servidor. Contate o suporte.");
      console.error("Erro 500 Detalhes:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;