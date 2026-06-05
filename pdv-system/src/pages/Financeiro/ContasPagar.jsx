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

const formatForInputDate = (dateVal) => {
    if (!dateVal) return '';
    if (Array.isArray(dateVal)) return `${dateVal[0]}-${String(dateVal[1]).padStart(2, '0')}-${String(dateVal[2]).padStart(2, '0')}`;
    return dateVal.split('T')[0];
};

export default function ContasPagar() {
  const [loading, setLoading] = useState(false);
  const [contas, setContas] = useState([]);
  const [resumo, setResumo] = useState({ totalPagar: 0, totalVencido: 0, pagoHoje: 0 });

  const [filtroStatus, setFiltroStatus] = useState('TODAS');
  const [busca, setBusca] = useState('');

  // =========================================================================
  // ESTADOS DOS MODAIS
  // =========================================================================

  const [modalNovaOpen, setModalNovaOpen] = useState(false);
  const [formNova, setFormNova] = useState({
      descricao: '', valorOriginal: '', dataVencimento: '', categoria: '', jaPaga: false, formaPagamento: 'DINHEIRO'
  });

  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [formEditar, setFormEditar] = useState({ id: null, descricao: '', valorOriginal: '', dataVencimento: '', categoria: '', fornecedorId: null });

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

  // Máscara Dinâmica de Dinheiro
  const handleCurrencyChange = (e, formUpdater, field) => {
    let value = e.target.value;
    value = value.replace(/\D/g, ""); // Remove tudo o que não é número
    if (value === "") {
        formUpdater(prev => ({ ...prev, [field]: "" }));
        return;
    }
    // Divide por 100 para criar as casas decimais automáticas
    let formatted = (parseInt(value, 10) / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    formUpdater(prev => ({ ...prev, [field]: formatted }));
  };

  // =========================================================================
  // AÇÕES CRUD: CRIAR, EDITAR E PAGAR
  // =========================================================================

  const handleNovaConta = async (e) => {
    e.preventDefault();
    const valorCorreto = parseMoneyBR(formNova.valorOriginal);
    if (valorCorreto <= 0) return toast.warn("Por favor, informe um valor válido.");
    if (!formNova.categoria) return toast.warn("Por favor, selecione uma categoria para a despesa.");

    const toastId = toast.loading("Registando despesa...");
    try {
      const payload = {
          descricao: formNova.descricao.trim(),
          valorOriginal: valorCorreto,
          dataVencimento: formNova.dataVencimento,
          categoria: formNova.categoria,
          fornecedorId: null
      };

      const response = await api.post('/contas-pagar', payload);

      // 🔥 CORREÇÃO APLICADA AQUI: Envia a data da despesa (dataVencimento) como a data do pagamento!
      if (formNova.jaPaga && response.data && response.data.id) {
          await api.post(`/contas-pagar/${response.data.id}/pagar`, {
              valorPago: valorCorreto,
              formaPagamento: formNova.formaPagamento,
              dataPagamento: formNova.dataVencimento, // Garante que o pagamento fica com a mesma data retroativa
              juros: 0,
              desconto: 0
          });
      }

      toast.update(toastId, {
          render: formNova.jaPaga ? "Despesa registada e paga com sucesso!" : "Despesa lançada com sucesso!",
          type: "success", isLoading: false, autoClose: 3000
      });

      setModalNovaOpen(false);
      setFormNova({ descricao: '', valorOriginal: '', dataVencimento: '', categoria: '', jaPaga: false, formaPagamento: 'DINHEIRO' });
      carregarDados();
    } catch (e) {
      toast.update(toastId, { render: "Erro ao lançar conta.", type: "error", isLoading: false, autoClose: 4000 });
    }
  };

  const abrirModalEditar = (conta) => {
    const valorFormatado = Number(conta.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setFormEditar({
        id: conta.id,
        descricao: conta.descricao,
        valorOriginal: valorFormatado,
        dataVencimento: formatForInputDate(conta.dataVencimento),
        categoria: conta.categoria || '',
        fornecedorId: conta.fornecedorId || null
    });
    setModalEditarOpen(true);
  };

  const handleEditarConta = async (e) => {
    e.preventDefault();
    const valorCorreto = parseMoneyBR(formEditar.valorOriginal);
    if (valorCorreto <= 0) return toast.warn("Por favor, informe um valor válido.");
    if (!formEditar.categoria) return toast.warn("Por favor, selecione uma categoria para a despesa.");

    const toastId = toast.loading("Atualizando despesa...");
    try {
      const payload = {
          descricao: formEditar.descricao.trim(),
          valorOriginal: valorCorreto,
          dataVencimento: formEditar.dataVencimento,
          categoria: formEditar.categoria,
          fornecedorId: formEditar.fornecedorId
      };

      await api.put(`/contas-pagar/${formEditar.id}`, payload);
      toast.update(toastId, { render: "Despesa atualizada com sucesso!", type: "success", isLoading: false, autoClose: 3000 });

      setModalEditarOpen(false);
      carregarDados();
    } catch (e) {
      toast.update(toastId, { render: "Erro ao atualizar conta.", type: "error", isLoading: false, autoClose: 4000 });
    }
  };

  const abrirModalPagar = (conta) => {
    setContaSelecionada(conta);
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
        // Ao clicar manualmente no botão "Pagar" da tabela, não enviamos a data (o backend assume hoje)
        juros: 0, desconto: 0
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
      <header className="cp-header">
        <div className="cp-header-title">
          <div className="cp-icon-box"><Wallet size={28} color="#3b82f6" /></div>
          <div>
            <h1>Contas a Pagar</h1>
            <p>Monitorização de Obrigações, Despesas e Saídas Financeiras</p>
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
                    <div className="cp-td-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span><Building size={12}/> {conta.fornecedorNome || 'Despesa Avulsa'}</span>
                        {conta.categoria && (
                            <span style={{ fontSize: '0.65rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                {conta.categoria.replace(/_/g, ' ')}
                            </span>
                        )}
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
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      {conta.status !== 'PAGO' && (
                        <button
                          type="button"
                          className="cp-btn-pay"
                          style={{ backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '6px 10px' }}
                          onClick={() => abrirModalEditar(conta)}
                          title="Editar Despesa"
                        >
                          <Edit3 size={16}/>
                        </button>
                      )}
                      {conta.status !== 'PAGO' && (
                        <button className="cp-btn-pay" onClick={() => abrirModalPagar(conta)}>
                          <DollarSign size={16}/> Pagar <ArrowRight size={14}/>
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

      {/* ========================================================= */}
      {/* MODAL NOVA CONTA COM PLANO DE CONTAS E MÁSCARA */}
      {/* ========================================================= */}
      {modalNovaOpen && (
        <div className="cp-modal-overlay">
            <form className="cp-modal-card scale-in" onSubmit={handleNovaConta}>
                <div className="cp-modal-header">
                    <div><h2>Lançar Despesa Operacional</h2><p>Classifique as contas para análise de rentabilidade</p></div>
                    <button type="button" className="btn-close" onClick={() => setModalNovaOpen(false)}><X size={24}/></button>
                </div>

                <div className="cp-modal-body">
                    <div className="cp-input-group">
                        <label>Descrição da Despesa</label>
                        <input type="text" required value={formNova.descricao} onChange={e => setFormNova({...formNova, descricao: e.target.value})} placeholder="Ex: Conta de Energia - Maio/2026"/>
                    </div>

                    <div className="cp-input-group" style={{ marginTop: '12px' }}>
                        <label>Categoria (Plano de Contas)</label>
                        <select
                            required
                            value={formNova.categoria}
                            onChange={e => setFormNova({...formNova, categoria: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                        >
                            <option value="">Selecione a categoria...</option>
                            <optgroup label="Despesas Administrativas (Fixas)">
                                <option value="ALUGUEL">Aluguel do Imóvel</option>
                                <option value="ENERGIA_AGUA">Água e Energia Elétrica</option>
                                <option value="INTERNET">Internet e Telefonia</option>
                                <option value="HONORARIOS_CONTABEIS">Honorários do Contabilista</option>
                                <option value="SALARIOS_ADMIN">Salários (Fixos) e Encargos</option>
                                <option value="MATERIAL_LIMPEZA">Material de Limpeza / Escritório</option>
                            </optgroup>
                            <optgroup label="Despesas com Vendas (Variáveis)">
                                <option value="COMISSOES">Comissões de Vendedores</option>
                                <option value="PUBLICIDADE">Publicidade (Ads, Panfletos)</option>
                                <option value="EMBALAGENS">Embalagens e Sacos de Papel</option>
                            </optgroup>
                            <optgroup label="Despesas Tributárias e Financeiras">
                                <option value="IMPOSTOS_OPERACIONAIS">Taxas (Alvará, Bombeiros)</option>
                                <option value="TARIFAS_BANCARIAS">Tarifas Bancárias e Juros</option>
                            </optgroup>
                        </select>
                    </div>

                    <div className="cp-input-row" style={{ marginTop: '12px' }}>
                        <div className="cp-input-group">
                            <label>Valor Total (R$)</label>
                            <input
                                type="text"
                                required
                                value={formNova.valorOriginal}
                                onChange={e => handleCurrencyChange(e, setFormNova, 'valorOriginal')}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="cp-input-group">
                            <label>Data de Vencimento/Registro</label>
                            <input type="date" required value={formNova.dataVencimento} onChange={e => setFormNova({...formNova, dataVencimento: e.target.value})}/>
                        </div>
                    </div>

                    {/* 🔥 CORREÇÃO APLICADA: Checkbox reescrito para deixar claro o pagamento retroativo */}
                    <div className="cp-input-group" style={{ marginTop: '16px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <input
                            type="checkbox"
                            id="jaPaga"
                            checked={formNova.jaPaga}
                            onChange={e => setFormNova({...formNova, jaPaga: e.target.checked})}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="jaPaga" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold', color: '#0f172a' }}>
                            Registrar pagamento com a mesma data da despesa
                        </label>
                    </div>

                    {formNova.jaPaga && (
                        <div className="cp-input-group" style={{ marginTop: '12px', animation: 'fadeIn 0.3s' }}>
                            <label>Forma de Pagamento utilizada</label>
                            <select
                                required
                                value={formNova.formaPagamento}
                                onChange={e => setFormNova({...formNova, formaPagamento: e.target.value})}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                            >
                                <option value="DINHEIRO">Dinheiro (Gaveta do Caixa)</option>
                                <option value="PIX">Pix (Conta Bancária da Loja)</option>
                                <option value="CARTAO_DEBITO">Cartão de Débito</option>
                                <option value="TRANSFERENCIA">Transferência Bancária</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="cp-modal-footer">
                    <button type="button" className="cp-btn-cancel" onClick={() => setModalNovaOpen(false)}>Cancelar</button>
                    <button type="submit" className="cp-btn-submit">{formNova.jaPaga ? "Salvar e Confirmar Pagamento" : "Salvar Despesa"}</button>
                </div>
            </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EDITAR CONTA */}
      {/* ========================================================= */}
      {modalEditarOpen && (
        <div className="cp-modal-overlay">
            <form className="cp-modal-card scale-in" onSubmit={handleEditarConta}>
                <div className="cp-modal-header">
                    <div><h2>Editar Despesa</h2><p>Atualize os detalhes da obrigação financeira</p></div>
                    <button type="button" className="btn-close" onClick={() => setModalEditarOpen(false)}><X size={24}/></button>
                </div>

                <div className="cp-modal-body">
                    <div className="cp-input-group">
                        <label>Descrição da Despesa</label>
                        <input type="text" required value={formEditar.descricao} onChange={e => setFormEditar({...formEditar, descricao: e.target.value})} placeholder="Ex: Conta de Energia"/>
                    </div>

                    <div className="cp-input-group" style={{ marginTop: '12px' }}>
                        <label>Categoria (Plano de Contas)</label>
                        <select
                            required
                            value={formEditar.categoria}
                            onChange={e => setFormEditar({...formEditar, categoria: e.target.value})}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                        >
                            <option value="">Selecione a categoria...</option>
                            <optgroup label="Despesas Administrativas (Fixas)">
                                <option value="ALUGUEL">Aluguer do Imóvel</option>
                                <option value="ENERGIA_AGUA">Água e Energia Elétrica</option>
                                <option value="INTERNET">Internet e Telefonia</option>
                                <option value="HONORARIOS_CONTABEIS">Honorários do Contabilista</option>
                                <option value="SALARIOS_ADMIN">Salários (Fixos) e Encargos</option>
                                <option value="MATERIAL_LIMPEZA">Material de Limpeza / Escritório</option>
                            </optgroup>
                            <optgroup label="Despesas com Vendas (Variáveis)">
                                <option value="COMISSOES">Comissões de Vendedores</option>
                                <option value="PUBLICIDADE">Publicidade (Ads, Panfletos)</option>
                                <option value="EMBALAGENS">Embalagens e Sacos de Papel</option>
                            </optgroup>
                            <optgroup label="Despesas Tributárias e Financeiras">
                                <option value="IMPOSTOS_OPERACIONAIS">Taxas (Alvará, Bombeiros)</option>
                                <option value="TARIFAS_BANCARIAS">Tarifas Bancárias e Juros</option>
                            </optgroup>
                        </select>
                    </div>

                    <div className="cp-input-row" style={{ marginTop: '12px' }}>
                        <div className="cp-input-group">
                            <label>Valor Total (R$)</label>
                            <input
                                type="text"
                                required
                                value={formEditar.valorOriginal}
                                onChange={e => handleCurrencyChange(e, setFormEditar, 'valorOriginal')}
                            />
                        </div>
                        <div className="cp-input-group">
                            <label>Data de Vencimento/Registro</label>
                            <input type="date" required value={formEditar.dataVencimento} onChange={e => setFormEditar({...formEditar, dataVencimento: e.target.value})}/>
                        </div>
                    </div>
                </div>

                <div className="cp-modal-footer">
                    <button type="button" className="cp-btn-cancel" onClick={() => setModalEditarOpen(false)}>Cancelar</button>
                    <button type="submit" className="cp-btn-submit">Atualizar Despesa</button>
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
                  <input
                      type="text"
                      required
                      className="input-gigante text-success"
                      value={formPagar.valorPago}
                      onChange={e => handleCurrencyChange(e, setFormPagar, 'valorPago')}
                  />
                </div>

                <div className="cp-input-group" style={{ marginTop: '12px' }}>
                   <label>Origem do Dinheiro (Forma de Pagamento)</label>
                   <select
                      value={formPagar.formaPagamento}
                      onChange={e => setFormPagar({...formPagar, formaPagamento: e.target.value})}
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}
                   >
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