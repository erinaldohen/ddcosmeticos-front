import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
    ArrowLeft, Clock, User, FileSpreadsheet, Edit3, Trash2,
    Box, Calendar, ArrowRight, Bot, CheckCircle2,
    AlertTriangle, Receipt
} from 'lucide-react';
import './HistoricoProduto.css';

const HistoricoProduto = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [historicoRaw, setHistoricoRaw] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analisandoIA, setAnaliseIA] = useState(true);

    // 🔥 CORREÇÃO: Agora guardamos o Produto real e completo
    const [produtoAtual, setProdutoAtual] = useState(null);

    useEffect(() => {
        const fetchHistorico = async () => {
            try {
                try {
                    const prodRes = await api.get(`/produtos/${id}`);
                    setProdutoAtual(prodRes.data); // Guarda os dados reais e atuais
                } catch (e) {}

                const response = await api.get(`/produtos/${id}/historico`);
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

    const getActionDetails = (rev) => {
        const tipo = rev.tipoAlteracao || '';
        const obs = rev.observacao || rev.motivo || rev.motivoUltimaAlteracao || '';
        const nf = rev.numeroNota || rev.numeroUltimaNotaFiscal || '';
        const obsUpper = obs.toUpperCase();

        if (nf || tipo.includes('NFE') || tipo.includes('ENTRADA') || obsUpper.includes('NOTA FISCAL') || obsUpper.includes('NF-E')) {
            const numDisplay = nf ? ` (NF: ${nf})` : '';
            return { title: `Entrada por Nota Fiscal${numDisplay}`, class: 'action-nfe', icon: <Receipt size={18} />, obs: obs };
        }

        if (obsUpper.includes('IMPORTA') || obsUpper.includes('PLANILHA') || obsUpper.includes('EXCEL') || obsUpper.includes('CSV')) {
             return { title: 'Importação em Massa', class: 'action-excel', icon: <FileSpreadsheet size={18} />, obs: obs };
        }

        if (tipo === 'CRIADO' || tipo === 'ADD') return { title: 'Criação do Produto', class: 'action-add', icon: <Box size={18} />, obs: obs };
        if (tipo === 'ALTERADO' || tipo === 'MOD') return { title: 'Atualização de Dados', class: 'action-mod', icon: <Edit3 size={18} />, obs: obs };
        if (tipo === 'EXCLUÍDO' || tipo === 'DEL') return { title: 'Exclusão / Inativação', class: 'action-del', icon: <Trash2 size={18} />, obs: obs };
        return { title: 'Alteração de Sistema', class: 'action-sys', icon: <Clock size={18} />, obs: obs };
    };

    const compararEntidades = (oldEnt, newEnt, tipoAlteracao) => {
        const diffs = [];
        const campos = [
            { key: 'descricao', label: 'Descrição', type: 'text' },
            { key: 'precoVenda', label: 'Preço de Venda', type: 'currency' },
            { key: 'precoCusto', label: 'Preço de Custo', type: 'currency' },
            { key: 'quantidade', label: 'Estoque Atual', type: 'number' },
            { key: 'quantidadeEmEstoque', label: 'Estoque Atual', type: 'number' },
            { key: 'estoqueMinimo', label: 'Estoque Mínimo', type: 'number' },
            { key: 'ncm', label: 'NCM Fiscal', type: 'text' },
            { key: 'marca', label: 'Marca', type: 'text' },
            { key: 'revisaoPendente', label: 'Status de Cadastro', type: 'alerta_revisao' },
            { key: 'alertaGondola', label: 'Auditoria de Gôndola', type: 'alerta_gondola' }
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

        const hasQtdEmEstoque = diffs.some(d => d.key === 'quantidadeEmEstoque');
        return hasQtdEmEstoque ? diffs.filter(d => d.key !== 'quantidade') : diffs;
    };

    const processedHistory = useMemo(() => {
        return historicoRaw.map((rev, index) => {
            const action = getActionDetails(rev);
            const dataFormatada = formatDateTime(rev.dataRevisao);
            const operador = rev.usuarioResponsavel;

            const oldEntidade = historicoRaw[index + 1] || null;
            const newEntidade = rev || {};

            const diffs = compararEntidades(oldEntidade, newEntidade, rev.tipoAlteracao);

            return { ...rev, action, dataFormatada, operador, diffs };
        });
    }, [historicoRaw]);

    // 🔥 A IA CORRIGIDA: Usa a fonte de verdade absoluta (produtoAtual)
    const iaAlerts = useMemo(() => {
        const alerts = [];

        // 1. Analisa o Produto Real da API para evitar falsos positivos por falta de mapeamento do Envers
        if (produtoAtual) {
            const isRevisaoMarcada = produtoAtual.revisaoPendente === true || produtoAtual.revisaoPendente === 'true';

            const temPrecoVenda = produtoAtual.precoVenda && produtoAtual.precoVenda > 0;
            const temNcmValido = produtoAtual.ncm && String(produtoAtual.ncm).length >= 8 && produtoAtual.ncm !== '00000000';
            const temEanValido = produtoAtual.codigoBarras && String(produtoAtual.codigoBarras).length >= 8 && produtoAtual.codigoBarras !== 'S/N';

            const falhas = [];
            if (!temPrecoVenda) falhas.push('Preço Zerado');
            if (!temNcmValido) falhas.push('NCM Inválido');
            if (!temEanValido) falhas.push('Sem EAN');

            if (isRevisaoMarcada && falhas.length > 0) {
                alerts.push({
                    id: `alert-current-revisao`,
                    type: 'warning',
                    icon: <FileSpreadsheet size={16}/>,
                    msg: `Inconsistência de Cadastro: O produto foi importado ou inserido às pressas e possui dados fiscais pendentes (${falhas.join(', ')}).`
                });
            }
        }

        // 2. Analisa as prateleiras (Gôndola) varrendo a trilha passada
        processedHistory.forEach(rev => {
            rev.diffs.forEach(diff => {
                if (diff.key === 'alertaGondola' && (diff.new === true || diff.new === 'true')) {
                    alerts.push({
                        id: `alert-${rev.idRevisao}-gondola`,
                        type: 'danger',
                        icon: <AlertTriangle size={16}/>,
                        msg: `Divergência Física: O operador ${rev.operador || 'Sistema'} reportou um preço de prateleira errado na Revisão #${rev.idRevisao}.`
                    });
                }
            });
        });
        return alerts;
    }, [processedHistory, produtoAtual]);

    const renderValue = (val, type) => {
        if (val === 'Vazio' || val === null || val === '') return <span style={{opacity: 0.5}}>N/A</span>;
        if (type === 'currency') return formatCurrency(val);
        if (type === 'boolean') return val === true || val === 'true' ? 'Sim' : 'Não';

        if (type === 'alerta_gondola') {
            const isDivergente = val === true || val === 'true';
            return isDivergente ?
                <span className="badge-alert-danger">⚠️ Divergente</span> :
                <span className="badge-alert-success">✅ Corrigido</span>;
        }

        if (type === 'alerta_revisao') {
            const isRevisao = val === true || val === 'true';
            return isRevisao ?
                <span className="badge-alert-warning">⚠️ Pendente de Cadastro</span> :
                <span className="badge-alert-success">✅ Cadastro Completo</span>;
        }

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
                    <p className="hist-subtitle">EAN/ID: <strong>{id}</strong> • {produtoAtual?.descricao || 'Carregando...'}</p>
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
                                <span><strong>Padrão de Ouro:</strong> O histórico deste produto está limpo. Nenhuma anomalia financeira ou fiscal detetada.</span>
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
                                            <span className="meta-tag user-tag"><User size={14}/> {rev.operador || 'Sistema'}</span>

                                            {rev.action.obs && (
                                                <span className="meta-tag obs-tag">Motivo: {rev.action.obs}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="card-header-right">
                                        <span className="rev-number">Alteração #{rev.idRevisao}</span>
                                    </div>
                                </div>

                                <div className="card-body">
                                    {rev.diffs.length === 0 ? (
                                        <span className="no-diff-text">Edição de sistema (Ex: vínculo interno). Os dados principais da mercadoria mantiveram-se iguais.</span>
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