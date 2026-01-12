import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '../../components/Layout/MainLayout';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import {
  Save, ArrowLeft, Package, Barcode, DollarSign,
  Layers, Ruler, Landmark, Truck,
  DownloadCloud, Upload, Image as ImageIcon,
  Lock, AlertCircle, PlusCircle, Percent
} from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;
  const eanInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [searchingEan, setSearchingEan] = useState(false);
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [previewImagem, setPreviewImagem] = useState(null);

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
    classificacaoReforma: 'PADRAO',
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

  // --- ATALHOS DE TECLADO ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-form');
        if (btn) btn.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- FOCO INICIAL ---
  useEffect(() => {
    if (!isEditMode && eanInputRef.current) {
      eanInputRef.current.focus();
    }
  }, [isEditMode]);

  // --- FORMATAÇÃO ---
  const formatarMoeda = (valor) => {
    if (!valor && valor !== 0) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
  };

  const converterParaFloat = (valorFormatado) => {
    if (!valorFormatado) return 0;
    const valorLimpo = valorFormatado.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(valorLimpo) || 0;
  };

  const aplicarMascaraMoeda = (valor) => {
    if (!valor) return '';
    const apenasNumeros = valor.replace(/\D/g, "");
    const numero = Number(apenasNumeros) / 100;
    return formatarMoeda(numero);
  };

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  };

  useEffect(() => {
    if (isEditMode) carregarProduto();
  }, [id]);

  const carregarProduto = async () => {
    setLoading(true);
    try {
      const dados = await produtoService.obterPorId(id);
      const custo = dados.precoCusto || 0;
      const venda = dados.precoVenda || 0;

      let margemIni = custo > 0 && venda > 0 ? (((venda - custo) / venda) * 100).toFixed(2).replace('.', ',') : '';
      let markupIni = custo > 0 && venda > 0 ? (((venda - custo) / custo) * 100).toFixed(2).replace('.', ',') : '';

      setFormData({
        ...dados,
        marca: dados.marca || '',
        categoria: dados.categoria || '',
        subcategoria: dados.subcategoria || '',
        unidade: dados.unidade || 'UN',
        ncm: dados.ncm || '',
        cest: dados.cest || '',
        cst: dados.cst || '102',
        classificacaoReforma: dados.classificacaoReforma || 'PADRAO',
        monofasico: dados.monofasico || false,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
        urlImagem: dados.urlImagem || '',
        precoCusto: formatarMoeda(dados.precoCusto),
        precoVenda: formatarMoeda(dados.precoVenda),
        precoMedio: formatarMoeda(dados.precoMedioPonderado),
        margemLucro: margemIni,
        markup: markupIni,
        diasParaReposicao: dados.diasParaReposicao || 0,
        estoqueFiscal: dados.estoqueFiscal || 0,
        estoqueNaoFiscal: dados.estoqueNaoFiscal || 0,
        quantidadeEmEstoque: (dados.estoqueFiscal || 0) + (dados.estoqueNaoFiscal || 0)
      });
      if (dados.urlImagem) setPreviewImagem(dados.urlImagem);
    } catch (error) {
      toast.error("Erro ao carregar dados.");
      navigate('/produtos');
    } finally {
      setLoading(false);
    }
  };

  const handlePrecoChange = (e) => {
    const { name, value } = e.target;
    const valorFormatado = aplicarMascaraMoeda(value);
    setFormData(prev => {
        const novoState = { ...prev, [name]: valorFormatado };
        const custo = converterParaFloat(name === 'precoCusto' ? valorFormatado : prev.precoCusto);
        const venda = converterParaFloat(name === 'precoVenda' ? valorFormatado : prev.precoVenda);
        if (custo > 0 && venda > 0) {
            novoState.margemLucro = (((venda - custo) / venda) * 100).toFixed(2).replace('.', ',');
            novoState.markup = (((venda - custo) / custo) * 100).toFixed(2).replace('.', ',');
        }
        return novoState;
    });
  };

  const handleMarkupChange = (e) => {
    const valorInput = e.target.value.replace(',', '.');
    setFormData(prev => {
        const custo = converterParaFloat(prev.precoCusto);
        const markup = parseFloat(valorInput);
        let novoPrecoVenda = prev.precoVenda;
        let novaMargem = prev.margemLucro;
        if (custo > 0 && !isNaN(markup)) {
            const calculoVenda = custo * (1 + (markup / 100));
            novoPrecoVenda = formatarMoeda(calculoVenda);
            novaMargem = (((calculoVenda - custo) / calculoVenda) * 100).toFixed(2).replace('.', ',');
        }
        return { ...prev, markup: e.target.value, precoVenda: novoPrecoVenda, margemLucro: novaMargem };
    });
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
        const dadosExternos = await produtoService.consultarEan(ean);
        setFormData(prev => ({
            ...prev,
            descricao: dadosExternos.nome || prev.descricao,
            urlImagem: dadosExternos.urlImagem || prev.urlImagem,
            marca: dadosExternos.marca || prev.marca,
            categoria: dadosExternos.categoria || prev.categoria,
            ncm: dadosExternos.ncm || prev.ncm,
            cest: dadosExternos.cest || prev.cest,
            cst: dadosExternos.cst || prev.cst,
            monofasico: dadosExternos.monofasico !== undefined ? dadosExternos.monofasico : prev.monofasico,
        }));
        if (dadosExternos.urlImagem && !arquivoImagem) setPreviewImagem(dadosExternos.urlImagem);
        toast.success("Dados encontrados!");
    } catch (error) { toast.info("Não encontrado."); }
    finally { setSearchingEan(false); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArquivoImagem(file);
      setPreviewImagem(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e, stayOnPage = false) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        precoCusto: converterParaFloat(formData.precoCusto),
        precoVenda: converterParaFloat(formData.precoVenda),
        diasParaReposicao: Number(formData.diasParaReposicao),
        estoqueMinimo: Number(formData.estoqueMinimo),
      };

      let produtoSalvo;
      if (isEditMode) {
        const { estoqueFiscal, estoqueNaoFiscal, quantidadeEmEstoque, ...updatePayload } = payload;
        produtoSalvo = await produtoService.atualizar(id, updatePayload);
      } else {
        produtoSalvo = await produtoService.salvar(payload);
      }

      if (arquivoImagem) {
        await produtoService.uploadImagem(produtoSalvo.id || id, arquivoImagem);
      }

      toast.success(isEditMode ? "Atualizado com sucesso!" : "Cadastrado com sucesso!");

      if (stayOnPage) {
        setFormData({
            descricao: '', codigoBarras: '', ativo: true, marca: '', categoria: '', subcategoria: '', unidade: 'UN',
            ncm: '', cest: '', cst: '102', classificacaoReforma: 'PADRAO', monofasico: false,
            urlImagem: '', precoCusto: '', precoVenda: '', precoMedio: '0,00', margemLucro: '', markup: '',
            quantidadeEmEstoque: 0, estoqueMinimo: 5, diasParaReposicao: 0, estoqueFiscal: 0, estoqueNaoFiscal: 0
        });
        setPreviewImagem(null);
        setArquivoImagem(null);
        eanInputRef.current?.focus();
      } else {
        navigate('/produtos');
      }
    } catch (error) {
      toast.error("Erro ao salvar produto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container-fluid">
        <div className="page-header">
          <div className="page-title">
            <h1>{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
            <p>{isEditMode ? 'Gerencie os detalhes e preços' : 'Cadastre um novo item no inventário'}</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/produtos')}>
              <ArrowLeft size={18} /> Voltar
            </button>
          </div>
        </div>

        <div className="form-container">
          {loading && isEditMode && !formData.descricao ? (
            <div className="loading-form"><div className="spinner"></div> Carregando...</div>
          ) : (
            <form onSubmit={(e) => handleSubmit(e, false)}>

              {/* --- 1. INFORMAÇÕES BÁSICAS --- */}
              <div className="form-section">
                <h3 className="section-title"><Package size={20} /> Informações Básicas</h3>
                <div className="form-row">
                    <div className="form-group">
                        <label>Descrição Completa do Produto *</label>
                        <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} required placeholder="Ex: Creme Hidratante Facial 50g..." style={{fontWeight: 600, fontSize: '1.05rem'}} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 2, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="form-row">
                             <div className="form-group flex-1">
                                <label><Barcode size={16} /> Código Barras / EAN</label>
                                <div className="input-action-group">
                                    <input ref={eanInputRef} type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} placeholder="789..." onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleBuscarEan())} />
                                    <button type="button" className="btn-search-icon" onClick={handleBuscarEan} disabled={searchingEan}>
                                        {searchingEan ? <div className="spinner-small"></div> : <DownloadCloud size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group flex-1">
                                <label>Referência / SKU</label>
                                <input type="text" placeholder="Cód. Interno" />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label>Marca</label><input type="text" name="marca" value={formData.marca} onChange={handleChange} /></div>
                            <div className="form-group"><label>Categoria</label><input type="text" name="categoria" value={formData.categoria} onChange={handleChange} /></div>
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
                                <input type="text" name="subcategoria" value={formData.subcategoria} onChange={handleChange} />
                            </div>
                        </div>
                    </div>

                    <div className="image-upload-area" style={{ flex: 1, minWidth: '220px' }}>
                        <div className="image-preview-box">
                            {previewImagem ? <img src={getImageUrl(previewImagem)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon size={40} color="#ccc" />}
                        </div>
                        <label htmlFor="file-upload" className="btn-upload"><Upload size={16} /> Alterar Imagem</label>
                        <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                        <input type="text" name="urlImagem" value={formData.urlImagem} onChange={(e) => { handleChange(e); setPreviewImagem(e.target.value); }} placeholder="Ou cole URL externa..." style={{ width: '100%', marginTop: '12px', fontSize: '0.8rem', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
                    </div>
                </div>
              </div>

              {/* --- 2. DADOS FISCAIS (Restaurado Integralmente) --- */}
              <div className="form-section" style={{borderLeft: '4px solid #f22998'}}>
                <h3 className="section-title"><Landmark size={20} /> Dados Fiscais (Simples Nacional)</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>NCM *</label>
                    <input type="text" name="ncm" value={formData.ncm} onChange={handleChange} placeholder="0000.00.00" maxLength={10} required />
                  </div>
                  <div className="form-group">
                    <label>CEST</label>
                    <input type="text" name="cest" value={formData.cest} onChange={handleChange} placeholder="00.000.00" />
                  </div>
                  <div className="form-group">
                    <label title="Código de Situação da Operação no Simples Nacional">CSOSN / CST *</label>
                    <input type="text" name="cst" value={formData.cst} onChange={handleChange} placeholder="Ex: 102 ou 500" required />
                  </div>
                  <div className="form-group flex-2">
                    <label>Reforma Tributária (LC 214)</label>
                    <select name="classificacaoReforma" value={formData.classificacaoReforma} onChange={handleChange}>
                        <option value="PADRAO">Padrão (Beleza/Luxo)</option>
                        <option value="CESTA_BASICA">Cesta Básica (0%)</option>
                        <option value="REDUZIDA_60">Reduzida 60% (Higiene)</option>
                        <option value="REDUZIDA_30">Reduzida 30%</option>
                        <option value="IMPOSTO_SELETIVO">Imposto Seletivo</option>
                        <option value="IMUNE">Imune</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                    <div className="form-group checkbox-group">
                        <label className="checkbox-label" style={{fontSize: '0.9rem', fontWeight: '600'}}>
                        <input type="checkbox" name="monofasico" checked={formData.monofasico} onChange={handleChange} />
                        Produto Monofásico (PIS/COFINS já pago na indústria)
                        </label>
                    </div>
                    <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                        <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleChange} /> Produto Ativo no Sistema
                        </label>
                    </div>
                </div>
              </div>

              {/* --- 3. FINANCEIRO (Com Markup e Margem) --- */}
              <div className="form-section">
                <h3 className="section-title"><DollarSign size={20} /> Precificação Inteligente</h3>
                <div className="form-row" style={{alignItems: 'flex-start'}}>
                  <div className="form-group">
                    <label>Preço de Custo</label>
                    <div className="input-prefix-group"><span className="prefix">R$</span><input type="text" name="precoCusto" value={formData.precoCusto} onChange={handlePrecoChange} placeholder="0,00" /></div>
                  </div>
                  <div className="form-group" style={{maxWidth: '140px'}}>
                     <label>Markup %</label>
                     <div className="input-prefix-group"><input type="number" name="markup" value={formData.markup} onChange={handleMarkupChange} style={{fontWeight: 'bold', color: '#059669', borderColor: '#a7f3d0'}} /><span className="suffix">%</span></div>
                     <small style={{color: '#059669'}}>Define Venda</small>
                  </div>
                  <div className="form-group">
                    <label className="label-highlight">Preço de Venda</label>
                    <div className="input-prefix-group highlight-group"><span className="prefix">R$</span><input type="text" name="precoVenda" value={formData.precoVenda} onChange={handlePrecoChange} required className="input-highlight" /></div>
                  </div>
                  <div className="form-group" style={{maxWidth: '140px'}}>
                     <label><Percent size={14}/> Margem Real</label>
                     <div className="input-prefix-group"><input type="text" disabled value={formData.margemLucro} style={{backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#6366f1'}} /><span className="suffix">%</span></div>
                  </div>
                </div>
              </div>

              {/* --- 4. ESTOQUE (Travado para Auditoria) --- */}
              <div className="form-section">
                <h3 className="section-title"><Layers size={20} /> Controle de Estoque</h3>
                <div className="form-row" style={{backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1'}}>
                    <div className="form-group"><label><Lock size={14}/> Estoque Fiscal (NFe)</label><input type="text" value={formData.estoqueFiscal} disabled style={{fontWeight: 'bold'}} /></div>
                    <div className="form-group"><label><Lock size={14}/> Estoque S/ Nota</label><input type="text" value={formData.estoqueNaoFiscal} disabled style={{fontWeight: 'bold'}} /></div>
                    <div className="form-group"><label>Total Disponível</label><input type="text" value={formData.quantidadeEmEstoque} disabled style={{backgroundColor: '#e0e7ff', fontWeight: 'bold', color: '#312e81'}} /></div>
                    <div className="form-group" style={{justifyContent: 'center'}}>
                         <small style={{display: 'flex', gap: 6, color: '#d97706'}}><AlertCircle size={16}/><span>Para alterar o estoque, use <b>Entrada de Notas</b> ou <b>Inventário</b>.</span></small>
                    </div>
                </div>
                <div className="form-row" style={{marginTop: '20px'}}>
                  <div className="form-group"><label>Estoque Mínimo</label><input type="number" name="estoqueMinimo" value={formData.estoqueMinimo} onChange={handleChange} /></div>
                  <div className="form-group"><label><Truck size={16}/> Dias Reposição</label><input type="number" name="diasParaReposicao" value={formData.diasParaReposicao} onChange={handleChange} /></div>
                   <div className="form-group flex-2"></div>
                </div>
              </div>

              <div className="form-actions">
                {!isEditMode && (
                  <button type="button" className="btn-secondary" onClick={(e) => handleSubmit(e, true)} disabled={loading}>
                    <PlusCircle size={18} /> Salvar e Adicionar Outro
                  </button>
                )}
                <button id="btn-submit-form" type="submit" className="action-btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Salvando...' : 'Salvar Alterações (Alt+S)'}
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ProdutoForm;