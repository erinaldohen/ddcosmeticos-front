import api from './api';

const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);

    // O Backend agora retorna { user: {...} }, o token vem via Cookie invisível
    if (response.data.user) {
      // Salvamos apenas os dados não sensíveis do usuário para a UI
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    try {
        // Avisa o backend para apagar o cookie
        await api.post('/auth/logout');
    } catch (e) {
        console.error("Erro ao fazer logout no servidor", e);
    } finally {
        // Limpa dados locais
        localStorage.removeItem('user');
        // Não existe mais 'token' para remover
    }
  },

  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated: () => {
      // Verificação simples de UI. A verificação real acontece na chamada de API (401)
      return !!localStorage.getItem('user');
  }
};

export default authService;