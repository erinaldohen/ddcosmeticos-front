import React, { useState } from 'react';
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

  // Estado para feedback visual (borda vermelha e tremedeira)
  const [inputError, setInputError] = useState(false);

  const logoUrl = "/logo.png";

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    // UX: Assim que o usuário digita algo novo, removemos o alerta de erro visual
    if (inputError) setInputError(false);
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      setLoading(true);
      setInputError(false); // Reseta erro anterior antes de tentar

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

        // --- TRATAMENTO PERSONALIZADO DE MENSAGENS ---

        // CENÁRIO 1: Sem conexão (Internet caiu ou API desligada)
        if (!error.response) {
            toast.error("Sem conexão com o servidor. Verifique sua internet.");
            return; // Encerra aqui, não marca os campos como erro do usuário
        }

        const status = error.response.status;
        const msgBackend = error.response.data?.message || "";

        switch (status) {
            case 401: // Unauthorized
                setInputError(true); // Culpa do usuário (digitou errado)
                toast.error("Credenciais inválidas. Verifique seu login e senha.");
                break;

            case 403: // Forbidden
                setInputError(true);
                toast.warning("Acesso negado. Sua conta pode estar inativa ou bloqueada.");
                break;

            case 404: // Not Found (Raro em login, mas possível)
                setInputError(true);
                toast.error("Usuário não encontrado no sistema.");
                break;

            case 429: // Too Many Requests
                toast.warning("Muitas tentativas consecutivas. Aguarde alguns instantes.");
                break;

            case 500: // Internal Server Error
                toast.error("Erro interno no servidor. Nossa equipe já foi notificada.");
                break;

            case 502: // Bad Gateway
            case 503: // Service Unavailable
            case 504: // Gateway Timeout
                toast.error("O sistema está passando por instabilidade. Tente novamente em breve.");
                break;

            default:
                // Erro genérico com mensagem do backend (se houver)
                toast.error(msgBackend || "Ocorreu um erro inesperado ao tentar entrar.");
        }

      } finally {
        setLoading(false);
      }
  };

  return (
    <main className="login-container">
      <div className="login-bg-shape shape-1" aria-hidden="true"></div>
      <div className="login-bg-shape shape-2" aria-hidden="true"></div>

      <section className="login-card fade-in-up">
        <header className="login-header">
          <div className="logo-wrapper">
            <img
              src={logoUrl}
              alt="Logo DD Cosméticos"
              className="login-logo"
              onError={(e) => { e.target.style.display='none'; }}
            />
          </div>
          <h1>Acesso ao Sistema</h1>
          <p>Informe suas credenciais para continuar</p>
        </header>

        <form onSubmit={handleLogin} autoComplete="off">

          {/* O input recebe a classe 'has-error' se inputError for true */}
          <div className={`form-group ${inputError ? 'has-error' : ''}`}>
            <label htmlFor="login">Login</label>
            <div className="input-wrapper-modern">
              <div className="icon-slot">
                <User size={20} />
              </div>
              <input
                id="login"
                type="text"
                name="login"
                value={credentials.login}
                onChange={handleChange}
                placeholder="E-mail ou Matrícula"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className={`form-group ${inputError ? 'has-error' : ''}`}>
            <label htmlFor="password">Senha</label>
            <div className="input-wrapper-modern">
              <div className="icon-slot">
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
              />
              <button
                type="button"
                className="btn-eye"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-login-pulse"
            disabled={loading}
          >
            {loading ? <Loader2 className="spinner" size={20} /> : <>Acessar Sistema <LogIn size={20} style={{marginLeft:8}}/></>}
            {!loading && <div className="btn-glow"></div>}
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