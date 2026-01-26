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
  Percent, AlertOctagon, Ban, FileOutput
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Configuracoes.css';

// --- UTILITÁRIOS E MÁSCARAS ---
const clean = (v) => v ? v.replace(/\D/g, '') : '';

const masks = {
  cnpj: (v) => clean(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5').substr(0, 18),
  cep: (v) => clean(v).replace(/^(\d{5})(\d{3})/, '$1-$2').substr(0, 9),
  phone: (v) => {
    let r = clean(v);
    if (r.length > 10) r = r.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (r.length > 5) r = r.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else if (r.length > 2) r = r.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    return r.substr(0, 15);
  },
  ie: (v) => clean(v).substr(0, 9),
  cnae: (v) => clean(v).replace(/^(\d{4})(\d{1})(\d{2})/, '$1-$2/$3').substr(0, 9),
  percent: (v) => {
    let r = v.replace(/\D/g, '');
    return r ? (parseFloat(r) / 100).toFixed(2) : '';
  }
};

// --- COMPONENTES AUXILIARES ---
const TabButton = ({ id, label, icon: Icon, activeTab, setActiveTab }) => (
  <button
    type="button"
    onClick={() => setActiveTab(id)}
    className={`tab-btn ${activeTab === id ? 'active' : ''}`}
  >
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
  const [activeTab, setActiveTab] = useState('geral');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [certValidade, setCertValidade] = useState(null);

  // --- FORM DATA ---
  const [form, setForm] = useState({
    loja: {
      razaoSocial: '', nomeFantasia: '', cnpj: '',
      ie: '', im: '', cnae: '',
      email: '', telefone: '', site: '', instagram: '', // Instagram Adicionado
      isMatriz: true, horarioAbre: '08:00', horarioFecha: '18:00', // Novos campos operacionais
      logo: null
    },
    endereco: {
      cep: '', logradouro: '', numero: '',
      complemento: '', bairro: '', cidade: '', uf: ''
    },
    fiscal: {
      ambiente: 'HOMOLOGACAO',
      regime: '1',
      homologacao: { token: '', cscId: '', serie: '900', nfe: '0' },
      producao: { token: '', cscId: '', serie: '1', nfe: '0' },
      certificado: null, senhaCert: '',
      csrtId: '', csrtHash: '',
      ibptToken: '',
      naturezaPadrao: 'Venda de Mercadorias',
      emailContabil: '', enviarXmlAutomatico: true,
      // NOVOS CAMPOS FISCAIS
      aliquotaInterna: '18.00', // Padrão PE
      modoContingencia: false,
      priorizarMonofasico: true // Crucial para cosméticos
    },
    financeiro: {
      margem: 30, custoFixo: 10, imposto: 4,
      descCaixa: 5, descGerente: 20,
      pixTipo: 'CNPJ', pixChave: '',
      pagamentos: { dinheiro: true, pix: true, credito: true, debito: true, crediario: false },
      // NOVAS REGRAS DE NEGÓCIO
      jurosMensal: '2.00', multaAtraso: '2.00', diasCarencia: 0,
      comissaoPadrao: '1.00', alertaSangria: '500.00'
    },
    vendas: { // NOVA SEÇÃO
      comportamentoCpf: 'PERGUNTAR', // SEMPRE, NUNCA, PERGUNTAR
      bloquearEstoque: true, // Não vende sem estoque
      layoutCupom: 'DETALHADO', // RESUMIDO, DETALHADO
      imprimirVendedor: true
    },
    sistema: {
      impressaoAuto: true, larguraPapel: '80mm',
      backupAuto: false, backupHora: '23:00', rodape: '',
      // NOVOS RECURSOS
      tema: 'light',
      backupNuvem: false,
      senhaGerenteCancelamento: true
    }
  });

  // --- INIT ---
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 600);
    document.documentElement.setAttribute('data-theme', form.sistema.tema);
  }, [form.sistema.tema]);

  // --- HANDLERS ---
  const update = (section, field, value) => {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const updateMask = (section, field, value, type) => {
    update(section, field, masks[type](value));
  };

  const updateFiscalEnv = (field, value) => {
    const amb = form.fiscal.ambiente.toLowerCase();
    setForm(prev => ({
      ...prev,
      fiscal: { ...prev.fiscal, [amb]: { ...prev.fiscal[amb], [field]: value } }
    }));
  };

  const handlePayment = (key) => {
    setForm(prev => ({
      ...prev,
      financeiro: {
        ...prev.financeiro,
        pagamentos: { ...prev.financeiro.pagamentos, [key]: !prev.financeiro.pagamentos[key] }
      }
    }));
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
      setCertValidade("31/12/2026");
      toast.success("Certificado carregado!");
    }
  };

  // --- API ACTIONS ---
  const searchCNPJ = async () => {
    const doc = clean(form.loja.cnpj);
    if (doc.length !== 14) return toast.warning("Digite um CNPJ válido.");
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
        endereco: {
          ...prev.endereco,
          cep: masks.cep(data.cep),
          logradouro: data.logradouro,
          numero: data.numero,
          bairro: data.bairro,
          cidade: data.municipio,
          uf: data.uf,
          complemento: data.complemento || ''
        }
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

  const handleSave = () => {
    if(!form.loja.ie) {
      toast.error("A Inscrição Estadual é obrigatória em PE!");
      setActiveTab('geral');
      return;
    }
    setIsSaving(true);
    setTimeout(() => { setIsSaving(false); toast.success("Configurações salvas!"); }, 1000);
  };

  if (isLoading) return <div className="loader-container"><div className="spinner"></div><p>Carregando...</p></div>;

  return (
    <div className="config-container">
      <header className="config-header">
        <div><h1>Configurações</h1><p>Gestão de Negócio e Fiscal</p></div>
        <div className="header-right">
          {/* TOGGLE TEMA */}
          <button className="btn-icon-only" onClick={() => update('sistema', 'tema', form.sistema.tema === 'light' ? 'dark' : 'light')} title="Alternar Tema">
            {form.sistema.tema === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
          </button>
          <button className="btn-save desktop-only" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <RefreshCw className="spin" size={20}/> : <Save size={20}/>} {isSaving ? '...' : 'Salvar'}
          </button>
        </div>
      </header>

      <nav className="config-tabs">
        <TabButton id="geral" label="Loja" icon={Store} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="fiscal" label="Fiscal" icon={FileText} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="financeiro" label="Financeiro" icon={DollarSign} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="vendas" label="PDV" icon={Printer} activeTab={activeTab} setActiveTab={setActiveTab} />
        <TabButton id="sistema" label="Sistema" icon={Server} activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>

      <main className="config-body fade-in">

        {/* === ABA GERAL === */}
        {activeTab === 'geral' && (
          <div className="grid-layout">
            <div className="card sidebar-card">
              <h3>Identidade</h3>
              <div className="logo-upload-area">
                <div className="preview-box" style={{backgroundImage: `url(${logoPreview})`}}>{!logoPreview && <Store size={40} className="text-muted"/>}</div>
                <label className="btn-outline full-width"><Upload size={16}/> Carregar<input type="file" hidden accept="image/*" onChange={handleLogoUpload}/></label>
                {logoPreview && <button className="btn-text-danger" onClick={() => {setLogoPreview(null); update('loja', 'logo', null);}}>Remover logo</button>}
              </div>
              <div className="divider"></div>

              {/* OPERAÇÃO */}
              <div className="form-group mt-2">
                <label>Tipo de Unidade</label>
                <div className="pill-selector">
                  <button className={form.loja.isMatriz ? 'active' : ''} onClick={() => update('loja', 'isMatriz', true)}>Matriz</button>
                  <button className={!form.loja.isMatriz ? 'active' : ''} onClick={() => update('loja', 'isMatriz', false)}>Filial</button>
                </div>
              </div>
              <div className="form-grid mt-2">
                <div className="form-group col-half"><label>Abertura</label><input type="time" value={form.loja.horarioAbre} onChange={e => update('loja', 'horarioAbre', e.target.value)}/></div>
                <div className="form-group col-half"><label>Fechamento</label><input type="time" value={form.loja.horarioFecha} onChange={e => update('loja', 'horarioFecha', e.target.value)}/></div>
              </div>
            </div>

            <div className="card main-card">
              <h3>Dados da Empresa</h3>
              <div className="form-grid">

                {/* Linha 1 */}
                <div className="form-group col-half">
                  <label>CNPJ</label>
                  <div className="input-action-group">
                    <input value={form.loja.cnpj} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} placeholder="00.000.000/0000-00"/>
                    <button type="button" className="btn-search-highlight" onClick={searchCNPJ} disabled={isSearching} data-tooltip="Consultar na Receita">
                      {isSearching ? <div className="spinner-mini white"/> : <Search size={18}/>}
                    </button>
                  </div>
                </div>
                <InputGroup label="Telefone / WhatsApp" icon={Smartphone} className="col-half"><input value={form.loja.telefone} onChange={e => updateMask('loja', 'telefone', e.target.value, 'phone')} placeholder="(00) 00000-0000"/></InputGroup>

                {/* Linha 2 - Fiscal Básico */}
                <InputGroup label="Inscrição Estadual (IE)" icon={FileText} className="col-half">
                  <input value={form.loja.ie} onChange={e => updateMask('loja', 'ie', e.target.value, 'ie')} placeholder="Obrigatório em PE"/>
                </InputGroup>
                <InputGroup label="Inscrição Municipal (IM)" icon={Building} className="col-half">
                  <input value={form.loja.im} onChange={e => update('loja', 'im', e.target.value)} placeholder="Serviços (Opcional)"/>
                </InputGroup>

                {/* Linha 3 */}
                <InputGroup label="Razão Social" icon={Building} className="col-full"><input value={form.loja.razaoSocial} onChange={e => update('loja', 'razaoSocial', e.target.value)}/></InputGroup>
                <InputGroup label="Nome Fantasia" icon={Store} className="col-full"><input value={form.loja.nomeFantasia} onChange={e => update('loja', 'nomeFantasia', e.target.value)} className="font-bold"/></InputGroup>

                {/* Linha 4 - Marketing e Contato */}
                <InputGroup label="Instagram" icon={Instagram} className="col-half"><input value={form.loja.instagram} onChange={e => update('loja', 'instagram', e.target.value)} placeholder="@loja"/></InputGroup>
                <InputGroup label="Site" icon={Globe} className="col-half"><input value={form.loja.site} onChange={e => update('loja', 'site', e.target.value)}/></InputGroup>
                <InputGroup label="Email Corporativo" icon={Mail} className="col-full"><input type="email" value={form.loja.email} onChange={e => update('loja', 'email', e.target.value)}/></InputGroup>
              </div>

              <div className="divider"></div>
              <h3>Endereço</h3>
              <div className="form-grid">
                <div className="form-group col-third"><label>CEP</label><div className="input-action-group"><input value={form.endereco.cep} onChange={e => updateMask('endereco', 'cep', e.target.value, 'cep')} onBlur={searchCEP}/><button type="button" onClick={searchCEP}><Search size={18}/></button></div></div>
                <div className="form-group col-two-thirds"><label>Logradouro</label><input value={form.endereco.logradouro} onChange={e => update('endereco', 'logradouro', e.target.value)}/></div>
                <div className="form-group col-third"><label>Número</label><input value={form.endereco.numero} onChange={e => update('endereco', 'numero', e.target.value)}/></div>
                <div className="form-group col-third"><label>Bairro</label><input value={form.endereco.bairro} onChange={e => update('endereco', 'bairro', e.target.value)}/></div>
                <div className="form-group col-third"><label>Cidade</label><input value={form.endereco.cidade} onChange={e => update('endereco', 'cidade', e.target.value)}/></div>
                <div className="form-group col-third"><label>UF</label><input value={form.endereco.uf} onChange={e => update('endereco', 'uf', e.target.value)} maxLength={2} className="text-center"/></div>
                <div className="form-group col-two-thirds"><label>Complemento</label><input value={form.endereco.complemento} onChange={e => update('endereco', 'complemento', e.target.value)}/></div>
              </div>
            </div>
          </div>
        )}

        {/* === ABA FISCAL === */}
        {activeTab === 'fiscal' && (
          <div className="grid-layout">
            <section className="card sidebar-card">
              <h3>Certificado Digital A1</h3>
              <div className="cert-upload-box">
                {certValidade ? (
                  <div className="cert-info-card fade-in">
                    <div className="cert-header"><div className="cert-icon-valid"><ShieldCheck size={24}/></div><div><strong>Ativo</strong><span className="text-muted text-xs">CNPJ: {form.loja.cnpj || '...'}</span></div></div>
                    <div className="cert-body"><div className="cert-row"><span>Vence:</span><strong>{certValidade}</strong></div><div className="cert-row"><span>Status:</span><span className="badge-success">Válido</span></div></div>
                    <label className="btn-text-action">Substituir<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload} /></label>
                  </div>
                ) : (
                  <>
                    <div className="cert-icon"><FileCheck size={32}/></div>
                    <label className="btn-outline full-width">Carregar (.pfx)<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload} /></label>
                    <small>.pfx ou .p12 (Max: 100kb)</small>
                  </>
                )}
                <div className="form-group mt-4">
                  <label>Senha do Certificado</label>
                  <div className="input-action-group">
                    <input type={showToken ? "text" : "password"} className="text-center" value={form.fiscal.senhaCert} onChange={e => update('fiscal', 'senhaCert', e.target.value)}/>
                    <button type="button" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                  </div>
                </div>
              </div>

              {/* CONTINGÊNCIA - NOVO */}
              <div className="divider"></div>
              <div className="form-group col-full switch-container danger-border">
                <div><strong>Contingência Offline</strong><p className="text-xs text-danger">Ativar se SEFAZ cair</p></div>
                <label className="switch"><input type="checkbox" checked={form.fiscal.modoContingencia} onChange={e => update('fiscal', 'modoContingencia', e.target.checked)}/><span className="slider round danger"></span></label>
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
                <div className="form-group col-half">
                  <label>Regime Tributário (CRT)</label>
                  <select value={form.fiscal.regime} onChange={e => update('fiscal', 'regime', e.target.value)}>
                    <option value="1">1 - Simples Nacional</option>
                    <option value="2">2 - Simples Nacional (Excesso)</option>
                    <option value="3">3 - Regime Normal</option>
                    <option value="4">4 - MEI</option>
                  </select>
                </div>
                <div className="form-group col-half">
                  <label>CFOP Padrão (Vendas)</label>
                  <input value={form.fiscal.naturezaPadrao} onChange={e => update('fiscal', 'naturezaPadrao', e.target.value)} placeholder="Ex: 5.102"/>
                </div>

                {/* CAMPOS INTELIGENTES POR AMBIENTE */}
                <div className="form-group col-quarter"><label>Série NFC-e</label><input type="number" value={form.fiscal[form.fiscal.ambiente.toLowerCase()].serie} onChange={e => updateFiscalEnv('serie', e.target.value)}/></div>
                <div className="form-group col-quarter"><label>Próx. Nota</label><input type="number" value={form.fiscal[form.fiscal.ambiente.toLowerCase()].nfe} onChange={e => updateFiscalEnv('nfe', e.target.value)}/></div>

                {/* ALÍQUOTA E MONOFÁSICO (COSMÉTICOS) */}
                <div className="form-group col-quarter"><label>ICMS Interno (%)</label><input type="number" value={form.fiscal.aliquotaInterna} onChange={e => update('fiscal', 'aliquotaInterna', e.target.value)}/></div>
                <div className="form-group col-quarter switch-container-vertical">
                  <label>Priorizar Monofásico?</label>
                  <label className="switch small"><input type="checkbox" checked={form.fiscal.priorizarMonofasico} onChange={e => update('fiscal', 'priorizarMonofasico', e.target.checked)}/><span className="slider round"></span></label>
                </div>

                <div className="form-group col-full"><label>Token IBPT (Lei da Transparência)</label><div className="input-wrapper"><div className="input-icon-left"><Calculator size={18}/></div><input value={form.fiscal.ibptToken} onChange={e => update('fiscal', 'ibptToken', e.target.value)} placeholder="Token de impostos..."/></div></div>
              </div>

              <div className="divider"></div>
              <h4>Credenciais CSC e Responsável Técnico</h4>

              <div className="form-grid">
                <div className="form-group col-two-thirds">
                  <label>Token CSC (Código Alfanumérico)</label>
                  <div className="input-action-group">
                    <div className="input-icon-left"><Lock size={18}/></div>
                    <input className="pl-icon" type="text" value={form.fiscal[form.fiscal.ambiente.toLowerCase()].token} onChange={e => updateFiscalEnv('token', e.target.value)} placeholder={form.fiscal.ambiente === 'PRODUCAO' ? "Ex: A1B2-C3D4 (Produção)" : "Ex: 000001 (Homologação)"}/>
                  </div>
                </div>
                <div className="form-group col-third"><label>ID Token (CSC)</label><input className="text-center" placeholder="Ex: 000001" value={form.fiscal[form.fiscal.ambiente.toLowerCase()].cscId} onChange={e => updateFiscalEnv('cscId', e.target.value)}/></div>

                <div className="form-group col-half"><label>ID CSRT (Software House)</label><input value={form.fiscal.csrtId} onChange={e => update('fiscal', 'csrtId', e.target.value)} placeholder="Fornecido pelo sistema"/></div>
                <div className="form-group col-half"><label>Hash CSRT</label><input type="password" value={form.fiscal.csrtHash} onChange={e => update('fiscal', 'csrtHash', e.target.value)} placeholder="Chave secreta"/></div>

                <div className="form-group col-full">
                  <label>E-mail do Contador (Envio XML)</label>
                  <div className="input-wrapper"><div className="input-icon-left"><Mail size={18}/></div><input type="email" value={form.fiscal.emailContabil} onChange={e => update('fiscal', 'emailContabil', e.target.value)} placeholder="contador@escritorio.com"/></div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* === ABA FINANCEIRO === */}
        {activeTab === 'financeiro' && (
          <div className="grid-cards-equal">
            {/* LADO ESQUERDO: GESTÃO */}
            <section className="card">
              <h3>Comissões e Alertas</h3>
              <div className="form-grid">
                <InputGroup label="Comissão Padrão (%)" icon={Percent} className="col-half">
                  <input type="number" value={form.financeiro.comissaoPadrao} onChange={e => update('financeiro', 'comissaoPadrao', e.target.value)}/>
                </InputGroup>
                <InputGroup label="Alerta de Sangria (R$)" icon={AlertOctagon} className="col-half">
                  <input type="number" value={form.financeiro.alertaSangria} onChange={e => update('financeiro', 'alertaSangria', e.target.value)}/>
                </InputGroup>
              </div>

              <div className="divider"></div>
              <h3>Limites de Desconto</h3>
              <div className="form-grid">
                <InputGroup label="Máx. Caixa (%)" className="col-half"><input type="number" value={form.financeiro.descCaixa} onChange={e => update('financeiro', 'descCaixa', e.target.value)}/></InputGroup>
                <InputGroup label="Máx. Gerente (%)" className="col-half"><input type="number" value={form.financeiro.descGerente} onChange={e => update('financeiro', 'descGerente', e.target.value)}/></InputGroup>
              </div>
            </section>

            {/* LADO DIREITO: PAGAMENTOS */}
            <section className="card">
              <h3>Meios de Pagamento</h3>
              <div className="payment-grid">
                {['dinheiro', 'pix', 'credito', 'debito', 'crediario'].map(key => (
                  <div key={key} className={`payment-card ${form.financeiro.pagamentos[key] ? 'active' : ''}`} onClick={() => handlePayment(key)}>
                    <div className="checkbox-visual">{form.financeiro.pagamentos[key] && <CheckCircle2 size={16}/>}</div>
                    <span style={{textTransform: 'capitalize'}}>{key}</span>
                  </div>
                ))}
              </div>

              {form.financeiro.pagamentos.pix && (
                <div className="pix-config-box fade-in mt-4">
                  <h4>Configuração Pix</h4>
                  <div className="form-grid">
                    <div className="form-group col-half"><label>Tipo</label><select value={form.financeiro.pixTipo} onChange={e => update('financeiro', 'pixTipo', e.target.value)}><option value="CNPJ">CNPJ</option><option value="CPF">CPF</option><option value="ALEATORIA">Aleatória</option></select></div>
                    <InputGroup label="Chave" icon={QrCode} className="col-half"><input value={form.financeiro.pixChave} onChange={e => update('financeiro', 'pixChave', e.target.value)}/></InputGroup>
                  </div>
                </div>
              )}

              {/* REGRAS DE CREDIÁRIO (SÓ APARECE SE ATIVADO) */}
              {form.financeiro.pagamentos.crediario && (
                <div className="pix-config-box fade-in mt-4 border-warning">
                  <h4>Regras do Crediário (Fiado)</h4>
                  <div className="form-grid">
                    <div className="form-group col-third"><label>Juros/Mês (%)</label><input type="number" value={form.financeiro.jurosMensal} onChange={e => update('financeiro', 'jurosMensal', e.target.value)}/></div>
                    <div className="form-group col-third"><label>Multa (%)</label><input type="number" value={form.financeiro.multaAtraso} onChange={e => update('financeiro', 'multaAtraso', e.target.value)}/></div>
                    <div className="form-group col-third"><label>Carência (Dias)</label><input type="number" value={form.financeiro.diasCarencia} onChange={e => update('financeiro', 'diasCarencia', e.target.value)}/></div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* === ABA VENDAS (PDV) === */}
        {activeTab === 'vendas' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Comportamento do Caixa</h3>
              <div className="form-grid">
                <div className="form-group col-full">
                  <label>Solicitação de CPF no Cupom</label>
                  <select value={form.vendas.comportamentoCpf} onChange={e => update('vendas', 'comportamentoCpf', e.target.value)}>
                    <option value="PERGUNTAR">Perguntar no início da venda</option>
                    <option value="SEMPRE">Exigir sempre (Obrigatório)</option>
                    <option value="NUNCA">Não perguntar (Agilidade)</option>
                  </select>
                </div>

                <div className="form-group col-full switch-container danger-border">
                  <div><strong>Bloquear Venda Sem Estoque</strong><p>Impede venda negativa</p></div>
                  <label className="switch"><input type="checkbox" checked={form.vendas.bloquearEstoque} onChange={e => update('vendas', 'bloquearEstoque', e.target.checked)}/><span className="slider round danger"></span></label>
                </div>
              </div>
            </section>

            <section className="card">
              <h3>Impressão e Cupom</h3>
              <div className="form-grid">
                <div className="form-group col-full switch-container">
                  <div><strong>Impressão Automática</strong></div>
                  <label className="switch"><input type="checkbox" checked={form.sistema.impressaoAuto} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)}/><span className="slider round"></span></label>
                </div>

                <div className="form-group col-half">
                  <label>Layout do Cupom</label>
                  <select value={form.vendas.layoutCupom} onChange={e => update('vendas', 'layoutCupom', e.target.value)}>
                    <option value="DETALHADO">Detalhado (Produtos + Impostos)</option>
                    <option value="RESUMIDO">Resumido (Ecônomico)</option>
                  </select>
                </div>

                <div className="form-group col-half"><label>Largura</label><div className="segment-control"><button type="button" className={form.sistema.larguraPapel === '58mm' ? 'active' : ''} onClick={() => update('sistema', 'larguraPapel', '58mm')}>58mm</button><button type="button" className={form.sistema.larguraPapel === '80mm' ? 'active' : ''} onClick={() => update('sistema', 'larguraPapel', '80mm')}>80mm</button></div></div>
                <div className="form-group col-full"><label>Mensagem de Rodapé</label><textarea rows="3" value={form.sistema.rodape} onChange={e => update('sistema', 'rodape', e.target.value)} placeholder="Agradecemos a preferência!"/></div>
              </div>
            </section>
          </div>
        )}

        {/* === ABA SISTEMA === */}
        {activeTab === 'sistema' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Segurança de Dados</h3>
              <div className="form-group col-full switch-container mb-4">
                <div><div className="flex-row"><Cloud size={18}/> <strong>Backup em Nuvem</strong></div><p>Sincronizar com Google Drive</p></div>
                <label className="switch"><input type="checkbox" checked={form.sistema.backupNuvem} onChange={e => update('sistema', 'backupNuvem', e.target.checked)}/><span className="slider round success"></span></label>
              </div>
              <div className="form-group col-full switch-container mb-4">
                <div><div className="flex-row"><UserCheck size={18}/> <strong>Exigir Senha de Gerente</strong></div><p>Para cancelar item ou venda</p></div>
                <label className="switch"><input type="checkbox" checked={form.sistema.senhaGerenteCancelamento} onChange={e => update('sistema', 'senhaGerenteCancelamento', e.target.checked)}/><span className="slider round"></span></label>
              </div>
              <div className="divider"></div>
              <button type="button" className="list-btn" onClick={() => toast.success("Backup local realizado!")}><div className="icon-bg green"><Download size={20}/></div><div className="text"><strong>Backup Manual Local</strong><span>Baixar cópia .SQL</span></div></button>
            </section>

            <section className="card border-danger">
              <h3 className="text-danger">Zona de Perigo</h3>
              <div className="danger-zone-content">
                <p>Ações irreversíveis que afetam o funcionamento da loja.</p>
                <button type="button" className="list-btn" onClick={() => toast.info("Cache limpo.")}><div className="icon-bg blue"><RefreshCw size={20}/></div><div className="text"><strong>Limpar Cache do Sistema</strong><span>Resolver lentidão ou bugs</span></div></button>
                <button type="button" className="btn-danger-block mt-4" onClick={() => window.confirm("Certeza? Isso apagará tudo.")}><Trash2 size={18}/> Resetar para Padrão de Fábrica</button>
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