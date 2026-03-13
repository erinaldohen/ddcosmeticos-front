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
    // --- ESTADOS ---
    const [caixas, setCaixas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resumo, setResumo] = useState({ total: 0, qtd: 0 });

    const [modalOpen, setModalOpen] = useState(false);
    const [caixaSelecionado, setCaixaSelecionado] = useState(null);
    const [loadingDetalhes, setLoadingDetalhes] = useState(false);

    // Filtros
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

    // --- CARREGAR DADOS ---
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

    // --- GERADOR DE PDF SOFISTICADO ---
    const gerarPDFSofisticado = () => {
        const doc = new jsPDF();

        // 1. Cabeçalho Executivo
        doc.setFillColor(242, 41, 152); // Magenta
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
                // CORREÇÃO: Utilizando Math.abs para remover o sinal de menos da string impressa
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
                    if (texto.includes('Falta')) data.cell.styles.textColor = [220, 38, 38]; // Vermelho
                    else if (texto.includes('Sobra')) data.cell.styles.textColor = [22, 163, 74]; // Verde
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

    // --- HELPER FORMAT ---
    const formatMoeda = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatData = (dataStr) => {
        if (!dataStr) return '--';
        return new Date(dataStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="historico-container fade-in">
            {/* HEADER */}
            <div className="page-header">
                <div className="header-title">
                    <h1><Archive size={32} className="text-primary" /> Histórico de Caixa</h1>
                    <p><b>{resumo.qtd}</b> registros | Total Físico: <b className="text-success">{formatMoeda(resumo.total)}</b></p>
                </div>
                <button className="btn-primary" onClick={() => { setPage(0); carregarCaixas(0, true); }} data-tooltip="Atualizar lista agora">
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar
                </button>
            </div>

            {/* FILTROS */}
            <div className="toolbar">
                <div className="date-filter-group">
                    <Calendar size={18} className="text-gray" />
                    <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    <span>até</span>
                    <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    <button className="btn-search-icon" onClick={() => carregarCaixas(0, true)} data-tooltip="Aplicar Filtro">
                        <Search size={18} />
                    </button>
                </div>
                <button className="btn-export" onClick={gerarPDFSofisticado} data-tooltip="Baixar Relatório Executivo">
                    <Download size={18} /> PDF
                </button>
            </div>

            {/* TABELA */}
            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Caixa / Operador</th>
                            <th>Abertura</th>
                            <th>Fechamento</th>
                            <th className="text-right">Físico (Gaveta)</th>
                            <th className="text-right">Diferença (Quebra)</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {caixas.length === 0 && !loading ? (
                            <tr><td colSpan="7" className="empty-state">Nenhum registro encontrado.</td></tr>
                        ) : (
                            caixas.map((caixa) => {
                                const informado = caixa.valorFisicoInformado || 0;
                                const diff = caixa.diferencaCaixa || 0;
                                const isAberto = caixa.status === 'ABERTO';

                                return (
                                    <tr key={caixa.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="avatar-mini"><User size={14}/></div>
                                                <div>
                                                    <strong>#{caixa.id} - {caixa.operadorNome || 'Admin'}</strong>
                                                    <span>PDV 01</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{formatData(caixa.dataAbertura)}</td>
                                        <td>{isAberto ? '--' : formatData(caixa.dataFechamento)}</td>

                                        <td className="text-right font-bold">
                                            {isAberto ? '--' : formatMoeda(informado)}
                                        </td>

                                        {/* COLUNA DE DIFERENÇA COLORIDA E DESTACADA */}
                                        <td className="text-right">
                                            {!isAberto ? (
                                                diff < -0.05 ? (
                                                    <span style={{ color: '#b91c1c', background: '#fee2e2', padding: '6px 10px', borderRadius: '8px', fontWeight: '800', display: 'inline-block' }}>
                                                        {/* CORREÇÃO AQUI: Math.abs(diff) no render visual */}
                                                        Falta {formatMoeda(Math.abs(diff))}
                                                    </span>
                                                ) : diff > 0.05 ? (
                                                    <span style={{ color: '#15803d', background: '#dcfce7', padding: '6px 10px', borderRadius: '8px', fontWeight: '800', display: 'inline-block' }}>
                                                        Sobra +{formatMoeda(Math.abs(diff))}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Exato (R$ 0,00)</span>
                                                )
                                            ) : '--'}
                                        </td>

                                        <td>
                                            <span className={`status-pill ${isAberto ? 'open' : 'closed'}`}>
                                                {caixa.status}
                                            </span>
                                        </td>

                                        <td>
                                            <button className="btn-icon-view" onClick={() => handleVerDetalhes(caixa.id)} data-tooltip="Ver Conferência">
                                                <Eye size={18}/>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {!loading && hasMore && (
                    <button className="btn-load-more" onClick={() => { const p = page + 1; setPage(p); carregarCaixas(p, false); }}>
                        <ArrowDownCircle size={18}/> Carregar Mais
                    </button>
                )}
            </div>

            {/* MODAL DETALHES COM AUDITORIA IA */}
            {modalOpen && caixaSelecionado && (
                <div className="modal-overlay fade-in" onClick={() => setModalOpen(false)}>
                    <div className="modal-content-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                        <div className="modal-header">
                            <h3><FileText size={20}/> Detalhes do Caixa #{caixaSelecionado.id}</h3>
                            <button onClick={() => setModalOpen(false)} className="btn-close-modal"><X size={20}/></button>
                        </div>
                        <div className="modal-body-grid">
                            <div className="info-section">
                                <label>Operador</label>
                                <p>{caixaSelecionado.usuarioAbertura?.nome || caixaSelecionado.operadorNome || 'Admin'}</p>
                            </div>
                            <div className="info-section">
                                <label>Abertura</label>
                                <p>{formatData(caixaSelecionado.dataAbertura)}</p>
                            </div>
                            <div className="info-section">
                                <label>Fechamento</label>
                                <p>{caixaSelecionado.dataFechamento ? formatData(caixaSelecionado.dataFechamento) : 'Em aberto'}</p>
                            </div>

                            <div className="divider-full"></div>

                            <div className="finance-card">
                                <span>Saldo Inicial</span>
                                <strong>{formatMoeda(caixaSelecionado.saldoInicial)}</strong>
                            </div>
                            <div className="finance-card success">
                                <span>(+) Entradas</span>
                                <strong>{formatMoeda(caixaSelecionado.totalEntradas)}</strong>
                            </div>
                            <div className="finance-card danger">
                                <span>(-) Saídas (Sangrias)</span>
                                <strong>{formatMoeda(caixaSelecionado.totalSaidas)}</strong>
                            </div>

                            <div className="finance-card highlight">
                                <span>(=) Esperado no Sistema</span>
                                <strong>{formatMoeda(caixaSelecionado.saldoEsperadoSistema)}</strong>
                            </div>

                            <div className="finance-card dark">
                                <span>Contado na Gaveta</span>
                                <strong>{formatMoeda(caixaSelecionado.valorFisicoInformado)}</strong>
                            </div>

                            {/* NOVO BLOCO: AUDITORIA IA E JUSTIFICATIVA */}
                            {caixaSelecionado.status === 'FECHADO' && Math.abs(caixaSelecionado.diferencaCaixa || 0) > 0.05 && (
                                <div style={{ gridColumn: 'span 3', background: '#fff0f6', border: '1px solid #fbcfe8', borderRadius: '12px', padding: '20px', marginTop: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                        <BrainCircuit size={24} color="#ec4899" />
                                        <h4 style={{ margin: 0, color: '#be185d', fontSize: '1.1rem', fontWeight: '800' }}>Auditoria de Quebra - Assistente IA</h4>
                                    </div>

                                    <div style={{ marginBottom: '15px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#9d174d', textTransform: 'uppercase' }}>Justificativa do Operador:</span>
                                        <p style={{ margin: '5px 0 0 0', color: '#831843', fontStyle: 'italic', background: 'white', padding: '10px', borderRadius: '8px', borderLeft: '4px solid #f9a8d4' }}>
                                            "{caixaSelecionado.justificativaDiferenca || 'Nenhuma justificativa fornecida.'}"
                                        </p>
                                    </div>

                                    <div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#9d174d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <AlertTriangle size={14}/> Veredito da IA:
                                        </span>
                                        <p style={{ margin: '5px 0 0 0', color: '#1e293b', fontWeight: '600', lineHeight: '1.5' }}>
                                            {caixaSelecionado.analiseAuditoriaIa || 'Análise da IA pendente ou não executada para este registro.'}
                                        </p>
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