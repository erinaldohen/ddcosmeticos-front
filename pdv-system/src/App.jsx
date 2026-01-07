import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

/* 1. Importar o CSS da biblioteca PRIMEIRO */
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/* 2. Importar o SEU CSS DEPOIS (Isso garante que o override funcione) */
import './index.css';

/* 3. Importar Páginas */
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';

function App() {
  return (
    <Router>
      {/* Configuração Global dos Alertas:
         - autoClose={4000}: Fecha sozinho em 4 segundos
         - theme="colored": Usa o fundo colorido (essencial para nosso design)
         - hideProgressBar={false}: Mostra a barrinha de tempo
      */}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;