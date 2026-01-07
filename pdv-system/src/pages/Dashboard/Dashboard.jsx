import React, { useEffect, useState } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './Dashboard.css';

const Dashboard = () => {
  // Estado inicial simulando "carregando"
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const nomeUsuario = localStorage.getItem('usuarioNome') || 'Gerente';

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Chama o endpoint real do Java
      const response = await api.get('/dashboard/resumo');
      setKpis(response.data);
    } catch (error) {
      // Se falhar, mostra erro mas mantém layout limpo
      console.error("Erro dashboard:", error);
      toast.error("Não foi possível atualizar os indicadores.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div className="page-title">
          <h1>Visão Geral</h1>
          <p>Olá, <strong>{nomeUsuario}</strong>. Aqui está o resumo de hoje.</p>
        </div>
        <div className="header-actions">
          <button onClick={carregarDados} title="Atualizar dados">↻ Atualizar</button>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign: 'center', padding: '50px', color: '#666'}}>Carregando indicadores...</div>
      ) : (
        <div className="kpi-grid">

          {/* O objeto 'kpis' virá do Java (DashboardResumoDTO).
              Ajuste os campos abaixo (ex: kpis.totalVendas) conforme o seu DTO real.
              Como não vi o DTO do Dashboard, estou supondo nomes padrão. */}

          <div className="kpi-card">
              <div className="card-top">
                <span className="card-label">Alertas de Estoque</span>
                {/* Ícone de Alerta usando a cor da marca */}
                <div className="icon-box icon-alert">⚡</div>
              </div>
              <div className="card-value">{kpis?.produtosBaixoEstoque || 0}</div>
              <div className="card-footer">
                {/* Texto em Magenta para indicar ação necessária */}
                <span style={{color: '#F22998', fontWeight: 600}}>
                   Repor Urgente
                </span>
              </div>
            </div>

          <div className="kpi-card">
            <div className="card-top">
              <span className="card-label">Contas a Receber</span>
              <div className="icon-box icon-blue">📅</div>
            </div>
            <div className="card-value">
              {kpis?.contasReceberHoje ?
                 new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.contasReceberHoje)
                 : 'R$ 0,00'}
            </div>
             <div className="card-footer">Vencendo hoje</div>
          </div>

          <div className="kpi-card">
            <div className="card-top">
              <span className="card-label">Alertas de Estoque</span>
              <div className="icon-box icon-pink">⚠️</div>
            </div>
            <div className="card-value">{kpis?.produtosBaixoEstoque || 0}</div>
            <div className="card-footer">
              <span className="trend-down">Produtos críticos</span>
            </div>
          </div>

        </div>
      )}
    </MainLayout>
  );
};

export default Dashboard;