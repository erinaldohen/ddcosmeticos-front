import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login/Login';
import PDV from './pages/PDV/PDV'; // PDV carrega instantaneamente para não atrasar o caixa

// =========================================================================
// 🚀 PERFORMANCE: Lazy Loading das telas gerenciais pesadas
// =========================================================================
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'));
const RelatorioComissoes = lazy(() => import('./pages/Relatorios/RelatorioComissoes'));
const CRM = lazy(() => import('./pages/CRM/CRM'));
const Configuracoes = lazy(() => import('./pages/Configuracoes/Configuracoes'));
const ProdutoList = lazy(() => import('./pages/Produtos/ProdutoList'));
const ProdutoForm = lazy(() => import('./pages/Produtos/ProdutoForm'));
const HistoricoProduto = lazy(() => import('./pages/Produtos/HistoricoProduto'));
const EntradaEstoque = lazy(() => import('./pages/Estoque/EntradaEstoque'));
const Inventario = lazy(() => import('./pages/Inventario/Inventario'));
const FornecedorList = lazy(() => import('./pages/Fornecedores/FornecedorList'));
const FornecedorForm = lazy(() => import('./pages/Fornecedores/FornecedorForm'));
const GerenciamentoCaixa = lazy(() => import('./pages/Caixa/GerenciamentoCaixa'));
const HistoricoCaixa = lazy(() => import('./pages/Caixa/HistoricoCaixa'));
const HistoricoVendas = lazy(() => import('./pages/Vendas/Historico/HistoricoVendas'));
const Auditoria = lazy(() => import('./pages/Auditoria/Auditoria'));
const ContasReceber = lazy(() => import('./pages/Financeiro/ContasReceber'));
const ContasPagar = lazy(() => import('./pages/Financeiro/ContasPagar'));

// =========================================================================
// 🛡️ SEGURANÇA: Prevenção contra "Tela Branca" (ChunkLoadError)
// =========================================================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Se falhar ao carregar o ficheiro JS do componente (Internet caiu ou houve atualização)
    if (error.name === 'ChunkLoadError' || String(error).includes('Failed to fetch dynamically imported module')) {
      console.warn("⚠️ Atualização detetada ou falha de rede. A recarregar o módulo silenciosamente...");
      window.location.reload();
    } else {
      console.error("Erro crítico na interface:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#334155' }}>
          <h2 style={{ marginBottom: '10px' }}>Ops! Ocorreu um pequeno erro de comunicação.</h2>
          <p>Tente recarregar a página.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Recarregar Sistema
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- HELPERS DE SEGURANÇA DE ROTAS ---
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

// --- DESIGN DO CARREGAMENTO (SPINNER) ---
const SuspenseLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f1f5f9' }}>
    <div style={{ width: '40px', height: '40px', border: '4px solid #cbd5e1', borderTopColor: '#ec4899', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
    <span style={{ color: '#64748b', fontWeight: '600', letterSpacing: '0.5px' }}>A abrir módulo...</span>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

// --- APLICAÇÃO PRINCIPAL ---
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastContainer position="top-right" autoClose={3000} theme="colored" limit={1} />
        <Suspense fallback={<SuspenseLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/pdv" element={<PrivateRoute><PDV /></PrivateRoute>} />

            <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />

                <Route path="/relatorios" element={<AdminRoute><Relatorios /></AdminRoute>} />
                <Route path="/relatorios/comissoes" element={<AdminRoute><RelatorioComissoes /></AdminRoute>} />

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

                <Route path="/configuracoes" element={<AdminRoute><Configuracoes /></AdminRoute>} />
                <Route path="/auditoria" element={<AdminRoute><Auditoria /></AdminRoute>} />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}