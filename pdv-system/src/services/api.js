import axios from 'axios';

// Cria a instância do Axios
const api = axios.create({
  // Garante que a URL base esteja certa (ajuste a porta se necessário)
  baseURL: 'http://localhost:8080/api/v1',
});

// --- INTERCEPTOR DE REQUISIÇÃO ---
// Este trecho garante que o token vá limpo para o backend
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    // Remove aspas duplas, aspas simples e espaços
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
    if (error.response && error.response.status === 401) {
       console.warn("Sessão expirada. Redirecionando...");
       // Opcional: Limpar storage e redirecionar
       // localStorage.clear();
       // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;