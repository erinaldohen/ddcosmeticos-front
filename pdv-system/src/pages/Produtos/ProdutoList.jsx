import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box,
  ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, ImageOff, Filter, XCircle, AlertOctagon,
  Copy, Check, Upload, FileText, FileSpreadsheet, Bot, AlertTriangle, ChevronRight as ChevronRightIcon
} from 'lucide-react';
import './ProdutoList.css';

// --- HOOK: DEBOUNCE ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- COMPONENTE: SKELETON ---
const TableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
      <tr key={i} className="skeleton-row">
        <td className="td-checkbox"><div className="sk-box sm"></div></td>
        <td>
          <div className="flex-center">
            <div className="sk-box lg mr-3"></div>
            <div className="sk-col">
              <div className="sk-line w-150 mb-1"></div>
              <div className="sk-line w-80"></div>
            </div>
          </div>
        </td>
        <td><div className="sk-line w-80"></div></td>
        <td><div className="sk-line w-100"></div></td>
        <td><div className="sk-line w-60"></div></td>
        <td><div className="sk-badge"></div></td>
        <td className="text-right"><div className="sk-circle ml-auto"></div></td>
      </tr>
    ))}
  </>
);

// --- COMPONENTE: IMAGEM SEGURA ---
const ProductImage = ({ src, alt }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return <div className="img-placeholder"><ImageOff size={16} /></div>;
  }
  return <img src={src} alt={alt} className="img-product" onError={() => setError(true)} />;
};

// --- COMPONENTE: COPIAR CÓDIGO ---
const CopyableCode = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!", { autoClose: 1000, hideProgressBar: true, position: "bottom-center" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="code-wrapper" onClick={handleCopy} data-label={copied ? "Copiado!" : "Clique para copiar"}>
      <span className="product-code">{code || 'S/GTIN'}</span>
      {code && (copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="icon-copy" />)}
    </div>
  );
};

// --- COMPONENTE: BARRA DE AÇÕES EM MASSA ---
const BulkActionBar = ({ count, onClear, onDelete, onPrint, mode }) => {
  if (count === 0) return null;
  return (
    <div className="bulk-action-bar-container">
      <div className="bulk-action-bar">
        <div className="bulk-info">
          <div className="badge-count">{count}</div>
          <span>selecionado{count > 1 ? 's' : ''}</span>
        </div>
        <div className="bulk-divider"></div>
        <div className="bulk-actions">
           {!mode && (
             <button onClick={onPrint} className="btn-bulk" title="Imprimir etiquetas">
               <Printer size={16} /> Imprimir
             </button>
           )}
           <button onClick={onDelete} className="btn-bulk danger" title={mode ? "Restaurar Selecionados" : "Excluir Selecionados"}>
             {mode ? <RotateCcw size={16} /> : <Trash2 size={16} />}
             {mode ? ' Restaurar' : ' Excluir'}
           </button>
        </div>
        <button onClick={onClear} className="btn-close-bulk" data-label="Cancelar seleção"><XCircle size={20} /></button>
      </div>
    </div>
  );
};

// ==================================================================================
// COMPONENTE PRINCIPAL
// ==================================================================================
const ProdutoList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Estados Principais
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaneamento, setLoadingSaneamento] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(null);
  const [modoLixeira, setModoLixeira] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Paginação e Filtros
  const [filtros, setFiltros] = useState({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');
  const debouncedSearch = useDebounce(termoBusca, 500);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger', confirmText: 'Confirmar' });

  // Helpers de Interface
  const getImageUrl = (url) => url ? (url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`) : null;
  const marcasDisponiveis = useMemo(() => Array.from(new Set(produtos.map(p => p.marca).filter(Boolean))).sort(), [produtos]);
  const categoriasDisponiveis = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort(), [produtos]);

  // Contagem para o Alerta de Revisão
  const produtosPendentesDeRevisao = useMemo(() => produtos.filter(p => p.revisaoPendente).length, [produtos]);

  // Busca na API
  const carregarProdutos = useCallback(async (pagina, termo) => {
    setLoading(true);
    try {
      if (modoLixeira) {
        const listaBruta = await produtoService.buscarLixeira();
        const listaInativos = Array.isArray(listaBruta) ? listaBruta : [];
        const filtrados = termo ? listaInativos.filter(p =>
            (p.descricao && p.descricao.toLowerCase().includes(termo.toLowerCase())) ||
            (p.codigoBarras && p.codigoBarras.includes(termo))
        ) : listaInativos;
        setProdutos(filtrados);
        setTotalPages(1);
        setTotalElements(filtrados.length);
      } else {
        const dados = await produtoService.listar(pagina, 1000, termo, filtros); // Ajustei o limite temporário para o Front fazer a contagem dos pendentes (O ideal era via backend)
        let listaProdutos = [];

        if (Array.isArray(dados)) {
            listaProdutos = dados;
        } else if (dados && dados.content && Array.isArray(dados.content)) {
            listaProdutos = dados.content;
        } else if (dados && dados.itens && Array.isArray(dados.itens)) {
            listaProdutos = dados.itens;
        }

        setProdutos(listaProdutos);
        setTotalPages(dados?.totalPages || dados?.totalPaginas || 1);
        setTotalElements(dados?.totalElements || dados?.totalElementos || listaProdutos.length);
      }
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        toast.error("Erro ao carregar lista de produtos.");
    }
    finally { setLoading(false); }
  }, [modoLixeira, filtros]);

  useEffect(() => { if (page !== 0) setPage(0); carregarProdutos(0, debouncedSearch); }, [debouncedSearch, filtros, modoLixeira]);
  useEffect(() => { carregarProdutos(page, debouncedSearch); }, [page]);
  useEffect(() => { setSelectedIds([]); }, [modoLixeira]);

  // Handlers de Interface
  const handleFiltroChange = (key, value) => setFiltros(prev => ({ ...prev, [key]: value }));
  const limparFiltros = () => setFiltros({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false });
  const handleSearchChange = (e) => setTermoBusca(e.target.value);
  const handleSelectAll = (e) => e.target.checked ? setSelectedIds(produtos.map(p => p.id)) : setSelectedIds([]);
  const handleSelectOne = (id) => selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(itemId => itemId !== id)) : setSelectedIds([...selectedIds, id]);
  const handleTriggerImport = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  // Funções de Negócio
  const handleImportar = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = null;
      const formData = new FormData();
      formData.append("arquivo", file);

      const toastId = toast.loading("A importar e processar dados...");

      try {
        const response = await api.post('/produtos/importar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000
        });

        if (response.data.sucesso) {
           toast.update(toastId, { render: "Importação concluída com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
           setPage(0);
           carregarProdutos(0, '');
        } else {
           throw new Error(response.data.mensagem);
        }
      } catch (error) {
          toast.update(toastId, { render: "Erro na importação do arquivo.", type: "error", isLoading: false, autoClose: 5000 });
      }
    };

  const handleCorrigirNcms = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'IA Fiscal Inteligente', message: 'O Robô irá corrigir NCMs inválidos automaticamente.', confirmText: 'Iniciar Robô',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 A analisar base de dados...");
        try {
          const res = await api.post('/produtos/corrigir-ncms-ia');
          toast.update(toastId, { render: `Sucesso! ${res.data.qtdCorrigidos || 0} NCMs corrigidos.`, type: "success", isLoading: false, autoClose: 5000 });
          carregarProdutos(page, debouncedSearch);
        } catch (e) { toast.update(toastId, { render: "Erro ao executar robô fiscal.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  const handleSaneamento = () => {
    setConfirmModal({
      isOpen: true, type: 'warning', title: 'Recalcular Tributos', message: 'Recalcular regras fiscais de todo o estoque?', confirmText: 'Recalcular Agora',
      onConfirm: async () => {
        setLoadingSaneamento(true);
        try { await produtoService.saneamentoFiscal(); toast.success("Tributos atualizados!"); carregarProdutos(page, debouncedSearch); }
        catch (e) { toast.error("Falha no saneamento."); } finally { setLoadingSaneamento(false); }
      }
    });
  };

  const handleExportar = async (tipo) => {
    const toastId = toast.loading(`Gerando exportação...`);
    try {
      const res = await api.get(`/produtos/exportar/${tipo}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `estoque.${tipo === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.update(toastId, { render: "Download iniciado!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (err) { toast.update(toastId, { render: "Erro na exportação.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  const handleBulkPrint = () => {
    if (selectedIds.length === 0) return;
    toast.info(`Impressão em lote não configurada. A processar ${selectedIds.length} etiquetas...`);
  };

  const handleBulkAction = () => {
    const isRestore = modoLixeira;
    setConfirmModal({
      isOpen: true, type: isRestore ? 'success' : 'danger', title: isRestore ? 'Restaurar Selecionados' : 'Inativar Selecionados',
      message: `Confirmar ação em ${selectedIds.length} itens?`, confirmText: 'Sim, confirmar',
      onConfirm: async () => {
        try {
          await Promise.all(selectedIds.map(id => {
            const prod = produtos.find(p => p.id === id);
            return isRestore ? produtoService.restaurar(prod.codigoBarras) : produtoService.excluir(prod.codigoBarras);
          }));
          toast.success(`Operação realizada em lote.`); setSelectedIds([]); carregarProdutos(page, debouncedSearch);
        } catch (e) { toast.error("Erro na operação em lote."); }
      }
    });
  };

  const handleSingleAction = (type, prod) => {
    const isDelete = type === 'delete';
    setConfirmModal({
      isOpen: true, type: isDelete ? 'danger' : 'success',
      title: isDelete ? 'Inativar Produto' : 'Restaurar Produto', message: `${isDelete ? 'Inativar' : 'Restaurar'} "${prod.descricao}"?`,
      confirmText: 'Confirmar',
      onConfirm: async () => {
        try {
          if (isDelete) await produtoService.excluir(prod.codigoBarras); else await produtoService.restaurar(prod.codigoBarras);
          toast.success("Sucesso na operação."); carregarProdutos(isDelete ? page : 0, debouncedSearch);
        } catch (e) { toast.error("Falha ao atualizar produto."); }
      }
    });
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try {
      const zpl = await produtoService.imprimirEtiqueta(id);
      const w = window.open('', '_blank', 'width=500,height=500');
      w.document.write(`<pre>${zpl}</pre>`);
      w.document.close();
    } catch (e) {
      toast.error("Erro ao gerar etiqueta de impressão.");
    } finally {
      setLoadingPrint(null);
    }
  };

  const handleOpenHistorico = (id) => {
    navigate(`/produtos/historico/${id}`);
  };

  const StatusIndicator = ({ prod }) => {
      const isAtivo = prod.ativo !== undefined ? prod.ativo : true;
      const estoque = prod.quantidadeEmEstoque || 0;
      const minimo = prod.estoqueMinimo || 5;

      if (!isAtivo) return <span className="status-badge inactive">Inativo</span>;
      if (estoque <= minimo) return <span className="status-badge warning">Baixo</span>;
      return <span className="status-badge active">Ativo</span>;
  };

  // Filtragem Front-end para a flag (até o backend implementar o filtro de revisao_pendente)
  const produtosExibidos = filtros.revisaoPendente ? produtos.filter(p => p.revisaoPendente) : produtos;

  return (
    <>
      <div className="modern-container">

        <header className="list-header">
          <div className="header-title-row">
            <div>
              <h1 className="title-gradient">{modoLixeira ? 'Lixeira' : 'Produtos'}</h1>
              <p className="subtitle">{modoLixeira ? 'Recuperação' : `Inventário • ${totalElements} itens`}</p>
            </div>
          </div>

          <div className="header-controls">
            <div className="toggle-wrapper">
              <button className={`toggle-btn ${!modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(false)}>Ativos</button>
              <button className={`toggle-btn ${modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(true)}>Lixeira</button>
            </div>

            {!modoLixeira && (
              <>
                <div className="header-actions-group">
                    <button className="btn-secondary btn-purple bordered" onClick={handleCorrigirNcms} data-label="IA Fiscal">
                        <Bot size={18} /> <span className="action-text">IA Fiscal</span>
                    </button>
                    <button className="btn-secondary btn-orange bordered" onClick={handleSaneamento} disabled={loadingSaneamento} data-label="Recalcular">
                        {loadingSaneamento ? <div className="spinner-micro dark"></div> : <Zap size={18} />} <span className="action-text">Recalcular</span>
                    </button>
                    <div className="divider-vertical"></div>
                    <button className="btn-secondary btn-green bordered" onClick={() => handleExportar('csv')} data-label="CSV">
                        <FileText size={18} /> <span className="action-text">CSV</span>
                    </button>
                    <button className="btn-secondary btn-green bordered" onClick={() => handleExportar('excel')} data-label="Excel">
                        <FileSpreadsheet size={18} /> <span className="action-text">Excel</span>
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                    <button className="btn-secondary btn-blue bordered" onClick={handleTriggerImport} data-label="Importar">
                        <Upload size={18} /> <span className="action-text">Importar</span>
                    </button>
                </div>

                <button className="btn-primary" onClick={() => navigate('/produtos/novo')}>
                    <Plus size={18} /> <span className="mobile-hide-text">Novo Produto</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* 🚨 BANNER DE ALERTA: PRODUTOS CRIADOS NO PDV */}
        {!modoLixeira && produtosPendentesDeRevisao > 0 && (
            <div className="alert-banner" style={{
                background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '16px',
                borderRadius: '8px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#fde68a', color: '#d97706', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 4px', color: '#92400e', fontSize: '1.1rem', fontWeight: '800' }}>
                            Revisão Necessária
                        </h3>
                        <p style={{ margin: 0, color: '#b45309', fontSize: '0.95rem' }}>
                            Existem <strong>{produtosPendentesDeRevisao}</strong> produtos cadastrados no PDV aguardando preenchimento de custo e NCM.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => handleFiltroChange('revisaoPendente', !filtros.revisaoPendente)}
                    style={{
                        background: '#f59e0b', color: 'white', border: 'none', padding: '10px 16px',
                        borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                    }}
                >
                    {filtros.revisaoPendente ? 'Mostrar Todos' : 'Ver Pendentes'} <ChevronRightIcon size={18} />
                </button>
            </div>
        )}

        <div className="content-card">
          <div className="card-toolbar">
            <div className="input-group">
              <Search className="input-icon" size={18} />
              <input type="text" placeholder="Procurar produto..." value={termoBusca} onChange={handleSearchChange} />
              {termoBusca && <button className="clear-btn" onClick={() => setTermoBusca('')}><X size={14}/></button>}
            </div>
            <div className="toolbar-actions">
              <button className={`btn-filter ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                  <Filter size={16}/> Filtros
              </button>
            </div>
          </div>

          {showFilters && !modoLixeira && (
            <div className="filters-panel fade-in">
                <div className="filters-grid">
                    <div className="filter-group">
                        <label>Estoque</label>
                        <div className="toggle-options">
                            <button onClick={() => handleFiltroChange('estoque', 'todos')} className={filtros.estoque === 'todos' ? 'active' : ''}>Todos</button>
                            <button onClick={() => handleFiltroChange('estoque', 'baixo')} className={filtros.estoque === 'baixo' ? 'active warning' : ''}>Baixo</button>
                            <button onClick={() => handleFiltroChange('estoque', 'com-estoque')} className={filtros.estoque === 'com-estoque' ? 'active success' : ''}>OK</button>
                        </div>
                    </div>
                    <div className="filter-group">
                        <label>Marca</label>
                        <select value={filtros.marca} onChange={(e) => handleFiltroChange('marca', e.target.value)}>
                            <option value="">Todas</option>
                            {marcasDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Categoria</label>
                        <select value={filtros.categoria} onChange={(e) => handleFiltroChange('categoria', e.target.value)}>
                            <option value="">Todas</option>
                            {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div className="filters-row-secondary">
                    <div className="filter-checks">
                        <label className={`check-card ${filtros.semImagem ? 'active' : ''}`}><input type="checkbox" checked={filtros.semImagem} onChange={(e) => handleFiltroChange('semImagem', e.target.checked)} /> Sem Imagem</label>
                        <label className={`check-card ${filtros.semNcm ? 'active' : ''}`}><input type="checkbox" checked={filtros.semNcm} onChange={(e) => handleFiltroChange('semNcm', e.target.checked)} /> Sem NCM</label>
                    </div>
                    <button className="btn-text-red" onClick={limparFiltros}>Limpar</button>
                </div>
            </div>
          )}

          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th className="th-checkbox"><div className="checkbox-wrapper"><input type="checkbox" onChange={handleSelectAll} checked={produtosExibidos.length > 0 && selectedIds.length === produtosExibidos.length} disabled={produtosExibidos.length === 0} /></div></th>
                  <th width="40%">Produto</th>
                  <th>Marca</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? <TableSkeleton /> : produtosExibidos.length === 0 ? (
                    <tr><td colSpan="7" className="text-center"><div className="empty-state"><Box size={48} /><h3>Nenhum produto encontrado</h3></div></td></tr>
                  ) : (
                    produtosExibidos.map((prod) => {
                      const isSelected = selectedIds.includes(prod.id);
                      return (
                        <tr key={prod.id} className={`fade-in ${isSelected ? 'row-selected' : ''}`} onClick={() => handleSelectOne(prod.id)}>
                          <td className="td-checkbox" onClick={(e) => e.stopPropagation()}><div className="checkbox-wrapper"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} /></div></td>
                          <td>
                            <div className="product-item">
                              <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} />
                              <div className="product-meta">
                                <span className="product-name" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    {prod.descricao || 'Sem Descrição'}
                                    {prod.revisaoPendente && (
                                        <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #fde68a' }}>
                                            PENDENTE
                                        </span>
                                    )}
                                </span>
                                <CopyableCode code={prod.codigoBarras} />
                              </div>
                            </div>
                          </td>
                          <td>{prod.marca || '-'}</td>
                          <td className="font-numeric">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda || 0)}</td>
                          <td><div className="stock-pill"><span className={(prod.quantidadeEmEstoque || 0) < (prod.estoqueMinimo || 5) ? 'text-red' : ''}>{prod.quantidadeEmEstoque || 0}</span><small>un</small></div></td>
                          <td><StatusIndicator prod={prod} /></td>
                          <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                            <div className="actions-flex">
                              {modoLixeira ? (
                                <button className="btn-icon-soft green" onClick={() => handleSingleAction('restore', prod)} title="Restaurar Produto"><RotateCcw size={18} /></button>
                              ) : (
                                <>
                                  <button className="btn-icon-soft" onClick={() => handlePrint(prod.id)} disabled={loadingPrint === prod.id} title="Imprimir Etiqueta ZPL">
                                    {loadingPrint === prod.id ? <div className="spinner-micro dark"></div> : <Printer size={18} />}
                                  </button>

                                  <button className="btn-icon-soft purple" onClick={() => handleOpenHistorico(prod.id)} title="Ver Histórico de Auditoria"><History size={18} /></button>

                                  <button className="btn-icon-soft blue" onClick={() => navigate(`/produtos/editar/${prod.id}`)} title="Editar Produto"><Edit3 size={18} /></button>
                                  <button className="btn-icon-soft red" onClick={() => handleSingleAction('delete', prod)} title="Mover para Lixeira"><Trash2 size={18} /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
              </tbody>
            </table>
          </div>

          {!modoLixeira && totalPages > 1 && !filtros.revisaoPendente && (
            <div className="pagination-bar">
              <span className="info">Página <strong>{page + 1}</strong> de {totalPages}</span>
              <div className="controls">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft size={16} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])} onDelete={handleBulkAction} onPrint={handleBulkPrint} mode={modoLixeira} />

      {confirmModal.isOpen && (
        <ConfirmModal
            title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText}
            onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }}
            onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} isDanger={confirmModal.type === 'danger'}
        />
      )}
    </>
  );
};

export default ProdutoList;