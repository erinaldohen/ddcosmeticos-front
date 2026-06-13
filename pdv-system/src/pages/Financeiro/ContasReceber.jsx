import React, { useState, useEffect } from 'react';
import {
  DollarSign, Calendar, Search, FileText,
  CheckCircle2, AlertCircle, RefreshCw, TrendingUp, X,
  User, Hash, ArrowRight, Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';
import { contasReceberService } from '../../services/contasReceberService';
import './ContasReceber.css';

// ==========================================================
// HELPERS BLINDADOS (Idênticos ao Contas a Pagar e PDV)
// ==========================================================
const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseMoneyBR = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

// Formatação segura de inputs financeiros em tempo real
const formatCurrencyInput = (v) => {
    let raw = String(v).replace(/\D/g, "");
    if(!raw) return "";
    return (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
    if(!dateStr) return "-";
    if (Array.isArray(dateStr)) return `${String(dateStr[2]).padStart(2,'0')}/${String(dateStr[1]).padStart(2,'0')}/${dateStr[0]}`;
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

// 🔥 MOTOR DE COBRANÇA: Calcula quantos dias o cliente está a dever
  const calcularDiasAtraso = (dataVencStr) => {
    if (!dataVencStr) return 0;
    let dateVenc;
    if (Array.isArray(dataVencStr)) {
        dateVenc = new Date(dataVencStr[0], dataVencStr[1] - 1, dataVencStr[2]);
    } else {
        const [year, month, day] = dataVencStr.split('T')[0].split('-');
        dateVenc = new Date(year, month - 1, day);
    }
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); dateVenc.setHours(0, 0, 0, 0);
    const diferencaTempo = hoje - dateVenc;
    const diasAtraso = Math.floor(diferencaTempo / (1000 * 60 * 60 * 24));
    return diasAtraso > 0 ? diasAtraso : 0;
  };

const ContasReceber = () => {
  const [loading, setLoading] = useState(false);
  const [loadingBaixa, setLoadingBaixa] = useState(false);

  const [contas, setContas] = useState([]);
  const [resumo, setResumo] = useState({ totalReceber: 0, totalVencido: 0, recebidoHoje: 0 });

  const [filtroStatus, setFiltroStatus] = useState('PENDENTE');
  const [busca, setBusca] = useState('');

  // Estado do Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [formBaixa, setFormBaixa] = useState({ valorFormatado: '', forma: 'DINHEIRO', juros: 0, desconto: 0 });

  useEffect(() => { carregarDados(); }, [filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosResumo, dadosContas] = await Promise.all([
        contasReceberService.obterResumo(),
        contasReceberService.listar({ status: filtroStatus, termo: busca })
      ]);
      setResumo(dadosResumo || { totalReceber: 0, totalVencido: 0, recebidoHoje: 0 });
      setContas(Array.isArray(dadosContas) ? dadosContas : []);
    } catch (error) { toast.error("Erro ao carregar dados financeiros."); }
    finally { setLoading(false); }
  };

  const abrirModalBaixa = (conta) => {
    setContaSelecionada(conta);
    const valorRestanteFormatado = Number(conta.valorRestante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setFormBaixa({ valorFormatado: valorRestanteFormatado, forma: 'DINHEIRO', juros: 0, desconto: 0 });
    setModalOpen(true);
  };

  const handleBaixa = async (e) => {
    e.preventDefault();
    if (!contaSelecionada || loadingBaixa) return;
    const valorCorreto = parseMoneyBR(formBaixa.valorFormatado);
    if (valorCorreto <= 0) return toast.warn("O valor a receber deve ser maior que zero.");

    setLoadingBaixa(true);
    const toastId = toast.loading("Processando entrada no caixa...");

    try {
      const payload = { valorPago: valorCorreto, formaPagamento: formBaixa.forma, juros: parseFloat(formBaixa.juros || 0), desconto: parseFloat(formBaixa.desconto || 0) };
      await contasReceberService.baixarTitulo(contaSelecionada.id, payload);
      toast.update(toastId, { render: "Pagamento registrado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
      setModalOpen(false); carregarDados();
    } catch (error) {
      toast.update(toastId, { render: error.response?.data?.message || "Erro ao registrar pagamento.", type: "error", isLoading: false, autoClose: 4000 });
    } finally { setLoadingBaixa(false); }
  };

  return (
    <div className="cp-premium-container fade-in">
      <header className="cp-header">
        <div className="cp-header-title">
          <div className="cp-icon-box" style={{ background: '#ecfdf5', boxShadow: '0 4px 10px rgba(16,185,129,0.15)' }}>
              <TrendingUp size={28} color="#10b981" />
          </div>
          <div>
            <h1>Contas a Receber</h1>
            <p>Gestão de Crediário e Cobranças</p>
          </div>
        </div>
        <div className="cp-header-actions">
            <button className="cp-btn-secondary" onClick={carregarDados} disabled={loading || loadingBaixa} title="Sincronizar">
                <RefreshCw size={18} className={loading ? 'spin' : ''}/> <span className="hide-mobile">Atualizar</span>
            </button>
        </div>
      </header>

      {/* KPI CARDS (Idênticos ao Contas a Pagar) */}
      <div className="cp-kpi-grid">
        <div className="cp-kpi-card info">
          <div className="kpi-icon-wrapper"><Wallet size={24} /></div>
          <div className="kpi-content">
              <span>A Receber (Total)</span>
              <h3>{formatMoney(resumo.totalReceber)}</h3>
          </div>
        </div>

        <div className="cp-kpi-card danger">
          <div className="kpi-icon-wrapper"><AlertCircle size={24} /></div>
          <div className="kpi-content">
              <span>Total Vencido</span>
              <h3>{formatMoney(resumo.totalVencido)}</h3>
          </div>
        </div>

        <div className="cp-kpi-card success">
          <div className="kpi-icon-wrapper"><CheckCircle2 size={24} /></div>
          <div className="kpi-content">
              <span>Recebido Hoje</span>
              <h3>{formatMoney(resumo.recebidoHoje)}</h3>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="cp-toolbar">
        <div className="cp-search-box">
          <Search size={18} className="search-icon"/>
          <input type="text" placeholder="Buscar por cliente ou documento..." value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && carregarDados()} />
        </div>
        <div className="cp-tabs">
          {['TODAS', 'PENDENTE', 'VENCIDA', 'PAGA'].map(s => (
            <button key={s} className={`cp-tab-btn ${filtroStatus === s ? 'active' : ''}`} onClick={() => setFiltroStatus(s)}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* LISTAGEM (Design unificado) */}
      <div className="cp-table-card">
        {loading && contas.length === 0 ? (
           <div className="cp-empty-state"><RefreshCw size={40} className="spin text-slate-300" /><h2>Sincronizando...</h2></div>
        ) : contas.length === 0 ? (
           <div className="cp-empty-state"><FileText size={48} className="text-slate-200" /><h2>Nenhuma conta encontrada nesta categoria.</h2></div>
        ) : (
          <table className="cp-table">
            <thead>
              <tr>
                <th>Cliente / Devedor</th>
                <th>Vencimento</th>
                <th>Valor Restante</th>
                <th>Status</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {contas.map(conta => (
                <tr key={conta.id} className="cp-table-row">
                  <td className="td-mobile-flex">
                    <span className="mobile-label hide-desktop"><User size={14}/> Cliente</span>
                    <div>
                        <div className="cp-td-title">{conta.clienteNome || "Consumidor Final"}</div>
                        <div className="cp-td-subtitle">
                            <span><Hash size={12}/> {conta.clienteTelefone || conta.clienteDocumento || "Sem dados de contacto"}</span>
                        </div>
                    </div>
                  </td>
                  <td className="td-mobile-flex">
                    <span className="mobile-label hide-desktop"><Calendar size={14}/> Vencimento</span>
                    <div>
                        <div className={`cp-td-date ${conta.status === 'VENCIDA' ? 'text-danger' : ''}`}>
                          <Calendar size={14} className="hide-mobile"/> {formatDate(conta.dataVencimento)}
                        </div>
                        {/* ALERTA DE DIAS EM ATRASO PARA O FIADO */}
                        {conta.status !== 'PAGA' && calcularDiasAtraso(conta.dataVencimento) > 0 && (
                            <span className="cr-badge-atraso">⚠️ {calcularDiasAtraso(conta.dataVencimento)} dias atraso</span>
                        )}
                    </div>
                  </td>
                  <td className="td-mobile-flex">
                    <span className="mobile-label hide-desktop"><DollarSign size={14}/> A Receber</span>
                    <div className="cp-td-value-stack">
                        <span className="value-restante text-success">{formatMoney(conta.valorRestante)}</span>
                        {conta.valorTotal > conta.valorRestante && (
                            <span className="value-original">Original: {formatMoney(conta.valorTotal)}</span>
                        )}
                    </div>
                  </td>
                  <td className="td-mobile-flex">
                    <span className="mobile-label hide-desktop"><AlertCircle size={14}/> Status</span>
                    <span className={`cp-badge status-${conta.status || 'PENDENTE'}`}>{conta.status}</span>
                  </td>
                  <td className="text-right td-mobile-action">
                    <div className="action-group">
                      {conta.status !== 'PAGA' && (
                        <button className="cp-btn-pay receive-btn" onClick={() => abrirModalBaixa(conta)} disabled={loadingBaixa}>
                          <DollarSign size={16}/> <span>Receber</span> <ArrowRight size={14} className="hide-mobile"/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DE BAIXA (Unificado com Glassmorphism) */}
      {modalOpen && contaSelecionada && (
        <div className="cp-modal-overlay">
          <form className="cp-modal-card scale-in" onSubmit={handleBaixa}>
            <div className="cp-modal-header">
                <div><h2>Receber Pagamento</h2><p className="text-truncate">Cliente: <strong>{contaSelecionada.clienteNome || "Consumidor"}</strong></p></div>
                <button type="button" className="btn-close" onClick={() => setModalOpen(false)}><X size={24}/></button>
            </div>

            <div className="cp-modal-body">
                <div className="cp-input-group">
                  <label>Valor Efetivamente Recebido (R$)</label>
                  <input
                      type="text"
                      required
                      className="input-gigante text-success"
                      value={formBaixa.valorFormatado}
                      onChange={e => setFormBaixa({...formBaixa, valorFormatado: formatCurrencyInput(e.target.value)})}
                      autoFocus
                  />
                </div>

                <div className="cp-input-group" style={{ marginTop: '16px' }}>
                   <label>Entrada de Caixa (Forma de Pagamento)</label>
                   <select
                      value={formBaixa.forma}
                      onChange={e => setFormBaixa({...formBaixa, forma: e.target.value})}
                      className="cp-select"
                   >
                     <option value="DINHEIRO">Dinheiro (Gaveta do Caixa)</option>
                     <option value="PIX">Pix (Conta Empresa)</option>
                     <option value="DEBITO">Cartão de Débito</option>
                     <option value="CREDITO">Cartão de Crédito</option>
                   </select>
                </div>
            </div>

            <div className="cp-modal-footer">
              <button type="button" className="cp-btn-cancel" onClick={() => setModalOpen(false)} disabled={loadingBaixa}>Cancelar</button>
              <button type="submit" className="cp-btn-submit success" disabled={loadingBaixa}>
                {loadingBaixa ? <RefreshCw size={18} className="spin"/> : <CheckCircle2 size={18} />}
                {loadingBaixa ? 'Processando...' : 'Confirmar Baixa'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContasReceber;