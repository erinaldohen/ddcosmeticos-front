import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import InsightsPanel from './components/InsightsPanel';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as TooltipChart,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
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

  const [abaAtiva, setAbaAtiva] = useState('financeiro');
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

  // 🚨 CORREÇÃO: Desempacotamento alinhado com o DashboardDTO do backend
  const payload = data || {};

  // No seu Backend, o MAP principal retornava "financeiro", "inventario", "topProdutos", etc.
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

  const graficoEvolucao = Array.isArray(fin.graficoVendas) ? fin.graficoVendas.map(i => ({ dia: i.data || '', total: Number(i.total || 0) })) : [];
  const faturamentoPeriodoChart = graficoEvolucao.reduce((acc, curr) => acc + curr.total, 0);

  const faturamentoCalculoMeta = filtroPeriodo === 'hoje' ? faturamento : faturamentoPeriodoChart;
  const taxaMargemMensal = faturamentoCalculoMeta > 0 ? ((lucroBruto - (faturamentoCalculoMeta * 0.04)) / faturamentoCalculoMeta) : 0.40;
  const margemAcumulada = faturamentoCalculoMeta * taxaMargemMensal;

  const custoFixoMes = analiseMensal?.custoFixoPrevisto || 0;
  const progressoEquilibrio = custoFixoMes > 0 ? Math.min(100, (margemAcumulada / custoFixoMes) * 100) : 0;
  const faltaParaPagar = Math.max(0, custoFixoMes - margemAcumulada);
  const lucroLiquidoRealMes = Math.max(0, margemAcumulada - custoFixoMes);

  const META_MENSAL = payload.metaMensal ? Number(payload.metaMensal) : 50000;
  const progressoMetaMensal = META_MENSAL > 0 ? Math.min(100, (faturamentoCalculoMeta / META_MENSAL) * 100) : 0;
  const runRate = Number(fin.runRate || 0);

  const crescimentoMoM = Number(fin.crescimentoMoM || 0);
  const isCrescimentoPositivo = crescimentoMoM >= 0;
  const roiIAValor = Number(ia.roiValor || 0);
  const roiIAItens = Number(ia.roiItens || 0);
  const mapaDeCalor = Array.isArray(fin.vendasPorHora) ? fin.vendasPorHora : [];

  const estoqueCurvaC = inv.estoqueCurvaC || { itens: 0, valorImobilizado: 0 };
  const produtosVencendo = inv.produtosVencendo || { itens: 0, valorRisco: 0 };
  const taxaRecorrencia = Number(fin.taxaRecorrencia || 0);
  const fluxo7Dias = fin.fluxoCaixa7Dias || { receitasPrevistas: 0, despesasPrevistas: 0, saldoProjetado: 0 };
  const vendasPerdidas = inv.vendasPerdidas || { quantidade: 0, valorEstimado: 0 };

  const topCategorias = Array.isArray(payload.topCategorias) ? payload.topCategorias.slice(0, 5) : [];
  const performanceVendedores = Array.isArray(payload.performanceVendedores) ? payload.performanceVendedores : [];

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

  const topProdutosOrdenados = [...topProdutosMapeados].sort((a, b) => b.valor - a.valor).slice(0, 10);
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

  const gerarInsightPagamento = () => {
      const temCartaoAlto = formasPagamento.find(p => p.name.toUpperCase().includes('CRÉDITO') && p.value > faturamento * 0.5);
      if (temCartaoAlto) return "Mais de 50% das vendas em Crédito. Considere oferecer um leve desconto no PIX/Dinheiro para melhorar a liquidez imediata.";
      return "O seu mix de pagamentos está pulverizado. Excelente para a saúde do fluxo de caixa diário.";
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
            <div className="dash-top-grid triple">
              <div className="break-even-widget be-purple">
                <div className="widget-header">
                    <div><h3 className="flex-center-gap"><Flag size={20} className="icon-purple"/> Meta de {labelPeriodo} <InfoTooltip text="Progresso da meta estipulada."/></h3></div>
                    <div className="widget-status">
                      <span>META BÁSICA</span>
                      <h4 className={progressoMetaMensal >= 100 ? 'text-success' : 'text-purple'}>{progressoMetaMensal >= 100 ? `BATIDA!` : `${formatCurrency(Math.max(0, META_MENSAL - faturamentoCalculoMeta))}`}</h4>
                    </div>
                </div>
                <div className="progress-bar-container"><div className={`progress-bar-fill ${progressoMetaMensal >= 100 ? 'bg-success-grad' : 'bg-purple-grad'}`} style={{ width: `${progressoMetaMensal}%` }}></div></div>
                <div className="widget-footer"><span>Alcançado: <b>{formatCurrency(faturamentoCalculoMeta)}</b></span><span>{progressoMetaMensal.toFixed(1)}%</span></div>
                {filtroPeriodo === 'este_mes' && (<NanoInsightIA insight={`Projeção de Fecho (Run Rate): ${formatCurrency(runRate)}`} tipo={runRate >= META_MENSAL ? "success" : "warning"} />)}
              </div>

              <div className="break-even-widget">
                <div className="widget-header">
                    <div><h3 className="flex-center-gap"><Scale size={20} className="icon-blue"/> Break-Even <InfoTooltip text="Verifica se a margem gerada cobriu os custos fixos."/></h3></div>
                    <div className="widget-status">
                      <span>LUCRO LÍQUIDO</span>
                      <h4 className={progressoEquilibrio >= 100 ? 'text-success' : 'text-warning'}>{progressoEquilibrio >= 100 ? `+ ${formatCurrency(lucroLiquidoRealMes)}` : `FALTAM ${formatCurrency(faltaParaPagar)}`}</h4>
                    </div>
                </div>
                <div className="progress-bar-container"><div className={`progress-bar-fill ${progressoEquilibrio >= 100 ? 'bg-success-grad' : 'bg-blue-grad'}`} style={{ width: `${progressoEquilibrio}%` }}></div></div>
                <div className="widget-footer"><span>Margem Bruta: <b>{formatCurrency(margemAcumulada)}</b></span><span>Custos: {formatCurrency(custoFixoMes)}</span></div>
                <NanoInsightIA insight={progressoEquilibrio >= 100 ? "Lucro garantido! Pense em reinvestir na Curva A." : "Venda mais produtos de ticket alto para bater os custos."} tipo={progressoEquilibrio >= 100 ? "success" : "warning"} />
              </div>

              <div className="box-card hover-effect cashflow-box">
                <div className="box-header">
                  <h3 className="flex-center-gap"><Activity size={18} className="icon-blue"/> Fluxo Futuro (7 Dias) <InfoTooltip text="Contas a pagar estimadas vs faturamento futuro."/></h3>
                  <span className="ia-badge blue">Caixa</span>
                </div>
                <div className="cf-body">
                  <div className="cf-row"><span className="cf-label text-success">A Receber Est.</span><strong className="cf-val text-success">+{formatCurrency(fluxo7Dias.receitasPrevistas)}</strong></div>
                  <div className="cf-row"><span className="cf-label text-danger">A Pagar Est.</span><strong className="cf-val text-danger">-{formatCurrency(fluxo7Dias.despesasPrevistas)}</strong></div>
                  <div className="cf-divider"></div>
                  <div className="cf-row total"><span className="cf-label">Saldo de Segurança</span><strong className={`cf-val ${fluxo7Dias.saldoProjetado >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(fluxo7Dias.saldoProjetado)}</strong></div>
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

            <div className="chart-box main-chart hover-effect" ref={chartContainerRef}>
                <div className="box-header">
                    <h3 className="flex-center-gap"><Activity size={18}/> Evolução {filtroPeriodo === 'hoje' ? 'Hoje' : 'Diária'} <InfoTooltip text="Acompanhamento gráfico das receitas."/></h3>
                    <NanoInsightIA insight={gerarInsightEvolucao()} />
                </div>
                <div className="chart-content mt-3">
                  {graficoEvolucao.length > 0 ? (
                    <AreaChart width={chartWidth || 800} height={250} data={graficoEvolucao}>
                      <defs><linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}}/>
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} tickFormatter={(v) => `R$${v}`}/>
                      <TooltipChart formatter={(val) => [formatCurrency(val), 'Faturamento']} />
                      <Area type="monotone" dataKey="total" stroke="#ec4899" strokeWidth={3} fill="url(#colorFat)" />
                    </AreaChart>
                  ) : <div className="empty-state">Sem fluxo neste período.</div>}
                </div>
            </div>
        </section>
      )}

      {/* ABA 2: INTELIGÊNCIA COMERCIAL */}
      {abaAtiva === 'comercial' && (
        <section className="dash-block animate-fade-in">
          <div className="dash-charts-grid split-2">

            <div className="chart-box hover-effect" style={{ paddingBottom: '30px' }}>
              <div className="box-header">
                  <h3 className="flex-center-gap"><PieChartIcon size={18}/> Caixa e Liquidez <InfoTooltip text="Quais os métodos de pagamento preferidos."/></h3>
              </div>
              <div className="chart-content flex-center" style={{flexDirection: 'column'}}>
                 <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={formasPagamento} cx="50%" cy="45%" labelLine={false} label={renderCustomizedLabel} innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                        {formasPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <TooltipChart formatter={(value) => formatCurrency(value)} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '15px' }} />
                    </PieChart>
                 </ResponsiveContainer>
                 <div className="w-full mt-2">
                    <NanoInsightIA insight={gerarInsightPagamento()} tipo="info" icon={DollarSign} />
                 </div>
              </div>
            </div>

            <div className="dash-charts-grid split-1" style={{ gap: '20px' }}>
                <div className="box-card hover-effect">
                  <div className="box-header"><h3 className="flex-center-gap"><Target size={18} className="icon-blue"/> Performance da Equipa <InfoTooltip text="Ranking de vendedores no período selecionado."/></h3></div>
                  <div className="ranking-list compact">
                    {performanceVendedores.length > 0 ? performanceVendedores.map((vend, i) => (
                      <div key={i} className={`ranking-item-operator ${i === 0 ? 'top-seller' : ''}`}>
                        <div className={`operator-avatar ${i === 0 ? 'top-avatar' : 'neutral-avatar'}`}>{vend.nome ? vend.nome.charAt(0).toUpperCase() : 'U'}</div>
                        <div className="operator-info">
                          <div className="operator-text"><span className="operator-name">{vend.nome || 'Usuário'}</span><span className="operator-val">{formatCurrency(vend.vendas)}</span></div>
                          <span className="operator-sub">{vend.converteu} vendas feitas</span>
                        </div>
                      </div>
                    )) : <p className="empty-state">Sem atividade registada.</p>}
                  </div>
                </div>

                <div className="box-card hover-effect ia-roi-card">
                  <div className="box-header flex-between">
                    <h3 className="flex-center-gap"><Sparkles size={18} className="icon-purple"/> Receita Extra via IA <InfoTooltip text="Valor faturado através das sugestões de Cross-Sell no PDV."/></h3>
                    <span className="ia-badge purple">Operacional</span>
                  </div>
                  <div className="roi-ia-panel">
                      <span className="roi-label">Valor Adicional Capturado</span>
                      <strong className="roi-val">{formatCurrency(roiIAValor)}</strong>
                      <span className="roi-sub">{roiIAItens} itens vendidos a mais sugeridos pelo sistema.</span>
                  </div>
                </div>
            </div>

          </div>
        </section>
      )}

      {/* ABA 3: OPERAÇÃO E GESTÃO DE ESTOQUE */}
      {abaAtiva === 'operacao' && (
        <section className="dash-block animate-fade-in">
          <div className="dash-bottom-grid split-3">
            <div className="box-card hover-effect span-1">
              <div className="box-header">
                 <h3 className="flex-center-gap"><ArchiveX size={18} className="icon-danger"/> Alertas de Estoque <InfoTooltip text="Problemas urgentes a resolver na prateleira."/></h3>
              </div>
              <div className="risk-alerts-container">
                 <div className="risk-item warning-glow clickable" onClick={() => setModalDrillDown('vencimento')}>
                    <div className="risk-icon"><CalendarClock size={20} className="icon-danger"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Vencendo nos próximos 60 dias</span>
                       <div className="risk-data"><span className="risk-qtd">{produtosVencendo.itens} SKUs</span><strong className="risk-val text-danger">{formatCurrency(produtosVencendo.valorRisco)}</strong></div>
                    </div>
                 </div>
                 <div className="risk-item warning-glow mt-3 clickable" onClick={() => setModalDrillDown('curvac')}>
                    <div className="risk-icon"><Package size={20} className="icon-warning"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Estoque Obsoleto (Parado &gt; 90d)</span>
                       <div className="risk-data"><span className="risk-qtd">{estoqueCurvaC.itens} SKUs</span><strong className="risk-val text-warning">{formatCurrency(estoqueCurvaC.valorImobilizado)}</strong></div>
                    </div>
                 </div>
                 <div className="risk-item warning-glow mt-3 lost-sales-item">
                    <div className="risk-icon"><TrendingDown size={20} className="icon-danger"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Ruptura (Cliente pediu mas faltou)</span>
                       <div className="risk-data"><span className="risk-qtd">{vendasPerdidas.quantidade} ocorrências</span><strong className="risk-val text-danger">{formatCurrency(vendasPerdidas.valorEstimado)}</strong></div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="box-card hover-effect span-1">
              <div className="box-header flex-between">
                  <h3 className="flex-center-gap"><Layers size={18} className="icon-main"/> Curva ABC ({labelPeriodo}) <InfoTooltip text="Curva A representa 80% do seu faturamento. Nunca deixe faltar."/></h3>
                  <span className="ia-badge main">Estratégia</span>
              </div>
              <div className="ranking-list compact abc-list mt-3">
                {produtosABC.length > 0 ? produtosABC.map((prod, i) => (
                    <div key={i} className="ranking-item">
                      <div className="rank-pos" style={{background: prod.cor, color: 'white', fontWeight: 'bold'}}>{prod.curva}</div>
                      <div className="rank-info">
                        <div className="rank-text">
                            <span className="rank-name" style={{maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={prod.nome}>{prod.nome}</span>
                            <span className="rank-val">{formatCurrency(prod.valor)}</span>
                        </div>
                        <div className="progress-bg"><div className="progress-fill" style={{width: `${Math.max(1, prod.percentual)}%`, background: prod.cor}}></div></div>
                      </div>
                    </div>
                )) : <p className="empty-state">Sem faturamento suficiente neste período.</p>}
              </div>
            </div>

            <div className="tax-widget hover-effect">
               <h3 className="flex-center-gap"><Landmark size={18}/> Simulador Tributário <InfoTooltip text="Provisão de Impostos do Período."/></h3>
               <div className="tax-value-box"><h2>{formatCurrency(impostoMes)}</h2><span className="tax-tag">Simples Nacional (4%)</span></div>
               <div className="tax-split-box">
                  <div className="tax-row"><span>DAS Aproximado</span><strong>{formatCurrency(impostoMes)}</strong></div>
               </div>
               <NanoInsightIA insight="A IA cruzou o NCM dos produtos e verificou os itens faturados." tipo="info" />
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