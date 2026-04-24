    import React, { useState, useEffect } from 'react';
    import { Inbox, FileText, CheckCircle, RefreshCw, DownloadCloud, Calendar, Filter } from 'lucide-react';
    import { toast } from 'react-toastify';
    import { useNavigate } from 'react-router-dom';
    import api from '../../services/api';
    import './CaixaEntradaNotas.css';

    const CaixaEntradaNotas = () => {
        const navigate = useNavigate();

        const [notasPendentes, setNotasPendentes] = useState([]);
        const [loading, setLoading] = useState(true);
        const [importandoId, setImportandoId] = useState(null);

        const [chaveBusca, setChaveBusca] = useState('');
        const [buscandoChave, setBuscandoChave] = useState(false);

        // 🔥 CORREÇÃO: Limpamos os filtros iniciais para mostrar TUDO! 🔥
        const [dataInicio, setDataInicio] = useState('');
        const [dataFim, setDataFim] = useState('');

        const carregarCaixaDeEntrada = async () => {
            setLoading(true);
            try {
                let url = '/estoque/notas-pendentes';

                if (dataInicio && dataFim) {
                    url += `?dataInicio=${dataInicio}&dataFim=${dataFim}`;
                }

                const res = await api.get(url, { silent: true });
                setNotasPendentes(res.data || []);
            } catch (error) {
                console.error("Erro ao buscar notas:", error);
                if (error.response && error.response.status === 403) {
                    toast.error("A sua sessão expirou. Por favor, faça login novamente.");
                } else {
                    toast.error("Erro ao carregar as notas.");
                }
            } finally {
                setLoading(false);
            }
        };

        useEffect(() => {
            carregarCaixaDeEntrada();
        }, []);

        const buscarPorChave = async (e) => {
            e.preventDefault();
            if (!chaveBusca || chaveBusca.replace(/\D/g, '').length !== 44) {
                toast.warning("Digite os 44 números da Chave de Acesso.");
                return;
            }

            setBuscandoChave(true);
            const toastId = toast.loading("A localizar nota específica nos servidores do Governo...");
            try {
                const limpa = chaveBusca.replace(/\D/g, '');
                const res = await api.post(`/estoque/notas-pendentes/buscar-chave/${limpa}`);
                toast.update(toastId, { render: res.data, type: "success", isLoading: false, autoClose: 4000 });
                setChaveBusca('');
                await carregarCaixaDeEntrada();
            } catch (error) {
                toast.update(toastId, { render: error.response?.data || "Falha ao buscar a chave.", type: "error", isLoading: false, autoClose: 5000 });
            } finally {
                setBuscandoChave(false);
            }
        };

        const forcarSincronizacao = async () => {
            setLoading(true);
            const toastId = toast.loading("A processar a fila da SEFAZ...");
            try {
                await api.post('/estoque/notas-pendentes/sincronizar');
                toast.update(toastId, { render: "Fila da SEFAZ sincronizada com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
                await carregarCaixaDeEntrada();
            } catch (error) {
                toast.update(toastId, { render: error.response?.data || "Falha ao sincronizar com a SEFAZ.", type: "error", isLoading: false, autoClose: 4000 });
                setLoading(false);
            }
        };

        // 🔥 O FLUXO MAJESTOSO (MANIFESTAR -> BAIXAR -> TELA DE ESTOQUE)
        const handleSolicitarXML = async (id, fornecedor, status) => {
            setImportandoId(id); // Trava o botão para evitar duplos cliques

            if (status === 'PENDENTE_MANIFESTACAO') {
                const toastId = toast.loading(`Autorizando a SEFAZ a libertar o XML de ${fornecedor}...`);
                try {
                    await api.post(`/estoque/notas-pendentes/${id}/manifestar`);
                    toast.update(toastId, { render: "XML libertado! A abrir o painel de validação...", type: "success", isLoading: false, autoClose: 2000 });
                    navigate('/estoque/entrada', { state: { notaPendenteId: id } });
                } catch (error) {
                    console.error(error);
                    const errorMsg = error.response?.data || "A SEFAZ negou ou demorou na devolução do XML. Tente de novo em alguns minutos.";
                    toast.update(toastId, { render: errorMsg, type: "error", isLoading: false, autoClose: 5000 });
                    setImportandoId(null);
                }
            } else {
                toast.info(`A preparar a tela de importação para ${fornecedor}...`);
                navigate('/estoque/entrada', { state: { notaPendenteId: id } });
            }
        };

        return (
            <main className="hn-container animate-fade">
                <header className="hn-header" style={{ background: 'linear-gradient(to right, #0f172a, #1e293b)' }}>
                    <div className="hn-hero-left">
                        <div className="hn-icon-box" style={{ background: '#3b82f6', color: 'white' }}>
                            <Inbox size={32} />
                        </div>
                        <div>
                            <h1 style={{ color: 'white' }}>Caixa de Entrada Fiscal</h1>
                            <p style={{ color: '#94a3b8' }}>Notas fiscais emitidas e disponíveis para importação no estoque.</p>
                        </div>
                    </div>
                    <div className="hn-stats">
                        <button onClick={forcarSincronizacao} disabled={loading} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                            <RefreshCw size={20} className={loading ? 'spin' : ''} /> {loading ? 'A Sincronizar...' : 'Puxar Novas da SEFAZ'}
                        </button>
                    </div>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', color: '#3b82f6' }}><FileText size={20} /></div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Buscar Nota Específica</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>A SEFAZ não puxou? Cole a Chave de 44 dígitos</p>
                            </div>
                        </div>
                        <form onSubmit={buscarPorChave} style={{ display: 'flex', gap: '10px' }}>
                            <input
                                type="text"
                                placeholder="Ex: 26230112345678000199550010001234561000000001"
                                value={chaveBusca}
                                onChange={(e) => setChaveBusca(e.target.value)}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                                maxLength={44}
                            />
                            <button type="submit" disabled={buscandoChave} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: buscandoChave ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                                {buscandoChave ? 'A buscar...' : 'Puxar XML'}
                            </button>
                        </form>
                    </div>

                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', color: '#f59e0b' }}><Calendar size={20} /></div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Filtrar por Período</h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Pesquise nas notas já descarregadas</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                            <button onClick={carregarCaixaDeEntrada} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Filter size={18} /> Filtrar
                            </button>
                        </div>
                    </div>
                </div>

                <section className="hn-table-card" style={{ marginTop: '20px' }}>
                    {loading ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                            <RefreshCw size={40} className="spin" style={{ marginBottom: '15px' }} />
                            <h3>A pesquisar dados...</h3>
                        </div>
                    ) : notasPendentes.length === 0 ? (
                        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                            <CheckCircle size={60} color="#10b981" style={{ marginBottom: '15px' }} />
                            <h3>Nenhuma nota encontrada!</h3>
                            <p>Tente ajustar o período ou clique em "Puxar Novas da SEFAZ".</p>
                        </div>
                    ) : (
                        <table className="hn-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '15%' }}>Data Emissão</th>
                                    <th style={{ width: '40%' }}>Fornecedor</th>
                                    <th style={{ width: '15%' }}>Valor Total</th>
                                    <th style={{ width: '30%', textAlign: 'center' }}>Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notasPendentes.map((nota) => {
                                    const isResumo = nota.status === 'PENDENTE_MANIFESTACAO';
                                    const isImportando = importandoId === nota.id;

                                    return (
                                    <tr key={nota.id}>
                                        <td><strong>{new Date(nota.dataEmissao || nota.dataCaptura).toLocaleDateString('pt-BR')}</strong></td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ color: '#0f172a' }}>{nota.nomeFornecedor || 'Fornecedor Não Identificado'}</strong>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>CNPJ: {nota.cnpjFornecedor}</span>
                                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>Chave: {nota.chaveAcesso}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <strong style={{ color: '#10b981', fontSize: '1.1rem' }}>
                                                R$ {nota.valorTotal ? nota.valorTotal.toFixed(2).replace('.', ',') : '0,00'}
                                            </strong>
                                            {isResumo && <span style={{display: 'block', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold'}}>Apenas Resumo (SEFAZ)</span>}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleSolicitarXML(nota.id, nota.nomeFornecedor, nota.status)}
                                                disabled={isImportando}
                                                style={{
                                                    background: isResumo ? '#f59e0b' : '#3b82f6',
                                                    color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px',
                                                    cursor: isImportando ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', fontWeight: 'bold',
                                                    opacity: isImportando ? 0.7 : 1
                                                }}
                                            >
                                                {isImportando ? <RefreshCw size={18} className="spin" /> : <DownloadCloud size={18} />}
                                                {isResumo ? "Solicitar XML Completo" : "Importar Inteligente"}
                                            </button>
                                        </td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </section>
            </main>
        );
    };

    export default CaixaEntradaNotas;