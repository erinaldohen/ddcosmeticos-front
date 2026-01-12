import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Edit, Trash2, Package,
  ChevronLeft, ChevronRight, Wand2, Printer, Clock, X // Novos ícones: Clock, X
} from 'lucide-react';
import './ProdutoList.css';

// --- COMPONENTE MODAL DE HISTÓRICO (INTERNO) ---
const HistoricoModal = ({ isOpen, onClose, historico, produtoNome }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Histórico de Alterações</h3>
          <button onClick={onClose} className="btn-close"><X size={20}/></button>
        </div>
        <div className="modal-body">
          <p className="modal-subtitle">Produto: <strong>{produtoNome}</strong></p>

          {historico.length === 0 ? (
            <p className="empty-history">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="timeline">
              {historico.map((item, index) => (
                <li key={index} className="timeline-item">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-date">
                        {new Date(item.dataAlteracao).toLocaleString()}
                      </span>
                      <span className={`badge-tipo ${item.tipo}`}>{item.tipo}</span>
                    </div>
                    <div className="timeline-details">
                      <p><strong>Nome:</strong> {item.nomeProduto}</p>
                      <p>
                        <strong>Preço Venda:</strong> R$ {item.precoVenda?.toFixed(2)} |
                        <strong> Custo:</strong> R$ {item.precoCusto?.toFixed(2)}
                      </p>
                      <p><strong>Estoque:</strong> {item.quantidadeEstoque}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const ProdutoList = () => {
  const navigate = useNavigate();

  // Estados Principais
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaneamento, setLoadingSaneamento] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(null);

  // Estados de Paginação e Busca
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  // Estados do Modal de Histórico
  const [showModal, setShowModal] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState('');
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // ... (getImageUrl e carregarProdutos mantidos iguais) ...
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  };

  const carregarProdutos = useCallback(async (paginaParaCarregar, termo = '') => {
    setLoading(true);
    try {
      const dados = await produtoService.listar(paginaParaCarregar, 10, termo);
      setProdutos(dados.itens);
      setTotalPages(dados.totalPaginas);
      setTotalElements(dados.totalElementos);
      setPage(dados.paginaAtual);
    } catch (error) {
      toast.error("Não foi possível carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarProdutos(page, termoBusca);
  }, [page, carregarProdutos]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setPage(0);
      carregarProdutos(0, termoBusca);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Deseja realmente inativar este produto?")) {
      try {
        await produtoService.excluir(id);
        toast.success("Produto atualizado.");
        carregarProdutos(page, termoBusca);
      } catch (error) {
        toast.error("Erro ao inativar produto.");
      }
    }
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try {
      const textoEtiqueta = await produtoService.imprimirEtiqueta(id);
      const printWindow = window.open('', '', 'width=500,height=500');
      printWindow.document.write('<html><head><title>Etiqueta</title></head><body>');
      printWindow.document.write('<h3>Código ZPL:</h3><pre>' + textoEtiqueta + '</pre>');
      printWindow.document.close();
      toast.success("Etiqueta gerada!");
    } catch (error) {
      toast.error("Erro ao gerar etiqueta.");
    } finally {
      setLoadingPrint(null);
    }
  };

  const handleSaneamento = async () => {
    if (!window.confirm("ATENÇÃO: Recalcular impostos de TODOS os produtos?")) return;
    setLoadingSaneamento(true);
    try {
      const msg = await produtoService.saneamentoFiscal();
      toast.success(msg);
      carregarProdutos(page, termoBusca);
    } catch (error) {
      toast.error("Erro ao executar saneamento.");
    } finally {
      setLoadingSaneamento(false);
    }
  };

  // --- NOVA FUNÇÃO: ABRIR HISTÓRICO ---
  const handleOpenHistorico = async (id, nome) => {
    setSelectedProdutoNome(nome);
    setLoadingHistorico(true);
    setShowModal(true); // Abre o modal vazio primeiro com loading (opcional)
    try {
      const dados = await produtoService.buscarHistorico(id);
      setHistoricoData(dados);
    } catch (error) {
      toast.error("Erro ao carregar histórico.");
      setShowModal(false);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const renderStatusBadge = (prod) => {
    if (prod.ativo === false) return <span className="status-badge status-danger">Inativo</span>;
    if (prod.quantidadeEmEstoque <= (prod.estoqueMinimo || 5)) return <span className="status-badge status-warning">Baixo Estoque</span>;
    return <span className="status-badge status-success">Ativo</span>;
  };

  return (
    <MainLayout>
      <div className="container-fluid">
        {/* Header e Botões (Mantidos com o CSS novo) */}
        <div className="page-header">
          <div className="page-title">
            <h1>Catálogo de Produtos</h1>
            <p>Gerencie seu inventário ({totalElements} itens encontrados)</p>
          </div>
          <div className="header-actions">
            <button className="btn-modern-secondary" onClick={handleSaneamento} disabled={loadingSaneamento}>
              {loadingSaneamento ? <div className="spinner-small"></div> : <Wand2 size={18} className="text-purple-600" />}
              <span>Ajuste Fiscal</span>
            </button>
            <button className="btn-modern-primary" onClick={() => navigate('/produtos/novo')}>
              <Plus size={20} /><span>Novo Produto</span>
            </button>
          </div>
        </div>

        <div className="datagrid-container">
          <div className="toolbar">
            <div className="search-box">
              <Search className="search-icon" size={18} />
              <input type="text" className="search-input" placeholder="Buscar..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} onKeyDown={handleSearch} />
            </div>
          </div>

          {loading ? (
            <div className="loading-state"><div className="spinner"></div><p>Carregando...</p></div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{width: '40%'}}>Produto</th>
                    <th>Preço</th>
                    <th>Estoque</th>
                    <th>Status</th>
                    <th style={{textAlign: 'right'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((prod) => (
                    <tr key={prod.id}>
                      <td>
                        <div className="product-info-cell">
                          <div className="product-icon-wrapper">
                            {prod.urlImagem ? (
                              <img src={getImageUrl(prod.urlImagem)} alt={prod.descricao} className="product-thumb" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : ( <Package size={24} color="#94a3b8" /> )}
                          </div>
                          <div>
                            <div className="product-name">{prod.descricao}</div>
                            <div className="ean-cell">{prod.codigoBarras || 'SEM EAN'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-price">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda)}</td>
                      <td><span className={`stock-value ${prod.quantidadeEmEstoque < (prod.estoqueMinimo || 5) ? 'stock-low' : ''}`}>{prod.quantidadeEmEstoque}</span> <span style={{fontSize: '0.8em', color: '#999'}}>un</span></td>
                      <td>{renderStatusBadge(prod)}</td>
                      <td>
                        <div className="actions-cell">
                          {/* BOTÃO DE HISTÓRICO (NOVO) */}
                          <button className="icon-btn" data-tooltip="Ver Histórico" onClick={() => handleOpenHistorico(prod.id, prod.descricao)}>
                            <Clock size={18} />
                          </button>

                          <button className="icon-btn print" data-tooltip="Imprimir Etiqueta" onClick={() => handlePrint(prod.id)} disabled={loadingPrint === prod.id}>
                            {loadingPrint === prod.id ? '...' : <Printer size={18} />}
                          </button>
                          <button className="icon-btn edit" data-tooltip="Editar" onClick={() => navigate(`/produtos/editar/${prod.id}`)}><Edit size={18} /></button>
                          <button className="icon-btn delete" data-tooltip="Inativar" onClick={() => handleDelete(prod.id)}><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Footer mantido igual... */}
          <div className="pagination-footer">
            <span className="page-info">Página <strong>{page + 1}</strong> de <strong>{totalPages || 1}</strong></span>
            <div className="pagination-controls">
              <button className="btn-page" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft size={16} /> Anterior</button>
              <button className="btn-page" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Próxima <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* RENDERIZA O MODAL SE ESTIVER ABERTO */}
      <HistoricoModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        historico={historicoData}
        produtoNome={selectedProdutoNome}
      />
    </MainLayout>
  );
};

export default ProdutoList;