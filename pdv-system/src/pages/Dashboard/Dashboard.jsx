import React from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <MainLayout>
      {/* Cabeçalho */}
      <div className="page-header">
        <div className="page-title">
          <h1>Painel de Controle</h1>
          <p>Bem-vindo ao sistema DD Cosméticos.</p>
        </div>
        <div className="header-actions">
          <button>+ Novo Pedido</button>
        </div>
      </div>

      {/* Grid de Indicadores */}
      <div className="kpi-grid">

        {/* Card 1: Faturamento (Verde para dinheiro) */}
        <div className="kpi-card">
          <div className="card-top">
            <span className="card-label">Faturamento Hoje</span>
            <div className="icon-box icon-money">💲</div>
          </div>
          <div className="card-value">R$ 2.450,00</div>
          <div className="card-footer">
            <span className="trend-up">▲ 15%</span> a mais que ontem
          </div>
        </div>

        {/* Card 2: Pedidos (Azul neutro) */}
        <div className="kpi-card">
          <div className="card-top">
            <span className="card-label">Pedidos Realizados</span>
            <div className="icon-box icon-blue">📦</div>
          </div>
          <div className="card-value">34</div>
          <div className="card-footer">
            Ticket médio: <strong>R$ 72,00</strong>
          </div>
        </div>

        {/* Card 3: Produtos Críticos (Rosa para alerta/marca) */}
        <div className="kpi-card">
          <div className="card-top">
            <span className="card-label">Estoque Baixo</span>
            <div className="icon-box icon-pink">⚠️</div>
          </div>
          <div className="card-value">8</div>
          <div className="card-footer">
            <span className="trend-down">Reposição Urgente</span>
          </div>
        </div>

      </div>

      {/* Exemplo de uma Seção em Branco para o futuro (Gráficos/Tabelas) */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        border: '1px solid #F0F0F0',
        boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
        minHeight: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#999'
      }}>
        <p>Área reservada para Gráficos de Vendas ou Lista de Últimos Pedidos</p>
      </div>

    </MainLayout>
  );
};

export default Dashboard;