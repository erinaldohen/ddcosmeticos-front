import React from 'react';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  // 1. Verifica se existe o token salvo no navegador
  const token = localStorage.getItem('token');

  // 2. Se NÃO tiver token, redireciona imediatamente para o Login
  if (!token) {
    // O 'replace' impede que o usuário clique em "Voltar" e acesse a tela novamente
    return <Navigate to="/" replace />;
  }

  // 3. Se tiver token, permite a entrada (renderiza a página filha)
  return children;
};

export default PrivateRoute;