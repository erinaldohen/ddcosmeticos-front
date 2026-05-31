import React, { useState, useEffect } from 'react';
import {
  DollarSign, Calendar, Search, FileText,
  CheckCircle2, AlertCircle, RefreshCw, TrendingDown, Plus, X,
  Building, Hash, ShieldCheck, Edit3, ArrowRight, Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './ContasPagar.css';

// =========================================================================
// HELPERS DE FORMATAÇÃO E PARSING BLINDADOS
// =========================================================================
const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseMoneyBR = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Remove pontos de milhar e troca a vírgula decimal por ponto
    const cleanStr = String(val).replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatDate = (dateStr) => {
    if(!dateStr) return "-";
    if (Array.isArray(dateStr)) return `${String(dateStr[2]).padStart(2,'0')}/${String(dateStr[1]).padStart(2,'0')}/${dateStr[0]}`;
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
};

export default function ContasPagar() {
  const [loading, setLoading] = useState(false);
  const [contas, setContas] = useState([]);
  const [resumo, setResumo] = useState({ totalPagar: 0, totalVencido: 0, pagoHoje: 0 });

  const [filtroStatus, setFiltroStatus] = useState('TODAS');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalNovaOpen, setModalNovaOpen] = useState(false);
  const [formNova, setFormNova] = useState({ descricao: '', valorOriginal: '', dataVencimento: '' });

  const [modalPagarOpen, setModalPagarOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [formPagar, setFormPagar] = useState({ valorPago: '', formaPagamento: 'DINHEIRO' });

  useEffect(() => {
    carregarDados();
  }, [filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [resResumo, resContas] = await Promise.all([
          api.get('/contas-pagar/resumo').catch(() => ({ data: { totalPagar: 0, totalVencido: 0, pagoHoje: 0 } })),
          api.get('/contas-pagar', { params: { status: filtroStatus, termo: busca } }).catch(() => ({ data: [] }))
      ]);

      setResumo(resResumo.data || { totalPagar: 0, totalVencido: 0, pagoHoje: 0 });
      setContas(Array.isArray(resContas.data) ? resContas.data : []);
    } catch (error) {
      toast.error("Falha de conexão com o banco de dados financeiro.");
    } finally {
      setLoading(false);
    }
  };

  const handleNovaConta = async (e) => {
    e.preventDefault();
    const valorCorreto = parseMoneyBR(formNova.valorOriginal);
    if (valorCorreto <= 0) return toast.warn("Por favor, informe um valor válido.");

    const toastId = toast.loading("Registando despesa...");
    try {
      const payload = {
          descricao: formNova.descricao.trim(),
          valorOriginal: valorCorreto,
          dataVencimento: formNova.dataVencimento,
          fornecedorId: null
      };

      await api.post('/contas-pagar', payload);
      toast.update(toastId, { render: "Despesa lançada com sucesso!", type: "success", isLoading: false, autoClose: 3000 });

      setModalNovaOpen(false);
      setFormNova({ descricao: '', valorOriginal: '', dataVencimento: '' });
      carregarDados();
    } catch (e) {
      toast.update(toastId, { render: "Erro ao lançar conta.", type: "error", isLoading: false, autoClose: 4000 });
    }
  };

  const abrirModalPagar = (conta) => {
    setContaSelecionada(conta);
    // Para facilitar a digitação, preenchemos o valor já no formato "150,00"
    const valorFormatado = Number(conta.valorRestante || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setFormPagar({ valorPago: valorFormatado, formaPagamento: 'DINHEIRO' });
    setModalPagarOpen(true);
  };

  const handlePagar = async (e) => {
    e.preventDefault();
    const valorCorreto = parseMoneyBR(formPagar.valorPago);
    if (valorCorreto <= 0) return toast.warn("O valor a pagar deve ser maior que zero.");

    const toastId = toast.loading("Processando saída de caixa...");
    try {
      const payload = {
        valorPago: valorCorreto,
        formaPagamento: formPagar.formaPagamento,
        juros: 0, desconto: 0
        // Não enviamos a data do frontend para evitar bugs de fuso horário. O Backend assume LocalDate.now().
      };

      await api.post(`/contas-pagar/${contaSelecionada.id}/pagar`, payload);

      toast.update(toastId, { render: "Pagamento confirmado!", type: "success", isLoading: false, autoClose: 3000 });
      setModalPagarOpen(false);
      carregarDados();
    } catch (error) {
      toast.update(toastId, { render: error.response?.data?.message || "Erro no pagamento.", type: "error", isLoading: false, autoClose: 4000 });
    }
  };

  return (
    <div className="cp-premium-container fade-in">
      {/* HEADER DA PÁGINA */}
      <header className="cp-header">
        <div className="cp-header-title">
          <div className="cp-icon-box"><Wallet size={28} color="#3b82f6" /></div>
          <div>
            <h1>Contas a Pagar</h1>
            <p>Monitorização de Obrigações, Despesas e Caídas Financeiras</p>
          </div>
        </div>
        <div className="cp-header-actions">
            <button className="cp-btn-secondary" onClick={carregarDados} disabled={loading} title="Sincronizar">
                <RefreshCw size={18} className={loading ? 'spin' : ''}/>
            </button>
            <button className="cp-btn-primary" onClick={() => setModalNovaOpen(true)}>
                <Plus size={20}/> <span>Nova Despesa</span>
            </button>
        </div>
      </header>

      {/* CARDS DE KPI (DASHBOARD) */}
      <div className="cp-kpi-grid">
        <div className="cp-kpi-card warning">
          <div className="kpi-icon-wrapper"><TrendingDown size={24} /></div>
          <div className="kpi-content">
              <span>A Pagar (Pendente)</span>
              <h3>{formatMoney(resumo.totalPagar)}</h3>
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
              <span>Pago Hoje</span>
              <h3>{formatMoney(resumo.pagoHoje)}</h3>
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS E FILTROS */}
      <div className="cp-toolbar">
        <div className="cp-search-box">
          <Search size={18} className="search-icon"/>
          <input
            type="text"
            placeholder="Pesquisar por descrição ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregarDados()}
          />
        </div>
        <div className="cp-tabs">
          {['TODAS', 'PENDENTE', 'VENCIDA', 'PARCIAL', 'PAGO'].map(s => (
            <button key={s} className={`cp-tab-btn ${filtroStatus === s ? 'active' : ''}`} onClick={() => setFiltroStatus(s)}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA DE DADOS PREMIUM */}
      <div className="cp-table-card">
        {loading && contas.length === 0 ? (
           <div className="cp-empty-state"><RefreshCw size={40} className="spin text-slate-300" /><h2>Sincronizando...</h2></div>
        ) : contas.length === 0 ? (
           <div className="cp-empty-state"><FileText size={48} className="text-slate-200" /><h2>Nenhuma conta encontrada nesta categoria.</h2></div>
        ) : (
          <table className="cp-table">
            <thead>
              <tr>
                <th>Descrição / Fornecedor</th>
                <th>Vencimento</th>
                <th>Valor a Pagar</th>
                <th>Status</th>
                <th className="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {contas.map(conta => (
                <tr key={conta.id} className="cp-table-row">
                  <td>
                    <div className="cp-td-title">{conta.descricao}</div>
                    <div className="cp-td-subtitle">
                        <Building size={12}/> {conta.fornecedorNome}
                    </div>
                  </td>
                  <td>
                    <div className={`cp-td-date ${conta.status === 'VENCIDA' ? 'text-danger' : ''}`}>
                      <Calendar size={14}/> {formatDate(conta.dataVencimento)}
                    </div>
                  </td>
                  <td>
                    <div className="cp-td-value-stack">
                        <span className="value-restante">{formatMoney(conta.valorRestante)}</span>
                        {conta.valorTotal > conta.valorRestante && (
                            <span className="value-original">Original: {formatMoney(conta.valorTotal)}</span>
                        )}
                    </div>
                  </td>
                  <td>
                    <span className={`cp-badge status-${conta.status || 'PENDENTE'}`}>{conta.status}</span>
                  </td>
                  <td className="text-right">
                    {conta.status !== 'PAGO' && (
                      <button className="cp-btn-pay" onClick={() => abrirModalPagar(conta)}>
                        <DollarSign size={16}/> Pagar <ArrowRight size={14}/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL NOVA CONTA (DESIGN MODERNO FLUTUANTE) */}
      {/* ========================================================= */}
      {modalNovaOpen && (
        <div className="cp-modal-overlay">
            <form className="cp-modal-card scale-in" onSubmit={handleNovaConta}>
                <div className="cp-modal-header">
                    <div><h2>Lançar Despesa</h2><p>Registe contas avulsas (água, luz, internet)</p></div>
                    <button type="button" className="btn-close" onClick={() => setModalNovaOpen(false)}><X size={24}/></button>
                </div>

                <div className="cp-modal-body">
                    <div className="cp-input-group">
                        <label>Descrição da Despesa</label>
                        <input type="text" required value={formNova.descricao} onChange={e => setFormNova({...formNova, descricao: e.target.value})} placeholder="Ex: Conta de Energia - Maio/2026"/>
                    </div>

                    <div className="cp-input-row">
                        <div className="cp-input-group">
                            <label>Valor Total (R$)</label>
                            <input type="text" required value={formNova.valorOriginal} onChange={e => setFormNova({...formNova, valorOriginal: e.target.value})} placeholder="Ex: 150,00"/>
                        </div>
                        <div className="cp-input-group">
                            <label>Data de Vencimento</label>
                            <input type="date" required value={formNova.dataVencimento} onChange={e => setFormNova({...formNova, dataVencimento: e.target.value})}/>
                        </div>
                    </div>
                </div>

                <div className="cp-modal-footer">
                    <button type="button" className="cp-btn-cancel" onClick={() => setModalNovaOpen(false)}>Cancelar</button>
                    <button type="submit" className="cp-btn-submit">Salvar Despesa</button>
                </div>
            </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONFIRMAR PAGAMENTO */}
      {/* ========================================================= */}
      {modalPagarOpen && contaSelecionada && (
        <div className="cp-modal-overlay">
          <form className="cp-modal-card scale-in" onSubmit={handlePagar}>
            <div className="cp-modal-header">
                <div><h2>Confirmar Pagamento</h2><p className="text-truncate">Baixa para: <strong>{contaSelecionada.descricao}</strong></p></div>
                <button type="button" className="btn-close" onClick={() => setModalPagarOpen(false)}><X size={24}/></button>
            </div>

            <div className="cp-modal-body">
                <div className="cp-input-group">
                  <label>Valor Efetivamente Pago (R$)</label>
                  <input type="text" required className="input-gigante text-success" value={formPagar.valorPago} onChange={e => setFormPagar({...formPagar, valorPago: e.target.value})}/>
                </div>

                <div className="cp-input-group">
                   <label>Origem do Dinheiro (Forma de Pagamento)</label>
                   <select value={formPagar.formaPagamento} onChange={e => setFormPagar({...formPagar, formaPagamento: e.target.value})}>
                     <option value="DINHEIRO">Dinheiro (Gaveta do Caixa)</option>
                     <option value="PIX">Pix (Conta Bancária da Loja)</option>
                     <option value="CARTAO_DEBITO">Cartão de Débito</option>
                     <option value="TRANSFERENCIA">Transferência Bancária</option>
                   </select>
                </div>
            </div>

            <div className="cp-modal-footer">
              <button type="button" className="cp-btn-cancel" onClick={() => setModalPagarOpen(false)}>Cancelar</button>
              <button type="submit" className="cp-btn-submit success">Confirmar Saída de Caixa</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}