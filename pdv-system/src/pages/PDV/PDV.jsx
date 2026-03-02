import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Plus, Minus, ArrowLeft, X,
  UserCheck, RotateCcw, UserPlus, ArrowRight,
  Clock, Banknote, Smartphone, CreditCard, ShieldCheck, Tag, AlertCircle, Building, ShoppingBag, CheckCircle2, ChevronRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import caixaService from '../../services/caixaService';
import './PDV.css';

const getUserRole = () => {
    const userStr = localStorage.getItem('user');
    try { return userStr ? JSON.parse(userStr).nome.split(' ')[0] : 'Operador'; }
    catch { return 'Operador'; }
};

const PDV = () => {
  const navigate = useNavigate();

  // Refs
  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);
  const inputClienteRef = useRef(null);
  const inputDescontoRef = useRef(null);
  const dropdownRef = useRef(null); // NOVO: Controla a rolagem da busca

  // Estados de Fluxo
  const [painelAtivo, setPainelAtivo] = useState('VENDA');
  const [validandoCaixa, setValidandoCaixa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [regraCancelamentoVenda, setRegraCancelamentoVenda] = useState('SENHA');

  // Estados de Dados
  const [carrinho, setCarrinho] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:carrinho')) || []; } catch { return []; } });
  const [pagamentos, setPagamentos] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [clienteAvulso, setClienteAvulso] = useState({ documento: '', nome: '' });
  const [buscaCliente, setBuscaCliente] = useState('');
  const [descontoTotalRaw, setDescontoTotalRaw] = useState(0);

  // Estados de Busca
  const [busca, setBusca] = useState('');
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);
  const [ultimoPagamentoId, setUltimoPagamentoId] = useState(null);

  // Modais
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showCnpjModal, setShowCnpjModal] = useState(false);

  // Pagamento & Desconto
  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');
  const [descontoInputRaw, setDescontoInputRaw] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('R$');

  // Cálculos Financeiros
  const subtotalItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0), [carrinho]);
  const descontoItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0), [carrinho]);
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);
  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  // Inicialização
  useEffect(() => {
    const init = async () => {
      try {
        const res = await caixaService.getStatus();
        if (!res || res.status === 'FECHADO' || res.aberto === false) {
          toast.warning("O Caixa está Fechado.", { toastId: 'cx-fechado' });
          navigate('/caixa'); return;
        }
        try { const { data } = await api.get('/configuracoes'); if (data?.sistema?.cancelamentoVenda) setRegraCancelamentoVenda(data.sistema.cancelamentoVenda); } catch (e) {}
        setValidandoCaixa(false);
      } catch (error) {
        if (!navigator.onLine) { toast.warning("Modo Offline ativo."); setValidandoCaixa(false); }
        else { toast.error("Erro ao validar o caixa."); navigate('/dashboard'); }
      }
    };
    init();
    const handleOnline = () => setIsOnline(true); const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [navigate]);

  useEffect(() => { localStorage.setItem('@dd:carrinho', JSON.stringify(carrinho)); }, [carrinho]);
  useEffect(() => { const timer = setInterval(() => setHoraAtual(new Date()), 1000); return () => clearInterval(timer); }, []);

  // Foco Automático
  useEffect(() => {
      if (showPasswordModal || showCleanModal || showExitModal || showCnpjModal) return;
      if (painelAtivo === 'VENDA') setTimeout(() => inputBuscaRef.current?.focus(), 50);
      else if (painelAtivo === 'PAGAMENTO') setTimeout(() => inputValorRef.current?.focus(), 50);
      else if (painelAtivo === 'CLIENTE') setTimeout(() => inputClienteRef.current?.focus(), 50);
      else if (painelAtivo === 'DESCONTO') setTimeout(() => inputDescontoRef.current?.focus(), 50);
  }, [painelAtivo, showPasswordModal, showCleanModal, showExitModal, showCnpjModal]);

  // NOVO: Scroll Automático na Busca via Teclado
  useEffect(() => {
      if (selectedIndex >= 0 && dropdownRef.current) {
          const selectedElement = dropdownRef.current.children[selectedIndex];
          if (selectedElement) {
              selectedElement.scrollIntoView({ block: 'nearest' });
          }
      }
  }, [selectedIndex]);

  // Atalhos de Teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
        const isModalOpen = showExitModal || showCleanModal || showPasswordModal || showCnpjModal;
        if (isModalOpen) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            setBusca(''); setSugestoesProdutos([]); setBuscaCliente(''); setDescontoInputRaw('');
            setPainelAtivo('VENDA'); return;
        }

        // CORREÇÃO: F2 força o foco mesmo se já estiver na tela de VENDA
        if (e.key === 'F2') {
            e.preventDefault();
            setPainelAtivo('VENDA');
            setTimeout(() => inputBuscaRef.current?.focus(), 50);
        }
        if (e.key === 'F3') { e.preventDefault(); setPainelAtivo('CLIENTE'); }
        if (e.key === 'F4') { e.preventDefault(); if (carrinho.length > 0) setPainelAtivo('DESCONTO'); else toast.warn("Carrinho vazio"); }
        if (e.key === 'F8') { e.preventDefault(); if (carrinho.length > 0) iniciarPagamento(); else toast.warn("Carrinho vazio"); }
        if (e.key === 'Delete' && painelAtivo === 'VENDA') { e.preventDefault(); handleLimparVenda(); }

        if (painelAtivo === 'PAGAMENTO' && e.target.tagName !== 'INPUT') {
            if (e.key === '1') { e.preventDefault(); setMetodoAtual('PIX'); inputValorRef.current?.focus(); }
            if (e.key === '2') { e.preventDefault(); setMetodoAtual('DINHEIRO'); inputValorRef.current?.focus(); }
            if (e.key === '3') { e.preventDefault(); setMetodoAtual('CREDITO'); inputValorRef.current?.focus(); }
            if (e.key === '4') { e.preventDefault(); setMetodoAtual('DEBITO'); inputValorRef.current?.focus(); }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const cleanNumeric = (v) => v ? v.replace(/\D/g, '') : '';
  const formatCurrencyInput = (v) => v.replace(/\D/g, "");
  const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";

  // Busca Inteligente
  useEffect(() => {
      if (busca.trim().length < 3) { setSugestoesProdutos([]); setSelectedIndex(-1); return; }
      const delay = setTimeout(async () => {
          try {
              const { data } = await api.get(`/produtos?termo=${busca}&size=10`);
              setSugestoesProdutos(data.content ? data.content : data); setSelectedIndex(-1);
          } catch (error) {}
      }, 300);
      return () => clearTimeout(delay);
  }, [busca]);

  const adicionarProdutoPorObjeto = useCallback((prod) => {
      setCarrinho(prev => {
          const index = prev.findIndex(i => i.id === prod.id);
          if (index >= 0) { const nc = [...prev]; nc[index].quantidade += 1; return nc; }
          return [...prev, { ...prod, quantidade: 1, desconto: 0 }];
      });
      setBusca(''); setSugestoesProdutos([]);
      setUltimoItemAdicionadoId(prod.id);
      setTimeout(() => setUltimoItemAdicionadoId(null), 800);
      setTimeout(() => inputBuscaRef.current?.focus(), 100);
  }, []);

  const processarBuscaManual = async () => {
      try {
          const { data } = await api.get(`/produtos/ean/${busca}`);
          if (data && (data.id || data.codigoBarras)) adicionarProdutoPorObjeto(data);
          else toast.error("Produto não encontrado.");
      } catch (e) { toast.error("Produto inexistente."); }
  };

  const handleSearchKeyDown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, sugestoesProdutos.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); }
      else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0 && sugestoesProdutos[selectedIndex]) adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]);
          else if (sugestoesProdutos.length === 1) adicionarProdutoPorObjeto(sugestoesProdutos[0]);
          else if (busca.length > 0) processarBuscaManual();
      }
  };

  const atualizarQtd = (id, d) => setCarrinho(prev => prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + d) } : i));
  const removerItem = async (id) => setCarrinho(prev => prev.filter(i => i.id !== id));

  const limparEstadoVenda = () => {
      setCarrinho([]); setPagamentos([]); setCliente(null); setClienteAvulso({documento:'', nome:''}); setBuscaCliente('');
      setDescontoTotalRaw(0); setPainelAtivo('VENDA'); setBusca(''); setSugestoesProdutos([]);
  };

  const handleLimparVenda = () => {
      if(carrinho.length === 0) return;
      if (regraCancelamentoVenda === 'SENHA') setShowPasswordModal(true); else setShowCleanModal(true);
  };

  const confirmarLimpezaComSenha = async () => {
      if (!senhaAdmin) return toast.warning("Digite a senha.");
      try {
          await api.post('/auth/validar-gerente', { senha: senhaAdmin });
          limparEstadoVenda(); setShowPasswordModal(false); setSenhaAdmin(''); toast.success("Venda cancelada.");
      } catch (e) { toast.error("Senha incorreta!"); }
  };
  const confirmarLimpezaLivre = () => { limparEstadoVenda(); setShowCleanModal(false); };

  const handleIdentificarCliente = async () => {
      const docLimpo = cleanNumeric(buscaCliente);
      if (docLimpo.length === 11) {
          setClienteAvulso({ documento: docLimpo, nome: 'Cliente CPF ' + docLimpo });
          toast.success("CPF vinculado à nota!");
          setPainelAtivo('VENDA');
      } else if (docLimpo.length === 14) {
          setLoading(true);
          try {
              const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${docLimpo}`);
              const data = await res.json();
              setClienteAvulso({ documento: docLimpo, nome: data.razao_social || '', ie: data.cnae_fiscal || '' });
              setPainelAtivo('VENDA'); setShowCnpjModal(true);
          } catch (e) {
              setClienteAvulso({ documento: docLimpo, nome: '' });
              setPainelAtivo('VENDA'); setShowCnpjModal(true);
          } finally { setLoading(false); }
      } else { toast.error("Digite um CPF (11) ou CNPJ (14) válido."); }
  };

  const aplicarDescontoGlobal = () => {
      const valorBase = parseInt(descontoInputRaw || '0', 10) / 100;
      if (valorBase <= 0) return setPainelAtivo('VENDA');
      let valorReal = (tipoDesconto === '%') ? subtotalItens * (valorBase / 100) : valorBase;
      if (tipoDesconto === '%' && valorBase > 100) return toast.error("Máximo é 100%");
      if (tipoDesconto === 'R$' && valorBase > subtotalItens) return toast.error("Maior que o subtotal");
      setDescontoTotalRaw(valorReal); setPainelAtivo('VENDA'); setDescontoInputRaw(''); toast.success("Desconto aplicado!");
  };

  const iniciarPagamento = () => {
      if (totalPagar >= 5000 && !cliente && !clienteAvulso.documento) {
          toast.error("SEFAZ: Vendas acima de R$ 5.000 exigem identificação.", { autoClose: 5000 });
          setPainelAtivo('CLIENTE'); return;
      }
      setPainelAtivo('PAGAMENTO');
      setValorInputRaw(Math.round(saldoDevedor * 100).toString());
  };

  const handleAdicionarPagamento = () => {
      let valor = parseInt(valorInputRaw.replace(/\D/g, '') || '0', 10) / 100;
      if (valor <= 0 && saldoDevedor > 0) valor = saldoDevedor;
      if (valor <= 0) return;

      const idPagamento = Date.now();
      const novosPagamentos = [...pagamentos, { id: idPagamento, tipo: metodoAtual, valor }];
      setPagamentos(novosPagamentos);

      setUltimoPagamentoId(idPagamento);
      toast.info(`R$ ${valor.toFixed(2)} em ${metodoAtual} registrado!`, { autoClose: 1500, position: "top-center" });
      setTimeout(() => setUltimoPagamentoId(null), 1000);

      const novoSaldo = Math.max(0, saldoDevedor - valor);
      if (novoSaldo > 0) {
          setValorInputRaw((Math.round(novoSaldo * 100)).toString());
          setTimeout(() => inputValorRef.current?.focus(), 50);
      } else {
          setValorInputRaw('');
      }
  };

  const finalizarVendaReal = async (pagamentosFinais = pagamentos) => {
      const saldoFinal = totalPagar - pagamentosFinais.reduce((acc, p) => acc + p.valor, 0);
      if (saldoFinal > 0.01) return toast.error(`Falta R$ ${saldoFinal.toFixed(2)}`);
      setLoading(true);

      try {
          const payloadVenda = {
              subtotal: subtotalItens, descontoTotal: descontoItens + descontoTotalRaw,
              totalPago: totalPagar, troco: Math.max(0, parseFloat((pagamentosFinais.reduce((acc, p) => acc + p.valor, 0) - totalPagar).toFixed(2))),
              clienteId: cliente ? cliente.id : null,
              clienteNome: cliente ? cliente.nome : (clienteAvulso.nome || 'Consumidor Final'),
              clienteDocumento: cliente ? cliente.documento : (clienteAvulso.documento || null),
              itens: carrinho.map(item => ({ produtoId: item.id, quantidade: item.quantidade, precoUnitario: item.precoVenda, desconto: item.desconto || 0 })),
              pagamentos: pagamentosFinais.map(p => ({ formaPagamento: p.tipo, valor: p.valor, parcelas: 1 }))
          };
          await api.post('/vendas', payloadVenda);
          toast.success("Venda Finalizada com Sucesso!");
          limparEstadoVenda();
      } catch (error) { toast.error(error.response?.data?.message || "Erro ao registrar a venda."); }
      finally { setLoading(false); }
  };

  const nomeExibicaoCliente = cliente ? cliente.nome : (clienteAvulso.documento ? `${clienteAvulso.nome} (${clienteAvulso.documento})` : 'Consumidor Final');

  if (validandoCaixa) return <div className="pos-loader"><div className="pos-spinner"></div><h2 style={{color:'#ec4899'}}>Iniciando Terminal</h2></div>;

  return (
    <div className="pos-container">

      {/* =========================================================
          LADO ESQUERDO: O CARRINHO
          ========================================================= */}
      <section className="pos-cart-section">

          <header className="pos-header">
              <div className="pos-brand">
                  <div className="brand-badge">DD</div>
                  <div className="brand-text">
                      <h1>DD Cosméticos</h1>
                      <span>{isOnline ? 'Terminal Online' : 'Terminal Offline'} • Operador: {getUserRole()}</span>
                  </div>
              </div>
              <button className="btn-exit" onClick={() => carrinho.length ? setShowExitModal(true) : navigate('/dashboard')}>
                  <ArrowLeft size={20}/> Sair
              </button>
          </header>

          <div className="pos-cart-body">
              {carrinho.length === 0 ? (
                  <div className="cart-empty-state">
                      <ShoppingBag size={80} strokeWidth={1} />
                      <h3>Caixa Livre</h3>
                      <p>Bipe um produto ou digite o código de barras.</p>
                  </div>
              ) : (
                  <div className="cart-list">
                      {carrinho.map((item, index) => (
                          <div key={item.id} className={`cart-item ${ultimoItemAdicionadoId === item.id ? 'flash-item' : ''}`}>
                              <div className="item-index">{String(index + 1).padStart(3, '0')}</div>
                              <div className="item-details">
                                  <strong>{item.descricao}</strong>
                                  <span>{item.codigoBarras || 'SEM GTIN'}</span>
                              </div>
                              <div className="item-price-calc">
                                  <div className="item-unit-price">R$ {item.precoVenda.toFixed(2)}</div>
                                  <div className="item-qty-control">
                                      <button onClick={() => atualizarQtd(item.id, -1)}><Minus size={16}/></button>
                                      <span>{item.quantidade}</span>
                                      <button onClick={() => atualizarQtd(item.id, 1)}><Plus size={16}/></button>
                                  </div>
                              </div>
                              <div className="item-total">
                                  R$ {(item.precoVenda * item.quantidade).toFixed(2)}
                              </div>
                              <button className="item-remove" onClick={() => removerItem(item.id)}><Trash2 size={20}/></button>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <footer className="pos-cart-footer">
              <div className="footer-calc">
                  <div className="calc-row text-muted"><span>Subtotal dos itens</span> <span>R$ {subtotalItens.toFixed(2)}</span></div>
                  <div className="calc-row text-pink"><span>Descontos Aplicados</span> <span>- R$ {descontoTotalRaw.toFixed(2)}</span></div>
                  <div className="calc-row grand-total">
                      <span>TOTAL A PAGAR</span>
                      <span className="total-value">R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
              </div>
          </footer>
      </section>

      {/* =========================================================
          LADO DIREITO: ACTION CENTER
          ========================================================= */}
      <section className="pos-action-section">

          {/* --- TELA 1: VENDA (PADRÃO) --- */}
          {painelAtivo === 'VENDA' && (
              <div className="action-panel panel-venda animate-fade">

                  <div className="search-premium-box">
                      <Search className="sp-icon" size={26}/>
                      <input
                          ref={inputBuscaRef} type="text" className="sp-input"
                          placeholder="Buscar produto (F2)..."
                          value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={handleSearchKeyDown} autoComplete="off"
                      />
                      {busca && <button className="sp-clear" onClick={() => {setBusca(''); inputBuscaRef.current?.focus();}}><X size={22}/></button>}

                      {/* O Dropdown agora possui a REF e rola automaticamente */}
                      {sugestoesProdutos.length > 0 && (
                          <div className="sp-dropdown" ref={dropdownRef}>
                              {sugestoesProdutos.map((prod, idx) => (
                                  <div key={prod.id} className={`spd-row ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => adicionarProdutoPorObjeto(prod)}>
                                      <div className="spd-info">
                                          <strong>{prod.descricao}</strong>
                                          <span>{prod.codigoBarras}</span>
                                      </div>
                                      <div className="spd-price">R$ {prod.precoVenda.toFixed(2)}</div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="customer-soft-card" onClick={() => setPainelAtivo('CLIENTE')}>
                      <div className="csc-icon"><UserCheck size={26}/></div>
                      <div className="csc-info">
                          <label>Identificação na Nota</label>
                          <strong>{nomeExibicaoCliente}</strong>
                      </div>
                      <ChevronRight className="csc-arrow" size={24}/>
                  </div>

                  <div className="quick-actions-grid">
                      <button className="qa-btn" onClick={() => setPainelAtivo('CLIENTE')}>
                          <kbd>F3</kbd> <span>Cliente</span>
                      </button>
                      <button className="qa-btn" onClick={() => { if(carrinho.length) setPainelAtivo('DESCONTO'); else toast.warn("Carrinho vazio"); }}>
                          <kbd>F4</kbd> <span>Desconto</span>
                      </button>
                      <button className="qa-btn btn-cancel-venda" onClick={handleLimparVenda} disabled={!carrinho.length}>
                          <kbd className="kbd-danger">DEL</kbd> <span>Cancelar</span>
                      </button>
                  </div>

                  <button className="btn-checkout-soft" disabled={!carrinho.length} onClick={iniciarPagamento}>
                      <div className="bcs-content">
                          <span className="bcs-label">IR PARA PAGAMENTO</span>
                          <span className="bcs-shortcut">Aperte F8</span>
                      </div>
                      <div className="bcs-icon"><ArrowRight size={36}/></div>
                  </button>
              </div>
          )}

          {/* --- TELA 2: PAGAMENTO (REORGANIZADA HIERARQUICAMENTE) --- */}
          {painelAtivo === 'PAGAMENTO' && (
              <div className="action-panel panel-pagamento animate-slide-left">
                  <header className="panel-header">
                      <button className="btn-voltar" onClick={() => setPainelAtivo('VENDA')}><ArrowLeft size={20}/> VOLTAR (ESC)</button>
                      <h2>Concluir Venda</h2>
                  </header>

                  <div className="payment-methods-grid">
                      {[
                        {id: 'PIX', key: '1', icon: <Smartphone size={20}/>, label: 'Pix'},
                        {id: 'DINHEIRO', key: '2', icon: <Banknote size={20}/>, label: 'Dinheiro'},
                        {id: 'CREDITO', key: '3', icon: <CreditCard size={20}/>, label: 'Crédito'},
                        {id: 'DEBITO', key: '4', icon: <CreditCard size={20}/>, label: 'Débito'}
                      ].map(m => (
                          <button key={m.id} className={`pm-soft-card ${metodoAtual === m.id ? 'active' : ''}`} onClick={() => { setMetodoAtual(m.id); inputValorRef.current?.focus(); }}>
                              <div className="pms-top"><kbd>{m.key}</kbd> {m.icon}</div>
                              <span className="pms-label">{m.label}</span>
                          </button>
                      ))}
                  </div>

                  <div className="payment-input-area">
                      <label>VALOR A INSERIR ({metodoAtual})</label>
                      <div className="pia-wrapper">
                          <span className="currency">R$</span>
                          <input ref={inputValorRef} value={getValorFormatado(valorInputRaw)} onChange={e => setValorInputRaw(formatCurrencyInput(e.target.value))} onKeyDown={e => e.key === 'Enter' && handleAdicionarPagamento()} placeholder="0,00" />
                          <button className="pia-btn" onClick={handleAdicionarPagamento}><CheckCircle2 size={32}/></button>
                      </div>
                  </div>

                  <div className="payment-logs-soft">
                      {pagamentos.map(p => (
                          <div key={p.id} className={`pls-row ${ultimoPagamentoId === p.id ? 'flash-payment' : ''}`}>
                              <span className="pls-type">{p.tipo}</span>
                              <strong className="pls-val">R$ {p.valor.toFixed(2)}</strong>
                              <button onClick={() => setPagamentos(pagamentos.filter(x => x.id !== p.id))}><Trash2 size={18}/></button>
                          </div>
                      ))}
                  </div>

                  <div className="payment-footer-soft">
                      <div className="pfs-row"><span>Falta Receber:</span> <strong className="val-red">R$ {saldoDevedor.toFixed(2)}</strong></div>
                      <div className="pfs-row"><span>Troco do Cliente:</span> <strong className="val-green">R$ {troco.toFixed(2)}</strong></div>
                      <button className="btn-checkout-finish" disabled={saldoDevedor > 0.01 || loading} onClick={() => finalizarVendaReal(pagamentos)}>
                          <div className="bcf-content">
                              <span className="bcf-label">{loading ? 'EMITINDO...' : 'FINALIZAR VENDA'}</span>
                              <span className="bcf-shortcut">ENTER</span>
                          </div>
                      </button>
                  </div>
              </div>
          )}

          {/* --- TELA 3: CLIENTE --- */}
          {painelAtivo === 'CLIENTE' && (
              <div className="action-panel panel-centered animate-slide-left">
                  <header className="panel-header absolute-top"><button className="btn-voltar" onClick={() => setPainelAtivo('VENDA')}><ArrowLeft size={20}/> VOLTAR (ESC)</button></header>
                  <div className="centered-content">
                      <div className="icon-circle mb-4"><Building size={48}/></div>
                      <h2 className="title-main">Identificar Cliente</h2>
                      <p className="subtitle-sec mb-6">Digite o CPF ou CNPJ (obrigatório acima de R$ 5.000)</p>
                      <input ref={inputClienteRef} className="input-giant-soft" placeholder="Apenas números..." value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleIdentificarCliente(); }} />
                      <button className="btn-primary-soft mt-4" onClick={handleIdentificarCliente}>VINCULAR E VOLTAR (ENTER)</button>
                  </div>
              </div>
          )}

          {/* --- TELA 4: DESCONTO --- */}
          {painelAtivo === 'DESCONTO' && (
              <div className="action-panel panel-centered animate-slide-left">
                  <header className="panel-header absolute-top"><button className="btn-voltar" onClick={() => setPainelAtivo('VENDA')}><ArrowLeft size={20}/> VOLTAR (ESC)</button></header>
                  <div className="centered-content">
                      <div className="icon-circle mb-4"><Tag size={48}/></div>
                      <h2 className="title-main">Aplicar Desconto</h2>
                      <div className="toggle-soft mt-4 mb-4">
                          <button className={tipoDesconto === 'R$' ? 'active' : ''} onClick={() => { setTipoDesconto('R$'); inputDescontoRef.current?.focus(); }}>R$ Fixo</button>
                          <button className={tipoDesconto === '%' ? 'active' : ''} onClick={() => { setTipoDesconto('%'); inputDescontoRef.current?.focus(); }}>% Porc.</button>
                      </div>
                      <div className="input-giant-wrapper">
                          <span>{tipoDesconto}</span>
                          <input ref={inputDescontoRef} value={getValorFormatado(descontoInputRaw)} onChange={e => setDescontoInputRaw(formatCurrencyInput(e.target.value))} onKeyDown={e => e.key === 'Enter' && aplicarDescontoGlobal()} placeholder="0,00" />
                      </div>
                      <button className="btn-primary-soft mt-6" onClick={aplicarDescontoGlobal}>APLICAR DESCONTO (ENTER)</button>
                  </div>
              </div>
          )}

      </section>

      {/* MODAIS DE SEGURANÇA */}
      {showCnpjModal && (
          <div className="modal-glass">
              <div className="modal-glass-card">
                  <Building size={40} className="mg-icon mx-auto mb-3"/>
                  <h3 className="text-center text-main font-bold">Dados da Empresa</h3>
                  <div className="mg-form mt-4">
                      <label>CNPJ</label><input className="mg-input disabled mb-3" value={clienteAvulso.documento} disabled />
                      <label>RAZÃO SOCIAL</label><input className="mg-input" value={clienteAvulso.nome} onChange={(e) => setClienteAvulso({...clienteAvulso, nome: e.target.value})} autoFocus/>
                  </div>
                  <div className="mg-actions mt-6">
                      <button className="mg-btn cancel" onClick={() => { setShowCnpjModal(false); setClienteAvulso({documento:'', nome:''}); }}>Cancelar</button>
                      <button className="mg-btn confirm" onClick={() => { setShowCnpjModal(false); setPainelAtivo('VENDA'); }}>Confirmar</button>
                  </div>
              </div>
          </div>
      )}

      {showPasswordModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm">
                  <ShieldCheck size={56} className="mg-icon danger mx-auto mb-3" />
                  <h3 className="text-danger font-bold">Autorização Gerencial</h3>
                  <p className="text-lg text-sec mb-4">Senha para cancelar venda.</p>
                  <input type="password" className="mg-input text-center tracking-widest text-xxl py-3" placeholder="••••" value={senhaAdmin} onChange={e => setSenhaAdmin(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmarLimpezaComSenha()} autoFocus />
                  <div className="mg-actions mt-6 justify-center">
                      <button className="mg-btn cancel" onClick={() => { setShowPasswordModal(false); setSenhaAdmin(''); }}>Voltar</button>
                      <button className="mg-btn danger" disabled={!senhaAdmin} onClick={confirmarLimpezaComSenha}>Autorizar</button>
                  </div>
              </div>
          </div>
      )}

      {showCleanModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm">
                  <AlertCircle size={56} className="mg-icon warning mx-auto mb-3" />
                  <h3 className="text-main font-bold">Cancelar Venda?</h3>
                  <p className="text-lg text-sec mb-4">O carrinho será esvaziado.</p>
                  <div className="mg-actions mt-6 justify-center">
                      <button className="mg-btn cancel" onClick={() => setShowCleanModal(false)}>Não</button>
                      <button className="mg-btn danger" onClick={confirmarLimpezaLivre}>Sim, Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {showExitModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm">
                  <h3 className="text-main font-bold">Sair do Terminal?</h3>
                  <p className="text-lg text-sec mb-4">A venda atual será perdida.</p>
                  <div className="mg-actions mt-6 justify-center">
                      <button className="mg-btn cancel" onClick={() => setShowExitModal(false)}>Ficar</button>
                      <button className="mg-btn confirm" onClick={() => navigate('/dashboard')}>Sair do Caixa</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default PDV;