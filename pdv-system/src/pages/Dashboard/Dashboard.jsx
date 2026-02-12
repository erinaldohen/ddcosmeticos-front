import React, { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  DollarSign, ShoppingBag, Users, AlertTriangle,
  Package, TrendingUp, Activity, ShieldAlert,
  ArrowUpRight, Clock
} from 'lucide-react';
import api from '../../services/api';
import './Dashboard.css'; // Importante: Importar o CSS

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  // Funções Auxiliares de Estilo
  const getEventStyle = (tipo) => {
    switch (tipo) {
      case 'ERRO': return { color: 'text-red-600', badge: 'badge-erro', iconColor: '#dc2626' };
      case 'VENDA': return { color: 'text-green-600', badge: 'badge-venda', iconColor: '#059669' };
      case 'ESTOQUE': return { color: 'text-orange-600', badge: 'badge-estoque', iconColor: '#ea580c' };
      case 'LOGIN': return { color: 'text-blue-600', badge: 'badge-login', iconColor: '#2563eb' };
      default: return { color: 'text-gray-600', badge: 'badge-default', iconColor: '#6b7280' };
    }
  };

  const getEventIcon = (tipo) => {
    const color = getEventStyle(tipo).iconColor;
    switch (tipo) {
      case 'ERRO': return <AlertTriangle size={20} color={color} />;
      case 'VENDA': return <DollarSign size={20} color={color} />;
      case 'ESTOQUE': return <Package size={20} color={color} />;
      case 'LOGIN': return <Users size={20} color={color} />;
      default: return <Activity size={20} color={color} />;
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-gray-500">Não foi possível carregar os dados.</div>;

  const financeiro = data.financeiro || { faturamentoHoje: 0, vendasHoje: 0, ticketMedio: 0, graficoVendas: [] };
  const inventario = data.inventario || { produtosVencidos: 0, baixoEstoque: 0 };
  const auditoria = data.auditoria || [];
  const topProdutos = data.topProdutos || [];

  return (
    <div className="dashboard-container">

      {/* HEADER */}
      <div className="dashboard-header">
        <div className="header-title">
          <h1>Visão Geral</h1>
          <p>Resumo estratégico da DD Cosméticos</p>
        </div>
        <div className="last-update">
           <Clock size={14} />
           <span>Atualizado: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI CARDS (Grid Superior) */}
      <div className="kpi-grid">

        {/* Card Faturamento */}
        <div className="kpi-card">
          <div className="kpi-bg-icon"><DollarSign size={80} color="#ec4899" /></div>
          <div>
            <div className="kpi-header-row">
              <div className="kpi-icon-box icon-pink"><DollarSign size={20} /></div>
              <span className="kpi-title">Faturamento Hoje</span>
            </div>
            <h3 className="kpi-value">{formatCurrency(financeiro.faturamentoHoje)}</h3>
          </div>
          <div className="kpi-footer trend-up">
            <TrendingUp size={14} style={{marginRight: 4}} />
            <span>Resumo Diário</span>
          </div>
        </div>

        {/* Card Vendas */}
        <div className="kpi-card">
          <div className="kpi-bg-icon"><ShoppingBag size={80} color="#2563eb" /></div>
          <div>
            <div className="kpi-header-row">
              <div className="kpi-icon-box icon-blue"><ShoppingBag size={20} /></div>
              <span className="kpi-title">Vendas Realizadas</span>
            </div>
            <h3 className="kpi-value">{financeiro.vendasHoje}</h3>
          </div>
          <div className="kpi-footer trend-neutral">
            <span>Tickets emitidos hoje</span>
          </div>
        </div>

        {/* Card Ticket Médio */}
        <div className="kpi-card">
          <div className="kpi-bg-icon"><ArrowUpRight size={80} color="#9333ea" /></div>
          <div>
            <div className="kpi-header-row">
              <div className="kpi-icon-box icon-purple"><ArrowUpRight size={20} /></div>
              <span className="kpi-title">Ticket Médio</span>
            </div>
            <h3 className="kpi-value">{formatCurrency(financeiro.ticketMedio)}</h3>
          </div>
          <div className="kpi-footer trend-up">
            <span>Média por venda</span>
          </div>
        </div>

        {/* Card Estoque */}
        <div className="kpi-card">
          <div className="kpi-bg-icon"><AlertTriangle size={80} color="#ea580c" /></div>
          <div>
            <div className="kpi-header-row">
              <div className="kpi-icon-box icon-orange"><Package size={20} /></div>
              <span className="kpi-title">Estoque Crítico</span>
            </div>
            <h3 className="kpi-value">{inventario.baixoEstoque}</h3>
          </div>
          <div className="kpi-footer trend-down" style={{cursor: 'pointer'}}>
            <span>Ver produtos em baixa</span> <ArrowUpRight size={12} style={{marginLeft: 4}} />
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (Gráfico + Top Produtos) */}
      <div className="main-content-grid">

        {/* Gráfico */}
        <div className="dashboard-section">
          <div className="section-title">
            <Activity size={20} color="#db2777" /> Desempenho de Vendas (Mês)
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financeiro.graficoVendas}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="data"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9ca3af', fontSize: 12}}
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`R$ ${value}`, 'Total']}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#ec4899"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Produtos */}
        <div className="dashboard-section">
          <div className="section-title">
            <ShoppingBag size={20} color="#7c3aed" /> Top Produtos
          </div>
          <div className="product-list">
            {topProdutos.length > 0 ? (
              topProdutos.map((prod, idx) => (
                <div key={idx} className="product-item">
                  <div style={{display: 'flex', alignItems: 'center'}}>
                    <div className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other'}`}>
                      {idx + 1}
                    </div>
                    <div className="product-info">
                      <h4>{prod.produto}</h4>
                      <span>{prod.quantidade} unid.</span>
                    </div>
                  </div>
                  <span className="product-value">{formatCurrency(prod.valorTotal)}</span>
                </div>
              ))
            ) : (
              <p style={{textAlign: 'center', color: '#9ca3af', marginTop: '2rem'}}>Nenhuma venda registrada.</p>
            )}
          </div>
        </div>
      </div>

      {/* AUDITORIA (Timeline) */}
      <div className="dashboard-section">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
          <div className="section-title" style={{marginBottom: 0}}>
            <ShieldAlert size={20} color="#2563eb" /> Auditoria & Segurança
          </div>
          <button className="btn-link">Ver Histórico Completo</button>
        </div>

        <div className="timeline-container">
          <div className="timeline-line"></div>

          <div className="timeline-events">
            {auditoria.length > 0 ? (
              auditoria.map((log, index) => {
                const style = getEventStyle(log.tipoEvento);
                return (
                  <div key={index} className="timeline-item">
                    <div className="timeline-icon">
                      {getEventIcon(log.tipoEvento)}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className={`event-badge ${style.badge}`}>
                          {log.tipoEvento}
                        </span>
                        <div className="timeline-time">
                          <Clock size={12} />
                          {new Date(log.dataHora).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <p className="timeline-msg">{log.mensagem}</p>
                      <div className="timeline-user">
                        <div className="user-avatar">
                          {log.usuarioResponsavel ? log.usuarioResponsavel.charAt(0) : 'S'}
                        </div>
                        <span>Executado por: <strong>{log.usuarioResponsavel || 'Sistema'}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p style={{paddingLeft: '2rem', color: '#9ca3af'}}>Nenhum evento recente.</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;