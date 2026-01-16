import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Edit3, Trash2, Box,
  ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, MoreHorizontal, ImageOff, Filter, XCircle, AlertOctagon,
  Copy, Check, Upload, FileText, FileSpreadsheet // Ícones novos
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

  const [modoLixeira, setModoLixeira] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  const debouncedSearch = useDebounce(termoBusca, 500);

  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [historicoData, setHistoricoData] = useState([]);
  const [selectedProdutoNome, setSelectedProdutoNome] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger' });

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('blob:') || url.startsWith('http')) return url;
    return `http://localhost:8080${url}`;
  };

  // --- BUSCA DE DADOS (CORRIGIDA E BLINDADA) ---
  const carregarProdutos = useCallback(async (pagina, termo) => {
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
        if(page !== 0) setPage(0);

      } else {
        // --- MODO NORMAL ---
        const dados = await produtoService.listar(pagina, 10, termo);

        // CORREÇÃO: Tratamento para lista vazia ou nula
        if (!dados) {
            setProdutos([]);
            setTotalPages(0);
            setTotalElements(0);
            return;
        }

        // Verifica formato Spring ('content') ou personalizado ('itens')
        const lista = dados.content || dados.itens || [];
        const paginas = dados.totalPages || dados.totalPaginas || 0;
        const total = dados.totalElements || 0;

        setProdutos(lista);
        setTotalPages(paginas);
        setTotalElements(total);
      }
    } catch (error) {
      console.error("Debug Erro Listagem:", error);

      // Tratamento silencioso para 404 (Lista vazia não é erro crítico)
      if (error.response && error.response.status === 404) {
          setProdutos([]);
          setTotalElements(0);
      }
      // Erro de Conexão (Backend desligado)
      else if (error.code === "ERR_NETWORK") {
          toast.error("Servidor offline. Verifique o backend.");
      }
      // Erro genérico
      else {
          toast.error("Erro ao carregar lista de produtos.");
      }
    } finally {
      setLoading(false);
    }
  }, [modoLixeira]);

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

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(produtos.map(p => p.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  // --- LÓGICA DE IMPORTAÇÃO ---
  // --- LÓGICA DE IMPORTAÇÃO (ATUALIZADA PARA TOAST) ---
    const handleImportar = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("arquivo", file);

      // 1. Inicia o toast de carregamento e guarda o ID dele
      const toastId = toast.loading("Processando arquivo... Aguarde.");

      try {
        const res = await api.post('/produtos/importar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // 2. Analisa se houve erros no retorno do backend para decidir a cor
        const temErros = !res.data.includes("❌ Erros: 0");

        // 3. Atualiza o toast existente (não cria um novo, substitui o "Carregando")
        toast.update(toastId, {
          render: (
            <div style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: '1.4' }}>
              <strong>Processamento Finalizado</strong>
              <br/>
              {res.data} {/* O backend já manda formatado com quebras de linha */}
            </div>
          ),
          type: temErros ? "warning" : "success", // Amarelo se tiver erro, Verde se for sucesso total
          isLoading: false,
          autoClose: 5000, // Fecha sozinho em 5 segundos
          closeOnClick: true,
          draggable: true
        });

        carregarProdutos(page, debouncedSearch);
      } catch (err) {
        console.error(err);
        // Se der erro de rede ou 500
        toast.update(toastId, {
          render: "Falha crítica ao enviar arquivo.",
          type: "error",
          isLoading: false,
          autoClose: 4000
        });
      }

      // Limpa o input
      e.target.value = null;
    };

  // --- LÓGICA DE EXPORTAÇÃO ---
  const handleExportar = async (tipo) => {
    const toastId = toast.loading(`Gerando ${tipo.toUpperCase()}...`);
    try {
      const res = await api.get(`/produtos/exportar/${tipo}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `estoque_ddcosmeticos.${tipo === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.update(toastId, { render: "Download iniciado!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (err) {
      toast.update(toastId, { render: "Erro ao exportar.", type: "error", isLoading: false, autoClose: 3000 });
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
        } catch (e) { toast.error("Erro na operação em massa."); }
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
          carregarProdutos(isDelete ? page : 0, debouncedSearch);
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
      if (!prod.ativo) return <span className="status-badge inactive">Inativo</span>;
      if (prod.quantidadeEmEstoque <= (prod.estoqueMinimo || 5)) return <span className="status-badge warning">Estoque Baixo</span>;
      return <span className="status-badge active">Ativo</span>;
  };

  return (
    <>
      <div className="modern-container">
        {/* HEADER */}
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
                <div style={{display: 'flex', gap: 5, marginRight: 10, paddingRight: 10, borderRight: '1px solid #e2e8f0'}}>
                    <button className="btn-secondary icon-only" onClick={() => handleExportar('csv')} title="Exportar CSV">
                        <FileText size={18} color="#64748b"/>
                    </button>
                    <button className="btn-secondary icon-only" onClick={() => handleExportar('excel')} title="Exportar Excel">
                        <FileSpreadsheet size={18} color="#10b981"/>
                    </button>
                    <div style={{position:'relative', overflow: 'hidden', display: 'flex'}}>
                        <input type="file" accept=".csv, .xls, .xlsx" style={{position:'absolute', left:0, top:0, opacity:0, width:'100%', height:'100%', cursor:'pointer'}} onChange={handleImportar} />
                        <button className="btn-secondary icon-only" title="Importar">
                            <Upload size={18} color="#3b82f6"/>
                        </button>
                    </div>
                </div>
                <button className="btn-secondary icon-only" onClick={handleSaneamento} disabled={loadingSaneamento} title="Recalcular Tributos">
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

        {/* CONTEÚDO */}
        <div className="content-card">
          <div className="card-toolbar">
            <div className="input-group">
              <Search className="input-icon" size={18} />
              <input type="text" placeholder="Buscar produto, EAN..." value={termoBusca} onChange={handleSearchChange} />
              {termoBusca && <button className="clear-btn" onClick={() => setTermoBusca('')}><X size={14}/></button>}
            </div>
            <div className="toolbar-actions">
              <button className="btn-filter"><Filter size={16}/> Filtros</button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th className="th-checkbox">
                    <div className="checkbox-wrapper">
                      <input type="checkbox" onChange={handleSelectAll} checked={produtos.length > 0 && selectedIds.length === produtos.length} disabled={produtos.length === 0} />
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
                      <tr key={prod.id} className={`fade-in ${isSelected ? 'row-selected' : ''}`} onClick={() => handleSelectOne(prod.id)}>
                        <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
                          <div className="checkbox-wrapper"><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} /></div>
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
                        <td className="font-numeric">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda)}</td>
                        <td>
                          <div className="stock-pill">
                            <span className={prod.quantidadeEmEstoque < (prod.estoqueMinimo || 5) ? 'text-red' : ''}>{prod.quantidadeEmEstoque}</span>
                            <small>un</small>
                          </div>
                        </td>
                        <td><StatusIndicator prod={prod} /></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="actions-flex">
                            {modoLixeira ? (
                              <button className="btn-icon-soft green" onClick={() => handleSingleAction('restore', prod)}><RotateCcw size={18} /></button>
                            ) : (
                              <>
                                <button className="btn-icon-soft blue" onClick={() => navigate(`/produtos/editar/${prod.id}`)}><Edit3 size={18} /></button>
                                <button className="btn-icon-soft red" onClick={() => handleSingleAction('delete', prod)}><Trash2 size={18} /></button>
                                <ActionMenu onHistory={() => handleOpenHistorico(prod.id, prod.descricao)} onPrint={() => handlePrint(prod.id)} loadingPrint={loadingPrint === prod.id} />
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
      <HistoricoModal isOpen={showHistoricoModal} onClose={() => setShowHistoricoModal(false)} historico={historicoData} produtoNome={selectedProdutoNome} />
      <ConfirmModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} type={confirmModal.type} />
    </>
  );
};

export default ProdutoList;