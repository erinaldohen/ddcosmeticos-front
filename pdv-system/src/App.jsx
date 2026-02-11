import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout
import MainLayout from './components/Layout/MainLayout';

// Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PDV from './pages/PDV/PDV';
import Configuracoes from './pages/Configuracoes/Configuracoes';

// Produtos & Estoque
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
import Inventario from './pages/Inventario/Inventario'; // <--- NOVA IMPORTAÇÃO

// Parceiros
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';

// Caixa
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';
import HistoricoCaixa from './pages/Caixa/HistoricoCaixa';

// Fiscal & Auditoria
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import Auditoria from './pages/Auditoria/Auditoria';

// Financeiro
import ContasReceber from './pages/Financeiro/ContasReceber';
import ContasPagar from './pages/Financeiro/ContasPagar';

// --- HELPERS DE SEGURANÇA ---

const getUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

// Rota Privada (Operacional)
const PrivateRoute = ({ children }) => {
  const user = getUser();
  return user ? children : <Navigate to="/login" replace />;
};

// Rota Administrativa (Backoffice)
const AdminRoute = ({ children }) => {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;

  const role = String(user.perfil || user.role || 'ROLE_USUARIO').toUpperCase();
  const allowed = ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA', 'ROLE_FINANCEIRO'];

  if (!allowed.includes(role)) {
    return <Navigate to="/pdv" replace />;
  }

  return children;
};

// --- APLICAÇÃO PRINCIPAL ---

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Routes>
        <Route path="/login" element={<Login />} />

        {/* PDV TELA CHEIA */}
        <Route path="/pdv" element={<PrivateRoute><PDV /></PrivateRoute>} />

        {/* LAYOUT ADMINISTRATIVO */}
        <Route element={<MainLayout />}>

            {/* Caixa Operacional */}
            <Route path="/caixa" element={<PrivateRoute><GerenciamentoCaixa /></PrivateRoute>} />

            {/* --- BACKOFFICE --- */}
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/historico-caixa" element={<AdminRoute><HistoricoCaixa /></AdminRoute>} />

            {/* Produtos */}
            <Route path="/produtos" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/produtos/novo" element={<AdminRoute><ProdutoForm /></AdminRoute>} />
            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoForm /></AdminRoute>} />

            {/* Estoque e Inventário */}
            <Route path="/estoque" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/estoque/entrada" element={<AdminRoute><EntradaEstoque /></AdminRoute>} />
            <Route path="/inventario" element={<AdminRoute><Inventario /></AdminRoute>} /> {/* <--- NOVA ROTA */}

            {/* Financeiro */}
            <Route path="/financeiro/contas-pagar" element={<AdminRoute><ContasPagar /></AdminRoute>} />
            <Route path="/financeiro/contas-receber" element={<AdminRoute><ContasReceber /></AdminRoute>} />

            {/* Fornecedores */}
            <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
            <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
            <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />

            {/* Fiscal & Sistema */}
            <Route path="/fiscal" element={<AdminRoute><RelatorioImpostos /></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />

        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}