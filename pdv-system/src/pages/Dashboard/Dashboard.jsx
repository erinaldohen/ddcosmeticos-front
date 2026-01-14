import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ShoppingBag, Smartphone, CreditCard, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../../services/api';
import AlertasAuditoria from '../../components/Dashboard/AlertasAuditoria';

const Dashboard = () => {
  const navigate = useNavigate();

  // Estado para controlar o momento exato de exibir o gráfico (evita erro de width=-1)
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

    // Pequeno delay para garantir que o CSS Grid/Flex calculou o tamanho da tela
    // antes do Recharts tentar renderizar. Isso corrige o erro visual.
    const timer = setTimeout(() => setIsReady(true), 100);

    return () => clearTimeout(timer);
  }, []);

  const carregarDadosDashboard = async () => {
    try {
      // Tenta buscar o status. Se der 403, o catch captura e define como FECHADO.
      const res = await api.get('/caixa/status');

      if (res.data) {
        const c = res.data;
        // Cálculos de segurança com fallback para 0
        const dinheiro = c.totalVendasDinheiro || 0;
        const pix = c.totalVendasPix || 0;
        const cartao = c.totalVendasCartao || 0;

        setResumo({
          faturamentoTotal: dinheiro + pix + cartao,
          vendasDinheiro: dinheiro,
          vendasPix: pix,
          vendasCartao: cartao,
          caixaStatus: 'ABERTO' // Se a requisição passou, o caixa está aberto/acessível
        });
      }
    } catch (error) {
      // Falha silenciosa ou caixa fechado/sem permissão
      console.warn("Dashboard: Não foi possível carregar dados do caixa (Pode estar fechado ou offline).");
      setResumo(prev => ({ ...prev, caixaStatus: 'FECHADO' }));
    }
  };

  const format = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Dados formatados para o gráfico
  const dadosGrafico = [
    { name: 'Dinheiro', valor: resumo.vendasDinheiro, color: '#10b981' }, // Verde
    { name: 'PIX', valor: resumo.vendasPix, color: '#06b6d4' },      // Ciano
    { name: 'Cartão', valor: resumo.vendasCartao, color: '#f59e0b' },   // Laranja
  ];

  return (
    <div className="dashboard-container fade-in">

      {/* --- CABEÇALHO --- */}
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

      {/* --- 1. GRID DE KPIs (Indicadores) --- */}
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

      {/* --- 2. ÁREA PRINCIPAL --- */}
      <div className="dashboard-grid" style={{ marginTop: '25px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

        {/* COLUNA ESQUERDA: Gráfico e Atalhos */}
        {/* minWidth: 0 é crucial para evitar overflow do gráfico dentro do grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          {/* Gráfico de Composição */}
          <div className="chart-card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Composição da Receita
            </h3>

            {/* CORREÇÃO DO ERRO WIDTH/HEIGHT:
                1. Height fixo em 300px.
                2. Width em 99% (evita bugs de arredondamento de pixels).
                3. Só renderiza quando isReady for true.
            */}
            <div style={{ width: '99%', height: '300px' }}>
              {isReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
                    <Tooltip
                       formatter={(value) => format(value)}
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                       cursor={{ fill: 'transparent' }}
                    />
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

          {/* Atalhos Rápidos */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Acesso Rápido</h3>
             <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
               <button
                  className="btn-confirm success"
                  onClick={() => navigate('/pdv')}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px', minWidth: '120px' }}
               >
                 <ShoppingBag size={18} /> Ir para o PDV
               </button>
               <button
                  className="btn-confirm"
                  onClick={() => navigate('/caixa')}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px', background: '#2563eb', minWidth: '120px' }}
               >
                 <DollarSign size={18} /> Gerir Caixa
               </button>
               <button
                  className="btn-cancel"
                  onClick={() => navigate('/produtos')}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px', minWidth: '120px' }}
               >
                 <ArrowRight size={18} /> Ver Produtos
               </button>
             </div>
          </div>
        </div>

        {/* COLUNA DIREITA: Alertas de Auditoria */}
        <div style={{ minWidth: 0 }}>
          <AlertasAuditoria />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;