import React, { useState, useEffect } from 'react';
import {
  Lock, Unlock, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, Save, LogOut, FileText, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import caixaService from '../../services/caixaService';
import './GerenciamentoCaixa.css';

const GerenciamentoCaixa = () => {
  const [caixa, setCaixa] = useState(null); // null = fechado
  const [loading, setLoading] = useState(true);

  // Form States
  const [valorInput, setValorInput] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'ABRIR', 'SANGRIA', 'SUPRIMENTO', 'FECHAR'

  useEffect(() => {
    carregarStatus();
  }, []);

  const carregarStatus = async () => {
    setLoading(true);
    try {
      const res = await caixaService.verificarStatus();
      // Backend retorna 204 (No Content) se fechado, ou 200 com objeto se aberto
      if (res.status === 200 && res.data) {
        setCaixa(res.data);
      } else {
        setCaixa(null);
      }
    } catch (error) {
      // Se for 401, o MainLayout/App provavelmente já vai tratar, mas aqui garantimos que não quebra
      console.error("Erro ao verificar caixa", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    // Converte vírgula para ponto
    const valor = parseFloat(valorInput.replace(',', '.'));
    if (isNaN(valor) || valor < 0) return toast.error("Valor inválido");

    try {
      if (modalMode === 'ABRIR') {
        const res = await caixaService.abrir(valor);
        setCaixa(res.data);
        toast.success("Caixa Aberto com Sucesso!");
      }
      else if (modalMode === 'FECHAR') {
        const res = await caixaService.fechar(valor);
        setCaixa(null); // Reseta tela visualmente

        // Feedback detalhado do fechamento
        const diff = res.data.diferenca;
        if (diff === 0) toast.success("Caixa fechado! Valores batem perfeitamente.");
        else if (diff > 0) toast.info(`Caixa fechado com SOBRA de ${formatMoney(diff)}`);
        else toast.warning(`Caixa fechado com FALTA de ${formatMoney(Math.abs(diff))}`);
      }
      else {
        // Sangria ou Suprimento
        const descFinal = descricao || (modalMode === 'SANGRIA' ? 'Retirada' : 'Aporte');
        await caixaService.movimentar(modalMode, valor, descFinal);

        toast.success(`${modalMode} realizada!`);
        // Recarrega para tentar atualizar saldo e lista de movimentos
        carregarStatus();
      }

      // Limpeza
      setModalMode(null);
      setValorInput('');
      setDescricao('');

    } catch (error) {
      console.error("Erro na operação:", error);

      let msg = "Erro na operação.";
      // Tratamento robusto de erro vindo do Backend (ResponseStatusException)
      if (error.response) {
          if (error.response.data && error.response.data.message) {
              msg = error.response.data.message;
          } else if (typeof error.response.data === 'string') {
              msg = error.response.data;
          }
      }
      toast.error(msg);
    }
  };

  const formatMoney = (val) => {
    return val ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  };

  if (loading) return <div className="loading-screen">Verificando Caixa...</div>;

  return (
    <div className="caixa-container fade-in">
      {/* HEADER */}
      <header className={`caixa-header ${caixa ? 'open' : 'closed'}`}>
        <div className="status-icon">
          {caixa ? <Unlock size={40} /> : <Lock size={40} />}
        </div>
        <div className="status-info">
          <h1>{caixa ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}</h1>
          {caixa && <p>Iniciado em: {new Date(caixa.dataAbertura).toLocaleString('pt-BR')}</p>}
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="caixa-main">
        {!caixa ? (
          <div className="empty-state-caixa">
            <DollarSign size={64} className="text-gray-400" />
            <h3>O terminal está fechado</h3>
            <p>Para iniciar as vendas, é necessário informar o fundo de troco.</p>
            <button className="btn-primary-large" onClick={() => setModalMode('ABRIR')}>
              ABRIR CAIXA
            </button>
          </div>
        ) : (
          <div className="dashboard-caixa">
            <div className="kpi-grid">
              <div className="kpi-card">
                <label>Saldo Inicial (Fundo)</label>
                <strong>{formatMoney(caixa.saldoInicial)}</strong>
              </div>
              <div className="kpi-card highlight">
                <label>Vendas (Dinheiro)</label>
                {/* Se o backend ainda não calcula totais parciais no /status, isso ficará zerado ou desatualizado até fechar */}
                <strong>{formatMoney(caixa.totalVendasDinheiro)}</strong>
                <small>Acumulado na sessão</small>
              </div>
            </div>

            <div className="actions-grid">
              <button className="btn-action suprimento" onClick={() => setModalMode('SUPRIMENTO')}>
                <TrendingUp size={24} />
                <span>Suprimento (Entrada)</span>
              </button>
              <button className="btn-action sangria" onClick={() => setModalMode('SANGRIA')}>
                <TrendingDown size={24} />
                <span>Sangria (Saída)</span>
              </button>
              <button className="btn-action fechar" onClick={() => setModalMode('FECHAR')}>
                <LogOut size={24} />
                <span>FECHAR CAIXA</span>
              </button>
            </div>

            <div className="history-section">
               <h3>Movimentações do Turno</h3>
               {(!caixa.movimentacoes || caixa.movimentacoes.length === 0) && (
                 <p className="text-muted">Nenhuma movimentação extra registrada.</p>
               )}
               <ul className="mov-list">
                 {caixa.movimentacoes?.map(m => (
                   <li key={m.id} className={`mov-item ${m.tipo}`}>
                      <div className="mov-info">
                        <span className="mov-type">{m.tipo}</span>
                        <span className="mov-desc">{m.descricao}</span>
                        <small>{new Date(m.dataHora).toLocaleTimeString('pt-BR')}</small>
                      </div>
                      <strong className="mov-val">{formatMoney(m.valor)}</strong>
                   </li>
                 ))}
               </ul>
            </div>
          </div>
        )}
      </main>

      {/* MODAL GENÉRICO */}
      {modalMode && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
                <h2>
                {modalMode === 'ABRIR' && 'Abertura de Caixa'}
                {modalMode === 'FECHAR' && 'Fechamento de Caixa'}
                {modalMode === 'SANGRIA' && 'Realizar Sangria'}
                {modalMode === 'SUPRIMENTO' && 'Realizar Suprimento'}
                </h2>
                <button className="btn-close-modal" onClick={() => {setModalMode(null); setValorInput('');}}><X /></button>
            </div>

            {modalMode === 'FECHAR' && (
              <div className="alert-box warning">
                <AlertTriangle size={20}/>
                <p>Conte o dinheiro físico na gaveta e informe abaixo. O sistema calculará a diferença (quebra) automaticamente.</p>
              </div>
            )}

            <div className="form-group">
              <label>Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                autoFocus
                placeholder="0.00"
                value={valorInput}
                onChange={e => setValorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAction()}
              />
            </div>

            {(modalMode === 'SANGRIA' || modalMode === 'SUPRIMENTO') && (
              <div className="form-group">
                <label>Motivo / Descrição</label>
                <input
                  type="text"
                  placeholder={modalMode === 'SANGRIA' ? "Ex: Pagamento Fornecedor" : "Ex: Adição de Troco"}
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                />
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => {setModalMode(null); setValorInput('');}}>Cancelar</button>
              <button
                className={`btn-confirm ${modalMode === 'FECHAR' || modalMode === 'SANGRIA' ? 'danger' : 'success'}`}
                onClick={handleAction}
              >
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