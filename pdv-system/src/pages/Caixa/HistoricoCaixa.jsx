import React, { useState, useEffect } from 'react';
import {
    Archive, Calendar, Search, RefreshCw,
    Eye, ArrowDownCircle, User, X, Download,
    FileText, BrainCircuit, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import './HistoricoCaixa.css';

const HistoricoCaixa = () => {
    const [caixas, setCaixas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resumo, setResumo] = useState({ total: 0, qtd: 0 });

    const [modalOpen, setModalOpen] = useState(false);
    const [caixaSelecionado, setCaixaSelecionado] = useState(null);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);

    const [dataInicio, setDataInicio] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);

    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        carregarCaixas(0, true);
        // eslint-disable-next-line
    }, []);

    const carregarCaixas = async (pagina = 0, reset = false) => {
        if (loading && pagina > 0) return;
        setLoading(true);

        try {
            const params = {
                page: pagina,
                size: 20,
                sort: 'dataAbertura,desc',
                inicio: dataInicio,
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
            if (reset) toast.error("Não foi possível carregar o histórico.", { toastId: "erro-historico-caixa" });
        } finally {
            setLoading(false);
        }
    };

    const calcularResumo = (lista) => {
        const fechados = lista.filter(c => c.status === 'FECHADO');
        const total = fechados.reduce((acc, c) => acc + (c.valorFisicoInformado || 0), 0);
        setResumo({ total, qtd: fechados.length });
    };

    const handleVerDetalhes = async (id) => {
        setModalOpen(true);
        setLoadingDetalhes(true);
        try {
            const res = await api.get(`/caixas/${id}`);
            setCaixaSelecionado(res.data);
        } catch (error) {
            toast.error("Erro ao carregar detalhes.");
            setModalOpen(false);
        } finally {
            setLoadingDetalhes(false);
        }
    };

    const gerarPDFSofisticado = () => {
        const doc = new jsPDF();

        // 1. Cabeçalho Executivo
        doc.setFillColor(242, 41, 152);
        doc.rect(0, 0, 210, 20, 'F');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text("DD Cosméticos", 14, 13);
        doc.setFontSize(10);
        doc.text("Relatório de Fechamento de Caixa", 150, 13);

        // 2. Metadados
        doc.setTextColor(50);
        doc.setFontSize(10);
        const lblPeriodo = "Período:";
        const valPeriodo = `${formatData(dataInicio)} a ${formatData(dataFim)}`;
        const lblGerado = "Gerado em:";
        const valGerado = `${new Date().toLocaleString()}`;
        const spaceWidth = doc.getTextWidth(" ");

        doc.setFont(undefined, 'bold');
        doc.text(lblPeriodo, 14, 30);
        const w1 = doc.getTextWidth(lblPeriodo);
        doc.setFont(undefined, 'normal');
        doc.text(valPeriodo, 14 + w1 + spaceWidth, 30);

        doc.setFont(undefined, 'bold');
        doc.text(lblGerado, 14, 35);
        const w2 = doc.getTextWidth(lblGerado);
        doc.setFont(undefined, 'normal');
        doc.text(valGerado, 14 + w2 + spaceWidth, 35);

        // 3. Resumo KPI (Box)
        doc.setDrawColor(200);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 40, 180, 20, 3, 3, 'FD');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text("Total Físico Informado (Período)", 20, 48);
        doc.text("Qtd. Fechamentos", 120, 48);

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text(formatMoeda(resumo.total), 20, 56);
        doc.text(resumo.qtd.toString(), 120, 56);
        doc.setFont(undefined, 'normal');

        // 4. Tabela de Dados
        const tableColumn = ["ID", "Operador", "Abertura", "Fechamento", "Físico Informado", "Diferença", "Status"];
        const tableRows = caixas.map(c => {
            const diff = c.diferencaCaixa || 0;
            let diffLabel = "--";
            if (c.status !== 'ABERTO') {
                if (diff < -0.05) diffLabel = `Falta ${formatMoeda(Math.abs(diff))}`;
                else if (diff > 0.05) diffLabel = `Sobra +${formatMoeda(Math.abs(diff))}`;
                else diffLabel = "R$ 0,00";
            }

            return [
                c.id,
                c.operadorNome || 'Admin',
                formatData(c.dataAbertura),
                c.status === 'ABERTO' ? '--' : formatData(c.dataFechamento),
                formatMoeda(c.valorFisicoInformado || 0),
                diffLabel,
                c.status
            ];
        });

        autoTable(doc, {
            startY: 70,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' },
                5: { halign: 'right' }
            },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                    const texto = data.cell.raw;
                    if (texto.includes('Falta')) data.cell.styles.textColor = [220, 38, 38];
                    else if (texto.includes('Sobra')) data.cell.styles.textColor = [22, 163, 74];
                }
            }
        });

        // 5. Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text('DD Cosméticos - Sistema de Gestão Interno', 14, doc.internal.pageSize.height - 10);
            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
        }

        doc.save(`Relatorio_Caixa_${dataInicio}.pdf`);
        toast.success("PDF Sofisticado gerado com sucesso! 📄");
    };

    const formatMoeda = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatData = (dataStr) => {
        if (!dataStr) return '--';
        return new Date(dataStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="hc-premium-container fade-in">
            <header className="hc-header">
                <div className="hc-header-title">
                    <div className="hc-icon-box">
                        <Archive size={28} color="#3b82f6" />
                    </div>
                    <div>
                        <h1>Histórico de Caixa</h1>
                        <p>Auditoria de gaveta e controle de fechamentos</p>
                    </div>
                </div>
                <div className="hc-header-actions">
                    <button className="hc-btn-secondary" onClick={() => { setPage(0); carregarCaixas(0, true); }}>
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                        <span className="hide-mobile">Sincronizar</span>
                    </button>
                    <button className="hc-btn-primary" onClick={gerarPDFSofisticado}>
                        <Download size={18} />
                        <span>Exportar PDF</span>
                    </button>
                </div>
            </header>

            <div className="hc-kpi-grid">
                <div className="hc-kpi-card info">
                    <div className="kpi-icon-wrapper"><Archive size={24} /></div>
                    <div className="kpi-content">
                        <span>Registos de Caixa</span>
                        <h3>{resumo.qtd} <span style={{fontSize: '1rem', color: '#64748b'}}>fechados</span></h3>
                    </div>
                </div>

                <div className="hc-kpi-card success">
                    <div className="kpi-icon-wrapper"><Calendar size={24} /></div>
                    <div className="kpi-content">
                        <span>Total Físico Informado</span>
                        <h3>{formatMoeda(resumo.total)}</h3>
                    </div>
                </div>
            </div>

            <div className="hc-toolbar">
                <div className="hc-filters-wrapper">
                    <div className="hc-input-group">
                        <label>Data Inicial</label>
                        <div className="input-with-icon">
                            <Calendar size={16} className="input-icon" />
                            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                        </div>
                    </div>
                    <div className="hc-input-group">
                        <label>Data Final</label>
                        <div className="input-with-icon">
                            <Calendar size={16} className="input-icon" />
                            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="hc-actions-wrapper">
                    <button className="hc-btn-search" onClick={() => { setPage(0); carregarCaixas(0, true); }}>
                        <Search size={18} /> <span>Filtrar</span>
                    </button>
                </div>
            </div>

            <div className="hc-table-card">
                {caixas.length === 0 && !loading ? (
                    <div className="hc-empty-state">
                        <Archive size={48} className="text-slate-300" />
                        <h2>Nenhum registo encontrado neste período.</h2>
                    </div>
                ) : (
                    <table className="hc-table">
                        <thead>
                            <tr>
                                <th>Caixa / Operador</th>
                                <th>Abertura</th>
                                <th>Fechamento</th>
                                <th className="text-right">Físico (Gaveta)</th>
                                <th className="text-right">Diferença</th>
                                <th>Status</th>
                                <th className="text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {caixas.map((caixa) => {
                                const informado = caixa.valorFisicoInformado || 0;
                                const diff = caixa.diferencaCaixa || 0;
                                const isAberto = caixa.status === 'ABERTO';

                                return (
                                    <tr key={caixa.id} className="hc-table-row">
                                        <td className="td-mobile-flex">
                                            <span className="mobile-label hide-desktop"><User size={14}/> Operador</span>
                                            <div>
                                                <div className="hc-td-title">#{caixa.id} - {caixa.operadorNome || 'Admin'}</div>
                                                <div className="hc-td-subtitle mt-1"><span>PDV 01</span></div>
                                            </div>
                                        </td>
                                        <td className="td-mobile-flex">
                                            <span className="mobile-label hide-desktop"><Calendar size={14}/> Abertura</span>
                                            <div className="hc-td-date">{formatData(caixa.dataAbertura)}</div>
                                        </td>
                                        <td className="td-mobile-flex">
                                            <span className="mobile-label hide-desktop"><Calendar size={14}/> Fechamento</span>
                                            <div className="hc-td-date">{isAberto ? '--' : formatData(caixa.dataFechamento)}</div>
                                        </td>

                                        <td className="text-right td-mobile-flex">
                                            <span className="mobile-label hide-desktop">Físico (Gaveta)</span>
                                            <div className="value-restante">{isAberto ? '--' : formatMoeda(informado)}</div>
                                        </td>

                                        <td className="text-right td-mobile-flex">
                                            <span className="mobile-label hide-desktop">Diferença</span>
                                            <div style={{display: 'inline-block', textAlign: 'right'}}>
                                            {!isAberto ? (
                                                diff < -0.05 ? (
                                                    <span className="diff-badge badge-danger">Falta {formatMoeda(Math.abs(diff))}</span>
                                                ) : diff > 0.05 ? (
                                                    <span className="diff-badge badge-success">Sobra +{formatMoeda(Math.abs(diff))}</span>
                                                ) : (
                                                    <span className="diff-badge badge-neutral">Exato (R$ 0,00)</span>
                                                )
                                            ) : '--'}
                                            </div>
                                        </td>

                                        <td className="td-mobile-flex">
                                            <span className="mobile-label hide-desktop">Status</span>
                                            <span className={`hc-badge status-${caixa.status}`}>{caixa.status}</span>
                                        </td>

                                        <td className="text-right td-mobile-action">
                                            <button className="hc-btn-view" onClick={() => handleVerDetalhes(caixa.id)}>
                                                <Eye size={16}/> <span>Conferência</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

                {!loading && hasMore && (
                    <button className="hc-btn-load-more" onClick={() => { const p = page + 1; setPage(p); carregarCaixas(p, false); }}>
                        <ArrowDownCircle size={18}/> Carregar Mais Registos
                    </button>
                )}
            </div>

            {/* MODAL DETALHES COM GLASSMORPHISM */}
            {modalOpen && caixaSelecionado && (
                <div className="hc-modal-overlay fade-in" onClick={() => setModalOpen(false)}>
                    <div className="hc-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="hc-modal-header">
                            <div>
                                <h2>Auditoria de Caixa #{caixaSelecionado.id}</h2>
                                <p>Revisão de valores físicos vs sistema</p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="btn-close-modal"><X size={24}/></button>
                        </div>

                        <div className="hc-modal-body">
                            <div className="hc-info-grid">
                                <div className="info-box">
                                    <label>Operador</label>
                                    <p>{caixaSelecionado.usuarioAbertura?.nome || caixaSelecionado.operadorNome || 'Admin'}</p>
                                </div>
                                <div className="info-box">
                                    <label>Abertura</label>
                                    <p>{formatData(caixaSelecionado.dataAbertura)}</p>
                                </div>
                                <div className="info-box">
                                    <label>Fechamento</label>
                                    <p>{caixaSelecionado.dataFechamento ? formatData(caixaSelecionado.dataFechamento) : 'Em aberto'}</p>
                                </div>
                            </div>

                            <div className="hc-finance-cards-grid mt-4">
                                <div className="finance-box neutral">
                                    <span>Saldo Inicial</span>
                                    <strong>{formatMoeda(caixaSelecionado.saldoInicial)}</strong>
                                </div>
                                <div className="finance-box success">
                                    <span>(+) Entradas de Caixa</span>
                                    <strong>{formatMoeda(caixaSelecionado.totalEntradas)}</strong>
                                </div>
                                <div className="finance-box danger">
                                    <span>(-) Saídas / Sangrias</span>
                                    <strong>{formatMoeda(caixaSelecionado.totalSaidas)}</strong>
                                </div>
                                <div className="finance-box highlight">
                                    <span>(=) Esperado no Sistema</span>
                                    <strong>{formatMoeda(caixaSelecionado.saldoEsperadoSistema)}</strong>
                                </div>
                                <div className="finance-box dark total-box">
                                    <span>Contado Fisicamente na Gaveta</span>
                                    <strong>{formatMoeda(caixaSelecionado.valorFisicoInformado)}</strong>
                                </div>
                            </div>

                            {/* AUDITORIA IA */}
                            {caixaSelecionado.status === 'FECHADO' && Math.abs(caixaSelecionado.diferencaCaixa || 0) > 0.05 && (
                                <div className="ia-audit-box mt-4">
                                    <div className="ia-audit-header">
                                        <BrainCircuit size={24} />
                                        <h4>Auditoria de Quebra - Assistente IA</h4>
                                    </div>
                                    <div className="ia-audit-content">
                                        <div className="justification-box">
                                            <span className="ia-label">Justificativa do Operador:</span>
                                            <p>"{caixaSelecionado.justificativaDiferenca || 'Nenhuma justificativa fornecida.'}"</p>
                                        </div>
                                        <div className="verdict-box mt-3">
                                            <span className="ia-label"><AlertTriangle size={14}/> Veredito da Inteligência Artificial:</span>
                                            <p>{caixaSelecionado.analiseAuditoriaIa || 'Análise da IA pendente ou não executada para este registro.'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistoricoCaixa;