import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Trash2, Plus, Minus, ArrowLeft, X, UserCheck, ArrowRight, Banknote, Smartphone,
  CreditCard, Tag, ShoppingBag, CheckCircle2, LogOut, TrendingDown,
  Camera, Printer, MessageCircle, AlertTriangle, PauseCircle, PlayCircle, Clock, FileText, Zap, Building2, MapPin, WifiOff, Wifi, Mail
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

const playAudio = (type = 'success') => { try { const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const osc = audioCtx.createOscillator(); osc.type = type === 'success' ? 'sine' : 'sawtooth'; osc.frequency.setValueAtTime(type === 'success' ? 850 : 150, audioCtx.currentTime); osc.connect(audioCtx.destination); osc.start(); setTimeout(() => osc.stop(), type === 'success' ? 120 : 300); } catch (e) {} };

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

  // MODAIS PÓS-VENDA
  const [showZapModal, setShowZapModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [zapNumber, setZapNumber] = useState('');
  const [emailEnvio, setEmailEnvio] = useState('');

  const [vendasPausadas, setVendasPausadas] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:pausadas')) || []; } catch { return []; } });
  const [showPausadasModal, setShowPausadasModal] = useState(false);

  const [carrinho, setCarrinho] = useState(() => { try { return JSON.parse(localStorage.getItem('@dd:carrinho')) || []; } catch { return []; } });
  const [pagamentos, setPagamentos] = useState([]);

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

  const [showFechamentoModal, setShowFechamentoModal] = useState(false);

  const subtotalItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoVenda * item.quantidade), 0), [carrinho]);
  const descontoItens = useMemo(() => carrinho.reduce((acc, item) => acc + (item.desconto || 0), 0), [carrinho]);
  const totalQuantidade = useMemo(() => carrinho.reduce((acc, item) => acc + item.quantidade, 0), [carrinho]);
  const totalPagar = Math.max(0, subtotalItens - descontoItens - descontoTotalRaw);
  const totalPago = useMemo(() => pagamentos.reduce((acc, p) => acc + p.valor, 0), [pagamentos]);
  const saldoDevedor = Math.max(0, parseFloat((totalPagar - totalPago).toFixed(2)));
  const troco = Math.max(0, parseFloat((totalPago - totalPagar).toFixed(2)));

  const [metodoAtual, setMetodoAtual] = useState('PIX');
  const [valorInputRaw, setValorInputRaw] = useState('');

  // =======================================================================
  // INICIALIZAÇÃO E OBTENÇÃO DA LOGO
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

        // Puxa a Logo corretamente
        if (res.data?.loja?.logoUrl) {
            const url = res.data.loja.logoUrl;
            const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.split('/api')[0] : '';
            setLojaLogo(url.startsWith('http') || url.startsWith('data:') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`);
        }

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

  useEffect(() => {
      if (vendaFinalizada) {
          setEmailEnvio(clienteAvulso.email || '');
          setZapNumber(clienteAvulso.telefone || '');
      }
  }, [vendaFinalizada, clienteAvulso.email, clienteAvulso.telefone]);

  // =======================================================================
  // TECLADO E BUSCA (COM SCROLL AUTOMÁTICO NA LISTA)
  // =======================================================================
  useEffect(() => {
      if (busca.trim().length < 3) { setSugestoesProdutos([]); setSelectedIndex(-1); return; }
      const delay = setTimeout(async () => {
          if(!isOnline) return;
          try { const { data } = await api.get(`/produtos?termo=${busca}&size=15`); setSugestoesProdutos(data.content || data); setSelectedIndex(-1); } catch (error) {}
      }, 300);
      return () => clearTimeout(delay);
  }, [busca, isOnline]);

  // Scroll automático no dropdown
  useEffect(() => {
      if (dropdownRef.current && selectedIndex >= 0) {
          const item = dropdownRef.current.children[selectedIndex];
          if (item) {
              item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [selectedIndex]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          const isModalOpen = showExitModal || showCancelVendaModal || showClienteModal || showDescontoModal || showRupturaModal || showPausadasModal || showZapModal || showEmailModal || vendaFinalizada || alertaCrediario || showFechamentoModal || showScanner;

          if (e.key === 'Escape') {
              e.preventDefault();
              if (alertaCrediario) { setAlertaCrediario(null); return; }
              if (showZapModal) { setShowZapModal(false); return; }
              if (showEmailModal) { setShowEmailModal(false); return; }
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
  }, [mobileViewState, carrinho.length, showClienteModal, showDescontoModal, showExitModal, showCancelVendaModal, showRupturaModal, showPausadasModal, showZapModal, showEmailModal, showFechamentoModal, showScanner, vendaFinalizada, alertaCrediario, saldoDevedor, metodoAtual, loading]);

  // =======================================================================
  // AÇÕES DO CARRINHO E VENDA
  // =======================================================================
  const handleShowDesconto = () => { if (carrinho.length === 0) return toast.warn("Adicione produtos antes de dar desconto."); setShowDescontoModal(true); };
  const handleIrParaPagamento = () => { if (carrinho.length === 0) return toast.warn("O carrinho está vazio."); setMobileView('PAYMENT'); setValorInputRaw(Math.round(saldoDevedor * 100).toString()); setTimeout(()=> inputValorRef.current?.focus(), 100); };
  const handleCancelarVenda = () => { if (carrinho.length === 0) return toast.warn("Não há nada para cancelar."); setShowCancelVendaModal(true); };

  const handlePausarVenda = () => {
      if (carrinho.length === 0) return toast.warning("Adicione produtos antes de pausar.");
      const novaPausa = { id: Date.now(), data: new Date().toLocaleTimeString(), carrinho, clienteAvulso, descontoTotalRaw, totalPagar, auditLog };
      setVendasPausadas([...vendasPausadas, novaPausa]);
      limparEstadoVenda();
      toast.info("Venda movida para espera.");
  };

  const handleShowPausadas = () => {
      if (vendasPausadas.length === 0) return toast.info("Nenhuma venda em espera.");
      setShowPausadasModal(true);
  };

  const handleRestaurarVenda = (id) => {
      const venda = vendasPausadas.find(v => v.id === id); if (!venda) return;
      if (carrinho.length > 0) return toast.warning("Cancele a venda atual antes de restaurar.");
      setCarrinho(venda.carrinho); setClienteAvulso(venda.clienteAvulso); setDescontoTotalRaw(venda.descontoTotalRaw); setAuditLog(venda.auditLog || []);
      setVendasPausadas(vendasPausadas.filter(v => v.id !== id)); setShowPausadasModal(false);
      toast.success("Venda restaurada!");
  };

  const confirmarCancelamentoVenda = () => { limparEstadoVenda(); setShowCancelVendaModal(false); toast.info("Venda cancelada."); };

  const limparEstadoVenda = () => { setCarrinho([]); setPagamentos([]); setClienteAvulso({ nome: '', telefone: '', documento: '', email: '', isPj: false, ie: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '' }); setDescontoTotalRaw(0); setMobileView('SCAN'); setBusca(''); setAuditLog([]); };
  const handleSairPdv = () => { if(carrinho.length > 0) setShowExitModal(true); else navigate('/dashboard'); };

  // =======================================================================
  // LOGICA DO CLIENTE (FOCO NO TELEFONE/WHATSAPP COMO PRINCIPAL)
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
              toast.success("Empresa identificada! NF-e habilitada."); playAudio('success'); setLoadingCnpj(false); return;
          }
      } catch(e) {}

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
      if (clean.length === 14 && validarCNPJ(clean)) buscarCnpj(clean);
  };

  const handleTelefoneChange = async (e) => {
        const val = mascaraTelefone(e.target.value);
        setClienteAvulso(prev => ({...prev, telefone: val}));

        const cleanTel = cleanNumeric(val);

        if (cleanTel.length === 10 || cleanTel.length === 11) {
            try {
                const { data } = await api.get(`/clientes/telefone/${cleanTel}`);
                if (data && data.nome) {
                    setClienteAvulso(prev => ({
                        ...prev,
                        nome: data.nome,
                        email: data.email || prev.email
                        // Só busca nome/email. O documento (CPF) não é tocado para evitar B2B fantasma.
                    }));
                    toast.success(`Bem-vindo(a) de volta, ${data.nome}!`);
                    playAudio('success');
                }
            } catch (err) {
                // Cliente novo. O caixa digita o nome e finaliza normal.
            }
        }
    };

  const confirmarClienteModal = () => {
      const cleanDoc = cleanNumeric(clienteAvulso.documento);
      const cleanTel = cleanNumeric(clienteAvulso.telefone);

      if (!clienteAvulso.nome && !cleanTel) {
          return toast.warning("Informe pelo menos o WhatsApp ou o Nome do cliente.");
      }

      if (cleanDoc.length > 0) {
          if (cleanDoc.length < 11) return toast.warning("Documento incompleto.");
          if (cleanDoc.length === 11 && !validarCPF(cleanDoc)) return toast.error("O CPF é inválido.");
          if (cleanDoc.length > 11 && cleanDoc.length < 14) return toast.warning("CNPJ incompleto.");
          if (cleanDoc.length === 14 && !validarCNPJ(cleanDoc)) return toast.error("O CNPJ é inválido.");
      }

      toast.success("Dados confirmados.");
      setShowClienteModal(false);
      if (!isMobile) setTimeout(() => inputBuscaRef.current?.focus(), 100);
  };

  // =======================================================================
  // PRODUTOS, PREÇOS E PAGAMENTO
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
      if (!isOnline) return toast.warning("Modo offline ativo.");
      try {
          const { data } = await api.get(`/produtos/ean/${valor}`);
          let produto = Array.isArray(data) ? data[0] : data;
          if (produto && (produto.id || produto.codigoBarras)) { adicionarProdutoAoCarrinho(produto); } else { throw new Error("Não encontrado"); }
      } catch (err) { playAudio('error'); toast.warning("Produto não encontrado!"); setBusca(''); if (inputBuscaRef.current) inputBuscaRef.current.value = ''; }
  };

  const handleSearchKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, sugestoesProdutos.length - 1));
      }
      else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
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
          if (tipoDesconto === '%' && valorBase > 100) return toast.error("Máximo 100%");
          if (tipoDesconto === 'R$' && valorBase > subtotalItens) return toast.error("Acima do subtotal");
          setDescontoTotalRaw(valorReal); toast.success("Desconto aplicado!");
      }
      setDescontoInputRaw(''); setShowDescontoModal(false);
  };
  const removerDescontoGlobal = () => { setDescontoTotalRaw(0); setDescontoInputRaw(''); setShowDescontoModal(false); toast.info("Desconto removido."); };

  const handleAdicionarPagamento = async () => {
      let valor = parseInt(valorInputRaw.replace(/\D/g, '') || '0', 10) / 100;
      if (valor <= 0 && saldoDevedor > 0) valor = saldoDevedor; if (valor <= 0) return;

      if (metodoAtual === 'CREDIARIO') {
          if (!isOnline) return toast.warning("Offline: Crediário exige internet.");
          const docClean = cleanNumeric(clienteAvulso.documento);

          if (!clienteAvulso.nome || (!docClean && !clienteAvulso.telefone)) {
              setShowClienteModal(true); return toast.warning("Cadastre o Nome e o WhatsApp (ou CPF) para vender no fiado.");
          }

          if(docClean) {
              setLoading(true);
              try {
                  const { data: statusCliente } = await api.get(`/clientes/analise-credito/${docClean}`);
                  if (statusCliente.bloqueado || statusCliente.debitosAtraso > 0) { setLoading(false); setAlertaCrediario(statusCliente); return; }
              } catch (err) {
                  if (err.response?.status === 404) { try { await api.post('/clientes', { nome: clienteAvulso.nome.toUpperCase(), documento: docClean, telefone: cleanNumeric(clienteAvulso.telefone) || "", ativo: true, limiteCredito: 0 }); } catch (erroCadastro) { setLoading(false); return toast.error("Falha ao registrar cliente."); } }
                  else { setLoading(false); return toast.warning("Serviço indisponível."); }
              }
              setLoading(false);
          }
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
  // FINALIZAÇÃO E ENVIO PARA SEFAZ
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
          toast.success("Modo Offline: Venda gravada localmente!");
          setVendaFinalizada({ id: payload.idOffline, status: 'OFFLINE', offline: true, dataVenda: new Date(), ...payload, tipoNota: payload.tipoNota });
          return;
      }

      setLoading(true);
      try {
          let response = await api.post('/vendas', payload);
          let vendaResult = response.data;

          if (vendaResult.status === 'REJEITADA') throw new Error("A SEFAZ rejeitou o documento. Verifique os dados fiscais.");

          toast.success(clienteAvulso.isPj ? "NF-e (B2B) Emitida!" : "Cupom (NFC-e) Autorizado!");
          setVendaFinalizada({...vendaResult, tipoNota: payload.tipoNota});
      } catch (err) {
          toast.error(err.response?.data?.message || err.message || "Falha de comunicação com o servidor.");
      } finally {
          setLoading(false);
      }
  };

  // =======================================================================
  // AÇÕES PÓS-VENDA (WHATSAPP, E-MAIL E IMPRESSÃO NATIVA)
  // =======================================================================
  const enviarPorWhatsApp = () => {
        const numeroLimpo = zapNumber.replace(/\D/g, '');
        if (numeroLimpo.length < 10) return toast.warning("Digite um número de WhatsApp válido.");

        const urlNota = vendaFinalizada?.urlQrCode || `http://nfce.sefaz.pe.gov.br/nfce/consulta?chNFe=${vendaFinalizada?.chaveAcessoNfce}`;
        const nomeCliente = clienteAvulso.nome ? ` ${clienteAvulso.nome.split(' ')[0]}` : '';
        const valorTotalFormatado = vendaFinalizada?.valorTotal?.toFixed(2) || totalPagar.toFixed(2);
        const chaveFormatada = vendaFinalizada?.chaveAcessoNfce ? vendaFinalizada.chaveAcessoNfce.replace(/(\d{4})/g, '$1 ').trim() : 'N/A';
        const dataVendaStr = vendaFinalizada?.dataVenda ? new Date(vendaFinalizada.dataVenda).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

        // Itens lidos da venda finalizada para garantir que existem
        const itensZAP = vendaFinalizada?.itens || carrinho;
        const pgsZAP = vendaFinalizada?.pagamentos || pagamentos;

        const listaProdutos = itensZAP.map(item => `▪️ ${item.quantidade}x ${item.descricao || item.produtoNome} - R$ ${(item.quantidade * (item.precoUnitario || item.precoVenda)).toFixed(2)}`).join('\n');
        const listaPagamentos = pgsZAP.map(p => `• ${p.formaPagamento || p.tipo}: R$ ${p.valor.toFixed(2)}`).join('\n');

        const mensagem = `Olá${nomeCliente}! 🛍️ Agradecemos sua compra na *${configLoja?.loja?.razaoSocial || 'DD Cosméticos'}*.\n\n` +
                         `📅 *Data/Hora:* ${dataVendaStr}\n` +
                         `🎫 *Cód. Venda:* #${vendaFinalizada?.id || vendaFinalizada?.idOffline || '0000'}\n\n` +
                         `🛒 *ITENS COMPRADOS:*\n${listaProdutos}\n\n` +
                         `💳 *PAGAMENTO:*\n${listaPagamentos}\n` +
                         `*Total Pago:* R$ ${valorTotalFormatado}\n\n` +
                         `📄 *DANFE ${vendaFinalizada?.tipoNota === 'NFE' ? 'NF-e' : 'NFC-e'}*\n` +
                         `• Chave: ${chaveFormatada}\n` +
                         `• Protocolo: ${vendaFinalizada?.protocolo || 'Aguardando Sefaz'}\n\n` +
                         `*Acesse o link abaixo para visualizar o seu documento fiscal:*\n${urlNota}\n\n` +
                         `Volte sempre e aproveite seus produtos! ✨`;

        const linkWhatsApp = `https://api.whatsapp.com/send?phone=55${numeroLimpo}&text=${encodeURIComponent(mensagem)}`;
        window.open(linkWhatsApp, '_blank');
        setShowZapModal(false);
        toast.success("Redirecionando para o WhatsApp...");
    };

  const enviarPorEmail = async () => {
        if (!emailEnvio || !emailEnvio.includes('@')) return toast.warning("Digite um e-mail válido.");
        setLoading(true);
        try {
            const vendaIdCorreto = vendaFinalizada.id || vendaFinalizada.idOffline;
            await toast.promise(
                api.post(`/vendas/${vendaIdCorreto}/email`, { email: emailEnvio }),
                {
                    pending: 'Aguardando o XML da SEFAZ e enviando e-mail...',
                    success: `Documento fiscal enviado para ${emailEnvio}!`,
                    error: {
                        render({data}){
                            return data.response?.data?.message || "Falha ao enviar e-mail. Verifique as configurações.";
                        }
                    }
                }
            );
            setShowEmailModal(false);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

  const imprimirCupomLocal = () => {
        const isNfe = vendaFinalizada?.tipoNota === 'NFE';
        const loja = configLoja?.loja || {};
        const fiscal = configLoja?.fiscal || {};

        const razaoSocial = loja.razaoSocial || "DD COSMÉTICOS LTDA";
        const cnpj = loja.cnpj || "57.648.950/0001-44";
        const endereco = loja.logradouro ? `${loja.logradouro}, ${loja.numero} - ${loja.bairro}` : "Rua Arquiteto Luiz Nunes, 63 - Imbiribeira";
        const cidadeUF = loja.cidade ? `${loja.cidade} - ${loja.uf}` : "Recife - PE";
        const telefone = loja.telefone || "(81) 99999-9999";

        const numDoc = vendaFinalizada?.numeroNfce || vendaFinalizada?.id || "000000";
        const serieDoc = vendaFinalizada?.serieNfce || "1";
        const chaveAcesso = vendaFinalizada?.chaveAcessoNfce || "00000000000000000000000000000000000000000000";
        const chaveFormatada = chaveAcesso.replace(/(\d{4})/g, '$1 ').trim();
        const dataVendaStr = vendaFinalizada?.dataVenda ? new Date(vendaFinalizada.dataVenda).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
        const qrCodeUrl = vendaFinalizada?.urlQrCode || `http://nfce.sefaz.pe.gov.br/nfce/consulta?chNFe=${chaveAcesso}`;

        const itensImpressao = vendaFinalizada?.itens || [];
        const totalQtd = itensImpressao.reduce((acc, i) => acc + i.quantidade, 0);
        const subtotalBase = itensImpressao.reduce((acc, i) => acc + (i.precoUnitario * i.quantidade), 0);
        const descontosImpressao = vendaFinalizada?.descontoTotal || 0;
        const pagamentosImpressao = vendaFinalizada?.pagamentos || [];
        const trocoImpressao = vendaFinalizada?.troco || 0;
        const docClienteImp = vendaFinalizada?.clienteDocumento || '';
        const nomeClienteImp = vendaFinalizada?.clienteNome || '';

        // 🚨 CÁLCULO DOS TRIBUTOS (MÉDIA IBPT PARA COSMÉTICOS: 15% Fed, 18% Est)
        const totalVenda = vendaFinalizada?.valorTotal || 0;
        const tribFederal = (totalVenda * 0.15).toFixed(2);
        const tribEstadual = (totalVenda * 0.18).toFixed(2);
        const tribMunicipal = "0.00";

        let printHtml = '';

        if (isNfe) {
            toast.info("Preparando DANFE A4 (Nota Grande)...");
            printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>DANFE NF-e - ${razaoSocial}</title>
                    <style>
                        @page { size: A4 landscape; margin: 5mm; }
                        body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; width: 100%; }
                        .danfe-container { width: 100%; border: 1px solid #000; padding: 5px; box-sizing: border-box;}
                        table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                        td, th { border: 1px solid #000; padding: 4px; vertical-align: top; }
                        .label { display: block; font-size: 8px; text-transform: uppercase; color: #333; margin-bottom: 2px;}
                        .val { font-size: 12px; font-weight: bold; }
                        .center { text-align: center; } .right { text-align: right; }
                        .title-box { font-size: 12px; font-weight: bold; margin: 10px 0 5px 0; text-transform: uppercase;}
                        .barcode { letter-spacing: 2px; font-size: 14px; text-align: center; margin-top: 10px;}
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <td style="width: 80%;"><span class="label">RECEBEMOS DE ${razaoSocial} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</span><span class="val">&nbsp;</span></td>
                            <td rowspan="2" class="center" style="width: 20%;"><span class="label">NF-e</span><span class="val" style="font-size:16px;">Nº ${numDoc}</span><br><span class="val">Série ${serieDoc}</span></td>
                        </tr>
                        <tr>
                            <td>
                               <div style="display: flex; justify-content: space-between;">
                                  <div style="width: 30%; border-right: 1px solid #000; padding-right: 5px;"><span class="label">DATA DE RECEBIMENTO</span><span class="val">&nbsp;</span></div>
                                  <div style="width: 70%; padding-left: 5px;"><span class="label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span><span class="val">&nbsp;</span></div>
                               </div>
                            </td>
                        </tr>
                    </table>

                    <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>

                    <div class="danfe-container">
                        <table>
                            <tr>
                                <td style="width: 40%; text-align: center; vertical-align: middle;">
                                    <h3 style="margin:5px 0; font-size: 16px;">${razaoSocial}</h3>
                                    <p style="margin:0; font-size: 11px;">${endereco}<br>${cidadeUF}<br>Fone: ${telefone}</p>
                                </td>
                                <td style="width: 20%; text-align: center; vertical-align: middle;">
                                    <h2 style="margin:0; font-size: 20px;">DANFE</h2>
                                    <p style="margin:0; font-size: 9px;">Documento Auxiliar da Nota Fiscal Eletrônica</p>
                                    <p style="margin:10px 0 0 0; font-size: 12px;">0 - ENTRADA<br>1 - SAÍDA <strong>[ 1 ]</strong></p>
                                    <h3 style="margin:5px 0; font-size: 16px;">Nº ${numDoc}</h3>
                                    <p style="margin:0; font-size: 12px;">SÉRIE: ${serieDoc}</p>
                                </td>
                                <td style="width: 40%; vertical-align: middle;">
                                    <div class="barcode">|| |||| || ||||| ||||| ||| ||</div>
                                    <div class="center" style="margin-top: 5px;">
                                        <span class="label">CHAVE DE ACESSO</span>
                                        <span class="val" style="font-size: 14px;">${chaveFormatada}</span>
                                    </div>
                                    <div class="center" style="margin-top: 15px;">
                                        <span class="label">Consulta de autenticidade no portal nacional da NF-e</span>
                                        <span style="font-size:10px;">www.nfe.fazenda.gov.br/portal</span>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <table>
                            <tr>
                                <td style="width: 60%;"><span class="label">NATUREZA DA OPERAÇÃO</span><span class="val">VENDA DE MERCADORIAS</span></td>
                                <td style="width: 40%;"><span class="label">PROTOCOLO DE AUTORIZAÇÃO DE USO</span><span class="val">${vendaFinalizada?.protocolo || 'N/A'} - ${dataVendaStr}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 33%;"><span class="label">INSCRIÇÃO ESTADUAL</span><span class="val">${fiscal.inscricaoEstadual || 'ISENTO'}</span></td>
                                <td style="width: 33%;"><span class="label">INSC. ESTADUAL DO SUBST. TRIB.</span><span class="val"></span></td>
                                <td style="width: 34%;"><span class="label">CNPJ</span><span class="val">${cnpj}</span></td>
                            </tr>
                        </table>

                        <div class="title-box">DESTINATÁRIO / REMETENTE</div>
                        <table>
                            <tr>
                                <td style="width: 60%;"><span class="label">NOME / RAZÃO SOCIAL</span><span class="val">${nomeClienteImp || 'CONSUMIDOR'}</span></td>
                                <td style="width: 25%;"><span class="label">CNPJ / CPF</span><span class="val">${docClienteImp}</span></td>
                                <td style="width: 15%;"><span class="label">DATA DA EMISSÃO</span><span class="val">${dataVendaStr.split(' ')[0]}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 45%;"><span class="label">ENDEREÇO</span><span class="val">Não Informado</span></td>
                                <td style="width: 25%;"><span class="label">BAIRRO / DISTRITO</span><span class="val">Não Informado</span></td>
                                <td style="width: 15%;"><span class="label">CEP</span><span class="val"></span></td>
                                <td style="width: 15%;"><span class="label">DATA DA SAÍDA</span><span class="val">${dataVendaStr.split(' ')[0]}</span></td>
                            </tr>
                        </table>

                        <div class="title-box">CÁLCULO DO IMPOSTO</div>
                        <table>
                            <tr>
                                <td style="width: 20%;"><span class="label">BASE DE CÁLCULO DO ICMS</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">VALOR DO ICMS</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">BASE CÁLC. ICMS SUBST.</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">VALOR ICMS SUBST.</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">VALOR TOTAL DOS PRODUTOS</span><span class="val right">${subtotalBase.toFixed(2)}</span></td>
                            </tr>
                            <tr>
                                <td><span class="label">VALOR DO FRETE</span><span class="val right">0,00</span></td>
                                <td><span class="label">VALOR DO SEGURO</span><span class="val right">0,00</span></td>
                                <td><span class="label">DESCONTO</span><span class="val right">${descontosImpressao.toFixed(2)}</span></td>
                                <td><span class="label">OUTRAS DESP. ACESSÓRIAS</span><span class="val right">0,00</span></td>
                                <td><span class="label">VALOR TOTAL DA NOTA</span><span class="val right">${totalVenda.toFixed(2)}</span></td>
                            </tr>
                        </table>

                        <div class="title-box">DADOS DO PRODUTO / SERVIÇOS</div>
                        <table>
                            <tr>
                                <th style="width: 8%;">CÓD.</th>
                                <th style="width: 44%;">DESCRIÇÃO DO PRODUTO</th>
                                <th style="width: 8%;">NCM/SH</th>
                                <th style="width: 5%;">CST</th>
                                <th style="width: 5%;">CFOP</th>
                                <th style="width: 5%;">UN.</th>
                                <th style="width: 5%;">QTD.</th>
                                <th style="width: 10%;">V. UNIT.</th>
                                <th style="width: 10%;">V. TOTAL</th>
                            </tr>
                            ${itensImpressao.map(i => `
                            <tr>
                                <td class="center">${i.produtoId || i.id}</td>
                                <td>${i.produtoNome || i.descricao || 'Produto'}</td>
                                <td class="center">00000000</td>
                                <td class="center">102</td>
                                <td class="center">5102</td>
                                <td class="center">UN</td>
                                <td class="right">${i.quantidade}</td>
                                <td class="right">${i.precoUnitario.toFixed(2)}</td>
                                <td class="right">${(i.quantidade * i.precoUnitario).toFixed(2)}</td>
                            </tr>
                            `).join('')}
                        </table>

                        <div class="title-box">DADOS ADICIONAIS</div>
                        <table style="height: 60px;">
                            <tr>
                                <td><span class="label">INFORMAÇÕES COMPLEMENTARES</span><span class="val" style="font-size: 10px;">Documento emitido por ME ou EPP optante pelo Simples Nacional.<br>Trib aprox R$ ${tribFederal} Fed e R$ ${tribEstadual} Est. Fonte: IBPT.</span></td>
                            </tr>
                        </table>
                    </div>

                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 500);
                        };
                    </script>
                </body>
                </html>
            `;
        } else {
            // 🚨 LAYOUT NFC-e BOBINA (80mm) - AJUSTES DE MARGEM E FONTE APLICADOS
            printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>CUPOM FISCAL</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        /* Margens blindadas: width em 71mm e padding-left em 4mm garantem fuga da margem direita da impressora */
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 9.5px;
                            width: 71mm;
                            margin: 0;
                            padding: 4mm 2mm 4mm 4mm;
                            color: #000;
                            line-height: 1.15;
                            box-sizing: border-box;
                        }
                        .center { text-align: center; } .left { text-align: left; } .right { text-align: right; }
                        .bold { font-weight: bold; }
                        .line { border-bottom: 1px dashed #000; margin: 4px 0; }
                        .double-line { border-bottom: 2px solid #000; margin: 4px 0; }
                        table { width: 100%; border-collapse: collapse; font-size: 8.5px; table-layout: fixed; }
                        th, td { padding: 1.5px 0; vertical-align: top; word-wrap: break-word; }

                        /* Controle de colunas para garantir que o Total nunca saia do papel */
                        .col-cod { width: 13%; }
                        .col-desc { width: 44%; }
                        .col-qtd { width: 12%; text-align: right; }
                        .col-vlun { width: 15%; text-align: right; }
                        .col-vltot { width: 16%; text-align: right; }

                        .qr-code { display: block; margin: 8px auto; width: 110px; height: 110px; }
                        p { margin: 2px 0; }
                    </style>
                </head>
                <body>
                    <div class="center bold" style="font-size:12px; text-transform:uppercase;">${razaoSocial}</div>
                    <div class="center">CNPJ: ${cnpj} ${fiscal.inscricaoEstadual ? ' IE: '+fiscal.inscricaoEstadual : ''}</div>
                    <div class="center" style="font-size:9px;">${endereco}</div>
                    <div class="center" style="font-size:9px;">${cidadeUF} - Tel: ${telefone}</div>
                    <div class="double-line"></div>

                    <div class="center bold" style="font-size:10px;">DANFE NFC-e - Documento Auxiliar da<br>Nota Fiscal de Consumidor Eletrônica</div>
                    <div class="center" style="font-size:9px;">Não permite aproveitamento de crédito de ICMS</div>
                    <div class="double-line"></div>

                    <table style="margin-bottom: 4px;">
                        <tr style="border-bottom: 1px dashed #000;">
                            <th class="left col-cod">CÓD</th>
                            <th class="left col-desc">DESCRIÇÃO</th>
                            <th class="right col-qtd">QTD</th>
                            <th class="right col-vlun">VL.UN</th>
                            <th class="right col-vltot">TOTAL</th>
                        </tr>
                        ${itensImpressao.map((i, index) => `
                            <tr>
                                <td class="left">${String(i.produtoId || i.id).padStart(3, '0')}</td>
                                <td class="left">${i.produtoNome || i.descricao || 'Produto'}</td>
                                <td class="right">${i.quantidade}</td>
                                <td class="right">${i.precoUnitario.toFixed(2)}</td>
                                <td class="right">${(i.quantidade * i.precoUnitario).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </table>

                    <div class="line"></div>
                    <div style="display:flex; justify-content:space-between;"><span>Qtd. Total de Itens:</span><span>${totalQtd}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>R$ ${subtotalBase.toFixed(2)}</span></div>
                    ${descontosImpressao > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Descontos:</span><span>- R$ ${descontosImpressao.toFixed(2)}</span></div>` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:11px;" class="bold"><span>VALOR TOTAL R$</span><span>${totalVenda.toFixed(2)}</span></div>
                    <div class="line"></div>

                    <div class="bold" style="margin-bottom: 3px;">FORMA DE PAGAMENTO</div>
                    <table style="margin-bottom: 4px;">
                        ${pagamentosImpressao.map(p => `
                            <tr><td class="left">${p.formaPagamento || p.tipo}</td><td class="right">R$ ${p.valor.toFixed(2)}</td></tr>
                        `).join('')}
                    </table>
                    <div style="display:flex; justify-content:space-between;"><span>Troco:</span><span>R$ ${trocoImpressao.toFixed(2)}</span></div>

                    <div class="line"></div>
                    <div class="center" style="font-size:9px;">Valores Aprox. Tributos (Lei 12.741/12):<br>Federal R$ ${tribFederal} | Estadual R$ ${tribEstadual} | Municipal R$ ${tribMunicipal}</div>
                    <div class="line"></div>

                    <div class="center bold" style="margin-bottom:2px;">CONSUMIDOR</div>
                    <div class="center" style="font-size:9px;">
                        ${docClienteImp ? `CNPJ/CPF: ${docClienteImp}<br>` : 'CONSUMIDOR NÃO IDENTIFICADO<br>'}
                        ${nomeClienteImp ? `${nomeClienteImp}<br>` : ''}
                    </div>
                    <div class="line"></div>

                    <div class="center bold" style="font-size:10px;">Emissão: ${dataVendaStr}</div>
                    <div class="center" style="font-size:10px;">NFC-e Nº ${numDoc} - Série ${serieDoc}</div>
                    <div class="center" style="margin-top:2px;">Protocolo de Autorização: ${vendaFinalizada?.protocolo || 'N/A'}</div>
                    <div class="center" style="margin-top:6px; font-size:9px;">Consulte pela Chave de Acesso em:</div>
                    <div class="center" style="font-size:9px; word-break:break-all;">http://nfce.sefaz.pe.gov.br/nfce/consulta</div>

                    <div class="center bold" style="margin-top:8px; font-size:10.5px; letter-spacing:1px; word-break:break-all;">
                        ${chaveFormatada}
                    </div>

                    <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code" />

                    <div class="center bold" style="margin-top:8px; font-size:10px;">${fiscal.obsPadraoCupom || 'Obrigado e volte sempre!'}</div>
                    <br><br><br>

                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 800);
                        };
                    </script>
                </body>
                </html>
            `;
        }

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(printHtml);
            printWindow.document.close();
        } else {
            toast.error("O bloqueador de Pop-ups do seu navegador impediu a impressão!");
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
      {/* MODAL DE CLIENTE: FOCO NO WHATSAPP (CORRIGIDO)               */}
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

                          <label className="form-label">WHATSAPP (IDENTIFICADOR PRINCIPAL)</label>
                          <input className="mg-input compact-input mb-2 border-primary" inputMode="numeric" value={clienteAvulso.telefone} onChange={handleTelefoneChange} autoFocus placeholder="(81) 90000-0000" onKeyDown={e => e.key === 'Enter' && confirmarClienteModal()}/>

                          <label className="form-label">{clienteAvulso.isPj ? 'RAZÃO SOCIAL' : 'NOME DO CLIENTE'}</label>
                          <input className="mg-input compact-input mb-2" value={clienteAvulso.nome} onChange={e => setClienteAvulso({...clienteAvulso, nome: e.target.value})} placeholder="Nome completo" onKeyDown={e => e.key === 'Enter' && confirmarClienteModal()}/>

                          <label className="form-label">CPF / CNPJ (OPCIONAL)</label>
                          <div className="relative mb-2">
                              <input
                                  className={`mg-input compact-input ${statusDocumento === 'valid' ? 'border-success' : statusDocumento === 'invalid' ? 'border-danger' : ''}`}
                                  inputMode="numeric"
                                  value={clienteAvulso.documento}
                                  onChange={handleDocumentoChange}
                                  onKeyDown={e => e.key === 'Enter' && confirmarClienteModal()}
                                  placeholder="Apenas números..."
                              />
                              <div className="absolute right-3 top-3 d-flex align-center gap-2" style={{pointerEvents: 'none'}}>
                                  {loadingCnpj && <div className="spinner-micro"></div>}
                                  {!loadingCnpj && statusDocumento === 'valid' && <CheckCircle2 size={20} className="text-success fade-in" />}
                                  {!loadingCnpj && statusDocumento === 'invalid' && <AlertTriangle size={20} className="text-danger fade-in" />}
                              </div>
                          </div>

                          <label className="form-label">E-MAIL (OPCIONAL)</label>
                          <input type="email" className="mg-input compact-input mb-2" placeholder="email@exemplo.com" value={clienteAvulso.email} onChange={e => setClienteAvulso({...clienteAvulso, email: e.target.value})} onKeyDown={e => e.key === 'Enter' && confirmarClienteModal()}/>

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
                      <button className="mg-btn cancel" onClick={() => { setClienteAvulso({nome:'',telefone:'',documento:'', email: '', isPj: false, ie: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: ''}); setShowClienteModal(false); }}>Limpar</button>
                      <button className="mg-btn confirm" onClick={confirmarClienteModal}>Salvar Dados (Enter)</button>
                  </div>
              </div>
          </div>
      )}

      {/* ========================================================== */}
      {/* MODAL DE AVISO DE RUPTURA DE ESTOQUE (TECLA F9 CORRIGIDA)  */}
      {/* ========================================================== */}
      {showRupturaModal && (
          <div className="modal-glass z-max">
              <div className="modal-glass-card text-center sm fade-in border-top-warning">
                  <h2 className="title-main mb-2">Aviso de Ruptura (Falta)</h2>
                  <p className="text-sec mb-4">Faltou algum produto na prateleira? Informe abaixo para a gerência repor o estoque.</p>

                  <input type="text" className="mg-input mb-4" placeholder="Ex: Esmalte Risqué Vermelho..." id="ruptura-input" autoFocus onKeyDown={e => {
                      if(e.key === 'Enter') {
                          if(!e.target.value) return toast.warn("Informe o produto.");
                          toast.success("Aviso de ruptura registrado!");
                          registrarAcaoAuditoria("AVISO_RUPTURA", `Produto em falta reportado: ${e.target.value}`);
                          setShowRupturaModal(false);
                      }
                  }}/>

                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowRupturaModal(false)}>Cancelar</button>
                      <button className="btn-action-warning flex-1" onClick={() => {
                          const val = document.getElementById('ruptura-input').value;
                          if(!val) return toast.warn("Informe o nome do produto.");
                          toast.success("Aviso de ruptura registrado com sucesso!");
                          registrarAcaoAuditoria("AVISO_RUPTURA", `Produto em falta reportado: ${val}`);
                          setShowRupturaModal(false);
                      }}>Registrar (Enter)</button>
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

      {/* ========================================================== */}
      {/* MODAIS DE ENVIO (WHATSAPP E E-MAIL)                          */}
      {/* ========================================================== */}
      {showZapModal && (
        <div className="modal-glass z-max" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
            <div className="modal-glass-card text-center sm fade-in border-top-success">
                <MessageCircle size={50} color="#25D366" className="mx-auto mb-3"/>
                <h2 className="title-main mb-2">Enviar via WhatsApp</h2>
                <p className="text-sec mb-4">Confirme o WhatsApp para enviar o link do documento fiscal.</p>
                <input
                    type="tel"
                    className="mg-input mb-4 text-center"
                    placeholder="(81) 99999-9999"
                    value={mascaraTelefone(zapNumber)}
                    onChange={e => setZapNumber(e.target.value)}
                    autoFocus
                />
                <div className="d-flex gap-3">
                    <button className="btn-outline-sec flex-1" onClick={() => setShowZapModal(false)}>Cancelar</button>
                    <button className="btn-action-success flex-1" style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} onClick={enviarPorWhatsApp}>Enviar</button>
                </div>
            </div>
        </div>
      )}

      {showEmailModal && (
          <div className="modal-glass z-max" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
              <div className="modal-glass-card text-center sm fade-in border-top-primary">
                  <Mail size={50} color="#3b82f6" className="mx-auto mb-3"/>
                  <h2 className="title-main mb-2">Enviar via E-mail</h2>
                  <p className="text-sec mb-4">O documento PDF oficial será enviado em anexo.</p>
                  <input
                      type="email"
                      className="mg-input mb-4 text-center"
                      placeholder="email@cliente.com"
                      value={emailEnvio}
                      onChange={e => setEmailEnvio(e.target.value)}
                      autoFocus
                  />
                  <div className="d-flex gap-3">
                      <button className="btn-outline-sec flex-1" onClick={() => setShowEmailModal(false)}>Cancelar</button>
                      <button className="btn-primary-block flex-1" onClick={enviarPorEmail}>
                          {loading ? <div className="spinner-micro"></div> : 'Enviar Nota'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ========================================================== */}
      {/* MODAL DE SUCESSO (IMPRESSÃO + COMUNICAÇÃO)                   */}
      {/* ========================================================== */}
      {vendaFinalizada && !showZapModal && !showEmailModal && (
        <div className="modal-glass z-max">
            <div className="modal-glass-card text-center sm fade-in border-top-success" style={{ padding: '32px 24px' }}>
                <CheckCircle2 size={60} color="#10b981" className="mx-auto mb-3" />
                <h2 className="title-main mb-2">Transação Concluída!</h2>
                <p className="text-sec mb-4">
                    {vendaFinalizada.offline ? "A internet caiu. A nota está salva e será transmitida assim que o Wi-Fi voltar." : "Documento fiscal emitido e autorizado com sucesso."}
                </p>

                <div className="d-flex-col gap-3 w-full mb-4">
                    <button className="btn-action-primary w-full" onClick={imprimirCupomLocal}>
                        <Printer size={20} /> Imprimir {vendaFinalizada.tipoNota === 'NFE' ? 'DANFE A4' : 'Cupom Fiscal'}
                    </button>

                    <div className="d-flex gap-2 w-full">
                        <button className="btn-outline-sec flex-1 d-flex justify-center align-center gap-2" onClick={() => { setZapNumber(clienteAvulso.telefone || ''); setShowZapModal(true); }} style={{ borderColor: '#10b981', color: '#10b981' }}>
                            <MessageCircle size={20} /> WhatsApp
                        </button>
                        <button className="btn-outline-sec flex-1 d-flex justify-center align-center gap-2" onClick={() => { setEmailEnvio(clienteAvulso.email || ''); setShowEmailModal(true); }} style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>
                            <Mail size={20} /> E-mail
                        </button>
                    </div>
                </div>

                <button className="btn-action-success w-full" style={{background: '#f8fafc', color: '#1e293b', border: '2px solid #cbd5e1', boxShadow: 'none'}} onClick={() => { setVendaFinalizada(null); limparEstadoVenda(); }}>
                    Nova Venda (ESC)
                </button>
            </div>
        </div>
      )}

    </div>
  );
};

export default PDV;