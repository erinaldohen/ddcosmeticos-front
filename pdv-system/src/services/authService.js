import api from './api';

export const loginUser = async (matricula, senha) => {
  // Agora enviamos EXATAMENTE o que o LoginRequestDTO.java pede
  const response = await api.post('/auth/login', {
    matricula,
    senha
  });
  return response.data; // Retorna o LoginResponseDTO (token, nome, perfil...)
};