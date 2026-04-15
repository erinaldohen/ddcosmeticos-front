import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  withCredentials: true
});

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 1. Trata falhas de rede brutas (servidor offline)
    if (error.code === 'ECONNABORTED' || !error.response) {
      if (!isRedirecting) {
          toast.error("Servidor DD Cosméticos indisponível.", { toastId: 'network-error' });
      }
      return Promise.reject(error);
    }

    const status = error.response.status;
    const originalRequest = error.config;
    const url = originalRequest.url || '';

    // Rotas de IA e Pesquisa que não devem causar spam de erros na tela
    const isSilentSearch = url.includes('/ncm/sugestoes') || url.includes('/fiscal/validar') || (url.includes('/produtos') && url.includes('termo='));

    if (status === 404 && isSilentSearch) {
        return Promise.reject(error);
    }

    const isLoginRequest = url.includes('login');
    const isReportRequest = url.includes('/relatorios');

    let backendMessage = "Operação inválida.";
    if (error.response.data instanceof Blob) {
       backendMessage = "Erro ao processar o arquivo solicitado.";
    } else {
       backendMessage = error.response.data?.mensagem || error.response.data?.message || "Operação inválida.";
    }

    // Erros de Validação
    if (status === 428) return Promise.reject(error);

    // 2. Trata Autenticação e Autorização (Login, Sessão Expirada)
    if (status === 401 || status === 403) {
      if (isLoginRequest) {
          toast.error("E-mail ou senha incorretos.", { toastId: 'bad-credentials' });
          return Promise.reject(error);
      }

      // 🔥 CORREÇÃO DE ARQUITETURA: Blindagem contra o falso 401/403 do Spring Boot
      // Se a rota não existir no Backend, o Spring reencaminha para /error e devolve 403.
      // Jamais deslogamos o utilizador por causa de um endpoint de IA/Fiscal que falhou ou não foi criado.
      if (isSilentSearch) {
          console.warn(`[Segurança] Rota ${url} bloqueada pelo backend (${status}). Ignorando redirecionamento de login.`);
          return Promise.reject(error);
      }

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

    // 3. Trata Bad Request
    if (status === 400 && !isLoginRequest) {
      if (isReportRequest) {
        console.warn("[BI] Erro 400 na rota de relatórios.");
        return Promise.reject(error);
      }
      toast.warning(backendMessage, { toastId: `bad-request-${status}` });
    }

    // 4. Trata Internal Server Error
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