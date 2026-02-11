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

// --- FINANCEIRO ---
import ContasReceber from './pages/Financeiro/ContasReceber';
import ContasPagar from './pages/Financeiro/ContasPagar';

// --- HELPERS DE SEGURANÇA ---

// Função auxiliar segura para ler o usuário do localStorage
const getUser = () => {
  try {
    // IMPORTANTE: Deve buscar a chave 'user' que definimos no Login.jsx
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

// Rota Privada Básica: Apenas verifica se está logado
// Usada para o PDV e Caixa (acessíveis a operadores)
const PrivateRoute = ({ children }) => {
  const user = getUser();
  return user ? children : <Navigate to="/login" replace />;
};

// Rota Administrativa: Verifica Login + Permissão
const AdminRoute = ({ children }) => {
  const user = getUser();

  // 1. Se não tem usuário salvo, manda pro Login
  if (!user) {
      return <Navigate to="/login" replace />;
  }

  // 2. Normaliza a role (maiúscula) para evitar erros de case-sensitive
  const role = String(user.perfil || user.role || 'ROLE_USUARIO').toUpperCase();

  // Lista de perfis que podem acessar o Backoffice (Dashboard)
  const allowed = ['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_ESTOQUISTA', 'ROLE_FINANCEIRO'];

  // 3. Se não tem permissão, manda para o PDV (que é permitido para todos logados)
  if (!allowed.includes(role)) {
    return <Navigate to="/pdv" replace />;
  }

  return children;
};

// --- APLICAÇÃO PRINCIPAL ---

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="colored"  /* <--- Garanta que esta propriedade existe */
      />

      <Routes>
        <Route path="/login" element={<Login />} />

        {/* --- PDV TELA CHEIA (Fora do Layout Principal) --- */}
        {/* Acessível a qualquer usuário logado */}
        <Route
          path="/pdv"
          element={
            <PrivateRoute>
              <PDV />
            </PrivateRoute>
          }
        />

        {/* --- ROTAS COM MENU LATERAL (MainLayout) --- */}
        <Route element={<MainLayout />}>

            {/* CAIXA: Acessível a todos via PrivateRoute (Operador precisa abrir caixa) */}
            <Route path="/caixa" element={<PrivateRoute><GerenciamentoCaixa /></PrivateRoute>} />

            {/* --- ROTAS ADMINISTRATIVAS (Protegidas por AdminRoute) --- */}

            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/historico-caixa" element={<AdminRoute><HistoricoCaixa /></AdminRoute>} />

            {/* Produtos */}
            <Route path="/produtos" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/produtos/novo" element={<AdminRoute><ProdutoForm /></AdminRoute>} />
            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoForm /></AdminRoute>} />

            {/* Estoque */}
            <Route path="/estoque" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/estoque/entrada" element={<AdminRoute><EntradaEstoque /></AdminRoute>} />

            {/* Financeiro */}
            <Route path="/financeiro/contas-pagar" element={<AdminRoute><ContasPagar /></AdminRoute>} />
            <Route path="/financeiro/contas-receber" element={<AdminRoute><ContasReceber /></AdminRoute>} />

            {/* Parceiros */}
            <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
            <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
            <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />

            {/* Fiscal & Config */}
            <Route path="/fiscal" element={<AdminRoute><RelatorioImpostos /></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />

        </Route>

        {/* Redirecionamento padrão da raiz */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Rota 404 - Redireciona para Login por segurança */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}