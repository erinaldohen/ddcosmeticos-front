import React, { useState, useEffect } from 'react';
import {
  Store, Save, Upload, Search, Globe,
  Smartphone, Mail, FileText, Server,
  Download, RefreshCw, Trash2, Lock,
  Eye, EyeOff, DollarSign, Printer,
  Clock, HardDrive, FileCheck, QrCode,
  Building, CheckCircle2, AlertTriangle,
  Briefcase, Calculator, ShieldCheck,
  Instagram, Moon, Sun, Cloud, UserCheck,
  Percent, AlertOctagon, Scissors, MessageCircle,
  Sparkles, Gift, CreditCard, Barcode, Database, Monitor,
  Truck, Scale, Heart, Palette, Layers, Image as ImageIcon,
  Coins, Info
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Configuracoes.css';

// --- UTILITÁRIOS (Mantidos) ---
const clean = (v) => v ? v.replace(/\D/g, '') : '';

const sanitizarDados = (obj) => {
  if (obj === null || obj === undefined) return "";
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const novoObj = {};
    Object.keys(obj).forEach(key => {
      novoObj[key] = sanitizarDados(obj[key]);
    });
    return novoObj;
  }
  return obj;
};

const getBackendUrl = () => {
  const baseUrl = api.defaults.baseURL || "";
  return baseUrl.split('/api')[0];
};

const formatMoney = (value) => {
  const val = Number(value) || 0;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

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
  cnae: (v) => clean(v).replace(/^(\d{4})(\d{1})(\d{2})/, '$1-$2/$3').substr(0, 9),
};

const getCertDays = (dateString) => {
  if (!dateString) return 0;
  if (dateString === "Instalado") return 365;
  const parts = dateString.split('/');
  if (parts.length !== 3) return 0;
  const expiry = new Date(parts[2], parts[1] - 1, parts[0]);
  const today = new Date();
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const Configuracoes = () => {
  // --- STATES ---
  const [activeTab, setActiveTab] = useState('loja');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [certData, setCertData] = useState({ validade: null, diasRestantes: 0 });

  // --- FORM DATA ---
  const [form, setForm] = useState({
    id: null,
    loja: {
      razaoSocial: '', nomeFantasia: '', cnpj: '', ie: '', im: '', cnae: '',
      email: '', telefone: '', whatsapp: '', site: '', instagram: '', slogan: '',
      corDestaque: '#ec4899',
      isMatriz: true, horarioAbre: '09:00', horarioFecha: '18:00',
      toleranciaMinutos: '30', bloqueioForaHorario: false, logo: null,
      taxaEntregaPadrao: '10.00', tempoEntregaMin: '40', logoUrl: ''
    },
    endereco: {
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: ''
    },
    fiscal: {
      ambiente: 'HOMOLOGACAO', regime: '1',
      homologacao: { token: '', cscId: '', serie: '900', nfe: '0' },
      producao: { token: '', cscId: '', serie: '1', nfe: '0' },
      certificado: null, senhaCert: '', csrtId: '', csrtHash: '', caminhoCertificado: '',
      ibptToken: '', naturezaPadrao: '5.102', emailContabil: '', enviarXmlAutomatico: true,
      aliquotaInterna: '18.00', modoContingencia: false, priorizarMonofasico: true,
      obsPadraoCupom: 'Trocas somente com etiqueta original e em até 7 dias.'
    },
    financeiro: {
      comissaoProdutos: '1.00', comissaoServicos: '10.00', alertaSangria: '500.00',
      fundoTrocoPadrao: '100.00', metaDiaria: '2000.00',
      taxaDebito: '1.99', taxaCredito: '4.50',
      descCaixa: 5, descGerente: 20, descExtraPix: true, bloquearAbaixoCusto: true,
      fechamentoCego: true,
      pixTipo: 'CNPJ', pixChave: '',
      pagamentos: { dinheiro: true, pix: true, credito: true, debito: true, crediario: false },
      jurosMensal: '2.00', multaAtraso: '2.00', diasCarencia: 0
    },
    vendas: {
      comportamentoCpf: 'PERGUNTAR', bloquearEstoque: true, layoutCupom: 'DETALHADO',
      imprimirVendedor: true, imprimirTicketTroca: true, autoEnterScanner: true,
      agruparItens: true,
      fidelidadeAtiva: true, pontosPorReal: '1', usarBalanca: false
    },
    sistema: {
      impressaoAuto: true, larguraPapel: '80mm', backupAuto: false, backupHora: '23:00', rodape: '',
      tema: 'light', backupNuvem: false, senhaGerenteCancelamento: true,
      nomeTerminal: 'CAIXA 01', imprimirLogoCupom: true
    }
  });

  // --- EFFECTS ---
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await api.get('/configuracoes');
        if (data && data.id) {
          const dadosLimpos = sanitizarDados(data);
          setForm(prev => ({
            ...prev,
            ...dadosLimpos,
            loja: { ...prev.loja, ...(dadosLimpos.loja || {}) },
            endereco: { ...prev.endereco, ...(dadosLimpos.endereco || {}) },
            fiscal: {
               ...prev.fiscal,
               ...(dadosLimpos.fiscal || {}),
               ambiente: dadosLimpos.fiscal?.ambiente || "HOMOLOGACAO",
               homologacao: { ...prev.fiscal.homologacao, ...(dadosLimpos.fiscal?.homologacao || {}) },
               producao: { ...prev.fiscal.producao, ...(dadosLimpos.fiscal?.producao || {}) }
            },
            financeiro: {
                ...prev.financeiro,
                ...(dadosLimpos.financeiro || {}),
                pagamentos: { ...(prev.financeiro?.pagamentos || {}), ...(dadosLimpos.financeiro?.pagamentos || {}) }
            },
            vendas: { ...prev.vendas, ...(dadosLimpos.vendas || {}) },
            sistema: { ...prev.sistema, ...(dadosLimpos.sistema || {}) }
          }));

          if (data.loja && data.loja.logoUrl) {
             const rootUrl = getBackendUrl();
             setLogoPreview(`${rootUrl}${data.loja.logoUrl}`);
          }

          if (data.fiscal && data.fiscal.caminhoCertificado) {
              setCertData({ validade: "Instalado", diasRestantes: 365, nomeArquivo: data.fiscal.caminhoCertificado });
          }
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
      if(form.sistema?.tema) document.documentElement.setAttribute('data-theme', form.sistema.tema);
  }, [form.sistema.tema]);

  // --- HANDLERS ---
  const update = (section, field, value) => {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const updateMoney = (section, field, inputValue) => {
    const onlyDigits = inputValue.replace(/\D/g, '');
    const realValue = (Number(onlyDigits) / 100).toFixed(2);
    update(section, field, realValue);
  };

  const updateMask = (section, field, value, type) => {
    update(section, field, masks[type](value));
  };

  const updateFiscalEnv = (field, value) => {
    const amb = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
    setForm(prev => ({
      ...prev,
      fiscal: { ...prev.fiscal, [amb]: { ...(prev.fiscal[amb] || {}), [field]: value } }
    }));
  };

  const handlePayment = (key) => {
    setForm(prev => {
      const pagamentosAtuais = prev.financeiro?.pagamentos || {};
      return {
        ...prev,
        financeiro: { ...prev.financeiro, pagamentos: { ...pagamentosAtuais, [key]: !pagamentosAtuais[key] } }
      };
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
      update('loja', 'logo', file);
    }
  };

  const handleCertUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      update('fiscal', 'certificado', file);
      const validadeSimulada = "15/05/2026";
      setCertData({ validade: validadeSimulada, diasRestantes: getCertDays(validadeSimulada) });
      toast.success("Arquivo selecionado! Clique em Salvar.");
    }
  };

  const searchCNPJ = async () => {
    const doc = clean(form.loja.cnpj);
    if (doc.length !== 14) return toast.warning("CNPJ inválido.");
    setIsSearching(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
      const data = await res.json();
      if(data.message) throw new Error();
      setForm(prev => ({
        ...prev,
        loja: {
          ...prev.loja,
          razaoSocial: data.razao_social,
          nomeFantasia: data.nome_fantasia || data.razao_social,
          telefone: masks.phone(data.ddd_telefone_1 || ''),
          email: data.email || prev.loja.email,
          cnae: data.cnae_fiscal || ''
        },
        endereco: { ...prev.endereco, cep: masks.cep(data.cep), logradouro: data.logradouro, numero: data.numero, bairro: data.bairro, cidade: data.municipio, uf: data.uf, complemento: data.complemento || '' }
      }));
      toast.success("Dados importados!");
    } catch { toast.error("CNPJ não encontrado."); }
    finally { setIsSearching(false); }
  };

  const searchCEP = async () => {
    const zip = clean(form.endereco.cep);
    if (zip.length !== 8) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(prev => ({ ...prev, endereco: { ...prev.endereco, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf, complemento: data.complemento || '' } }));
      }
    } catch {} finally { setIsSearching(false); }
  };

  const handleSave = async () => {
    if(!form.loja.ie && form.loja.cnpj) { toast.error("IE obrigatória."); setActiveTab('loja'); return; }
    setIsSaving(true);
    try {
      const { data: configSalva } = await api.put('/configuracoes', form);
      let urlAtualizada = configSalva.loja?.logoUrl;
      let caminhoCertAtualizado = configSalva.fiscal?.caminhoCertificado;

      if (form.loja.logo instanceof File) {
        const formData = new FormData();
        formData.append('file', form.loja.logo);
        const responseLogo = await api.post('/configuracoes/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (typeof responseLogo.data === 'string') urlAtualizada = responseLogo.data;
      }

      if (form.fiscal.certificado instanceof File) {
         const formData = new FormData();
         formData.append('file', form.fiscal.certificado);
         formData.append('senha', form.fiscal.senhaCert);
         const responseCert = await api.post('/configuracoes/certificado', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
         if(responseCert.status === 200) setCertData({ validade: "Instalado (Novo)", diasRestantes: 365 });
      }

      toast.success("Configurações salvas!");
      const dadosLimpos = sanitizarDados(configSalva);
      setForm(prev => ({
          ...prev, ...dadosLimpos,
          loja: { ...prev.loja, ...(dadosLimpos.loja || {}), logoUrl: urlAtualizada, logo: null },
          fiscal: { ...prev.fiscal, ...(dadosLimpos.fiscal || {}), caminhoCertificado: caminhoCertAtualizado || prev.fiscal.caminhoCertificado }
      }));
      if (urlAtualizada) {
          const rootUrl = getBackendUrl();
          setLogoPreview(`${rootUrl}${urlAtualizada}`);
      }
    } catch (error) { console.error(error); toast.error("Erro ao salvar."); } finally { setIsSaving(false); }
  };

  // --- NOVAS FUNÇÕES DE MANUTENÇÃO (CONECTADAS AO BACKEND) ---
  const handleOtimizarBanco = async () => {
    const toastId = toast.loading("Otimizando banco de dados...");
    try {
      await api.post('/configuracoes/manutencao/otimizar');
      toast.update(toastId, { render: "Banco de dados otimizado!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (e) {
      toast.update(toastId, { render: "Erro ao otimizar banco.", type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  const handleBackup = async () => {
    const toastId = toast.loading("Gerando backup...");
    try {
      const response = await api.get('/configuracoes/manutencao/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // Gera nome com data atual: backup_ddcosmeticos_2023-10-25_14-30.mv.db
      const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      link.setAttribute('download', `backup_ddcosmeticos_${dateStr}.mv.db`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.update(toastId, { render: "Download iniciado!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (e) {
      console.error(e);
      toast.update(toastId, { render: "Erro ao gerar backup.", type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  if (isLoading) return <div className="loading-screen"><div className="spinner"></div> Carregando...</div>;

  const currentEnv = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
  const currentFiscalData = form.fiscal[currentEnv] || { serie: '', nfe: '', token: '', cscId: '' };

  return (
    <main className="container-fluid">
      <header className="page-header">
        <div className="page-title">
          <h1>Configurações</h1>
          <p>Gestão Corporativa, Fiscal e Parâmetros</p>
        </div>
        <div className="header-actions">
           <button className="btn-secondary" onClick={() => update('sistema', 'tema', form.sistema.tema === 'light' ? 'dark' : 'light')}>
             {form.sistema.tema === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
           </button>
           <button className="action-btn-primary" onClick={handleSave} disabled={isSaving}>
             {isSaving ? <RefreshCw className="spin" size={18}/> : <Save size={18}/>} {isSaving ? 'Salvando...' : 'Salvar Alterações'}
           </button>
        </div>
      </header>

      {/* ABAS */}
      <nav className="config-tabs-container">
         <div className="config-tabs">
            {['loja', 'fiscal', 'financeiro', 'vendas', 'sistema'].map(id => {
                const iconMap = { loja: Store, fiscal: FileText, financeiro: DollarSign, vendas: Printer, sistema: Server };
                const Icon = iconMap[id];
                return (
                    <button key={id} type="button" onClick={() => setActiveTab(id)} className={`tab-btn ${activeTab === id ? 'active' : ''}`}>
                        <Icon size={18} /> <span style={{textTransform:'capitalize'}}>{id}</span>
                    </button>
                )
            })}
         </div>
      </nav>

      <div className="form-container">
        {/* === ABA LOJA === */}
        {activeTab === 'loja' && (
          <div className="dashboard-grid">
            {/* COLUNA ESQUERDA (Identidade) */}
            <div style={{flex: 1, minWidth: '300px'}}>
                <section className="form-section">
                    <h3 className="section-title"><Palette size={20}/> Identidade Visual</h3>
                    <div className="image-upload-area">
                        <div className="image-preview-box">
                            {logoPreview ? <img src={logoPreview} alt="Logo" style={{width:'100%', height:'100%', objectFit:'contain'}}/> : <Store size={40} color="#ccc"/>}
                        </div>
                        <label className="btn-upload full-width"><Upload size={16}/> Carregar Logo<input type="file" hidden accept="image/*" onChange={handleLogoUpload}/></label>
                        {logoPreview && <button className="btn-text-danger mt-2" onClick={() => {setLogoPreview(null); update('loja', 'logo', null);}}>Remover</button>}
                    </div>

                    <div className="form-row mt-4">
                        <div className="form-group flex-1">
                             <div className="floating-group">
                                <input type="color" className="ff-input-floating h-12 p-1 cursor-pointer" value={form.loja.corDestaque || "#ec4899"} onChange={e => update('loja', 'corDestaque', e.target.value)}/>
                                <label className="ff-label-floating">Cor do Sistema</label>
                             </div>
                        </div>
                    </div>
                    <div className="form-group col-full switch-container">
                         <div><div className="flex-row"><Building size={18}/> <strong>Matriz / Filial</strong></div><p>Define hierarquia</p></div>
                         <label className="switch"><input type="checkbox" checked={form.loja.isMatriz} onChange={e => update('loja', 'isMatriz', e.target.checked)}/><span className="slider round"></span></label>
                    </div>

                    <div className="divider my-4"></div>
                    <h4 className="section-subtitle"><Clock size={16}/> Horários</h4>
                    <div className="form-row">
                        <ConfigInput label="Abertura" type="time" value={form.loja.horarioAbre} onChange={e => update('loja', 'horarioAbre', e.target.value)} />
                        <ConfigInput label="Fechamento" type="time" value={form.loja.horarioFecha} onChange={e => update('loja', 'horarioFecha', e.target.value)} />
                    </div>

                    <div className="divider my-4"></div>
                    <h4 className="section-subtitle"><Truck size={16}/> Delivery</h4>
                    <div className="form-row">
                        <ConfigInput label="Taxa Padrão" value={form.loja.taxaEntregaPadrao} onChange={e => update('loja', 'taxaEntregaPadrao', e.target.value)} prefix="R$" />
                        <ConfigInput label="Tempo (Min)" value={form.loja.tempoEntregaMin} onChange={e => update('loja', 'tempoEntregaMin', e.target.value)} suffix="min" />
                    </div>
                </section>
            </div>

            {/* COLUNA DIREITA (Dados) */}
            <div style={{flex: 2, minWidth: '300px'}}>
                <section className="form-section">
                    <h3 className="section-title"><FileText size={20}/> Dados Cadastrais</h3>
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <div className="floating-group input-action-group">
                                <input value={form.loja.cnpj} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} className="ff-input-floating" placeholder=" " />
                                <label className="ff-label-floating">CNPJ</label>
                                <div className="input-tools">
                                    <button type="button" className="btn-tool cloud" onClick={searchCNPJ} disabled={isSearching} data-tip="Consultar Receita">
                                        {isSearching ? <div className="spinner-micro"/> : <Search size={18}/>}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <ConfigInput label="Inscrição Estadual (IE)" value={form.loja.ie} onChange={e => updateMask('loja', 'ie', e.target.value, 'ie')} />
                    </div>
                    <div className="form-row">
                        <ConfigInput label="Razão Social" value={form.loja.razaoSocial} onChange={e => update('loja', 'razaoSocial', e.target.value)} className="flex-2" />
                        <ConfigInput label="Nome Fantasia" value={form.loja.nomeFantasia} onChange={e => update('loja', 'nomeFantasia', e.target.value)} className="flex-1" />
                    </div>
                    <div className="form-row">
                        <ConfigInput label="Telefone Fixo" value={form.loja.telefone} onChange={e => updateMask('loja', 'telefone', e.target.value, 'phone')} />
                        <ConfigInput label="WhatsApp" value={form.loja.whatsapp} onChange={e => updateMask('loja', 'whatsapp', e.target.value, 'phone')} />
                        <ConfigInput label="Instagram" value={form.loja.instagram} onChange={e => update('loja', 'instagram', e.target.value)} prefix="@" />
                    </div>
                    <div className="form-row">
                         <ConfigInput label="Slogan / Frase" value={form.loja.slogan} onChange={e => update('loja', 'slogan', e.target.value)} className="flex-2" />
                         <ConfigInput label="Site" value={form.loja.site} onChange={e => update('loja', 'site', e.target.value)} className="flex-1" />
                    </div>

                    <div className="divider my-4"></div>
                    <h3 className="section-title"><Globe size={20}/> Endereço</h3>
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <div className="floating-group input-action-group">
                                <input value={form.endereco.cep} onChange={e => updateMask('endereco', 'cep', e.target.value, 'cep')} onBlur={searchCEP} className="ff-input-floating" placeholder=" " />
                                <label className="ff-label-floating">CEP</label>
                                <div className="input-tools">
                                    <button type="button" className="btn-tool cloud" onClick={searchCEP}><Search size={18}/></button>
                                </div>
                            </div>
                        </div>
                        <ConfigInput label="Logradouro" value={form.endereco.logradouro} onChange={e => update('endereco', 'logradouro', e.target.value)} className="flex-2" />
                        <ConfigInput label="Número" value={form.endereco.numero} onChange={e => update('endereco', 'numero', e.target.value)} className="flex-small" />
                    </div>
                    <div className="form-row">
                        <ConfigInput label="Bairro" value={form.endereco.bairro} onChange={e => update('endereco', 'bairro', e.target.value)} />
                        <ConfigInput label="Cidade" value={form.endereco.cidade} onChange={e => update('endereco', 'cidade', e.target.value)} />
                        <ConfigInput label="UF" value={form.endereco.uf} onChange={e => update('endereco', 'uf', e.target.value)} className="flex-small" />
                    </div>
                     <div className="form-row">
                        <ConfigInput label="Complemento" value={form.endereco.complemento} onChange={e => update('endereco', 'complemento', e.target.value)} className="flex-1" />
                    </div>
                </section>
            </div>
          </div>
        )}

        {/* === ABA FISCAL === */}
        {activeTab === 'fiscal' && (
           <div className="dashboard-grid">
               <div style={{flex: 1}}>
                   <section className="form-section">
                       <h3 className="section-title"><ShieldCheck size={20}/> Certificado A1</h3>
                       <div className="cert-upload-box">
                           {certData.validade ? (
                               <div className={`cert-info-card ${certData.diasRestantes < 30 ? 'warning' : 'success'}`}>
                                   <div className="cert-header">
                                       <div className="cert-icon">{certData.diasRestantes < 0 ? <AlertTriangle/> : <CheckCircle2/>}</div>
                                       <div><strong>{certData.diasRestantes < 0 ? 'Vencido' : 'Instalado'}</strong><small>Expira em {certData.diasRestantes} dias</small></div>
                                   </div>
                                   <div className="cert-meta">
                                       <span>Validade: {certData.validade}</span>
                                   </div>
                                   <label className="btn-text-action">Substituir<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload}/></label>
                               </div>
                           ) : (
                               <div className="empty-cert">
                                   <FileCheck size={32} className="text-muted mb-2"/>
                                   <label className="btn-upload"><Upload size={16}/> Carregar PFX<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload}/></label>
                               </div>
                           )}
                           <div className="form-row mt-4">
                               <div className="form-group flex-1">
                                   <div className="floating-group input-action-group">
                                        <input type={showToken ? "text" : "password"} value={form.fiscal.senhaCert} onChange={e => update('fiscal', 'senhaCert', e.target.value)} className="ff-input-floating" placeholder=" " />
                                        <label className="ff-label-floating">Senha do Certificado</label>
                                        <div className="input-tools">
                                            <button type="button" className="btn-tool" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                                        </div>
                                   </div>
                               </div>
                           </div>
                       </div>
                       <div className="divider my-4"></div>
                       <div className="form-group col-full switch-container danger-border">
                            <div><strong>Contingência Offline</strong><p className="text-danger">Ativar apenas se SEFAZ cair</p></div>
                            <label className="switch"><input type="checkbox" checked={form.fiscal.modoContingencia} onChange={e => update('fiscal', 'modoContingencia', e.target.checked)}/><span className="slider round danger"></span></label>
                       </div>
                   </section>
               </div>

               <div style={{flex: 2}}>
                   <section className="form-section">
                       <div className="flex-row justify-between items-center mb-4">
                           <h3 className="section-title mb-0"><Server size={20}/> Emissão e Regras</h3>
                           <div className="env-toggle">
                                <button type="button" className={form.fiscal.ambiente === 'HOMOLOGACAO' ? 'active warning' : ''} onClick={() => update('fiscal', 'ambiente', 'HOMOLOGACAO')}>HOMOLOGAÇÃO</button>
                                <button type="button" className={form.fiscal.ambiente === 'PRODUCAO' ? 'active success' : ''} onClick={() => update('fiscal', 'ambiente', 'PRODUCAO')}>PRODUÇÃO</button>
                           </div>
                       </div>
                       {form.fiscal.ambiente === 'PRODUCAO' && (<div className="alert-production"><AlertTriangle size={20}/><span><strong>ATENÇÃO:</strong> Notas com validade jurídica.</span></div>)}

                       <div className="form-row">
                           <div className="form-group flex-1">
                               <div className="floating-group">
                                    <select value={form.fiscal.regime || "1"} onChange={e => update('fiscal', 'regime', e.target.value)} className="ff-input-floating">
                                        <option value="1">1 - Simples Nacional</option><option value="2">2 - Simples Nacional (Excesso)</option><option value="3">3 - Regime Normal</option>
                                    </select>
                                    <label className="ff-label-floating">Regime Tributário</label>
                               </div>
                           </div>
                           <div className="form-group flex-1">
                               <div className="floating-group">
                                    <select value={form.fiscal.naturezaPadrao || "5.102"} onChange={e => update('fiscal', 'naturezaPadrao', e.target.value)} className="ff-input-floating">
                                        <option value="5.102">5.102 - Venda</option><option value="5.405">5.405 - Venda c/ ST</option>
                                    </select>
                                    <label className="ff-label-floating">Natureza Padrão</label>
                               </div>
                           </div>
                       </div>
                       <div className="form-row">
                           <ConfigInput label="Série NFC-e" value={currentFiscalData.serie} onChange={e => updateFiscalEnv('serie', e.target.value)} className="flex-small" />
                           <ConfigInput label="Próx. Nota" value={currentFiscalData.nfe} onChange={e => updateFiscalEnv('nfe', e.target.value)} className="flex-small" />
                           <ConfigInput label="Aliq. Fallback" value={form.fiscal.aliquotaInterna} onChange={e => update('fiscal', 'aliquotaInterna', e.target.value)} suffix="%" className="flex-small" />
                           <div className="form-group col-full switch-container-vertical flex-1"><div><label>Segregar Monofásico</label></div><label className="switch small"><input type="checkbox" checked={form.fiscal.priorizarMonofasico} onChange={e => update('fiscal', 'priorizarMonofasico', e.target.checked)}/><span className="slider round success"></span></label></div>
                       </div>
                       <div className="form-row">
                           <ConfigInput label="Token IBPT (De Olho no Imposto)" value={form.fiscal.ibptToken} onChange={e => update('fiscal', 'ibptToken', e.target.value)} className="flex-1" />
                       </div>
                       <div className="form-row">
                           <div className="form-group flex-1">
                               <div className="floating-group">
                                   <textarea className="ff-input-floating" style={{height:'auto', minHeight:52, paddingTop:20}} value={form.fiscal.obsPadraoCupom} onChange={e => update('fiscal', 'obsPadraoCupom', e.target.value)} placeholder=" "></textarea>
                                   <label className="ff-label-floating">Mensagem Padrão (Cupom)</label>
                               </div>
                           </div>
                       </div>

                       <div className="divider my-4"></div>
                       <h4 className="section-subtitle"><Lock size={16}/> Credenciais CSC</h4>
                       <div className="form-row">
                           <ConfigInput label="Token CSC" value={currentFiscalData.token} onChange={e => updateFiscalEnv('token', e.target.value)} className="flex-2" />
                           <ConfigInput label="ID CSC" value={currentFiscalData.cscId} onChange={e => updateFiscalEnv('cscId', e.target.value)} className="flex-1" />
                       </div>
                   </section>
               </div>
           </div>
        )}

        {/* === ABA FINANCEIRO === */}
        {activeTab === 'financeiro' && (
          <div className="dashboard-grid">
              <div style={{flex: 1}}>
                  <section className="form-section">
                      <h3 className="section-title"><Calculator size={20}/> Parâmetros</h3>
                      <div className="form-row">
                         <ConfigInput label="Meta Diária" value={formatMoney(form.financeiro.metaDiaria)} onChange={e => updateMoney('financeiro', 'metaDiaria', e.target.value)} className="group-money" />
                         <ConfigInput label="Fundo Troco" value={formatMoney(form.financeiro.fundoTrocoPadrao)} onChange={e => updateMoney('financeiro', 'fundoTrocoPadrao', e.target.value)} className="group-money" />
                      </div>
                      <div className="form-row">
                          <ConfigInput label="Comissão Prod." value={form.financeiro.comissaoProdutos} onChange={e => update('financeiro', 'comissaoProdutos', e.target.value)} suffix="%" className="group-percent"/>
                          <ConfigInput label="Comissão Serv." value={form.financeiro.comissaoServicos} onChange={e => update('financeiro', 'comissaoServicos', e.target.value)} suffix="%" className="group-percent"/>
                      </div>
                      <div className="form-row">
                          <ConfigInput label="Alerta Sangria" value={formatMoney(form.financeiro.alertaSangria)} onChange={e => updateMoney('financeiro', 'alertaSangria', e.target.value)} className="group-money" />
                      </div>

                      <div className="divider my-4"></div>
                      <div className="form-group col-full switch-container danger-border">
                          <div><strong>Fechamento Cego</strong><p className="text-danger">Oculta totais ao fechar caixa</p></div>
                          <label className="switch"><input type="checkbox" checked={form.financeiro.fechamentoCego} onChange={e => update('financeiro', 'fechamentoCego', e.target.checked)}/><span className="slider round danger"></span></label>
                      </div>
                  </section>
              </div>

              <div style={{flex: 1}}>
                  <section className="form-section">
                      <h3 className="section-title"><CreditCard size={20}/> Taxas e Pagamentos</h3>
                      <div className="payment-grid mb-4">
                          {['dinheiro', 'pix', 'credito', 'debito', 'crediario'].map(key => (
                              <div key={key} className={`payment-card ${form.financeiro.pagamentos?.[key] ? 'active' : ''}`} onClick={() => handlePayment(key)}>
                                  <div className="checkbox-visual">{form.financeiro.pagamentos?.[key] && <CheckCircle2 size={16}/>}</div><span>{key}</span>
                              </div>
                          ))}
                      </div>
                      <div className="form-row bg-gray-50 p-3 rounded">
                          <ConfigInput label="Taxa Débito" value={form.financeiro.taxaDebito} onChange={e => update('financeiro', 'taxaDebito', e.target.value)} suffix="%" className="group-percent"/>
                          <ConfigInput label="Taxa Crédito" value={form.financeiro.taxaCredito} onChange={e => update('financeiro', 'taxaCredito', e.target.value)} suffix="%" className="group-percent"/>
                      </div>
                      {form.financeiro.pagamentos?.pix && (
                          <div className="pix-config-box fade-in mt-4">
                              <h4 className="section-subtitle text-indigo-600"><QrCode size={16}/> Configuração Pix</h4>
                              <div className="form-row">
                                  <div className="form-group flex-1">
                                      <div className="floating-group">
                                          <select value={form.financeiro.pixTipo || "CNPJ"} onChange={e => update('financeiro', 'pixTipo', e.target.value)} className="ff-input-floating">
                                              <option value="CNPJ">CNPJ</option><option value="CPF">CPF</option><option value="ALEATORIA">Aleatória</option>
                                          </select>
                                          <label className="ff-label-floating">Tipo Chave</label>
                                      </div>
                                  </div>
                                  <ConfigInput label="Chave Pix" value={form.financeiro.pixChave} onChange={e => update('financeiro', 'pixChave', e.target.value)} />
                              </div>
                          </div>
                      )}
                  </section>
              </div>
          </div>
        )}

        {/* === ABA VENDAS === */}
        {activeTab === 'vendas' && (
          <div className="dashboard-grid">
              <div style={{flex: 1}}>
                  <section className="form-section">
                      <h3 className="section-title"><Briefcase size={20}/> Regras de Negócio</h3>
                      <div className="form-group col-full switch-container mb-4 warning-border bg-yellow-50">
                          <div><div className="flex-row text-warning"><Heart size={18}/> <strong>Fidelidade</strong></div><p>Acumular pontos</p></div>
                          <label className="switch small"><input type="checkbox" checked={form.vendas.fidelidadeAtiva} onChange={e => update('vendas', 'fidelidadeAtiva', e.target.checked)}/><span className="slider round warning"></span></label>
                      </div>
                      {form.vendas.fidelidadeAtiva && (
                          <div className="form-row mb-4">
                              <ConfigInput label="Pontos p/ R$ 1,00" value={form.vendas.pontosPorReal} onChange={e => update('vendas', 'pontosPorReal', e.target.value)} />
                          </div>
                      )}
                      <div className="form-row">
                           <div className="form-group flex-1">
                                <div className="floating-group">
                                    <select value={form.vendas.comportamentoCpf} onChange={e => update('vendas', 'comportamentoCpf', e.target.value)} className="ff-input-floating">
                                        <option value="PERGUNTAR">Perguntar</option><option value="SEMPRE">Exigir</option><option value="NUNCA">Nunca</option>
                                    </select>
                                    <label className="ff-label-floating">Solicitar CPF</label>
                                </div>
                           </div>
                      </div>
                      <div className="form-group col-full switch-container danger-border">
                           <div><strong>Bloquear Sem Estoque</strong><p>Impede venda negativa</p></div>
                           <label className="switch"><input type="checkbox" checked={form.vendas.bloquearEstoque} onChange={e => update('vendas', 'bloquearEstoque', e.target.checked)}/><span className="slider round danger"></span></label>
                      </div>
                  </section>
              </div>
              <div style={{flex: 1}}>
                  <section className="form-section">
                      <h3 className="section-title"><Printer size={20}/> Impressão</h3>
                      <div className="form-group col-full switch-container"><div><strong>Impressão Automática</strong></div><label className="switch"><input type="checkbox" checked={form.sistema.impressaoAuto} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)}/><span className="slider round"></span></label></div>
                      <div className="form-group col-full switch-container"><div><strong>Ticket de Troca</strong></div><label className="switch"><input type="checkbox" checked={form.vendas.imprimirTicketTroca} onChange={e => update('vendas', 'imprimirTicketTroca', e.target.checked)}/><span className="slider round success"></span></label></div>
                      <div className="form-row mt-4">
                           <div className="form-group flex-1">
                               <div className="floating-group">
                                   <select value={form.vendas.layoutCupom} onChange={e => update('vendas', 'layoutCupom', e.target.value)} className="ff-input-floating">
                                       <option value="DETALHADO">Detalhado</option><option value="RESUMIDO">Resumido</option>
                                   </select>
                                   <label className="ff-label-floating">Layout</label>
                               </div>
                           </div>
                           <div className="form-group flex-1">
                               <div className="floating-group">
                                   <select value={form.sistema.larguraPapel} onChange={e => update('sistema', 'larguraPapel', e.target.value)} className="ff-input-floating">
                                       <option value="80mm">80mm (Padrão)</option><option value="58mm">58mm (Estreito)</option>
                                   </select>
                                   <label className="ff-label-floating">Papel</label>
                               </div>
                           </div>
                      </div>
                      <div className="form-row">
                          <div className="form-group flex-1">
                              <div className="floating-group">
                                  <textarea className="ff-input-floating" style={{height:'auto', minHeight:52, paddingTop:20}} value={form.sistema.rodape} onChange={e => update('sistema', 'rodape', e.target.value)} placeholder=" "></textarea>
                                  <label className="ff-label-floating">Rodapé do Cupom</label>
                              </div>
                          </div>
                      </div>
                  </section>
              </div>
          </div>
        )}

        {/* === ABA SISTEMA === */}
        {activeTab === 'sistema' && (
           <div className="dashboard-grid">
               <div style={{flex: 1}}>
                   <section className="form-section">
                       <h3 className="section-title"><Monitor size={20}/> Terminal</h3>
                       <div className="form-row">
                           <ConfigInput label="Nome do Terminal" value={form.sistema.nomeTerminal} onChange={e => update('sistema', 'nomeTerminal', e.target.value)} placeholder="Ex: CAIXA 01" />
                       </div>
                       <div className="divider my-4"></div>
                       <div className="form-group col-full switch-container"><div><div className="flex-row"><ImageIcon size={18}/> <strong>Logo no Cupom</strong></div></div><label className="switch"><input type="checkbox" checked={form.sistema.imprimirLogoCupom} onChange={e => update('sistema', 'imprimirLogoCupom', e.target.checked)}/><span className="slider round"></span></label></div>
                       <div className="form-group col-full switch-container mt-2"><div><div className="flex-row"><UserCheck size={18}/> <strong>Senha Gerente (Cancelamento)</strong></div></div><label className="switch"><input type="checkbox" checked={form.sistema.senhaGerenteCancelamento} onChange={e => update('sistema', 'senhaGerenteCancelamento', e.target.checked)}/><span className="slider round"></span></label></div>
                   </section>
               </div>
               <div style={{flex: 1}}>
                   <section className="form-section border-danger">
                       <h3 className="section-title text-danger"><AlertTriangle size={20}/> Manutenção</h3>
                       <div className="danger-zone-content">
                           <button type="button" className="list-btn" onClick={handleOtimizarBanco}><div className="icon-bg blue"><Database size={20}/></div><div className="text"><strong>Otimizar Banco</strong><span>Compactar e reindexar</span></div></button>
                           <button type="button" className="list-btn mt-2" onClick={() => toast.info("Cache limpo.")}><div className="icon-bg blue"><RefreshCw size={20}/></div><div className="text"><strong>Limpar Cache</strong><span>Resolver lentidão</span></div></button>
                           <button type="button" className="list-btn mt-2" onClick={handleBackup}><div className="icon-bg green"><Download size={20}/></div><div className="text"><strong>Backup Manual</strong><span>Baixar cópia .SQL</span></div></button>
                           <div className="divider"></div>
                           <button type="button" className="list-btn mt-2" onClick={() => window.confirm("Certeza? Isso apagará todas as configurações.")}><div className="icon-bg red"><Trash2 size={20}/></div><div className="text"><strong>Resetar Fábrica</strong><span>Apagar configurações</span></div></button>
                       </div>
                   </section>
               </div>
           </div>
        )}
      </div>
    </main>
  );
};

// --- COMPONENTE INPUT UNIFICADO (Floating Label) ---
const ConfigInput = ({ label, value, onChange, type="text", className="", prefix, suffix, placeholder=" " }) => (
    <div className={`form-group ${className}`}>
        <div className={`floating-group ${prefix ? 'group-money' : ''} ${suffix ? 'group-percent' : ''}`}>
            <input
                type={type}
                className="ff-input-floating"
                value={value || ''}
                onChange={onChange}
                placeholder={placeholder}
            />
            {prefix && <span className="prefix">{prefix}</span>}
            {suffix && <span className="suffix">{suffix}</span>}
            <label className="ff-label-floating">{label}</label>
        </div>
    </div>
);

export default Configuracoes;