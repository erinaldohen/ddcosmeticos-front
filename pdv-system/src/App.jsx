import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout e Segurança
import PrivateRoute from './components/PrivateRoute'; // <-- ESSENCIAL: Faltava este import
import MainLayout from './components/Layout/MainLayout';    // <-- Removido o .jsx para evitar erro de resolução do Vite

// Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';

// CSS Global
import './index.css';

function App() {
  return (
    <Router>
      <ToastContainer
        position="top-right"
        autoClose={4000}
        theme="colored"
      />

      <Routes>
        {/* ==========================================
            ROTAS PÚBLICAS
            ========================================== */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* ==========================================
            ROTAS PROTEGIDAS (Usam MainLayout)
            ========================================== */}

        {/* Dashboard */}
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

        {/* Módulo de Produtos */}
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

        {/* Módulo Fiscal (Reforma Tributária LC 214) */}
        <Route
          path="/fiscal/retencao"
          element={
            <PrivateRoute>
              <MainLayout>
                <RelatorioImpostos />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;