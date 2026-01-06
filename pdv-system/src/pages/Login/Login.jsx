import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if(email && password) {
       navigate('/dashboard');
    } else {
       alert("Preencha os campos para testar.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="logo-area">
          {/* Se a logo não carregar, ele mostra o texto 'DD' de segurança */}
          <img src="/logo.png" alt="DD" className="logo-img" />

          <div className="login-title">
            <h2>Bem-vindo de volta</h2>
            <p>Faça login para gerenciar sua loja.</p>
          </div>
        </div>

        <form className="form-area" onSubmit={handleLogin}>
          <div className="input-wrapper">
            <label>E-mail</label>
            <input
              type="email"
              className="custom-input"
              placeholder="ex: gerente@ddcosmeticos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-wrapper">
            <label>Senha</label>
            <input
              type="password"
              className="custom-input"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-login">
            Acessar Sistema
          </button>
        </form>

        <a href="#" className="forgot-pass">Esqueci minha senha</a>

      </div>
    </div>
  );
};

export default Login;