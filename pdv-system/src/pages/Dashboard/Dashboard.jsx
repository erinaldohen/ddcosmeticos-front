import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, Smartphone, CreditCard,
  TrendingUp, TrendingDown, ArrowRight, Tags, Hash, Clock, ListChecks,
  Sparkles, CheckCircle, Info, Inbox
} from 'lucide-react'; // Adicionado Inbox para empty state
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine, Label
} from 'recharts';
import api from '../../services/api';
import './Dashboard.css';

// Componentes
import KPICard from './components/KPICard';
import AuditPanel from './components/AuditPanel';
import ProductRank from './components/ProductRank';

const Dashboard = () => {
  const navigate = useNavigate();
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [loading, setLoading] = useState(true);

  // ESTADO INICIAL VAZIO (Sem Mocks)
  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    vendasDinheiro: 0,
    vendasPix: 0,
    vendasCartao: 0,
    qtdVendas: 0,
    ticketMedio: 0,
    caixaStatus: 'FECHADO',
    metaFaturamento: 2000.00, // Meta fixa ou vinda de config
    metaTicket: 50.00,        // Meta fixa ou vinda de config
    vendasPorHora: [],
    ultimasVendas: [],
    alertasSistema: [],
    topProdutos: []
  });

  const [insightGeral, setInsightGeral] = useState("");

  // Pesos para ordenação da auditoria
  const PRIORIDADE_PESO = { alto: 3, medio: 2, baixo: 1 };

  useEffect(() => {
    carregarDadosDashboard();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) setChartWidth(chartContainerRef.current.offsetWidth - 10);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(handleResize);
    if (chartContainerRef.current) observer.observe(chartContainerRef.current);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!loading && resumo.faturamentoTotal > 0) gerarInsightGeral();
  }, [resumo, loading]);

  const carregarDadosDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/caixa/status');

      if (res.data) {
        const c = res.data;

        // Cálculo de totais caso o backend mande separado
        const total = (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0);
        const quantidade = c.quantidadeVendas || 0;
        const ticket = quantidade > 0 ? (total / quantidade) : 0;

        // Processamento de Alertas Reais (Se houver)
        const alertasReais = c.alertasSistema || [];
        const alertasOrdenados = alertasReais.sort((a, b) =>
            (PRIORIDADE_PESO[b.nivel] || 1) - (PRIORIDADE_PESO[a.nivel] || 1)
        );

        setResumo({
          faturamentoTotal: total,
          vendasDinheiro: c.totalVendasDinheiro || 0,
          vendasPix: c.totalVendasPix || 0,
          vendasCartao: c.totalVendasCartao || 0,
          qtdVendas: quantidade,
          ticketMedio: ticket,
          caixaStatus: c.status || 'FECHADO',
          metaFaturamento: 2000.00,
          metaTicket: 50.00,

          // INTEGRAÇÃO REAL: Se o backend não mandar lista, usa array vazio []
          vendasPorHora: c.vendasPorHora || [],
          ultimasVendas: c.ultimasVendas || [],
          alertasSistema: alertasOrdenados,
          topProdutos: c.topProdutos || []
        });
      }
    } catch (error) {
      console.warn("Dashboard offline ou sem permissão.", error);
      // Mantém tudo zerado em caso de erro
      setResumo(prev => ({ ...prev, caixaStatus: 'FECHADO' }));
    } finally {
        setLoading(false);
    }
  };

  const gerarInsightGeral = () => {
    const { ticketMedio, faturamentoTotal, metaFaturamento } = resumo;
    if (faturamentoTotal >= metaFaturamento) setInsightGeral("🚀 Meta batida! O desempenho hoje está excelente.");
    else if (ticketMedio < 50) setInsightGeral("💡 Oportunidade: O Ticket Médio está baixo. Ofereça combos.");
    else setInsightGeral("📊 Acompanhamento: Vendas estáveis.");
  };

  const format = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const dadosGrafico = [
    { name: 'Dinheiro', valor: resumo.vendasDinheiro, color: '#10b981' },
    { name: 'PIX', valor: resumo.vendasPix, color: '#0ea5e9' },
    { name: 'Cartão', valor: resumo.vendasCartao, color: '#f97316' },
  ];

  const getBadgeClass = (tipo) => {
      if (!tipo) return 'secondary';
      const t = tipo.toUpperCase();
      if (t.includes('PIX')) return 'info';
      if (t.includes('DINHEIRO')) return 'success';
      return 'warning';
  };

  const variacaoFaturamento = resumo.metaFaturamento > 0
    ? ((resumo.faturamentoTotal - resumo.metaFaturamento) / resumo.metaFaturamento) * 100
    : 0;

  const variacaoTicket = resumo.metaTicket > 0
    ? ((resumo.ticketMedio - resumo.metaTicket) / resumo.metaTicket) * 100
    : 0;

  return (
    <div className="dashboard-container fade-in">
      <header className="page-header">
        <div>
          <h1>Visão Geral da Loja</h1>
          <p className="text-muted">Monitoramento em tempo real com análise inteligente</p>
        </div>
        <div>
            {loading ? <div className="skeleton" style={{width: 100, height: 30}}></div> : (
                <span className={`badge ${resumo.caixaStatus === 'ABERTO' ? 'success' : 'danger'}`} style={{padding: '8px 16px'}}>
                    Caixa {resumo.caixaStatus}
                </span>
            )}
        </div>
      </header>

      {/* BOX IA (Só exibe se houver dados para analisar) */}
      {!loading && resumo.faturamentoTotal > 0 && (
          <div className="ai-insight-box">
            <div className="ai-icon"><Sparkles size={24} /></div>
            <div className="ai-content">
              <h4>Inteligência do Negócio</h4>
              <p>{insightGeral}</p>
            </div>
          </div>
      )}

      {/* KPI GRID */}
      <div className="kpi-grid">
        <KPICard
            title="Faturamento Total"
            icon={<ShoppingBag size={24} color="#ffffff" />}
            value={format(resumo.faturamentoTotal)}
            loading={loading}
            className="highlight-revenue"
            progress={resumo.metaFaturamento > 0 ? (resumo.faturamentoTotal/resumo.metaFaturamento)*100 : 0}
            insight={{
                type: variacaoFaturamento >= 0 ? 'positive' : 'negative',
                text: `${Math.abs(variacaoFaturamento).toFixed(1)}% ${variacaoFaturamento >= 0 ? 'acima' : 'abaixo'} da meta`
            }}
        />
        <KPICard title="Qtd. Vendas" icon={<Hash size={24} color="#8b5cf6" />} value={resumo.qtdVendas} loading={loading}
            insight={{type: 'neutral', text: 'Fluxo em tempo real'}} />

        <KPICard title="Ticket Médio" icon={<Tags size={24} color="#ec4899" />} value={format(resumo.ticketMedio)} loading={loading}
            insight={{type: variacaoTicket >= 0 ? 'positive' : 'negative', text: `Meta: ${format(resumo.metaTicket)}`}} />

        <KPICard title="Dinheiro" icon={<DollarSign size={24} color="#10b981" />} value={format(resumo.vendasDinheiro)} loading={loading} />
        <KPICard title="PIX" icon={<Smartphone size={24} color="#0ea5e9" />} value={format(resumo.vendasPix)} loading={loading} />
        <KPICard title="Cartões" icon={<CreditCard size={24} color="#f97316" />} value={format(resumo.vendasCartao)} loading={loading} />
      </div>

      {/* MAIN GRID */}
      <div className="dashboard-grid">
        {/* ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', minWidth: 0 }}>

          {/* Gráfico Composição */}
          <div className="chart-card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} /> Composição da Receita
            </h3>
            <div ref={chartContainerRef} style={{ width: '100%', height: '250px', position: 'relative', overflow: 'hidden' }}>
              {chartWidth > 0 && !loading ? (
                <BarChart width={chartWidth} height={250} data={dadosGrafico} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 12}} />
                    <Tooltip formatter={(value) => format(value)} cursor={{ fill: 'transparent' }} contentStyle={{ zIndex: 1000, borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={30}>
                        {dadosGrafico.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Bar>
                    <ReferenceLine x={resumo.metaFaturamento / 3} stroke="red" strokeDasharray="3 3">
                        <Label value="Média" position="insideTopRight" fill="red" fontSize={10} />
                    </ReferenceLine>
                </BarChart>
              ) : <div className="skeleton skeleton-box"></div>}
            </div>
          </div>

          {/* Gráfico Fluxo Horário */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Clock size={18} /> Fluxo de Vendas (Horário)
             </h3>
             <div style={{ width: '100%', height: '220px' }}>
                {chartWidth > 0 && !loading ? (
                   resumo.vendasPorHora.length > 0 ? (
                      <AreaChart width={chartWidth} height={220} data={resumo.vendasPorHora} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorHora" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hora" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(val) => format(val)} />
                        <Area type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorHora)" />
                      </AreaChart>
                   ) : (
                     <div className="empty-state-container" style={{height:'100%', minHeight:'auto', border:'none'}}>
                         <Info size={24} color="#cbd5e1"/>
                         <span className="empty-subtext">Sem dados de fluxo ainda.</span>
                     </div>
                   )
                ) : <div className="skeleton skeleton-box"></div>}
             </div>
          </div>

          {/* TOP PRODUTOS (REAL) */}
          <ProductRank loading={loading} produtos={resumo.topProdutos} formatCurrency={format} />

          {/* Últimas Transações */}
          <div className="chart-card" style={{ padding: '0px', overflow: 'hidden' }}>
             <div style={{ padding: '20px 20px 10px 20px', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <ListChecks size={18} /> Últimas Transações
                </h3>
             </div>

             {loading ? (
                 <div style={{padding: 20}}><div className="skeleton skeleton-text"></div></div>
             ) : resumo.ultimasVendas.length > 0 ? (
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: '#f8fafc', color: '#64748b' }}>
                       <tr>
                          <th style={{ padding: '12px 20px', textAlign: 'left', fontWeight: 600 }}>Hora</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Pagamento</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600 }}>Valor</th>
                       </tr>
                    </thead>
                    <tbody>
                       {resumo.ultimasVendas.map((venda, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                             <td style={{ padding: '12px 20px', color: '#334155' }}>{venda.hora || '--:--'}</td>
                             <td style={{ padding: '12px' }}>
                                <span className={`badge ${getBadgeClass(venda.tipo)}`} style={{fontSize: '0.7rem', padding: '4px 8px'}}>
                                   {venda.tipo}
                                </span>
                             </td>
                             <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                {format(venda.valor)}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
             ) : (
                <div className="empty-state-container" style={{border:'none'}}>
                    <Inbox size={32} className="empty-icon" />
                    <span className="empty-subtext">Nenhuma transação recente.</span>
                </div>
             )}
          </div>
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', minWidth: 0 }}>
          {/* Acesso Rápido */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Acesso Rápido</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <button className="btn-confirm success" onClick={() => navigate('/pdv')} style={{ justifyContent:'center' }}>
                 <ShoppingBag size={18} /> Abrir PDV
               </button>
               <button className="btn-confirm" onClick={() => navigate('/caixa')} style={{ background: '#2563eb', justifyContent:'center' }}>
                 <DollarSign size={18} /> Gerenciar Caixa
               </button>
               <button className="btn-cancel" onClick={() => navigate('/produtos')} style={{ justifyContent:'center' }}>
                 <ArrowRight size={18} /> Catálogo de Produtos
               </button>
             </div>
          </div>

          {/* Auditoria Real */}
          <AuditPanel loading={loading} alertas={resumo.alertasSistema} onNavigate={() => navigate('/auditoria')} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;