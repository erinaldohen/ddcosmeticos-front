import React, { useState, useEffect } from 'react';
import {
  Lock, Unlock, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, LogOut, X, ArrowRight, Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';
import caixaService from '../../services/caixaService';
import './GerenciamentoCaixa.css';

const GerenciamentoCaixa = () => {
  const [caixa, setCaixa] = useState(null);
  const [loading, setLoading] = useState(true);

  const [valorInput, setValorInput] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modalMode, setModalMode] = useState(null);

  useEffect(() => {
    carregarStatus();
  }, []);

  const carregarStatus = async () => {
    setLoading(true);
    try {
      const res = await caixaService.getStatus();
      if (res.status === 200 && res.data && res.data.status === 'ABERTO') {
        setCaixa(res.data);
      } else {
        setCaixa(null);
      }
    } catch (error) {
      if (error.response?.status === 404) setCaixa(null);
      else console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleValorChange = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value === "") { setValorInput(""); return; }
    const numero = parseFloat(value) / 100;
    setValorInput(numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  const getValorFloat = () => {
      if (!valorInput) return 0;
      const limpo = valorInput.replace(/[^\d,]/g, '').replace(',', '.');
      return parseFloat(limpo) || 0;
  };

  const handleAction = async () => {
    const valor = getValorFloat();

    if (modalMode !== 'ABRIR' && (isNaN(valor) || valor <= 0)) {
        return toast.warning("Informe um valor válido.");
    }

    try {
      if (modalMode === 'ABRIR') {
        const res = await caixaService.abrir({ saldoInicial: valor });
        setCaixa(res.data);
        toast.success("Caixa aberto com sucesso!");
      }
      else if (modalMode === 'FECHAR') {
        const res = await caixaService.fechar({ saldoFinalInformado: valor });
        setCaixa(null);
        const diff = res.data.diferenca || 0;
        if (Math.abs(diff) < 0.01) toast.success("Caixa fechado. Valores conferem.");
        else if (diff > 0) toast.info(`Sobra de ${formatMoney(diff)}`);
        else toast.warning(`Falta de ${formatMoney(Math.abs(diff))}`);
      }
      else {
        const descFinal = descricao || (modalMode === 'SANGRIA' ? 'Retirada Avulsa' : 'Aporte de Troco');
        if (modalMode === 'SANGRIA') await caixaService.sangria({ valor, observacao: descFinal });
        else await caixaService.suprimento({ valor, observacao: descFinal });
        toast.success("Operação registrada.");
        carregarStatus();
      }
      setModalMode(null);
      setValorInput('');
      setDescricao('');
    } catch (error) {
      const msg = error.response?.data?.message || "Erro ao processar.";
      toast.error(msg);
    }
  };

  const formatMoney = (val) => val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

  if (loading) return <div className="loading-screen"><div className="spinner"></div> Verificando...</div>;

  return (
    <div className="caixa-container fade-in">
      <header className={`caixa-header ${caixa ? 'open' : 'closed'}`}>
        <div className="status-icon">
          {caixa ? <Unlock size={32} /> : <Lock size={32} />}
        </div>
        <div className="status-info">
          <h1>{caixa ? 'Caixa Aberto' : 'Caixa Fechado'}</h1>
          {caixa && <p>Sessão iniciada às {new Date(caixa.dataAbertura).toLocaleTimeString('pt-BR').substring(0,5)}</p>}
        </div>
      </header>

      <main className="caixa-main">
        {!caixa ? (
          <div className="empty-state-caixa">
            <div style={{background:'#f1f5f9', width:80, height:80, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto'}}>
                <DollarSign size={40} className="text-gray-400" />
            </div>
            <h3>Caixa Fechado</h3>
            <p>Informe o valor inicial do caixa para começar.</p>
            <button className="btn-primary-large" onClick={() => setModalMode('ABRIR')}>
              ABRIR CAIXA
            </button>
          </div>
        ) : (
          <div className="dashboard-caixa">
            <div className="kpi-grid">
              <div className="kpi-card">
                <label>Saldo Inicial</label>
                <strong>{formatMoney(caixa.saldoInicial)}</strong>
              </div>
              <div className="kpi-card highlight">
                <label>Vendas (Dinheiro)</label>
                <strong>{formatMoney(caixa.totalEntradas || 0)}</strong>
              </div>
              <div className="kpi-card danger">
                <label>Saídas</label>
                <strong>{formatMoney(caixa.totalSaidas || 0)}</strong>
              </div>
            </div>

            <div className="actions-grid">
              <button className="btn-action suprimento" onClick={() => setModalMode('SUPRIMENTO')}>
                <div className="mov-icon" style={{background:'#dcfce7', color:'#10b981'}}><TrendingUp size={24} /></div>
                <span>Suprimento</span>
              </button>
              <button className="btn-action sangria" onClick={() => setModalMode('SANGRIA')}>
                <div className="mov-icon" style={{background:'#fee2e2', color:'#ef4444'}}><TrendingDown size={24} /></div>
                <span>Sangria</span>
              </button>
              <button className="btn-action fechar" onClick={() => setModalMode('FECHAR')}>
                <div className="mov-icon" style={{background:'#fee2e2', color:'#ef4444'}}><LogOut size={24} /></div>
                <span>Fechar Caixa</span>
              </button>
            </div>

            <div className="history-section">
               <h3>Histórico Recente</h3>
               {(!caixa.movimentacoes || caixa.movimentacoes.length === 0) ? (
                 <div className="empty-history">Sem movimentações manuais.</div>
               ) : (
                 <ul className="mov-list">
                   {caixa.movimentacoes.map((m, idx) => (
                     <li key={idx} className={`mov-item ${m.tipo?.toLowerCase()}`}>
                        <div className="mov-icon">
                            {m.tipo === 'SANGRIA' ? <TrendingDown size={20}/> : <TrendingUp size={20}/>}
                        </div>
                        <div className="mov-info">
                          <span className="mov-type">{m.tipo}</span>
                          <span className="mov-desc">{m.observacao}</span>
                          <small>{new Date(m.dataMovimento || m.dataHora).toLocaleTimeString('pt-BR')}</small>
                        </div>
                        <strong className="mov-val">{formatMoney(m.valor)}</strong>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
          </div>
        )}
      </main>

      {/* --- RENDERIZAÇÃO DO MODAL --- */}
      {modalMode && (
        <div className="modal-overlay">

          {/* SELEÇÃO DO TIPO DE MODAL: 'modal-ai' PARA ABERTURA, 'modal-standard' PARA O RESTO */}
          <div className={`modal-content ${modalMode === 'ABRIR' ? 'modal-ai' : 'modal-standard'}`}>

            {/* === LAYOUT IA / SMART (ABRIR) === */}
            {modalMode === 'ABRIR' ? (
                <>
                    <div className="modal-header">
                        <button className="btn-close-abs" onClick={() => {setModalMode(null); setValorInput('');}}><X size={20}/></button>
                        <div className="ai-icon-bubble">
                            <Unlock size={36} strokeWidth={2} />
                        </div>
                        <h2>Abertura de Caixa</h2>
                        <p className="subtitle">Informe o fundo de troco disponível.</p>
                    </div>

            <div className="modal-body">
                <div className="input-smart-wrapper">
                    <input
                        type="text"
                        autoFocus
                        placeholder="R$ 0,00"
                        // CORREÇÃO: Mostra o valor completo (Ex: R$ 150,00)
                        value={valorInput}
                        onChange={handleValorChange}
                        onKeyDown={e => e.key === 'Enter' && handleAction()}
                        className="input-smart"
                    />
                </div>
            </div>

                    <div className="modal-footer">
                        <button className="btn-smart-primary" onClick={handleAction}>
                            INICIAR OPERAÇÃO <ArrowRight size={20}/>
                        </button>
                    </div>
                </>
            ) : (
                /* === LAYOUT PADRÃO (FECHAR, SANGRIA, SUPRIMENTO) === */
                <>
                    <div className="modal-header">
                        <h2>
                            {modalMode === 'FECHAR' && 'Fechamento de Caixa'}
                            {modalMode === 'SANGRIA' && 'Realizar Sangria'}
                            {modalMode === 'SUPRIMENTO' && 'Realizar Suprimento'}
                        </h2>
                        <button className="btn-close-modal" onClick={() => {setModalMode(null); setValorInput('');}}><X size={20}/></button>
                    </div>

                    <div className="modal-body">
                        {modalMode === 'FECHAR' && (
                          <div className="alert-box warning" style={{marginBottom: 20}}>
                            <AlertTriangle size={20}/>
                            <p>Conte o dinheiro físico na gaveta e informe abaixo.</p>
                          </div>
                        )}

                        <div className="form-group">
                          <label>Valor (R$)</label>
                          <input
                            type="text"
                            autoFocus
                            placeholder="R$ 0,00"
                            value={valorInput}
                            onChange={handleValorChange}
                            onKeyDown={e => e.key === 'Enter' && handleAction()}
                          />
                        </div>

                        {(modalMode === 'SANGRIA' || modalMode === 'SUPRIMENTO') && (
                          <div className="form-group">
                            <label>Motivo</label>
                            <input
                              type="text"
                              placeholder={modalMode === 'SANGRIA' ? "Ex: Pagamento Fornecedor" : "Ex: Adição de Troco"}
                              value={descricao}
                              onChange={e => setDescricao(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAction()}
                            />
                          </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button className="btn-std-cancel" onClick={() => {setModalMode(null); setValorInput('');}}>Cancelar</button>
                        <button
                            className={`btn-std-confirm ${modalMode === 'FECHAR' || modalMode === 'SANGRIA' ? 'danger' : 'success'}`}
                            onClick={handleAction}
                        >
                            Confirmar
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GerenciamentoCaixa;