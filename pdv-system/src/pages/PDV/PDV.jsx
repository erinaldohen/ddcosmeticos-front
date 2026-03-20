import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Plus, Minus, ArrowLeft, X, UserCheck, ArrowRight, Banknote, Smartphone,
  CreditCard, Tag, ShoppingBag, CheckCircle2, LogOut, TrendingDown,
  Camera, Printer, MessageCircle, Mail, AlertTriangle, ChevronUp, PauseCircle, PlayCircle, Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';
import caixaService from '../../services/caixaService';
import './PDV.css';

// ==========================================================
// UTILITÁRIOS
// ==========================================================
const mascaraTelefone = (v) => {
    if (!v) return ''; let val = v.replace(/\D/g, '');
    if (val.length <= 10) return val.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return val.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
};

const mascaraDocumento = (v) => {
    if (!v) return ''; let val = v.replace(/\D/g, '');
    if (val.length <= 11) return val.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return val.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18);
};

const cleanNumeric = (v) => (v ? String(v).replace(/\D/g, '') : '');
const formatCurrencyInput = (v) => String(v).replace(/\D/g, "");
const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";

const playAudio = (type = 'success') => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = type === 'success' ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(type === 'success' ? 850 : 150, audioCtx.currentTime);
        osc.connect(audioCtx.destination); osc.start(); setTimeout(() => osc.stop(), type === 'success' ? 120 : 300);
    } catch (e) {}
};

// ==========================================================
// CÂMERA MOBILE
// ==========================================================
const ScannerModal = ({ onProcessScan, onClose }) => {
    const lastScannedRef = useRef({ code: '', time: 0 });

    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader-core");
        html5QrCode.start(
            { facingMode: "environment" },
            { fps: 15, qrbox: { width: 250, height: 120 }, aspectRatio: 1.0 },
            (decodedText) => {
                const valorLimpo = decodedText.replace(/[^a-zA-Z0-9]/g, '');
                const now = Date.now();
                if (lastScannedRef.current.code === valorLimpo && (now - lastScannedRef.current.time < 2000)) return;
                lastScannedRef.current = { code: valorLimpo, time: now };
                onProcessScan(valorLimpo);
            },
            () => {}
        ).catch(() => toast.error("Câmera bloqueada ou indisponível."));

        return () => { if (html5QrCode.isScanning) html5QrCode.stop().catch(() => {}); };
    }, [onProcessScan]);

    return (
        <div className="modal-glass z-max">
            <div className="modal-glass-card sm text-center fade-in bg-dark-glass">
                <h3 className="title-main mb-4 text-white">Escaneie o Código</h3>
                <div className="scanner-viewport">
                    <div id="reader-core" className="reader-core"></div>
                    <div className="scanner-overlay"></div>
                    <div className="scanner-laser"></div>
                </div>
                <button className="btn-cancel-dark mt-4" onClick={onClose}>Fechar Câmera</button>
            </div>
        </div>
    );
};

// ==========================================================
// COMPONENTE PRINCIPAL: PDV
// ==========================================================
const PDV = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 992);
  const [horaAtual, setHoraAtual] = useState(new Date());

  // LOG DE AUDITORIA (ANTI-FRAUDE)
  const [auditLog, setAuditLog] = useState([]);

  const registrarAcaoAuditoria = useCallback((acao, detalhes) => {
      const hora = new Date();
      setAuditLog(prev => [...prev, {
          acao, detalhes,
          hora: hora.toLocaleTimeString('pt-BR', { hour12: false }) + ':' + hora.getMilliseconds()
      }]);
  }, []);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth <= 992);
      window.addEventListener('resize', handleResize);
      const timer = setInterval(() => setHoraAtual(new Date()), 1000);
      return () => { window.removeEventListener('resize', handleResize); clearInterval(timer); };
  }, []);

  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);
  const dropdownRef = useRef(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileViewState, setMobileView] = useState('SCAN');
  const [validandoCaixa, setValidandoCaixa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(null);

  const [vendasPausadas, setVendasPausadas] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:pausadas')) || []; } catch { return []; } });
  const [showPausadasModal, setShowPausadasModal] = useState(false);

  const [carrinho, setCarrinho] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:carrinho')) || []; } catch { return []; } });
  const [pagamentos, setPagamentos] = useState([]);
  const [clienteAvulso, setClienteAvulso] = useState({ nome: '', telefone: '', documento: '' });
  const [descontoTotalRaw, setDescontoTotalRaw] = useState(0);

  const [busca, setBusca] = useState('');
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const [showCadastroRapido, setShowCadastroRapido] = useState(false);
  const [produtoRapido, setProdutoRapido] = useState({ codigoBarras: '', descricao: '', precoVendaRaw: '', categoria: '' });
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [descontoInputRaw, setDescontoInputRaw] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('R$');

  const [showRupturaModal, setShowRupturaModal] = useState(false);
  const [produtoFaltante, setProdutoFaltante] = useState('');

  const [showExitModal, setShowExitModal] = useState(false);

  const [showFechamentoModal, setShowFechamentoModal] = useState(false);
  const [valorFechamentoRaw, setValorFechamentoRaw] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [requerJustificativa, setRequerJustificativa] = useState(false);

  const [showZapModal, setShowZapModal] = useState(false);
  const [zapNumber, setZapNumber] = useState('');

  const subtotalItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0), [carrinho]);
  const descontoItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0), [carrinho]);
  const totalQuantidade = useMemo(() => carrinho.reduce((acc, item) => acc + item.quantidade, 0), [carrinho]);
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);
  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true); const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline); window.addEventListener('offline', handleOffline);
    caixaService.getStatus().then(res => {
        if (!res || res.status === 'FECHADO' || !res.aberto) { toast.warning("O Caixa está Fechado."); navigate('/caixa'); }
        else setValidandoCaixa(false);
    }).catch(() => { toast.error("Erro ao validar caixa."); navigate('/dashboard'); });
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [navigate]);

  useEffect(() => { localStorage.setItem('@dd:carrinho', JSON.stringify(carrinho)); }, [carrinho]);
  useEffect(() => { localStorage.setItem('@dd:pausadas', JSON.stringify(vendasPausadas)); }, [vendasPausadas]);

  useEffect(() => {
      if (isMobile) return;
      const isModalOpen = showExitModal || showFechamentoModal || showClienteModal || showDescontoModal || showScanner || showCadastroRapido || showRupturaModal || showPausadasModal || showZapModal || vendaFinalizada;
      if (!isModalOpen) {
          if (mobileViewState === 'SCAN') setTimeout(() => inputBuscaRef.current?.focus(), 50);
          else if (mobileViewState === 'PAYMENT') setTimeout(() => inputValorRef.current?.focus(), 50);
      }
  }, [mobileViewState, showExitModal, showFechamentoModal, showClienteModal, showDescontoModal, showScanner, showCadastroRapido, showRupturaModal, showPausadasModal, showZapModal, vendaFinalizada, isMobile]);

  useEffect(() => {
      if (selectedIndex >= 0 && dropdownRef.current) {
          const el = dropdownRef.current.children[selectedIndex];
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
  }, [selectedIndex]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
              e.preventDefault();
              if (showZapModal) { setShowZapModal(false); return; }
              if (vendaFinalizada) { setVendaFinalizada(null); limparEstadoVenda(); return; }
              if (showClienteModal) { setShowClienteModal(false); return; }
              if (showDescontoModal) { setShowDescontoModal(false); return; }
              if (showRupturaModal) { setShowRupturaModal(false); return; }
              if (showFechamentoModal) { setShowFechamentoModal(false); return; }
              if (showExitModal) { setShowExitModal(false); return; }
              if (showScanner) { setShowScanner(false); return; }
              if (showCadastroRapido) { setShowCadastroRapido(false); setBusca(''); return; }
              if (showPausadasModal) { setShowPausadasModal(false); return; }
              setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); setMobileView('SCAN'); return;
          }

          const isModalOpen = showExitModal || showFechamentoModal || showRupturaModal || showClienteModal || showDescontoModal || showScanner || showCadastroRapido || showPausadasModal || showZapModal || vendaFinalizada;
          if (isModalOpen) return;

          if (e.key === 'F2') { e.preventDefault(); setMobileView('SCAN'); }
          if (e.key === 'F3') { e.preventDefault(); setShowClienteModal(true); }
          if (e.key === 'F4') { e.preventDefault(); if (carrinho.length > 0) setShowDescontoModal(true); else toast.warn("Carrinho vazio"); }
          if (e.key === 'F8') { e.preventDefault(); if (carrinho.length > 0) { setMobileView('PAYMENT'); setValorInputRaw(Math.round(saldoDevedor * 100).toString()); } else toast.warn("Carrinho vazio"); }
          if (e.key === 'F9') { e.preventDefault(); setShowRupturaModal(true); }
          if (e.key === 'Delete' && mobileViewState === 'SCAN') { e.preventDefault(); handleLimparVenda(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileViewState, carrinho.length, showClienteModal, showDescontoModal, showExitModal, showFechamentoModal, showRupturaModal, showScanner, showCadastroRapido, showPausadasModal, showZapModal, vendaFinalizada, saldoDevedor]);

  // ==========================================================
  // LOGICA DO CARRINHO E AUDITORIA
  // ==========================================================
  const adicionarProdutoAoCarrinho = useCallback((prod) => {
      playAudio('success');
      setUltimoItemAdicionadoId(null);
      setTimeout(() => setUltimoItemAdicionadoId(prod.id), 10);
      setTimeout(() => setUltimoItemAdicionadoId(null), 800);

      setCarrinho(prev => {
          const index = prev.findIndex(i => i.id === prod.id);
          if (index >= 0) {
              registrarAcaoAuditoria('AUMENTOU_QTD', `Produto: ${prod.descricao} (+1)`);
              const nc = [...prev]; nc[index] = { ...nc[index], quantidade: nc[index].quantidade + 1 }; return nc;
          }
          registrarAcaoAuditoria('ADICIONOU_PRODUTO', `Produto: ${prod.descricao} | Valor: R$ ${prod.precoVenda}`);
          return [...prev, { ...prod, quantidade: 1, desconto: 0 }];
      });

      setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1);
      if (inputBuscaRef.current) inputBuscaRef.current.value = '';
  }, [registrarAcaoAuditoria]);

  useEffect(() => {
      if (busca.trim().length < 3) { setSugestoesProdutos([]); setSelectedIndex(-1); return; }
      const delay = setTimeout(async () => {
          try { const { data } = await api.get(`/produtos?termo=${busca}&size=15`); setSugestoesProdutos(data.content || data); setSelectedIndex(-1); } catch (error) {}
      }, 300);
      return () => clearTimeout(delay);
  }, [busca]);

  const processarEAN = async (valorRaw) => {
      const valor = valorRaw.replace(/[^a-zA-Z0-9]/g, '');
      if (!valor) return;
      try {
          const { data } = await api.get(`/produtos/ean/${valor}`);
          let produto = Array.isArray(data) ? data[0] : data;
          if (produto && (produto.id || produto.codigoBarras)) { adicionarProdutoAoCarrinho(produto); }
          else { throw new Error("Não encontrado"); }
      } catch (err) {
          playAudio('error');
          toast.warning("Produto não cadastrado! Preencha rápido.");
          setBusca(''); if (inputBuscaRef.current) inputBuscaRef.current.value = '';
          setProdutoRapido({ codigoBarras: valor, descricao: '', precoVendaRaw: '', categoria: '' });
          setShowCadastroRapido(true);
      }
  };

  const handleSearchKeyDown = (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => Math.min(prev + 1, sugestoesProdutos.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => Math.max(prev - 1, 0)); }
      else if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedIndex >= 0 && sugestoesProdutos[selectedIndex]) { adicionarProdutoAoCarrinho(sugestoesProdutos[selectedIndex]); }
          else { const valorExato = e.currentTarget.value; setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); processarEAN(valorExato); }
      }
  };

  const atualizarQtd = (id, d) => {
      setCarrinho(prev => prev.map(i => {
          if (i.id === id) {
              const novaQtd = Math.max(1, i.quantidade + d);
              registrarAcaoAuditoria(d > 0 ? 'AUMENTOU_QTD' : 'DIMINUIU_QTD', `Produto ID: ${id} | Nova Qtd: ${novaQtd}`);
              return { ...i, quantidade: novaQtd };
          }
          return i;
      }));
  };

  const removerItem = (id) => {
      const item = carrinho.find(i => i.id === id);
      if (item) registrarAcaoAuditoria('REMOVER_PRODUTO', `Produto: ${item.descricao} removido do carrinho.`);
      setCarrinho(prev => prev.filter(i => i.id !== id));
  };

  const limparEstadoVenda = () => {
      setCarrinho([]); setPagamentos([]); setClienteAvulso({ nome: '', telefone: '', documento: '' });
      setDescontoTotalRaw(0); setMobileView('SCAN'); setBusca(''); setAuditLog([]);
  };

  const handleLimparVenda = () => {
      if(carrinho.length === 0) return;
      setShowExitModal(true);
  };

  const confirmarAbandonoVenda = () => {
      registrarAcaoAuditoria('VENDA_ABANDONADA', `Venda cancelada no meio do processo. Valor Total: R$ ${totalPagar}`);
      console.log("Log de Auditoria da venda cancelada:", auditLog);
      limparEstadoVenda();
      setShowExitModal(false);
  };

  const handlePausarVenda = () => {
      if (carrinho.length === 0) return toast.warning("Carrinho está vazio.");
      const novaPausa = { id: Date.now(), data: new Date().toLocaleTimeString(), carrinho, clienteAvulso, descontoTotalRaw, totalPagar, auditLog };
      setVendasPausadas([...vendasPausadas, novaPausa]);
      limparEstadoVenda();
      toast.info("Venda pausada e ecrã libertado.");
  };

  const handleRestaurarVenda = (id) => {
      const venda = vendasPausadas.find(v => v.id === id);
      if (!venda) return;
      if (carrinho.length > 0) return toast.warning("Cancele ou pause a venda atual primeiro.");
      setCarrinho(venda.carrinho); setClienteAvulso(venda.clienteAvulso); setDescontoTotalRaw(venda.descontoTotalRaw);
      setAuditLog(venda.auditLog || []);
      registrarAcaoAuditoria('VENDA_RESTAURADA', `Venda restaurada do modo de espera.`);
      setVendasPausadas(vendasPausadas.filter(v => v.id !== id));
      setShowPausadasModal(false); toast.success("Venda restaurada!");
  };

  const aplicarDescontoGlobal = () => {
      const valorBase = parseInt(descontoInputRaw || '0', 10) / 100;
      let valorReal = 0;
      if (valorBase > 0) {
          valorReal = (tipoDesconto === '%') ? subtotalItens * (valorBase / 100) : valorBase;
          if (tipoDesconto === '%' && valorBase > 100) return toast.error("Máximo é 100%");
          if (tipoDesconto === 'R$' && valorBase > subtotalItens) return toast.error("Maior que o subtotal");
          setDescontoTotalRaw(valorReal); toast.success("Desconto aplicado!");
          registrarAcaoAuditoria('APLICOU_DESCONTO', `Valor: R$ ${valorReal.toFixed(2)}`);
      } else {
          setDescontoTotalRaw(0); toast.info("Desconto removido.");
          registrarAcaoAuditoria('REMOVER_DESCONTO', `Desconto zerado.`);
      }
      setDescontoInputRaw(''); setShowDescontoModal(false);
  };

  // ==========================================================
  // FUNÇÕES DE RUPTURA E FECHAMENTO DE CAIXA
  // ==========================================================
  const registrarVendaPerdida = async () => {
      if (produtoFaltante.trim().length < 3) return toast.warning("Digite o nome do produto.");
      setLoading(true);
      try {
          await api.post('/caixas/venda-perdida', { produto: produtoFaltante });
          toast.success("Ruptura registada com sucesso!");
          setShowRupturaModal(false);
          setProdutoFaltante('');
      }
      catch (err) { toast.error("Erro ao registar ruptura."); }
      finally { setLoading(false); }
  };

  const handleSolicitarFechamento = () => {
      if (carrinho.length > 0) return toast.warning("Cancele a venda atual antes de fechar.");
      setShowFechamentoModal(true); setRequerJustificativa(false); setJustificativa(''); setValorFechamentoRaw('');
  };

  const confirmarFechamentoCaixa = async () => {
      if (requerJustificativa && justificativa.trim().length < 10) return toast.warning("Justificativa muito curta.");
      setLoading(true);
      try {
          const valorInformado = parseInt(valorFechamentoRaw.replace(/\D/g, '') || '0', 10) / 100;
          await api.post('/caixas/fechar', { valorFisicoInformado: valorInformado, justificativaDiferenca: justificativa.trim() !== '' ? justificativa : null });
          toast.success("Caixa fechado com sucesso."); setShowFechamentoModal(false); limparEstadoVenda(); navigate('/caixa');
      } catch (error) {
          if (error.response?.status === 428 || error.response?.data?.message?.toLowerCase().includes("justificativa")) { setRequerJustificativa(true); toast.warning("Divergência. Justifique."); }
          else { toast.error("Erro ao fechar o caixa."); }
      } finally { setLoading(false); }
  };

  // ==========================================================
  // PAGAMENTO E FINALIZAÇÃO
  // ==========================================================
  const handleAdicionarPagamento = () => {
      let valor = parseInt(valorInputRaw.replace(/\D/g, '') || '0', 10) / 100;
      if (valor <= 0 && saldoDevedor > 0) valor = saldoDevedor;
      if (valor <= 0) return;
      setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor }]);
      registrarAcaoAuditoria('ADICIONOU_PAGAMENTO', `Tipo: ${metodoAtual} | Valor: R$ ${valor.toFixed(2)}`);
      const novoSaldo = Math.max(0, saldoDevedor - valor);
      if (novoSaldo > 0) setValorInputRaw((Math.round(novoSaldo * 100)).toString()); else setValorInputRaw('');
      if (!isMobile) setTimeout(() => inputValorRef.current?.focus(), 50);
  };

  const handleRemoverPagamento = (id) => {
      const pRemovido = pagamentos.find(x => x.id === id);
      if (pRemovido) registrarAcaoAuditoria('REMOVEU_PAGAMENTO', `Tipo: ${pRemovido.tipo} | Valor: R$ ${pRemovido.valor.toFixed(2)}`);
      const novos = pagamentos.filter(x => x.id !== id); setPagamentos(novos);
      const novoTotalPago = novos.reduce((acc, p) => acc + p.valor, 0); const novoSaldo = Math.max(0, parseFloat((totalPagar - novoTotalPago).toFixed(2)));
      if (novoSaldo > 0) setValorInputRaw((Math.round(novoSaldo * 100)).toString());
  };

  const finalizarVendaReal = async () => {
      if (saldoDevedor > 0.01) return toast.error(`Falta R$ ${saldoDevedor.toFixed(2)}`);
      setLoading(true);
      try {
          registrarAcaoAuditoria('FINALIZOU_VENDA', `Tentativa de finalização. Total: R$ ${totalPagar}`);
          const payload = {
              subtotal: subtotalItens, descontoTotal: descontoItens + descontoTotalRaw, totalPago: totalPagar,
              troco: Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2))),
              clienteNome: clienteAvulso.nome || "Consumidor Final",
              clienteDocumento: cleanNumeric(clienteAvulso.documento) || null,
              clienteTelefone: cleanNumeric(clienteAvulso.telefone) || null,
              itens: carrinho.map(i => ({ produtoId: i.id, quantidade: i.quantidade, precoUnitario: i.precoVenda, desconto: i.desconto || 0 })),
              pagamentos: pagamentos.map(p => ({ formaPagamento: p.tipo, valor: p.valor, parcelas: 1 })),
              logAuditoria: auditLog
          };
          const response = await api.post('/vendas', payload);
          toast.success("Venda Finalizada!");
          setVendaFinalizada(response.data);
      } catch (err) { toast.error("Erro ao registrar a venda."); } finally { setLoading(false); }
  };

  // ==========================================================
  // IMPRESSÃO TÉRMICA NATIVA E WHATSAPP
  // ==========================================================
  const imprimirCupomLocal = () => {
      const dataVenda = new Date();
      const idVenda = vendaFinalizada?.idVenda || vendaFinalizada?.id || '0000';
      const itensHTML = carrinho.map(i => `
          <tr><td colspan="3">${i.descricao}</td></tr>
          <tr>
            <td>${i.quantidade}x</td>
            <td>R$ ${i.precoVenda.toFixed(2)}</td>
            <td style="text-align: right;">R$ ${(i.quantidade * i.precoVenda).toFixed(2)}</td>
          </tr>
      `).join('');

      const pagamentosHTML = pagamentos.map(p => `
          <tr><td>${p.tipo}</td><td style="text-align: right;">R$ ${p.valor.toFixed(2)}</td></tr>
      `).join('');

      const html = `
        <html>
        <head>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { font-family: monospace; font-size: 10px; width: 80mm; margin: 0; padding: 4mm; color: #000; }
            h2, h3, h4 { text-align: center; margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 5px;}
            th, td { padding: 2px 0; }
            hr { border-top: 1px dashed #000; margin: 5px 0; }
            .right { text-align: right; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(()=>window.close(), 500);">
           <h2>DD COSMÉTICOS</h2>
           <div class="center">
             Data: ${dataVenda.toLocaleDateString('pt-BR')} Hora: ${dataVenda.toLocaleTimeString('pt-BR')}<br>
             Pedido Nº: ${idVenda}
           </div>
           <hr>
           <table>${itensHTML}</table>
           <hr>
           <table>
             <tr><td><b>SUBTOTAL</b></td><td class="right">R$ ${subtotalItens.toFixed(2)}</td></tr>
             ${descontoTotalRaw > 0 ? `<tr><td><b>DESCONTO</b></td><td class="right">- R$ ${descontoTotalRaw.toFixed(2)}</td></tr>` : ''}
             <tr><td><b style="font-size:12px;">TOTAL</b></td><td class="right"><b style="font-size:12px;">R$ ${totalPagar.toFixed(2)}</b></td></tr>
           </table>
           <hr>
           <table>
             <tr><td colspan="2"><b>PAGAMENTOS:</b></td></tr>
             ${pagamentosHTML}
             <tr><td>TROCO</td><td class="right">R$ ${troco.toFixed(2)}</td></tr>
           </table>
           <hr>
           <div class="center">
             Cliente: ${clienteAvulso.nome || 'Consumidor Final'}<br>
             Obrigado pela preferência!
           </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=400,height=600');
      printWindow.document.write(html);
      printWindow.document.close();
  };

  const enviarWhatsAppBodyCompleto = () => {
      if(!zapNumber || zapNumber.length < 10) return toast.warning("Digite um número válido com DDD.");

      const dataVenda = new Date();
      let listaItens = carrinho.map(i => `▪️ ${i.quantidade}x ${i.descricao} - R$ ${(i.precoVenda * i.quantidade).toFixed(2)}`).join('\n');

      const descontosStr = descontoTotalRaw > 0 ? `\n*Desconto:* - R$ ${descontoTotalRaw.toFixed(2)}` : '';
      let pagamentosStr = pagamentos.map(p => `${p.tipo}: R$ ${p.valor.toFixed(2)}`).join('\n');

      const texto = `*DD COSMÉTICOS*\nObrigado pela compra! 💖\n\n📅 Data: ${dataVenda.toLocaleDateString('pt-BR')} às ${dataVenda.toLocaleTimeString('pt-BR')}\n🛒 *RESUMO DOS ITENS:*\n${listaItens}\n\n*Subtotal:* R$ ${subtotalItens.toFixed(2)}${descontosStr}\n*TOTAL PAGO:* R$ ${totalPagar.toFixed(2)}\n\n💳 *Pagamento:*\n${pagamentosStr}\n*Troco:* R$ ${troco.toFixed(2)}\n\n🧾 _Para consultar sua nota oficial, acesse o portal do SEFAZ._\n\nVolte sempre! ✨`;

      window.open(`https://api.whatsapp.com/send?phone=55${zapNumber.replace(/\D/g, '')}&text=${encodeURIComponent(texto)}`, '_blank');
      setShowZapModal(false);
  };

  // ==========================================================
  // RENDERIZAÇÃO DA INTERFACE
  // ==========================================================
  if (validandoCaixa) return <div className="pos-loader"><div className="pos-spinner"></div><h2>A Iniciar Terminal...</h2></div>;

  return (
    <div className="pos-container">

      {(!isMobile || mobileViewState === 'SCAN' || mobileViewState === 'CART') && (
      <section className={`pos-cart-section ${isMobile && mobileViewState === 'CART' ? 'mobile-cart-active' : ''}`}>

          {(!isMobile || mobileViewState === 'SCAN') && (
          <header className="pos-header">
              <div className="pos-brand">
                  <div className="brand-icon">✨</div>
                  <div className="brand-info"><h1>DD Cosméticos</h1><span>Terminal Caixa {isOnline ? '🟢' : '🔴'}</span></div>
              </div>
              <div className="header-clock hide-mobile">
                  <Clock size={16} className="text-primary" />
                  {horaAtual.toLocaleTimeString('pt-BR')}
              </div>
              <div className="header-actions">
                  <button className="btn-icon-outline" onClick={handleSolicitarFechamento} title="Fechar Caixa"><LogOut size={18}/></button>
                  <button className="btn-icon-danger" onClick={handleLimparVenda} title="Abandonar Venda"><ArrowLeft size={18}/></button>
              </div>
          </header>
          )}

          {(!isMobile || mobileViewState === 'SCAN') && (
          <div className="search-premium-area">
              <div className="search-input-wrapper">
                  <Search className="icon-search" size={20}/>
                  <input
                      ref={inputBuscaRef} type="text" className="sp-input" placeholder="Bipe ou digite o produto..."
                      value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={handleSearchKeyDown} autoComplete="off"
                  />
                  {busca && <button className="btn-clear" onClick={() => {setBusca(''); inputBuscaRef.current?.focus();}}><X size={16}/></button>}
              </div>
              <button className="btn-camera" onClick={() => setShowScanner(true)}><Camera size={24} /></button>

              {sugestoesProdutos.length > 0 && busca && (
                  <div className="search-dropdown" ref={dropdownRef}>
                      {sugestoesProdutos.map((prod, idx) => (
                          <div key={prod.id} className={`dropdown-item ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => adicionarProdutoAoCarrinho(prod)}>
                              <div className="dropdown-item-info"><strong>{prod.descricao}</strong><span>{prod.codigoBarras}</span></div>
                              <div className="dropdown-item-price">R$ {prod.precoVenda.toFixed(2)}</div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
          )}

          {isMobile && mobileViewState === 'CART' && (
              <div className="mobile-cart-header">
                  <button className="btn-icon-outline" onClick={() => setMobileView('SCAN')}><ChevronUp size={24} /></button>
                  <h2>Carrinho</h2>
                  <button className="btn-text-danger" onClick={handleLimparVenda}>Esvaziar</button>
              </div>
          )}

          <div className="pos-cart-body">
              {carrinho.length === 0 ? (
                  <div className="cart-empty"><ShoppingBag size={50} strokeWidth={1} /><h3>Nenhum produto</h3><p>Utilize o leitor ou a pesquisa.</p></div>
              ) : (
                  <div className="cart-items-wrapper">
                      {carrinho.map((item, idx) => (
                          <div key={item.id} className={`cart-card fade-in ${ultimoItemAdicionadoId === item.id ? 'flash-item' : ''}`}>
                              {!isMobile && <div className="cart-card-index">{idx + 1}</div>}
                              <div className="cart-card-info">
                                  <strong>{item.descricao}</strong>
                                  <span>{item.codigoBarras}</span>
                                  {isMobile && <div className="mobile-unit-price">R$ {item.precoVenda.toFixed(2)} un</div>}
                              </div>
                              <div className="cart-card-actions">
                                  {!isMobile && <div className="unit-price">R$ {item.precoVenda.toFixed(2)}</div>}
                                  <div className="qty-control">
                                      <button onClick={() => atualizarQtd(item.id, -1)}><Minus size={16}/></button>
                                      <span>{item.quantidade}</span>
                                      <button onClick={() => atualizarQtd(item.id, 1)}><Plus size={16}/></button>
                                  </div>
                                  <div className="line-total">R$ {(item.precoVenda * item.quantidade).toFixed(2)}</div>
                                  <button className="btn-trash" onClick={() => removerItem(item.id)}><Trash2 size={18}/></button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          {carrinho.length > 0 && (!isMobile || mobileViewState === 'CART') && (
          <footer className="pos-cart-footer">
              <div className="summary-row text-muted">
                  <span>Qtd. Itens: <strong className="text-dark">{totalQuantidade}</strong></span>
                  <span>Subtotal: R$ {subtotalItens.toFixed(2)}</span>
              </div>
              {descontoTotalRaw > 0 && <div className="summary-row text-pink"><span>Desconto</span><span>- R$ {descontoTotalRaw.toFixed(2)}</span></div>}
              <div className="summary-row grand-total"><span>Total a Pagar</span><span className="total-highlight">R$ {totalPagar.toFixed(2)}</span></div>
              {isMobile && mobileViewState === 'CART' && (
                  <button className="btn-primary-block mt-4" onClick={() => { setMobileView('PAYMENT'); setValorInputRaw(Math.round(saldoDevedor * 100).toString()); }}>
                      Ir para Pagamento <ArrowRight size={24}/>
                  </button>
              )}
          </footer>
          )}
      </section>
      )}

      {(!isMobile || mobileViewState === 'PAYMENT' || mobileViewState === 'SCAN') && (
      <section className={`pos-action-section ${isMobile && mobileViewState === 'PAYMENT' ? 'mobile-pay-active fade-in-up' : ''}`}>

          {mobileViewState === 'SCAN' && (
              <div className="panel-venda animate-fade">
                  <div className="card-cliente" onClick={() => setShowClienteModal(true)}>
                      <div className="card-cliente-icon"><UserCheck size={24}/></div>
                      <div className="card-cliente-info"><span>Identificação</span><strong>{clienteAvulso.nome || 'Consumidor Final'}</strong></div>
                      <ArrowRight size={20} className="text-muted"/>
                  </div>

                  <div className="grid-atalhos">
                      <button className="btn-atalho" onClick={() => setShowClienteModal(true)}><div className="icon-wrapper"><UserCheck size={20}/></div><span>Cliente</span><kbd className="hide-mobile">F3</kbd></button>
                      <button className="btn-atalho" onClick={() => { if(carrinho.length) setShowDescontoModal(true); else toast.warn("Vazio"); }}><div className="icon-wrapper"><Tag size={20}/></div><span>Desconto</span><kbd className="hide-mobile">F4</kbd></button>
                      <button className="btn-atalho" onClick={handlePausarVenda}><div className="icon-wrapper bg-warning-light text-warning"><PauseCircle size={20}/></div><span>Pausar</span></button>
                      <button className="btn-atalho" onClick={() => { if(vendasPausadas.length > 0) setShowPausadasModal(true); else toast.info("Nenhuma pausa"); }}>
                          <div className="icon-wrapper bg-info-light text-info relative">
                              <PlayCircle size={20}/>
                              {vendasPausadas.length > 0 && <span className="badge-pulse">{vendasPausadas.length}</span>}
                          </div>
                          <span>Em Espera</span>
                      </button>
                      <button className="btn-atalho" onClick={() => setShowRupturaModal(true)}><div className="icon-wrapper"><TrendingDown size={20}/></div><span>Ruptura</span><kbd className="hide-mobile">F9</kbd></button>
                      <button className="btn-atalho btn-atalho-danger" onClick={handleLimparVenda}><div className="icon-wrapper"><Trash2 size={20}/></div><span>Cancelar</span><kbd className="hide-mobile">DEL</kbd></button>
                  </div>

                  <button className="btn-checkout-giant" disabled={!carrinho.length} onClick={() => { setMobileView('PAYMENT'); setValorInputRaw(Math.round(saldoDevedor * 100).toString()); }}>
                      <div className="checkout-info"><span>Finalizar Compra</span><kbd className="hide-mobile">F8</kbd></div>
                      <div className="checkout-arrow"><ArrowRight size={28}/></div>
                  </button>
              </div>
          )}

          {mobileViewState === 'PAYMENT' && (
              <div className="panel-pagamento animate-slide-left">
                  <header className="pay-header">
                      <button className="btn-voltar-pay" onClick={() => isMobile ? setMobileView('CART') : setMobileView('SCAN')}><ArrowLeft size={18}/> Voltar</button>
                      <h2>Pagamento</h2>
                  </header>

                  <div className="pay-methods-grid">
                      {[{id: 'PIX', icon: <Smartphone size={20}/>, label: 'Pix'}, {id: 'DINHEIRO', icon: <Banknote size={20}/>, label: 'Dinheiro'}, {id: 'CREDITO', icon: <CreditCard size={20}/>, label: 'Crédito'}, {id: 'DEBITO', icon: <CreditCard size={20}/>, label: 'Débito'}].map(m => (
                          <button key={m.id} className={`pay-method-card ${metodoAtual === m.id ? 'active' : ''}`} onClick={() => { setMetodoAtual(m.id); if(!isMobile) inputValorRef.current?.focus(); }}>
                              {m.icon}<span>{m.label}</span>
                          </button>
                      ))}
                  </div>

                  <div className="pay-input-box">
                      <label>VALOR RECEBIDO ({metodoAtual})</label>
                      <div className="pay-input-wrapper">
                          <span className="currency">R$</span>
                          <input ref={inputValorRef} inputMode="numeric" value={getValorFormatado(valorInputRaw)} onChange={e => setValorInputRaw(formatCurrencyInput(e.target.value))} onKeyDown={e => e.key === 'Enter' && handleAdicionarPagamento()} placeholder="0,00" />
                          <button className="btn-add-pay" onClick={handleAdicionarPagamento}><CheckCircle2 size={24}/></button>
                      </div>
                  </div>

                  <div className="pay-logs">
                      {pagamentos.map(p => (
                          <div key={p.id} className="pay-log-row">
                              <span>{p.tipo}</span><strong>R$ {p.valor.toFixed(2)}</strong>
                              <button onClick={() => handleRemoverPagamento(p.id)}><Trash2 size={16}/></button>
                          </div>
                      ))}
                  </div>

                  <div className="pay-footer">
                      <div className="pay-summary"><span>Falta Receber:</span> <strong className="text-danger">R$ {saldoDevedor.toFixed(2)}</strong></div>
                      <div className="pay-summary"><span>Troco:</span> <strong className="text-success">R$ {troco.toFixed(2)}</strong></div>
                      <button className="btn-finish-pay" disabled={saldoDevedor > 0.01 || loading} onClick={finalizarVendaReal}>
                          {loading ? 'Emitindo NFC-e...' : 'FINALIZAR VENDA'}
                      </button>
                  </div>
              </div>
          )}
      </section>
      )}

      {isMobile && mobileViewState === 'SCAN' && carrinho.length > 0 && (
          <div className="fab-cart bounce-in" onClick={() => setMobileView('CART')}>
              <div className="fab-badge">{totalQuantidade}</div>
              <ShoppingBag size={24}/>
              <div className="fab-total">R$ {totalPagar.toFixed(2)}</div>
          </div>
      )}

      {/* ========================================================== */}
      {/* TODOS OS MODAIS                                            */}
      {/* ========================================================== */}

      {vendaFinalizada && (
        <div className="modal-glass z-max">
          <div className="modal-glass-card text-center sm fade-in border-top-success">
            <CheckCircle2 size={60} color="#10b981" className="mx-auto mb-3" />
            <h2 className="title-main mb-2">Sucesso!</h2>
            <p className="text-sec mb-4">A venda foi registada e a NFC-e autorizada.</p>

            <div className="d-flex-col gap-3 mb-4">
              <button className="btn-action-primary" onClick={imprimirCupomLocal}>
                <Printer size={20} /> Imprimir Cupom Térmico
              </button>

              <div className="d-flex gap-3">
                <button className="btn-action-success" onClick={() => { setZapNumber(clienteAvulso.telefone || ''); setShowZapModal(true); }}>
                  <MessageCircle size={18} /> WhatsApp
                </button>
              </div>
            </div>
            <button className="btn-outline-sec" onClick={() => { setVendaFinalizada(null); limparEstadoVenda(); }}>Próxima Venda (ESC)</button>
          </div>
        </div>
      )}

      {showZapModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card sm fade-in border-top-success text-center">
                  <h2 className="title-main mb-2">Enviar Recibo</h2>
                  <p className="text-sec mb-4">O cliente receberá todos os dados da compra no WhatsApp.</p>
                  <label className="form-label text-left">NÚMERO DO WHATSAPP</label>
                  <input className="mg-input mb-4" placeholder="(DDD) 90000-0000" value={zapNumber} onChange={e => setZapNumber(mascaraTelefone(e.target.value))} autoFocus onKeyDown={e => e.key === 'Enter' && enviarWhatsAppBodyCompleto()} />
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowZapModal(false)}>Voltar</button>
                      <button className="btn-action-success flex-1" onClick={enviarWhatsAppBodyCompleto}>Enviar Mensagem</button>
                  </div>
              </div>
          </div>
      )}

      {showExitModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-danger">
                  <AlertTriangle size={50} color="#ef4444" className="mx-auto mb-3"/>
                  <h2 className="title-main mb-2 text-xl">Cancelar Venda Atual?</h2>
                  <p className="text-sec mb-4">Atenção: Todos os itens lidos serão perdidos e este evento será registado para auditoria.</p>
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowExitModal(false)}>Ficar</button>
                      <button className="btn-danger-block flex-1" onClick={confirmarAbandonoVenda}>Confirmar Cancelamento</button>
                  </div>
              </div>
          </div>
      )}

      {showDescontoModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-primary">
                  <h2 className="title-main mb-2">Desconto</h2>
                  <div className="toggle-soft mt-4 mb-4">
                      <button className={tipoDesconto === 'R$' ? 'active' : ''} onClick={() => setTipoDesconto('R$')}>R$ Fixo</button>
                      <button className={tipoDesconto === '%' ? 'active' : ''} onClick={() => setTipoDesconto('%')}>% Porc.</button>
                  </div>
                  <div className="input-giant-wrapper">
                      <span>{tipoDesconto}</span>
                      <input inputMode="numeric" value={getValorFormatado(descontoInputRaw)} onChange={e => setDescontoInputRaw(formatCurrencyInput(e.target.value))} autoFocus onKeyDown={e => e.key === 'Enter' && aplicarDescontoGlobal()} />
                  </div>
                  <div className="mg-actions">
                      <button className="mg-btn cancel" onClick={() => setShowDescontoModal(false)}>Voltar</button>
                      <button className="mg-btn confirm" onClick={aplicarDescontoGlobal}>Aplicar</button>
                  </div>
              </div>
          </div>
      )}

      {showClienteModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-primary">
                  <div className="icon-circle mx-auto mb-4"><UserCheck size={32}/></div>
                  <h2 className="title-main mb-4">Cliente na Nota</h2>
                  <div className="text-left w-full">
                      <label className="form-label">NOME</label>
                      <input className="mg-input mb-3" value={clienteAvulso.nome} onChange={e => setClienteAvulso({...clienteAvulso, nome: e.target.value})} autoFocus/>
                      <label className="form-label">WHATSAPP</label>
                      <input className="mg-input mb-3" inputMode="numeric" value={clienteAvulso.telefone} onChange={e => setClienteAvulso({...clienteAvulso, telefone: mascaraTelefone(e.target.value)})}/>
                      <label className="form-label">CPF/CNPJ</label>
                      <input className="mg-input mb-4" inputMode="numeric" value={clienteAvulso.documento} onChange={e => setClienteAvulso({...clienteAvulso, documento: mascaraDocumento(e.target.value)})}/>
                  </div>
                  <div className="mg-actions">
                      <button className="mg-btn cancel" onClick={() => { setClienteAvulso({nome:'',telefone:'',documento:''}); setShowClienteModal(false); }}>Limpar</button>
                      <button className="mg-btn confirm" onClick={() => setShowClienteModal(false)}>Salvar (Enter)</button>
                  </div>
              </div>
          </div>
      )}

      {showRupturaModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-warning">
                  <TrendingDown size={50} color="#f59e0b" className="mx-auto mb-3"/>
                  <h2 className="title-main mb-2 text-xl">Avisar Ruptura</h2>
                  <p className="text-sec mb-4">Qual produto o cliente procurou e não encontrou?</p>
                  <input type="text" className="mg-input mb-4 text-center" placeholder="Ex: Esmalte Vermelho" value={produtoFaltante} onChange={e => setProdutoFaltante(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && registrarVendaPerdida()} />
                  <div className="mg-actions">
                      <button className="mg-btn cancel" onClick={() => setShowRupturaModal(false)}>Voltar</button>
                      <button className="mg-btn confirm" disabled={produtoFaltante.length < 3 || loading} onClick={registrarVendaPerdida}>Registrar</button>
                  </div>
              </div>
          </div>
      )}

      {showPausadasModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card fade-in">
                  <h2 className="title-main mb-4">Vendas em Espera</h2>
                  {vendasPausadas.length === 0 ? <p className="text-sec text-center">Nenhuma venda pausada no momento.</p> : (
                      <div className="d-flex-col gap-3">
                          {vendasPausadas.map(v => (
                              <div key={v.id} className="cart-card flex-col align-start p-3" style={{ borderLeft: '4px solid #f59e0b' }}>
                                  <div className="d-flex justify-between w-full mb-2">
                                      <strong>{v.clienteAvulso.nome || 'Cliente Anônimo'}</strong>
                                      <span className="text-muted">{v.data}</span>
                                  </div>
                                  <div className="d-flex justify-between w-full align-center">
                                      <span className="text-sec">{v.carrinho.length} itens • R$ {v.totalPagar.toFixed(2)}</span>
                                      <button className="btn-outline-sec" style={{ borderColor: '#f59e0b', color: '#d97706', padding: '8px 16px' }} onClick={() => handleRestaurarVenda(v.id)}>Restaurar</button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                  <button className="btn-cancel-dark mt-4" onClick={() => setShowPausadasModal(false)}>Fechar (ESC)</button>
              </div>
          </div>
      )}

      {showFechamentoModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-danger">
                  <h3 className={`font-bold text-xl mb-3 ${requerJustificativa ? 'text-warning' : 'text-danger'}`}>{requerJustificativa ? 'Divergência de Caixa' : 'Fechar Caixa'}</h3>
                  <div className="mg-closing-input-wrapper mt-4">
                      <span className="mg-closing-currency">R$</span>
                      <input type="text" className="mg-closing-input" inputMode="numeric" value={getValorFormatado(valorFechamentoRaw)} onChange={e => { setValorFechamentoRaw(formatCurrencyInput(e.target.value)); setRequerJustificativa(false); }} placeholder="0,00" disabled={requerJustificativa} autoFocus />
                  </div>
                  {requerJustificativa && <textarea className="mg-input w-full tx-justificativa mt-4" rows="3" placeholder="Escreva a justificativa..." value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />}
                  <div className="mg-actions">
                      <button className="mg-btn cancel" onClick={() => { setShowFechamentoModal(false); setValorFechamentoRaw(''); setRequerJustificativa(false); }}>Voltar</button>
                      <button className="mg-btn confirm" onClick={confirmarFechamentoCaixa}>{requerJustificativa ? 'Enviar' : 'Fechar'}</button>
                  </div>
              </div>
          </div>
      )}

      {showCadastroRapido && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card sm fade-in border-top-primary">
                  <h2 className="title-main mb-2">Produto Não Encontrado</h2>
                  <p className="text-sec mb-4 text-sm">O sistema vai gerar a tributação com base na categoria.</p>
                  <label className="form-label">EAN Lido</label>
                  <input className="mg-input mb-3 bg-disabled" value={produtoRapido.codigoBarras} disabled />
                  <label className="form-label">Descrição</label>
                  <input className="mg-input mb-3" placeholder="Ex: MASCARA HIDRATANTE 200G" value={produtoRapido.descricao} onChange={e => setProdutoRapido({...produtoRapido, descricao: e.target.value})} autoFocus />
                  <div className="d-flex gap-3 mb-4">
                      <div className="flex-1">
                          <label className="form-label">Categoria</label>
                          <select className="mg-input" value={produtoRapido.categoria} onChange={e => setProdutoRapido({...produtoRapido, categoria: e.target.value})}>
                              <option value="">Selecione...</option>
                              <option value="CABELO">Cabelos</option>
                              <option value="MAQUIAGEM">Maquiagem</option>
                              <option value="PELE">Cuidados com a Pele</option>
                          </select>
                      </div>
                      <div className="w-45">
                          <label className="form-label">Preço</label>
                          <input className="mg-input text-center" inputMode="numeric" value={getValorFormatado(produtoRapido.precoVendaRaw)} onChange={e => setProdutoRapido({...produtoRapido, precoVendaRaw: formatCurrencyInput(e.target.value)})} onKeyDown={e => e.key === 'Enter' && handleSalvarProdutoRapido()} />
                      </div>
                  </div>
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => { setShowCadastroRapido(false); setBusca(''); }}>Cancelar</button>
                      <button className="btn-primary-block flex-1" onClick={handleSalvarProdutoRapido} disabled={loading}>Salvar na Venda</button>
                  </div>
              </div>
          </div>
      )}

      {showScanner && <ScannerModal onProcessScan={(ean) => { setShowScanner(false); processarEAN(ean); }} onClose={() => setShowScanner(false)} />}

    </div>
  );
};

export default PDV;