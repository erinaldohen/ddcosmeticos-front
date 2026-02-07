import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, TrendingUp, Tags, Hash, ListChecks,
  Sparkles, Info, Inbox, PieChart as PieIcon
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../../services/api';
import './Dashboard.css';

// Componentes (Assumindo que existem na pasta components)
import KPICard from './components/KPICard';
import AuditPanel from './components/AuditPanel';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes');

  // ESTADO INICIAL
  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    qtdVendas: 0,
    ticketMedio: 0,
    metaFaturamento: 2000.00,
    graficoVendas: [],
    graficoPagamentos: [],
    ultimasVendas: [],
    topProdutos: []
  });

  const [insightGeral, setInsightGeral] = useState("Analisando dados...");

  useEffect(() => {
    carregarDadosDashboard();
  }, []);

  // --- HELPER DE FORMATAÇÃO ---
  const format = (val) => {
      const num = Number(val);
      return isNaN(num) ? "R$ 0,00" : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // --- TOOLTIP CUSTOMIZADO ---
  const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
          const dadosOriginais = payload[0].payload;
          const valor = dadosOriginais.valor ?? payload[0].value ?? 0;

          return (
              <div className="custom-tooltip-chart">
                  <p className="tooltip-label">Dia: {label}</p>
                  <p className="tooltip-value">
                      Faturado: <span>{format(valor)}</span>
                  </p>
              </div>
          );
      }
      return null;
  };

  // --- LÓGICA DE DADOS ---
  const dadosProcessados = useMemo(() => {
      const safeNumber = (val) => {
          if (val === null || val === undefined) return 0;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
              if (val.includes(',')) return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
              return parseFloat(val) || 0;
          }
          return 0;
      };

      // 1. Processa Vendas Diárias
      const todasVendas = (resumo.graficoVendas || []).map((item, index) => ({
          data: String(item.data || item.dataVenda || item.dia || (index + 1)),
          valor: safeNumber(item.valor ?? item.total ?? item.valorTotal ?? item.faturamento)
      }));

      // 2. Filtra Período
      let vendasFiltradas = todasVendas;
      if (todasVendas.length > 0) {
          if (filtroPeriodo === '7dias') vendasFiltradas = todasVendas.slice(-7);
          else if (filtroPeriodo === '15dias') vendasFiltradas = todasVendas.slice(-15);
      }

      // 3. Processa Pagamentos
      const pagamentos = (resumo.graficoPagamentos || []).map(item => ({
          formaPagamento: item.formaPagamento || item.tipo || 'Outros',
          valor: safeNumber(item.valor ?? item.total ?? item.amount ?? 0)
      }));

      // 4. Trends (Cálculo de tendência vs média do período)
      const diasComVenda = todasVendas.filter(d => d.valor > 0).length || 1;
      const totalMes = todasVendas.reduce((acc, curr) => acc + curr.valor, 0);
      const mediaDiaria = totalMes / diasComVenda;
      const baseFat = mediaDiaria > 0 ? mediaDiaria : 1;
      const varFat = ((resumo.faturamentoTotal - baseFat) / baseFat) * 100;
      const varQtd = varFat * 0.8; // Estimativa simples para qtd

      return {
          vendas: vendasFiltradas,
          pagamentos: pagamentos,
          trends: {
              fat: { value: Math.abs(varFat).toFixed(1), isPositive: varFat >= 0, label: 'vs. média' },
              qtd: { value: Math.abs(varQtd).toFixed(1), isPositive: varQtd >= 0, label: 'vs. média' },
              ticket: { value: '0.0', isPositive: true, isNeutral: true, label: 'estável' }
          },
          maxVal: resumo.topProdutos.length > 0 ? Math.max(...resumo.topProdutos.map(p => safeNumber(p.valorTotal))) : 1
      };
  }, [resumo, filtroPeriodo]);

  // Atualiza insight ao mudar dados
  useEffect(() => {
    if (!loading) gerarInsightGeral();
  }, [resumo, loading]);

  const carregarDadosDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard');
      const d = res.data;
      if (d) {
        setResumo({
          faturamentoTotal: d.faturamentoHoje || 0,
          qtdVendas: d.vendasHoje || 0,
          ticketMedio: d.ticketMedioMes || 0,
          metaFaturamento: 2000.00,
          graficoVendas: d.graficoVendas || [],
          graficoPagamentos: d.graficoPagamentos || [],
          ultimasVendas: d.ultimasVendas || [],
          topProdutos: d.rankingProdutos || []
        });
      }
    } catch (error) {
      console.warn("Erro dashboard (usando dados zerados):", error);
    } finally {
        setLoading(false);
    }
  };

  const gerarInsightGeral = () => {
    const { ticketMedio, faturamentoTotal, metaFaturamento, qtdVendas } = resumo;
    if (qtdVendas === 0) setInsightGeral("Loja aberta. Aguardando a primeira venda do dia.");
    else if (faturamentoTotal >= metaFaturamento) setInsightGeral("🚀 Meta batida! O desempenho de hoje está excelente.");
    else setInsightGeral(`📊 Faltam ${format(metaFaturamento - faturamentoTotal)} para atingir a meta diária.`);
  };

  const COLORS_PIE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  const getBadgeClass = (tipo) => {
      const t = String(tipo || '').toUpperCase();
      if (t.includes('PIX')) return 'info';
      if (t.includes('DINHEIRO')) return 'success';
      if (t.includes('CREDITO') || t.includes('DEBITO')) return 'warning';
      return 'secondary';
  };

  const getRankClass = (i) => {
      if (i === 0) return 'gold';
      if (i === 1) return 'silver';
      if (i === 2) return 'bronze';
      return 'default';
  };

  const temDadosVendas = dadosProcessados.vendas && dadosProcessados.vendas.length > 0;
  const temDadosPagamentos = dadosProcessados.pagamentos && dadosProcessados.pagamentos.length > 0;

  return (
    <div className="dashboard-container fade-in">
      <header className="page-header">
        <div>
            <h1>Visão Geral</h1>
            <p className="text-muted">Acompanhamento em tempo real</p>
        </div>
        <div>
            {!loading && <span className="badge success" style={{padding: '8px 16px', fontSize:'0.85rem'}}>Loja Aberta</span>}
        </div>
      </header>

      {/* Caixa de Insight IA */}
      <div className="ai-insight-box">
        <div className="ai-icon"><Sparkles size={24} /></div>
        <div className="ai-content">
            <h4>Análise Inteligente</h4>
            <p>{insightGeral}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard title="Faturamento Hoje" icon={<ShoppingBag size={24} color="#ffffff" />} value={format(resumo.faturamentoTotal)} loading={loading} className="highlight-revenue" trend={dadosProcessados.trends.fat} />
        <KPICard title="Vendas Realizadas" icon={<Hash size={24} color="#8b5cf6" />} value={resumo.qtdVendas} loading={loading} trend={dadosProcessados.trends.qtd} />
        <KPICard title="Ticket Médio" icon={<Tags size={24} color="#ec4899" />} value={format(resumo.ticketMedio)} loading={loading} trend={dadosProcessados.trends.ticket} />
      </div>

      <div className="dashboard-grid">

        {/* COLUNA ESQUERDA (2/3) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', flex: 2, minWidth: 0 }}>

          {/* GRÁFICO EVOLUÇÃO */}
          <div className="chart-card" style={{ padding: '24px' }}>
            <div className="chart-header-row">
                <h3 className="chart-title"><TrendingUp size={20} /> Evolução de Vendas</h3>
                <div className="filter-group">
                    <button className={`filter-btn ${filtroPeriodo === '7dias' ? 'active' : ''}`} onClick={() => setFiltroPeriodo('7dias')}>7 Dias</button>
                    <button className={`filter-btn ${filtroPeriodo === '15dias' ? 'active' : ''}`} onClick={() => setFiltroPeriodo('15dias')}>15 Dias</button>
                    <button className={`filter-btn ${filtroPeriodo === 'mes' ? 'active' : ''}`} onClick={() => setFiltroPeriodo('mes')}>Mês</button>
                </div>
            </div>

            <div className="chart-wrapper">
              {loading ? <div className="skeleton skeleton-box"></div> :
                temDadosVendas ? (
                    <ResponsiveContainer width="99%" height={300}>
                        <AreaChart data={dadosProcessados.vendas} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="data"
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `R$${val}`}
                                tick={{ fontSize: 11, fill: '#64748b' }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="valor" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVendas)" animationDuration={1000} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : <div className="empty-state-container"><Info size={32} /><span className="empty-subtext">Sem dados no período.</span></div>
              }
            </div>
          </div>

          {/* TOP PRODUTOS */}
          <div className="chart-card" style={{ padding: '24px' }}>
             <h3 style={{ marginBottom: '20px' }}>Top Produtos Mais Vendidos</h3>
             {loading ? <div className="skeleton skeleton-text"></div> : (
               <ul className="ranking-list">
                  {resumo.topProdutos.map((p, i) => (
                      <li key={i} className="ranking-item">
                          <div className={`rank-medal ${getRankClass(i)}`}>{i + 1}</div>
                          <div className="rank-info">
                              <span className="rank-name">{p.produto || p.marca || 'Produto'}</span>
                              <div className="rank-bar-bg">
                                  <div className="rank-bar-fill" style={{ width: `${((p.valorTotal || 0) / dadosProcessados.maxVal) * 100}%` }}></div>
                              </div>
                          </div>
                          <div className="rank-stats">
                              <span className="rank-value">{format(p.valorTotal)}</span>
                              <span className="rank-qty">{p.quantidade} {p.unidade || 'UN'}</span>
                          </div>
                      </li>
                  ))}
                  {resumo.topProdutos.length === 0 && <div className="empty-state-container"><span className="empty-subtext">Nenhum produto vendido hoje.</span></div>}
               </ul>
             )}
          </div>

           {/* ÚLTIMAS TRANSAÇÕES */}
           <div className="chart-card" style={{ padding: '0px', overflow: 'hidden' }}>
             <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background:'#fafafa' }}>
                <h3 style={{ margin: 0 }}><ListChecks size={20} /> Transações Recentes</h3>
             </div>
             {loading ? <div style={{padding: 20}}><div className="skeleton skeleton-text"></div></div> :
               resumo.ultimasVendas.length > 0 ? (
                 <div className="table-container">
                     <table className="table-fixed">
                        <thead>
                           <tr style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'left', textTransform:'uppercase' }}>
                              <th className="col-cliente">Cliente</th>
                              <th className="col-metodo">Método</th>
                              <th className="col-valor">Valor</th>
                           </tr>
                        </thead>
                        <tbody>
                           {resumo.ultimasVendas.map((venda, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                 <td className="col-cliente">
                                     <div style={{fontWeight:600, color:'#334155'}}>#{venda.id}</div>
                                     <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{venda.clienteNome || 'Consumidor Final'}</div>
                                 </td>
                                 <td className="col-metodo">
                                    <div style={{display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap'}}>
                                        {venda.pagamentos && venda.pagamentos.length > 0 ? (
                                            venda.pagamentos.map((pag, pIdx) => (
                                                <span key={pIdx} className={`badge ${getBadgeClass(pag.formaPagamento)}`}>{pag.formaPagamento}</span>
                                            ))
                                        ) : <span className="badge secondary">ND</span>}
                                    </div>
                                 </td>
                                 <td className="col-valor" style={{fontWeight: 700, color: '#0f172a'}}>{format(venda.valorTotal)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                 </div>
             ) : <div className="empty-state-container"><Inbox size={32} className="empty-icon" /><span className="empty-subtext">Nenhuma transação recente.</span></div>}
          </div>
        </div>

        {/* COLUNA DIREITA (1/3) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', flex: 1, minWidth: 0 }}>

          {/* GRÁFICO PAGAMENTOS */}
          <div className="chart-card" style={{ padding: '24px' }}>
             <h3 style={{ marginBottom: '5px' }}><PieIcon size={20} style={{marginRight:8}}/> Meios de Pagamento</h3>
             <p className="text-muted" style={{marginBottom:'20px', fontSize:'0.85rem'}}>Distribuição percentual</p>

             <div className="chart-wrapper">
                {loading ? <div className="skeleton skeleton-box"></div> :
                    temDadosPagamentos ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dadosProcessados.pagamentos}
                                    cx="50%" cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="valor"
                                    nameKey="formaPagamento"
                                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                        const x = cx + (outerRadius + 20) * Math.cos(-midAngle * (Math.PI / 180));
                                        const y = cy + (outerRadius + 20) * Math.sin(-midAngle * (Math.PI / 180));
                                        return percent > 0.05 ? (
                                            <text x={x} y={y} fill="#334155" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{fontSize: '11px', fontWeight:'700'}}>
                                                {`${(percent * 100).toFixed(0)}%`}
                                            </text>
                                        ) : null;
                                    }}
                                >
                                    {dadosProcessados.pagamentos.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val) => format(val)} contentStyle={{borderRadius:'8px'}} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state-container"><Info size={32} className="empty-icon"/><span className="empty-subtext">Sem dados de pagamento.</span></div>
                }
             </div>

             {/* ANÁLISE IA - Insight de Pagamento */}
             {temDadosPagamentos && (
                 <div style={{marginTop: 15, padding: 12, background:'#f0fdf4', borderRadius: 8, fontSize:'0.85rem', color:'#166534', display:'flex', gap:8, alignItems:'flex-start'}}>
                     <Sparkles size={16} style={{marginTop:2, flexShrink:0}} />
                     <span>
                        <strong>Insight:</strong> O método
                        {(() => {
                            if (dadosProcessados.pagamentos.length > 0) {
                                const max = dadosProcessados.pagamentos.reduce((p, c) => (p.valor > c.valor ? p : c));
                                return ` ${max.formaPagamento} `;
                            }
                            return ' Principal ';
                        })()}
                        é o favorito dos clientes hoje.
                     </span>
                 </div>
             )}
          </div>

          <AuditPanel loading={loading} alertas={[]} onNavigate={() => navigate('/auditoria')} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;