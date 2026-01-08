import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Componentes e Layouts
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import ProdutoList from './pages/Produtos/ProdutoList';
import ProdutoForm from './pages/Produtos/ProdutoForm'; // <--- IMPORTANTE: Importar o Form

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
        {/* ROTA PÚBLICA */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* ROTAS PROTEGIDAS */}

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* --- Rotas de Produtos --- */}

        {/* Listagem */}
        <Route
          path="/produtos"
          element={
             <PrivateRoute>
                 <ProdutoList />
             </PrivateRoute>
            }
        />

        {/* Novo Produto */}
        <Route
          path="/produtos/novo"
          element={
             <PrivateRoute>
                 <ProdutoForm />
             </PrivateRoute>
            }
        />

        {/* Editar Produto (Recebe o ID) */}
        <Route
          path="/produtos/editar/:id"
          element={
             <PrivateRoute>
                 <ProdutoForm />
             </PrivateRoute>
            }
        />

        {/* Rota Coringa - Redireciona para Login se não achar nada */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;