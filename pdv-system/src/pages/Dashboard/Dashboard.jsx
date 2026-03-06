import React, { useEffect, useState, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as TooltipChart,
  BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts';
import {
  DollarSign, ShoppingBag, Activity, Clock, RefreshCcw,
  CreditCard, Users, Sparkles, Target, AlertCircle, Package,
  TrendingDown, Landmark, Zap, Scale
} from 'lucide-react';
import api from '../../services/api';
import './Dashboard.css';

const NanoInsightIA = ({ insight, tipo = 'info' }) => {
  const cores = {
    info: { text: '#3b82f6', bg: '#eff6ff' }, warning: { text: '#f59e0b', bg: '#fffbeb' },
    success: { text: '#10b981', bg: '#ecfdf5' }, danger: { text: '#ef4444', bg: '#fef2f2' },
    premium: { text: '#ec4899', bg: '#fdf2f8' }
  };
  const cor = cores[tipo] || cores.info;
  return (
    <div style={{ marginTop: '12px', padding: '8px 12px', background: cor.bg, borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px', border: `1px solid ${cor.text}30` }}>
      <Sparkles size={14} color={cor.text} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span style={{ fontSize: '0.75rem', color: cor.text, fontWeight: 600, lineHeight: 1.4 }}>{insight}</span>
    </div>
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
      // Faz as duas requisições em paralelo para o Dashboard e para o Motor de Custos
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

  if (loading && !data) return <div className="dash-loading"><div className="spinner"></div></div>;

  const payload = data?.data || data?.body || data || {};
  const fin = payload.financeiro || {};
  const inv = payload.inventario || {};

  // EXTRAÇÃO DE DADOS DIÁRIOS
  const META_DIARIA = payload.metaDiaria ? Number(payload.metaDiaria) : 1500;
  const faturamento = Number(fin.faturamentoHoje || 0);
  const lucroBruto = Number(fin.lucroBrutoHoje || 0);
  const vendasQtd = Number(fin.vendasHoje || 0);
  const ticketMedio = Number(fin.ticketMedio || (vendasQtd > 0 ? faturamento / vendasQtd : 0));
  const progressoMeta = Math.min(100, (faturamento / META_DIARIA) * 100);
  const itensVendidosHoje = Number(fin.itensVendidosHoje || 0);
  const itensPorAtendimento = vendasQtd > 0 ? (itensVendidosHoje / vendasQtd).toFixed(2) : 0;

  // CÁLCULO EXATO DA MARGEM E LUCRO DIÁRIO
  const faixaSimplesNacional = fin.faixaSimples || "4,00% (Anexo I)";
  const taxaSimplesNum = parseFloat(faixaSimplesNacional.replace(',', '.').replace(/[^0-9.]/g, '')) || 4.0;
  const impostoDiarioEstimado = faturamento * (taxaSimplesNum / 100);
  const margemContribuicaoReal = lucroBruto - impostoDiarioEstimado;
  const percentualMargem = faturamento > 0 ? (margemContribuicaoReal / faturamento) * 100 : 0;

  // EXTRAÇÃO DE DADOS MENSAIS E PONTO DE EQUILÍBRIO
  const graficoEvolucao = Array.isArray(fin.graficoVendas) ? fin.graficoVendas.map(i => ({ dia: i.data || '', total: Number(i.total || 0) })) : [];
  const faturamentoMes = graficoEvolucao.reduce((acc, curr) => acc + curr.total, 0);

  // Estima a margem do mês baseada na saúde da margem de hoje (ou 40% como fallback padrão da DD)
  const taxaMargemMensal = faturamento > 0 ? (margemContribuicaoReal / faturamento) : 0.40;
  const margemAcumuladaMes = faturamentoMes * taxaMargemMensal;

  const custoFixoMes = analiseMensal?.custoFixoPrevisto || 0;
  const progressoEquilibrio = custoFixoMes > 0 ? Math.min(100, (margemAcumuladaMes / custoFixoMes) * 100) : 0;
  const faltaParaPagar = Math.max(0, custoFixoMes - margemAcumuladaMes);
  const lucroLiquidoRealMes = Math.max(0, margemAcumuladaMes - custoFixoMes);

  const rupturaEstoque = inv.indiceRuptura || 0;
  const mapaDeCalor = Array.isArray(fin.vendasPorHora) ? fin.vendasPorHora.map(i => ({ horaStr: `${String(i.hora).padStart(2, '0')}h`, qtd: Number(i.quantidadeVendas || 0) })) : [];
  const topProdutos = Array.isArray(payload.topProdutos) ? payload.topProdutos.slice(0, 5).map(p => ({ nome: p.produto || '', qtd: Number(p.quantidade || 0), valor: Number(p.valorTotal || 0) })) : [];
  const performanceVendedores = Array.isArray(payload.performanceVendedores) ? payload.performanceVendedores : [];

  // =========================================================================
  // O CÉREBRO: IA GESTORA (COPILOTO EXECUTIVO)
  // =========================================================================
  const gerarDiagnosticoGestor = () => {
    let analise = [];

    // Análise 1: Saúde do Mês (Ponto de Equilíbrio)
    if (custoFixoMes > 0) {
      if (progressoEquilibrio >= 100) {
        analise.push("🏆 MÊS PAGO! A loja já cobriu os custos fixos. A partir de agora, toda margem gerada vai direto para o Lucro Líquido.");
      } else if (progressoEquilibrio > 70) {
        analise.push("📈 Reta final para o Ponto de Equilíbrio. Faltam poucas vendas para a loja se pagar neste mês.");
      } else {
        analise.push(`⚠️ Foco total no caixa: A loja ainda precisa de ${formatCurrency(faltaParaPagar)} em margem limpa para pagar as despesas fixas.`);
      }
    } else {
      analise.push("📝 Cadastre suas despesas (Aluguel, Luz, etc) no módulo 'Contas a Pagar' para a IA calcular seu Lucro Líquido Real.");
    }

    // Análise 2: Pulso do Dia
    if (faturamento > 0) {
      const hora = new Date().getHours();
      const metaProporcional = (META_DIARIA / 10) * Math.max(1, hora - 8);

      if (faturamento < metaProporcional) {
        analise.push(`O ritmo de hoje está lento. Puxe a equipe e faça uma oferta relâmpago no WhatsApp.`);
      } else if (itensPorAtendimento < 1.5) {
        analise.push(`Apesar das vendas, os clientes estão levando poucos itens. Exija que o caixa sempre ofereça um item adicional (Cross-sell).`);
      }
    }

    return analise.join(" ");
  };

  // Nano Insights Diários
  const getFaturamentoInsight = () => {
    if (progressoMeta >= 100) return { text: `Superávit: R$ ${(faturamento - META_DIARIA).toFixed(2)}`, type: 'success' };
    return { text: `Faltam R$ ${(META_DIARIA - faturamento).toFixed(2)}`, type: 'premium' };
  };
  const getMargemInsight = () => {
    if (faturamento > 0 && margemContribuicaoReal >= faturamento * 0.95) return { text: "Risco: Custos parecem zerados.", type: 'danger' };
    if (percentualMargem < 25 && faturamento > 0) return { text: `Apertada (${percentualMargem.toFixed(1)}%). Segure descontos.`, type: 'warning' };
    return { text: `Saudável. Sobra R$ ${(margemContribuicaoReal/(vendasQtd||1)).toFixed(2)} por cupom.`, type: 'success' };
  };

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

      {/* COPILOTO EXECUTIVO DD */}
      <div className="ai-insight-box" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white', border: '1px solid #334155' }}>
        <div className="ai-icon-glow" style={{ background: '#ec4899', boxShadow: '0 0 20px rgba(236,72,153,0.5)' }}>
           <Zap size={24} color="white" />
        </div>
        <div className="ai-content">
          <h4 style={{ color: '#fbcfe8' }}>Copiloto Gerencial DD</h4>
          <p style={{ color: '#cbd5e1', fontSize: '1.05rem', fontWeight: 400 }}>{gerarDiagnosticoGestor()}</p>
        </div>
      </div>

      {/* NOVO: TERMÔMETRO DO MÊS (PONTO DE EQUILÍBRIO) */}
      <div className="break-even-widget" style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={20} color="#3b82f6"/> Saúde Financeira do Mês (Ponto de Equilíbrio)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                Margem Acumulada vs Custos Fixos (Aluguel, Luz, Salários, etc).
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>STATUS</span>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: progressoEquilibrio >= 100 ? '#10b981' : '#f59e0b' }}>
                {progressoEquilibrio >= 100 ? `LUCRO: + ${formatCurrency(lucroLiquidoRealMes)}` : `FALTAM: ${formatCurrency(faltaParaPagar)}`}
              </h4>
            </div>
        </div>

        {/* Barra de Progresso Customizada */}
        <div style={{ width: '100%', height: '24px', background: '#f1f5f9', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
           <div style={{
               width: `${progressoEquilibrio}%`, height: '100%',
               background: progressoEquilibrio >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
               transition: 'width 1s ease-in-out'
           }}></div>
           {/* Linha de Chegada (100%) */}
           <div style={{ position: 'absolute', top: 0, bottom: 0, left: '99%', width: '2px', background: '#0f172a', zIndex: 10 }}></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
            <span>Margem Gerada: {formatCurrency(margemAcumuladaMes)}</span>
            <span>Custo Fixo: {formatCurrency(custoFixoMes)}</span>
        </div>
      </div>

      {/* CLUSTER 1: PULSO DIÁRIO */}
      <div className="dash-kpi-grid">
        <div className="kpi-card hover-effect" style={{borderLeftColor: '#ec4899'}}>
          <div className="kpi-info">
            <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span className="kpi-label">Faturamento Hoje</span><DollarSign size={20} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{formatCurrency(faturamento)}</h2>
            <div className="progress-bg"><div className="progress-fill" style={{width: `${progressoMeta}%`, background: '#ec4899'}}></div></div>
            <NanoInsightIA insight={getFaturamentoInsight().text} tipo={getFaturamentoInsight().type} />
          </div>
        </div>

        <div className="kpi-card hover-effect" style={{borderLeftColor: '#10b981'}}>
          <div className="kpi-info">
            <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span className="kpi-label">Margem de Contrib.</span><TrendingDown size={20} color="#cbd5e1"/></div>
            <h2 className="kpi-value" style={{color: margemContribuicaoReal >= 0 ? '#0f172a' : '#ef4444'}}>{formatCurrency(margemContribuicaoReal)}</h2>
            <NanoInsightIA insight={getMargemInsight().text} tipo={getMargemInsight().type} />
          </div>
        </div>

        <div className="kpi-card hover-effect" style={{borderLeftColor: '#8b5cf6'}}>
          <div className="kpi-info">
            <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span className="kpi-label">Ticket Médio</span><CreditCard size={20} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{formatCurrency(ticketMedio)}</h2>
            <NanoInsightIA insight={ticketMedio < 45 ? "Ofereça upsell no caixa." : "Ticket saudável."} tipo={ticketMedio < 45 ? 'warning' : 'success'} />
          </div>
        </div>

        <div className="kpi-card hover-effect" style={{borderLeftColor: '#f59e0b'}}>
          <div className="kpi-info">
            <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span className="kpi-label">Peças/Atendimento</span><Package size={20} color="#cbd5e1"/></div>
            <h2 className="kpi-value">{itensPorAtendimento} <span style={{fontSize: '1rem', color: '#94a3b8'}}>unid.</span></h2>
            <NanoInsightIA insight={itensPorAtendimento < 1.5 ? "Foque em venda cruzada." : "Cross-sell ativo."} tipo={itensPorAtendimento < 1.5 ? 'warning' : 'success'} />
          </div>
        </div>
      </div>

      {/* CLUSTER 2: OPERACIONAL E FLUXO */}
      <div className="dash-charts-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="chart-box hover-effect" ref={chartContainerRef}>
          <div className="box-header">
            <h3><Activity size={18}/> Evolução Mensal da Receita</h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', gap: '8px' }}>
               <span title="Faixa do Simples Nacional Estimada"><Landmark size={14}/> {faixaSimplesNacional}</span>
            </span>
          </div>
          <div className="chart-content">
            {graficoEvolucao.length > 0 ? (
              <AreaChart width={chartWidth || 600} height={250} data={graficoEvolucao}>
                <defs><linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(v) => `R$${v}`}/>
                <TooltipChart formatter={(val) => [formatCurrency(val), 'Faturamento']} />
                <Area type="monotone" dataKey="total" stroke="#ec4899" strokeWidth={3} fill="url(#colorFat)" />
              </AreaChart>
            ) : <div className="empty-state">Aguardando fechamentos no mês.</div>}
          </div>
        </div>

        <div className="chart-box hover-effect">
          <div className="box-header">
            <h3><Users size={18}/> Mapa de Fluxo (Hora)</h3>
          </div>
          <div className="chart-content">
            {mapaDeCalor.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={mapaDeCalor} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="horaStr" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}}/>
                    <TooltipChart cursor={{fill: '#f1f5f9'}} formatter={(val) => [`${val} vendas`, 'Volume']} />
                    <Bar dataKey="qtd" radius={[4,4,0,0]} maxBarSize={30}>
                      {mapaDeCalor.map((entry, idx) => (<Cell key={`cell-${idx}`} fill={entry.qtd > 2 ? '#8b5cf6' : '#94a3b8'} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            ) : <div className="empty-state">Sem fluxo.</div>}
          </div>
        </div>
      </div>

      {/* CLUSTER 3: PERFORMANCE E PRODUTOS */}
      <div className="dash-bottom-grid">
        <div className="box-card hover-effect">
          <div className="box-header">
             <h3><ShoppingBag size={18} color="#ec4899"/> Curva ABC (Receita)</h3>
             <span style={{ fontSize: '0.8rem', color: rupturaEstoque > 5 ? '#ef4444' : '#10b981', display: 'flex', gap: '4px' }} title="Índice de prateleiras vazias">
               <AlertCircle size={14}/> Ruptura: {rupturaEstoque}%
             </span>
          </div>
          <div className="ranking-list" style={{marginTop: '16px'}}>
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
        </div>

        <div className="box-card hover-effect">
          <div className="box-header"><h3><Target size={18} color="#3b82f6"/> Fechamentos por Operador</h3></div>
          <div className="ranking-list" style={{ marginTop: '16px' }}>
            {performanceVendedores.length > 0 ? performanceVendedores.map((vend, i) => (
              <div key={i} className="ranking-item" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: `4px solid ${i === 0 ? '#3b82f6' : '#cbd5e1'}` }}>
                <div style={{ width: '36px', height: '36px', background: i===0 ? '#3b82f6' : '#e2e8f0', color: i===0 ? 'white' : '#64748b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {vend.nome.charAt(0).toUpperCase()}
                </div>
                <div className="rank-info" style={{ marginLeft: '12px' }}>
                  <div className="rank-text" style={{ marginBottom: 0 }}>
                    <span className="rank-name" style={{ fontSize: '1rem', color: '#0f172a' }}>{vend.nome}</span>
                    <span className="rank-val" style={{ color: '#3b82f6' }}>{formatCurrency(vend.vendas)}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{vend.converteu} cupons finalizados</span>
                </div>
              </div>
            )) : <p className="empty-state">Sem operadores registrados hoje.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;