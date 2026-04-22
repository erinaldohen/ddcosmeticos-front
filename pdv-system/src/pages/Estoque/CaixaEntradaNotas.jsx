import React, { useState, useEffect } from 'react';
import { Inbox, FileText, CheckCircle, AlertCircle, RefreshCw, DownloadCloud } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './CaixaEntradaNotas.css';

const CaixaEntradaNotas = () => {
    const [notasPendentes, setNotasPendentes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [importandoId, setImportandoId] = useState(null);

    // Lê a base de dados local
    const carregarCaixaDeEntrada = async () => {
        setLoading(true);
        try {
            const res = await api.get('/estoque/notas-pendentes', { silent: true });
            setNotasPendentes(res.data || []);
        } catch (error) {
            console.error("Erro ao buscar notas no banco local:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarCaixaDeEntrada();
    }, []);

    // 🔥 NOVA FUNÇÃO: Obriga o Java a ir à SEFAZ
    const forcarSincronizacao = async () => {
        setLoading(true);
        const toastId = toast.loading("A comunicar com os servidores da SEFAZ...");
        try {
            // Bate na nova porta do Controller
            await api.post('estoque/notas-pendentes/sincronizar');
            toast.update(toastId, { render: "Sincronização com SEFAZ concluída!", type: "success", isLoading: false, autoClose: 3000 });

            // Depois de sincronizar, lê o banco de dados de novo para ver o que chegou
            await carregarCaixaDeEntrada();
        } catch (error) {
            toast.update(toastId, { render: error.response?.data || "Falha ao comunicar com a SEFAZ.", type: "error", isLoading: false, autoClose: 4000 });
            setLoading(false);
        }
    };

    const importarNota = async (id, fornecedor) => {
        setImportandoId(id);
        const toastId = toast.loading(`A importar nota de ${fornecedor}...`);

        try {
            await api.post(`/estoque/notas-pendentes/${id}/importar`);
            toast.update(toastId, { render: "Estoque e Financeiro atualizados com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
            setNotasPendentes(notasPendentes.filter(n => n.id !== id));
        } catch (error) {
            toast.update(toastId, { render: error.response?.data || "Erro ao processar a importação.", type: "error", isLoading: false, autoClose: 4000 });
        } finally {
            setImportandoId(null);
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
                        <h1 style={{ color: 'white' }}>Caixa de Entrada SEFAZ</h1>
                        <p style={{ color: '#94a3b8' }}>Notas fiscais emitidas contra o CNPJ da DD Cosméticos prontas para importação.</p>
                    </div>
                </div>
                <div className="hn-stats">
                    {/* 🔥 BOTÃO CORRIGIDO AQUI! */}
                    <button onClick={forcarSincronizacao} disabled={loading} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={20} className={loading ? 'spin' : ''} /> {loading ? 'A Sincronizar...' : 'Atualizar Sincronização'}
                    </button>
                </div>
            </header>

            <section className="hn-table-card" style={{ marginTop: '20px' }}>
                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw size={40} className="spin" style={{ marginBottom: '15px' }} />
                        <h3>A pesquisar na SEFAZ e no Banco de Dados...</h3>
                    </div>
                ) : notasPendentes.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                        <CheckCircle size={60} color="#10b981" style={{ marginBottom: '15px' }} />
                        <h3>Tudo em dia!</h3>
                        <p>Não há novas notas fiscais pendentes de importação.</p>
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

                                return (
                                <tr key={nota.id}>
                                    <td>
                                        <strong>{new Date(nota.dataEmissao || nota.dataCaptura).toLocaleDateString('pt-BR')}</strong>
                                    </td>
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
                                        {isResumo && (
                                            <span style={{display: 'block', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 'bold'}}>
                                                Apenas Resumo (SEFAZ)
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {isResumo ? (
                                            <button
                                                onClick={() => toast.info("Na próxima fase, este botão fará a Manifestação da Nota para descarregar o XML Completo!")}
                                                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', fontWeight: 'bold' }}
                                            >
                                                Solicitar XML Completo
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => importarNota(nota.id, nota.nomeFornecedor)}
                                                disabled={importandoId === nota.id}
                                                style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: importandoId === nota.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 auto', fontWeight: 'bold' }}
                                            >
                                                {importandoId === nota.id ? <RefreshCw size={18} className="spin" /> : <DownloadCloud size={18} />}
                                                Importar para Estoque
                                            </button>
                                        )}
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