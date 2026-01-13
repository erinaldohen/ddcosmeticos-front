import React, { useEffect, useState, useCallback, useRef } from 'react';
// import MainLayout removido para eliminar a aba dupla
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Edit3, Trash2, Box,
  ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, MoreHorizontal, ImageOff, Filter, XCircle, AlertOctagon,
  Copy, Check
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
    toast.success("Código copiado!", { autoClose: 1000, hideProgressBar: true, position: "bottom-center" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-wrapper" onClick={handleCopy} data-label={copied ? "Copiado!" : "Clique para copiar"}>
      <span className="product-code">{code || 'S/GTIN'}</span>
      {code && (
        copied
        ? <Check size={12} className="text-green-500" />
        : <Copy size={12} className="icon-copy" />
      )}
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
      <button className={`btn-icon-soft ${isOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
        <MoreHorizontal size={18} />
      </button>
      {isOpen && (
        <div className="dropdown-popover">
          <button onClick={(e) => { e.stopPropagation(); onHistory(); setIsOpen(false); }}>
            <History size={14} /> Histórico
          </button>
          <button onClick={(e) => { e.stopPropagation(); onPrint(); setIsOpen(false); }} disabled={loadingPrint}>
            {loadingPrint ? <div className="spinner-micro"></div> : <Printer size={14} />}
            Imprimir Etiqueta
          </button>
        </div>
      )}
    </div>
  );
};

// --- MODAIS ---
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'danger' }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card small">
        <div className="modal-header-clean">
          <div className={`icon-circle ${type === 'danger' ? 'danger' : 'success'}`}>
             {type === 'danger' ? <Trash2 size={20}/> : <RotateCcw size={20}/>}
          </div>
          <button onClick={onClose} className="btn-close-simple"><X size={20}/></button>
        </div>
        <div className="modal-body-clean">
           <h3>{title}</h3>
           <p>{message}</p>
        </div>
        <div className="modal-footer-clean">
           <button className="btn-secondary" onClick={onClose}>Cancelar</button>
           <button className={`btn-primary ${type === 'danger' ? 'red' : 'green'}`} onClick={() => { onConfirm(); onClose(); }}>
             {confirmText}
           </button>
        </div>
      </div>
    </div>
  );
};

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
                      <div><label>Nome</label> {item.nomeProduto}</div>
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
// COMPONENTE PRINCIPAL: LISTA DE PRODUTOS
// ==================================================================================
const ProdutoList = () => {
  const navigate = useNavigate();

  // --- ESTADOS ---
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaneamento, setLoadingSaneamento] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(null);

  // Modos e Seleção
  const [modoLixeira, setModoLixeira] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Paginação e Busca
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  // Busca Debounced
  const debouncedSearch = useDebounce(termoBusca, 500);

  // Estados dos Modais
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  };

  // --- BUSCA DE DADOS ---
  const carregarProdutos = useCallback(async (pagina, termo) => {
      // DEBUG: Verifique no console se os números mudam ao clicar (0, 1, 2...)
      console.log(`📡 Buscando página: ${pagina}, Termo: "${termo}"`);

      setLoading(true);
      try {
        if (modoLixeira) {
          const listaInativos = await produtoService.buscarLixeira();
          const filtrados = termo
            ? listaInativos.filter(p => p.descricao.toLowerCase().includes(termo.toLowerCase()) || p.codigoBarras.includes(termo))
            : listaInativos;
          setProdutos(filtrados);
          setTotalPages(1);
          setTotalElements(filtrados.length);
          // Na lixeira não paginamos no backend neste exemplo, então resetamos para 0 visualmente
          // Se sua lixeira tiver paginação no backend, altere aqui.
          if(page !== 0) setPage(0);
        } else {
          // Modo Normal
          const dados = await produtoService.listar(pagina, 10, termo);

          setProdutos(dados.itens);
          setTotalPages(dados.totalPaginas);
          setTotalElements(dados.totalElements);

          // IMPORTANTE: NÃO chamamos setPage(dados.paginaAtual) aqui.
          // Deixamos o estado local controlar a navegação.
        }
      } catch (error) {
        toast.error("Erro ao sincronizar dados.");
      } finally {
        setLoading(false);
      }
    }, [modoLixeira]); // Removido 'page' da dependência para evitar loop, embora useCallback lide bem

  // Efeitos
  useEffect(() => {
    carregarProdutos(page, debouncedSearch);
  }, [page, debouncedSearch, modoLixeira, carregarProdutos]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, modoLixeira]);

  const handleSearchChange = (e) => {
    setTermoBusca(e.target.value);
    if(page !== 0) setPage(0);
  };

  // --- LÓGICA DE SELEÇÃO ---
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(produtos.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // --- AÇÕES EM MASSA ---
  const handleBulkAction = () => {
    const isRestore = modoLixeira;
    const actionName = isRestore ? 'Restaurar' : 'Excluir';

    setConfirmModal({
      isOpen: true,
      title: isRestore ? 'Restaurar Selecionados' : 'Mover para Lixeira',
      message: `Tem certeza que deseja ${actionName.toLowerCase()} ${selectedIds.length} itens?`,
      type: isRestore ? 'success' : 'danger',
      confirmText: `Sim, ${actionName}`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedIds.map(id => {
            const prod = produtos.find(p => p.id === id);
            return isRestore
              ? produtoService.restaurar(prod.codigoBarras)
              : produtoService.excluir(prod.codigoBarras);
          }));
          toast.success(`Itens processados com sucesso.`);
          setSelectedIds([]);
          carregarProdutos(page, debouncedSearch);
        } catch (e) {
          toast.error("Erro na operação em massa.");
        }
      }
    });
  };

  const handleBulkPrint = () => {
    toast.info(`Fila de impressão iniciada para ${selectedIds.length} itens.`);
    setSelectedIds([]);
  };

  // --- AÇÕES INDIVIDUAIS ---
  const handleSingleAction = (type, prod) => {
    const isDelete = type === 'delete';
    setConfirmModal({
      isOpen: true,
      title: isDelete ? 'Mover para Lixeira' : 'Restaurar Produto',
      message: isDelete ? `Deseja remover "${prod.descricao}"?` : `Restaurar "${prod.descricao}"?`,
      type: isDelete ? 'danger' : 'success',
      confirmText: isDelete ? 'Mover' : 'Restaurar',
      onConfirm: async () => {
        try {
          if (isDelete) await produtoService.excluir(prod.codigoBarras);
          else await produtoService.restaurar(prod.codigoBarras);

          toast.success(isDelete ? "Produto inativado." : "Produto restaurado.");

          if(isDelete) carregarProdutos(page, debouncedSearch);
          else carregarProdutos(0, debouncedSearch);

        } catch (e) { toast.error("Erro na operação."); }
      }
    });
  };

  const handleSaneamento = async () => {
    if (!window.confirm("Isso irá recalcular tributos de todo o estoque. Continuar?")) return;
    setLoadingSaneamento(true);
    try {
      await produtoService.saneamentoFiscal();
      toast.success("Tributos atualizados.");
      carregarProdutos(page, debouncedSearch);
    } catch (e) { toast.error("Falha no saneamento."); }
    finally { setLoadingSaneamento(false); }
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try {
      const zpl = await produtoService.imprimirEtiqueta(id);
      const w = window.open('', '_blank', 'width=500,height=500');
      w.document.write(`<pre>${zpl}</pre>`);
      w.document.close();
    } catch (e) { toast.error("Erro ao gerar etiqueta."); }
    finally { setLoadingPrint(null); }
  };

  const handleOpenHistorico = async (id, nome) => {
    setSelectedProdutoNome(nome);
    setShowHistoricoModal(true);
    setHistoricoData([]);
    try {
      const dados = await produtoService.buscarHistorico(id);
      setHistoricoData(dados);
    } catch (e) { toast.error("Histórico indisponível."); }
  };

  const StatusIndicator = ({ prod }) => {
      // 1. Se estiver inativo (desativado manualmente)
      if (!prod.ativo) {
        return <span className="status-badge inactive">Inativo</span>;
      }

      // 2. Se estiver com estoque baixo
      if (prod.quantidadeEmEstoque <= (prod.estoqueMinimo || 5)) {
        return <span className="status-badge warning">Estoque Baixo</span>;
      }

      // 3. Caso normal
      return <span className="status-badge active">Ativo</span>;
    };

  // --- RENDER ---
  return (
    <>
      <div className="modern-container">

        {/* HEADER DA PÁGINA */}
        <header className="list-header">
          <div>
            <h1 className="title-gradient">{modoLixeira ? 'Lixeira' : 'Produtos'}</h1>
            <p className="subtitle">{modoLixeira ? 'Recuperação de itens' : `Gestão de inventário • ${totalElements} itens`}</p>
          </div>
          <div className="header-controls">
            <div className="toggle-wrapper">
              <button className={`toggle-btn ${!modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(false)}>Ativos</button>
              <button className={`toggle-btn ${modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(true)}>Lixeira</button>
            </div>
            {!modoLixeira && (
              <>
                <button className="btn-secondary icon-only" onClick={handleSaneamento} disabled={loadingSaneamento} data-label="Recalcular Tributos">
                  {loadingSaneamento ? <div className="spinner-micro dark"></div> : <Zap size={18} />}
                </button>
                <button className="btn-primary" onClick={() => navigate('/produtos/novo')}>
                  <Plus size={18} strokeWidth={3} />
                  <span>Novo Produto</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* CARTÃO DE CONTEÚDO PRINCIPAL */}
        <div className="content-card">

          {/* BARRA DE FERRAMENTAS */}
          <div className="card-toolbar">
            <div className="input-group">
              <Search className="input-icon" size={18} />
              <input type="text" placeholder="Buscar produto, EAN..." value={termoBusca} onChange={handleSearchChange} />
              {termoBusca && <button className="clear-btn" onClick={() => setTermoBusca('')} data-label="Limpar busca"><X size={14}/></button>}
            </div>
            <div className="toolbar-actions">
              <button className="btn-filter" data-label="Filtros avançados (Em breve)"><Filter size={16}/> Filtros</button>
            </div>
          </div>

          {/* TABELA DE DADOS */}
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th className="th-checkbox">
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={produtos.length > 0 && selectedIds.length === produtos.length}
                        disabled={produtos.length === 0}
                      />
                    </div>
                  </th>
                  <th width="40%">Produto</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton />
                ) : produtos.length === 0 ? (
                  <tr><td colSpan="6"><div className="empty-state"><Box size={48} strokeWidth={1} /><h3>Nenhum produto encontrado</h3></div></td></tr>
                ) : (
                  produtos.map((prod) => {
                    const isSelected = selectedIds.includes(prod.id);
                    return (
                      <tr
                        key={prod.id}
                        className={`fade-in ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => handleSelectOne(prod.id)}
                        tabIndex="0"
                        onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); handleSelectOne(prod.id); } }}
                      >
                        <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
                          <div className="checkbox-wrapper">
                             <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} />
                          </div>
                        </td>
                        <td>
                          <div className="product-item">
                            <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} />
                            <div className="product-meta">
                              <span className="product-name" title={prod.descricao.length > 30 ? prod.descricao : ''}>{prod.descricao}</span>
                              <CopyableCode code={prod.codigoBarras} />
                            </div>
                          </div>
                        </td>
                        <td className="font-numeric">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda)}
                        </td>
                        <td>
                          <div className="stock-pill">
                            <span className={prod.quantidadeEmEstoque < (prod.estoqueMinimo || 5) ? 'text-red' : ''}>
                              {prod.quantidadeEmEstoque}
                            </span>
                            <small>un</small>
                          </div>
                        </td>
                        <td><StatusIndicator prod={prod} /></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="actions-flex">
                            {modoLixeira ? (
                              <button className="btn-icon-soft green" onClick={() => handleSingleAction('restore', prod)} data-label="Restaurar">
                                <RotateCcw size={18} />
                              </button>
                            ) : (
                              <>
                                <button className="btn-icon-soft blue" onClick={() => navigate(`/produtos/editar/${prod.id}`)} data-label="Editar">
                                  <Edit3 size={18} />
                                </button>
                                <button className="btn-icon-soft red" onClick={() => handleSingleAction('delete', prod)} data-label="Excluir">
                                  <Trash2 size={18} />
                                </button>
                                <ActionMenu
                                  onHistory={() => handleOpenHistorico(prod.id, prod.descricao)}
                                  onPrint={() => handlePrint(prod.id)}
                                  loadingPrint={loadingPrint === prod.id}
                                />
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

          {/* RODAPÉ / PAGINAÇÃO */}
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

      <BulkActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onDelete={handleBulkAction}
        onPrint={handleBulkPrint}
        mode={modoLixeira}
      />

      <HistoricoModal isOpen={showHistoricoModal} onClose={() => setShowHistoricoModal(false)} historico={historicoData} produtoNome={selectedProdutoNome} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
      />
    </>
  );
};

export default ProdutoList;