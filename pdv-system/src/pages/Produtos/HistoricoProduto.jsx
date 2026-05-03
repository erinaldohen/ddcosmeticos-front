import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, History, User, Clock, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';
import './HistoricoProduto.css';
import { toast } from 'react-toastify';

const HistoricoProduto = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // A sua API retorna a lista das revisões do Envers (quem, quando, tipo e os dados)
                const res = await api.get(`/auditoria/produto/${id}`);
                setHistorico(res.data || []);
            } catch (err) {
                toast.error("Erro ao buscar a trilha de auditoria.");
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [id]);

    const formatarData = (dataArray) => {
        if (!dataArray) return "Data desconhecida";
        // Envers costuma devolver a data em array [Ano, Mês, Dia, Hora, Minuto, Segundo]
        if(Array.isArray(dataArray) && dataArray.length >= 5) {
            const [ano, mes, dia, hora, min] = dataArray;
            return `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano} às ${String(hora).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
        }
        // Fallback caso venha como String ISO normal
        return new Date(dataArray).toLocaleString('pt-BR');
    };

    // 🔥 BLINDADO: Compara a revisão atual com a anterior de forma 100% segura contra null/undefined
    const getMudancas = (atual, index, arrayCompleto) => {
        if (!atual) return [];

        const tipo = atual.tipoEvento || atual.revtype;
        if (tipo === 'CREATE' || tipo === 'INSERT' || tipo === 0) return [{ campo: 'Criação', de: '-', para: 'Novo Registo' }];
        if (tipo === 'DELETE' || tipo === 'REMOVE' || tipo === 2) return [{ campo: 'Exclusão', de: 'Ativo', para: 'Lixeira' }];

        const anterior = arrayCompleto[index + 1];
        if (!anterior) return [];

        // Segurança extra: Se `entidade` for undefined, assumimos que os campos vêm diretamente na raiz do objeto `atual`
        const entAtual = atual.entidade || atual || {};
        const entAnterior = anterior.entidade || anterior || {};

        const mudancas = [];

        if (entAtual.precoVenda !== entAnterior.precoVenda) {
            const de = entAnterior.precoVenda || 0;
            const para = entAtual.precoVenda || 0;
            mudancas.push({ campo: 'Preço Venda', de: `R$ ${de.toFixed(2)}`, para: `R$ ${para.toFixed(2)}` });
        }
        if (entAtual.precoCusto !== entAnterior.precoCusto) {
            const de = entAnterior.precoCusto || 0;
            const para = entAtual.precoCusto || 0;
            mudancas.push({ campo: 'Preço Custo', de: `R$ ${de.toFixed(2)}`, para: `R$ ${para.toFixed(2)}` });
        }
        if (entAtual.quantidadeEmEstoque !== entAnterior.quantidadeEmEstoque) {
            mudancas.push({ campo: 'Estoque Físico', de: entAnterior.quantidadeEmEstoque || 0, para: entAtual.quantidadeEmEstoque || 0 });
        }
        if (entAtual.descricao !== entAnterior.descricao) {
            mudancas.push({ campo: 'Descrição', de: entAnterior.descricao || 'S/N', para: entAtual.descricao || 'S/N' });
        }

        return mudancas;
    };

    const analisarComIA = () => {
        setIsAnalyzing(true);

        setTimeout(() => {
            let alertas = [];
            let quedasPreco = 0;

            historico.forEach((rev, idx) => {
                const mudancas = getMudancas(rev, idx, historico);
                const ent = rev.entidade || rev || {};

                mudancas.forEach(m => {
                    if (m.campo === 'Preço Venda') {
                        // Limpa os R$ para poder comparar matematicamente
                        const de = parseFloat(m.de.replace('R$ ', '').replace(',', '.'));
                        const para = parseFloat(m.para.replace('R$ ', '').replace(',', '.'));

                        if (para < de) quedasPreco++;

                        // IA Deteta se alguma vez este utilizador baixou a Venda para valor INFERIOR ao Custo
                        if (para > 0 && para < (ent.precoCusto || 0)) {
                            alertas.push(`Venda Abaixo de Custo (R$ ${para.toFixed(2)}) efetuada por ${rev.usuarioOperacao || 'Sistema'} em ${formatarData(rev.dataHora)}.`);
                        }
                    }
                });
            });

            if (quedasPreco > 2) alertas.push(`Comportamento Atípico: O preço de retalho foi rebaixado ${quedasPreco} vezes recentemente. Requer atenção administrativa.`);

            setAiAnalysis({
                seguro: alertas.length === 0,
                mensagem: alertas.length === 0 ? "A trilha de auditoria deste produto encontra-se dentro dos padrões normais de operação comercial." : "Foram detetadas anomalias graves na trilha de auditoria deste produto.",
                detalhes: alertas
            });

            setIsAnalyzing(false);
        }, 1500);
    };

    return (
        <div className="modern-layout-container fade-in">
            <header className="page-header-modern">
                <button onClick={() => navigate(-1)} className="btn-icon-soft" style={{marginRight: '16px', float: 'left'}}><ArrowLeft size={20}/></button>
                <div className="header-titles" style={{clear:'none'}}>
                    <h1 className="title-gradient">Auditoria de Produto</h1>
                    <p className="subtitle text-muted">Trilha de modificações com proteção Envers</p>
                </div>
            </header>

            <div className="audit-content-wrapper">

                {/* Painel da IA de Auditoria */}
                <div className="ai-audit-panel">
                    <div className="ai-audit-header">
                        <Cpu size={28} className="text-primary" />
                        <div>
                            <h3>Inspetor IA</h3>
                            <p>Análise comportamental de alterações de preço e stock.</p>
                        </div>
                    </div>

                    {!aiAnalysis ? (
                        <button className="btn-primary-shadow w-full" onClick={analisarComIA} disabled={isAnalyzing}>
                            {isAnalyzing ? "A Processar Registos..." : "Executar Varredura de Segurança"}
                        </button>
                    ) : (
                        <div className={`ai-audit-result ${aiAnalysis.seguro ? 'safe' : 'danger'}`}>
                            {aiAnalysis.seguro ? <ShieldCheck size={24} style={{flexShrink:0}} /> : <AlertTriangle size={24} style={{flexShrink:0}} />}
                            <div>
                                <strong>{aiAnalysis.mensagem}</strong>
                                {aiAnalysis.detalhes.map((det, i) => <div key={i} className="audit-alert-item">• {det}</div>)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Timeline Visual (Trilha de Histórico) */}
                <div className="timeline-container">
                    {loading ? (
                        <p>A extrair e decifrar histórico da base de dados...</p>
                    ) : historico.length === 0 ? (
                        <div className="empty-state-modern">
                            <History size={48} className="text-muted" />
                            <p>Nenhuma modificação registada para este produto após a sua criação inicial.</p>
                        </div>
                    ) : (
                        historico.map((rev, index) => {
                            const mudancas = getMudancas(rev, index, historico);
                            const tipo = rev.tipoEvento || rev.revtype;
                            const isCreate = tipo === 'CREATE' || tipo === 'INSERT' || tipo === 0;

                            return (
                                <div key={rev.idRevisao || index} className="timeline-item">
                                    <div className={`timeline-marker ${isCreate ? 'create' : 'update'}`}></div>
                                    <div className="timeline-content">
                                        <div className="timeline-header">
                                            <span className="timeline-action">{isCreate ? 'Criação do Registo' : 'Atualização de Dados'}</span>
                                            <span className="timeline-date"><Clock size={14}/> {formatarData(rev.dataHora)}</span>
                                        </div>

                                        <div className="timeline-user">
                                            <User size={16}/> Operador: <strong>{rev.usuarioOperacao || 'Sistema Base (Importação)'}</strong>
                                        </div>

                                        {mudancas.length > 0 ? (
                                            <div className="timeline-diff-box">
                                                <div className="diff-title">Resumo das Alterações efetuadas:</div>
                                                {mudancas.map((m, i) => (
                                                    <div key={i} className="diff-row">
                                                        <span className="diff-field">{m.campo}:</span>
                                                        <span className="diff-old">{m.de}</span>
                                                        <span className="diff-arrow">➔</span>
                                                        <span className="diff-new">{m.para}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            !isCreate && (
                                                <div className="timeline-diff-box" style={{background: '#f1f5f9', color: '#64748b'}}>
                                                    Nenhum campo principal (Preço, Estoque, Descrição) foi alterado nesta revisão.
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoricoProduto;