import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { produtoService } from '../../services/produtoService';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Save, ArrowLeft, Package, DollarSign,
  Layers, Landmark, DownloadCloud, Info, PlusCircle, Wand2,
  Sparkles, AlertCircle, Bot, AlertTriangle, Search
} from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = ({ id: propsId, onSave }) => {
  const navigate = useNavigate();
  const routeParams = useParams();
  const id = propsId || routeParams.id;
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

  const [sugestoesNcm, setSugestoesNcm] = useState([]);
  const [buscandoNcm, setBuscandoNcm] = useState(false);
  const [descricaoNcmSelecionado, setDescricaoNcmSelecionado] = useState('');

  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    descricao: '', codigoBarras: '', referencia: '', ativo: true, marca: '', categoria: '', subcategoria: '',
    unidade: 'UN', ncm: '', cest: '', cst: '102', origem: '0', classificacaoReforma: 'PADRAO',
    impostoSeletivo: false, monofasico: false,
    precoCusto: '0,00', precoVenda: '0,00', precoMedio: '0,00', margemLucro: '', markup: '',
    quantidadeEmEstoque: 0, estoqueMinimo: 5, diasParaReposicao: 0, estoqueFiscal: 0, estoqueNaoFiscal: 0,
    lote: '', validade: '',
    revisaoPendente: false
  });

  const parseMoeda = (v) => { if(!v) return 0; if(typeof v === 'number') return v; return parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) || 0; };
  const formatarMoeda = (v) => { if(v === undefined || v === null || v === '') return '0,00'; return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const aplicarMascara = (v) => { const n = v.replace(/\D/g, ""); if(n === "") return ""; return (Number(n)/100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  // 🔥 RAIO-X DE INTEGRIDADE DO FRONTEND
  const isProdutoIntegro = () => {
      const pVenda = parseMoeda(formData.precoVenda);
      const temPrecoVenda = pVenda > 0;
      const temNcmValido = formData.ncm && formData.ncm.length >= 8 && formData.ncm !== '00000000';
      const temEanValido = formData.codigoBarras && formData.codigoBarras.length >= 8 && formData.codigoBarras !== 'S/N';
      return temPrecoVenda && temNcmValido && temEanValido;
  };

  useEffect(() => {
    const handleKeyDown = (e) => { if(e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveProduct(false); }};
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  useEffect(() => { if(!isEditMode && eanInputRef.current) eanInputRef.current.focus(); }, [isEditMode]);
  useEffect(() => { if(isEditMode) carregarProduto(); }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => { if (ncmRef.current && !ncmRef.current.contains(event.target)) setSugestoesNcm([]); };
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
          if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1970) dataValidade = dateObj.toISOString().split('T')[0];
      }

      setFormData({
        ...d,
        ncm: d.ncm||'', cest: d.cest||'', cst: d.cst||'', origem: d.origem||'0',
        marca: d.marca||'', categoria: d.categoria||'', subcategoria: d.subcategoria||'',
        descricao: d.descricao||'', codigoBarras: d.codigoBarras||'', referencia: d.referencia||'',
        unidade: d.unidade||'UN', impostoSeletivo: d.impostoSeletivo||false, monofasico: d.monofasico||false, ativo: d.ativo!==undefined?d.ativo:true,
        estoqueMinimo: d.estoqueMinimo!==null?d.estoqueMinimo:5, diasParaReposicao: d.diasParaReposicao!==null?d.diasParaReposicao:0,
        lote: d.lote || '', validade: dataValidade,
        estoqueFiscal: d.estoqueFiscal||0, estoqueNaoFiscal: d.estoqueNaoFiscal||0,
        quantidadeEmEstoque: (d.estoqueFiscal||0)+(d.estoqueNaoFiscal||0),
        precoCusto: formatarMoeda(d.precoCusto), precoVenda: formatarMoeda(d.precoVenda), precoMedio: formatarMoeda(d.precoMedioPonderado),
        margemLucro: custo>0 && venda>0 ? (((venda-custo)/venda)*100).toFixed(2).replace('.',',') : '',
        markup: custo>0 && venda>0 ? (((venda-custo)/custo)*100).toFixed(2).replace('.',',') : '',
        revisaoPendente: d.revisaoPendente || false
      });
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

  const triggerNcmSearch = async (termoBusca) => {
      if (!termoBusca || termoBusca.trim().length < 2) { setSugestoesNcm([]); return; }
      setBuscandoNcm(true);
      try {
          const response = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${encodeURIComponent(termoBusca)}`);
          if (response.ok) {
              const data = await response.json();
              setSugestoesNcm(data.slice(0, 15).map(item => ({ codigo: item.codigo, descricao: item.descricao })));
          } else setSugestoesNcm([]);
      } catch (e) { setSugestoesNcm([]); } finally { setBuscandoNcm(false); }
  };

  const handleNcmChange = (e) => {
      const v = e.target.value;
      setFormData(prev => ({...prev, ncm: v})); setDescricaoNcmSelecionado('');
      if (v.length >= 2) setErrors(prev => ({...prev, ncm: ''}));
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (v.length >= 2) { typingTimer.current = setTimeout(() => { triggerNcmSearch(v); }, 400); }
      else { setSugestoesNcm([]); }
  };

  const selecionarNcm = (item) => {
      setFormData(prev => ({...prev, ncm: item.codigo}));
      setDescricaoNcmSelecionado(item.descricao); setSugestoesNcm([]); setErrors(prev => ({...prev, ncm: ''}));
      setTimeout(handleValidacaoFiscal, 100);
  };

  const handleValidacaoFiscal = async () => {
      if(!formData.descricao || !formData.ncm || formData.ncm.length < 8) return;
      setValidandoFiscal(true);
      try {
        const res = await api.post('/fiscal/validar', { descricao: formData.descricao, ncm: formData.ncm });
        const d = res.data;
        setFormData(prev => ({ ...prev, ncm: d.ncm || prev.ncm, cest: d.cest || prev.cest, cst: d.cst || prev.cst, monofasico: d.monofasico, impostoSeletivo: d.impostoSeletivo }));
        if((d.ncm && d.ncm !== formData.ncm) || (d.cst && d.cst !== formData.cst)) toast.success("Dados Fiscais Ajustados pela IA Tributária! 🤖");
      } catch(e) { console.warn("Validação fiscal ignorada."); } finally { setValidandoFiscal(false); }
  };

  const handleGerarEanInterno = async () => {
    try {
      const res = await produtoService.gerarEanInterno();
      let val = (typeof res === 'object' && res !== null) ? (res.data || res.ean || res.message || '') : String(res);
      if(typeof val === 'object') val = JSON.stringify(val);
      setFormData(prev => ({...prev, codigoBarras: val}));
      if(val) { toast.info(`Gerado: ${val}`); setTimeout(() => skuInputRef.current?.focus(), 100); }
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
          setFormData(prev => ({...prev, descricao: dExt.nome||dExt.descricao||prev.descricao, marca: dExt.marca||prev.marca, ncm: dExt.ncm||prev.ncm}));
          toast.success("Encontrado na base nacional!");
          handleAnaliseIA(dExt.nome || dExt.descricao);
        } else toast.info("Novo código. Preencha manualmente.");
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
        revisaoPendente: !isProdutoIntegro()
      };

      delete p.margemLucro; delete p.markup; delete p.estoqueFiscal; delete p.estoqueNaoFiscal; delete p.quantidadeEmEstoque;
      let res = isEditMode ? await produtoService.atualizar(id, p) : await produtoService.salvar(p);

      toast.success("Produto gravado com sucesso!");
      if (onSave) onSave();
      else if(stay) window.location.reload();
      else navigate('/produtos');
    } catch(e) {
      let msg = e.response?.data?.message || "Erro ao gravar produto.";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <main className="container-fluid animate-fade">
      {!onSave && (
          <header className="page-header">
            <div className="page-title">
              <h1>{isEditMode ? 'Editar Ficha do Produto' : 'Cadastrar Novo Produto'}</h1>
              <p>Integração de Estoque e Matriz Fiscal</p>
            </div>
            <div className="header-actions">
              <button className="btn-secondary" onClick={() => navigate('/produtos')}><ArrowLeft size={18} /> <span>Voltar ao Catálogo</span></button>
            </div>
          </header>
      )}

      <div className="form-container" style={onSave ? { padding: '0', boxShadow: 'none', border: 'none', background: 'transparent' } : {}}>

        {formData.revisaoPendente && isEditMode && !isProdutoIntegro() && (
            <div className="alert-ribbon-warning">
                <AlertTriangle size={24} />
                <div className="alert-text">
                    <strong>Revisão Pendente!</strong>
                    <span>Ficha iniciada no caixa. Valide o <b>Preço de Custo</b> e o <b>NCM</b> para normalizar.</span>
                </div>
            </div>
        )}

        {loading && isEditMode && !formData.descricao ? (
          <div className="loading-state"><div className="spinner"></div><p>A carregar registo do servidor...</p></div>
        ) : (
          <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="pf-form-body">

            {/* SEÇÃO 1: BÁSICOS (Totalmente Fluida sem Imagem) */}
            <section className="form-section">
                <div className="section-header-row">
                <h2 className="section-title"><Package size={22} /> Dados Principais</h2>
                <button type="button" className="btn-ia-analyze" onClick={() => handleAnaliseIA()} disabled={analisandoIA}>
                    {analisandoIA ? <div className="spinner-micro" /> : <Bot size={18} />}
                    <span>Analisar Inteligência Sefaz</span>
                </button>
                </div>

                <div className="pf-layout-inputs">
                    <ProdInput label="Descrição Completa *" name="descricao" value={formData.descricao} onChange={handleChange} onBlur={handleBlurValidation} error={errors.descricao} required tooltip="Nome visível na NF-e e Cupom Fiscal." />

                    <div className="pf-row-fluid">
                    <div className="form-group-modern input-action-group">
                        <div className="label-row"><label>Código de Barras (EAN)</label></div>
                        <div className="input-action-wrapper">
                            <input ref={eanInputRef} type="text" name="codigoBarras" className="pf-input" value={formData.codigoBarras} onChange={handleChange} placeholder="Bipe ou digite..." onKeyDown={(e)=>e.key==='Enter'&&handleBuscarEan()} />
                            <div className="input-tools">
                                <button type="button" className="btn-tool magic" onClick={handleGerarEanInterno} data-tooltip="Gerar EAN Interno"><Wand2 size={18} /></button>
                                <button type="button" className="btn-tool cloud" onClick={handleBuscarEan} data-tooltip="Buscar na Nuvem Sefaz">
                                    {searchingEan ? <div className="spinner-micro" /> : <DownloadCloud size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <ProdInput label="Referência Interna / SKU" name="referencia" value={formData.referencia} onChange={handleChange} ref={skuInputRef} tooltip="Código auxiliar de controlo da loja." />
                    </div>

                    <div className="pf-row-fluid">
                    <ProdInput label="Marca do Fabricante" name="marca" value={formData.marca} onChange={handleChange} />
                    <ProdInput label="Categoria" name="categoria" value={formData.categoria} onChange={handleChange} />
                    <ProdInput label="Subcategoria" name="subcategoria" value={formData.subcategoria} onChange={handleChange} />
                    <div className="form-group-modern">
                        <div className="label-row"><label>Unidade de Medida</label></div>
                        <select name="unidade" value={formData.unidade} onChange={handleChange} className="pf-input">
                            <option value="UN">Unidade (UN)</option><option value="KG">Quilograma (KG)</option><option value="LT">Litro (LT)</option><option value="CX">Caixa (CX)</option><option value="KIT">Kit (KIT)</option>
                        </select>
                    </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO 2: FISCAL */}
            <section className="form-section highlight-fiscal">
              <h2 className="section-title text-fiscal"><Landmark size={22} /> Matriz Tributária {validandoFiscal && <span className="validando-badge"><Sparkles size={14}/> Validando na Nuvem...</span>}</h2><br />

              <div className="pf-layout-inputs">
                  <div className="pf-row-fluid">
                    <div className="form-group-modern input-action-group" ref={ncmRef} style={{position: 'relative'}}>
                        <div className="label-row"><label>Código NCM *</label></div>
                        <div className="input-action-wrapper">
                            <input type="text" name="ncm" className={`pf-input ${errors.ncm ? 'pf-input-error' : ''}`} value={formData.ncm} onChange={handleNcmChange} onBlur={handleBlurValidation} placeholder="Digite NCM ou termo..." autoComplete="off" />
                            <div className="input-tools">
                                <button type="button" className="btn-tool cloud" onClick={() => triggerNcmSearch(formData.ncm)} data-tooltip="Localizar NCM">
                                    {buscandoNcm ? <div className="spinner-micro" /> : <Search size={18} />}
                                </button>
                            </div>
                        </div>
                        {errors.ncm ? <span className="pf-error-msg"><AlertCircle size={12}/> {errors.ncm}</span> : descricaoNcmSelecionado ? <span className="text-success-micro">✓ {descricaoNcmSelecionado}</span> : null}

                        {sugestoesNcm.length > 0 && (
                            <div className="ncm-dropdown">
                                {sugestoesNcm.map((i,x)=>(
                                    <div key={x} className="ncm-suggestion-item" onClick={()=>selecionarNcm(i)}>
                                        <strong>{i.codigo}</strong><span>{i.descricao}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group-modern">
                        <div className="label-row"><label>Origem do Produto</label></div>
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
                    <ProdInput label="CEST" name="cest" value={formData.cest} onChange={handleChange} />
                  </div>

                  <div className="pf-checkbox-row">
                    <label className="custom-checkbox danger"><input type="checkbox" name="impostoSeletivo" checked={formData.impostoSeletivo} onChange={handleChange}/> <span>Imposto Seletivo</span></label>
                    <label className="custom-checkbox"><input type="checkbox" name="monofasico" checked={formData.monofasico} onChange={handleChange}/> <span>Tributação Monofásica</span></label>
                    <label className="custom-checkbox success"><input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange}/> <span>Ativo para Venda</span></label>
                  </div>
              </div>
            </section>

            {/* SEÇÃO 3: PRECIFICAÇÃO */}
            <section className="form-section">
              <h2 className="section-title"><DollarSign size={22} /> Valores e Precificação</h2><br />

              <div className="pf-layout-inputs">
                  <div className="pf-row-fluid">
                    <ProdInput label="Custo Bruto" value={formData.precoCusto} onChange={handlePrecoCustoChange} className="text-bold" prefix="R$" />
                    <ProdInput label="Markup (Alvo)" value={formData.markup} onChange={handleMarkupChange} className="text-success text-bold" suffix="%" tooltip="Cálculo base sobre o custo." />
                    <ProdInput label="Preço na Prateleira *" name="precoVenda" value={formData.precoVenda} onChange={handlePrecoVendaChange} onBlur={handleBlurValidation} error={errors.precoVenda} required className="text-primary text-bold text-lg" prefix="R$" />
                    <ProdInput label="Margem Líquida" value={formData.margemLucro} disabled className="bg-disabled text-bold" suffix="%" />
                  </div>
              </div>
            </section>

            {/* SEÇÃO 4: ESTOQUE E LOGÍSTICA */}
            <section className="form-section">
              <h2 className="section-title"><Layers size={22} /> Controlo de Armazém</h2><br />

              <div className="pf-layout-inputs">
                  <div className="pf-row-fluid bg-light-panel">
                    <ProdInput label="Qtd. Sistema Fiscal" value={formData.estoqueFiscal||0} disabled className="bg-disabled" />
                    <ProdInput label="Qtd. Avulso" value={formData.estoqueNaoFiscal||0} disabled className="bg-disabled" />
                    <ProdInput label="Estoque Consolidado" value={formData.quantidadeEmEstoque} disabled className="bg-disabled highlight-blue text-bold text-lg" />
                  </div>

                  <div className="pf-row-fluid mt-4">
                    <ProdInput label="Alerta de Estoque Mínimo" name="estoqueMinimo" type="number" value={formData.estoqueMinimo} onChange={handleChange} />
                    <ProdInput label="Tempo de Reposição (Dias)" name="diasParaReposicao" type="number" value={formData.diasParaReposicao} onChange={handleChange} />
                    <ProdInput label="Nº do Lote" name="lote" value={formData.lote} onChange={handleChange} />
                    <ProdInput label="Data de Vencimento" name="validade" type="date" value={formData.validade} onChange={handleChange} className="date-input" />
                  </div>
              </div>
            </section>

            <footer className="form-footer">
              {!isEditMode && <button type="button" className="btn-secondary" onClick={(e)=>saveProduct(true)} disabled={loading}><PlusCircle size={20}/> <span>Salvar e Inserir Novo</span></button>}
              <button type="button" className="btn-action-primary" onClick={()=>saveProduct(false)} disabled={loading}><Save size={20}/> <span>{loading ? 'A processar...' : 'Gravar Ficha do Produto'}</span></button>
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