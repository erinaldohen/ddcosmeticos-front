import React, { useEffect, useState, useCallback } from 'react';
import MainLayout from '../../components/Layout/MainLayout';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Edit, Trash2, Package,
  ChevronLeft, ChevronRight, Wand2, Printer // Importação do ícone Printer
} from 'lucide-react';
import './ProdutoList.css';

const ProdutoList = () => {
  const navigate = useNavigate();

  // Estados
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaneamento, setLoadingSaneamento] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(null); // ID do produto sendo impresso
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  // Busca de Dados
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

  // --- FUNÇÃO DE IMPRESSÃO DE ETIQUETA ---
  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try {
      const textoEtiqueta = await produtoService.imprimirEtiqueta(id);

      // Abre uma nova janela para o navegador imprimir o código ZPL ou texto
      // Em produção real com Zebra Browser Print, a lógica seria diferente.
      // Aqui simulamos a visualização do código da etiqueta.
      const printWindow = window.open('', '', 'width=500,height=500');
      printWindow.document.write('<html><head><title>Etiqueta</title></head><body>');
      printWindow.document.write('<h3>Código ZPL da Etiqueta:</h3>');
      printWindow.document.write('<pre>' + textoEtiqueta + '</pre>');
      printWindow.document.write('<p><em>Envie este código para a impressora.</em></p>');
      printWindow.document.write('</body></html>');
      printWindow.document.close();

      toast.success("Etiqueta gerada com sucesso!");
    } catch (error) {
      console.error("Erro impressão:", error);
      toast.error("Erro ao gerar etiqueta.");
    } finally {
      setLoadingPrint(null);
    }
  };

  // --- FUNÇÃO DE SANEAMENTO FISCAL ---
  const handleSaneamento = async () => {
    if (!window.confirm("ATENÇÃO: Isso irá recalcular automaticamente os impostos (CST, Monofásico, Reforma) de TODOS os produtos com base no NCM cadastrado.\n\nUse isso se a legislação mudar ou para corrigir produtos antigos.\n\nDeseja continuar?")) {
      return;
    }

    setLoadingSaneamento(true);
    try {
      const msg = await produtoService.saneamentoFiscal();
      toast.success(msg);
      carregarProdutos(page, termoBusca);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao executar saneamento fiscal. Verifique se você é ADMIN.");
    } finally {
      setLoadingSaneamento(false);
    }
  };

  // Renderiza o Badge de Status com lógica visual
  const renderStatusBadge = (prod) => {
    if (prod.ativo === false) {
      return <span className="status-badge status-danger">Inativo</span>;
    }
    const estoqueMin = prod.estoqueMinimo || 5;
    if (prod.quantidadeEmEstoque <= estoqueMin) {
      return <span className="status-badge status-warning">Baixo Estoque</span>;
    }
    return <span className="status-badge status-success">Ativo</span>;
  };

  return (
    <MainLayout>
      <div className="container-fluid">

        {/* Header */}
        <div className="page-header">
          <div className="page-title">
            <h1>Catálogo de Produtos</h1>
            <p>Gerencie seu inventário ({totalElements} itens encontrados)</p>
          </div>
          <div className="header-actions">

            {/* BOTÃO DE SANEAMENTO */}
            <button
              className="btn-secondary"
              onClick={handleSaneamento}
              disabled={loadingSaneamento}
              title="Corrigir impostos de todos os produtos automaticamente"
              style={{marginRight: '10px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #ddd'}}
            >
              {loadingSaneamento ? '...' : <><Wand2 size={18} /> Ajuste Fiscal</>}
            </button>

            <button className="action-btn-primary" onClick={() => navigate('/produtos/novo')}>
              <Plus size={18} />
              Novo Produto
            </button>
          </div>
        </div>

        <div className="datagrid-container">
          {/* Toolbar de Busca */}
          <div className="toolbar">
            <div className="search-box">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Buscar por nome, EAN..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Carregando produtos...</p>
            </div>
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
                    <tr>
                      <td colSpan="5" className="empty-state">
                        <Package size={48} style={{ opacity: 0.2, marginBottom: 10 }} />
                        <p>Nenhum produto encontrado.</p>
                      </td>
                    </tr>
                  ) : (
                    produtos.map((prod) => (
                      <tr key={prod.id}>
                        <td>
                          <div className="product-info-cell">
                            <div className="product-icon-wrapper">
                              {prod.urlImagem ? (
                                <img
                                  src={prod.urlImagem}
                                  alt={prod.descricao}
                                  className="product-thumb"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <Package size={20} />
                              )}
                            </div>

                            <div>
                              <div className="product-name">{prod.descricao}</div>
                              <div className="ean-cell">{prod.codigoBarras || 'SEM EAN'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-price">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda)}
                        </td>
                        <td>
                          <span className={`stock-value ${prod.quantidadeEmEstoque < (prod.estoqueMinimo || 5) ? 'stock-low' : ''}`}>
                            {prod.quantidadeEmEstoque}
                          </span> <span style={{fontSize: '0.8em', color: '#999'}}>un</span>
                        </td>
                        <td>
                          {renderStatusBadge(prod)}
                        </td>
                        <td>
                          <div className="actions-cell">
                            {/* BOTÃO DE IMPRESSÃO */}
                            <button
                              className="icon-btn print"
                              data-tooltip="Imprimir Etiqueta"
                              onClick={() => handlePrint(prod.id)}
                              disabled={loadingPrint === prod.id}
                              style={{ marginRight: '5px', color: '#555' }}
                            >
                              {loadingPrint === prod.id ? '...' : <Printer size={18} />}
                            </button>

                            <button
                              className="icon-btn edit"
                              data-tooltip="Editar Produto"
                              onClick={() => navigate(`/produtos/editar/${prod.id}`)}
                            >
                              <Edit size={18} />
                            </button>

                            <button
                              className="icon-btn delete"
                              data-tooltip="Inativar Produto"
                              onClick={() => handleDelete(prod.id)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer / Paginação */}
          <div className="pagination-footer">
            <span className="page-info">
              Página <strong>{page + 1}</strong> de <strong>{totalPages || 1}</strong>
            </span>
            <div className="pagination-controls">
              <button
                className="btn-page"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <button
                className="btn-page"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima <ChevronRight size={16} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </MainLayout>
  );
};

export default ProdutoList;