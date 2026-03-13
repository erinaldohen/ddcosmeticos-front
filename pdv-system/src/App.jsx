import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout (Menu Lateral + Topo)
import MainLayout from './components/Layout/MainLayout';

// --- PÁGINAS ---
import Login from './pages/Login/Login';
import PDV from './pages/PDV/PDV';
import Dashboard from './pages/Dashboard/Dashboard';
import Relatorios from './pages/Relatorios/Relatorios';
import RelatorioComissoes from './pages/Relatorios/RelatorioComissoes'; // <-- IMPORTAÇÃO AQUI
import CRM from './pages/CRM/CRM';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import HistoricoProduto from './pages/Produtos/HistoricoProduto';
import EntradaEstoque from './pages/Estoque/EntradaEstoque';
import Inventario from './pages/Inventario/Inventario';
import FornecedorList from './pages/Fornecedores/FornecedorList';
import FornecedorForm from './pages/Fornecedores/FornecedorForm';
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';
import HistoricoCaixa from './pages/Caixa/HistoricoCaixa';
import HistoricoVendas from './pages/Vendas/Historico/HistoricoVendas';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import Auditoria from './pages/Auditoria/Auditoria';
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

const PrivateRoute = ({ children }) => {
  const user = getUser();
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;

  const rawRole = String(user.perfilDoUsuario || user.perfil || user.role || 'USUARIO').toUpperCase();
  const roleClean = rawRole.replace('ROLE_', '');

  const allowed = ['ADMIN', 'GERENTE', 'ESTOQUISTA', 'FINANCEIRO'];

  if (!allowed.includes(roleClean)) {
    return <Navigate to="/pdv" replace />;
  }

  return children;
};

// --- APLICAÇÃO PRINCIPAL ---
export default function App() {
  return (
    <BrowserRouter>
      {/* Previne múltiplas mensagens idênticas saltando na tela */}
      <ToastContainer position="top-right" autoClose={3000} theme="colored" limit={1} />

      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ROTA OPERACIONAL (TELA CHEIA) */}
        <Route path="/pdv" element={<PrivateRoute><PDV /></PrivateRoute>} />

        {/* ROTAS ADMINISTRATIVAS */}
        <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />

            {/* ROTAS DE RELATÓRIOS */}
            <Route path="/relatorios" element={<AdminRoute><Relatorios /></AdminRoute>} />
            <Route path="/relatorios/comissoes" element={<AdminRoute><RelatorioComissoes /></AdminRoute>} /> {/* <-- NOVA ROTA ADICIONADA AQUI */}

            <Route path="/crm" element={<AdminRoute><CRM /></AdminRoute>} />

            <Route path="/caixa" element={<PrivateRoute><GerenciamentoCaixa /></PrivateRoute>} />
            <Route path="/historico-caixa" element={<AdminRoute><HistoricoCaixa /></AdminRoute>} />
            <Route path="/vendas/historico" element={<AdminRoute><HistoricoVendas /></AdminRoute>} />

            <Route path="/produtos" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/produtos/novo" element={<AdminRoute><ProdutoForm /></AdminRoute>} />
            <Route path="/produtos/editar/:id" element={<AdminRoute><ProdutoForm /></AdminRoute>} />

            <Route path="/produtos/historico/:id" element={<AdminRoute><HistoricoProduto /></AdminRoute>} />

            <Route path="/estoque" element={<AdminRoute><ProdutoList /></AdminRoute>} />
            <Route path="/estoque/entrada" element={<AdminRoute><EntradaEstoque /></AdminRoute>} />
            <Route path="/inventario" element={<AdminRoute><Inventario /></AdminRoute>} />

            <Route path="/financeiro/contas-pagar" element={<AdminRoute><ContasPagar /></AdminRoute>} />
            <Route path="/financeiro/contas-receber" element={<AdminRoute><ContasReceber /></AdminRoute>} />

            <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
            <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
            <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />

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