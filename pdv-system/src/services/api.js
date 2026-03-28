import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  // A MÁGICA DA SEGURANÇA: Obriga o navegador a enviar o Cookie HttpOnly
  withCredentials: true
});

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || !error.response) {
      if (!isRedirecting) {
          toast.error("Servidor DD Cosméticos indisponível.", { toastId: 'network-error' });
      }
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;
    const url = originalRequest.url || '';

    // Verifica se é tentativa de login
    const isLoginRequest = url.includes('login');
    const isReportRequest = url.includes('/relatorios');

    let backendMessage = "Operação inválida.";
    if (error.response.data instanceof Blob) {
       backendMessage = "Erro ao processar o arquivo solicitado.";
    } else {
       backendMessage = error.response.data?.mensagem || error.response.data?.message || "Operação inválida.";
    }

    if (status === 428) return Promise.reject(error);

    // 401 ou 403 - Tratamento robusto de Sessão
    if (status === 401 || status === 403) {
      // Se deu 401 na tela de login, é só senha errada. Não redireciona!
      if (isLoginRequest) {
          toast.error("E-mail ou senha incorretos.", { toastId: 'bad-credentials' });
          return Promise.reject(error);
      }

      // Se deu 401 navegando no sistema, o cookie expirou. Limpa e expulsa.
      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem('user');

        if (status === 401) {
            toast.error("Sessão expirada por segurança. Identifique-se novamente.", { toastId: 'session-expired' });
        } else {
            toast.error("O seu perfil não tem permissão para esta área.", { toastId: 'forbidden-error' });
        }

        setTimeout(() => {
          window.location.href = '/login';
          isRedirecting = false;
        }, 1500);
      }
      return Promise.reject(error);
    }

    // 400 - Erros de Validação (Ex: Estoque insuficiente)
    if (status === 400 && !isLoginRequest) {
      if (isReportRequest) {
        console.warn("[BI] Erro 400 na rota de relatórios.");
        return Promise.reject(error);
      }
      toast.warning(backendMessage, { toastId: `bad-request-${status}` });
    }

    // 500 - Erro Crítico no Backend (Agora expõe o erro real no console)
    if (status === 500) {
      console.error(`[ERRO 500 NO JAVA] Rota: ${url} | Detalhes:`, error.response.data);
      if (!isReportRequest) {
        toast.error("Erro interno. Verifique o console do navegador para detalhes.", { toastId: `server-error-${url}` });
      }
    }

    return Promise.reject(error);
  }
);

export default api;