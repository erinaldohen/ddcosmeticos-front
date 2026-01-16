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
  const eanInputRef = useRef(null);
  const typingTimer = useRef(null);

  const [loading, setLoading] = useState(false);
  const [searchingEan, setSearchingEan] = useState(false);
  const [validandoFiscal, setValidandoFiscal] = useState(false);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [previewImagem, setPreviewImagem] = useState(null);

  const [sugestoesNcm, setSugestoesNcm] = useState([]);
  const [buscandoNcm, setBuscandoNcm] = useState(false);

  const [formData, setFormData] = useState({
    descricao: '',
    codigoBarras: '',
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
    precoCusto: '',
    precoVenda: '',
    precoMedio: '0,00',
    margemLucro: '',
    markup: '',
    quantidadeEmEstoque: 0,
    estoqueMinimo: 5,
    diasParaReposicao: 0,
    estoqueFiscal: 0,
    estoqueNaoFiscal: 0
  });

  // --- HELPER FUNCTIONS (ATUALIZADAS PARA CÁLCULO SEGURO) ---

  // Converte "1.250,90" (String) -> 1250.90 (Float)
  const parseMoeda = (valor) => {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;
    // Remove pontos de milhar e troca vírgula por ponto
    const limpo = valor.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
  };

  // Converte 1250.90 (Float) -> "1.250,90" (String)
  const formatarMoeda = (valor) => {
    if (valor === undefined || valor === null || valor === '') return '';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Máscara de digitação estilo ATM (0,00 -> 0,10 -> 1,00)
  const aplicarMascara = (valor) => {
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros === "") return "";
    return (Number(apenasNumeros) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getImageUrl = (url) => !url ? null : (url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`);

  // --- EFEITOS ---

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById('btn-submit-form')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isEditMode && eanInputRef.current) eanInputRef.current.focus();
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode) carregarProduto();
  }, [id]);

  // --- CARREGAMENTO ---

  const carregarProduto = async () => {
    setLoading(true);
    try {
      const d = await produtoService.obterPorId(id);

      const custo = d.precoCusto || 0;
      const venda = d.precoVenda || 0;

      setFormData({
        ...d,
        // Strings
        ncm: d.ncm || '',
        cest: d.cest || '',
        cst: d.cst || '',
        origem: d.origem || '0',
        marca: d.marca || '',
        categoria: d.categoria || '',
        subcategoria: d.subcategoria || '',
        descricao: d.descricao || '',
        codigoBarras: d.codigoBarras || '',
        urlImagem: d.urlImagem || '',
        unidade: d.unidade || 'UN',

        // Booleanos
        impostoSeletivo: d.impostoSeletivo || false,
        monofasico: d.monofasico || false,
        ativo: d.ativo !== undefined ? d.ativo : true,

        // Números
        estoqueMinimo: d.estoqueMinimo !== null ? d.estoqueMinimo : '',
        diasParaReposicao: d.diasParaReposicao !== null ? d.diasParaReposicao : '',
        estoqueFiscal: d.estoqueFiscal || 0,
        estoqueNaoFiscal: d.estoqueNaoFiscal || 0,
        quantidadeEmEstoque: (d.estoqueFiscal || 0) + (d.estoqueNaoFiscal || 0),

        // Valores Monetários (Usando formatarMoeda atualizado)
        precoCusto: formatarMoeda(d.precoCusto),
        precoVenda: formatarMoeda(d.precoVenda),
        precoMedio: formatarMoeda(d.precoMedioPonderado),

        // Cálculos Iniciais
        margemLucro: custo > 0 && venda > 0 ? (((venda - custo) / venda) * 100).toFixed(2).replace('.', ',') : '',
        markup: custo > 0 && venda > 0 ? (((venda - custo) / custo) * 100).toFixed(2).replace('.', ',') : ''
      });

      if (d.urlImagem) setPreviewImagem(d.urlImagem);
    } catch (e) {
      toast.error("Erro ao carregar dados.");
      console.error(e);
      navigate('/produtos');
    } finally {
      setLoading(false);
    }
  };

  // --- HANDLERS DE PREÇO E MARKUP (A Lógica Nova) ---

  // 1. Quando altera o Preço de Venda -> Recalcula Markup
  const handlePrecoVendaChange = (e) => {
    const valorFormatado = aplicarMascara(e.target.value);
    const vendaFloat = parseMoeda(valorFormatado);
    const custoFloat = parseMoeda(formData.precoCusto);

    setFormData(prev => {
      let novoMarkup = prev.markup;
      let novaMargem = prev.margemLucro;

      if (custoFloat > 0) {
        // Markup = ((Venda - Custo) / Custo) * 100
        const markupCalc = ((vendaFloat - custoFloat) / custoFloat) * 100;
        novoMarkup = markupCalc.toFixed(2).replace('.', ',');

        // Margem = ((Venda - Custo) / Venda) * 100
        if (vendaFloat > 0) {
            const margemCalc = ((vendaFloat - custoFloat) / vendaFloat) * 100;
            novaMargem = margemCalc.toFixed(2).replace('.', ',');
        }
      }

      return {
        ...prev,
        precoVenda: valorFormatado,
        markup: novoMarkup,
        margemLucro: novaMargem
      };
    });
  };

  // 2. Quando altera o Markup -> Recalcula Preço de Venda
  const handleMarkupChange = (e) => {
    const valorInput = e.target.value; // Permite vírgula
    const markupFloat = parseFloat(valorInput.replace(',', '.'));
    const custoFloat = parseMoeda(formData.precoCusto);

    setFormData(prev => {
      let novoPrecoVenda = prev.precoVenda;
      let novaMargem = prev.margemLucro;

      if (custoFloat > 0 && !isNaN(markupFloat)) {
        // Venda = Custo * (1 + Markup/100)
        const vendaCalc = custoFloat * (1 + (markupFloat / 100));
        novoPrecoVenda = formatarMoeda(vendaCalc);

        // Atualiza margem
        const margemCalc = ((vendaCalc - custoFloat) / vendaCalc) * 100;
        novaMargem = margemCalc.toFixed(2).replace('.', ',');
      }

      return {
        ...prev,
        markup: valorInput,
        precoVenda: novoPrecoVenda,
        margemLucro: novaMargem
      };
    });
  };

  // --- OUTROS HANDLERS ---

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
              .sort((a, b) => a.codigo.localeCompare(b.codigo)).slice(0, 10);
            setSugestoesNcm(filtrados);
          }
        } catch (err) { console.error(err); }
        finally { setBuscandoNcm(false); }
      }, 400);
    } else { setSugestoesNcm([]); }
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
        ncm: dadosInteligentes.ncm,
        cest: dadosInteligentes.cest,
        cst: dadosInteligentes.cst,
        monofasico: dadosInteligentes.monofasico,
        impostoSeletivo: dadosInteligentes.impostoSeletivo
      }));
      if (dadosInteligentes.ncm !== formData.ncm) {
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

  const handleGerarEanInterno = async () => {
    try {
      const novoEan = await produtoService.gerarEanInterno();
      setFormData(prev => ({ ...prev, codigoBarras: novoEan }));
      toast.info("EAN interno gerado!");
    } catch (err) { toast.error("Erro ao gerar código."); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleBuscarEan = async () => {
    const ean = formData.codigoBarras;
    if (!ean || ean.length < 8) return toast.warning("EAN inválido.");
    setSearchingEan(true);
    try {
      const dExt = await produtoService.consultarEan(ean);
      setFormData(prev => ({
        ...prev,
        descricao: dExt.nome || prev.descricao, urlImagem: dExt.urlImagem || prev.urlImagem,
        marca: dExt.marca || prev.marca, categoria: dExt.categoria || prev.categoria,
        ncm: dExt.ncm || prev.ncm, cest: dExt.cest || prev.cest, cst: dExt.cst || prev.cst,
        monofasico: dExt.monofasico !== undefined ? dExt.monofasico : prev.monofasico,
      }));
      if (dExt.urlImagem && !arquivoImagem) setPreviewImagem(dExt.urlImagem);
      toast.success("Dados encontrados!");
    } catch (error) { toast.info("Não encontrado."); }
    finally { setSearchingEan(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { setArquivoImagem(file); setPreviewImagem(URL.createObjectURL(file)); }
  };

  const handleSubmit = async (e, stay = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const p = {
        ...formData,
        precoCusto: parseMoeda(formData.precoCusto),
        precoVenda: parseMoeda(formData.precoVenda),
        diasParaReposicao: Number(formData.diasParaReposicao),
        estoqueMinimo: Number(formData.estoqueMinimo)
      };
      let res = isEditMode ? await produtoService.atualizar(id, p) : await produtoService.salvar(p);
      if (arquivoImagem) await produtoService.uploadImagem(res.id || id, arquivoImagem);
      toast.success("Salvo com sucesso!");
      stay ? window.location.reload() : navigate('/produtos');
    } catch (e) { toast.error("Erro ao salvar."); }
    finally { setLoading(false); }
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
            <form onSubmit={(e) => handleSubmit(e, false)}>
              <div className="form-section">
                <h3 className="section-title"><Package size={20} /> Informações Básicas</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Descrição Completa do Produto *</label>
                    <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} required placeholder="Ex: Creme..." style={{ fontWeight: 600 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label><Barcode size={16} /> EAN / Código de Barras</label>
                        <div className="input-action-group">
                          <input ref={eanInputRef} type="text" name="codigoBarras" value={formData.codigoBarras || ''} onChange={handleChange} placeholder="789..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarEan())} />
                          <button type="button" className="btn-magic" onClick={handleGerarEanInterno} data-label="Gerar EAN Interno"><Wand2 size={18} /></button>
                          <button type="button" className="btn-search-icon" onClick={handleBuscarEan} disabled={searchingEan} data-label="Buscar Dados Externos">{searchingEan ? <div className="spinner-small" /> : <DownloadCloud size={16} />}</button>
                        </div>
                      </div>
                      <div className="form-group flex-1"><label>Referência / SKU</label><input type="text" placeholder="Cód. Interno" /></div>
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
                  <div className="image-upload-area" style={{ flex: 1, minWidth: '220px' }}>
                    <div className="image-preview-box">{previewImagem ? <img src={getImageUrl(previewImagem)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon size={40} color="#ccc" />}</div>
                    <label htmlFor="file-upload" className="btn-upload"><Upload size={16} /> Alterar Imagem</label>
                    <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    <input type="text" name="urlImagem" value={formData.urlImagem} onChange={(e) => { handleChange(e); setPreviewImagem(e.target.value); }} placeholder="URL externa..." style={{ width: '100%', marginTop: '12px', fontSize: '0.8rem', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                  </div>
                </div>
              </div>

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

              <div className="form-section">
                <h3 className="section-title"><DollarSign size={20} /> Precificação Inteligente</h3>
                <div className="form-row" style={{ alignItems: 'flex-start' }}>

                  {/* CUSTO: Bloqueado (Read-Only) */}
                  <div className="form-group">
                    <label>Preço Médio (Custo)</label>
                    <div className="input-prefix-group">
                      <span className="prefix" style={{ color: '#64748b' }}>R$</span>
                      <input
                        type="text"
                        name="precoCusto"
                        value={formData.precoCusto}
                        disabled={true}
                        style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                      />
                    </div>
                  </div>

                  {/* MARKUP: Editável */}
                  <div className="form-group" style={{ maxWidth: '140px' }}>
                    <label>Markup %</label>
                    <div className="input-prefix-group">
                      <input
                        type="text"
                        name="markup"
                        value={formData.markup}
                        onChange={handleMarkupChange}
                        style={{ fontWeight: 'bold', color: '#059669' }}
                        autoComplete="off"
                      />
                      <span className="suffix">%</span>
                    </div>
                  </div>

                  {/* VENDA: Editável (Calcula o Markup reverso) */}
                  <div className="form-group">
                    <label className="label-highlight">Preço de Venda</label>
                    <div className="input-prefix-group highlight-group">
                      <span className="prefix">R$</span>
                      <input
                        type="text"
                        name="precoVenda"
                        value={formData.precoVenda}
                        onChange={handlePrecoVendaChange}
                        required
                        className="input-highlight"
                      />
                    </div>
                  </div>

                  {/* MARGEM: Calculada (Apenas leitura) */}
                  <div className="form-group" style={{ maxWidth: '140px' }}>
                    <label><Percent size={14} /> Margem Real</label>
                    <div className="input-prefix-group">
                      <input
                        type="text"
                        disabled
                        value={formData.margemLucro}
                        style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}
                      />
                      <span className="suffix">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3 className="section-title"><Layers size={20} /> Controle de Estoque</h3>
                <div className="form-row" style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <div className="form-group"><label><Lock size={14} data-label="Estoque controlado pelo sistema fiscal" /> Estoque Fiscal</label><input type="text" value={formData.estoqueFiscal} disabled /></div>
                  <div className="form-group"><label><Lock size={14} data-label="Estoque de vendas sem nota" /> Estoque S/ Nota</label><input type="text" value={formData.estoqueNaoFiscal} disabled /></div>
                  <div className="form-group">
                    <label>Total Disponível</label>
                    <input
                      type="text"
                      value={formData.quantidadeEmEstoque}
                      disabled
                      style={{
                        backgroundColor: '#e0e7ff',
                        fontWeight: 'bold',
                        color: Number(formData.quantidadeEmEstoque) < Number(formData.estoqueMinimo) ? '#ef4444' : '#312e81'
                      }}
                    />
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
                {!isEditMode && <button type="button" className="btn-secondary" onClick={(e) => handleSubmit(e, true)} disabled={loading} data-label="Salvar e abrir formulário limpo"><PlusCircle size={18} /> Salvar e Novo</button>}
                <button id="btn-submit-form" type="submit" className="action-btn-primary" disabled={loading} data-label="Finalizar e voltar"><Save size={18} />{loading ? 'Salvando...' : 'Salvar (Alt+S)'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ProdutoForm;