import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, DollarSign, User, CheckCircle2,
  FileText, Wallet, ArrowLeft, Phone, Clock, Plus, Trash2,
  Receipt, ShoppingBag, History, CalendarCheck, AlertTriangle, X,
  Printer, MessageCircle
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

  // Estados para envio de WhatsApp Avulso
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

      try {
          await api.post(`/financeiro/crediario/receber/${faturaReceber.idFatura}`, payload);
          toast.success("Pagamento registrado com sucesso!");
          setModalReceber(false);
          abrirDashboardCliente(clienteSelecionado);
          carregarDevedores();
      } catch (error) {
          toast.error("Erro ao processar o recebimento.");
      }
  };

  // =========================================================
  // GERAÇÃO DE COMPROVANTE VIA WHATSAPP (COM SUPORTE A AVULSO)
  // =========================================================
  const handleSendWhatsApp = (numeroInformado = null) => {
      const numeroFinal = numeroInformado || clienteSelecionado?.telefone;

      if (!numeroFinal) {
          // Se não tem telefone cadastrado e nem foi informado, abre o input
          setExibirInputZap(true);
          return;
      }

      const numApenas = numeroFinal.replace(/\D/g, '');
      if (numApenas.length < 10) {
          return toast.warning("Digite um número de telefone válido com DDD.");
      }

      const primeiroNome = clienteSelecionado.nome.split(' ')[0];

      let texto = `*COMPROVANTE DE QUITAÇÃO* ✅\n*DD Cosméticos*\n\n`;
      texto += `Olá, ${primeiroNome}!\n`;
      texto += `Aqui está o comprovante da sua compra quitada.\n\n`;
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

      const url = `https://wa.me/55${numApenas}?text=${encodeURIComponent(texto)}`;
      window.open(url, '_blank');

      // Reseta os estados caso o envio tenha sucesso
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
        <div className="fade-in">
            <header className="crm-header">
                <div>
                    <h1 className="crm-title"><Wallet size={28} className="text-primary"/> Gestão de Fiado</h1>
                    <p className="crm-subtitle">Acompanhe as vendas a prazo e o histórico dos seus clientes.</p>
                </div>
                <div className="crm-stats-row">
                    <div className="crm-stat blue">
                        <span>A Receber (Total)</span>
                        <strong>{formatarMoeda(totalGeral)}</strong>
                    </div>
                    <div className="crm-stat red">
                        <span>Em Atraso Crítico</span>
                        <strong>{formatarMoeda(totalEmAtraso)}</strong>
                    </div>
                </div>
            </header>

            <div className="crm-search-box">
                <Search size={22} className="text-muted"/>
                <input
                    type="text"
                    placeholder="Busque pelo Nome ou CPF do cliente..."
                    value={busca} onChange={e => setBusca(e.target.value)}
                />
            </div>

            <div className="crm-client-grid">
                {loading ? (
                    <div className="crm-empty-state col-span-full"><div className="spinner"></div></div>
                ) : devedoresFiltrados.length === 0 ? (
                    <div className="crm-empty-state col-span-full">
                        <CheckCircle2 size={48} color="#10b981"/>
                        <p>Nenhum cliente inadimplente encontrado.</p>
                    </div>
                ) : (
                    devedoresFiltrados.map(cliente => (
                        <div key={cliente.idCliente} className="crm-client-card" onClick={() => abrirDashboardCliente(cliente)}>
                            <div className="client-card-header">
                                <div className="client-avatar">
                                    <User size={24}/>
                                    {cliente.totalAtrasado > 0 && <div className="alert-pulse"></div>}
                                </div>
                                <div className="client-info">
                                    <h3>{cliente.nome}</h3>
                                    <span>{cliente.documento}</span>
                                </div>
                            </div>
                            <div className="client-card-body">
                                <div className="debt-info">
                                    <span className="debt-label">Dívida Ativa</span>
                                    <span className={`debt-value ${cliente.totalAtrasado > 0 ? 'text-danger' : 'text-dark'}`}>
                                        {formatarMoeda(cliente.totalDevido)}
                                    </span>
                                </div>
                                <button className="btn-view-profile">Ver Histórico</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}

      {clienteSelecionado && (
        <div className="client-dashboard fade-in-up">

            <div className="profile-banner">
                <button className="btn-back" onClick={voltarParaLista}>
                    <ArrowLeft size={20}/> Voltar
                </button>
                <div className="profile-content">
                    <div className="profile-avatar-large"><User size={40}/></div>
                    <div className="profile-details">
                        <h2>{clienteSelecionado.nome}</h2>
                        <div className="profile-tags">
                            <span className="tag-cpf"><FileText size={14}/> {clienteSelecionado.documento}</span>
                            {clienteSelecionado.telefone && (
                                <a href={`https://wa.me/55${clienteSelecionado.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="tag-whatsapp">
                                    <Phone size={14}/> {clienteSelecionado.telefone}
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="profile-total-debt">
                        <span>Total Pendente</span>
                        <strong>{formatarMoeda(clienteSelecionado.totalDevido)}</strong>
                    </div>
                </div>
            </div>

            {loadingDetalhes ? (
                 <div className="crm-empty-state"><div className="spinner"></div></div>
            ) : (
                <div className="dashboard-split">

                    <div className="open-debts-section">
                        <h3 className="section-title"><AlertTriangle size={20} className="text-warning"/> Aguardando Pagamento</h3>

                        {faturasEmAberto.length === 0 ? (
                             <div className="crm-empty-state bg-white">
                                <CheckCircle2 size={40} color="#10b981"/>
                                <h3>Cliente em dia!</h3>
                                <p>Não há nenhuma compra pendente de pagamento.</p>
                             </div>
                        ) : (
                            <div className="debts-feed">
                                {faturasEmAberto.map(fatura => (
                                    <div key={fatura.idFatura} className={`premium-invoice-card ${fatura.status === 'ATRASADO' ? 'delayed' : ''}`}>

                                        <div className="invoice-header">
                                            <div className="invoice-title">
                                                <Receipt size={18} className="text-primary"/>
                                                <strong>{fatura.descricao}</strong>
                                            </div>
                                            <div className={`status-pill ${fatura.diasEmAberto > 30 ? 'danger' : 'warning'}`}>
                                                <Clock size={14}/> {fatura.diasEmAberto} dias em aberto
                                            </div>
                                        </div>

                                        <div className="invoice-meta">
                                            Data da Venda: <strong>{new Date(fatura.dataCompra).toLocaleDateString('pt-BR')}</strong>
                                        </div>

                                        <div className="invoice-items">
                                            <div className="items-header"><ShoppingBag size={14}/> Itens da Venda</div>
                                            {fatura.itens && fatura.itens.length > 0 ? (
                                                <ul>
                                                    {fatura.itens.map((item, idx) => (
                                                        <li key={idx}>
                                                            <span className="qtd">{item.quantidade}x</span>
                                                            <span className="nome">{item.descricao}</span>
                                                            <span className="preco">{formatarMoeda(item.precoUnitario * item.quantidade)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="no-items-msg">O detalhamento desta compra não está disponível.</p>
                                            )}
                                        </div>

                                        <div className="invoice-footer">
                                            <div className="invoice-progress">
                                                <div className="progress-labels">
                                                    <span>Pago: {formatarMoeda(fatura.valorTotal - fatura.saldoDevedor)}</span>
                                                    <span>Total: {formatarMoeda(fatura.valorTotal)}</span>
                                                </div>
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{width: `${((fatura.valorTotal - fatura.saldoDevedor) / fatura.valorTotal) * 100}%`}}></div>
                                                </div>
                                            </div>

                                            <div className="invoice-action">
                                                <div className="amount-left">
                                                    <span>Falta Pagar</span>
                                                    <strong>{formatarMoeda(fatura.saldoDevedor)}</strong>
                                                </div>
                                                <button
                                                    className="btn-pay-now"
                                                    onClick={() => {
                                                        setFaturaReceber(fatura);
                                                        setPagamentos([]);
                                                        setValorReceberRaw(Math.round(fatura.saldoDevedor * 100).toString());
                                                        setModalReceber(true);
                                                        setTimeout(() => inputValorRef.current?.focus(), 100);
                                                    }}
                                                >
                                                    <DollarSign size={18}/> Liquidar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="history-timeline-section">
                        <h3 className="section-title"><History size={20} className="text-muted"/> Histórico Quitado</h3>

                        {faturasPagas.length === 0 ? (
                            <div className="crm-empty-state no-border">
                                <p>Nenhum histórico de compras pagas.</p>
                            </div>
                        ) : (
                            <div className="timeline">
                                {faturasPagas.map(fatura => (
                                    <div
                                        key={fatura.idFatura}
                                        className="timeline-item fade-in clickable-timeline"
                                        onClick={() => {
                                            setFaturaHistorico(fatura);
                                            setExibirInputZap(false); // Reseta caso estivesse aberto de outra fatura
                                            setTelefoneAvulso('');
                                            setModalHistorico(true);
                                        }}
                                    >
                                        <div className="timeline-icon"><CalendarCheck size={16}/></div>
                                        <div className="timeline-content">
                                            <strong>{fatura.descricao}</strong>
                                            <span className="timeline-date">Comprado em: {new Date(fatura.dataCompra).toLocaleDateString('pt-BR')}</span>
                                            {fatura.dataPagamento && (
                                                <span className="timeline-date" style={{color: '#10b981', fontWeight: 'bold'}}>Pago em: {new Date(fatura.dataPagamento).toLocaleDateString('pt-BR')}</span>
                                            )}
                                            <div className="timeline-value">{formatarMoeda(fatura.valorTotal)}</div>
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

      {/* MODAL DE PAGAMENTO PREMIUM */}
      {modalReceber && faturaReceber && (
          <div className="payment-modal-overlay" onClick={() => setModalReceber(false)}>
              <div className="payment-modal-card fade-in-up" onClick={e => e.stopPropagation()}>

                  <div className="pm-header">
                      <button className="pm-close" onClick={() => setModalReceber(false)}><X size={24}/></button>
                      <h2 className="pm-title">Pagamento de Fatura</h2>
                      <p className="pm-subtitle">{faturaReceber.descricao}</p>
                  </div>

                  <div className="pm-amount-box">
                      <span className="pm-amount-label">Valor Restante a Pagar</span>
                      <div className="pm-amount-value">{formatarMoeda(saldoFaltaPagar)}</div>
                  </div>

                  <div className="pm-body">
                      <div className="pm-input-group">
                          <select className="pm-select" value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}>
                              <option value="PIX">PIX</option>
                              <option value="DINHEIRO">Dinheiro</option>
                              <option value="CREDITO">Cartão de Crédito</option>
                              <option value="DEBITO">Cartão de Débito</option>
                          </select>

                          <div className="pm-money-input">
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

                          <button className="pm-btn-add" onClick={handleAdicionarPagamento} disabled={saldoFaltaPagar <= 0} title="Adicionar">
                              <Plus size={24}/>
                          </button>
                      </div>

                      {pagamentos.length > 0 && (
                          <div className="pm-receipt fade-in">
                              {pagamentos.map(p => (
                                  <div key={p.id} className="pm-receipt-item">
                                      <div className="pm-ri-info">
                                          <CheckCircle2 size={16} className="text-success"/>
                                          {p.formaPagamento}
                                      </div>
                                      <div className="pm-ri-val">
                                          {formatarMoeda(p.valor)}
                                          <button className="pm-btn-del" onClick={() => handleRemoverPagamento(p.id)}>
                                              <Trash2 size={16}/>
                                          </button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="pm-footer">
                      <button className="pm-btn-cancel" onClick={() => setModalReceber(false)}>Cancelar</button>
                      <button
                          className="pm-btn-confirm"
                          onClick={processarBaixaDeTitulos}
                          disabled={pagamentos.length === 0}
                      >
                          Confirmar Recebimento
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE HISTÓRICO (RECIBO COM DATA DE PAGAMENTO E ZAP AVULSO) */}
      {modalHistorico && faturaHistorico && (
          <div className="payment-modal-overlay print-overlay" onClick={() => setModalHistorico(false)}>
              <div className="payment-modal-card receipt-modal fade-in-up printable-receipt" onClick={e => e.stopPropagation()}>

                  <div className="pm-header" style={{background: '#f8fafc', borderBottom: '1px dashed #cbd5e1'}}>
                      <button className="pm-close no-print" onClick={() => setModalHistorico(false)}><X size={24}/></button>

                      <div className="print-only-logo">
                          <h2>DD Cosméticos</h2>
                          <p>Comprovante de Quitação</p>
                      </div>

                      <div className="d-flex justify-center mb-2 no-print" style={{display: 'flex', justifyContent: 'center'}}>
                          <div style={{background: '#d1fae5', color: '#059669', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center'}}>
                              <CheckCircle2 size={36} strokeWidth={2.5}/>
                          </div>
                      </div>
                      <h2 className="pm-title no-print">Comprovante Quitado</h2>
                      <p className="pm-subtitle no-print">Esta fatura já foi totalmente paga.</p>
                  </div>

                  <div className="pm-body" style={{padding: '24px'}}>

                      <div className="receipt-meta-info" style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px dashed #cbd5e1'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
                              <div>
                                  <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block'}}>Data da Compra</span>
                                  <strong style={{color: '#1e293b', fontSize: '1rem'}}>{new Date(faturaHistorico.dataCompra).toLocaleDateString('pt-BR')}</strong>
                              </div>

                              {faturaHistorico.dataPagamento && (
                                  <div style={{textAlign: 'center'}}>
                                      <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#059669', textTransform: 'uppercase', display: 'block'}}>Data do Pagto</span>
                                      <strong style={{color: '#10b981', fontSize: '1rem'}}>{new Date(faturaHistorico.dataPagamento).toLocaleDateString('pt-BR')}</strong>
                                  </div>
                              )}

                              <div style={{textAlign: 'right'}}>
                                  <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block'}}>Ref. Fatura</span>
                                  <strong style={{color: '#1e293b', fontSize: '1rem'}}>{faturaHistorico.descricao}</strong>
                              </div>
                          </div>

                          <div className="print-customer-box" style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                              <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px'}}>Dados do Cliente</span>
                              <div style={{ color: '#1e293b', fontSize: '0.95rem', lineHeight: '1.4' }}>
                                  <strong>{clienteSelecionado.nome}</strong><br/>
                                  CPF/CNPJ: {clienteSelecionado.documento}
                                  {clienteSelecionado.telefone && <><br/>Telefone: {clienteSelecionado.telefone}</>}
                              </div>
                          </div>
                      </div>

                      <div className="invoice-items" style={{padding: 0, marginBottom: '24px'}}>
                          <div className="items-header" style={{marginBottom: '16px'}}><ShoppingBag size={14}/> Itens Adquiridos</div>
                          {faturaHistorico.itens && faturaHistorico.itens.length > 0 ? (
                              <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px'}}>
                                  {faturaHistorico.itens.map((item, idx) => (
                                      <li key={idx} style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px'}}>
                                          <span style={{fontWeight: '800', color: '#64748b', width: '35px'}}>{item.quantidade}x</span>
                                          <span style={{color: '#334155', flex: 1, paddingRight: '12px'}}>{item.descricao}</span>
                                          <span style={{fontWeight: '700', color: '#1e293b'}}>{formatarMoeda(item.precoUnitario * item.quantidade)}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p style={{color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1'}}>
                                  Detalhamento indisponível para esta compra.
                              </p>
                          )}
                      </div>

                      <div className="print-total-box" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0'}}>
                          <span style={{textTransform: 'uppercase', fontWeight: '800', color: '#065f46', fontSize: '0.9rem'}}>Total Quitado</span>
                          <strong style={{color: '#059669', fontSize: '1.8rem', fontWeight: '900', lineHeight: 1}}>{formatarMoeda(faturaHistorico.valorTotal)}</strong>
                      </div>
                  </div>

                  {/* RODAPÉ DINÂMICO: ZAP AVULSO OU BOTÕES NORMAIS */}
                  <div className="pm-footer no-print" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      {exibirInputZap ? (
                          <div className="fade-in" style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                              <span style={{fontSize: '0.85rem', fontWeight: '700', color: '#475569'}}>Cliente sem telefone. Digite o WhatsApp (com DDD):</span>
                              <div style={{display: 'flex', gap: '8px'}}>
                                  <input
                                      type="text"
                                      placeholder="Ex: 81999999999"
                                      value={telefoneAvulso}
                                      onChange={e => setTelefoneAvulso(e.target.value.replace(/\D/g, ''))}
                                      style={{flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none'}}
                                      autoFocus
                                  />
                                  <button
                                      onClick={() => handleSendWhatsApp(telefoneAvulso)}
                                      style={{padding: '0 20px', borderRadius: '8px', background: '#25D366', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}
                                  >
                                      Enviar
                                  </button>
                                  <button
                                      onClick={() => setExibirInputZap(false)}
                                      style={{padding: '0 16px', borderRadius: '8px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 'bold', cursor: 'pointer'}}
                                  >
                                      <X size={18} />
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div style={{display: 'flex', gap: '12px', width: '100%'}}>
                              <button
                                  className="btn-outline-sec flex-1"
                                  onClick={() => window.print()}
                                  style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}
                              >
                                  <Printer size={18}/> Imprimir
                              </button>
                              <button
                                  className="btn-action-success flex-1"
                                  onClick={() => handleSendWhatsApp()}
                                  style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#25D366', boxShadow: 'none'}}
                              >
                                  <MessageCircle size={18}/> WhatsApp
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