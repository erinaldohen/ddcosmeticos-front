import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // useParams é vital para edição
import api from '../../services/api';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Search, Loader } from 'lucide-react';

const FornecedorForm = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // Pega o ID da URL

  const [loading, setLoading] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);

  const [formData, setFormData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    inscricaoEstadual: '',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: ''
  });

  // --- 1. CORREÇÃO: CARREGAR DADOS NA EDIÇÃO ---
  useEffect(() => {
    if (id) {
      carregarFornecedor();
    }
  }, [id]);

  const carregarFornecedor = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/fornecedores/${id}`);
      setFormData(res.data);
    } catch (error) {
      toast.error("Erro ao carregar dados do fornecedor.");
      navigate('/fornecedores');
    } finally {
      setLoading(false);
    }
  };
  // ---------------------------------------------

  // --- 2. NOVA FUNCIONALIDADE: BUSCA CNPJ ---
  const buscarDadosCnpj = async () => {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
        return toast.warning("Digite um CNPJ válido (14 números) para pesquisar.");
    }

    setLoadingCnpj(true);
    try {
        const res = await api.get(`/fornecedores/consulta-cnpj/${cnpjLimpo}`);
        const dados = res.data;

        setFormData(prev => ({
            ...prev,
            razaoSocial: dados.razao_social || '',
            nomeFantasia: dados.nome_fantasia || dados.razao_social || '',
            logradouro: dados.logradouro || '',
            numero: dados.numero || '',
            bairro: dados.bairro || '',
            cidade: dados.municipio || '',
            estado: dados.uf || '',
            cep: dados.cep || '',
            telefone: dados.ddd_telefone_1 || ''
        }));
        toast.success("Dados encontrados!");
    } catch (error) {
        toast.error("CNPJ não encontrado na base pública ou API indisponível.");
    } finally {
        setLoadingCnpj(false);
    }
  };
  // ------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (id) {
        await api.put(`/fornecedores/${id}`, formData);
        toast.success("Fornecedor atualizado!");
      } else {
        await api.post('/fornecedores', formData);
        toast.success("Fornecedor cadastrado!");
      }
      navigate('/fornecedores');
    } catch (error) {
      toast.error("Erro ao salvar. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="page-header">
        <div className="page-title">
          <h1>{id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h1>
          <p>Preencha os dados cadastrais</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/fornecedores')}>
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      <div className="card-entrada" style={{maxWidth: '800px', margin: '0 auto'}}>
        <form onSubmit={handleSubmit}>

          {/* BLOCO PRINCIPAL */}
          <h3 className="card-title">Dados Principais</h3>
          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
              <label>CNPJ *</label>
              <div style={{display: 'flex', gap: 10}}>
                  <input
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleChange}
                    placeholder="00.000.000/0000-00"
                    required
                    maxLength={18}
                  />
                  <button
                    type="button"
                    className="btn-xml" // Reutilizando estilo do botão cinza
                    onClick={buscarDadosCnpj}
                    disabled={loadingCnpj}
                    title="Consultar na Receita"
                  >
                    {loadingCnpj ? <Loader size={16} className="spin"/> : <Search size={16}/>}
                  </button>
              </div>
            </div>

            <div className="form-group" style={{flex: 1}}>
              <label>Inscrição Estadual</label>
              <input name="inscricaoEstadual" value={formData.inscricaoEstadual} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex: 2}}>
              <label>Razão Social *</label>
              <input name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} required />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Nome Fantasia</label>
              <input name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Telefone</label>
              <input name="telefone" value={formData.telefone} onChange={handleChange} />
            </div>
          </div>

          <hr style={{margin: '20px 0', border: '0', borderTop: '1px solid #e2e8f0'}} />

          {/* BLOCO ENDEREÇO */}
          <h3 className="card-title">Endereço</h3>
          <div className="form-row">
            <div className="form-group" style={{flex: 1}}>
               <label>CEP</label>
               <input name="cep" value={formData.cep} onChange={handleChange} />
            </div>
            <div className="form-group" style={{flex: 3}}>
               <label>Logradouro</label>
               <input name="logradouro" value={formData.logradouro} onChange={handleChange} />
            </div>
            <div className="form-group" style={{flex: 1}}>
               <label>Número</label>
               <input name="numero" value={formData.numero} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
             <div className="form-group" style={{flex: 1}}>
                <label>Bairro</label>
                <input name="bairro" value={formData.bairro} onChange={handleChange} />
             </div>
             <div className="form-group" style={{flex: 1}}>
                <label>Cidade</label>
                <input name="cidade" value={formData.cidade} onChange={handleChange} />
             </div>
             <div className="form-group" style={{flex: 0.5}}>
                <label>UF</label>
                <input name="estado" value={formData.estado} onChange={handleChange} maxLength={2} />
             </div>
          </div>

          <div style={{marginTop: 30, display: 'flex', justifyContent: 'flex-end'}}>
            <button type="submit" className="btn-finalizar" style={{width: 'auto', padding: '0 40px'}} disabled={loading}>
              {loading ? 'Salvando...' : <><Save size={20}/> Salvar Cadastro</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default FornecedorForm;