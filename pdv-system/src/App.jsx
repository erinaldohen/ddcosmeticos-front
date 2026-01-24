import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- LAYOUT ---
// Voltamos para o caminho relativo (./) e o nome que você já tinha (MainLayout)
import MainLayout from './components/Layout/MainLayout';

// --- PÁGINAS ---
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PDV from './pages/PDV/PDV';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import Configuracoes from './pages/Configuracoes/Configuracoes';

// Páginas que talvez ainda não existam ou precisem de ajuste de caminho
// Se der erro nelas, comente as linhas abaixo temporariamente:
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';
import HistoricoCaixa from './pages/Caixa/HistoricoCaixa';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import Auditoria from './pages/Auditoria/Auditoria';

// --- PROTEÇÃO DE ROTAS ---

const PrivateRoute = ({ children }) => {
  // Verifique se no seu Login você salva como 'token' ou 'dd-token'
  // Vou deixar 'token' baseado no seu primeiro código, mas se não logar, mude para 'dd-token'
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  let usuario = {};

  try {
    usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch (e) {
    usuario = {};
  }

  if (!token) return <Navigate to="/login" replace />;

  // Se não for admin, joga pro PDV
  if (usuario.perfil !== 'ROLE_ADMIN') {
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
        {/* ROTA PÚBLICA */}
        <Route path="/login" element={<Login />} />

        {/* ROTA RAIZ REDIRECIONA */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* LAYOUT PRINCIPAL (Protegido) */}
        <Route element={<MainLayout />}>

            {/* Acesso Geral */}
            <Route path="/pdv" element={<PrivateRoute><PDV /></PrivateRoute>} />
            <Route path="/caixa" element={<PrivateRoute><GerenciamentoCaixa /></PrivateRoute>} />

            {/* Acesso Admin */}
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />

            <Route path="/historico-caixa" element={<AdminRoute><HistoricoCaixa /></AdminRoute>} />

            {/* Produtos */}
            <Route path="/produtos" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/produtos/novo" element={<AdminRoute><ProdutoForm /></AdminRoute>} />
            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoForm /></AdminRoute>} />

            {/* Fornecedores */}
            <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
            <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
            <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />

            {/* Estoque */}
            <Route path="/estoque" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/estoque/entrada" element={<AdminRoute><EntradaEstoque /></AdminRoute>} />

            {/* Fiscal e Auditoria */}
            <Route path="/fiscal" element={<AdminRoute><RelatorioImpostos /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />

        </Route>

        {/* Rota de Erro */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}