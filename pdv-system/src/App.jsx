import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout (Agora contém o <Outlet /> e a Sidebar)
import MainLayout from './components/Layout/MainLayout';

// Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PDV from './pages/PDV/PDV';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';
import HistoricoCaixa from './pages/Caixa/HistoricoCaixa';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import Auditoria from './pages/Auditoria/Auditoria';

// --- COMPONENTES DE PROTEÇÃO ---

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch (e) { usuario = {}; }

  if (!token) return <Navigate to="/login" replace />;

  // Se o usuário não for ADMIN, manda para o PDV
  if (usuario.perfil !== 'ROLE_ADMIN') {
    return <Navigate to="/pdv" replace />;
  }

  return children;
};

// --- APP ---

function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Routes>
        {/* 1. ROTAS PÚBLICAS (Fora do Layout) */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* 2. LAYOUT PRINCIPAL (Persistente) */}
        {/* O MainLayout fica aqui como pai. Ele não recarrega ao mudar as rotas filhas. */}
        <Route element={<MainLayout />}>

          {/* --- ROTAS GERAIS (Operadores e Admins) --- */}
          <Route path="/pdv" element={
            <PrivateRoute><PDV /></PrivateRoute>
          } />

          <Route path="/caixa" element={
            <PrivateRoute><GerenciamentoCaixa /></PrivateRoute>
          } />

          {/* --- ROTAS RESTRITAS A ADMIN (ROLE_ADMIN) --- */}
          <Route path="/dashboard" element={
            <AdminRoute><Dashboard /></AdminRoute>
          } />

          <Route path="/historico-caixa" element={
            <AdminRoute><HistoricoCaixa /></AdminRoute>
          } />

          {/* Produtos */}
          <Route path="/produtos" element={
            <AdminRoute><ProdutoList /></AdminRoute>
          } />
          <Route path="/produtos/novo" element={
            <AdminRoute><ProdutoForm /></AdminRoute>
          } />
          <Route path="/produtos/editar/:id" element={
            <AdminRoute><ProdutoForm /></AdminRoute>
          } />

          {/* Fornecedores */}
          <Route path="/fornecedores" element={
            <AdminRoute><FornecedorList /></AdminRoute>
          } />
          <Route path="/fornecedores/novo" element={
            <AdminRoute><FornecedorForm /></AdminRoute>
          } />
          <Route path="/fornecedores/editar/:id" element={
            <AdminRoute><FornecedorForm /></AdminRoute>
          } />

          {/* Estoque */}
          <Route path="/estoque" element={
            <AdminRoute><ProdutoList /></AdminRoute>
          } />
          <Route path="/estoque/entrada" element={
            <AdminRoute><EntradaEstoque /></AdminRoute>
          } />

          {/* Fiscal e Auditoria */}
          <Route path="/fiscal" element={
            <AdminRoute><RelatorioImpostos /></AdminRoute>
          } />
          <Route path="/auditoria" element={
            <AdminRoute><Auditoria /></AdminRoute>
          } />

        </Route> {/* Fim do MainLayout */}

        {/* Rota Curinga */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;