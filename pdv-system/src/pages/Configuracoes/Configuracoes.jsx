import React, { useState, useEffect } from 'react';
import {
  Store, Save, Upload, Search, Globe,
  Smartphone, Mail, FileText, Server,
  Download, RefreshCw, Trash2, Lock,
  Eye, EyeOff, DollarSign, Printer,
  Clock, HardDrive, FileCheck, QrCode,
  Building, CheckCircle2, CreditCard,
  Banknote, BookOpen // Ícone para Crediário (Caderneta)
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
  numbers: (v) => clean(v)
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
  const [printingTest, setPrintingTest] = useState(false);

  // --- FORM DATA ---
  const [form, setForm] = useState({
    loja: {
      razaoSocial: '', nomeFantasia: '', cnpj: '',
      email: '', telefone: '', site: '', logo: null
    },
    endereco: {
      cep: '', logradouro: '', numero: '',
      complemento: '', bairro: '', cidade: '', uf: ''
    },
    fiscal: {
      ambiente: 'HOMOLOGACAO',
      regime: 'SIMPLES',
      homologacao: { token: '', cscId: '', serie: '900', nfe: '0' },
      producao: { token: '', cscId: '', serie: '1', nfe: '0' },
      certificado: null, senhaCert: ''
    },
    financeiro: {
      margem: 30, custoFixo: 10, imposto: 4,
      descCaixa: 5, descGerente: 20,
      pixTipo: 'CNPJ', pixChave: '',
      // ADICIONADO: crediario
      pagamentos: { dinheiro: true, pix: true, credito: true, debito: true, crediario: false }
    },
    sistema: {
      impressaoAuto: true, larguraPapel: '80mm',
      backupAuto: false, backupHora: '23:00', rodape: ''
    }
  });

  // --- INIT ---
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 600);
  }, []);

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
      fiscal: {
        ...prev.fiscal,
        [amb]: {
          ...prev.fiscal[amb],
          [field]: value
        }
      }
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
          email: data.email || prev.loja.email
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
    setIsSaving(true);
    setTimeout(() => { setIsSaving(false); toast.success("Salvo com sucesso!"); }, 1000);
  };

  const handlePrintTest = () => {
    setPrintingTest(true);
    setTimeout(() => { setPrintingTest(false); toast.info("Teste enviado."); }, 1500);
  };

  if (isLoading) return <div className="loader-container"><div className="spinner"></div><p>Carregando...</p></div>;

  return (
    <div className="config-container">
      <header className="config-header">
        <div><h1>Configurações</h1><p>Painel de controle do sistema.</p></div>
        <button className="btn-save desktop-only" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <RefreshCw className="spin" size={20}/> : <Save size={20}/>} {isSaving ? '...' : 'Salvar'}
        </button>
      </header>

      <nav className="config-tabs">
        <TabButton id="geral" label="Geral e Loja" icon={Store} activeTab={activeTab} setActiveTab={setActiveTab} />
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
            </div>
            <div className="card main-card">
              <h3>Dados da Empresa</h3>
              <div className="form-grid">
                <div className="form-group col-half">
                  <label>CNPJ</label>
                  <div className="input-action-group">
                    <input value={form.loja.cnpj} onChange={e => updateMask('loja', 'cnpj', e.target.value, 'cnpj')} placeholder="00.000.000/0000-00"/>
                    <button type="button" className="btn-search-highlight" onClick={searchCNPJ} disabled={isSearching} data-tooltip="Consultar na Receita">
                      {isSearching ? <div className="spinner-mini white"/> : <Search size={18}/>}
                    </button>
                  </div>
                </div>
                <InputGroup label="Telefone" icon={Smartphone} className="col-half"><input value={form.loja.telefone} onChange={e => updateMask('loja', 'telefone', e.target.value, 'phone')} placeholder="(00) 00000-0000"/></InputGroup>
                <InputGroup label="Razão Social" icon={Building} className="col-full"><input value={form.loja.razaoSocial} onChange={e => update('loja', 'razaoSocial', e.target.value)}/></InputGroup>
                <InputGroup label="Nome Fantasia" icon={Store} className="col-full"><input value={form.loja.nomeFantasia} onChange={e => update('loja', 'nomeFantasia', e.target.value)} className="font-bold"/></InputGroup>
                <InputGroup label="Email" icon={Mail} className="col-half"><input type="email" value={form.loja.email} onChange={e => update('loja', 'email', e.target.value)}/></InputGroup>
                <InputGroup label="Site" icon={Globe} className="col-half"><input value={form.loja.site} onChange={e => update('loja', 'site', e.target.value)}/></InputGroup>
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
              <h3>Certificado</h3>
              <div className="cert-upload-box">
                <FileCheck size={32} className="text-muted mb-4"/>
                <label className="btn-outline full-width">Selecionar Arquivo<input type="file" hidden accept=".pfx,.p12" onChange={handleCertUpload}/></label>
                <small>.pfx ou .p12</small>
                {certValidade && <p className="text-success text-sm mt-2">Validade: {certValidade}</p>}
                <input type="password" placeholder="Senha" className="input-sm text-center mt-2" value={form.fiscal.senhaCert} onChange={e => update('fiscal', 'senhaCert', e.target.value)}/>
              </div>
            </section>

            <section className="card main-card">
              <div className="card-header-row">
                <h3>Emissão</h3>
                <div className="env-toggle">
                  <button type="button" className={form.fiscal.ambiente === 'HOMOLOGACAO' ? 'active warning' : ''} onClick={() => update('fiscal', 'ambiente', 'HOMOLOGACAO')}>TESTE (HML)</button>
                  <button type="button" className={form.fiscal.ambiente === 'PRODUCAO' ? 'active success' : ''} onClick={() => update('fiscal', 'ambiente', 'PRODUCAO')}>PRODUÇÃO</button>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group col-half">
                  <label>Regime Tributário</label>
                  <select value={form.fiscal.regime} onChange={e => update('fiscal', 'regime', e.target.value)}><option value="SIMPLES">Simples Nacional</option><option value="NORMAL">Normal</option></select>
                </div>

                {/* Inputs de Série e Nota Inteligentes */}
                <div className="form-group col-quarter">
                  <label>Série</label>
                  <input
                    type="number"
                    value={form.fiscal[form.fiscal.ambiente.toLowerCase()].serie}
                    onChange={e => updateFiscalEnv('serie', e.target.value)}
                  />
                </div>
                <div className="form-group col-quarter">
                  <label>Nº Nota</label>
                  <input
                    type="number"
                    value={form.fiscal[form.fiscal.ambiente.toLowerCase()].nfe}
                    onChange={e => updateFiscalEnv('nfe', e.target.value)}
                  />
                </div>
              </div>

              <div className="divider"></div>
              <h4>Credenciais CSC ({form.fiscal.ambiente})</h4>

              <div className="form-grid">
                <div className="form-group col-two-thirds">
                  <label>Token CSC</label>
                  <div className="input-action-group">
                    <div className="input-icon-left"><Lock size={18}/></div>
                    <input
                      className="pl-icon"
                      type={showToken ? "text" : "password"}
                      value={form.fiscal[form.fiscal.ambiente.toLowerCase()].token}
                      onChange={e => updateFiscalEnv('token', e.target.value)}
                      placeholder={form.fiscal.ambiente === 'PRODUCAO' ? "Token Produção" : "Token Homologação"}
                    />
                    <button type="button" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                  </div>
                </div>
                <div className="form-group col-third">
                  <label>ID CSC</label>
                  <input
                    className="text-center"
                    placeholder="Ex: 000001"
                    value={form.fiscal[form.fiscal.ambiente.toLowerCase()].cscId}
                    onChange={e => updateFiscalEnv('cscId', e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {/* === ABA FINANCEIRO === */}
        {activeTab === 'financeiro' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Descontos & Margens</h3>
              <div className="form-grid">
                <InputGroup label="Máx. Caixa (%)" className="col-half"><input type="number" value={form.financeiro.descCaixa} onChange={e => update('financeiro', 'descCaixa', e.target.value)}/></InputGroup>
                <InputGroup label="Máx. Gerente (%)" className="col-half"><input type="number" value={form.financeiro.descGerente} onChange={e => update('financeiro', 'descGerente', e.target.value)}/></InputGroup>
                <div className="col-full divider"></div>
                <InputGroup label="Margem Alvo (%)" className="col-half"><input type="number" value={form.financeiro.margem} onChange={e => update('financeiro', 'margem', e.target.value)}/></InputGroup>
                <InputGroup label="Custo Fixo (%)" className="col-half"><input type="number" value={form.financeiro.custoFixo} onChange={e => update('financeiro', 'custoFixo', e.target.value)}/></InputGroup>
              </div>
            </section>

            <section className="card">
              <h3>Pagamentos</h3>
              <div className="payment-grid">
                {['dinheiro', 'pix', 'credito', 'debito', 'crediario'].map(key => (
                  <div key={key} className={`payment-card ${form.financeiro.pagamentos[key] ? 'active' : ''}`} onClick={() => handlePayment(key)}>
                    <div className="checkbox-visual">{form.financeiro.pagamentos[key] && <CheckCircle2 size={16}/>}</div>
                    <span style={{textTransform: 'capitalize'}}>{key}</span>
                  </div>
                ))}
              </div>

              {form.financeiro.pagamentos.pix && (
                <div className="pix-config-box fade-in">
                  <h4>Configuração Pix</h4>
                  <div className="form-grid">
                    <div className="form-group col-half">
                      <label>Tipo Chave</label>
                      <select value={form.financeiro.pixTipo} onChange={e => update('financeiro', 'pixTipo', e.target.value)}>
                        <option value="CNPJ">CNPJ</option><option value="CPF">CPF</option><option value="EMAIL">Email</option><option value="ALEATORIA">Aleatória</option>
                      </select>
                    </div>
                    <InputGroup label="Chave" icon={QrCode} className="col-half">
                      <input value={form.financeiro.pixChave} onChange={e => update('financeiro', 'pixChave', e.target.value)}/>
                    </InputGroup>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* === ABA VENDAS === */}
        {activeTab === 'vendas' && (
          <div className="grid-cards-equal">
            <section className="card">
              <h3>Impressão</h3>
              <div className="form-grid">
                <div className="form-group col-full switch-container">
                  <div><strong>Imprimir Automático</strong><p>Ao finalizar a venda</p></div>
                  <label className="switch"><input type="checkbox" checked={form.sistema.impressaoAuto} onChange={e => update('sistema', 'impressaoAuto', e.target.checked)}/><span className="slider round"></span></label>
                </div>
                <div className="form-group col-full"><label>Largura</label><div className="segment-control"><button type="button" className={form.sistema.larguraPapel === '58mm' ? 'active' : ''} onClick={() => update('sistema', 'larguraPapel', '58mm')}>58mm</button><button type="button" className={form.sistema.larguraPapel === '80mm' ? 'active' : ''} onClick={() => update('sistema', 'larguraPapel', '80mm')}>80mm</button></div></div>
                <div className="form-group col-full"><label>Rodapé</label><textarea rows="3" value={form.sistema.rodape} onChange={e => update('sistema', 'rodape', e.target.value)}/></div>
              </div>
            </section>
            <section className="card">
              <div className="card-header-row"><h3>Backup</h3><button className="btn-outline small" onClick={() => toast.info("Backup manual...")}>Executar Agora</button></div>
              <div className="form-group col-full switch-container mb-4"><div><strong>Backup Diário</strong></div><label className="switch"><input type="checkbox" checked={form.sistema.backupAuto} onChange={e => update('sistema', 'backupAuto', e.target.checked)}/><span className="slider round"></span></label></div>
              {form.sistema.backupAuto && <InputGroup label="Horário" icon={Clock} className="col-half"><input type="time" value={form.sistema.backupHora} onChange={e => update('sistema', 'backupHora', e.target.value)}/></InputGroup>}
            </section>
          </div>
        )}

        {/* === ABA SISTEMA === */}
        {activeTab === 'sistema' && (
          <div className="grid-cards-equal">
            <section className="card"><h3>Manutenção</h3><div className="list-actions"><button type="button" className="list-btn" onClick={() => toast.success("Limpo!")}><div className="icon-bg blue"><RefreshCw size={20}/></div><div className="text"><strong>Limpar Cache</strong><span>Resolver erros</span></div></button><button type="button" className="list-btn" onClick={() => toast.info("Log baixado.")}><div className="icon-bg green"><Download size={20}/></div><div className="text"><strong>Download Logs</strong><span>Para suporte</span></div></button></div></section>
            <section className="card border-danger"><h3>Perigo</h3><p className="text-danger mb-4">Ações irreversíveis.</p><button type="button" className="btn-danger-block" onClick={() => window.confirm("Certeza?")}><Trash2 size={18}/> Resetar Fábrica</button></section>
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