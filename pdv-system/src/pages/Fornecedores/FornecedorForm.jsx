import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  ArrowLeft, Save, Building2, MapPin, Phone, Search, Loader, CheckCircle
} from 'lucide-react';
import { maskCNPJ, maskPhone, maskCEP, unmask } from '../../utils/masks';
import './FornecedorForm.css';

const FornecedorForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const [formData, setFormData] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    email: '',
    telefone: '',
    contato: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    ativo: true
  });

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      api.get(`/fornecedores/${id}`)
        .then(res => setFormData(res.data))
        .catch(() => toast.error("Erro ao carregar dados."))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valorFinal = value;

    if (name === 'cnpj') valorFinal = maskCNPJ(value);
    if (name === 'telefone') valorFinal = maskPhone(value);
    if (name === 'cep') valorFinal = maskCEP(value);

    if (['razaoSocial', 'nomeFantasia', 'logradouro', 'bairro', 'cidade', 'contato', 'uf'].includes(name)) {
        valorFinal = value.toUpperCase();
    }

    setFormData(prev => ({ ...prev, [name]: valorFinal }));
  };

  const consultarCEP = async () => {
    const cepLimpo = unmask(formData.cep);
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);
        if (!res.ok) throw new Error('CEP não encontrado');
        const data = await res.json();

        setFormData(prev => ({
            ...prev,
            logradouro: data.street ? data.street.toUpperCase() : prev.logradouro,
            bairro: data.neighborhood ? data.neighborhood.toUpperCase() : prev.bairro,
            cidade: data.city ? data.city.toUpperCase() : prev.cidade,
            uf: data.state ? data.state.toUpperCase() : prev.uf
        }));
        document.getElementById('ff-input-numero')?.focus();
    } catch (error) {
        console.log("CEP não encontrado.");
    } finally {
        setLoadingCep(false);
    }
  };

  const consultarCNPJ = async () => {
    const cnpjLimpo = unmask(formData.cnpj);
    if (cnpjLimpo.length !== 14) return toast.warning("CNPJ incompleto.");

    setLoadingCnpj(true);
    try {
      const res = await api.get(`/fornecedores/consulta-cnpj/${cnpjLimpo}`);
      const dados = res.data;

      setFormData(prev => ({
        ...prev,
        razaoSocial: dados.razaoSocial?.toUpperCase() || prev.razaoSocial,
        nomeFantasia: dados.nomeFantasia?.toUpperCase() || dados.razaoSocial?.toUpperCase(),
        email: dados.email?.toLowerCase() || prev.email,
        inscricaoEstadual: dados.inscricaoEstadual || prev.inscricaoEstadual,
        logradouro: dados.logradouro?.toUpperCase() || prev.logradouro,
        numero: dados.numero || '',
        bairro: dados.bairro?.toUpperCase() || prev.bairro,
        cidade: dados.municipio?.toUpperCase() || prev.cidade,
        uf: dados.uf?.toUpperCase() || prev.uf,
        cep: maskCEP(dados.cep || prev.cep),
        telefone: maskPhone(dados.telefone || prev.telefone)
      }));
      toast.success("Dados da Receita importados!");
    } catch (error) {
      toast.error("Erro ao consultar CNPJ.");
    } finally {
      setLoadingCnpj(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
        ...formData,
        cnpj: unmask(formData.cnpj),
        cep: unmask(formData.cep),
        telefone: unmask(formData.telefone)
    };

    try {
      if (isEdit) {
        await api.put(`/fornecedores/${id}`, payload);
        toast.success("Fornecedor atualizado!");
      } else {
        await api.post('/fornecedores', payload);
        toast.success("Fornecedor criado!");
      }
      navigate('/fornecedores');
    } catch (error) {
      toast.error(error.response?.data?.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ff-wrapper">
      <div className="ff-container-limit">
        <header className="ff-header">
          <div className="ff-title-area">
            <div className="ff-icon-bg">
              <Building2 size={24} color="#fff" />
            </div>
            <div className="ff-text-header">
              <h1>{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h1>
              <p>Gerencie as informações fiscais e de contato do parceiro.</p>
            </div>
          </div>
          <button className="ff-btn-back" onClick={() => navigate('/fornecedores')}>
            <ArrowLeft size={18} /> Voltar
          </button>
        </header>

        <form onSubmit={handleSubmit} className="ff-form-card">

          {/* SEÇÃO 1: EMPRESARIAL */}
          <div className="ff-section">
            <div className="ff-section-title">
              <Building2 size={18} />
              <span>Dados Fiscais</span>
            </div>

            <div className="ff-grid">
              <div className="ff-col-5">
                <div className="ff-cnpj-row">
                  <div className="ff-cnpj-box">
                    <input
                      type="text"
                      name="cnpj"
                      className="ff-input-floating"
                      placeholder=" "
                      value={formData.cnpj}
                      onChange={handleChange}
                      required
                      maxLength={18}
                    />
                    <label className="ff-label-floating">CNPJ *</label>
                  </div>
                  <button type="button" className="ff-btn-query" onClick={consultarCNPJ} disabled={loadingCnpj}>
                    {loadingCnpj ? <Loader size={16} className="ff-spin"/> : <Search size={16}/>}
                    Receita
                  </button>
                </div>
              </div>

              <FF_Input label="Inscrição Estadual" name="inscricaoEstadual" value={formData.inscricaoEstadual} onChange={handleChange} colSpan="ff-col-7" />
              <FF_Input label="Razão Social" name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} colSpan="ff-col-6" required />
              <FF_Input label="Nome Fantasia" name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} colSpan="ff-col-6" required />
            </div>
          </div>

          {/* SEÇÃO 2: CONTATO */}
          <div className="ff-section">
            <div className="ff-section-title">
              <Phone size={18} />
              <span>Canais de Contato</span>
            </div>
            <div className="ff-grid">
              <FF_Input label="E-mail Corporativo" name="email" value={formData.email} onChange={handleChange} colSpan="ff-col-6" />
              <FF_Input label="Telefone / WhatsApp" name="telefone" value={formData.telefone} onChange={handleChange} colSpan="ff-col-3" />
              <FF_Input label="Pessoa de Contato" name="contato" value={formData.contato} onChange={handleChange} colSpan="ff-col-3" />
            </div>
          </div>

          {/* SEÇÃO 3: ENDEREÇO */}
          <div className="ff-section">
            <div className="ff-section-title">
              <MapPin size={18} />
              <span>Localização</span>
              {loadingCep && <span className="ff-loading-tag">Buscando...</span>}
            </div>
            <div className="ff-grid">
              <FF_Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} onBlur={consultarCEP} colSpan="ff-col-3" />
              <FF_Input label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} colSpan="ff-col-7" />
              <FF_Input id="ff-input-numero" label="Nº" name="numero" value={formData.numero} onChange={handleChange} colSpan="ff-col-2" />
              <FF_Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} colSpan="ff-col-4" />
              <FF_Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} colSpan="ff-col-6" />
              <FF_Input label="UF" name="uf" value={formData.uf} onChange={handleChange} colSpan="ff-col-2" />
            </div>
          </div>

          <div className="ff-footer">
            <button type="button" className="ff-btn-cancel" onClick={() => navigate('/fornecedores')}>
              Cancelar
            </button>
            <button type="submit" className="ff-btn-save" disabled={loading}>
              {loading ? <Loader size={18} className="ff-spin"/> : <CheckCircle size={18}/>}
              {loading ? 'Salvando...' : 'Salvar Cadastro'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

// Componente Interno Isolado
const FF_Input = ({ label, name, value, onChange, colSpan = "ff-col-12", required = false, id = null, onBlur = null }) => (
  <div className={`ff-floating-group ${colSpan}`}>
    <input
      id={id}
      type="text"
      name={name}
      className="ff-input-floating"
      placeholder=" "
      value={value || ''}
      onChange={onChange}
      onBlur={onBlur}
      required={required}
    />
    <label className="ff-label-floating">
      {label} {required && <span style={{color:'#ef4444'}}>*</span>}
    </label>
  </div>
);

export default FornecedorForm;