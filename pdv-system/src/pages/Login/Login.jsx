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
        // 1. Envia as credenciais para o Back-end
        const response = await api.post('/auth/login', credentials);

        // 2. Extrai os dados mapeando exatamente com o LoginResponseDTO do Spring
        const usuarioRecebido = response.data.usuario;
        const tokenRecebido = response.data.token;

        if (usuarioRecebido && tokenRecebido) {
          // 3. Salva no LocalStorage
          localStorage.setItem('token', tokenRecebido);
          localStorage.setItem('user', JSON.stringify(usuarioRecebido));

          // Pega o primeiro nome com fallback de segurança
          const primeiroNome = usuarioRecebido.nome ? usuarioRecebido.nome.split(' ')[0] : 'Usuário';
          toast.success(`Login realizado! Bem-vindo, ${primeiroNome}.`);

          setTimeout(() => {
            // 4. Lógica de Redirecionamento Inteligente por Perfil
            const perfil = usuarioRecebido.perfilDoUsuario;

            if (['ROLE_ADMIN', 'ROLE_GERENTE', 'ROLE_FINANCEIRO'].includes(perfil)) {
              navigate('/dashboard');
            } else {
              navigate('/caixa'); // Operadores de PDV vão para a gestão de caixa
            }
          }, 500);
        } else {
          // O Back-end respondeu 200 OK, mas o JSON não tem 'token' ou 'usuario'
          throw new Error("FORMATO_INVALIDO");
        }

      } catch (error) { // Corrigido o erro de sintaxe aqui
        console.error("Erro detalhado no Login:", error);

        const toastOptions = {
          autoClose: 4000,
          position: "top-right",
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          toastId: "login-error-toast"
        };

        // Se o erro foi o nosso 'throw' customizado de formato
        if (error.message === "FORMATO_INVALIDO") {
          toast.error("O servidor respondeu, mas os dados estão incompletos. Contate o suporte.", toastOptions);
          return;
        }

        // Se não há resposta da API (Servidor fora ou erro de CORS)
        if (!error.response) {
          toast.error("Sem conexão com o servidor. Verifique sua internet.", toastOptions);
          return;
        }

        const status = error.response.status;
        const msgBackend = error.response.data?.mensagem || error.response.data?.message;

        switch (status) {
          case 401:
          case 403:
            setInputError(true);
            toast.error("Credenciais inválidas ou acesso negado.", toastOptions);
            break;
          case 404:
            setInputError(true);
            toast.error("Usuário não encontrado.", toastOptions);
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