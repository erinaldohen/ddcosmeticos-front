import React, { useState, useEffect } from 'react';
import {
  DollarSign, Calendar, Search,
  CheckCircle2, AlertCircle, RefreshCw, Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';
import { contasReceberService } from '../../services/contasReceberService';
import './ContasReceber.css';

const ContasReceber = () => {
  const [loading, setLoading] = useState(false);
  const [contas, setContas] = useState([]);
  const [resumo, setResumo] = useState({ totalReceber: 0, totalVencido: 0, recebidoHoje: 0 });
  const [filtroStatus, setFiltroStatus] = useState('PENDENTE');
  const [busca, setBusca] = useState('');

  // Estado do Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [formBaixa, setFormBaixa] = useState({ valor: '', forma: 'DINHEIRO', juros: 0, desconto: 0 });

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

      setResumo(dadosResumo);
      setContas(dadosContas);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  };

  const abrirModalBaixa = (conta) => {
    setContaSelecionada(conta);
    setFormBaixa({
      valor: conta.valorRestante, // Sugere quitar o restante
      forma: 'DINHEIRO',
      juros: 0,
      desconto: 0
    });
    setModalOpen(true);
  };

  const handleBaixa = async (e) => {
    e.preventDefault();
    if (!contaSelecionada) return;

    try {
      const payload = {
        valorPago: parseFloat(formBaixa.valor),
        formaPagamento: formBaixa.forma,
        juros: parseFloat(formBaixa.juros || 0),
        desconto: parseFloat(formBaixa.desconto || 0)
      };

      await contasReceberService.baixarTitulo(contaSelecionada.id, payload);
      toast.success("Pagamento registrado com sucesso!");
      setModalOpen(false);
      carregarDados(); // Recarrega para atualizar a lista e os KPIs
    } catch (error) {
      toast.error("Erro ao registrar pagamento.");
    }
  };

  const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateStr) => {
    if(!dateStr) return "-";
    // Tenta tratar array de data [ano, mes, dia] se vier do Java LocalDate
    if (Array.isArray(dateStr)) return `${dateStr[2]}/${dateStr[1]}/${dateStr[0]}`;
    return new Date(dateStr).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
  };

  return (
    <div className="container-fluid contas-container fade-in">
      <header className="page-header">
        <div>
          <h1>Contas a Receber</h1>
          <p>Gestão de Crediário e Cobranças</p>
        </div>
        <button className="btn-secondary" onClick={carregarDados} disabled={loading}>
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
            placeholder="Buscar cliente..."
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
                    <div style={{fontWeight:600}}>{conta.clienteNome}</div>
                    <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{conta.clienteTelefone}</div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6, color: conta.status === 'VENCIDA' ? '#ef4444' : 'inherit', fontWeight: conta.status === 'VENCIDA' ? 700 : 400}}>
                      <Calendar size={14}/> {formatDate(conta.dataVencimento)}
                    </div>
                  </td>
                  <td style={{fontWeight:700, color: '#1e293b'}}>{formatMoney(conta.valorRestante)}</td>
                  <td><span className={`badge-debt ${conta.status}`}>{conta.status}</span></td>
                  <td style={{display:'flex', justifyContent:'flex-end'}}>
                    {conta.status !== 'PAGA' && (
                      <button className="btn-pay" onClick={() => abrirModalBaixa(conta)}>
                        <DollarSign size={16}/> Receber
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{textAlign:'center', padding:30, color:'#94a3b8'}}>Nenhuma conta encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE BAIXA */}
      {modalOpen && contaSelecionada && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleBaixa}>
            <div className="modal-header">
              <h2>Receber Pagamento</h2>
              <p>Cliente: <strong>{contaSelecionada.clienteNome}</strong></p>
            </div>

            <div className="form-group mb-3">
              <label style={{fontSize:'0.85rem', fontWeight:600, color:'#64748b'}}>Valor a Pagar (R$)</label>
              <input
                type="number" step="0.01" required
                className="ff-input-floating" style={{fontSize:'1.5rem', fontWeight:'bold', color:'#10b981', padding:'10px'}}
                value={formBaixa.valor}
                onChange={e => setFormBaixa({...formBaixa, valor: e.target.value})}
              />
            </div>

            <div className="form-group mb-3">
               <label style={{fontSize:'0.85rem', fontWeight:600, color:'#64748b'}}>Forma de Pagamento</label>
               <select className="ff-input-floating" value={formBaixa.forma} onChange={e => setFormBaixa({...formBaixa, forma: e.target.value})}>
                 <option value="DINHEIRO">Dinheiro</option>
                 <option value="PIX">Pix</option>
                 <option value="DEBITO">Débito</option>
                 <option value="CREDITO">Crédito</option>
               </select>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="action-btn-primary">Confirmar Baixa</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContasReceber;