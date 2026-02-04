import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// Aceita uma prop 'roles' que é um array de permissões permitidas (ex: ['ROLE_ADMIN'])
const PrivateRoute = ({ roles }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  // 1. Não tem token? Login.
  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    const userRole = user.perfilDoUsuario || 
                     (user.authorities && user.authorities[0]?.authority) || 
                     user.role || 
                     'ROLE_USUARIO';

    // 2. Se a rota exige roles e o usuário NÃO tem a role necessária
    if (roles && !roles.includes(userRole)) {
      // Redireciona para uma página segura padrão (ex: PDV ou Dashboard)
      return <Navigate to="/pdv" replace />;
    }

    // 3. Autorizado
    return <Outlet />;

  } catch (error) {
    console.error("Erro ao validar rota privada:", error);
    return <Navigate to="/login" replace />;
  }
};

export default PrivateRoute;