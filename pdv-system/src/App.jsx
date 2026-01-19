import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout
import MainLayout from './components/Layout/MainLayout';

// Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PDV from './pages/PDV/PDV';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
// --- NOVOS IMPORTS FORNECEDORES ---
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';
// ----------------------------------
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

  // Se o usuário não for ADMIN, manda para o PDV em vez de deslogar
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
        {/* PÚBLICO */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* --- ROTAS GERAIS (Operadores e Admins) --- */}
        <Route path="/pdv" element={
          <PrivateRoute>
            <MainLayout><PDV /></MainLayout>
          </PrivateRoute>
        } />

        <Route path="/caixa" element={
          <PrivateRoute>
            <MainLayout><GerenciamentoCaixa /></MainLayout>
          </PrivateRoute>
        } />

        {/* --- ROTAS RESTRITAS A ADMIN (ROLE_ADMIN) --- */}

        <Route path="/dashboard" element={
          <AdminRoute>
            <MainLayout><Dashboard /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/historico-caixa" element={
          <AdminRoute>
            <MainLayout><HistoricoCaixa /></MainLayout>
          </AdminRoute>
        } />

        {/* PRODUTOS */}
        <Route path="/produtos" element={
          <AdminRoute>
            <MainLayout><ProdutoList /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/produtos/novo" element={
          <AdminRoute>
            <MainLayout><ProdutoForm /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/produtos/editar/:id" element={
          <AdminRoute>
            <MainLayout><ProdutoForm /></MainLayout>
          </AdminRoute>
        } />

        {/* --- NOVAS ROTAS DE FORNECEDORES --- */}
        <Route path="/fornecedores" element={
          <AdminRoute>
            <MainLayout><FornecedorList /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/fornecedores/novo" element={
          <AdminRoute>
            <MainLayout><FornecedorForm /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/fornecedores/editar/:id" element={
          <AdminRoute>
            <MainLayout><FornecedorForm /></MainLayout>
          </AdminRoute>
        } />
        {/* ----------------------------------- */}

        {/* ESTOQUE */}

        {/* CORREÇÃO CRÍTICA: Rota /estoque adicionada.
            Sem ela, o navigate('/estoque') caía no path="*" e deslogava o usuário.
            Estou apontando para ProdutoList, pois geralmente é onde se vê o estoque. */}
        <Route path="/estoque" element={
          <AdminRoute>
            <MainLayout><ProdutoList /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/estoque/entrada" element={
          <AdminRoute>
            <MainLayout><EntradaEstoque /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/fiscal" element={
          <AdminRoute>
            <MainLayout><RelatorioImpostos /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/auditoria" element={
          <AdminRoute>
            <MainLayout><Auditoria /></MainLayout>
          </AdminRoute>
        } />

        {/* Rota Curinga: Qualquer endereço não listado acima redireciona para login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;