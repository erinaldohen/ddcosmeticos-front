import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { produtoService } from '../../services/produtoService';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Save, ArrowLeft, Package, Barcode, DollarSign,
  Layers, Ruler, Landmark, Truck,
  DownloadCloud, Upload, Image as ImageIcon,
  Lock, AlertCircle, PlusCircle, Percent, Wand2, Sparkles
} from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  // Refs para controle de foco e debounce
  const eanInputRef = useRef(null);
  const skuInputRef = useRef(null);
  const formRef = useRef(null);
  const typingTimer = useRef(null);

  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [searchingEan, setSearchingEan] = useState(false);
  const [validandoFiscal, setValidandoFiscal] = useState(false);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [previewImagem, setPreviewImagem] = useState(null);
  const [sugestoesNcm, setSugestoesNcm] = useState([]);
  const [buscandoNcm, setBuscandoNcm] = useState(false);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    descricao: '',
    codigoBarras: '',
    referencia: '', // Adicionado para binding do SKU
    ativo: true,
    marca: '',
    categoria: '',
    subcategoria: '',
    unidade: 'UN',
    ncm: '',
    cest: '',
    cst: '102',
    origem: '0',
    classificacaoReforma: 'PADRAO',
    impostoSeletivo: false,
    monofasico: false,
    urlImagem: '',
    precoCusto: '0,00',
    precoVenda: '0,00',
    precoMedio: '0,00',
    margemLucro: '',
    markup: '',
    quantidadeEmEstoque: 0,
    estoqueMinimo: 5,
    diasParaReposicao: 0,
    estoqueFiscal: 0,
    estoqueNaoFiscal: 0
  });

  // --- HELPER FUNCTIONS ---

  const parseMoeda = (valor) => {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;
    const limpo = valor.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
  };

  const formatarMoeda = (valor) => {
    if (valor === undefined || valor === null || valor === '') return '0,00';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const aplicarMascara = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros === "") return "";
    return (Number(apenasNumeros) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Garante URL válida (absoluta ou relativa ao backend)
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    // Ajuste conforme a porta do seu backend se necessário
    return `http://localhost:8080${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // --- EFEITOS ---

  // Atalho Alt+S para salvar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveProduct(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  // Foco inicial
  useEffect(() => {
    if (!isEditMode && eanInputRef.current) eanInputRef.current.focus();
  }, [isEditMode]);

  // Carregar dados na edição
  useEffect(() => {
    if (isEditMode) carregarProduto();
  }, [id]);

  // --- LÓGICA DE NEGÓCIO ---

  const carregarProduto = async () => {
    setLoading(true);
    try {
      const d = await produtoService.obterPorId(id);
      const custo = d.precoCusto || 0;
      const venda = d.precoVenda || 0;

      setFormData({
        ...d,
        ncm: d.ncm || '',
        cest: d.cest || '',
        cst: d.cst || '',
        origem: d.origem || '0',
        marca: d.marca || '',
        categoria: d.categoria || '',
        subcategoria: d.subcategoria || '',
        descricao: d.descricao || '',
        codigoBarras: d.codigoBarras || '',
        referencia: d.referencia || '', // Carrega referência se existir
        urlImagem: d.urlImagem || '',
        unidade: d.unidade || 'UN',
        impostoSeletivo: d.impostoSeletivo || false,
        monofasico: d.monofasico || false,
        ativo: d.ativo !== undefined ? d.ativo : true,
        estoqueMinimo: d.estoqueMinimo !== null ? d.estoqueMinimo : 5,
        diasParaReposicao: d.diasParaReposicao !== null ? d.diasParaReposicao : 0,
        estoqueFiscal: d.estoqueFiscal || 0,
        estoqueNaoFiscal: d.estoqueNaoFiscal || 0,
        quantidadeEmEstoque: (d.estoqueFiscal || 0) + (d.estoqueNaoFiscal || 0),
        // Formatação de valores
        precoCusto: formatarMoeda(d.precoCusto),
        precoVenda: formatarMoeda(d.precoVenda),
        precoMedio: formatarMoeda(d.precoMedioPonderado),
        // Cálculos
        margemLucro: custo > 0 && venda > 0 ? (((venda - custo) / venda) * 100).toFixed(2).replace('.', ',') : '',
        markup: custo > 0 && venda > 0 ? (((venda - custo) / custo) * 100).toFixed(2).replace('.', ',') : ''
      });

      if (d.urlImagem) setPreviewImagem(d.urlImagem);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados do produto.");
      navigate('/produtos');
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS DE PREÇO (LÓGICA ATUALIZADA) ---

  const handlePrecoCustoChange = (e) => {
    const valorFormatado = aplicarMascara(e.target.value);
    const custoFloat = parseMoeda(valorFormatado);
    const markupFloat = parseFloat(formData.markup?.replace(',', '.') || 0);

    setFormData(prev => {
      let novoPrecoVenda = prev.precoVenda;
      let novaMargem = prev.margemLucro;

      // Se houver markup definido, recalcula o preço de venda automaticamente
      if (markupFloat > 0 && custoFloat > 0) {
        const vendaCalc = custoFloat * (1 + (markupFloat / 100));
        novoPrecoVenda = formatarMoeda(vendaCalc);
        // Recalcula margem
        const margemCalc = ((vendaCalc - custoFloat) / vendaCalc) * 100;
        novaMargem = margemCalc.toFixed(2).replace('.', ',');
      } else {
        // Se não tem markup, mantém a venda e recalcula markup/margem baseado no novo custo
        const vendaFloat = parseMoeda(prev.precoVenda);
        if (vendaFloat > 0 && custoFloat > 0) {
           const novoMarkupCalc = ((vendaFloat - custoFloat) / custoFloat) * 100;
           const novaMargemCalc = ((vendaFloat - custoFloat) / vendaFloat) * 100;
           return {
             ...prev,
             precoCusto: valorFormatado,
             markup: novoMarkupCalc.toFixed(2).replace('.', ','),
             margemLucro: novaMargemCalc.toFixed(2).replace('.', ',')
           };
        }
      }

      return { ...prev, precoCusto: valorFormatado, precoVenda: novoPrecoVenda, margemLucro: novaMargem };
    });
  };

  const handlePrecoVendaChange = (e) => {
    const valorFormatado = aplicarMascara(e.target.value);
    const vendaFloat = parseMoeda(valorFormatado);
    const custoFloat = parseMoeda(formData.precoCusto);

    setFormData(prev => {
      let novoMarkup = prev.markup;
      let novaMargem = prev.margemLucro;

      if (custoFloat > 0) {
        const markupCalc = ((vendaFloat - custoFloat) / custoFloat) * 100;
        novoMarkup = markupCalc.toFixed(2).replace('.', ',');

        if (vendaFloat > 0) {
            const margemCalc = ((vendaFloat - custoFloat) / vendaFloat) * 100;
            novaMargem = margemCalc.toFixed(2).replace('.', ',');
        }
      }
      return { ...prev, precoVenda: valorFormatado, markup: novoMarkup, margemLucro: novaMargem };
    });
  };

  const handleMarkupChange = (e) => {
    const valorInput = e.target.value; // Permite digitar vírgula
    const markupFloat = parseFloat(valorInput.replace(',', '.'));
    const custoFloat = parseMoeda(formData.precoCusto);

    setFormData(prev => {
      let novoPrecoVenda = prev.precoVenda;
      let novaMargem = prev.margemLucro;

      if (custoFloat > 0 && !isNaN(markupFloat)) {
        const vendaCalc = custoFloat * (1 + (markupFloat / 100));
        novoPrecoVenda = formatarMoeda(vendaCalc);

        if (vendaCalc > 0) {
            const margemCalc = ((vendaCalc - custoFloat) / vendaCalc) * 100;
            novaMargem = margemCalc.toFixed(2).replace('.', ',');
        }
      }
      return { ...prev, markup: valorInput, precoVenda: novoPrecoVenda, margemLucro: novaMargem };
    });
  };

  // --- HANDLERS FISCAIS ---

  const handleNcmChange = (e) => {
    const valor = e.target.value;
    setFormData(prev => ({ ...prev, ncm: valor }));

    if (typingTimer.current) clearTimeout(typingTimer.current);

    if (valor.length >= 2) {
      setBuscandoNcm(true);
      typingTimer.current = setTimeout(async () => {
        try {
          const res = await produtoService.buscarNcms(valor);
          if (Array.isArray(res)) {
            const filtrados = res
              .filter(item => item.codigo.replace(/\D/g, '').startsWith(valor.replace(/\D/g, '')))
              .sort((a, b) => a.codigo.localeCompare(b.codigo))
              .slice(0, 10);
            setSugestoesNcm(filtrados);
          }
        } catch (err) {
          console.error("Erro ao buscar NCM", err);
        } finally {
          setBuscandoNcm(false);
        }
      }, 400);
    } else {
      setSugestoesNcm([]);
    }
  };

  const handleValidacaoFiscal = async () => {
    if (!formData.descricao) return;
    setValidandoFiscal(true);
    try {
      const response = await api.post('/fiscal/validar', {
        descricao: formData.descricao,
        ncm: formData.ncm
      });
      const dadosInteligentes = response.data;

      setFormData(prev => ({
        ...prev,
        ncm: dadosInteligentes.ncm || prev.ncm,
        cest: dadosInteligentes.cest || prev.cest,
        cst: dadosInteligentes.cst || prev.cst,
        monofasico: dadosInteligentes.monofasico,
        impostoSeletivo: dadosInteligentes.impostoSeletivo
      }));

      if (dadosInteligentes.ncm && dadosInteligentes.ncm !== formData.ncm) {
        toast.success("Dados Fiscais Ajustados Automaticamente! 🤖");
      }
    } catch (error) {
      console.error("Erro na validação fiscal:", error);
    } finally {
      setValidandoFiscal(false);
    }
  };

  const selecionarNcm = (item) => {
    setFormData(prev => ({ ...prev, ncm: item.codigo }));
    setSugestoesNcm([]);
    setTimeout(() => handleValidacaoFiscal(), 100);
  };

  // --- EAN E ARQUIVOS ---

  const handleGerarEanInterno = async () => {
    try {
      const novoEan = await produtoService.gerarEanInterno();
      setFormData(prev => ({ ...prev, codigoBarras: novoEan }));
      toast.info("EAN interno gerado com sucesso.");
    } catch (err) {
      toast.error("Erro ao gerar código interno.");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleBuscarEan = async () => {
    const ean = formData.codigoBarras;

    if (!ean || ean.length < 3) {
        toast.warning("Código de barras muito curto.");
        skuInputRef.current?.focus();
        return;
    }

    setSearchingEan(true);
    let encontradoLocalmente = false;

    // 1. Busca Local Segura
    try {
      const res = await api.get(`/produtos?termo=${ean}&size=1`);
      const produtosEncontrados = res.data.content || [];

      if (produtosEncontrados.length > 0) {
          const prodExistente = produtosEncontrados[0];
          // Match exato
          if (prodExistente.codigoBarras === ean) {
              encontradoLocalmente = true;
              // Se é edição do mesmo produto, ok
              if (isEditMode && String(prodExistente.id) === String(id)) {
                  toast.info("Este código pertence a este produto.");
                  setSearchingEan(false);
                  return;
              }
              // Duplicidade
              toast.error(`Produto já cadastrado!\n${prodExistente.descricao}`);
              setFormData(prev => ({ ...prev, codigoBarras: '' }));
              setTimeout(() => eanInputRef.current?.focus(), 100);
              setSearchingEan(false);
              return;
          }
      }
    } catch (error) {
        console.warn("Busca local falhou, tentando externa...", error);
    }

    // 2. Busca Externa
    if (!encontradoLocalmente) {
        try {
            const toastId = toast.loading("Consultando base externa...");
            const dExt = await produtoService.consultarEan(ean);
            toast.dismiss(toastId);

            if (dExt && (dExt.nome || dExt.descricao)) {
                setFormData(prev => ({
                  ...prev,
                  descricao: dExt.nome || dExt.descricao || prev.descricao,
                  urlImagem: dExt.urlImagem || dExt.thumbnail || prev.urlImagem,
                  marca: dExt.marca || prev.marca,
                  categoria: dExt.categoria || prev.categoria,
                  ncm: dExt.ncm || prev.ncm,
                  cest: dExt.cest || prev.cest,
                  cst: dExt.cst || prev.cst,
                  monofasico: dExt.monofasico !== undefined ? dExt.monofasico : prev.monofasico,
                }));

                if (dExt.urlImagem) setPreviewImagem(dExt.urlImagem);
                toast.success("Dados encontrados e preenchidos!");
            } else {
                toast.info("Código novo. Preencha os dados manualmente.");
            }
        } catch (extError) {
            toast.dismiss();
            console.error("Erro busca externa:", extError);
            toast.info("Novo cadastro liberado.");
        }
        setTimeout(() => skuInputRef.current?.focus(), 100);
    }
    setSearchingEan(false);
  };

  const handleEanKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleBuscarEan();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
        setArquivoImagem(file);
        setPreviewImagem(URL.createObjectURL(file));
    }
  };

  // --- SAVE ---

  const saveProduct = async (stay = false) => {
    if (formRef.current && !formRef.current.checkValidity()) {
        formRef.current.reportValidity();
        return;
    }

    setLoading(true);
    try {
      const p = {
        ...formData,
        precoCusto: parseMoeda(formData.precoCusto),
        precoVenda: parseMoeda(formData.precoVenda),
        diasParaReposicao: Number(formData.diasParaReposicao),
        estoqueMinimo: Number(formData.estoqueMinimo)
      };

      let res;
      if (isEditMode) {
        res = await produtoService.atualizar(id, p);
      } else {
        res = await produtoService.salvar(p);
      }

      // Upload de imagem se houver
      if (arquivoImagem && (res.id || id)) {
        await produtoService.uploadImagem(res.id || id, arquivoImagem);
      }

      toast.success("Produto salvo com sucesso!");

      if (stay) {
        // Recarrega para limpar estado ou redireciona para novo
        window.location.reload();
      } else {
        navigate('/produtos');
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar produto. Verifique os campos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container-fluid">
        <div className="page-header">
          <div className="page-title">
            <h1>{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
            <p>Conformidade Fiscal: Modelo Atual & LC 214</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" type="button" onClick={() => navigate('/produtos')} data-label="Voltar para a lista">
              <ArrowLeft size={18} /> Voltar
            </button>
          </div>
        </div>

        <div className="form-container">
          {loading && isEditMode && !formData.descricao ? (
            <div className="loading-form"><div className="spinner"></div> Carregando...</div>
          ) : (
            <form ref={formRef} onSubmit={(e) => e.preventDefault()}>

              {/* SEÇÃO 1: DADOS BÁSICOS */}
              <div className="form-section">
                <h3 className="section-title"><Package size={20} /> Informações Básicas</h3>

                <div className="form-row">
                  <div className="form-group">
                    <label>Descrição Completa do Produto *</label>
                    <input
                        type="text"
                        name="descricao"
                        value={formData.descricao}
                        onChange={handleChange}
                        required
                        placeholder="Ex: Creme Hidratante 500ml..."
                        style={{ fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label><Barcode size={16} /> EAN / Código de Barras</label>
                        <div className="input-action-group">
                          <input
                            ref={eanInputRef}
                            type="text"
                            name="codigoBarras"
                            value={formData.codigoBarras || ''}
                            onChange={handleChange}
                            placeholder="789..."
                            onKeyDown={handleEanKeyDown}
                          />
                          <button type="button" className="btn-magic" onClick={handleGerarEanInterno} title="Gerar EAN Interno"><Wand2 size={18} /></button>
                          <button type="button" className="btn-search-icon" onClick={handleBuscarEan} disabled={searchingEan} title="Buscar na Nuvem">
                            {searchingEan ? <div className="spinner-small" /> : <DownloadCloud size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="form-group flex-1">
                        <label>Referência / SKU</label>
                        <input
                            ref={skuInputRef}
                            type="text"
                            name="referencia"
                            value={formData.referencia || ''}
                            onChange={handleChange}
                            placeholder="Cód. Interno"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group"><label>Marca</label><input type="text" name="marca" value={formData.marca || ''} onChange={handleChange} /></div>
                      <div className="form-group"><label>Categoria</label><input type="text" name="categoria" value={formData.categoria || ''} onChange={handleChange} /></div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-small">
                        <label><Ruler size={16} /> Unidade</label>
                        <select name="unidade" value={formData.unidade} onChange={handleChange}>
                          <option value="UN">Unidade (UN)</option>
                          <option value="KG">Quilo (KG)</option>
                          <option value="LT">Litro (LT)</option>
                          <option value="CX">Caixa (CX)</option>
                          <option value="KIT">Kit</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Subcategoria</label>
                        <input type="text" name="subcategoria" value={formData.subcategoria || ''} onChange={handleChange} />
                      </div>
                    </div>
                  </div>

                  {/* UPLOAD DE IMAGEM */}
                  <div className="image-upload-area" style={{ flex: 1, minWidth: '220px' }}>
                    <div className="image-preview-box">
                        {previewImagem ?
                            <img src={getImageUrl(previewImagem)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : <ImageIcon size={40} color="#ccc" />
                        }
                    </div>
                    <label htmlFor="file-upload" className="btn-upload"><Upload size={16} /> Alterar Imagem</label>
                    <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    <input
                        type="text"
                        name="urlImagem"
                        value={formData.urlImagem}
                        onChange={(e) => { handleChange(e); setPreviewImagem(e.target.value); }}
                        placeholder="Ou cole uma URL externa..."
                        style={{ width: '100%', marginTop: '12px', fontSize: '0.8rem', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: DADOS FISCAIS */}
              <div className="form-section" style={{ borderLeft: '4px solid #f22998' }}>
                <h3 className="section-title">
                  <Landmark size={20} /> Dados Fiscais
                  {validandoFiscal && <span style={{ fontSize: '0.8rem', color: '#f22998', marginLeft: 10 }}> <Sparkles size={14} style={{ display: 'inline' }} /> Otimizando...</span>}
                </h3>
                <div className="form-row">
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>NCM *</label>
                    <div className="input-action-group">
                      <input
                        type="text"
                        name="ncm"
                        value={formData.ncm || ''}
                        onChange={handleNcmChange}
                        onBlur={handleValidacaoFiscal}
                        placeholder="0000.00.00"
                        autoComplete="off"
                        required
                        style={{ borderColor: validandoFiscal ? '#f22998' : '#cbd5e1' }}
                      />
                      {(buscandoNcm || validandoFiscal) && <div className="spinner-small" />}
                    </div>
                    <span className="ncm-hint">Digite ou deixe vazio para a IA sugerir</span>

                    {sugestoesNcm.length > 0 && (
                      <div className="ncm-dropdown">
                        {sugestoesNcm.map((item, idx) => (
                          <div key={idx} className="ncm-suggestion-item" onClick={() => selecionarNcm(item)}>
                            <span className="ncm-code">{item.codigo}</span><span className="ncm-desc">{item.descricao}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Origem da Mercadoria *</label>
                    <select name="origem" value={formData.origem || '0'} onChange={handleChange}>
                      <option value="0">0 - Nacional</option>
                      <option value="1">1 - Estrangeira (Importação Direta)</option>
                      <option value="2">2 - Estrangeira (Adquirida no Int.)</option>
                    </select>
                  </div>

                  <div className="form-group"><label>CST / CSOSN *</label><input type="text" name="cst" value={formData.cst || ''} onChange={handleChange} required /></div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Reforma Tributária (IBS/CBS - LC 214)</label>
                    <select name="classificacaoReforma" value={formData.classificacaoReforma} onChange={handleChange}>
                      <option value="PADRAO">Alíquota Padrão (IBS/CBS Cheio)</option>
                      <option value="CESTA_BASICA">Cesta Básica Nacional (Alíquota Zero)</option>
                      <option value="REDUZIDA_60">Reduzida 60% (Saúde/Educação/Higiene)</option>
                      <option value="REDUZIDA_30">Reduzida 30% (Serviços Profissionais)</option>
                      <option value="IMUNE">Imune / Isento</option>
                    </select>
                  </div>
                  <div className="form-group"><label>CEST</label><input type="text" name="cest" value={formData.cest || ''} onChange={handleChange} placeholder="00.000.00" /></div>
                </div>

                <div className="form-row" style={{ backgroundColor: '#fff1f2', padding: '15px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label" style={{ color: '#991b1b', fontWeight: '700' }}>
                      <input type="checkbox" name="impostoSeletivo" checked={formData.impostoSeletivo || false} onChange={handleChange} />
                      Sujeito ao Imposto Seletivo (Imposto do Pecado)
                    </label>
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label"><input type="checkbox" name="monofasico" checked={formData.monofasico || false} onChange={handleChange} /> Produto PIS/COFINS Monofásico</label>
                  </div>
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label"><input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange} /> Ativo</label>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: PRECIFICAÇÃO */}
              <div className="form-section">
                <h3 className="section-title"><DollarSign size={20} /> Precificação Inteligente</h3>
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group">
                    <label>Preço Custo (R$)</label>
                    <div className="input-prefix-group">
                      <span className="prefix" style={{ color: '#64748b' }}>R$</span>
                      <input
                        type="text"
                        name="precoCusto"
                        value={formData.precoCusto}
                        onChange={handlePrecoCustoChange}
                        // Habilitado para permitir cadastro inicial e ajustes
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: '140px' }}>
                    <label>Markup %</label>
                    <div className="input-prefix-group">
                      <input type="text" name="markup" value={formData.markup} onChange={handleMarkupChange} style={{ fontWeight: 'bold', color: '#059669' }} autoComplete="off" />
                      <span className="suffix">%</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label-highlight">Preço de Venda</label>
                    <div className="input-prefix-group highlight-group">
                      <span className="prefix">R$</span>
                      <input type="text" name="precoVenda" value={formData.precoVenda} onChange={handlePrecoVendaChange} required className="input-highlight" />
                    </div>
                  </div>
                  <div className="form-group" style={{ maxWidth: '140px' }}>
                    <label><Percent size={14} /> Margem Real</label>
                    <div className="input-prefix-group">
                      <input type="text" disabled value={formData.margemLucro} style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }} />
                      <span className="suffix">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: ESTOQUE */}
              <div className="form-section">
                <h3 className="section-title"><Layers size={20} /> Controle de Estoque</h3>
                <div className="form-row" style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <div className="form-group"><label><Lock size={14} data-label="Estoque controlado pelo sistema fiscal" /> Estoque Fiscal</label><input type="text" value={formData.estoqueFiscal} disabled /></div>
                  <div className="form-group"><label><Lock size={14} data-label="Estoque de vendas sem nota" /> Estoque S/ Nota</label><input type="text" value={formData.estoqueNaoFiscal} disabled /></div>
                  <div className="form-group">
                    <label>Total Disponível</label>
                    <input type="text" value={formData.quantidadeEmEstoque} disabled style={{ backgroundColor: '#e0e7ff', fontWeight: 'bold', color: Number(formData.quantidadeEmEstoque) < Number(formData.estoqueMinimo) ? '#ef4444' : '#312e81' }} />
                  </div>
                  <div className="form-group" style={{ justifyContent: 'center' }}><small style={{ display: 'flex', gap: 6, color: '#d97706' }}><AlertCircle size={16} /><span>Ajuste via Entrada de Notas ou Inventário.</span></small></div>
                </div>
                <div className="form-row" style={{ marginTop: '20px' }}>
                  <div className="form-group"><label>Estoque Mínimo</label><input type="number" name="estoqueMinimo" value={formData.estoqueMinimo} onChange={handleChange} /></div>
                  <div className="form-group"><label><Truck size={16} /> Dias Reposição</label><input type="number" name="diasParaReposicao" value={formData.diasParaReposicao} onChange={handleChange} /></div>
                  <div className="form-group flex-2"></div>
                </div>
              </div>

              <div className="form-actions">
                {!isEditMode && <button type="button" className="btn-secondary" onClick={(e) => saveProduct(true)} disabled={loading} title="Salvar e abrir formulário limpo"><PlusCircle size={18} /> Salvar e Novo</button>}
                <button id="btn-submit-form" type="button" className="action-btn-primary" onClick={() => saveProduct(false)} disabled={loading} title="Finalizar e voltar"><Save size={18} />{loading ? 'Salvando...' : 'Salvar (Alt+S)'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ProdutoForm;