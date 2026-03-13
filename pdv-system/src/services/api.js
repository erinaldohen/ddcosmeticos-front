import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 15000,
  withCredentials: true
});

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || !error.response) {
      toast.error("Servidor DD Cosméticos indisponível.", { toastId: 'network-error' });
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;
    const url = originalRequest.url || '';

    const isLoginRequest = url.includes('/auth/login');
    const isReportRequest = url.includes('/relatorios');

    // Se o erro vier de um download de arquivo (blob), precisamos ler o JSON dentro do blob
    let backendMessage = "Operação inválida.";
    if (error.response.data instanceof Blob) {
       // Em downloads falhos, não conseguimos ler o json direto. Aqui apenas silenciamos ou tratamos genérico
       backendMessage = "Erro ao processar o arquivo solicitado.";
    } else {
       backendMessage = error.response.data?.mensagem || error.response.data?.message || "Operação inválida.";
    }

    // 6. Erro 428 (Precondition Required): Apenas repassa
    if (status === 428) {
      return Promise.reject(error);
    }

    // 2. Erro 400: Regras de Negócio e Validações
    if (status === 400 && !isLoginRequest) {
      if (isReportRequest) {
        console.warn("[BI] Erro 400 na rota de relatórios.");
        return Promise.reject(error);
      }
      toast.warning(backendMessage, { toastId: `bad-request-${status}` });
    }

    // 3. Erro 401: Sessão Expirada (Token Inválido)
    if (status === 401 && !isLoginRequest) {
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.clear();

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
      if (!isReportRequest) {
        toast.error("Ocorreu um erro interno no servidor.", { toastId: 'server-error-500' });
      }
      console.error("Erro 500 no Java:", error.response.data);
    }

    return Promise.reject(error);
  }
);

export default api;