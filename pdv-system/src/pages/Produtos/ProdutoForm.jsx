import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { produtoService } from '../../services/produtoService';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Save, ArrowLeft, Package, Barcode, DollarSign,
  Layers, Landmark, DownloadCloud, Upload, Image as ImageIcon,
  Info, PlusCircle, Wand2, Sparkles, AlertCircle
} from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const eanInputRef = useRef(null);
  const skuInputRef = useRef(null);
  const formRef = useRef(null);
  const typingTimer = useRef(null);

  const [loading, setLoading] = useState(false);
  const [searchingEan, setSearchingEan] = useState(false);
  const [validandoFiscal, setValidandoFiscal] = useState(false);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [previewImagem, setPreviewImagem] = useState(null);
  const [sugestoesNcm, setSugestoesNcm] = useState([]);
  const [buscandoNcm, setBuscandoNcm] = useState(false);

  // ESTADO DE ERROS (Gestão de Erros)
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    descricao: '', codigoBarras: '', referencia: '', ativo: true, marca: '', categoria: '', subcategoria: '',
    unidade: 'UN', ncm: '', cest: '', cst: '102', origem: '0', classificacaoReforma: 'PADRAO',
    impostoSeletivo: false, monofasico: false, urlImagem: '',
    precoCusto: '0,00', precoVenda: '0,00', precoMedio: '0,00', margemLucro: '', markup: '',
    quantidadeEmEstoque: 0, estoqueMinimo: 5, diasParaReposicao: 0, estoqueFiscal: 0, estoqueNaoFiscal: 0
  });

  // --- HELPERS ---
  const parseMoeda = (v) => { if(!v) return 0; if(typeof v === 'number') return v; return parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) || 0; };
  const formatarMoeda = (v) => { if(v === undefined || v === null || v === '') return '0,00'; return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const aplicarMascara = (v) => { const n = v.replace(/\D/g, ""); if(n === "") return ""; return (Number(n)/100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const getImageUrl = (url) => { if(!url) return null; if(url.startsWith('blob:') || url.startsWith('http')) return url; return `http://localhost:8080${url.startsWith('/')?'':'/'}${url}`; };

  // --- EFEITOS ---
  useEffect(() => {
    const handleKeyDown = (e) => { if(e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveProduct(false); }};
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  // Condução: Foco automático no primeiro campo essencial
  useEffect(() => { if(!isEditMode && eanInputRef.current) eanInputRef.current.focus(); }, [isEditMode]);
  useEffect(() => { if(isEditMode) carregarProduto(); }, [id]);

  // --- VALIDAÇÃO (Prevenção de Erros) ---
  const validateField = (name, value) => {
    let errorMsg = '';

    // Regras de validação
    switch (name) {
      case 'descricao':
        if (!value || value.trim().length < 3) errorMsg = 'Descrição é obrigatória (mín. 3 letras).';
        break;
      case 'precoVenda':
        if (parseMoeda(value) <= 0) errorMsg = 'Preço de venda deve ser maior que zero.';
        break;
      case 'ncm':
        if (!value || value.length < 2) errorMsg = 'NCM Obrigatório.';
        break;
      case 'cst':
        if (!value) errorMsg = 'CST Obrigatório.';
        break;
      default:
        break;
    }

    setErrors(prev => ({ ...prev, [name]: errorMsg }));
    return errorMsg === '';
  };

  // Wrapper para handleBlur (Validação ao sair do campo)
  const handleBlurValidation = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
    // Se for NCM, chama a validação fiscal também
    if (name === 'ncm') handleValidacaoFiscal();
  };

  // --- CARREGAMENTO ---
  const carregarProduto = async () => {
    setLoading(true);
    try {
      const d = await produtoService.obterPorId(id);
      const custo = d.precoCusto || 0; const venda = d.precoVenda || 0;
      setFormData({
        ...d,
        ncm: d.ncm||'', cest: d.cest||'', cst: d.cst||'', origem: d.origem||'0',
        marca: d.marca||'', categoria: d.categoria||'', subcategoria: d.subcategoria||'',
        descricao: d.descricao||'', codigoBarras: d.codigoBarras||'', referencia: d.referencia||'',
        urlImagem: d.urlImagem||'', unidade: d.unidade||'UN',
        impostoSeletivo: d.impostoSeletivo||false, monofasico: d.monofasico||false, ativo: d.ativo!==undefined?d.ativo:true,
        estoqueMinimo: d.estoqueMinimo!==null?d.estoqueMinimo:5, diasParaReposicao: d.diasParaReposicao!==null?d.diasParaReposicao:0,
        estoqueFiscal: d.estoqueFiscal||0, estoqueNaoFiscal: d.estoqueNaoFiscal||0,
        quantidadeEmEstoque: (d.estoqueFiscal||0)+(d.estoqueNaoFiscal||0),
        precoCusto: formatarMoeda(d.precoCusto), precoVenda: formatarMoeda(d.precoVenda), precoMedio: formatarMoeda(d.precoMedioPonderado),
        margemLucro: custo>0 && venda>0 ? (((venda-custo)/venda)*100).toFixed(2).replace('.',',') : '',
        markup: custo>0 && venda>0 ? (((venda-custo)/custo)*100).toFixed(2).replace('.',',') : ''
      });
      if(d.urlImagem) setPreviewImagem(d.urlImagem);
    } catch(e) { toast.error("Erro ao carregar produto."); navigate('/produtos'); } finally { setLoading(false); }
  };

  // --- CÁLCULOS (Carga de Trabalho Reduzida) ---
  const handlePrecoCustoChange = (e) => {
    const val = aplicarMascara(e.target.value); const custo = parseMoeda(val); const markup = parseFloat(formData.markup?.replace(',','.')||0);
    setFormData(prev => {
      let novaVenda = prev.precoVenda, novaMargem = prev.margemLucro;
      if(markup > 0 && custo > 0) {
        const v = custo * (1 + (markup/100)); novaVenda = formatarMoeda(v); novaMargem = (((v-custo)/v)*100).toFixed(2).replace('.',',');
      } else {
        const v = parseMoeda(prev.precoVenda);
        if(v > 0 && custo > 0) { return { ...prev, precoCusto: val, markup: (((v-custo)/custo)*100).toFixed(2).replace('.',','), margemLucro: (((v-custo)/v)*100).toFixed(2).replace('.',',') }; }
      }
      return { ...prev, precoCusto: val, precoVenda: novaVenda, margemLucro: novaMargem };
    });
  };

  const handlePrecoVendaChange = (e) => {
    const val = aplicarMascara(e.target.value); const venda = parseMoeda(val); const custo = parseMoeda(formData.precoCusto);
    // Remove erro se valor for válido
    if(parseMoeda(val) > 0) setErrors(prev => ({...prev, precoVenda: ''}));

    setFormData(prev => {
      let novoMarkup = prev.markup, novaMargem = prev.margemLucro;
      if(custo > 0) { novoMarkup = (((venda-custo)/custo)*100).toFixed(2).replace('.',','); if(venda > 0) novaMargem = (((venda-custo)/venda)*100).toFixed(2).replace('.',','); }
      return { ...prev, precoVenda: val, markup: novoMarkup, margemLucro: novaMargem };
    });
  };

  const handleMarkupChange = (e) => {
    const val = e.target.value; const markup = parseFloat(val.replace(',','.')); const custo = parseMoeda(formData.precoCusto);
    setFormData(prev => {
      let novaVenda = prev.precoVenda, novaMargem = prev.margemLucro;
      if(custo > 0 && !isNaN(markup)) { const v = custo * (1 + (markup/100)); novaVenda = formatarMoeda(v); if(v > 0) novaMargem = (((v-custo)/v)*100).toFixed(2).replace('.',','); }
      // Remove erro de preço venda pois ele foi recalculado
      if(parseMoeda(novaVenda) > 0) setErrors(prev => ({...prev, precoVenda: ''}));
      return { ...prev, markup: val, precoVenda: novaVenda, margemLucro: novaMargem };
    });
  };

  // --- NCM & API ---
  const handleNcmChange = (e) => {
    const v = e.target.value; setFormData(prev => ({...prev, ncm: v}));
    if (v.length >= 2) setErrors(prev => ({...prev, ncm: ''})); // Limpa erro ao digitar
    if(typingTimer.current) clearTimeout(typingTimer.current);
    if(v.length >= 2) {
      setBuscandoNcm(true);
      typingTimer.current = setTimeout(async () => {
        try { const res = await produtoService.buscarNcms(v); if(Array.isArray(res)) setSugestoesNcm(res.slice(0,10)); }
        catch(e) { console.error(e); } finally { setBuscandoNcm(false); }
      }, 400);
    } else setSugestoesNcm([]);
  };

  const handleValidacaoFiscal = async () => {
    if(!formData.descricao) return; setValidandoFiscal(true);
    try {
      const res = await api.post('/fiscal/validar', { descricao: formData.descricao, ncm: formData.ncm });
      const d = res.data;
      setFormData(prev => ({ ...prev, ncm: d.ncm||prev.ncm, cest: d.cest||prev.cest, cst: d.cst||prev.cst, monofasico: d.monofasico, impostoSeletivo: d.impostoSeletivo }));
      if(d.ncm && d.ncm !== formData.ncm) toast.success("Dados Fiscais Ajustados! 🤖");
    } catch(e) {} finally { setValidandoFiscal(false); }
  };

  const selecionarNcm = (item) => {
    setFormData(prev => ({...prev, ncm: item.codigo}));
    setSugestoesNcm([]);
    setErrors(prev => ({...prev, ncm: ''})); // Limpa erro
    setTimeout(handleValidacaoFiscal, 100);
  };

  const handleGerarEanInterno = async () => {
    try {
      const res = await produtoService.gerarEanInterno();
      let val = (typeof res === 'object' && res !== null) ? (res.data || res.ean || res.message || '') : String(res);
      if(typeof val === 'object') val = JSON.stringify(val);
      setFormData(prev => ({...prev, codigoBarras: val}));
      if(val) { toast.info(`Gerado: ${val}`); setTimeout(() => skuInputRef.current?.focus(), 100); }
      else toast.warning("Código vazio.");
    } catch(e) { console.error(e); toast.error("Erro ao gerar EAN."); }
  };

  const handleBuscarEan = async () => {
    const ean = formData.codigoBarras; if(!ean || ean.length < 3) { toast.warning("Muito curto."); return; }
    setSearchingEan(true); let local = false;
    try {
      const res = await api.get(`/produtos?termo=${ean}&size=1`);
      if(res.data.content?.length > 0 && res.data.content[0].codigoBarras === ean) {
        local = true;
        if(isEditMode && String(res.data.content[0].id) === String(id)) toast.info("Mesmo produto.");
        else { toast.error("Já cadastrado!"); setFormData(prev => ({...prev, codigoBarras: ''})); }
      }
    } catch(e) {}
    if(!local) {
      try {
        const dExt = await produtoService.consultarEan(ean);
        if(dExt && (dExt.nome || dExt.descricao)) {
          setFormData(prev => ({...prev, descricao: dExt.nome||dExt.descricao||prev.descricao, urlImagem: dExt.urlImagem||prev.urlImagem, marca: dExt.marca||prev.marca, ncm: dExt.ncm||prev.ncm}));
          if(dExt.urlImagem) setPreviewImagem(dExt.urlImagem);
          toast.success("Encontrado!");
        } else toast.info("Novo código.");
      } catch(e) { toast.info("Novo cadastro."); }
      setTimeout(() => skuInputRef.current?.focus(), 100);
    }
    setSearchingEan(false);
  };

  const handleChange = (e) => {
    const {name, value, type, checked} = e.target;
    setFormData(prev => ({...prev, [name]: type==='checkbox'?checked:value}));

    // Limpa erro ao digitar
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const handleFileChange = (e) => { const f = e.target.files[0]; if(f) { setArquivoImagem(f); setPreviewImagem(URL.createObjectURL(f)); }};

  const saveProduct = async (stay) => {
    // 1. Validação Manual Final
    const isValidDesc = validateField('descricao', formData.descricao);
    const isValidPreco = validateField('precoVenda', formData.precoVenda);
    const isValidNcm = validateField('ncm', formData.ncm);
    const isValidCst = validateField('cst', formData.cst);

    if (!isValidDesc || !isValidPreco || !isValidNcm || !isValidCst) {
        toast.error("Corrija os campos em vermelho.");
        return;
    }

    if(formRef.current && !formRef.current.checkValidity()) { formRef.current.reportValidity(); return; }

    setLoading(true);
    try {
      const p = {
        ...formData, precoCusto: parseMoeda(formData.precoCusto), precoVenda: parseMoeda(formData.precoVenda),
        diasParaReposicao: Number(formData.diasParaReposicao)||0, estoqueMinimo: Number(formData.estoqueMinimo)||0, origem: Number(formData.origem)
      };
      delete p.margemLucro; delete p.markup; delete p.estoqueFiscal; delete p.estoqueNaoFiscal; delete p.quantidadeEmEstoque;
      let res = isEditMode ? await produtoService.atualizar(id, p) : await produtoService.salvar(p);
      if(arquivoImagem && (res.id || id)) await produtoService.uploadImagem(res.id||id, arquivoImagem);
      toast.success("Salvo!");
      if(stay) window.location.reload(); else navigate('/produtos');
    } catch(e) {
      let msg = "Erro desconhecido.";
      if(e.response?.data?.message) msg = e.response.data.message;
      else if(e.response?.status === 404) msg = "Verifique NCM ou Categoria.";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <main className="container-fluid">
      <header className="page-header">
        <div className="page-title">
          <h1>{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
          <p>Cadastro seguro com validação inteligente</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/produtos')}><ArrowLeft size={18} /> Voltar</button>
        </div>
      </header>

      <div className="form-container">
        {loading && isEditMode && !formData.descricao ? (
          <div className="loading-screen"><div className="spinner"></div> Carregando...</div>
        ) : (
          <form ref={formRef} onSubmit={(e) => e.preventDefault()}>

            {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS */}
            <section className="form-section">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                <h2 className="section-title" style={{marginBottom:0}}><Package size={20} /> Informações Básicas</h2>
                <div className="mandatory-legend"><span className="mandatory-star">*</span> Obrigatório</div>
              </div>

              <div className="form-row">
                <ProdInput
                  label="Descrição Completa *"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  onBlur={handleBlurValidation}
                  error={errors.descricao}
                  required
                />
              </div>

              <div style={{display:'flex', gap:30, flexWrap:'wrap', alignItems:'flex-start'}}>
                <div style={{flex:2}}>
                  <div className="form-row">
                    {/* CAMPO EAN COM FERRAMENTAS */}
                    <div className="form-group flex-1">
                      <div className="floating-group input-action-group">
                        <input
                          id="codigoBarras"
                          ref={eanInputRef}
                          type="text"
                          name="codigoBarras"
                          className="ff-input-floating"
                          value={formData.codigoBarras}
                          onChange={handleChange}
                          placeholder=" "
                          onKeyDown={(e)=>e.key==='Enter'&&handleBuscarEan()}
                        />
                        <label className="ff-label-floating">EAN / Código</label>
                        <div className="input-tools">
                          <button type="button" className="btn-tool magic" onClick={handleGerarEanInterno} data-tip="Gerar Sequencial">
                            <Wand2 size={18} />
                          </button>
                          <button type="button" className="btn-tool cloud" onClick={handleBuscarEan} data-tip="Consultar na Nuvem">
                            {searchingEan ? <div className="spinner-micro" /> : <DownloadCloud size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <ProdInput label="Referência / SKU" name="referencia" value={formData.referencia} onChange={handleChange} ref={skuInputRef} tooltip="Código interno rápido." className="flex-1" />
                  </div>

                  <div className="form-row">
                    <ProdInput label="Marca" name="marca" value={formData.marca} onChange={handleChange} className="flex-1" />
                    <ProdInput label="Categoria" name="categoria" value={formData.categoria} onChange={handleChange} className="flex-1" />
                  </div>

                  <div className="form-row">
                    <div className="form-group flex-small">
                      <div className="floating-group">
                        <select name="unidade" className="ff-input-floating" value={formData.unidade} onChange={handleChange}>
                          <option value="UN">UN</option><option value="KG">KG</option><option value="LT">LT</option><option value="CX">CX</option><option value="KIT">KIT</option>
                        </select>
                        <label className="ff-label-floating">Unidade</label>
                      </div>
                    </div>
                    <ProdInput label="Subcategoria" name="subcategoria" value={formData.subcategoria} onChange={handleChange} className="flex-1" />
                  </div>
                </div>

                {/* ÁREA DE IMAGEM */}
                <figure className="image-upload-area" style={{flex:1, minWidth:220, margin:0}}>
                  <div className="image-preview-box">
                    {previewImagem ? <img src={getImageUrl(previewImagem)} alt="Preview" style={{width:'100%', height:'100%', objectFit:'contain'}} /> : <ImageIcon size={40} color="#ccc" />}
                  </div>
                  <label htmlFor="file-upload" className="btn-upload"><Upload size={16} /> Alterar Imagem</label>
                  <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
                  <ProdInput label="URL Externa" name="urlImagem" value={formData.urlImagem} onChange={(e)=>{handleChange(e);setPreviewImagem(e.target.value)}} style={{marginTop:10, marginBottom:0}} />
                </figure>
              </div>
            </section>

            {/* SEÇÃO 2: FISCAL */}
            <section className="form-section" style={{borderLeft:'4px solid #f22998'}}>
              <h2 className="section-title"><Landmark size={20} /> Dados Fiscais {validandoFiscal && <span style={{fontSize:'0.8rem', color:'#f22998', marginLeft:10}}><Sparkles size={14} style={{display:'inline'}}/> Otimizando...</span>}</h2>
              <div className="form-row">
                <div className="form-group flex-1" style={{position:'relative'}}>
                  <ProdInput
                    label="NCM *"
                    name="ncm"
                    value={formData.ncm}
                    onChange={handleNcmChange}
                    onBlur={handleBlurValidation}
                    error={errors.ncm}
                    required
                    tooltip="Classificação Fiscal."
                  />
                  {(buscandoNcm||validandoFiscal) && <div className="spinner-mini" style={{top:18}}/>}
                  {sugestoesNcm.length>0 && <div className="ncm-dropdown">{sugestoesNcm.map((i,x)=><div key={x} className="ncm-suggestion-item" onClick={()=>selecionarNcm(i)}><span>{i.codigo}</span><span>{i.descricao}</span></div>)}</div>}
                </div>
                <div className="form-group flex-1">
                  <div className="floating-group">
                    <select name="origem" className="ff-input-floating" value={formData.origem} onChange={handleChange}>
                      <option value="0">0 - Nacional</option><option value="1">1 - Imp. Direta</option><option value="2">2 - Estrang. (Merc. Int)</option>
                    </select>
                    <label className="ff-label-floating">Origem</label>
                  </div>
                </div>
                <ProdInput
                  label="CST / CSOSN *"
                  name="cst"
                  value={formData.cst}
                  onChange={handleChange}
                  onBlur={handleBlurValidation}
                  error={errors.cst}
                  required
                  className="flex-1"
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <div className="floating-group">
                    <select name="classificacaoReforma" className="ff-input-floating" value={formData.classificacaoReforma} onChange={handleChange}>
                      <option value="PADRAO">Padrão</option><option value="CESTA_BASICA">Cesta Básica (0%)</option><option value="REDUZIDA_60">Reduzida 60%</option><option value="REDUZIDA_30">Reduzida 30%</option><option value="IMUNE">Imune</option>
                    </select>
                    <label className="ff-label-floating">Reforma Tributária (LC 214)</label>
                  </div>
                </div>
                <ProdInput label="CEST" name="cest" value={formData.cest} onChange={handleChange} className="flex-1" />
              </div>

              <div className="form-row" style={{backgroundColor:'#fff1f2', padding:15, borderRadius:8, border:'1px solid #fecaca'}}>
                <div className="checkbox-group"><label className="checkbox-label" style={{color:'#991b1b', fontWeight:700}}><input type="checkbox" name="impostoSeletivo" checked={formData.impostoSeletivo} onChange={handleChange}/> Imposto Seletivo</label></div>
                <div className="checkbox-group" style={{marginLeft:20}}><label className="checkbox-label"><input type="checkbox" name="monofasico" checked={formData.monofasico} onChange={handleChange}/> Monofásico</label></div>
                <div className="checkbox-group" style={{marginLeft:20}}><label className="checkbox-label"><input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange}/> Ativo</label></div>
              </div>
            </section>

            {/* SEÇÃO 3: PRECIFICAÇÃO */}
            <section className="form-section">
              <h2 className="section-title"><DollarSign size={20} /> Precificação Inteligente</h2>

              <div className="form-row" style={{alignItems:'flex-start'}}>

                {/* Preço Custo */}
                <div className="form-group flex-1">
                  <div className="floating-group group-money">
                    <input
                      type="text"
                      className="ff-input-floating"
                      value={formData.precoCusto}
                      onChange={handlePrecoCustoChange}
                      placeholder=" "
                    />
                    <span className="prefix">R$</span>
                    <label className="ff-label-floating">Preço Custo</label>
                  </div>
                </div>

                {/* Markup */}
                <div className="form-group" style={{maxWidth:140}}>
                  <div className="floating-group group-percent">
                    <input
                      type="text"
                      className="ff-input-floating"
                      value={formData.markup}
                      onChange={handleMarkupChange}
                      placeholder=" "
                      style={{fontWeight:'bold', color:'#059669'}}
                    />
                    <span className="suffix">%</span>
                    <label className="ff-label-floating">Markup</label>
                    <Info size={16} className="tooltip-icon" data-tip="% sobre custo." />
                  </div>
                </div>

                {/* Preço Venda */}
                <div className="form-group flex-1">
                  <div className="floating-group group-money">
                    <input
                      type="text"
                      name="precoVenda"
                      className={`ff-input-floating ${errors.precoVenda ? 'input-error' : ''}`}
                      value={formData.precoVenda}
                      onChange={handlePrecoVendaChange}
                      onBlur={handleBlurValidation}
                      required
                      placeholder=" "
                      style={{fontWeight:'bold', color:'#6366f1'}}
                    />
                    <span className="prefix">R$</span>
                    <label className="ff-label-floating">Preço Venda *</label>
                    {errors.precoVenda && <span className="error-message"><AlertCircle size={12}/> {errors.precoVenda}</span>}
                  </div>
                </div>

                {/* Margem Real */}
                <div className="form-group" style={{maxWidth:140}}>
                  <div className="floating-group group-percent">
                    <input
                      type="text"
                      className="ff-input-floating"
                      value={formData.margemLucro}
                      disabled
                      placeholder=" "
                      style={{backgroundColor:'#f1f5f9', fontWeight:'bold'}}
                    />
                    <span className="suffix">%</span>
                    <label className="ff-label-floating">Margem</label>
                    <Info size={16} className="tooltip-icon" data-tip="Lucro real final." />
                  </div>
                </div>

              </div>
            </section>

            {/* SEÇÃO 4: ESTOQUE */}
            <section className="form-section">
              <h2 className="section-title"><Layers size={20} /> Controle de Estoque</h2>
              <div className="form-row" style={{backgroundColor:'#f8fafc', padding:16, borderRadius:8, border:'1px dashed #cbd5e1'}}>
                <ProdInput label="Estoque Fiscal" value={formData.estoqueFiscal||0} disabled tooltip="Qtd. via XML." className="flex-1" />
                <ProdInput label="Estoque S/ Nota" value={formData.estoqueNaoFiscal||0} disabled className="flex-1" />
                <div className="form-group flex-1">
                  <div className="floating-group">
                    <input type="text" className="ff-input-floating" value={formData.quantidadeEmEstoque} disabled placeholder=" " style={{backgroundColor:'#e0e7ff', fontWeight:'bold', color:Number(formData.quantidadeEmEstoque)<Number(formData.estoqueMinimo)?'#ef4444':'#312e81'}} />
                    <label className="ff-label-floating">Total Disponível</label>
                  </div>
                </div>
              </div>
              <div className="form-row" style={{marginTop:20}}>
                <ProdInput label="Estoque Mínimo" name="estoqueMinimo" type="number" value={formData.estoqueMinimo} onChange={handleChange} className="flex-1" />
                <ProdInput label="Dias Reposição" name="diasParaReposicao" type="number" value={formData.diasParaReposicao} onChange={handleChange} className="flex-1" />
                <div className="flex-2"></div>
              </div>
            </section>

            <footer className="form-footer">
              {!isEditMode && <button type="button" className="btn-secondary" onClick={(e)=>saveProduct(true)} disabled={loading} title="Salvar e limpar"><PlusCircle size={18}/> Salvar e Novo</button>}
              <button type="button" className="action-btn-primary" onClick={()=>saveProduct(false)} disabled={loading} title="Alt+S"><Save size={18}/> {loading?'Salvando...':'Salvar'}</button>
            </footer>

          </form>
        )}
      </div>
    </main>
  );
};

// --- COMPONENTE INPUT COM SUPORTE A ERRO ---
const ProdInput = React.forwardRef(({ label, name, value, onChange, type="text", className="", required=false, disabled=false, id, onBlur, tooltip, style, error }, ref) => (
  <div className={`form-group ${className}`} style={style}>
    <div className="floating-group">
      <input
        ref={ref} id={id} type={type} name={name}
        className={`ff-input-floating ${error ? 'input-error' : ''}`}
        placeholder=" "
        value={value} onChange={onChange} onBlur={onBlur} required={required} disabled={disabled}
      />
      <label className="ff-label-floating">{label}</label>
      {tooltip && <Info size={16} className="tooltip-icon" data-tip={tooltip} />}
      {error && <span className="error-message"><AlertCircle size={12}/> {error}</span>}
    </div>
  </div>
));

export default ProdutoForm;