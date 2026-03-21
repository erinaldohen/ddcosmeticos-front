import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  // A MÁGICA DA SEGURANÇA: Obriga o navegador a enviar o Cookie HttpOnly
  // que contém o JWT gerado pelo Java, sem que o Javascript saiba dele.
  withCredentials: true
});

// Interceptor de Request: REMOVIDO o código que lia o localStorage para buscar o Token!
// Agora é 100% responsabilidade do Cookie e do Browser.
api.interceptors.request.use(
  (config) => config,
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

    let backendMessage = "Operação inválida.";
    if (error.response.data instanceof Blob) {
       backendMessage = "Erro ao processar o arquivo solicitado.";
    } else {
       backendMessage = error.response.data?.mensagem || error.response.data?.message || "Operação inválida.";
    }

    if (status === 428) return Promise.reject(error);

    if (status === 400 && !isLoginRequest) {
      if (isReportRequest) {
        console.warn("[BI] Erro 400 na rota de relatórios.");
        return Promise.reject(error);
      }
      toast.warning(backendMessage, { toastId: `bad-request-${status}` });
    }

    // 401 ou 403 (Sessão Expirada ou Sem Permissão) - Limpa os dados visuais do user e força login
    if ((status === 401 || status === 403) && !isLoginRequest) {
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem('user'); // Removemos apenas as infos de nome/perfil

        if (status === 401) {
            toast.error("Sessão expirada. Identifique-se novamente.", { toastId: 'session-expired' });
        } else {
            toast.error("O seu perfil não tem permissão para aceder a este recurso.", { toastId: 'forbidden-error' });
        }

        setTimeout(() => {
          window.location.href = '/login';
          isRedirecting = false;
        }, 1500);
      }
      return Promise.reject(error);
    }

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