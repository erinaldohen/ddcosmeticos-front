import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Plus, Minus, ArrowLeft, X, UserCheck, ArrowRight, Banknote, Smartphone,
  CreditCard, Tag, ShoppingBag, CheckCircle2, LogOut, TrendingDown,
  Camera, Printer, MessageCircle, AlertTriangle, ChevronUp, PauseCircle, PlayCircle, Clock, FileText, Zap, Building2, MapPin, WifiOff, Wifi, Mail
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import caixaService from '../../services/caixaService';
import './PDV.css';

// ==========================================================
// UTILITÁRIOS E VALIDAÇÕES MATEMÁTICAS
// ==========================================================
const mascaraTelefone = (v) => { if (!v) return ''; let val = v.replace(/\D/g, ''); if (val.length <= 10) return val.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2'); return val.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15); };
const mascaraDocumento = (v) => { if (!v) return ''; let val = v.replace(/\D/g, ''); if (val.length <= 11) return val.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); return val.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18); };
const mascaraCEP = (v) => { if (!v) return ''; let val = v.replace(/\D/g, ''); return val.replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9); };
const cleanNumeric = (v) => (v ? String(v).replace(/\D/g, '') : '');
const formatCurrencyInput = (v) => String(v).replace(/\D/g, "");
const getValorFormatado = (r) => r ? (parseInt(r, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";

// Validação Matemática Real
const validarCPF = (cpf) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11; if (resto === 10 || resto === 11) resto = 0; if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11; if (resto === 10 || resto === 11) resto = 0; if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
};

const validarCNPJ = (cnpj) => {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    let tamanho = cnpj.length - 2, numeros = cnpj.substring(0, tamanho), digitos = cnpj.substring(tamanho), soma = 0, pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) { soma += numeros.charAt(tamanho - i) * pos--; if (pos < 2) pos = 9; }
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11; if (resultado !== parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1; numeros = cnpj.substring(0, tamanho); soma = 0; pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) { soma += numeros.charAt(tamanho - i) * pos--; if (pos < 2) pos = 9; }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11; if (resultado !== parseInt(digitos.charAt(1))) return false;
    return true;
};

const getBackendUrl = () => api.defaults.baseURL ? api.defaults.baseURL.split('/api')[0] : "";
const playAudio = (type = 'success') => { try { const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const osc = audioCtx.createOscillator(); osc.type = type === 'success' ? 'sine' : 'sawtooth'; osc.frequency.setValueAtTime(type === 'success' ? 850 : 150, audioCtx.currentTime); osc.connect(audioCtx.destination); osc.start(); setTimeout(() => osc.stop(), type === 'success' ? 120 : 300); } catch (e) {} };

// ==========================================================
// CÂMERA MOBILE
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
        const config = { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0, formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.QR_CODE ] };
        scanner.start({ facingMode: "environment" }, config, (decodedText) => { if (wasScanned) return; const valorLimpo = decodedText.replace(/[^a-zA-Z0-9]/g, ''); if (valorLimpo) { wasScanned = true; try { scanner.pause(true); } catch (e) {} onProcessScan(valorLimpo); } }, () => {}).then(() => { try { const track = scanner.getRunningTrackCameraCapabilities(); if (track && track.torchFeature().isSupported) setHasFlashlight(true); } catch (e) {} }).catch(() => toast.error("Falha ao acessar a câmera."));
        return () => { wasScanned = true; if (scanner) { try { if (scanner.isScanning || scanner.getState() === 2) { scanner.stop().then(() => { scanner.clear(); scanner = null; }).catch(() => { scanner.clear(); scanner = null; }); } else { scanner.clear(); scanner = null; } } catch (error) { scanner = null; } } };
    }, [onProcessScan]);

    const handleManualSubmit = (e) => { e.preventDefault(); if (manualEan.trim().length >= 3) onProcessScan(manualEan.trim()); };
    const toggleFlashlight = async () => { if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) { const newState = !isFlashlightOn; try { await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: newState }] }); setIsFlashlightOn(newState); } catch (e) { toast.warn("Lanterna não suportada."); } } };

    return (
        <div className="modal-glass z-max">
            <div className="modal-glass-card sm text-center fade-in bg-dark-glass" style={{ padding: '24px' }}>
                <div className="d-flex justify-between align-center mb-4">
                    <h3 className="title-main text-white m-0 text-left">Escaneie o Código</h3>
                    {hasFlashlight && <button className={`btn-torch ${isFlashlightOn ? 'active' : ''}`} onClick={toggleFlashlight} title="Lanterna"><Zap size={22} /></button>}
                </div>
                <div className="scanner-viewport" style={{ aspectRatio: '1/1', marginBottom: '20px' }}>
                    <div id="reader-core" className="reader-core" style={{ minHeight: '250px' }}></div>
                    <div className="scanner-overlay"></div><div className="scanner-laser"></div>
                </div>
                <div className="fallback-manual" style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px' }}>
                    <p className="text-white mb-2" style={{ fontSize: '0.85rem', fontWeight: '600' }}>Plástico refletindo? Digite o código:</p>
                    <form onSubmit={handleManualSubmit} className="d-flex gap-2">
                        <input type="number" className="mg-input" style={{ padding: '10px', fontSize: '1.2rem', textAlign: 'center' }} placeholder="Ex: 78910..." value={manualEan} onChange={(e) => setManualEan(e.target.value)} autoFocus />
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
  const [alertaCrediario, setAlertaCrediario] = useState(null);
  const [senhaGerenteCrediario, setSenhaGerenteCrediario] = useState('');

  const registrarAcaoAuditoria = useCallback((acao, detalhes) => {
      const hora = new Date();
      setAuditLog(prev => [...prev, { acao, detalhes, hora: hora.toLocaleTimeString('pt-BR', { hour12: false }) + ':' + hora.getMilliseconds() }]);
  }, []);

  const inputBuscaRef = useRef(null);
  const inputValorRef = useRef(null);
  const dropdownRef = useRef(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [filaOffline, setFilaOffline] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:offline_vendas')) || []; } catch { return []; } });

  const [mobileViewState, setMobileView] = useState('SCAN');
  const [validandoCaixa, setValidandoCaixa] = useState(true);
  const [loading, setLoading] = useState(false);

  const [vendaFinalizada, setVendaFinalizada] = useState(null);
  const [emailEnvio, setEmailEnvio] = useState(''); // Estado para o E-mail pós-venda

  const [vendasPausadas, setVendasPausadas] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:pausadas')) || []; } catch { return []; } });
  const [showPausadasModal, setShowPausadasModal] = useState(false);

  const [carrinho, setCarrinho] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:carrinho')) || []; } catch { return []; } });
  const [pagamentos, setPagamentos] = useState([]);

  // CLIENTE AVULSO AMPLIADO (E-mail incluído)
  const [clienteAvulso, setClienteAvulso] = useState({
      nome: '', telefone: '', documento: '', email: '',
      isPj: false, ie: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: ''
  });
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [descontoTotalRaw, setDescontoTotalRaw] = useState(0);

  const [busca, setBusca] = useState('');
  const [sugestoesProdutos, setSugestoesProdutos] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [ultimoItemAdicionadoId, setUltimoItemAdicionadoId] = useState(null);

  const [showScanner, setShowScanner] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showDescontoModal, setShowDescontoModal] = useState(false);
  const [descontoInputRaw, setDescontoInputRaw] = useState('');
  const [tipoDesconto, setTipoDesconto] = useState('R$');
  const [showExitModal, setShowExitModal] = useState(false);
  const [showCancelVendaModal, setShowCancelVendaModal] = useState(false);
  const [showRupturaModal, setShowRupturaModal] = useState(false);
  const [produtoFaltante, setProdutoFaltante] = useState('');

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

  const pdvChannel = useMemo(() => new BroadcastChannel('pdv_channel'), []);

  useEffect(() => {
      pdvChannel.postMessage({ type: 'PDV_UPDATE', payload: { carrinho, totalPagar, totalPago, troco, cliente: clienteAvulso.nome, metodoAtual, status: mobileViewState === 'PAYMENT' ? 'PAGAMENTO' : 'LIVRE' } });
  }, [carrinho, totalPagar, totalPago, troco, clienteAvulso.nome, metodoAtual, mobileViewState, pdvChannel]);

  // Sincroniza e-mail ao finalizar a venda
  useEffect(() => {
      if (vendaFinalizada) setEmailEnvio(clienteAvulso.email || '');
  }, [vendaFinalizada, clienteAvulso.email]);

  // =======================================================================
  // INICIALIZAÇÃO
  // =======================================================================
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 992);
    window.addEventListener('resize', handleResize);
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);

    const syncOfflineQueue = async () => {
        setIsOnline(true);
        if (filaOffline.length > 0) {
            toast.info(`Sincronizando ${filaOffline.length} vendas offline...`);
            let filaRestante = [...filaOffline];
            for (let i = 0; i < filaOffline.length; i++) {
                try {
                    await api.post('/vendas', filaOffline[i]);
                    filaRestante = filaRestante.filter(v => v.idOffline !== filaOffline[i].idOffline);
                } catch (e) {}
            }
            setFilaOffline(filaRestante);
            if (filaRestante.length === 0) toast.success("Sincronização offline concluída com sucesso!");
        }
    };

    window.addEventListener('online', syncOfflineQueue);
    window.addEventListener('offline', () => setIsOnline(false));

    api.get('/configuracoes').then(res => {
        setConfigLoja(res.data);
        if (res.data?.financeiro) {
            const fin = res.data.financeiro; const ativos = [];
            if (fin.aceitaPix) ativos.push({id: 'PIX', icon: <Smartphone size={20}/>, label: 'Pix'});
            if (fin.aceitaDinheiro) ativos.push({id: 'DINHEIRO', icon: <Banknote size={20}/>, label: 'Dinheiro'});
            if (fin.aceitaCredito) ativos.push({id: 'CREDITO', icon: <CreditCard size={20}/>, label: 'Crédito'});
            if (fin.aceitaDebito) ativos.push({id: 'DEBITO', icon: <CreditCard size={20}/>, label: 'Débito'});
            if (fin.aceitaCrediario) ativos.push({id: 'CREDIARIO', icon: <FileText size={20}/>, label: 'Fiado'});
            if (ativos.length > 0) { setMetodosPagamentoAtivos(ativos); setMetodoAtual(ativos[0].id); }
        }
    }).catch(() => {});

    caixaService.getStatus().then(res => {
        if (!res || res.status === 'FECHADO' || !res.aberto) { toast.warning("O Caixa está Fechado."); navigate('/caixa'); }
        else setValidandoCaixa(false);
    }).catch(() => { setValidandoCaixa(false); });

    return () => {
        window.removeEventListener('resize', handleResize); clearInterval(timer);
        window.removeEventListener('online', syncOfflineQueue); window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, [filaOffline, navigate]);

  useEffect(() => { localStorage.setItem('@dd:carrinho', JSON.stringify(carrinho)); }, [carrinho]);
  useEffect(() => { localStorage.setItem('@dd:pausadas', JSON.stringify(vendasPausadas)); }, [vendasPausadas]);
  useEffect(() => { localStorage.setItem('@dd:offline_vendas', JSON.stringify(filaOffline)); }, [filaOffline]);

  // =======================================================================
  // TECLADO E BUSCA (BLINDADOS)
  // =======================================================================
  useEffect(() => {
      if (busca.trim().length < 3) { setSugestoesProdutos([]); setSelectedIndex(-1); return; }
      const delay = setTimeout(async () => {
          if(!isOnline) return;
          try { const { data } = await api.get(`/produtos?termo=${busca}&size=15`); setSugestoesProdutos(data.content || data); setSelectedIndex(-1); } catch (error) {}
      }, 300);
      return () => clearTimeout(delay);
  }, [busca, isOnline]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          const isModalOpen = showExitModal || showCancelVendaModal || showClienteModal || showDescontoModal || showRupturaModal || showPausadasModal || showZapModal || vendaFinalizada || alertaCrediario || showFechamentoModal || showScanner;

          if (e.key === 'Escape') {
              e.preventDefault();
              if (alertaCrediario) { setAlertaCrediario(null); setSenhaGerenteCrediario(''); return; }
              if (showZapModal) { setShowZapModal(false); return; }
              if (vendaFinalizada) { setVendaFinalizada(null); limparEstadoVenda(); return; }
              if (showClienteModal) { setShowClienteModal(false); return; }
              if (showDescontoModal) { setShowDescontoModal(false); return; }
              if (showRupturaModal) { setShowRupturaModal(false); return; }
              if (showCancelVendaModal) { setShowCancelVendaModal(false); return; }
              if (showExitModal) { setShowExitModal(false); return; }
              if (showPausadasModal) { setShowPausadasModal(false); return; }
              if (showFechamentoModal) { setShowFechamentoModal(false); return; }
              if (showScanner) { setShowScanner(false); return; }
              setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); setMobileView('SCAN'); return;
          }

          if (isModalOpen) return;

          // Atalhos MOUSE ZERO no Pagamento
          if (mobileViewState === 'PAYMENT') {
              if (e.target.tagName !== 'INPUT' || e.target.type === 'text') {
                  const k = e.key.toUpperCase();
                  if (k === 'P') { e.preventDefault(); setMetodoAtual('PIX'); inputValorRef.current?.focus(); }
                  else if (k === 'D') { e.preventDefault(); setMetodoAtual('DINHEIRO'); inputValorRef.current?.focus(); }
                  else if (k === 'C') { e.preventDefault(); setMetodoAtual('CREDITO'); inputValorRef.current?.focus(); }
                  else if (k === 'T') { e.preventDefault(); setMetodoAtual('DEBITO'); inputValorRef.current?.focus(); }
                  else if (k === 'F') { e.preventDefault(); setMetodoAtual('CREDIARIO'); inputValorRef.current?.focus(); }
              }
              if (e.key === 'Enter') {
                  e.preventDefault();
                  if (saldoDevedor <= 0.01 && !loading) finalizarVendaReal();
                  else handleAdicionarPagamento();
              }
              return;
          }

          // ATALHOS GERAIS
          if (e.key === 'F2') { e.preventDefault(); setMobileView('SCAN'); }
          if (e.key === 'F3') { e.preventDefault(); setShowClienteModal(true); }
          if (e.key === 'F4') { e.preventDefault(); handleShowDesconto(); }
          if (e.key === 'F5') { e.preventDefault(); handlePausarVenda(); }
          if (e.key === 'F6') { e.preventDefault(); handleShowPausadas(); }
          if (e.key === 'F8') { e.preventDefault(); handleIrParaPagamento(); }
          if (e.key === 'F9') { e.preventDefault(); setShowRupturaModal(true); }

          if (e.key === 'Delete' && e.target.tagName !== 'INPUT') { e.preventDefault(); handleCancelarVenda(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileViewState, carrinho.length, showClienteModal, showDescontoModal, showExitModal, showCancelVendaModal, showRupturaModal, showPausadasModal, showZapModal, showFechamentoModal, showScanner, vendaFinalizada, alertaCrediario, saldoDevedor, metodoAtual, loading]);

  // =======================================================================
  // AÇÕES BLINDADAS E VALIDADAS
  // =======================================================================
  const handleShowDesconto = () => { if (carrinho.length === 0) return toast.warn("Adicione produtos antes de dar desconto."); setShowDescontoModal(true); };
  const handleIrParaPagamento = () => { if (carrinho.length === 0) return toast.warn("O carrinho está vazio."); setMobileView('PAYMENT'); setValorInputRaw(Math.round(saldoDevedor * 100).toString()); setTimeout(()=> inputValorRef.current?.focus(), 100); };
  const handleCancelarVenda = () => { if (carrinho.length === 0) return toast.warn("Não há nada para cancelar."); setShowCancelVendaModal(true); };

  const handlePausarVenda = () => {
      if (carrinho.length === 0) return toast.warning("Adicione produtos antes de pausar a venda.");
      const novaPausa = { id: Date.now(), data: new Date().toLocaleTimeString(), carrinho, clienteAvulso, descontoTotalRaw, totalPagar, auditLog };
      setVendasPausadas([...vendasPausadas, novaPausa]);
      limparEstadoVenda();
      toast.info("Venda movida para espera.");
  };

  const handleShowPausadas = () => {
      if (vendasPausadas.length === 0) return toast.info("Nenhuma venda em espera no momento.");
      setShowPausadasModal(true);
  };

  const handleRestaurarVenda = (id) => {
      const venda = vendasPausadas.find(v => v.id === id); if (!venda) return;
      if (carrinho.length > 0) return toast.warning("Cancele a venda atual antes de restaurar.");
      setCarrinho(venda.carrinho); setClienteAvulso(venda.clienteAvulso); setDescontoTotalRaw(venda.descontoTotalRaw); setAuditLog(venda.auditLog || []);
      setVendasPausadas(vendasPausadas.filter(v => v.id !== id)); setShowPausadasModal(false);
      toast.success("Venda restaurada com sucesso!");
  };

  const confirmarCancelamentoVenda = () => { limparEstadoVenda(); setShowCancelVendaModal(false); toast.info("Venda atual cancelada."); };

  const limparEstadoVenda = () => { setCarrinho([]); setPagamentos([]); setClienteAvulso({ nome: '', telefone: '', documento: '', email: '', isPj: false, ie: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' }); setDescontoTotalRaw(0); setMobileView('SCAN'); setBusca(''); setAuditLog([]); };
  const handleSairPdv = () => { if(carrinho.length > 0) setShowExitModal(true); else navigate('/dashboard'); };
  const confirmarSaidaPdv = () => { limparEstadoVenda(); setShowExitModal(false); navigate('/dashboard'); };

  // =======================================================================
  // LOGICA B2B E VALIDAÇÃO VISUAL (SEM TOASTS INVASIVOS)
  // =======================================================================
  const statusDocumento = useMemo(() => {
      const clean = cleanNumeric(clienteAvulso.documento);
      if (clean.length === 11) return validarCPF(clean) ? 'valid' : 'invalid';
      if (clean.length === 14) return validarCNPJ(clean) ? 'valid' : 'invalid';
      return 'idle';
  }, [clienteAvulso.documento]);

  const buscarCnpj = async (cnpjLimpo) => {
      setLoadingCnpj(true);
      try {
          const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
          if (res.ok) {
              const data = await res.json(); const est = data.estabelecimento;
              let ieEncontrada = 'ISENTO';
              if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
                  const ativa = est.inscricoes_estaduais.find(i => i.ativa); ieEncontrada = ativa ? ativa.inscricao_estadual : est.inscricoes_estaduais[0].inscricao_estadual;
              }
              setClienteAvulso(prev => ({ ...prev, nome: data.razao_social, telefone: (est.ddd1 && est.telefone1) ? `${est.ddd1}${est.telefone1}` : prev.telefone, cep: est.cep || '', logradouro: est.logradouro || '', numero: est.numero || '', bairro: est.bairro || '', cidade: est.cidade?.nome || '', uf: est.estado?.sigla || '', ie: ieEncontrada, isPj: true }));
              toast.success("Empresa e IE identificadas! NF-e habilitada."); playAudio('success'); setLoadingCnpj(false); return;
          }
      } catch(e) { console.warn("CNPJ WS indisponível."); }

      try {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
          if (res.ok) {
              const data = await res.json();
              setClienteAvulso(prev => ({ ...prev, nome: data.razao_social, telefone: data.ddd_telefone_1 || prev.telefone, cep: data.cep || '', logradouro: data.logradouro || '', numero: data.numero || '', bairro: data.bairro || '', cidade: data.municipio || '', uf: data.uf || '', ie: '', isPj: true }));
              toast.success("Empresa identificada! Preencha a IE manualmente."); playAudio('success');
          } else { setClienteAvulso(prev => ({...prev, isPj: true})); }
      } catch(e) { setClienteAvulso(prev => ({...prev, isPj: true})); } finally { setLoadingCnpj(false); }
  };

  const handleDocumentoChange = (e) => {
      const val = mascaraDocumento(e.target.value);
      const clean = cleanNumeric(val);
      setClienteAvulso(prev => ({...prev, documento: val, isPj: clean.length > 11}));

      // Busca silenciosa se bater 14 dígitos e for válido
      if (clean.length === 14 && validarCNPJ(clean)) {
          buscarCnpj(clean);
      }
  };

  const confirmarClienteModal = () => {
      const clean = cleanNumeric(clienteAvulso.documento);
      if (clean.length > 0) {
          if (clean.length < 11) return toast.warning("Documento incompleto. Digite 11 ou 14 números.");
          if (clean.length === 11 && !validarCPF(clean)) return toast.error("O CPF digitado é inválido.");
          if (clean.length > 11 && clean.length < 14) return toast.warning("CNPJ incompleto.");
          if (clean.length === 14 && !validarCNPJ(clean)) return toast.error("O CNPJ digitado é inválido.");
      }
      toast.success("Dados confirmados.");
      setShowClienteModal(false);
      if (!isMobile) setTimeout(() => inputBuscaRef.current?.focus(), 100);
  };

  // =======================================================================
  // PRODUTOS E PREÇOS
  // =======================================================================
  const adicionarProdutoAoCarrinho = useCallback((prod) => {
      playAudio('success'); setUltimoItemAdicionadoId(null); setTimeout(() => setUltimoItemAdicionadoId(prod.id), 10); setTimeout(() => setUltimoItemAdicionadoId(null), 800);
      setCarrinho(prev => {
          const index = prev.findIndex(i => i.id === prod.id);
          if (index >= 0) { registrarAcaoAuditoria('AUMENTOU_QTD', `Produto: ${prod.descricao} (+1)`); const nc = [...prev]; nc[index] = { ...nc[index], quantidade: nc[index].quantidade + 1 }; return nc; }
          registrarAcaoAuditoria('ADICIONOU_PRODUTO', `Produto: ${prod.descricao} | Valor: R$ ${prod.precoVenda}`); return [...prev, { ...prod, quantidade: 1, desconto: 0 }];
      });
      setBusca(''); setSugestoesProdutos([]); setSelectedIndex(-1); if (inputBuscaRef.current) inputBuscaRef.current.value = '';
  }, [registrarAcaoAuditoria]);

  const processarEAN = async (valorRaw) => {
      const valor = valorRaw.replace(/[^a-zA-Z0-9]/g, ''); if (!valor) return;
      if (!isOnline) return toast.warning("Modo offline: Não é possível buscar novos códigos na nuvem.");
      try {
          const { data } = await api.get(`/produtos/ean/${valor}`);
          let produto = Array.isArray(data) ? data[0] : data;
          if (produto && (produto.id || produto.codigoBarras)) { adicionarProdutoAoCarrinho(produto); } else { throw new Error("Não encontrado"); }
      } catch (err) { playAudio('error'); toast.warning("Produto não cadastrado na base!"); setBusca(''); if (inputBuscaRef.current) inputBuscaRef.current.value = ''; }
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

  const atualizarQtd = (id, d) => { setCarrinho(prev => prev.map(i => { if (i.id === id) { const novaQtd = Math.max(1, i.quantidade + d); return { ...i, quantidade: novaQtd }; } return i; })); };
  const removerItem = (id) => { setCarrinho(prev => prev.filter(i => i.id !== id)); };

  const aplicarDescontoGlobal = () => {
      const valorBase = parseInt(descontoInputRaw || '0', 10) / 100; let valorReal = 0;
      if (valorBase > 0) {
          valorReal = (tipoDesconto === '%') ? subtotalItens * (valorBase / 100) : valorBase;
          if (tipoDesconto === '%' && valorBase > 100) return toast.error("O desconto não pode ser maior que 100%");
          if (tipoDesconto === 'R$' && valorBase > subtotalItens) return toast.error("O desconto não pode ser maior que o subtotal da venda");
          setDescontoTotalRaw(valorReal); toast.success("Desconto aplicado com sucesso!");
      }
      setDescontoInputRaw(''); setShowDescontoModal(false);
  };
  const removerDescontoGlobal = () => { setDescontoTotalRaw(0); setDescontoInputRaw(''); setShowDescontoModal(false); toast.info("Desconto removido da venda."); };

  const handleSolicitarFechamento = () => { if (carrinho.length > 0) return toast.warning("Cancele a venda atual antes de fechar o caixa."); setShowFechamentoModal(true); setRequerJustificativa(false); setJustificativa(''); setValorFechamentoRaw(''); };
  const confirmarFechamentoCaixa = async () => {
      if (requerJustificativa && justificativa.trim().length < 10) return toast.warning("Sua justificativa é muito curta. Detalhe o motivo.");
      setLoading(true);
      try {
          const valorInformado = parseInt(valorFechamentoRaw.replace(/\D/g, '') || '0', 10) / 100;
          await api.post('/caixas/fechar', { valorFisicoInformado: valorInformado, justificativaDiferenca: justificativa.trim() !== '' ? justificativa : null });
          toast.success("O caixa foi fechado com sucesso."); setShowFechamentoModal(false); limparEstadoVenda(); navigate('/caixa');
      } catch (error) {
          if (error.response?.status === 428 || error.response?.data?.message?.toLowerCase().includes("justificativa")) { setRequerJustificativa(true); toast.warning("Divergência detectada. Justifique os valores."); }
          else { toast.error("Falha ao encerrar o caixa."); }
      } finally { setLoading(false); }
  };

  const handleAdicionarPagamento = async () => {
      let valor = parseInt(valorInputRaw.replace(/\D/g, '') || '0', 10) / 100;
      if (valor <= 0 && saldoDevedor > 0) valor = saldoDevedor; if (valor <= 0) return;

      if (metodoAtual === 'CREDIARIO') {
          if (!isOnline) return toast.warning("Modo Offline: Vendas no crediário requerem internet para consulta do SPC.");
          const docClean = cleanNumeric(clienteAvulso.documento);
          if (!docClean || docClean.length < 11 || !clienteAvulso.nome || clienteAvulso.nome.trim() === '') { setShowClienteModal(true); return toast.warning("Identifique o cliente na nota para autorizar o Fiado."); }
          setLoading(true);
          try {
              const { data: statusCliente } = await api.get(`/clientes/analise-credito/${docClean}`);
              if (statusCliente.bloqueado || statusCliente.debitosAtraso > 0) { setLoading(false); setAlertaCrediario(statusCliente); return; }
          } catch (err) {
              if (err.response?.status === 404) { try { await api.post('/clientes', { nome: clienteAvulso.nome.toUpperCase(), documento: docClean, telefone: cleanNumeric(clienteAvulso.telefone) || "", ativo: true, limiteCredito: 0 }); } catch (erroCadastro) { setLoading(false); return toast.error("Falha ao registrar cliente novo."); } }
              else { setLoading(false); return toast.warning("Serviço de análise de crédito indisponível."); }
          }
          setLoading(false);
      }

      setPagamentos([...pagamentos, { id: Date.now(), tipo: metodoAtual, valor }]);
      const novoSaldo = Math.max(0, saldoDevedor - valor);
      if (novoSaldo > 0) setValorInputRaw((Math.round(novoSaldo * 100)).toString()); else setValorInputRaw('');
      if (!isMobile) setTimeout(() => inputValorRef.current?.focus(), 50);
  };

  const handleRemoverPagamento = (id) => {
      const novos = pagamentos.filter(x => x.id !== id); setPagamentos(novos);
      const novoTotalPago = novos.reduce((acc, p) => acc + p.valor, 0); const novoSaldo = Math.max(0, parseFloat((totalPagar - novoTotalPago).toFixed(2)));
      if (novoSaldo > 0) setValorInputRaw((Math.round(novoSaldo * 100)).toString());
  };

  // =======================================================================
  // FINALIZAÇÃO COM INTERCEPTADOR OFFLINE
  // =======================================================================
  const finalizarVendaReal = async () => {
      if (saldoDevedor > 0.01) return toast.error(`Ainda falta pagar R$ ${saldoDevedor.toFixed(2)}`);

      const payload = {
          idOffline: `OFF-${Date.now()}`,
          subtotal: subtotalItens, descontoTotal: descontoItens + descontoTotalRaw, totalPago: totalPagar,
          troco: Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2))),
          clienteNome: clienteAvulso.nome || "Consumidor Final",
          clienteDocumento: cleanNumeric(clienteAvulso.documento) || null,
          clienteTelefone: cleanNumeric(clienteAvulso.telefone) || null,
          clienteCep: clienteAvulso.isPj ? clienteAvulso.cep : null,
          clienteLogradouro: clienteAvulso.isPj ? clienteAvulso.logradouro : null,
          clienteNumero: clienteAvulso.isPj ? clienteAvulso.numero : null,
          clienteBairro: clienteAvulso.isPj ? clienteAvulso.bairro : null,
          clienteCidade: clienteAvulso.isPj ? clienteAvulso.cidade : null,
          clienteUf: clienteAvulso.isPj ? clienteAvulso.uf : null,
          clienteIe: clienteAvulso.ie || null,
          tipoNota: clienteAvulso.isPj ? 'NFE' : 'NFCE',
          itens: carrinho.map(i => ({ produtoId: i.id, quantidade: i.quantidade, precoUnitario: i.precoVenda, desconto: i.desconto || 0 })),
          pagamentos: pagamentos.map(p => ({ formaPagamento: p.tipo, valor: p.valor, parcelas: 1 })),
          logAuditoria: auditLog
      };

      if (!isOnline) {
          setFilaOffline([...filaOffline, payload]);
          toast.success("A internet falhou, mas a venda foi gravada em segurança no Modo Offline!");
          setVendaFinalizada({ idVenda: payload.idOffline, status: 'OFFLINE', offline: true, dataVenda: new Date(), ...payload, tipoNota: payload.tipoNota });
          return;
      }

      setLoading(true);
      try {
          let response = await api.post('/vendas', payload);
          let vendaResult = response.data;

          if (vendaResult.statusNfce === 'REJEITADA') throw new Error("A SEFAZ rejeitou o documento. Verifique os dados fiscais.");

          toast.success(clienteAvulso.isPj ? "NF-e Emitida com Sucesso!" : "Cupom Finalizado com Sucesso!");
          setVendaFinalizada({...vendaResult, tipoNota: payload.tipoNota});
      } catch (err) {
          toast.error(err.message || "Houve uma falha de comunicação com o servidor.");
      } finally {
          setLoading(false);
      }
  };

  // =======================================================================
  // AÇÕES PÓS-VENDA (IMPRESSÃO INTELIGENTE E E-MAIL SOB DEMANDA)
  // =======================================================================
  const imprimirCupomLocal = () => {
      const isNfe = vendaFinalizada?.tipoNota === 'NFE';
      const razaoSocial = configLoja?.loja?.razaoSocial || "DD Cosméticos";
      const cnpjL = configLoja?.loja?.cnpj || "57.648.950/0001-44";
      const numDoc = vendaFinalizada?.numeroNfce || vendaFinalizada?.idVenda || "000000";
      const serieDoc = vendaFinalizada?.serieNfce || "1";
      const chaveAcesso = vendaFinalizada?.chaveAcessoNfce || "00000000000000000000000000000000000000000000";

      // ROTEAMENTO DE IMPRESSÃO: A4 (NF-e) vs BOBINA (NFC-e)
      if (isNfe) {
          toast.info("Gerando DANFE A4 (Nota Grande)...");
          const printWindow = window.open('', '_blank', 'width=900,height=800');
          printWindow.document.write(`
              <html>
              <head><title>DANFE NF-e - ${razaoSocial}</title></head>
              <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;" onload="window.print(); setTimeout(()=>window.close(), 500);">
                  <div style="border: 2px solid #000; padding: 20px; border-radius: 8px; max-width: 800px; margin: auto;">
                      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px;">
                          <div>
                              <h2 style="margin: 0 0 10px 0;">${razaoSocial}</h2>
                              <p style="margin: 0; font-size: 12px;">CNPJ: ${cnpjL}</p>
                              <p style="margin: 0; font-size: 12px;">Recife - PE</p>
                          </div>
                          <div style="text-align: center; border-left: 2px solid #000; padding-left: 20px;">
                              <h3 style="margin: 0 0 5px 0;">DANFE</h3>
                              <p style="margin: 0; font-size: 10px;">Documento Auxiliar da Nota Fiscal Eletrônica</p>
                              <p style="font-weight: bold; margin-top: 10px;">Nº ${numDoc} - Série ${serieDoc}</p>
                          </div>
                      </div>
                      <div style="margin-bottom: 20px;">
                          <h4 style="background: #f1f5f9; padding: 5px; margin: 0 0 10px 0; border: 1px solid #ccc;">DADOS DO DESTINATÁRIO</h4>
                          <p style="margin: 0; font-size: 12px;"><strong>Razão Social:</strong> ${clienteAvulso.nome}</p>
                          <p style="margin: 0; font-size: 12px;"><strong>CNPJ:</strong> ${clienteAvulso.documento} &nbsp;&nbsp; <strong>IE:</strong> ${clienteAvulso.ie || 'ISENTO'}</p>
                          <p style="margin: 0; font-size: 12px;"><strong>Endereço:</strong> ${clienteAvulso.logradouro}, ${clienteAvulso.numero} - ${clienteAvulso.bairro}, ${clienteAvulso.cidade}-${clienteAvulso.uf}</p>
                      </div>
                      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc;">
                          <p style="font-size: 10px; margin: 0;">Chave de Acesso</p>
                          <p style="font-weight: bold; font-size: 14px; letter-spacing: 2px;">${chaveAcesso.replace(/(\d{4})/g, '$1 ').trim()}</p>
                      </div>
                  </div>
              </body>
              </html>
          `);
          printWindow.document.close();
          return;
      }

      // IMPRESSORA TÉRMICA 80MM (CUPOM NFC-e)
      const qrCodeUrl = vendaFinalizada?.urlQrCode || `http://nfce.sefaz.pe.gov.br/nfce/consulta?chNFe=${chaveAcesso}`;
      let itensHTML = carrinho.map(i => `<tr><td style="text-align:left; font-size:11px;">${i.quantidade}x ${i.descricao}</td><td style="text-align:right; font-size:11px;">R$ ${(i.quantidade * i.precoVenda).toFixed(2)}</td></tr>`).join('');

      let printHtml = `
          <html>
          <head>
              <title>DANFE NFC-e</title>
              <style>
                  body { font-family: monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; color: #000; }
                  .center { text-align: center; } .bold { font-weight: bold; }
                  .line { border-bottom: 1px dashed #000; margin: 10px 0; }
                  table { width: 100%; border-collapse: collapse; }
              </style>
          </head>
          <body onload="window.print(); setTimeout(()=>window.close(), 500);">
              <div class="center bold" style="font-size:14px;">${razaoSocial}</div>
              <div class="center">CNPJ: ${cnpjL}</div>
              <div class="line"></div>
              <div class="center bold">DANFE NFC-e - Consumidor Final</div>
              <div class="line"></div>
              <table>${itensHTML}</table>
              <div class="line"></div>
              <div style="display:flex; justify-content:space-between;" class="bold"><span>TOTAL:</span><span>R$ ${totalPagar.toFixed(2)}</span></div>
              <div class="line"></div>
              <div class="center">Nº ${numDoc} - Série ${serieDoc}</div>
              <div class="center" style="font-size:10px; margin-top:10px;">Chave de Acesso:</div>
              <div class="center bold" style="font-size:9px; word-break:break-all;">${chaveAcesso.replace(/(\d{4})/g, '$1 ').trim()}</div>
              <div class="center" style="margin-top:15px;">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code" />
              </div>
          </body>
          </html>
      `;

      const printWindow = window.open('', '_blank', 'width=400,height=600');
      printWindow.document.write(printHtml);
      printWindow.document.close();
      toast.info("Impressão enviada para a máquina térmica.");
  };

  const enviarPorEmail = async () => {
      if (!emailEnvio || !emailEnvio.includes('@')) {
          return toast.warning("Digite um e-mail válido no campo acima para enviar os arquivos.");
      }
      setLoading(true);
      try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          toast.success(`O XML e o PDF da Nota foram enviados para ${emailEnvio}!`);
      } catch (err) {
          toast.error("Falha ao enviar o e-mail. Verifique sua conexão.");
      } finally {
          setLoading(false);
      }
  };

  if (validandoCaixa) return <div className="loader"><div className="spinner"></div><h2>A Iniciar Terminal...</h2></div>;

  return (
    <div className="pos-container">

      {(!isMobile || mobileViewState === 'SCAN' || mobileViewState === 'CART') && (
      <section className={`pos-cart-section ${isMobile && mobileViewState === 'CART' ? 'mobile-cart-active' : ''}`}>

          {(!isMobile || mobileViewState === 'SCAN') && (
          <header className="pos-header">
              <div className="pos-brand">
                  {lojaLogo ? <div className="brand-logo-box"><img src={lojaLogo} alt="Logo" /></div> : <div className="brand-icon">✨</div>}
                  <div className="brand-info">
                      <h1>DD Cosméticos</h1>
                      <span className={isOnline ? 'text-success' : 'text-danger'} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                          {isOnline ? <><Wifi size={14}/> Online</> : <><WifiOff size={14}/> Offline (Fila: {filaOffline.length})</>}
                      </span>
                  </div>
              </div>
              <div className="header-actions">
                  <div className="header-clock hide-mobile tooltip-wrap"><Clock size={16} className="text-primary" /> {horaAtual.toLocaleTimeString('pt-BR')}</div>
                  <button className="btn-icon-danger" onClick={handleSairPdv}><ArrowLeft size={18}/></button>
              </div>
          </header>
          )}

          {(!isMobile || mobileViewState === 'SCAN') && (
          <div className="search-premium-area">
              <div className="search-input-wrapper">
                  <Search className="icon-search" size={20}/>
                  <input ref={inputBuscaRef} type="text" className="sp-input" placeholder="Bipe ou digite o produto..." value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={handleSearchKeyDown} autoComplete="off" disabled={!isOnline && sugestoesProdutos.length===0}/>
                  {busca && <button className="btn-clear" onClick={() => {setBusca(''); inputBuscaRef.current?.focus();}}><X size={16}/></button>}
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

          <div className="pos-cart-body">
              {carrinho.length === 0 ? (
                  <div className="cart-empty"><ShoppingBag size={50} strokeWidth={1} /><h3>Nenhum produto no momento</h3><p>Utilize o leitor de código de barras ou a pesquisa manual.</p></div>
              ) : (
                  <div className="cart-items-wrapper">
                      {carrinho.map((item, idx) => (
                          <div key={item.id} className={`cart-card fade-in ${ultimoItemAdicionadoId === item.id ? 'flash-item' : ''}`}>
                              {!isMobile && <div className="cart-card-index">{idx + 1}</div>}
                              <div className="cart-card-info"><strong>{item.descricao}</strong><span>{item.codigoBarras}</span></div>
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
              <div className="summary-row text-muted"><span>Qtd. Itens: <strong className="text-dark">{totalQuantidade}</strong></span><span>Subtotal: R$ {subtotalItens.toFixed(2)}</span></div>
              {descontoTotalRaw > 0 && <div className="summary-row text-pink"><span>Desconto Aplicado</span><span>- R$ {descontoTotalRaw.toFixed(2)}</span></div>}
              <div className="summary-row grand-total"><span>Total a Pagar</span><span className="total-highlight">R$ {totalPagar.toFixed(2)}</span></div>
              {isMobile && mobileViewState === 'CART' && (<button className="btn-primary-block mt-4" onClick={handleIrParaPagamento}>Ir para Pagamento <ArrowRight size={24}/></button>)}
          </footer>
          )}
      </section>
      )}

      {(!isMobile || mobileViewState === 'PAYMENT' || mobileViewState === 'SCAN') && (
      <section className={`pos-action-section ${isMobile && mobileViewState === 'PAYMENT' ? 'mobile-pay-active fade-in-up' : ''}`}>

          {mobileViewState === 'SCAN' && (
              <div className="panel-venda animate-fade">

                  <div className={`card-cliente tooltip-wrap ${clienteAvulso.isPj ? 'pj-active' : ''}`} onClick={() => setShowClienteModal(true)}>
                      <div className="card-cliente-icon">{clienteAvulso.isPj ? <Building2 size={24}/> : <UserCheck size={24}/>}</div>
                      <div className="card-cliente-info w-full">
                          <div className="d-flex justify-between align-center">
                              <span>Identificação</span>
                              {clienteAvulso.isPj && <span className="badge-nfe fade-in">NF-e B2B</span>}
                          </div>
                          <strong>{clienteAvulso.nome || 'Consumidor Final'}</strong>
                      </div>
                      <ArrowRight size={20} className="text-muted"/>
                  </div>

                  <div className="grid-atalhos">
                      <button className="btn-atalho atalho-cliente" onClick={() => setShowClienteModal(true)}>
                          <div className="icon-wrapper"><UserCheck size={20}/></div>
                          <div className="atalho-texto"><span>Cliente</span><p>Identificar</p></div>
                          <kbd className="hide-mobile">F3</kbd>
                      </button>

                      <button className="btn-atalho atalho-desconto" onClick={handleShowDesconto}>
                          <div className="icon-wrapper"><Tag size={20}/></div>
                          <div className="atalho-texto"><span>Desconto</span><p>Abater valor</p></div>
                          <kbd className="hide-mobile">F4</kbd>
                      </button>

                      <button className="btn-atalho atalho-pausa" onClick={handlePausarVenda}>
                          <div className="icon-wrapper bg-warning-light text-warning"><PauseCircle size={20}/></div>
                          <div className="atalho-texto"><span>Pausar</span><p>Guardar venda</p></div>
                          <kbd className="hide-mobile">F5</kbd>
                      </button>

                      <button className="btn-atalho atalho-espera" onClick={handleShowPausadas}>
                          <div className="icon-wrapper bg-info-light text-info relative">
                              <PlayCircle size={20}/>
                              {vendasPausadas.length > 0 && <span className="badge-pulse">{vendasPausadas.length}</span>}
                          </div>
                          <div className="atalho-texto"><span>Espera</span><p>Restaurar</p></div>
                          <kbd className="hide-mobile">F6</kbd>
                      </button>

                      <button className="btn-atalho atalho-ruptura" onClick={() => setShowRupturaModal(true)}>
                          <div className="icon-wrapper"><TrendingDown size={20}/></div>
                          <div className="atalho-texto"><span>Ruptura</span><p>Avisar falta</p></div>
                          <kbd className="hide-mobile">F9</kbd>
                      </button>

                      <button className="btn-atalho btn-atalho-danger" onClick={handleCancelarVenda}>
                          <div className="icon-wrapper"><Trash2 size={20}/></div>
                          <div className="atalho-texto"><span className="text-danger">Cancelar</span><p>Limpar itens</p></div>
                          <kbd className="hide-mobile">DEL</kbd>
                      </button>
                  </div>

                  <button className="btn-checkout-giant" disabled={!carrinho.length} onClick={handleIrParaPagamento}>
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
                              <kbd style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                  {m.id === 'PIX' ? 'P' : m.id === 'DINHEIRO' ? 'D' : m.id === 'CREDITO' ? 'C' : m.id === 'DEBITO' ? 'T' : 'F'}
                              </kbd>
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
                      <button className="btn-finish-pay" disabled={saldoDevedor > 0.01 || loading} onClick={() => finalizarVendaReal()}>
                          {loading ? 'Emitindo Documento...' : (clienteAvulso.isPj && isOnline ? 'EMITIR NF-E B2B (ENTER)' : 'FINALIZAR VENDA (ENTER)')}
                      </button>
                  </div>
              </div>
          )}
      </section>
      )}

      {/* ========================================================== */}
      {/* MODAL DE CLIENTE (VALIDAÇÃO VISUAL SEM POP-UP INVASIVO)    */}
      {/* ========================================================== */}
      {showClienteModal && (
          <div className="modal-glass z-max">
              <div className={`modal-glass-card text-center fade-in border-top-primary ${clienteAvulso.isPj ? 'md' : 'sm'}`} style={{ transition: 'max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                  <div className="d-flex justify-between align-center mb-3">
                      <h2 className="title-main m-0">{clienteAvulso.isPj ? 'Dados da Empresa (NF-e)' : 'Identificação na Nota'}</h2>
                      <button className="btn-icon-outline" style={{border: 'none', width:'30px', height:'30px'}} onClick={() => setShowClienteModal(false)}><X size={20}/></button>
                  </div>

                  <div className={clienteAvulso.isPj ? "grid-2-cols text-left mt-3" : "text-left w-full mt-3"}>
                      <div className="col-left">
                          <label className="form-label">CPF / CNPJ</label>
                          <div className="relative mb-2">
                              <input
                                  className={`mg-input compact-input ${statusDocumento === 'valid' ? 'border-success' : statusDocumento === 'invalid' ? 'border-danger' : ''}`}
                                  inputMode="numeric"
                                  value={clienteAvulso.documento}
                                  onChange={handleDocumentoChange}
                                  onKeyDown={e => e.key === 'Enter' && confirmarClienteModal()}
                                  placeholder="Apenas números..."
                                  autoFocus
                              />
                              <div className="absolute right-3 top-3 d-flex align-center gap-2" style={{pointerEvents: 'none'}}>
                                  {loadingCnpj && <div className="spinner-micro"></div>}
                                  {!loadingCnpj && statusDocumento === 'valid' && <CheckCircle2 size={20} className="text-success fade-in" />}
                                  {!loadingCnpj && statusDocumento === 'invalid' && <AlertTriangle size={20} className="text-danger fade-in" />}
                              </div>
                          </div>

                          <label className="form-label">{clienteAvulso.isPj ? 'RAZÃO SOCIAL' : 'NOME'}</label>
                          <input className="mg-input compact-input mb-2" value={clienteAvulso.nome} onChange={e => setClienteAvulso({...clienteAvulso, nome: e.target.value})}/>

                          <div className="d-flex gap-2 mb-2">
                              <div className="flex-1">
                                  <label className="form-label">WHATSAPP</label>
                                  <input className="mg-input compact-input" inputMode="numeric" value={clienteAvulso.telefone} onChange={e => setClienteAvulso({...clienteAvulso, telefone: mascaraTelefone(e.target.value)})}/>
                              </div>
                              <div className="flex-1">
                                  <label className="form-label">E-MAIL (OPCIONAL)</label>
                                  <input type="email" className="mg-input compact-input" placeholder="email@exemplo.com" value={clienteAvulso.email} onChange={e => setClienteAvulso({...clienteAvulso, email: e.target.value})}/>
                              </div>
                          </div>

                          {clienteAvulso.isPj && (
                              <>
                                  <label className="form-label">INSCRIÇÃO ESTADUAL (IE)</label>
                                  <input className="mg-input compact-input mb-2" placeholder="Digite ISENTO se não houver" value={clienteAvulso.ie} onChange={e => setClienteAvulso({...clienteAvulso, ie: e.target.value.replace(/\D/g, '')})}/>
                              </>
                          )}
                      </div>

                      {clienteAvulso.isPj && (
                          <div className="col-right fade-in-up" style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                              <h4 className="text-sec mb-3 d-flex align-center gap-2" style={{fontSize: '0.85rem', textTransform: 'uppercase'}}><MapPin size={16}/> Endereço Obrigatório</h4>
                              <div className="d-flex gap-2 mb-2">
                                  <div className="w-45"><label className="form-label">CEP</label><input className="mg-input compact-input" value={mascaraCEP(clienteAvulso.cep)} onChange={e => setClienteAvulso({...clienteAvulso, cep: e.target.value})}/></div>
                                  <div className="flex-1"><label className="form-label">Bairro</label><input className="mg-input compact-input" value={clienteAvulso.bairro} onChange={e => setClienteAvulso({...clienteAvulso, bairro: e.target.value})}/></div>
                              </div>
                              <label className="form-label">Logradouro (Rua, Av.)</label>
                              <input className="mg-input compact-input mb-2" value={clienteAvulso.logradouro} onChange={e => setClienteAvulso({...clienteAvulso, logradouro: e.target.value})}/>
                              <div className="d-flex gap-2">
                                  <div className="w-45"><label className="form-label">Número</label><input className="mg-input compact-input" value={clienteAvulso.numero} onChange={e => setClienteAvulso({...clienteAvulso, numero: e.target.value})}/></div>
                                  <div className="flex-1 d-flex gap-2">
                                      <div className="flex-1"><label className="form-label">Cidade</label><input className="mg-input compact-input" value={clienteAvulso.cidade} onChange={e => setClienteAvulso({...clienteAvulso, cidade: e.target.value})}/></div>
                                      <div style={{width: '60px'}}><label className="form-label">UF</label><input className="mg-input compact-input text-center" maxLength={2} value={clienteAvulso.uf} onChange={e => setClienteAvulso({...clienteAvulso, uf: e.target.value.toUpperCase()})}/></div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
                  <div className="mg-actions mt-4">
                      <button className="mg-btn cancel" onClick={() => { setClienteAvulso({nome:'',telefone:'',documento:'', email: '', isPj: false, ie: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: ''}); setShowClienteModal(false); }}>Limpar Formulário</button>
                      <button className="mg-btn confirm" onClick={confirmarClienteModal}>Salvar Dados (Enter)</button>
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

      {/* MODAL DE SUCESSO (COM E-MAIL E IMPRESSÃO INTELIGENTE) */}
      {vendaFinalizada && (
        <div className="modal-glass z-max">
          <div className="modal-glass-card text-center sm fade-in border-top-success">
            {vendaFinalizada.offline ? <WifiOff size={60} color="#f59e0b" className="mx-auto mb-3" /> : <CheckCircle2 size={60} color="#10b981" className="mx-auto mb-3" />}
            <h2 className="title-main mb-2">{vendaFinalizada.offline ? 'Venda Salva Localmente' : 'Transação Concluída!'}</h2>
            <p className="text-sec mb-4">
                {vendaFinalizada.offline
                    ? "A internet caiu. O sistema enviará o XML para a SEFAZ automaticamente assim que a rede voltar."
                    : `A ${vendaFinalizada.tipoNota === 'NFE' ? 'NF-e (Nota Grande)' : 'NFC-e'} foi emitida e autorizada na SEFAZ.`}
            </p>

            <div className="d-flex-col gap-3 mb-4">
              <button className="btn-action-primary" onClick={imprimirCupomLocal}>
                  <Printer size={20} /> {vendaFinalizada.tipoNota === 'NFE' ? 'Imprimir DANFE A4' : 'Imprimir Cupom Térmico'}
              </button>

              {/* ÁREA DE ENVIO DE E-MAIL SOB DEMANDA */}
              {!vendaFinalizada.offline && (vendaFinalizada.tipoNota === 'NFE' || clienteAvulso.documento) && (
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '8px', textAlign: 'left', textTransform: 'uppercase' }}>
                          Enviar XML e PDF
                      </p>
                      <div className="d-flex gap-2">
                          <input
                              type="email"
                              className="mg-input compact-input mb-0"
                              placeholder="E-mail do cliente"
                              value={emailEnvio}
                              onChange={(e) => setEmailEnvio(e.target.value)}
                              style={{ flex: 1 }}
                          />
                          <button className="btn-action-success" onClick={enviarPorEmail} disabled={loading} style={{ width: 'auto', padding: '0 16px' }}>
                              <Mail size={20} />
                          </button>
                      </div>
                  </div>
              )}
            </div>

            <button className="btn-action-success" style={{background: '#f8fafc', color: '#1e293b', border: '2px solid #cbd5e1', boxShadow: 'none'}} onClick={() => { setVendaFinalizada(null); limparEstadoVenda(); }}>
                Iniciar Nova Venda (ESC)
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DESCONTO */}
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
                      {descontoTotalRaw > 0 && <button className="mg-btn danger" onClick={removerDescontoGlobal}>Remover</button>}
                      <button className="mg-btn confirm" onClick={aplicarDescontoGlobal}>Aplicar</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL CANCELAR VENDA */}
      {showCancelVendaModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-danger">
                  <AlertTriangle size={50} color="#ef4444" className="mx-auto mb-3"/>
                  <h2 className="title-main mb-2 text-xl">Deseja descartar a venda?</h2>
                  <p className="text-sec mb-4">Os itens lidos retornarão ao estoque imediatamente.</p>
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowCancelVendaModal(false)}>Retornar</button>
                      <button className="btn-danger-block flex-1" onClick={confirmarCancelamentoVenda}>Descartar Itens</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default PDV;