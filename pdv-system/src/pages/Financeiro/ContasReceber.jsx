import React, { useState, useEffect } from 'react';
import {
  DollarSign, Calendar, Search,
  CheckCircle2, AlertCircle, RefreshCw, Wallet, X
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
    // Array enviado pelo LocalDate do Java
    if (Array.isArray(dateStr)) return `${String(dateStr[2]).padStart(2,'0')}/${String(dateStr[1]).padStart(2,'0')}/${dateStr[0]}`;
    // String ISO segura (sem timezone shift)
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

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dateVenc.setHours(0, 0, 0, 0);

    const diferencaTempo = hoje - dateVenc;
    const diasAtraso = Math.floor(diferencaTempo / (1000 * 60 * 60 * 24));

    return diasAtraso > 0 ? diasAtraso : 0;
  };

const ContasReceber = () => {
  const [loading, setLoading] = useState(false);
  const [loadingBaixa, setLoadingBaixa] = useState(false); // 🔥 Novo estado anti-duplo clique

  const [contas, setContas] = useState([]);
  const [resumo, setResumo] = useState({ totalReceber: 0, totalVencido: 0, recebidoHoje: 0 });

  const [filtroStatus, setFiltroStatus] = useState('PENDENTE');
  const [busca, setBusca] = useState('');

  // Estado do Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);

  // O valor agora é guardado já no formato amigável "150,00"
  const [formBaixa, setFormBaixa] = useState({ valorFormatado: '', forma: 'DINHEIRO', juros: 0, desconto: 0 });

  useEffect(() => {
    carregarDados();
  }, [filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosResumo, dadosContas] = await Promise.all([
        contasReceberService.obterResumo(),
        contasReceberService.listar({ status: filtroStatus, termo: busca })
      ]);

      setResumo(dadosResumo || { totalReceber: 0, totalVencido: 0, recebidoHoje: 0 });
      setContas(Array.isArray(dadosContas) ? dadosContas : []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  };

  const abrirModalBaixa = (conta) => {
    setContaSelecionada(conta);
    const valorRestanteFormatado = Number(conta.valorRestante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    setFormBaixa({
      valorFormatado: valorRestanteFormatado,
      forma: 'DINHEIRO',
      juros: 0,
      desconto: 0
    });
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
      const payload = {
        valorPago: valorCorreto,
        formaPagamento: formBaixa.forma,
        juros: parseFloat(formBaixa.juros || 0),
        desconto: parseFloat(formBaixa.desconto || 0)
      };

      await contasReceberService.baixarTitulo(contaSelecionada.id, payload);

      toast.update(toastId, { render: "Pagamento registrado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
      setModalOpen(false);
      carregarDados();
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Erro ao registrar pagamento.";
      toast.update(toastId, { render: errorMsg, type: "error", isLoading: false, autoClose: 4000 });
    } finally {
      setLoadingBaixa(false);
    }
  };

  return (
    <div className="container-fluid contas-container fade-in">
      <header className="page-header">
        <div>
          <h1>Contas a Receber</h1>
          <p>Gestão de Crediário e Cobranças</p>
        </div>
        <button className="btn-secondary" onClick={carregarDados} disabled={loading || loadingBaixa}>
          <RefreshCw size={18} className={loading ? 'spin' : ''}/> Atualizar
        </button>
      </header>

      {/* KPI CARDS */}
      <div className="kpi-row">
        <div className="kpi-card-finance info">
          <div className="kpi-icon blue"><Wallet /></div>
          <div className="kpi-info"><h3>A Receber (Total)</h3><p>{formatMoney(resumo.totalReceber)}</p></div>
        </div>
        <div className="kpi-card-finance danger">
          <div className="kpi-icon red"><AlertCircle /></div>
          <div className="kpi-info"><h3>Vencido</h3><p>{formatMoney(resumo.totalVencido)}</p></div>
        </div>
        <div className="kpi-card-finance success">
          <div className="kpi-icon green"><CheckCircle2 /></div>
          <div className="kpi-info"><h3>Recebido Hoje</h3><p>{formatMoney(resumo.recebidoHoje)}</p></div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon-inside"/>
          <input
            placeholder="Buscar por cliente ou documento..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregarDados()}
          />
        </div>
        <div className="status-tabs">
          {['TODAS', 'PENDENTE', 'VENCIDA', 'PAGA'].map(s => (
            <button key={s} className={`status-tab ${filtroStatus === s ? 'active' : ''}`} onClick={() => setFiltroStatus(s)}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* LISTAGEM */}
      <div className="debt-table-container">
        {loading && contas.length === 0 ? (
            <div style={{textAlign: 'center', padding: '50px', color: '#94a3b8'}}><RefreshCw size={32} className="spin mb-2"/><h2>Carregando contas...</h2></div>
        ) : (
        <table className="debt-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vencimento</th>
              <th>Valor Restante</th>
              <th>Status</th>
              <th style={{textAlign:'right'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {contas.length > 0 ? (
              contas.map(conta => (
                <tr key={conta.id}>
                  <td>
                    <div style={{fontWeight:600}}>{conta.clienteNome || "Consumidor Final"}</div>
                    <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{conta.clienteTelefone || conta.clienteDocumento || "Sem dados de contacto"}</div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6, color: conta.status === 'VENCIDA' ? '#ef4444' : 'inherit', fontWeight: conta.status === 'VENCIDA' ? 700 : 400}}>
                      <Calendar size={14}/> {formatDate(conta.dataVencimento)}
                    </div>
                    {/* 🔥 ALERTA DE DIAS EM ATRASO PARA O FIADO */}
                                            {conta.status !== 'PAGA' && calcularDiasAtraso(conta.dataVencimento) > 0 && (
                                                <span style={{
                                                    fontSize: '0.70rem', backgroundColor: '#fee2e2', color: '#b91c1c',
                                                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', width: 'fit-content',
                                                    border: '1px solid #fca5a5'
                                                }}>
                                                    ⚠️ {calcularDiasAtraso(conta.dataVencimento)} dias em atraso
                                                </span>
                                            )}
                  </td>
                  <td style={{fontWeight:700, color: '#1e293b'}}>{formatMoney(conta.valorRestante)}</td>
                  <td><span className={`badge-debt ${conta.status}`}>{conta.status}</span></td>
                  <td style={{display:'flex', justifyContent:'flex-end'}}>
                    {conta.status !== 'PAGA' && (
                      <button className="btn-pay" onClick={() => abrirModalBaixa(conta)} disabled={loadingBaixa}>
                        <DollarSign size={16}/> Receber
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{textAlign:'center', padding:40, color:'#94a3b8'}}>Nenhuma conta encontrada nos filtros atuais.</td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* MODAL DE BAIXA COM MÁSCARAS E PREVENÇÃO DE DUPLO CLIQUE */}
      {modalOpen && contaSelecionada && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleBaixa}>
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                  <h2 style={{margin: '0 0 5px 0', fontSize: '1.3rem', color: '#0f172a'}}>Receber Pagamento</h2>
                  <p style={{margin: 0, color: '#64748b'}}>Cliente: <strong>{contaSelecionada.clienteNome || "Consumidor"}</strong></p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} style={{background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'}}><X size={24}/></button>
            </div>

            <div className="form-group mb-3" style={{marginTop: '20px'}}>
              <label style={{fontSize:'0.85rem', fontWeight:600, color:'#64748b', display: 'block', marginBottom: '8px'}}>Valor a Receber (R$)</label>

              {/* O INPUT MÁGICO DE DINHEIRO */}
              <input
                type="text"
                inputMode="numeric"
                required
                className="ff-input-floating"
                style={{fontSize:'1.5rem', fontWeight:'bold', color:'#10b981', padding:'12px', textAlign: 'right'}}
                value={formBaixa.valorFormatado}
                onChange={e => setFormBaixa({...formBaixa, valorFormatado: formatCurrencyInput(e.target.value)})}
                autoFocus
              />
            </div>

            <div className="form-group mb-3">
               <label style={{fontSize:'0.85rem', fontWeight:600, color:'#64748b', display: 'block', marginBottom: '8px'}}>Forma de Pagamento / Entrada de Caixa</label>
               <select className="ff-input-floating" value={formBaixa.forma} onChange={e => setFormBaixa({...formBaixa, forma: e.target.value})}>
                 <option value="DINHEIRO">Dinheiro (Gaveta do Caixa)</option>
                 <option value="PIX">Pix (Conta Empresa)</option>
                 <option value="DEBITO">Cartão de Débito</option>
                 <option value="CREDITO">Cartão de Crédito</option>
               </select>
            </div>

            <div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '30px'}}>
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)} disabled={loadingBaixa}>Cancelar</button>

              <button type="submit" className="action-btn-primary" style={{background: '#10b981', display: 'flex', alignItems: 'center', gap: '8px'}} disabled={loadingBaixa}>
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