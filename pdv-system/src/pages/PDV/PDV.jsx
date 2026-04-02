import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Plus, Minus, ArrowLeft, X, UserCheck, ArrowRight, Banknote, Smartphone,
  CreditCard, Tag, ShoppingBag, CheckCircle2, LogOut, TrendingDown,
  Camera, Printer, MessageCircle, AlertTriangle, ChevronUp, PauseCircle, PlayCircle, Clock, FileText, Zap
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
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

const getBackendUrl = () => api.defaults.baseURL ? api.defaults.baseURL.split('/api')[0] : "";

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
// CÂMERA MOBILE (PERFORMANCE MÁXIMA & ANTI-VAZAMENTO DE MEMÓRIA)
// ==========================================================
const ScannerModal = ({ onProcessScan, onClose }) => {
    const [hasFlashlight, setHasFlashlight] = useState(false);
    const [isFlashlightOn, setIsFlashlightOn] = useState(false);
    const [manualEan, setManualEan] = useState('');
    const html5QrCodeRef = useRef(null);

    useEffect(() => {
        let wasScanned = false;
        let scanner = new Html5Qrcode("reader-core");
        html5QrCodeRef.current = scanner;

        const config = {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.QR_CODE
            ]
        };

        scanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                if (wasScanned) return;
                const valorLimpo = decodedText.replace(/[^a-zA-Z0-9]/g, '');
                if (valorLimpo) {
                    wasScanned = true;
                    try { scanner.pause(true); } catch (e) {}
                    onProcessScan(valorLimpo);
                }
            },
            () => {}
        ).then(() => {
            try {
                const track = scanner.getRunningTrackCameraCapabilities();
                if (track && track.torchFeature().isSupported) {
                    setHasFlashlight(true);
                }
            } catch (e) {}
        }).catch(() => toast.error("Falha ao acessar a câmera. Verifique as permissões."));

        return () => {
            wasScanned = true;
            if (scanner) {
                try {
                    if (scanner.isScanning || scanner.getState() === 2) {
                        scanner.stop().then(() => { scanner.clear(); scanner = null; }).catch(() => { scanner.clear(); scanner = null; });
                    } else { scanner.clear(); scanner = null; }
                } catch (error) { scanner = null; }
            }
        };
    }, [onProcessScan]);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualEan.trim().length >= 3) {
            onProcessScan(manualEan.trim());
        }
    };

    const toggleFlashlight = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            const newState = !isFlashlightOn;
            try {
                await html5QrCodeRef.current.applyVideoConstraints({
                    advanced: [{ torch: newState }]
                });
                setIsFlashlightOn(newState);
            } catch (e) {
                toast.warn("Lanterna não suportada neste aparelho.");
            }
        }
    };

    return (
        <div className="modal-glass z-max">
            <div className="modal-glass-card sm text-center fade-in bg-dark-glass" style={{ padding: '24px' }}>
                <div className="d-flex justify-between align-center mb-4">
                    <h3 className="title-main text-white m-0 text-left">Escaneie o Código</h3>
                    {hasFlashlight && (
                        <button className={`btn-torch ${isFlashlightOn ? 'active' : ''}`} onClick={toggleFlashlight} title="Lanterna">
                            <Zap size={22} />
                        </button>
                    )}
                </div>

                <div className="scanner-viewport" style={{ aspectRatio: '1/1', marginBottom: '20px' }}>
                    <div id="reader-core" className="reader-core" style={{ minHeight: '250px' }}></div>
                    <div className="scanner-overlay"></div>
                    <div className="scanner-laser"></div>
                </div>

                <div className="fallback-manual" style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px' }}>
                    <p className="text-white mb-2" style={{ fontSize: '0.85rem', fontWeight: '600' }}>Plástico refletindo? Digite o código:</p>
                    <form onSubmit={handleManualSubmit} className="d-flex gap-2">
                        <input
                            type="number"
                            className="mg-input"
                            style={{ padding: '10px', fontSize: '1.2rem', textAlign: 'center' }}
                            placeholder="Ex: 78910..."
                            value={manualEan}
                            onChange={(e) => setManualEan(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="btn-action-success" style={{ width: 'auto', padding: '0 20px' }}>OK</button>
                    </form>
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

  const [lojaLogo, setLojaLogo] = useState(null);
  const [configLoja, setConfigLoja] = useState(null);

  const [metodosPagamentoAtivos, setMetodosPagamentoAtivos] = useState([
      {id: 'PIX', icon: <Smartphone size={20}/>, label: 'Pix'},
      {id: 'DINHEIRO', icon: <Banknote size={20}/>, label: 'Dinheiro'},
      {id: 'CREDITO', icon: <CreditCard size={20}/>, label: 'Crédito'},
      {id: 'DEBITO', icon: <CreditCard size={20}/>, label: 'Débito'}
  ]);

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

      api.get('/configuracoes').then(res => {
          setConfigLoja(res.data);
          if (res.data?.loja?.logoUrl) {
              const url = res.data.loja.logoUrl;
              setLojaLogo(url.startsWith('http') || url.startsWith('data:image') ? url : `${getBackendUrl()}${url.startsWith('/') ? '' : '/'}${url}`);
          }
          if (res.data?.financeiro) {
              const fin = res.data.financeiro;
              const ativos = [];
              if (fin.aceitaPix) ativos.push({id: 'PIX', icon: <Smartphone size={20}/>, label: 'Pix'});
              if (fin.aceitaDinheiro) ativos.push({id: 'DINHEIRO', icon: <Banknote size={20}/>, label: 'Dinheiro'});
              if (fin.aceitaCredito) ativos.push({id: 'CREDITO', icon: <CreditCard size={20}/>, label: 'Crédito'});
              if (fin.aceitaDebito) ativos.push({id: 'DEBITO', icon: <CreditCard size={20}/>, label: 'Débito'});
              if (fin.aceitaCrediario) ativos.push({id: 'CREDIARIO', icon: <FileText size={20}/>, label: 'Fiado'});

              if (ativos.length > 0) {
                  setMetodosPagamentoAtivos(ativos);
                  setMetodoAtual(ativos[0].id);
              }
          }
      }).catch(() => {});

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
  const [produtoRapido, setProdutoRapido] = useState({
      codigoBarras: '', descricao: '', precoVendaRaw: '',
      categoria: '', subcategoria: '', ncm: '', loadingIA: false
  });

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [descontoInputRaw, setDescontoInputRaw] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('R$');

  const [showRupturaModal, setShowRupturaModal] = useState(false);
  const [produtoFaltante, setProdutoFaltante] = useState('');

  const [showExitModal, setShowExitModal] = useState(false);
  const [showCancelVendaModal, setShowCancelVendaModal] = useState(false);

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
      const isModalOpen = showExitModal || showCancelVendaModal || showFechamentoModal || showClienteModal || showDescontoModal || showScanner || showCadastroRapido || showRupturaModal || showPausadasModal || showZapModal || vendaFinalizada;
      if (!isModalOpen) {
          if (mobileViewState === 'SCAN') setTimeout(() => inputBuscaRef.current?.focus(), 50);
          else if (mobileViewState === 'PAYMENT') setTimeout(() => inputValorRef.current?.focus(), 50);
      }
  }, [mobileViewState, showExitModal, showCancelVendaModal, showFechamentoModal, showClienteModal, showDescontoModal, showScanner, showCadastroRapido, showRupturaModal, showPausadasModal, showZapModal, vendaFinalizada, isMobile]);

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
              if (showCancelVendaModal) { setShowCancelVendaModal(false); return; }
              if (showExitModal) { setShowExitModal(false); return; }
              if (showScanner) { setShowScanner(false); return; }
              if (showCadastroRapido) { setShowCadastroRapido(false); setBusca(''); return; }
              if (showPausadasModal) { setShowPausadasModal(false); return; }
              setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); setMobileView('SCAN'); return;
          }

          const isModalOpen = showExitModal || showCancelVendaModal || showFechamentoModal || showRupturaModal || showClienteModal || showDescontoModal || showScanner || showCadastroRapido || showPausadasModal || showZapModal || vendaFinalizada;
          if (isModalOpen) return;

          if (e.key === 'F2') { e.preventDefault(); setMobileView('SCAN'); }
          if (e.key === 'F3') { e.preventDefault(); setShowClienteModal(true); }
          if (e.key === 'F4') { e.preventDefault(); if (carrinho.length > 0) setShowDescontoModal(true); else toast.warn("Carrinho vazio"); }
          if (e.key === 'F8') { e.preventDefault(); if (carrinho.length > 0) { setMobileView('PAYMENT'); setValorInputRaw(Math.round(saldoDevedor * 100).toString()); } else toast.warn("Carrinho vazio"); }
          if (e.key === 'F9') { e.preventDefault(); setShowRupturaModal(true); }
          if (e.key === 'Delete' && mobileViewState === 'SCAN') { e.preventDefault(); handleCancelarVenda(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileViewState, carrinho.length, showClienteModal, showDescontoModal, showExitModal, showCancelVendaModal, showFechamentoModal, showRupturaModal, showScanner, showCadastroRapido, showPausadasModal, showZapModal, vendaFinalizada, saldoDevedor]);

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

  const classificarComIA = async (descricaoProduto, eanProduto) => {
      if (!descricaoProduto || descricaoProduto.trim().length < 3) return;

      setProdutoRapido(prev => ({ ...prev, loadingIA: true }));
      try {
          const res = await api.post('/produtos/analisar-ia', {
              descricao: descricaoProduto,
              codigoBarras: eanProduto
          });

          if (res.data) {
              setProdutoRapido(prev => ({
                  ...prev,
                  categoria: res.data.categoria || prev.categoria,
                  subcategoria: res.data.subcategoria || prev.subcategoria,
                  ncm: res.data.ncm || prev.ncm,
                  loadingIA: false
              }));
              toast.success("✨ IA classificou o produto!");
              setTimeout(() => document.getElementById('input-preco-rapido')?.focus(), 100);
          }
      } catch (err) {
          setProdutoRapido(prev => ({ ...prev, loadingIA: false }));
      }
  };

  const processarEAN = async (valorRaw) => {
      const valor = valorRaw.replace(/[^a-zA-Z0-9]/g, '');
      if (!valor) return;
      try {
          const { data } = await api.get(`/produtos/ean/${valor}`);
          let produto = Array.isArray(data) ? data[0] : data;

          if (produto && (produto.id || produto.codigoBarras)) {
              if (!produto.precoVenda || produto.precoVenda <= 0) {
                  playAudio('error');
                  toast.info("Produto encontrado. Qual o preço?");

                  setProdutoRapido({
                      codigoBarras: produto.codigoBarras || valor,
                      descricao: produto.descricao || '',
                      precoVendaRaw: '',
                      categoria: produto.categoria || '',
                      subcategoria: produto.subcategoria || '',
                      ncm: produto.ncm || '',
                      loadingIA: false
                  });
                  setShowCadastroRapido(true);

                  if (!produto.categoria || !produto.ncm) {
                      classificarComIA(produto.descricao, produto.codigoBarras);
                  }
              } else {
                  adicionarProdutoAoCarrinho(produto);
              }
          }
          else { throw new Error("Não encontrado"); }
      } catch (err) {
          playAudio('error');
          toast.warning("Produto não cadastrado! Preencha rápido.");
          setBusca(''); if (inputBuscaRef.current) inputBuscaRef.current.value = '';
          setProdutoRapido({
              codigoBarras: valor, descricao: '', precoVendaRaw: '',
              categoria: '', subcategoria: '', ncm: '', loadingIA: false
          });
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

  const handleSairPdv = () => {
      if(carrinho.length > 0) { setShowExitModal(true); }
      else { navigate('/dashboard'); }
  };

  const confirmarSaidaPdv = () => {
      registrarAcaoAuditoria('SAIDA_ABRUPTA', `Usuário abandonou o PDV com carrinho preenchido.`);
      limparEstadoVenda();
      setShowExitModal(false);
      navigate('/dashboard');
  };

  const handleCancelarVenda = () => {
      if(carrinho.length === 0) return;
      setShowCancelVendaModal(true);
  };

  const confirmarCancelamentoVenda = () => {
      registrarAcaoAuditoria('VENDA_CANCELADA', `Venda cancelada pelo utilizador. Valor: R$ ${totalPagar}`);
      limparEstadoVenda();
      setShowCancelVendaModal(false);
      toast.info("Venda cancelada. Carrinho vazio.");
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
      }
      setDescontoInputRaw(''); setShowDescontoModal(false);
  };

  const removerDescontoGlobal = () => {
      setDescontoTotalRaw(0);
      setDescontoInputRaw('');
      setShowDescontoModal(false);
      toast.info("Desconto removido!");
      registrarAcaoAuditoria('REMOVER_DESCONTO', `Desconto zerado.`);
  };

  const handleSalvarProdutoRapido = async () => {
        const preco = parseInt(produtoRapido.precoVendaRaw || '0', 10) / 100;
        if (preco <= 0) return toast.warning("Digite o preço de venda válido!");
        if (!produtoRapido.descricao || produtoRapido.descricao.trim().length < 3) return toast.warning("Digite uma descrição para a Nota Fiscal.");

        setLoading(true);

        try {
            const payloadNovoProduto = {
                          codigoBarras: produtoRapido.codigoBarras,
                          descricao: produtoRapido.descricao.toUpperCase(),
                          precoVenda: preco,
                          precoCusto: 0,
                          ncm: produtoRapido.ncm || "33049990",
                          categoria: produtoRapido.categoria?.toUpperCase() || "GERAL",
                          subcategoria: produtoRapido.subcategoria?.toUpperCase() || "",
                          unidade: 'UN',
                          ativo: true,
                          cst: '102',
                          origem: '0',
                          revisaoPendente: true
                      };

            const response = await api.post('/produtos', payloadNovoProduto);
            const produtoSalvoNoBanco = response.data;

            adicionarProdutoAoCarrinho(produtoSalvoNoBanco);

            setShowCadastroRapido(false);
            setProdutoRapido({ codigoBarras: '', descricao: '', precoVendaRaw: '', categoria: '', subcategoria: '', ncm: '', loadingIA: false });
            toast.success("Produto cadastrado no sistema e adicionado à venda!");

        } catch (error) {
            toast.error("Erro ao salvar o produto no banco de dados.");
        } finally {
            setLoading(false);
        }
    };

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

      const temFiado = pagamentos.some(p => p.tipo === 'CREDIARIO');
      if (temFiado && (!clienteAvulso.nome || clienteAvulso.nome.trim() === '')) {
          return toast.warning("Identifique o Cliente (F3) para vender a Fiado.");
      }

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

                let response = await api.post('/vendas', payload);
                let vendaResult = response.data;

                // LOOP DE ESPERA (POLLING): Aguarda até 4 segundos se a nota estiver pendente na Sefaz
                let tentativas = 0;
                while(vendaResult.status === 'PENDENTE' && tentativas < 4) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const resCheck = await api.get(`/vendas/${vendaResult.id || vendaResult.idVenda}`);
                    vendaResult = resCheck.data;
                    tentativas++;
                }

                toast.success("Venda Finalizada!");
                setVendaFinalizada(vendaResult); // Agora garante que entra com URL e Chave
            } catch (err) { toast.error("Erro ao registrar a venda."); } finally { setLoading(false); }
        };

  // 🚨 COMPLIANCE SEFAZ: IMPRESSÃO DE CUPOM FISCAL DANFE NFC-E LEGALIZADO
  const imprimirCupomLocal = () => {
      const dataVenda = new Date(vendaFinalizada?.dataVenda || new Date());
      const idVenda = vendaFinalizada?.idVenda || vendaFinalizada?.id || '0000';
      const numNfce = vendaFinalizada?.numeroNfce || idVenda;
      const serieNfce = vendaFinalizada?.serieNfce || configLoja?.fiscal?.serieProducao || '1';

      // CORREÇÃO: Usando 'vendaFinalizada' ao invés de 'vendaBase'
      const chaveAcessoRaw = vendaFinalizada?.chaveAcessoNfce || vendaFinalizada?.chaveAcesso || vendaFinalizada?.chaveNfce || vendaFinalizada?.chave || '00000000000000000000000000000000000000000000';
      const chaveAcessoFormatada = chaveAcessoRaw.replace(/(\d{4})/g, '$1 ').trim();

      const protocolo = vendaFinalizada?.protocolo || 'N/A';

      const loja = configLoja?.loja || {};
      const end = configLoja?.endereco || {};
      const sys = configLoja?.sistema || {};

      const razaoSocial = loja.razaoSocial || 'DD COSMÉTICOS';
      const cnpj = loja.cnpj ? loja.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '00.000.000/0000-00';
      const ie = loja.ie || 'ISENTO';
      const enderecoCompleto = `${end.logradouro || 'Rua'}, ${end.numero || 'S/N'} - ${end.bairro || 'Centro'}, ${end.cidade || 'Cidade'}-${end.uf || 'UF'}`;

      let logoHTML = '';
      if (sys.imprimirLogoCupom && lojaLogo) {
          logoHTML = `<div class="center"><img src="${lojaLogo}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;" /></div>`;
      }

      const isHomologacao = configLoja?.fiscal?.ambiente === 'HOMOLOGACAO';
      const watermark = isHomologacao ? `<div class="homologacao-watermark">AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL</div>` : '';

      const itensHTML = carrinho.map((i, index) => `
          <tr><td colspan="2" class="item-desc">${String(index + 1).padStart(3, '0')} ${i.codigoBarras || i.id} ${i.descricao}</td></tr>
          <tr><td class="item-det">${i.quantidade} UN X ${i.precoVenda.toFixed(2)}</td><td class="right item-det">R$ ${(i.quantidade * i.precoVenda).toFixed(2)}</td></tr>
      `).join('');

      const pagamentosHTML = pagamentos.map(p => `<tr><td>${p.tipo}</td><td class="right">R$ ${p.valor.toFixed(2)}</td></tr>`).join('');

      // Regra Consumidor Lei NFC-e
      const docCliente = clienteAvulso.documento ? `CPF/CNPJ: ${clienteAvulso.documento}` : 'CONSUMIDOR NÃO IDENTIFICADO';
      const nomeCliente = clienteAvulso.nome ? `Nome: ${clienteAvulso.nome}` : '';

      // Lei da Transparência (12.741/12)
      const impostoMes = totalPagar * 0.04;

      // QR Code Dinâmico SEFAZ-PE
      const urlConsultaSefaz = 'http://nfce.sefaz.pe.gov.br/nfce/consulta';
      const qrCodeUrl = `${urlConsultaSefaz}?chNFe=${chaveAcessoRaw}&nVersao=100`;

      const html = `
        <html>
        <head>
          <title>DANFE NFC-e #${idVenda}</title>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 80mm; margin: 0; padding: 4mm; color: #000; background: #fff;}
            h2, h3, h4 { text-align: center; margin: 2px 0; font-size: 12px;}
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 5px;}
            th, td { padding: 2px 0; }
            .border-top { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;}
            .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 5px; padding-bottom: 5px;}
            .right { text-align: right; } .center { text-align: center; } .bold { font-weight: bold; }
            .left { text-align: left; }
            .item-desc { font-size: 10px; } .item-det { font-size: 10px; padding-left: 15px;}
            .chave { font-size: 9px; word-break: break-all; text-align: center; letter-spacing: 1px; margin: 10px 0;}
            .homologacao-watermark { text-align: center; font-size: 14px; font-weight: bold; padding: 10px; border: 2px dashed #000; margin: 10px 0; text-transform: uppercase; }
            .msg-rodape { text-align: center; font-size: 10px; margin-top: 15px;}
          </style>
        </head>
        <body onload="window.print(); setTimeout(()=>window.close(), 500);">
           ${logoHTML}
           <div class="center bold">${razaoSocial}</div>
           <div class="center">CNPJ: ${cnpj} IE: ${ie}</div>
           <div class="center">${enderecoCompleto}</div>
           <div class="border-top border-bottom center bold">
             DANFE NFC-e - Documento Auxiliar da Nota Fiscal<br>de Consumidor Eletrônica
           </div>
           <div class="center" style="font-size: 9px; margin-bottom: 5px;">Não permite aproveitamento de crédito de ICMS</div>
           ${watermark}
           <table class="border-bottom">
             <tr><th class="left" colspan="2">CÓDIGO DESCRIÇÃO</th></tr>
             <tr><th class="left" style="padding-left:15px;">QTD UN X VL UNIT (R$)</th><th class="right">VL TOTAL (R$)</th></tr>
             ${itensHTML}
           </table>
           <table>
             <tr><td>QTD. TOTAL DE ITENS</td><td class="right">${totalQuantidade}</td></tr>
             <tr><td>VALOR TOTAL R$</td><td class="right">${subtotalItens.toFixed(2)}</td></tr>
             ${descontoTotalRaw > 0 ? `<tr><td>DESCONTOS R$</td><td class="right">- ${descontoTotalRaw.toFixed(2)}</td></tr>` : ''}
             <tr><td class="bold" style="font-size: 12px;">VALOR A PAGAR R$</td><td class="right bold" style="font-size: 12px;">${totalPagar.toFixed(2)}</td></tr>
             <tr><td colspan="2" class="border-top">FORMA DE PAGAMENTO</td></tr>
             ${pagamentosHTML}
             <tr><td>TROCO R$</td><td class="right">${troco.toFixed(2)}</td></tr>
           </table>
           <div class="border-top border-bottom center">${docCliente}<br>${nomeCliente}</div>
           <div class="center bold mt-2">
             NFC-e Nº ${numNfce} Série ${serieNfce} ${dataVenda.toLocaleDateString('pt-BR')} ${dataVenda.toLocaleTimeString('pt-BR')}
           </div>
           <div class="center" style="font-size: 9px; margin-top:5px;">Protocolo de Autorização: ${protocolo}</div>
           <div class="center mt-2" style="font-size: 10px;">Consulte pela Chave de Acesso em<br>${urlConsultaSefaz}</div>
           <div class="chave">${chaveAcessoFormatada}</div>
           <div class="center mt-2 mb-2">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code NFC-e" />
           </div>
           <div class="border-top msg-rodape">
              Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ ${impostoMes.toFixed(2)}<br><br>
              ${sys.rodape || 'Obrigado pela preferência! Volte sempre.'}
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

        // Garante que a data está correta com base no retorno do backend
        const dataVenda = vendaFinalizada?.dataVenda ? new Date(vendaFinalizada.dataVenda) : new Date();
        const dataFormatada = dataVenda.toLocaleDateString('pt-BR') + ' às ' + dataVenda.toLocaleTimeString('pt-BR');

        // Formatação dos Itens e Valores
        let listaItens = carrinho.map(i => `▪️ ${i.quantidade} un x ${i.descricao} - R$ ${(i.precoVenda * i.quantidade).toFixed(2)}`).join('\n');
        const descontosStr = descontoTotalRaw > 0 ? `\n*Desconto:* - R$ ${descontoTotalRaw.toFixed(2)}` : '';
        let pagamentosStr = pagamentos.map(p => `${p.tipo}: R$ ${p.valor.toFixed(2)}`).join('\n');

        let chaveAcesso = vendaFinalizada?.chaveAcessoNfce;
        let textoFiscal = '';

        // Cálculo/Extração dos Tributos (Lei 12.741/12)
        // Se o backend enviar valores como valorIbs, valorCbs, etc., você pode somá-los aqui.
        // Caso contrário, usa-se a média padrão aproximada do IBPT para o varejo (ex: 18%)
        const tributosEstimados = vendaFinalizada?.valorIbs || (totalPagar * 0.18);
        const impostosStr = `\nTrib. aprox.: R$ ${tributosEstimados.toFixed(2)} (Lei Fed. 12.741/12)`;

        // Montagem do bloco oficial da NFC-e
        if (chaveAcesso && !chaveAcesso.includes("SIMULADA") && !chaveAcesso.includes("Aguardando")) {
            // Formata a chave com espaços a cada 4 dígitos
            const chaveFormatada = chaveAcesso.replace(/(.{4})/g, '$1 ').trim();

            // Extrai o Número (posições 25 a 33) e a Série (posições 22 a 24) direto da Chave de Acesso
            const numeroNfce = parseInt(chaveAcesso.substring(25, 34), 10);
            const serieNfce = parseInt(chaveAcesso.substring(22, 25), 10);

            textoFiscal = `\n\n🧾 *DOCUMENTO FISCAL (NFC-e)*\nNFC-e nº: ${numeroNfce}  Série: ${serieNfce}\n\n*Consulte pela Chave de Acesso em:*\nhttp://nfce.sefaz.pe.gov.br/nfce/consulta\n\n*Chave:*\n${chaveFormatada}${impostosStr}`;
        } else {
            textoFiscal = `\n\n🧾 *RECIBO DE VENDA*\n(Sem valor fiscal)${impostosStr}`;
        }

        // Montagem final do Layout da Mensagem
        const texto = `*DD COSMÉTICOS*\nCNPJ: 57.648.950/0001-44\n\n📅 ${dataFormatada}\n\n🛒 *RESUMO DA COMPRA:*\n${listaItens}\n\n*Subtotal:* R$ ${subtotalItens.toFixed(2)}${descontosStr}\n*TOTAL:* R$ ${totalPagar.toFixed(2)}\n\n💳 *Pagamento:*\n${pagamentosStr}\n*Troco:* R$ ${troco.toFixed(2)}${textoFiscal}\n\nObrigado pela preferência! ✨`;

        window.open(`https://api.whatsapp.com/send?phone=55${zapNumber.replace(/\D/g, '')}&text=${encodeURIComponent(texto)}`, '_blank');
        setShowZapModal(false);
    };

  if (validandoCaixa) return <div className="loader"><div className="spinner"></div><h2>A Iniciar Terminal...</h2></div>;

  return (
    <div className="pos-container">

      {(!isMobile || mobileViewState === 'SCAN' || mobileViewState === 'CART') && (
      <section className={`pos-cart-section ${isMobile && mobileViewState === 'CART' ? 'mobile-cart-active' : ''}`}>

          {(!isMobile || mobileViewState === 'SCAN') && (
          <header className="pos-header">
              <div className="pos-brand">
                  {lojaLogo ? (
                      <div className="brand-logo-box"><img src={lojaLogo} alt="Logo" /></div>
                  ) : (
                      <div className="brand-icon">✨</div>
                  )}
                  <div className="brand-info"><h1>DD Cosméticos</h1><span>Terminal Caixa {isOnline ? '🟢' : '🔴'}</span></div>
              </div>
              <div className="header-actions">
                  <div className="header-clock hide-mobile tooltip-wrap">
                      <Clock size={16} className="text-primary" />
                      {horaAtual.toLocaleTimeString('pt-BR')}
                      <span className="tooltip-text">Hora Atual</span>
                  </div>
                  <div className="tooltip-wrap">
                      <button className="btn-icon-outline" onClick={handleSolicitarFechamento} title="Fechar Caixa"><LogOut size={18}/></button>
                      <span className="tooltip-text">Fechar o Caixa</span>
                  </div>
                  <div className="tooltip-wrap">
                      <button className="btn-icon-danger" onClick={handleSairPdv} title="Abandonar Venda"><ArrowLeft size={18}/></button>
                      <span className="tooltip-text text-danger">Sair do PDV</span>
                  </div>
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
              <div className="tooltip-wrap ml-2">
                  <button className="btn-camera" onClick={() => setShowScanner(true)}><Camera size={24} /></button>
                  <span className="tooltip-text">Ler Código pela Câmera</span>
              </div>

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
                  <button className="btn-text-danger" onClick={handleCancelarVenda}>Esvaziar</button>
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
                  <div className="card-cliente tooltip-wrap" onClick={() => setShowClienteModal(true)}>
                      <div className="card-cliente-icon"><UserCheck size={24}/></div>
                      <div className="card-cliente-info"><span>Identificação</span><strong>{clienteAvulso.nome || 'Consumidor Final'}</strong></div>
                      <ArrowRight size={20} className="text-muted"/>
                      <span className="tooltip-text">Inserir CPF na Nota</span>
                  </div>

                  <div className="grid-atalhos">
                      <div className="tooltip-wrap w-full">
                          <button className="btn-atalho atalho-cliente w-full" onClick={() => setShowClienteModal(true)}>
                              <div className="icon-wrapper"><UserCheck size={20}/></div><span>Cliente</span><kbd className="hide-mobile">F3</kbd>
                          </button>
                          <span className="tooltip-text">Atalho para identificar cliente</span>
                      </div>

                      <div className="tooltip-wrap w-full">
                          <button className="btn-atalho atalho-desconto w-full" onClick={() => { if(carrinho.length) setShowDescontoModal(true); else toast.warn("Vazio"); }}>
                              <div className="icon-wrapper"><Tag size={20}/></div><span>Desconto</span><kbd className="hide-mobile">F4</kbd>
                          </button>
                          <span className="tooltip-text">Aplicar Desconto (F4)</span>
                      </div>

                      <div className="tooltip-wrap w-full">
                          <button className="btn-atalho atalho-pausa w-full" onClick={handlePausarVenda}>
                              <div className="icon-wrapper bg-warning-light text-warning"><PauseCircle size={20}/></div><span>Pausar</span>
                          </button>
                          <span className="tooltip-text">Salvar venda para continuar depois</span>
                      </div>

                      <div className="tooltip-wrap w-full">
                          <button className="btn-atalho atalho-espera w-full" onClick={() => { if(vendasPausadas.length > 0) setShowPausadasModal(true); else toast.info("Nenhuma pausa"); }}>
                              <div className="icon-wrapper bg-info-light text-info relative">
                                  <PlayCircle size={20}/>
                                  {vendasPausadas.length > 0 && <span className="badge-pulse">{vendasPausadas.length}</span>}
                              </div>
                              <span>Em Espera</span>
                          </button>
                          <span className="tooltip-text">Recuperar vendas pausadas</span>
                      </div>

                      <div className="tooltip-wrap w-full">
                          <button className="btn-atalho atalho-ruptura w-full" onClick={() => setShowRupturaModal(true)}>
                              <div className="icon-wrapper"><TrendingDown size={20}/></div><span>Ruptura</span><kbd className="hide-mobile">F9</kbd>
                          </button>
                          <span className="tooltip-text">Registrar item que faltou na loja</span>
                      </div>

                      <div className="tooltip-wrap w-full">
                          <button className="btn-atalho btn-atalho-danger w-full" onClick={handleCancelarVenda}>
                              <div className="icon-wrapper"><Trash2 size={20}/></div><span>Cancelar</span><kbd className="hide-mobile">DEL</kbd>
                          </button>
                          <span className="tooltip-text text-danger">Limpar carrinho e recomeçar</span>
                      </div>
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
                      {metodosPagamentoAtivos.map(m => (
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
                  <LogOut size={50} color="#ef4444" className="mx-auto mb-3"/>
                  <h2 className="title-main mb-2 text-xl">Sair do PDV?</h2>
                  <p className="text-sec mb-4">Tem certeza que deseja fechar o painel de vendas? A venda atual será perdida.</p>
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowExitModal(false)}>Ficar</button>
                      <button className="btn-danger-block flex-1" onClick={confirmarSaidaPdv}>Sim, Sair</button>
                  </div>
              </div>
          </div>
      )}

      {showCancelVendaModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-danger">
                  <AlertTriangle size={50} color="#ef4444" className="mx-auto mb-3"/>
                  <h2 className="title-main mb-2 text-xl">Cancelar Venda Atual?</h2>
                  <p className="text-sec mb-4">Atenção: Todos os itens lidos serão removidos do carrinho e o evento registado na auditoria.</p>
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowCancelVendaModal(false)}>Voltar</button>
                      <button className="btn-danger-block flex-1" onClick={confirmarCancelamentoVenda}>Limpar Carrinho</button>
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
                      {descontoTotalRaw > 0 && (
                          <button className="mg-btn danger" onClick={removerDescontoGlobal}>Remover</button>
                      )}
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
              <div className="modal-glass-card fade-in border-top-warning">
                  <h2 className="title-main mb-4 text-center">Vendas em Espera</h2>
                  {vendasPausadas.length === 0 ? <p className="text-sec text-center">Nenhuma venda pausada no momento.</p> : (
                      <div className="d-flex-col gap-3">
                          {vendasPausadas.map(v => (
                              <div key={v.id} className="cart-card flex-col align-start p-3" style={{ borderLeft: '4px solid #10b981' }}>
                                  <div className="d-flex justify-between w-full mb-2">
                                      <strong>{v.clienteAvulso.nome || 'Cliente Anônimo'}</strong>
                                      <span className="text-muted">{v.data}</span>
                                  </div>
                                  <div className="d-flex justify-between w-full align-center">
                                      <span className="text-sec">{v.carrinho.length} itens • R$ {v.totalPagar.toFixed(2)}</span>
                                      <button className="btn-outline-sec" style={{ borderColor: '#10b981', color: '#059669', padding: '8px 16px', width: 'auto' }} onClick={() => handleRestaurarVenda(v.id)}>Restaurar</button>
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

      {/* MODAL DE CADASTRO RÁPIDO (COM INTELIGÊNCIA ARTIFICIAL) */}
      {showCadastroRapido && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card sm fade-in border-top-primary">
                  <div className="d-flex justify-between align-center mb-2">
                      <h2 className="title-main m-0">Novo Produto</h2>
                      {produtoRapido.loadingIA && (
                          <span className="badge-pulse" style={{position:'relative', width:'auto', padding:'4px 10px', borderRadius:'12px', background:'#e0e7ff', color:'#4338ca', display:'flex', gap:'6px'}}>
                              <div className="spinner-micro" style={{borderColor:'#4338ca', borderTopColor:'transparent'}}></div> IA Analisando...
                          </span>
                      )}
                  </div>
                  <p className="text-sec mb-4 text-sm">A IA tenta preencher os dados fiscais por você.</p>

                  <div className="d-flex gap-3 mb-3">
                      <div className="w-45">
                          <label className="form-label">EAN Lido</label>
                          <input className="mg-input bg-disabled" value={produtoRapido.codigoBarras} disabled />
                      </div>
                      <div className="flex-1">
                          <label className="form-label">Preço Final (R$)</label>
                          <input id="input-preco-rapido" className="mg-input text-center" style={{ borderColor: 'var(--success)', color: 'var(--success)', fontWeight: '900', fontSize: '1.4rem' }} inputMode="numeric" value={getValorFormatado(produtoRapido.precoVendaRaw)} onChange={e => setProdutoRapido({...produtoRapido, precoVendaRaw: formatCurrencyInput(e.target.value)})} onKeyDown={e => e.key === 'Enter' && handleSalvarProdutoRapido()} autoFocus={!produtoRapido.descricao} />
                      </div>
                  </div>

                  <label className="form-label d-flex justify-between">
                      <span>Descrição (Nome na Nota)</span>
                      {!produtoRapido.loadingIA && produtoRapido.descricao.length > 3 && (
                          <button className="btn-text-primary p-0" style={{fontSize:'0.75rem', background:'transparent', border:'none', color:'var(--primary)', fontWeight:'800'}} onClick={() => classificarComIA(produtoRapido.descricao, produtoRapido.codigoBarras)}>✨ Forçar IA</button>
                      )}
                  </label>
                  <input className="mg-input mb-3" placeholder="Ex: MASCARA HIDRATANTE 200G" value={produtoRapido.descricao} onChange={e => setProdutoRapido({...produtoRapido, descricao: e.target.value})} autoFocus={!produtoRapido.descricao} />

                  <div className="d-flex gap-3 mb-3">
                      <div className="flex-1">
                          <label className="form-label">Categoria</label>
                          <input className={`mg-input ${produtoRapido.loadingIA ? 'bg-disabled' : ''}`} placeholder="Ex: MAQUIAGEM" value={produtoRapido.categoria} onChange={e => setProdutoRapido({...produtoRapido, categoria: e.target.value})} disabled={produtoRapido.loadingIA} />
                      </div>
                      <div className="flex-1">
                          <label className="form-label">Subcategoria</label>
                          <input className={`mg-input ${produtoRapido.loadingIA ? 'bg-disabled' : ''}`} placeholder="Ex: BATOM" value={produtoRapido.subcategoria} onChange={e => setProdutoRapido({...produtoRapido, subcategoria: e.target.value})} disabled={produtoRapido.loadingIA} />
                      </div>
                  </div>

                  <div className="mb-4">
                      <label className="form-label">NCM (Fiscal)</label>
                      <input className={`mg-input ${produtoRapido.loadingIA ? 'bg-disabled' : ''}`} placeholder="Ex: 33049990" value={produtoRapido.ncm} onChange={e => setProdutoRapido({...produtoRapido, ncm: e.target.value})} disabled={produtoRapido.loadingIA} />
                  </div>

                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => { setShowCadastroRapido(false); setBusca(''); setProdutoRapido({...produtoRapido, loadingIA: false}); }}>Cancelar</button>
                      <button className="btn-primary-block flex-1" onClick={handleSalvarProdutoRapido} disabled={produtoRapido.loadingIA || loading}>Adicionar à Venda</button>
                  </div>
              </div>
          </div>
      )}

      {showScanner && <ScannerModal onProcessScan={(ean) => { setShowScanner(false); processarEAN(ean); }} onClose={() => setShowScanner(false)} />}

    </div>
  );
};

export default PDV;