import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout
import MainLayout from './components/Layout/MainLayout';

// Páginas
import Login from './pages/Login/Login'; // <--- CERTIFIQUE-SE DE IMPORTAR O LOGIN AQUI
import Auditoria from './pages/Auditoria/Auditoria';
import Dashboard from './pages/Dashboard/Dashboard';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm';
import RelatorioImpostos from './pages/Fiscal/RelatorioImpostos';
import PDV from './pages/PDV/PDV';
import GerenciamentoCaixa from './pages/Caixa/GerenciamentoCaixa';

// Lógica de Proteção de Rota
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  // Se não tiver token, manda para Login. Se tiver, renderiza o componente.
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />

      <Routes>
        {/* --- ROTA PÚBLICA (ESSENCIAL PARA NÃO DAR LOOP) --- */}
        <Route path="/login" element={<Login />} />

        {/* Rota Raiz: Se tiver logado vai pro dashboard, senão pro login */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* --- ROTAS PROTEGIDAS --- */}
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
          path="/caixa"
          element={
            <PrivateRoute>
              <MainLayout>
                <GerenciamentoCaixa />
              </MainLayout>
            </PrivateRoute>
          }
        />

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

        <Route
          path="/auditoria"
          element={
            <PrivateRoute>
              <MainLayout>
                <Auditoria />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* --- ROTA 404 (CORINGA) --- */}
        {/* Se a página não existe, manda para o Login para quebrar o loop */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </Router>
  );
}

export default App;