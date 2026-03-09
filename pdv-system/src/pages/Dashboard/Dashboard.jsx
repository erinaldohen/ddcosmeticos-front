import React, { useEffect, useState, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as TooltipChart,
  BarChart, Bar, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  DollarSign, ShoppingBag, Activity, Clock, RefreshCcw,
  CreditCard, Sparkles, Target, AlertCircle, Package, HeartHandshake,
  TrendingDown, Landmark, Zap, Scale, Tag, PieChart as PieChartIcon, ArchiveX, CalendarClock, Globe, Flag,
  TrendingUp, BarChart2, Layers, HelpCircle, X, ChevronDown, Filter
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

const NanoInsightIA = ({ insight, tipo = 'info' }) => (
  <div className={`nano-insight insight-${tipo}`}>
    <Sparkles size={14} className={`insight-icon icon-${tipo}`} />
    <span className={`insight-text text-${tipo}`}>{insight}</span>
  </div>
);

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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="ct-label">{`${label}`}</p>
        <p className="ct-val">{`${payload[0].value} cupons gerados`}</p>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [analiseMensal, setAnaliseMensal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [errorStatus, setErrorStatus] = useState(false);
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);

  // Estados de Interface
  const [abaAtiva, setAbaAtiva] = useState('financeiro'); // 'financeiro', 'comercial', 'operacao'
  const [modalDrillDown, setModalDrillDown] = useState(null);
  const [listaDrillDown, setListaDrillDown] = useState([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState('este_mes');

  // Observer para largura de gráficos (Correção de redimensionamento ao trocar abas)
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) setChartWidth(entries[0].contentRect.width);
    });
    if (chartContainerRef.current) observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [abaAtiva, loading]);

  useEffect(() => {
    carregarDados();
    const intervalId = setInterval(() => carregarDados(true), 60000);
    return () => clearInterval(intervalId);
  }, [filtroPeriodo]);

  // Hook para buscar a lista detalhada do modal de risco
  useEffect(() => {
      if (modalDrillDown) {
        setListaDrillDown([]); // Limpa a lista antes de buscar a nova
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
      const [dashRes, analiseRes] = await Promise.all([
        api.get(`/dashboard?periodo=${filtroPeriodo}`),
        api.get('/contas-pagar/analise-mensal').catch(() => ({ data: { custoFixoPrevisto: 0 } }))
      ]);
      setData(dashRes.data);
      setAnaliseMensal(analiseRes.data);
      setLastUpdate(new Date());
    } catch (err) {
      setErrorStatus(true);
    } finally { if (!isSilent) setLoading(false); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  if (loading && !data) return <DashboardSkeleton />;

  const payload = data?.data || data?.body || data || {};
  const fin = payload.financeiro || {};
  const inv = payload.inventario || {};
  const ia = payload.inteligencia || {};

  const META_DIARIA = payload.metaDiaria ? Number(payload.metaDiaria) : 1500;
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
  const faturamentoMes = graficoEvolucao.reduce((acc, curr) => acc + curr.total, 0);
  const taxaMargemMensal = faturamento > 0 ? ((lucroBruto - (faturamento * 0.04)) / faturamento) : 0.40;
  const margemAcumuladaMes = faturamentoMes * taxaMargemMensal;

  const custoFixoMes = analiseMensal?.custoFixoPrevisto || 0;
  const progressoEquilibrio = custoFixoMes > 0 ? Math.min(100, (margemAcumuladaMes / custoFixoMes) * 100) : 0;
  const faltaParaPagar = Math.max(0, custoFixoMes - margemAcumuladaMes);
  const lucroLiquidoRealMes = Math.max(0, margemAcumuladaMes - custoFixoMes);

  const META_MENSAL = payload.metaMensal ? Number(payload.metaMensal) : 0;
  const progressoMetaMensal = META_MENSAL > 0 ? Math.min(100, (faturamentoMes / META_MENSAL) * 100) : 0;
  const runRate = Number(fin.runRate || 0);

  const crescimentoMoM = Number(fin.crescimentoMoM || 0);
  const isCrescimentoPositivo = crescimentoMoM >= 0;
  const roiIAValor = Number(ia.roiValor || 0);
  const roiIAItens = Number(ia.roiItens || 0);
  const mapaDeCalor = Array.isArray(fin.vendasPorHora) ? fin.vendasPorHora : [];

  const origemVendasRaw = Array.isArray(fin.origemVendas) ? fin.origemVendas : [];
  const origemVendas = origemVendasRaw.length > 0 ? origemVendasRaw.map(o => {
      const nomeSafe = String(o.name || 'Outros').toLowerCase();
      return { ...o, value: Number(o.value || 0), fill: nomeSafe.includes('loja') ? '#3b82f6' : nomeSafe.includes('whatsapp') ? '#10b981' : '#f59e0b' };
  }) : [{ name: 'Aguardando', value: 1, fill: '#e2e8f0' }];

  const estoqueCurvaC = inv.estoqueCurvaC || { itens: 0, valorImobilizado: 0 };
  const produtosVencendo = inv.produtosVencendo || { itens: 0, valorRisco: 0 };
  const taxaRecorrencia = Number(fin.taxaRecorrencia || 0);
  const fluxo7Dias = fin.fluxoCaixa7Dias || { receitasPrevistas: 0, despesasPrevistas: 0, saldoProjetado: 0 };
  const vendasPerdidas = inv.vendasPerdidas || { quantidade: 0, valorEstimado: 0 };

  const topProdutos = Array.isArray(payload.topProdutos) ? payload.topProdutos.slice(0, 5) : [];
  const topCategorias = Array.isArray(payload.topCategorias) ? payload.topCategorias.slice(0, 5) : [];
  const performanceVendedores = Array.isArray(payload.performanceVendedores) ? payload.performanceVendedores : [];

  const formasPagamento = Array.isArray(fin.formasPagamento) && fin.formasPagamento.length > 0
    ? fin.formasPagamento.map(p => ({ ...p, fill: String(p.name).toUpperCase().includes('PIX') ? '#10b981' : '#3b82f6' }))
    : [{ name: 'Aguardando', value: 1, fill: '#e2e8f0' }];

  const gerarDiagnosticoGestor = () => {
    let analise = [];
    if (progressoEquilibrio >= 100) analise.push("🏆 MÊS PAGO! A loja cobriu os custos fixos.");
    else analise.push(`⚠️ Falta ${formatCurrency(faltaParaPagar)} para cobrir custos fixos.`);
    if (isCrescimentoPositivo) analise.push(`📈 Faturamento crescendo ${crescimentoMoM.toFixed(1)}% (MoM).`);
    if (produtosVencendo.itens > 0) analise.push(`🚨 Crie promoções para os ${produtosVencendo.itens} produtos vencendo.`);
    return analise.join(" ");
  };

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Central Executiva</h1>
          <p className="dash-subtitle">Gestão de Varejo Inteligente • DD Cosméticos</p>
        </div>
        <div className="dash-actions">
          <div className="period-filter">
             <Filter size={16} className="filter-icon" />
             <select value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)}>
                <option value="hoje">Apenas Hoje</option>
                <option value="este_mes">Este Mês</option>
                <option value="mes_passado">Mês Passado</option>
             </select>
             <ChevronDown size={14} className="filter-arrow" />
          </div>
          {errorStatus && <span className="dash-error-badge"><AlertCircle size={14} /> Offline</span>}
          <span className="dash-time"><Clock size={14} /> {lastUpdate.toLocaleTimeString()}</span>
          <button className="btn-refresh" onClick={() => carregarDados(false)}><RefreshCcw size={16}/> Sincronizar</button>
        </div>
      </header>

      <AlertasAuditoria />

      <div className="ai-insight-box">
        <div className="ai-icon-glow"><Zap size={24} color="white" /></div>
        <div className="ai-content">
          <h4>Copiloto Gerencial DD</h4>
          <p>{gerarDiagnosticoGestor()}</p>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS */}
      <div className="dash-tabs">
        <button className={abaAtiva === 'financeiro' ? 'active' : ''} onClick={() => setAbaAtiva('financeiro')}>📊 Resumo Financeiro</button>
        <button className={abaAtiva === 'comercial' ? 'active' : ''} onClick={() => setAbaAtiva('comercial')}>🧠 Inteligência Comercial</button>
        <button className={abaAtiva === 'operacao' ? 'active' : ''} onClick={() => setAbaAtiva('operacao')}>🛡️ Operação & Risco</button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: RESUMO FINANCEIRO E METAS                                          */}
      {/* ========================================================================= */}
      {abaAtiva === 'financeiro' && (
        <section className="dash-block animate-fade-in">
            <div className="dash-top-grid triple">
              <div className="break-even-widget be-purple">
                <div className="widget-header">
                    <div><h3 className="flex-center-gap"><Flag size={20} className="icon-purple"/> Termômetro do Mês <InfoTooltip text="Progresso da meta mensal definida."/></h3></div>
                    <div className="widget-status">
                      <span>META: {formatCurrency(META_MENSAL)}</span>
                      <h4 className={progressoMetaMensal >= 100 ? 'text-success' : 'text-purple'}>{progressoMetaMensal >= 100 ? `BATIDA!` : `FALTAM: ${formatCurrency(Math.max(0, META_MENSAL - faturamentoMes))}`}</h4>
                    </div>
                </div>
                <div className="progress-bar-container"><div className={`progress-bar-fill ${progressoMetaMensal >= 100 ? 'bg-success-grad' : 'bg-purple-grad'}`} style={{ width: `${progressoMetaMensal}%` }}></div></div>
                <div className="widget-footer"><span>Faturado: <b>{formatCurrency(faturamentoMes)}</b></span><span>{progressoMetaMensal.toFixed(1)}%</span></div>
                <NanoInsightIA insight={`Neste ritmo (Run Rate), fechará em: ${formatCurrency(runRate)}`} tipo={runRate >= META_MENSAL ? "success" : "warning"} />
              </div>

              <div className="break-even-widget">
                <div className="widget-header">
                    <div><h3 className="flex-center-gap"><Scale size={20} className="icon-blue"/> Ponto de Equilíbrio <InfoTooltip text="Verifica se a margem gerada cobriu os custos fixos."/></h3></div>
                    <div className="widget-status">
                      <span>STATUS</span>
                      <h4 className={progressoEquilibrio >= 100 ? 'text-success' : 'text-warning'}>{progressoEquilibrio >= 100 ? `LUCRO: + ${formatCurrency(lucroLiquidoRealMes)}` : `FALTAM: ${formatCurrency(faltaParaPagar)}`}</h4>
                    </div>
                </div>
                <div className="progress-bar-container"><div className={`progress-bar-fill ${progressoEquilibrio >= 100 ? 'bg-success-grad' : 'bg-blue-grad'}`} style={{ width: `${progressoEquilibrio}%` }}></div></div>
                <div className="widget-footer"><span>Margem Limpa: <b>{formatCurrency(margemAcumuladaMes)}</b></span><span>Custos: {formatCurrency(custoFixoMes)}</span></div>
                <NanoInsightIA insight={progressoEquilibrio >= 100 ? "A loja já se pagou neste mês!" : "Foco em produtos de margem alta."} tipo={progressoEquilibrio >= 100 ? "success" : "warning"} />
              </div>

              <div className="box-card hover-effect cashflow-box">
                <div className="box-header">
                  <h3 className="flex-center-gap"><Activity size={18} className="icon-blue"/> Projeção 7 Dias <InfoTooltip text="Contas a pagar estimadas vs faturamento futuro."/></h3>
                  <span className="ia-badge blue">Caixa</span>
                </div>
                <div className="cf-body">
                  <div className="cf-row"><span className="cf-label text-success">A Receber Est.</span><strong className="cf-val text-success">+{formatCurrency(fluxo7Dias.receitasPrevistas)}</strong></div>
                  <div className="cf-row"><span className="cf-label text-danger">A Pagar Est.</span><strong className="cf-val text-danger">-{formatCurrency(fluxo7Dias.despesasPrevistas)}</strong></div>
                  <div className="cf-divider"></div>
                  <div className="cf-row total"><span className="cf-label">Saldo Projetado</span><strong className={`cf-val ${fluxo7Dias.saldoProjetado >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(fluxo7Dias.saldoProjetado)}</strong></div>
                </div>
              </div>
            </div>

            <div className="dash-kpi-grid">
              <div className="kpi-card hover-effect kpi-pink"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Faturamento <InfoTooltip text="Total faturado no dia de hoje."/></span><div className={`mom-badge ${isCrescimentoPositivo ? 'mom-up' : 'mom-down'}`} title="Crescimento sobre mês passado">{isCrescimentoPositivo ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}{Math.abs(crescimentoMoM).toFixed(1)}%</div></div><h2 className="kpi-value">{formatCurrency(faturamento)}</h2></div></div>
              <div className="kpi-card hover-effect kpi-indigo"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Fundo CMV <InfoTooltip text="Custo dos produtos vendidos hoje."/></span><RefreshCcw size={18} className="kpi-icon"/></div><h2 className="kpi-value">{formatCurrency(valorReposicao)}</h2></div></div>
              <div className="kpi-card hover-effect kpi-green"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Margem Limpa <InfoTooltip text="Lucro Bruto menos impostos estimados."/></span><TrendingDown size={18} className="kpi-icon"/></div><h2 className="kpi-value">{formatCurrency(lucroBruto - (faturamento*0.04))}</h2></div></div>
              <div className="kpi-card hover-effect kpi-blue"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Qtde. Vendas <InfoTooltip text="Número de cupons emitidos hoje."/></span><ShoppingBag size={18} className="kpi-icon"/></div><h2 className="kpi-value">{vendasQtd} <span className="text-small">cupons</span></h2></div></div>
              <div className="kpi-card hover-effect kpi-purple"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Ticket Médio <InfoTooltip text="Valor médio gasto por cupom."/></span><CreditCard size={18} className="kpi-icon"/></div><h2 className="kpi-value">{formatCurrency(ticketMedio)}</h2></div></div>
              <div className="kpi-card hover-effect kpi-orange"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Mix / Cesta <InfoTooltip text="Média de itens distintos no carrinho."/></span><Package size={18} className="kpi-icon"/></div><h2 className="kpi-value">{produtosDistintos} <span className="text-small">itens</span></h2></div></div>
              <div className="kpi-card hover-effect kpi-red"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Descontos <InfoTooltip text="Soma de descontos cedidos hoje."/></span><Tag size={18} className="kpi-icon"/></div><h2 className={`kpi-value ${percentualDesconto > 5 ? 'text-danger' : 'text-main'}`}>{formatCurrency(descontosHoje)}</h2></div></div>
              <div className="kpi-card hover-effect kpi-rose"><div className="kpi-info"><div className="kpi-info-header"><span className="kpi-label flex-center-gap">Fidelidade <InfoTooltip text="% de clientes do dia que são recorrentes."/></span><HeartHandshake size={18} className="kpi-icon"/></div><h2 className="kpi-value">{taxaRecorrencia.toFixed(1)}<span className="text-small">%</span></h2></div></div>
            </div>

            <div className="chart-box main-chart hover-effect" ref={chartContainerRef}>
                <div className="box-header"><h3 className="flex-center-gap"><Activity size={18}/> Evolução de Faturamento Mensal <InfoTooltip text="Acompanhamento diário das receitas."/></h3></div>
                <div className="chart-content">
                  {graficoEvolucao.length > 0 ? (
                    <AreaChart width={chartWidth || 800} height={250} data={graficoEvolucao}>
                      <defs><linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}}/>
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} tickFormatter={(v) => `R$${v}`}/>
                      <TooltipChart formatter={(val) => [formatCurrency(val), 'Faturamento']} />
                      <Area type="monotone" dataKey="total" stroke="#ec4899" strokeWidth={3} fill="url(#colorFat)" />
                    </AreaChart>
                  ) : <div className="empty-state">Aguardando dados de vendas.</div>}
                </div>
            </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: INTELIGÊNCIA COMERCIAL E COMPORTAMENTO                             */}
      {/* ========================================================================= */}
      {abaAtiva === 'comercial' && (
        <section className="dash-block animate-fade-in">
          <div className="dash-charts-grid split-2">
            <div className="chart-box hover-effect heatmap-box">
              <div className="box-header"><h3 className="flex-center-gap"><BarChart2 size={18}/> Horários de Pico <InfoTooltip text="Fluxo de cupons emitidos por hora."/></h3></div>
              <div className="chart-content flex-center">
                 {mapaDeCalor.length > 0 ? (
                     <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={mapaDeCalor} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <XAxis dataKey="horaStr" tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false}/>
                            <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false}/>
                            <TooltipChart content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
                            <Bar dataKey="qtd" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                 ) : <div className="empty-state">Sem fluxo hoje.</div>}
              </div>
            </div>

            <div className="chart-box hover-effect">
              <div className="box-header"><h3 className="flex-center-gap"><Globe size={18}/> Origem de Venda <InfoTooltip text="Divisão de vendas (Loja Física vs WhatsApp)."/></h3></div>
              <div className="chart-content flex-center">
                 <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={origemVendas} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                        {origemVendas.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <TooltipChart formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-box hover-effect">
              <div className="box-header"><h3 className="flex-center-gap"><PieChartIcon size={18}/> Meios de Pagamento <InfoTooltip text="Preferência de liquidação dos clientes."/></h3></div>
              <div className="chart-content flex-center">
                 <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={formasPagamento} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                        {formasPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <TooltipChart formatter={(value) => formatCurrency(value)} />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
            </div>

            <div className="box-card hover-effect">
              <div className="box-header"><h3 className="flex-center-gap"><Layers size={18} className="icon-blue"/> Top Categorias <InfoTooltip text="Grupos de produtos que mais faturam."/></h3></div>
              <div className="ranking-list compact">
                {topCategorias.length > 0 ? topCategorias.map((cat, i) => {
                  const pct = Math.max(5, (cat.valor / (topCategorias[0]?.valor || 1)) * 100);
                  return (
                    <div key={i} className="ranking-item">
                      <div className="rank-pos">#{i + 1}</div>
                      <div className="rank-info">
                        <div className="rank-text"><span className="rank-name">{cat.nome || 'Diversos'}</span><span className="rank-val">{formatCurrency(cat.valor)}</span></div>
                        <div className="progress-bg"><div className={`progress-fill ${i === 0 ? 'kpi-fill-blue' : 'kpi-fill-neutral'}`} style={{width: `${pct}%`}}></div></div>
                      </div>
                    </div>
                  );
                }) : <p className="empty-state">Aguardando vendas.</p>}
              </div>
            </div>
          </div>

          <div className="dash-bottom-grid split-3 mt-4">
            <div className="box-card hover-effect ia-roi-card">
              <div className="box-header">
                 <h3 className="flex-center-gap"><Sparkles size={18} className="icon-purple"/> Retorno da IA <InfoTooltip text="Receita extra gerada através de sugestões de Cross-Sell no PDV."/></h3>
                 <span className="ia-badge purple">Balcão</span>
              </div>
              <div className="roi-ia-panel">
                  <span className="roi-label">Receita Extra (Mês)</span>
                  <strong className="roi-val">{formatCurrency(roiIAValor)}</strong>
                  <span className="roi-sub">{roiIAItens} produtos adicionados</span>
              </div>
            </div>

            <div className="box-card hover-effect">
              <div className="box-header">
                 <h3 className="flex-center-gap"><Sparkles size={18} className="icon-purple"/> Afinidade de Produtos <InfoTooltip text="Pares de produtos que costumam ser vendidos juntos (Cesta)."/></h3>
                 <span className="ia-badge purple">IA</span>
              </div>
              <div className="ranking-list compact">
                {ia?.afinidade?.length > 0 ? ia.afinidade.map((item, i) => (
                  <div key={i} className="ranking-item-operator ia-combo-row">
                    <div className="operator-avatar ia-combo-icon"><Zap size={14} /></div>
                    <div className="operator-info">
                      <div className="operator-text"><span className="operator-name ia-combo-name">{item.combinacao}</span></div>
                      <span className="operator-sub">Vendido junto {item.quantidade} vezes</span>
                    </div>
                  </div>
                )) : <p className="empty-state">Sem dados suficientes.</p>}
              </div>
            </div>

            <div className="box-card hover-effect">
              <div className="box-header"><h3 className="flex-center-gap"><Target size={18} className="icon-blue"/> Ranking Vendedores <InfoTooltip text="Performance da sua equipa comercial."/></h3></div>
              <div className="ranking-list compact">
                {performanceVendedores.length > 0 ? performanceVendedores.map((vend, i) => (
                  <div key={i} className={`ranking-item-operator ${i === 0 ? 'top-seller' : ''}`}>
                    <div className={`operator-avatar ${i === 0 ? 'top-avatar' : 'neutral-avatar'}`}>{vend.nome ? vend.nome.charAt(0).toUpperCase() : 'U'}</div>
                    <div className="operator-info">
                      <div className="operator-text"><span className="operator-name">{vend.nome || 'Usuário'}</span><span className="operator-val">{formatCurrency(vend.vendas)}</span></div>
                      <span className="operator-sub">{vend.converteu} cupons</span>
                    </div>
                  </div>
                )) : <p className="empty-state">Sem atividade hoje.</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: OPERAÇÃO E GESTÃO DE RISCO                                         */}
      {/* ========================================================================= */}
      {abaAtiva === 'operacao' && (
        <section className="dash-block animate-fade-in">
          <div className="dash-bottom-grid split-3">
            <div className="box-card hover-effect span-1">
              <div className="box-header">
                 <h3 className="flex-center-gap"><ArchiveX size={18} className="icon-danger"/> Alertas Estoque <InfoTooltip text="Itens críticos que exigem promoção. Clique nos cards para ver a lista."/></h3>
              </div>
              <div className="risk-alerts-container">
                 <div className="risk-item warning-glow clickable" onClick={() => setModalDrillDown('vencimento')}>
                    <div className="risk-icon"><CalendarClock size={20} className="icon-danger"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Vencendo nos próximos 60 dias</span>
                       <div className="risk-data"><span className="risk-qtd">{produtosVencendo.itens} itens</span><strong className="risk-val text-danger">{formatCurrency(produtosVencendo.valorRisco)}</strong></div>
                    </div>
                 </div>
                 <div className="risk-item warning-glow mt-3 clickable" onClick={() => setModalDrillDown('curvac')}>
                    <div className="risk-icon"><Package size={20} className="icon-warning"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Curva C (Sem giro &gt; 90d)</span>
                       <div className="risk-data"><span className="risk-qtd">{estoqueCurvaC.itens} itens</span><strong className="risk-val text-warning">{formatCurrency(estoqueCurvaC.valorImobilizado)}</strong></div>
                    </div>
                 </div>
                 <div className="risk-item warning-glow mt-3 lost-sales-item">
                    <div className="risk-icon"><TrendingDown size={20} className="icon-danger"/></div>
                    <div className="risk-info">
                       <span className="risk-title">Ruptura (Vendas Perdidas no PDV)</span>
                       <div className="risk-data"><span className="risk-qtd">{vendasPerdidas.quantidade} registros</span><strong className="risk-val text-danger">{formatCurrency(vendasPerdidas.valorEstimado)}</strong></div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="box-card hover-effect span-1">
              <div className="box-header"><h3 className="flex-center-gap"><ShoppingBag size={18} className="icon-premium"/> Curva ABC <InfoTooltip text="Os produtos individuais que trazem a maior fatia de faturamento."/></h3></div>
              <div className="ranking-list compact">
                {topProdutos.length > 0 ? topProdutos.map((prod, i) => {
                  const pct = Math.max(5, (prod.valor / (topProdutos[0]?.valor || 1)) * 100);
                  return (
                    <div key={i} className="ranking-item">
                      <div className="rank-pos">#{i + 1}</div>
                      <div className="rank-info">
                        <div className="rank-text"><span className="rank-name">{prod.nome || 'Produto'}</span><span className="rank-val">{formatCurrency(prod.valor)}</span></div>
                        <div className="progress-bg"><div className={`progress-fill ${i === 0 ? 'kpi-fill-pink' : 'kpi-fill-neutral'}`} style={{width: `${pct}%`}}></div></div>
                      </div>
                    </div>
                  );
                }) : <p className="empty-state">Aguardando vendas.</p>}
              </div>
            </div>

            <div className="tax-widget hover-effect">
               <h3 className="flex-center-gap"><Landmark size={18}/> Provisão de Imposto <InfoTooltip text="Imposto simulado acumulado para repasse ao contador."/></h3>
               <div className="tax-value-box"><h2>{formatCurrency(impostoMes)}</h2><span className="tax-tag">4,00% (Anexo I)</span></div>
               <div className="tax-split-box">
                  <div className="tax-row"><span>Federal</span><strong>{formatCurrency(impostoMes * 0.74)}</strong></div>
                  <div className="tax-row"><span>Estadual</span><strong>{formatCurrency(impostoMes * 0.26)}</strong></div>
               </div>
               <NanoInsightIA insight="Lembre-se que produtos monofásicos abaterão este valor final." tipo="info" />
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE DRILL DOWN (AÇÃO IMEDIATA)                                       */}
      {/* ========================================================================= */}
      {modalDrillDown && (
          <div className="modal-glass">
              <div className="modal-glass-card list-modal fade-in">
                  <div className="modal-header-flex">
                      <h3>{modalDrillDown === 'vencimento' ? '🚨 Lista: Vencendo em 60 dias' : '📦 Lista: Parados na Curva C'}</h3>
                      <button className="btn-close-modal" onClick={() => setModalDrillDown(null)}><X size={20}/></button>
                  </div>
                  <p className="modal-description">
                      {modalDrillDown === 'vencimento' ? 'Crie uma promoção imediata para estes itens antes que estraguem.' : 'Estoque imobilizado. Analise descontos para girar o caixa.'}
                  </p>

                  <div className="table-responsive">
                      <table className="drilldown-table">
                          <thead>
                              <tr>
                                  <th>Produto</th>
                                  <th className="text-right">Estoque</th>
                                  <th className="text-right">Custo Total</th>
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
                                  <tr><td colSpan="3" className="empty-table-state">Carregando lista de itens críticos...</td></tr>
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