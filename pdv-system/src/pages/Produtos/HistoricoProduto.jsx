import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    ArrowLeft, Clock, User, FileSpreadsheet, Edit3, Trash2,
    Box, Calendar, ArrowRight, ShieldAlert, Bot, CheckCircle2,
    AlertTriangle
} from 'lucide-react';
import './HistoricoProduto.css';

const HistoricoProduto = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [historicoRaw, setHistoricoRaw] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analisandoIA, setAnaliseIA] = useState(true);
    const [produtoNome, setProdutoNome] = useState('');

    useEffect(() => {
        const fetchHistorico = async () => {
            try {
                try {
                    const prodRes = await api.get(`/produtos/${id}`);
                    setProdutoNome(prodRes.data.descricao);
                } catch (e) {}

                const response = await api.get(`/produtos/${id}/historico`);
                // Ordena do mais recente para o mais antigo (ID da Revisão maior primeiro)
                const sortedHistory = response.data.sort((a, b) => b.idRevisao - a.idRevisao);
                setHistoricoRaw(sortedHistory);
            } catch (error) {
                console.error("Erro ao carregar auditoria:", error);
            } finally {
                setLoading(false);
                setTimeout(() => setAnaliseIA(false), 1200);
            }
        };
        fetchHistorico();
    }, [id]);

    const formatDateTime = (dataRevisao) => {
        if (!dataRevisao) return "Data desconhecida";
        try {
            const data = new Date(dataRevisao);
            return data.toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch(e) { return "Data Inválida"; }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // 🔥 CORREÇÃO 1: Lê as traduções exatas do seu HistoricoProdutoDTO.java
    const getActionDetails = (tipoAlteracao) => {
        if (tipoAlteracao === 'CRIADO' || tipoAlteracao === 'ADD') return { title: 'Criação do Produto', class: 'action-add', icon: <Box size={18} /> };
        if (tipoAlteracao === 'ALTERADO' || tipoAlteracao === 'MOD') return { title: 'Atualização de Dados', class: 'action-mod', icon: <Edit3 size={18} /> };
        if (tipoAlteracao === 'EXCLUÍDO' || tipoAlteracao === 'DEL') return { title: 'Exclusão / Inativação', class: 'action-del', icon: <Trash2 size={18} /> };
        return { title: 'Alteração de Sistema', class: 'action-sys', icon: <Clock size={18} /> };
    };

    // 🔥 CORREÇÃO 2: Mapeia exatamente os campos disponíveis no HistoricoProdutoDTO.java
    // 🔥 MOTOR DE COMPARAÇÃO BLINDADO (Agora com NCM, Marca e Estoque Mínimo)
        const compararEntidades = (oldEnt, newEnt, tipoAlteracao) => {
            const diffs = [];
            const campos = [
                { key: 'descricao', label: 'Descrição', type: 'text' },
                { key: 'precoVenda', label: 'Preço de Venda', type: 'currency' },
                { key: 'precoCusto', label: 'Preço de Custo', type: 'currency' },
                { key: 'quantidade', label: 'Estoque Atual', type: 'number' },
                { key: 'estoqueMinimo', label: 'Estoque Mínimo', type: 'number' }, // LÊ DO JAVA!
                { key: 'ncm', label: 'NCM Fiscal', type: 'text' },                 // LÊ DO JAVA!
                { key: 'marca', label: 'Marca', type: 'text' }                     // LÊ DO JAVA!
            ];

            const isAdd = tipoAlteracao === 'CRIADO' || tipoAlteracao === 'ADD';
            const isMod = tipoAlteracao === 'ALTERADO' || tipoAlteracao === 'MOD';
            const isDel = tipoAlteracao === 'EXCLUÍDO' || tipoAlteracao === 'DEL';

            if (isDel) {
                diffs.push({ key: 'status', label: 'Ação', old: 'Ativo', new: 'Deletado/Inativado', type: 'text' });
                return diffs;
            }

            campos.forEach(campo => {
                const oldV = oldEnt ? oldEnt[campo.key] : null;
                const newV = newEnt ? newEnt[campo.key] : null;

                const normOld = (oldV === null || oldV === undefined || oldV === '') ? 'VAZIO' : String(oldV).trim();
                const normNew = (newV === null || newV === undefined || newV === '') ? 'VAZIO' : String(newV).trim();

                if (isAdd && normNew !== 'VAZIO') {
                     diffs.push({ ...campo, old: null, new: newV });
                }
                else if (isMod && normOld !== normNew) {
                     diffs.push({ ...campo, old: oldV ?? 'Vazio', new: newV ?? 'Vazio' });
                }
            });
            return diffs;
        };

    // 🔥 CORREÇÃO 3: O 'rev' já é a entidade principal (Não existe 'rev.entidade')
    const processedHistory = useMemo(() => {
        return historicoRaw.map((rev, index) => {
            const action = getActionDetails(rev.tipoAlteracao);
            const dataFormatada = formatDateTime(rev.dataRevisao);
            const operador = rev.usuarioResponsavel;

            const oldEntidade = historicoRaw[index + 1] || null; // O antigo é o próximo no array
            const newEntidade = rev || {};

            const diffs = compararEntidades(oldEntidade, newEntidade, rev.tipoAlteracao);

            return { ...rev, action, dataFormatada, operador, diffs };
        });
    }, [historicoRaw]);

    const iaAlerts = useMemo(() => {
        const alerts = [];
        processedHistory.forEach(rev => {
            rev.diffs.forEach(diff => {
                if (diff.key === 'precoVenda' && diff.old > 0) {
                    const drop = ((diff.old - diff.new) / diff.old) * 100;
                    if (drop >= 30) {
                        alerts.push({ id: `alert-${rev.idRevisao}-drop`, type: 'danger', icon: <ShieldAlert size={16}/>, msg: `Alerta Crítico: O preço de venda caiu ${drop.toFixed(0)}% na Alteração #${rev.idRevisao} feita por ${rev.operador}.` });
                    }
                }
                if (diff.key === 'quantidade' && Math.abs(diff.new - diff.old) >= 50) {
                    alerts.push({ id: `alert-${rev.idRevisao}-est`, type: 'warning', icon: <AlertTriangle size={16}/>, msg: `Atenção: Salto abrupto de estoque (${diff.old} para ${diff.new}) na Alteração #${rev.idRevisao}.` });
                }
            });
        });
        return alerts;
    }, [processedHistory]);

    const renderValue = (val, type) => {
        if (val === 'Vazio' || val === null || val === '') return <span style={{opacity: 0.5}}>N/A</span>;
        if (type === 'currency') return formatCurrency(val);
        return val;
    };

    if (loading) return <div className="historico-layout"><div className="loading-state"><Clock className="spin" size={32}/><span>Decodificando Auditoria...</span></div></div>;

    return (
        <div className="historico-layout fade-in">
            <header className="hist-header">
                <button className="btn-back-soft" onClick={() => navigate('/produtos')}>
                    <ArrowLeft size={18} /> Voltar ao Catálogo
                </button>
                <div className="hist-title-group">
                    <h1>Rastreamento de Auditoria</h1>
                    <p className="hist-subtitle">EAN/ID: <strong>{id}</strong> • {produtoNome}</p>
                </div>
            </header>

            {historicoRaw.length > 0 && (
                <div className="ia-auditor-panel slide-up">
                    <div className="ia-auditor-header">
                        <div className="ia-brand">
                            <div className="ia-icon-glow"><Bot size={24} /></div>
                            <div>
                                <h2>Auditoria Inteligente</h2>
                                <p>Análise comportamental do histórico de edições.</p>
                            </div>
                        </div>
                        {analisandoIA ? (
                            <span className="ia-status pulse">Analisando saltos temporais...</span>
                        ) : (
                            <span className="ia-status ready">Análise Concluída</span>
                        )}
                    </div>

                    <div className="ia-auditor-body">
                        {analisandoIA ? (
                            <div className="ia-skeleton"></div>
                        ) : iaAlerts.length > 0 ? (
                            <div className="ia-alerts-list">
                                {iaAlerts.map((alert) => (
                                    <div key={alert.id} className={`ia-alert-item ${alert.type}`}>
                                        {alert.icon} <span>{alert.msg}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ia-alert-item success">
                                <CheckCircle2 size={18} />
                                <span><strong>Padrão de Ouro:</strong> O histórico deste produto está limpo. Nenhuma anomalia financeira detetada.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {processedHistory.length === 0 ? (
                <div className="empty-state-modern">
                    <Clock size={48} style={{opacity: 0.2}} />
                    <h3>Nenhum rastro encontrado</h3>
                    <p>O histórico de edições ainda não foi gerado para este item.</p>
                </div>
            ) : (
                <div className="timeline-container">
                    {processedHistory.map((rev, index) => (
                        <div key={`rev-${rev.idRevisao || index}`} className={`timeline-node slide-up`} style={{ animationDelay: `${index * 0.05}s` }}>

                            <div className={`timeline-badge ${rev.action.class}`}>
                                {rev.action.icon}
                            </div>

                            <div className="timeline-card">
                                <div className="card-header">
                                    <div className="card-header-left">
                                        <h3 className={`action-title ${rev.action.class}-text`}>{rev.action.title}</h3>
                                        <div className="meta-tags">
                                            <span className="meta-tag" style={{fontWeight: 800}}><Calendar size={14}/> {rev.dataFormatada}</span>
                                            <span className="meta-tag user-tag"><User size={14}/> {rev.operador}</span>
                                        </div>
                                    </div>
                                    <div className="card-header-right">
                                        <span className="rev-number">Alteração #{rev.idRevisao}</span>
                                    </div>
                                </div>

                                <div className="card-body">
                                    {rev.diffs.length === 0 ? (
                                        <span className="no-diff-text">Edição de sistema (Ex: vinculo de banco). Os dados principais estão iguais.</span>
                                    ) : (
                                        <div className="diff-grid">
                                            {rev.diffs.map((diff) => (
                                                <div key={`diff-${rev.idRevisao}-${diff.key}`} className="diff-row">
                                                    <span className="diff-label">{diff.label}</span>
                                                    <div className="diff-values">
                                                        {diff.old !== null && (
                                                            <>
                                                                <span className="val-old">
                                                                    {renderValue(diff.old, diff.type)}
                                                                </span>
                                                                <ArrowRight size={14} className="diff-arrow" />
                                                            </>
                                                        )}
                                                        <span className="val-new">
                                                            {renderValue(diff.new, diff.type)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="timeline-end">
                        <div className="timeline-end-dot"></div>
                        <span>Início dos Registros</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricoProduto;