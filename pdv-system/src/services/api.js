import axios from 'axios';

// --- CONFIGURAÇÃO ---
// Quando tiver o backend real, mude para false e coloque sua URL
const USE_MOCK = false;
const API_URL = 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// --- SIMULADOR DE BACKEND (Para testarmos UX agora) ---
// Isso simula o atraso da internet e respostas do servidor
api.interceptors.request.use(async (config) => {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simula 1.5s de loading

    // Simulação de Rota de Login
    if (config.url === '/auth/login' && config.method === 'post') {
      const { email, password } = JSON.parse(config.data);

      // Regra de Negócio Simulada:
      if (password === '123456') {
        return Promise.resolve({
          data: {
            token: 'fake-jwt-token-123',
            user: { name: 'Gerente DD', email }
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        });
      } else {
        return Promise.reject({
          response: { status: 401, data: { message: 'Senha incorreta ou usuário não encontrado.' } }
        });
      }
    }
  }
  return config;
}, error => Promise.reject(error));

// --- INTERCEPTOR DE RESPOSTA (Tratamento Global de Erros) ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Se o token expirou (Erro 401), podemos deslogar o usuário automaticamente aqui
    if (error.response && error.response.status === 401) {
      console.warn("Sessão expirada ou credenciais inválidas");
      // Aqui poderíamos limpar o localStorage e redirecionar para login
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;