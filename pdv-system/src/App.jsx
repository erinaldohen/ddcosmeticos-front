import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout Principal
import MainLayout from './components/Layout/MainLayout';

// Páginas de Acesso
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PDV from './pages/PDV/PDV';

// Produtos
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';

// Caixa
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';
import HistoricoCaixa from './pages/Caixa/HistoricoCaixa';

// Fiscal e Auditoria
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import Auditoria from './pages/Auditoria/Auditoria';
import LixeiraProdutos from './pages/Auditoria/LixeiraProdutos';

// =================================================================
// COMPONENTES DE PROTEÇÃO DE ROTA
// =================================================================

// 1. Rota Privada (Básica): Apenas verifica se existe token
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

// 2. Rota Admin (Avançada): Verifica token E permissão de Gerente
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');

  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch (e) {
    usuario = {};
  }

  if (!token) return <Navigate to="/login" replace />;

  if (usuario.perfil !== 'ROLE_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// =================================================================
// APLICAÇÃO PRINCIPAL
// =================================================================

function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Routes>
        {/* --- ROTA PÚBLICA --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* --- ROTAS GERAIS --- */}
        <Route path="/dashboard" element={<PrivateRoute><MainLayout><Dashboard /></MainLayout></PrivateRoute>} />
        <Route path="/pdv" element={<PrivateRoute><MainLayout><PDV /></MainLayout></PrivateRoute>} />
        <Route path="/caixa" element={<PrivateRoute><MainLayout><GerenciamentoCaixa /></MainLayout></PrivateRoute>} />
        <Route path="/historico-caixa" element={<PrivateRoute><MainLayout><HistoricoCaixa /></MainLayout></PrivateRoute>} />
        <Route path="/produtos" element={<PrivateRoute><MainLayout><ProdutoList /></MainLayout></PrivateRoute>} />

        <Route path="/produtos/novo" element={<PrivateRoute><MainLayout><ProdutoForm /></MainLayout></PrivateRoute>} />
        <Route path="/produtos/editar/:id" element={<PrivateRoute><MainLayout><ProdutoForm /></MainLayout></PrivateRoute>} />

        {/* --- ROTAS ADMINISTRATIVAS --- */}
        <Route path="/fiscal" element={<AdminRoute><MainLayout><RelatorioImpostos /></MainLayout></AdminRoute>} />
        <Route path="/auditoria" element={<AdminRoute><MainLayout><Auditoria /></MainLayout></AdminRoute>} />
        <Route path="/auditoria/lixeira" element={<AdminRoute><MainLayout><LixeiraProdutos /></MainLayout></AdminRoute>} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;