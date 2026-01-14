import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, Smartphone, CreditCard, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../services/api';
import AlertasAuditoria from '../../components/Dashboard/AlertasAuditoria';

const Dashboard = () => {
  const navigate = useNavigate();
  // Estado para controlar o momento exato de exibir o gráfico
  const [isReady, setIsReady] = useState(false);

  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    vendasDinheiro: 0,
    vendasPix: 0,
    vendasCartao: 0,
    caixaStatus: 'FECHADO'
  });

  useEffect(() => {
    carregarDadosDashboard();

    // Espera 100ms para o CSS Grid se ajustar antes de tentar desenhar o gráfico
    // Isso resolve o erro "width(-1)"
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const carregarDadosDashboard = async () => {
    try {
      const res = await api.get('/caixa/status');
      if (res.data) {
        const c = res.data;
        setResumo({
          faturamentoTotal: (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0),
          vendasDinheiro: c.totalVendasDinheiro || 0,
          vendasPix: c.totalVendasPix || 0,
          vendasCartao: c.totalVendasCartao || 0,
          caixaStatus: 'ABERTO'
        });
      }
    } catch (error) {
      // Loga o erro mas não quebra a tela
      console.warn("Dashboard offline:", error.response?.status);
    }
  };

  const format = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const dadosGrafico = [
    { name: 'Dinheiro', valor: resumo.vendasDinheiro, color: '#10b981' },
    { name: 'PIX', valor: resumo.vendasPix, color: '#06b6d4' },
    { name: 'Cartão', valor: resumo.vendasCartao, color: '#f59e0b' },
  ];

  return (
    <div className="dashboard-container fade-in">
      {/* HEADER E KPIS MANTIDOS IGUAIS ... */}
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

      {/* KPI GRID */}
      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-header"><label>Faturamento Total</label><ShoppingBag size={24} color="#2563eb" /></div>
          <strong>{format(resumo.faturamentoTotal)}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-header"><label>Dinheiro</label><DollarSign size={24} color="#10b981" /></div>
          <strong>{format(resumo.vendasDinheiro)}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-header"><label>PIX</label><Smartphone size={24} color="#06b6d4" /></div>
          <strong>{format(resumo.vendasPix)}</strong>
        </div>
        <div className="kpi-card">
          <div className="kpi-header"><label>Cartões</label><CreditCard size={24} color="#f59e0b" /></div>
          <strong>{format(resumo.vendasCartao)}</strong>
        </div>
      </div>

      <div className="dashboard-grid" style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          <div className="chart-card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Composição da Receita
            </h3>

            {/* CORREÇÃO DO WIDTH/HEIGHT: Só renderiza quando isReady for true */}
            <div style={{ width: '99%', height: '300px' }}>
              {isReady && (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => format(value)} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={30}>
                        {dadosGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Acesso Rápido</h3>
             <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
               <button className="btn-confirm success" onClick={() => navigate('/pdv')} style={{ flex: 1 }}>
                 <ShoppingBag size={18} /> PDV
               </button>
               <button className="btn-confirm" onClick={() => navigate('/caixa')} style={{ flex: 1, background: '#2563eb' }}>
                 <DollarSign size={18} /> Caixa
               </button>
             </div>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <AlertasAuditoria />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;