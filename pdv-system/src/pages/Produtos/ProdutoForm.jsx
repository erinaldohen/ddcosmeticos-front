import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { produtoService } from '../../services/produtoService';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Save, ArrowLeft, Package, DollarSign,
  Layers, Landmark, DownloadCloud, Upload, Image as ImageIcon,
  Info, PlusCircle, Wand2, Sparkles, AlertCircle, Bot, AlertTriangle, Search
} from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const eanInputRef = useRef(null);
  const skuInputRef = useRef(null);
  const formRef = useRef(null);
  const ncmRef = useRef(null);
  const typingTimer = useRef(null);

  const [loading, setLoading] = useState(false);
  const [searchingEan, setSearchingEan] = useState(false);
  const [validandoFiscal, setValidandoFiscal] = useState(false);
  const [analisandoIA, setAnalisandoIA] = useState(false);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [previewImagem, setPreviewImagem] = useState(null);
  const [sugestoesNcm, setSugestoesNcm] = useState([]);
  const [buscandoNcm, setBuscandoNcm] = useState(false);
  const [descricaoNcmSelecionado, setDescricaoNcmSelecionado] = useState(''); // 🔥 Estado para a Descrição do NCM

  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    descricao: '', codigoBarras: '', referencia: '', ativo: true, marca: '', categoria: '', subcategoria: '',
    unidade: 'UN', ncm: '', cest: '', cst: '102', origem: '0', classificacaoReforma: 'PADRAO',
    impostoSeletivo: false, monofasico: false, urlImagem: '',
    precoCusto: '0,00', precoVenda: '0,00', precoMedio: '0,00', margemLucro: '', markup: '',
    quantidadeEmEstoque: 0, estoqueMinimo: 5, diasParaReposicao: 0, estoqueFiscal: 0, estoqueNaoFiscal: 0,
    lote: '', validade: '',
    revisaoPendente: false
  });

  const parseMoeda = (v) => { if(!v) return 0; if(typeof v === 'number') return v; return parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) || 0; };
  const formatarMoeda = (v) => { if(v === undefined || v === null || v === '') return '0,00'; return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const aplicarMascara = (v) => { const n = v.replace(/\D/g, ""); if(n === "") return ""; return (Number(n)/100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const getImageUrl = (url) => { if(!url) return null; if(url.startsWith('blob:') || url.startsWith('http')) return url; return `http://localhost:8080${url.startsWith('/')?'':'/'}${url}`; };

  useEffect(() => {
    const handleKeyDown = (e) => { if(e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveProduct(false); }};
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  useEffect(() => { if(!isEditMode && eanInputRef.current) eanInputRef.current.focus(); }, [isEditMode]);
  useEffect(() => { if(isEditMode) carregarProduto(); }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
        if (ncmRef.current && !ncmRef.current.contains(event.target)) {
            setSugestoesNcm([]);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ncmRef]);

  const validateField = (name, value) => {
    let errorMsg = '';
    switch (name) {
      case 'descricao': if (!value || value.trim().length < 3) errorMsg = 'Mínimo de 3 letras.'; break;
      case 'precoVenda': if (parseMoeda(value) <= 0) errorMsg = 'Maior que zero.'; break;
      case 'ncm': if (!value || value.length < 2) errorMsg = 'Obrigatório.'; break;
      case 'cst': if (!value) errorMsg = 'Obrigatório.'; break;
      default: break;
    }
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
    return errorMsg === '';
  };

  const handleBlurValidation = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
    if (name === 'ncm') handleValidacaoFiscal();
  };

  const carregarProduto = async () => {
    setLoading(true);
    try {
      const d = await produtoService.obterPorId(id);
      const custo = d.precoCusto || 0; const venda = d.precoVenda || 0;

      let dataValidade = '';
      if (d.validade) {
          const dateObj = new Date(d.validade);
          if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1970) {
              dataValidade = dateObj.toISOString().split('T')[0];
          }
      }

      setFormData({
        ...d,
        ncm: d.ncm||'', cest: d.cest||'', cst: d.cst||'', origem: d.origem||'0',
        marca: d.marca||'', categoria: d.categoria||'', subcategoria: d.subcategoria||'',
        descricao: d.descricao||'', codigoBarras: d.codigoBarras||'', referencia: d.referencia||'',
        urlImagem: d.urlImagem||'', unidade: d.unidade||'UN',
        impostoSeletivo: d.impostoSeletivo||false, monofasico: d.monofasico||false, ativo: d.ativo!==undefined?d.ativo:true,
        estoqueMinimo: d.estoqueMinimo!==null?d.estoqueMinimo:5, diasParaReposicao: d.diasParaReposicao!==null?d.diasParaReposicao:0,
        lote: d.lote || '', validade: dataValidade,
        estoqueFiscal: d.estoqueFiscal||0, estoqueNaoFiscal: d.estoqueNaoFiscal||0,
        quantidadeEmEstoque: (d.estoqueFiscal||0)+(d.estoqueNaoFiscal||0),
        precoCusto: formatarMoeda(d.precoCusto), precoVenda: formatarMoeda(d.precoVenda), precoMedio: formatarMoeda(d.precoMedioPonderado),
        margemLucro: custo>0 && venda>0 ? (((venda-custo)/venda)*100).toFixed(2).replace('.',',') : '',
        markup: custo>0 && venda>0 ? (((venda-custo)/custo)*100).toFixed(2).replace('.',',') : '',
        revisaoPendente: d.revisaoPendente || false
      });
      if(d.urlImagem) setPreviewImagem(d.urlImagem);
    } catch(e) { toast.error("Erro ao carregar produto."); navigate('/produtos'); } finally { setLoading(false); }
  };

  const handlePrecoCustoChange = (e) => {
    const val = aplicarMascara(e.target.value); const custo = parseMoeda(val); const markup = parseFloat(formData.markup?.replace(',','.')||0);
    setFormData(prev => {
      let novaVenda = prev.precoVenda, novaMargem = prev.margemLucro;
      if(markup > 0 && custo > 0) { const v = custo * (1 + (markup/100)); novaVenda = formatarMoeda(v); novaMargem = (((v-custo)/v)*100).toFixed(2).replace('.',','); }
      else { const v = parseMoeda(prev.precoVenda); if(v > 0 && custo > 0) { return { ...prev, precoCusto: val, markup: (((v-custo)/custo)*100).toFixed(2).replace('.',','), margemLucro: (((v-custo)/v)*100).toFixed(2).replace('.',',') }; } }
      return { ...prev, precoCusto: val, precoVenda: novaVenda, margemLucro: novaMargem };
    });
  };

  const handlePrecoVendaChange = (e) => {
    const val = aplicarMascara(e.target.value); const venda = parseMoeda(val); const custo = parseMoeda(formData.precoCusto);
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
      if(parseMoeda(novaVenda) > 0) setErrors(prev => ({...prev, precoVenda: ''}));
      return { ...prev, markup: val, precoVenda: novaVenda, margemLucro: novaMargem };
    });
  };

  // --- LÓGICA DE BUSCA NCM ATIVADA ---
      const triggerNcmSearch = async (termoBusca) => {
          // Só dispara se tiver pelo menos 2 números
          if (!termoBusca || termoBusca.trim().length < 2) {
              setSugestoesNcm([]);
              return;
          }

          setBuscandoNcm(true);
          try {
              // 🔥 Chamada para o serviço que consulta a API (BrasilAPI ou Backend)
              const res = await produtoService.buscarNcms(termoBusca);
              if (Array.isArray(res)) {
                  setSugestoesNcm(res);
              } else {
                  setSugestoesNcm([]);
              }
          } catch (e) {
              console.error("Falha na busca inteligente de NCM:", e);
              setSugestoesNcm([]);
          } finally {
              setBuscandoNcm(false);
          }
      };

      const handleNcmChange = (e) => {
        const v = e.target.value;
        setFormData(prev => ({...prev, ncm: v}));
        setDescricaoNcmSelecionado('');

        if (v.length >= 2) setErrors(prev => ({...prev, ncm: ''}));

        // 🔥 Gerenciamento do Timer para disparar a API após 400ms de pausa na digitação
        if (typingTimer.current) clearTimeout(typingTimer.current);

        if (v.length >= 2) {
            typingTimer.current = setTimeout(() => {
                triggerNcmSearch(v);
            }, 400);
        } else {
            setSugestoesNcm([]);
        }
      };

  const handleValidacaoFiscal = async () => {
      if(!formData.descricao || !formData.ncm || formData.ncm.length < 8) return;

      setValidandoFiscal(true);
      try {
        const res = await api.post('/fiscal/validar', { descricao: formData.descricao, ncm: formData.ncm });
        const d = res.data;

        setFormData(prev => ({
            ...prev,
            ncm: d.ncm || prev.ncm,
            cest: d.cest || prev.cest,
            cst: d.cst || prev.cst,
            monofasico: d.monofasico,
            impostoSeletivo: d.impostoSeletivo
        }));

        // Só avisa "Ajustado" se o Backend realmente alterou o NCM ou o CST
        if((d.ncm && d.ncm !== formData.ncm) || (d.cst && d.cst !== formData.cst)) {
            toast.success("Dados Fiscais Ajustados pela IA Tributária! 🤖");
        }

      } catch(e) {
          console.warn("Validação fiscal ignorada (Backend indisponível ou erro 404).");
      } finally {
          setValidandoFiscal(false);
      }
    };

  const selecionarNcm = (item) => {
    setFormData(prev => ({...prev, ncm: item.codigo}));
    setDescricaoNcmSelecionado(item.descricao); // Guarda a descrição na tela
    setSugestoesNcm([]);
    setErrors(prev => ({...prev, ncm: ''}));
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
    } catch(e) { toast.error("Erro ao gerar EAN."); }
  };

  const handleBuscarEan = async () => {
    const ean = formData.codigoBarras; if(!ean || ean.length < 3) { toast.warning("Código muito curto."); return; }
    setSearchingEan(true); let local = false;
    try {
      const res = await api.get(`/produtos?termo=${ean}&size=1`);
      if(res.data.content?.length > 0 && res.data.content[0].codigoBarras === ean) {
        local = true;
        if(isEditMode && String(res.data.content[0].id) === String(id)) toast.info("Já está a editar este produto.");
        else { toast.error("Produto já cadastrado no sistema!"); setFormData(prev => ({...prev, codigoBarras: ''})); }
      }
    } catch(e) {}

    if(!local) {
      try {
        const dExt = await produtoService.consultarEan(ean);
        if(dExt && (dExt.nome || dExt.descricao)) {
          setFormData(prev => ({...prev, descricao: dExt.nome||dExt.descricao||prev.descricao, urlImagem: dExt.urlImagem||prev.urlImagem, marca: dExt.marca||prev.marca, ncm: dExt.ncm||prev.ncm}));
          if(dExt.urlImagem) setPreviewImagem(dExt.urlImagem);
          toast.success("Encontrado na base nacional!");
          handleAnaliseIA(dExt.nome || dExt.descricao);
        } else toast.info("Novo código. Preencha os dados manualmente.");
      } catch(e) { toast.info("Novo cadastro."); }
      setTimeout(() => skuInputRef.current?.focus(), 100);
    }
    setSearchingEan(false);
  };

  const handleAnaliseIA = async (descricaoParaAnalise = formData.descricao) => {
    if (!descricaoParaAnalise || descricaoParaAnalise.trim().length < 3) { toast.warning("Informe a descrição primeiro."); return; }
    setAnalisandoIA(true);
    try {
      const res = await api.post('/produtos/analisar-ia', { descricao: descricaoParaAnalise, codigoBarras: formData.codigoBarras, marca: formData.marca });
      const iaData = res.data;
      if (iaData) {
        setFormData(prev => ({ ...prev, categoria: iaData.categoria || prev.categoria, subcategoria: iaData.subcategoria || prev.subcategoria, ncm: iaData.ncm || prev.ncm, marca: iaData.marca || prev.marca }));
        toast.success("Análise de IA concluída! ✨");
        if(iaData.ncm) handleValidacaoFiscal();
      }
    } catch (e) { toast.error("Erro ao analisar com IA."); } finally { setAnalisandoIA(false); }
  };

  const handleChange = (e) => {
    const {name, value, type, checked} = e.target;
    setFormData(prev => ({...prev, [name]: type==='checkbox'?checked:value}));
    if (errors[name]) setErrors(prev => ({...prev, [name]: ''}));
  };

  const handleFileChange = (e) => { const f = e.target.files[0]; if(f) { setArquivoImagem(f); setPreviewImagem(URL.createObjectURL(f)); }};

  const saveProduct = async (stay) => {
    const isValidDesc = validateField('descricao', formData.descricao);
    const isValidPreco = validateField('precoVenda', formData.precoVenda);
    const isValidNcm = validateField('ncm', formData.ncm);
    const isValidCst = validateField('cst', formData.cst);

    if (!isValidDesc || !isValidPreco || !isValidNcm || !isValidCst) { toast.error("Corrija os campos obrigatórios em vermelho."); return; }
    if(formRef.current && !formRef.current.checkValidity()) { formRef.current.reportValidity(); return; }

    setLoading(true);
    try {
      const dataValidade = formData.validade ? `${formData.validade}T00:00:00` : null;

      const p = {
        ...formData, precoCusto: parseMoeda(formData.precoCusto), precoVenda: parseMoeda(formData.precoVenda),
        diasParaReposicao: Number(formData.diasParaReposicao)||0, estoqueMinimo: Number(formData.estoqueMinimo)||0, origem: Number(formData.origem),
        validade: dataValidade,
        revisaoPendente: false
      };

      delete p.margemLucro; delete p.markup; delete p.estoqueFiscal; delete p.estoqueNaoFiscal; delete p.quantidadeEmEstoque;
      let res = isEditMode ? await produtoService.atualizar(id, p) : await produtoService.salvar(p);
      if(arquivoImagem && (res.id || id)) await produtoService.uploadImagem(res.id||id, arquivoImagem);
      toast.success("Produto gravado com sucesso!");
      if(stay) window.location.reload(); else navigate('/produtos');
    } catch(e) {
      let msg = e.response?.data?.message || "Erro ao gravar produto.";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <main className="container-fluid animate-fade">
      <header className="page-header">
        <div className="page-title">
          <h1>{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
          <p>Gestão e auditoria fiscal de stock</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate('/produtos')}><ArrowLeft size={18} /> Voltar</button>
        </div>
      </header>

      <div className="form-container">
        {formData.revisaoPendente && isEditMode && (
            <div className="alert-ribbon-warning">
                <AlertTriangle size={24} />
                <div className="alert-text">
                    <strong>Revisão Pendente!</strong>
                    <span>Este produto foi cadastrado rapidamente no caixa. Preencha o <b>Preço de Custo</b>, valide o <b>NCM</b> e salve.</span>
                </div>
            </div>
        )}

        {loading && isEditMode && !formData.descricao ? (
          <div className="loading-state"><div className="spinner"></div><p>A carregar registo...</p></div>
        ) : (
          <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="pf-form-body">

            {/* SEÇÃO 1: BÁSICOS & IMAGEM */}
                        <section className="form-section">
                          <div className="section-header-row">
                            <h2 className="section-title"><Package size={22} /> Identificação e Classificação</h2>
                            <button type="button" className="btn-ia-analyze" onClick={() => handleAnaliseIA()} disabled={analisandoIA} title="A IA analisa a descrição e sugere a Categoria e o NCM correto.">
                                {analisandoIA ? <div className="spinner-micro" /> : <Bot size={18} />}
                                <span className="hide-mobile">Analisar NCM/Cat. via IA</span>
                            </button>
                          </div>

                          <div className="pf-layout-grid">
                            <div className="pf-layout-inputs">
                              <ProdInput
                                label="Descrição Completa *"
                                name="descricao"
                                value={formData.descricao}
                                onChange={handleChange}
                                onBlur={handleBlurValidation}
                                error={errors.descricao}
                                required
                                tooltip="Nome visível para o cliente no PDV e na Nota Fiscal."
                              />

                              <div className="pf-row-fluid">
                                <div className="form-group-modern input-action-group">
                                    <div className="label-row">
                                        <label>EAN / Código de Barras</label>
                                        <span className="tooltip-wrapper" data-tooltip="Código de barras oficial do produto (GTIN/EAN).">
                                            <Info size={14} className="info-icon" />
                                        </span>
                                    </div>
                                    <div className="input-action-wrapper">
                                        <input ref={eanInputRef} type="text" name="codigoBarras" className="pf-input" value={formData.codigoBarras} onChange={handleChange} placeholder="Bipe ou digite..." onKeyDown={(e)=>e.key==='Enter'&&handleBuscarEan()} />
                                        <div className="input-tools">
                                            <button type="button" className="btn-tool magic" onClick={handleGerarEanInterno} title="Gerar Código Interno Automático"><Wand2 size={16} /></button>
                                            <button type="button" className="btn-tool cloud" onClick={handleBuscarEan} title="Buscar cadastro na Nuvem (Base Nacional)">
                                                {searchingEan ? <div className="spinner-micro" /> : <DownloadCloud size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <ProdInput
                                    label="Referência / SKU Interno"
                                    name="referencia"
                                    value={formData.referencia}
                                    onChange={handleChange}
                                    ref={skuInputRef}
                                    tooltip="Código rápido exclusivo da sua loja."
                                />
                              </div>

                              <div className="pf-row-fluid">
                                <ProdInput label="Marca" name="marca" value={formData.marca} onChange={handleChange} />
                                <ProdInput label="Categoria" name="categoria" value={formData.categoria} onChange={handleChange} tooltip="Ex: Perfumaria, Cabelos, Maquiagem." />
                              </div>

                              <div className="pf-row-fluid">
                                <ProdInput label="Subcategoria" name="subcategoria" value={formData.subcategoria} onChange={handleChange} tooltip="Ex: Shampoo, Condicionador, Batom." />
                                <div className="form-group-modern">
                                    <div className="label-row">
                                        <label>Unidade de Medida</label>
                                        <span className="tooltip-wrapper" data-tooltip="Como o produto é vendido. Afeta a emissão fiscal.">
                                            <Info size={14} className="info-icon" />
                                        </span>
                                    </div>
                                    <select name="unidade" value={formData.unidade} onChange={handleChange} className="pf-input">
                                        <option value="UN">Unidade (UN)</option>
                                        <option value="KG">Quilograma (KG)</option>
                                        <option value="LT">Litro (LT)</option>
                                        <option value="CX">Caixa (CX)</option>
                                        <option value="KIT">Kit (KIT)</option>
                                    </select>
                                </div>
                              </div>
                            </div>

                            <div className="pf-layout-image">
                              <div className="image-upload-area">
                                <div className="image-preview-box">
                                  {previewImagem ? <img src={getImageUrl(previewImagem)} alt="Preview" /> : <ImageIcon size={48} color="#cbd5e1" />}
                                </div>
                                <label htmlFor="file-upload" className="btn-upload-img"><Upload size={16} /> Enviar Imagem</label>
                                <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
                                <ProdInput
                                    label="Ou URL Externa:"
                                    name="urlImagem"
                                    value={formData.urlImagem}
                                    onChange={(e)=>{handleChange(e);setPreviewImagem(e.target.value)}}
                                    tooltip="Cole um link direto para a imagem na internet."
                                />
                              </div>
                            </div>
                          </div>
                        </section>

            {/* SEÇÃO 2: FISCAL */}
            <section className="form-section highlight-fiscal">
              <h2 className="section-title text-fiscal"><Landmark size={22} /> Matriz Tributária e Fiscal {validandoFiscal && <span className="validando-badge"><Sparkles size={14}/> Validando Sefaz...</span>}</h2><br />

              <div className="pf-layout-inputs">
                  <div className="pf-row-fluid">

                    <div className="form-group-modern input-action-group" ref={ncmRef}>
                        <div className="label-row">
                            <label>NCM *</label>
                            <Info size={14} className="info-icon" title="Nomenclatura Comum do Mercosul" />
                        </div>
                        <div className="input-action-wrapper">
                            <input
                                type="text" name="ncm"
                                className={`pf-input ${errors.ncm ? 'pf-input-error' : ''}`}
                                value={formData.ncm}
                                onChange={handleNcmChange} // 🔥 Aciona a lógica acima
                                onBlur={handleBlurValidation}
                                placeholder="Digite número ou nome..."
                                autoComplete="off"
                            />
                            <div className="input-tools">
                                <button type="button" className="btn-tool cloud" onClick={() => triggerNcmSearch(formData.ncm)} title="Pesquisar NCM">
                                    {buscandoNcm ? <div className="spinner-micro" /> : <Search size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Exibe erro ou a descrição selecionada em verde */}
                        {errors.ncm ? (
                            <span className="pf-error-msg"><AlertCircle size={12}/> {errors.ncm}</span>
                        ) : descricaoNcmSelecionado ? (
                            <span style={{fontSize: '0.75rem', color: '#059669', fontWeight: '700', marginTop: '4px', display: 'block', lineHeight: '1.2'}}>
                                ✓ {descricaoNcmSelecionado}
                            </span>
                        ) : null}

                        {/* 🔥 LISTA DE SUGESTÕES (DROPDOWN) */}
                        {sugestoesNcm.length > 0 && (
                            <div className="ncm-dropdown" style={{position: 'absolute', width: '100%', zIndex: 100}}>
                                {sugestoesNcm.map((i, x) => (
                                    <div key={x} className="ncm-suggestion-item" onClick={() => selecionarNcm(i)} style={{cursor: 'pointer'}}>
                                        <strong>{i.codigo}</strong>
                                        <span>{i.descricao}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group-modern">
                        <div className="label-row"><label>Origem da Mercadoria</label></div>
                        <select name="origem" value={formData.origem} onChange={handleChange} className="pf-input">
                          <option value="0">0 - Nacional</option><option value="1">1 - Estrangeira (Imp. Direta)</option><option value="2">2 - Estrangeira (Mercado Interno)</option>
                        </select>
                    </div>

                    <ProdInput label="CST / CSOSN *" name="cst" value={formData.cst} onChange={handleChange} onBlur={handleBlurValidation} error={errors.cst} required />
                  </div>

                  <div className="pf-row-fluid">
                    <div className="form-group-modern">
                        <div className="label-row"><label>Reforma Tributária (LC 214)</label></div>
                        <select name="classificacaoReforma" value={formData.classificacaoReforma} onChange={handleChange} className="pf-input border-warning">
                          <option value="PADRAO">Padrão</option><option value="CESTA_BASICA">Cesta Básica (0%)</option><option value="REDUZIDA_60">Reduzida 60%</option><option value="REDUZIDA_30">Reduzida 30%</option><option value="IMUNE">Imune</option>
                        </select>
                    </div>
                    <ProdInput label="CEST (Subst. Tributária)" name="cest" value={formData.cest} onChange={handleChange} />
                  </div>

                  <div className="pf-checkbox-row">
                    <label className="custom-checkbox danger"><input type="checkbox" name="impostoSeletivo" checked={formData.impostoSeletivo} onChange={handleChange}/> <span>Sujeito a Imposto Seletivo</span></label>
                    <label className="custom-checkbox"><input type="checkbox" name="monofasico" checked={formData.monofasico} onChange={handleChange}/> <span>Tributação Monofásica</span></label>
                    <label className="custom-checkbox success"><input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange}/> <span><strong>Ativo no Sistema</strong></span></label>
                  </div>
              </div>
            </section>

            {/* SEÇÃO 3: PRECIFICAÇÃO */}
            <section className="form-section">
              <h2 className="section-title"><DollarSign size={22} /> Formação de Preço</h2><br />

              <div className="pf-layout-inputs">
                  <div className="pf-row-fluid">
                    <ProdInput label="Custo Bruto" value={formData.precoCusto} onChange={handlePrecoCustoChange} className="text-bold" prefix="R$" tooltip="Valor base pago ao fornecedor." />
                    <ProdInput label="Markup" value={formData.markup} onChange={handleMarkupChange} className="text-success text-bold" suffix="%" tooltip="Cálculo: (Venda - Custo) / Custo. Digite para sugerir o Preço Final." />
                    <ProdInput label="Preço Final *" name="precoVenda" value={formData.precoVenda} onChange={handlePrecoVendaChange} onBlur={handleBlurValidation} error={errors.precoVenda} required className="text-primary text-bold" prefix="R$" tooltip="Preço na prateleira. Alterá-lo recalcula o Markup e a Margem." />
                    <ProdInput label="Margem Líquida" value={formData.margemLucro} disabled className="bg-disabled text-bold" suffix="%" tooltip="Cálculo: (Venda - Custo) / Venda. O lucro percentual que fica no caixa." />
                  </div>
              </div>
            </section>

            {/* SEÇÃO 4: ESTOQUE E VALIDADE */}
            <section className="form-section">
              <h2 className="section-title"><Layers size={22} /> Logística e Validade</h2><br />

              <div className="pf-layout-inputs">
                  <div className="pf-row-fluid bg-light-panel">
                    <ProdInput label="Estoque Físico/XML" value={formData.estoqueFiscal||0} disabled className="bg-disabled" tooltip="Entradas automatizadas via notas fiscais." />
                    <ProdInput label="Estoque Avulso" value={formData.estoqueNaoFiscal||0} disabled className="bg-disabled" tooltip="Entradas e saídas manuais (sem nota)." />
                    <ProdInput label="Volume Total" value={formData.quantidadeEmEstoque} disabled className="bg-disabled highlight-blue text-bold" tooltip="Soma automática (Fiscal + Avulso)." />
                  </div>

                  <div className="pf-row-fluid mt-4">
                    <ProdInput label="Estoque Mínimo" name="estoqueMinimo" type="number" value={formData.estoqueMinimo} onChange={handleChange} />
                    <ProdInput label="Ciclo Reposição (Dias)" name="diasParaReposicao" type="number" value={formData.diasParaReposicao} onChange={handleChange} />
                    <ProdInput label="Lote" name="lote" value={formData.lote} onChange={handleChange} />
                    <ProdInput label="Data de Vencimento" name="validade" type="date" value={formData.validade} onChange={handleChange} className="date-input" />
                  </div>
              </div>
            </section>

            <footer className="form-footer">
              {!isEditMode && <button type="button" className="btn-secondary" onClick={(e)=>saveProduct(true)} disabled={loading} title="Salvar e continuar na tela"><PlusCircle size={18}/> Salvar e Novo</button>}
              <button type="button" className="btn-action-primary" onClick={()=>saveProduct(false)} disabled={loading} title="Atalho: Alt+S"><Save size={20}/> {loading?'A gravar...':'Gravar Produto'}</button>
            </footer>

          </form>
        )}
      </div>
    </main>
  );
};

// --- COMPONENTE INPUT OTIMIZADO ---
const ProdInput = React.forwardRef(({ label, name, value, onChange, type="text", className="", required=false, disabled=false, id, onBlur, tooltip, error, prefix, suffix }, ref) => (
  <div className={`form-group-modern ${className}`}>
    <div className="label-row">
        <label htmlFor={id || name}>{label}</label>
        {tooltip && (
            <span className="tooltip-wrapper" data-tooltip={tooltip}>
                <Info size={14} className="info-icon" />
            </span>
        )}
    </div>
    <div className={`input-wrapper ${prefix ? 'has-prefix' : ''} ${suffix ? 'has-suffix' : ''}`}>
        {prefix && <span className="input-prefix">{prefix}</span>}
        <input
          ref={ref} id={id || name} type={type} name={name}
          className={`pf-input ${error ? 'pf-input-error' : ''}`}
          value={value} onChange={onChange} onBlur={onBlur} required={required} disabled={disabled}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
    {error && <span className="pf-error-msg"><AlertCircle size={12}/> {error}</span>}
  </div>
));

export default ProdutoForm;