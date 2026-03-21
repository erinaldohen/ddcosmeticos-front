import api from './api';

const authService = {
  login: async (credentials) => {
    const payload = {
        login: credentials.login || credentials.matricula || credentials.email,
        password: credentials.password || credentials.senha
    };

    // Ao fazer este POST, o Java (AuthenticationController) irá devolver
    // um "Set-Cookie" no cabeçalho. O navegador guarda esse cookie automaticamente.
    const response = await api.post('/auth/login', payload);

    if (response.data.usuario) {
      // Guardamos apenas os dados "inocentes" para desenhar a interface gráfica
      localStorage.setItem('user', JSON.stringify(response.data.usuario));
    }
    return response.data;
  },

  logout: async () => {
    try {
        // Ao chamar esta rota, o Java destrói o Cookie de sessão
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