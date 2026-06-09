import axios from 'axios';
import { toast } from 'react-toastify';

let isRedirecting = false;

// Função para detetar se estamos num túnel Cloudflare ou localmente
const getBaseUrl = () => {
  const isCloudflareTunnel = window.location.hostname.includes('trycloudflare.com');

  if (isCloudflareTunnel) {
    // Se o utilizador abriu o site pelo link HTTPS do Cloudflare, usamos o túnel do Backend (Java)
    return 'https://phones-normal-geo-prescribed.trycloudflare.com/api/v1';
  } else {
    // Se o utilizador abriu localmente, usamos a porta 8080 direta
    return 'http://localhost:8080/api/v1';
  }
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  withCredentials: true
});

// 🔥 INTERCEPTOR DE REQUISIÇÃO (Mostrador de Crachá)
api.interceptors.request.use(
  (config) => {
    // 1. Vai à memória do navegador buscar os dados guardados no Login
    const userStorage = localStorage.getItem('user');

    if (userStorage) {
      try {
        const user = JSON.parse(userStorage);
        // 2. Se encontrar o token, injeta o cabeçalho 'Authorization'
        if (user && user.token) {
          // Micro-ajuste: Garante que o objeto headers existe antes de injetar o Bearer
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch (error) {
        console.error("Erro ao processar o token:", error);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔥 INTERCEPTOR DE RESPOSTA (Tratamento de Erros e 401/403)
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

    // BLINDAGEM ABSOLUTA: Se o componente enviou 'silent: true', ignora falhas
    if (config.silent) {
        console.warn(`[Silent API] Erro ${status} na rota ${url} silenciado.`);
        return Promise.reject(error);
    }

    // CORREÇÃO: Rotas que não devem forçar o logout
    const isSilentSearch =
        url.includes('/ncm/sugestoes') ||
        url.includes('/fiscal/validar') ||
        url.includes('/estoque/historico-entradas');

    // SE O CRACHÁ FOR INVÁLIDO OU EXPIRADO
        if (status === 401 || status === 403) {
          // Adicione a rota de vendas aqui para não expulsar o usuário no meio da venda
          if (url.includes('login') || isSilentSearch || url.includes('/vendas')) {
              if (url.includes('/vendas')) {
                  toast.error("Sua sessão foi perdida. Por favor, tente novamente.");
              }
              return Promise.reject(error);
          }

          if (!isRedirecting) {
            isRedirecting = true;
            // Opcional: localStorage.removeItem('user'); // Comente isto para testar se a sessão volta sozinha
            toast.error("Sessão expirada.");
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