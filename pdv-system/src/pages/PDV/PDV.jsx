import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trash2, CreditCard, Banknote, User, Plus, Minus,
  PauseCircle, ArrowLeft, X,
  MonitorCheck, UserCheck, AlertTriangle,
  Tag, RotateCcw, UserPlus, Barcode, Percent, ArrowRight, Clock,
  DollarSign, Menu, LogOut, Printer
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import caixaService from '../../services/caixaService';
import './PDV.css';

const PDV = () => {
  const navigate = useNavigate();

  // --- REFS ---
  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);
  const inputClienteRef = useRef(null);
  const inputDescontoRef = useRef(null);
  const dropdownRef = useRef(null);

  // --- ESTADOS ---
  const [carrinho, setCarrinho] = useState(() => {
      try {
          const salvo = localStorage.getItem('@dd:carrinho');
          return salvo ? JSON.parse(salvo) : [];
      } catch { return []; }
  });

  const [vendasPausadas, setVendasPausadas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Modais
  const [modalPagamento, setModalPagamento] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [modalDesconto, setModalDesconto] = useState({ open: false, tipo: 'TOTAL', itemId: null });

  // Desconto e Pagamento
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
  const [showClienteInput, setShowClienteInput] = useState(false);

  // --- CÁLCULOS ---
  const subtotalItens = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  const descontoItens = carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0);
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  // --- EFEITOS GLOBAIS ---
  useEffect(() => {
    localStorage.setItem('@dd:carrinho', JSON.stringify(carrinho));
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    const handleBeforeUnload = (e) => {
      if (carrinho.length > 0) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        clearInterval(timer);
    };
  }, [carrinho]);

  const getUserRole = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.perfil || user.perfilDoUsuario || user.role || 'ROLE_USUARIO';
    } catch (e) { return 'ROLE_USUARIO'; }
  };

  const handleVoltar = () => {
      if (carrinho.length > 0) setShowExitModal(true);
      else confirmExit();
  };

  const confirmExit = useCallback(() => {
      const role = getUserRole();
      navigate(['ROLE_ADMIN', 'ROLE_GERENTE'].includes(role) ? '/dashboard' : '/caixa');
  }, [navigate]);

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    carregarVendasSuspensas();
    verificarCaixa();
  }, []);

  const verificarCaixa = async () => {
    try {
      const res = await caixaService.getStatus();
      if (!res.data || res.data.status === 'FECHADO') {
        toast.warning("Caixa Fechado. É necessário abrir o caixa.", { toastId: 'cx-closed' });
        navigate('/caixa');
      }
    } catch (error) {
        console.error("Erro ao verificar caixa", error);
    }
  };

  const carregarVendasSuspensas = useCallback(async () => {
      try {
          // CORREÇÃO: Removemos o /api/v1 duplicado
          const res = await api.get('/vendas/suspensas');
          setVendasPausadas(res.data || []);
      } catch (e) { console.error(e); }
  }, []);

  const limparEstadoVenda = () => {
      setCarrinho([]); setPagamentos([]); setCliente(null);
      setDescontoTotalRaw(0); setModalPagamento(false);
      setShowExitModal(false); setBusca('');
      localStorage.removeItem('@dd:carrinho');
  };

  // --- AÇÕES ---
  const pausarVenda = async () => {
    if (carrinho.length === 0) return toast.info("Carrinho vazio.");
    try {
        const payload = {
            clienteId: cliente?.id || null,
            descontoTotal: Number(descontoTotalRaw) || 0,
            observacao: "Venda Suspensa",
            formaDePagamento: "DINHEIRO",
            itens: carrinho.map(i => ({
                produtoId: i.id, quantidade: Number(i.quantidade),
                precoUnitario: Number(i.precoVenda), desconto: Number(i.desconto||0)
            })),
            pagamentos: []
        };
        // CORREÇÃO: Removemos o /api/v1 duplicado
        await api.post('/vendas/suspender', payload);
        toast.success("Venda Pausada! ⏸️");
        limparEstadoVenda(); carregarVendasSuspensas();
    } catch (e) { toast.error("Erro ao pausar venda."); }
  };

  const retomVenda = async (vendaSuspensa) => {
      if (carrinho.length > 0) return toast.warn("Finalize a venda atual antes.");
      setLoading(true);
      try {
          // CORREÇÃO: Removemos o /api/v1 duplicado
          await api.delete(`/vendas/${vendaSuspensa.id}`, { data: { motivo: "Retomada PDV" } });
          const itensRecuperados = vendaSuspensa.itens.map(item => ({
              id: item.produtoId, descricao: item.produtoDescricao || item.produtoNome || "Item",
              precoVenda: Number(item.precoUnitario), quantidade: Number(item.quantidade),
              codigoBarras: item.codigoBarras || '', desconto: Number(item.desconto || 0)
          }));
          setCarrinho(itensRecuperados);
          if (vendaSuspensa.clienteNome && vendaSuspensa.clienteNome !== "Consumidor Final") {
              setCliente({ id: vendaSuspensa.clienteId, nome: vendaSuspensa.clienteNome });
          }
          setDescontoTotalRaw(Number(vendaSuspensa.descontoTotal || 0));
          setShowListaEspera(false); carregarVendasSuspensas();
          toast.success("Venda recuperada!"); setTimeout(() => inputBuscaRef.current?.focus(), 100);
      } catch (error) { toast.error("Erro ao recuperar."); } finally { setLoading(false); }
  };

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
    if (valor === 0 && saldoDevedor > 0) valor = saldoDevedor;
    if (valor <= 0) return;
    setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor }]);
    const novoSaldo = Math.max(0, saldoDevedor - valor);
    if (novoSaldo > 0) {
        setValorInputRaw((Math.round(novoSaldo * 100)).toString());
        setTimeout(() => inputValorRef.current?.focus(), 50);
    } else { setValorInputRaw(''); }
  };

  const finalizarVenda = async () => {
      if (saldoDevedor > 0.01) return toast.error(`Falta R$ ${saldoDevedor.toFixed(2)}`);
      setLoading(true);
      try {
          const mapPgto = (t) => ({ 'CREDITO':'CREDITO', 'DEBITO':'DEBITO', 'PIX':'PIX', 'CREDIARIO':'CREDIARIO', 'DINHEIRO':'DINHEIRO' }[t] || 'DINHEIRO');
          const payload = {
              clienteId: cliente?.id || null, descontoTotal: descontoTotalRaw + descontoItens,
              observacao: "PDV", formaDePagamento: pagamentos.length > 0 ? mapPgto(pagamentos[0].tipo) : 'DINHEIRO',
              itens: carrinho.map(i => ({
                  produtoId: i.id, quantidade: i.quantidade,
                  precoUnitario: i.precoVenda, desconto: i.desconto || 0
              })),
              pagamentos: pagamentos.map(p => ({
                  formaPagamento: mapPgto(p.tipo), valor: p.valor, parcelas: 1
              }))
          };
          // CORREÇÃO: Removemos o /api/v1 duplicado
          const res = await api.post('/vendas', payload);

          try { await api.post(`/vendas/${res.data.id}/imprimir`); toast.info("Imprimindo..."); }
          catch(e) { console.warn("Impressora offline"); }

          toast.success("Venda Finalizada!");
          limparEstadoVenda(); setTimeout(() => inputBuscaRef.current?.focus(), 100);
      } catch (e) { toast.error("Erro ao finalizar."); } finally { setLoading(false); }
  };

  const handleLimparVenda = () => { if(carrinho.length > 0) setShowCleanModal(true); };
  const confirmarLimpeza = () => { limparEstadoVenda(); setShowCleanModal(false); inputBuscaRef.current?.focus(); };

  const handleBuscaChange = async (e) => {
    const termo = e.target.value; setBusca(termo); setSelectedIndex(-1);
    if (/^\d{7,14}$/.test(termo)) { setSugestoesProdutos([]); return; }
    if (termo.length > 2) {
        try {
            // CORREÇÃO: Removemos o /api/v1 duplicado
            const res = await api.get(`/produtos`, { params: { termo, size: 6 } });
            setSugestoesProdutos(res.data.content || []);
        } catch (err) {}
    } else setSugestoesProdutos([]);
  };

  const adicionarProdutoPorObjeto = (prod) => {
    const existe = carrinho.find(i => i.id === prod.id);
    if (existe) setCarrinho(prev => prev.map(i => i.id === prod.id ? { ...i, quantidade: i.quantidade + 1 } : i));
    else setCarrinho(prev => [...prev, { ...prod, quantidade: 1, desconto: 0 }]);
    setUltimoItemAdicionadoId(prod.id); setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); inputBuscaRef.current?.focus();
  };

  const processarBuscaManual = async (e) => {
    if (e) e.preventDefault(); if (!busca) return;
    if (sugestoesProdutos.length > 0 && selectedIndex !== -1) return adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]);
    try {
        setLoading(true);
        // CORREÇÃO: Removemos o /api/v1 duplicado
        const res = await api.get(`/produtos`, { params: { termo: busca, size: 1 } });
        if (res.data.content?.[0]) adicionarProdutoPorObjeto(res.data.content[0]);
        else { toast.warning("Produto não encontrado"); setBusca(''); }
    } catch (err) { toast.error("Erro ao buscar."); } finally { setLoading(false); }
  };

  const handleSearchKeyDown = (e) => {
    if (sugestoesProdutos.length > 0) {
      if (e.key === 'ArrowDown') setSelectedIndex(prev => (prev + 1) % sugestoesProdutos.length);
      else if (e.key === 'ArrowUp') setSelectedIndex(prev => (prev - 1 + sugestoesProdutos.length) % sugestoesProdutos.length);
      else if (e.key === 'Enter') { e.preventDefault(); selectedIndex >= 0 ? adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]) : processarBuscaManual(); }
    } else if (e.key === 'Enter') processarBuscaManual(e);
  };

  // UTILS
  const formatCurrencyInput = (v) => v.replace(/\D/g, "");
  const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";
  const getProductColor = (n) => ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6'][(n?.charCodeAt(0)||0)%5];
  const getProductInitials = (n) => (n||"?").substring(0, 2).toUpperCase();
  const atualizarQtd = (id, d) => setCarrinho(prev => prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + d) } : i));
  const removerItem = (id) => setCarrinho(prev => prev.filter(i => i.id !== id));

  const buscarClientes = async (v) => {
      setBuscaCliente(v);
      if(v.length>2) { try{const r=await api.get(`/clientes`,{params:{termo:v}}); setSugestoesClientes(r.data.content||[]);}catch(e){} } else setSugestoesClientes([]);
  };
  const selecionarCliente = (c) => { setCliente(c); setBuscaCliente(''); setSugestoesClientes([]); setShowClienteInput(false); };

  const abrirModalDesconto = (t, id=null) => { setModalDesconto({open:true, tipo:t, itemId:id}); setDescontoInput(''); setTipoDesconto('$'); setTimeout(()=>inputDescontoRef.current?.focus(), 100); };
  const aplicarDesconto = () => {
      const calc = (base) => tipoDesconto === '%' ? (base * parseFloat(descontoInput.replace(',','.')||0))/100 : parseInt(descontoInput.replace(/\D/g,'')||0,10)/100;
      if (modalDesconto.tipo === 'TOTAL') { const v = calc(subtotalItens); if(v>subtotalItens) return toast.error("Inválido"); setDescontoTotalRaw(v); }
      else { setCarrinho(prev => prev.map(i => i.id === modalDesconto.itemId ? { ...i, desconto: calc(i.precoVenda * i.quantidade) } : i)); }
      setModalDesconto({...modalDesconto, open:false}); inputBuscaRef.current?.focus();
  };

  const handleKeyDownGlobal = useCallback((e) => {
    if (modalDesconto.open || modalPagamento || showExitModal || showListaEspera || showCleanModal) {
        if (e.key === 'Escape') { setModalDesconto(p=>({...p, open:false})); setModalPagamento(false); setShowExitModal(false); setShowListaEspera(false); setShowCleanModal(false); }
        return;
    }
    switch(e.key) {
        case 'F1': e.preventDefault(); inputBuscaRef.current?.focus(); break;
        case 'F2': e.preventDefault(); pausarVenda(); break;
        case 'F3': e.preventDefault(); setShowClienteInput(true); setTimeout(()=>inputClienteRef.current?.focus(), 50); break;
        case 'F4': e.preventDefault(); abrirModalDesconto('TOTAL'); break;
        case 'F5': e.preventDefault(); abrirPagamento(); break;
        case 'F6': e.preventDefault(); if(vendasPausadas.length > 0) setShowListaEspera(true); break;
        case 'Delete': if(carrinho.length > 0) handleLimparVenda(); break;
        case 'Escape':
            if(showClienteInput) setShowClienteInput(false);
            else if(busca) setBusca('');
            else handleVoltar();
            break;
    }
  }, [carrinho.length, modalDesconto.open, modalPagamento, showExitModal, showListaEspera, showCleanModal, vendasPausadas.length, busca, showClienteInput]);

  useEffect(() => { window.addEventListener('keydown', handleKeyDownGlobal); return () => window.removeEventListener('keydown', handleKeyDownGlobal); }, [handleKeyDownGlobal]);

  return (
    <div className="pdv-container fade-in">
      <div className="pdv-left">
        <header className="pdv-header-main">
          <button className="btn-action-soft" onClick={handleVoltar} data-tooltip="Menu (Esc)">
            {['ROLE_ADMIN','ROLE_GERENTE'].includes(getUserRole()) ? <Menu size={22} /> : <ArrowLeft size={22} />}
          </button>
          <button className="btn-action-soft" onClick={() => navigate('/caixa')} data-tooltip="Gerir Caixa" style={{marginLeft: 10}}>
            <DollarSign size={22} color="#16a34a" />
          </button>
          <div className="search-wrapper" style={{marginLeft: 16}}>
            <Search size={22} className="text-gray-400 mr-2"/>
            <input ref={inputBuscaRef} type="text" placeholder="Pesquisar produto (F1)..." value={busca} onChange={handleBuscaChange} onKeyDown={handleSearchKeyDown} autoFocus autoComplete="off" />
            {sugestoesProdutos.length > 0 && (
              <div className="pdv-dropdown-products" ref={dropdownRef}>
                {sugestoesProdutos.map((prod, idx) => (
                  <div key={prod.id} className={`dropdown-item ${idx === selectedIndex ? 'active' : ''}`} onClick={() => adicionarProdutoPorObjeto(prod)}>
                    <div className="product-avatar" style={{backgroundColor: getProductColor(prod.descricao)}}>{getProductInitials(prod.descricao)}</div>
                    <div className="dd-content"><span className="dd-name">{prod.descricao}</span><div className="dd-meta"><span className="dd-tag">{prod.codigoBarras}</span></div></div>
                    <div className="dd-price-right"><span className="dd-price">R$ {prod.precoVenda.toFixed(2)}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pdv-clock-display" style={{marginLeft: 'auto', paddingRight: 10, display:'flex', alignItems:'center', gap: 8, color: '#334155'}}>
             <Clock size={20} className="text-gray-400"/>
             <span style={{fontSize: '1.2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums'}}>{horaAtual.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
          </div>
        </header>

        <main className="pdv-cart">
          <table className="cart-table">
            <thead>
              <tr><th style={{width:'40%',paddingLeft:20}}>Produto</th><th style={{width:'15%',textAlign:'center'}}>Qtd</th><th style={{width:'15%',textAlign:'right'}}>Preço</th><th style={{width:'10%',textAlign:'center'}}>Desc.</th><th style={{width:'15%',textAlign:'right'}}>Total</th><th style={{width:'5%'}}></th></tr>
            </thead>
            <tbody>
              {carrinho.map(item => (
                <tr key={item.id} className={`row-item ${ultimoItemAdicionadoId === item.id ? 'flash-highlight' : ''}`}>
                  <td style={{paddingLeft:20}}><div className="prod-name-box"><span className="prod-name">{item.descricao}</span><div className="prod-meta-row"><Barcode size={12}/> <small className="prod-ean">{item.codigoBarras}</small></div></div></td>
                  <td align="center"><div className="qty-control-group"><button className="btn-qty" onClick={() => atualizarQtd(item.id, -1)}><Minus size={12}/></button><span className="qty-display">{item.quantidade}</span><button className="btn-qty" onClick={() => atualizarQtd(item.id, 1)}><Plus size={12}/></button></div></td>
                  <td align="right">R$ {item.precoVenda.toFixed(2)}</td>
                  <td align="center"><button className={`btn-item-desc ${item.desconto > 0 ? 'active' : ''}`} onClick={() => abrirModalDesconto('ITEM', item.id)}>{item.desconto > 0 ? `-${item.desconto.toFixed(2)}` : <Tag size={14}/>}</button></td>
                  <td align="right" style={{fontWeight:'bold', color:'#0f172a'}}>R$ {((item.precoVenda * item.quantidade) - (item.desconto || 0)).toFixed(2)}</td>
                  <td align="center"><button className="btn-trash-item" onClick={() => removerItem(item.id)}><Trash2 size={16}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {carrinho.length === 0 && (
             <div className="empty-state-modern"><MonitorCheck size={48} className="text-gray-300 mb-4"/><h2>Caixa Livre</h2>
                 {vendasPausadas.length > 0 && <div className="paused-list-modern" onClick={() => setShowListaEspera(true)} style={{cursor:'pointer'}}><h4><Clock size={16}/> {vendasPausadas.length} Vendas em Espera (F6)</h4><div className="paused-card">Clique para ver a fila</div></div>}
             </div>
          )}
        </main>
      </div>

      <aside className="pdv-right clean-theme">
         <div style={{display:'flex', gap: 10, marginBottom: 10}}>
             <div className="customer-card-action" style={{flex: 1}} onClick={() => { setShowClienteInput(!showClienteInput); setTimeout(()=>inputClienteRef.current?.focus(), 100); }}>
                 <div style={{display:'flex', gap:8, alignItems:'center'}}>{cliente ? <UserCheck size={18} color="#166534"/> : <UserPlus size={18}/>}<span style={{fontSize:'0.9rem'}}>{cliente ? cliente.nome.substring(0,12) : "Cliente (F3)"}</span></div>
             </div>
             <button className="customer-card-action" style={{flex: 0.4, background: vendasPausadas.length > 0 ? '#fff7ed' : '#f8fafc', borderColor: vendasPausadas.length > 0 ? '#fdba74' : '#e2e8f0', justifyContent:'center', padding: '0 10px'}} onClick={() => setShowListaEspera(true)}>
                 <Clock size={18} color={vendasPausadas.length > 0 ? '#ea580c' : '#94a3b8'}/>
                 {vendasPausadas.length > 0 && <span style={{marginLeft: 5, color:'#c2410c', fontWeight:'bold'}}>{vendasPausadas.length}</span>}
             </button>
         </div>

         {showClienteInput && (
             <div className="client-popover">
                 <input ref={inputClienteRef} autoFocus className="client-input" placeholder="Buscar..." value={buscaCliente} onChange={e=>buscarClientes(e.target.value)} />
                 {sugestoesClientes.map(c=><div key={c.id} className="client-item" onClick={()=>selecionarCliente(c)}>{c.nome}</div>)}
             </div>
         )}

         <div className="action-grid">
             <button className="tactical-btn info" onClick={()=>inputBuscaRef.current?.focus()}><span className="shortcut-corner">F1</span><Search/> Buscar</button>
             <button className="tactical-btn warning" onClick={pausarVenda}><span className="shortcut-corner">F2</span><PauseCircle/> Pausar</button>
             <button className="tactical-btn secondary" onClick={()=>abrirModalDesconto('TOTAL')}><span className="shortcut-corner">F4</span><Percent/> Desc. Total</button>
             <button className="tactical-btn danger" onClick={handleLimparVenda}><span className="shortcut-corner">Del</span><RotateCcw/> Limpar</button>
         </div>

         <div className="summary-panel">
             <div className="summary-line"><span>Subtotal</span><strong>R$ {subtotalItens.toFixed(2)}</strong></div>
             {(descontoTotalRaw + descontoItens) > 0 && <div className="summary-line discount"><span>Descontos</span><strong>- R$ {(descontoTotalRaw + descontoItens).toFixed(2)}</strong></div>}
             <div className="summary-line total"><small>A PAGAR</small><div className="big-price">R$ {totalPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div></div>
         </div>

         <button className="btn-finalize-huge" disabled={carrinho.length===0} onClick={abrirPagamento}><span>Finalizar</span> <span className="key-hint">F5</span></button>
      </aside>

      {/* --- MODAIS --- */}
      {modalPagamento && (
          <div className="payment-overlay" onClick={() => setModalPagamento(false)}>
              <div className="payment-modal modern" onClick={e => e.stopPropagation()}>
                  <div className="pm-methods">
                      <h3 style={{marginBottom: 20, color:'#1e293b'}}>Forma de Pagamento</h3>
                      <div className="pm-grid">{['PIX','DINHEIRO','CREDITO','DEBITO','CREDIARIO'].map(m => (<button key={m} className={`pm-card ${metodoAtual === m ? 'active' : ''}`} onClick={()=>{setMetodoAtual(m); setTimeout(()=>inputValorRef.current?.focus(), 50)}}>{m}</button>))}</div>
                      <div style={{marginTop:'auto'}}>
                          <div className="math-row"><span>Total da Venda</span><strong>R$ {totalPagar.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></div>
                          <div className={`math-row ${saldoDevedor > 0.01 ? 'debt' : 'paid'}`}><span>{saldoDevedor > 0.01 ? 'Falta Pagar' : 'Troco'}</span><strong>R$ {saldoDevedor > 0.01 ? saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : troco.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></div>
                      </div>
                  </div>
                  <div className="pm-inputs">
                      <label style={{fontSize:'0.9rem', fontWeight:600, color:'#64748b', marginBottom:'-10px'}}>Valor do Pagamento:</label>
                      <div className="input-with-icon primary">
                          <span className="currency-prefix">R$</span>
                          <input ref={inputValorRef} autoFocus value={getValorFormatado(valorInputRaw)} onChange={e => setValorInputRaw(formatCurrencyInput(e.target.value))} onKeyDown={e => e.key === 'Enter' && handleAdicionarPagamento()} placeholder="0,00" />
                          <button className="btn-enter-icon" onClick={handleAdicionarPagamento}><ArrowRight size={24} strokeWidth={3} /></button>
                      </div>
                      <div className="pm-log">
                          {pagamentos.length === 0 && <p style={{textAlign:'center', color:'#cbd5e1', marginTop:20}}>Nenhum pagamento lançado.</p>}
                          {pagamentos.map(p => (<div key={p.id} className="log-row"><div style={{display:'flex', flexDirection:'column'}}><span style={{fontWeight:700, color:'#3b82f6', fontSize:'0.8rem'}}>{p.tipo}</span><strong style={{fontSize:'1.1rem'}}>R$ {p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></div><button onClick={()=>setPagamentos(pagamentos.filter(x=>x.id!==p.id))} style={{background:'none', border:'none', cursor:'pointer', padding:5}}><X size={18} color="#ef4444" /></button></div>))}
                      </div>
                      <button className="btn-finish-modal" disabled={saldoDevedor > 0.01 || loading} onClick={finalizarVenda}>{loading ? 'PROCESSANDO...' : 'CONCLUIR VENDA (F5)'}</button>
                  </div>
              </div>
          </div>
      )}
      {modalDesconto.open && (<div className="modal-exit-overlay"><div className="modal-exit-content" style={{width: 350}}><div className="exit-icon-wrapper" style={{background:'#eff6ff', color:'#2563eb'}}><Percent size={48}/></div><h3>Desconto</h3><div className="toggle-discount-type"><button className={tipoDesconto==='$'?'active':''} onClick={()=>setTipoDesconto('$')}>R$</button><button className={tipoDesconto==='%'?'active':''} onClick={()=>setTipoDesconto('%')}>%</button></div><div className="input-with-icon discount"><span style={{fontWeight:800, color:'#64748b'}}>{tipoDesconto}</span><input ref={inputDescontoRef} type="text" value={tipoDesconto==='$'?getValorFormatado(descontoInput):descontoInput} onChange={e=>{const v=e.target.value; if(tipoDesconto==='$')setDescontoInput(formatCurrencyInput(v)); else setDescontoInput(v.replace(/[^0-9.,]/g,''));}} onKeyDown={e=>e.key==='Enter'&&aplicarDesconto()}/></div><div className="modal-exit-actions"><button className="btn-exit-cancel" onClick={()=>setModalDesconto({...modalDesconto, open:false})}>Cancelar</button><button className="btn-exit-confirm" onClick={aplicarDesconto} style={{background:'#10b981'}}>Aplicar</button></div></div></div>)}
      {showCleanModal && (<div className="modal-exit-overlay"><div className="modal-exit-content"><div className="exit-icon-wrapper"><RotateCcw size={48}/></div><h3>Limpar Venda?</h3><p>O carrinho será esvaziado.</p><div className="modal-exit-actions"><button className="btn-exit-cancel" onClick={()=>setShowCleanModal(false)}>Não</button><button className="btn-exit-confirm" onClick={confirmarLimpeza}>Sim, Limpar</button></div></div></div>)}
      {showListaEspera && (<div className="modal-exit-overlay" onClick={()=>setShowListaEspera(false)}><div className="modal-exit-content" style={{width: 500, padding: 20}} onClick={e=>e.stopPropagation()}><h3>Vendas em Espera</h3><div style={{maxHeight: 300, overflowY:'auto', marginTop:10}}>{vendasPausadas.length===0?<p style={{color:'#94a3b8', padding:20}}>Vazia.</p>:vendasPausadas.map(v=><div key={v.id} className="paused-card" style={{display:'flex', justifyContent:'space-between', padding:15, marginBottom:10}} onClick={()=>retomVenda(v)}><div><strong>{v.clienteNome||'Consumidor'}</strong><br/><small>{new Date(v.dataVenda).toLocaleTimeString()}</small></div><div style={{textAlign:'right'}}><strong style={{color:'#059669'}}>R$ {v.valorTotal?.toFixed(2)}</strong><br/><small>{v.itens?.length} itens</small></div></div>)}</div><button className="btn-exit-cancel" style={{marginTop:20}} onClick={()=>setShowListaEspera(false)}>Fechar</button></div></div>)}
      {showExitModal && (<div className="modal-exit-overlay"><div className="modal-exit-content"><div className="exit-icon-wrapper"><AlertTriangle size={48}/></div><h3>Deseja Sair?</h3><p>O que gostaria de fazer?</p><div className="modal-exit-actions" style={{flexDirection:'column', gap:10}}><button className="btn-exit-cancel" onClick={()=>setShowExitModal(false)} style={{width:'100%'}}>Cancelar</button><button className="btn-exit-confirm" onClick={confirmExit} style={{width:'100%', background:'#3b82f6'}}>Ir para {['ROLE_ADMIN','ROLE_GERENTE'].includes(getUserRole())?'Dashboard':'Caixa'}</button></div></div></div>)}
    </div>
  );
};

export default PDV;