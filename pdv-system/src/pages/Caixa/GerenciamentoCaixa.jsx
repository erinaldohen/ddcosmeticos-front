import React, { useState, useEffect } from 'react';
import {
    Unlock, Lock, TrendingUp, TrendingDown,
    CheckCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-toastify';
import caixaService from '../../services/caixaService';
import './GerenciamentoCaixa.css';

const GerenciamentoCaixa = () => {
    const [status, setStatus] = useState(null); // 'ABERTO', 'FECHADO'
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState(false);

    // Inputs
    const [valorInput, setValorInput] = useState('');
    const [observacao, setObservacao] = useState('');

    // Dados do Caixa Aberto
    const [dadosCaixa, setDadosCaixa] = useState({
        saldoInicial: 0,
        totalEntradas: 0,
        totalSaidas: 0,
        saldoAtual: 0
    });

    useEffect(() => {
        carregarStatus();
    }, []);

    const carregarStatus = async () => {
        setLoading(true);
        try {
            const res = await caixaService.getStatus();
            if (res.data) {
                setStatus('ABERTO');
                setDadosCaixa({
                    saldoInicial: res.data.saldoInicial,
                    totalEntradas: res.data.totalEntradas || 0,
                    totalSaidas: 0,
                    saldoAtual: (res.data.totalDinheiro || 0) + res.data.saldoInicial
                });
            } else {
                setStatus('FECHADO');
            }
        } catch (error) {
            console.error("Erro status:", error);
            setStatus('FECHADO');
        } finally {
            setLoading(false);
        }
    };

    // --- AÇÕES ---

    const handleAbrirCaixa = async () => {
        if (!valorInput) return toast.warn("Informe o fundo de troco.");
        setLoadingAction(true);
        try {
            await caixaService.abrir({ saldoInicial: valorInput });
            toast.success("Caixa aberto com sucesso!");
            setValorInput('');
            carregarStatus();
        } catch (error) {
            toast.error(error.response?.data?.message || "Erro ao abrir caixa.");
        } finally {
            setLoadingAction(false);
        }
    };

    const handleFecharCaixa = async () => {
        if (!valorInput) return toast.warn("Informe o valor total na gaveta.");
        setLoadingAction(true);
        try {
            await caixaService.fechar({ saldoFinalInformado: valorInput });
            toast.success("Caixa fechado e conferido!");
            setValorInput('');
            setStatus('FECHADO');
        } catch (error) {
            toast.error("Erro ao fechar caixa.");
        } finally {
            setLoadingAction(false);
        }
    };

    const handleMovimentacao = async (tipo) => {
        if (!valorInput) return toast.warn("Informe o valor.");
        setLoadingAction(true);
        try {
            if (tipo === 'SANGRIA') {
                await caixaService.sangria({ valor: valorInput, observacao });
                toast.success("Sangria realizada!");
            } else {
                await caixaService.suprimento({ valor: valorInput, observacao });
                toast.success("Suprimento realizado!");
            }
            setValorInput('');
            setObservacao('');
            carregarStatus();
        } catch (error) {
            toast.error("Erro na movimentação.");
        } finally {
            setLoadingAction(false);
        }
    };

    if (loading) return <div className="caixa-loading">Carregando status do caixa...</div>;

    return (
        <div className="caixa-manager-container fade-in">
            <header className="caixa-header">
                <h1>Gerenciamento de Caixa</h1>
                <div className={`status-pill ${status === 'ABERTO' ? 'open' : 'closed'}`}>
                    {status === 'ABERTO' ? <Unlock size={16}/> : <Lock size={16}/>}
                    {status}
                </div>
            </header>

            <div className="caixa-grid">
                {/* --- CARD PRINCIPAL (AÇÃO) --- */}
                <div className="caixa-card main-action">
                    {status === 'FECHADO' ? (
                        <div className="action-content">
                            <div className="icon-bg closed"><Lock size={48} /></div>
                            <h2>Abrir Turno</h2>
                            <p>Informe o Fundo de Troco para iniciar as vendas.</p>

                            <div className="input-group">
                                <label>Fundo de Troco (R$)</label>
                                <input
                                    type="number"
                                    placeholder="0,00"
                                    value={valorInput}
                                    onChange={e => setValorInput(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <button className="btn-large primary" onClick={handleAbrirCaixa} disabled={loadingAction}>
                                {loadingAction ? 'Abrindo...' : 'Abrir Caixa'}
                            </button>
                        </div>
                    ) : (
                        <div className="action-content">
                            <div className="icon-bg open"><CheckCircle size={48} /></div>
                            <h2>Fechar Turno</h2>
                            <p>Conte o dinheiro na gaveta e informe abaixo.</p>

                            <div className="info-resumo">
                                <span>Fundo Inicial: <strong>R$ {Number(dadosCaixa.saldoInicial).toFixed(2)}</strong></span>
                            </div>

                            <div className="input-group">
                                <label>Valor em Gaveta (Dinheiro)</label>
                                <input
                                    type="number"
                                    placeholder="0,00"
                                    value={valorInput}
                                    onChange={e => setValorInput(e.target.value)}
                                />
                            </div>

                            <button className="btn-large danger" onClick={handleFecharCaixa} disabled={loadingAction}>
                                {loadingAction ? 'Conferindo...' : 'Fechar Caixa'}
                            </button>
                        </div>
                    )}
                </div>

                {/* --- MOVIMENTAÇÕES (SÓ APARECE SE ABERTO) --- */}
                {status === 'ABERTO' && (
                    <div className="caixa-card movements">
                        <h3>Movimentações Manuais</h3>
                        <div className="mov-inputs">
                            <div className="input-group">
                                <label>Valor (R$)</label>
                                <input
                                    type="number"
                                    placeholder="0,00"
                                    value={valorInput}
                                    onChange={e => setValorInput(e.target.value)}
                                />
                            </div>
                            <div className="input-group">
                                <label>Motivo / Observação</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Pagamento Fornecedor..."
                                    value={observacao}
                                    onChange={e => setObservacao(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="mov-buttons">
                            <button className="btn-mov sangria" onClick={() => handleMovimentacao('SANGRIA')} disabled={loadingAction}>
                                <TrendingDown size={20}/> Sangria (Saída)
                            </button>
                            <button className="btn-mov suprimento" onClick={() => handleMovimentacao('SUPRIMENTO')} disabled={loadingAction}>
                                <TrendingUp size={20}/> Suprimento (Entrada)
                            </button>
                        </div>
                        <div className="aviso-mov">
                            <AlertTriangle size={16}/> Sangrias retiram valor do sistema. Use com atenção.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GerenciamentoCaixa;