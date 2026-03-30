import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import api from "../../services/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart
} from "recharts";
import {
  TrendingUp, Download, Calendar, PackageCheck, DollarSign,
  Layers, FileText, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
  Sparkles, AlertTriangle, Target, ShoppingBag, PiggyBank, Wallet,
  BarChart3, Briefcase, ArrowDownCircle, ArrowUpCircle, Scale, ShieldAlert, HelpCircle,
  Landmark, Building2
} from "lucide-react";
import './Relatorios.css';

// ==========================================
// 1. IDENTIDADE VISUAL E FORMATAÇÃO
// ==========================================
const BRAND = { primary: '#ec4899', secondary: '#3b82f6', accent: '#8b5cf6', success: '#10b981', warning: '#f59e0b', slate: '#94a3b8', grid: '#f1f5f9' };
const BRAND_PALETTE = [BRAND.secondary, BRAND.primary, BRAND.accent, BRAND.success, BRAND.warning, BRAND.slate];
const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

// ✅ ATUALIZAÇÃO DE UX: Rótulos percentuais nos gráficos de Pizza
const renderLabelEmPorcentagem = ({ percent }) => {
  if (percent < 0.05) return null; // Esconde se for muito pequeno para não sobrepor texto
  return `${(percent * 100).toFixed(1)}%`;
};

// ==========================================
// 2. COMPONENTES AUXILIARES (UX & TOOLTIPS)
// ==========================================
const InfoTooltip = ({ text }) => (
  <div className="info-tooltip-wrapper">
    <HelpCircle size={16} className="info-icon" />
    <div className="info-tooltip-content">{text}</div>
  </div>
);

const NanoInsightIA = ({ insight, tipo = 'info' }) => (
  <div className={`nano-insight insight-${tipo}`}>
    <Sparkles size={14} className="insight-icon" />
    <span className="insight-text">{insight}</span>
  </div>
);

const SectionHeader = ({ icon: Icon, title }) => (
  <div className="rel-section-header">
    <div className="rsh-title-row">
      <div className="rsh-icon"><Icon size={16} /></div><h2>{title}</h2><div className="rsh-line"></div>
    </div>
  </div>
);

const ChartCard = ({ title, infoText, onDownload, insight, children, fullWidth = false, isLoading = false }) => (
  <div className={`rel-chart-card ${fullWidth ? 'col-span-full' : ''}`}>
    <div className="rcc-header">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h3>{title}</h3>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
      <button onClick={onDownload} title="Exportar dados deste gráfico para Excel"><Download size={18} /></button>
    </div>
    <div className="rcc-content" style={{ width: '100%', height: 300 }}>
      {isLoading ? <div className="rel-spinner"></div> : <ResponsiveContainer width="99%" height={300}>{children}</ResponsiveContainer>}
    </div>
    {insight && <div className="rcc-footer-insight"><NanoInsightIA insight={insight} /></div>}
  </div>
);

const KpiCard = ({ title, value, subtext, icon: Icon, trend, highlight = false, infoText }) => (
  <div className={`rel-kpi-card ${highlight ? 'highlight-kpi' : ''}`}>
    <div className="rkc-top">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          {title}
          {infoText && <InfoTooltip text={infoText} />}
        </div>
        <h4>{value}</h4>
      </div>
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
  const [dataInicio, setDataInicio] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));

  const [dadosBase, setDadosBase] = useState(null);
  const [loading, setLoading] = useState(false);

  const carregarRelatorio = async () => {
    setLoading(true);
    setDadosBase(null);
    try {
      const params = { inicio: dataInicio, fim: dataFim };
      const response = await api.get(`/relatorios/${categoriaAtiva}`, { params });
      setDadosBase(response.data);
    } catch (error) {
      toast.error(`Módulo de ${categoriaAtiva} indisponível ou sem dados.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarRelatorio();
  }, [categoriaAtiva, dataInicio, dataFim]);

  const exportarPDF = async () => {
    const toastId = toast.loading("A IA está a redigir o Dossiê Executivo Simples...");
    try {
      const response = await api.get('/relatorios/dossie-executivo/pdf', {
        params: { inicio: dataInicio, fim: dataFim },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Dossie_Simples_DD_${dataFim}.pdf`);
      document.body.appendChild(link); link.click(); link.parentNode.removeChild(link);

      toast.update(toastId, { render: "Dossiê gerado com sucesso!", type: "success", isLoading: false, autoClose: 4000 });
    } catch (err) {
      toast.update(toastId, { render: "Erro ao gerar o Dossiê no servidor.", type: "error", isLoading: false, autoClose: 5000 });
    }
  };

  const gerarBalancoTrimestral = async () => {
    const tri = document.getElementById('q-trimestre').value;
    const ano = document.getElementById('q-ano').value;
    const toastId = toast.loading("A estruturar Balanço Trimestral S/A de Investidores...");
    try {
        const response = await api.get(`/relatorios/balanco-trimestral/pdf?ano=${ano}&trimestre=${tri}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Balanco_Resultados_${tri}T${ano}.pdf`);
        document.body.appendChild(link); link.click(); link.parentNode.removeChild(link);
        toast.update(toastId, { render: "Balanço Corporativo descarregado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (e) { toast.update(toastId, { render: "Falha ao compilar balanço. Verifique conexão.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  const exportarExcel = (nomeArquivo, dadosArray) => {
    if (!dadosArray || dadosArray.length === 0) {
      toast.warn("Não existem dados nos gráficos para gerar o Excel.");
      return;
    }
    try {
      const colunas = Object.keys(dadosArray[0]).join(",");
      const linhas = dadosArray.map(obj => Object.values(obj).join(",")).join("\n");
      const csvContent = "data:text/csv;charset=utf-8," + colunas + "\n" + linhas;

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${nomeArquivo}_${dataFim}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success(`Planilha ${nomeArquivo}.csv baixada!`);
    } catch (e) {
      toast.error("Falha ao converter dados para Excel.");
    }
  };

  const exportarTudoExcel = () => {
    if(!dadosBase) { toast.warn("Sem dados para exportar."); return; }
    toast.info("Processando tabelas Excel...");
    if(categoriaAtiva === 'vendas') exportarExcel("Vendas_Diarias", dadosBase.vendasDiarias);
    if(categoriaAtiva === 'estoque') exportarExcel("Curva_ABC", dadosBase.curvaABC);
    if(categoriaAtiva === 'financeiro') exportarExcel("DRE", dadosBase.dre);
    if(categoriaAtiva === 'fiscal') exportarExcel("Impostos", dadosBase.segregacao);
  };

  const calcGMROI = () => {
      try {
        if(!dadosBase || categoriaAtiva !== 'estoque') return 0;
        const custo = Number(dadosBase.custoEstoque) || 1;
        const venda = Number(dadosBase.vendaProjetada) || 0;
        const lucroEstimado = venda - custo;
        return custo > 0 ? (lucroEstimado / custo) : 0;
      } catch (e) { return 0; }
  };

  const calcEBITDA = () => {
      try {
        if(!dadosBase || categoriaAtiva !== 'financeiro') return 0;
        const dreData = Array.isArray(dadosBase.dre) ? dadosBase.dre : [];

        const receita = dreData.find(i => i?.name?.includes("Receita"))?.valor || 0;
        const cmv = dreData.find(i => i?.name?.includes("CMV"))?.valor || 0;
        const despOp = dreData.find(i => i?.name?.includes("Despesas"))?.valor || 0;

        return Number(receita) - Number(cmv) - Number(despOp);
      } catch (e) { return 0; }
  };

  return (
    <div className="rel-container">
      <svg style={{ height: 0, width: 0, position: 'absolute' }}>
        <defs>
          <linearGradient id="gradSecondary" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND.secondary} stopOpacity={0.4} /><stop offset="100%" stopColor={BRAND.secondary} stopOpacity={0.05} /></linearGradient>
        </defs>
      </svg>

      <div className="rel-header no-print">
        <div className="rh-title">
          <div className="rh-icon"><TrendingUp size={28} /></div>
          <div><h1>Central de Inteligência</h1><p>Visão Estratégica DD Cosméticos</p></div>
        </div>

        <div className="rh-actions">
          <div className="rh-date-picker">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            <span className="rh-dp-sep">•</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <button className="btn-export" onClick={exportarTudoExcel}><FileSpreadsheet size={16} /> EXCEL</button>
          <button className="btn-export pdf" onClick={exportarPDF}><FileText size={16} /> PDF Diário</button>

          <div className="corporate-action-box" style={{display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px', marginLeft: '4px'}}>
             <Building2 size={18} color="#0f172a" title="Portal Corporativo S/A" />
             <select id="q-trimestre" style={{padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: 'bold'}} defaultValue="1">
                <option value="1">1º Trimestre</option>
                <option value="2">2º Trimestre</option>
                <option value="3">3º Trimestre</option>
                <option value="4">4º Trimestre</option>
             </select>
             <select id="q-ano" style={{padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: 'bold'}} defaultValue={new Date().getFullYear()}>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
             </select>
             <button className="btn-export pdf" style={{background: '#0f172a', color: 'white'}} onClick={gerarBalancoTrimestral}>
               Gerar Balanço S/A
             </button>
          </div>
        </div>
      </div>

      <div className="rel-tabs no-print">
        <button className={categoriaAtiva === "vendas" ? "active" : ""} onClick={() => setCategoriaAtiva("vendas")}><TrendingUp size={16}/> Comercial</button>
        <button className={categoriaAtiva === "estoque" ? "active" : ""} onClick={() => setCategoriaAtiva("estoque")}><PackageCheck size={16}/> Estoque</button>
        <button className={categoriaAtiva === "financeiro" ? "active" : ""} onClick={() => setCategoriaAtiva("financeiro")}><DollarSign size={16}/> Financeiro</button>
        {/* A Aba Fiscal foi removida daqui, como pedido (sem CBS e IBS) */}
      </div>

      <div id="dashboard-print-area" className="rel-content-area">
        {/* ======================= ABA: VENDAS ======================= */}
        {categoriaAtiva === "vendas" && dadosBase && (
          <div className="rel-fade-in">
            <div className="rel-kpi-grid">
                <KpiCard title="Faturamento Bruto" value={formatarMoeda(dadosBase.totalFaturado)} subtext="No período" icon={DollarSign} trend="up"
                         infoText="Soma de todas as vendas antes de deduzir custos." />
                <KpiCard title="Cupom Médio" value={formatarMoeda(dadosBase.ticketMedio)} subtext="Média real" icon={ShoppingBag} trend="neutral"
                         infoText="Valor médio que cada cliente gasta na loja." />
                <KpiCard title="Total Pedidos" value={dadosBase.quantidadeVendas || 0} subtext="Volume" icon={Target} trend="up"
                         infoText="Quantidade total de vendas concretizadas." />
                <KpiCard title="Margem Contribuição" value={formatarMoeda(dadosBase.lucroBrutoEstimado)} subtext="Lucro Bruto" icon={PiggyBank} trend="up"
                         infoText="O que sobra das vendas após descontar o custo das mercadorias. Capital para pagar as contas." />
            </div>
            <SectionHeader icon={BarChart3} title="Análise Comercial Visual" />
            <div className="rel-chart-grid">
                <ChartCard title="Tendência de Vendas"
                           infoText="Evolução diária do faturamento. Ajuda a identificar picos e vales."
                           fullWidth isLoading={loading} onDownload={() => exportarExcel("Vendas", dadosBase.vendasDiarias)}
                           insight="Os picos indicam forte fluxo. Se os vales ocorrem sempre nos mesmos dias da semana, crie campanhas nesses dias.">
                    <AreaChart data={dadosBase.vendasDiarias || []} margin={{top: 10, right: 10, left: -10, bottom: 0}}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BRAND.grid} />
                      <XAxis dataKey="data" tick={{fill: BRAND.slate, fontSize: 11}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: BRAND.slate, fontSize: 11}} tickFormatter={(v) => `R$${v}`} />
                      {/* ✅ O HOVER EM DINHEIRO: */}
                      <Tooltip formatter={(value) => [formatarMoeda(value), "Total"]} />
                      <Area type="monotone" dataKey="total" name="Vendas" fill="url(#gradSecondary)" stroke={BRAND.secondary} strokeWidth={4} />
                    </AreaChart>
                </ChartCard>
                <ChartCard title="Mix de Pagamentos"
                           infoText="Proporção das formas de pagamento usadas pelos clientes."
                           isLoading={loading} onDownload={() => exportarExcel("Pagamentos", dadosBase.porPagamento)}
                           insight="Altas taxas de Crédito prejudicam o fluxo de caixa imediato. Estimule descontos no PIX.">
                    <PieChart>
                      <Pie data={dadosBase.porPagamento || []} innerRadius={60} outerRadius={80} dataKey="valorTotal" nameKey="formaPagamento" label={renderLabelEmPorcentagem}>
                        {(dadosBase.porPagamento || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                      </Pie>
                      {/* ✅ O HOVER EM DINHEIRO: */}
                      <Tooltip formatter={(value) => formatarMoeda(value)} />
                      <Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                </ChartCard>
                <ChartCard title="Distribuição de Ticket"
                           infoText="Concentração de vendas por faixa de valores."
                           isLoading={loading} onDownload={() => exportarExcel("Ticket", dadosBase.distribuicaoTicket)}
                           insight="Observe onde a barra é maior para entender qual é a capacidade financeira do seu público fiel.">
                     <BarChart data={dadosBase.distribuicaoTicket || []} margin={{top: 10}}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={BRAND.grid} />
                        <XAxis dataKey="range" tick={{fontSize: 11, fill: BRAND.slate}} axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="qtd" name="Qtd Vendas" fill={BRAND.accent} radius={[8,8,0,0]} />
                     </BarChart>
                </ChartCard>
            </div>
          </div>
        )}

        {/* ======================= ABA: ESTOQUE ======================= */}
        {categoriaAtiva === "estoque" && dadosBase && (
           <div className="rel-fade-in">
             <div className="rel-kpi-grid">
                <KpiCard title="Custo Estoque" value={formatarMoeda(dadosBase.custoEstoque)} subtext="Capital Retido" icon={PackageCheck} trend="neutral"
                         infoText="Valor pago aos fornecedores pelas mercadorias que estão na prateleira." />
                <KpiCard title="GMROI (Lucro p/ R$1)" value={`R$ ${calcGMROI().toFixed(2)}`} subtext="Retorno sobre Estoque" icon={TrendingUp} trend="up" highlight
                         infoText="Indicador Ouro: Retorno gerado para cada 1 Real imobilizado em estoque." />
                <KpiCard title="Mix Produtos" value={dadosBase.mixProdutos || 0} subtext="Itens ativos" icon={Briefcase} trend="up"
                         infoText="Quantidade de SKUs distintos ativos e à venda." />
                <KpiCard title="Ruptura" value={`${dadosBase.ruptura || 0}%`} subtext="Risco de falta" icon={AlertTriangle} trend="down"
                         infoText="Percentagem de produtos cadastrados que se encontram com quantidade zero." />
             </div>
             <SectionHeader icon={Target} title="Inteligência de Portfólio" />
             <div className="rel-chart-grid">
                <ChartCard title="Curva ABC de Receita"
                           infoText="Relação entre volume de produtos e receita. A Curva A sustenta o negócio."
                           fullWidth isLoading={loading} onDownload={() => exportarExcel("Curva_ABC", dadosBase.curvaABC)}
                           insight="Produtos A geram o maior lucro; nunca os deixe faltar. Produtos C precisam de liquidação.">
                    <ComposedChart data={dadosBase.curvaABC || []} margin={{left: -20}}>
                       <CartesianGrid strokeDasharray="3 3" stroke={BRAND.grid} vertical={false} />
                       <XAxis dataKey="name" tick={{fill: BRAND.slate, fontSize: 10}}/>
                       <YAxis axisLine={false} />
                       <Tooltip />
                       <Bar dataKey="produtos" name="Volume %" fill={BRAND.slate} radius={[4,4,0,0]} fillOpacity={0.5} />
                       <Line type="monotone" dataKey="receita" name="Receita %" stroke={BRAND.secondary} strokeWidth={4} />
                    </ComposedChart>
                </ChartCard>
                <ChartCard title="Aging (Idade do Estoque)"
                           infoText="Classificação dos itens pelo tempo que estão sem ser vendidos."
                           isLoading={loading} onDownload={() => exportarExcel("Aging", dadosBase.aging)}
                           insight="Fatias acima de 90 dias representam dinheiro a perder valor. Sugerido fazer promoção desses itens.">
                  <PieChart>
                    <Pie data={dadosBase.aging || []} innerRadius={60} outerRadius={80} dataKey="value" label={renderLabelEmPorcentagem}>
                      {(dadosBase.aging || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                    </Pie>
                    {/* ✅ O HOVER EM DINHEIRO (caso os valores do backend sejam monetários, se forem qtd, ignore o formatarMoeda) */}
                    <Tooltip formatter={(value) => formatarMoeda(value)} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ChartCard>
             </div>
           </div>
        )}

        {/* ======================= ABA: FINANCEIRO ======================= */}
        {categoriaAtiva === "financeiro" && dadosBase && (
           <div className="rel-fade-in">
               <div className="rel-kpi-grid">
                  <KpiCard title="EBITDA Operacional" value={formatarMoeda(calcEBITDA())} subtext="Geração de Caixa Real" icon={Landmark} trend="up" highlight
                           infoText="Lucro puramente operacional (antes de juros e impostos). A verdadeira saúde da empresa." />
                  <KpiCard title="Saldo em Caixa" value={formatarMoeda(dadosBase.saldo)} subtext="Atual" icon={Wallet} trend="neutral"
                           infoText="Projeção líquida: (Receitas + Entradas) - Pagamentos agendados." />
                  <KpiCard title="A Pagar" value={formatarMoeda(dadosBase.aPagar)} subtext="Despesas" icon={ArrowDownCircle} trend="down"
                           infoText="Total de obrigações de saída no período selecionado." />
                  <KpiCard title="A Receber" value={formatarMoeda(dadosBase.aReceber)} subtext="Previsão" icon={ArrowUpCircle} trend="up"
                           infoText="Entradas programadas (cartões a cair, boletos a receber)." />
               </div>
               <SectionHeader icon={Wallet} title="Fluxo e Despesas" />
               <div className="rel-chart-grid">
                  <ChartCard title="DRE Simplificado"
                             infoText="DRE: Compara as Receitas Brutas com o CMV e os Custos Operacionais."
                             fullWidth isLoading={loading} onDownload={() => exportarExcel("DRE", dadosBase.dre)}
                             insight="O 'Resultado' reflete o ganho real. Se a barra de Despesas passar do CMV, a operação está com custos fixos pesados.">
                    <BarChart data={dadosBase.dre || []} margin={{top: 20, bottom: 20}}>
                      <CartesianGrid vertical={false} stroke={BRAND.grid}/>
                      <XAxis dataKey="name" axisLine={false} tick={{fill: BRAND.slate, fontWeight: 600}} />
                      <YAxis hide />
                      <Tooltip formatter={(value) => [formatarMoeda(value), "Valor"]}/>
                      <Bar dataKey="valor" radius={[8,8,8,8]}>
                        {(dadosBase.dre || []).map((e, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartCard>
               </div>
           </div>
        )}
      </div>
    </div>
  );
}