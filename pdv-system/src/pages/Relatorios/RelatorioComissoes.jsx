import React, { useState, useEffect } from 'react';
import {
  Calendar, User, DollarSign, TrendingUp, Search,
  Award, RefreshCw, AlertCircle, Printer, PieChart
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './RelatorioComissoes.css';

const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const RelatorioComissoes = () => {
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [dataInicio, setDataInicio] = useState(firstDay);
    const [dataFim, setDataFim] = useState(today);
    const [vendedorId, setVendedorId] = useState('');

    const [vendedoresList, setVendedoresList] = useState([]);
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingPdf, setLoadingPdf] = useState(false);

    useEffect(() => {
        const carregarVendedores = async () => {
            try {
                const res = await api.get('/usuarios');
                const apenasVendedores = res.data.filter(u =>
                    ['GERENTE', 'ADMIN', 'VENDEDOR', 'CAIXA'].includes(u.perfil?.toUpperCase()) ||
                    ['ROLE_GERENTE', 'ROLE_ADMIN', 'ROLE_VENDEDOR', 'ROLE_CAIXA'].includes(u.role?.toUpperCase())
                );
                setVendedoresList(apenasVendedores.length > 0 ? apenasVendedores : res.data);
            } catch (error) {
                console.error("Erro ao carregar vendedores", error);
            }
        };
        carregarVendedores();
        buscarRelatorio(firstDay, today, '');
    }, []);

    const buscarRelatorio = async (inicio, fim, idVendedor) => {
        if (!inicio || !fim) return toast.warning("Selecione as datas.");
        setLoading(true);
        try {
            const params = { dataInicio: inicio, dataFim: fim };
            if (idVendedor) params.vendedorId = idVendedor;
            const response = await api.get('/relatorios/comissoes', { params });
            setDados(response.data);
        } catch (error) {
            toast.error("Erro ao gerar relatório. Verifique a conexão.");
        } finally {
            setLoading(false);
        }
    };

    const handleGerar = (e) => {
        e.preventDefault();
        buscarRelatorio(dataInicio, dataFim, vendedorId);
    };

    const handlePrint = async () => {
        setLoadingPdf(true);
        try {
            const response = await api.get('/relatorios/comissoes/pdf', {
                params: { dataInicio, dataFim, vendedorId },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `comissoes_${dataInicio}_${dataFim}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("PDF gerado com sucesso!");
        } catch (e) {
            toast.error("Erro ao gerar PDF.");
        } finally {
            setLoadingPdf(false);
        }
    };

    return (
        <div className="com-premium-container fade-in">
            <header className="com-header">
                <div className="com-header-title">
                    <div className="com-icon-box">
                        <Award size={28} color="#3b82f6" />
                    </div>
                    <div>
                        <h1>Comissões e Desempenho</h1>
                        <p>Apuração de ganhos e ranking de vendas da equipe</p>
                    </div>
                </div>
            </header>

            {/* BARRA DE FILTROS ELEGANTE */}
            <form className="com-toolbar" onSubmit={handleGerar}>
                <div className="com-filters-wrapper">
                    <div className="com-input-group">
                        <label>Data Inicial</label>
                        <div className="input-with-icon">
                            <Calendar size={16} className="input-icon" />
                            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required />
                        </div>
                    </div>

                    <div className="com-input-group">
                        <label>Data Final</label>
                        <div className="input-with-icon">
                            <Calendar size={16} className="input-icon" />
                            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} required />
                        </div>
                    </div>

                    <div className="com-input-group">
                        <label>Vendedor</label>
                        <div className="input-with-icon">
                            <User size={16} className="input-icon" />
                            <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                                <option value="">Todos os Vendedores</option>
                                {vendedoresList.map(v => (
                                    <option key={v.id} value={v.id}>{v.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="com-actions-wrapper">
                    <button type="button" className="com-btn-secondary" onClick={handlePrint} disabled={loadingPdf || !dados}>
                        {loadingPdf ? <RefreshCw className="spin" size={18} /> : <Printer size={18} />}
                        <span>Exportar PDF</span>
                    </button>
                    <button type="submit" className="com-btn-primary" disabled={loading}>
                        {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
                        <span>Gerar Relatório</span>
                    </button>
                </div>
            </form>

            {loading && !dados ? (
                <div className="com-empty-state">
                    <RefreshCw className="spin text-slate-300" size={40} />
                    <h2>Processando comissões...</h2>
                </div>
            ) : dados ? (
                <>
                    {/* KPI CARDS - MESMO ESTILO DO CONTAS A PAGAR */}
                    <div className="com-kpi-grid">
                        <div className="com-kpi-card info">
                            <div className="kpi-icon-wrapper"><TrendingUp size={24} /></div>
                            <div className="kpi-content">
                                <span>Total Faturado</span>
                                <h3>{formatMoney(dados.totalVendidoGeral)}</h3>
                            </div>
                        </div>

                        <div className="com-kpi-card success">
                            <div className="kpi-icon-wrapper"><DollarSign size={24} /></div>
                            <div className="kpi-content">
                                <span>Comissões a Pagar</span>
                                <h3>{formatMoney(dados.totalComissoesGeral)}</h3>
                            </div>
                        </div>

                        <div className="com-kpi-card purple">
                            <div className="kpi-icon-wrapper"><PieChart size={24} /></div>
                            <div className="kpi-content">
                                <span>Taxa Média Global</span>
                                <h3>
                                    {dados.totalVendidoGeral > 0
                                      ? ((dados.totalComissoesGeral / dados.totalVendidoGeral) * 100).toFixed(1) + '%'
                                      : '0%'}
                                </h3>
                            </div>
                        </div>
                    </div>

                    {/* TABELA DE RANKING (APP CARDS NO MOBILE) */}
                    <div className="com-table-card">
                        {dados.vendedores.length === 0 ? (
                            <div className="com-empty-state">
                                <AlertCircle size={48} className="text-slate-300" />
                                <h2>Nenhuma venda processada neste período.</h2>
                            </div>
                        ) : (
                            <table className="com-table">
                                <thead>
                                    <tr>
                                        <th width="80" className="text-center">Rank</th>
                                        <th>Vendedor</th>
                                        <th className="text-center hide-mobile-col">Vendas Feitas</th>
                                        <th className="text-right">Faturamento Base</th>
                                        <th className="text-right">Comissão a Pagar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dados.vendedores.map((vendedor, index) => (
                                        <tr key={vendedor.idVendedor} className="com-table-row">
                                            <td className="text-center td-mobile-flex rank-cell">
                                                <span className="mobile-label hide-desktop">Posição no Ranking</span>
                                                <div className={`badge-rank rank-${index + 1}`}>
                                                    {index + 1 === 1 ? <Award size={18}/> : index + 1}
                                                </div>
                                            </td>

                                            <td className="td-mobile-flex">
                                                <span className="mobile-label hide-desktop"><User size={14}/> Vendedor</span>
                                                <div>
                                                    <div className="com-td-title">{vendedor.nomeVendedor}</div>
                                                    <div className="com-td-subtitle hide-desktop mt-1">
                                                        <span>{vendedor.quantidadeVendas} vendas computadas</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="text-center hide-mobile-col">
                                                <span className="qtd-vendas-badge">{vendedor.quantidadeVendas} cupons</span>
                                            </td>

                                            <td className="text-right td-mobile-flex">
                                                <span className="mobile-label hide-desktop"><TrendingUp size={14}/> Faturamento Base</span>
                                                <div className="com-td-value-stack">
                                                    <span className="value-restante">{formatMoney(vendedor.valorTotalVendido)}</span>
                                                    {vendedor.valorBaseComissao < vendedor.valorTotalVendido && (
                                                        <span className="value-original" title="Base de cálculo após descontos/devoluções">Base: {formatMoney(vendedor.valorBaseComissao)}</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="text-right td-mobile-flex">
                                                <span className="mobile-label hide-desktop"><DollarSign size={14}/> Comissão a Pagar</span>
                                                <div className="valor-destaque text-success">{formatMoney(vendedor.valorComissao)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default RelatorioComissoes;