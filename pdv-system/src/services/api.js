import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

// Cria a instância do Axios com a URL base do seu Spring Boot
const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 15000, // Aumentado para 15s (BI costuma demorar mais que o PDV)
  withCredentials: true
});

// --- INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token && token !== 'null' && token !== 'undefined') {
      // Remove aspas extras que o localStorage às vezes coloca
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
    // 1. Erro de Conexão ou Servidor Offline
    if (error.code === 'ECONNABORTED' || !error.response) {
      toast.error("Servidor DD Cosméticos indisponível.", { toastId: 'network-error' });
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;
    const url = originalRequest.url || '';

    // Identificadores de rota para evitar alertas desnecessários
    const isLoginRequest = url.includes('/auth/login');
    const isReportRequest = url.includes('/relatorios');

    // 2. Erro 400: Regras de Negócio e Validações
    if (status === 400 && !isLoginRequest) {
      // SILENCIAR: Se for erro em Relatórios, não mostra Toast (o componente trata com Mocks)
      if (isReportRequest) {
        console.warn("[BI] Erro 400 na rota de relatórios. Verifique o mapeamento do LocalDate no Java.");
        return Promise.reject(error);
      }

      const backendMessage = error.response.data?.message || error.response.data || "Operação inválida.";

      // Usa um toastId fixo por mensagem para evitar duplicidade na tela
      toast.warning(backendMessage, { toastId: `bad-request-${backendMessage}` });
    }

    // 3. Erro 401: Sessão Expirada (Token Inválido)
    if (status === 401 && !isLoginRequest) {
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.clear(); // Limpa tudo para garantir segurança

        toast.error("Sessão expirada. Identifique-se novamente.", { toastId: 'session-expired' });

        setTimeout(() => {
          window.location.href = '/login';
          isRedirecting = false;
        }, 1500);
      }
      return Promise.reject(error);
    }

    // 4. Erro 403: Proibido (Permissão de Perfil)
    if (status === 403 && !isLoginRequest) {
      toast.error("Seu perfil não tem permissão para acessar este recurso.", { toastId: 'forbidden-error' });
      console.warn("Acesso negado em:", url);
    }

    // 5. Erro 500: Erro Crítico no Backend Java
    if (status === 500) {
      // Novamente, se for relatório, deixa o front lidar silenciosamente
      if (!isReportRequest) {
        toast.error("Ocorreu um erro interno no servidor.", { toastId: 'server-error-500' });
      }
      console.error("Erro 500 no Java:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;