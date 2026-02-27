import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, User, Plus, Minus, PauseCircle, ArrowLeft, X,
  MonitorCheck, UserCheck, Tag, RotateCcw, UserPlus, Barcode, Percent,
  ArrowRight, Clock, DollarSign, Menu, Wifi, WifiOff, CreditCard, Banknote, Smartphone, FileText
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import caixaService from '../../services/caixaService';
import './PDV.css';

const PDV = () => {
  const navigate = useNavigate();

  // --- REFS & ESTADOS ---
  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);
  const inputClienteRef = useRef(null);
  const inputDescontoRef = useRef(null);

  const [validandoCaixa, setValidandoCaixa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [carrinho, setCarrinho] = useState(() => {
      try { return JSON.parse(localStorage.getItem('@dd:carrinho')) || []; } catch { return []; }
  });

  const [vendasPausadas, setVendasPausadas] = useState([]);
  const [busca, setBusca] = useState('');
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Modais e UI States
  const [modalPagamento, setModalPagamento] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [modalDesconto, setModalDesconto] = useState({ open: false, tipo: 'TOTAL', itemId: null });
  const [showClienteInput, setShowClienteInput] = useState(false);

  // Dados Transacionais
  const [descontoInput, setDescontoInput] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('$');
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [pagamentos, setPagamentos] = useState([]);
  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');
  const [descontoTotalRaw, setDescontoTotalRaw] = useState(0);
  const [cliente, setCliente] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [sugestoesClientes, setSugestoesClientes] = useState([]);

  // --- CÁLCULOS ---
  const subtotalItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0), [carrinho]);
  const descontoItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0), [carrinho]);
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);
  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  // --- EFEITOS (Otimizados) ---

  // 1. Verificação de Caixa e Online Status
  useEffect(() => {
    const init = async () => {
      try {
        const res = await caixaService.getStatus();
        if (!res || res.status === 'FECHADO' || res.aberto === false) {
          // CORREÇÃO: Adicionado o toastId para não duplicar a mensagem
          toast.warning("O Caixa está Fechado.", { toastId: 'caixa-fechado-alerta' });
          navigate('/caixa');
          return;
        }
        setValidandoCaixa(false);
        carregarVendasSuspensas();
      } catch (error) {
        if (!navigator.onLine) {
          toast.warning("Modo Offline ativo.", { toastId: 'caixa-offline-alerta' });
          setValidandoCaixa(false);
        } else {
          toast.error("Erro no caixa.");
          navigate('/dashboard');
        }
      }
    };
    init();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [navigate]);

  // 2. Persistência do Carrinho
  useEffect(() => {
    localStorage.setItem('@dd:carrinho', JSON.stringify(carrinho));
  }, [carrinho]);

  // 3. Relógio isolado (Melhora performance ao não recriar no carrinho change)
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);


  // --- HANDLERS ---
  const formatCurrencyInput = (v) => v.replace(/\D/g, "");
  const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";

  // CORREÇÃO: Puxa o nome real em vez de ser estático
  const getUserRole = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      return userObj.nome ? userObj.nome.split(' ')[0] : 'Operador';
    }
    return 'Operador';
  };

  const carregarVendasSuspensas = async () => {};
  const handleBuscaChange = (e) => { setBusca(e.target.value); };
  const handleSearchKeyDown = (e) => { if(e.key === 'Enter') processarBuscaManual() };
  const processarBuscaManual = () => { };
  const adicionarProdutoPorObjeto = (prod) => { };
  const atualizarQtd = (id, d) => setCarrinho(prev => prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + d) } : i));
  const removerItem = (id) => setCarrinho(prev => prev.filter(i => i.id !== id));
  const limparEstadoVenda = () => { setCarrinho([]); setPagamentos([]); setCliente(null); setDescontoTotalRaw(0); setModalPagamento(false); };
  const handleLimparVenda = () => { if(carrinho.length > 0) setShowCleanModal(true); };
  const confirmarLimpeza = () => { limparEstadoVenda(); setShowCleanModal(false); };
  const pausarVenda = () => { toast.info("Funcionalidade de pausar"); };
  const handleVoltar = () => { if(carrinho.length) setShowExitModal(true); else navigate('/dashboard'); };
  const confirmExit = () => navigate('/dashboard');

  const abrirPagamento = () => {
      if (carrinho.length === 0) return toast.warn("Carrinho vazio.");
      setModalPagamento(true);
      const valorCentavos = Math.round(saldoDevedor * 100);
      setValorInputRaw(valorCentavos.toString());
      setTimeout(() => inputValorRef.current?.focus(), 100);
  };

  const handleAdicionarPagamento = () => {
    const rawVal = parseInt(valorInputRaw.replace(/\D/g, '') || '0', 10);
    let valor = rawVal / 100;
    if (valor <= 0 && saldoDevedor > 0) valor = saldoDevedor;
    if (valor <= 0) return;

    setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor }]);
    const novoSaldo = Math.max(0, saldoDevedor - valor);

    if (novoSaldo > 0) {
        setValorInputRaw((Math.round(novoSaldo * 100)).toString());
        setTimeout(() => inputValorRef.current?.focus(), 50);
    } else {
        setValorInputRaw('');
    }
  };

  const finalizarVenda = async () => {
      if (saldoDevedor > 0.01) return toast.error(`Falta R$ ${saldoDevedor.toFixed(2)}`);
      setLoading(true);
      setTimeout(() => {
          setLoading(false);
          toast.success("Venda Finalizada!");
          limparEstadoVenda();
      }, 1000);
  };

  const sugestoesDinheiro = useMemo(() => {
      if (metodoAtual !== 'DINHEIRO' || saldoDevedor <= 0) return [];
      const exato = saldoDevedor;
      const proximaNota5 = Math.ceil(saldoDevedor / 5) * 5;
      const proximaNota10 = Math.ceil(saldoDevedor / 10) * 10;
      const proximaNota50 = Math.ceil(saldoDevedor / 50) * 50;

      const sugestoes = new Set([exato, proximaNota5, proximaNota10, proximaNota50, 20, 50, 100]);
      return Array.from(sugestoes).filter(v => v >= saldoDevedor).sort((a,b) => a-b).slice(0, 4);
  }, [saldoDevedor, metodoAtual]);

  // --- RENDERIZAÇÃO ---
  if (validandoCaixa) return <div className="loading-screen"><div className="spinner"></div><p>Validando Caixa...</p></div>;

  return (
    <div className="pdv-layout">
      {/* ESQUERDA: OPERAÇÃO */}
      <section className="pdv-operation-area">
        <header className="pdv-header">
            <div className="brand">
                <div className="brand-icon">DD</div>
                <div className="brand-info">
                    <h1>PDV <span className="status-badge">{isOnline ? 'ONLINE' : 'OFFLINE'}</span></h1>
                    <span className="operator-name">Operador: {getUserRole()}</span>
                </div>
            </div>

            <div className="search-bar-container">
                <Search className="search-icon" />
                <input
                    ref={inputBuscaRef}
                    type="text"
                    className="search-input"
                    placeholder="EAN, Código ou Nome do Produto (F1)"
                    value={busca}
                    onChange={handleBuscaChange}
                    onKeyDown={handleSearchKeyDown}
                    autoComplete="off"
                />
                {busca && <button onClick={() => setBusca('')} className="clear-search"><X size={16}/></button>}

                {sugestoesProdutos.length > 0 && (
                    <div className="search-dropdown">
                        {sugestoesProdutos.map((prod, idx) => (
                            <div key={prod.id} className={`dropdown-row ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => adicionarProdutoPorObjeto(prod)}>
                                <div className="prod-info">
                                    <span className="prod-name">{prod.descricao}</span>
                                    <span className="prod-sku">{prod.codigoBarras}</span>
                                </div>
                                <span className="prod-price">R$ {prod.precoVenda.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </header>

        <div className="cart-list-container">
            {carrinho.length === 0 ? (
                <div className="empty-cart-state">
                    <MonitorCheck size={64} opacity={0.2} />
                    <h2>Caixa Livre</h2>
                    <p>Bipe um produto ou digite o código para iniciar</p>
                    <div className="shortcuts-hint">
                        <span><strong>F1</strong> Busca</span>
                        <span><strong>F2</strong> Pausar</span>
                        <span><strong>F3</strong> Cliente</span>
                        <span><strong>F5</strong> Pagar</span>
                    </div>
                </div>
            ) : (
                <table className="cart-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th className="text-center">Qtd</th>
                            <th className="text-right">Unitário</th>
                            <th className="text-right">Total</th>
                            <th className="text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {carrinho.map((item, index) => (
                            <tr key={item.id} className={ultimoItemAdicionadoId === item.id ? 'new-item' : ''}>
                                <td>
                                    <div className="cart-item-info">
                                        <span className="item-seq">{index + 1}</span>
                                        <div>
                                            <span className="item-name">{item.descricao}</span>
                                            <small className="item-sku">{item.codigoBarras || 'SEM GTIN'}</small>
                                        </div>
                                        {item.desconto > 0 && <span className="tag-discount">-{item.desconto.toFixed(2)}</span>}
                                    </div>
                                </td>
                                <td className="text-center">
                                    <div className="qty-stepper">
                                        <button onClick={() => atualizarQtd(item.id, -1)}><Minus size={14}/></button>
                                        <span>{item.quantidade}</span>
                                        <button onClick={() => atualizarQtd(item.id, 1)}><Plus size={14}/></button>
                                    </div>
                                </td>
                                <td className="text-right">R$ {item.precoVenda.toFixed(2)}</td>
                                <td className="text-right font-bold">R$ {((item.precoVenda * item.quantidade) - (item.desconto || 0)).toFixed(2)}</td>
                                <td className="text-center">
                                    <button className="btn-icon danger" onClick={() => removerItem(item.id)}><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

        <footer className="pdv-footer">
            <div className="footer-clock">
                <Clock size={16}/> {horaAtual.toLocaleTimeString()}
            </div>
            <div className="footer-actions">
                <button className="btn-secondary" onClick={() => setShowListaEspera(true)}>
                    <PauseCircle size={16}/> Espera ({vendasPausadas.length})
                </button>
                <button className="btn-secondary danger" onClick={handleLimparVenda}>
                    <RotateCcw size={16}/> Cancelar (Del)
                </button>
            </div>
        </footer>
      </section>

      {/* DIREITA: COMANDO */}
      <aside className="pdv-command-area">
        <div className="command-header">
            <button className="btn-back" onClick={handleVoltar}><ArrowLeft/></button>
            <div className="store-status">
                <span className="dot online"></span> Caixa Aberto
            </div>
        </div>

        <div className="customer-panel" onClick={() => { setShowClienteInput(!showClienteInput); setTimeout(() => inputClienteRef.current?.focus(), 100); }}>
            <div className="cp-icon">
                {cliente ? <UserCheck size={24} /> : <UserPlus size={24} />}
            </div>
            <div className="cp-info">
                <label>Cliente (F3)</label>
                <span>{cliente ? cliente.nome : 'Consumidor Final'}</span>
            </div>
            {showClienteInput && (
                <div className="client-dropdown" onClick={(e) => e.stopPropagation()}>
                    <input ref={inputClienteRef} placeholder="Buscar cliente..." onChange={(e) => setBuscaCliente(e.target.value)} />
                </div>
            )}
        </div>

        <div className="financial-summary">
            <div className="summary-row">
                <span>Subtotal</span>
                <span>R$ {subtotalItens.toFixed(2)}</span>
            </div>
            <div className="summary-row discount" onClick={() => setModalDesconto({...modalDesconto, open: true})}>
                <span>Descontos (F4)</span>
                <span>- R$ {(descontoItens + descontoTotalRaw).toFixed(2)}</span>
            </div>
            <div className="total-display">
                <small>TOTAL A PAGAR</small>
                <div className="value">R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
        </div>

        <div className="payment-trigger">
            <button
                className="btn-pay-large"
                disabled={carrinho.length === 0}
                onClick={abrirPagamento}
            >
                <div className="pay-label">
                    <span>FINALIZAR VENDA</span>
                    <small>F5</small>
                </div>
                <div className="pay-icon"><ArrowRight size={32}/></div>
            </button>
        </div>
      </aside>

      {/* MODAL PAGAMENTO */}
      {modalPagamento && (
          <div className="payment-overlay-backdrop">
              <div className="payment-drawer">
                  <header className="drawer-header">
                      <h2>Pagamento</h2>
                      <button className="btn-close" onClick={() => setModalPagamento(false)}><X/></button>
                  </header>

                  <div className="drawer-body">
                      <div className="payment-split">
                          <div className="methods-grid">
                              {[
                                {id: 'PIX', icon: <Smartphone/>, label: 'PIX'},
                                {id: 'DINHEIRO', icon: <Banknote/>, label: 'Dinheiro'},
                                {id: 'CREDITO', icon: <CreditCard/>, label: 'Crédito'},
                                {id: 'DEBITO', icon: <CreditCard/>, label: 'Débito'},
                                {id: 'CREDIARIO', icon: <FileText/>, label: 'Crediário'}
                              ].map(m => (
                                  <button
                                    key={m.id}
                                    className={`method-card ${metodoAtual === m.id ? 'active' : ''}`}
                                    onClick={() => { setMetodoAtual(m.id); inputValorRef.current?.focus(); }}
                                  >
                                      {m.icon}
                                      <span>{m.label}</span>
                                  </button>
                              ))}
                          </div>

                          <div className="value-input-area">
                              <label>Valor a receber em {metodoAtual}</label>
                              <div className="input-money-wrapper">
                                  <span>R$</span>
                                  <input
                                    ref={inputValorRef}
                                    value={getValorFormatado(valorInputRaw)}
                                    onChange={e => setValorInputRaw(formatCurrencyInput(e.target.value))}
                                    onKeyDown={e => e.key === 'Enter' && handleAdicionarPagamento()}
                                    placeholder="0,00"
                                  />
                              </div>

                              {metodoAtual === 'DINHEIRO' && (
                                  <div className="quick-money-chips">
                                      {sugestoesDinheiro.map(val => (
                                          <button key={val} onClick={() => {
                                              setValorInputRaw((val * 100).toString());
                                              inputValorRef.current?.focus();
                                          }}>R$ {val.toFixed(2)}</button>
                                      ))}
                                  </div>
                              )}

                              <button className="btn-add-payment" onClick={handleAdicionarPagamento}>
                                  Confirmar Valor <ArrowRight size={16}/>
                              </button>
                          </div>
                      </div>

                      <div className="payments-log">
                          {pagamentos.map(p => (
                              <div key={p.id} className="payment-log-item">
                                  <span className="p-type">{p.tipo}</span>
                                  <span className="p-value">R$ {p.valor.toFixed(2)}</span>
                                  <button onClick={() => setPagamentos(pagamentos.filter(x => x.id !== p.id))}><Trash2 size={14}/></button>
                              </div>
                          ))}
                          {pagamentos.length === 0 && <span className="empty-log">Nenhum pagamento lançado</span>}
                      </div>
                  </div>

                  <footer className="drawer-footer">
                      <div className="footer-balance">
                          <span>Restante:</span>
                          <span className={saldoDevedor > 0 ? 'debt' : 'ok'}>R$ {saldoDevedor.toFixed(2)}</span>
                      </div>
                      <div className="footer-balance">
                          <span>Troco:</span>
                          <span className="change">R$ {troco.toFixed(2)}</span>
                      </div>
                      <button
                        className="btn-finalize-drawer"
                        disabled={saldoDevedor > 0.01 || loading}
                        onClick={finalizarVenda}
                      >
                          {loading ? <div className="spinner-mini"></div> : 'EMITIR CUPOM (Enter)'}
                      </button>
                  </footer>
              </div>
          </div>
      )}

      {showExitModal && <div className="modal-backdrop"><div className="modal-card"><h3>Sair do PDV?</h3><div className="modal-actions"><button onClick={() => setShowExitModal(false)}>Cancelar</button><button className="primary" onClick={confirmExit}>Confirmar</button></div></div></div>}

      {showCleanModal && <div className="modal-backdrop"><div className="modal-card"><h3>Cancelar Venda Atual?</h3><p>Todos os itens serão removidos.</p><div className="modal-actions"><button onClick={() => setShowCleanModal(false)}>Não, Voltar</button><button className="danger" onClick={confirmarLimpeza}>Sim, Cancelar</button></div></div></div>}
    </div>
  );
};

export default PDV;