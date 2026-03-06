import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import api from "../../services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart, FunnelChart, Funnel, LabelList, ReferenceLine
} from "recharts";
import {
  TrendingUp, Download, Calendar, PackageCheck, DollarSign,
  Layers, FileText, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
  Sparkles, AlertTriangle, Target, ShoppingBag, PiggyBank, Wallet, BarChart3, Briefcase, ArrowDownCircle, ArrowUpCircle, Scale, ShieldAlert
} from "lucide-react";
import './Relatorios.css';

// ==========================================
// 1. IDENTIDADE VISUAL DD COSMÉTICOS
// ==========================================
const BRAND = {
  primary: '#ec4899',
  secondary: '#3b82f6',
  accent: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  slate: '#94a3b8',
  dark: '#0f172a',
  grid: '#f1f5f9'
};

const BRAND_PALETTE = [BRAND.secondary, BRAND.primary, BRAND.accent, BRAND.success, BRAND.warning, BRAND.slate];

const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

// ==========================================
// 2. COMPONENTES DE INTERFACE
// ==========================================
const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="rel-section-header">
    <div className="rsh-title-row">
      <div className="rsh-icon"><Icon size={16} /></div>
      <h2>{title}</h2>
      <div className="rsh-line"></div>
    </div>
    {description && <p>{description}</p>}
  </div>
);

const CustomTooltipContent = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rel-tooltip">
        <p className="rel-tooltip-label">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="rel-tooltip-item">
            <div className="rel-tooltip-name">
              <div className="rel-tooltip-dot" style={{ backgroundColor: entry.color || entry.fill }}></div>
              <span>{entry.name}</span>
            </div>
            <span className="rel-tooltip-val">
              {typeof entry.value === 'number' && Math.abs(entry.value) > 100 ? formatarMoeda(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const ChartCard = ({ title, subtitle, onDownload, children, fullWidth = false, isLoading = false }) => (
  <div className={`rel-chart-card ${fullWidth ? 'col-span-full' : ''}`}>
    <div className="rcc-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <button onClick={onDownload} title="Baixar Gráfico"><Download size={18} /></button>
    </div>
    {/* Estilo inline reforçado para blindar contra o erro Width -1 do Recharts */}
    <div className="rcc-content" style={{ width: '100%', height: '300px', minHeight: '300px', position: 'relative' }}>
      {isLoading ? (
        <div className="rel-spinner"></div>
      ) : (
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

const KpiCard = ({ title, value, subtext, icon: Icon, trend }) => (
  <div className="rel-kpi-card group">
    <div className="rkc-top">
      <div><p>{title}</p><h4>{value}</h4></div>
      <div className="rkc-icon"><Icon size={24} /></div>
    </div>
    <div className={`rkc-trend trend-${trend}`}>
      {trend === 'up' && <ArrowUpRight size={14} />}
      {trend === 'down' && <ArrowDownRight size={14} />}
      {subtext}
    </div>
  </div>
);

// ==========================================
// 3. COMPONENTE PRINCIPAL
// ==========================================
export default function RelatoriosDashboard() {
  const [categoriaAtiva, setCategoriaAtiva] = useState("vendas");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));

  const [dadosBase, setDadosBase] = useState(null);
  const [loading, setLoading] = useState(false);
  const toastId = useRef(null);

  // BUSCA EXCLUSIVA NO BANCO DE DADOS REAL
  const carregarRelatorio = async () => {
    setLoading(true);
    setDadosBase(null); // Limpa dados anteriores ao trocar de aba

    try {
      const params = {};
      if (dataInicio) params.inicio = dataInicio;
      if (dataFim) params.fim = dataFim;

      const response = await api.get(`/relatorios/${categoriaAtiva}`, { params });
      setDadosBase(response.data);
    } catch (error) {
      console.error(`Erro ao carregar BI de ${categoriaAtiva}:`, error.message);
      if (!toast.isActive(toastId.current)) {
        toastId.current = toast.error(`Módulo de ${categoriaAtiva} ainda não mapeado no servidor ou sem dados no período.`, {
          position: "top-right",
          autoClose: 4000,
          toastId: "erro-bi-real"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarRelatorio();
  }, [categoriaAtiva, dataInicio, dataFim]);

  const baixarRelatorio = (tipo) => toast.info(`Gerando relatório em ${tipo}...`);

  // IA DINÂMICA POR ABA
  const gerarInsightEstrategico = () => {
    if (!dadosBase) return "Aguardando dados reais do servidor para gerar inteligência.";

    if (categoriaAtiva === "vendas") {
      if (dadosBase.crossSell && dadosBase.crossSell.length > 0) {
        return <>O combo <strong>{dadosBase.crossSell[0].par}</strong> é o líder absoluto. Crie um "Kit Promocional" no PDV.</>;
      }
      return "Analise as tendências do período para criar campanhas focadas.";
    }

    if (categoriaAtiva === "estoque") {
      if (dadosBase.ruptura > 5) return "Risco de falta de produtos. Revise a curva A para não perder vendas.";
      return "Estoque em níveis controlados. Atenção aos itens de curva C sem giro.";
    }

    if (categoriaAtiva === "financeiro") {
      return "Fluxo de caixa atualizado. Acompanhe os vencimentos de curto prazo.";
    }

    return "Cenário operacional dentro das métricas.";
  };

  return (
    <div className="rel-container">
      {/* GRADIENTES RECHARTS */}
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="gradSecondary" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND.secondary} stopOpacity={0.4} /><stop offset="100%" stopColor={BRAND.secondary} stopOpacity={0.05} /></linearGradient>
          <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND.primary} stopOpacity={0.4} /><stop offset="100%" stopColor={BRAND.primary} stopOpacity={0.05} /></linearGradient>
        </defs>
      </svg>

      {/* CABEÇALHO */}
      <div className="rel-header">
        <div className="rh-title">
          <div className="rh-icon"><TrendingUp size={28} /></div>
          <div>
            <h1>Central de Inteligência</h1>
            <p>Visão Estratégica DD Cosméticos</p>
          </div>
        </div>

        <div className="rh-actions">
          <div className="rh-date-picker">
            <span>Período:</span>
            <Calendar size={16} />
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            <span>•</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <button className="btn-export" onClick={() => baixarRelatorio('Excel')}><FileSpreadsheet size={16} /> EXCEL</button>
          <button className="btn-export pdf" onClick={() => baixarRelatorio('PDF')}><FileText size={16} /> PDF</button>
        </div>
      </div>

      {/* NAVEGAÇÃO DAS ABAS */}
      <div className="rel-tabs">
        <button className={categoriaAtiva === "vendas" ? "active" : ""} onClick={() => setCategoriaAtiva("vendas")}><TrendingUp size={16}/> Comercial</button>
        <button className={categoriaAtiva === "estoque" ? "active" : ""} onClick={() => setCategoriaAtiva("estoque")}><PackageCheck size={16}/> Estoque</button>
        <button className={categoriaAtiva === "financeiro" ? "active" : ""} onClick={() => setCategoriaAtiva("financeiro")}><DollarSign size={16}/> Financeiro</button>
        <button className={categoriaAtiva === "fiscal" ? "active" : ""} onClick={() => setCategoriaAtiva("fiscal")}><Layers size={16}/> Fiscal</button>
      </div>

      {/* DD INTELLIGENCE CARD */}
      <div className="rel-ai-card">
        <div className="ai-bg-glow"></div>
        <div className="ai-content-row">
          <div className="ai-icon-box"><Sparkles size={24} className="animate-pulse" /></div>
          <div className="ai-text-area">
            <h3>DD Intelligence <span>• Dados Reais</span></h3>
            <p style={{ fontSize: '1.05rem', color: '#cbd5e1' }}>{gerarInsightEstrategico()}</p>
          </div>
        </div>
      </div>

      {/* ÁREA DE DADOS - RENDERIZAÇÃO CONDICIONAL PARA CADA ABA */}
      <div className="rel-content-area">

        {/* ======================= ABA: VENDAS ======================= */}
        {categoriaAtiva === "vendas" && dadosBase && (
          <div className="rel-fade-in">
            <div className="rel-kpi-grid">
                <KpiCard title="Faturamento Bruto" value={formatarMoeda(dadosBase.totalFaturado)} subtext="No período" icon={DollarSign} trend="up" />
                <KpiCard title="Cupom Médio" value={formatarMoeda(dadosBase.ticketMedio)} subtext="Média real" icon={ShoppingBag} trend="neutral" />
                <KpiCard title="Total Pedidos" value={dadosBase.quantidadeVendas} subtext="Volume" icon={Target} trend="up" />
                <KpiCard title="Margem Contribuição" value={formatarMoeda(dadosBase.lucroBrutoEstimado)} subtext="Lucro Bruto" icon={PiggyBank} trend="up" />
            </div>
            <SectionHeader icon={BarChart3} title="Análise Comercial" />
            <div className="rel-chart-grid">
                <ChartCard title="Tendência de Vendas" fullWidth isLoading={loading}>
                    <AreaChart data={dadosBase.vendasDiarias || []} margin={{top: 10, right: 10, left: -10, bottom: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BRAND.grid} />
                      <XAxis dataKey="data" tick={{fill: BRAND.slate, fontSize: 11}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: BRAND.slate, fontSize: 11}} />
                      <Tooltip content={<CustomTooltipContent />} />
                      <Area type="monotone" dataKey="total" name="Vendas" fill="url(#gradSecondary)" stroke={BRAND.secondary} strokeWidth={4} />
                    </AreaChart>
                </ChartCard>
                <ChartCard title="Mix de Pagamentos" isLoading={loading}>
                    <PieChart>
                      <Pie data={dadosBase.porPagamento || []} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="valorTotal" nameKey="formaPagamento">
                        {(dadosBase.porPagamento || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltipContent />} /><Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                </ChartCard>
                <ChartCard title="Distribuição de Ticket" isLoading={loading}>
                     <BarChart data={dadosBase.distribuicaoTicket || []} margin={{top: 10}}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={BRAND.grid} />
                        <XAxis dataKey="range" tick={{fontSize: 11, fill: BRAND.slate}} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltipContent />} />
                        <Bar dataKey="qtd" name="Qtd Vendas" fill={BRAND.accent} radius={[8,8,0,0]} barSize={40} />
                     </BarChart>
                </ChartCard>
            </div>
          </div>
        )}

        {/* ======================= ABA: ESTOQUE ======================= */}
        {categoriaAtiva === "estoque" && dadosBase && (
           <div className="rel-fade-in">
             <div className="rel-kpi-grid">
                <KpiCard title="Custo Estoque" value={formatarMoeda(dadosBase.custoEstoque)} subtext="Capital Imobilizado" icon={PackageCheck} trend="neutral" />
                <KpiCard title="Venda Projetada" value={formatarMoeda(dadosBase.vendaProjetada)} subtext="Preço de Venda" icon={DollarSign} trend="up" />
                <KpiCard title="Mix Produtos" value={dadosBase.mixProdutos} subtext="Itens ativos" icon={Briefcase} trend="up" />
                <KpiCard title="Ruptura" value={`${dadosBase.ruptura || 0}%`} subtext="Faltas de produto" icon={AlertTriangle} trend="down" />
             </div>
             <SectionHeader icon={Target} title="Inteligência de Portfólio" />
             <div className="rel-chart-grid">
                <ChartCard title="Curva ABC de Receita" fullWidth isLoading={loading}>
                    <ComposedChart data={dadosBase.curvaABC || []} margin={{left: -20}}>
                       <CartesianGrid strokeDasharray="3 3" stroke={BRAND.grid} vertical={false} />
                       <XAxis dataKey="name" tick={{fill: BRAND.slate}}/>
                       <YAxis axisLine={false} />
                       <Tooltip content={<CustomTooltipContent />} />
                       <Bar dataKey="produtos" name="Volume %" fill={BRAND.slate} radius={[8,8,0,0]} fillOpacity={0.5} />
                       <Line type="monotone" dataKey="receita" name="Receita %" stroke={BRAND.secondary} strokeWidth={4} />
                    </ComposedChart>
                </ChartCard>
                <ChartCard title="Aging (Idade do Estoque)" isLoading={loading}>
                  <PieChart>
                    <Pie data={dadosBase.aging || []} innerRadius={60} outerRadius={80} dataKey="value">
                      {(dadosBase.aging || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltipContent />} /><Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ChartCard>
                <ChartCard title="Cobertura (Dias)" isLoading={loading}>
                  <BarChart data={dadosBase.cobertura || []} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tick={{fontSize: 12}} />
                    <Tooltip />
                    <ReferenceLine x={30} stroke={BRAND.secondary} strokeDasharray="3 3" />
                    <Bar dataKey="dias" name="Dias de Estoque" fill={BRAND.warning} radius={[0,8,8,0]} barSize={28} />
                  </BarChart>
                </ChartCard>
             </div>
           </div>
        )}

        {/* ======================= ABA: FINANCEIRO ======================= */}
        {categoriaAtiva === "financeiro" && dadosBase && (
           <div className="rel-fade-in">
               <div className="rel-kpi-grid">
                  <KpiCard title="Saldo em Caixa" value={formatarMoeda(dadosBase.saldo)} subtext="Atual" icon={Wallet} trend="neutral" />
                  <KpiCard title="A Pagar" value={formatarMoeda(dadosBase.aPagar)} subtext="Período" icon={ArrowDownCircle} trend="down" />
                  <KpiCard title="A Receber" value={formatarMoeda(dadosBase.aReceber)} subtext="Período" icon={ArrowUpCircle} trend="up" />
                  <KpiCard title="Total Vencido" value={formatarMoeda(dadosBase.vencido)} subtext="Atrasos" icon={AlertTriangle} trend="neutral" />
               </div>
               <SectionHeader icon={Wallet} title="Fluxo e Despesas" />
               <div className="rel-chart-grid">
                  <ChartCard title="DRE Simplificado" fullWidth isLoading={loading}>
                    <BarChart data={dadosBase.dre || []} margin={{top: 20, bottom: 20}}>
                      <CartesianGrid vertical={false} stroke={BRAND.grid}/>
                      <XAxis dataKey="name" axisLine={false} tick={{fill: BRAND.slate, fontWeight: 600}} />
                      <YAxis hide />
                      <Tooltip content={<CustomTooltipContent />} />
                      <Bar dataKey="valor" radius={[8,8,8,8]}>
                        {(dadosBase.dre || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartCard>
               </div>
           </div>
        )}

        {/* ======================= ABA: FISCAL ======================= */}
        {categoriaAtiva === "fiscal" && dadosBase && (
           <div className="rel-fade-in">
             <div className="rel-kpi-grid">
                <KpiCard title="Recuperação DAS" value={formatarMoeda(dadosBase.recuperacao)} subtext="Economia" icon={PiggyBank} trend="up" />
                <KpiCard title="Alíquota Média" value={`${dadosBase.aliquota || 0}%`} subtext="Simples Nacional" icon={Scale} trend="down" />
                <KpiCard title="Audit Erros" value={dadosBase.erros || 0} subtext="NCM/CEST vazios" icon={ShieldAlert} trend="neutral" />
             </div>
             <SectionHeader icon={ShieldAlert} title="Conformidade Tributária" />
             <div className="rel-chart-grid">
                <ChartCard title="Receita Segregada" isLoading={loading}>
                   <PieChart>
                     <Pie data={dadosBase.segregacao || []} innerRadius={60} outerRadius={80} dataKey="value">
                       {(dadosBase.segregacao || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                     </Pie>
                     <Tooltip content={<CustomTooltipContent />} /><Legend verticalAlign="bottom" iconType="circle" />
                   </PieChart>
                </ChartCard>
             </div>
           </div>
        )}

        {/* MENSAGEM DE ESPERA PARA ABAS SEM DADOS */}
        {!loading && !dadosBase && (
          <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <Layers size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <h3 style={{ color: '#64748b' }}>Aguardando conexão</h3>
            <p>O painel '{categoriaAtiva}' ainda não retornou dados do banco de dados.</p>
          </div>
        )}

      </div>
    </div>
  );
}