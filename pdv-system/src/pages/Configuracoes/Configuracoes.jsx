import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  Store, Save, Upload, Search, Palette,
  FileText, Server, Download, RefreshCw, Trash2,
  Eye, EyeOff, DollarSign, Printer, FileCheck,
  CheckCircle2, AlertTriangle, Moon, Sun, X, Info, Database, AlertCircle,
  QrCode, Check, Menu, TrendingUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Configuracoes.css';

// =========================================================================
// UTILITÁRIOS E SEGURANÇA
// =========================================================================
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

// =========================================================================
// COMPONENTES DE UI ISOLADOS
// =========================================================================
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
                <input type={type} className="cfg-input" value={value !== null && value !== undefined ? value : ''} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled} />
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

// =========================================================================
// PÁGINA PRINCIPAL: CONFIGURAÇÕES
// =========================================================================
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
    loja: { razaoSocial: '', cnpj: '', ie: '', nomeFantasia: '', slogan: '', whatsapp: '', instagram: '', isMatriz: true, logoUrl: '', corDestaque: '#ec4899' },
    endereco: { cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', complemento: '' },
    fiscal: { ambiente: 'HOMOLOGACAO', homologacao: { serie: '', nfe: '', token: '', cscId: '' }, producao: { serie: '', nfe: '', token: '', cscId: '' }, senhaCert: '', regime: '1', naturezaPadrao: '5.102', aliquotaInterna: '', priorizarMonofasico: false, modoContingencia: false },
    financeiro: { fundoTrocoPadrao: 0, alertaSangria: 0, taxaCredito: 0, fechamentoCego: true, pagamentos: { dinheiro: true, pix: true, credito: true, debito: true, crediario: true }, pixTipo: 'CNPJ', pixChave: '' },
    vendas: { imprimirTicketTroca: false, comportamentoCpf: 'PERGUNTAR', bloquearEstoque: true, metaMensal: 0 },
    sistema: { tema: 'light', cancelamentoItem: 'ALERTA', cancelamentoVenda: 'SENHA', nomeTerminal: 'CAIXA 01', imprimirLogoCupom: true, impressaoAuto: true, rodape: '' },
    // Adicionado de forma limpa
    comissoes: { tipoCalculo: 'GERAL', percentualGeral: 0, comissionarSobre: 'LUCRO', descontarTaxasCartao: false }
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

          if (data.loja?.logoUrl) setLogoPreview(`${getBackendUrl()}${data.loja.logoUrl}`);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }, []);

  const updateMask = useCallback((section, field, value, type) => { update(section, field, masks[type](value)); }, [update]);
  const updateMoney = (section, field, value) => { const raw = value.replace(/\D/g, ''); update(section, field, raw ? Number(raw) / 100 : 0); };

  const updateFiscalEnv = (field, value) => {
    const amb = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
    setForm(prev => { setIsDirty(true); return { ...prev, fiscal: { ...prev.fiscal, [amb]: { ...(prev.fiscal[amb] || {}), [field]: value } } }; });
  };

  const handlePayment = (key) => {
    setForm(prev => {
      setIsDirty(true);
      const pag = prev.financeiro?.pagamentos || {};
      return { ...prev, financeiro: { ...prev.financeiro, pagamentos: { ...pag, [key]: !pag[key] } } };
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
        const formData = new FormData(); formData.append('file', logoFile);
        try {
            const respLogo = await api.post('/configuracoes/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
            if (typeof respLogo.data === 'string') finalLogoUrl = respLogo.data;
            setLogoFile(null);
        } catch (e) { toast.warn("Aviso: Logo não atualizada no servidor."); }
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

      const payload = { ...form, loja: { ...form.loja, logoUrl: finalLogoUrl }, fiscal: { ...form.fiscal, senhaCert: '' } };

      if (initialFormState) {
          if (initialFormState.sistema.cancelamentoVenda !== payload.sistema.cancelamentoVenda) await registrarAuditoria('CONFIG_SISTEMA', 'Regra de cancelamento PDV alterada');
          if (initialFormState.financeiro.fechamentoCego !== payload.financeiro.fechamentoCego) await registrarAuditoria('CONFIG_FINANCEIRO', 'Fechamento de caixa alterado');
      }

      const { data: configSalva } = await api.put('/configuracoes', payload);
      const dadosLimpos = sanitizarDados(configSalva);

      const formAtualizado = {
          ...form, ...dadosLimpos,
          loja: { ...form.loja, ...(dadosLimpos.loja || {}) },
          fiscal: { ...form.fiscal, ...(dadosLimpos.fiscal || {}), senhaCert: '' }
      };

      setForm(formAtualizado);
      setInitialFormState(JSON.parse(JSON.stringify(formAtualizado)));
      setIsDirty(false);
      localStorage.removeItem('@dd:config_draft');
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

  const currentEnv = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
  const currentFiscalData = form.fiscal[currentEnv] || { serie: '', nfe: '', token: '', cscId: '' };

  const tabs = [
      { id: 'loja', icon: <Store size={18}/>, label: 'Identidade e Empresa' },
      { id: 'fiscal', icon: <FileText size={18}/>, label: 'Fiscal e Tributos' },
      { id: 'financeiro', icon: <DollarSign size={18}/>, label: 'Caixa e Financeiro' },
      { id: 'vendas', icon: <Printer size={18}/>, label: 'Operação de Vendas' },
      // Adicionado de forma limpa
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
                  {/* Classe para esconder o texto num telemóvel e deixar só o ícone */}
                  <span className="cfg-hide-mobile">{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
          </div>
      </header>

      <div className="cfg-layout">

          {/* NOVIDADE MOBILE: Dropdown Nativo para navegação nas abas */}
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

          {/* SIDEBAR DESKTOP (Escondida no Mobile via CSS) */}
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

              {/* ABA: EMPRESA E IDENTIDADE */}
              {activeTab === 'loja' && (
                  <div className="cfg-panel animate-fade">
                      <h2 className="cfg-panel-title">Informações Públicas</h2>
                      <div className="cfg-card">
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
                              <div className="cfg-card-divider"></div>
                              <div className="cfg-visual-controls">
                                  <Field label="Cor Primária do Sistema" type="color" value={form.loja.corDestaque} onChange={e => update('loja', 'corDestaque', e.target.value)} />
                                  <div className="mt-3"><ToggleSwitch label="Esta Loja é a Matriz" description="Apenas matrizes recebem produtos." checked={form.loja.isMatriz} onChange={e => update('loja', 'isMatriz', e.target.checked)} /></div>
                              </div>
                          </div>
                      </div>

                      <h2 className="cfg-panel-title mt-6">Dados Fiscais e Endereço</h2>
                      <div className="cfg-card">
                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="CNPJ" value={form.loja.cnpj} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} onBlur={searchCNPJ} error={errors['loja.cnpj']} actionIcon={isSearching ? <RefreshCw className="spin" size={18}/> : <Search size={18}/>} onAction={searchCNPJ} placeholder="00.000.000/0000-00" />
                              <Field label="Inscrição Estadual (IE)" value={form.loja.ie} onChange={e => updateMask('loja', 'ie', e.target.value, 'ie')} error={errors['loja.ie']} placeholder="Obrigatório p/ NFC-e" />
                          </div>
                          <div className="mb-4"><Field label="Razão Social (Contrato Social)" value={form.loja.razaoSocial} onChange={e => update('loja', 'razaoSocial', e.target.value)} error={errors['loja.razaoSocial']} /></div>
                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="Nome Fantasia (Aparece no Sistema)" value={form.loja.nomeFantasia} onChange={e => update('loja', 'nomeFantasia', e.target.value)} />
                              <Field label="Slogan / Frase de Impacto" value={form.loja.slogan} onChange={e => update('loja', 'slogan', e.target.value)} />
                          </div>
                          <div className="cfg-grid-col-3 mb-4">
                              <Field label="WhatsApp de Contato" value={form.loja.whatsapp} onChange={e => updateMask('loja', 'whatsapp', e.target.value, 'phone')} placeholder="(81) 90000-0000" />
                              <Field label="Instagram" prefix="@" value={form.loja.instagram} onChange={e => update('loja', 'instagram', e.target.value)} placeholder="sua.loja" />
                              <Field label="CEP" value={form.endereco.cep} onChange={e => updateMask('endereco', 'cep', e.target.value, 'cep')} onBlur={searchCEP} actionIcon={<Search size={18}/>} onAction={searchCEP} placeholder="00000-000" />
                          </div>

                          <div className="cfg-address-grid">
                              <div className="cfg-addr-logradouro"><Field label="Logradouro (Rua/Av)" value={form.endereco.logradouro} onChange={e => update('endereco', 'logradouro', e.target.value)} /></div>
                              <div className="cfg-addr-numero"><Field label="Nº" value={form.endereco.numero} onChange={e => update('endereco', 'numero', e.target.value)} /></div>
                              <div className="cfg-addr-bairro"><Field label="Bairro" value={form.endereco.bairro} onChange={e => update('endereco', 'bairro', e.target.value)} /></div>
                          </div>
                      </div>
                  </div>
              )}

              {/* ABA: FISCAL E SEFAZ */}
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
                              <Field label="Série da NFC-e" value={currentFiscalData.serie || ""} onChange={e => updateFiscalEnv('serie', clean(e.target.value))} placeholder="Normalmente: 1" />
                              <Field label="Próximo Número (NFC-e)" value={currentFiscalData.nfe || ""} onChange={e => updateFiscalEnv('nfe', clean(e.target.value))} placeholder="Ex: 1500" />
                              <Field label="Alíquota ICMS do Estado" suffix="%" value={form.fiscal.aliquotaInterna || ""} onChange={e => update('fiscal', 'aliquotaInterna', e.target.value)} placeholder="Ex: 18 ou 20.5" />
                          </div>

                          <div className="cfg-grid-col-2">
                              <Field label="Token CSC (Código de Segurança)" type="password" value={currentFiscalData.token} onChange={e => updateFiscalEnv('token', e.target.value)} placeholder="Fornecido pela sua contabilidade" />
                              <Field label="ID do CSC" value={currentFiscalData.cscId} onChange={e => updateFiscalEnv('cscId', clean(e.target.value))} placeholder="Ex: 1 ou 2" />
                          </div>
                      </div>
                  </div>
              )}

              {/* ABA: FINANCEIRO E CAIXA */}
              {activeTab === 'financeiro' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Operação Financeira</h2>
                      <div className="cfg-card">
                          <div className="cfg-grid-col-3 mb-5">
                              <Field label="Fundo de Troco Fixo" prefix="R$" value={formatMoney(form.financeiro.fundoTrocoPadrao)} onChange={e => updateMoney('financeiro', 'fundoTrocoPadrao', e.target.value)} placeholder="0,00" />
                              <Field label="Alerta Sangria (Teto da Gaveta)" prefix="R$" value={formatMoney(form.financeiro.alertaSangria)} onChange={e => updateMoney('financeiro', 'alertaSangria', e.target.value)} placeholder="0,00" />
                              <Field label="Taxa Média Crédito" suffix="%" value={form.financeiro.taxaCredito} onChange={e => update('financeiro', 'taxaCredito', e.target.value)} placeholder="Para cálculo de lucro" />
                          </div>

                          <div className="cfg-highlight-box border-red mb-5">
                              <ToggleSwitch label="Fechamento de Caixa Cego (Anti-Fraude)" description="Obriga o operador a contar as notas às cegas. Evita que ele retire as sobras." checked={form.financeiro.fechamentoCego} onChange={e => update('financeiro', 'fechamentoCego', e.target.checked)} danger />
                          </div>

                          <h3 className="cfg-card-title border-bottom pb-2 mb-4">Meios de Pagamento Aceitos</h3>
                          <div className="cfg-payment-grid mb-4">
                              {[
                                  {id: 'dinheiro', icon: <DollarSign size={20}/>, label: 'Dinheiro'},
                                  {id: 'pix', icon: <QrCode size={20}/>, label: 'PIX Direto'},
                                  {id: 'credito', icon: <Printer size={20}/>, label: 'Cartão Crédito'},
                                  {id: 'debito', icon: <Printer size={20}/>, label: 'Cartão Débito'},
                                  {id: 'crediario', icon: <FileText size={20}/>, label: 'Fiado / Crediário'}
                              ].map(metodo => (
                                  <button key={metodo.id} className={`cfg-pay-card ${form.financeiro.pagamentos?.[metodo.id] ? 'active' : ''}`} onClick={() => handlePayment(metodo.id)}>
                                      <div className="pay-check">{form.financeiro.pagamentos?.[metodo.id] && <Check size={14}/>}</div>
                                      {metodo.icon} <span>{metodo.label}</span>
                                  </button>
                              ))}
                          </div>

                          {form.financeiro.pagamentos?.pix && (
                              <div className="cfg-highlight-box border-blue fade-in">
                                  <h4 className="mb-3 text-blue">Configuração da Chave PIX (QR Code Tela)</h4>
                                  <div className="cfg-grid-col-2">
                                      <Field label="Tipo de Chave" type="select" value={form.financeiro.pixTipo || "CNPJ"} onChange={e => update('financeiro', 'pixTipo', e.target.value)} options={[ { value: 'CNPJ', label: 'CNPJ' }, { value: 'CELULAR', label: 'Celular' }, { value: 'ALEATORIA', label: 'Chave Aleatória' }, { value: 'EMAIL', label: 'E-mail' } ]} />
                                      <Field label="A sua Chave PIX" value={form.financeiro.pixChave} onChange={e => update('financeiro', 'pixChave', e.target.value)} placeholder="Cole a chave aqui" />
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* ABA: VENDAS */}
              {activeTab === 'vendas' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Operação e Metas (PDV)</h2>
                      <div className="cfg-card">

                          <div className="cfg-highlight-box border-blue mb-5">
                              <h4 className="mb-3 text-blue">Termômetro do Dashboard</h4>
                              <div className="cfg-grid-col-2 items-center">
                                  <Field
                                      label="Meta de Faturamento Mensal (Loja Física)"
                                      prefix="R$"
                                      value={formatMoney(form.vendas.metaMensal)}
                                      onChange={e => updateMoney('vendas', 'metaMensal', e.target.value)}
                                      placeholder="Ex: 50.000,00"
                                  />
                                  <div className="cfg-info-msg m-0-mobile">
                                      <Info size={16}/> <span>Este valor será usado no painel inicial para calcular se a loja está a bater as metas.</span>
                                  </div>
                              </div>
                          </div>

                          <div className="cfg-grid-col-2 mb-5">
                              <ToggleSwitch label="Impressão Automática" description="Dispara a bobina assim que o pagamento for confirmado." checked={form.sistema.impressaoAuto} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)} />
                              <ToggleSwitch label="Emitir Ticket de Troca" description="Imprime uma via extra sem valores." checked={form.vendas.imprimirTicketTroca} onChange={e => update('vendas', 'imprimirTicketTroca', e.target.checked)} />
                          </div>

                          <div className="cfg-card-divider mb-5"></div>

                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="Tamanho da Impressora (Bobina)" type="select" value={form.sistema.larguraPapel || "80mm"} onChange={e => update('sistema', 'larguraPapel', e.target.value)} options={[ { value: '80mm', label: '80mm (Lojas/Supermercado)' }, { value: '58mm', label: '58mm (Mini Bluetooth)' } ]} />
                              <Field label="Identificar Cliente na Venda (CPF)" type="select" value={form.vendas.comportamentoCpf || "PERGUNTAR"} onChange={e => update('vendas', 'comportamentoCpf', e.target.value)} options={[ { value: 'PERGUNTAR', label: 'Sugerir (Abre Modal Fidelidade)' }, { value: 'SEMPRE', label: 'Obrigatório (Trava a Venda)' }, { value: 'NUNCA', label: 'Não Sugerir' } ]} />
                          </div>

                          <div className="cfg-highlight-box border-red mb-5">
                              <ToggleSwitch label="Trava de Ruptura (Venda Negativa)" description="Se o estoque estiver zerado, o sistema não deixa passar o produto no caixa." checked={form.vendas.bloquearEstoque} onChange={e => update('vendas', 'bloquearEstoque', e.target.checked)} danger />
                          </div>

                          <Field label="Mensagem no Rodapé do Cupom" type="textarea" value={form.sistema.rodape} onChange={e => update('sistema', 'rodape', e.target.value)} placeholder="Ex: Volte Sempre! Trocas apenas com etiqueta em até 7 dias." />
                      </div>
                  </div>
              )}

              {/* ABA: COMISSÕES (INSERIDA DE FORMA LIMPA) */}
              {activeTab === 'comissoes' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Regras de Comissionamento</h2>
                      <div className="cfg-card">
                          <div className="cfg-grid-col-2 mb-5">
                              <div className="cfg-highlight-box border-blue">
                                  <Field
                                      label="Tipo de Cálculo"
                                      type="select"
                                      value={form.comissoes?.tipoCalculo || 'GERAL'}
                                      onChange={e => update('comissoes', 'tipoCalculo', e.target.value)}
                                      options={[
                                          { value: 'GERAL', label: 'Percentual Fixo (Loja Toda)' },
                                          { value: 'CATEGORIA', label: 'Por Categoria/Produto' }
                                      ]}
                                  />
                                  {form.comissoes?.tipoCalculo === 'GERAL' && (
                                      <div className="mt-3">
                                          <Field label="Percentual (%)" suffix="%" value={form.comissoes?.percentualGeral || 0} onChange={e => update('comissoes', 'percentualGeral', e.target.value)} />
                                      </div>
                                  )}
                              </div>

                              <div className="cfg-highlight-box border-blue">
                                  <Field
                                      label="Base de Cálculo"
                                      type="select"
                                      value={form.comissoes?.comissionarSobre || 'LUCRO'}
                                      onChange={e => update('comissoes', 'comissionarSobre', e.target.value)}
                                      options={[
                                          { value: 'TOTAL_VENDA', label: 'Sobre Valor Total da Venda' },
                                          { value: 'LUCRO', label: 'Sobre o Lucro (Venda - Custo)' }
                                      ]}
                                  />
                              </div>
                          </div>

                          <ToggleSwitch
                              label="Descontar Taxas de Cartão"
                              description="Deduzir taxas financeiras antes de calcular a comissão."
                              checked={form.comissoes?.descontarTaxasCartao}
                              onChange={e => update('comissoes', 'descontarTaxasCartao', e.target.checked)}
                          />
                      </div>
                  </div>
              )}

              {/* ABA: SISTEMA */}
              {activeTab === 'sistema' && (
                  <div className="tab-pane animate-slide-left">
                      <h2 className="cfg-panel-title">Manutenção e Permissões</h2>
                      <div className="cfg-card mb-5">
                          <div className="cfg-grid-col-2 mb-4">
                              <Field label="Nome do Terminal Atual" value={form.sistema?.nomeTerminal} onChange={e => update('sistema', 'nomeTerminal', e.target.value)} placeholder="Ex: CAIXA PRINCIPAL" />
                              <div className="pt-2"><ToggleSwitch label="Imprimir Logo no Cupom Físico" checked={form.sistema?.imprimirLogoCupom} onChange={e => update('sistema', 'imprimirLogoCupom', e.target.checked)} /></div>
                          </div>

                          <h3 className="cfg-card-title border-bottom pb-2 mb-4 mt-2">Níveis de Permissão no Balcão</h3>
                          <div className="cfg-grid-col-2">
                              <div className="cfg-highlight-box border-blue">
                                  <Field label="Remover 1 ITEM do Carrinho" type="select" value={form.sistema?.cancelamentoItem || "ALERTA"} onChange={e => update('sistema', 'cancelamentoItem', e.target.value)} options={[ { value: 'ALERTA', label: 'Livre p/ o Operador' }, { value: 'SENHA', label: 'Exigir Senha Gerencial' } ]} />
                              </div>
                              <div className="cfg-highlight-box border-red">
                                  <Field label="Cancelar a VENDA INTEIRA" type="select" value={form.sistema?.cancelamentoVenda || "SENHA"} onChange={e => update('sistema', 'cancelamentoVenda', e.target.value)} options={[ { value: 'SENHA', label: 'Exigir Senha Gerencial (Recomendado)' }, { value: 'ALERTA', label: 'Livre p/ o Operador (Risco)' } ]} />
                              </div>
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
                                      <Download size={20}/> <span>Baixar Backup</span>
                                  </button>
                                  <button type="button" className="cfg-btn-action red outline" onClick={() => setShowResetModal(true)}>
                                      <Trash2 size={20}/> <span>Zerar Sistema</span>
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