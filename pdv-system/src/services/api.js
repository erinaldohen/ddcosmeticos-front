import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  withCredentials: true
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || !error.response) {
      if (!isRedirecting) toast.error("Servidor DD Cosméticos indisponível.");
      return Promise.reject(error);
    }

    const status = error.response.status;
    const config = error.config;
    const url = config.url || '';

    // 🔥 BLINDAGEM ABSOLUTA: Se o componente enviou 'silent: true', ignora falhas de permissão e 404
    if (config.silent) {
        console.warn(`[Silent API] Erro ${status} na rota ${url} silenciado.`);
        return Promise.reject(error);
    }

    // 🔥 CORREÇÃO: Nova rota oficial do backend incluída nas excepções
    const isSilentSearch =
        url.includes('/ncm/sugestoes') ||
        url.includes('/fiscal/validar') ||
        url.includes('/estoque/historico-entradas');

    if (status === 401 || status === 403) {
      if (url.includes('login') || isSilentSearch) return Promise.reject(error);

      if (!isRedirecting) {
        isRedirecting = true;
        localStorage.removeItem('user');
        toast.error("Sessão expirada ou sem permissão.");
        setTimeout(() => { window.location.href = '/login'; isRedirecting = false; }, 1500);
      }
    }

    if (status === 400 && !url.includes('login')) {
      toast.warning(error.response.data?.mensagem || "Operação inválida.");
    }

    return Promise.reject(error);
  }
);

export default api;