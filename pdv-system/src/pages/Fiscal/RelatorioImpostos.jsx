import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Landmark, TrendingUp, AlertTriangle, Download } from 'lucide-react';
import './RelatorioImpostos.css';

const RelatorioImpostos = () => {
    const [dados, setDados] = useState({
        totalIBS: 0,
        totalCBS: 0,
        totalSeletivo: 0,
        totalRetido: 0,
        historico: []
    });

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

    useEffect(() => {
        const mockDados = {
            totalIBS: 0,
            totalCBS: 0,
            totalSeletivo: 0,
            totalRetido: 0,
            historico: [
                { dia: 'Transição 2026', ibs: 0, cbs: 0, seletivo: 0 }
            ]
        };
        setDados(mockDados);
    }, []);

    const dataPie = [
        { name: 'IBS', value: dados.totalIBS || 1 },
        { name: 'CBS', value: dados.totalCBS || 1 },
        { name: 'Seletivo', value: dados.totalSeletivo || 0 },
    ];

    return (
        <> {/* Usando Fragment para evitar nesting desnecessário de containers */}
            <div className="header-relatorio">
                <div className="page-title">
                    <h2><Landmark /> Painel de Retenção Fiscal (LC 214)</h2>
                    <p>Monitoramento em tempo real do Split Payment.</p>
                </div>
                <button className="btn-export" onClick={() => window.print()}>
                    <Download size={18} /> Exportar Relatório
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <span className="label">Total Retido (Split Payment)</span>
                    <h3 className="value">R$ {dados.totalRetido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <span className="trend"><TrendingUp size={14} /> Aguardando vendas...</span>
                </div>
                <div className="stat-card">
                    <span className="label">IBS (Estadual/Mun.)</span>
                    <h3 className="value color-ibs">R$ {dados.totalIBS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="stat-card">
                    <span className="label">CBS (Federal)</span>
                    <h3 className="value color-cbs">R$ {dados.totalCBS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-box">
                    <h4>Evolução Diária</h4>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={dados.historico}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="dia" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="ibs" fill="#0088FE" name="IBS" />
                                <Bar dataKey="cbs" fill="#00C49F" name="CBS" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="chart-box">
                    <h4>Distribuição da Carga</h4>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={dataPie} innerRadius={60} outerRadius={80} dataKey="value" nameKey="name">
                                    {dataPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="alerta-fiscal">
                <AlertTriangle size={20} />
                <p>Dados baseados na Lei Complementar 214/2024. Alíquotas sujeitas a alteração pelo Comitê Gestor.</p>
            </div>
        </>
    );
};

export default RelatorioImpostos;