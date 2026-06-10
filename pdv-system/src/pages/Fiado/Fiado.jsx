import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, DollarSign, User, CheckCircle2,
  FileText, Wallet, ArrowLeft, Phone, Clock, Plus, Trash2,
  Receipt, ShoppingBag, History, CalendarCheck, AlertTriangle, X,
  Printer, MessageCircle, AlertOctagon, ChevronRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Fiado.css';

const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
const formatCurrencyInput = (v) => String(v).replace(/\D/g, "");
const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "0,00";

const Fiado = () => {
  const [devedores, setDevedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [faturasCliente, setFaturasCliente] = useState([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  const [modalReceber, setModalReceber] = useState(false);
  const [faturaReceber, setFaturaReceber] = useState(null);

  const [modalHistorico, setModalHistorico] = useState(false);
  const [faturaHistorico, setFaturaHistorico] = useState(null);

  const [exibirInputZap, setExibirInputZap] = useState(false);
  const [telefoneAvulso, setTelefoneAvulso] = useState('');

  const [pagamentos, setPagamentos] = useState([]);
  const [valorReceberRaw, setValorReceberRaw] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState('PIX');
  const inputValorRef = useRef(null);

  const carregarDevedores = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/financeiro/crediario/resumo');
      setDevedores(data);
    } catch (error) {
      toast.error("Falha ao carregar a lista de clientes.");
    } finally {
      setLoading(false);
    }
  };

  const abrirDashboardCliente = async (cliente) => {
    setClienteSelecionado(cliente);
    setLoadingDetalhes(true);
    try {
      const { data } = await api.get(`/financeiro/crediario/cliente/${cliente.idCliente}`);
      setFaturasCliente(data);
    } catch (error) {
      toast.error("Falha ao buscar histórico do cliente.");
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const voltarParaLista = () => {
    setClienteSelecionado(null);
    setFaturasCliente([]);
  };

  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const saldoFaltaPagar = faturaReceber ? Math.max(0, faturaReceber.saldoDevedor - totalPago) : 0;

  const handleAdicionarPagamento = () => {
      let valorNum = parseInt(valorReceberRaw.replace(/\D/g, '') || '0', 10) / 100;
      if (valorNum <= 0 && saldoFaltaPagar > 0) valorNum = saldoFaltaPagar;
      if (valorNum <= 0) return;

      if (valorNum > saldoFaltaPagar) {
          return toast.warning(`O valor excede a dívida (R$ ${saldoFaltaPagar.toFixed(2)}).`);
      }

      setPagamentos([...pagamentos, { id: Date.now(), formaPagamento: metodoPagamento, valor: valorNum }]);

      const novoSaldo = Math.max(0, saldoFaltaPagar - valorNum);
      setValorReceberRaw(novoSaldo > 0 ? (Math.round(novoSaldo * 100)).toString() : '');
      inputValorRef.current?.focus();
  };

  const handleRemoverPagamento = (id) => {
      const novos = pagamentos.filter(x => x.id !== id);
      setPagamentos(novos);
      const novoTotal = novos.reduce((acc, p) => acc + p.valor, 0);
      const novoSaldo = Math.max(0, faturaReceber.saldoDevedor - novoTotal);
      setValorReceberRaw(novoSaldo > 0 ? (Math.round(novoSaldo * 100)).toString() : '');
  };

  const processarBaixaDeTitulos = async () => {
      if (pagamentos.length === 0) return toast.warning("Adicione pelo menos um pagamento.");
      const payload = { pagamentos: pagamentos.map(p => ({ valor: p.valor, formaPagamento: p.formaPagamento })) };

      const toastId = toast.loading("A processar liquidação...");
      try {
          await api.post(`/financeiro/crediario/receber/${faturaReceber.idFatura}`, payload);
          toast.update(toastId, { render: "Pagamento registrado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
          setModalReceber(false);
          abrirDashboardCliente(clienteSelecionado);
          carregarDevedores();
      } catch (error) {
          toast.update(toastId, { render: "Erro ao processar o recebimento.", type: "error", isLoading: false, autoClose: 4000 });
      }
  };

  const handleSendWhatsApp = (numeroInformado = null) => {
      const numeroFinal = numeroInformado || clienteSelecionado?.telefone;

      if (!numeroFinal) {
          setExibirInputZap(true);
          return;
      }

      const numApenas = numeroFinal.replace(/\D/g, '');
      if (numApenas.length < 10) return toast.warning("Digite um número de telefone válido com DDD.");

      const primeiroNome = clienteSelecionado.nome.split(' ')[0];

      let texto = `*COMPROVANTE DE QUITAÇÃO* ✅\n*DD Cosméticos*\n\n`;
      texto += `Olá, ${primeiroNome}!\nAqui está o comprovante da sua compra quitada.\n\n`;
      texto += `🧾 *Ref:* ${faturaHistorico.descricao}\n`;
      texto += `📅 *Data da Compra:* ${new Date(faturaHistorico.dataCompra).toLocaleDateString('pt-BR')}\n`;

      if (faturaHistorico.dataPagamento) {
          texto += `✅ *Pago em:* ${new Date(faturaHistorico.dataPagamento).toLocaleDateString('pt-BR')}\n`;
      }

      texto += `💰 *Total Pago:* ${formatarMoeda(faturaHistorico.valorTotal)}\n\n`;

      if (faturaHistorico.itens && faturaHistorico.itens.length > 0) {
          texto += `*Itens Adquiridos:*\n`;
          faturaHistorico.itens.forEach(item => {
              texto += `- ${item.quantidade}x ${item.descricao} (${formatarMoeda(item.precoUnitario)})\n`;
          });
          texto += `\n`;
      }

      texto += `Obrigado pela preferência e confiança! ✨`;

      window.open(`https://wa.me/55${numApenas}?text=${encodeURIComponent(texto)}`, '_blank');
      setExibirInputZap(false);
      setTelefoneAvulso('');
  };

  useEffect(() => { carregarDevedores(); }, []);

  const devedoresFiltrados = devedores.filter(c =>
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.documento.replace(/\D/g, '').includes(busca.replace(/\D/g, ''))
  );

  const faturasEmAberto = faturasCliente.filter(f => f.status !== 'PAGO' && f.status !== 'CANCELADO');
  const faturasPagas = faturasCliente.filter(f => f.status === 'PAGO');

  const totalGeral = useMemo(() => devedores.reduce((acc, c) => acc + c.totalDevido, 0), [devedores]);
  const totalEmAtraso = useMemo(() => devedores.reduce((acc, c) => acc + c.totalAtrasado, 0), [devedores]);

  return (
    <div className="crm-fiado-container">
      {!clienteSelecionado && (
        <div className="fade-in-up">
            <header className="fiado-header">
                <div className="fiado-header-text">
                    <h1 className="fiado-title"><Wallet size={32} className="text-primary"/> Gestão de Fiado</h1>
                    <p className="fiado-subtitle">Painel de controle de vendas a prazo e inadimplência.</p>
                </div>
                <div className="fiado-stats-row">
                    <div className="fiado-stat-card bg-glass-blue">
                        <div className="stat-icon"><DollarSign size={24}/></div>
                        <div className="stat-info">
                            <span>Total a Receber</span>
                            <strong>{formatarMoeda(totalGeral)}</strong>
                        </div>
                    </div>
                    <div className="fiado-stat-card bg-glass-red">
                        <div className="stat-icon"><AlertOctagon size={24}/></div>
                        <div className="stat-info">
                            <span>Atraso Crítico</span>
                            <strong>{formatarMoeda(totalEmAtraso)}</strong>
                        </div>
                    </div>
                </div>
            </header>

            <div className="fiado-search-bar">
                <Search size={20} className="search-icon"/>
                <input
                    type="text"
                    placeholder="Localize um cliente pelo Nome ou CPF/CNPJ..."
                    value={busca} onChange={e => setBusca(e.target.value)}
                />
            </div>

            <div className="fiado-client-grid">
                {loading ? (
                    <div className="fiado-empty-state col-span-full"><div className="spinner-modern"></div></div>
                ) : devedoresFiltrados.length === 0 ? (
                    <div className="fiado-empty-state col-span-full">
                        <div className="empty-icon-wrap"><CheckCircle2 size={48}/></div>
                        <h3>Saúde Financeira Impecável</h3>
                        <p>Nenhum cliente com dívida ativa encontrado nesta pesquisa.</p>
                    </div>
                ) : (
                    devedoresFiltrados.map(cliente => (
                        <div key={cliente.idCliente} className={`fiado-client-card ${cliente.totalAtrasado > 0 ? 'border-danger' : 'border-safe'}`} onClick={() => abrirDashboardCliente(cliente)}>
                            {cliente.totalAtrasado > 0 && <div className="card-badge-danger">Em Atraso</div>}
                            <div className="card-main-content">
                                <div className="card-avatar">
                                    <User size={28}/>
                                </div>
                                <div className="card-user-info">
                                    <h3>{cliente.nome}</h3>
                                    <span>{cliente.documento}</span>
                                </div>
                            </div>
                            <div className="card-footer-info">
                                <div className="debt-block">
                                    <span className="label">Dívida Ativa</span>
                                    <strong className={cliente.totalAtrasado > 0 ? 'text-danger' : 'text-primary'}>
                                        {formatarMoeda(cliente.totalDevido)}
                                    </strong>
                                </div>
                                <div className="btn-arrow-go">
                                    <ChevronRight size={20}/>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {clienteSelecionado && (
        <div className="client-dashboard fade-in-up">
            <div className="dashboard-hero-banner">
                <button className="btn-glass-back" onClick={voltarParaLista}>
                    <ArrowLeft size={18}/> Voltar ao Painel
                </button>
                <div className="hero-content">
                    <div className="hero-avatar"><User size={46}/></div>
                    <div className="hero-details">
                        <h2>{clienteSelecionado.nome}</h2>
                        <div className="hero-tags">
                            <span className="tag-blur"><FileText size={14}/> {clienteSelecionado.documento}</span>
                            {clienteSelecionado.telefone && (
                                <a href={`https://wa.me/55${clienteSelecionado.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="tag-whatsapp-btn">
                                    <Phone size={14}/> WhatsApp
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="hero-debt-total">
                        <span>Saldo Devedor</span>
                        <strong>{formatarMoeda(clienteSelecionado.totalDevido)}</strong>
                    </div>
                </div>
            </div>

            {loadingDetalhes ? (
                 <div className="fiado-empty-state"><div className="spinner-modern"></div></div>
            ) : (
                <div className="dashboard-grid-split">
                    {/* COLUNA ESQUERDA: COBRANÇAS EM ABERTO */}
                    <div className="debts-column">
                        <div className="column-header">
                            <AlertTriangle size={22} className="text-warning"/>
                            <h3>Aguardando Pagamento</h3>
                            <span className="badge-count">{faturasEmAberto.length}</span>
                        </div>

                        {faturasEmAberto.length === 0 ? (
                             <div className="fiado-empty-state no-bg">
                                <div className="empty-icon-wrap success"><CheckCircle2 size={40}/></div>
                                <h4>Cliente em dia!</h4>
                                <p>Não há nenhuma pendência em aberto.</p>
                             </div>
                        ) : (
                            <div className="invoice-list">
                                {faturasEmAberto.map(fatura => (
                                    <div key={fatura.idFatura} className={`modern-invoice-card ${fatura.status === 'ATRASADO' ? 'is-delayed' : ''}`}>
                                        <div className="invoice-top">
                                            <div className="invoice-identity">
                                                <Receipt size={20} className="text-primary"/>
                                                <div>
                                                    <strong>{fatura.descricao}</strong>
                                                    <span>Venda de {new Date(fatura.dataCompra).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                            </div>
                                            <div className={`status-pill ${fatura.diasEmAberto > 30 ? 'critical' : 'warning'}`}>
                                                <Clock size={14}/> {fatura.diasEmAberto} dias
                                            </div>
                                        </div>

                                        <div className="invoice-mid">
                                            <div className="items-resume">
                                                <div className="items-title"><ShoppingBag size={14}/> Resumo da Compra</div>
                                                {fatura.itens && fatura.itens.length > 0 ? (
                                                    <ul>
                                                        {fatura.itens.map((item, idx) => (
                                                            <li key={idx}>
                                                                <span className="q">{item.quantidade}x</span>
                                                                <span className="n">{item.descricao}</span>
                                                                <span className="v">{formatarMoeda(item.precoUnitario * item.quantidade)}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <p className="no-items">Sem detalhamento de itens.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="invoice-bot">
                                            <div className="progress-section">
                                                <div className="p-labels">
                                                    <span className="p-paid">Pago: {formatarMoeda(fatura.valorTotal - fatura.saldoDevedor)}</span>
                                                    <span className="p-total">Total: {formatarMoeda(fatura.valorTotal)}</span>
                                                </div>
                                                <div className="p-bar-bg">
                                                    <div className="p-bar-fill" style={{width: `${((fatura.valorTotal - fatura.saldoDevedor) / fatura.valorTotal) * 100}%`}}></div>
                                                </div>
                                            </div>

                                            <div className="action-section">
                                                <div className="due-amount">
                                                    <span>Falta Pagar</span>
                                                    <strong>{formatarMoeda(fatura.saldoDevedor)}</strong>
                                                </div>
                                                <button
                                                    className="btn-liquidate"
                                                    onClick={() => {
                                                        setFaturaReceber(fatura);
                                                        setPagamentos([]);
                                                        setValorReceberRaw(Math.round(fatura.saldoDevedor * 100).toString());
                                                        setModalReceber(true);
                                                        setTimeout(() => inputValorRef.current?.focus(), 100);
                                                    }}
                                                >
                                                    <DollarSign size={18} strokeWidth={2.5}/> Liquidar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* COLUNA DIREITA: HISTÓRICO */}
                    <div className="history-column">
                        <div className="column-header">
                            <History size={22} className="text-muted"/>
                            <h3>Histórico Quitado</h3>
                        </div>

                        {faturasPagas.length === 0 ? (
                            <div className="fiado-empty-state no-bg">
                                <p>Nenhum histórico de quitação.</p>
                            </div>
                        ) : (
                            <div className="modern-timeline">
                                {faturasPagas.map(fatura => (
                                    <div
                                        key={fatura.idFatura}
                                        className="timeline-node"
                                        onClick={() => {
                                            setFaturaHistorico(fatura);
                                            setExibirInputZap(false);
                                            setTelefoneAvulso('');
                                            setModalHistorico(true);
                                        }}
                                    >
                                        <div className="node-icon"><CalendarCheck size={16}/></div>
                                        <div className="node-content">
                                            <div className="node-head">
                                                <strong>{fatura.descricao}</strong>
                                                <span className="node-val">{formatarMoeda(fatura.valorTotal)}</span>
                                            </div>
                                            <div className="node-dates">
                                                <span>Compra: {new Date(fatura.dataCompra).toLocaleDateString('pt-BR')}</span>
                                                {fatura.dataPagamento && (
                                                    <span className="text-success font-bold">• Pago: {new Date(fatura.dataPagamento).toLocaleDateString('pt-BR')}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* MODAL CHECKOUT PREMIUM */}
      {modalReceber && faturaReceber && (
          <div className="modern-modal-overlay" onClick={() => setModalReceber(false)}>
              <div className="modern-modal-card scale-in" onClick={e => e.stopPropagation()}>
                  <div className="modal-header-clean">
                      <div>
                          <h2>Recebimento de Fatura</h2>
                          <p>{faturaReceber.descricao}</p>
                      </div>
                      <button className="btn-close-clean" onClick={() => setModalReceber(false)}><X size={24}/></button>
                  </div>

                  <div className="modal-amount-display">
                      <span>Saldo Devedor Restante</span>
                      <strong>{formatarMoeda(saldoFaltaPagar)}</strong>
                  </div>

                  <div className="modal-checkout-body">
                      <label className="input-label-modern">Lançar Pagamento</label>
                      <div className="checkout-input-row">
                          <select className="input-select-modern" value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}>
                              <option value="PIX">PIX</option>
                              <option value="DINHEIRO">Dinheiro</option>
                              <option value="CREDITO">C. Crédito</option>
                              <option value="DEBITO">C. Débito</option>
                          </select>
                          <div className="input-money-modern">
                              <span>R$</span>
                              <input
                                  ref={inputValorRef}
                                  type="text"
                                  inputMode="numeric"
                                  value={getValorFormatado(valorReceberRaw)}
                                  onChange={e => setValorReceberRaw(formatCurrencyInput(e.target.value))}
                                  onKeyDown={e => e.key === 'Enter' && handleAdicionarPagamento()}
                              />
                          </div>
                          <button className="btn-add-modern" onClick={handleAdicionarPagamento} disabled={saldoFaltaPagar <= 0} title="Lançar valor">
                              <Plus size={24}/>
                          </button>
                      </div>

                      {pagamentos.length > 0 && (
                          <div className="checkout-receipt-list">
                              {pagamentos.map(p => (
                                  <div key={p.id} className="receipt-row">
                                      <div className="row-info"><CheckCircle2 size={18} className="text-success"/> {p.formaPagamento}</div>
                                      <div className="row-val">
                                          {formatarMoeda(p.valor)}
                                          <button className="btn-row-del" onClick={() => handleRemoverPagamento(p.id)}><Trash2 size={16}/></button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="modal-footer-clean">
                      <button className="btn-cancel-modern" onClick={() => setModalReceber(false)}>Cancelar</button>
                      <button className="btn-confirm-modern" onClick={processarBaixaDeTitulos} disabled={pagamentos.length === 0}>
                          Finalizar Recebimento
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE HISTÓRICO / COMPROVANTE */}
      {modalHistorico && faturaHistorico && (
          <div className="modern-modal-overlay print-overlay" onClick={() => setModalHistorico(false)}>
              <div className="modern-modal-card receipt-card scale-in printable-receipt" onClick={e => e.stopPropagation()}>

                  <div className="receipt-header">
                      <button className="btn-close-clean no-print" onClick={() => setModalHistorico(false)} style={{position:'absolute', right: '20px', top: '20px'}}><X size={24}/></button>

                      <div className="print-only-logo">
                          <h2>DD Cosméticos</h2>
                          <p>Comprovante de Quitação</p>
                      </div>

                      <div className="success-badge-icon no-print"><CheckCircle2 size={40} strokeWidth={2.5}/></div>
                      <h2 className="no-print">Fatura Liquidada</h2>
                      <p className="no-print">O histórico desta compra foi concluído.</p>
                  </div>

                  <div className="receipt-body">
                      <div className="receipt-meta-grid">
                          <div className="meta-item">
                              <span>Data da Compra</span>
                              <strong>{new Date(faturaHistorico.dataCompra).toLocaleDateString('pt-BR')}</strong>
                          </div>
                          {faturaHistorico.dataPagamento && (
                              <div className="meta-item center">
                                  <span className="text-success">Data de Quitação</span>
                                  <strong className="text-success">{new Date(faturaHistorico.dataPagamento).toLocaleDateString('pt-BR')}</strong>
                              </div>
                          )}
                          <div className="meta-item right">
                              <span>Referência</span>
                              <strong>{faturaHistorico.descricao}</strong>
                          </div>
                      </div>

                      <div className="receipt-customer-box">
                          <span>Dados do Cliente</span>
                          <p>
                              <strong>{clienteSelecionado.nome}</strong><br/>
                              Doc: {clienteSelecionado.documento}
                              {clienteSelecionado.telefone && <><br/>Tel: {clienteSelecionado.telefone}</>}
                          </p>
                      </div>

                      <div className="receipt-items-list">
                          <div className="items-list-title"><ShoppingBag size={14}/> Itens Adquiridos</div>
                          {faturaHistorico.itens && faturaHistorico.itens.length > 0 ? (
                              <ul>
                                  {faturaHistorico.itens.map((item, idx) => (
                                      <li key={idx}>
                                          <span className="q">{item.quantidade}x</span>
                                          <span className="d">{item.descricao}</span>
                                          <span className="v">{formatarMoeda(item.precoUnitario * item.quantidade)}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <div className="empty-items-msg">Detalhamento indisponível.</div>
                          )}
                      </div>

                      <div className="receipt-total-highlight">
                          <span>Total Quitado</span>
                          <strong>{formatarMoeda(faturaHistorico.valorTotal)}</strong>
                      </div>
                  </div>

                  {/* ZAP AVULSO / BOTÕES */}
                  <div className="receipt-footer no-print">
                      {exibirInputZap ? (
                          <div className="zap-avulso-box fade-in">
                              <label>Cliente sem telefone. Informe o WhatsApp com DDD:</label>
                              <div className="zap-avulso-row">
                                  <input
                                      type="text"
                                      placeholder="Ex: 81999999999"
                                      value={telefoneAvulso}
                                      onChange={e => setTelefoneAvulso(e.target.value.replace(/\D/g, ''))}
                                      autoFocus
                                  />
                                  <button className="btn-send-zap" onClick={() => handleSendWhatsApp(telefoneAvulso)}>Enviar</button>
                                  <button className="btn-cancel-zap" onClick={() => setExibirInputZap(false)}><X size={18} /></button>
                              </div>
                          </div>
                      ) : (
                          <div className="receipt-action-row">
                              <button className="btn-print-receipt" onClick={() => window.print()}>
                                  <Printer size={18}/> Imprimir
                              </button>
                              <button className="btn-zap-receipt" onClick={() => handleSendWhatsApp()}>
                                  <MessageCircle size={18}/> Enviar WhatsApp
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Fiado;