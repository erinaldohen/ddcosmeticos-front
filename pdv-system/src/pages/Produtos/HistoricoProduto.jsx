import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { ArrowLeft, Clock, User, FileEdit, PlusCircle, Trash2, Box, Calendar, Hash, RefreshCw, Info } from 'lucide-react';
import './HistoricoProduto.css';

const HistoricoProduto = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);
    const [produtoAtual, setProdutoAtual] = useState(null);

    useEffect(() => {
        const carregarHistorico = async () => {
            try {
                // Carrega primeiro o produto atual para termos o cabeçalho
                const prodResponse = await api.get(`/produtos/${id}`);
                setProdutoAtual(prodResponse.data);

                // Carrega o histórico do Envers
                const histResponse = await api.get(`/produtos/${id}/historico`);
                setHistorico(histResponse.data);
            } catch (error) {
                toast.error("Erro ao carregar histórico da auditoria.");
            } finally {
                setLoading(false);
            }
        };
        carregarHistorico();
    }, [id]);

    const getTipoIcone = (tipo) => {
        switch (tipo?.toUpperCase()) {
            case 'CRIACAO': return <PlusCircle className="text-emerald-500" size={24} />;
            case 'ALTERACAO': return <FileEdit className="text-blue-500" size={24} />;
            case 'EXCLUSAO': return <Trash2 className="text-rose-500" size={24} />;
            case 'SANEAMENTO_IA': return <RefreshCw className="text-fuchsia-500" size={24} />;
            default: return <Clock className="text-slate-400" size={24} />;
        }
    };

    const getTipoLabel = (tipo) => {
        switch (tipo?.toUpperCase()) {
            case 'CRIACAO': return 'Produto Criado';
            case 'ALTERACAO': return 'Produto Atualizado';
            case 'EXCLUSAO': return 'Movido para Lixeira';
            case 'SANEAMENTO_IA': return 'Ajuste de Inteligência Artificial';
            default: return tipo || 'Evento Registado';
        }
    };

    // Helper para transformar o objeto 'detalhesAlteracao' em elementos visuais
    const renderizarDetalhes = (detalhes) => {
        if (!detalhes || typeof detalhes !== 'object' || Object.keys(detalhes).length === 0) {
            return <div className="no-details">Nenhuma alteração de campo registada neste evento.</div>;
        }

        return (
            <div className="diff-grid">
                {Object.entries(detalhes).map(([campo, mudanca]) => (
                    <div key={campo} className="diff-item">
                        <span className="diff-field">{campo}</span>
                        <div className="diff-values">
                            {mudanca.antigo ? (
                                <>
                                    <span className="diff-old">{mudanca.antigo}</span>
                                    <span className="diff-arrow">→</span>
                                </>
                            ) : (
                                <span className="diff-new-badge">NOVO</span>
                            )}
                            <span className="diff-new">{mudanca.novo || <em>vazio</em>}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="historico-loader">
                <div className="spinner-modern"></div>
                <p>Consultando registos de auditoria...</p>
            </div>
        );
    }

    return (
        <div className="historico-layout fade-in">
            {/* HEADER DO PRODUTO */}
            <div className="historico-header-card">
                <button className="btn-voltar" onClick={() => navigate('/produtos')}>
                    <ArrowLeft size={20} /> Voltar ao Catálogo
                </button>
                <div className="header-info">
                    <div className="header-icon-wrap"><Box size={32} /></div>
                    <div>
                        <h2>Histórico de Auditoria</h2>
                        <h3>{produtoAtual ? produtoAtual.descricao : `Produto ID #${id}`}</h3>
                        {produtoAtual && (
                            <div className="header-tags">
                                <span className="tag-brand"><Hash size={14}/> {produtoAtual.codigoBarras || 'S/ EAN'}</span>
                                <span className="tag-stock">{produtoAtual.marca || 'S/ Marca'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TIMELINE DE AUDITORIA */}
            <div className="timeline-container">
                {historico.length === 0 ? (
                    <div className="empty-timeline">
                        <Info size={48} className="text-slate-300" />
                        <h3>Nenhum registo encontrado</h3>
                        <p>O histórico de auditoria para este produto está vazio ou indisponível.</p>
                    </div>
                ) : (
                    <div className="timeline">
                        {historico.map((evento, index) => (
                            <div key={index} className="timeline-event fade-in-up" style={{animationDelay: `${index * 0.1}s`}}>

                                {/* Ícone da Timeline */}
                                <div className="timeline-point">
                                    <div className="point-icon">{getTipoIcone(evento.tipoRevisao)}</div>
                                    <div className="point-line"></div>
                                </div>

                                {/* Cartão de Evento */}
                                <div className="timeline-card">
                                    <div className="event-header">
                                        <div className="event-title">
                                            <h4>{getTipoLabel(evento.tipoRevisao)}</h4>
                                            <span className="event-version">Versão v{evento.revisaoId}</span>
                                        </div>
                                        <div className="event-meta">
                                            <span className="meta-date"><Calendar size={14}/> {new Date(evento.dataHora).toLocaleString('pt-BR')}</span>
                                            <span className="meta-user"><User size={14}/> {evento.usuarioResponsavel || 'Sistema / Auto'}</span>
                                        </div>
                                    </div>

                                    <div className="event-body">
                                        {/* A Mágica do Diff acontece aqui */}
                                        {renderizarDetalhes(evento.detalhesAlteracao)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoricoProduto;