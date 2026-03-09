import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Plus, Minus, ArrowLeft, X,
  UserCheck, ArrowRight, Clock, Banknote, Smartphone,
  CreditCard, ShieldCheck, Tag, AlertCircle, Building,
  ShoppingBag, CheckCircle2, ChevronRight, LogOut,
  Sparkles, Check, TrendingDown, Phone, UserX, HeartHandshake
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
  const inputClienteNomeRef = useRef(null);
  const inputDescontoRef = useRef(null);
  const dropdownRef = useRef(null);

  // Estados de Fluxo
  const [painelAtivo, setPainelAtivo] = useState('VENDA');
  const [validandoCaixa, setValidandoCaixa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Estados de Fechamento
  const [valorFechamentoRaw, setValorFechamentoRaw] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [requerJustificativa, setRequerJustificativa] = useState(false);

  // Estados de Dados da Venda
  const [carrinho, setCarrinho] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:carrinho')) || []; } catch { return []; } });
  const [pagamentos, setPagamentos] = useState([]);

  // Estados de Cliente Unificados
  const [cliente, setCliente] = useState(null);
  const [clienteAvulso, setClienteAvulso] = useState({ nome: '', telefone: '', documento: '' });
  const [descontoTotalRaw, setDescontoTotalRaw] = useState(0);

  // Estados de Busca
  const [busca, setBusca] = useState('');
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);
  const [ultimoPagamentoId, setUltimoPagamentoId] = useState(null);

  // Estados de IA
  const [sugestoesIA, setSugestoesIA] = useState([]);
  const [sugestaoAtiva, setSugestaoAtiva] = useState(null);

  // Modais Flutuantes
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showFechamentoModal, setShowFechamentoModal] = useState(false);
  const [showRupturaModal, setShowRupturaModal] = useState(false);
  const [produtoFaltante, setProdutoFaltante] = useState('');

  // Cálculos Financeiros
  const subtotalItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0), [carrinho]);
  const descontoItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0), [carrinho]);
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);
  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  // Pagamento & Desconto
  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');
  const [descontoInputRaw, setDescontoInputRaw] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('R$');

  // Inicialização
  useEffect(() => {
    const init = async () => {
      try {
        const res = await caixaService.getStatus();
        if (!res || res.status === 'FECHADO' || res.aberto === false) {
          toast.warning("O Caixa está Fechado.", { toastId: 'cx-fechado' });
          navigate('/caixa'); return;
        }
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

  // Foco Automático Inteligente
  useEffect(() => {
      const isModalOpen = showPasswordModal || showExitModal || showFechamentoModal || showRupturaModal || showClienteModal || showDescontoModal;
      if (isModalOpen) {
          if (showClienteModal) setTimeout(() => inputClienteNomeRef.current?.focus(), 50);
          if (showDescontoModal) setTimeout(() => inputDescontoRef.current?.focus(), 50);
          return;
      }
      if (painelAtivo === 'VENDA') setTimeout(() => inputBuscaRef.current?.focus(), 50);
      else if (painelAtivo === 'PAGAMENTO') setTimeout(() => inputValorRef.current?.focus(), 50);
  }, [painelAtivo, showPasswordModal, showExitModal, showFechamentoModal, showRupturaModal, showClienteModal, showDescontoModal]);

  useEffect(() => {
      if (selectedIndex >= 0 && dropdownRef.current) {
          const selectedElement = dropdownRef.current.children[selectedIndex];
          if (selectedElement) selectedElement.scrollIntoView({ block: 'nearest' });
      }
  }, [selectedIndex]);

  // Atalhos de Teclado Globais Otimizados
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            if (showClienteModal) { setShowClienteModal(false); return; }
            if (showDescontoModal) { setShowDescontoModal(false); return; }
            if (showRupturaModal) { setShowRupturaModal(false); return; }
            if (showFechamentoModal) { setShowFechamentoModal(false); return; }
            if (showPasswordModal) { setShowPasswordModal(false); return; }
            if (showExitModal) { setShowExitModal(false); return; }

            setBusca(''); setSugestoesProdutos([]); setDescontoInputRaw('');
            setPainelAtivo('VENDA'); return;
        }

        const isModalOpen = showExitModal || showPasswordModal || showFechamentoModal || showRupturaModal || showClienteModal || showDescontoModal;
        if (isModalOpen) return;

        if (e.key === 'F2') { e.preventDefault(); setPainelAtivo('VENDA'); }
        if (e.key === 'F3') { e.preventDefault(); setShowClienteModal(true); }
        if (e.key === 'F4') { e.preventDefault(); if (carrinho.length > 0) setShowDescontoModal(true); else toast.warn("Carrinho vazio"); }
        if (e.key === 'F8') { e.preventDefault(); if (carrinho.length > 0) iniciarPagamento(); else toast.warn("Carrinho vazio"); }
        if (e.key === 'F9') { e.preventDefault(); setShowRupturaModal(true); }
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
  }, [painelAtivo, carrinho.length, showClienteModal, showDescontoModal, showExitModal, showPasswordModal, showFechamentoModal, showRupturaModal]);

  const cleanNumeric = (v) => (v ? String(v).replace(/\D/g, '') : '');
  const formatCurrencyInput = (v) => String(v).replace(/\D/g, "");
  const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";

  // Motor IA
  const buscarDicaIA = async (produtoId, categoria) => {
    try {
        const response = await api.get(`/caixas/sugestao-ia/${produtoId}`);
        if (response.data && response.data.length > 0) {
            setSugestoesIA(response.data);
            setSugestaoAtiva({ idTrigger: produtoId, categoria: categoria, timestamp: Date.now() });
        } else { setSugestoesIA([]); }
    } catch (error) {}
  };

  const dispensarSugestao = () => { setSugestoesIA([]); };

  const adicionarProdutoPorObjeto = useCallback((prod, foiSugeridoPelaIA = false) => {
      let influencia = 'NENHUMA';
      if (sugestaoAtiva && (Date.now() - sugestaoAtiva.timestamp < 120000)) {
          if (foiSugeridoPelaIA) { influencia = 'DIRETA'; setSugestoesIA([]); }
          else if (prod.categoria === sugestaoAtiva.categoria) { influencia = 'INDIRETA'; }
      }

      setCarrinho(prev => {
          const index = prev.findIndex(i => i.id === prod.id);
          if (index >= 0) {
              const nc = [...prev];
              nc[index].quantidade += 1;
              if (influencia !== 'NENHUMA') nc[index].influenciaIA = influencia;
              return nc;
          }
          return [...prev, { ...prod, quantidade: 1, desconto: 0, influenciaIA: influencia }];
      });

      setBusca(''); setSugestoesProdutos([]); setUltimoItemAdicionadoId(prod.id);
      if (!foiSugeridoPelaIA) buscarDicaIA(prod.id, prod.categoria);

      setTimeout(() => setUltimoItemAdicionadoId(null), 800);
      setTimeout(() => inputBuscaRef.current?.focus(), 100);
  }, [sugestaoAtiva]);

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
      setCarrinho([]); setPagamentos([]); setCliente(null);
      setClienteAvulso({ nome: '', telefone: '', documento: '' });
      setDescontoTotalRaw(0); setPainelAtivo('VENDA'); setBusca(''); setSugestoesProdutos([]);
      setSugestoesIA([]); setSugestaoAtiva(null);
  };

  const handleLimparVenda = () => { if(carrinho.length === 0) return; setShowPasswordModal(true); };

  const confirmarLimpezaComSenha = async () => {
      if (!senhaAdmin) return toast.warning("Digite a senha.");
      try {
          await api.post('/auth/validar-gerente', { senha: senhaAdmin });
          limparEstadoVenda(); setShowPasswordModal(false); setSenhaAdmin(''); toast.success("Venda cancelada.");
      } catch (e) { toast.error("Senha incorreta!"); }
  };

  const registrarVendaPerdida = async () => {
      if (produtoFaltante.trim().length < 3) return toast.warning("Digite o nome do produto.");
      setLoading(true);
      try {
          await api.post('/caixas/venda-perdida', { produto: produtoFaltante });
          toast.success("Ruptura registada. Dashboard atualizado!");
          setShowRupturaModal(false); setProdutoFaltante('');
          setTimeout(() => inputBuscaRef.current?.focus(), 50);
      } catch (err) { toast.error("Erro ao registar a venda perdida."); }
      finally { setLoading(false); }
  };

  const handleSolicitarFechamento = () => {
      if (carrinho.length > 0) return toast.warning("Cancele a venda atual antes de fechar.");
      setShowFechamentoModal(true); setRequerJustificativa(false); setJustificativa('');
  };

  const confirmarFechamentoCaixa = async () => {
      if (requerJustificativa && justificativa.trim().length < 10) return toast.warning("Justificativa muito curta.");
      setLoading(true);
      try {
          const valorInformado = parseInt(valorFechamentoRaw.replace(/\D/g, '') || '0', 10) / 100;
          await api.post('/caixas/fechar', { valorFisicoInformado: valorInformado, justificativaDiferenca: justificativa.trim() !== '' ? justificativa : null });
          toast.success("Caixa fechado com sucesso.");
          setShowFechamentoModal(false); limparEstadoVenda(); navigate('/caixa');
      } catch (error) {
          if (error.response?.status === 428 || error.response?.data?.message?.toLowerCase().includes("justificativa")) {
              setRequerJustificativa(true); toast.warning("Divergência. Justifique.");
          } else { toast.error("Erro ao fechar o caixa."); }
      } finally { setLoading(false); }
  };

  // Lógica de Cliente e Fidelidade
  const handleBlurDocumento = async () => {
      const docLimpo = cleanNumeric(clienteAvulso.documento);
      if (docLimpo.length === 14 && !clienteAvulso.nome) {
          setLoading(true);
          try {
              const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${docLimpo}`);
              const data = await res.json();
              setClienteAvulso(prev => ({ ...prev, nome: data.razao_social || '' }));
              toast.success("CNPJ Localizado!");
          } catch (e) {
              toast.warning("CNPJ não encontrado na base de dados.");
          } finally { setLoading(false); }
      }
  };

  const handleSalvarCliente = async () => {
      const docLimpo = cleanNumeric(clienteAvulso.documento);
      const telLimpo = cleanNumeric(clienteAvulso.telefone);

      // Proteção: Se apertou Enter rápido sem dar blur no CNPJ
      if (docLimpo.length === 14 && !clienteAvulso.nome) {
          setLoading(true);
          try {
              const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${docLimpo}`);
              const data = await res.json();
              setClienteAvulso(prev => ({ ...prev, nome: data.razao_social || '' }));
              toast.success("CNPJ Localizado!");
          } catch (e) {
              toast.warning("CNPJ não encontrado na Receita.");
          } finally { setLoading(false); }
          return;
      }

      if (!clienteAvulso.nome && !telLimpo && !docLimpo) {
          toast.info("Venda sem identificação (Consumidor Final).");
      } else {
          toast.success("Cliente vinculado à venda!");
      }

      setShowClienteModal(false);
      if (painelAtivo === 'VENDA') setTimeout(() => inputBuscaRef.current?.focus(), 50);
      if (painelAtivo === 'PAGAMENTO') setTimeout(() => inputValorRef.current?.focus(), 50);
  };

  const handleRemoverCliente = () => {
      setCliente(null);
      setClienteAvulso({ nome: '', telefone: '', documento: '' });
      toast.info("Identificação removida.");
      setShowClienteModal(false);
      if (painelAtivo === 'VENDA') setTimeout(() => inputBuscaRef.current?.focus(), 50);
      if (painelAtivo === 'PAGAMENTO') setTimeout(() => inputValorRef.current?.focus(), 50);
  };

  // Funções de Desconto e Pagamento
  const aplicarDescontoGlobal = () => {
      const valorBase = parseInt(descontoInputRaw || '0', 10) / 100;
      let valorReal = 0;

      if (valorBase > 0) {
          valorReal = (tipoDesconto === '%') ? subtotalItens * (valorBase / 100) : valorBase;
          if (tipoDesconto === '%' && valorBase > 100) return toast.error("Máximo é 100%");
          if (tipoDesconto === 'R$' && valorBase > subtotalItens) return toast.error("Maior que o subtotal");
          setDescontoTotalRaw(valorReal);
          toast.success("Desconto aplicado!");
      } else {
          setDescontoTotalRaw(0);
          toast.info("Desconto removido.");
      }

      setDescontoInputRaw('');
      setShowDescontoModal(false);

      if (painelAtivo === 'PAGAMENTO') {
          const novoTotal = Math.max(0, subtotalItens - descontoItens - valorReal);
          const novoSaldo = Math.max(0, parseFloat((novoTotal - totalPago).toFixed(2)));
          setValorInputRaw((Math.round(novoSaldo * 100)).toString());
          setTimeout(() => inputValorRef.current?.focus(), 50);
      } else {
          setTimeout(() => inputBuscaRef.current?.focus(), 50);
      }
  };

  const iniciarPagamento = () => {
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
      toast.info(`R$ ${valor.toFixed(2)} em ${metodoAtual}`, { autoClose: 1500, position: "top-center" });
      setTimeout(() => setUltimoPagamentoId(null), 1000);

      const novoSaldo = Math.max(0, saldoDevedor - valor);
      if (novoSaldo > 0) {
          setValorInputRaw((Math.round(novoSaldo * 100)).toString());
          setTimeout(() => inputValorRef.current?.focus(), 50);
      } else { setValorInputRaw(''); }
  };

  const handleRemoverPagamento = (id) => {
      const novosPagamentos = pagamentos.filter(x => x.id !== id);
      setPagamentos(novosPagamentos);
      const novoTotalPago = novosPagamentos.reduce((acc, p) => acc + p.valor, 0);
      const novoSaldo = Math.max(0, parseFloat((totalPagar - novoTotalPago).toFixed(2)));
      if (novoSaldo > 0) setValorInputRaw((Math.round(novoSaldo * 100)).toString());
  };

  const finalizarVendaReal = async (pagamentosFinais = pagamentos) => {
      const saldoFinal = totalPagar - pagamentosFinais.reduce((acc, p) => acc + p.valor, 0);
      if (saldoFinal > 0.01) return toast.error(`Falta R$ ${saldoFinal.toFixed(2)}`);

      if (totalPagar >= 5000 && !cliente && !cleanNumeric(clienteAvulso.documento)) {
          toast.error("SEFAZ: Vendas acima de R$ 5.000 exigem CPF/CNPJ.");
          setShowClienteModal(true); return;
      }
      setLoading(true);
      try {
          const payloadVenda = {
              subtotal: subtotalItens, descontoTotal: descontoItens + descontoTotalRaw,
              totalPago: totalPagar, troco: Math.max(0, parseFloat((pagamentosFinais.reduce((acc, p) => acc + p.valor, 0) - totalPagar).toFixed(2))),
              clienteId: cliente ? cliente.id : null,
              clienteNome: cliente ? cliente.nome : (clienteAvulso.nome || 'Consumidor Final'),
              clienteDocumento: cliente ? cliente.documento : (cleanNumeric(clienteAvulso.documento) || null),
              clienteTelefone: cleanNumeric(clienteAvulso.telefone) || null,
              itens: carrinho.map(item => ({ produtoId: item.id, quantidade: item.quantidade, precoUnitario: item.precoVenda, desconto: item.desconto || 0, influenciaIA: item.influenciaIA || 'NENHUMA' })),
              pagamentos: pagamentosFinais.map(p => ({ formaPagamento: p.tipo, valor: p.valor, parcelas: 1 }))
          };
          await api.post('/vendas', payloadVenda);
          toast.success("Venda Finalizada com Sucesso!");
          limparEstadoVenda();
      } catch (error) { toast.error(error.response?.data?.message || "Erro ao registrar a venda."); }
      finally { setLoading(false); }
  };

  let nomeExibicaoCliente = 'Consumidor Final';
  if (cliente) {
      nomeExibicaoCliente = cliente.nome;
  } else if (clienteAvulso.nome || clienteAvulso.telefone || clienteAvulso.documento) {
      const partes = [];
      if (clienteAvulso.nome) partes.push(clienteAvulso.nome);
      if (clienteAvulso.telefone) partes.push(clienteAvulso.telefone);
      if (clienteAvulso.documento) partes.push(clienteAvulso.documento);
      nomeExibicaoCliente = partes.join(' - ');
  }

  if (validandoCaixa) return <div className="pos-loader"><div className="pos-spinner"></div><h2 className="pos-loader-title">Iniciando Terminal</h2></div>;

  return (
    <div className="pos-container">
      <section className="pos-cart-section">
          <header className="pos-header">
              <div className="pos-brand">
                  <div className="brand-badge">DD</div>
                  <div className="brand-text">
                      <h1>DD Cosméticos</h1>
                      <span>{isOnline ? 'Terminal Online' : 'Terminal Offline'} • {getUserRole()}</span>
                  </div>
              </div>
              <div className="pos-header-actions pos-flex-gap">
                  <button className="btn-exit btn-exit-danger" onClick={handleSolicitarFechamento} title="Encerrar o Turno">
                      <LogOut size={18}/> Fechar Caixa
                  </button>
                  <button className="btn-exit" onClick={() => carrinho.length ? setShowExitModal(true) : navigate('/dashboard')} title="Sair do Terminal">
                      <ArrowLeft size={18}/> Sair
                  </button>
              </div>
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
                                  <strong>
                                      {item.influenciaIA !== 'NENHUMA' && <Sparkles size={16} className="ia-icon-inline" title="Sugerido pela IA" />}
                                      {item.descricao}
                                  </strong>
                                  <span>{item.codigoBarras || 'SEM GTIN'}</span>
                              </div>
                              <div className="item-price-calc">
                                  <div className="item-unit-price">R$ {item.precoVenda.toFixed(2)}</div>
                                  <div className="item-qty-control">
                                      <button onClick={() => atualizarQtd(item.id, -1)}><Minus size={20}/></button>
                                      <span>{item.quantidade}</span>
                                      <button onClick={() => atualizarQtd(item.id, 1)}><Plus size={20}/></button>
                                  </div>
                              </div>
                              <div className="item-total">R$ {(item.precoVenda * item.quantidade).toFixed(2)}</div>
                              <button className="item-remove" onClick={() => removerItem(item.id)}><Trash2 size={24}/></button>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <footer className="pos-cart-footer">
              <div className="footer-calc">
                  <div className="calc-row text-muted"><span>Subtotal dos itens</span> <span>R$ {subtotalItens.toFixed(2)}</span></div>
                  {descontoTotalRaw > 0 && (
                      <div className="calc-row text-pink">
                          <span className="flex-center-gap">
                              Descontos <button onClick={() => { setDescontoTotalRaw(0); setDescontoInputRaw(''); }} className="btn-remove-discount"><Trash2 size={16}/></button>
                          </span>
                          <span>- R$ {descontoTotalRaw.toFixed(2)}</span>
                      </div>
                  )}
                  <div className="calc-row grand-total">
                      <span>TOTAL A PAGAR</span>
                      <span className="total-value">R$ {totalPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
              </div>
          </footer>
      </section>

      <section className="pos-action-section">
          {painelAtivo === 'VENDA' && (
              <div className="action-panel panel-venda animate-fade">
                  <div className="search-premium-box">
                      <Search className="sp-icon" size={32}/>
                      <input ref={inputBuscaRef} type="text" className="sp-input" placeholder="Buscar produto (F2)..." value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={handleSearchKeyDown} autoComplete="off" />
                      {busca && <button className="sp-clear" onClick={() => {setBusca(''); inputBuscaRef.current?.focus();}}><X size={26}/></button>}
                      {sugestoesProdutos.length > 0 && (
                          <div className="sp-dropdown" ref={dropdownRef}>
                              {sugestoesProdutos.map((prod, idx) => (
                                  <div key={prod.id} className={`spd-row ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => adicionarProdutoPorObjeto(prod)}>
                                      <div className="spd-info"><strong>{prod.descricao}</strong><span>{prod.codigoBarras}</span></div>
                                      <div className="spd-price">R$ {prod.precoVenda.toFixed(2)}</div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>

                  {sugestoesIA.length > 0 && (
                      <div className="ia-suggestion-card">
                          <div className="ia-header">
                              <Sparkles size={20} color="#8b5cf6" />
                              <span>Oferecer para complementar:</span>
                          </div>
                          <ul className="ia-list">
                              {sugestoesIA.map((sugestaoNome, idx) => (
                                  <li key={idx} className="ia-item">
                                      <span className="ia-item-text">{sugestaoNome}</span>
                                      <div className="ia-item-actions">
                                          <button className="ia-btn-reject" onClick={dispensarSugestao}><X size={18}/></button>
                                          <button className="ia-btn-accept" onClick={() => { toast.info(`Buscando: ${sugestaoNome}`); }}><Check size={18}/></button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  )}

                  <div className="customer-soft-card" onClick={() => setShowClienteModal(true)}>
                      <div className="csc-icon"><UserCheck size={32}/></div>
                      <div className="csc-info"><label>Clube de Fidelidade</label><strong>{nomeExibicaoCliente}</strong></div>
                      <ChevronRight className="csc-arrow" size={30}/>
                  </div>

                  <div className="quick-actions-grid">
                      <button className="qa-btn" onClick={() => setShowClienteModal(true)}><kbd>F3</kbd> <span>Cliente</span></button>
                      <button className="qa-btn" onClick={() => { if(carrinho.length) setShowDescontoModal(true); else toast.warn("Carrinho vazio"); }}><kbd>F4</kbd> <span>Desconto</span></button>
                      <button className="qa-btn" onClick={() => setShowRupturaModal(true)}><kbd>F9</kbd> <span>Faltou Produto</span></button>
                      <button className="qa-btn btn-cancel-venda" onClick={handleLimparVenda} disabled={!carrinho.length}><kbd className="kbd-danger">DEL</kbd> <span>Cancelar</span></button>
                  </div>

                  <button className="btn-checkout-soft" disabled={!carrinho.length} onClick={iniciarPagamento}>
                      <div className="bcs-content"><span className="bcs-label">IR PARA PAGAMENTO</span><span className="bcs-shortcut">Aperte F8</span></div>
                      <div className="bcs-icon"><ArrowRight size={40}/></div>
                  </button>
              </div>
          )}

          {painelAtivo === 'PAGAMENTO' && (
              <div className="action-panel panel-pagamento animate-slide-left">
                  <header className="panel-header">
                      <button className="btn-voltar" onClick={() => setPainelAtivo('VENDA')}><ArrowLeft size={24}/> VOLTAR (ESC)</button>
                      <h2>Concluir Venda</h2>
                  </header>

                  <div className="payment-quick-actions mb-4 pos-flex-gap">
                      <button className="pqa-btn" onClick={() => setShowClienteModal(true)}>
                          <UserCheck size={18}/> {clienteAvulso.nome || clienteAvulso.telefone || clienteAvulso.documento ? 'Cliente OK' : 'Cliente (F3)'}
                      </button>
                      <button className="pqa-btn" onClick={() => setShowDescontoModal(true)}>
                          <Tag size={18}/> {descontoTotalRaw > 0 ? 'Desconto OK' : 'Desconto (F4)'}
                      </button>
                  </div>

                  <div className="payment-methods-grid">
                      {[{id: 'PIX', key: '1', icon: <Smartphone size={24}/>, label: 'Pix'}, {id: 'DINHEIRO', key: '2', icon: <Banknote size={24}/>, label: 'Dinheiro'}, {id: 'CREDITO', key: '3', icon: <CreditCard size={24}/>, label: 'Crédito'}, {id: 'DEBITO', key: '4', icon: <CreditCard size={24}/>, label: 'Débito'}].map(m => (
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
                          <button className="pia-btn" onClick={handleAdicionarPagamento}><CheckCircle2 size={36}/></button>
                      </div>
                  </div>

                  <div className="payment-logs-soft">
                      {pagamentos.map(p => (
                          <div key={p.id} className={`pls-row ${ultimoPagamentoId === p.id ? 'flash-payment' : ''}`}>
                              <span className="pls-type">{p.tipo}</span><strong className="pls-val">R$ {p.valor.toFixed(2)}</strong>
                              <button onClick={() => handleRemoverPagamento(p.id)}><Trash2 size={22}/></button>
                          </div>
                      ))}
                  </div>

                  <div className="payment-footer-soft">
                      <div className="pfs-row"><span>Falta Receber:</span> <strong className="val-red">R$ {saldoDevedor.toFixed(2)}</strong></div>
                      <div className="pfs-row"><span>Troco do Cliente:</span> <strong className="val-green">R$ {troco.toFixed(2)}</strong></div>
                      <button className="btn-checkout-finish" disabled={saldoDevedor > 0.01 || loading} onClick={() => finalizarVendaReal(pagamentos)}>
                          <div className="bcf-content"><span className="bcf-label">{loading ? 'EMITINDO...' : 'FINALIZAR VENDA'}</span><span className="bcf-shortcut">ENTER</span></div>
                      </button>
                  </div>
              </div>
          )}
      </section>

      {/* ========================================================== */}
      {/* MODAIS FLUTUANTES GLOBAIS                                  */}
      {/* ========================================================== */}

      {showClienteModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm fade-in">
                  <div className="icon-circle mx-auto mb-4"><HeartHandshake size={50}/></div>
                  <h2 className="title-main mb-2">Clube de Vantagens</h2>
                  <p className="subtitle-sec mb-4 text-md">Vincule a venda para acumular recorrência.</p>

                  <div className="text-left w-full">
                      <label className="form-label">NOME / APELIDO (Opcional)</label>
                      <input ref={inputClienteNomeRef} className="mg-input mb-3" placeholder="Ex: Maria" value={clienteAvulso.nome} onChange={e => setClienteAvulso({...clienteAvulso, nome: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleSalvarCliente()} />

                      <label className="form-label flex-center-gap"><Phone size={14}/> WHATSAPP (Recomendado)</label>
                      <input className="mg-input mb-3" placeholder="(81) 9..." value={clienteAvulso.telefone} onChange={e => setClienteAvulso({...clienteAvulso, telefone: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleSalvarCliente()} />

                      <label className="form-label">CPF / CNPJ (P/ Nota Fiscal)</label>
                      <input className="mg-input mb-4" placeholder="Apenas números..." value={clienteAvulso.documento} onChange={e => setClienteAvulso({...clienteAvulso, documento: e.target.value})} onBlur={handleBlurDocumento} onKeyDown={e => e.key === 'Enter' && handleSalvarCliente()} />
                  </div>

                  <div className="mg-actions mt-2 justify-center pos-flex-gap w-full">
                      <button className="mg-btn cancel" onClick={handleRemoverCliente} title="Limpar dados do cliente"><UserX size={20}/> Limpar</button>
                      <button className="mg-btn confirm" onClick={handleSalvarCliente}>Salvar (Enter)</button>
                  </div>
              </div>
          </div>
      )}

      {showDescontoModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm fade-in">
                  <div className="icon-circle mx-auto mb-4"><Tag size={50}/></div>
                  <h2 className="title-main mb-2">Aplicar Desconto</h2>
                  <p className="subtitle-sec mb-4 text-md">Para remover, digite 0.</p>

                  <div className="toggle-soft mt-4 mb-4">
                      <button className={tipoDesconto === 'R$' ? 'active' : ''} onClick={() => { setTipoDesconto('R$'); inputDescontoRef.current?.focus(); }}>R$ Fixo</button>
                      <button className={tipoDesconto === '%' ? 'active' : ''} onClick={() => { setTipoDesconto('%'); inputDescontoRef.current?.focus(); }}>% Porc.</button>
                  </div>
                  <div className="input-giant-wrapper">
                      <span>{tipoDesconto}</span>
                      <input ref={inputDescontoRef} value={getValorFormatado(descontoInputRaw)} onChange={e => setDescontoInputRaw(formatCurrencyInput(e.target.value))} onKeyDown={e => e.key === 'Enter' && aplicarDescontoGlobal()} placeholder="0,00" />
                  </div>

                  <div className="mg-actions mt-6 justify-center pos-flex-gap">
                      <button className="mg-btn cancel" onClick={() => { setShowDescontoModal(false); if (painelAtivo === 'VENDA') inputBuscaRef.current?.focus(); else inputValorRef.current?.focus(); }}>Cancelar</button>
                      <button className="mg-btn confirm" onClick={aplicarDescontoGlobal}>Aplicar (Enter)</button>
                  </div>
              </div>
          </div>
      )}

      {showRupturaModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm fade-in">
                  <TrendingDown size={60} className="mg-icon danger mx-auto mb-3" />
                  <h3 className="text-danger font-bold text-xxl mb-2">Produto em Falta</h3>
                  <p className="text-sec mb-4 text-md">O que o cliente pediu e nós não temos?</p>
                  <input type="text" className="mg-input mb-4 text-center" placeholder="Ex: Creme Niina Secrets..." value={produtoFaltante} onChange={e => setProdutoFaltante(e.target.value)} onKeyDown={e => e.key === 'Enter' && registrarVendaPerdida()} autoFocus />
                  <div className="mg-actions mt-2 justify-center pos-flex-gap">
                      <button className="mg-btn cancel" onClick={() => { setShowRupturaModal(false); setProdutoFaltante(''); }}>Voltar</button>
                      <button className="mg-btn danger" disabled={produtoFaltante.trim().length < 3 || loading} onClick={registrarVendaPerdida}>{loading ? 'Avisando...' : 'Avisar Compras'}</button>
                  </div>
              </div>
          </div>
      )}

      {showFechamentoModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center mg-closing-card" style={{ maxWidth: requerJustificativa ? '500px' : '450px', transition: 'max-width 0.3s' }}>
                  <LogOut size={requerJustificativa ? 50 : 60} className={`mg-icon ${requerJustificativa ? 'warning' : 'danger'} mx-auto mb-4`} style={{ transition: 'all 0.3s' }} />
                  <h3 className={`font-bold text-xxl mb-3 ${requerJustificativa ? 'text-warning' : 'text-danger'}`}>{requerJustificativa ? 'Divergência de Valores' : 'Encerrar Turno e Fechar Caixa?'}</h3>
                  {!requerJustificativa ? (
                      <p className="text-lg text-sec mb-6" style={{ lineHeight: '1.5' }}>Conte o dinheiro físico na gaveta e digite o valor exato abaixo.</p>
                  ) : (
                      <p className="text-md text-sec mb-4" style={{ lineHeight: '1.5' }}>O valor de <strong>{getValorFormatado(valorFechamentoRaw)}</strong> não confere.<br/>Justifique o motivo.</p>
                  )}
                  <div className="mg-closing-input-wrapper" style={{ marginBottom: requerJustificativa ? '1rem' : '2rem' }}>
                      <span className="mg-closing-currency">R$</span>
                      <input type="text" className="mg-closing-input" value={getValorFormatado(valorFechamentoRaw)} onChange={e => { setValorFechamentoRaw(formatCurrencyInput(e.target.value)); setRequerJustificativa(false); }} onKeyDown={e => !requerJustificativa && e.key === 'Enter' && confirmarFechamentoCaixa()} placeholder="0,00" disabled={requerJustificativa} autoFocus={!requerJustificativa} />
                  </div>
                  {requerJustificativa && (
                      <div className="fade-in mb-4 text-left">
                          <label className="label-justificativa">JUSTIFICATIVA OBRIGATÓRIA</label>
                          <textarea className="mg-input w-full tx-justificativa" rows="3" placeholder="Ex: Dei troco a mais..." value={justificativa} onChange={(e) => setJustificativa(e.target.value)} autoFocus />
                      </div>
                  )}
                  <div className="mg-actions mt-2 justify-center pos-flex-gap">
                      <button className="mg-btn cancel" onClick={() => { setShowFechamentoModal(false); setValorFechamentoRaw(''); setRequerJustificativa(false); }} disabled={loading}>Voltar</button>
                      <button className={`mg-btn font-bold ${requerJustificativa ? 'warning' : 'danger'}`} onClick={confirmarFechamentoCaixa} disabled={loading}>{loading ? 'Verificando...' : (requerJustificativa ? 'Enviar e Fechar' : 'Sim, Fechar Caixa')}</button>
                  </div>
              </div>
          </div>
      )}

      {showPasswordModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm">
                  <ShieldCheck size={60} className="mg-icon danger mx-auto mb-3" />
                  <h3 className="text-danger font-bold text-xxl">Autorização Gerencial</h3>
                  <p className="text-lg text-sec mb-4 text-small">Senha para cancelar a venda atual.</p>
                  <input type="password" className="mg-input text-center tracking-widest text-xxl py-3" placeholder="••••" value={senhaAdmin} onChange={e => setSenhaAdmin(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmarLimpezaComSenha()} autoFocus />
                  <div className="mg-actions mt-6 justify-center pos-flex-gap">
                      <button className="mg-btn cancel" onClick={() => { setShowPasswordModal(false); setSenhaAdmin(''); }}>Voltar</button>
                      <button className="mg-btn danger" disabled={!senhaAdmin} onClick={confirmarLimpezaComSenha}>Autorizar</button>
                  </div>
              </div>
          </div>
      )}

      {showExitModal && (
          <div className="modal-glass">
              <div className="modal-glass-card text-center sm">
                  <h3 className="text-main font-bold text-xxl">Sair do Terminal?</h3>
                  <p className="text-lg text-sec mb-4 mt-2 text-small">O seu caixa continuará <strong>Aberto</strong>, mas a venda atual será perdida.</p>
                  <div className="mg-actions mt-6 justify-center pos-flex-gap">
                      <button className="mg-btn cancel" onClick={() => setShowExitModal(false)}>Ficar</button>
                      <button className="mg-btn confirm" onClick={() => navigate('/dashboard')}>Sair</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PDV;