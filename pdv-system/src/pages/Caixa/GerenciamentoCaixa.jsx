import React, { useState, useEffect } from 'react';
import {
  DollarSign, Lock, Unlock, TrendingUp, TrendingDown,
  CreditCard, Smartphone, Banknote, Wallet, AlertCircle,
  PlusCircle, MinusCircle, CheckCircle2, FileText, AlertTriangle
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
  const [modalResumo, setModalResumo] = useState(false); // NOVO: Modal de Resumo

  const [valorInput, setValorInput] = useState('');
  const [observacaoInput, setObservacaoInput] = useState('');
  const [dadosFechamento, setDadosFechamento] = useState(null); // Guarda o resultado do fechamento

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

  // --- FUNÇÕES DE MÁSCARA MONETÁRIA ---
  const handleValorChange = (e) => {
    // Remove tudo que não for número. Se vazio, vira string vazia.
    const onlyNums = e.target.value.replace(/\D/g, "");
    setValorInput(onlyNums);
  };

  const getValorFormatado = (valorRaw) => {
    if (!valorRaw) return "";
    // Divide por 100 para criar os centavos e formata no padrão BR
    const parsed = parseInt(valorRaw, 10);
    if (isNaN(parsed)) return "";
    return (parsed / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  // --- HANDLERS (Ações) ---
  const limparInputs = () => { setValorInput(''); setObservacaoInput(''); };

  const executarAcao = async (tipo) => {
    if(!valorInput) return toast.warning("Informe um valor.");
    const parsedValor = parseInt(valorInput, 10);
    if (isNaN(parsedValor) || (tipo !== 'FECHAR' && parsedValor === 0)) {
         return toast.warning("Informe um valor válido.");
    }

    // Converte a string limpa ("15000") para decimal (150.00) pro backend
    const valorDecimal = parsedValor / 100;

    try {
      if (tipo === 'ABRIR') {
        await caixaService.abrir(valorDecimal);
        setModalAbertura(false);
        toast.success("Caixa aberto! Boas vendas. 🚀");
        carregarDados();
      } else if (tipo === 'FECHAR') {
        const response = await caixaService.fechar(valorDecimal);
        setModalFechamento(false);
        setDadosFechamento(response); // Guarda a resposta (diferença, saldo esperado)
        setModalResumo(true);         // Abre o modal de resumo final
        toast.success("Caixa fechado com sucesso.");
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
      toast.error(error.response?.data?.message || "Erro ao processar operação.");
    }
  };

  const fecharResumo = () => {
    setModalResumo(false);
    setDadosFechamento(null);
    carregarDados(); // Força recarregar para mostrar a tela de "Caixa Fechado"
  };

  if (loading) return <div className="loading-screen"><div className="loader"></div>Carregando Dashboard...</div>;

  return (
    <div className={`caixa-container fade-in ${!caixa ? 'layout-fechado' : ''}`}>

      {/* HEADER: SÓ APARECE SE O CAIXA ESTIVER ABERTO E SEM MODAL DE RESUMO */}
      {caixa && !modalResumo && (
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

      {/* --- ESTADO DE RESUMO PÓS-FECHAMENTO --- */}
      {modalResumo && dadosFechamento && (
         <div className="empty-state-modern resume-state">
            <div className={`icon-wrapper-large ${dadosFechamento.diferenca === 0 ? 'success' : 'warning'}`}>
               {dadosFechamento.diferenca === 0 ? <CheckCircle2 size={56} /> : <AlertTriangle size={56} />}
            </div>
            <h2>Relatório de Fechamento</h2>

            <div className="resume-details">
                <div className="resume-row">
                    <span>Valor Físico Informado:</span>
                    <strong>R$ {(dadosFechamento.valorInformado ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                </div>
                <div className="resume-row">
                    <span>Valor Esperado (Sistema):</span>
                    <strong>R$ {(dadosFechamento.saldoEsperado ?? 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                </div>
                <div className={`resume-row highlight ${dadosFechamento.diferenca < 0 ? 'text-red' : dadosFechamento.diferenca > 0 ? 'text-green' : ''}`}>
                    <span>Status do Caixa:</span>
                    <strong>
                        {dadosFechamento.diferenca === 0 ? 'Caixa Bateu' :
                         dadosFechamento.diferenca < 0 ? `Quebra de R$ ${Math.abs(dadosFechamento.diferenca).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` :
                         `Sobra de R$ ${dadosFechamento.diferenca.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`}
                    </strong>
                </div>
            </div>

            <button className="btn-hero" onClick={fecharResumo}>
              <Lock size={20} /> Concluir e Sair
            </button>
         </div>
      )}


      {!caixa && !modalResumo ? (
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
      ) : caixa && !modalResumo ? (
        // --- ESTADO ABERTO (DASHBOARD) ---
        <div className="dashboard-grid">

          {/* COLUNA 1: RESUMO GERAL (Dinheiro na Gaveta) */}
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
      ) : null}

      {/* --- MODAL GENÉRICO DE INPUT --- */}
      {(modalAbertura || modalFechamento || modalSangria || modalSuprimento) && (
        <div className="modal-overlay-modern">
          <div className="modal-card-modern fade-in-up">
            <div className={`modal-header ${modalFechamento || modalSangria ? 'warning' : 'primary'}`}>
               {modalAbertura && <h3>Abrir Caixa</h3>}
               {modalFechamento && <h3>Fechar Caixa</h3>}
               {modalSangria && <h3>Realizar Sangria</h3>}
               {modalSuprimento && <h3>Realizar Suprimento</h3>}
            </div>

            <div className="modal-body">
              <label>{modalFechamento ? 'Valor Contado em Gaveta (R$)' : 'Valor (R$)'}</label>
              <div className="input-money-wrapper">
                <span>R$</span>
                <input
                  autoFocus
                  type="text"
                  value={getValorFormatado(valorInput)}
                  onChange={handleValorChange}
                  onKeyDown={e => e.key === 'Enter' && (
                    modalAbertura ? executarAcao('ABRIR') :
                    modalFechamento ? executarAcao('FECHAR') :
                    modalSangria ? executarAcao('SANGRIA') :
                    executarAcao('SUPRIMENTO')
                  )}
                  placeholder="0,00"
                />
              </div>

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

              {modalFechamento && (
                <p className="modal-hint">
                  <AlertCircle size={14}/> Conte as notas físicas na gaveta e informe o valor total.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-text" onClick={() => {
                setModalAbertura(false); setModalFechamento(false); setModalSangria(false); setModalSuprimento(false);
              }}>Cancelar</button>

              <button className={`btn-confirm ${modalFechamento || modalSangria ? 'danger' : 'primary'}`} onClick={() => {
                 if(modalAbertura) executarAcao('ABRIR');
                 if(modalFechamento) executarAcao('FECHAR');
                 if(modalSangria) executarAcao('SANGRIA');
                 if(modalSuprimento) executarAcao('SUPRIMENTO');
              }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciamentoCaixa;