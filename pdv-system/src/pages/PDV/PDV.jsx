import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trash2, CreditCard, Banknote, User, Plus, Minus,
  PauseCircle, Smartphone, ArrowLeft, X,
  MonitorCheck, History, UserCheck, AlertTriangle,
  Tag, RotateCcw, UserPlus, Box, Barcode, CheckCircle, Calculator,
  Percent, ArrowRight, Clock
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
  const [carrinho, setCarrinho] = useState([]);
  const [vendasPausadas, setVendasPausadas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);

  // Modais
  const [modalPagamento, setModalPagamento] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showListaEspera, setShowListaEspera] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [modalDesconto, setModalDesconto] = useState({ open: false, tipo: 'TOTAL', itemId: null });

  // Desconto
  const [descontoInput, setDescontoInput] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('$'); // '$' ou '%'

  // Dados
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [pagamentos, setPagamentos] = useState([]);
  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');
  const [descontoTotalRaw, setDescontoTotalRaw] = useState(0); // Desconto Global
  const [cliente, setCliente] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [sugestoesClientes, setSugestoesClientes] = useState([]);
  const [showClienteInput, setShowClienteInput] = useState(false);

  // --- CÁLCULOS ---
  // Soma bruta dos itens (qtd * preco)
  const subtotalItens = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  // Soma dos descontos individuais aplicados em cada item
  const descontoItens = carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0);

  // Total a pagar = Subtotal - Descontos Itens - Desconto Global
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);

  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);

  // Arredonda para 2 casas para evitar flutuação de ponto flutuante (ex: 0.0000001)
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  // --- SEGURANÇA: PREVENIR SAÍDA ACIDENTAL ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (carrinho.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [carrinho]);

  const handleVoltar = () => {
      if (carrinho.length > 0) setShowExitModal(true);
      else navigate('/dashboard');
  };

  const confirmExit = useCallback(() => navigate('/dashboard'), [navigate]);

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    carregarVendasSuspensas();
    verificarCaixa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verificarCaixa = async () => {
    try {
      const res = await caixaService.getStatus();
      if (!res.data || res.data.status === 'FECHADO') {
        toast.warning("Caixa Fechado. Abra o caixa para vender.");
        navigate('/caixa');
      }
    } catch (error) {
        console.error("Erro ao verificar caixa", error);
        toast.error("Erro de conexão ao verificar caixa.");
    }
  };

  const carregarVendasSuspensas = useCallback(async () => {
      try {
          const res = await api.get('/vendas/suspensas');
          setVendasPausadas(res.data || []);
      } catch (e) {
          console.error("Erro ao carregar vendas suspensas", e);
      }
  }, []);

  // --- AÇÕES ---

  // 1. PAUSAR VENDA (F2)
  const pausarVenda = async () => {
    if (carrinho.length === 0) return toast.info("Carrinho vazio.");

    const toastId = toast.loading("Pausando venda...", { position: "top-center" });

    try {
        const payload = {
            clienteId: cliente?.id || null,
            // Envia o desconto global. O backend deve saber lidar com desconto itens + desconto global
            descontoTotal: Number(descontoTotalRaw) || 0,
            observacao: "Venda Suspensa",
            formaDePagamento: "DINHEIRO", // Padrão para suspensão
            itens: carrinho.map(i => ({
                produtoId: i.id,
                quantidade: Number(i.quantidade),
                precoUnitario: Number(i.precoVenda || 0),
                desconto: Number(i.desconto || 0)
            })),
            pagamentos: []
        };

        await api.post('/vendas/suspender', payload);

        toast.update(toastId, {
            render: "Venda Pausada! ⏸️",
            type: "success",
            isLoading: false,
            autoClose: 2000,
            position: "top-center",
            theme: "colored"
        });

        limparEstadoVenda();
        carregarVendasSuspensas();
    } catch (e) {
        console.error(e);
        toast.update(toastId, {
            render: "Erro ao pausar venda.",
            type: "error",
            isLoading: false,
            autoClose: 3000,
            position: "top-center"
        });
    }
  };

  // 2. RETOMAR VENDA (F6 / Click)
  const retomVenda = async (vendaSuspensa) => {
      if (carrinho.length > 0) return toast.warn("Finalize ou limpe a venda atual antes.");
      setLoading(true);
      try {
          await api.delete(`/vendas/${vendaSuspensa.id}`, { data: { motivo: "Retomada no PDV" } });

          const itensRecuperados = vendaSuspensa.itens.map(item => ({
              id: item.produtoId,
              descricao: item.produtoDescricao || item.descricao || item.produtoNome || "Item recuperado",
              precoVenda: Number(item.precoUnitario || item.precoVenda || 0),
              quantidade: Number(item.quantidade),
              codigoBarras: item.codigoBarras || '',
              desconto: Number(item.desconto || 0)
          }));

          setCarrinho(itensRecuperados);

          if (vendaSuspensa.clienteNome && vendaSuspensa.clienteNome !== "Consumidor Final") {
              setCliente({ id: vendaSuspensa.clienteId || null, nome: vendaSuspensa.clienteNome });
          } else {
              setCliente(null);
          }

          setDescontoTotalRaw(Number(vendaSuspensa.descontoTotal || 0));

          setShowListaEspera(false);
          carregarVendasSuspensas();
          toast.success("Venda recuperada!", { position: "top-center", theme: "colored", autoClose: 2000 });
          setTimeout(() => inputBuscaRef.current?.focus(), 100);
      } catch (error) {
          console.error(error);
          toast.error("Erro ao recuperar venda.", { position: "top-center" });
      } finally {
          setLoading(false);
      }
  };

  // 3. PAGAMENTO (F5)
  const abrirPagamento = () => {
      if (carrinho.length === 0) return toast.warn("Carrinho vazio.");
      setModalPagamento(true);

      // Usa Math.round para garantir integridade dos centavos antes de converter para string
      const valorCentavos = Math.round(saldoDevedor * 100);
      setValorInputRaw(valorCentavos.toString());

      setTimeout(() => inputValorRef.current?.focus(), 100);
  };

  const handleAdicionarPagamento = () => {
    // Parser seguro de inteiros
    const rawVal = parseInt(valorInputRaw.replace(/\D/g, '') || '0', 10);
    let valor = rawVal / 100;

    // Se o usuário apertar enter sem digitar nada (0) e houver saldo, assume o saldo total
    if (valor === 0 && saldoDevedor > 0) valor = saldoDevedor;

    if (valor <= 0) return;
    if (valor > saldoDevedor && metodoAtual !== 'DINHEIRO') {
        // Bloqueia pagamento maior que a dívida para métodos que não geram troco (opcional, mas recomendado)
        // toast.warn("Valor maior que o saldo devedor.");
        // return;
        // *Mantendo comportamento padrão: permite troco em qualquer método ou deixa passar*
    }

    setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor }]);

    // Calcula novo saldo para UX do input
    const novoSaldo = Math.max(0, saldoDevedor - valor);

    if (novoSaldo > 0) {
        setValorInputRaw((Math.round(novoSaldo * 100)).toString());
        setTimeout(() => inputValorRef.current?.focus(), 50);
    } else {
        setValorInputRaw('');
    }
  };

  const finalizarVenda = async () => {
      // Pequena margem para erro de ponto flutuante
      if (saldoDevedor > 0.01) return toast.error(`Falta R$ ${saldoDevedor.toFixed(2)}`);

      setLoading(true);
      try {
          const mapPgto = (t) => ({ 'CREDITO':'CREDITO', 'DEBITO':'DEBITO', 'PIX':'PIX', 'CREDIARIO':'CREDIARIO', 'DINHEIRO':'DINHEIRO' }[t] || 'DINHEIRO');

          const payload = {
              clienteId: cliente?.id || null,
              // Backend deve esperar o desconto total da venda (soma dos descontos)
              descontoTotal: descontoTotalRaw + descontoItens,
              observacao: "PDV",
              // Define forma de pagamento principal (opcional, dependendo do backend)
              formaDePagamento: pagamentos.length > 0 ? mapPgto(pagamentos[0].tipo) : 'DINHEIRO',
              itens: carrinho.map(i => ({
                  produtoId: i.id,
                  quantidade: i.quantidade,
                  precoUnitario: i.precoVenda,
                  desconto: i.desconto || 0
              })),
              pagamentos: pagamentos.map(p => ({
                  formaPagamento: mapPgto(p.tipo),
                  valor: p.valor,
                  parcelas: 1
              }))
          };

          await api.post('/vendas', payload);
          toast.success("Venda Finalizada!", { position: "top-center", theme: "colored" });
          limparEstadoVenda();
          setTimeout(() => inputBuscaRef.current?.focus(), 100);
      } catch (e) {
          console.error(e);
          toast.error("Erro ao finalizar venda.");
      } finally {
          setLoading(false);
      }
  };

  const handleLimparVenda = () => { if(carrinho.length > 0) setShowCleanModal(true); };
  const confirmarLimpeza = () => { limparEstadoVenda(); setShowCleanModal(false); inputBuscaRef.current?.focus(); };

  const limparEstadoVenda = () => {
      setCarrinho([]);
      setPagamentos([]);
      setCliente(null);
      setDescontoTotalRaw(0);
      setModalPagamento(false);
      setShowExitModal(false);
      setBusca('');
  };

  // --- DESCONTOS ---
  const abrirModalDesconto = (tipo, itemId = null) => {
      setModalDesconto({ open: true, tipo, itemId });
      setDescontoInput('');
      setTipoDesconto('$');
      setTimeout(() => inputDescontoRef.current?.focus(), 100);
  };

  const calcularValorDesconto = (valorBase) => {
      if (tipoDesconto === '%') {
          const porcentagem = parseFloat(descontoInput.replace(',', '.') || 0);
          return (valorBase * porcentagem) / 100;
      } else {
          // Input em centavos (formatação monetária)
          const centavos = parseInt(descontoInput.replace(/\D/g, '') || 0, 10);
          return centavos / 100;
      }
  };

  const aplicarDesconto = () => {
      if (modalDesconto.tipo === 'TOTAL') {
          const v = calcularValorDesconto(subtotalItens);
          if (v > subtotalItens) return toast.error("Desconto maior que o subtotal.");
          setDescontoTotalRaw(v);
      } else {
          // Desconto Item
          setCarrinho(prev => prev.map(item => {
              if (item.id === modalDesconto.itemId) {
                  const totalItem = item.precoVenda * item.quantidade;
                  const v = calcularValorDesconto(totalItem);
                  // Validação básica: desconto não pode ser maior que o item
                  if (v >= totalItem) {
                      toast.error("Desconto inválido p/ o item.");
                      return item;
                  }
                  return { ...item, desconto: v };
              }
              return item;
          }));
      }
      setModalDesconto({ ...modalDesconto, open: false });
      inputBuscaRef.current?.focus();
  };

  // --- PRODUTOS ---
  const handleBuscaChange = async (e) => {
    const termo = e.target.value;
    setBusca(termo);
    setSelectedIndex(-1);

    // Evita busca com termos muito curtos ou códigos de barra incompletos
    if (/^\d{7,14}$/.test(termo)) {
        // Se parece código de barras, não busca sugestão, espera Enter
        setSugestoesProdutos([]);
        return;
    }
    if (termo.length <= 2) {
        setSugestoesProdutos([]);
        return;
    }

    try {
        const res = await api.get(`/produtos`, { params: { termo, size: 6 } });
        setSugestoesProdutos(res.data.content || []);
    } catch (err) {
        // Silent fail para busca typeahead
    }
  };

  const adicionarProdutoPorObjeto = (prod) => {
    const itemExistente = carrinho.find(i => i.id === prod.id);

    setCarrinho(prev => itemExistente
        ? prev.map(i => i.id === prod.id ? { ...i, quantidade: i.quantidade + 1 } : i)
        : [...prev, { ...prod, quantidade: 1, desconto: 0 }]
    );

    setUltimoItemAdicionadoId(prod.id);
    setBusca('');
    setSugestoesProdutos([]);
    setSelectedIndex(-1);
    inputBuscaRef.current?.focus();
  };

  const processarBuscaManual = async (e) => {
    if (e) e.preventDefault();
    if (!busca) return;

    if (sugestoesProdutos.length > 0 && selectedIndex !== -1) {
        return adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]);
    }

    try {
        setLoading(true);
        const res = await api.get(`/produtos`, { params: { termo: busca, size: 1 } });
        if (res.data.content?.[0]) {
            adicionarProdutoPorObjeto(res.data.content[0]);
        } else {
            toast.warning("Produto não encontrado");
            setBusca('');
        }
    } catch (err) {
        toast.error("Erro ao buscar produto.");
    } finally {
        setLoading(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (sugestoesProdutos.length > 0) {
      if (e.key === 'ArrowDown') setSelectedIndex(prev => (prev + 1) % sugestoesProdutos.length);
      else if (e.key === 'ArrowUp') setSelectedIndex(prev => (prev - 1 + sugestoesProdutos.length) % sugestoesProdutos.length);
      else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0) adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]);
          else processarBuscaManual();
      }
    } else if (e.key === 'Enter') {
        processarBuscaManual(e);
    }
  };

  // --- UTILS ---
  const atualizarQtd = (id, delta) => {
      setCarrinho(prev => prev.map(i => {
          if (i.id === id) {
             const novaQtd = Math.max(1, i.quantidade + delta);
             // Se tinha desconto, opcionalmente ajustar ou manter fixo?
             // Aqui mantemos o desconto total do item fixo (ex: deu 5 reais de desconto, continua 5)
             // Se fosse unitário, teria que recalcular.
             return { ...i, quantidade: novaQtd };
          }
          return i;
      }));
  };

  const removerItem = (id) => setCarrinho(prev => prev.filter(i => i.id !== id));

  const buscarClientes = async (v) => {
      setBuscaCliente(v);
      if(v.length > 2) {
          try {
              const r = await api.get(`/clientes`,{params:{termo:v}});
              setSugestoesClientes(r.data.content||[]);
          } catch(e){}
      } else {
          setSugestoesClientes([]);
      }
  };

  const selecionarCliente = (c) => {
      setCliente(c);
      setBuscaCliente('');
      setSugestoesClientes([]);
      setShowClienteInput(false);
  };

  const formatCurrencyInput = (v) => v.replace(/\D/g, "");

  const getValorFormatado = (r) => {
      if (!r) return "";
      const val = parseInt(r, 10);
      if (isNaN(val)) return "";
      return (val / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const getProductColor = (n) => ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6'][(n?.charCodeAt(0) || 0) % 5];
  const getProductInitials = (n) => (n || "?").substring(0, 2).toUpperCase();

  // --- ATALHOS GLOBAIS ---
  const handleKeyDownGlobal = useCallback((e) => {
    // Se algum modal estiver aberto, Esc fecha o modal
    if (modalDesconto.open || modalPagamento || showExitModal || showListaEspera || showCleanModal) {
        if (e.key === 'Escape') {
            setModalDesconto(prev => ({...prev, open:false}));
            setModalPagamento(false);
            setShowExitModal(false);
            setShowListaEspera(false);
            setShowCleanModal(false);
        }
        return;
    }

    // Atalhos do PDV principal
    switch(e.key) {
        case 'F1': e.preventDefault(); inputBuscaRef.current?.focus(); break;
        case 'F2': e.preventDefault(); pausarVenda(); break;
        case 'F3': e.preventDefault(); setShowClienteInput(true); setTimeout(()=>inputClienteRef.current?.focus(), 50); break;
        case 'F4': e.preventDefault(); abrirModalDesconto('TOTAL'); break;
        case 'F5': e.preventDefault(); abrirPagamento(); break;
        case 'F6': e.preventDefault(); if(vendasPausadas.length > 0) setShowListaEspera(true); break;
        case 'Delete': if(carrinho.length > 0) handleLimparVenda(); break;
        case 'Escape':
            if (showClienteInput) setShowClienteInput(false);
            else if (busca) setBusca('');
            else if (carrinho.length > 0) setShowExitModal(true);
            else handleVoltar();
            break;
        default: break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrinho.length, modalDesconto.open, modalPagamento, showExitModal, showListaEspera, showCleanModal, vendasPausadas.length, busca, showClienteInput]);

  useEffect(() => {
      window.addEventListener('keydown', handleKeyDownGlobal);
      return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [handleKeyDownGlobal]);

  return (
    <div className="pdv-container fade-in">
      <div className="pdv-left">
        <header className="pdv-header-main">
          <button className="btn-action-soft" onClick={handleVoltar} data-tooltip="Sair (Esc)"><ArrowLeft size={22} /></button>
          <div className="search-wrapper">
            <Search size={22} className="text-gray-400 mr-2"/>
            <input
                ref={inputBuscaRef}
                type="text"
                placeholder="Pesquisar produto (F1)..."
                value={busca}
                onChange={handleBuscaChange}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                autoComplete="off"
            />
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
                  <td align="center"><button className={`btn-item-desc ${item.desconto > 0 ? 'active' : ''}`} onClick={() => abrirModalDesconto('ITEM', item.id)} data-tooltip="Desconto no Item">{item.desconto > 0 ? `-${item.desconto.toFixed(2)}` : <Tag size={14}/>}</button></td>
                  <td align="right" style={{fontWeight:'bold', color:'#0f172a'}}>R$ {((item.precoVenda * item.quantidade) - (item.desconto || 0)).toFixed(2)}</td>
                  <td align="center"><button className="btn-trash-item" onClick={() => removerItem(item.id)} data-tooltip="Remover (Del)"><Trash2 size={16}/></button></td>
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
             <button className="customer-card-action" style={{flex: 0.4, background: vendasPausadas.length > 0 ? '#fff7ed' : '#f8fafc', borderColor: vendasPausadas.length > 0 ? '#fdba74' : '#e2e8f0', justifyContent:'center', padding: '0 10px', cursor: 'pointer'}} onClick={() => setShowListaEspera(true)} data-tooltip="Ver Vendas Suspensas (F6)">
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
                          <input
                              ref={inputValorRef}
                              autoFocus
                              value={getValorFormatado(valorInputRaw)}
                              onChange={e => setValorInputRaw(formatCurrencyInput(e.target.value))}
                              onKeyDown={e => e.key === 'Enter' && handleAdicionarPagamento()}
                              placeholder="0,00"
                          />
                          <button className="btn-enter-icon" onClick={handleAdicionarPagamento} title="Confirmar Valor"><ArrowRight size={24} strokeWidth={3} /></button>
                      </div>
                      <div className="pm-log">
                          {pagamentos.length === 0 && <p style={{textAlign:'center', color:'#cbd5e1', marginTop:20}}>Nenhum pagamento lançado.</p>}
                          {pagamentos.map(p => (
                              <div key={p.id} className="log-row">
                                  <div style={{display:'flex', flexDirection:'column'}}><span style={{fontWeight:700, color:'#3b82f6', fontSize:'0.8rem'}}>{p.tipo}</span><strong style={{fontSize:'1.1rem'}}>R$ {p.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong></div>
                                  <button onClick={()=>setPagamentos(pagamentos.filter(x=>x.id!==p.id))} style={{background:'none', border:'none', cursor:'pointer', padding:5}}><X size={18} color="#ef4444" /></button>
                              </div>
                          ))}
                      </div>
                      <button className="btn-finish-modal" disabled={saldoDevedor > 0.01 || loading} onClick={finalizarVenda}>{loading ? 'PROCESSANDO...' : 'CONCLUIR VENDA (F5)'}</button>
                  </div>
              </div>
          </div>
      )}

      {modalDesconto.open && (
          <div className="modal-exit-overlay">
              <div className="modal-exit-content" style={{width: 350}}>
                  <div className="exit-icon-wrapper" style={{background:'#eff6ff', color:'#2563eb'}}><Percent size={48} /></div>
                  <h3>{modalDesconto.tipo === 'TOTAL' ? 'Desconto Global' : 'Desconto no Item'}</h3>
                  <div className="toggle-discount-type">
                      <button className={tipoDesconto === '$' ? 'active' : ''} onClick={() => setTipoDesconto('$')}>R$ Valor</button>
                      <button className={tipoDesconto === '%' ? 'active' : ''} onClick={() => setTipoDesconto('%')}>% Porcentagem</button>
                  </div>
                  <div className="input-with-icon discount" style={{marginBottom: 20}}>
                      <span style={{fontWeight:800, color:'#64748b'}}>{tipoDesconto}</span>
                      <input
                          ref={inputDescontoRef}
                          type="text"
                          value={tipoDesconto === '$' ? getValorFormatado(descontoInput) : descontoInput}
                          onChange={e => {
                              const val = e.target.value;
                              if (tipoDesconto === '$') { setDescontoInput(formatCurrencyInput(val)); }
                              else { setDescontoInput(val.replace(/[^0-9.,]/g, '')); }
                          }}
                          onKeyDown={e => e.key === 'Enter' && aplicarDesconto()}
                          placeholder={tipoDesconto === '$' ? "0,00" : "0"}
                          autoComplete="off"
                      />
                  </div>
                  <div className="modal-exit-actions">
                      <button className="btn-exit-cancel" onClick={()=>setModalDesconto({...modalDesconto, open:false})}>Cancelar</button>
                      <button className="btn-exit-confirm" onClick={aplicarDesconto} style={{background:'#10b981'}}>Aplicar</button>
                  </div>
              </div>
          </div>
      )}

      {showCleanModal && (
        <div className="modal-exit-overlay">
            <div className="modal-exit-content">
                <div className="exit-icon-wrapper"><RotateCcw size={48} /></div>
                <h3>Limpar Venda?</h3>
                <p>Todos os itens serão removidos do carrinho.</p>
                <div className="modal-exit-actions"><button className="btn-exit-cancel" onClick={() => setShowCleanModal(false)}>Voltar</button><button className="btn-exit-confirm" onClick={confirmarLimpeza}>Limpar</button></div>
            </div>
        </div>
      )}

      {showListaEspera && (
          <div className="modal-exit-overlay" onClick={() => setShowListaEspera(false)}>
              <div className="modal-exit-content" style={{width: 500, padding: 20}} onClick={e => e.stopPropagation()}>
                  <h3>Vendas em Espera</h3>
                  <div style={{maxHeight: 300, overflowY: 'auto', marginTop: 10}}>
                      {vendasPausadas.length === 0 ? <p style={{color:'#94a3b8', padding:20}}>Nenhuma venda na fila.</p> :
                        vendasPausadas.map(v => (
                          <div key={v.id} className="paused-card" style={{display:'flex', justifyContent:'space-between', padding:15, marginBottom:10}} onClick={() => retomVenda(v)}>
                              <div><strong>{v.clienteNome || 'Consumidor'}</strong><br/><small>{new Date(v.dataVenda).toLocaleTimeString()}</small></div>
                              <div style={{textAlign:'right'}}><strong style={{color:'#059669'}}>R$ {v.valorTotal?.toFixed(2)}</strong><br/><small>{v.itens?.length} itens</small></div>
                          </div>
                        ))
                      }
                  </div>
                  <button className="btn-exit-cancel" style={{marginTop:20}} onClick={() => setShowListaEspera(false)}>Fechar (Esc)</button>
              </div>
          </div>
      )}

      {showExitModal && (
        <div className="modal-exit-overlay">
            <div className="modal-exit-content">
                <div className="exit-icon-wrapper"><AlertTriangle size={48} /></div>
                <h3>Sair do PDV?</h3>
                <p>A venda atual será perdida.</p>
                <div className="modal-exit-actions"><button className="btn-exit-cancel" onClick={() => setShowExitModal(false)}>Voltar</button><button className="btn-exit-confirm" onClick={confirmExit}>Sair</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default PDV;