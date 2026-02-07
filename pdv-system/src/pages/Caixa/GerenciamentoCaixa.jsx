import React, { useState, useEffect } from 'react';
import {
    Unlock, Lock, TrendingUp, TrendingDown,
    CheckCircle, Wallet,
    History as HistoryIcon,
    Calendar, Info, Power, Edit3,
    Eye, EyeOff, X, Printer
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf'; // NOVO
import caixaService from '../../services/caixaService';
import { MOTIVOS_PADRAO_CAIXA } from '../../utils/motivosFinanceiros';
import './GerenciamentoCaixa.css';

const GerenciamentoCaixa = () => {
    const navigate = useNavigate();

    // Estados de Controle
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState(false);

    // Regra de Negócio: Privacidade do Saldo
    const [exibirSaldo, setExibirSaldo] = useState(false);

    // Regra de Negócio: Fechamento Cego
    const [exibirModalFechamento, setExibirModalFechamento] = useState(false);
    const [saldoFechamentoContado, setSaldoFechamentoContado] = useState('');

    // Inputs Gerais
    const [valorInput, setValorInput] = useState('');
    const [observacao, setObservacao] = useState('');

    const [listaMotivos, setListaMotivos] = useState(MOTIVOS_PADRAO_CAIXA);
    const [dadosCaixa, setDadosCaixa] = useState({
        saldoInicial: 0,
        totalEntradas: 0,
        totalSaidas: 0,
        saldoAtual: 0,
        movimentacoes: []
    });

    const hoje = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long'
    });

    useEffect(() => {
        carregarStatus();
        carregarMotivosDoSistema();
    }, []);

    // --- CARGAS DE DADOS ---
    const carregarMotivosDoSistema = async () => {
        try {
            const response = await caixaService.getMotivosFrequentes();
            const motivosDoBanco = response.data || [];
            const listaCompleta = [...new Set([...MOTIVOS_PADRAO_CAIXA, ...motivosDoBanco])].sort();
            setListaMotivos(listaCompleta);
        } catch (error) {
            setListaMotivos(MOTIVOS_PADRAO_CAIXA.sort());
        }
    };

    const carregarStatus = async () => {
        setLoading(true);
        try {
            const res = await caixaService.getStatus();
            if (res.data) {
                setStatus('ABERTO');
                const saldoAtualCalculado = (res.data.totalDinheiro || 0) +
                                            (res.data.saldoInicial || 0) +
                                            (res.data.totalEntradas || 0) -
                                            (res.data.totalSaidas || 0);

                setDadosCaixa({
                    id: res.data.id,
                    saldoInicial: res.data.saldoInicial,
                    totalEntradas: res.data.totalEntradas || 0,
                    totalSaidas: res.data.totalSaidas || 0,
                    saldoAtual: saldoAtualCalculado,
                    movimentacoes: res.data.movimentacoes || []
                });
            } else {
                setStatus('FECHADO');
            }
        } catch (error) {
            setStatus('FECHADO');
        } finally {
            setLoading(false);
        }
    };

    // --- FORMATAÇÃO E VALIDAÇÃO ---
    const formatarMoedaInput = (valor) => {
        let v = valor.replace(/\D/g, "");
        if (v === "") return "";
        const numero = parseFloat(v) / 100;
        return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const getValorNumerico = (strValor) => {
        if (!strValor) return 0;
        return parseFloat(strValor.replace(/\D/g, "")) / 100;
    };

    // --- NOVO: GERADOR DE RECIBO PDF SOFISTICADO ---
    const gerarReciboPDF = (tipo, dados, valorInformado = 0) => {
        const doc = new jsPDF();

        // Cores e Cabeçalho
        const colorPrimary = [37, 99, 235]; // Azul
        const colorDanger = [220, 38, 38];  // Vermelho

        doc.setFillColor(...colorPrimary);
        doc.rect(0, 0, 210, 20, 'F');

        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text("DD Cosméticos - Comprovante", 105, 13, { align: 'center' });

        // Info Básica
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Operação: ${tipo}`, 14, 30);
        doc.text(`Data: ${new Date().toLocaleString()}`, 14, 35);
        if(dados.id) doc.text(`ID Movimentação: #${dados.id}`, 14, 40);

        // Box de Valor
        doc.setDrawColor(200);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 45, 180, 25, 3, 3, 'FD');

        doc.setFontSize(12);
        doc.text("Valor da Operação", 20, 55);

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        if (tipo === 'SANGRIA') doc.setTextColor(...colorDanger);
        else doc.setTextColor(...colorPrimary);

        const valorFinal = tipo === 'FECHAMENTO' ? valorInformado : dados.valor;
        doc.text(Number(valorFinal).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}), 20, 63);

        // Se for Fechamento, mostra resumo
        if (tipo === 'FECHAMENTO') {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.setFont(undefined, 'normal');
            doc.text("Conferência de Fechamento (Cego)", 14, 80);
            doc.text(`Saldo Contado: R$ ${valorInformado.toFixed(2)}`, 14, 85);
            doc.text("O valor será auditado pelo gerente.", 14, 90);
        }

        // Rodapé
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Documento gerado eletronicamente.", 105, 280, { align: 'center' });

        doc.save(`Recibo_${tipo}_${new Date().getTime()}.pdf`);
    };

    // --- AÇÕES DO CAIXA ---
    const executarAcao = async (tipoAcao, payload) => {
        const valorRaw = tipoAcao === 'FECHAR' ? saldoFechamentoContado : valorInput;
        const valorCheck = getValorNumerico(valorRaw);

        if (valorCheck <= 0 && tipoAcao !== 'ABRIR') return toast.warn("Valor inválido.");

        if ((tipoAcao === 'SANGRIA' || tipoAcao === 'SUPRIMENTO') && !observacao) {
            return toast.warn("Informe o motivo da movimentação.");
        }

        setLoadingAction(true);
        try {
            let response;

            if (tipoAcao === 'ABRIR') {
                await caixaService.abrir(payload);
                toast.success("Caixa ABERTO com sucesso!");
            }
            else if (tipoAcao === 'FECHAR') {
                response = await caixaService.fechar(payload);
                toast.success("Caixa FECHADO! Gerando recibo... 📄");
                setExibirModalFechamento(false);
                gerarReciboPDF('FECHAMENTO', response?.data || {}, valorCheck);
            }
            else if (tipoAcao === 'SANGRIA') {
                response = await caixaService.sangria(payload);
                toast.success("Sangria realizada! 📄");
                gerarReciboPDF('SANGRIA', response.data);
            }
            else if (tipoAcao === 'SUPRIMENTO') {
                response = await caixaService.suprimento(payload);
                toast.success("Suprimento realizado! 📄");
                gerarReciboPDF('SUPRIMENTO', response.data);
            }

            // Atualiza lista de motivos
            if (observacao && !listaMotivos.includes(observacao)) {
                setListaMotivos(prev => [...prev, observacao].sort());
            }

            // Limpeza
            setValorInput('');
            setObservacao('');
            setSaldoFechamentoContado('');
            carregarStatus();

        } catch (error) {
            toast.error(error.response?.data?.message || "Erro ao realizar operação.");
        } finally {
            setLoadingAction(false);
        }
    };

    if (loading) return <div className="caixa-loading"><div className="spinner"></div></div>;

    return (
        <div className="caixa-manager-container fade-in">
            <header className="header-status-highlight">
                <div className="header-left">
                    <div className="badge-date"><Calendar size={14}/> {hoje}</div>
                    <h1>Gerenciamento de Caixa</h1>
                </div>
                <div className={`status-banner ${status === 'ABERTO' ? 'is-open' : 'is-closed'}`}>
                    <div className="status-icon-wrapper">
                        {status === 'ABERTO' ? <Unlock size={28} /> : <Lock size={28} />}
                        <div className="pulse-ring"></div>
                    </div>
                    <div className="status-text-group">
                        <span className="status-label">STATUS ATUAL</span>
                        <h2 className="status-main">{status === 'ABERTO' ? 'ABERTO' : 'FECHADO'}</h2>
                    </div>
                </div>
            </header>

            {status === 'ABERTO' && (
                <div className="kpi-row fade-in">
                    <div className="kpi-card" data-tooltip="Dinheiro inicial na gaveta">
                        <span className="kpi-label">Fundo Inicial</span>
                        <div className="kpi-value text-gray">
                            R$ {dadosCaixa.saldoInicial.toFixed(2)}
                        </div>
                    </div>
                    <div className="kpi-card" data-tooltip="Aportes manuais">
                        <span className="kpi-label">Suprimentos</span>
                        <div className="kpi-value text-green">
                            <TrendingUp size={18}/>
                            {dadosCaixa.totalEntradas.toFixed(2)}
                        </div>
                    </div>
                    <div className="kpi-card" data-tooltip="Retiradas para despesas/sangrias">
                        <span className="kpi-label">Sangrias</span>
                        <div className="kpi-value text-red">
                            <TrendingDown size={18}/>
                            {dadosCaixa.totalSaidas.toFixed(2)}
                        </div>
                    </div>

                    <div className="kpi-card highlight" data-tooltip="Saldo esperado (Sistema)">
                        <div className="kpi-header-row" style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                            <span className="kpi-label">Saldo Estimado</span>
                            <button
                                onClick={() => setExibirSaldo(!exibirSaldo)}
                                className="btn-icon-sm"
                                title={exibirSaldo ? "Ocultar valor" : "Ver valor"}
                            >
                                {exibirSaldo ? <EyeOff size={16}/> : <Eye size={16}/>}
                            </button>
                        </div>
                        <div className="kpi-value text-primary">
                            <Wallet size={18}/>
                            {exibirSaldo ? `R$ ${dadosCaixa.saldoAtual.toFixed(2)}` : "••••••"}
                        </div>
                    </div>
                </div>
            )}

            <div className="content-grid">
                {/* ÁREA DE AÇÃO PRINCIPAL */}
                <div className={`main-panel card-soft ${status === 'FECHADO' ? 'center-focus' : ''}`}>
                    <div className="panel-header">
                        <div className={`icon-box ${status === 'FECHADO' ? 'red-soft' : 'blue-soft'}`}>
                            {status === 'FECHADO' ? <Power size={24}/> : <CheckCircle size={24}/>}
                        </div>
                        <div>
                            <h3>{status === 'FECHADO' ? 'Iniciar Operação' : 'Operação Ativa'}</h3>
                            <p>{status === 'FECHADO' ? 'Defina o fundo de troco para abrir.' : 'O caixa está registrando vendas.'}</p>
                        </div>
                    </div>

                    {status === 'FECHADO' ? (
                        <>
                            <div className="input-hero-wrapper">
                                <span className="currency-symbol">R$</span>
                                <input
                                    type="text"
                                    placeholder="0,00"
                                    value={valorInput}
                                    onChange={(e) => setValorInput(formatarMoedaInput(e.target.value))}
                                    className="input-hero"
                                    autoFocus
                                />
                            </div>
                            <button
                                className="btn-primary-soft btn-open-action"
                                onClick={() => executarAcao('ABRIR', { saldoInicial: getValorNumerico(valorInput) })}
                                disabled={loadingAction}
                            >
                                {loadingAction ? 'Abrindo...' : 'ABRIR CAIXA'}
                            </button>
                        </>
                    ) : (
                        <div className="fechamento-container">
                            <p className="info-text">Para encerrar o dia, realize o fechamento cego (contagem física).</p>
                            <button
                                className="btn-primary-soft btn-close-action"
                                onClick={() => setExibirModalFechamento(true)}
                                disabled={loadingAction}
                            >
                                ENCERRAR EXPEDIENTE
                            </button>
                        </div>
                    )}
                </div>

                {/* MOVIMENTAÇÕES AVULSAS */}
                {status === 'ABERTO' && (
                    <div className="side-column fade-in">
                        <div className="card-soft mov-card">
                            <div className="card-title-row">
                                <h4>Movimentação Avulsa</h4>
                                <Info size={14} className="info-icon" title="Sangrias e Suprimentos não fiscais"/>
                            </div>

                            <div className="mov-form-grid">
                                <div className="form-group">
                                    <label>Valor (R$)</label>
                                    <div className="input-with-icon">
                                        <span className="input-icon-left">R$</span>
                                        <input
                                            className="input-soft"
                                            type="text"
                                            placeholder="0,00"
                                            value={valorInput}
                                            onChange={(e) => setValorInput(formatarMoedaInput(e.target.value))}
                                        />
                                    </div>
                                </div>

                                <div className="form-group full-width">
                                    <label>Motivo</label>
                                    <div className="input-with-icon">
                                        <Edit3 size={16} className="input-icon-left text-gray"/>
                                        <input
                                            id="input-motivo"
                                            className="input-soft"
                                            type="text"
                                            list="motivos-list"
                                            placeholder="Ex: Pagamento Motoboy..."
                                            value={observacao}
                                            onChange={e => setObservacao(e.target.value)}
                                        />
                                        <datalist id="motivos-list">
                                            {listaMotivos.map((motivo, idx) => (
                                                <option key={idx} value={motivo} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            <div className="action-buttons-row">
                                <button
                                    className="btn-action sangria"
                                    onClick={() => executarAcao('SANGRIA', { valor: getValorNumerico(valorInput), observacao })}
                                >
                                    <TrendingDown size={16}/> Sangria
                                </button>
                                <button
                                    className="btn-action suprimento"
                                    onClick={() => executarAcao('SUPRIMENTO', { valor: getValorNumerico(valorInput), observacao })}
                                >
                                    <TrendingUp size={16}/> Suprimento
                                </button>
                            </div>
                        </div>

                        <div className="card-soft history-card">
                            <div className="card-title-row">
                                <h4><HistoryIcon size={16}/> Últimas Ações</h4>
                            </div>
                            {dadosCaixa.movimentacoes && dadosCaixa.movimentacoes.length > 0 ? (
                                <ul className="history-list">
                                    {dadosCaixa.movimentacoes.slice(-5).reverse().map((mov, idx) => (
                                        <li key={idx} className="history-item">
                                            <div className={`indicator ${mov.tipo === 'SANGRIA' ? 'red' : 'green'}`}></div>
                                            <div className="history-content">
                                                <span className="h-desc">{mov.observacao || mov.tipo}</span>
                                                <span className="h-time">
                                                    {new Date(mov.dataHora).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <span className="h-val">R$ {mov.valor.toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="empty-state">Sem movimentações hoje.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* --- MODAL DE FECHAMENTO CEGO (SEGURANÇA) --- */}
            {exibirModalFechamento && (
                <div className="modal-overlay fade-in">
                    <div className="modal-content-blind">
                        <div className="modal-header-blind">
                            <Lock size={24} className="icon-lock"/>
                            <h3>Conferência de Caixa</h3>
                            <button className="btn-close-modal" onClick={() => setExibirModalFechamento(false)}>
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="modal-body-blind">
                            <p className="security-notice">
                                <strong>Atenção:</strong> Conte o dinheiro físico na gaveta e informe o valor abaixo.
                            </p>

                            <label>Valor Total em Dinheiro (Físico):</label>
                            <div className="input-hero-wrapper blind-input">
                                <span className="currency-symbol">R$</span>
                                <input
                                    type="text"
                                    placeholder="0,00"
                                    value={saldoFechamentoContado}
                                    onChange={(e) => setSaldoFechamentoContado(formatarMoedaInput(e.target.value))}
                                    className="input-hero"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="modal-actions-blind">
                            <button className="btn-cancelar" onClick={() => setExibirModalFechamento(false)}>Cancelar</button>
                            <button
                                className="btn-confirmar-fechamento"
                                onClick={() => executarAcao('FECHAR', { saldoFinalInformado: getValorNumerico(saldoFechamentoContado) })}
                                disabled={loadingAction || !saldoFechamentoContado}
                            >
                                {loadingAction ? 'Processando...' : 'CONFIRMAR FECHAMENTO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GerenciamentoCaixa;