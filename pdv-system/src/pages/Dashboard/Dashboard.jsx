import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './Dashboard.css';

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const nomeUsuario = localStorage.getItem('usuarioNome') || 'Gerente';

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const response = await api.get('/dashboard/resumo');
      setKpis(response.data);
    } catch (error) {
      console.error("Erro dashboard:", error);
      toast.error("Não foi possível atualizar os indicadores.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <> {/* Removido o MainLayout - agora controlado pelo App.jsx */}
      <div className="page-header">
        <div className="page-title">
          <h1>Visão Geral</h1>
          <p>Olá, <strong>{nomeUsuario}</strong>. Aqui está o resumo de hoje.</p>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={carregarDados} title="Atualizar dados">↻ Atualizar</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Carregando indicadores...</p>
        </div>
      ) : (
        <div className="kpi-grid">

          {/* CARD 01: ALERTAS CRÍTICOS */}
          <div className="kpi-card alert-border">
              <div className="card-top">
                <span className="card-label">Produtos Críticos</span>
                <div className="icon-box icon-alert">⚡</div>
              </div>
              <div className="card-value">{kpis?.produtosBaixoEstoque || 0}</div>
              <div className="card-footer">
                <span style={{color: '#F22998', fontWeight: 600}}>
                   Ação Necessária
                </span>
              </div>
          </div>

          {/* CARD 02: FINANCEIRO */}
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
             <div className="card-footer">Previsão para hoje</div>
          </div>

          {/* CARD 03: VENDAS DO DIA (Sugestão de novo KPI) */}
          <div className="kpi-card">
            <div className="card-top">
              <span className="card-label">Vendas Realizadas</span>
              <div className="icon-box icon-pink">🛍️</div>
            </div>
            <div className="card-value">{kpis?.totalVendasHoje || 0}</div>
            <div className="card-footer">
              <span className="trend-up">Acompanhamento diário</span>
            </div>
          </div>

        </div>
      )}
    </>
  );
};

export default Dashboard;