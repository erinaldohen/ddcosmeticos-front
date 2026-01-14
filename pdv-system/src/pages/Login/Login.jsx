import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const Login = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ login: '', senha: '' });
  const [loading, setLoading] = useState(false);

  // Caminho da logo na pasta public
  const logoUrl = "/logo.png";

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        // AJUSTE CRÍTICO: Mapeando os nomes dos campos para o Backend
        // Se o seu Java AuthenticationDTO espera "matricula", mudamos aqui:
        const payload = {
          matricula: credentials.login, // Frontend usa 'login', Backend recebe 'matricula'
          senha: credentials.senha
        };

        // Se o backend esperar 'login', mude 'matricula' para 'login' abaixo
        const response = await api.post('/auth/login', payload);

        const { token, nome, perfil, matricula } = response.data;

        if (token) {
          localStorage.setItem('token', token);
          localStorage.setItem('usuario', JSON.stringify({ nome, perfil, matricula }));

          toast.success(`Bem-vindo(a), ${nome.split(' ')[0]}!`);
          navigate('/dashboard');
        } else {
          toast.error("Erro: Token não recebido.");
        }

      } catch (error) {
        console.error("Erro Login:", error);

        // Feedback detalhado para você corrigir rápido
        if (error.response?.status === 400) {
          console.log("ERRO 400 - RESPOSTA DO SERVER:", error.response.data);
          toast.error("Erro de Validação. Verifique o console (F12).");
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          toast.error("Usuário ou senha incorretos.");
        } else {
          toast.error("Erro ao conectar ao servidor.");
        }
      } finally {
        setLoading(false);
      }
};

  return (
    // <main>: Conteúdo principal da página
    <main style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#F0F2F5', padding: '20px'
    }}>

      {/* <section>: Uma seção temática independente (o card de login) */}
      <section className="chart-card" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px', borderRadius: '16px' }} aria-labelledby="login-header">

        {/* <header>: Cabeçalho da seção, contendo a identidade (logo/título) */}
        <header style={{ textAlign: 'center', marginBottom: '35px' }}>
          <img
            src={logoUrl}
            alt="Logo DD Cosméticos"
            style={{
              maxWidth: '200px',
              maxHeight: '100px',
              width: 'auto',
              marginBottom: '10px',
              objectFit: 'contain'
            }}
            onError={(e) => { e.target.style.display='none'; document.getElementById('alt-text').style.display='block'; }}
          />

          <h1 id="alt-text" style={{ display: 'none', color: '#F22998', marginBottom: '10px', fontSize: '1.5rem' }}>
            DD Cosméticos
          </h1>

          {/* id="login-header" conecta com aria-labelledby da section */}
          <p id="login-header" className="text-muted" style={{ fontSize: '0.95rem' }}>
            Faça login para acessar o sistema
          </p>
        </header>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            {/* htmlFor conecta a label ao input pelo ID */}
            <label htmlFor="login" style={{ display: 'block', marginBottom: '8px', color: '#334155', fontWeight: '500' }}>
              Matrícula / Login
            </label>
            <div className="input-group" style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
              <User size={20} color="#F22998" style={{ marginRight: '12px' }} aria-hidden="true" />
              <input
                id="login"
                type="text"
                name="login"
                required
                value={credentials.login}
                onChange={handleChange}
                placeholder="Digite sua matrícula"
                autoComplete="username"
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem', background: 'transparent', color: '#1e293b' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label htmlFor="senha" style={{ display: 'block', marginBottom: '8px', color: '#334155', fontWeight: '500' }}>
              Senha
            </label>
            <div className="input-group" style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
              <Lock size={20} color="#F22998" style={{ marginRight: '12px' }} aria-hidden="true" />
              <input
                id="senha"
                type="password"
                name="senha"
                required
                value={credentials.senha}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '1rem', background: 'transparent', color: '#1e293b' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn-confirm"
            style={{
              width: '100%', padding: '14px', justifyContent: 'center', fontSize: '1.05rem',
              background: 'var(--primary)', borderRadius: '8px', fontWeight: '600',
              boxShadow: '0 4px 12px rgba(242, 41, 152, 0.3)'
            }}
            disabled={loading}
          >
            {loading ? 'Autenticando...' : <><LogIn size={22} aria-hidden="true" /> Acessar Sistema</>}
          </button>
        </form>

      </section>
    </main>
  );
};

export default Login;