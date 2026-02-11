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

  // Referência para focar no primeiro campo ao carregar (Acessibilidade Motora)
  const loginInputRef = useRef(null);

  const logoUrl = "/logo.png";

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
      console.error("Erro no Login:", error);

      const toastOptions = {
        autoClose: 4000,
        position: "top-right",
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        toastId: "login-error-toast"
      };

      if (!error.response) {
        toast.error("Sem conexão com o servidor. Verifique sua internet.", toastOptions);
        return;
      }

      const status = error.response.status;
      const msgBackend = error.response.data?.mensagem || error.response.data?.message;

      // Mantendo sua estrutura exata de mensagens de erro
      switch (status) {
        case 401:
          setInputError(true);
          toast.error("Senha incorreta. Por favor, tente novamente.", toastOptions);
          break;
        case 404:
          setInputError(true);
          toast.error("Usuário não encontrado. Verifique seu e-mail ou matrícula.", toastOptions);
          break;
        case 403:
          setInputError(true);
          toast.warning("Acesso negado. Sua conta pode estar inativa ou bloqueada.", toastOptions);
          break;
        case 429:
          toast.warning("Muitas tentativas consecutivas. Aguarde alguns instantes.", toastOptions);
          break;
        case 500:
          toast.error("Erro interno no sistema. Nossa equipe já foi notificada.", toastOptions);
          break;
        default:
          toast.error(msgBackend || "Ocorreu um erro inesperado ao tentar entrar.", toastOptions);
      }

    } finally {
      setTimeout(() => setLoading(false), 100);
    }
  };

  return (
    <main className="login-container">
      <div className="login-bg-shape shape-1" aria-hidden="true"></div>
      <div className="login-bg-shape shape-2" aria-hidden="true"></div>

      <section className="login-card fade-in-up" role="region" aria-labelledby="login-title">
        <header className="login-header">
          <div className="logo-wrapper">
            <img
              src={logoUrl}
              alt="Logo DD Cosméticos"
              className="login-logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 id="login-title">Acesso ao Sistema</h1>
          <p>Informe suas credenciais para continuar</p>
        </header>

        <form onSubmit={handleLogin} autoComplete="off" noValidate={false}>
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
                inputMode="text"
                aria-invalid={inputError}
                aria-describedby={inputError ? "login-error-announcer" : undefined}
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
                tabIndex="-1"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Announcer para leitores de tela: Ativado apenas em erro */}
          <div id="login-error-announcer" className="sr-only" aria-live="assertive">
            {inputError && "Erro na tentativa de login. Verifique seus dados nos campos destacados."}
          </div>

          <button
            type="submit"
            className="btn-login-pulse"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <Loader2 className="spinner" size={24} aria-label="Processando login" />
            ) : (
              <>Acessar Sistema <LogIn size={20} style={{ marginLeft: 8 }} aria-hidden="true" /></>
            )}
            {!loading && <div className="btn-glow" aria-hidden="true"></div>}
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