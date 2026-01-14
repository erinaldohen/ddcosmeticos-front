import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, Smartphone, CreditCard, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../services/api';
import AlertasAuditoria from '../../components/Dashboard/AlertasAuditoria'; // <--- O componente que criamos antes

const Dashboard = () => {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    vendasDinheiro: 0,
    vendasPix: 0,
    vendasCartao: 0,
    caixaStatus: 'FECHADO'
  });

  useEffect(() => {
    carregarDadosDashboard();
  }, []);

  const carregarDadosDashboard = async () => {
    try {
      const res = await api.get('/caixa/status');

      if (res.status === 200 && res.data) {
        const c = res.data;
        setResumo({
          faturamentoTotal: (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0),
          vendasDinheiro: c.totalVendasDinheiro || 0,
          vendasPix: c.totalVendasPix || 0,
          vendasCartao: c.totalVendasCartao || 0,
          caixaStatus: 'ABERTO'
        });
      } else {
        setResumo(prev => ({ ...prev, caixaStatus: 'FECHADO' }));
      }
    } catch (error) {
      // Falha silenciosa ou caixa fechado (404/204)
      setResumo(prev => ({ ...prev, caixaStatus: 'FECHADO' }));
    }
  };

  const format = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Dados formatados para o gráfico (Recharts)
  const dadosGrafico = [
    { name: 'Dinheiro', valor: resumo.vendasDinheiro, color: '#10b981' },
    { name: 'PIX', valor: resumo.vendasPix, color: '#06b6d4' },
    { name: 'Cartão', valor: resumo.vendasCartao, color: '#f59e0b' },
  ];

  return (
    <div className="dashboard-container fade-in">
      <header className="page-header" style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Resumo do Dia</h1>
          <p className="text-muted">Visão geral do turno atual</p>
        </div>
        <div>
           <span className={`badge ${resumo.caixaStatus === 'ABERTO' ? 'success' : 'danger'}`} style={{fontSize: '0.9rem', padding: '8px 12px'}}>
             Caixa {resumo.caixaStatus}
          </span>
        </div>
      </header>

      {/* 1. GRID DE KPIs (Indicadores) */}
      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-header">
            <label>Faturamento Total</label>
            <ShoppingBag size={24} color="#2563eb" />
          </div>
          <strong>{format(resumo.faturamentoTotal)}</strong>
          <small className="text-muted">Vendas consolidadas hoje</small>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <label>Dinheiro</label>
            <DollarSign size={24} color="#10b981" />
          </div>
          <strong>{format(resumo.vendasDinheiro)}</strong>
          <small className="text-success">Na gaveta</small>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <label>PIX</label>
            <Smartphone size={24} color="#06b6d4" />
          </div>
          <strong>{format(resumo.vendasPix)}</strong>
          <small className="text-info">Conta Digital</small>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <label>Cartões</label>
            <CreditCard size={24} color="#f59e0b" />
          </div>
          <strong>{format(resumo.vendasCartao)}</strong>
          <small className="text-warning">A receber</small>
        </div>
      </div>



      {/* 2. ÁREA PRINCIPAL (Gráfico + Alertas) */}
      <div className="dashboard-grid" style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

        {/* COLUNA ESQUERDA: Gráfico e Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Gráfico de Composição */}
          <div className="chart-card" style={{ height: '300px', padding: '20px' }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Composição da Receita
            </h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={70} />
                <Tooltip
                   formatter={(value) => format(value)}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={30}>
                  {dadosGrafico.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Atalhos Rápidos */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Acesso Rápido</h3>
             <div style={{ display: 'flex', gap: '15px' }}>
               <button
                  className="btn-confirm success"
                  onClick={() => navigate('/pdv')}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
               >
                 <ShoppingBag size={18} /> Ir para o PDV
               </button>
               <button
                  className="btn-confirm"
                  onClick={() => navigate('/caixa')}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px', background: '#2563eb' }}
               >
                 <DollarSign size={18} /> Gerir Caixa
               </button>
               <button
                  className="btn-cancel"
                  onClick={() => navigate('/produtos')}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
               >
                 <ArrowRight size={18} /> Ver Produtos
               </button>
             </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Alertas de Auditoria */}
        <div>
          <AlertasAuditoria />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;