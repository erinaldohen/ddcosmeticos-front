import axios from 'axios';
import { toast } from 'react-toastify';

// Tenta pegar a URL do arquivo .env (padrão Vite ou CRA), senão usa localhost
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // Aumentei para 15s (relatórios pesados podem demorar)
  headers: {
    'Content-Type': 'application/json'
  }
});

// --- INTERCEPTOR DE REQUISIÇÃO ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    // Remove aspas duplas extras que às vezes ficam salvas no localStorage
    const cleanToken = token.replace(/"/g, '');
    config.headers.Authorization = `Bearer ${cleanToken}`;
  }

  return config;
}, error => Promise.reject(error));

// --- INTERCEPTOR DE RESPOSTA ---
api.interceptors.response.use(
  (response) => response,
  (error) => {

    // CASO 1: Erro de Conexão (Servidor fora do ar ou internet caiu)
    if (!error.response) {
      toast.error("Erro de conexão. Verifique sua internet ou contate o suporte.");
      return Promise.reject(error);
    }

    const status = error.response.status;
    const mensagemBackend = error.response.data?.message || "Ocorreu um erro inesperado.";

    // CASO 2: Token Expirado ou Inválido (401)
    if (status === 401) {
      // Evita loops se já estivermos na tela de login
      if (!window.location.pathname.includes('/login')) {
        toast.warning("Sua sessão expirou. Faça login novamente.");
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        setTimeout(() => window.location.href = '/login', 2000);
      }
    }

    // CASO 3: Sem Permissão (403) - Ex: Caixa tentando acessar Auditoria
    else if (status === 403) {
      toast.error("Acesso Negado: Você não tem permissão para realizar esta ação.");
    }

    // CASO 4: Erro do Servidor (500) - Bug no backend
    else if (status === 500) {
      console.error("Erro Crítico no Backend:", error.response.data);
      toast.error("Erro interno do servidor. Tente novamente mais tarde.");
    }

    // CASO 5: Erros de Validação (400) ou Regra de Negócio
    // Geralmente deixamos o componente tratar, mas podemos logar aqui
    else if (status === 400 || status === 422) {
      // Opcional: Se quiser mostrar toast automático para validações:
      // toast.warn(mensagemBackend);
    }

    return Promise.reject(error);
  }
);

export default api;