import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Edit, Trash2, Package,
  ChevronLeft, ChevronRight, Wand2, Printer, Clock, X,
  RotateCcw // [NOVO] Ícone para restaurar
} from 'lucide-react';
import './ProdutoList.css';

// --- COMPONENTE MODAL DE CONFIRMAÇÃO (GENÉRICO) ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'danger' }) => {
  if (!isOpen) return null;
  const btnClass = type === 'success' ? 'btn-confirm-success' : 'btn-confirm-danger';
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{width: '400px', height: 'auto'}}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="btn-close"><X size={20}/></button>
        </div>
        <div className="modal-body">
           <p style={{fontSize: '1rem', color: '#334155'}}>{message}</p>
           <div className="modal-actions">
             <button className="btn-confirm-cancel" onClick={onClose}>Cancelar</button>
             <button className={btnClass} onClick={() => { onConfirm(); onClose(); }}>{confirmText}</button>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENTE MODAL DE HISTÓRICO ---
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
  const [modoLixeira, setModoLixeira] = useState(false); // [NOVO] Estado da Lixeira

  // Estados de Paginação e Busca
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  // Estados dos Modais
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState('');

  // Modal de Confirmação (Delete/Restore)
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  };

  const carregarProdutos = useCallback(async (paginaParaCarregar, termo = '') => {
    setLoading(true);
    try {
      if (modoLixeira) {
        // [NOVO] Busca Lixeira
        const listaInativos = await produtoService.buscarLixeira();
        setProdutos(listaInativos); // Lixeira retorna lista direta, sem paginação no momento
        setTotalPages(1);
        setTotalElements(listaInativos.length);
        setPage(0);
      } else {
        // Busca Normal
        const dados = await produtoService.listar(paginaParaCarregar, 10, termo);
        setProdutos(dados.itens);
        setTotalPages(dados.totalPaginas);
        setTotalElements(dados.totalElementos);
        setPage(dados.paginaAtual);
      }
    } catch (error) {
      toast.error(modoLixeira ? "Erro ao carregar lixeira." : "Não foi possível carregar o catálogo.");
    } finally {
      setLoading(false);
    }
  }, [modoLixeira]);

  useEffect(() => {
    carregarProdutos(page, termoBusca);
  }, [page, carregarProdutos, modoLixeira]); // Recarrega ao mudar o modo

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setPage(0);
      carregarProdutos(0, termoBusca);
    }
  };

  // --- AÇÃO: DELETAR (Mover para Lixeira) ---
  const handleDeleteClick = (ean, nome) => {
    setConfirmModal({
      isOpen: true,
      title: 'Inativar Produto?',
      message: `Deseja enviar "${nome}" para a lixeira? Ele deixará de aparecer nas vendas.`,
      type: 'danger',
      confirmText: 'Inativar',
      onConfirm: async () => {
        try {
          await produtoService.excluir(ean);
          toast.success("Produto movido para a lixeira.");
          carregarProdutos(page, termoBusca);
        } catch (error) {
          toast.error("Erro ao inativar produto.");
        }
      }
    });
  };

  // --- AÇÃO: RESTAURAR DA LIXEIRA ---
  const handleRestaurarClick = (ean, nome) => {
    setConfirmModal({
      isOpen: true,
      title: 'Restaurar Produto?',
      message: `O produto "${nome}" voltará a ficar ativo para vendas.`,
      type: 'success',
      confirmText: 'Restaurar',
      onConfirm: async () => {
        try {
          // [IMPORTANTE] Passa o EAN
          await produtoService.restaurar(ean);
          toast.success("Produto restaurado com sucesso!");
          // Recarrega a lista (permanecendo na lixeira para ver que sumiu)
          carregarProdutos(0, termoBusca);
        } catch (error) {
          toast.error("Erro ao restaurar produto.");
        }
      }
    });
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

  const handleOpenHistorico = async (id, nome) => {
    setSelectedProdutoNome(nome);
    setShowHistoricoModal(true);
    try {
      const dados = await produtoService.buscarHistorico(id);
      setHistoricoData(dados);
    } catch (error) {
      toast.error("Erro ao carregar histórico.");
    }
  };

  // Toggle Lixeira
  const toggleModoLixeira = () => {
    setModoLixeira(!modoLixeira);
    setPage(0); // Reseta página ao trocar de modo
  };

  const renderStatusBadge = (prod) => {
    if (!prod.ativo) return <span className="status-badge status-danger">Inativo</span>;
    if (prod.quantidadeEmEstoque <= (prod.estoqueMinimo || 5)) return <span className="status-badge status-warning">Baixo Estoque</span>;
    return <span className="status-badge status-success">Ativo</span>;
  };

  return (
    <MainLayout>
      <div className="container-fluid">
        {/* Header */}
        <div className="page-header">
          <div className="page-title">
            <h1>{modoLixeira ? 'Lixeira de Produtos' : 'Catálogo de Produtos'}</h1>
            <p>{modoLixeira ? 'Restaurar itens excluídos' : `Gerencie seu inventário (${totalElements} itens)`}</p>
          </div>
          <div className="header-actions">
            {/* BOTÃO TOGGLE LIXEIRA */}
            <button
              className={`btn-toggle-trash ${modoLixeira ? 'active' : ''}`}
              onClick={toggleModoLixeira}
              title={modoLixeira ? "Voltar para Produtos Ativos" : "Ver Lixeira"}
            >
              <Trash2 size={18} />
              <span>{modoLixeira ? 'Ver Ativos' : 'Lixeira'}</span>
            </button>

            {!modoLixeira && (
              <>
                <button className="btn-modern-secondary" onClick={handleSaneamento} disabled={loadingSaneamento}>
                  {loadingSaneamento ? <div className="spinner-small"></div> : <Wand2 size={18} className="text-purple-600" />}
                  <span>Ajuste Fiscal</span>
                </button>
                <button className="btn-modern-primary" onClick={() => navigate('/produtos/novo')}>
                  <Plus size={20} /><span>Novo Produto</span>
                </button>
              </>
            )}
          </div>
        </div>

        {modoLixeira && (
           <div className="lixeira-mode-banner">
             <Trash2 size={16} /> Modo Lixeira: Itens deletados aparecem aqui. Clique em restaurar para recuperá-los.
           </div>
        )}

        <div className="datagrid-container">
          <div className="toolbar">
            <div className="search-box">
              <Search className="search-icon" size={18} />
              <input type="text" className="search-input" placeholder="Buscar..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} onKeyDown={handleSearch} disabled={modoLixeira} />
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
                  {produtos.length === 0 ? (
                    <tr><td colSpan="5" className="empty-state">Nenhum produto encontrado.</td></tr>
                  ) : (
                    produtos.map((prod) => (
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
                        <td>
                          <span className={`stock-value ${prod.quantidadeEmEstoque < (prod.estoqueMinimo || 5) ? 'stock-low' : ''}`}>
                            {prod.quantidadeEmEstoque}
                          </span>
                          <span style={{fontSize: '0.8em', color: '#999'}}>un</span>
                        </td>
                        <td>{renderStatusBadge(prod)}</td>
                        <td>
                          <div className="actions-cell">
                            {modoLixeira ? (
                              // AÇÕES DA LIXEIRA (Só Restaurar)
                              <button
                                className="icon-btn restore"
                                data-tooltip="Restaurar Produto"
                                // [IMPORTANTE] Passar EAN
                                onClick={() => handleRestaurarClick(prod.codigoBarras, prod.descricao)}
                                style={{backgroundColor: '#ecfdf5', color: '#166534', fontWeight: 'bold', padding: '8px 12px'}}
                              >
                                <RotateCcw size={18} style={{marginRight: '6px'}}/> Restaurar
                              </button>
                            ) : (
                              // AÇÕES NORMAIS
                              <>
                                <button className="icon-btn" data-tooltip="Ver Histórico" onClick={() => handleOpenHistorico(prod.id, prod.descricao)}>
                                  <Clock size={18} />
                                </button>
                                <button className="icon-btn print" data-tooltip="Imprimir Etiqueta" onClick={() => handlePrint(prod.id)} disabled={loadingPrint === prod.id}>
                                  {loadingPrint === prod.id ? '...' : <Printer size={18} />}
                                </button>
                                <button className="icon-btn edit" data-tooltip="Editar" onClick={() => navigate(`/produtos/editar/${prod.id}`)}>
                                  <Edit size={18} />
                                </button>
                                <button className="icon-btn delete" data-tooltip="Inativar" onClick={() => handleDeleteClick(prod.codigoBarras, prod.descricao)}>
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação (Esconde se estiver na lixeira, pois ela retorna lista completa por enquanto) */}
          {!modoLixeira && (
            <div className="pagination-footer">
              <span className="page-info">Página <strong>{page + 1}</strong> de <strong>{totalPages || 1}</strong></span>
              <div className="pagination-controls">
                <button className="btn-page" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft size={16} /> Anterior</button>
                <button className="btn-page" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Próxima <ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE HISTÓRICO */}
      <HistoricoModal
        isOpen={showHistoricoModal}
        onClose={() => setShowHistoricoModal(false)}
        historico={historicoData}
        produtoNome={selectedProdutoNome}
      />

      {/* MODAL DE CONFIRMAÇÃO (DELETE/RESTORE) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
      />
    </MainLayout>
  );
};

export default ProdutoList;