import api from './api';

const authService = {
  login: async (credentials) => {
    // Adapter: Garante que enviamos 'login' e 'password' para o backend
    // mesmo que o form use 'matricula' ou 'senha'
    const payload = {
        login: credentials.login || credentials.matricula || credentials.email,
        password: credentials.password || credentials.senha
    };

    const response = await api.post('/auth/login', payload);

    if (response.data.usuario) {
      localStorage.setItem('user', JSON.stringify(response.data.usuario));
    }
    return response.data;
  },

  logout: async () => {
    try {
        await api.post('/auth/logout');
    } catch (e) {
        console.error("Logout error", e);
    } finally {
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
  },

  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch { return null; }
  },

  isAuthenticated: () => !!localStorage.getItem('user')
};

export default authService;