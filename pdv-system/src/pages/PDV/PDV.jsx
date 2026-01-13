import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trash2, ShoppingCart, CreditCard, Banknote,
  User, ChevronRight, X, Plus, Minus, PauseCircle,
  PlayCircle, Receipt, Smartphone, AlertCircle,
  PackageSearch, Wallet, ArrowRight,
  Info, Percent, MonitorCheck, History, RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './PDV.css';

const PDV = () => {
  // --- ESTADOS ---
  const [carrinho, setCarrinho] = useState([]);
  const [vendasPausadas, setVendasPausadas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false); // Loading geral
  const [calculandoImposto, setCalculandoImposto] = useState(false); // Loading específico fiscal
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);

  // Dados Fiscais Reais (Vindos do Backend)
  const [fiscalData, setFiscalData] = useState({
    valorTotalVenda: 0,
    totalIbs: 0,
    totalCbs: 0,
    totalIs: 0,
    totalLiquido: 0,
    aliquotaEfetivaPorcentagem: 0
  });

  // Sugestões e Pagamento
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [modalPagamento, setModalPagamento] = useState(false);
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

  // --- CÁLCULOS TOTAIS BÁSICOS ---
  const totalItens = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  const valorDesconto = descontoRaw ? parseInt(descontoRaw, 10) / 100 : 0;
  const totalComDesconto = Math.max(0, totalItens - valorDesconto);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const saldoDevedor = Math.max(0, totalComDesconto - totalPago);
  const troco = Math.max(0, totalPago - totalComDesconto);

  // --- INTEGRAÇÃO FISCAL (CÉREBRO NO BACKEND) ---
  useEffect(() => {
    // Se carrinho vazio, reseta
    if (carrinho.length === 0) {
      setFiscalData({
        valorTotalVenda: 0, totalIbs: 0, totalCbs: 0, totalIs: 0, totalLiquido: 0, aliquotaEfetivaPorcentagem: 0
      });
      return;
    }

    // Debounce para não chamar a API a cada clique frenético no "+"
    const timer = setTimeout(async () => {
      setCalculandoImposto(true);
      try {
        // Mapeia para o formato que o TributacaoController espera (Lista de ItemSplitRequest ou similar)
        const payload = carrinho.map(item => ({
          idProduto: item.id,
          quantidade: item.quantidade
        }));

        const res = await api.post('/v1/tributacao/simular-carrinho', payload);
        setFiscalData(res.data);
      } catch (error) {
        console.error("Erro ao calcular impostos reais:", error);
        // Fallback silencioso ou aviso sutil
      } finally {
        setCalculandoImposto(false);
      }
    }, 600); // 600ms de espera

    return () => clearTimeout(timer);
  }, [carrinho]);

  // Valores para o Gráfico (Convertendo do DTO do Backend para o Visual)
  const valFed = fiscalData.totalCbs + fiscalData.totalIs; // Federal = CBS + Seletivo
  const valEst = fiscalData.totalIbs; // Estadual/Municipal = IBS (Simplificado na visualização)
  const valLiq = fiscalData.totalLiquido;

  // Percentuais para a barra (Evita divisão por zero)
  const totalFiscal = fiscalData.valorTotalVenda || 1;
  const pctFed = (valFed / totalFiscal) * 100;
  const pctEst = (valEst / totalFiscal) * 100;
  const pctLiq = (valLiq / totalFiscal) * 100;

  // --- EFEITOS DE UI ---
  useEffect(() => {
    const manterFoco = setInterval(() => {
       if (!modalPagamento && document.activeElement !== inputBuscaRef.current && !buscaCliente && sugestoesProdutos.length === 0) {
           inputBuscaRef.current?.focus();
       }
    }, 3000);
    return () => clearInterval(manterFoco);
  }, [modalPagamento, buscaCliente, sugestoesProdutos]);

  // --- ATALHOS GLOBAIS ---
  const handleKeyDownGlobal = useCallback((e) => {
    if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); }
    if (e.key === 'F2') { e.preventDefault(); pausarVenda(); }
    if (e.key === 'F5') { e.preventDefault(); if(carrinho.length > 0) setModalPagamento(true); }
    if (e.key === 'Escape') {
      setModalPagamento(false);
      setSugestoesClientes([]);
      setSugestoesProdutos([]);
      setSelectedIndex(-1);
    }
  }, [carrinho]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDownGlobal);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal);
  }, [handleKeyDownGlobal]);

  // --- LÓGICA DE PRODUTOS ---
  const handleSearchKeyDown = (e) => {
    if (sugestoesProdutos.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % sugestoesProdutos.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + sugestoesProdutos.length) % sugestoesProdutos.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0) adicionarProdutoPorObjeto(sugestoesProdutos[selectedIndex]);
        else processarBuscaManual();
      }
    } else if (e.key === 'Enter') {
        processarBuscaManual(e);
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const activeItem = dropdownRef.current.children[selectedIndex];
      if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleBuscaChange = async (e) => {
    const termo = e.target.value;
    setBusca(termo);
    setSelectedIndex(-1);

    if (/^\d{7,14}$/.test(termo)) {
      setSugestoesProdutos([]);
      return;
    }

    if (termo.length > 2) {
      try {
        const res = await api.get(`/produtos`, { params: { termo, size: 6 } });
        setSugestoesProdutos(res.data.content || []);
      } catch (err) { console.error(err); }
    } else {
      setSugestoesProdutos([]);
    }
  };

  const adicionarProdutoPorObjeto = (prod) => {
    const itemExistente = carrinho.find(i => i.id === prod.id);
    const qtdFutura = (itemExistente ? itemExistente.quantidade : 0) + 1;

    if (qtdFutura > prod.quantidadeEmEstoque) {
      toast.warn(`Estoque Baixo: ${prod.quantidadeEmEstoque} un.`);
      // Chama auditoria no backend (POST criado anteriormente)
      api.post('/auditoria', {
        acao: 'VENDA_SEM_ESTOQUE',
        detalhes: `ID ${prod.id} - ${prod.descricao}`,
        usuario: 'Operador Caixa',
        dataHora: new Date()
      }).catch(err => console.log("Falha ao auditar", err));
    }

    setCarrinho(prev => {
      if (itemExistente) return prev.map(item => item.id === prod.id ? { ...item, quantidade: item.quantidade + 1 } : item);
      return [...prev, { ...prod, quantidade: 1 }];
    });

    setUltimoItemAdicionadoId(prod.id);
    setTimeout(() => setUltimoItemAdicionadoId(null), 800);
    setBusca('');
    setSugestoesProdutos([]);
    setSelectedIndex(-1);
    inputBuscaRef.current?.focus();
  };

  const processarBuscaManual = async (e) => {
    if (e) e.preventDefault();
    if (!busca) return;

    if (sugestoesProdutos.length > 0 && selectedIndex === -1) {
        adicionarProdutoPorObjeto(sugestoesProdutos[0]);
        return;
    }

    try {
      setLoading(true);
      const res = await api.get(`/produtos`, { params: { termo: busca, size: 1 } });
      const prod = res.data.content?.[0];

      if (!prod) {
        toast.warning("Produto não encontrado!");
        return;
      }
      adicionarProdutoPorObjeto(prod);
    } catch (err) {
      toast.error("Erro ao buscar");
    } finally { setLoading(false); }
  };

  const atualizarQtd = (id, delta) => {
    setCarrinho(prev => prev.map(item =>
      item.id === id ? { ...item, quantidade: Math.max(1, item.quantidade + delta) } : item
    ));
  };

  const removerItem = (id) => {
    setCarrinho(prev => prev.filter(item => item.id !== id));
  };

  const pausarVenda = async () => {
    if (carrinho.length === 0) return;
    try {
        const payload = {
            itens: carrinho.map(i => ({ produtoId: i.id, quantidade: i.quantidade, precoUnitario: i.precoVenda })),
            ehOrcamento: true,
            descontoTotal: 0
        };
        await api.post('/vendas/suspender', payload);
        toast.info("Venda pausada!");
        setCarrinho([]);
        carregarVendasSuspensas();
    } catch (error) { toast.error("Erro ao pausar"); }
  };

  const carregarVendasSuspensas = async () => {
      try {
          const res = await api.get('/vendas/suspensas');
          setVendasPausadas(res.data);
      } catch (error) {}
  };

  useEffect(() => { carregarVendasSuspensas(); }, []);

  const retomarVenda = (venda) => {
    if (carrinho.length > 0) return toast.warning("Finalize a venda atual.");
    const itensRec = venda.itens.map(i => ({
        id: i.produtoId || i.id,
        descricao: i.produtoNome || "Item Recuperado",
        precoVenda: i.precoUnitario,
        quantidade: i.quantidade,
        codigoBarras: i.codigoBarras || ''
    }));
    setCarrinho(itensRec);
    setVendasPausadas(prev => prev.filter(v => v.idVenda !== venda.idVenda));
  };

  // --- PAGAMENTO ---
  const formatCurrencyInput = (value) => value.replace(/\D/g, "");

  const getValorFormatado = (raw) => {
    if (!raw) return "";
    return (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const handleAdicionarPagamento = () => {
    const valor = parseInt(valorInputRaw || '0', 10) / 100;
    if (valor <= 0) return toast.error("Valor inválido");

    if (metodoAtual === 'CREDIARIO') {
        if (!cliente) return toast.warning("Identifique o cliente!");
        if (valor > (cliente.limiteCredito || 0)) return toast.error("Limite excedido!");
    }

    setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor, clienteNome: cliente?.nome }]);
    setValorInputRaw('');
    setTimeout(() => inputValorRef.current?.focus(), 50);
  };

  const finalizarVenda = async () => {
      if (saldoDevedor > 0.01) return toast.error("Falta receber!");

      try {
          const metodoPrinc = pagamentos.sort((a,b) => b.valor - a.valor)[0]?.tipo || 'DINHEIRO';
          let docLimpo = null;
          if (cliente && (cliente.cpf || cliente.cnpj)) {
             docLimpo = (cliente.cpf || cliente.cnpj).replace(/\D/g, '');
          }

          const payload = {
              clienteDocumento: docLimpo,
              clienteNome: cliente?.nome || "Consumidor Final",
              formaDePagamento: metodoPrinc,
              pagamentosDetalhados: pagamentos.map(p => ({ tipo: p.tipo, valor: p.valor })),
              itens: carrinho.map(i => ({ produtoId: i.id, quantidade: i.quantidade, precoUnitario: i.precoVenda })),
              descontoTotal: valorDesconto,
              ehOrcamento: false,
              quantidadeParcelas: 1
          };

          const res = await api.post('/vendas', payload);
          toast.success(`Venda #${res.data.idVenda || ''} OK!`);
          setCarrinho([]); setPagamentos([]); setCliente(null); setDescontoRaw(''); setModalPagamento(false);
          // Limpa dados fiscais
          setFiscalData({ valorTotalVenda: 0, totalIbs: 0, totalCbs: 0, totalIs: 0, totalLiquido: 0, aliquotaEfetivaPorcentagem: 0 });
      } catch (error) {
          toast.error("Erro: " + (error.response?.data?.message || "Falha"));
      }
  };

  const buscarClientes = async (val) => {
    setBuscaCliente(val);
    if (val.length > 2) {
      try {
        const res = await api.get(`/clientes`, { params: { termo: val } });
        setSugestoesClientes(res.data.content || []);
      } catch (err) {}
    } else setSugestoesClientes([]);
  };

  return (
    <div className="pdv-container fade-in">
      <div className="pdv-left">
        <header className="pdv-header-main">

          <form className="search-wrapper" onSubmit={processarBuscaManual}>
            <div className="icon-box-left"><Search size={20} /></div>
            <input
              ref={inputBuscaRef}
              type="text"
              placeholder="Digite o nome ou bipe o código (F1)"
              value={busca}
              onChange={handleBuscaChange}
              onKeyDown={handleSearchKeyDown}
              autoFocus
              autoComplete="off"
            />
            <button type="submit" className="btn-search-go" data-label="Adicionar (Enter)">
               <ArrowRight size={20} strokeWidth={3} />
            </button>

            {sugestoesProdutos.length > 0 && (
              <div className="pdv-dropdown-products" ref={dropdownRef}>
                {sugestoesProdutos.map((prod, idx) => (
                  <div key={prod.id} className={`dropdown-item ${idx === selectedIndex ? 'active' : ''}`} onClick={() => adicionarProdutoPorObjeto(prod)}>
                    <div className="dd-info">
                      <span className="dd-name">{prod.descricao}</span>
                      <small className="dd-meta">{prod.codigoBarras || 'S/GTIN'} | Estoque: {prod.quantidadeEmEstoque}</small>
                    </div>
                    <strong className="dd-price">R$ {prod.precoVenda.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </form>

          <div className="header-actions">
             <button type="button" className="btn-action-soft" onClick={pausarVenda} data-label="Pausar Venda (F2)">
               <PauseCircle size={26} color="#475569" strokeWidth={2} />
             </button>
             {vendasPausadas.length > 0 && (
               <div className="paused-vendas-pill pulse-animation">
                  <AlertCircle size={16} /> {vendasPausadas.length}
               </div>
             )}
          </div>
        </header>

        <main className="pdv-cart">
          <table className="cart-table">
            <thead>
              <tr>
                <th width="50%">Produto</th>
                <th>Preço</th>
                <th>Qtd.</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrinho.map(item => (
                <tr key={item.id} className={`row-item ${ultimoItemAdicionadoId === item.id ? 'flash-highlight' : ''}`}>
                  <td>
                    <div className="prod-name-box">
                      <span className="prod-name">{item.descricao}</span>
                      <small className="prod-ean">{item.codigoBarras || 'S/GTIN'}</small>
                    </div>
                  </td>
                  <td className="font-mono">R$ {item.precoVenda.toFixed(2)}</td>
                  <td>
                    <div className="qty-control">
                      <button onClick={() => atualizarQtd(item.id, -1)} tabIndex="-1"><Minus size={14}/></button>
                      <span className="qty-val">{item.quantidade}</span>
                      <button onClick={() => atualizarQtd(item.id, 1)} tabIndex="-1"><Plus size={14}/></button>
                    </div>
                  </td>
                  <td className="text-right font-bold">R$ {(item.precoVenda * item.quantidade).toFixed(2)}</td>
                  <td className="text-right">
                    <button className="btn-del" onClick={() => removerItem(item.id)} tabIndex="-1">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {carrinho.length === 0 && (
            <div className="empty-state-modern">
              <div className="hero-icon">
                <MonitorCheck size={64} strokeWidth={1} />
              </div>
              <h2>Caixa Aberto</h2>
              <p>Terminal pronto para operação.</p>

              <div className="shortcuts-hint">
                <div className="hint-item"><kbd>F1</kbd> Buscar</div>
                <div className="hint-item"><kbd>F2</kbd> Pausar</div>
                <div className="hint-item"><kbd>F5</kbd> Pagar</div>
              </div>

              {vendasPausadas.length > 0 && (
                <div className="paused-list-modern">
                   <h4><History size={16}/> Vendas em Espera</h4>
                   {vendasPausadas.map(v => (
                     <div key={v.id || Math.random()} className="paused-card" onClick={() => retomarVenda(v)}>
                        <PlayCircle size={18} />
                        <span>R$ {v.total?.toFixed(2)} <small>• {v.hora}</small></span>
                     </div>
                   ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <aside className="pdv-right">
        <div className="summary-box">
          <div className="summary-item large-qty">
            <label>ITENS</label>
            <span>{carrinho.reduce((a, b) => a + b.quantidade, 0)}</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-total">
            <label>TOTAL A PAGAR</label>
            <h1>R$ {totalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h1>
          </div>
        </div>

        {/* COMPONENTE FISCAL CONECTADO AO BACKEND */}
        <div className="fiscal-info-pdv">
           <div className="fiscal-header">
             <Info size={14} />
             {calculandoImposto ? 'Calculando Tributos...' : 'Carga Tributária (LC 214)'}
             {calculandoImposto && <RefreshCw className="spin" size={12}/>}
           </div>

           <div className="fiscal-bar-wrapper">
              <div
                className="fiscal-segment fed"
                style={{width: `${pctFed}%`}}
                data-label={`Federal (CBS+IS): R$ ${valFed.toFixed(2)} (${pctFed.toFixed(1)}%)`}
              ></div>
              <div
                className="fiscal-segment est"
                style={{width: `${pctEst}%`}}
                data-label={`Estadual (IBS): R$ ${valEst.toFixed(2)} (${pctEst.toFixed(1)}%)`}
              ></div>
              <div
                className="fiscal-segment liq"
                style={{width: `${pctLiq}%`}}
                data-label={`Receita Líquida: R$ ${valLiq.toFixed(2)} (${pctLiq.toFixed(1)}%)`}
              ></div>
           </div>

           <div className="fiscal-legend-grid">
              <div className="legend-item"><span className="dot fed"></span> CBS+IS: {pctFed.toFixed(1)}%</div>
              <div className="legend-item"><span className="dot est"></span> IBS: {pctEst.toFixed(1)}%</div>
              <div className="legend-item"><span className="dot liq"></span> Liq: {pctLiq.toFixed(1)}%</div>
           </div>
        </div>

        <button
          className="btn-checkout"
          disabled={carrinho.length === 0}
          onClick={() => setModalPagamento(true)}
          data-label="Pagamento (F5)"
        >
          <Wallet size={24} />
          <span>FECHAR VENDA</span>
          <ChevronRight size={24} />
        </button>
      </aside>

      {/* MODAL PAGAMENTO (Mantido igual) */}
      {modalPagamento && (
        <div className="payment-overlay">
          <div className="payment-modal modern">
            <div className="payment-modal-body">

              <div className="pm-methods">
                <h3>Método</h3>
                <div className="pm-grid">
                  {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'CREDIARIO'].map(m => (
                    <button
                      key={m}
                      className={`pm-card ${metodoAtual === m ? 'active' : ''}`}
                      onClick={() => { setMetodoAtual(m); setTimeout(()=>inputValorRef.current?.focus(), 50); }}
                    >
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
                  <label>Desconto (R$)</label>
                  <div className="input-with-icon discount">
                    <Percent size={18} />
                    <input
                      type="text"
                      placeholder="0,00"
                      value={getValorFormatado(descontoRaw)}
                      onChange={(e) => setDescontoRaw(formatCurrencyInput(e.target.value))}
                    />
                  </div>
                </div>

                <div className="input-group-modern">
                  <label>Valor Recebido (R$)</label>
                  <div className="input-with-icon primary">
                    <Plus size={20} />
                    <input
                      ref={inputValorRef}
                      type="text"
                      placeholder="0,00"
                      value={getValorFormatado(valorInputRaw)}
                      onChange={(e) => setValorInputRaw(formatCurrencyInput(e.target.value))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdicionarPagamento()}
                      autoFocus
                    />
                  </div>
                  <button className="btn-add-modern" onClick={handleAdicionarPagamento}>
                    LANÇAR
                  </button>
                </div>

                <div className="pm-log">
                  {pagamentos.map(p => (
                    <div key={p.id} className="log-row">
                      <span>{p.tipo}</span>
                      <strong>R$ {p.valor.toFixed(2)}</strong>
                      <button onClick={() => setPagamentos(pagamentos.filter(i => i.id !== p.id))}><X size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pm-summary dark-theme">
                 <button className="close-btn-absolute" onClick={() => setModalPagamento(false)}><X /></button>

                 <div className="summary-rows">
                   <div className="s-row sub">
                      <span>Subtotal</span>
                      <span>R$ {totalItens.toFixed(2)}</span>
                   </div>
                   {valorDesconto > 0 && (
                     <div className="s-row discount">
                        <span>Desconto</span>
                        <span>- R$ {valorDesconto.toFixed(2)}</span>
                     </div>
                   )}
                   <div className="s-row total">
                      <span>Total Final</span>
                      <h1>R$ {totalComDesconto.toFixed(2)}</h1>
                   </div>

                   <div className="divider-dark"></div>

                   <div className="s-row paid">
                      <span>Pago</span>
                      <span>R$ {totalPago.toFixed(2)}</span>
                   </div>

                   {saldoDevedor > 0.01 ? (
                     <div className="s-status pending">
                        <small>FALTA PAGAR</small>
                        <strong>R$ {saldoDevedor.toFixed(2)}</strong>
                     </div>
                   ) : (
                     <div className="s-status change">
                        <small>TROCO</small>
                        <strong>R$ {troco.toFixed(2)}</strong>
                     </div>
                   )}
                 </div>

                 <button
                  className="btn-finish-modern"
                  disabled={saldoDevedor > 0.01}
                  onClick={finalizarVenda}
                 >
                   CONCLUIR VENDA
                 </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDV;