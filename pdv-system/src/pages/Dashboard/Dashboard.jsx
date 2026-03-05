import React, { useEffect, useState, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as TooltipChart,
  BarChart, Bar, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  DollarSign, ShoppingBag, AlertTriangle, Package,
  TrendingUp, Activity, Clock, PiggyBank, RefreshCcw,
  CreditCard, ShieldAlert, Users, Sparkles, Target
} from 'lucide-react';
import api from '../../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);

  const META_DIARIA = 1500;

  useEffect(() => {
    carregarDados();
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) setChartWidth(entries[0].contentRect.width);
    });
    if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Erro", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  if (loading && !data) return <div className="dash-loading"><div className="spinner"></div></div>;

  // --- EXTRATORES DE DADOS (Blindados) ---
  const payload = data?.data || data?.body || data || {};
  const fin = payload.financeiro || payload || {};
  const inv = payload.inventario || payload || {};

  const faturamento = Number(fin.faturamentoHoje ?? fin.faturamentoDiario ?? payload.totalVendidoHoje ?? 0);
  const lucroBruto = Number(fin.lucroBrutoHoje ?? 0);
  const vendasQtd = Number(fin.vendasHoje ?? fin.vendasDiarias ?? payload.quantidadeVendasHoje ?? 0);
  const ticketMedio = Number(fin.ticketMedio ?? (vendasQtd > 0 ? faturamento / vendasQtd : 0));
  const progressoMeta = Math.min(100, (faturamento / META_DIARIA) * 100);

  const rawGraficoVendas = Array.isArray(fin.graficoVendas) ? fin.graficoVendas : (Array.isArray(payload.graficoVendas) ? payload.graficoVendas : []);
  const graficoEvolucao = rawGraficoVendas.map(i => ({ dia: i.data || i.dia || '', total: Number(i.total || i.valorTotal || 0) }));

  const rawVendasHora = Array.isArray(fin.vendasPorHora) ? fin.vendasPorHora : [];
  const mapaDeCalor = rawVendasHora.map(i => ({ horaStr: `${String(i.hora).padStart(2, '0')}h`, qtd: Number(i.quantidadeVendas || 0) }));

  const rawRanking = Array.isArray(payload.topProdutos) ? payload.topProdutos : (Array.isArray(payload.ranking) ? payload.ranking : []);
  const topProdutos = rawRanking.slice(0, 5).map(p => ({ nome: p.produto || p.nome || '', qtd: Number(p.quantidade || p.qtd || 0), valor: Number(p.valorTotal || p.total || 0) }));

  const rawAuditoria = Array.isArray(payload.auditoria) ? payload.auditoria : (Array.isArray(payload.alertas) ? payload.alertas : []);
  const auditoria = rawAuditoria.slice(0, 3);

  const pagamentosData = Array.isArray(fin.pagamentos) && fin.pagamentos.length > 0 ? fin.pagamentos : [
    { name: 'PIX', value: faturamento * 0.45, color: '#10b981' },
    { name: 'Crédito', value: faturamento * 0.35, color: '#8b5cf6' },
    { name: 'Débito', value: faturamento * 0.15, color: '#3b82f6' },
    { name: 'Dinheiro', value: faturamento * 0.05, color: '#f59e0b' }
  ].filter(p => p.value > 0);

  // --- IA GERAL ---
  const gerarInsightIA = () => {
    if (faturamento === 0) return "Aguardando movimentações para gerar análises.";
    let insights = [];
    if (progressoMeta >= 100) insights.push("Meta diária batida! Excelente conversão da equipe.");
    else if (ticketMedio < 40) insights.push("O Ticket Médio está baixo. Ofereça produtos de compra por impulso no caixa.");

    if (mapaDeCalor.length > 0) {
      const pico = mapaDeCalor.reduce((prev, curr) => (prev.qtd > curr.qtd) ? prev : curr);
      if (pico.qtd > 3) insights.push(`Pico detectado às ${pico.horaStr}. Aloque a equipe na vitrine neste horário amanhã.`);
    }
    return insights[Math.floor(Math.random() * insights.length)] || "Cenário estável. Mantenha o padrão de atendimento.";
  };

  // --- IA CURVA A ---
  const gerarDicaCurvaA = (produto) => {
    if (!produto || produto.valor === 0) return "Aguardando dados de vendas.";
    const dicas = [
      `Aproveite o hype do "${produto.nome}": posicione-o no balcão do caixa para compra por impulso.`,
      `O item "${produto.nome}" está saindo muito! Crie um "Kit" com um produto encalhado para limpar estoque.`,
      `Grave um Story mostrando o "${produto.nome}" dizendo que é o campeão de hoje. Escassez gera venda!`,
      `Ofereça 10% de desconto na 2ª unidade do "${produto.nome}". Quem compra um, leva dois com vantagem.`
    ];
    return dicas[produto.nome.length % dicas.length];
  };

  return (
    <div className="dash-wrapper">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Painel Estratégico</h1>
          <p className="dash-subtitle">Visão em tempo real da DD Cosméticos</p>
        </div>
        <div className="dash-actions">
          <span className="dash-time"><Clock size={14} /> {lastUpdate.toLocaleTimeString()}</span>
          <button className="btn-refresh" onClick={carregarDados}><RefreshCcw size={16}/> Atualizar</button>
        </div>
      </header>

      <div className="ai-insight-box">
        <div className="ai-icon-glow"><Sparkles size={24} color="#ec4899" /></div>
        <div className="ai-content">
          <h4>IA Analítica DD Cosméticos</h4>
          <p>{gerarInsightIA()}</p>
        </div>
      </div>

      <div className="dash-kpi-grid">
        <div className="kpi-card highlight-blue hover-effect">
          <div className="kpi-info"><span className="kpi-label">Faturamento Hoje</span><h2 className="kpi-value">{formatCurrency(faturamento)}</h2></div>
          <div className="kpi-icon"><DollarSign size={32}/></div>
        </div>
        <div className="kpi-card highlight-green hover-effect">
          <div className="kpi-info"><span className="kpi-label">Margem Bruta</span><h2 className="kpi-value">{formatCurrency(lucroBruto)}</h2></div>
          <div className="kpi-icon"><PiggyBank size={32}/></div>
        </div>
        <div className="kpi-card highlight-purple hover-effect">
          <div className="kpi-info"><span className="kpi-label">Ticket Médio</span><h2 className="kpi-value">{formatCurrency(ticketMedio)}</h2></div>
          <div className="kpi-icon"><CreditCard size={32}/></div>
        </div>
        <div className="kpi-card highlight-pink hover-effect">
          <div className="kpi-info" style={{width: '100%'}}>
            <div style={{display:'flex', justifyContent:'space-between'}}><span className="kpi-label">Meta (R$ {META_DIARIA})</span><Target size={20} color="#ec4899"/></div>
            <h2 className="kpi-value">{progressoMeta.toFixed(1)}%</h2>
            <div className="progress-bg mt-2"><div className="progress-fill" style={{width: `${progressoMeta}%`, background: progressoMeta >= 100 ? '#10b981' : '#ec4899'}}></div></div>
          </div>
        </div>
      </div>

      <div className="dash-charts-grid">
        {/* Gráfico 1 - Ocupa 100% da largura */}
        <div className="chart-box hover-effect full-width" ref={chartContainerRef}>
          <div className="box-header"><h3><Activity size={18}/> Evolução (Mês)</h3></div>
          <div className="chart-content">
            {graficoEvolucao.length > 0 ? (
              <AreaChart width={chartWidth || 800} height={250} data={graficoEvolucao}>
                <defs><linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(v) => `R$${v}`}/>
                <TooltipChart formatter={(val) => [formatCurrency(val), 'Faturamento']} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fill="url(#colorFat)" />
              </AreaChart>
            ) : <div className="empty-state">Sem dados financeiros.</div>}
          </div>
        </div>

        {/* Gráfico 2 e 3 - Ficam Lado a Lado (50% cada) */}
        <div className="chart-box hover-effect">
          <div className="box-header"><h3><Users size={18}/> Fluxo de Loja</h3></div>
          <div className="chart-content">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={mapaDeCalor} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="horaStr" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                <TooltipChart cursor={{fill: '#f1f5f9'}} formatter={(val) => [`${val} vendas`, 'Volume']} />
                <Bar dataKey="qtd" radius={[4,4,0,0]}>
                  {mapaDeCalor.map((entry, idx) => (<Cell key={`cell-${idx}`} fill={entry.qtd > 2 ? '#ec4899' : '#94a3b8'} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-box hover-effect">
          <div className="box-header"><h3><CreditCard size={18}/> Mix de Pagamentos</h3></div>
          <div className="chart-content" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
            {faturamento > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pagamentosData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {pagamentosData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <TooltipChart formatter={(val) => formatCurrency(val)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="empty-state">Sem dados financeiros.</p>}
          </div>
          <div className="pie-legend">
            {pagamentosData.map((p, i) => (
              <div key={i} className="legend-item"><span className="dot" style={{background: p.color}}></span>{p.name}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-bottom-grid">
        <div className="box-card hover-effect">
          <div className="box-header"><h3><ShoppingBag size={18} color="#ec4899"/> Curva A (Top Produtos)</h3></div>
          {topProdutos.length > 0 && (
            <div className="ai-dica-curvaA">
              <strong>💡 Estratégia de Venda:</strong> {gerarDicaCurvaA(topProdutos[0])}
            </div>
          )}
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
            }) : <p className="empty-state">Sem produtos vendidos.</p>}
          </div>
        </div>

        <div className="box-card hover-effect">
          <div className="box-header"><h3><ShieldAlert size={18} color="#f59e0b"/> Auditoria Recente</h3></div>
          <div className="audit-list">
            {auditoria.length > 0 ? auditoria.map((log, i) => (
              <div key={i} className="audit-item hover-effect-light">
                <div className="audit-bullet"></div>
                <div className="audit-details">
                  <span className="audit-msg">{log.mensagem}</span>
                  <span className="audit-meta">{new Date(log.dataHora).toLocaleTimeString()} • {log.usuarioResponsavel}</span>
                </div>
              </div>
            )) : <p className="empty-state">Nenhum evento registrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;