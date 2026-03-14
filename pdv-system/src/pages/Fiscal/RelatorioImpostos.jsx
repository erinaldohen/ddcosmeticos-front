import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, ComposedChart, Bar, Line
} from 'recharts';
import { Landmark, TrendingUp, AlertTriangle, Download, DollarSign, Percent, Calendar } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './RelatorioImpostos.css';

const RelatorioImpostos = () => {
    const [loading, setLoading] = useState(false);
    const [periodo, setPeriodo] = useState({
        inicio: new Date().toISOString().slice(0, 7) + '-01', // Início do mês atual
        fim: new Date().toISOString().slice(0, 10) // Hoje
    });

    const [dados, setDados] = useState({
        totalFaturamento: 0,
        totalIBS: 0,
        totalCBS: 0,
        totalSeletivo: 0,
        totalRetido: 0,
        aliquotaEfetiva: 0,
        historico: [],
        distribuicao: []
    });

    // Paleta de Cores Institucional/Fiscal (Moderna e Sóbria)
    const COLORS = {
        IBS: '#3b82f6',      // Azul (Estadual/Municipal)
        CBS: '#10b981',      // Verde (Federal)
        SELETIVO: '#f59e0b', // Laranja (Imposto do "Pecado")
        RETIDO: '#6366f1',   // Roxo (Total Retido)
        BRUTO: '#cbd5e1'     // Cinza (Faturamento)
    };

    useEffect(() => {
        carregarDadosReais();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodo]);

    const carregarDadosReais = async () => {
        setLoading(true);
        try {
            const response = await api.get('/fiscal/dashboard-resumo', {
                params: {
                    inicio: periodo.inicio,
                    fim: periodo.fim
                }
            });
            if (response.data) {
                 setDados(response.data);
            }
        } catch (error) {
            console.error("Erro ao carregar fiscal", error);
            toast.error("Erro ao sincronizar dados fiscais.");
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e) => {
        setPeriodo({ ...periodo, [e.target.name]: e.target.value });
    };

    // Tooltip Customizado para os Gráficos
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip-fiscal" style={{ background: '#fff', padding: '10px', border: '1px solid #ccc', borderRadius: '8px' }}>
                    <p className="label-date" style={{ fontWeight: 'bold', marginBottom: '5px' }}>{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color || entry.fill, margin: '2px 0', fontSize: '0.85rem' }}>
                            {entry.name}: R$ {Number(entry.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="fiscal-dashboard-container fade-in">
            {/* --- HEADER --- */}
            <header className="header-relatorio">
                <div className="page-title">
                    <div className="icon-wrapper"><Landmark size={28} /></div>
                    <div>
                        <h2>Painel de Inteligência Fiscal</h2>
                        <p className="subtitle">Monitoramento Split Payment (LC 214) & Carga Tributária</p>
                    </div>
                </div>
                <div className="actions-bar">
                    <div className="date-picker-group">
                        <Calendar size={16} />
                        <input type="date" name="inicio" value={periodo.inicio} onChange={handleDateChange} />
                        <span>até</span>
                        <input type="date" name="fim" value={periodo.fim} onChange={handleDateChange} />
                    </div>
                    <button className="btn-primary" onClick={() => window.print()}>
                        <Download size={18} /> PDF
                    </button>
                </div>
            </header>

            {loading ? (
                <div className="loading-state" style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                    Calculando tributos em tempo real...
                </div>
            ) : (
                <>
                    {/* --- KPI CARDS --- */}
                    <div className="stats-grid-modern">
                        {/* Card Principal: Split Payment */}
                        <div className="stat-card-modern main">
                            <div className="stat-icon-bg"><DollarSign size={24} color="#fff" /></div>
                            <div className="stat-content">
                                <span className="stat-label">Total Retido (Split Payment)</span>
                                <h3 className="stat-value">R$ {(dados.totalRetido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                                <span className="stat-trend positive">
                                    <TrendingUp size={14} /> Retido automaticamente na fonte
                                </span>
                            </div>
                        </div>

                        {/* Cards Secundários: Detalhamento */}
                        <div className="stat-card-modern">
                            <div className="stat-header">
                                <span className="stat-label">IBS (Est/Mun)</span>
                                <div className="stat-indicator" style={{ backgroundColor: COLORS.IBS }}></div>
                            </div>
                            <h3 className="stat-value">R$ {(dados.totalIBS || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                            <small className="text-muted">Competência Compartilhada</small>
                        </div>

                        <div className="stat-card-modern">
                            <div className="stat-header">
                                <span className="stat-label">CBS (Federal)</span>
                                <div className="stat-indicator" style={{ backgroundColor: COLORS.CBS }}></div>
                            </div>
                            <h3 className="stat-value">R$ {(dados.totalCBS || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                            <small className="text-muted">Contribuição Social</small>
                        </div>

                        <div className="stat-card-modern highlight">
                            <div className="stat-header">
                                <span className="stat-label">Carga Efetiva</span>
                                <Percent size={18} className="text-gray-400" />
                            </div>
                            <h3 className="stat-value">{(dados.aliquotaEfetiva || 0).toFixed(2)}%</h3>
                            <div className="progress-bar-fiscal">
                                <div className="progress-fill" style={{ width: `${Math.min(dados.aliquotaEfetiva || 0, 100)}%`, backgroundColor: COLORS.SELETIVO }}></div>
                            </div>
                            <small className="text-muted">Sobre Faturamento Bruto</small>
                        </div>
                    </div>

                    {/* --- GRÁFICOS --- */}
                                        <div className="charts-grid-modern">

                                            {/* 1. Evolução Diária (Area Chart) */}
                                            <div className="chart-box-modern big">
                                                <div className="chart-header">
                                                    <h4>Evolução da Arrecadação (Split)</h4>
                                                </div>
                                                {/* SOLUÇÃO DEFINITIVA: height={320} passado como número inteiro */}
                                                <div style={{ width: '100%' }}>
                                                    <ResponsiveContainer width="99%" height={320}>
                                                        <AreaChart data={dados.historico || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                            <defs>
                                                                <linearGradient id="colorIbs" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={COLORS.IBS} stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor={COLORS.IBS} stopOpacity={0} />
                                                                </linearGradient>
                                                                <linearGradient id="colorCbs" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor={COLORS.CBS} stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor={COLORS.CBS} stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <XAxis dataKey="dia" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Legend />
                                                            <Area type="monotone" dataKey="ibs" stroke={COLORS.IBS} fillOpacity={1} fill="url(#colorIbs)" name="IBS" stackId="1" />
                                                            <Area type="monotone" dataKey="cbs" stroke={COLORS.CBS} fillOpacity={1} fill="url(#colorCbs)" name="CBS" stackId="1" />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* 2. Distribuição (Donut) */}
                                            <div className="chart-box-modern">
                                                <h4>Composição da Carga</h4>
                                                <div style={{ width: '100%', position: 'relative' }}>
                                                    <ResponsiveContainer width="99%" height={320}>
                                                        <PieChart>
                                                            <Pie
                                                                data={dados.distribuicao && dados.distribuicao.length > 0 ? dados.distribuicao : [{name: 'Sem Dados', value: 1}]}
                                                                innerRadius={70}
                                                                outerRadius={90}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                            >
                                                                {(dados.distribuicao || []).map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={[COLORS.IBS, COLORS.CBS, COLORS.SELETIVO][index % 3]} />
                                                                ))}
                                                                {(!dados.distribuicao || dados.distribuicao.length === 0) && <Cell fill="#e2e8f0" />}
                                                            </Pie>
                                                            <Tooltip />
                                                            <Legend verticalAlign="bottom" height={36} />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="donut-center-text" style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                                                        <small style={{ display: 'block', color: '#64748b' }}>Total</small>
                                                        <strong style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                                                            {(dados.totalRetido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 3. Venda Bruta vs Líquida */}
                                            <div className="chart-box-modern full-width">
                                                <div className="chart-header">
                                                    <h4>Impacto no Caixa (Bruto vs Retido Estimado)</h4>
                                                </div>
                                                <div style={{ width: '100%' }}>
                                                    <ResponsiveContainer width="99%" height={250}>
                                                        <ComposedChart data={dados.historico || []} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                            <CartesianGrid stroke="#f5f5f5" />
                                                            <XAxis dataKey="dia" scale="band" fontSize={12} />
                                                            <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Legend />
                                                            <Bar dataKey="vendas" barSize={30} fill={COLORS.BRUTO} name="Faturamento Bruto" radius={[4, 4, 0, 0]} />
                                                            <Line
                                                                type="monotone"
                                                                dataKey={(item) => (item.ibs || 0) + (item.cbs || 0)}
                                                                stroke={COLORS.RETIDO}
                                                                strokeWidth={3}
                                                                name="Valor Retido (Estimado)"
                                                                dot={false}
                                                            />
                                                        </ComposedChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        </div>

                    {/* --- ALERTA --- */}
                    <div className="alerta-fiscal-modern">
                        <div className="icon-box"><AlertTriangle size={20} /></div>
                        <div>
                            <strong>Modo de Simulação Ativo</strong>
                            <p>O sistema está calculando os valores de IBS e CBS com base nas alíquotas configuradas no menu "Configurações &gt; Fiscal". A retenção real depende do processamento bancário e das regras de transição vigentes.</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default RelatorioImpostos;