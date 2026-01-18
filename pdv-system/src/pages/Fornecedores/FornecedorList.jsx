import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import { Plus, Search, Edit, Trash2, Building2, Phone, Mail, MapPin, ChevronLeft, ChevronRight, Truck, X } from 'lucide-react';
import './FornecedorList.css';

const FornecedorList = () => {
  const navigate = useNavigate();
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  // Função de carregar dados isolada
  const fetchFornecedores = useCallback(async (termo = '', page = 0) => {
    setLoading(true);
    try {
      const url = `/fornecedores?page=${page}&size=10&termo=${termo}`;
      const res = await api.get(url);
      setFornecedores(res.data.content || []);
      setTotalPaginas(res.data.totalPages || 0);
    } catch (e) {
      toast.error("Erro ao sincronizar dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce para busca automática conforme digita
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFornecedores(termoBusca, 0); // Sempre volta para página 0 na busca
      setPagina(0);
    }, 400); // Aguarda 400ms após o último caractere
    return () => clearTimeout(timer);
  }, [termoBusca, fetchFornecedores]);

  // Carregar quando trocar de página (sem busca ativa)
  useEffect(() => {
    if (termoBusca === '') {
      fetchFornecedores('', pagina);
    }
  }, [pagina, termoBusca, fetchFornecedores]);

  const handleExcluir = async (id) => {
    if (window.confirm("Deseja inativar este fornecedor?")) {
      try {
        await api.delete(`/fornecedores/${id}`);
        toast.success("Fornecedor atualizado.");
        fetchFornecedores(termoBusca, pagina);
      } catch (e) { toast.error("Erro na exclusão."); }
    }
  };

  return (
    <div className="fl-wrapper">
      <Tooltip id="fl-tip" />

      <header className="fl-header">
        <div className="fl-title-area">
          <div className="fl-icon-bg"><Truck size={24} color="#fff" /></div>
          <div className="fl-text-header">
            <h1>Fornecedores</h1>
            <p>Listagem dinâmica de parceiros comerciais</p>
          </div>
        </div>
        <button className="fl-btn-new" onClick={() => navigate('/fornecedores/novo')}>
          <Plus size={18} /> Adicionar
        </button>
      </header>

      <div className="fl-card-main">
        <div className="fl-toolbar-search">
          <div className="fl-search-box-v2">
            <Search className="fl-icon-left" size={20} />
            <input
              type="text"
              className="fl-input-v2"
              placeholder="Digite o CNPJ ou Nome do fornecedor..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
            />
            {termoBusca && (
              <button className="fl-btn-clear" onClick={() => setTermoBusca('')}>
                <X size={16} />
              </button>
            )}
            {loading && <div className="fl-loader-mini"></div>}
          </div>
        </div>

        <div className="fl-table-scroll">
          <table className="fl-table">
            <thead>
              <tr>
                <th>Fornecedor / CNPJ</th>
                <th>Contato Principal</th>
                <th>Cidade</th>
                <th>Status</th>
                <th className="fl-text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores.map(f => (
                <tr key={f.id} className="fl-tr-hover">
                  <td>
                    <div className="fl-cell-main">
                      <span className="fl-primary-text">{f.nomeFantasia}</span>
                      <span className="fl-secondary-text">{f.cnpj}</span>
                    </div>
                  </td>
                  <td>
                    <div className="fl-cell-contact">
                      <span>{f.telefone || 'Sem telefone'}</span>
                      <small>{f.email || 'Sem e-mail'}</small>
                    </div>
                  </td>
                  <td><span className="fl-city-tag">{f.cidade} - {f.uf}</span></td>
                  <td>
                    <span className={`fl-status-dot ${f.ativo ? 'is-active' : 'is-inactive'}`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="fl-text-right">
                    <div className="fl-actions-row">
                      <button className="fl-icon-btn edit" onClick={() => navigate(`/fornecedores/editar/${f.id}`)} data-tooltip-id="fl-tip" data-tooltip-content="Editar"><Edit size={16}/></button>
                      <button className="fl-icon-btn delete" onClick={() => handleExcluir(f.id)} data-tooltip-id="fl-tip" data-tooltip-content="Inativar"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && fornecedores.length === 0 && (
                <tr>
                  <td colSpan="5" className="fl-no-results">
                    Nenhum fornecedor encontrado para "{termoBusca}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="fl-footer">
          <div className="fl-pagination-info">
            Mostrando página {pagina + 1} de {totalPaginas}
          </div>
          <div className="fl-pagination-nav">
            <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} className="fl-nav-btn"><ChevronLeft size={18}/></button>
            <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)} className="fl-nav-btn"><ChevronRight size={18}/></button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FornecedorList;