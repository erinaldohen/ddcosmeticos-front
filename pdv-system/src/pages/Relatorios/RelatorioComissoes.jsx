import React, { useState, useEffect } from 'react';
import {
  Calendar, User, DollarSign, TrendingUp, Search,
  Award, RefreshCw, AlertCircle, Printer
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
        <div className="comissoes-container modern-container">
            <header className="list-header mb-4">
                <div className="header-title-row">
                    <div>
                        <h1 className="title-gradient">Comissões por Vendedor</h1>
                        <p className="subtitle">Apuração de ganhos e ranking de desempenho.</p>
                    </div>
                </div>
            </header>

            {/* BARRA DE FILTROS */}
            <form className="filtros-bar" onSubmit={handleGerar}>
                <div className="filtro-grupo">
                    <label>Data Inicial</label>
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required />
                </div>
                <div className="filtro-grupo">
                    <label>Data Final</label>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} required />
                </div>
                <div className="filtro-grupo">
                    <label>Vendedor</label>
                    <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}>
                        <option value="">Todos os Vendedores</option>
                        {vendedoresList.map(v => (
                            <option key={v.id} value={v.id}>{v.nome}</option>
                        ))}
                    </select>
                </div>

                <div className="cfg-flex gap-sm">
                    <button type="submit" className="btn-gerar" disabled={loading}>
                        {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
                        Gerar
                    </button>

                    <button
                        type="button"
                        className="btn-gerar"
                        onClick={handlePrint}
                        style={{ background: '#6366f1' }}
                        disabled={loadingPdf || !dados}
                    >
                        {loadingPdf ? <RefreshCw className="spin" size={18} /> : <Printer size={18} />}
                        PDF
                    </button>
                </div>
            </form>

            {loading && !dados ? (
                <div className="flex-center p-5"><RefreshCw className="spin text-blue" size={40} /></div>
            ) : dados ? (
                <>
                    {/* CARDS DE RESUMO */}
                    <div className="cards-resumo">
                        <div className="card-resumo blue">
                            <div className="card-icone"><TrendingUp size={32} /></div>
                            <div className="card-info">
                                <h3>Total Faturado</h3>
                                <h2>{formatMoney(dados.totalVendidoGeral)}</h2>
                            </div>
                        </div>

                        <div className="card-resumo green">
                            <div className="card-icone"><DollarSign size={32} /></div>
                            <div className="card-info">
                                <h3>Comissões a Pagar</h3>
                                <h2>{formatMoney(dados.totalComissoesGeral)}</h2>
                            </div>
                        </div>
                    </div>

                    {/* TABELA DE RANKING */}
                    <div className="ranking-table">
                        {dados.vendedores.length === 0 ? (
                            <div className="empty-state p-5 text-center">
                                <AlertCircle size={48} color="#94a3b8" className="mb-3" />
                                <h3>Nenhuma venda encontrada</h3>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th width="80" className="text-center">Pos.</th>
                                        <th>Vendedor</th>
                                        <th className="text-center">Vendas</th>
                                        <th className="text-right">Faturamento</th>
                                        <th className="text-right">Base de Cálculo</th>
                                        <th className="text-right">Comissão</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dados.vendedores.map((vendedor, index) => (
                                        <tr key={vendedor.idVendedor}>
                                            <td className="text-center">
                                                <span className={`badge-rank rank-${index + 1}`}>
                                                    {index + 1 === 1 ? <Award size={18}/> : index + 1}
                                                </span>
                                            </td>
                                            <td>{vendedor.nomeVendedor}</td>
                                            <td className="text-center">{vendedor.quantidadeVendas}</td>
                                            <td className="text-right">{formatMoney(vendedor.valorTotalVendido)}</td>
                                            <td className="text-right">{formatMoney(vendedor.valorBaseComissao)}</td>
                                            <td className="text-right valor-destaque">{formatMoney(vendedor.valorComissao)}</td>
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