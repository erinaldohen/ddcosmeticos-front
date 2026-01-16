import api from './api';

const login = async (email, senha) => {
  // Envia 'email' no corpo, conforme o novo DTO do Java
  const response = await api.post('/auth/login', { email, senha });

  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    // Salva dados do usuário para mostrar no menu/header
    localStorage.setItem('usuario', JSON.stringify({
      nome: response.data.nome,
      perfil: response.data.perfil
    }));
  }
  return response.data;
};

const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/login';
};

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('usuario'));
};

export default {
  login,
  logout,
  getCurrentUser
};