import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
// Removido 'react-tooltip' em favor do CSS global data-tooltip
import {
  Plus, Search, Edit, Trash2, Truck, X,
  ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmModal from '../../components/ConfirmModal'; // Importando Modal Seguro
import './FornecedorList.css';

const FornecedorList = () => {
  const navigate = useNavigate();
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  // Estado para Modal de Exclusão
  const [modalDelete, setModalDelete] = useState({ open: false, id: null, nome: '' });

  // --- LÓGICA DE BUSCA (Mantida Original) ---
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFornecedores(termoBusca, 0);
      setPagina(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [termoBusca, fetchFornecedores]);

  useEffect(() => {
    if (termoBusca === '') {
      fetchFornecedores('', pagina);
    }
  }, [pagina, termoBusca, fetchFornecedores]);

  // --- AÇÃO DE EXCLUSÃO (Com Modal) ---
  const confirmarExclusao = async () => {
    try {
      await api.delete(`/fornecedores/${modalDelete.id}`);
      toast.success("Fornecedor inativado com sucesso!");
      setModalDelete({ open: false, id: null, nome: '' });
      fetchFornecedores(termoBusca, pagina);
    } catch (e) {
      toast.error(e.response?.data?.message || "Erro na exclusão.");
    }
  };

  // --- GERADOR DE PDF ---
  const gerarRelatorioPDF = () => {
    const doc = new jsPDF();

    // Cabeçalho Marca
    doc.setFillColor(59, 130, 246); // Azul Primary
    doc.rect(0, 0, 210, 20, 'F');
    doc.setFontSize(22); doc.setTextColor(255, 255, 255);
    doc.text("DD Cosméticos", 14, 13);
    doc.setFontSize(10);
    doc.text("Relatório de Fornecedores", 150, 13);

    doc.setTextColor(50);
    doc.setFont(undefined, 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);

    const tableBody = fornecedores.map(f => [
      f.nomeFantasia,
      f.cnpj,
      f.telefone || '-',
      f.email || '-',
      f.ativo ? 'Ativo' : 'Inativo'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [["Nome", "CNPJ", "Telefone", "Email", "Status"]],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 },
    });

    doc.save("Fornecedores.pdf");
    toast.success("PDF baixado com sucesso!");
  };

  return (
    <div className="fl-wrapper fade-in">

      <header className="fl-header">
        <div className="fl-title-area">
          <div className="fl-icon-bg"><Truck size={24} color="#fff" /></div>
          <div className="fl-text-header">
            <h1>Fornecedores</h1>
            <p>Listagem dinâmica de parceiros comerciais</p>
          </div>
        </div>

        <div className="fl-header-actions">
          <button className="fl-btn-secondary" onClick={gerarRelatorioPDF} data-tooltip="Baixar PDF">
            <Download size={18} /> <span className="mobile-hide">Relatório</span>
          </button>
          <button className="fl-btn-new" onClick={() => navigate('/fornecedores/novo')} data-tooltip="Novo Cadastro">
            <Plus size={18} /> <span className="mobile-hide">Adicionar</span>
          </button>
        </div>
      </header>

      <div className="fl-card-main">
        <div className="fl-toolbar-search">
          <div className="fl-search-box-v2">
            <Search className="fl-icon-left" size={20} />
            <input
              type="text"
              className="fl-input-v2"
              placeholder="Digite o CNPJ ou Nome..."
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
                  <td><span className="fl-city-tag">{f.cidade ? `${f.cidade} - ${f.uf}` : 'N/A'}</span></td>
                  <td>
                    <span className={`fl-status-dot ${f.ativo ? 'is-active' : 'is-inactive'}`}>
                      {f.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="fl-text-right">
                    <div className="fl-actions-row">
                      <button
                        className="fl-icon-btn edit"
                        onClick={() => navigate(`/fornecedores/editar/${f.id}`)}
                        data-tooltip="Editar"
                      >
                        <Edit size={16}/>
                      </button>
                      <button
                        className="fl-icon-btn delete tooltip-left"
                        onClick={() => setModalDelete({ open: true, id: f.id, nome: f.nomeFantasia })}
                        data-tooltip="Inativar"
                      >
                        <Trash2 size={16}/>
                      </button>
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
            Página {pagina + 1} de {totalPaginas > 0 ? totalPaginas : 1}
          </div>
          <div className="fl-pagination-nav">
            <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} className="fl-nav-btn"><ChevronLeft size={18}/></button>
            <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)} className="fl-nav-btn"><ChevronRight size={18}/></button>
          </div>
        </footer>
      </div>

      {/* MODAL DE CONFIRMAÇÃO */}
      {modalDelete.open && (
        <ConfirmModal
          title="Inativar Fornecedor"
          message={`Tem certeza que deseja inativar "${modalDelete.nome}"?`}
          onConfirm={confirmarExclusao}
          onCancel={() => setModalDelete({ open: false, id: null, nome: '' })}
        />
      )}
    </div>
  );
};

export default FornecedorList;