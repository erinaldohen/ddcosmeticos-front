import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trash2, ShoppingCart, CreditCard, Banknote,
  User, ChevronRight, X, Plus, Minus, PauseCircle,
  PlayCircle, Receipt, Smartphone, AlertCircle, CheckCircle2,
  PackageSearch, Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './PDV.css';

const PDV = () => {
  // --- ESTADOS PRINCIPAIS ---
  const [carrinho, setCarrinho] = useState([]);
  const [vendasPausadas, setVendasPausadas] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);

  // --- ESTADOS DE PAGAMENTO ---
  const [modalPagamento, setModalPagamento] = useState(false);
  const [pagamentos, setPagamentos] = useState([]);
  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInput, setValorInput] = useState('');
  const [cliente, setCliente] = useState(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [sugestoesClientes, setSugestoesClientes] = useState([]);

  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);

  // --- CÁLCULOS ---
  const totalVenda = carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0);
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0);
  const saldoDevedor = Math.max(0, totalVenda - totalPago);
  const troco = Math.max(0, totalPago - totalVenda);

  // --- ATALHOS DE TECLADO ---
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); }
    if (e.key === 'F2') { e.preventDefault(); pausarVenda(); }
    if (e.key === 'F5') { e.preventDefault(); if(carrinho.length > 0) setModalPagamento(true); }
    if (e.key === 'Escape') { setModalPagamento(false); setSugestoesClientes([]); }
  }, [carrinho]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // --- LÓGICA DE PRODUTOS ---
  const adicionarProduto = async (e) => {
    if (e) e.preventDefault();
    if (!busca) return;
    try {
      setLoading(true);
      const res = await api.get(`/produtos/busca?termo=${busca}`);
      const prod = res.data;

      setCarrinho(prev => {
        const existe = prev.find(item => item.id === prod.id);
        if (existe) {
          return prev.map(item => item.id === prod.id ? { ...item, quantidade: item.quantidade + 1 } : item);
        }
        return [...prev, { ...prod, quantidade: 1 }];
      });
      setBusca('');
      toast.success(`${prod.descricao} adicionado`, { autoClose: 800, hideProgressBar: true });
    } catch (err) {
      toast.error("Produto não encontrado");
    } finally { setLoading(false); }
  };

  const atualizarQtd = (id, delta) => {
    setCarrinho(prev => prev.map(item =>
      item.id === id ? { ...item, quantidade: Math.max(1, item.quantidade + delta) } : item
    ));
  };

  // --- LÓGICA DE VENDAS PAUSADAS ---
  const pausarVenda = () => {
    if (carrinho.length === 0) return;
    const novaPausa = { id: Date.now(), itens: carrinho, total: totalVenda, hora: new Date().toLocaleTimeString() };
    setVendasPausadas([...vendasPausadas, novaPausa]);
    setCarrinho([]);
    toast.info("Venda pausada e salva temporariamente");
  };

  const retomarVenda = (venda) => {
    if (carrinho.length > 0) return toast.warning("Conclua ou pause a venda atual primeiro");
    setCarrinho(venda.itens);
    setVendasPausadas(vendasPausadas.filter(v => v.id !== venda.id));
  };

  // --- LÓGICA DE PAGAMENTO ---
  const handleAdicionarPagamento = () => {
    const valor = parseFloat(valorInput.replace(',', '.'));
    if (!valor || valor <= 0) return toast.error("Informe um valor válido");
    if (metodoAtual === 'CREDIARIO' && !cliente) return toast.warning("Selecione um cliente para o crediário");

    setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor, clienteNome: cliente?.nome }]);
    setValorInput('');
  };

  const buscarClientes = async (val) => {
    setBuscaCliente(val);
    if (val.length > 2) {
      try {
        const res = await api.get(`/clientes/busca?termo=${val}`);
        setSugestoesClientes(res.data);
      } catch (err) { console.error(err); }
    } else setSugestoesClientes([]);
  };

  return (
    <div className="pdv-container fade-in">
      {/* --- COLUNA ESQUERDA: OPERAÇÃO --- */}
      <div className="pdv-left">
        <header className="pdv-header-main">
          <div className="search-wrapper">
            <Search size={22} className="icon-search" />
            <form onSubmit={adicionarProduto}>
              <input
                ref={inputBuscaRef}
                type="text"
                placeholder="Escaneie o código ou digite o nome (F1)"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </form>
          </div>
          <div className="header-actions">
             <button className="btn-action-soft" onClick={pausarVenda} data-label="Pausar Venda (F2)">
               <PauseCircle size={24} />
             </button>
             {vendasPausadas.length > 0 && (
               <div className="paused-vendas-pill">
                  <AlertCircle size={16} /> {vendasPausadas.length} em espera
               </div>
             )}
          </div>
        </header>

        <main className="pdv-cart">
          <table className="cart-table">
            <thead>
              <tr>
                <th width="50%">Descrição do Produto</th>
                <th>Preço Un.</th>
                <th>Qtd.</th>
                <th className="text-right">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrinho.map(item => (
                <tr key={item.id} className="row-item">
                  <td>
                    <div className="prod-name-box">
                      <span className="prod-name">{item.descricao}</span>
                      <small className="prod-ean">{item.codigoBarras}</small>
                    </div>
                  </td>
                  <td className="font-mono">R$ {item.precoVenda.toFixed(2)}</td>
                  <td>
                    <div className="qty-control">
                      <button onClick={() => atualizarQtd(item.id, -1)}><Minus size={14}/></button>
                      <span className="qty-val">{item.quantidade}</span>
                      <button onClick={() => atualizarQtd(item.id, 1)}><Plus size={14}/></button>
                    </div>
                  </td>
                  <td className="text-right font-bold">R$ {(item.precoVenda * item.quantidade).toFixed(2)}</td>
                  <td className="text-right">
                    <button className="btn-del" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {carrinho.length === 0 && (
            <div className="empty-state-pdv">
              <PackageSearch size={80} strokeWidth={1} />
              <h3>Caixa Livre</h3>
              <p>Pronto para uma nova venda...</p>

              {vendasPausadas.length > 0 && (
                <div className="paused-list">
                   {vendasPausadas.map(v => (
                     <div key={v.id} className="paused-card" onClick={() => retomarVenda(v)}>
                        <PlayCircle size={18} />
                        <span>{v.hora} - R$ {v.total.toFixed(2)}</span>
                     </div>
                   ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* --- COLUNA DIREITA: FINANCEIRO --- */}
      <aside className="pdv-right">
        <div className="summary-box">
          <div className="summary-item">
            <label>Itens no Carrinho</label>
            <span>{carrinho.reduce((a, b) => a + b.quantidade, 0)} un</span>
          </div>
          <div className="summary-total">
            <label>Total a Pagar</label>
            <h1>R$ {totalVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h1>
          </div>
        </div>

        <div className="fiscal-info-pdv">
           <div className="fiscal-row">
             <span>IBS/CBS Est. (Split LC 214)</span>
             <strong>R$ {(totalVenda * 0.26).toFixed(2)}</strong>
           </div>
           <p className="fiscal-notice">Operação em conformidade com a Reforma Tributária</p>
        </div>

        <button
          className="btn-checkout"
          disabled={carrinho.length === 0}
          onClick={() => setModalPagamento(true)}
        >
          <Wallet size={24} />
          <span>FECHAR VENDA (F5)</span>
          <ChevronRight size={24} />
        </button>
      </aside>

      {/* --- MODAL DE PAGAMENTO --- */}
      {modalPagamento && (
        <div className="payment-overlay">
          <div className="payment-modal">
            <header className="payment-header">
              <h2><Receipt /> Finalização de Venda</h2>
              <button className="close-modal" onClick={() => setModalPagamento(false)}><X /></button>
            </header>

            <div className="payment-content">
              <div className="metodos-grid">
                {[
                  { id: 'PIX', icon: <Smartphone />, label: 'Pix' },
                  { id: 'DINHEIRO', icon: <Banknote />, label: 'Dinheiro' },
                  { id: 'CREDITO', icon: <CreditCard />, label: 'Crédito' },
                  { id: 'DEBITO', icon: <CreditCard />, label: 'Débito' },
                  { id: 'CREDIARIO', icon: <User />, label: 'Crediário' }
                ].map(m => (
                  <button
                    key={m.id}
                    className={`method-btn ${metodoAtual === m.id ? 'active' : ''}`}
                    onClick={() => setMetodoAtual(m.id)}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              <div className="payment-inputs">
                {metodoAtual === 'CREDIARIO' && (
                  <div className="crediario-area">
                    <div className="client-search">
                      <input
                        type="text"
                        placeholder="Nome ou CPF do Cliente..."
                        value={buscaCliente}
                        onChange={(e) => buscarClientes(e.target.value)}
                      />
                      {sugestoesClientes.length > 0 && (
                        <div className="client-dropdown">
                          {sugestoesClientes.map(c => (
                            <div key={c.id} className="client-item" onClick={() => { setCliente(c); setSugestoesClientes([]); setBuscaCliente(''); }}>
                              <span>{c.nome}</span>
                              <small>{c.cpf}</small>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {cliente && (
                      <div className="client-card-premium">
                        <div className="card-chip"></div>
                        <span className="card-holder">{cliente.nome}</span>
                        <div className="card-limit">
                          <label>Crédito Disponível</label>
                          <span>R$ {(cliente.limiteCredito - (cliente.saldoDevedor || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="input-valor-group">
                  <label>Valor a Receber</label>
                  <div className="input-currency">
                    <span>R$</span>
                    <input
                      ref={inputValorRef}
                      type="text"
                      placeholder="0,00"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdicionarPagamento()}
                      autoFocus
                    />
                    <button className="btn-add-pay" onClick={handleAdicionarPagamento}>OK</button>
                  </div>
                </div>

                <div className="payments-list">
                  {pagamentos.map(p => (
                    <div key={p.id} className="pay-row">
                      <span className="pay-type">{p.tipo} {p.clienteNome && `(${p.clienteNome})`}</span>
                      <span className="pay-val">R$ {p.valor.toFixed(2)}</span>
                      <button onClick={() => setPagamentos(pagamentos.filter(i => i.id !== p.id))}><X size={14}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <footer className="payment-footer">
               <div className="totals-pay">
                  <div className="total-pay-item">
                    <label>Faltando</label>
                    <span className={saldoDevedor > 0 ? 'text-red' : ''}>R$ {saldoDevedor.toFixed(2)}</span>
                  </div>
                  {troco > 0 && (
                    <div className="total-pay-item">
                      <label>Troco</label>
                      <span className="text-green">R$ {troco.toFixed(2)}</span>
                    </div>
                  )}
               </div>
               <button
                className="btn-confirm-sale"
                disabled={saldoDevedor > 0}
                onClick={() => { toast.success("Venda finalizada!"); window.location.reload(); }}
               >
                 CONCLUIR E IMPRIMIR CUPOM
               </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDV;