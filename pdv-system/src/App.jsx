import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout (Menu Lateral + Topo)
import MainLayout from './components/Layout/MainLayout';

// --- PÁGINAS ---

// Acesso
import Login from './pages/Login/Login';

// Operacional
import PDV from './pages/PDV/PDV';
import Dashboard from './pages/Dashboard/Dashboard';

// Configurações
import Configuracoes from './pages/Configuracoes/Configuracoes';

// Produtos & Estoque
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
import Inventario from './pages/Inventario/Inventario';

// Parceiros (Fornecedores/Clientes)
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';

// Caixa (Gestão)
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

/**
 * Rota Privada Básica:
 * Apenas verifica se está logado. Usado para o PDV e Caixa Operacional.
 */
const PrivateRoute = ({ children }) => {
  const user = getUser();
  return user ? children : <Navigate to="/login" replace />;
};

/**
 * Rota Administrativa (Backoffice):
 * Verifica login E permissão. Se for apenas operador, joga para o PDV.
 */
const AdminRoute = ({ children }) => {
  const user = getUser();

  if (!user) return <Navigate to="/login" replace />;

  // Normaliza o perfil (alguns backends mandam 'perfil', outros 'role')
  const role = String(user.perfil || user.role || 'ROLE_USUARIO').toUpperCase();

  // Lista de quem pode acessar o painel administrativo
  const allowed = ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA', 'ROLE_FINANCEIRO'];

  if (!allowed.includes(role)) {
    // Se for operador comum tentando acessar admin, manda pro caixa
    return <Navigate to="/pdv" replace />;
  }

  return children;
};

// --- APLICAÇÃO PRINCIPAL ---

export default function App() {
  return (
    <BrowserRouter>
      {/* Container de notificações global */}
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <Routes>
        {/* 1. ROTA PÚBLICA */}
        <Route path="/login" element={<Login />} />

        {/* 2. ROTA OPERACIONAL (TELA CHEIA - SEM MENU LATERAL) */}
        <Route
          path="/pdv"
          element={
            <PrivateRoute>
              <PDV />
            </PrivateRoute>
          }
        />

        {/* 3. ROTAS ADMINISTRATIVAS (COM LAYOUT/MENU) */}
        {/* O MainLayout deve conter um <Outlet /> para renderizar os filhos */}
        <Route element={<MainLayout />}>

            {/* Dashboard & Visão Geral */}
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />

            {/* Gestão de Caixa (Abertura/Fechamento/Conferência) */}
            <Route path="/caixa" element={<PrivateRoute><GerenciamentoCaixa /></PrivateRoute>} />
            <Route path="/historico-caixa" element={<AdminRoute><HistoricoCaixa /></AdminRoute>} />

            {/* Produtos & Catálogo */}
            <Route path="/produtos" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/produtos/novo" element={<AdminRoute><ProdutoForm /></AdminRoute>} />
            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoForm /></AdminRoute>} />

            {/* Estoque & Inventário */}
            <Route path="/estoque" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/estoque/entrada" element={<AdminRoute><EntradaEstoque /></AdminRoute>} />
            <Route path="/inventario" element={<AdminRoute><Inventario /></AdminRoute>} />

            {/* Financeiro */}
            <Route path="/financeiro/contas-pagar" element={<AdminRoute><ContasPagar /></AdminRoute>} />
            <Route path="/financeiro/contas-receber" element={<AdminRoute><ContasReceber /></AdminRoute>} />

            {/* Fornecedores */}
            <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
            <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
            <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />

            {/* Fiscal, Configurações & Segurança */}
            <Route path="/fiscal" element={<AdminRoute><RelatorioImpostos /></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />

        </Route>

        {/* Rota Default: Redireciona para login ou dashboard */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}