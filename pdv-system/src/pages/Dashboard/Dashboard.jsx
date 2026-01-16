import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, Smartphone, CreditCard, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../services/api';
import AlertasAuditoria from '../../components/Dashboard/AlertasAuditoria';

const Dashboard = () => {
  const navigate = useNavigate();

  // TRAVA DE SEGURANÇA: Controla se o gráfico pode ser renderizado
  const [chartEnabled, setChartEnabled] = useState(false);

  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    vendasDinheiro: 0,
    vendasPix: 0,
    vendasCartao: 0,
    caixaStatus: 'FECHADO'
  });

  useEffect(() => {
    carregarDadosDashboard();

    // TRUQUE DO DOUBLE-FRAME:
    // requestAnimationFrame garante que o navegador terminou o "paint" do CSS
    // antes de deixarmos o Recharts tentar calcular o tamanho.
    const timer = requestAnimationFrame(() => {
      setTimeout(() => {
        setChartEnabled(true);
      }, 200); // Pequeno delay extra por segurança
    });

    return () => cancelAnimationFrame(timer);
  }, []);

  const carregarDadosDashboard = async () => {
    try {
      const res = await api.get('/caixa/status');
      if (res.data) {
        const c = res.data;
        const dinheiro = c.totalVendasDinheiro || 0;
        const pix = c.totalVendasPix || 0;
        const cartao = c.totalVendasCartao || 0;

        setResumo({
          faturamentoTotal: dinheiro + pix + cartao,
          vendasDinheiro: dinheiro,
          vendasPix: pix,
          vendasCartao: cartao,
          caixaStatus: 'ABERTO'
        });
      }
    } catch (error) {
      console.warn("Dashboard offline ou sem permissão.");
      setResumo(prev => ({ ...prev, caixaStatus: 'FECHADO' }));
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

      {/* MAIN GRID */}
      <div className="dashboard-grid" style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

        {/* COLUNA ESQUERDA - CORREÇÃO CRÍTICA 1: minWidth: 0 e overflow: hidden */}
        {/* Isso impede que o Grid calcule errado o tamanho da coluna */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, overflow: 'hidden' }}>

          <div className="chart-card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Composição da Receita
            </h3>

            {/* CORREÇÃO CRÍTICA 2: Wrapper com tamanho FIXO em pixels para altura */}
            <div style={{ width: '100%', height: '300px', position: 'relative' }}>
              {chartEnabled ? (
                // ResponsiveContainer precisa de um pai com tamanho definido
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
                    <Tooltip
                        formatter={(value) => format(value)}
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ zIndex: 1000 }} // Garante que o tooltip fique por cima
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={30}>
                        {dadosGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                    </BarChart>
                </ResponsiveContainer>
              ) : (
                // Placeholder enquanto o layout carrega
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f8fafc', borderRadius: '8px', color: '#94a3b8'
                }}>
                  Carregando gráfico...
                </div>
              )}
            </div>
          </div>

          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Acesso Rápido</h3>
             <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
               <button className="btn-confirm success" onClick={() => navigate('/pdv')} style={{ flex: 1, minWidth: '120px' }}>
                 <ShoppingBag size={18} /> PDV
               </button>
               <button className="btn-confirm" onClick={() => navigate('/caixa')} style={{ flex: 1, background: '#2563eb', minWidth: '120px' }}>
                 <DollarSign size={18} /> Caixa
               </button>
               <button className="btn-cancel" onClick={() => navigate('/produtos')} style={{ flex: 1, minWidth: '120px' }}>
                 <ArrowRight size={18} /> Produtos
               </button>
             </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ minWidth: 0 }}>
          <AlertasAuditoria />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;