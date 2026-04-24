import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login/Login';
import PDV from './pages/PDV/PDV';

// =========================================================================
// 🚀 PERFORMANCE: Lazy Loading das telas gerenciais e secundárias
// =========================================================================
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Relatorios = lazy(() => import('./pages/Relatorios/Relatorios'));
const RelatorioComissoes = lazy(() => import('./pages/Relatorios/RelatorioComissoes'));
const CRM = lazy(() => import('./pages/CRM/CRM'));
const Configuracoes = lazy(() => import('./pages/Configuracoes/Configuracoes'));
const ProdutoList = lazy(() => import('./pages/Produtos/ProdutoList'));
const ProdutoForm = lazy(() => import('./pages/Produtos/ProdutoForm'));
const HistoricoProduto = lazy(() => import('./pages/Produtos/HistoricoProduto'));

// 🔥 NOVA PÁGINA: GESTÃO DE NOTAS SEFAZ 🔥
const GestaoNotasSefaz = lazy(() => import('./pages/Estoque/GestaoNotasSefaz'));

const Inventario = lazy(() => import('./pages/Inventario/Inventario'));
const FornecedorList = lazy(() => import('./pages/Fornecedores/FornecedorList'));
const FornecedorForm = lazy(() => import('./pages/Fornecedores/FornecedorForm'));
const GerenciamentoCaixa = lazy(() => import('./pages/Caixa/GerenciamentoCaixa'));
const HistoricoCaixa = lazy(() => import('./pages/Caixa/HistoricoCaixa'));
const HistoricoVendas = lazy(() => import('./pages/Historico/HistoricoVendas'));
const HistoricoNotas = lazy(() => import('./pages/HistoricoNotas/HistoricoNotas'));
const Auditoria = lazy(() => import('./pages/Auditoria/Auditoria'));
const ContasPagar = lazy(() => import('./pages/Financeiro/ContasPagar'));
const Fiado = lazy(() => import('./pages/Fiado/Fiado'));
const CustomerDisplay = lazy(() => import('./pages/PDV/CustomerDisplay'));

// =========================================================================
// 🛡️ SEGURANÇA: ErrorBoundary (Proteção contra Ecrã Branco)
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
    try {
      console.error("UI Crash Interceptado:", error);
      const msg = error?.message || "";
      if (msg.includes('ChunkLoadError') || msg.includes('module')) {
        // Recarregamento comentado temporariamente para evitar loop infinito
        // window.location.reload();
      }
    } catch(e) {
      console.error("Falha ao registar erro:", e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
          <h2>Ops! Erro de comunicação ou de interface.</h2>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
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

  let roleStr = '';

  try {
    if (typeof user.perfilDoUsuario === 'string') roleStr = user.perfilDoUsuario;
    else if (typeof user.perfil === 'string') roleStr = user.perfil;
    else if (typeof user.role === 'string') roleStr = user.role;
    else if (Array.isArray(user.roles)) roleStr = user.roles[0]?.authority || user.roles[0]?.nome || '';
    else if (Array.isArray(user.authorities)) roleStr = user.authorities[0]?.authority || '';
  } catch (e) {
    console.warn("Formato de permissão não reconhecido.");
  }

  const role = roleStr.toUpperCase().replace('ROLE_', '');
  const allowed = ['ADMIN', 'GERENTE', 'ESTOQUISTA', 'FINANCEIRO'];

  return allowed.includes(role) ? children : <Navigate to="/pdv" replace />;
};

const SuspenseLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f1f5f9' }}>
    <div className="spinner"></div>
    <style>{`.spinner { width: 40px; height: 40px; border: 4px solid #cbd5e1; border-top-color: #ec4899; borderRadius: 50%; animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
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
            <Route path="/pdv/display" element={<PrivateRoute><CustomerDisplay /></PrivateRoute>} />

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

                {/* 🔥 A TELA DE GESTÃO DA SEFAZ AQUI 🔥 */}
                <Route path="/estoque/sefaz" element={<AdminRoute><GestaoNotasSefaz /></AdminRoute>} />

                <Route path="/historico-notas" element={<AdminRoute><HistoricoNotas /></AdminRoute>} />

                <Route path="/inventario" element={<AdminRoute><Inventario /></AdminRoute>} />
                <Route path="/fornecedores" element={<AdminRoute><FornecedorList /></AdminRoute>} />
                <Route path="/fornecedores/novo" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
                <Route path="/fornecedores/editar/:id" element={<AdminRoute><FornecedorForm /></AdminRoute>} />
                <Route path="/financeiro/contas-pagar" element={<AdminRoute><ContasPagar /></AdminRoute>} />
                <Route path="/fiado" element={<AdminRoute><Fiado /></AdminRoute>} />
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