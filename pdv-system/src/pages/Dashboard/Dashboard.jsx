import React, { useEffect, useState, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as TooltipChart,
  BarChart, Bar, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  DollarSign, ShoppingBag, Activity, Clock, RefreshCcw,
  CreditCard, Users, Sparkles, Target, AlertCircle, Package,
  TrendingDown, Landmark, Zap, Scale, Tag, PieChart as PieChartIcon, Award
} from 'lucide-react';
import api from '../../services/api';
import './Dashboard.css';

// --- COMPONENTE DE INSIGHT DA IA ---
const NanoInsightIA = ({ insight, tipo = 'info' }) => {
  const cores = {
    info: { text: '#3b82f6', bg: '#eff6ff' }, warning: { text: '#f59e0b', bg: '#fffbeb' },
    success: { text: '#10b981', bg: '#ecfdf5' }, danger: { text: '#ef4444', bg: '#fef2f2' },
    premium: { text: '#ec4899', bg: '#fdf2f8' }
  };
  const cor = cores[tipo] || cores.info;
  return (
    <div className="nano-insight" style={{ background: cor.bg, border: `1px solid ${cor.text}30` }}>
      <Sparkles size={14} color={cor.text} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span style={{ color: cor.text }}>{insight}</span>
    </div>
  );
};

// --- COMPONENTE DE SKELETON LOADING ---
const DashboardSkeleton = () => (
  <div className="dash-wrapper">
    <div className="dash-header"><div className="skeleton" style={{width: '250px', height: '40px'}}></div></div>
    <div className="dash-top-grid">
      <div className="skeleton" style={{height: '180px', borderRadius: '16px'}}></div>
      <div className="skeleton" style={{height: '180px', borderRadius: '16px'}}></div>
    </div>
    <div className="dash-kpi-grid">
      {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{height: '160px', borderRadius: '16px'}}></div>)}
    </div>
  </div>
);

// --- RENDERIZADOR DE PORCENTAGEM NO GRÁFICO DE PIZZA ---
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
  if (percent < 0.05) return null; // Oculta a porcentagem se a fatia for muito pequena (< 5%)
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.4)' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [analiseMensal, setAnaliseMensal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [errorStatus, setErrorStatus] = useState(false);

  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    carregarDados();
    const intervalId = setInterval(() => carregarDados(true), 60000);
    const resizeObserver = new ResizeObserver((entries) => { if (entries[0]) setChartWidth(entries[0].contentRect.width); });
    if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current);
    return () => { resizeObserver.disconnect(); clearInterval(intervalId); };
  }, []);

  const carregarDados = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setErrorStatus(false);
    try {
      const [dashRes, analiseRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/contas-pagar/analise-mensal').catch(() => ({ data: { custoFixoPrevisto: 0 } }))
      ]);
      setData(dashRes.data);
      setAnaliseMensal(analiseRes.data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Erro no Dashboard:", err);
      setErrorStatus(true);
    } finally { if (!isSilent) setLoading(false); }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  if (loading && !data) return <DashboardSkeleton />;

  const payload = data?.data || data?.body || data || {};
  const fin = payload.financeiro || {};
  const inv = payload.inventario || {};

  // EXTRAÇÕES DIÁRIAS
  const META_DIARIA = payload.metaDiaria ? Number(payload.metaDiaria) : 1500;
  const faturamento = Number(fin.faturamentoHoje || 0);
  const lucroBruto = Number(fin.lucroBrutoHoje || 0);
  const valorReposicao = Number(fin.custoTotalReposicaoHoje || 0);
  const vendasQtd = Number(fin.vendasHoje || 0);
  const ticketMedio = Number(fin.ticketMedio || (vendasQtd > 0 ? faturamento / vendasQtd : 0));
  const progressoMeta = Math.min(100, (faturamento / META_DIARIA) * 100);

  const produtosDistintos = Number(fin.produtosDistintosPorVenda || 0).toFixed(2);
  const descontosHoje = Number(fin.descontosHoje || 0);
  const percentualDesconto = faturamento > 0 ? (descontosHoje / (faturamento + descontosHoje)) * 100 : 0;

  const faixaSimplesNacional = fin.faixaSimples || "4,00% (Anexo I)";
  const taxaSimplesNum = parseFloat(faixaSimplesNacional.replace(',', '.').replace(/[^0-9.]/g, '')) || 4.0;
  const impostoDiarioEstimado = faturamento * (taxaSimplesNum / 100);
  const margemContribuicaoReal = lucroBruto - impostoDiarioEstimado;
  const percentualMargem = faturamento > 0 ? (margemContribuicaoReal / faturamento) * 100 : 0;

  // IMPOSTOS MENSAIS
  const impostoMes = Number(fin.impostoProvisorioMes || 0);
  const impostoFederal = Number(fin.impostoFederal || 0);
  const impostoEstadual = Number(fin.impostoEstadual || 0);

  // EXTRAÇÕES MENSAIS E SAÚDE
  const graficoEvolucao = Array.isArray(fin.graficoVendas) ? fin.graficoVendas.map(i => ({ dia: i.data || '', total: Number(i.total || 0) })) : [];
  const faturamentoMes = graficoEvolucao.reduce((acc, curr) => acc + curr.total, 0);
  const taxaMargemMensal = faturamento > 0 ? (margemContribuicaoReal / faturamento) : 0.40;
  const margemAcumuladaMes = faturamentoMes * taxaMargemMensal;

  const custoFixoMes = analiseMensal?.custoFixoPrevisto || 0;
  const progressoEquilibrio = custoFixoMes > 0 ? Math.min(100, (margemAcumuladaMes / custoFixoMes) * 100) : 0;
  const faltaParaPagar = Math.max(0, custoFixoMes - margemAcumuladaMes);
  const lucroLiquidoRealMes = Math.max(0, margemAcumuladaMes - custoFixoMes);

  // LISTAS E GRÁFICOS
  const rupturaEstoque = inv.indiceRuptura || 0;
  const mapaDeCalor = Array.isArray(fin.vendasPorHora) ? fin.vendasPorHora.map(i => ({ horaStr: i.horaStr || '', qtd: Number(i.qtd || 0) })) : [];
  const topProdutos = Array.isArray(payload.topProdutos) ? payload.topProdutos.slice(0, 5) : [];
  const performanceVendedores = Array.isArray(payload.performanceVendedores) ? payload.performanceVendedores : [];
  const topCategorias = Array.isArray(payload.topCategorias) ? payload.topCategorias.slice(0, 3) : [];

  // MAPEMANETO INTELIGENTE DE CORES PARA FORMAS DE PAGAMENTO
  const getPaymentColor = (name) => {
      const n = name.toUpperCase();
      if(n.includes('PIX')) return '#10b981'; // Verde Esmeralda (Dinheiro imediato)
      if(n.includes('CREDITO') || n.includes('CRÉDITO')) return '#3b82f6'; // Azul (Padrão para crédito)
      if(n.includes('DEBITO') || n.includes('DÉBITO')) return '#8b5cf6'; // Roxo (Cartão de Débito)
      if(n.includes('DINHEIRO')) return '#f59e0b'; // Laranja/Âmbar (Destaca bem do verde)
      if(n.includes('CREDIARIO') || n.includes('CREDIÁRIO') || n.includes('BOLETO')) return '#ec4899'; // Rosa
      return '#94a3b8'; // Cinza Ardósia para "Outros"
    };

  const formasPagamento = Array.isArray(fin.formasPagamento) && fin.formasPagamento.length > 0
    ? fin.formasPagamento.map(p => ({ ...p, fill: getPaymentColor(p.name) }))
    : [{ name: 'Aguardando', value: 1, fill: '#e2e8f0' }];

  // =========================================================================
  // MOTORES DE INTELIGÊNCIA ARTIFICIAL
  // =========================================================================

  const gerarDiagnosticoGestor = () => {
    let analise = [];
    if (custoFixoMes > 0) {
      if (progressoEquilibrio >= 100) analise.push("🏆 MÊS PAGO! A loja cobriu os custos fixos. Margem gerada a partir de agora é Lucro Líquido.");
      else if (progressoEquilibrio > 75) analise.push("📈 Reta final para o Ponto de Equilíbrio do mês. Pouco esforço para lucrar.");
      else analise.push(`⚠️ Foco em Caixa: A loja precisa de mais ${formatCurrency(faltaParaPagar)} de margem limpa para honrar os custos fixos.`);
    } else {
      analise.push("📝 Cadastre as despesas fixas no módulo 'Contas a Pagar' para a IA calcular o Ponto de Equilíbrio.");
    }
    return analise.join(" ");
  };

  const getBreakEvenInsight = () => progressoEquilibrio >= 100 ? { text: "Operação saudável e gerando lucro.", type: "success" } : { text: "Operação em fase de pagamento de custos.", type: "warning" };
  const getDasInsight = () => impostoMes > 0 ? { text: "Provisão em tempo real. Monofásicos irão abater o valor final.", type: "info" } : { text: "Aguardando fluxo de vendas.", type: "info" };
  const getFaturamentoInsight = () => progressoMeta >= 100 ? { text: `Superávit: + ${formatCurrency(faturamento - META_DIARIA)} sobre a meta.`, type: 'success' } : { text: `Faltam ${formatCurrency(META_DIARIA - faturamento)} para a meta.`, type: 'premium' };
  const getReposicaoInsight = () => valorReposicao > 0 ? { text: `Não gaste este valor. Ele mantém seu estoque girando.`, type: 'warning' } : { text: "Custo de reposição (CMV).", type: 'info' };
  const getVendasInsight = () => vendasQtd > 0 ? { text: "Pace de conversão ativo na loja física.", type: 'success' } : { text: "Caixa ocioso. Faça uma oferta flash.", type: 'info' };
  const getMargemInsight = () => percentualMargem < 25 && faturamento > 0 ? { text: `Margem de ${percentualMargem.toFixed(1)}% está baixa.`, type: 'danger' } : { text: `Sobra R$ ${(margemContribuicaoReal/(vendasQtd||1)).toFixed(2)} livre por cupom.`, type: 'success' };
  const getDescontoInsight = () => percentualDesconto > 5 ? { text: "Atenção: Descontos corroendo a lucratividade.", type: 'danger' } : { text: "Taxa de desconto perfeitamente controlada.", type: 'success' };
  const getTicketInsight = () => ticketMedio < 45 && vendasQtd > 0 ? { text: "Baixo. Peça aos caixas para sugerir upsell.", type: 'warning' } : { text: "Ticket médio correspondendo ao padrão.", type: 'success' };
  const getMixInsight = () => produtosDistintos <= 1 && vendasQtd > 0 ? { text: "Atenção: Cross-sell nulo. Ninguém leva 2 itens.", type: 'danger' } : { text: "Excelente diversificação de carrinho.", type: 'success' };

  const getEvolucaoInsight = () => {
    const projecao = faturamentoMes > 0 ? ((faturamentoMes / Math.max(1, new Date().getDate())) * 30) : 0;
    return projecao > 0 ? {text: `Projetando fechar o mês com ${formatCurrency(projecao)}.`, type: "premium"} : {text: "Aguardando dados.", type: "info"};
  };
  const getPagamentoInsight = () => {
    if (formasPagamento[0].name === 'Aguardando') return {text: "Métricas de liquidez em breve.", type: "info"};
    const topPag = formasPagamento.reduce((a, b) => (a.value > b.value ? a : b), {value: 0});
    return topPag.name.includes('PIX') || topPag.name.includes('DINHEIRO') ? {text: `${topPag.name} em alta. Ótimo para liquidez e caixa.`, type: "success"} : {text: `Maioria das vendas parceladas. Atenção ao caixa.`, type: "warning"};
  };
  const getFluxoInsight = () => {
    if (mapaDeCalor.length === 0) return {text: "Aguardando formação de tráfego.", type: "info"};
    const pico = mapaDeCalor.reduce((a, b) => (a.qtd > b.qtd ? a : b), {qtd: 0});
    return pico.qtd > 0 ? {text: `Pico de atendimentos detectado às ${pico.horaStr}.`, type: "premium"} : {text: "Distribuição linear de clientes.", type: "info"};
  };
  const getAbcInsight = () => topProdutos.length > 0 ? {text: `${topProdutos[0].nome} lidera as vendas.`, type: "success"} : {text: "Ranking em construção.", type: "info"};
  const getCatInsight = () => topCategorias.length > 0 ? {text: `Demanda focada em ${topCategorias[0].nome}.`, type: "premium"} : {text: "Análise de categoria pendente.", type: "info"};
  const getVendInsight = () => performanceVendedores.length > 0 ? {text: `${performanceVendedores[0].nome} lidera fechamentos.`, type: "success"} : {text: "Aguardando comissões.", type: "info"};

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Central Executiva</h1>
          <p className="dash-subtitle">Gestão de Varejo Inteligente • DD Cosméticos</p>
        </div>
        <div className="dash-actions">
          {errorStatus && <span style={{ color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={14} /> Offline</span>}
          <span className="dash-time"><Clock size={14} /> Atualizado: {lastUpdate.toLocaleTimeString()}</span>
          <button className="btn-refresh" onClick={() => carregarDados(false)}><RefreshCcw size={16}/> Sincronizar</button>
        </div>
      </header>

      {/* COPILOTO EXECUTIVO */}
      <div className="ai-insight-box">
        <div className="ai-icon-glow"><Zap size={24} color="white" /></div>
        <div className="ai-content">
          <h4>Copiloto Gerencial DD</h4>
          <p>{gerarDiagnosticoGestor()}</p>
        </div>
      </div>

      {/* TOPO: BREAK-EVEN E IMPOSTOS */}
      <div className="dash-top-grid">
        <div className="break-even-widget">
          <div className="widget-header">
              <div>
                <h3><Scale size={20} color="#3b82f6"/> Saúde Financeira do Mês</h3>
                <p>Margem Acumulada vs Custos Fixos.</p>
              </div>
              <div className="widget-status">
                <span>STATUS</span>
                <h4 style={{ color: progressoEquilibrio >= 100 ? '#10b981' : '#f59e0b' }}>
                  {progressoEquilibrio >= 100 ? `LUCRO: + ${formatCurrency(lucroLiquidoRealMes)}` : `FALTAM: ${formatCurrency(faltaParaPagar)}`}
                </h4>
              </div>
          </div>
          <div className="progress-bar-container">
             <div className="progress-bar-fill" style={{ width: `${progressoEquilibrio}%`, background: progressoEquilibrio >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}></div>
             <div className="progress-bar-goal"></div>
          </div>
          <div className="widget-footer">
              <span>Margem Gerada: <b>{formatCurrency(margemAcumuladaMes)}</b></span>
              <span>Custo Fixo: {formatCurrency(custoFixoMes)}</span>
          </div>
          <NanoInsightIA insight={getBreakEvenInsight().text} tipo={getBreakEvenInsight().type} />
        </div>

        <div className="tax-widget">
           <h3><Landmark size={18}/> Provisão de Imposto (DAS)</h3>
           <div className="tax-value-box">
              <h2>{formatCurrency(impostoMes)}</h2>
              <span className="tax-tag">{faixaSimplesNacional}</span>
           </div>
           <div className="tax-split-box">
              <div className="tax-row"><span>Federal (Receita)</span><strong>{formatCurrency(impostoFederal)}</strong></div>
              <div className="tax-row"><span>Estadual (SEFAZ-PE)</span><strong>{formatCurrency(impostoEstadual)}</strong></div>
           </div>
           <NanoInsightIA insight={getDasInsight().text} tipo={getDasInsight().type} />
        </div>
      </div>

      {/* CLUSTER 1: PULSO DIÁRIO */}
      <div className="dash-kpi-grid">
        <div className="kpi-card hover-effect kpi-pink">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Faturamento</span><DollarSign size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{formatCurrency(faturamento)}</h2>
            <div className="progress-bg"><div className="progress-fill" style={{width: `${progressoMeta}%`, background: '#ec4899'}}></div></div>
          </div>
          <NanoInsightIA insight={getFaturamentoInsight().text} tipo={getFaturamentoInsight().type} />
        </div>

        <div className="kpi-card hover-effect kpi-indigo">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Fundo de Reposição</span><RefreshCcw size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{formatCurrency(valorReposicao)}</h2>
          </div>
          <NanoInsightIA insight={getReposicaoInsight().text} tipo={getReposicaoInsight().type} />
        </div>

        <div className="kpi-card hover-effect kpi-blue">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Qtde. Vendas</span><ShoppingBag size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{vendasQtd} <span>cupons</span></h2>
          </div>
          <NanoInsightIA insight={getVendasInsight().text} tipo={getVendasInsight().type} />
        </div>

        <div className="kpi-card hover-effect kpi-green">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Margem Limpa</span><TrendingDown size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value" style={{color: margemContribuicaoReal >= 0 ? '#0f172a' : '#ef4444'}}>{formatCurrency(margemContribuicaoReal)}</h2>
          </div>
          <NanoInsightIA insight={getMargemInsight().text} tipo={getMargemInsight().type} />
        </div>

        <div className="kpi-card hover-effect kpi-red">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Descontos</span><Tag size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value" style={{color: percentualDesconto > 5 ? '#ef4444' : '#0f172a'}}>{formatCurrency(descontosHoje)}</h2>
          </div>
          <NanoInsightIA insight={getDescontoInsight().text} tipo={getDescontoInsight().type} />
        </div>

        <div className="kpi-card hover-effect kpi-purple">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Ticket Médio</span><CreditCard size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{formatCurrency(ticketMedio)}</h2>
          </div>
          <NanoInsightIA insight={getTicketInsight().text} tipo={getTicketInsight().type} />
        </div>

        <div className="kpi-card hover-effect kpi-orange">
          <div className="kpi-info">
            <div className="kpi-info-header"><span className="kpi-label">Mix/Venda</span><Package size={18} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{produtosDistintos} <span>itens</span></h2>
          </div>
          <NanoInsightIA insight={getMixInsight().text} tipo={getMixInsight().type} />
        </div>
      </div>

      {/* CLUSTER 2: GRÁFICOS */}
      <div className="dash-charts-grid">
        <div className="chart-box full-width hover-effect" ref={chartContainerRef}>
          <div className="box-header"><h3><Activity size={18}/> Evolução Mensal</h3></div>
          <div className="chart-content">
            {graficoEvolucao.length > 0 ? (
              <AreaChart width={chartWidth || 600} height={200} data={graficoEvolucao}>
                <defs><linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}}/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} tickFormatter={(v) => `R$${v}`}/>
                <TooltipChart formatter={(val) => [formatCurrency(val), 'Faturamento']} />
                <Area type="monotone" dataKey="total" stroke="#ec4899" strokeWidth={3} fill="url(#colorFat)" />
              </AreaChart>
            ) : <div className="empty-state">Aguardando dados.</div>}
          </div>
          <NanoInsightIA insight={getEvolucaoInsight().text} tipo={getEvolucaoInsight().type} />
        </div>

        {/* GRAFICO PIZZA C/ LABEL CUSTOMIZADO */}
        <div className="chart-box hover-effect">
          <div className="box-header"><h3><PieChartIcon size={18}/> Liquidez e Pagamentos</h3></div>
          <div className="chart-content flex-center">
             <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={formasPagamento}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {formasPagamento.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <TooltipChart formatter={(value) => formatCurrency(value)} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', marginTop: '10px' }} />
                </PieChart>
             </ResponsiveContainer>
          </div>
          <NanoInsightIA insight={getPagamentoInsight().text} tipo={getPagamentoInsight().type} />
        </div>

        {/* GRAFICO FLUXO C/ GRADIENTE SUAVE */}
        <div className="chart-box hover-effect">
          <div className="box-header"><h3><Users size={18}/> Fluxo de Clientes (Hora)</h3></div>
          <div className="chart-content">
            {mapaDeCalor.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={mapaDeCalor} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorFluxo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.9}/>
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="horaStr" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}}/>
                    <YAxis axisLine={false} tickLine={false} hide />
                    <TooltipChart cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="qtd" radius={[6, 6, 0, 0]} fill="url(#colorFluxo)" />
                  </BarChart>
                </ResponsiveContainer>
            ) : <div className="empty-state">Sem fluxo registrado.</div>}
          </div>
          <NanoInsightIA insight={getFluxoInsight().text} tipo={getFluxoInsight().type} />
        </div>
      </div>

      {/* CLUSTER 3: RANKINGS */}
      <div className="dash-bottom-grid">
        <div className="box-card hover-effect">
          <div className="box-header">
             <h3><ShoppingBag size={18} color="#ec4899"/> Curva ABC</h3>
             <span className="ruptura-badge"><AlertCircle size={14}/> Ruptura: {rupturaEstoque}%</span>
          </div>
          <div className="ranking-list">
            {topProdutos.length > 0 ? topProdutos.map((prod, i) => {
              const pct = Math.max(5, (prod.valor / (topProdutos[0]?.valor || 1)) * 100);
              return (
                <div key={i} className="ranking-item">
                  <div className="rank-pos">#{i + 1}</div>
                  <div className="rank-info">
                    <div className="rank-text"><span className="rank-name">{prod.nome}</span><span className="rank-val">{formatCurrency(prod.valor)}</span></div>
                    <div className="progress-bg"><div className="progress-fill" style={{width: `${pct}%`, background: i === 0 ? '#ec4899' : '#cbd5e1'}}></div></div>
                  </div>
                </div>
              );
            }) : <p className="empty-state">Aguardando vendas.</p>}
          </div>
          <NanoInsightIA insight={getAbcInsight().text} tipo={getAbcInsight().type} />
        </div>

        <div className="box-card hover-effect">
          <div className="box-header"><h3><Award size={18} color="#f59e0b"/> Top Categorias</h3></div>
          <div className="ranking-list">
            {topCategorias.length > 0 ? topCategorias.map((cat, i) => (
              <div key={i} className="ranking-item-category">
                <div className="cat-icon">{i + 1}º</div>
                <div className="cat-info">
                  <span className="cat-name">{cat.nome}</span>
                  <span className="cat-val">{formatCurrency(cat.valor)}</span>
                </div>
              </div>
            )) : <p className="empty-state">Aguardando fluxo de vendas.</p>}
          </div>
          <NanoInsightIA insight={getCatInsight().text} tipo={getCatInsight().type} />
        </div>

        <div className="box-card hover-effect">
          <div className="box-header"><h3><Target size={18} color="#3b82f6"/> Vendedores</h3></div>
          <div className="ranking-list">
            {performanceVendedores.length > 0 ? performanceVendedores.map((vend, i) => (
              <div key={i} className="ranking-item-operator" style={{ borderLeftColor: i === 0 ? '#3b82f6' : '#cbd5e1' }}>
                <div className="operator-avatar" style={{ background: i===0 ? '#3b82f6' : '#e2e8f0', color: i===0 ? 'white' : '#64748b' }}>
                  {vend.nome.charAt(0).toUpperCase()}
                </div>
                <div className="operator-info">
                  <div className="operator-text">
                    <span className="operator-name">{vend.nome}</span>
                    <span className="operator-val">{formatCurrency(vend.vendas)}</span>
                  </div>
                  <span className="operator-sub">{vend.converteu} cupons fechados</span>
                </div>
              </div>
            )) : <p className="empty-state">Sem operadores hoje.</p>}
          </div>
          <NanoInsightIA insight={getVendInsight().text} tipo={getVendInsight().type} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;