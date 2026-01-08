import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MainLayout from '../../components/Layout/MainLayout';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Package, Barcode, DollarSign, Layers } from 'lucide-react';
import './ProdutoForm.css';

const ProdutoForm = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Pega o ID da URL se for edição
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    descricao: '',
    codigoBarras: '',
    precoCusto: '',
    precoVenda: '',
    quantidadeEmEstoque: 0,
    estoqueMinimo: 5,
    ativo: true
  });

  useEffect(() => {
    if (isEditMode) {
      carregarProduto();
    }
  }, [id]);

  const carregarProduto = async () => {
    setLoading(true);
    try {
      const dados = await produtoService.obterPorId(id);
      setFormData(dados);
    } catch (error) {
      toast.error("Erro ao carregar dados do produto.");
      navigate('/produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode) {
        await produtoService.atualizar(id, formData);
        toast.success("Produto atualizado com sucesso!");
      } else {
        await produtoService.salvar(formData);
        toast.success("Produto cadastrado com sucesso!");
      }
      navigate('/produtos');
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar produto. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="container-fluid">

        {/* Header do Formulário */}
        <div className="page-header">
          <div className="page-title">
            <h1>{isEditMode ? 'Editar Produto' : 'Novo Produto'}</h1>
            <p>{isEditMode ? `Editando: ${formData.descricao || '...'}` : 'Preencha os dados abaixo'}</p>
          </div>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate('/produtos')}>
              <ArrowLeft size={18} /> Voltar
            </button>
          </div>
        </div>

        {/* Card do Formulário */}
        <div className="form-container">
          {loading && isEditMode ? (
            <div className="loading-form">Carregando dados...</div>
          ) : (
            <form onSubmit={handleSubmit}>

              {/* Linha 1: Descrição e Código */}
              <div className="form-row">
                <div className="form-group flex-2">
                  <label><Package size={16} /> Descrição do Produto *</label>
                  <input
                    type="text"
                    name="descricao"
                    value={formData.descricao}
                    onChange={handleChange}
                    required
                    placeholder="Ex: Shampoo Hidratante 300ml"
                  />
                </div>
                <div className="form-group flex-1">
                  <label><Barcode size={16} /> Código de Barras (EAN)</label>
                  <input
                    type="text"
                    name="codigoBarras"
                    value={formData.codigoBarras}
                    onChange={handleChange}
                    placeholder="789..."
                  />
                </div>
              </div>

              {/* Linha 2: Preços */}
              <div className="form-row">
                <div className="form-group">
                  <label><DollarSign size={16} /> Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="precoCusto"
                    value={formData.precoCusto}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="label-highlight"><DollarSign size={16} /> Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    name="precoVenda"
                    value={formData.precoVenda}
                    onChange={handleChange}
                    required
                    className="input-highlight"
                  />
                </div>
              </div>

              {/* Linha 3: Estoque */}
              <div className="form-row">
                <div className="form-group">
                  <label><Layers size={16} /> Estoque Atual</label>
                  <input
                    type="number"
                    name="quantidadeEmEstoque"
                    value={formData.quantidadeEmEstoque}
                    onChange={handleChange}
                    disabled={isEditMode} // Geralmente estoque se altera via movimentação, não edição direta (opcional)
                  />
                  {isEditMode && <small>Faça um ajuste de estoque para alterar este valor.</small>}
                </div>
                <div className="form-group">
                  <label>Estoque Mínimo</label>
                  <input
                    type="number"
                    name="estoqueMinimo"
                    value={formData.estoqueMinimo}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="ativo"
                      checked={formData.ativo}
                      onChange={handleChange}
                    />
                    Produto Ativo?
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="action-btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Salvando...' : 'Salvar Dados'}
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