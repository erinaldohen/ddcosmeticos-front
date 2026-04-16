import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import InsightsPanel from './components/InsightsPanel';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as TooltipChart,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, BarChart, Bar // 🔥 Adicionado BarChart e Bar
} from 'recharts';
import {
  DollarSign, ShoppingBag, Activity, Clock, RefreshCcw, ArrowRight,
  CreditCard, Sparkles, Target, AlertCircle, Package, HeartHandshake,
  TrendingDown, Landmark, Zap, Scale, Tag, PieChart as PieChartIcon, ArchiveX, CalendarClock, Flag,
  TrendingUp, Layers, HelpCircle, X, ChevronDown, Calendar, AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import AlertasAuditoria from '../Dashboard/AlertasAuditoria';
import './Dashboard.css';

const InfoTooltip = ({ text }) => (
  <div className="info-tooltip-wrapper">
    <HelpCircle size={14} className="info-icon" />
    <div className="info-tooltip-content">{text}</div>
  </div>
);

const NanoInsightIA = ({ insight, tipo = 'info', icon = Sparkles }) => {
  const Icon = icon;
  return (
    <div className={`nano-insight insight-${tipo}`}>
      <Icon size={14} className={`insight-icon icon-${tipo}`} />
      <span className={`insight-text text-${tipo}`}>{insight}</span>
    </div>
  );
};

const DashboardSkeleton = () => (
  <div className="dash-wrapper">
    <div className="dash-header"><div className="skeleton sk-header"></div></div>
    <div className="dash-tabs-skeleton"><div className="skeleton sk-tab"></div><div className="skeleton sk-tab"></div></div>
    <div className="dash-top-grid"><div className="skeleton sk-top"></div><div className="skeleton sk-top"></div></div>
  </div>
);

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
  const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" className="pie-label">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [analiseMensal, setAnaliseMensal] = useState(null);
  const [qtdPendentes, setQtdPendentes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [errorStatus, setErrorStatus] = useState(false);
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);

  const [abaAtiva, setAbaAtiva] = useState('comercial'); // 🔥 Inicia na Comercial para você testar
  const [modalDrillDown, setModalDrillDown] = useState(null);
  const [listaDrillDown, setListaDrillDown] = useState([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState('hoje');
  const [user, setUser] = useState(null);

  useEffect(() => {
      try {
          const u = localStorage.getItem('user');
          if (u) setUser(JSON.parse(u));
      } catch (e) {}
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setChartWidth(entries[0].contentRect.width);
    });
    if (chartContainerRef.current) observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [abaAtiva, loading]);

  useEffect(() => {
    carregarDados();
    const intervalId = setInterval(() => {
        if (filtroPeriodo === 'hoje') carregarDados(true);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [filtroPeriodo]);

  useEffect(() => {
      if (modalDrillDown) {
        setListaDrillDown([]);
        api.get(`/dashboard/risco-lista?tipo=${modalDrillDown}`)
           .then(res => setListaDrillDown(res.data))
           .catch(err => console.error("Erro ao buscar lista", err));
      } else {
        setListaDrillDown([]);
      }
  }, [modalDrillDown]);

  const carregarDados = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setErrorStatus(false);
    try {
      const [dashRes, analiseRes, pendentesRes] = await Promise.all([
        api.get(`/dashboard?periodo=${filtroPeriodo}`),
        api.get(`/contas-pagar/analise-mensal?periodo=${filtroPeriodo}`).catch(() => ({ data: { custoFixoPrevisto: 0 } })),
        api.get('/dashboard/alertas/pendentes-revisao').catch(() => ({ data: 0 }))
      ]);
      setData(dashRes.data);
      setAnaliseMensal(analiseRes.data);
      setQtdPendentes(Number(pendentesRes.data) || 0);
      setLastUpdate(new Date());
    } catch (err) {
      setErrorStatus(true);
    } finally { if (!isSilent) setLoading(false); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  if (loading && !data) return <DashboardSkeleton />;

  const payload = data || {};
  const fin = payload.financeiro || {};
  const inv = payload.inventario || {};
  const ia = payload.inteligencia || {};

  const labelPeriodo = filtroPeriodo === 'hoje' ? 'Hoje' : filtroPeriodo === 'este_mes' ? 'Este Mês' : 'Mês Passado';
  const faturamento = Number(fin.faturamentoHoje || 0);
  const lucroBruto = Number(fin.lucroBrutoHoje || 0);
  const valorReposicao = Number(fin.custoTotalReposicaoHoje || 0);
  const vendasQtd = Number(fin.vendasHoje || 0);
  const ticketMedio = Number(fin.ticketMedio || (vendasQtd > 0 ? faturamento / vendasQtd : 0));

  const produtosDistintos = Number(fin.produtosDistintosPorVenda || 0).toFixed(2);
  const descontosHoje = Number(fin.descontosHoje || 0);
  const percentualDesconto = faturamento > 0 ? (descontosHoje / (faturamento + descontosHoje)) * 100 : 0;
  const impostoMes = Number(fin.impostoProvisorioMes || 0);

  const graficoEvolucao = Array.isArray(fin.graficoVendas) ? fin.graficoVendas.map(i => ({
      dia: i.data || '',
      faturamento: Number(i.total || 0),
      custo: Number(i.custo || i.total * 0.4)
  })) : [];
  const faturamentoPeriodoChart = graficoEvolucao.reduce((acc, curr) => acc + curr.faturamento, 0);

  const faturamentoCalculoMeta = filtroPeriodo === 'hoje' ? faturamento : faturamentoPeriodoChart;
  const taxaMargemMensal = faturamentoCalculoMeta > 0 ? ((lucroBruto - (faturamentoCalculoMeta * 0.04)) / faturamentoCalculoMeta) : 0.40;
  const margemAcumulada = faturamentoCalculoMeta * taxaMargemMensal;

  const custoFixoMes = analiseMensal?.custoFixoPrevisto || 0;
  const progressoEquilibrio = custoFixoMes > 0 ? Math.min(100, (margemAcumulada / custoFixoMes) * 100) : 0;
  const faltaParaPagar = Math.max(0, custoFixoMes - margemAcumulada);
  const lucroLiquidoRealMes = Math.max(0, margemAcumulada - custoFixoMes);

  const META_MENSAL = payload.metaMensal ? Number(payload.metaMensal) : 0;
  const META_ALVO = filtroPeriodo === 'hoje' ? (payload.metaDiaria ? Number(payload.metaDiaria) : 0) : META_MENSAL;
  const progressoMetaMensal = META_ALVO > 0 ? Math.min(100, (faturamentoCalculoMeta / META_ALVO) * 100) : 0;

  const runRate = Number(fin.runRate || 0);
  const crescimentoMoM = Number(fin.crescimentoMoM || 0);
  const isCrescimentoPositivo = crescimentoMoM >= 0;
  const roiIAValor = Number(ia.roiValor || 0);
  const roiIAItens = Number(ia.roiItens || 0);

  // 🔥 MAPA DE CALOR: Preparado para o BarChart
  const mapaDeCalor = Array.isArray(fin.vendasPorHora) ? fin.vendasPorHora : [];

  const estoqueCurvaC = inv.estoqueCurvaC || { itens: 0, valorImobilizado: 0 };
  const produtosVencendo = inv.produtosVencendo || { itens: 0, valorRisco: 0 };
  const taxaRecorrencia = Number(fin.taxaRecorrencia || 0);

  const receitasFuturas = Number(fin.fluxoCaixa7Dias?.receitasPrevistas || 0);
  const despesasFuturas = Number(fin.fluxoCaixa7Dias?.despesasPrevistas || 0);
  const saldoPrevisto = receitasFuturas - despesasFuturas;
  const fluxoTotalBase = receitasFuturas + despesasFuturas;
  const percReceita = fluxoTotalBase > 0 ? (receitasFuturas / fluxoTotalBase) * 100 : 50;

  const vendasPerdidas = inv.vendasPerdidas || { quantidade: 0, valorEstimado: 0 };

  const performanceVendedores = Array.isArray(payload.performanceVendedores) ? payload.performanceVendedores : [];

  // 🔥 TOP CATEGORIAS: Para o novo Painel de Categorias
  const topCategorias = Array.isArray(payload.topCategorias) ? payload.topCategorias.slice(0, 5) : [];

  const formasPagamentoRaw = Array.isArray(fin.formasPagamento) ? fin.formasPagamento : [];
  const formasPagamento = formasPagamentoRaw.length > 0 ? formasPagamentoRaw.map(p => {
    const n = String(p.name).toUpperCase();
    let color = '#94a3b8';
    if (n.includes('PIX')) color = '#059669';
    else if (n.includes('DINHEIRO') || n.includes('CASH')) color = '#4ade80';
    else if (n.includes('CRÉDITO') || n.includes('CREDITO')) color = '#3b82f6';
    else if (n.includes('DÉBITO') || n.includes('DEBITO')) color = '#38bdf8';
    else if (n.includes('CREDIÁRIO') || n.includes('CREDIARIO')) color = '#fbbf24';
    return { ...p, fill: color };
  }) : [{ name: 'Sem Vendas', value: 1, fill: '#e2e8f0' }];

  const topProdutosBruto = Array.isArray(payload.topProdutos) ? payload.topProdutos : [];
  const topProdutosMapeados = topProdutosBruto.map(p => ({
      nome: p.nome || p.descricao || p.name || p.produto || 'Produto Desconhecido',
      valor: Number(p.valor || p.total || p.faturamento || p.vendas || 0)
  }));

  const topProdutosOrdenados = [...topProdutosMapeados].sort((a, b) => b.valor - a.valor).slice(0, 15);
  const faturamentoTotalABC = topProdutosOrdenados.reduce((acc, curr) => acc + curr.valor, 0);

  let fatAcumulado = 0;
  const produtosABC = topProdutosOrdenados.map((prod) => {
      fatAcumulado += prod.valor;
      const percentualAcumulado = faturamentoTotalABC > 0 ? (fatAcumulado / faturamentoTotalABC) * 100 : 0;

      let curva = 'C';
      let cor = '#94a3b8';

      if (percentualAcumulado <= 80 || (percentualAcumulado > 80 && curva === 'C' && fatAcumulado === prod.valor)) {
          curva = 'A'; cor = '#ec4899';
      }
      else if (percentualAcumulado <= 95) { curva = 'B'; cor = '#3b82f6'; }

      return { ...prod, curva, cor, percentual: faturamentoTotalABC > 0 ? (prod.valor / faturamentoTotalABC) * 100 : 0 };
  });

  const gerarDiagnosticoPrincipal = () => {
    let analise = [];
    if (progressoEquilibrio >= 100) analise.push("🏆 Ponto de Equilíbrio atingido! Tudo a partir de agora é Lucro Líquido.");
    else analise.push(`⚠️ Faltam ${formatCurrency(faltaParaPagar)} de margem para cobrir os custos operacionais.`);
    if (filtroPeriodo === 'hoje' && mapaDeCalor.length > 0 && mapaDeCalor[mapaDeCalor.length-1]?.qtd < 2) {
      analise.push("⏳ O movimento da loja está fraco nesta última hora. Considere disparar uma oferta no WhatsApp.");
    }
    return analise.join(" ");
  };

  const gerarInsightEvolucao = () => {
      if (isCrescimentoPositivo) return `Excelente! Faturamento ${crescimentoMoM.toFixed(1)}% superior ao mesmo período passado.`;
      return `Atenção: Queda de ${Math.abs(crescimentoMoM).toFixed(1)}% no faturamento. Promova os itens da Curva C.`;
  };

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Central Executiva</h1>
          <p className="dash-subtitle">Gestão de Varejo Inteligente • DD Cosméticos</p>
        </div>
        <div className="dash-actions">
          <div className="period-filter highlight-filter">
             <Calendar size={16} className="filter-icon text-main" />
             <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
                <option value="hoje">Dados de Hoje</option>
                <option value="este_mes">Acumulado do Mês</option>
                <option value="mes_passado">Mês Passado (Fechado)</option>
             </select>
             <ChevronDown size={14} className="filter-arrow" />
          </div>
          {errorStatus && <span className="dash-error-badge"><AlertCircle size={14} /> Offline</span>}
          <span className="dash-time"><Clock size={14} /> {lastUpdate.toLocaleTimeString()}</span>
          <button className="btn-refresh" onClick={() => carregarDados(false)}><RefreshCcw size={16}/> Sincronizar</button>
        </div>
      </header>

      <InsightsPanel />
      <AlertasAuditoria />

      {percentualDesconto > 8 && (
          <div className="fade-in" style={{background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', border: '1px solid #ef4444', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px -3px rgba(239, 68, 68, 0.15)', flexWrap: 'wrap', gap: '15px'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{background: '#ef4444', color: 'white', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)'}}>
                      <TrendingDown size={28} />
                  </div>
                  <div>
                      <h3 style={{ margin: '0 0 4px', color: '#991b1b', fontSize: '1.2rem', fontWeight: '800' }}>Hemorragia de Margem (Descontos Excessivos)</h3>
                      <p style={{ margin: 0, color: '#b91c1c', fontSize: '1rem', fontWeight: '500' }}>Atenção! O volume de descontos concedidos atingiu <strong>{percentualDesconto.toFixed(1)}%</strong> do faturamento ({formatCurrency(descontosHoje)}).</p>
                  </div>
              </div>
          </div>
      )}

      {qtdPendentes > 0 && (
          <div className="fade-in" style={{background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #f59e0b', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px -3px rgba(245, 158, 11, 0.15)', flexWrap: 'wrap', gap: '15px'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{background: '#f59e0b', color: 'white', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)'}}>
                      <AlertTriangle size={28} />
                  </div>
                  <div>
                      <h3 style={{ margin: '0 0 4px', color: '#92400e', fontSize: '1.2rem', fontWeight: '800' }}>Ação Requerida</h3>
                      <p style={{ margin: 0, color: '#b45309', fontSize: '1rem', fontWeight: '500' }}>Existem <strong>{qtdPendentes} novos produtos</strong> aguardando revisão.</p>
                  </div>
              </div>
              <button onClick={() => navigate('/produtos', { state: { filtrarPendentes: true } })} style={{background: '#92400e', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap'}}>Revisar Agora <ArrowRight size={20} /></button>
          </div>
      )}

      <div className="ai-insight-box" style={{background: 'linear-gradient(135deg, #fffcf0 0%, #fef9e6 100%)', border: '1px solid #f1e4b8', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '18px', boxShadow: '0 4px 15px -3px rgba(184, 134, 11, 0.1)'}}>
        <div className="ai-icon-glow" style={{background: '#4b3621', color: 'white', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(75, 54, 33, 0.3)', flexShrink: 0}}>
            <Zap size={26} color="white" />
        </div>
        <div className="ai-content">
          <h4 style={{margin: '0 0 5px', color: '#4b3621', fontSize: '1.15rem', fontWeight: '800'}}>Copiloto IA DD Cosméticos ({labelPeriodo})</h4>
          <p style={{margin: 0, color: '#5c4033', fontSize: '1rem', fontWeight: '600', lineHeight: '1.5'}}>{gerarDiagnosticoPrincipal()}</p>
        </div>
      </div>

      <div className="dash-tabs">
        <button className={abaAtiva === 'financeiro' ? 'active' : ''} onClick={() => setAbaAtiva('financeiro')}>📊 Visão Financeira</button>
        <button className={abaAtiva === 'comercial' ? 'active' : ''} onClick={() => setAbaAtiva('comercial')}>🧠 Inteligência Comercial</button>
        <button className={abaAtiva === 'operacao' ? 'active' : ''} onClick={() => setAbaAtiva('operacao')}>🛡️ Operação & Estoque</button>
      </div>

      {abaAtiva === 'financeiro' && (
        <section className="dash-block animate-fade-in">
            <div className="dash-top-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
              <div className="box-card hover-effect" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                  <h3 className="flex-center-gap w-full" style={{ marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><Flag size={18} className="text-purple"/> Meta de {labelPeriodo}</h3>
                  <div style={{ position: 'relative', width: '120px', height: '120px', margin: '10px 0' }}>
                      <svg viewBox="0 0 36 36" width="100%" height="100%">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#ec4899" strokeWidth="4" strokeDasharray={`${progressoMetaMensal}, 100`} />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#0f172a' }}>{progressoMetaMensal.toFixed(0)}%</span>
                      </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Atingido / Alvo</span>
                      <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{formatCurrency(faturamentoCalculoMeta)}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 4px' }}>/</span>
                      <span style={{ fontSize: '0.9rem', color: '#64748b' }}>{formatCurrency(META_ALVO)}</span>
                  </div>
              </div>

              <div className="box-card hover-effect" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                  <h3 className="flex-center-gap w-full" style={{ marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}><Scale size={18} className="text-blue"/> Ponto de Equilíbrio</h3>
                  <div style={{ position: 'relative', width: '120px', height: '120px', margin: '10px 0' }}>
                      <svg viewBox="0 0 36 36" width="100%" height="100%">
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                          <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#3b82f6" strokeWidth="4" strokeDasharray={`${progressoEquilibrio}, 100`} />
                      </svg>
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: progressoEquilibrio >= 100 ? '#10b981' : '#0f172a' }}>{progressoEquilibrio.toFixed(0)}%</span>
                      </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                      <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Margem vs Custos Fixos</span>
                      <strong style={{ fontSize: '1.1rem', color: progressoEquilibrio >= 100 ? '#10b981' : '#ef4444' }}>
                          {progressoEquilibrio >= 100 ? `Lucro: ${formatCurrency(lucroLiquidoRealMes)}` : `Faltam: ${formatCurrency(faltaParaPagar)}`}
                      </strong>
                  </div>
              </div>

              <div className="box-card hover-effect" style={{ display: 'flex', flexDirection: 'column', padding: '24px', gridColumn: 'span 1' }}>
                <div className="box-header">
                  <h3 className="flex-center-gap"><Activity size={18} className="text-emerald"/> Liquidez Futura (7 Dias) <InfoTooltip text="Projeção baseada em Contas a Receber vs Pagar."/></h3>
                </div>
                <div style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div><span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Recebimentos</span><br/><strong style={{ color: '#10b981', fontSize: '1.2rem' }}>+{formatCurrency(receitasFuturas)}</strong></div>
                        <div style={{ textAlign: 'right' }}><span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Pagamentos</span><br/><strong style={{ color: '#ef4444', fontSize: '1.2rem' }}>-{formatCurrency(despesasFuturas)}</strong></div>
                    </div>
                    <div style={{ width: '100%', height: '12px', borderRadius: '6px', display: 'flex', overflow: 'hidden', margin: '16px 0', background: '#f1f5f9' }}>
                        {fluxoTotalBase > 0 ? (
                            <><div style={{ width: `${percReceita}%`, background: '#10b981' }}></div><div style={{ width: `${100 - percReceita}%`, background: '#ef4444' }}></div></>
                        ) : (<div style={{ width: '100%', background: '#e2e8f0' }}></div>)}
                    </div>
                    <div style={{ background: saldoPrevisto >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${saldoPrevisto >= 0 ? '#bbf7d0' : '#fecaca'}`, padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: saldoPrevisto >= 0 ? '#166534' : '#991b1b', fontWeight: 'bold' }}>Saldo de Segurança</span>
                        <strong style={{ color: saldoPrevisto >= 0 ? '#15803d' : '#dc2626', fontSize: '1.3rem' }}>{formatCurrency(saldoPrevisto)}</strong>
                    </div>
                </div>
              </div>
            </div>

            <div className="dash-kpi-grid">
              <div className="kpi-card hover-effect kpi-pink">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Faturamento <InfoTooltip text="Total faturado no período selecionado."/></span><div className={`mom-badge ${isCrescimentoPositivo ? 'mom-up' : 'mom-down'}`} title="Crescimento sobre o mesmo período anterior">{isCrescimentoPositivo ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}{Math.abs(crescimentoMoM).toFixed(1)}%</div></div>
                  <h2 className="kpi-value">{formatCurrency(faturamento)}</h2>
                </div>
                <NanoInsightIA insight={isCrescimentoPositivo ? "Ritmo superior ao médio." : "Tráfego em queda. Sugerida promoção."} tipo={isCrescimentoPositivo ? "success" : "warning"} />
              </div>
              <div className="kpi-card hover-effect kpi-indigo">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">CMV Total <InfoTooltip text="Custo da mercadoria vendida."/></span><RefreshCcw size={18} className="kpi-icon"/></div>
                  <h2 className="kpi-value">{formatCurrency(valorReposicao)}</h2>
                </div>
                <NanoInsightIA insight={faturamento > 0 && (valorReposicao / faturamento) > 0.60 ? "Custo muito elevado." : "Custo controlado."} tipo={faturamento > 0 && (valorReposicao / faturamento) > 0.60 ? "danger" : "success"} />
              </div>
              <div className="kpi-card hover-effect kpi-green">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Lucro Bruto <InfoTooltip text="Faturamento menos o CMV."/></span><TrendingDown size={18} className="kpi-icon"/></div>
                  <h2 className="kpi-value">{formatCurrency(lucroBruto)}</h2>
                </div>
                <NanoInsightIA insight={`Margem Bruta de ${faturamento > 0 ? ((lucroBruto / faturamento) * 100).toFixed(1) : 0}%.`} tipo="info" />
              </div>
              <div className="kpi-card hover-effect kpi-blue">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Total de Vendas <InfoTooltip text="Número de cupons emitidos."/></span><ShoppingBag size={18} className="kpi-icon"/></div>
                  <h2 className="kpi-value">{vendasQtd} <span className="text-small">recibos</span></h2>
                </div>
                <NanoInsightIA insight={vendasQtd < 5 && filtroPeriodo === 'hoje' ? "Fluxo muito lento." : "Volume normalizado."} tipo={vendasQtd < 5 && filtroPeriodo === 'hoje' ? "warning" : "info"} />
              </div>
              <div className="kpi-card hover-effect kpi-purple">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Ticket Médio <InfoTooltip text="Gasto médio por cliente."/></span><CreditCard size={18} className="kpi-icon"/></div>
                  <h2 className="kpi-value">{formatCurrency(ticketMedio)}</h2>
                </div>
                <NanoInsightIA insight={ticketMedio < 40 && faturamento > 0 ? "Oportunidade de Cross-sell." : "Valor saudável."} tipo={ticketMedio < 40 && faturamento > 0 ? "warning" : "success"} />
              </div>
              <div className="kpi-card hover-effect kpi-orange">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Itens por Cesta <InfoTooltip text="Média de itens por cupom."/></span><Package size={18} className="kpi-icon"/></div>
                  <h2 className="kpi-value">{produtosDistintos} <span className="text-small">un</span></h2>
                </div>
                <NanoInsightIA insight={produtosDistintos <= 1.2 && vendasQtd > 0 ? "Maioria leva só 1 item." : "Venda casada OK."} tipo={produtosDistintos <= 1.2 && vendasQtd > 0 ? "warning" : "success"} />
              </div>
              <div className="kpi-card hover-effect kpi-red">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Descontos <InfoTooltip text="Soma de abatimentos."/></span><Tag size={18} className="kpi-icon"/></div>
                  <h2 className={`kpi-value ${percentualDesconto > 8 ? 'text-danger' : 'text-main'}`}>{formatCurrency(descontosHoje)}</h2>
                </div>
                <NanoInsightIA insight={percentualDesconto > 8 ? `Cedeu ${percentualDesconto.toFixed(1)}%. Risco.` : "Descontos normais."} tipo={percentualDesconto > 8 ? "danger" : "success"} />
              </div>
              <div className="kpi-card hover-effect kpi-rose">
                <div className="kpi-info">
                  <div className="kpi-info-header"><span className="kpi-label flex-center-gap">Retenção <InfoTooltip text="Clientes que retornaram."/></span><HeartHandshake size={18} className="kpi-icon"/></div>
                  <h2 className="kpi-value">{taxaRecorrencia.toFixed(1)}<span className="text-small">%</span></h2>
                </div>
                <NanoInsightIA insight={taxaRecorrencia < 15 && vendasQtd > 0 ? "Pouca fidelização." : "Boa base de retorno."} tipo={taxaRecorrencia < 15 && vendasQtd > 0 ? "warning" : "success"} />
              </div>
            </div>

            <div className="chart-box main-chart hover-effect mt-6" ref={chartContainerRef}>
                <div className="box-header flex-between">
                    <div><h3 className="flex-center-gap"><TrendingUp size={18}/> Receita vs. Custo (CMV) <InfoTooltip text="Linha rosa representa o Faturamento. A área azul representa o Custo dos Produtos Vendidos."/></h3></div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width: '10px', height: '10px', background: '#ec4899', borderRadius: '50%'}}></div> Faturamento</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width: '10px', height: '10px', background: '#3b82f6', borderRadius: '50%'}}></div> CMV</span>
                    </div>
                </div>
                <div className="chart-content mt-4">
                  {graficoEvolucao.length > 0 ? (
                    <AreaChart width={chartWidth || 800} height={300} data={graficoEvolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                          <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient>
                          <linearGradient id="colorCusto" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} tickFormatter={(v) => `R$${v>1000 ? (v/1000).toFixed(0)+'k' : v}`}/>
                      <TooltipChart contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} formatter={(value, name) => [formatCurrency(value), name === 'faturamento' ? 'Faturamento' : 'Custo (CMV)']} />
                      <Area type="monotone" dataKey="faturamento" stroke="#ec4899" strokeWidth={4} fill="url(#colorFat)" activeDot={{ r: 6, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }} />
                      <Area type="monotone" dataKey="custo" stroke="#3b82f6" strokeWidth={3} fill="url(#colorCusto)" />
                    </AreaChart>
                  ) : <div className="empty-state" style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Sem dados de fluxo para este período.</div>}
                </div>
            </div>
        </section>
      )}

      {/* 🔥 ABA 2: INTELIGÊNCIA COMERCIAL (ESTADO DA ARTE) 🔥 */}
      {abaAtiva === 'comercial' && (
        <section className="dash-block animate-fade-in">

          {/* LINHA 1: Mapa de Calor (Visão de Tráfego por Hora) */}
          <div className="box-card hover-effect mb-4 w-full">
              <div className="box-header flex-between">
                  <h3 className="flex-center-gap"><Clock size={18} className="text-primary"/> Mapa de Calor (Vendas por Hora) <InfoTooltip text="Identifique os horários de pico para reforçar o atendimento no balcão."/></h3>
                  <span className="ia-badge primary">Tráfego</span>
              </div>
              <div className="chart-content mt-4" style={{ height: '240px' }}>
                  {mapaDeCalor.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={mapaDeCalor} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="hora" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                              <TooltipChart cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} formatter={(val) => [val, 'Vendas (Qtd)']} />
                              <Bar dataKey="qtd" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                  {mapaDeCalor.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.qtd > (vendasQtd / Math.max(1, mapaDeCalor.length)) * 1.5 ? '#ec4899' : '#3b82f6'} />
                                  ))}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  ) : <div className="empty-state flex-center h-full">Sem dados de horário para este período.</div>}
              </div>
              <div className="mt-2 text-center"><span style={{fontSize:'0.85rem', color:'#64748b'}}>* Barras em <b style={{color:'#ec4899'}}>rosa</b> indicam horários de pico intenso (fluxo acima da média).</span></div>
          </div>

          {/* LINHA 2: Categorias e Métodos de Pagamento */}
          <div className="dash-charts-grid split-2" style={{ marginBottom: '24px' }}>

              {/* Top Categorias */}
              <div className="box-card hover-effect">
                  <div className="box-header">
                      <h3 className="flex-center-gap"><ShoppingBag size={18} className="text-orange"/> Top Categorias <InfoTooltip text="As famílias de produtos que mais atraem clientes."/></h3>
                  </div>
                  <div className="mt-4 d-flex-col gap-3">
                      {topCategorias.length > 0 ? topCategorias.map((cat, i) => {
                          const perc = faturamento > 0 ? (cat.valor / faturamento) * 100 : 0;
                          return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', color: '#1e293b' }}>
                                      <span>{i + 1}. {cat.nome}</span>
                                      <span>{formatCurrency(cat.valor)}</span>
                                  </div>
                                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ width: `${Math.max(2, perc)}%`, background: i === 0 ? '#f59e0b' : '#cbd5e1', height: '100%', borderRadius: '4px' }}></div>
                                  </div>
                              </div>
                          );
                      }) : <p className="empty-state">Nenhuma categoria com faturamento.</p>}
                  </div>
              </div>

              {/* Pagamentos Donut */}
              <div className="chart-box hover-effect">
                <div className="box-header">
                    <h3 className="flex-center-gap"><PieChartIcon size={18} className="text-emerald"/> Preferência de Pagamento</h3>
                </div>
                <div className="chart-content flex-center relative" style={{flexDirection: 'column', height: '240px'}}>
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        {/* Agora é um Donut Chart para ser mais elegante */}
                        <Pie data={formasPagamento} cx="50%" cy="50%" labelLine={false} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                          {formasPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />)}
                        </Pie>
                        <TooltipChart formatter={(value) => formatCurrency(value)} contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 10px rgba(0,0,0,0.1)'}}/>
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                   </ResponsiveContainer>
                   {/* Centro do Donut */}
                   <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                       <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>TOTAL</span><br/>
                       <span style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: '900' }}>{formatCurrency(faturamento)}</span>
                   </div>
                </div>
              </div>
          </div>

          {/* LINHA 3: Equipa e ROI IA */}
          <div className="dash-charts-grid split-2">
              {/* Pódio de Vendedores */}
              <div className="box-card hover-effect">
                  <div className="box-header"><h3 className="flex-center-gap"><Target size={18} className="text-blue"/> Pódio da Equipe <InfoTooltip text="Ranking de vendedores por faturamento e conversão."/></h3></div>
                  <div className="ranking-list mt-3">
                    {performanceVendedores.length > 0 ? performanceVendedores.map((vend, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: i === 0 ? '#eff6ff' : '#f8fafc', borderRadius: '8px', border: i === 0 ? '1px solid #bfdbfe' : '1px solid transparent', marginBottom: '8px' }}>
                        <div style={{ fontSize: '1.5rem', width: '30px', textAlign: 'center' }}>
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: 'block', color: i === 0 ? '#1d4ed8' : '#334155', fontSize: '1rem' }}>{vend.nome || 'Usuário'}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{vend.converteu} clientes atendidos</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.1rem' }}>{formatCurrency(vend.vendas)}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>TM: {formatCurrency(vend.vendas / Math.max(1, vend.converteu))}</span>
                        </div>
                      </div>
                    )) : <p className="empty-state">Sem atividade registada da equipa.</p>}
                  </div>
              </div>

              {/* ROI IA */}
              <div className="box-card hover-effect ia-roi-card" style={{ background: 'linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%)', border: '1px solid #e9d5ff' }}>
                  <div className="box-header flex-between">
                    <h3 className="flex-center-gap"><Sparkles size={18} className="text-purple"/> Impacto da IA (Cross-Sell)</h3>
                    <span className="ia-badge purple" style={{ background: 'white' }}>Conversão</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100% - 50px)', textAlign: 'center', padding: '20px' }}>
                      <div style={{ background: 'rgba(255,255,255,0.6)', padding: '20px', borderRadius: '50%', marginBottom: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                          <Zap size={40} color="#9333ea" />
                      </div>
                      <span style={{ fontSize: '0.9rem', color: '#6b21a8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Receita Adicional Gerada</span>
                      <strong style={{ fontSize: '2.5rem', color: '#4c1d95', margin: '10px 0', lineHeight: '1' }}>{formatCurrency(roiIAValor)}</strong>
                      <p style={{ fontSize: '0.95rem', color: '#581c87', margin: 0, backgroundColor: 'rgba(255,255,255,0.5)', padding: '8px 16px', borderRadius: '20px' }}>
                          <b>{roiIAItens} itens</b> adicionados aos carrinhos usando a Sugestão Inteligente.
                      </p>
                  </div>
              </div>
          </div>
        </section>
      )}

      {/* ABA 3: OPERAÇÃO E GESTÃO DE ESTOQUE */}
      {abaAtiva === 'operacao' && (
        <section className="dash-block animate-fade-in">

          <div className="dash-top-grid triple" style={{ marginBottom: '24px' }}>

            <div className="box-card hover-effect">
              <div className="box-header">
                 <h3 className="flex-center-gap"><CalendarClock size={18} className="text-warning"/> Capital Imobilizado</h3>
              </div>
              <div className="risk-item warning-glow clickable mt-2" onClick={() => setModalDrillDown('curvac')}>
                    <div className="risk-icon"><Package size={20} className="icon-warning"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Estoque Obsoleto (&gt; 90 dias)</span>
                       <div className="risk-data"><span className="risk-qtd">{estoqueCurvaC.itens} SKUs</span><strong className="risk-val text-warning">{formatCurrency(estoqueCurvaC.valorImobilizado)}</strong></div>
                    </div>
              </div>
            </div>

            <div className="box-card hover-effect">
              <div className="box-header">
                 <h3 className="flex-center-gap"><TrendingDown size={18} className="text-danger"/> Riscos Iminentes</h3>
              </div>
              <div className="risk-item warning-glow clickable mt-2" onClick={() => setModalDrillDown('vencimento')} style={{ borderLeftColor: '#ef4444' }}>
                    <div className="risk-icon" style={{background: '#fef2f2'}}><CalendarClock size={20} className="text-danger"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Vencendo em 60 dias</span>
                       <div className="risk-data"><span className="risk-qtd">{produtosVencendo.itens} SKUs</span><strong className="risk-val text-danger">{formatCurrency(produtosVencendo.valorRisco)}</strong></div>
                    </div>
              </div>
              <div className="risk-item warning-glow mt-2 lost-sales-item" style={{ borderLeftColor: '#ef4444' }}>
                    <div className="risk-icon" style={{background: '#fef2f2'}}><ArchiveX size={20} className="text-danger"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Ruptura (Vendas Perdidas)</span>
                       <div className="risk-data"><span className="risk-qtd">{vendasPerdidas.quantidade} Vezes</span><strong className="risk-val text-danger">{formatCurrency(vendasPerdidas.valorEstimado)}</strong></div>
                    </div>
              </div>
            </div>

            <div className="tax-widget hover-effect" style={{ height: '100%', margin: 0 }}>
               <h3 className="flex-center-gap"><Landmark size={18}/> Simulador Tributário <InfoTooltip text="Provisão de Impostos do Período."/></h3>
               <div className="tax-value-box"><h2>{formatCurrency(impostoMes)}</h2><span className="tax-tag">Simples Nacional (4%)</span></div>
               <div className="tax-split-box">
                  <div className="tax-row"><span>DAS Aproximado</span><strong>{formatCurrency(impostoMes)}</strong></div>
               </div>
               <NanoInsightIA insight="A IA cruzou o NCM dos produtos faturados." tipo="info" />
            </div>

          </div>

          <div className="box-card hover-effect" style={{ width: '100%' }}>
              <div className="box-header flex-between" style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div>
                      <h3 className="flex-center-gap" style={{ fontSize: '1.25rem' }}>
                          <Layers size={22} className="icon-main"/> Rentabilidade Curva ABC ({labelPeriodo})
                          <InfoTooltip text="Produtos classificados por importância no faturamento (A=80%, B=15%, C=5%)."/>
                      </h3>
                      <p style={{ margin: '4px 0 0 30px', color: '#64748b', fontSize: '0.9rem' }}>
                          Total de <b>{produtosABC.length} produtos</b> movimentados. Foco estratégico nos itens classe A.
                      </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                      <span className="abc-legend" style={{ background: '#fdf2f8', color: '#be185d', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>A: Foco de Reabastecimento</span>
                      <span className="abc-legend" style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>B: Estabilidade</span>
                  </div>
              </div>

              <div className="abc-chart-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                {produtosABC.length > 0 ? produtosABC.map((prod, i) => (
                    <div key={i} className="abc-bar-row" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="abc-badge" style={{ background: prod.cor, color: 'white', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '900', fontSize: '1.1rem', flexShrink: 0 }}>
                          {prod.curva}
                      </div>
                      <div style={{ width: '25%', flexShrink: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={prod.nome}>{prod.nome}</h4>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Faturamento: {formatCurrency(prod.valor)}</span>
                      </div>
                      <div style={{ flex: 1, background: '#f1f5f9', height: '24px', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{
                              width: `${Math.max(2, prod.percentual)}%`,
                              background: `linear-gradient(90deg, ${prod.cor}cc 0%, ${prod.cor} 100%)`,
                              height: '100%',
                              borderRadius: '12px',
                              transition: 'width 1s ease-out'
                          }}></div>
                          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 'bold', color: prod.percentual > 10 ? 'white' : '#475569' }}>
                              {prod.percentual.toFixed(1)}% do Faturamento
                          </span>
                      </div>
                    </div>
                )) : (
                    <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
                        <Layers size={48} color="#cbd5e1" style={{ margin: '0 auto 10px' }} />
                        <p style={{ fontSize: '1.1rem', color: '#64748b' }}>Sem dados suficientes para processar a Curva ABC neste período.</p>
                    </div>
                )}
              </div>
          </div>

        </section>
      )}

      {/* MODAIS */}
      {modalDrillDown && (
          <div className="modal-glass">
              <div className="modal-glass-card list-modal fade-in">
                  <div className="modal-header-flex">
                      <h3>{modalDrillDown === 'vencimento' ? '🚨 Risco: Vencendo em 60 dias' : '📦 Risco: Obsoletos (Parados)'}</h3>
                      <button className="btn-close-modal" onClick={() => setModalDrillDown(null)}><X size={20}/></button>
                  </div>
                  <p className="modal-description">
                      {modalDrillDown === 'vencimento' ? 'Coloque-os na prateleira da frente ou crie um Pague 1 Leve 2.' : 'Faça uma liquidação relâmpago para libertar dinheiro imobilizado.'}
                  </p>

                  <div className="table-responsive">
                      <table className="drilldown-table">
                          <thead>
                              <tr>
                                  <th>SKU / Produto</th>
                                  <th className="text-right">Estoque</th>
                                  <th className="text-right">Capital Retido</th>
                              </tr>
                          </thead>
                          <tbody>
                              {listaDrillDown && listaDrillDown.length > 0 ? (
                                  listaDrillDown.map((item, idx) => (
                                      <tr key={idx}>
                                          <td>{item.produto}</td>
                                          <td className="text-right font-bold text-main">{item.estoque} un</td>
                                          <td className="text-right text-danger">{item.custo}</td>
                                      </tr>
                                  ))
                              ) : (
                                  <tr><td colSpan="3" className="empty-table-state">Carregando inventário crítico...</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;