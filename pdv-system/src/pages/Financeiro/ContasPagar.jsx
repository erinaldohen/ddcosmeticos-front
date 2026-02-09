import React, { useState, useEffect } from 'react';
import {
  DollarSign, Calendar, Search,
  CheckCircle2, AlertCircle, RefreshCw, TrendingDown, Plus, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import { contasPagarService } from '../../services/contasPagarService';
// Importe um serviço de fornecedores se quiser popular o select
// import { fornecedorService } from '../../services/fornecedorService';
import './ContasPagar.css'; // Crie ou use o mesmo do Receber

const ContasPagar = () => {
  const [loading, setLoading] = useState(false);
  const [contas, setContas] = useState([]);
  const [resumo, setResumo] = useState({ totalPagar: 0, totalVencido: 0, pagoHoje: 0 });
  const [filtroStatus, setFiltroStatus] = useState('PENDENTE');
  const [busca, setBusca] = useState('');

  // Modal Nova Conta
  const [modalNovaOpen, setModalNovaOpen] = useState(false);
  const [formNova, setFormNova] = useState({ descricao: '', valorOriginal: '', dataVencimento: '', fornecedorId: '' });

  // Modal Pagar
  const [modalPagarOpen, setModalPagarOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [formPagar, setFormPagar] = useState({ valor: '', forma: 'DINHEIRO', juros: 0, desconto: 0 });

  useEffect(() => {
    carregarDados();
  }, [filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [dadosResumo, dadosContas] = await Promise.all([
        contasPagarService.obterResumo(),
        contasPagarService.listar({ status: filtroStatus, termo: busca })
      ]);
      setResumo(dadosResumo);
      setContas(dadosContas);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar contas.");
    } finally {
      setLoading(false);
    }
  };

  const handleNovaConta = async (e) => {
    e.preventDefault();
    try {
      await contasPagarService.criar({
        ...formNova,
        valorOriginal: parseFloat(formNova.valorOriginal),
        fornecedorId: formNova.fornecedorId ? parseInt(formNova.fornecedorId) : null
      });
      toast.success("Conta lançada com sucesso!");
      setModalNovaOpen(false);
      setFormNova({ descricao: '', valorOriginal: '', dataVencimento: '', fornecedorId: '' });
      carregarDados();
    } catch (e) {
      toast.error("Erro ao lançar conta.");
    }
  };

  const abrirModalPagar = (conta) => {
    setContaSelecionada(conta);
    setFormPagar({
      valor: conta.valorRestante,
      forma: 'DINHEIRO', juros: 0, desconto: 0
    });
    setModalPagarOpen(true);
  };

  const handlePagar = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        valorPago: parseFloat(formPagar.valor),
        formaPagamento: formPagar.forma,
        juros: parseFloat(formPagar.juros || 0),
        desconto: parseFloat(formPagar.desconto || 0)
      };
      await contasPagarService.pagar(contaSelecionada.id, payload);
      toast.success("Pagamento realizado (Saída de Caixa)!");
      setModalPagarOpen(false);
      carregarDados();
    } catch (error) {
      toast.error("Erro ao realizar pagamento.");
    }
  };

  const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateStr) => {
    if(!dateStr) return "-";
    if (Array.isArray(dateStr)) return `${dateStr[2]}/${dateStr[1]}/${dateStr[0]}`;
    return new Date(dateStr).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
  };

  return (
    <div className="container-fluid contas-container fade-in">
      <header className="page-header">
        <div>
          <h1>Contas a Pagar</h1>
          <p>Gestão de Despesas e Fornecedores</p>
        </div>
        <div className="header-actions">
            <button className="action-btn-primary" onClick={() => setModalNovaOpen(true)}>
                <Plus size={18}/> Lançar Despesa
            </button>
            <button className="btn-secondary" onClick={carregarDados} disabled={loading}>
                <RefreshCw size={18} className={loading ? 'spin' : ''}/>
            </button>
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="kpi-row">
        <div className="kpi-card-finance warning">
          <div className="kpi-icon red"><TrendingDown /></div>
          <div className="kpi-info"><h3>A Pagar (Total)</h3><p>{formatMoney(resumo.totalPagar)}</p></div>
        </div>
        <div className="kpi-card-finance danger">
          <div className="kpi-icon red"><AlertCircle /></div>
          <div className="kpi-info"><h3>Vencido</h3><p>{formatMoney(resumo.totalVencido)}</p></div>
        </div>
        <div className="kpi-card-finance success">
          <div className="kpi-icon green"><CheckCircle2 /></div>
          <div className="kpi-info"><h3>Pago Hoje</h3><p>{formatMoney(resumo.pagoHoje)}</p></div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon-inside"/>
          <input
            placeholder="Buscar despesa ou fornecedor..."
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
              <th>Descrição / Fornecedor</th>
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
                    <div style={{fontWeight:600}}>{conta.descricao}</div>
                    <div style={{fontSize:'0.75rem', color:'#94a3b8'}}>{conta.fornecedorNome}</div>
                  </td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6, color: conta.status === 'VENCIDA' ? '#ef4444' : 'inherit'}}>
                      <Calendar size={14}/> {formatDate(conta.dataVencimento)}
                    </div>
                  </td>
                  <td style={{fontWeight:700, color: '#ef4444'}}>{formatMoney(conta.valorRestante)}</td>
                  <td><span className={`badge-debt ${conta.status}`}>{conta.status}</span></td>
                  <td style={{display:'flex', justifyContent:'flex-end'}}>
                    {conta.status !== 'PAGA' && (
                      <button className="btn-pay-out" onClick={() => abrirModalPagar(conta)}>
                        <DollarSign size={16}/> Pagar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{textAlign:'center', padding:30, color:'#94a3b8'}}>Nenhuma despesa encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL NOVA CONTA */}
      {modalNovaOpen && (
        <div className="modal-overlay">
            <form className="modal-content" onSubmit={handleNovaConta}>
                <div className="modal-header"><h2>Lançar Despesa</h2><p>Registre contas manuais</p></div>

                <div className="form-group mb-3">
                    <label className="text-muted text-sm">Descrição</label>
                    <input className="ff-input-floating" required value={formNova.descricao} onChange={e => setFormNova({...formNova, descricao: e.target.value})} placeholder="Ex: Conta de Luz"/>
                </div>
                <div className="form-row mb-3">
                    <div className="form-group flex-1">
                        <label className="text-muted text-sm">Valor (R$)</label>
                        <input type="number" step="0.01" required className="ff-input-floating" value={formNova.valorOriginal} onChange={e => setFormNova({...formNova, valorOriginal: e.target.value})}/>
                    </div>
                    <div className="form-group flex-1">
                        <label className="text-muted text-sm">Vencimento</label>
                        <input type="date" required className="ff-input-floating" value={formNova.dataVencimento} onChange={e => setFormNova({...formNova, dataVencimento: e.target.value})}/>
                    </div>
                </div>
                {/* Aqui você pode adicionar um Select de Fornecedores buscando da API */}

                <div className="modal-actions">
                    <button type="button" className="btn-secondary" onClick={() => setModalNovaOpen(false)}>Cancelar</button>
                    <button type="submit" className="action-btn-primary">Salvar</button>
                </div>
            </form>
        </div>
      )}

      {/* MODAL PAGAR (BAIXA) */}
      {modalPagarOpen && contaSelecionada && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handlePagar}>
            <div className="modal-header">
              <h2>Pagar Conta</h2>
              <p>Saída de Caixa: <strong>{contaSelecionada.descricao}</strong></p>
            </div>

            <div className="form-group mb-3">
              <label style={{fontSize:'0.85rem', fontWeight:600, color:'#64748b'}}>Valor a Pagar (R$)</label>
              <input type="number" step="0.01" required className="ff-input-floating" style={{fontSize:'1.5rem', fontWeight:'bold', color:'#ef4444', padding:'10px'}} value={formPagar.valor} onChange={e => setFormPagar({...formPagar, valor: e.target.value})}/>
            </div>

            <div className="form-group mb-3">
               <label style={{fontSize:'0.85rem', fontWeight:600, color:'#64748b'}}>Forma de Pagamento</label>
               <select className="ff-input-floating" value={formPagar.forma} onChange={e => setFormPagar({...formPagar, forma: e.target.value})}>
                 <option value="DINHEIRO">Dinheiro (Caixa)</option>
                 <option value="PIX">Pix (Conta Bancária)</option>
               </select>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setModalPagarOpen(false)}>Cancelar</button>
              <button type="submit" className="action-btn-primary" style={{backgroundColor:'#ef4444'}}>Confirmar Pagamento</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContasPagar;