import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trash2, CreditCard, Banknote,
  User, Plus, Minus, PauseCircle,
  PlayCircle, Smartphone, AlertCircle,
  ArrowRight, ArrowLeft, X,
  Percent, MonitorCheck, History, UserCheck,
  AlertTriangle, LogOut // Ícones novos para o modal de saída
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import caixaService from '../../services/caixaService';
import './PDV.css';

const PDV = () => {
  const navigate = useNavigate();

  // --- ESTADOS ---
  const [carrinho, setCarrinho] = useState([]);
  const [vendasPausadas, setVendasPausadas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);

  // Modais
  const [modalPagamento, setModalPagamento] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false); // NOVO: Controle do Modal de Saída

  // Dados da Venda
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [pagamentos, setPagamentos] = useState([]);
  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');
  const [descontoRaw, setDescontoRaw] = useState('');
  const [cliente, setCliente] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [sugestoesClientes, setSugestoesClientes] = useState([]);

  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);
  const dropdownRef = useRef(null);

  // --- 1. VERIFICAÇÃO DE CAIXA ---
  useEffect(() => {
    let isMounted = true;
    const verificarCaixa = async () => {
      try {
        const res = await caixaService.getStatus();
        if (isMounted && (!res.data || res.data.status === 'FECHADO')) {
          toast.warning("Caixa Fechado.", { toastId: 'caixa-fechado' });
          navigate('/caixa');
        }
      } catch (error) { /* silenciar erro de rede no mount */ }
    };
    verificarCaixa();
    return () => { isMounted = false; };
  }, [navigate]);

  // --- CÁLCULOS ---
  const totalItens = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  const valorDesconto = descontoRaw ? parseInt(descontoRaw, 10) / 100 : 0;
  const totalComDesconto = Math.max(0, totalItens - valorDesconto);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const saldoDevedor = Math.max(0, totalComDesconto - totalPago);
  const troco = Math.max(0, totalPago - totalComDesconto);

  // --- EFEITOS DE FOCO ---
  useEffect(() => {
    const manterFoco = setInterval(() => {
       if (!modalPagamento && !showExitModal && document.activeElement !== inputBuscaRef.current && !buscaCliente && sugestoesProdutos.length === 0) {
           inputBuscaRef.current?.focus();
       }
    }, 2000);
    return () => clearInterval(manterFoco);
  }, [modalPagamento, showExitModal, buscaCliente, sugestoesProdutos]);

  // --- FUNÇÕES AUXILIARES (Hoisteadas para uso no useCallback) ---
  const carregarVendasSuspensas = useCallback(async () => {
      try {
          const res = await api.get('/vendas/suspensas');
          setVendasPausadas(res.data || []);
      } catch (e) {}
  }, []);

  const pausarVenda = useCallback(async () => {
    if (carrinho.length === 0) return toast.info("Carrinho vazio.");
    try {
        await api.post('/vendas/suspender', { itens: carrinho.map(i => ({ idProduto: i.id, quantidade: i.quantidade })), observacao: "Suspensa PDV", descontoTotal: 0 });
        toast.success("Venda pausada!");
        setCarrinho([]);
        carregarVendasSuspensas();
    } catch (e) {
        toast.error("Erro ao pausar.");
    }
  }, [carrinho, carregarVendasSuspensas]);

  const confirmExit = useCallback(() => {
      navigate('/dashboard'); // Sai da página perdendo os dados (ação consciente)
  }, [navigate]);

  // --- ATALHOS DE TECLADO ---
  const handleKeyDownGlobal = useCallback((e) => {
    // Se o modal de saída estiver aberto
    if (showExitModal) {
        if (e.key === 'Escape') setShowExitModal(false);
        if (e.key === 'Enter') confirmExit();
        return;
    }

    if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); }
    if (e.key === 'F2') { e.preventDefault(); pausarVenda(); }
    if (e.key === 'F5') { e.preventDefault(); if(carrinho.length > 0) setModalPagamento(true); }

    if (e.key === 'Escape') {
        if (modalPagamento) setModalPagamento(false);
        else {
            setSugestoesClientes([]);
            setSugestoesProdutos([]);
            setSelectedIndex(-1);
        }
    }
  }, [carrinho, modalPagamento, showExitModal, confirmExit, pausarVenda]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [handleKeyDownGlobal]);

  // --- LÓGICA DE SAÍDA SEGURA ---
  const handleVoltar = () => {
      if (carrinho.length > 0) {
          setShowExitModal(true); // Abre o modal de confirmação
      } else {
          navigate('/dashboard');
      }
  };

  // ... (Lógica de Produtos, Busca, etc.) ...
  const handleSearchKeyDown = (e) => {
    if (sugestoesProdutos.length > 0) {
      if (e.key === 'ArrowDown') setSelectedIndex(prev => (prev + 1) % sugestoesProdutos.length);
      else if (e.key === 'ArrowUp') setSelectedIndex(prev => (prev - 1 + sugestoesProdutos.length) % sugestoesProdutos.length);
      else if (e.key === 'Enter') { e.preventDefault(); selectedIndex >= 0 ? adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]) : processarBuscaManual(); }
    } else if (e.key === 'Enter') processarBuscaManual(e);
  };

  const handleBuscaChange = async (e) => {
    const termo = e.target.value; setBusca(termo); setSelectedIndex(-1);
    if (/^\d{7,14}$/.test(termo) || termo.length <= 2) { setSugestoesProdutos([]); return; }
    try { const res = await api.get(`/produtos`, { params: { termo, size: 6 } }); setSugestoesProdutos(res.data.content || []); } catch (err) {}
  };

  const adicionarProdutoPorObjeto = (prod) => {
    if (prod.precoVenda <= 0) return toast.error("Produto sem preço!");
    const itemExistente = carrinho.find(i => i.id === prod.id);
    setCarrinho(prev => itemExistente ? prev.map(i => i.id === prod.id ? { ...i, quantidade: i.quantidade + 1 } : i) : [...prev, { ...prod, quantidade: 1 }]);
    setUltimoItemAdicionadoId(prod.id); setTimeout(() => setUltimoItemAdicionadoId(null), 800);
    setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); inputBuscaRef.current?.focus();
  };

  const processarBuscaManual = async (e) => {
    if (e) e.preventDefault(); if (!busca) return;
    if (sugestoesProdutos.length > 0 && selectedIndex !== -1) return adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]);
    if (sugestoesProdutos.length === 1) return adicionarProdutoPorObjeto(sugestoesProdutos[0]);
    try { setLoading(true); const res = await api.get(`/produtos`, { params: { termo: busca, size: 1 } });
    if (res.data.content?.[0]) adicionarProdutoPorObjeto(res.data.content[0]); else toast.warning("Produto não encontrado!");
    } catch (err) {} finally { setLoading(false); }
  };

  const atualizarQtd = (id, delta) => setCarrinho(prev => prev.map(i => i.id === id ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i));
  const removerItem = (id) => setCarrinho(prev => prev.filter(i => i.id !== id));

  useEffect(() => { carregarVendasSuspensas(); }, [carregarVendasSuspensas]);

  const retomarVenda = (v) => { if (carrinho.length > 0) return toast.warn("Finalize a atual.");
  setCarrinho(v.itens.map(i => ({ id: i.produtoId||i.id, descricao: i.produtoNome||i.descricao||"Item", precoVenda: i.precoUnitario, quantidade: i.quantidade, codigoBarras: i.codigoBarras||'' })));
  setVendasPausadas(p => p.filter(x => x.id !== v.id)); };

  const buscarClientes = async (v) => { setBuscaCliente(v); if(v.length>2) { try{const r=await api.get(`/clientes`,{params:{termo:v}}); setSugestoesClientes(r.data.content||[]);}catch(e){}} else setSugestoesClientes([]); };
  const selecionarCliente = (c) => { setCliente(c); setBuscaCliente(''); setSugestoesClientes([]); };
  const formatCurrencyInput = (v) => v.replace(/\D/g, "");
  const getValorFormatado = (r) => r ? (parseInt(r,10)/100).toLocaleString('pt-BR',{minimumFractionDigits:2}) : "";
  const handleAdicionarPagamento = () => { const v=parseInt(valorInputRaw||'0',10)/100; if(v<=0) return toast.error("Valor inválido"); setPagamentos([...pagamentos,{id:Date.now(),tipo:metodoAtual,valor:v}]); setValorInputRaw(''); setTimeout(()=>inputValorRef.current?.focus(),50); };

  const mapFormaPagamento = (t) => {
      switch(t) { case 'CREDITO': return 'CARTAO_CREDITO'; case 'DEBITO': return 'CARTAO_DEBITO'; case 'CREDIARIO': return 'CREDIARIO'; case 'PIX': return 'PIX'; default: return 'DINHEIRO'; }
  };

  const finalizarVenda = async () => {
      if (saldoDevedor > 0.01) return toast.error(`Falta R$ ${saldoDevedor.toFixed(2)}`);
      if (loading) return; setLoading(true);
      try {
          // Correção para backend: envia formaDePagamento principal
          const pgPrincipal = pagamentos.length > 0 ? mapFormaPagamento(pagamentos[0].tipo) : 'DINHEIRO';

          await api.post('/vendas', {
              idCliente: cliente?.id,
              descontoTotal: valorDesconto,
              observacao: "PDV",
              formaDePagamento: pgPrincipal, // Campo legado obrigatório
              itens: carrinho.map(i=>({idProduto:i.id, quantidade:i.quantidade})),
              pagamentos: pagamentos.map(p=>({formaPagamento:mapFormaPagamento(p.tipo), valor:p.valor, parcelas:1}))
          });
          toast.success("Venda Finalizada!"); setCarrinho([]); setPagamentos([]); setCliente(null); setDescontoRaw(''); setModalPagamento(false); setTimeout(()=>inputBuscaRef.current?.focus(),100);
      } catch (e) {
          console.error(e);
          toast.error("Erro ao finalizar.");
      } finally { setLoading(false); }
  };

  return (
    <div className="pdv-container fade-in">
      <div className="pdv-left">
        <header className="pdv-header-main">
          {/* Botão Voltar com Segurança */}
          <button
            className="btn-action-soft"
            onClick={handleVoltar}
            data-tooltip="Voltar ao Painel (Esc)"
          >
            <ArrowLeft size={24} />
          </button>

          <form className="search-wrapper" onSubmit={processarBuscaManual}>
            <div className="icon-box-left"><Search size={20} /></div>
            <input
              ref={inputBuscaRef} type="text" placeholder="Digite o nome ou bipe o código (F1)"
              value={busca} onChange={handleBuscaChange} onKeyDown={handleSearchKeyDown} autoFocus autoComplete="off"
            />
            <button type="submit" className="btn-search-go" data-tooltip="Pesquisar"><ArrowRight size={20} strokeWidth={3} /></button>
            {sugestoesProdutos.length > 0 && (
              <div className="pdv-dropdown-products" ref={dropdownRef}>
                {sugestoesProdutos.map((prod, idx) => (
                  <div key={prod.id} className={`dropdown-item ${idx === selectedIndex ? 'active' : ''}`} onClick={() => adicionarProdutoPorObjeto(prod)}>
                    <div className="dd-info"><span className="dd-name">{prod.descricao}</span><small className="dd-meta">{prod.codigoBarras}</small></div>
                    <strong className="dd-price">R$ {prod.precoVenda.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </form>

          <div className="header-actions">
             <button type="button" className="btn-action-soft blue" onClick={pausarVenda} data-tooltip="Pausar Venda (F2)">
               <PauseCircle size={24} />
             </button>
             {vendasPausadas.length > 0 && (
               <div className="paused-vendas-pill pulse-animation" data-tooltip={`${vendasPausadas.length} vendas em espera`}>
                  <AlertCircle size={16} /> {vendasPausadas.length}
               </div>
             )}
          </div>
        </header>

        <main className="pdv-cart">
          <table className="cart-table">
            <thead>
              <tr>
                <th style={{width: '45%', textAlign: 'left'}}>Produto</th>
                <th style={{width: '15%', textAlign: 'right'}}>Preço</th>
                <th style={{width: '15%', textAlign: 'center'}}>Qtd.</th>
                <th style={{width: '15%', textAlign: 'right'}}>Total</th>
                <th style={{width: '10%', textAlign: 'center'}}></th>
              </tr>
            </thead>
            <tbody>
              {carrinho.map(item => (
                <tr key={item.id} className={`row-item ${ultimoItemAdicionadoId === item.id ? 'flash-highlight' : ''}`}>
                  <td style={{width: '45%'}}>
                    <div className="prod-name-box">
                      <span className="prod-name" title={item.descricao}>{item.descricao}</span>
                      <small className="prod-ean">{item.codigoBarras || 'S/GTIN'}</small>
                    </div>
                  </td>
                  <td style={{width: '15%'}} className="text-right font-mono">R$ {item.precoVenda.toFixed(2)}</td>
                  <td style={{width: '15%'}} className="text-center">
                    <div className="qty-control">
                      <button onClick={() => atualizarQtd(item.id, -1)} tabIndex="-1" data-tooltip="Diminuir"><Minus size={14}/></button>
                      <span className="qty-val">{item.quantidade}</span>
                      <button onClick={() => atualizarQtd(item.id, 1)} tabIndex="-1" data-tooltip="Aumentar"><Plus size={14}/></button>
                    </div>
                  </td>
                  <td style={{width: '15%'}} className="text-right font-bold">R$ {(item.precoVenda * item.quantidade).toFixed(2)}</td>
                  <td style={{width: '10%'}} className="text-center">
                    <button className="btn-del" onClick={() => removerItem(item.id)} tabIndex="-1" data-tooltip="Remover Item">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="shortcuts-footer">
              <div className="sc-item f1" data-tooltip="Focar na busca"><div className="kbd-box">F1</div> <span className="sc-label">Buscar</span></div>
              <div className="sc-item f2" data-tooltip="Colocar venda em espera"><div className="kbd-box">F2</div> <span className="sc-label">Pausar</span></div>
              <div className="sc-item f5" data-tooltip="Ir para pagamento"><div className="kbd-box">F5</div> <span className="sc-label">Finalizar</span></div>
          </div>

          {carrinho.length === 0 && (
            <div className="empty-state-modern">
              <div className="hero-icon"><MonitorCheck size={64} strokeWidth={1} /></div>
              <h2>Caixa Aberto</h2>
              <p>Pronto para vender. Bipe um produto ou digite o nome.</p>
              {vendasPausadas.length > 0 && (
                <div className="paused-list-modern">
                   <h4><History size={16}/> Vendas em Espera</h4>
                   {vendasPausadas.map(v => (
                     <div key={v.id || Math.random()} className="paused-card" onClick={() => retomarVenda(v)} data-tooltip="Clique para retomar">
                        <PlayCircle size={18} />
                        <span>R$ {v.valorTotal?.toFixed(2) || '---'} <small>• {new Date(v.dataVenda).toLocaleTimeString().substring(0,5)}</small></span>
                     </div>
                   ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <aside className="pdv-right clean-theme">
        <div className="summary-wrapper">
            <div className="summary-row">
                <span className="label">Qtd. Itens</span>
                <span className="value">{carrinho.reduce((a, b) => a + b.quantidade, 0)}</span>
            </div>

            <div className="summary-total-clean">
                <span className="label">Total a Pagar</span>
                <h1 className="total-value">R$ {totalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h1>
            </div>
        </div>

        <div className="spacer"></div>

        <button
          className="btn-checkout-clean"
          disabled={carrinho.length === 0}
          onClick={() => setModalPagamento(true)}
          data-tooltip="Ir para pagamento (F5)"
        >
          <span>FINALIZAR VENDA</span>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
             <div className="kbd-box light">F5</div>
             <ArrowRight size={24} strokeWidth={2.5}/>
          </div>
        </button>
      </aside>

      {/* --- MODAL DE PAGAMENTO --- */}
      {modalPagamento && (
        <div className="payment-overlay">
          <div className="payment-modal modern">
            <div className="payment-modal-body">
              <div className="pm-methods">
                <h3>Forma de Pagamento</h3>
                <div className="pm-grid">
                  {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'CREDIARIO'].map(m => (
                    <button key={m} className={`pm-card ${metodoAtual === m ? 'active' : ''}`} onClick={() => { setMetodoAtual(m); setTimeout(()=>inputValorRef.current?.focus(), 50); }} data-tooltip={`Selecionar ${m}`}>
                      {m === 'PIX' && <Smartphone size={20}/>}
                      {m === 'DINHEIRO' && <Banknote size={20}/>}
                      {(m === 'CREDITO' || m === 'DEBITO') && <CreditCard size={20}/>}
                      {m === 'CREDIARIO' && <User size={20}/>}
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pm-inputs">
                <h3>Valores</h3>
                <div className="input-group-modern">
                    <label>Cliente (Opcional)</label>
                    <div className="input-with-icon discount">
                        <UserCheck size={18} />
                        {cliente ? (
                             <div className="cliente-selected" style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center', paddingRight:10}}>
                                 <span title={cliente.nome}>{cliente.nome.substring(0,25)}</span>
                                 <button onClick={() => setCliente(null)} data-tooltip="Remover cliente" style={{background:'none', border:'none', cursor:'pointer'}}><X size={14}/></button>
                             </div>
                        ) : (
                            <input type="text" placeholder="Buscar Cliente..." value={buscaCliente} onChange={(e) => buscarClientes(e.target.value)}/>
                        )}
                    </div>
                    {sugestoesClientes.length > 0 && !cliente && (
                        <div className="pdv-dropdown-products" style={{maxHeight: '150px', position:'absolute', zIndex:10, marginTop:60, width:'90%'}}>
                            {sugestoesClientes.map(c => (
                                <div key={c.id} className="dropdown-item" onClick={() => selecionarCliente(c)}><div className="dd-info">{c.nome}</div></div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="input-group-modern">
                  <label>Desconto (R$)</label>
                  <div className="input-with-icon discount">
                    <Percent size={18} />
                    <input type="text" placeholder="0,00" value={getValorFormatado(descontoRaw)} onChange={(e) => setDescontoRaw(formatCurrencyInput(e.target.value))}/>
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>Valor Recebido (R$)</label>
                  <div className="input-with-icon primary">
                    <span className="currency-symbol-input">R$</span>
                    <input ref={inputValorRef} type="text" placeholder="0,00" value={getValorFormatado(valorInputRaw)} onChange={(e) => setValorInputRaw(formatCurrencyInput(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && handleAdicionarPagamento()} autoFocus/>
                  </div>
                  <button className="btn-add-modern" onClick={handleAdicionarPagamento} data-tooltip="Adicionar Pagamento">LANÇAR</button>
                </div>

                <div className="pm-log">
                  {pagamentos.map(p => (
                    <div key={p.id} className="log-row">
                      <span>{p.tipo}</span><strong>R$ {p.valor.toFixed(2)}</strong>
                      <button onClick={() => setPagamentos(pagamentos.filter(i => i.id !== p.id))} data-tooltip="Remover"><X size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pm-summary clean-theme">
                 <button className="close-btn-absolute" onClick={() => setModalPagamento(false)} data-tooltip="Fechar"><X size={24}/></button>
                 <div className="summary-rows">
                   <div className="s-row sub"><span>Subtotal</span><span>R$ {totalItens.toFixed(2)}</span></div>
                   {valorDesconto > 0 && (<div className="s-row discount"><span>Desconto</span><span>- R$ {valorDesconto.toFixed(2)}</span></div>)}
                   <div className="s-row total"><span>Total Final</span><h1>R$ {totalComDesconto.toFixed(2)}</h1></div>
                   <div className="divider-dark"></div>
                   <div className="s-row paid"><span>Pago</span><span>R$ {totalPago.toFixed(2)}</span></div>
                   {saldoDevedor > 0.01 ? (
                     <div className="s-status pending"><small>FALTA PAGAR</small><strong>R$ {saldoDevedor.toFixed(2)}</strong></div>
                   ) : (
                     <div className="s-status change"><small>TROCO</small><strong>R$ {troco.toFixed(2)}</strong></div>
                   )}
                 </div>
                 <button className="btn-finish-modern" disabled={saldoDevedor > 0.01 || loading} onClick={finalizarVenda} data-tooltip="Concluir Venda">
                   {loading ? 'PROCESSANDO...' : 'CONCLUIR VENDA'}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- NOVO: MODAL DE SAÍDA (Confirmação) --- */}
      {showExitModal && (
        <div className="modal-exit-overlay">
            <div className="modal-exit-content">
                <div className="exit-icon-wrapper">
                    <AlertTriangle size={48} />
                </div>
                <h3>Abandonar Venda?</h3>
                <p>Existem itens no carrinho. Se você sair agora, <b>a venda atual será perdida</b>.</p>

                <div className="modal-exit-actions">
                    <button className="btn-exit-cancel" onClick={() => setShowExitModal(false)} autoFocus>
                        Não, Continuar
                    </button>
                    <button className="btn-exit-confirm" onClick={confirmExit}>
                        Sim, Sair <LogOut size={16} style={{marginLeft: 8}}/>
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PDV;