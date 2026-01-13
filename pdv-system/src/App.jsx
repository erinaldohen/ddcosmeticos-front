import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout
import MainLayout from './components/Layout/MainLayout';

// Páginas
import Auditoria from './pages/Auditoria/Auditoria';
import Dashboard from './pages/Dashboard/Dashboard';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import PDV from './pages/PDV/PDV'; // Novo Import

// Simulação de Autenticação (Ajuste conforme seu backend)
const PrivateRoute = ({ children }) => {
  const isAuthenticated = true; // Altere para sua lógica real de login
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />

      <Routes>
        {/* Rota Raiz Redireciona para Dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" />} />



        {/* Rotas Protegidas com Layout Principal */}
        <Route path="/auditoria" element={<PrivateRoute><MainLayout><Auditoria /></MainLayout></PrivateRoute>} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/produtos"
          element={
            <PrivateRoute>
              <MainLayout>
                <ProdutoList />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/produtos/novo"
          element={
            <PrivateRoute>
              <MainLayout>
                <ProdutoForm />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/produtos/editar/:id"
          element={
            <PrivateRoute>
              <MainLayout>
                <ProdutoForm />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/fiscal"
          element={
            <PrivateRoute>
              <MainLayout>
                <RelatorioImpostos />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* --- NOVA ROTA DO PDV --- */}
        <Route
          path="/pdv"
          element={
            <PrivateRoute>
              <MainLayout>
                <PDV />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Rota 404 */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;