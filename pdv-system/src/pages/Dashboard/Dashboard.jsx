import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, Smartphone, CreditCard,
  TrendingUp, ArrowRight, Tags, Hash, ListChecks,
  Sparkles, Info, Inbox
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../../services/api';
import './Dashboard.css';

// Componentes
import KPICard from './components/KPICard';
import AuditPanel from './components/AuditPanel';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // ESTADO INICIAL
  const [resumo, setResumo] = useState({
    faturamentoTotal: 0,
    vendasDinheiro: 0,
    vendasPix: 0,
    vendasCartao: 0,
    qtdVendas: 0,
    ticketMedio: 0,
    metaFaturamento: 2000.00,
    metaTicket: 50.00,
    graficoVendas: [],
    graficoPagamentos: [],
    ultimasVendas: [],
    topProdutos: [],
    alertasSistema: []
  });

  const [insightGeral, setInsightGeral] = useState("");

  useEffect(() => {
    carregarDadosDashboard();
  }, []);

  useEffect(() => {
    if (!loading && resumo.faturamentoTotal > 0) gerarInsightGeral();
  }, [resumo, loading]);

  const carregarDadosDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard');
      console.log("DADOS REAIS BACKEND:", res.data);

      if (res.data) {
        const d = res.data;
        const listaPagamentos = d.graficoPagamentos || [];

        // --- LÓGICA DE SOMA ROBUSTA ---
        const somaPorTipo = (termos) => {
            return listaPagamentos
                .filter(p => {
                    const tipo = String(p.tipo || '').toUpperCase();
                    return termos.some(t => tipo.includes(t));
                })
                .reduce((acc, curr) => acc + (curr.valor || 0), 0);
        };

        const totalDinheiro = somaPorTipo(['DINHEIRO']);
        const totalPix = somaPorTipo(['PIX']);
        const totalCartao = somaPorTipo(['CREDITO', 'DEBITO', 'CARTAO', 'CREDIARIO']);

        setResumo({
          faturamentoTotal: d.faturamentoHoje || 0,
          qtdVendas: d.vendasHoje || 0,
          ticketMedio: d.ticketMedioMes || 0,

          vendasDinheiro: totalDinheiro,
          vendasPix: totalPix,
          vendasCartao: totalCartao,

          metaFaturamento: 2000.00,
          metaTicket: 50.00,

          graficoVendas: d.graficoVendas || [],
          graficoPagamentos: listaPagamentos,
          ultimasVendas: d.ultimasVendas || [],
          topProdutos: d.rankingProdutos || [],
          alertasSistema: []
        });
      }
    } catch (error) {
      console.warn("Erro ao carregar dashboard:", error);
    } finally {
        setLoading(false);
    }
  };

  const gerarInsightGeral = () => {
    const { ticketMedio, faturamentoTotal, metaFaturamento } = resumo;
    if (faturamentoTotal >= metaFaturamento) setInsightGeral("🚀 Meta batida! O desempenho hoje está excelente.");
    else if (ticketMedio < 50) setInsightGeral("💡 Oportunidade: O Ticket Médio está baixo. Ofereça combos.");
    else setInsightGeral("📊 Acompanhamento: Vendas fluindo.");
  };

  const format = (val) => {
      const num = Number(val);
      return isNaN(num) ? "R$ 0,00" : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const COLORS_PIE = ['#10b981', '#0ea5e9', '#f97316', '#8b5cf6', '#ec4899'];

  const getBadgeClass = (tipo) => {
      if (!tipo) return 'secondary';
      const t = String(tipo).toUpperCase();
      if (t.includes('PIX')) return 'info';
      if (t.includes('DINHEIRO')) return 'success';
      if (t.includes('CREDITO') || t.includes('DEBITO')) return 'warning';
      return 'secondary';
  };

  // --- NOVA LÓGICA DE VALIDAÇÃO VISUAL ---
  // Verifica se existe algum valor > 0 no gráfico de vendas.
  // Como o backend preenche dias vazios com 0, apenas checar o tamanho do array não funciona.
  const temDadosVendas = resumo.graficoVendas && resumo.graficoVendas.some(item => item.valor > 0);

  // Verifica se tem pagamentos
  const temDadosPagamentos = resumo.graficoPagamentos && resumo.graficoPagamentos.length > 0;

  return (
    <div className="dashboard-container fade-in">
      <header className="page-header">
        <div>
          <h1>Visão Geral</h1>
          <p className="text-muted">Acompanhamento em tempo real</p>
        </div>
        <div>
            {!loading && <span className="badge success" style={{padding: '8px 16px'}}>Loja Aberta</span>}
        </div>
      </header>

      {/* KPI GRID */}
      <div className="kpi-grid">
        <KPICard
            title="Faturamento Hoje"
            icon={<ShoppingBag size={24} color="#ffffff" />}
            value={format(resumo.faturamentoTotal)}
            loading={loading}
            className="highlight-revenue"
        />
        <KPICard title="Vendas Hoje" icon={<Hash size={24} color="#8b5cf6" />} value={resumo.qtdVendas} loading={loading} />
        <KPICard title="Ticket Médio" icon={<Tags size={24} color="#ec4899" />} value={format(resumo.ticketMedio)} loading={loading} />

        <KPICard title="Dinheiro" icon={<DollarSign size={24} color="#10b981" />} value={format(resumo.vendasDinheiro)} loading={loading} />
        <KPICard title="PIX" icon={<Smartphone size={24} color="#0ea5e9" />} value={format(resumo.vendasPix)} loading={loading} />
        <KPICard title="Cartões" icon={<CreditCard size={24} color="#f97316" />} value={format(resumo.vendasCartao)} loading={loading} />
      </div>

      <div className="dashboard-grid">
        {/* COLUNA ESQUERDA (GRÁFICO E LISTAS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 2 }}>

          {/* GRÁFICO BARRAS (VENDAS POR DIA) */}
          <div className="chart-card" style={{ padding: '20px' }}>
            <h3 style={{ marginBottom: '15px' }}><TrendingUp size={18} /> Vendas por Dia</h3>

            <div style={{ width: '100%', height: '300px' }}>
              {loading ? (
                <div className="skeleton skeleton-box"></div>
              ) : temDadosVendas ? ( // <--- AQUI A MUDANÇA: Usa a validação de valores
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={resumo.graficoVendas} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="data" style={{fontSize: 12}} />
                            <YAxis style={{fontSize: 12}} />
                            <Tooltip formatter={(value) => format(value)} />
                            <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
              ) : (
                <div className="empty-state-container">
                    <Info size={24} color="#cbd5e1"/>
                    <span className="empty-subtext">Sem vendas este mês.</span>
                </div>
              )}
            </div>
          </div>

          {/* TOP PRODUTOS (RANKING) */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Top Produtos</h3>
             {loading ? <div className="skeleton skeleton-text"></div> : (
               <ul className="ranking-list" style={{listStyle: 'none', padding: 0}}>
                  {resumo.topProdutos.map((p, i) => (
                      <li key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #f1f5f9'}}>
                          <div style={{display:'flex', alignItems:'center'}}>
                              <span style={{fontWeight: 'bold', color: '#64748b', marginRight: 15, width: 20}}>{i+1}°</span>
                              <div style={{display:'flex', flexDirection:'column'}}>
                                  <span style={{fontWeight: 600, color: '#334155'}}>{p.produto || p.marca || 'Produto'}</span>
                                  <span style={{fontSize:'0.8rem', color:'#94a3b8'}}>Qtd: {p.quantidade} {p.unidade || ''}</span>
                              </div>
                          </div>
                          <div style={{textAlign: 'right'}}>
                              <div style={{fontWeight: 'bold', color: '#0f172a'}}>{format(p.valorTotal || p.valor)}</div>
                          </div>
                      </li>
                  ))}
                  {resumo.topProdutos.length === 0 && <p style={{color:'#94a3b8', textAlign:'center', padding: 20}}>Nenhum produto vendido.</p>}
               </ul>
             )}
          </div>

          {/* ÚLTIMAS TRANSAÇÕES */}
          <div className="chart-card" style={{ padding: '0px', overflow: 'hidden' }}>
             <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0 }}><ListChecks size={18} /> Últimas Transações</h3>
             </div>
             {loading ? <div style={{padding: 20}}><div className="skeleton skeleton-text"></div></div> :
               resumo.ultimasVendas.length > 0 ? (
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead style={{ background: '#f8fafc', color: '#64748b' }}>
                       <tr>
                          <th style={{ padding: '12px 20px', textAlign: 'left' }}>Venda</th>
                          <th style={{ padding: '12px', textAlign: 'center' }}>Formas de Pagamento</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right' }}>Total</th>
                       </tr>
                    </thead>
                    <tbody>
                       {resumo.ultimasVendas.map((venda, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                             <td style={{ padding: '12px 20px' }}>
                                 <div style={{fontWeight:600}}>#{venda.id}</div>
                                 <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{venda.clienteNome || 'Consumidor'}</div>
                             </td>
                             <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{display:'flex', gap:4, justifyContent:'center', flexWrap:'wrap'}}>
                                    {venda.pagamentos && venda.pagamentos.length > 0 ? (
                                        venda.pagamentos.map((pag, pIdx) => (
                                            <span key={pIdx} className={`badge ${getBadgeClass(pag.formaPagamento)}`} style={{fontSize: '0.7rem', padding: '2px 8px', borderRadius:'4px'}}>
                                                {pag.formaPagamento}
                                            </span>
                                        ))
                                    ) : (
                                        <span className={`badge ${getBadgeClass(venda.formaDePagamento)}`} style={{fontSize: '0.7rem', padding: '2px 8px'}}>
                                            {venda.formaDePagamento || 'ND'}
                                        </span>
                                    )}
                                </div>
                             </td>
                             <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                {format(venda.valorTotal)}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
             ) : (
                <div className="empty-state-container" style={{border:'none', padding:20}}><Inbox size={32} className="empty-icon" /><span className="empty-subtext">Nenhuma transação.</span></div>
             )}
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

          {/* GRÁFICO PIZZA */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Formas de Pagamento</h3>
             <div style={{ width: '100%', height: '300px' }}>
                {loading ? <div className="skeleton skeleton-box"></div> :
                    temDadosPagamentos ? ( // <--- AQUI A MUDANÇA
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={resumo.graficoPagamentos}
                                    cx="50%" cy="50%"
                                    innerRadius={60} outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="valor"
                                    nameKey="tipo"
                                >
                                    {resumo.graficoPagamentos.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(val) => format(val)} />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state-container" style={{border:'none'}}>
                            <Info size={24} color="#cbd5e1"/>
                            <span className="empty-subtext">Sem dados.</span>
                        </div>
                    )
                }
             </div>
          </div>

          {/* ACESSO RÁPIDO */}
          <div className="chart-card" style={{ padding: '20px' }}>
             <h3 style={{ marginBottom: '15px' }}>Acesso Rápido</h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <button className="btn-confirm success" onClick={() => navigate('/pdv')} style={{ justifyContent:'center', padding:15, border:'none', borderRadius:8, background:'#10b981', color:'white', fontWeight:'bold', cursor:'pointer' }}>
                 <ShoppingBag size={18} style={{marginRight:8}}/> Abrir PDV
               </button>
               <button className="btn-confirm" onClick={() => navigate('/caixa')} style={{ justifyContent:'center', padding:15, border:'none', borderRadius:8, background:'#2563eb', color:'white', fontWeight:'bold', cursor:'pointer' }}>
                 <DollarSign size={18} style={{marginRight:8}}/> Gerenciar Caixa
               </button>
               <button className="btn-cancel" onClick={() => navigate('/produtos')} style={{ justifyContent:'center', padding:15, border:'1px solid #e2e8f0', borderRadius:8, background:'white', color:'#475569', fontWeight:'bold', cursor:'pointer' }}>
                 <ArrowRight size={18} style={{marginRight:8}}/> Produtos
               </button>
             </div>
          </div>

          <AuditPanel loading={loading} alertas={[]} onNavigate={() => navigate('/auditoria')} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;