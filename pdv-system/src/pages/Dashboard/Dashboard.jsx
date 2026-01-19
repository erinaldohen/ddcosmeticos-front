import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, Smartphone, CreditCard, TrendingUp, ArrowRight } from 'lucide-react';
// REMOVIDO: ResponsiveContainer (Causa do erro)
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import api from '../../services/api';
import AlertasAuditoria from '../../components/Dashboard/AlertasAuditoria';

const Dashboard = () => {
  const navigate = useNavigate();

  // REFERÊNCIA PARA MEDIR O TAMANHO REAL
  const chartContainerRef = useRef(null);

  // ESTADO PARA LARGURA DO GRÁFICO (Manual)
  const [chartWidth, setChartWidth] = useState(0);

  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    vendasDinheiro: 0,
    vendasPix: 0,
    vendasCartao: 0,
    caixaStatus: 'FECHADO'
  });

  // 1. CARREGAMENTO DE DADOS
  useEffect(() => {
    carregarDadosDashboard();
  }, []);

  // 2. LÓGICA MANUAL DE RESPONSIVIDADE (INFALÍVEL)
  // Substitui o ResponsiveContainer que estava dando erro
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) {
        // Pega a largura exata da div pai e desconta padding se necessário
        setChartWidth(chartContainerRef.current.offsetWidth - 10);
      }
    };

    // Mede na inicialização
    handleResize();

    // Mede se a tela mudar de tamanho
    window.addEventListener('resize', handleResize);

    // Observer para detectar mudanças no Grid (caso o menu lateral abra/feche)
    const observer = new ResizeObserver(handleResize);
    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
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

        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          <div className="chart-card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Composição da Receita
            </h3>

            {/* CONTAINER REF: Aqui medimos o tamanho */}
            <div
                ref={chartContainerRef}
                style={{ width: '100%', height: '300px', minHeight: '300px', position: 'relative', overflow: 'hidden' }}
            >
              {chartWidth > 0 ? (
                // LÓGICA MANUAL: Passamos o width exato em pixels.
                // Isso impede que o Recharts tente adivinhar e calcule -1.
                <BarChart
                    width={chartWidth}
                    height={300}
                    data={dadosGrafico}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
                    <Tooltip
                        formatter={(value) => format(value)}
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ zIndex: 1000, borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={30}>
                        {dadosGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
              ) : (
                // LOADING: Se a largura for 0 (carregando), mostra spinner
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f8fafc', borderRadius: '8px', color: '#94a3b8'
                }}>
                  <div className="spinner-border text-primary" role="status" style={{marginRight: 10, width: '1.5rem', height: '1.5rem'}}></div>
                  <span>Carregando gráfico...</span>
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