import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box,
  ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, MoreHorizontal, ImageOff, Filter, XCircle, AlertOctagon,
  Copy, Check, Upload, FileText, FileSpreadsheet, Bot,
  Tags, Image as ImageIcon, DollarSign
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

// --- COMPONENTE: MENU DE AÇÕES INDIVIDUAIS ---
const ActionMenu = ({ onHistory, onPrint, loadingPrint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const clickOut = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);
  return (
    <div className="action-menu-wrapper" ref={menuRef}>
      <button className={`btn-icon-soft ${isOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} data-label="Mais opções">
        <MoreHorizontal size={18} />
      </button>
      {isOpen && (
        <div className="dropdown-popover">
          <button onClick={(e) => { e.stopPropagation(); onHistory(); setIsOpen(false); }}><History size={14} /> Histórico</button>
          <button onClick={(e) => { e.stopPropagation(); onPrint(); setIsOpen(false); }} disabled={loadingPrint}>
            {loadingPrint ? <div className="spinner-micro"></div> : <Printer size={14} />} Imprimir Etiqueta
          </button>
        </div>
      )}
    </div>
  );
};

// --- MODAL HISTÓRICO ---
const HistoricoModal = ({ isOpen, onClose, historico, produtoNome }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card wide">
        <div className="modal-header-simple">
          <div>
            <h3>Histórico de Alterações</h3>
            <span className="subtitle">{produtoNome}</span>
          </div>
          <button onClick={onClose} className="btn-close-simple"><X size={20}/></button>
        </div>
        <div className="modal-body-scroll">
          {historico.length === 0 ? (
            <div className="empty-state-modal">
              <AlertOctagon size={32} />
              <p>Sem registros recentes.</p>
            </div>
          ) : (
            <div className="timeline-clean">
              {historico.map((item, index) => (
                <div key={index} className="timeline-row">
                  <div className="timeline-dot"></div>
                  <div className="timeline-date">{new Date(item.dataAlteracao).toLocaleString()}</div>
                  <div className="timeline-content">
                    <span className={`tag-mini ${item.tipo}`}>{item.tipo}</span>
                    <div className="timeline-grid">
                      <div><label>Usuario</label> {item.usuario || 'Sistema'}</div>
                      <div><label>Preço</label> R$ {item.precoVenda?.toFixed(2)}</div>
                      <div><label>Estoque</label> {item.quantidadeEstoque}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

  // Estados
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaneamento, setLoadingSaneamento] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(null);
  const [modoLixeira, setModoLixeira] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filtros, setFiltros] = useState({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');
  const debouncedSearch = useDebounce(termoBusca, 500);

  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger', confirmText: 'Confirmar' });

  // Helpers
  const getImageUrl = (url) => url ? (url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`) : null;
  const marcasDisponiveis = useMemo(() => Array.from(new Set(produtos.map(p => p.marca).filter(Boolean))).sort(), [produtos]);
  const categoriasDisponiveis = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort(), [produtos]);

  // Carregamento
  const carregarProdutos = useCallback(async (pagina, termo) => {
    setLoading(true);
    try {
      if (modoLixeira) {
        const listaBruta = await produtoService.buscarLixeira();
        const listaInativos = Array.isArray(listaBruta) ? listaBruta : [];
        const filtrados = termo ? listaInativos.filter(p => p.descricao.toLowerCase().includes(termo.toLowerCase()) || p.codigoBarras.includes(termo)) : listaInativos;
        setProdutos(filtrados);
        setTotalPages(1);
        setTotalElements(filtrados.length);
      } else {
        const dados = await produtoService.listar(pagina, 10, termo, filtros);
        if (dados && dados.itens) {
            setProdutos(dados.itens);
            setTotalPages(dados.totalPaginas);
            setTotalElements(dados.totalElementos);
        } else {
            setProdutos([]);
            setTotalPages(0);
            setTotalElements(0);
        }
      }
    } catch (error) { toast.error("Erro ao carregar lista."); }
    finally { setLoading(false); }
  }, [modoLixeira, filtros]);

  useEffect(() => { if (page !== 0) setPage(0); carregarProdutos(0, debouncedSearch); }, [debouncedSearch, filtros, modoLixeira]);
  useEffect(() => { carregarProdutos(page, debouncedSearch); }, [page]);
  useEffect(() => { setSelectedIds([]); }, [modoLixeira]);

  // Handlers
  const handleFiltroChange = (key, value) => setFiltros(prev => ({ ...prev, [key]: value }));
  const limparFiltros = () => setFiltros({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false });
  const handleSearchChange = (e) => setTermoBusca(e.target.value);
  const handleSelectAll = (e) => e.target.checked ? setSelectedIds(produtos.map(p => p.id)) : setSelectedIds([]);
  const handleSelectOne = (id) => selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(itemId => itemId !== id)) : setSelectedIds([...selectedIds, id]);
  const handleTriggerImport = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  // Ações
  const handleImportar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = null;
    const formData = new FormData();
    formData.append("arquivo", file);
    const toastId = toast.loading("Enviando...");
    try {
      const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.data.sucesso) {
         toast.update(toastId, { render: "Importação concluída!", type: "success", isLoading: false, autoClose: 3000 });
         setPage(0); carregarProdutos(0, '');
      } else { throw new Error(response.data.mensagem); }
    } catch (error) { toast.update(toastId, { render: "Erro na importação.", type: "error", isLoading: false, autoClose: 5000 }); }
  };

  const handleCorrigirNcms = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'IA Fiscal Inteligente', message: 'O Robô irá corrigir NCMs inválidos automaticamente.', confirmText: 'Iniciar Robô',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Analisando base de dados...");
        try {
          const res = await api.post('/produtos/corrigir-ncms-ia');
          toast.update(toastId, { render: `Sucesso! ${res.data.qtdCorrigidos || 0} NCMs corrigidos.`, type: "success", isLoading: false, autoClose: 5000 });
          carregarProdutos(page, debouncedSearch);
        } catch (e) { toast.update(toastId, { render: "Erro ao executar.", type: "error", isLoading: false }); }
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
    const toastId = toast.loading(`Gerando...`);
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
    toast.info(`Imprimindo ${selectedIds.length} etiquetas...`);
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
          toast.success(`Operação realizada.`); setSelectedIds([]); carregarProdutos(page, debouncedSearch);
        } catch (e) { toast.error("Erro na operação."); }
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
          toast.success("Sucesso."); carregarProdutos(isDelete ? page : 0, debouncedSearch);
        } catch (e) { toast.error("Erro."); }
      }
    });
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try {
      const zpl = await produtoService.imprimirEtiqueta(id);
      const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${zpl}</pre>`); w.document.close();
    } catch (e) { toast.error("Erro ao gerar etiqueta."); } finally { setLoadingPrint(null); }
  };

  const handleOpenHistorico = async (id, nome) => {
    setSelectedProdutoNome(nome); setShowHistoricoModal(true); setHistoricoData([]);
    try { setHistoricoData(await produtoService.buscarHistorico(id)); } catch (e) { toast.error("Histórico indisponível."); }
  };

  const StatusIndicator = ({ prod }) => {
      if (!prod.ativo) return <span className="status-badge inactive">Inativo</span>;
      if (prod.quantidadeEmEstoque <= (prod.estoqueMinimo || 5)) return <span className="status-badge warning">Baixo</span>;
      return <span className="status-badge active">Ativo</span>;
  };

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
                {/* TOOLBAR COM AÇÕES EXTENSAS NO MOBILE */}
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
                    <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx" style={{display: 'none'}} />
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

        <div className="content-card">
          <div className="card-toolbar">
            <div className="input-group">
              <Search className="input-icon" size={18} />
              <input type="text" placeholder="Buscar produto..." value={termoBusca} onChange={handleSearchChange} />
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
                  <th className="th-checkbox"><div className="checkbox-wrapper"><input type="checkbox" onChange={handleSelectAll} checked={produtos.length > 0 && selectedIds.length === produtos.length} disabled={produtos.length === 0} /></div></th>
                  <th width="40%">Produto</th>
                  <th>Marca</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? <TableSkeleton /> : produtos.length === 0 ? (
                    <tr><td colSpan="7" className="text-center"><div className="empty-state"><Box size={48} /><h3>Nenhum produto encontrado</h3></div></td></tr>
                  ) : (
                    produtos.map((prod) => {
                      const isSelected = selectedIds.includes(prod.id);
                      return (
                        <tr key={prod.id} className={`fade-in ${isSelected ? 'row-selected' : ''}`} onClick={() => handleSelectOne(prod.id)}>
                          <td className="td-checkbox" onClick={(e) => e.stopPropagation()}><div className="checkbox-wrapper"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} /></div></td>
                          <td>
                            <div className="product-item">
                              <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} />
                              <div className="product-meta"><span className="product-name">{prod.descricao}</span><CopyableCode code={prod.codigoBarras} /></div>
                            </div>
                          </td>
                          <td>{prod.marca || '-'}</td>
                          <td className="font-numeric">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda)}</td>
                          <td><div className="stock-pill"><span className={prod.quantidadeEmEstoque < (prod.estoqueMinimo || 5) ? 'text-red' : ''}>{prod.quantidadeEmEstoque}</span><small>un</small></div></td>
                          <td><StatusIndicator prod={prod} /></td>
                          <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                            <div className="actions-flex">
                              {modoLixeira ? (
                                <button className="btn-icon-soft green" onClick={() => handleSingleAction('restore', prod)} data-label="Restaurar"><RotateCcw size={18} /></button>
                              ) : (
                                <>
                                  <button className="btn-icon-soft" onClick={() => handlePrint(prod.id)} disabled={loadingPrint === prod.id} data-label="Imprimir">
                                    {loadingPrint === prod.id ? <div className="spinner-micro dark"></div> : <Printer size={18} />}
                                  </button>
                                  <button className="btn-icon-soft purple" onClick={() => handleOpenHistorico(prod.id, prod.descricao)} data-label="Histórico"><History size={18} /></button>
                                  <button className="btn-icon-soft blue" onClick={() => navigate(`/produtos/editar/${prod.id}`)} data-label="Editar"><Edit3 size={18} /></button>
                                  <button className="btn-icon-soft red" onClick={() => handleSingleAction('delete', prod)} data-label="Inativar"><Trash2 size={18} /></button>
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

          {!modoLixeira && totalPages > 1 && (
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

      {showHistoricoModal && <HistoricoModal isOpen={showHistoricoModal} onClose={() => setShowHistoricoModal(false)} historico={historicoData} produtoNome={selectedProdutoNome} />}

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