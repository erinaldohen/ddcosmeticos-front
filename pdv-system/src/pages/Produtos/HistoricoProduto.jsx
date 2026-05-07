import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Clock, User, FileSpreadsheet, Edit3, Trash2, Box, Calendar } from 'lucide-react';
import './HistoricoProduto.css';

const HistoricoProduto = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);
    const [produtoNome, setProdutoNome] = useState('');

    useEffect(() => {
        const fetchHistorico = async () => {
            try {
                // Tenta ir buscar o nome do produto atual para o título
                try {
                    const prodRes = await api.get(`/produtos/${id}`);
                    setProdutoNome(prodRes.data.descricao);
                } catch (e) {}

                // Busca as revisões do Envers
                const response = await api.get(`/produtos/${id}/historico`);
                setHistorico(response.data);
            } catch (error) {
                console.error("Erro ao carregar auditoria:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistorico();
    }, [id]);

    // Formatador de Data e Hora
    const formatDateTime = (dateArray) => {
        if (!dateArray || dateArray.length < 5) return "Data desconhecida";
        // dateArray geralmente vem do Java: [YYYY, MM, DD, HH, mm, ss]
        const data = new Date(dateArray[0], dateArray[1] - 1, dateArray[2], dateArray[3], dateArray[4]);
        return data.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Inteligência para traduzir a Ação
    const getActionDetails = (revType, origem) => {
        if (origem === 'IMPORTACAO_EXCEL') {
            return {
                title: 'Importação de Arquivo (Excel/CSV)',
                cssClass: 'action-excel',
                icon: <FileSpreadsheet size={14} />
            };
        }

        switch (revType) {
            case 'ADD':
                return { title: 'Criação Manual do Produto', cssClass: 'action-add', icon: <Box size={14} /> };
            case 'MOD':
                return { title: 'Edição de Dados', cssClass: 'action-mod', icon: <Edit3 size={14} /> };
            case 'DEL':
                return { title: 'Produto Inativado/Excluído', cssClass: 'action-del', icon: <Trash2 size={14} /> };
            default:
                return { title: 'Alteração de Sistema', cssClass: 'action-mod', icon: <Edit3 size={14} /> };
        }
    };

    if (loading) {
        return <div className="historico-container"><h3>A carregar registos de auditoria...</h3></div>;
    }

    return (
        <div className="historico-container fade-in">
            <div className="historico-header">
                <button className="btn-voltar" onClick={() => navigate('/produtos')}>
                    <ArrowLeft size={18} /> Voltar ao Catálogo
                </button>
                <div>
                    <h1 className="historico-title">Auditoria do Produto</h1>
                    <span style={{color: '#64748b'}}>{produtoNome || `ID: ${id}`}</span>
                </div>
            </div>

            {historico.length === 0 ? (
                <div className="empty-history">
                    <History size={48} style={{opacity: 0.2, marginBottom: '16px'}} />
                    <h2>Nenhum registo encontrado</h2>
                    <p>O histórico de alterações para este produto não está disponível ou o produto é muito recente.</p>
                </div>
            ) : (
                <div className="timeline">
                    {historico.map((rev, index) => {
                        // Extrai a origem do estado do produto naquela revisão
                        const origem = rev.entidade?.origem;
                        const action = getActionDetails(rev.tipoRevisao, origem);
                        const dataFormatada = formatDateTime(rev.dataRevisao);
                        // Se o backend enviar o usuário, usamos. Senão, 'Sistema/Admin'.
                        const operador = rev.nomeUsuario || 'Administrador';

                        return (
                            <div key={index} className={`timeline-item ${action.cssClass} slide-up`}>
                                <div className="timeline-icon">
                                    {action.icon}
                                </div>

                                <div className="audit-card-header">
                                    <div>
                                        <h3 className="audit-action-title">{action.title}</h3>
                                        <div className="audit-meta">
                                            <span><Calendar size={14} /> {dataFormatada}</span>
                                            <span className="operator-badge"><User size={12} /> {operador}</span>
                                        </div>
                                    </div>
                                    <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>Rev #{rev.revisaoId}</span>
                                </div>

                                {/* Mostra o estado do produto nesta alteração */}
                                {rev.entidade && (
                                    <div className="audit-diff-grid">
                                        <div className="diff-item">
                                            <span className="diff-label">Preço de Venda</span>
                                            <span className="diff-value">R$ {rev.entidade.precoVenda?.toFixed(2) || '0.00'}</span>
                                        </div>
                                        <div className="diff-item">
                                            <span className="diff-label">Preço de Custo</span>
                                            <span className="diff-value">R$ {rev.entidade.precoCusto?.toFixed(2) || '0.00'}</span>
                                        </div>
                                        <div className="diff-item">
                                            <span className="diff-label">Estoque</span>
                                            <span className="diff-value">{rev.entidade.quantidadeEmEstoque || 0} un.</span>
                                        </div>
                                        <div className="diff-item">
                                            <span className="diff-label">Código (EAN)</span>
                                            <span className="diff-value">{rev.entidade.codigoBarras || '-'}</span>
                                        </div>
                                        <div className="diff-item">
                                            <span className="diff-label">NCM</span>
                                            <span className="diff-value">{rev.entidade.ncm || '-'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default HistoricoProduto;