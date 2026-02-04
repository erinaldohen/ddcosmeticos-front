import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/Layout/MainLayout';

// Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PDV from './pages/PDV/PDV';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';
import HistoricoCaixa from './pages/Caixa/HistoricoCaixa';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import Auditoria from './pages/Auditoria/Auditoria';

// --- HELPERS DE ROTA ---

// Função auxiliar para ler usuário com segurança
const getUser = () => {
  try {
    const userStr = localStorage.getItem('user') || localStorage.getItem('usuario');
    return userStr ? JSON.parse(userStr) : {};
  } catch (e) {
    return {};
  }
};

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = getUser();

  // Normaliza o perfil
  const role = user.perfil || user.perfilDoUsuario || user.role || '';

  if (!token) return <Navigate to="/login" replace />;

  // Se for ROLE_USUARIO ou ROLE_CAIXA tentando acessar rota admin, manda pro PDV
  const allowed = ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA'];

  if (!allowed.includes(role)) {
    return <Navigate to="/pdv" replace />;
  }

  return children;
};

// --- APP ---

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Redirecionamento da Raiz */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<MainLayout />}>

            {/* ROTAS ACESSÍVEIS PARA ROLE_USUARIO */}
            <Route path="/pdv" element={
              <PrivateRoute><PDV /></PrivateRoute>
            } />

            {/* Caixa: Geralmente Caixa e Admin, mas você pode liberar se necessário */}
            <Route path="/caixa" element={
              <PrivateRoute><GerenciamentoCaixa /></PrivateRoute>
            } />

            {/* ROTAS ADMINISTRATIVAS */}
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
            <Route path="/historico-caixa" element={<AdminRoute><HistoricoCaixa /></AdminRoute>} />

            <Route path="/produtos" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/produtos/novo" element={<AdminRoute><ProdutoForm /></AdminRoute>} />
            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoForm /></AdminRoute>} />

            <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
            <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
            <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />

            <Route path="/estoque" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/estoque/entrada" element={<AdminRoute><EntradaEstoque /></AdminRoute>} />

            <Route path="/fiscal" element={<AdminRoute><RelatorioImpostos /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />

        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}