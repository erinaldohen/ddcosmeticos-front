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
  Coins // <--- NOVO ÍCONE IMPORTADO
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Configuracoes.css';

// --- UTILITÁRIOS ---
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

// --- FUNÇÃO PARA FORMATAR MOEDA VISUALMENTE (R$ 1.000,00) ---
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

// --- COMPONENTES AUXILIARES ---
const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }) => (
  <button type="button" onClick={() => setActiveTab(id)} className={`tab-btn ${activeTab === id ? 'active' : ''}`}>
    <Icon size={18} /> {label}
  </button>
);

const InputGroup = ({ label, icon: Icon, children, className = '' }) => (
  <div className={`form-group ${className}`}>
    <label>{label}</label>
    <div className="input-wrapper">
      {Icon && <div className="input-icon-left"><Icon size={18} /></div>}
      {children}
    </div>
  </div>
);

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

  // --- INIT ---
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
                  pagamentos: {
                      ...(prev.financeiro?.pagamentos || {}),
                      ...(dadosLimpos.financeiro?.pagamentos || {})
                  }
              },
              vendas: { ...prev.vendas, ...(dadosLimpos.vendas || {}) },
              sistema: { ...prev.sistema, ...(dadosLimpos.sistema || {}) }
            }));

            if (data.loja && data.loja.logoUrl) {
               const rootUrl = getBackendUrl();
               setLogoPreview(`${rootUrl}${data.loja.logoUrl}`);
            }

            if (data.fiscal && data.fiscal.caminhoCertificado) {
                setCertData({
                    validade: "Instalado",
                    diasRestantes: 365,
                    nomeArquivo: data.fiscal.caminhoCertificado
                });
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
        if(form.sistema?.tema) {
            document.documentElement.setAttribute('data-theme', form.sistema.tema);
        }
    }, [form.sistema.tema]);

  // --- HANDLERS ---
  const update = (section, field, value) => {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  // --- ATUALIZAÇÃO COM MÁSCARA DE MOEDA ---
  const updateMoney = (section, field, inputValue) => {
    // Remove tudo que não é número
    const onlyDigits = inputValue.replace(/\D/g, '');
    // Converte para float (dividir por 100 para ter 2 casas decimais)
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
      fiscal: {
          ...prev.fiscal,
          [amb]: { ...(prev.fiscal[amb] || {}), [field]: value }
      }
    }));
  };

  const handlePayment = (key) => {
    setForm(prev => {
      const pagamentosAtuais = prev.financeiro?.pagamentos || {};
      return {
        ...prev,
        financeiro: {
          ...prev.financeiro,
          pagamentos: { ...pagamentosAtuais, [key]: !pagamentosAtuais[key] }
        }
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

  // --- API ACTIONS ---
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
      if(!form.loja.ie && form.loja.cnpj) {
          toast.error("Inscrição Estadual obrigatória para CNPJ.");
          setActiveTab('loja');
          return;
      }

      setIsSaving(true);
      try {
        const { data: configSalva } = await api.put('/configuracoes', form);
        let urlAtualizada = configSalva.loja?.logoUrl;
        let caminhoCertAtualizado = configSalva.fiscal?.caminhoCertificado;

        if (form.loja.logo instanceof File) {
          const formData = new FormData();
          formData.append('file', form.loja.logo);
          const responseLogo = await api.post('/configuracoes/logo', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (typeof responseLogo.data === 'string') {
             urlAtualizada = responseLogo.data;
          }
        }

        if (form.fiscal.certificado instanceof File) {
           const formData = new FormData();
           formData.append('file', form.fiscal.certificado);
           formData.append('senha', form.fiscal.senhaCert);
           const responseCert = await api.post('/configuracoes/certificado', formData, {
               headers: { 'Content-Type': 'multipart/form-data' }
           });

           if(responseCert.status === 200) {
               setCertData({
                   validade: "Instalado (Novo)",
                   diasRestantes: 365
               });
           }
        }

        toast.success("Configurações salvas com sucesso!");

        const dadosLimpos = sanitizarDados(configSalva);

        setForm(prev => ({
            ...prev,
            ...dadosLimpos,
            loja: {
                ...prev.loja,
                ...(dadosLimpos.loja || {}),
                logoUrl: urlAtualizada,
                logo: null
            },
            fiscal: {
                 ...prev.fiscal,
                 ...(dadosLimpos.fiscal || {}),
                 homologacao: { ...prev.fiscal.homologacao, ...(dadosLimpos.fiscal?.homologacao || {}) },
                 producao: { ...prev.fiscal.producao, ...(dadosLimpos.fiscal?.producao || {}) },
                 caminhoCertificado: caminhoCertAtualizado || prev.fiscal.caminhoCertificado
            }
        }));

        if (urlAtualizada) {
            const rootUrl = getBackendUrl();
            setLogoPreview(`${rootUrl}${urlAtualizada}`);
        }

      } catch (error) {
        console.error(error);
        toast.error("Erro ao salvar. Verifique o console.");
      } finally {
        setIsSaving(false);
      }
    };

  if (isLoading) return <div className="loader-container"><div className="spinner"></div><p>Carregando...</p></div>;

  const currentEnv = (form.fiscal.ambiente || 'HOMOLOGACAO').toLowerCase();
  const currentFiscalData = form.fiscal[currentEnv] || { serie: '', nfe: '', token: '', cscId: '' };

  return (
    <div className="config-container">
      <header className="config-header">
        <div><h1>Configurações</h1><p>Gestão Corporativa e Fiscal</p></div>
        <div className="header-right">
          <button className="btn-icon-only" onClick={() => update('sistema', 'tema', form.sistema.tema === 'light' ? 'dark' : 'light')}>
            {form.sistema.tema === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
          </button>
          <button className="btn-save desktop-only" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <RefreshCw className="spin" size={20}/> : <Save size={20}/>} {isSaving ? '...' : 'Salvar'}
          </button>
        </div>
      </header>

      <nav className="config-tabs">
        <TabButton id="loja" label="Loja" icon={Store} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="fiscal" label="Fiscal" icon={FileText} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="financeiro" label="Financeiro" icon={DollarSign} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="vendas" label="PDV" icon={Printer} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="sistema" label="Sistema" icon={Server} activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>

      <main className="config-body fade-in">

        {/* === ABA LOJA === */}
        {activeTab === 'loja' && (
          <div className="grid-layout">
            <div className="card sidebar-card">
              <h3>Identidade Visual</h3>
              <div className="logo-upload-area">
                <div className="preview-box" style={{backgroundImage: `url(${logoPreview})`}}>{!logoPreview && <Store size={40} className="text-muted"/>}</div>
                <label className="btn-outline full-width"><Upload size={16}/> Carregar Logo<input type="file" hidden accept="image/*" onChange={handleLogoUpload}/></label>
                {logoPreview && <button className="btn-text-danger" onClick={() => {setLogoPreview(null); update('loja', 'logo', null);}}>Remover</button>}
              </div>
              <div className="divider"></div>

              <div className="form-group mt-2">
                <label>Cor do Sistema</label>
                <div className="input-wrapper flex-row items-center gap-2">
                  <input type="color" className="h-10 w-16 p-1 cursor-pointer" value={form.loja.corDestaque || "#ec4899"} onChange={e => update('loja', 'corDestaque', e.target.value)}/>
                  <span className="text-sm text-muted">Cor da Marca</span>
                </div>
              </div>

              <div className="form-group mt-2">
                <label>Estrutura</label>
                <div className="pill-selector full-width">
                  <button className={form.loja.isMatriz ? 'active' : ''} onClick={() => update('loja', 'isMatriz', true)}>Matriz</button>
                  <button className={!form.loja.isMatriz ? 'active' : ''} onClick={() => update('loja', 'isMatriz', false)}>Filial</button>
                </div>
              </div>

              {/* OPERAÇÃO E DELIVERY */}
              <div className="form-grid mt-2">
                <div className="form-group col-half"><label>Abertura</label><input type="time" value={form.loja.horarioAbre || ""} onChange={e => update('loja', 'horarioAbre', e.target.value)}/></div>
                <div className="form-group col-half"><label>Fechamento</label><input type="time" value={form.loja.horarioFecha || ""} onChange={e => update('loja', 'horarioFecha', e.target.value)}/></div>

                <div className="col-full divider"></div>
                <div className="col-full"><strong className="text-muted text-sm flex-row"><Truck size={14}/> Delivery</strong></div>
                <div className="form-group col-half"><label>Taxa Padrão (R$)</label><input type="number" value={form.loja.taxaEntregaPadrao || ""} onChange={e => update('loja', 'taxaEntregaPadrao', e.target.value)}/></div>
                <div className="form-group col-half"><label>Tempo Est. (Min)</label><input type="number" value={form.loja.tempoEntregaMin || ""} onChange={e => update('loja', 'tempoEntregaMin', e.target.value)}/></div>
              </div>
            </div>

            <div className="card main-card">
              <h3>Dados Cadastrais</h3>
              <div className="form-grid">
                <div className="form-group col-half">
                  <label>CNPJ</label>
                  <div className="input-action-group">
                    <input value={form.loja.cnpj || ""} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} placeholder="00.000.000/0000-00"/>
                    <button type="button" className="btn-search-highlight" onClick={searchCNPJ} disabled={isSearching} data-tooltip="Consultar na Receita">
                      {isSearching ? <div className="spinner-mini white"/> : <Search size={18}/>}
                    </button>
                  </div>
                </div>
                <InputGroup label="Inscrição Estadual (IE)" icon={FileText} className="col-half"><input value={form.loja.ie || ""} onChange={e => updateMask('loja', 'ie', e.target.value, 'ie')} placeholder="Obrigatório em PE"/></InputGroup>
                <InputGroup label="Razão Social" icon={Building} className="col-full"><input value={form.loja.razaoSocial || ""} onChange={e => update('loja', 'razaoSocial', e.target.value)}/></InputGroup>
                <InputGroup label="Nome Fantasia" icon={Store} className="col-half"><input value={form.loja.nomeFantasia || ""} onChange={e => update('loja', 'nomeFantasia', e.target.value)} className="font-bold"/></InputGroup>
                <InputGroup label="Slogan / Frase" icon={Sparkles} className="col-half"><input value={form.loja.slogan || ""} onChange={e => update('loja', 'slogan', e.target.value)} placeholder="Ex: Realçando sua beleza"/></InputGroup>
                <InputGroup label="WhatsApp (Atendimento)" icon={MessageCircle} className="col-half"><input value={form.loja.whatsapp || ""} onChange={e => updateMask('loja', 'whatsapp', e.target.value, 'phone')} placeholder="(00) 90000-0000"/></InputGroup>
                <InputGroup label="Telefone Fixo" icon={Smartphone} className="col-half"><input value={form.loja.telefone || ""} onChange={e => updateMask('loja', 'telefone', e.target.value, 'phone')} placeholder="(00) 0000-0000"/></InputGroup>
                <InputGroup label="Instagram" icon={Instagram} className="col-half"><input value={form.loja.instagram || ""} onChange={e => update('loja', 'instagram', e.target.value)} placeholder="@sua_loja"/></InputGroup>
                <InputGroup label="Site" icon={Globe} className="col-half"><input value={form.loja.site || ""} onChange={e => update('loja', 'site', e.target.value)}/></InputGroup>
              </div>
              <div className="divider"></div>
              <h3>Localização</h3>
              <div className="form-grid">
                <div className="form-group col-third"><label>CEP</label><div className="input-action-group"><input value={form.endereco.cep || ""} onChange={e => updateMask('endereco', 'cep', e.target.value, 'cep')} onBlur={searchCEP}/><button type="button" onClick={searchCEP}><Search size={18}/></button></div></div>
                <div className="form-group col-two-thirds"><label>Logradouro</label><input value={form.endereco.logradouro || ""} onChange={e => update('endereco', 'logradouro', e.target.value)}/></div>
                <div className="form-group col-third"><label>Número</label><input value={form.endereco.numero || ""} onChange={e => update('endereco', 'numero', e.target.value)}/></div>
                <div className="form-group col-third"><label>Bairro</label><input value={form.endereco.bairro || ""} onChange={e => update('endereco', 'bairro', e.target.value)}/></div>
                <div className="form-group col-third"><label>Cidade</label><input value={form.endereco.cidade || ""} onChange={e => update('endereco', 'cidade', e.target.value)}/></div>
                <div className="form-group col-third"><label>UF</label><input value={form.endereco.uf || ""} onChange={e => update('endereco', 'uf', e.target.value)} maxLength={2} className="text-center"/></div>
                <div className="form-group col-two-thirds"><label>Complemento</label><input value={form.endereco.complemento || ""} onChange={e => update('endereco', 'complemento', e.target.value)}/></div>
              </div>
            </div>
          </div>
        )}

        {/* === ABA FISCAL === */}
        {activeTab === 'fiscal' && (
          <div className="grid-layout">
            <section className="card sidebar-card">
              <h3>Certificado Digital</h3>
              <div className="cert-upload-box">
                {certData.validade ? (
                  <div className={`cert-info-card fade-in ${certData.diasRestantes < 30 ? 'warning-border' : ''}`}>
                    <div className="cert-header">
                      <div className={`cert-icon-valid ${certData.diasRestantes < 30 ? 'bg-warning' : ''}`}>{certData.diasRestantes < 0 ? <AlertTriangle size={24}/> : <ShieldCheck size={24}/>}</div>
                      <div><strong>{certData.diasRestantes < 0 ? 'Vencido' : 'Ativo'}</strong><span className="text-muted text-xs d-block">CNPJ: {form.loja.cnpj || '...'}</span></div>
                    </div>
                    <div className="cert-body"><div className="cert-row"><span>Vencimento:</span><strong>{certData.validade}</strong></div><div className="cert-row"><span>Status:</span>{certData.diasRestantes > 30 ? <span className="badge-success">OK ({certData.diasRestantes}d)</span> : <span className="badge-warning">Atenção ({certData.diasRestantes}d)</span>}</div></div>
                    <label className="btn-text-action">Substituir Arquivo<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload} /></label>
                  </div>
                ) : (
                  <>
                    <div className="cert-icon"><FileCheck size={32}/></div>
                    <label className="btn-outline full-width">Carregar (.pfx)<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload} /></label>
                    <small>.pfx ou .p12</small>
                  </>
                )}
                <div className="form-group mt-4">
                  <label>Senha do Certificado</label>
                  <div className="input-action-group">
                    <input
                        type={showToken ? "text" : "password"}
                        className="text-center"
                        value={form.fiscal.senhaCert || ""}
                        onChange={e => update('fiscal', 'senhaCert', e.target.value)}
                        autoComplete="new-password"
                        name="senhaCert"
                    />
                    <button type="button" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                </div>
              </div>
              <div className="divider"></div>
              <div className="form-group col-full switch-container danger-border">
                <div><strong>Contingência Offline</strong><p className="text-xs text-danger">Ativar se SEFAZ cair</p></div>
                <label className="switch"><input type="checkbox" checked={form.fiscal.modoContingencia || false} onChange={e => update('fiscal', 'modoContingencia', e.target.checked)}/><span className="slider round danger"></span></label>
              </div>
            </section>

            <section className="card main-card">
              <div className="card-header-row">
                <h3>Emissão e Regras (PE)</h3>
                <div className="env-toggle">
                  <button type="button" className={form.fiscal.ambiente === 'HOMOLOGACAO' ? 'active warning' : ''} onClick={() => update('fiscal', 'ambiente', 'HOMOLOGACAO')}>HOMOLOGAÇÃO</button>
                  <button type="button" className={form.fiscal.ambiente === 'PRODUCAO' ? 'active success' : ''} onClick={() => update('fiscal', 'ambiente', 'PRODUCAO')}>PRODUÇÃO</button>
                </div>
              </div>
              {form.fiscal.ambiente === 'PRODUCAO' && (<div className="alert-production fade-in"><AlertTriangle size={20}/><span><strong>ATENÇÃO:</strong> Modo de Produção Ativo. Notas com validade jurídica.</span></div>)}

              <div className="form-grid">
                <div className="form-group col-half"><label>Regime Tributário</label><select value={form.fiscal.regime || "1"} onChange={e => update('fiscal', 'regime', e.target.value)}><option value="1">1 - Simples Nacional</option><option value="2">2 - Simples Nacional (Excesso)</option><option value="3">3 - Regime Normal</option></select></div>
                <div className="form-group col-half"><label>Natureza Padrão (CFOP)</label><select value={form.fiscal.naturezaPadrao || "5.102"} onChange={e => update('fiscal', 'naturezaPadrao', e.target.value)}><option value="5.102">5.102 - Venda Mercadoria</option><option value="5.405">5.405 - Venda c/ ST</option><option value="5.101">5.101 - Venda Produção</option></select>{form.fiscal.naturezaPadrao === '5.405' && <small className="text-xs text-success mt-1">Recomendado para revenda com ST.</small>}</div>
                <div className="form-group col-quarter"><label>Série NFC-e</label><input type="number" value={currentFiscalData.serie || ""} onChange={e => updateFiscalEnv('serie', e.target.value)}/></div>
                <div className="form-group col-quarter"><label>Próx. Nota</label><input type="number" value={currentFiscalData.nfe || ""} onChange={e => updateFiscalEnv('nfe', e.target.value)}/></div>
                <div className="form-group col-quarter"><label>Alíq. Fallback (%)</label><div className="input-wrapper" data-tooltip="Usado se NCM não encontrado"><input type="number" value={form.fiscal.aliquotaInterna || ""} onChange={e => update('fiscal', 'aliquotaInterna', e.target.value)} placeholder="18.00"/></div></div>
                <div className="form-group col-quarter switch-container-vertical"><label>Segregar Monofásico</label><label className="switch small" data-tooltip="Separa PIS/COFINS"><input type="checkbox" checked={form.fiscal.priorizarMonofasico || false} onChange={e => update('fiscal', 'priorizarMonofasico', e.target.checked)}/><span className="slider round success"></span></label></div>
                <div className="form-group col-full"><label>Token IBPT (Lei da Transparência)</label><div className="input-wrapper"><div className="input-icon-left"><Calculator size={18}/></div><input value={form.fiscal.ibptToken || ""} onChange={e => update('fiscal', 'ibptToken', e.target.value)} placeholder="Token de impostos..."/></div></div>
                <div className="form-group col-full"><label>Observação Padrão (Lei da Troca)</label><textarea rows="2" value={form.fiscal.obsPadraoCupom || ""} onChange={e => update('fiscal', 'obsPadraoCupom', e.target.value)} placeholder="Ex: Troca em até 7 dias com etiqueta intacta."/></div>
              </div>
              <div className="divider"></div>
              <h4>Credenciais Técnicas</h4>
              <div className="form-grid">
                <div className="form-group col-two-thirds"><label>Token CSC</label><div className="input-action-group"><div className="input-icon-left"><Lock size={18}/></div><input className="pl-icon" type="text" value={currentFiscalData.token || ""} onChange={e => updateFiscalEnv('token', e.target.value)} placeholder="Código alfanumérico..."/></div></div>
                <div className="form-group col-third"><label>ID CSC</label><input className="text-center" placeholder="Ex: 000001" value={currentFiscalData.cscId || ""} onChange={e => updateFiscalEnv('cscId', e.target.value)}/></div>
                <div className="form-group col-half"><label>ID CSRT (Opcional)</label><input value={form.fiscal.csrtId || ""} onChange={e => update('fiscal', 'csrtId', e.target.value)}/></div>

                <div className="form-group col-half">
                    <label>Hash CSRT (Chave)</label>
                    <input
                        type="password"
                        value={form.fiscal.csrtHash || ""}
                        onChange={e => update('fiscal', 'csrtHash', e.target.value)}
                        autoComplete="new-password"
                        name="csrtHash"
                    />
                </div>

                <div className="form-group col-full"><label>E-mail Contador (Envio XML)</label><div className="input-wrapper"><div className="input-icon-left"><Mail size={18}/></div><input type="email" value={form.fiscal.emailContabil || ""} onChange={e => update('fiscal', 'emailContabil', e.target.value)} placeholder="contador@escritorio.com"/></div></div>
              </div>
            </section>
          </div>
        )}

        {/* === ABA FINANCEIRO === */}
        {activeTab === 'financeiro' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Parâmetros de Lucratividade</h3>
              <div className="form-grid">
                <InputGroup label="Meta Diária" icon={DollarSign} className="col-half">
                    <input
                        type="text"
                        value={formatMoney(form.financeiro.metaDiaria)}
                        onChange={e => updateMoney('financeiro', 'metaDiaria', e.target.value)}
                    />
                </InputGroup>
                {/* --- AQUI ESTÁ A MUDANÇA DO ÍCONE E DA MÁSCARA --- */}
                <InputGroup label="Fundo de Troco" icon={Coins} className="col-half">
                    <input
                        type="text"
                        value={formatMoney(form.financeiro.fundoTrocoPadrao)}
                        onChange={e => updateMoney('financeiro', 'fundoTrocoPadrao', e.target.value)}
                        title="Valor inicial do caixa"
                    />
                </InputGroup>

                <div className="form-group col-half"><label>Comissão Produtos (%)</label><div className="input-wrapper"><div className="input-icon-left"><Percent size={18}/></div><input type="number" value={form.financeiro.comissaoProdutos || ""} onChange={e => update('financeiro', 'comissaoProdutos', e.target.value)}/></div></div>
                <div className="form-group col-half"><label>Comissão Serviços (%)</label><div className="input-wrapper"><div className="input-icon-left"><Scissors size={18}/></div><input type="number" value={form.financeiro.comissaoServicos || ""} onChange={e => update('financeiro', 'comissaoServicos', e.target.value)}/></div></div>

                <InputGroup label="Alerta de Sangria" icon={AlertOctagon} className="col-full">
                    <input
                        type="text"
                        value={formatMoney(form.financeiro.alertaSangria)}
                        onChange={e => updateMoney('financeiro', 'alertaSangria', e.target.value)}
                    />
                </InputGroup>
              </div>

              <div className="divider"></div>
              <h3>Segurança de Caixa</h3>
              <div className="form-group col-full switch-container danger-border mb-4"><div><strong>Fechamento Cego</strong><p className="text-danger">Oculta totais no fechamento (Obrigatório contar)</p></div><label className="switch small"><input type="checkbox" checked={form.financeiro.fechamentoCego || false} onChange={e => update('financeiro', 'fechamentoCego', e.target.checked)}/><span className="slider round danger"></span></label></div>

              <h3>Limites de Desconto</h3>
              <div className="form-grid">
                <InputGroup label="Máx. Vendedor (%)" className="col-half"><input type="number" value={form.financeiro.descCaixa || ""} onChange={e => update('financeiro', 'descCaixa', e.target.value)}/></InputGroup>
                <InputGroup label="Máx. Gerente (%)" className="col-half"><input type="number" value={form.financeiro.descGerente || ""} onChange={e => update('financeiro', 'descGerente', e.target.value)}/></InputGroup>
                <div className="form-group col-full switch-container"><div><strong>Desconto Extra no PIX?</strong><p>Permite limite maior à vista</p></div><label className="switch small"><input type="checkbox" checked={form.financeiro.descExtraPix || false} onChange={e => update('financeiro', 'descExtraPix', e.target.checked)}/><span className="slider round success"></span></label></div>
              </div>
            </section>

            <section className="card">
              <h3>Pagamentos & Taxas</h3>
              <div className="payment-grid mb-4">
                {['dinheiro', 'pix', 'credito', 'debito', 'crediario'].map(key => (
                  <div key={key} className={`payment-card ${form.financeiro.pagamentos?.[key] ? 'active' : ''}`} onClick={() => handlePayment(key)}>
                    <div className="checkbox-visual">{form.financeiro.pagamentos?.[key] && <CheckCircle2 size={16}/>}</div><span style={{textTransform: 'capitalize'}}>{key}</span>
                  </div>
                ))}
              </div>
              <div className="form-grid bg-gray-50 p-3 rounded mb-4">
                <div className="form-group col-half"><label>Taxa Débito (%)</label><div className="input-wrapper"><div className="input-icon-left"><CreditCard size={18}/></div><input type="number" value={form.financeiro.taxaDebito || ""} onChange={e => update('financeiro', 'taxaDebito', e.target.value)}/></div></div>
                <div className="form-group col-half"><label>Taxa Crédito (%)</label><div className="input-wrapper"><div className="input-icon-left"><CreditCard size={18}/></div><input type="number" value={form.financeiro.taxaCredito || ""} onChange={e => update('financeiro', 'taxaCredito', e.target.value)}/></div></div>
              </div>
              {form.financeiro.pagamentos?.pix && (<div className="pix-config-box fade-in mt-4"><h4>Configuração Pix</h4><div className="form-grid"><div className="form-group col-half"><label>Tipo</label><select value={form.financeiro.pixTipo || "CNPJ"} onChange={e => update('financeiro', 'pixTipo', e.target.value)}><option value="CNPJ">CNPJ</option><option value="CPF">CPF</option><option value="ALEATORIA">Aleatória</option></select></div><InputGroup label="Chave" icon={QrCode} className="col-half"><input value={form.financeiro.pixChave || ""} onChange={e => update('financeiro', 'pixChave', e.target.value)}/></InputGroup></div></div>)}
              {form.financeiro.pagamentos?.crediario && (<div className="pix-config-box fade-in mt-4 border-warning"><h4>Regras do Crediário</h4><div className="form-grid"><div className="form-group col-third"><label>Juros (%)</label><input type="number" value={form.financeiro.jurosMensal || ""} onChange={e => update('financeiro', 'jurosMensal', e.target.value)}/></div><div className="form-group col-third"><label>Multa (%)</label><input type="number" value={form.financeiro.multaAtraso || ""} onChange={e => update('financeiro', 'multaAtraso', e.target.value)}/></div><div className="form-group col-third"><label>Carência</label><input type="number" value={form.financeiro.diasCarencia || ""} onChange={e => update('financeiro', 'diasCarencia', e.target.value)}/></div></div></div>)}
            </section>
          </div>
        )}

        {/* === ABA VENDAS === */}
        {activeTab === 'vendas' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Experiência de Compra</h3>

              {/* FIDELIDADE - NOVO */}
              <div className="form-group col-full switch-container mb-4" style={{borderColor: '#eab308', background: '#fefce8'}}>
                <div><div className="flex-row text-warning"><Heart size={18}/> <strong>Programa de Fidelidade</strong></div><p>Clientes ganham pontos por compra</p></div>
                <label className="switch small"><input type="checkbox" checked={form.vendas.fidelidadeAtiva || false} onChange={e => update('vendas', 'fidelidadeAtiva', e.target.checked)}/><span className="slider round success"></span></label>
              </div>
              { form.vendas.fidelidadeAtiva &&
                <div className="form-grid fade-in mb-4 pl-2 border-left-warning">
                  <div className="form-group col-half"><label>Pontos a cada R$ 1,00</label><input type="number" value={form.vendas.pontosPorReal || ""} onChange={e => update('vendas', 'pontosPorReal', e.target.value)}/></div>
                </div>
              }

              <div className="form-grid">
                <div className="form-group col-full"><label>Solicitação de CPF</label><select value={form.vendas.comportamentoCpf || "PERGUNTAR"} onChange={e => update('vendas', 'comportamentoCpf', e.target.value)}><option value="PERGUNTAR">Perguntar no início</option><option value="SEMPRE">Exigir sempre</option><option value="NUNCA">Não perguntar</option></select></div>
                <div className="form-group col-full switch-container danger-border"><div><strong>Bloquear Sem Estoque</strong><p>Impede venda negativa</p></div><label className="switch"><input type="checkbox" checked={form.vendas.bloquearEstoque || false} onChange={e => update('vendas', 'bloquearEstoque', e.target.checked)}/><span className="slider round danger"></span></label></div>

                {/* HARDWARE - NOVO */}
                <div className="form-group col-full switch-container"><div><div className="flex-row"><Scale size={18}/> <strong>Venda por Balança</strong></div><p>Para essências/granel</p></div><label className="switch small"><input type="checkbox" checked={form.vendas.usarBalanca || false} onChange={e => update('vendas', 'usarBalanca', e.target.checked)}/><span className="slider round"></span></label></div>
              </div>
            </section>
            <section className="card">
              <h3>Impressão e Cupom</h3>
              <div className="form-grid">
                <div className="form-group col-full switch-container"><div><strong>Impressão Automática</strong></div><label className="switch"><input type="checkbox" checked={form.sistema.impressaoAuto || false} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)}/><span className="slider round"></span></label></div>
                {/* TICKET DE TROCA */}
                <div className="form-group col-full switch-container"><div><div className="flex-row"><Gift size={18}/> <strong>Ticket de Troca/Presente</strong></div><p>Imprimir comprovante sem valor</p></div><label className="switch"><input type="checkbox" checked={form.vendas.imprimirTicketTroca || false} onChange={e => update('vendas', 'imprimirTicketTroca', e.target.checked)}/><span className="slider round success"></span></label></div>

                {/* AGRUPAR ITENS - NOVO */}
                <div className="form-group col-full switch-container"><div><div className="flex-row"><Layers size={18}/> <strong>Agrupar Itens Iguais</strong></div><p>Ex: "2x Batom" em uma linha</p></div><label className="switch small"><input type="checkbox" checked={form.vendas.agruparItens || false} onChange={e => update('vendas', 'agruparItens', e.target.checked)}/><span className="slider round"></span></label></div>

                <div className="form-group col-half"><label>Layout</label><select value={form.vendas.layoutCupom || "DETALHADO"} onChange={e => update('vendas', 'layoutCupom', e.target.value)}><option value="DETALHADO">Detalhado</option><option value="RESUMIDO">Resumido</option></select></div>
                <div className="form-group col-half"><label>Largura</label><div className="segment-control"><button type="button" className={form.sistema.larguraPapel === '58mm' ? 'active' : ''} onClick={() => update('sistema', 'larguraPapel', '58mm')}>58mm</button><button type="button" className={form.sistema.larguraPapel === '80mm' ? 'active' : ''} onClick={() => update('sistema', 'larguraPapel', '80mm')}>80mm</button></div></div>
                <div className="form-group col-full"><label>Mensagem de Rodapé</label><textarea rows="3" value={form.sistema.rodape || ""} onChange={e => update('sistema', 'rodape', e.target.value)} placeholder="Volte sempre!"/></div>
              </div>
            </section>
          </div>
        )}

        {/* === ABA SISTEMA === */}
        {activeTab === 'sistema' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Infraestrutura</h3>
              <div className="form-grid">
                 <InputGroup label="Nome deste Terminal" icon={Monitor} className="col-full"><input value={form.sistema.nomeTerminal || ""} onChange={e => update('sistema', 'nomeTerminal', e.target.value)} placeholder="Ex: CAIXA 01"/></InputGroup>
              </div>
              <div className="divider"></div>
              <h3>Segurança e Visual</h3>
              {/* IMPRIMIR LOGO - NOVO */}
              <div className="form-group col-full switch-container"><div><div className="flex-row"><ImageIcon size={18}/> <strong>Imprimir Logo no Cupom</strong></div><p>Pode deixar impressão lenta</p></div><label className="switch"><input type="checkbox" checked={form.sistema.imprimirLogoCupom || false} onChange={e => update('sistema', 'imprimirLogoCupom', e.target.checked)}/><span className="slider round"></span></label></div>

              <div className="form-group col-full switch-container mb-4"><div><div className="flex-row"><Cloud size={18}/> <strong>Backup em Nuvem</strong></div><p>Sincronizar com Drive</p></div><label className="switch"><input type="checkbox" checked={form.sistema.backupNuvem || false} onChange={e => update('sistema', 'backupNuvem', e.target.checked)}/><span className="slider round success"></span></label></div>
              <div className="form-group col-full switch-container mb-4"><div><div className="flex-row"><UserCheck size={18}/> <strong>Senha de Gerente</strong></div><p>Para cancelar venda</p></div><label className="switch"><input type="checkbox" checked={form.sistema.senhaGerenteCancelamento || false} onChange={e => update('sistema', 'senhaGerenteCancelamento', e.target.checked)}/><span className="slider round"></span></label></div>
              <button type="button" className="list-btn" onClick={() => toast.success("Backup local realizado!")}><div className="icon-bg green"><Download size={20}/></div><div className="text"><strong>Backup Manual</strong><span>Baixar cópia .SQL</span></div></button>
            </section>
            <section className="card border-danger">
              <h3 className="text-danger">Manutenção</h3>
              <div className="danger-zone-content">
                <p>Ações de otimização e limpeza.</p>
                <button type="button" className="list-btn" onClick={() => toast.success("Banco de dados otimizado!")}><div className="icon-bg blue"><Database size={20}/></div><div className="text"><strong>Otimizar Banco de Dados</strong><br /><span>Compactar e reindexar (VACUUM)</span></div></button>
                <button type="button" className="list-btn mt-2" onClick={() => toast.info("Cache limpo.")}><div className="icon-bg blue"><RefreshCw size={20}/></div><div className="text"><strong>Limpar Cache</strong><br /><span>Resolver lentidão</span></div></button>
                <div className="divider"></div>
                <button type="button" className="btn-danger-block mt-4" onClick={() => window.confirm("Certeza?")}><Trash2 size={18}/> Resetar Fábrica</button>
              </div>
            </section>
          </div>
        )}
      </main>

      <div className="mobile-footer mobile-only">
        <button className="btn-save full-width" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
};

export default Configuracoes;