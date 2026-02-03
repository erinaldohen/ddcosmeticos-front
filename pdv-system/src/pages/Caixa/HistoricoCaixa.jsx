import React, { useState, useEffect } from 'react';
import {
    Archive, Calendar, Search, RefreshCw,
    Eye, ArrowDownCircle, User, X, Download,
    TrendingUp, TrendingDown, Minus, AlertTriangle, FileText
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './HistoricoCaixa.css';

const HistoricoCaixa = () => {
    // --- ESTADOS DE DADOS ---
    const [caixas, setCaixas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resumo, setResumo] = useState({ total: 0, qtd: 0 });

    // --- ESTADOS DO MODAL ---
    const [modalOpen, setModalOpen] = useState(false);
    const [caixaSelecionado, setCaixaSelecionado] = useState(null);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);

    // --- FILTROS (Padrão: Últimos 30 dias) ---
    const [dataInicio, setDataInicio] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dataFim, setDataFim] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    // --- PAGINAÇÃO ---
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // --- INICIALIZAÇÃO ---
    useEffect(() => {
        carregarCaixas(0, true);
        // eslint-disable-next-line
    }, []);

    // --- CARREGAR LISTA ---
    const carregarCaixas = async (pagina = 0, reset = false) => {
        if (loading && pagina > 0) return;
        setLoading(true);

        try {
            const params = {
                page: pagina,
                size: 20,
                sort: 'id,desc', // Ordenação decrescente (mais recente primeiro)
                inicio: dataInicio, // Parâmetro renomeado para bater com o Java
                fim: dataFim
            };

            const res = await api.get('/caixas', { params });
            const dadosBrutos = res.data.content || res.data || [];

            const novaLista = reset ? dadosBrutos : [...caixas, ...dadosBrutos];
            setCaixas(novaLista);
            calcularResumo(novaLista);
            setHasMore(dadosBrutos.length >= 20);

        } catch (error) {
            console.error("Erro histórico:", error);
            toast.error("Erro ao carregar histórico.");
        } finally {
            setLoading(false);
        }
    };

    // --- CARREGAR DETALHES (MODAL) ---
    const handleVerDetalhes = async (id) => {
        setModalOpen(true);
        setLoadingDetalhes(true);
        try {
            const res = await api.get(`/caixas/${id}`);
            setCaixaSelecionado(res.data);
        } catch (error) {
            console.error("Erro detalhes:", error);
            toast.error("Não foi possível carregar os detalhes.");
            setModalOpen(false);
        } finally {
            setLoadingDetalhes(false);
        }
    };

    // --- EXPORTAR PDF ---
    const handleExportarPDF = async () => {
        try {
            const toastId = toast.loading("Gerando PDF...");

            const params = { inicio: dataInicio, fim: dataFim };

            const response = await api.get('/caixas/relatorio/pdf', {
                params,
                responseType: 'blob' // Importante para arquivos binários
            });

            // Cria link temporário
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Relatorio_Caixa_${dataInicio}.pdf`);
            document.body.appendChild(link);
            link.click();

            // Limpa memória
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.dismiss(toastId);
            toast.success("Download concluído!");

        } catch (error) {
            console.error("Erro download:", error);
            toast.dismiss();
            toast.error("Erro ao gerar o PDF.");
        }
    };

    // --- HELPER FUNCTIONS ---
    const calcularResumo = (lista) => {
        const fechados = lista.filter(c => c.status !== 'ABERTO');
        // Usa o valor de fechamento ou o calculado se nulo
        const total = fechados.reduce((acc, c) => acc + (c.valorFechamento || c.valorCalculadoSistema || 0), 0);
        setResumo({ total, qtd: fechados.length });
    };

    const handleAtualizar = () => {
        setPage(0);
        carregarCaixas(0, true);
    };

    const handleCarregarMais = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        carregarCaixas(nextPage, false);
    };

    const formatMoeda = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatData = (dataStr) => {
        if (!dataStr) return '--';
        return new Date(dataStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    // Função segura para evitar erro de objeto no React
    const getUsuarioNome = (user) => {
        if (!user) return 'Sistema';
        if (typeof user === 'string') return user;
        return user.nome || user.username || 'Operador';
    };

    return (
        <div className="historico-container fade-in">
            {/* HEADER */}
            <div className="page-header">
                <div className="header-title">
                    <h1><Archive size={32} color="#6366f1" /> Histórico de Caixa</h1>
                    <p><b>{resumo.qtd}</b> fechamentos | Movimentação Total: <b style={{color:'#16a34a'}}>{formatMoeda(resumo.total)}</b></p>
                </div>
                <button className="btn-primary" onClick={handleAtualizar}>
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar
                </button>
            </div>

            {/* TOOLBAR */}
            <div className="toolbar">
                <div style={{flex: 1, display: 'flex', alignItems:'center', gap: 10, flexWrap:'wrap'}}>
                    <div className="date-range-box">
                        <Calendar size={18} color="#94a3b8" />
                        <input type="date" className="date-input" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                        <span style={{color:'#cbd5e1'}}>até</span>
                        <input type="date" className="date-input" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    </div>
                    <button className="btn-icon-text" onClick={handleAtualizar}>
                        <Search size={18} /> Filtrar
                    </button>
                </div>

                <div style={{flex:1}}></div>

                {/* BOTÃO EXPORTAR */}
                <button className="btn-icon-text" onClick={handleExportarPDF} title="Baixar Relatório">
                    <Download size={18} /> <span className="mobile-hide">Exportar PDF</span>
                </button>
            </div>

            {/* TABELA */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{width: '25%'}}>Caixa / Operador</th>
                            <th>Período</th>
                            <th style={{textAlign: 'right'}}>Saldo Inicial</th>
                            <th style={{textAlign: 'right'}}>Saldo Final</th>
                            <th style={{textAlign: 'right'}}>Conferência</th>
                            <th>Status</th>
                            <th style={{textAlign: 'right'}}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {caixas.length === 0 && !loading ? (
                            <tr><td colSpan="7" className="empty-state">Nenhum registro encontrado.</td></tr>
                        ) : (
                            caixas.map((caixa) => {
                                // Lógica de Valores
                                const valorEsperado = caixa.valorCalculadoSistema || caixa.valorCalculado || (caixa.saldoInicial + (caixa.totalEntradas || 0)) || 0;
                                const valorInformado = caixa.valorFechamento !== null ? caixa.valorFechamento : 0;
                                const diferenca = valorInformado - valorEsperado;

                                const statusClass = (caixa.status || 'FECHADO').toLowerCase();
                                const isAberto = statusClass === 'aberto';

                                return (
                                    <tr key={caixa.id}>
                                        <td>
                                            <div className="item-identity">
                                                <div className="item-avatar"><User size={20} /></div>
                                                <div className="item-info">
                                                    <h4>#{caixa.id} - {getUsuarioNome(caixa.usuarioAbertura)}</h4>
                                                    <span>PDV Principal</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="item-info">
                                                <span style={{display:'block', color:'#0f172a'}}>{formatData(caixa.dataAbertura)}</span>
                                                <span style={{display:'block', color: isAberto ? '#16a34a' : '#64748b'}}>
                                                    {isAberto ? 'Em andamento' : formatData(caixa.dataFechamento)}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{textAlign: 'right', color:'#64748b', fontWeight:500}}>
                                            {formatMoeda(caixa.saldoInicial)}
                                        </td>
                                        <td style={{textAlign: 'right'}}>
                                            {isAberto ? <span className="text-neutral">--</span> :
                                                <span className="value-main" style={{color: valorInformado === 0 ? '#ef4444' : '#0f172a'}}>
                                                    {formatMoeda(valorInformado)}
                                                </span>
                                            }
                                        </td>
                                        <td style={{textAlign: 'right'}}>
                                            {!isAberto ? (
                                                Math.abs(diferenca) > 0.05 ? (
                                                    <div style={{display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4}}>
                                                        {diferenca > 0 ? <TrendingUp size={14} color="#16a34a"/> : <TrendingDown size={14} color="#ef4444"/>}
                                                        <span className={diferenca > 0 ? 'text-success' : 'text-danger'}>
                                                            {diferenca > 0 ? '+' : ''}{formatMoeda(diferenca)}
                                                        </span>
                                                    </div>
                                                ) : <span className="text-success"><Minus size={14} /> Batido</span>
                                            ) : <span className="text-neutral">--</span>}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${statusClass}`}>
                                                <div style={{width:6, height:6, borderRadius:'50%', background:'currentColor', marginRight:6}}></div>
                                                {caixa.status || 'FECHADO'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn-icon-action view"
                                                    onClick={() => handleVerDetalhes(caixa.id)}
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {loading && <div style={{padding:20, textAlign:'center', color:'#6366f1'}}><RefreshCw size={24} className="spin" /></div>}

                {!loading && hasMore && caixas.length > 0 && (
                    <div className="load-more-container">
                        <button className="btn-icon-text" onClick={handleCarregarMais}>
                            <ArrowDownCircle size={18} /> Carregar Mais
                        </button>
                    </div>
                )}
            </div>

            {/* --- MODAL DE DETALHES --- */}
            {modalOpen && (
                <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><FileText size={20} color="#6366f1"/> Detalhes do Caixa #{caixaSelecionado?.id || '...'}</h2>
                            <button className="btn-close" onClick={() => setModalOpen(false)}><X size={20}/></button>
                        </div>

                        <div className="modal-body">
                            {loadingDetalhes || !caixaSelecionado ? (
                                <div style={{textAlign:'center', padding:30}}><RefreshCw className="spin"/> Carregando...</div>
                            ) : (
                                <>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="detail-label">Operador</span>
                                            <span className="detail-value">{getUsuarioNome(caixaSelecionado.usuarioAbertura)}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Status</span>
                                            <span className={`status-badge ${(caixaSelecionado.status || '').toLowerCase()}`}>
                                                {caixaSelecionado.status}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Abertura</span>
                                            <span className="detail-value">{formatData(caixaSelecionado.dataAbertura)}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">Fechamento</span>
                                            <span className="detail-value">{formatData(caixaSelecionado.dataFechamento)}</span>
                                        </div>
                                    </div>

                                    <div className="finance-summary">
                                        <h4 style={{margin:'0 0 15px 0', color:'#64748b', fontSize:'0.9rem', textTransform:'uppercase'}}>Resumo Financeiro</h4>

                                        <div className="finance-row">
                                            <span>Saldo Inicial (Fundo)</span>
                                            <span>{formatMoeda(caixaSelecionado.saldoInicial)}</span>
                                        </div>
                                        <div className="finance-row" style={{color:'#16a34a'}}>
                                            <span>(+) Total Vendas/Entradas</span>
                                            <span>{formatMoeda(caixaSelecionado.totalEntradas || 0)}</span>
                                        </div>
                                        <div className="finance-row" style={{color:'#ef4444'}}>
                                            <span>(-) Total Sangrias/Saídas</span>
                                            <span>{formatMoeda(caixaSelecionado.totalSaidas || 0)}</span>
                                        </div>

                                        <div className="finance-row total">
                                            <span>(=) Valor Esperado</span>
                                            <span>{formatMoeda(
                                                (caixaSelecionado.valorCalculadoSistema ||
                                                (caixaSelecionado.saldoInicial + (caixaSelecionado.totalEntradas||0) - (caixaSelecionado.totalSaidas||0)))
                                            )}</span>
                                        </div>

                                        <div className="finance-row" style={{marginTop:5, fontSize:'1.1rem', fontWeight:800, color:'#0f172a'}}>
                                            <span>Valor em Gaveta</span>
                                            <span>{formatMoeda(caixaSelecionado.valorFechamento || 0)}</span>
                                        </div>

                                        {(() => {
                                            const sistema = caixaSelecionado.valorCalculadoSistema || 0;
                                            const gaveta = caixaSelecionado.valorFechamento || 0;
                                            const diff = gaveta - sistema;
                                            if(Math.abs(diff) < 0.05) return null;

                                            return (
                                                <div style={{
                                                    marginTop: 15, padding: 10, borderRadius: 8,
                                                    background: diff > 0 ? '#f0fdf4' : '#fef2f2',
                                                    color: diff > 0 ? '#166534' : '#991b1b',
                                                    display:'flex', alignItems:'center', gap: 10, fontWeight: 700
                                                }}>
                                                    {diff > 0 ? <TrendingUp size={20}/> : <AlertTriangle size={20}/>}
                                                    <span>{diff > 0 ? 'Sobra:' : 'Quebra:'} {formatMoeda(diff)}</span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricoCaixa;