import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, LogIn } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const Login = () => {
  const navigate = useNavigate();
  // Mantive 'login' no estado para compatibilidade, mas representa o Email
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
        // AJUSTE CRÍTICO 2.0: Adaptação para o novo sistema de Login por EMAIL
        // O Backend agora espera um LoginRequestDTO(String email, String senha)

        const payload = {
          email: credentials.login, // Mapeamos o campo 'login' do form para 'email' do DTO
          senha: credentials.senha
        };

        const response = await api.post('/auth/login', payload);

        // O novo LoginResponseDTO retorna: { token, nome, perfil }
        const { token, nome, perfil } = response.data;

        if (token) {
          localStorage.setItem('token', token);
          // Salvamos o objeto completo para uso no menu/cabeçalho
          localStorage.setItem('usuario', JSON.stringify({
            nome,
            perfil,
            email: credentials.login // Guardamos o email para referência local
          }));

          toast.success(`Bem-vindo(a), ${nome ? nome.split(' ')[0] : 'Usuário'}!`);
          navigate('/dashboard');
        } else {
          toast.error("Erro: Token de acesso não recebido.");
        }

      } catch (error) {
        console.error("Erro Login:", error);

        if (error.response?.status === 400) {
          // Erro de validação (ex: email inválido)
          toast.warning("Verifique o e-mail e a senha informados.");
        } else if (error.response?.status === 401 || error.response?.status === 403) {
          toast.error("Credenciais inválidas. Tente novamente.");
        } else {
          toast.error("Servidor indisponível no momento.");
        }
      } finally {
        setLoading(false);
      }
};

  return (
    // <main>: Conteúdo principal da página (LAYOUT INTACTO)
    <main style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: '#F0F2F5', padding: '20px'
    }}>

      {/* <section>: Card de login */}
      <section className="chart-card" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px', borderRadius: '16px' }} aria-labelledby="login-header">

        {/* <header>: Identidade visual */}
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

          <p id="login-header" className="text-muted" style={{ fontSize: '0.95rem' }}>
            Faça login para acessar o sistema
          </p>
        </header>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="login" style={{ display: 'block', marginBottom: '8px', color: '#334155', fontWeight: '500' }}>
              E-mail Corporativo
            </label>
            <div className="input-group" style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
              <User size={20} color="#F22998" style={{ marginRight: '12px' }} aria-hidden="true" />
              <input
                id="login"
                type="email" // Alterado para email para ativar validação do navegador
                name="login"
                required
                value={credentials.login}
                onChange={handleChange}
                placeholder="email@ddcosmeticos.com.br" // Placeholder atualizado
                autoComplete="email"
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