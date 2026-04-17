import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  ArrowLeft, Building2, MapPin, Phone, Search, Loader, CheckCircle
} from 'lucide-react';
import { maskCNPJ, maskPhone, maskCEP, unmask } from '../../utils/masks';
import './FornecedorForm.css';

const FornecedorForm = ({ isModal = false, onSuccess }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !isModal && !!id;

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
    complemento: '',
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
        .catch(() => toast.error("Erro ao carregar dados.", { toastId: "erro-carregar-fornecedor" }))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valorFinal = value;

    if (name === 'cnpj') valorFinal = maskCNPJ(value);
    if (name === 'telefone') valorFinal = maskPhone(value);
    if (name === 'cep') valorFinal = maskCEP(value);

    // Uppercase para campos de texto padrão
    if (['razaoSocial', 'nomeFantasia', 'logradouro', 'bairro', 'cidade', 'contato', 'uf', 'complemento'].includes(name)) {
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
        // Foca no número após achar o endereço
        document.getElementById('ff-input-numero')?.focus();
    } catch (error) {
        console.log("CEP não encontrado ou erro de conexão.");
    } finally {
        setLoadingCep(false);
    }
  };

  // =========================================================================
  // 🔥 CORREÇÃO: CONSULTA RICA (CNPJ.WS PRIMEIRO, BRASIL API COMO FALLBACK)
  // =========================================================================
  const consultarCNPJ = async () => {
      const cnpjLimpo = unmask(formData.cnpj);
      if (cnpjLimpo.length !== 14) return toast.warning("CNPJ incompleto.");

      setLoadingCnpj(true);

      // 1. Verifica duplicidade no Backend
      if (!isEdit) {
          try {
              const check = await api.get(`/fornecedores/buscar-por-cnpj/${cnpjLimpo}`);
              if (check.data && check.data.id) {
                  if (isModal) {
                      toast.success("Fornecedor localizado no sistema!");
                      if (onSuccess) onSuccess(check.data);
                      setLoadingCnpj(false);
                      return;
                  } else {
                      toast.warning("Atenção: Este CNPJ já está cadastrado no sistema.");
                  }
              }
          } catch (error) {
              if (error.response && error.response.status !== 404) {
                  console.error("Erro no backend:", error);
              }
          }
      }

      try {
          // 2. Tentativa Primária: CNPJ.ws (Traz Inscrição Estadual, Contatos Ricos)
          const resPrincipal = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);

          if (resPrincipal.ok) {
              const data = await resPrincipal.json();
              const est = data.estabelecimento;

              // Busca a IE Ativa
              let ieEncontrada = 'ISENTO';
              if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
                  const ieAtiva = est.inscricoes_estaduais.find(i => i.ativa);
                  ieEncontrada = ieAtiva ? ieAtiva.inscricao_estadual : est.inscricoes_estaduais[0].inscricao_estadual;
              }

              // Monta Telefone e E-mail
              const telCompleto = (est.ddd1 && est.telefone1) ? `${est.ddd1}${est.telefone1}` : '';
              const emailCnpj = est.email || '';

              setFormData(prev => ({
                  ...prev,
                  razaoSocial: data.razao_social?.toUpperCase() || '',
                  nomeFantasia: (est.nome_fantasia || data.razao_social)?.toUpperCase() || '',
                  inscricaoEstadual: ieEncontrada,
                  email: emailCnpj.toLowerCase(),
                  telefone: maskPhone(telCompleto),
                  cep: maskCEP(est.cep || ''),
                  logradouro: est.logradouro?.toUpperCase() || '',
                  numero: est.numero || 'SN',
                  complemento: est.complemento?.toUpperCase() || '',
                  bairro: est.bairro?.toUpperCase() || '',
                  cidade: est.cidade?.nome?.toUpperCase() || '',
                  uf: est.estado?.sigla?.toUpperCase() || ''
              }));

              toast.success("Dados completos importados com sucesso! 🏢");
              setLoadingCnpj(false);
              return; // Sai da função, não precisa da BrasilAPI
          }
      } catch (e) {
          console.warn("CNPJ.ws falhou, tentando fallback na BrasilAPI...");
      }

      // 3. Fallback: BrasilAPI (Rápida, mas com menos dados)
      try {
          const resFallback = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
          if (!resFallback.ok) throw new Error('CNPJ não encontrado na Receita.');
          const dados = await resFallback.json();

          setFormData(prev => ({
            ...prev,
            razaoSocial: dados.razao_social?.toUpperCase() || '',
            nomeFantasia: (dados.nome_fantasia || dados.razao_social)?.toUpperCase() || '',
            email: dados.email?.toLowerCase() || prev.email,
            telefone: maskPhone(dados.ddd_telefone_1 || dados.telefone || prev.telefone),
            cep: maskCEP(dados.cep || ''),
            logradouro: dados.logradouro?.toUpperCase() || '',
            numero: dados.numero || 'SN',
            complemento: dados.complemento?.toUpperCase() || '',
            bairro: dados.bairro?.toUpperCase() || '',
            cidade: dados.municipio?.toUpperCase() || '',
            uf: dados.uf?.toUpperCase() || ''
            // IE omitida propositadamente no fallback pois a BrasilAPI não garante precisão
          }));

          toast.success("Dados importados! Preencha a I.E. manualmente.");
      } catch (error) {
          toast.error("Não foi possível buscar dados automáticos. Preencha manualmente.");
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
      let responseData;
      if (isEdit) {
        await api.put(`/fornecedores/${id}`, payload);
        toast.success("Fornecedor atualizado!");
        navigate('/fornecedores');
      } else {
        const res = await api.post('/fornecedores', payload);
        responseData = res.data;
        toast.success("Fornecedor criado!");

        if (isModal && onSuccess) {
            onSuccess(responseData);
        } else {
            navigate('/fornecedores');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Erro ao salvar. Verifique campos obrigatórios.");
    } finally {
      setLoading(false);
    }
  };

  const wrapperClass = isModal ? 'ff-modal-mode' : 'ff-wrapper';

  return (
    <div className={wrapperClass}>
      <div className={isModal ? '' : 'ff-container-limit'}>

        {!isModal && (
            <header className="ff-header">
              <div className="ff-title-area">
                <div className="ff-icon-bg"><Building2 size={24} color="#fff" /></div>
                <div className="ff-text-header">
                  <h1>{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h1>
                  <p>Gerencie as informações fiscais e de contato.</p>
                </div>
              </div>
              <button type="button" className="ff-btn-back" onClick={() => navigate('/fornecedores')}>
                <ArrowLeft size={18} /> Voltar
              </button>
            </header>
        )}

        <form onSubmit={handleSubmit} className={isModal ? 'ff-form-modal' : 'ff-form-card'}>

          {/* SEÇÃO 1: EMPRESARIAL */}
          <div className="ff-section">
            {!isModal && <div className="ff-section-title"><Building2 size={18} /><span>Dados Fiscais</span></div>}
            <div className="ff-grid">
              <div className="ff-col-5">
                <div className="ff-cnpj-row">
                  <div className="ff-cnpj-box">
                    <input
                      type="text" name="cnpj" className="ff-input-floating" placeholder=" "
                      value={formData.cnpj} onChange={handleChange} required maxLength={18} autoFocus={isModal}
                    />
                    <label className="ff-label-floating">CNPJ *</label>
                  </div>
                  <button type="button" className="ff-btn-query" onClick={consultarCNPJ} disabled={loadingCnpj}>
                    {loadingCnpj ? <Loader size={16} className="ff-spin"/> : <Search size={16}/>}
                    {isModal ? '' : 'Receita'}
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
            {!isModal && <div className="ff-section-title"><Phone size={18} /><span>Contato</span></div>}
            <div className="ff-grid">
              <FF_Input label="E-mail" name="email" value={formData.email} onChange={handleChange} colSpan="ff-col-6" />
              <FF_Input label="Telefone" name="telefone" value={formData.telefone} onChange={handleChange} colSpan="ff-col-3" />
              <FF_Input label="Contato" name="contato" value={formData.contato} onChange={handleChange} colSpan="ff-col-3" />
            </div>
          </div>

          {/* SEÇÃO 3: ENDEREÇO */}
          <div className="ff-section">
            {!isModal && (
                <div className="ff-section-title">
                  <MapPin size={18} /><span>Endereço</span>
                  {loadingCep && <span className="ff-loading-tag">buscando...</span>}
                </div>
            )}
            <div className="ff-grid">
              <FF_Input label="CEP" name="cep" value={formData.cep} onChange={handleChange} onBlur={consultarCEP} colSpan="ff-col-3" />
              <FF_Input label="Logradouro" name="logradouro" value={formData.logradouro} onChange={handleChange} colSpan="ff-col-6" />
              <FF_Input id="ff-input-numero" label="Nº" name="numero" value={formData.numero} onChange={handleChange} colSpan="ff-col-3" />

              <FF_Input label="Complemento" name="complemento" value={formData.complemento} onChange={handleChange} colSpan="ff-col-3" />
              <FF_Input label="Bairro" name="bairro" value={formData.bairro} onChange={handleChange} colSpan="ff-col-4" />
              <FF_Input label="Cidade" name="cidade" value={formData.cidade} onChange={handleChange} colSpan="ff-col-3" />
              <FF_Input label="UF" name="uf" value={formData.uf} onChange={handleChange} colSpan="ff-col-2" />
            </div>
          </div>

          <div className="ff-footer">
            {!isModal && <button type="button" className="ff-btn-cancel" onClick={() => navigate('/fornecedores')}>Cancelar</button>}
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

// Componente de Input Reutilizável
const FF_Input = ({ label, name, value, onChange, colSpan = "ff-col-12", required = false, id = null, onBlur = null }) => (
  <div className={`ff-floating-group ${colSpan}`}>
    <input
      id={id} type="text" name={name} className="ff-input-floating" placeholder=" "
      value={value || ''} onChange={onChange} onBlur={onBlur} required={required}
    />
    <label className="ff-label-floating">{label} {required && <span style={{color:'#ef4444'}}>*</span>}</label>
  </div>
);

export default FornecedorForm;