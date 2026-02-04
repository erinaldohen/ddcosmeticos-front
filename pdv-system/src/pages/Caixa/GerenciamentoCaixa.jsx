import React, { useState, useEffect } from 'react';
import {
    Unlock, Lock, TrendingUp, TrendingDown,
    CheckCircle, AlertTriangle, Wallet,
    History as HistoryIcon,
    Clock, DollarSign, Calendar, Info, Power, Edit3
} from 'lucide-react';
import { toast } from 'react-toastify';
import caixaService from '../../services/caixaService';
import { MOTIVOS_PADRAO_CAIXA } from '../../utils/motivosFinanceiros'; // Mantemos a lista fixa como base
import './GerenciamentoCaixa.css';

const GerenciamentoCaixa = () => {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState(false);

    // Inputs
    const [valorInput, setValorInput] = useState('');
    const [observacao, setObservacao] = useState('');

    // LISTA DE MOTIVOS (Começa com a padrão, depois enriquece com a do sistema)
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
        carregarMotivosDoSistema(); // Nova função de carga
    }, []);

    // --- CARREGA MOTIVOS DO BANCO DE DADOS ---
    const carregarMotivosDoSistema = async () => {
        try {
            // Tenta buscar do backend
            const response = await caixaService.getMotivosFrequentes();
            const motivosDoBanco = response.data || [];

            // Funde a lista padrão com a do banco (Remove duplicatas com Set)
            const listaCompleta = [...new Set([...MOTIVOS_PADRAO_CAIXA, ...motivosDoBanco])].sort();

            setListaMotivos(listaCompleta);
        } catch (error) {
            // Se o backend falhar ou não tiver o endpoint ainda, usa só a padrão
            console.warn("Não foi possível carregar histórico de motivos.", error);
            setListaMotivos(MOTIVOS_PADRAO_CAIXA.sort());
        }
    };

    const carregarStatus = async () => {
        setLoading(true);
        try {
            const res = await caixaService.getStatus();
            if (res.data) {
                setStatus('ABERTO');
                setDadosCaixa({
                    saldoInicial: res.data.saldoInicial,
                    totalEntradas: res.data.totalEntradas || 0,
                    totalSaidas: res.data.totalSaidas || 0,
                    saldoAtual: (res.data.totalDinheiro || 0) + res.data.saldoInicial,
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

    const handleValorChange = (e) => {
        let valor = e.target.value.replace(/\D/g, "");
        if (valor === "") { setValorInput(""); return; }
        const numero = parseFloat(valor) / 100;
        setValorInput(numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    };

    const getValorNumerico = () => valorInput ? parseFloat(valorInput.replace(/\D/g, "")) / 100 : 0;

    const executarAcao = async (tipoAcao, payload) => {
        const valorCheck = getValorNumerico();
        if (valorCheck <= 0) return toast.warn("Informe um valor válido maior que zero.");
        if ((tipoAcao === 'SANGRIA' || tipoAcao === 'SUPRIMENTO') && !observacao) return toast.warn("Informe o motivo.");

        setLoadingAction(true);
        try {
            if (tipoAcao === 'ABRIR') await caixaService.abrir(payload);
            else if (tipoAcao === 'FECHAR') await caixaService.fechar(payload);
            else if (tipoAcao === 'SANGRIA') await caixaService.sangria(payload);
            else if (tipoAcao === 'SUPRIMENTO') await caixaService.suprimento(payload);

            toast.success("Operação realizada com sucesso!");

            // Atualiza a lista local imediatamente para o usuário não precisar recarregar a página
            // para ver o motivo que acabou de criar
            if (!listaMotivos.includes(observacao)) {
                setListaMotivos(prev => [...prev, observacao].sort());
            }

            setValorInput('');
            setObservacao('');
            carregarStatus();
        } catch (error) {
            toast.error(error.response?.data?.message || "Erro na operação.");
        } finally {
            setLoadingAction(false);
        }
    };

    const handleMainInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (status === 'FECHADO') executarAcao('ABRIR', { saldoInicial: getValorNumerico() });
            else executarAcao('FECHAR', { saldoFinalInformado: getValorNumerico() });
        }
    };

    const handleMovValorKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('input-motivo')?.focus();
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
                        <div className="kpi-value">
                            <DollarSign size={18} className="text-gray"/>
                            {dadosCaixa.saldoInicial.toFixed(2)}
                        </div>
                    </div>
                    <div className="kpi-card" data-tooltip="Total Vendas Dinheiro + Suprimentos">
                        <span className="kpi-label">Entradas</span>
                        <div className="kpi-value text-green">
                            <TrendingUp size={18}/>
                            {dadosCaixa.totalEntradas.toFixed(2)}
                        </div>
                    </div>
                    <div className="kpi-card" data-tooltip="Total Sangrias">
                        <span className="kpi-label">Saídas</span>
                        <div className="kpi-value text-red">
                            <TrendingDown size={18}/>
                            {dadosCaixa.totalSaidas.toFixed(2)}
                        </div>
                    </div>
                    <div className="kpi-card highlight" data-tooltip="Valor estimado atual na gaveta">
                        <span className="kpi-label">Saldo Estimado</span>
                        <div className="kpi-value text-primary">
                            <Wallet size={18}/>
                            {dadosCaixa.saldoAtual.toFixed(2)}
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
                            <h3>{status === 'FECHADO' ? 'Iniciar Operação' : 'Encerrar Operação'}</h3>
                            <p>{status === 'FECHADO' ? 'Defina o fundo de troco.' : 'Conferência final.'}</p>
                        </div>
                    </div>

                    <div className="input-hero-wrapper">
                        <span className="currency-symbol">R$</span>
                        <input
                            type="text"
                            placeholder="0,00"
                            value={status === 'FECHADO' || !observacao ? valorInput : ''}
                            onChange={handleValorChange}
                            onKeyDown={handleMainInputKeyDown}
                            className="input-hero"
                            disabled={loadingAction}
                            autoFocus={status === 'FECHADO'}
                        />
                    </div>

                    <button
                        className={`btn-primary-soft ${status === 'FECHADO' ? 'btn-open-action' : 'btn-close-action'}`}
                        onClick={() => status === 'FECHADO'
                            ? executarAcao('ABRIR', { saldoInicial: getValorNumerico() })
                            : executarAcao('FECHAR', { saldoFinalInformado: getValorNumerico() })
                        }
                        disabled={loadingAction}
                    >
                        {loadingAction ? 'Processando...' : (status === 'FECHADO' ? 'ABRIR CAIXA (Enter)' : 'CONFERIR E FECHAR (Enter)')}
                    </button>
                </div>

                {/* MOVIMENTAÇÕES */}
                {status === 'ABERTO' && (
                    <div className="side-column fade-in">
                        <div className="card-soft mov-card">
                            <div className="card-title-row">
                                <h4>Movimentação Avulsa</h4>
                                <Info size={14} className="info-icon" data-tooltip="Registre retiradas (Sangria) ou entradas manuais (Suprimento)."/>
                            </div>

                            <div className="mov-form-grid">
                                <div className="form-group">
                                    <label>Valor da Movimentação</label>
                                    <div className="input-with-icon">
                                        <span className="input-icon-left">R$</span>
                                        <input
                                            className="input-soft"
                                            type="text"
                                            placeholder="0,00"
                                            value={valorInput}
                                            onChange={handleValorChange}
                                            onKeyDown={handleMovValorKeyDown}
                                        />
                                    </div>
                                </div>

                                <div className="form-group full-width">
                                    <label>Motivo / Observação <small>(Selecione ou digite)</small></label>
                                    <div className="input-with-icon">
                                        <Edit3 size={16} className="input-icon-left text-gray"/>
                                        <input
                                            id="input-motivo"
                                            className="input-soft"
                                            type="text"
                                            list="motivos-list"
                                            placeholder="Ex: Pagamento..."
                                            value={observacao}
                                            onChange={e => setObservacao(e.target.value)}
                                            autoComplete="off"
                                        />
                                        {/* Lista carregada do Banco + Padrões */}
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
                                    onClick={() => executarAcao('SANGRIA', { valor: getValorNumerico(), observacao })}
                                >
                                    <TrendingDown size={16}/> Sangria (Saída)
                                </button>
                                <button
                                    className="btn-action suprimento"
                                    onClick={() => executarAcao('SUPRIMENTO', { valor: getValorNumerico(), observacao })}
                                >
                                    <TrendingUp size={16}/> Suprimento (Entrada)
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
                                                <span className="h-time">{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <span className="h-val">R$ {mov.valor.toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="empty-state">Sem registros recentes.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GerenciamentoCaixa;