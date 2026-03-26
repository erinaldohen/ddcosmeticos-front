import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  Store, Save, Upload, Search, Palette, FileText, Server, Download, RefreshCw, Trash2,
  Eye, EyeOff, DollarSign, Printer, FileCheck, CheckCircle2, AlertTriangle, Moon, Sun,
  X, Info, Database, AlertCircle, QrCode, Check, Menu, TrendingUp, Clock, Settings
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Configuracoes.css';

const clean = (v) => v ? String(v).replace(/\D/g, '') : '';

const sanitizarDados = (obj) => {
  if (obj === null || obj === undefined) return "";
  if (typeof obj === 'boolean' || typeof obj === 'number') return obj;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const novoObj = {};
    Object.keys(obj).forEach(key => novoObj[key] = sanitizarDados(obj[key]));
    return novoObj;
  }
  return obj;
};

const getBackendUrl = () => api.defaults.baseURL ? api.defaults.baseURL.split('/api')[0] : "";

const formatMoney = (value) => {
    if (value === null || value === undefined) return "0,00";
    const numero = typeof value === 'string' ? Number(value.replace(/\D/g, '')) / 100 : Number(value);
    return isNaN(numero) ? "0,00" : numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = () => resolve(fileReader.result);
    fileReader.onerror = (error) => reject(error);
  });
};

const masks = {
  cnpj: (v) => clean(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').substring(0, 18),
  cep: (v) => clean(v).replace(/^(\d{5})(\d{3})/, '$1-$2').substring(0, 9),
  phone: (v) => {
    let r = clean(v);
    if (r.length > 10) r = r.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (r.length > 5) r = r.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return r.substring(0, 15);
  },
  ie: (v) => clean(v).substring(0, 12),
};

const getUserRole = () => {
    const userStr = localStorage.getItem('user');
    try { return userStr ? JSON.parse(userStr).nome.split(' ')[0] : 'Admin'; } catch { return 'Admin'; }
};

const registrarAuditoria = async (acao, detalhes) => {
    try { await api.post('/auditoria', { acao, operador: getUserRole(), dataHora: new Date().toISOString(), detalhes }); } catch (e) {}
};

const Field = memo(({ label, value, onChange, onBlur, type="text", prefix, suffix, placeholder, options=[], error, disabled, actionIcon, onAction }) => (
    <div className="cfg-field-group">
        <label className="cfg-field-label">{label}</label>
        <div className={`cfg-field-wrapper ${type === 'textarea' ? 'is-textarea' : ''} ${error ? 'cfg-error' : ''} ${disabled ? 'cfg-disabled' : ''}`}>
            {prefix && <span className="cfg-addon prefix">{prefix}</span>}

            {type === 'select' ? (
                <select className="cfg-input" value={value || ''} onChange={onChange} onBlur={onBlur} disabled={disabled}>
                    {options.map((opt, idx) => <option key={idx} value={opt.value}>{opt.label}</option>)}
                </select>
            ) : type === 'textarea' ? (
                <textarea className="cfg-input textarea" value={value || ''} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled}></textarea>
            ) : type === 'color' ? (
                 <div className="cfg-color-picker-wrap">
                     <input type="color" className="cfg-color-input" value={value || '#ec4899'} onChange={onChange} disabled={disabled} />
                     <span className="cfg-color-hex">{value || '#ec4899'}</span>
                 </div>
            ) : (
                <input type={type} className="cfg-input" value={value !== null && value !== undefined ? value : ''} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled} step={type === 'number' ? "any" : undefined} />
            )}

            {suffix && <span className="cfg-addon suffix">{suffix}</span>}
            {actionIcon && <button type="button" className="cfg-action-btn" onClick={onAction} disabled={disabled} tabIndex="-1">{actionIcon}</button>}
        </div>
        {error && <span className="cfg-error-text">{error}</span>}
    </div>
));

const ToggleSwitch = ({ label, description, checked, onChange, danger }) => (
    <label className={`cfg-toggle-wrapper ${danger ? 'cfg-danger-zone' : ''}`}>
        <div className="cfg-toggle-info">
            <strong className={danger ? 'text-red' : ''}>{label}</strong>
            {description && <p>{description}</p>}
        </div>
        <div className="cfg-switch-control">
            <input type="checkbox" checked={!!checked} onChange={onChange} />
            <span className="cfg-slider"></span>
        </div>
    </label>
);

const DangerModal = ({ isOpen, onClose, onConfirm, keyword }) => {
    const [input, setInput] = useState('');
    if (!isOpen) return null;
    return (
        <div className="cfg-modal-overlay">
            <div className="cfg-modal-content border-red">
                <header className="cfg-modal-header text-red">
                    <AlertTriangle size={24}/> <h2>Zona de Risco</h2>
                    <button onClick={onClose} className="cfg-btn-close"><X size={20}/></button>
                </header>
                <div className="cfg-modal-body">
                    <p>Esta ação apagará as configurações do sistema e <strong>não pode ser desfeita</strong>.</p>
                    <p>Digite <strong className="cfg-highlight">{keyword}</strong> para confirmar:</p>
                    <input type="text" className="cfg-danger-input" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder={keyword} autoFocus/>
                </div>
                <footer className="cfg-modal-footer">
                    <button className="cfg-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="cfg-btn-danger-confirm" disabled={input !== keyword} onClick={() => { onConfirm(); setInput(''); }}>Executar Formatação</button>
                </footer>
            </div>
        </div>
    );
};

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('loja');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [certFile, setCertFile] = useState(null);
  const [certData, setCertData] = useState({ validade: null, diasRestantes: 0 });
  const [showToken, setShowToken] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [errors, setErrors] = useState({});
  const [showResetModal, setShowResetModal] = useState(false);

  const lastCepRef = useRef('');
  const lastCnpjRef = useRef('');

  const baseForm = {
    id: null,
    metaFaturamentoMensal: 0,
    loja: {
      razaoSocial: '', nomeFantasia: '', cnpj: '', ie: '', im: '', cnae: '', email: '',
      telefone: '', whatsapp: '', site: '', instagram: '', slogan: '', corDestaque: '#ec4899',
      isMatriz: true, horarioAbre: '', horarioFecha: '', toleranciaMinutos: 0,
      bloqueioForaHorario: false, taxaEntregaPadrao: 0, tempoEntregaMin: 30, logoUrl: ''
    },
    endereco: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' },
    fiscal: {
      ambiente: 'HOMOLOGACAO', regime: '1', tokenHomologacao: '', cscIdHomologacao: '', serieHomologacao: 1, nfeHomologacao: 1,
      tokenProducao: '', cscIdProducao: '', serieProducao: 1, nfeProducao: 1, caminhoCertificado: '', senhaCert: '',
      csrtId: '', csrtHash: '', ibptToken: '', naturezaPadrao: '5.102', emailContabil: '', enviarXmlAutomatico: true,
      aliquotaInterna: 18.00, modoContingencia: false, priorizarMonofasico: true, obsPadraoCupom: ''
    },
    financeiro: {
      comissaoProdutos: 0, comissaoServicos: 0, alertaSangria: 500.00, fundoTrocoPadrao: 0, metaDiaria: 0,
      taxaDebito: 0, taxaCredito: 0, descCaixa: 5.00, descGerente: 20.00, descExtraPix: false, bloquearAbaixoCusto: true,
      pixTipo: 'CNPJ', pixChave: '', aceitaDinheiro: true, aceitaPix: true, aceitaCredito: true, aceitaDebito: true,
      aceitaCrediario: false, jurosMensal: 0, multaAtraso: 0, diasCarencia: 0, fechamentoCego: true
    },
    vendas: {
      comportamentoCpf: 'PERGUNTAR', bloquearEstoque: true, layoutCupom: '', imprimirVendedor: false,
      imprimirTicketTroca: false, autoEnterScanner: false, fidelidadeAtiva: false, pontosPorReal: 0,
      usarBalanca: false, agruparItens: false, metaMensal: 0
    },
    sistema: {
      impressaoAuto: true, larguraPapel: '80MM', backupAuto: true, backupHora: '23:00', rodape: '',
      tema: 'light', backupNuvem: false, senhaGerenteCancelamento: true, nomeTerminal: 'CAIXA 01', imprimirLogoCupom: true
    },
    comissoes: {
      tipoCalculo: 'GERAL', percentualGeral: 0, comissionarSobre: 'LUCRO', descontarTaxasCartao: false
    }
  };

  const [form, setForm] = useState(baseForm);
  const [initialFormState, setInitialFormState] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await api.get('/configuracoes');
        if (data && data.id) {
          const dadosLimpos = sanitizarDados(data);
          const formMontado = {
              ...baseForm, ...dadosLimpos,
              metaFaturamentoMensal: dadosLimpos.metaFaturamentoMensal || 0,
              loja: { ...baseForm.loja, ...(dadosLimpos.loja || {}) },
              endereco: { ...baseForm.endereco, ...(dadosLimpos.endereco || {}) },
              fiscal: { ...baseForm.fiscal, ...(dadosLimpos.fiscal || {}), senhaCert: '' },
              financeiro: { ...baseForm.financeiro, ...(dadosLimpos.financeiro || {}) },
              vendas: { ...baseForm.vendas, ...(dadosLimpos.vendas || {}) },
              sistema: { ...baseForm.sistema, ...(dadosLimpos.sistema || {}) },
              comissoes: { ...baseForm.comissoes, ...(dadosLimpos.comissoes || {}) }
          };
          setForm(formMontado);
          setInitialFormState(JSON.parse(JSON.stringify(formMontado)));

          if (data.loja?.logoUrl) {
              const url = data.loja.logoUrl;
              if (url.startsWith('data:image') || url.startsWith('http')) {
                  setLogoPreview(url);
              } else {
                  const separator = url.startsWith('/') ? '' : '/';
                  setLogoPreview(`${getBackendUrl()}${separator}${url}`);
              }
          }

          if (data.fiscal?.caminhoCertificado) {
              setCertData({
                  validade: data.fiscal.validadeCertificado || "Ativo",
                  diasRestantes: data.fiscal.diasRestantes || null
              });
          }

          const draft = localStorage.getItem('@dd:config_draft');
          if (draft) setHasDraft(true);
        }
      } catch (error) { toast.error("Falha ao carregar configurações do banco."); }
      finally { setIsLoading(false); }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (isDirty && !isLoading) localStorage.setItem('@dd:config_draft', JSON.stringify(form));
    const handleBeforeUnload = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form, isDirty, isLoading]);

  useEffect(() => { return () => { if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview); }; }, [logoPreview]);
  useEffect(() => { if(form.sistema?.tema) document.documentElement.setAttribute('data-theme', form.sistema.tema); }, [form.sistema.tema]);

  const restoreDraft = () => {
      try { const draft = JSON.parse(localStorage.getItem('@dd:config_draft')); if (draft) { setForm(draft); setIsDirty(true); toast.success("Rascunho recuperado!"); } } catch (e) {}
      setHasDraft(false);
  };
  const discardDraft = () => { localStorage.removeItem('@dd:config_draft'); setHasDraft(false); };

  const update = useCallback((section, field, value) => {
    setIsDirty(true); setErrors(prev => ({ ...prev, [`${section}.${field}`]: null }));
    if (section === 'raiz') {
       setForm(prev => ({ ...prev, [field]: value }));
    } else {
       setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
    }
  }, []);

  const updateMask = useCallback((section, field, value, type) => { update(section, field, masks[type](value)); }, [update]);

  const updateMoney = (section, field, value) => {
      const raw = String(value).replace(/\D/g, '');
      const valFinal = raw ? Number(raw) / 100 : 0;
      if (section === 'raiz') update('raiz', field, valFinal);
      else update(section, field, valFinal);
  };

  const updateFiscalEnv = (baseField, value) => {
    const sulfix = form.fiscal.ambiente === 'PRODUCAO' ? 'Producao' : 'Homologacao';
    const fieldName = baseField + sulfix;
    setForm(prev => { setIsDirty(true); return { ...prev, fiscal: { ...prev.fiscal, [fieldName]: value } }; });
  };

  const handlePayment = (key) => {
    setForm(prev => {
      setIsDirty(true);
      return { ...prev, financeiro: { ...prev.financeiro, [key]: !prev.financeiro[key] } };
    });
  };

  const searchCNPJ = async () => {
    const doc = clean(form.loja.cnpj);
    if (doc.length !== 14 || doc === lastCnpjRef.current) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
      const data = await res.json();
      if(data.message) throw new Error();
      lastCnpjRef.current = doc;
      setIsDirty(true); setErrors(prev => ({ ...prev, 'loja.cnpj': null, 'loja.razaoSocial': null }));
      setForm(prev => ({
        ...prev,
        loja: { ...prev.loja, razaoSocial: data.razao_social, nomeFantasia: data.nome_fantasia || data.razao_social, telefone: masks.phone(data.ddd_telefone_1 || ''), email: data.email || prev.loja.email, cnae: data.cnae_fiscal || '' },
        endereco: { ...prev.endereco, cep: masks.cep(data.cep), logradouro: data.logradouro, numero: data.numero, bairro: data.bairro, cidade: data.municipio, uf: data.uf, complemento: data.complemento || '' }
      }));
      toast.success("Dados preenchidos via Receita Federal!");
    } catch { setErrors(prev => ({ ...prev, 'loja.cnpj': 'CNPJ não encontrado' })); }
    finally { setIsSearching(false); }
  };

  const searchCEP = async () => {
    const zip = clean(form.endereco.cep);
    if (zip.length !== 8 || zip === lastCepRef.current) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await res.json();
      if (!data.erro) {
        lastCepRef.current = zip;
        setIsDirty(true);
        setForm(prev => ({ ...prev, endereco: { ...prev.endereco, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf, complemento: data.complemento || '' } }));
      }
    } catch {} finally { setIsSearching(false); }
  };

  const handleSave = async () => {
    const newErrs = {};
    if (!form.loja.razaoSocial) newErrs['loja.razaoSocial'] = 'Razão Social é obrigatória';
    if (form.loja.cnpj && !form.loja.ie) newErrs['loja.ie'] = 'Obrigatório p/ NF-e';

    if (Object.keys(newErrs).length > 0) {
        setErrors(newErrs);
        setActiveTab('loja');
        return toast.error("Corrija os campos marcados em vermelho na aba Empresa.");
    }

    setIsSaving(true);
    try {
      let finalLogoUrl = form.loja.logoUrl;

      if (logoFile) {
        try {
            finalLogoUrl = await convertToBase64(logoFile);
            setLogoFile(null);
        } catch (e) {
            toast.warn("Aviso: Falha ao processar a imagem da logo.");
        }
      }

      if (certFile) {
         if (!form.fiscal.senhaCert) {
             setIsSaving(false); setActiveTab('fiscal');
             return toast.error("A senha do Certificado é obrigatória para a instalação.");
         }

         const formData = new FormData();
         formData.append('file', certFile);
         formData.append('senha', form.fiscal.senhaCert);

         try {
             const certResp = await api.post('/configuracoes/certificado', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
             if (certResp.data && certResp.data.diasRestantes !== undefined) {
                 setCertData({ validade: certResp.data.validade || "Instalado", diasRestantes: certResp.data.diasRestantes });
                 toast.success(`Certificado lido com sucesso! Válido até ${certResp.data.validade}.`);
             }
             setCertFile(null);
             form.fiscal.senhaCert = '';
         } catch (e) {
             setIsSaving(false); setActiveTab('fiscal');
             return toast.error("Falha: Senha incorreta ou arquivo .PFX corrompido.");
         }
      }

      // 🟢 A MÁGICA FINAL: Forçamos o CSC a ter exatamente 6 dígitos como string, garantindo que o Backend não receba um "número cru"
      const payload = {
          ...form,
          loja: { ...form.loja, logoUrl: finalLogoUrl },
          fiscal: {
              ...form.fiscal,
              senhaCert: '',
              cscIdHomologacao: form.fiscal.cscIdHomologacao ? String(form.fiscal.cscIdHomologacao).padStart(6, '0') : '',
              cscIdProducao: form.fiscal.cscIdProducao ? String(form.fiscal.cscIdProducao).padStart(6, '0') : ''
          }
      };

      if (initialFormState) {
          if (initialFormState.sistema.senhaGerenteCancelamento !== payload.sistema.senhaGerenteCancelamento) await registrarAuditoria('CONFIG_SISTEMA', 'Regra de cancelamento PDV alterada');
          if (initialFormState.financeiro.fechamentoCego !== payload.financeiro.fechamentoCego) await registrarAuditoria('CONFIG_FINANCEIRO', 'Fechamento de caixa alterado');
      }

      const { data: configSalva } = await api.put('/configuracoes', payload);
      const dadosLimpos = sanitizarDados(configSalva);

      const formAtualizado = {
          ...form, ...dadosLimpos,
          metaFaturamentoMensal: dadosLimpos.metaFaturamentoMensal || 0,
          loja: { ...form.loja, ...(dadosLimpos.loja || {}) },
          fiscal: { ...form.fiscal, ...(dadosLimpos.fiscal || {}), senhaCert: '' }
      };

      setForm(formAtualizado);
      setInitialFormState(JSON.parse(JSON.stringify(formAtualizado)));
      setIsDirty(false);
      localStorage.removeItem('@dd:config_draft');

      if (formAtualizado.loja.logoUrl) {
          const url = formAtualizado.loja.logoUrl;
          if (url.startsWith('data:image') || url.startsWith('http')) {
              setLogoPreview(url);
          } else {
              const separator = url.startsWith('/') ? '' : '/';
              setLogoPreview(`${getBackendUrl()}${separator}${url}`);
          }
      }

      toast.success("Configurações salvas e aplicadas!");

    } catch (error) { toast.error("Erro Crítico: Falha de comunicação com o servidor."); }
    finally { setIsSaving(false); }
  };

  const handleOtimizarBanco = async () => {
      const toastId = toast.loading("Otimizando banco de dados...");
      try { await api.post('/configuracoes/manutencao/otimizar'); toast.update(toastId, { render: "Banco otimizado!", type: "success", isLoading: false, autoClose: 3000 }); } catch (e) { toast.update(toastId, { render: "Falha ao otimizar banco.", type: "error", isLoading: false, autoClose: 3000 }); }
  };
  const handleBackup = async () => {
      const toastId = toast.loading("Preparando backup de segurança...");
      try {
          const response = await api.get('/configuracoes/manutencao/backup', { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a'); link.href = url;
          link.setAttribute('download', `ddcosmeticos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
          document.body.appendChild(link); link.click(); link.remove();
          toast.update(toastId, { render: "Download em andamento!", type: "success", isLoading: false, autoClose: 3000 });
      } catch (e) { toast.update(toastId, { render: "Erro de permissão no backup.", type: "error", isLoading: false, autoClose: 3000 }); }
  };
  const executeFactoryReset = async () => {
      setShowResetModal(false);
      const toastId = toast.loading("Formatando sistema...");
      try {
          await api.post('/configuracoes/manutencao/reset');
          toast.update(toastId, { render: "Sistema zerado. Reiniciando...", type: "success", isLoading: false, autoClose: 3000 });
          setTimeout(() => window.location.reload(true), 2000);
      } catch (e) { toast.update(toastId, { render: "Acesso negado para formatar banco.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  if (isLoading) return <div className="cfg-loader"><RefreshCw className="spin" size={40} /><h2>Sincronizando Sistema</h2></div>;

  const isProd = form.fiscal.ambiente === 'PRODUCAO';
  const cSerie = isProd ? form.fiscal.serieProducao : form.fiscal.serieHomologacao;
  const cNfe = isProd ? form.fiscal.nfeProducao : form.fiscal.nfeHomologacao;
  const cToken = isProd ? form.fiscal.tokenProducao : form.fiscal.tokenHomologacao;
  const cCscId = isProd ? form.fiscal.cscIdProducao : form.fiscal.cscIdHomologacao;

  const tabs = [
      { id: 'loja', icon: <Store size={18}/>, label: 'Identidade e Empresa' },
      { id: 'fiscal', icon: <FileText size={18}/>, label: 'Fiscal e Tributos' },
      { id: 'financeiro', icon: <DollarSign size={18}/>, label: 'Caixa e Financeiro' },
      { id: 'vendas', icon: <Printer size={18}/>, label: 'Operação de Vendas' },
      { id: 'comissoes', icon: <TrendingUp size={18}/>, label: 'Comissões e Metas' },
      { id: 'sistema', icon: <Server size={18}/>, label: 'Sistema e Segurança' },
  ];

  return (
    <div className="cfg-page-container animate-fade">
      <DangerModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} onConfirm={executeFactoryReset} keyword="CONFIRMAR" />

      {hasDraft && (
          <div className="cfg-draft-banner slide-down">
              <div className="cfg-flex"><AlertCircle size={18}/> <span>Recuperamos alterações que não foram salvas.</span></div>
              <div className="cfg-flex gap-sm">
                  <button className="cfg-btn-ghost text-white" onClick={discardDraft}>Descartar</button>
                  <button className="cfg-btn-solid-light" onClick={restoreDraft}>Restaurar</button>
              </div>
          </div>
      )}

      <header className="cfg-topbar">
          <div className="cfg-title-area">
              <h1>Configurações Globais</h1>
              <p>Gerencie as regras de negócio, notas fiscais e aparência do seu PDV.</p>
          </div>
          <div className="cfg-actions-area">
              {isDirty && <span className="cfg-badge-dirty slide-left">Modificado</span>}
              <button className="cfg-btn-icon" onClick={() => update('sistema', 'tema', form.sistema.tema === 'light' ? 'dark' : 'light')} title="Mudar Tema">
                  {form.sistema.tema === 'light' ? <Moon size={22}/> : <Sun size={22}/>}
              </button>
              <button className={`cfg-btn-save ${isSaving ? 'saving' : ''} ${!isDirty && !logoFile && !certFile ? 'disabled' : ''}`} onClick={handleSave} disabled={isSaving || (!isDirty && !logoFile && !certFile)}>
                  {isSaving ? <RefreshCw className="spin" size={20}/> : <Save size={20}/>}
                  <span className="cfg-hide-mobile">{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
          </div>
      </header>

      <div className="cfg-layout">

          <div className="cfg-mobile-tab-selector">
              <label>Menu de Configurações:</label>
              <div className="cfg-mobile-select-wrapper">
                  <Menu size={18} className="cfg-mobile-select-icon"/>
                  <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)}>
                      {tabs.map(tab => (
                          <option key={tab.id} value={tab.id}>{tab.label}</option>
                      ))}
                  </select>
              </div>
          </div>

          <aside className="cfg-sidebar">
              <nav className="cfg-nav">
                  {tabs.map(tab => (
                      <button key={tab.id} className={`cfg-nav-item ${activeTab === tab.id ? 'active' : ''} ${Object.keys(errors).some(k => k.startsWith(tab.id)) ? 'has-error' : ''}`} onClick={() => setActiveTab(tab.id)}>
                          {tab.icon} <span>{tab.label}</span>
                      </button>
                  ))}
              </nav>
          </aside>

          <main className={`cfg-content-area ${isSaving ? 'fade-out' : ''}`}>

              {activeTab === 'loja' && (
                  <div className="cfg-panel animate-fade">
                      <h2 className="cfg-panel-title">Identidade Visual e Informações</h2>
                      <div className="cfg-card mb-5">
                          <div className="cfg-grid-col-2">
                              <div className="cfg-logo-uploader">
                                  <div className="cfg-logo-box" style={{ width: '120px', height: '120px', borderRadius: '12px', background: '#f1f5f9', border: '2px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                      {logoPreview ? <img src={logoPreview} alt="Logo" style={{width: '100%', height: '100%', objectFit: 'contain'}}/> : <Store size={48} color="var(--text-muted)"/>}
                                  </div>
                                  <div className="cfg-logo-controls">
                                      <h3>Logo da Empresa</h3>
                                      <p>Usada no PDV e Impressão de Cupons.</p>
                                      <div className="cfg-flex mt-2 flex-wrap">
                                          <label className="cfg-btn-outline cfg-btn-sm"><Upload size={16}/> {logoFile ? "Trocar Imagem" : "Enviar Arquivo"}<input type="file" hidden accept="image/*" onChange={(e) => { if(e.target.files[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])); setIsDirty(true); } }}/></label>
                                          {(logoPreview || logoFile) && <button className="cfg-btn-link text-red" onClick={() => {setLogoPreview(null); setLogoFile(null); update('loja', 'logoUrl', '');}}>Remover</button>}
                                      </div>
                                  </div>
                              </div>
                              <div className="cfg-card-divider hide-mobile"></div>
                              <div className="cfg-visual-controls">
                                  <Field label="Cor Primária do Sistema" type="color" value={form.loja.corDestaque} onChange={e => update('loja', 'corDestaque', e.target.value)} />
                                  <div className="mt-3"><ToggleSwitch label="Esta Loja é a Matriz" description="Apenas matrizes podem distribuir produtos." checked={form.loja.isMatriz} onChange={e => update('loja', 'isMatriz', e.target.checked)} /></div>
                              </div>
                          </div>
                      </div>

                      <h2 className="cfg-panel-title">Dados Cadastrais e Endereço</h2>
                      <div className="cfg-card">
                          <div className="cfg-grid-col-3 mb-4">
                              <Field label="CNPJ" value={form.loja.cnpj} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} onBlur={searchCNPJ} error={errors['loja.cnpj']} actionIcon={isSearching ? <RefreshCw className="spin" size={18}/> : <Search size={18}/>} onAction={searchCNPJ} placeholder="00.000.000/0000-00" />
                              <Field label="Inscrição Estadual (IE)" value={form.loja.ie} onChange={e => updateMask('loja', 'ie', e.target.value, 'ie')} error={errors['loja.ie']} placeholder="Obrigatório p/ NF-e" />
                              <Field label="Inscrição Municipal (IM)" value={form.loja.im} onChange={e => update('loja', 'im', clean(e.target.value))} placeholder="Opcional" />
                          </div>

                          <div className="mb-4"><Field label="Razão Social (Contrato Social)" value={form.loja.razaoSocial} onChange={e => update('loja', 'razaoSocial', e.target.value)} error={errors['loja.razaoSocial']} /></div>

                          <div className="cfg-grid-col-3 mb-4">
                              <Field label="Nome Fantasia" value={form.loja.nomeFantasia} onChange={e => update('loja', 'nomeFantasia', e.target.value)} />
                              <Field label="Slogan / Frase" value={form.loja.slogan} onChange={e => update('loja', 'slogan', e.target.value)} />
                              <Field label="CNAE Principal" value={form.loja.cnae} onChange={e => update('loja', 'cnae', clean(e.target.value))} placeholder="Opcional" />
                          </div>

                          <div className="cfg-grid-col-4 mb-4">
                              <Field label="WhatsApp de Contato" value={form.loja.whatsapp} onChange={e => updateMask('loja', 'whatsapp', e.target.value, 'phone')} placeholder="(81) 90000-0000" />
                              <Field label="Instagram" prefix="@" value={form.loja.instagram} onChange={e => update('loja', 'instagram', e.target.value)} placeholder="sua.loja" />
                              <Field label="Email" value={form.loja.email} onChange={e => update('loja', 'email', e.target.value)} placeholder="loja@email.com" />
                              <Field label="Site" value={form.loja.site} onChange={e => update('loja', 'site', e.target.value)} placeholder="www.sualoja.com.br" />
                          </div>

                          <div className="cfg-card-divider mb-4"></div>

                          <div className="cfg-grid-col-3 mb-4">
                              <Field label="CEP" value={form.endereco.cep} onChange={e => updateMask('endereco', 'cep', e.target.value, 'cep')} onBlur={searchCEP} actionIcon={<Search size={18}/>} onAction={searchCEP} placeholder="00000-000" />
                              <div className="cfg-addr-logradouro" style={{gridColumn: 'span 2'}}><Field label="Logradouro (Rua/Av)" value={form.endereco.logradouro} onChange={e => update('endereco', 'logradouro', e.target.value)} /></div>
                          </div>

                          <div className="cfg-grid-col-4 mb-4">
                              <Field label="Nº" value={form.endereco.numero} onChange={e => update('endereco', 'numero', e.target.value)} />
                              <Field label="Complemento" value={form.endereco.complemento} onChange={e => update('endereco', 'complemento', e.target.value)} placeholder="Sala, Galpão..." />
                              <Field label="Bairro" value={form.endereco.bairro} onChange={e => update('endereco', 'bairro', e.target.value)} />
                              <Field label="Cidade" value={form.endereco.cidade} onChange={e => update('endereco', 'cidade', e.target.value)} />
                          </div>

                          <div className="cfg-card-divider mb-4"></div>

                          <h3 className="cfg-card-title mb-4">Horários e Entregas</h3>
                          <div className="cfg-grid-col-4 mb-4">
                              <Field label="Abertura" type="time" value={form.loja.horarioAbre} onChange={e => update('loja', 'horarioAbre', e.target.value)} />
                              <Field label="Fechamento" type="time" value={form.loja.horarioFecha} onChange={e => update('loja', 'horarioFecha', e.target.value)} />
                              <Field label="Tolerância (min)" type="number" value={form.loja.toleranciaMinutos} onChange={e => update('loja', 'toleranciaMinutos', parseInt(e.target.value) || 0)} />
                              <div className="pt-2"><ToggleSwitch label="Bloquear PDV fora do horário" checked={form.loja.bloqueioForaHorario} onChange={e => update('loja', 'bloqueioForaHorario', e.target.checked)} danger /></div>
                          </div>

                          <div className="cfg-grid-col-2">
                              <Field label="Taxa Padrão de Entrega" prefix="R$" value={formatMoney(form.loja.taxaEntregaPadrao)} onChange={e => updateMoney('loja', 'taxaEntregaPadrao', e.target.value)} placeholder="0,00" />
                              <Field label="Tempo Mínimo de Entrega (Minutos)" type="number" value={form.loja.tempoEntregaMin} onChange={e => update('loja', 'tempoEntregaMin', parseInt(e.target.value) || 0)} />
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'fiscal' && (
                  <div className="tab-pane animate-slide-left">
                      <div className="cfg-card-header flex-between flex-wrap">
                          <div>
                              <h2 className="cfg-panel-title m-0">Motor Fiscal</h2>
                              <p className="cfg-panel-sub">Comunicação e Autenticação com a Receita (SEFAZ).</p>
                          </div>
                          <div className="cfg-env-selector mt-2-mobile">
                              <button className={form.fiscal.ambiente === 'HOMOLOGACAO' ? 'active-warn' : ''} onClick={() => update('fiscal', 'ambiente', 'HOMOLOGACAO')}>Homologação (Testes)</button>
                              <button className={form.fiscal.ambiente === 'PRODUCAO' ? 'active-success' : ''} onClick={() => update('fiscal', 'ambiente', 'PRODUCAO')}>Produção (Validade Jurídica)</button>
                          </div>
                      </div>

                      {form.fiscal.ambiente === 'PRODUCAO' && (
                          <div className="cfg-alert danger mt-4 mb-4">
                              <AlertTriangle size={24}/>
                              <div><strong>ATENÇÃO MÁXIMA:</strong> Você está no ambiente de Produção. Todas as notas emitidas aqui gerarão impostos reais para o seu CNPJ.</div>
                          </div>
                      )}

                      <div className="cfg-card mt-4">
                          <h3 className="cfg-card-title border-bottom pb-2 mb-4">1. Certificado Digital A1</h3>
                          <div className="cfg-grid-col-2 items-center">
                              <div className="cfg-cert-box w-full">
                                  {certData.validade ? (
                                      <div className={`cfg-cert-status ${certData.diasRestantes && certData.diasRestantes < 30 ? 'warn' : 'ok'}`}>
                                          {certData.diasRestantes && certData.diasRestantes < 30 ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                                          <div>
                                              <h4>Certificado Instalado</h4>
                                              <span>{certData.validade} {certData.diasRestantes && `(Restam ${certData.diasRestantes} dias)`}</span>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="cfg-cert-status empty">
                                          <FileCheck size={32} />
                                          <div><h4>Sem Certificado</h4><span>O PDV não conseguirá emitir nota fiscal.</span></div>
                                      </div>
                                  )}
                                  <label className="cfg-btn-solid-light mt-3 w-full text-center">
                                      <Upload size={18} className="mr-2"/> {certFile ? 'Arquivo Carregado' : 'Procurar .PFX'}
                                      <input type="file" hidden accept=".pfx,.p12" onChange={(e) => { if(e.target.files[0]) { setCertFile(e.target.files[0]); setIsDirty(true); toast.info("Digite a senha do certificado ao lado para que a chave seja lida."); } }}/>
                                  </label>
                              </div>
                              <div className="cfg-cert-inputs w-full">
                                  <Field label="Senha do Certificado Digital" type={showToken ? "text" : "password"} value={form.fiscal.senhaCert} onChange={e => update('fiscal', 'senhaCert', e.target.value)} actionIcon={showToken ? <EyeOff size={18}/> : <Eye size={18}/>} onAction={() => setShowToken(!showToken)} placeholder="Digite para instalar um novo arquivo" />
                                  <div className="mt-4 pt-4 border-top">
                                      <ToggleSwitch label="Contingência Automática" description="Se a SEFAZ cair, o sistema emite a nota offline." checked={form.fiscal.modoContingencia} onChange={e => update('fiscal', 'modoContingencia', e.target.checked)} danger />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="cfg-card mt-4">
                          <h3 className="cfg-card-title border-bottom pb-2 mb-4">2. Parâmetros de Emissão ({form.fiscal.ambiente})</h3>
                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="Regime Tributário" type="select" value={form.fiscal.regime || "1"} onChange={e => update('fiscal', 'regime', e.target.value)} options={[ { value: '1', label: '1 - Simples Nacional' }, { value: '3', label: '3 - Regime Normal (Lucro Presumido/Real)' } ]} />
                              <Field label="CFOP Base do Caixa" type="select" value={form.fiscal.naturezaPadrao || "5.102"} onChange={e => update('fiscal', 'naturezaPadrao', e.target.value)} options={[ { value: '5.102', label: '5.102 - Venda de Mercadoria Padrão' }, { value: '5.405', label: '5.405 - Venda com Subst. Tributária (Recomendado)' } ]} />
                          </div>

                          <div className="cfg-grid-col-3 mb-4">
                              <Field label="Série da NFC-e" value={cSerie || ""} onChange={e => updateFiscalEnv('serie', clean(e.target.value))} placeholder="Normalmente: 1" />
                              <Field label="Próximo Número (NFC-e)" value={cNfe || ""} onChange={e => updateFiscalEnv('nfe', clean(e.target.value))} placeholder="Ex: 1500" />
                              <Field label="Alíquota ICMS do Estado" suffix="%" value={form.fiscal.aliquotaInterna || ""} onChange={e => update('fiscal', 'aliquotaInterna', e.target.value)} placeholder="Ex: 18 ou 20.5" />
                          </div>

                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="Token CSC (Código de Segurança)" type="password" value={cToken || ""} onChange={e => updateFiscalEnv('token', e.target.value.replace(/[\s\u200B-\u200D\uFEFF]/g, ''))} placeholder="Fornecido pela sua contabilidade" />
                              <Field label="ID do CSC (Obrigatório 6 dígitos)" value={cCscId || ""} onChange={e => updateFiscalEnv('cscId', clean(e.target.value))} placeholder="Ex: 000001" />
                          </div>

                          <div className="cfg-card-divider mb-4"></div>

                          <h3 className="cfg-card-title mb-4">Tokens e Contabilidade</h3>
                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="ID CSRT" value={form.fiscal.csrtId} onChange={e => update('fiscal', 'csrtId', clean(e.target.value))} placeholder="Opcional em alguns estados" />
                              <Field label="Hash CSRT" type="password" value={form.fiscal.csrtHash} onChange={e => update('fiscal', 'csrtHash', e.target.value)} />
                          </div>

                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="Token IBPT (Imposto na Nota)" value={form.fiscal.ibptToken} onChange={e => update('fiscal', 'ibptToken', e.target.value)} placeholder="Para cálculo de tributos transparentes" />
                              <Field label="E-mail da Contabilidade" value={form.fiscal.emailContabil} onChange={e => update('fiscal', 'emailContabil', e.target.value)} placeholder="contato@contabilidade.com" />
                          </div>

                          <div className="cfg-grid-col-2 mb-4">
                              <ToggleSwitch label="Enviar XML Automático" description="Dispara os fechamentos e XMLs para a contabilidade ao fechar o mês." checked={form.fiscal.enviarXmlAutomatico} onChange={e => update('fiscal', 'enviarXmlAutomatico', e.target.checked)} />
                              <ToggleSwitch label="Priorizar Monofásico" description="Se marcado, força CST específico para cosméticos monofásicos." checked={form.fiscal.priorizarMonofasico} onChange={e => update('fiscal', 'priorizarMonofasico', e.target.checked)} />
                          </div>

                          <Field label="Observação Padrão da Nota" type="textarea" value={form.fiscal.obsPadraoCupom} onChange={e => update('fiscal', 'obsPadraoCupom', e.target.value)} placeholder="Ex: Documento emitido por ME ou EPP optante pelo Simples Nacional." />
                      </div>
                  </div>
              )}

              {activeTab === 'financeiro' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Operação Financeira do Caixa</h2>
                      <div className="cfg-card">
                          <h3 className="cfg-card-title border-bottom pb-2 mb-4">Valores de Fundo e Alertas</h3>
                          <div className="cfg-grid-col-3 mb-5">
                              <Field label="Fundo de Troco Fixo" prefix="R$" value={formatMoney(form.financeiro.fundoTrocoPadrao)} onChange={e => updateMoney('financeiro', 'fundoTrocoPadrao', e.target.value)} placeholder="0,00" />
                              <Field label="Alerta de Sangria (Teto da Gaveta)" prefix="R$" value={formatMoney(form.financeiro.alertaSangria)} onChange={e => updateMoney('financeiro', 'alertaSangria', e.target.value)} placeholder="0,00" />
                              <Field label="Meta Diária Padrão" prefix="R$" value={formatMoney(form.financeiro.metaDiaria)} onChange={e => updateMoney('financeiro', 'metaDiaria', e.target.value)} placeholder="0,00" />
                          </div>

                          <h3 className="cfg-card-title border-bottom pb-2 mb-4">Taxas e Limites</h3>
                          <div className="cfg-grid-col-4 mb-5">
                              <Field label="Taxa Crédito" suffix="%" value={formatMoney(form.financeiro.taxaCredito)} onChange={e => updateMoney('financeiro', 'taxaCredito', e.target.value)} />
                              <Field label="Taxa Débito" suffix="%" value={formatMoney(form.financeiro.taxaDebito)} onChange={e => updateMoney('financeiro', 'taxaDebito', e.target.value)} />
                              <Field label="Desconto Máx. Caixa" suffix="%" value={formatMoney(form.financeiro.descCaixa)} onChange={e => updateMoney('financeiro', 'descCaixa', e.target.value)} />
                              <Field label="Desconto Máx. Gerente" suffix="%" value={formatMoney(form.financeiro.descGerente)} onChange={e => updateMoney('financeiro', 'descGerente', e.target.value)} />
                          </div>

                          <div className="cfg-grid-col-2 mb-5">
                              <ToggleSwitch label="Permitir Desconto Extra no PIX" checked={form.financeiro.descExtraPix} onChange={e => update('financeiro', 'descExtraPix', e.target.checked)} />
                              <ToggleSwitch label="Bloquear Venda Abaixo do Custo" checked={form.financeiro.bloquearAbaixoCusto} onChange={e => update('financeiro', 'bloquearAbaixoCusto', e.target.checked)} danger />
                          </div>

                          <div className="cfg-highlight-box border-red mb-5">
                              <ToggleSwitch label="Fechamento de Caixa Cego (Anti-Fraude)" description="Obriga o operador a contar as notas às cegas. Evita que ele retire as sobras." checked={form.financeiro.fechamentoCego} onChange={e => update('financeiro', 'fechamentoCego', e.target.checked)} danger />
                          </div>

                          <h3 className="cfg-card-title border-bottom pb-2 mb-4">Meios de Pagamento Aceitos</h3>
                          <div className="cfg-payment-grid mb-4">
                              {[
                                  {id: 'aceitaDinheiro', icon: <DollarSign size={20}/>, label: 'Dinheiro'},
                                  {id: 'aceitaPix', icon: <QrCode size={20}/>, label: 'PIX Direto'},
                                  {id: 'aceitaCredito', icon: <Printer size={20}/>, label: 'Cartão Crédito'},
                                  {id: 'aceitaDebito', icon: <Printer size={20}/>, label: 'Cartão Débito'},
                                  {id: 'aceitaCrediario', icon: <FileText size={20}/>, label: 'Fiado / Crediário'}
                              ].map(metodo => (
                                  <button key={metodo.id} className={`cfg-pay-card ${form.financeiro[metodo.id] ? 'active' : ''}`} onClick={() => handlePayment(metodo.id)}>
                                      <div className="pay-check">{form.financeiro[metodo.id] && <Check size={14}/>}</div>
                                      {metodo.icon} <span>{metodo.label}</span>
                                  </button>
                              ))}
                          </div>

                          {form.financeiro.aceitaPix && (
                              <div className="cfg-highlight-box border-blue fade-in mb-5">
                                  <h4 className="mb-3 text-blue">Configuração da Chave PIX (QR Code Tela)</h4>
                                  <div className="cfg-grid-col-2">
                                      <Field label="Tipo de Chave" type="select" value={form.financeiro.pixTipo || "CNPJ"} onChange={e => update('financeiro', 'pixTipo', e.target.value)} options={[ { value: 'CNPJ', label: 'CNPJ' }, { value: 'CELULAR', label: 'Celular' }, { value: 'ALEATORIA', label: 'Chave Aleatória' }, { value: 'EMAIL', label: 'E-mail' } ]} />
                                      <Field label="A sua Chave PIX" value={form.financeiro.pixChave} onChange={e => update('financeiro', 'pixChave', e.target.value)} placeholder="Cole a chave aqui" />
                                  </div>
                              </div>
                          )}

                          {form.financeiro.aceitaCrediario && (
                              <div className="cfg-highlight-box border-warning fade-in mb-5">
                                  <h4 className="mb-3 text-warning">Regras do Crediário / Fiado</h4>
                                  <div className="cfg-grid-col-3">
                                      <Field label="Juros Mensal" suffix="%" value={formatMoney(form.financeiro.jurosMensal)} onChange={e => updateMoney('financeiro', 'jurosMensal', e.target.value)} />
                                      <Field label="Multa por Atraso" prefix="R$" value={formatMoney(form.financeiro.multaAtraso)} onChange={e => updateMoney('financeiro', 'multaAtraso', e.target.value)} />
                                      <Field label="Dias de Carência" type="number" value={form.financeiro.diasCarencia} onChange={e => update('financeiro', 'diasCarencia', parseInt(e.target.value) || 0)} />
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {activeTab === 'vendas' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Operação de Vendas (PDV)</h2>
                      <div className="cfg-card">

                          <div className="cfg-highlight-box border-blue mb-5">
                              <h4 className="mb-3 text-blue">Comportamento de Venda</h4>
                              <div className="cfg-grid-col-3 items-center">
                                  <Field label="Identificar Cliente (CPF)" type="select" value={form.vendas.comportamentoCpf || "PERGUNTAR"} onChange={e => update('vendas', 'comportamentoCpf', e.target.value)} options={[ { value: 'PERGUNTAR', label: 'Sugerir Identificação' }, { value: 'SEMPRE', label: 'Obrigatório (Trava a Venda)' }, { value: 'NUNCA', label: 'Não Sugerir' } ]} />
                                  <Field label="Layout do Cupom" type="select" value={form.vendas.layoutCupom || "PADRAO"} onChange={e => update('vendas', 'layoutCupom', e.target.value)} options={[ { value: 'PADRAO', label: 'Padrão (Compacto)' }, { value: 'DETALHADO', label: 'Detalhado (Com Descontos)' } ]} />
                                  <div className="pt-2 pl-4"><ToggleSwitch label="Bloquear Estoque Zerado" checked={form.vendas.bloquearEstoque} onChange={e => update('vendas', 'bloquearEstoque', e.target.checked)} danger /></div>
                              </div>
                          </div>

                          <div className="cfg-grid-col-3 mb-5">
                              <ToggleSwitch label="Imprimir Ticket Troca" checked={form.vendas.imprimirTicketTroca} onChange={e => update('vendas', 'imprimirTicketTroca', e.target.checked)} />
                              <ToggleSwitch label="Imprimir Vendedor no Cupom" checked={form.vendas.imprimirVendedor} onChange={e => update('vendas', 'imprimirVendedor', e.target.checked)} />
                              <ToggleSwitch label="Agrupar Itens Iguais" checked={form.vendas.agruparItens} onChange={e => update('vendas', 'agruparItens', e.target.checked)} />
                          </div>

                          <div className="cfg-grid-col-2 mb-5">
                              <ToggleSwitch label="Auto-Enter no Scanner" description="Adiciona o produto automaticamente sem apertar Enter." checked={form.vendas.autoEnterScanner} onChange={e => update('vendas', 'autoEnterScanner', e.target.checked)} />
                              <ToggleSwitch label="Integração de Balança" description="Busca peso via porta COM automaticamente." checked={form.vendas.usarBalanca} onChange={e => update('vendas', 'usarBalanca', e.target.checked)} />
                          </div>

                          <div className="cfg-card-divider mb-5"></div>

                          <div className="cfg-highlight-box border-warning mb-5">
                              <h4 className="mb-3 text-warning">Programa de Fidelidade</h4>
                              <div className="cfg-grid-col-2">
                                  <ToggleSwitch label="Ativar Fidelidade" description="Acumula pontos pelo CPF na hora da compra." checked={form.vendas.fidelidadeAtiva} onChange={e => update('vendas', 'fidelidadeAtiva', e.target.checked)} />
                                  {form.vendas.fidelidadeAtiva && (
                                      <Field label="Pontos a cada R$ 1,00 gasto" type="number" value={form.vendas.pontosPorReal} onChange={e => update('vendas', 'pontosPorReal', parseFloat(e.target.value) || 0)} />
                                  )}
                              </div>
                          </div>

                      </div>
                  </div>
              )}

              {activeTab === 'comissoes' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Metas e Comissionamento</h2>
                      <div className="cfg-card">

                          <div className="cfg-highlight-box border-blue mb-5">
                              <h4 className="mb-3 text-blue">Termômetro de Dashboard (Meta da Loja)</h4>
                              <div className="cfg-grid-col-2 items-center">
                                  <Field
                                      label="Meta de Faturamento Mensal"
                                      prefix="R$"
                                      value={formatMoney(form.metaFaturamentoMensal)}
                                      onChange={e => updateMoney('raiz', 'metaFaturamentoMensal', e.target.value)}
                                      placeholder="Ex: 50.000,00"
                                  />
                                  <div className="cfg-info-msg m-0-mobile">
                                      <Info size={16}/> <span>Usado nos painéis principais para calcular progresso do mês.</span>
                                  </div>
                              </div>
                          </div>

                          <div className="cfg-card-divider mb-5"></div>

                          <h3 className="cfg-card-title mb-4">Cálculo de Comissões dos Vendedores</h3>
                          <div className="cfg-grid-col-2 mb-5">
                              <div className="cfg-highlight-box border-blue">
                                  <Field
                                      label="Regra Base de Comissão"
                                      type="select"
                                      value={form.comissoes?.tipoCalculo || 'GERAL'}
                                      onChange={e => update('comissoes', 'tipoCalculo', e.target.value)}
                                      options={[
                                          { value: 'GERAL', label: 'Percentual Fixo (Loja Toda)' },
                                          { value: 'CATEGORIA', label: 'Por Categoria de Produto' }
                                      ]}
                                  />
                                  {form.comissoes?.tipoCalculo === 'GERAL' && (
                                      <div className="mt-3">
                                          <Field
                                              label="Percentual Pago (%)"
                                              type="number"
                                              suffix="%"
                                              value={form.comissoes?.percentualGeral || 0}
                                              onChange={e => update('comissoes', 'percentualGeral', parseFloat(e.target.value) || 0)}
                                          />
                                      </div>
                                  )}
                              </div>

                              <div className="cfg-highlight-box border-blue">
                                  <Field
                                      label="A Comissão é calculada sobre o quê?"
                                      type="select"
                                      value={form.comissoes?.comissionarSobre || 'LUCRO'}
                                      onChange={e => update('comissoes', 'comissionarSobre', e.target.value)}
                                      options={[
                                          { value: 'TOTAL_VENDA', label: 'Sobre o Valor Bruto da Venda' },
                                          { value: 'LUCRO', label: 'Sobre o Lucro Líquido (Venda - Custo)' }
                                      ]}
                                  />
                              </div>
                          </div>

                          <ToggleSwitch
                              label="Descontar Taxas da Maquininha?"
                              description="Se ativado, subtrai a taxa do cartão de crédito/débito antes de aplicar o percentual do vendedor."
                              checked={form.comissoes?.descontarTaxasCartao}
                              onChange={e => update('comissoes', 'descontarTaxasCartao', e.target.checked)}
                          />
                      </div>
                  </div>
              )}

              {activeTab === 'sistema' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Sistema, Backup e Segurança</h2>
                      <div className="cfg-card mb-5">
                          <div className="cfg-grid-col-3 mb-4">
                              <Field label="Nome do Terminal Atual" value={form.sistema?.nomeTerminal} onChange={e => update('sistema', 'nomeTerminal', e.target.value)} placeholder="Ex: CAIXA PRINCIPAL" />
                              <Field label="Tamanho da Impressora" type="select" value={form.sistema?.larguraPapel || "80MM"} onChange={e => update('sistema', 'larguraPapel', e.target.value)} options={[ { value: '80MM', label: '80mm Padrão' }, { value: '58MM', label: '58mm Mini Bluetooth' } ]} />
                              <div className="pt-2"><ToggleSwitch label="Imprimir Logo no Cupom" checked={form.sistema?.imprimirLogoCupom} onChange={e => update('sistema', 'imprimirLogoCupom', e.target.checked)} /></div>
                          </div>

                          <div className="cfg-grid-col-2 mb-4">
                              <ToggleSwitch label="Impressão Automática no Final da Venda" checked={form.sistema?.impressaoAuto} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)} />
                          </div>

                          <Field label="Mensagem no Rodapé do Cupom Fiscal/Não Fiscal" type="textarea" value={form.sistema?.rodape} onChange={e => update('sistema', 'rodape', e.target.value)} placeholder="Ex: Volte Sempre! Trocas em 7 dias." />

                          <div className="cfg-card-divider my-5"></div>

                          <h3 className="cfg-card-title border-bottom pb-2 mb-4 mt-2">Níveis de Permissão no Balcão</h3>
                          <div className="cfg-highlight-box border-red mb-5">
                              <ToggleSwitch label="Exigir Senha do Gerente para Cancelamentos" description="Requer permissão de nível Gerencial para cancelar itens ou a venda inteira no PDV." checked={form.sistema?.senhaGerenteCancelamento} onChange={e => update('sistema', 'senhaGerenteCancelamento', e.target.checked)} danger />
                          </div>

                          <div className="cfg-card-divider my-5"></div>

                          <h3 className="cfg-card-title mb-4">Rotinas de Backup</h3>
                          <div className="cfg-grid-col-3 mb-4">
                              <ToggleSwitch label="Ativar Backup Automático" checked={form.sistema?.backupAuto} onChange={e => update('sistema', 'backupAuto', e.target.checked)} />
                              <Field label="Hora do Backup" type="time" value={form.sistema?.backupHora} onChange={e => update('sistema', 'backupHora', e.target.value)} disabled={!form.sistema?.backupAuto}/>
                              <ToggleSwitch label="Sincronizar em Nuvem" checked={form.sistema?.backupNuvem} onChange={e => update('sistema', 'backupNuvem', e.target.checked)} disabled={!form.sistema?.backupAuto}/>
                          </div>
                      </div>

                      <div className="cfg-card danger-zone-card">
                          <div className="danger-header flex-wrap">
                              <AlertTriangle size={24}/>
                              <div>
                                  <h3 className="m-0">Área Restrita do Administrador</h3>
                                  <p>Ações de banco de dados e recuperação de sistema.</p>
                              </div>
                          </div>
                          <div className="danger-body">
                              <div className="cfg-action-buttons">
                                  <button type="button" className="cfg-btn-action blue" onClick={handleOtimizarBanco}>
                                      <Database size={20}/> <span>Otimizar BD</span>
                                  </button>
                                  <button type="button" className="cfg-btn-action green" onClick={handleBackup}>
                                      <Download size={20}/> <span>Baixar Backup Manual</span>
                                  </button>
                                  <button type="button" className="cfg-btn-action red outline" onClick={() => setShowResetModal(true)}>
                                      <Trash2 size={20}/> <span>Zerar Sistema (Format)</span>
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

          </main>
      </div>
    </div>
  );
};

export default Configuracoes;