import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '../../components/Layout/MainLayout';
import { produtoService } from '../../services/produtoService'; // Importação corrigida
import { toast } from 'react-toastify';
import {
  Save, ArrowLeft, Package, Barcode, DollarSign,
  Layers, Tag, Image, Ruler, Percent,
  Landmark, Truck, DownloadCloud, Upload, Image as ImageIcon // Ícones novos
} from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [searchingEan, setSearchingEan] = useState(false);

  // Estados para Upload de Imagem
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

    // FISCAL
    ncm: '',
    cest: '',
    cst: '102',
    classificacaoReforma: 'PADRAO',
    monofasico: false,

    urlImagem: '',

    // FINANCEIRO
    precoCusto: '',
    precoVenda: '',
    precoMedio: '0,00',

    quantidadeEmEstoque: 0,
    estoqueMinimo: 5,
    diasParaReposicao: 0,
    estoqueFiscal: 0,
    estoqueNaoFiscal: 0
  });

  // --- FUNÇÃO AUXILIAR PARA CORRIGIR URL DA IMAGEM ---
  const getImageUrl = (url) => {
    if (!url) return null;
    // Se for blob (upload local) ou http (link externo), usa como está
    if (url.startsWith('blob:') || url.startsWith('http')) return url;

    // Se for caminho relativo do backend (/imagens/...), adiciona o host
    // Ajuste a porta 8080 se necessário
    return `http://localhost:8080${url}`;
  };

  const formatarValorInicial = (valor) => {
    if (!valor) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
  };

  const formatarValor4Casas = (valor) => {
    if (!valor) return '0,0000';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(valor);
  };

  const aplicarMascaraMoeda = (valor) => {
    if (!valor) return '';
    const apenasNumeros = valor.replace(/\D/g, "");
    const numero = Number(apenasNumeros) / 100;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numero);
  };

  const converterParaFloat = (valorFormatado) => {
    if (!valorFormatado) return 0;
    const valorLimpo = valorFormatado.toString().replace(/\./g, '').replace(',', '.');
    return parseFloat(valorLimpo);
  };

  useEffect(() => {
    if (isEditMode) {
      carregarProduto();
    }
  }, [id]);

  const carregarProduto = async () => {
    setLoading(true);
    try {
      const dados = await produtoService.obterPorId(id);
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
        urlImagem: dados.urlImagem || '',
        precoCusto: formatarValorInicial(dados.precoCusto),
        precoVenda: formatarValorInicial(dados.precoVenda),
        precoMedio: formatarValor4Casas(dados.precoMedioPonderado),
        diasParaReposicao: dados.diasParaReposicao || 0,
        estoqueFiscal: dados.estoqueFiscal || 0,
        estoqueNaoFiscal: dados.estoqueNaoFiscal || 0
      });
      // Se já tem imagem salva, define no preview
      if (dados.urlImagem) {
        setPreviewImagem(dados.urlImagem);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados do produto.");
      navigate('/produtos');
    } finally {
      setLoading(false);
    }
  };

  // --- MANIPULADOR DE ARQUIVO ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setArquivoImagem(file);
      const previewUrl = URL.createObjectURL(file);
      setPreviewImagem(previewUrl);
    }
  };

  const handleBuscarEan = async () => {
    const ean = formData.codigoBarras;
    if (!ean || ean.length < 8) {
      toast.warning("Digite um código de barras válido para buscar.");
      return;
    }

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
        classificacaoReforma: dadosExternos.classificacaoReforma || prev.classificacaoReforma
      }));

      // Se a API externa retornou imagem e o usuário não selecionou arquivo manual
      if (dadosExternos.urlImagem && !arquivoImagem) {
        setPreviewImagem(dadosExternos.urlImagem);
      }

      if(dadosExternos.ncm) {
          toast.success("Dados encontrados e regras fiscais aplicadas!");
      } else {
          toast.warning("Produto encontrado, mas sem dados fiscais (NCM).");
      }
    } catch (error) {
      console.error(error);
      toast.info("Produto não encontrado na base externa. Preencha manualmente.");
    } finally {
      setSearchingEan(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'precoCusto' || name === 'precoVenda') {
      setFormData(prev => ({ ...prev, [name]: aplicarMascaraMoeda(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        precoCusto: converterParaFloat(formData.precoCusto),
        precoVenda: converterParaFloat(formData.precoVenda),
        diasParaReposicao: Number(formData.diasParaReposicao),
        estoqueMinimo: Number(formData.estoqueMinimo),
        quantidadeEmEstoque: Number(formData.quantidadeEmEstoque)
      };

      let produtoSalvo;
      if (isEditMode) {
        produtoSalvo = await produtoService.atualizar(id, payload);
        toast.success("Produto atualizado com sucesso!");
      } else {
        produtoSalvo = await produtoService.salvar(payload);
        toast.success("Produto cadastrado com sucesso!");
      }

      // --- LÓGICA DE UPLOAD ---
      if (arquivoImagem) {
        const idFinal = produtoSalvo.id || id; // Pega o ID do retorno se for novo
        await produtoService.uploadImagem(idFinal, arquivoImagem);
        toast.success("Imagem enviada com sucesso!");
      }

      navigate('/produtos');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar. Verifique os campos obrigatórios.");
    } finally {
      setLoading(false);
    }
  };

  const custoFloat = converterParaFloat(formData.precoCusto);
  const vendaFloat = converterParaFloat(formData.precoVenda);
  const margem = custoFloat > 0 && vendaFloat > 0
    ? (((vendaFloat - custoFloat) / custoFloat) * 100).toFixed(2)
    : '0';

  return (
    <MainLayout>
      <div className="container-fluid">
        <div className="page-header">
          <div className="page-title">
            <h1>{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
            <p>{isEditMode ? 'Atualize as informações completas do item' : 'Cadastre um novo item no inventário'}</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/produtos')}>
              <ArrowLeft size={18} /> Voltar
            </button>
          </div>
        </div>

        <div className="form-container">
          {loading && isEditMode && !formData.descricao ? (
            <div className="loading-form"><div className="spinner"></div> Carregando dados...</div>
          ) : (
            <form onSubmit={handleSubmit}>

              {/* SEÇÃO 1: IDENTIFICAÇÃO + IMAGEM */}
              <div className="form-section">
                <h3 className="section-title"><Package size={20} /> Informações Básicas</h3>

                <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>

                  {/* Lado Esquerdo: Campos */}
                  <div style={{ flex: 2, minWidth: '300px' }}>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label><Barcode size={16} /> Código de Barras (EAN)</label>
                        <div className="input-action-group">
                          <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} placeholder="789..." onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleBuscarEan(); } }} />
                          <button type="button" className="btn-search-icon" onClick={handleBuscarEan} disabled={searchingEan}>
                            {searchingEan ? <div className="spinner-small"></div> : <DownloadCloud size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="form-group flex-2">
                        <label>Descrição do Produto *</label>
                        <input type="text" name="descricao" value={formData.descricao} onChange={handleChange} required placeholder="Ex: Creme..." />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group"><label>Marca</label><input type="text" name="marca" value={formData.marca} onChange={handleChange} /></div>
                      <div className="form-group"><label>Categoria</label><input type="text" name="categoria" value={formData.categoria} onChange={handleChange} /></div>
                      <div className="form-group"><label>Subcategoria</label><input type="text" name="subcategoria" value={formData.subcategoria} onChange={handleChange} /></div>
                      <div className="form-group flex-small">
                        <label><Ruler size={16} /> Unidade</label>
                        <select name="unidade" value={formData.unidade} onChange={handleChange}>
                            <option value="UN">UN</option><option value="KG">KG</option><option value="LT">LT</option><option value="CX">CX</option><option value="KIT">KIT</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Upload de Imagem */}
                  <div className="image-upload-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px dashed #ddd', padding: '20px', borderRadius: '8px', backgroundColor: '#fafafa', minWidth: '200px' }}>
                    <div className="image-preview-box" style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '4px', marginBottom: '10px', overflow: 'hidden' }}>
                      {previewImagem ? (
                        <img
                          src={getImageUrl(previewImagem)} // [CORREÇÃO] Aqui usamos a função auxiliar
                          alt="Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => { e.target.style.display = 'none'; }} // Esconde se der erro
                        />
                      ) : (
                        <ImageIcon size={48} color="#ccc" />
                      )}
                    </div>

                    <label htmlFor="file-upload" className="btn-upload" style={{ cursor: 'pointer', color: '#6366f1', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: '1px solid #6366f1', borderRadius: '6px' }}>
                      <Upload size={18} /> Carregar Imagem
                    </label>
                    <input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    <small style={{ color: '#999', marginTop: '8px', fontSize: '0.8rem' }}>Ou cole URL abaixo</small>

                    <input
                      type="text"
                      name="urlImagem"
                      value={formData.urlImagem}
                      onChange={(e) => { handleChange(e); setPreviewImagem(e.target.value); }}
                      placeholder="https://..."
                      style={{ width: '100%', marginTop: '5px', fontSize: '0.8rem', padding: '5px' }}
                    />
                  </div>

                </div>
              </div>

              {/* --- SEÇÃO 3: FISCAL --- */}
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

              {/* --- SEÇÃO 4: FINANCEIRO --- */}
              <div className="form-section">
                <h3 className="section-title"><DollarSign size={20} /> Financeiro</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Custo Última Compra (R$)</label>
                    <div className="input-prefix-group">
                        <span className="prefix">R$</span>
                        <input type="text" name="precoCusto" value={formData.precoCusto} onChange={handleChange} placeholder="0,00" />
                    </div>
                  </div>

                  <div className="form-group" style={{opacity: 0.85}}>
                    <label title="Custo Médio Ponderado calculado automaticamente nas entradas">Custo Médio (R$)</label>
                    <div className="input-prefix-group">
                        <span className="prefix">R$</span>
                        <input type="text" disabled value={formData.precoMedio} style={{backgroundColor: '#f1f5f9', fontWeight:'bold'}} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label-highlight">Preço de Venda *</label>
                    <div className="input-prefix-group highlight-group">
                        <span className="prefix">R$</span>
                        <input type="text" name="precoVenda" value={formData.precoVenda} onChange={handleChange} required placeholder="0,00" className="input-highlight" />
                    </div>
                  </div>

                  <div className="form-group">
                     <label><Percent size={16}/> Margem Estimada</label>
                     <input type="text" disabled value={`${margem}%`} style={{backgroundColor: '#f1f5f9', fontWeight: 'bold', color: 'var(--primary)'}} />
                  </div>
                </div>
              </div>

              {/* --- SEÇÃO 5: ESTOQUE --- */}
              <div className="form-section">
                <h3 className="section-title"><Layers size={20} /> Estoque</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Estoque Total (Físico)</label>
                    <input type="number" name="quantidadeEmEstoque" value={formData.quantidadeEmEstoque} onChange={handleChange} disabled={isEditMode} />
                    {isEditMode && <small>Use o menu "Entradas" para ajustar.</small>}
                  </div>

                  <div className="form-group">
                    <label>Estoque Mínimo</label>
                    <input type="number" name="estoqueMinimo" value={formData.estoqueMinimo} onChange={handleChange} />
                  </div>

                  <div className="form-group">
                    <label><Truck size={16}/> Dias Reposição</label>
                    <input type="number" name="diasParaReposicao" value={formData.diasParaReposicao} onChange={handleChange} placeholder="Ex: 7" />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="action-btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Processando...' : 'Salvar Produto'}
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