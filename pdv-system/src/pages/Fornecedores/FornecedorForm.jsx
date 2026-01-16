import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Building2 } from 'lucide-react';

const FornecedorForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    razaoSocial: '', nomeFantasia: '', cpfOuCnpj: '',
    ie: '', email: '', telefone: '', cep: '', endereco: '', numero: '',
    bairro: '', cidade: '', uf: '', ativo: true
  });

  useEffect(() => {
    if (id) {
        api.get(`/fornecedores?cnpjCpf=${id}`).then(res => setFormData(res.data)).catch(() => {});
        // Nota: Ajuste a busca por ID no backend se necessário, aqui usei a busca por doc como exemplo ou você cria um getById
    }
  }, [id]);

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/fornecedores', formData);
      toast.success("Fornecedor Salvo!");
      navigate('/fornecedores');
    } catch (err) { toast.error("Erro ao salvar."); }
  };

  return (
    <div className="container-fluid">
      <div className="page-header">
        <div className="page-title">
          <h1>{id ? 'Editar' : 'Novo'} Fornecedor</h1>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/fornecedores')}><ArrowLeft size={18}/> Voltar</button>
      </div>
      <div className="form-container">
        <form onSubmit={handleSubmit}>
           <div className="form-section">
              <h3 className="section-title"><Building2 size={20}/> Dados Cadastrais</h3>
              <div className="form-row">
                 <div className="form-group flex-2"><label>Razão Social *</label><input required name="razaoSocial" value={formData.razaoSocial} onChange={handleChange}/></div>
                 <div className="form-group"><label>CNPJ / CPF *</label><input required name="cpfOuCnpj" value={formData.cpfOuCnpj} onChange={handleChange}/></div>
              </div>
              <div className="form-row">
                 <div className="form-group"><label>Nome Fantasia</label><input name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange}/></div>
                 <div className="form-group"><label>Inscrição Estadual</label><input name="ie" value={formData.ie} onChange={handleChange}/></div>
              </div>
           </div>
           <div className="form-actions">
              <button type="submit" className="action-btn-primary"><Save size={18}/> Salvar</button>
           </div>
        </form>
      </div>
    </div>
  );
};
export default FornecedorForm;