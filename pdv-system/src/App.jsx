import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Importa o Guarda que acabamos de criar
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import ProdutoList from './pages/Produtos/ProdutoList';

// Importe seu CSS global (aquele que corrigimos o laranja)
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
        {/* ROTA PÚBLICA (Qualquer um acessa) */}
        <Route path="/" element={<Login />} />

        {/* ROTA PROTEGIDA (Só quem tem token entra) */}
        {/* Nova Rota de Dashboard */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Nova Rota de Produtos */}
        <Route path="/produtos"
         element={
             <PrivateRoute>
                 <ProdutoList />
             </PrivateRoute>
            }
        />

        {/* Dica de Ouro: Redirecionar qualquer rota desconhecida para o Login */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;