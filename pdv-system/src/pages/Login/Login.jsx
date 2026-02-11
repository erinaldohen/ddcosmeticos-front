import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ login: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inputError, setInputError] = useState(false);

  // Referência para focar no primeiro campo ao carregar
  const loginInputRef = useRef(null);

  useEffect(() => {
    loginInputRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    if (inputError) setInputError(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setInputError(false);

    try {
      const response = await api.post('/auth/login', credentials);
      const usuarioRecebido = response.data.usuario || response.data.user;

      if (usuarioRecebido) {
        localStorage.setItem('user', JSON.stringify(usuarioRecebido));
        toast.success(`Login realizado! Bem-vindo, ${usuarioRecebido.nome.split(' ')[0]}.`);

        setTimeout(() => {
          if (['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_FINANCEIRO'].includes(usuarioRecebido.perfil)) {
            navigate('/dashboard');
          } else {
            navigate('/pdv');
          }
        }, 500);
      } else {
        throw new Error("RESPOSTA_VAZIA");
      }

    } catch (error) {
      const toastOptions = {
        autoClose: 4000,
        position: "top-right",
        toastId: "login-error-toast"
      };

      if (!error.response) {
        toast.error("Sem conexão com o servidor.", toastOptions);
        return;
      }

      const status = error.response.status;
      const msgBackend = error.response.data?.mensagem || error.response.data?.message;

      switch (status) {
        case 401:
          setInputError(true);
          toast.error("Senha incorreta. Por favor, tente novamente.", toastOptions);
          break;
        case 404:
          setInputError(true);
          toast.error("Usuário não encontrado.", toastOptions);
          break;
        default:
          toast.error(msgBackend || "Ocorreu um erro inesperado.", toastOptions);
      }

    } finally {
      setTimeout(() => setLoading(false), 100);
    }
  };

  return (
    <main className="login-container">
      <div className="login-bg-shape shape-1" aria-hidden="true"></div>
      <div className="login-bg-shape shape-2" aria-hidden="true"></div>

      <section className="login-card fade-in-up" role="main" aria-labelledby="login-title">
        <header className="login-header">
          <div className="logo-wrapper">
            <img
              src="/logo.png"
              alt="Logotipo DD Cosméticos"
              className="login-logo"
            />
          </div>
          <h1 id="login-title">Acesso ao Sistema</h1>
          <p>Informe suas credenciais para continuar</p>
        </header>

        <form onSubmit={handleLogin} autoComplete="off" role="form">
          <div className={`form-group ${inputError ? 'has-error' : ''}`}>
            <label htmlFor="login">Login</label>
            <div className="input-wrapper-modern">
              <div className="icon-slot" aria-hidden="true">
                <User size={20} />
              </div>
              <input
                ref={loginInputRef}
                id="login"
                type="text"
                name="login"
                value={credentials.login}
                onChange={handleChange}
                placeholder="E-mail ou Matrícula"
                required
                autoComplete="username"
                aria-invalid={inputError}
                aria-describedby={inputError ? "login-error-helper" : undefined}
              />
            </div>
          </div>

          <div className={`form-group ${inputError ? 'has-error' : ''}`}>
            <label htmlFor="password">Senha</label>
            <div className="input-wrapper-modern">
              <div className="icon-slot" aria-hidden="true">
                <Lock size={20} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={credentials.password}
                onChange={handleChange}
                placeholder="Sua senha"
                required
                autoComplete="current-password"
                aria-invalid={inputError}
              />
              <button
                type="button"
                className="btn-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Announcer Invisível: O software de leitura dirá isso quando o erro surgir */}
          <div id="login-error-helper" className="sr-only" aria-live="assertive">
            {inputError && "Erro na tentativa de login. Verifique se o usuário e senha estão corretos."}
          </div>

          <button
            type="submit"
            className="btn-login-pulse"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 className="spinner" size={24} aria-label="Carregando" />
            ) : (
              <>Acessar Sistema <LogIn size={20} style={{ marginLeft: 8 }} aria-hidden="true" /></>
            )}
          </button>
        </form>

        <footer className="login-footer">
          <p>© DD Cosméticos • Ambiente Seguro</p>
        </footer>
      </section>
    </main>
  );
};

export default Login;