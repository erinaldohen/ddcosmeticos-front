import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
  Store, Save, Upload, Search, MapPin, Palette,
  Building, FileText, Server, Download, RefreshCw, Trash2,
  Lock, Eye, EyeOff, DollarSign, Printer, FileCheck,
  CheckCircle2, AlertTriangle, Briefcase, Calculator,
  ShieldCheck, Moon, Sun, X, Check, Info, Database, AlertCircle, QrCode
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Configuracoes.css';

// =========================================================================
// UTILITÁRIOS E SEGURANÇA
// =========================================================================
const clean = (v) => v ? v.replace(/\D/g, '') : '';

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
const formatMoney = (value) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const masks = {
  cnpj: (v) => clean(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').substr(0, 18),
  cep: (v) => clean(v).replace(/^(\d{5})(\d{3})/, '$1-$2').substr(0, 9),
  phone: (v) => {
    let r = clean(v);
    if (r.length > 10) r = r.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (r.length > 5) r = r.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return r.substr(0, 15);
  },
  ie: (v) => clean(v).substr(0, 9),
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
    <div className="field-group">
        <label className="field-label">{label}</label>
        <div className={`field-input-wrapper ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
            {prefix && <span className="field-addon prefix">{prefix}</span>}
            {type === 'select' ? (
                <select className="field-input" value={value || ''} onChange={onChange} onBlur={onBlur} disabled={disabled}>
                    {options.map((opt, idx) => <option key={idx} value={opt.value}>{opt.label}</option>)}
                </select>
            ) : type === 'textarea' ? (
                <textarea className="field-input textarea" value={value || ''} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled} rows="3"></textarea>
            ) : (
                <input type={type} className="field-input" value={value !== null && value !== undefined ? value : ''} onChange={onChange} onBlur={onBlur} placeholder={placeholder} disabled={disabled} />
            )}
            {suffix && <span className="field-addon suffix">{suffix}</span>}
            {actionIcon && <button type="button" className="field-action-btn" onClick={onAction} disabled={disabled}>{actionIcon}</button>}
        </div>
        {error && <span className="field-error-text">{error}</span>}
    </div>
));

const ToggleSwitch = ({ label, description, checked, onChange, danger }) => (
    <div className={`toggle-wrapper ${danger ? 'danger-zone' : ''}`}>
        <div className="toggle-info">
            <strong className={danger ? 'text-danger' : ''}>{label}</strong>
            {description && <p>{description}</p>}
        </div>
        <label className="switch-control">
            <input type="checkbox" checked={checked} onChange={onChange} />
            <span className={`slider-ui ${danger ? 'danger' : ''}`}></span>
        </label>
    </div>
);

const DangerModal = ({ isOpen, onClose, onConfirm, keyword }) => {
    const [input, setInput] = useState('');
    if (!isOpen) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content border-danger">
                <header className="modal-header text-danger">
                    <div className="flex-row"><AlertTriangle size={24}/> <h2>Zona de Risco</h2></div>
                    <button onClick={onClose} className="btn-icon"><X size={20}/></button>
                </header>
                <div className="modal-body">
                    <p>Esta ação apagará as configurações do sistema e <strong>não pode ser desfeita</strong>.</p>
                    <p>Digite <strong className="highlight-text">{keyword}</strong> para confirmar:</p>
                    <input type="text" className="input-danger-confirm" value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder={keyword} />
                </div>
                <footer className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="btn-confirm-danger" disabled={input !== keyword} onClick={() => { onConfirm(); setInput(''); }}>Executar Formatação</button>
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
    loja: { razaoSocial: '', cnpj: '', ie: '', isMatriz: true, logoUrl: '', corDestaque: '#ec4899' },
    endereco: { cep: '' },
    fiscal: { ambiente: 'HOMOLOGACAO', homologacao: {}, producao: {}, senhaCert: '' },
    financeiro: {}, vendas: {},
    sistema: { tema: 'light', cancelamentoItem: 'ALERTA', cancelamentoVenda: 'SENHA', nomeTerminal: 'CAIXA 01', imprimirLogoCupom: true }
  };

  const [form, setForm] = useState(baseForm);
  const [initialFormState, setInitialFormState] = useState(null);

  // --- EFEITO: CARREGAMENTO INICIAL E RASCUNHOS ---
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
              sistema: { ...baseForm.sistema, ...(dadosLimpos.sistema || {}) }
          };
          setForm(formMontado);
          setInitialFormState(JSON.parse(JSON.stringify(formMontado)));

          if (data.loja?.logoUrl) setLogoPreview(`${getBackendUrl()}${data.loja.logoUrl}`);

          if (data.fiscal?.caminhoCertificado) {
              setCertData({ validade: data.fiscal.validadeCertificado || "Instalado e Ativo", diasRestantes: data.fiscal.diasRestantes || 365 });
          }

          const draft = localStorage.getItem('@dd:config_draft');
          if (draft) setHasDraft(true);
        }
      } catch (error) { toast.error("Falha ao carregar configurações do banco de dados."); }
      finally { setIsLoading(false); }
    };
    loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- EFEITOS DE PROTEÇÃO (BeforeUnload e Rascunho) ---
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

  // --- HANDLERS DE ATUALIZAÇÃO DO STATE ---
  const update = useCallback((section, field, value) => {
    setIsDirty(true); setErrors(prev => ({ ...prev, [`${section}.${field}`]: null }));
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }, []);

  const updateMask = useCallback((section, field, value, type) => { update(section, field, masks[type](value)); }, [update]);
  const updateMoney = (section, field, value) => { const raw = value.replace(/\D/g, ''); update(section, field, (Number(raw) / 100).toFixed(2)); };

  const updateFiscalEnv = (field, value) => {
    const amb = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
    setForm(prev => { setIsDirty(true); return { ...prev, fiscal: { ...prev.fiscal, [amb]: { ...(prev.fiscal[amb] || {}), [field]: value } } }; });
  };

  const handlePayment = (key) => {
    setForm(prev => {
      setIsDirty(true); const pag = prev.financeiro?.pagamentos || {};
      return { ...prev, financeiro: { ...prev.financeiro, pagamentos: { ...pag, [key]: !pag[key] } } };
    });
  };

  // --- CONSULTAS API (CNPJ E CEP) ---
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

  // --- SALVAMENTO E SEGURANÇA ---
  const handleSave = async () => {
    const newErrs = {};
    if (!form.loja.razaoSocial) newErrs['loja.razaoSocial'] = 'Obrigatório';
    if (form.loja.cnpj && !form.loja.ie) newErrs['loja.ie'] = 'Obrigatório p/ Nota Fiscal';

    if (Object.keys(newErrs).length > 0) {
        setErrors(newErrs);
        setActiveTab('loja');
        return toast.error("Verifique os campos obrigatórios na aba Empresa.");
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
             return toast.error("A senha do Certificado é obrigatória para instalação.");
         }

         const formData = new FormData();
         formData.append('file', certFile);
         formData.append('senha', form.fiscal.senhaCert);

         try {
             const certResp = await api.post('/configuracoes/certificado', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
             if (certResp.data && certResp.data.diasRestantes !== undefined) {
                 setCertData({ validade: certResp.data.validade || "Instalado", diasRestantes: certResp.data.diasRestantes });
             } else {
                 setCertData({ validade: "Instalado e Ativo", diasRestantes: 365 });
             }
             setCertFile(null);
             form.fiscal.senhaCert = ''; // Destrói a senha da memória
         } catch (e) {
             setIsSaving(false); setActiveTab('fiscal');
             return toast.error("Falha: Senha incorreta ou arquivo PFX corrompido.");
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
      toast.success("Configurações salvas com sucesso!");

    } catch (error) { toast.error("Erro Crítico: Falha ao salvar os dados."); }
    finally { setIsSaving(false); }
  };

  const handleOtimizarBanco = async () => {
      const toastId = toast.loading("Otimizando banco de dados...");
      try { await api.post('/configuracoes/manutencao/otimizar'); toast.update(toastId, { render: "Banco otimizado!", type: "success", isLoading: false, autoClose: 3000 }); } catch (e) { toast.update(toastId, { render: "Falha ao otimizar banco.", type: "error", isLoading: false, autoClose: 3000 }); }
  };
  const handleLimparCache = () => { localStorage.clear(); sessionStorage.clear(); window.location.reload(true); };
  const handleBackup = async () => {
      const toastId = toast.loading("Gerando arquivo de Backup...");
      try {
          const response = await api.get('/configuracoes/manutencao/backup', { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a'); link.href = url;
          link.setAttribute('download', `ddcosmeticos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
          document.body.appendChild(link); link.click(); link.remove();
          toast.update(toastId, { render: "Download iniciado!", type: "success", isLoading: false, autoClose: 3000 });
      } catch (e) { toast.update(toastId, { render: "Erro de permissão no backup.", type: "error", isLoading: false, autoClose: 3000 }); }
  };
  const executeFactoryReset = async () => {
      setShowResetModal(false);
      const toastId = toast.loading("Apagando sistema...");
      try {
          await api.post('/configuracoes/manutencao/reset');
          toast.update(toastId, { render: "Sistema formatado. Reiniciando...", type: "success", isLoading: false, autoClose: 3000 });
          setTimeout(() => window.location.reload(true), 2000);
      } catch (e) { toast.update(toastId, { render: "Acesso negado para formatar banco.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  if (isLoading) return <div className="setup-loader"><RefreshCw className="spin" size={40} /><h3>Carregando Sistema...</h3></div>;

  const currentEnv = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
  const currentFiscalData = form.fiscal[currentEnv] || { serie: '', nfe: '', token: '', cscId: '' };

  const tabs = [
      { id: 'loja', icon: <Store size={18}/>, label: 'Identidade e Empresa' },
      { id: 'fiscal', icon: <FileText size={18}/>, label: 'Fiscal e Tributos' },
      { id: 'financeiro', icon: <DollarSign size={18}/>, label: 'Caixa e Financeiro' },
      { id: 'vendas', icon: <Printer size={18}/>, label: 'Operação de Vendas' },
      { id: 'sistema', icon: <Server size={18}/>, label: 'Sistema e Segurança' },
  ];

  return (
    <div className="container-fluid">
      <DangerModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} onConfirm={executeFactoryReset} keyword="CONFIRMAR" />

      {hasDraft && (
          <div className="draft-banner">
              <div className="flex-row"><AlertCircle size={18}/> <span>Recuperamos um rascunho não salvo.</span></div>
              <div className="flex-row gap-3"><button className="btn-link" onClick={discardDraft}>Descartar</button><button className="btn-solid-small" onClick={restoreDraft}>Restaurar</button></div>
          </div>
      )}

      <header className="config-topbar">
          <div className="topbar-title">
              <h1>Configurações Globais</h1>
              {isDirty && <span className="badge-dirty">Modificações não salvas</span>}
          </div>
          <div className="topbar-actions">
              <button className="btn-icon-mode" onClick={() => update('sistema', 'tema', form.sistema.tema === 'light' ? 'dark' : 'light')}>
                  {form.sistema.tema === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
              </button>
              <button className="btn-save-master" onClick={handleSave} disabled={isSaving || (!isDirty && !logoFile && !certFile)}>
                  {isSaving ? <RefreshCw className="spin" size={18}/> : <Save size={18}/>}
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
          </div>
      </header>

      <div className="config-body">
          {/* SIDEBAR COM ABAS VERTICAIS */}
          <aside className="config-sidebar">
              <nav className="toc-menu">
                  {tabs.map(tab => (
                      <button key={tab.id} className={`toc-link ${activeTab === tab.id ? 'active' : ''} ${Object.keys(errors).some(k => k.startsWith(tab.id)) ? 'has-error' : ''}`} onClick={() => setActiveTab(tab.id)}>
                          <div className="toc-content">{tab.icon} <span>{tab.label}</span></div>
                      </button>
                  ))}
              </nav>
          </aside>

          {/* CONTEÚDO PRINCIPAL (Exibe apenas a aba ativa) */}
          <main className={`config-content ${isSaving ? 'is-saving' : ''}`}>

              {/* === ABA: LOJA === */}
              {activeTab === 'loja' && (
                  <div className="tab-pane fade-in">
                      <div className="section-header">
                          <h2>Identidade e Empresa</h2>
                          <p>Dados vitais que aparecem para os clientes e na contabilidade.</p>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-body grid-col-2">
                              <div className="logo-upload-box">
                                  <div className="logo-preview">{logoPreview ? <img src={logoPreview} alt="Logo"/> : <Store size={40} color="#cbd5e1"/>}</div>
                                  <div className="logo-actions">
                                      <label className="btn-upload"><Upload size={16}/> {logoFile ? "Trocar Fila" : "Mudar Logo"}<input type="file" hidden accept="image/*" onChange={(e) => { if(e.target.files[0]) { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])); setIsDirty(true); } }}/></label>
                                      {(logoPreview || logoFile) && <button className="btn-remove-link" onClick={() => {setLogoPreview(null); setLogoFile(null); update('loja', 'logoUrl', '');}}>Remover Imagem</button>}
                                  </div>
                              </div>
                              <div className="visual-settings">
                                  <Field label="Cor Primária do Sistema" type="color" value={form.loja.corDestaque || "#ec4899"} onChange={e => update('loja', 'corDestaque', e.target.value)} />
                                  <ToggleSwitch label="Esta Loja é Matriz" description="Sincroniza produtos com filiais" checked={form.loja.isMatriz} onChange={e => update('loja', 'isMatriz', e.target.checked)} />
                              </div>
                          </div>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-body">
                              <div className="grid-col-2">
                                  <Field label="CNPJ" value={form.loja.cnpj} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} onBlur={searchCNPJ} error={errors['loja.cnpj']} actionIcon={isSearching ? <RefreshCw className="spin" size={16}/> : <Search size={16}/>} onAction={searchCNPJ} />
                                  <Field label="Inscrição Estadual (I.E.)" value={form.loja.ie} onChange={e => updateMask('loja', 'ie', e.target.value, 'ie')} error={errors['loja.ie']} />
                              </div>
                              <Field label="Razão Social (Fiscal)" value={form.loja.razaoSocial} onChange={e => update('loja', 'razaoSocial', e.target.value)} error={errors['loja.razaoSocial']} />
                              <div className="grid-col-2">
                                  <Field label="Nome Fantasia" value={form.loja.nomeFantasia} onChange={e => update('loja', 'nomeFantasia', e.target.value)} />
                                  <Field label="Slogan / Frase" value={form.loja.slogan} onChange={e => update('loja', 'slogan', e.target.value)} />
                              </div>
                              <div className="grid-col-3">
                                  <Field label="WhatsApp" value={form.loja.whatsapp} onChange={e => updateMask('loja', 'whatsapp', e.target.value, 'phone')} />
                                  <Field label="Instagram" prefix="@" value={form.loja.instagram} onChange={e => update('loja', 'instagram', e.target.value)} />
                                  <Field label="CEP" value={form.endereco.cep} onChange={e => updateMask('endereco', 'cep', e.target.value, 'cep')} onBlur={searchCEP} actionIcon={<Search size={16}/>} onAction={searchCEP} />
                              </div>
                              <div className="grid-col-4 mt-2">
                                  <div style={{gridColumn: 'span 2'}}><Field label="Logradouro" value={form.endereco.logradouro} onChange={e => update('endereco', 'logradouro', e.target.value)} /></div>
                                  <Field label="Número" value={form.endereco.numero} onChange={e => update('endereco', 'numero', e.target.value)} />
                                  <Field label="Bairro" value={form.endereco.bairro} onChange={e => update('endereco', 'bairro', e.target.value)} />
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* === ABA: FISCAL === */}
              {activeTab === 'fiscal' && (
                  <div className="tab-pane fade-in">
                      <div className="section-header">
                          <h2>Segurança Fiscal e Tributos</h2>
                          <p>Certificados e comunicação direta com a SEFAZ.</p>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-body grid-col-2">
                              <div className="cert-status-area">
                                  {certData.validade ? (
                                      <div className={`cert-badge ${certData.diasRestantes < 30 ? 'is-warning' : 'is-success'}`}>
                                          <CheckCircle2 size={24} />
                                          <div className="cert-info-text">
                                              <strong>Certificado Instalado</strong>
                                              <span>{certData.validade} • Restam {certData.diasRestantes} dias</span>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="cert-badge is-empty"><FileCheck size={24} /><div className="cert-info-text"><strong>Sem Certificado</strong><span>Emissão bloqueada</span></div></div>
                                  )}
                                  <label className="btn-upload mt-2"><Upload size={16}/> {certFile ? 'Na Fila de Upload' : 'Carregar .PFX'}<input type="file" hidden accept=".pfx,.p12" onChange={(e) => { if(e.target.files[0]) { setCertFile(e.target.files[0]); setIsDirty(true); toast.info("Certificado carregado. Digite a senha ao lado."); } }}/></label>
                              </div>
                              <div className="cert-auth-area">
                                  <Field label="Senha do Certificado" type={showToken ? "text" : "password"} value={form.fiscal.senhaCert} onChange={e => update('fiscal', 'senhaCert', e.target.value)} actionIcon={showToken ? <EyeOff size={16}/> : <Eye size={16}/>} onAction={() => setShowToken(!showToken)} placeholder="Obrigatório para instalar" />
                                  <div className="mt-4"><ToggleSwitch label="Contingência Offline Automática" description="Gera nota sem internet e envia depois." checked={form.fiscal.modoContingencia} onChange={e => update('fiscal', 'modoContingencia', e.target.checked)} danger /></div>
                              </div>
                          </div>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-header flex-between">
                              <div className="flex-row"><Server size={18}/> <h3 style={{margin:0, fontSize:'1rem'}}>Parâmetros da SEFAZ</h3></div>
                              <div className="env-pill-selector">
                                  <button className={form.fiscal.ambiente === 'HOMOLOGACAO' ? 'active warn' : ''} onClick={() => update('fiscal', 'ambiente', 'HOMOLOGACAO')}>Homologação</button>
                                  <button className={form.fiscal.ambiente === 'PRODUCAO' ? 'active succ' : ''} onClick={() => update('fiscal', 'ambiente', 'PRODUCAO')}>Produção Real</button>
                              </div>
                          </div>
                          {form.fiscal.ambiente === 'PRODUCAO' && <div className="alert-box danger"><AlertTriangle size={18}/> As notas emitidas terão validade jurídica e tributária.</div>}
                          <div className="card-body">
                              <div className="grid-col-2">
                                  <Field label="Regime Tributário" type="select" value={form.fiscal.regime || "1"} onChange={e => update('fiscal', 'regime', e.target.value)} options={[ { value: '1', label: 'Simples Nacional' }, { value: '3', label: 'Regime Normal' } ]} />
                                  <Field label="CFOP Base" type="select" value={form.fiscal.naturezaPadrao || "5.102"} onChange={e => update('fiscal', 'naturezaPadrao', e.target.value)} options={[ { value: '5.102', label: '5.102 - Venda Comum' }, { value: '5.405', label: '5.405 - Venda c/ ST' } ]} />
                              </div>

                              <div className="grid-col-3 mt-2">
                                  <Field label="Série NFC-e (Padrão: 1)" value={currentFiscalData.serie || ""} onChange={e => updateFiscalEnv('serie', clean(e.target.value))} placeholder="Ex: 1" />
                                  <Field label="Nº da Próxima Nota" value={currentFiscalData.nfe || ""} onChange={e => updateFiscalEnv('nfe', clean(e.target.value))} placeholder="Ex: 1541" />
                                  <Field label="Alíquota ICMS Padrão" suffix="%" value={form.fiscal.aliquotaInterna || ""} onChange={e => update('fiscal', 'aliquotaInterna', e.target.value)} />
                              </div>

                              {form.fiscal.ambiente === 'PRODUCAO' && (
                                  <p className="helper-text mt-1 mb-2" style={{ color: '#d97706', fontWeight: '500' }}>
                                      <Info size={14} style={{display:'inline', marginBottom:'-2px', marginRight: '4px'}}/>
                                      Migrando de outro sistema? Informe o número da <strong>Próxima Nota</strong> acima para evitar erro de duplicidade. O PDV somará +1 automaticamente.
                                  </p>
                              )}

                              <div className="grid-col-2 mt-4">
                                  <Field label="Token CSC" type="password" value={currentFiscalData.token} onChange={e => updateFiscalEnv('token', e.target.value)} />
                                  <Field label="ID CSC" value={currentFiscalData.cscId} onChange={e => updateFiscalEnv('cscId', e.target.value)} />
                              </div>

                              <div className="feature-block border-blue mt-4">
                                  <ToggleSwitch label="Segregar Imposto Monofásico" description="Reduz pagamento do DAS sobre perfumes e cosméticos." checked={form.fiscal.priorizarMonofasico} onChange={e => update('fiscal', 'priorizarMonofasico', e.target.checked)} />
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* === ABA: FINANCEIRO === */}
              {activeTab === 'financeiro' && (
                  <div className="tab-pane fade-in">
                      <div className="section-header">
                          <h2>Caixa e Financeiro</h2>
                          <p>Taxas de maquininha, PIX e regras da gaveta de dinheiro.</p>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-body">
                              <div className="grid-col-3">
                                  <Field label="Fundo de Troco Fixo" prefix="R$" value={formatMoney(form.financeiro.fundoTrocoPadrao)} onChange={e => updateMoney('financeiro', 'fundoTrocoPadrao', e.target.value)} />
                                  <Field label="Alerta de Sangria" prefix="R$" value={formatMoney(form.financeiro.alertaSangria)} onChange={e => updateMoney('financeiro', 'alertaSangria', e.target.value)} />
                                  <Field label="Taxa Crédito (Loja)" suffix="%" value={form.financeiro.taxaCredito} onChange={e => update('financeiro', 'taxaCredito', e.target.value)} />
                              </div>

                              <div className="mt-4"><ToggleSwitch label="Fechamento de Caixa Cego" description="Impede fraudes obrigando o operador a contar o dinheiro físico sem ver o saldo do sistema." checked={form.financeiro.fechamentoCego} onChange={e => update('financeiro', 'fechamentoCego', e.target.checked)} danger /></div>

                              <h4 className="sub-heading mt-4">Meios de Pagamento</h4>
                              <div className="payment-pills mb-2">
                                  {['dinheiro', 'pix', 'credito', 'debito', 'crediario'].map(key => (
                                      <button key={key} className={`pill-btn ${form.financeiro.pagamentos?.[key] ? 'active' : ''}`} onClick={() => handlePayment(key)}>
                                          {form.financeiro.pagamentos?.[key] && <CheckCircle2 size={16}/>} {key}
                                      </button>
                                  ))}
                              </div>

                              {form.financeiro.pagamentos?.pix && (
                                  <div className="feature-block border-amber mt-2">
                                      <div className="grid-col-2">
                                          <Field label="Tipo da Chave PIX" type="select" value={form.financeiro.pixTipo || "CNPJ"} onChange={e => update('financeiro', 'pixTipo', e.target.value)} options={[ { value: 'CNPJ', label: 'CNPJ da Empresa' }, { value: 'CELULAR', label: 'Celular' }, { value: 'ALEATORIA', label: 'Aleatória' } ]} />
                                          <Field label="Código PIX" value={form.financeiro.pixChave} onChange={e => update('financeiro', 'pixChave', e.target.value)} />
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}

              {/* === ABA: VENDAS === */}
              {activeTab === 'vendas' && (
                  <div className="tab-pane fade-in">
                      <div className="section-header">
                          <h2>Operação de Vendas e PDV</h2>
                          <p>Comportamento de tela e layout de impressão do cupom.</p>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-body">
                              <div className="grid-col-2">
                                  <ToggleSwitch label="Imprimir Cupom Automático" checked={form.sistema.impressaoAuto} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)} />
                                  <ToggleSwitch label="Imprimir Ticket de Troca" checked={form.vendas.imprimirTicketTroca} onChange={e => update('vendas', 'imprimirTicketTroca', e.target.checked)} />
                              </div>
                              <div className="grid-col-2 mt-4">
                                  <Field label="Bobina de Papel" type="select" value={form.sistema.larguraPapel} onChange={e => update('sistema', 'larguraPapel', e.target.value)} options={[ { value: '80mm', label: '80mm Padrão de Supermercado' }, { value: '58mm', label: '58mm Compacta' } ]} />
                                  <Field label="Exigência de CPF na Venda" type="select" value={form.vendas.comportamentoCpf} onChange={e => update('vendas', 'comportamentoCpf', e.target.value)} options={[ { value: 'PERGUNTAR', label: 'Avisar Caixa para Perguntar' }, { value: 'SEMPRE', label: 'Bloquear e Exigir Sempre' }, { value: 'NUNCA', label: 'Não Solicitar' } ]} />
                              </div>

                              <div className="mt-4"><ToggleSwitch label="Bloquear Venda Negativa" description="Impede a venda se o sistema acusar saldo zero do produto." checked={form.vendas.bloquearEstoque} onChange={e => update('vendas', 'bloquearEstoque', e.target.checked)} danger /></div>

                              <div className="mt-4"><Field label="Texto Promocional (Fim do cupom)" type="textarea" value={form.sistema.rodape} onChange={e => update('sistema', 'rodape', e.target.value)} /></div>
                          </div>
                      </div>
                  </div>
              )}

              {/* === ABA: SISTEMA === */}
              {activeTab === 'sistema' && (
                  <div className="tab-pane fade-in">
                      <div className="section-header">
                          <h2>Sistema e Manutenção</h2>
                          <p>Segurança antifraude e limpeza de banco de dados.</p>
                      </div>

                      <div className="config-card mb-4">
                          <div className="card-body">
                              <div className="grid-col-2">
                                  <Field label="Identificação do Terminal" value={form.sistema?.nomeTerminal} onChange={e => update('sistema', 'nomeTerminal', e.target.value)} placeholder="Ex: CAIXA PRINCIPAL" />
                                  <div className="pt-4"><ToggleSwitch label="Injetar Logo no Topo do Cupom" checked={form.sistema?.imprimirLogoCupom} onChange={e => update('sistema', 'imprimirLogoCupom', e.target.checked)} /></div>
                              </div>

                              <h4 className="sub-heading mt-4">Políticas Antifraude de Caixa</h4>
                              <div className="grid-col-2">
                                  <div className="feature-block border-blue">
                                      <Field label="Cancelar 1 ITEM da Venda" type="select" value={form.sistema?.cancelamentoItem || "ALERTA"} onChange={e => update('sistema', 'cancelamentoItem', e.target.value)} options={[ { value: 'ALERTA', label: 'Livre p/ Caixa' }, { value: 'SENHA', label: 'Exigir Senha' } ]} />
                                  </div>
                                  <div className="feature-block border-red">
                                      <Field label="Cancelar VENDA TOTAL" type="select" value={form.sistema?.cancelamentoVenda || "SENHA"} onChange={e => update('sistema', 'cancelamentoVenda', e.target.value)} options={[ { value: 'SENHA', label: 'Exigir Senha de Gerente' }, { value: 'ALERTA', label: 'Livre (Risco)' } ]} />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="config-card border-danger-card">
                          <div className="card-header text-danger"><AlertTriangle size={20}/> <h3 style={{margin:0, fontSize:'1rem'}}>Área Restrita (Manutenção)</h3></div>
                          <div className="card-body">
                              <div className="action-list">
                                  <button type="button" className="action-row" onClick={handleOtimizarBanco}>
                                      <div className="ac-icon bg-blue"><Database size={20}/></div>
                                      <div className="ac-text"><strong>Otimizar Servidor Local</strong><span>Remove arquivos órfãos e limpa lixo digital.</span></div>
                                  </button>
                                  <button type="button" className="action-row" onClick={handleBackup}>
                                      <div className="ac-icon bg-green"><Download size={20}/></div>
                                      <div className="ac-text"><strong>Gerar Backup Físico</strong><span>Faz o download do arquivo .SQL com as vendas.</span></div>
                                  </button>
                                  <button type="button" className="action-row danger-row" onClick={() => setShowResetModal(true)}>
                                      <div className="ac-icon bg-red"><Trash2 size={20}/></div>
                                      <div className="ac-text"><strong>Zerar Sistema (Reset de Fábrica)</strong><span>Apaga todas as vendas e configurações irreversivelmente.</span></div>
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