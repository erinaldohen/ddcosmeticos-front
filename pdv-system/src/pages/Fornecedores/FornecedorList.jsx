import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { Plus, Search, Edit, Trash2, Truck } from 'lucide-react';

const FornecedorList = () => {
  const navigate = useNavigate();
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarFornecedores();
  }, []);

  const carregarFornecedores = async () => {
    try {
      const res = await api.get('/fornecedores');
      setFornecedores(res.data);
    } catch (e) {
      toast.error("Erro ao carregar fornecedores");
    } finally { setLoading(false); }
  };

  return (
    <div className="container-fluid">
      <div className="page-header">
        <div className="page-title">
          <h1><Truck size={28} style={{marginRight: 10, verticalAlign: 'middle'}}/> Fornecedores</h1>
          <p>Gestão de parceiros e distribuidores</p>
        </div>
        <button className="action-btn-primary" onClick={() => navigate('/fornecedores/novo')}>
          <Plus size={18} /> Novo Fornecedor
        </button>
      </div>

      <div className="form-container" style={{padding: 0, overflow: 'hidden'}}>
        <div style={{padding: 20, borderBottom: '1px solid #e2e8f0'}}>
           <div className="input-prefix-group">
              <Search size={18} className="prefix" style={{left: 10}}/>
              <input type="text" placeholder="Buscar fornecedor..." style={{paddingLeft: 40}} />
           </div>
        </div>

        {loading ? <div style={{padding: 20}}>Carregando...</div> : (
          <table className="table-custom" style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{background: '#f8fafc', textAlign: 'left'}}>
                <th style={{padding: 15}}>Razão Social / Nome</th>
                <th style={{padding: 15}}>CNPJ / CPF</th>
                <th style={{padding: 15}}>Cidade/UF</th>
                <th style={{padding: 15, textAlign: 'right'}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map(f => (
                <tr key={f.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                  <td style={{padding: 15}}>
                    <strong>{f.razaoSocial}</strong><br/>
                    <small style={{color: '#64748b'}}>{f.nomeFantasia}</small>
                  </td>
                  <td style={{padding: 15}}>{f.cpfOuCnpj}</td>
                  <td style={{padding: 15}}>{f.cidade} - {f.uf}</td>
                  <td style={{padding: 15, textAlign: 'right'}}>
                     <button className="btn-icon" onClick={() => navigate(`/fornecedores/editar/${f.id}`)} style={{marginRight: 10, cursor: 'pointer', border: 'none', background: 'transparent'}}><Edit size={18} color="#6366f1"/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
export default FornecedorList;