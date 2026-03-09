import React, { useState, useEffect } from 'react';
import {
  DollarSign, Lock, Unlock, TrendingUp, TrendingDown,
  CreditCard, Smartphone, Banknote, Wallet, AlertCircle,
  PlusCircle, MinusCircle, CheckCircle2
} from 'lucide-react';
import caixaService from '../../services/caixaService';
import { toast } from 'react-toastify';
import './GerenciamentoCaixa.css';

const GerenciamentoCaixa = () => {
  const [caixa, setCaixa] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados de Modais e Inputs
  const [modalAbertura, setModalAbertura] = useState(false);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [modalSangria, setModalSangria] = useState(false);
  const [modalSuprimento, setModalSuprimento] = useState(false);

  const [valorInput, setValorInput] = useState('');
  const [observacaoInput, setObservacaoInput] = useState('');

  // --- ESTADOS PARA A IA (Justificativa) ---
  const [justificativaFechamento, setJustificativaFechamento] = useState('');
  const [requerJustificativa, setRequerJustificativa] = useState(false);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const data = await caixaService.getStatus();
      if (data && data.status === 'ABERTO') {
          setCaixa(data.caixa || data);
      } else {
          setCaixa(null);
      }
    } catch (error) {
      console.error("Erro ao carregar caixa:", error);
      toast.error("Não foi possível sincronizar o caixa.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);

  const handleValorChange = (e) => {
    const onlyNums = e.target.value.replace(/\D/g, "");
    setValorInput(onlyNums);
    // Se ele mudar o valor numérico, esconde a justificativa para tentar fechar normalmente
    if (requerJustificativa) setRequerJustificativa(false);
  };

  const getValorFormatado = (valorRaw) => {
    if (!valorRaw) return "";
    const parsed = parseInt(valorRaw, 10);
    if (isNaN(parsed)) return "";
    return (parsed / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const limparInputs = () => {
    setValorInput('');
    setObservacaoInput('');
    setJustificativaFechamento('');
    setRequerJustificativa(false);
  };

  const executarAcao = async (tipo) => {
    if (!valorInput) return toast.warning("Informe um valor.");
    const parsedValor = parseInt(valorInput, 10);
    if (isNaN(parsedValor) || (tipo !== 'FECHAR' && parsedValor === 0)) {
         return toast.warning("Informe um valor válido.");
    }

    // Validação da Justificativa antes de enviar pro Java
    if (tipo === 'FECHAR' && requerJustificativa && justificativaFechamento.trim().length < 10) {
      return toast.warning("Por favor, digite uma justificativa detalhada (mín. 10 caracteres).");
    }

    const valorDecimal = parsedValor / 100;

    try {
      if (tipo === 'ABRIR') {
        await caixaService.abrir(valorDecimal);
        setModalAbertura(false);
        toast.success("Caixa aberto! Boas vendas. 🚀");
        carregarDados();
      } else if (tipo === 'FECHAR') {
        // Envia o fechamento com a justificativa
        await caixaService.fechar(valorDecimal, justificativaFechamento.trim() !== '' ? justificativaFechamento : null);
        setModalFechamento(false);
        toast.success("Caixa fechado com sucesso.");

        // A MÁGICA: Força a interface voltar para o "Cadeado Fechado" instantaneamente!
        setCaixa(null);
        carregarDados(); // Sincroniza em background
      } else if (tipo === 'SANGRIA') {
        await caixaService.sangria({ valor: valorDecimal, observacao: observacaoInput });
        setModalSangria(false);
        toast.info("Sangria realizada.");
        carregarDados();
      } else if (tipo === 'SUPRIMENTO') {
        await caixaService.suprimento({ valor: valorDecimal, observacao: observacaoInput });
        setModalSuprimento(false);
        toast.success("Suprimento adicionado.");
        carregarDados();
      }
      limparInputs();
    } catch (error) {
      // --- CAPTURA DA TRAVA DE SEGURANÇA 428 (IA) ---
      if (tipo === 'FECHAR' && (error.response?.status === 428 || error.response?.data?.mensagem?.includes("justificativa"))) {
         setRequerJustificativa(true);
         toast.warning("Houve divergência no caixa. É necessário justificar o motivo.");
      } else {
         toast.error(error.response?.data?.mensagem || error.response?.data?.message || "Erro ao processar operação.");
      }
    }
  };

  if (loading) return <div className="loading-screen"><div className="loader"></div>Carregando Dashboard...</div>;

  return (
    <div className={`caixa-container fade-in ${!caixa ? 'layout-fechado' : ''}`}>

      {/* HEADER: SÓ APARECE SE O CAIXA ESTIVER ABERTO */}
      {caixa && (
        <header className="caixa-header-modern">
          <div>
            <h1>Controle de Caixa</h1>
            <p className="subtitle">Gestão financeira do ponto de venda</p>
          </div>
          <div className="status-pill active">
            <div className="pulsing-dot"></div>
            CAIXA ABERTO #{caixa.id}
          </div>
        </header>
      )}

      {!caixa ? (
        // --- ESTADO FECHADO (MENSAGEM SUSPENSA) ---
        <div className="empty-state-modern">
          <div className="icon-wrapper-large">
            <Lock size={56} strokeWidth={1.5} />
          </div>
          <h2>O caixa está fechado</h2>
          <p>Informe o fundo de troco inicial para começar a operar.</p>
          <button className="btn-hero" onClick={() => { limparInputs(); setModalAbertura(true); }}>
            <Unlock size={20} /> Abrir Caixa Agora
          </button>
        </div>
      ) : (
        // --- ESTADO ABERTO (DASHBOARD) ---
        <div className="dashboard-grid">

          {/* COLUNA 1: RESUMO GERAL */}
          <section className="main-balance-card">
            <div className="balance-header">
              <span><Wallet size={18}/> Dinheiro em Gaveta</span>
              <small>Saldo Físico Estimado</small>
            </div>
            <div className="balance-value">
              R$ {(caixa.saldoAtual ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>

            <div className="quick-actions-row">
              <button className="btn-icon-action success" onClick={() => {limparInputs(); setModalSuprimento(true)}} title="Adicionar Dinheiro">
                <PlusCircle size={20}/> Suprimento
              </button>
              <button className="btn-icon-action danger" onClick={() => {limparInputs(); setModalSangria(true)}} title="Retirar Dinheiro">
                <MinusCircle size={20}/> Sangria
              </button>
            </div>

            <div className="mini-stats-row">
              <div className="mini-stat">
                <span className="label">Saldo Inicial</span>
                <span className="value">R$ {(caixa.saldoInicial ?? 0).toFixed(2)}</span>
              </div>
              <div className="mini-stat text-green">
                <span className="label">Entradas</span>
                <span className="value">+ R$ {((caixa.totalEntradas ?? 0) + (caixa.totalVendasDinheiro ?? 0)).toFixed(2)}</span>
              </div>
              <div className="mini-stat text-red">
                <span className="label">Saídas</span>
                <span className="value">- R$ {(caixa.totalSaidas ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* COLUNA 2: VENDAS DIGITAIS */}
          <section className="digital-sales-panel">
            <h3><TrendingUp size={20}/> Faturamento Digital</h3>

            <div className="method-card pix">
              <div className="method-icon"><Smartphone size={20}/></div>
              <div className="method-info">
                <span>PIX</span>
                <div className="progress-bg"><div className="progress-fill" style={{width: '100%'}}></div></div>
              </div>
              <strong>R$ {(caixa.totalVendasPix ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            <div className="method-card credit">
              <div className="method-icon"><CreditCard size={20}/></div>
              <div className="method-info">
                <span>Crédito</span>
                <small>Cartão</small>
              </div>
              <strong>R$ {(caixa.totalVendasCredito ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            <div className="method-card debit">
              <div className="method-icon"><CreditCard size={20}/></div>
              <div className="method-info">
                <span>Débito</span>
                <small>Cartão</small>
              </div>
              <strong>R$ {(caixa.totalVendasDebito ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            <div className="total-digital-row">
              <span>Total Digital</span>
              <span>R$ {((caixa.totalVendasPix??0) + (caixa.totalVendasCredito??0) + (caixa.totalVendasDebito??0)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
            </div>
          </section>

          {/* BOTÃO FECHAR (Rodapé) */}
          <div className="dashboard-footer">
             <div className="audit-info">
                <CheckCircle2 size={16} color="#10b981"/> Sistema Operacional
             </div>
             <button className="btn-close-register" onClick={() => { limparInputs(); setModalFechamento(true); }}>
               Fechar Caixa
             </button>
          </div>

        </div>
      )}

      {/* --- MODAL GENÉRICO DE INPUT (INCLUINDO IA) --- */}
      {(modalAbertura || modalFechamento || modalSangria || modalSuprimento) && (
        <div className="modal-overlay-modern fade-in">
          <div className="modal-card-modern fade-in-up" style={{ transition: 'all 0.3s', borderColor: requerJustificativa ? '#f59e0b' : 'transparent' }}>

            <div className={`modal-header ${requerJustificativa ? 'warning' : modalFechamento || modalSangria ? 'danger' : 'primary'}`}>
               {modalAbertura && <h3>Abrir Caixa</h3>}
               {modalFechamento && <h3>{requerJustificativa ? 'Divergência Encontrada' : 'Fechar Caixa'}</h3>}
               {modalSangria && <h3>Realizar Sangria</h3>}
               {modalSuprimento && <h3>Realizar Suprimento</h3>}
            </div>

            <div className="modal-body">
              <label>{modalFechamento ? 'Valor Contado em Gaveta (R$)' : 'Valor (R$)'}</label>
              <div className="input-money-wrapper" style={{ borderColor: requerJustificativa ? '#f59e0b' : '' }}>
                <span>R$</span>
                <input
                  autoFocus={!requerJustificativa}
                  type="text"
                  value={getValorFormatado(valorInput)}
                  onChange={handleValorChange}
                  disabled={requerJustificativa}
                  onKeyDown={e => !requerJustificativa && e.key === 'Enter' && (
                    modalAbertura ? executarAcao('ABRIR') :
                    modalFechamento ? executarAcao('FECHAR') :
                    modalSangria ? executarAcao('SANGRIA') :
                    executarAcao('SUPRIMENTO')
                  )}
                  placeholder="0,00"
                />
              </div>

              {/* BLOCO IA: JUSTIFICATIVA DE FECHAMENTO */}
              {requerJustificativa && (
                 <div className="fade-in" style={{ marginTop: '15px' }}>
                    <label style={{ color: '#d97706', fontWeight: 'bold' }}>Justificativa Obrigatória</label>
                    <textarea
                       autoFocus
                       className="input-text-modern"
                       rows="3"
                       style={{ resize: 'none', borderColor: '#fcd34d', backgroundColor: '#fffbeb' }}
                       placeholder="Explique o motivo da diferença no caixa..."
                       value={justificativaFechamento}
                       onChange={e => setJustificativaFechamento(e.target.value)}
                    />
                 </div>
              )}

              {(modalSangria || modalSuprimento) && (
                <>
                  <label style={{marginTop: 15}}>Motivo / Observação</label>
                  <input
                    className="input-text-modern"
                    value={observacaoInput}
                    onChange={e => setObservacaoInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (modalSangria ? executarAcao('SANGRIA') : executarAcao('SUPRIMENTO'))}
                    placeholder="Ex: Pagamento de fornecedor..."
                  />
                </>
              )}

              {modalFechamento && !requerJustificativa && (
                <p className="modal-hint">
                  <AlertCircle size={14}/> Conte as notas físicas na gaveta e informe o valor total.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-text" disabled={loading} onClick={() => {
                setModalAbertura(false); setModalFechamento(false); setModalSangria(false); setModalSuprimento(false); limparInputs();
              }}>Cancelar</button>

              <button className={`btn-confirm ${requerJustificativa ? 'warning' : modalFechamento || modalSangria ? 'danger' : 'primary'}`}
                      disabled={loading}
                      onClick={() => {
                         if(modalAbertura) executarAcao('ABRIR');
                         if(modalFechamento) executarAcao('FECHAR');
                         if(modalSangria) executarAcao('SANGRIA');
                         if(modalSuprimento) executarAcao('SUPRIMENTO');
                      }}>
                {loading ? 'Aguarde...' : requerJustificativa ? 'Confirmar e Enviar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciamentoCaixa;