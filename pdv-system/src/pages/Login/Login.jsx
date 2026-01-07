import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginUser } from '../../services/authService';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [matricula, setMatricula] = useState(''); // Mudou de email para matricula
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
      e.preventDefault();
      if (!matricula || !senha) {
        // ANTES: toast.warning(...) -> Laranja
        // AGORA: Usará o Magenta definido no CSS acima, mantendo a coerência.
        toast.warn("Preencha matrícula e senha para continuar.");
        return;
      }

    setLoading(true);

    try {
      // Chama o serviço real
      const data = await loginUser(matricula, senha);

      // Salva os dados retornados pelo Java
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuarioNome', data.nome);
      localStorage.setItem('usuarioPerfil', data.perfil);

      // Feedback elegante
      toast.success(`Bem-vindo, ${data.nome}!`); // Turquesa (Sucesso)
      navigate('/dashboard');

    } catch (error) {
      console.error("Erro Login:", error);

      // Tratamento Inteligente dos erros do Java
      let msg = "Falha ao conectar ao servidor.";

      if (error.response) {
        // Se o backend retornou o objeto ErrorResponse padronizado
        if (error.response.data && error.response.data.message) {
          msg = error.response.data.message;
        }
        // Se for erro de validação de campos (Map<String, String>)
        else if (error.response.data && error.response.data.errors) {
          const firstError = Object.values(error.response.data.errors)[0];
          msg = firstError || "Dados inválidos.";
        }
        else if (error.response.status === 403) {
           msg = "Acesso negado ou credenciais inválidas.";
        }
      }

      toast.error(msg); // Vermelho Profundo (Erro)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo-area">
          <img src="/logo.png" alt="DD" className="logo-img" />
          <div className="login-title">
            <h2>Acesso Corporativo</h2>
            <p>Insira sua matrícula funcional.</p>
          </div>
        </div>

        <form className="form-area" onSubmit={handleLogin}>
          <div className="input-wrapper">
            <label>Matrícula</label> {/* Label ajustado */}
            <input
              type="text"
              className="custom-input"
              placeholder="Ex: 102030"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input-wrapper">
            <label>Senha</label>
            <input
              type="password"
              className="custom-input"
              placeholder="Sua senha de rede"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn-login"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;