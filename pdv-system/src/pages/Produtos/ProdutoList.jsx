import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box, ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, ImageOff, Filter, Copy, Check, Upload, FileSpreadsheet,
  Bot, AlertTriangle, Barcode, ChevronDown, ZoomIn, Edit2, CheckCircle2, Receipt
} from 'lucide-react';
import './ProdutoList.css';

// =========================================================================
// 🧩 COMPONENTES AUXILIARES (Otimizados com memo para Performance)
// =========================================================================

const SearchBar = memo(({ onSearch }) => {
  const [localTerm, setLocalTerm] = useState('');
  useEffect(() => {
      const handler = setTimeout(() => onSearch(localTerm), 400);
      return () => clearTimeout(handler);
  }, [localTerm, onSearch]);
  return (
    <div className="search-bar-modern">
      <Search className="search-icon" size={18} />
      <input type="text" placeholder="Pesquisar produto, marca ou EAN..." value={localTerm} onChange={(e) => setLocalTerm(e.target.value)} />
      {localTerm && <button className="clear-search-btn" onClick={() => setLocalTerm('')} title="Limpar busca"><X size={14}/></button>}
    </div>
  );
});

const Pagination = memo(({ page, totalPages, setPage }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-modern">
      <button className="btn-page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /> <span className="hide-mobile">Anterior</span></button>
      <div className="page-indicator">Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong></div>
      <button className="btn-page" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><span className="hide-mobile">Próxima</span> <ChevronRight size={18} /></button>
    </div>
  );
});

const TableSkeleton = memo(() => (
  <>{[1, 2, 3, 4, 5].map((i) => (
      <tr key={i} className="ux-table-row skeleton-row">
        <td className="checkbox-cell"><div className="sk-box sm"></div></td>
        <td className="product-main-cell">
          <div className="flex-center" style={{ display: 'flex', gap: '16px' }}>
            <div className="sk-box lg"></div>
            <div className="sk-col" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="sk-line w-150"></div><div className="sk-line w-80"></div>
            </div>
          </div>
        </td>
        <td className="hide-mobile"><div className="sk-line w-80"></div></td>
        <td><div className="sk-line w-100"></div></td>
        <td><div className="sk-line w-100"></div></td>
        <td className="hide-mobile"><div className="sk-badge"></div></td>
        <td className="align-right"><div className="sk-line w-80 ml-auto"></div></td>
      </tr>
  ))}</>
));

const ProductImage = memo(({ src, alt, onZoom }) => {
  const [error, setError] = useState(false);
  if (!src || error) return <div className="img-placeholder"><ImageOff size={20} /></div>;
  return (
    <div className="img-zoom-wrapper" onClick={(e) => { e.stopPropagation(); onZoom(src); }}>
      <img src={src} alt={alt} className="img-product" onError={() => setError(true)} loading="lazy" />
      <div className="img-zoom-overlay"><ZoomIn size={16} /></div>
    </div>
  );
});

const CopyableCode = memo(({ code }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation(); if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("EAN Copiado!", { autoClose: 1000, hideProgressBar: true, position: "bottom-center" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="code-wrapper" onClick={handleCopy} title="Clique para copiar">
      <span className="product-code">{code || 'S/GTIN'}</span>
      {code && (copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="icon-copy" />)}
    </div>
  );
});

const ActionMenu = memo(({ prod, onEdit, onDelete, onPrint, onHistory, loadingPrint }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
        const handleEscKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscKey);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen]);

    const handleAction = (e, actionFn) => { e.stopPropagation(); setIsOpen(false); actionFn(); };

    return (
        <div className="action-menu-container" ref={menuRef}>
            <button className="btn-manage" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                Gerenciar <ChevronDown size={16} />
            </button>
            {isOpen && (
                <div className="action-dropdown fade-in-fast">
                    <button className="dropdown-item primary" onClick={(e) => handleAction(e, () => onEdit(prod.id))}><Edit3 size={16} /> <span>Editar Produto</span></button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={(e) => handleAction(e, () => onPrint(prod.id))} disabled={loadingPrint === prod.id}>
                        {loadingPrint === prod.id ? <div className="spinner-micro dark"></div> : <Printer size={16} />} <span>Imprimir Etiqueta</span>
                    </button>
                    <button className="dropdown-item" onClick={(e) => handleAction(e, () => onHistory(prod.id))}><History size={16} /> <span>Ver Histórico</span></button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item text-danger" onClick={(e) => handleAction(e, () => onDelete(prod))}><Trash2 size={16} /> <span>Mover para Lixeira</span></button>
                </div>
            )}
        </div>
    );
});

const StockHealthBar = memo(({ estoque, minimo }) => {
    const maxBar = minimo > 0 ? minimo * 3 : 20;
    const percent = Math.min(100, Math.max(0, (estoque / maxBar) * 100));
    let colorClass = 'bg-emerald-500';
    if (estoque === 0) colorClass = 'bg-rose-500';
    else if (estoque <= minimo) colorClass = 'bg-amber-500';

    return (
        <div className="stock-health-container" title={`Mínimo exigido: ${minimo || 5}`}>
            <div className="stock-health-text">
                <span className={`stock-number ${estoque <= minimo ? 'text-danger' : 'text-success'}`}>{estoque} un.</span>
            </div>
            <div className="stock-health-track">
                <div className={`stock-health-fill ${colorClass}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
});

const StatusIndicator = memo(({ prod }) => {
  const isAtivo = prod.ativo !== undefined ? prod.ativo : true;
  if (!isAtivo) return <span className="badge badge-inactive">Inativo</span>;
  if ((prod.quantidadeEmEstoque || 0) === 0) return <span className="badge badge-danger">Zerado</span>;
  if ((prod.quantidadeEmEstoque || 0) <= (prod.estoqueMinimo || 5)) return <span className="badge badge-warning">Baixo</span>;
  return <span className="badge badge-active">Ativo</span>;
});

const DiagnosticoAlertas = memo(({ prod }) => {
    const alertas = [];
    const temPrecoVenda = prod.precoVenda && prod.precoVenda > 0;
    const temNcmValido = prod.ncm && prod.ncm.length >= 8 && prod.ncm !== '00000000';
    const temEanValido = prod.codigoBarras && prod.codigoBarras.length >= 8 && prod.codigoBarras !== 'S/N';
    const temImagem = !!prod.urlImagem;
    const possuiFalhaGrave = !temPrecoVenda || !temNcmValido || !temEanValido;

    if (prod.alertaGondola) alertas.push({ id: 'gondola', texto: "🚨 DIVERGÊNCIA FÍSICA", classe: "badge-divergence-glow" });
    if (!temPrecoVenda) alertas.push({ id: 'preco', texto: "Preço Zerado", classe: "bg-rose-100 text-rose-700 border-rose-200" });
    if (!temNcmValido) alertas.push({ id: 'ncm', texto: "NCM Pendente/Inválido", classe: "bg-amber-100 text-amber-700 border-amber-200" });
    if (!temEanValido) alertas.push({ id: 'ean', texto: "Sem EAN GS1", classe: "bg-orange-100 text-orange-700 border-orange-200" });
    if (!temImagem) alertas.push({ id: 'img', texto: "Sem Imagem", classe: "bg-purple-100 text-purple-700 border-purple-200" });
    if (prod.revisaoPendente && possuiFalhaGrave && !prod.alertaGondola) alertas.push({ id: 'revisao', texto: "⚠️ Revisão Pendente", classe: "bg-blue-100 text-blue-700 border-blue-200" });

    if (alertas.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {alertas.map(alerta => (
                <span key={alerta.id} className={`badge border ${alerta.classe}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                    {alerta.texto}
                </span>
            ))}
        </div>
    );
});

// =========================================================================
// 🔥 COMPONENTE DA LINHA (Isolado e Memorizado - Fim das piscadas na Tabela)
// =========================================================================
const rowPropsAreEqual = (prev, next) => {
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.prod !== next.prod) return false;
    if (prev.loadingPrint === prev.prod.id || next.loadingPrint === next.prod.id) return false;

    const wasEditing = prev.editingCell.id === prev.prod.id;
    const isEditing = next.editingCell.id === next.prod.id;
    if (wasEditing || isEditing) {
        return prev.editingCell.field === next.editingCell.field &&
               prev.editingCell.value === next.editingCell.value;
    }
    return true;
};

const ProdutoRow = memo(({
    prod, isSelected, onSelectOne, getImageUrl, onZoom,
    editingCell, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, applyCurrencyMask,
    navigate, onSingleAction, onPrint, loadingPrint
}) => {
    const handleFocus = (e) => e.target.select();
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') onSaveEdit();
        if (e.key === 'Escape') onCancelEdit();
    };

    const isEditingPreco = editingCell.id === prod.id && editingCell.field === 'precoVenda';
    const isEditingEstoque = editingCell.id === prod.id && editingCell.field === 'quantidadeEmEstoque';

    return (
        <tr className={`ux-table-row ${isSelected ? 'selected' : ''}`} onClick={() => onSelectOne(prod.id)}>
            <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={isSelected} onChange={() => onSelectOne(prod.id)} />
            </td>
            <td className="product-main-cell">
                <div className="flex-center" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} onZoom={onZoom} />
                    <div className="product-info-modern">
                        <h4 className="product-title-modern">{prod.descricao}</h4>
                        <CopyableCode code={prod.codigoBarras} />
                        <DiagnosticoAlertas prod={prod} />
                    </div>
                </div>
            </td>
            <td className="hide-mobile">{prod.marca || 'S/ Marca'}</td>

            <td className="font-numeric editable-cell-modern" onDoubleClick={(e) => onStartEdit(e, prod.id, 'precoVenda', prod.precoVenda)}>
                {isEditingPreco ? (
                    <div className="inline-edit-wrapper safe-mode">
                        <span className="currency-prefix">R$</span>
                        <input autoFocus type="text" className="inline-input" value={editingCell.value}
                            onFocus={handleFocus} onChange={(e) => onEditChange(applyCurrencyMask(e.target.value))}
                            onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                        <div className="inline-actions">
                            <button className="btn-inline-save" onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}><Check size={16}/></button>
                            <button className="btn-inline-cancel" onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}><X size={16}/></button>
                        </div>
                    </div>
                ) : (
                    <div className="editable-content-display" title="Duplo clique para editar">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda || 0)}
                        <Edit2 size={12} className="edit-hint-icon" />
                    </div>
                )}
            </td>
            <td className="editable-cell-modern" onDoubleClick={(e) => onStartEdit(e, prod.id, 'quantidadeEmEstoque', prod.quantidadeEmEstoque)}>
                {isEditingEstoque ? (
                    <div className="inline-edit-wrapper safe-mode">
                        <input autoFocus type="number" className="inline-input text-center" value={editingCell.value}
                            onChange={(e) => onEditChange(e.target.value)}
                            onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                        <div className="inline-actions">
                            <button className="btn-inline-save" onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}><Check size={16}/></button>
                            <button className="btn-inline-cancel" onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}><X size={16}/></button>
                        </div>
                    </div>
                ) : (
                    <div className="editable-content-display" title="Duplo clique para editar">
                        <StockHealthBar estoque={prod.quantidadeEmEstoque || 0} minimo={prod.estoqueMinimo || 5} />
                        <Edit2 size={12} className="edit-hint-icon" />
                    </div>
                )}
            </td>
            <td className="hide-mobile"><StatusIndicator prod={prod} /></td>
            <td className="align-right actions-cell" onClick={(e) => e.stopPropagation()}>
                <ActionMenu prod={prod} onEdit={(id) => navigate(`/produtos/editar/${id}`)} onDelete={(p) => onSingleAction('delete', p)} onPrint={onPrint} onHistory={(id) => navigate(`/produtos/historico/${id}`)} loadingPrint={loadingPrint} />
            </td>
        </tr>
    );
}, rowPropsAreEqual);


// ==================================================================================
// 🚀 COMPONENTE PRINCIPAL (Reestruturado com Gestão de Estado Eficiente)
// ==================================================================================
export default function ProdutoList() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // 🔥 1. ESTADOS DE DADOS (Consolidados)
  const [dados, setDados] = useState({
      produtos: [],
      lixeiraCount: 0,
      raioX: { totalAnomalias: 0, semCusto: 0, precoVendaZerado: 0, divergenciaGondola: 0 },
      divergentes: []
  });

  // 🔥 2. ESTADOS DE UI & MODAIS (Consolidados)
  const [ui, setUi] = useState({
      loading: true,
      loadingPrint: null,
      filtrosOpen: false,
      modalDivergencia: false,
      zoomImg: null
  });

  // 🔥 3. ESTADOS DE NAVEGAÇÃO E FILTROS (Consolidados)
  const [modoLixeira, setModoLixeira] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [pageState, setPageState] = useState({ page: 0, totalPages: 0, totalElements: 0 });
  const [filtros, setFiltros] = useState({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false });

  // 🔥 4. ESTADOS DE INTERAÇÃO RÁPIDA (Mantidos separados por eficiência de re-render)
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingCell, setEditingCell] = useState({ id: null, field: null, value: '' });
  const [newPrices, setNewPrices] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger', confirmText: 'Confirmar' });

  const activeFiltersCount = Object.keys(filtros).filter(k => (typeof filtros[k] === 'boolean' && filtros[k]) || (typeof filtros[k] === 'string' && filtros[k] !== '' && filtros[k] !== 'todos')).length;

  const getImageUrl = useCallback((url) => {
    if (!url || url === 'null' || url === 'undefined') return null;
    return url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`;
  }, []);

  const carregarProdutos = useCallback(async (pagina, termo) => {
    setUi(prev => ({ ...prev, loading: true }));
    try {
      try { const lix = await produtoService.buscarLixeira(); setDados(d => ({ ...d, lixeiraCount: Array.isArray(lix) ? lix.length : 0 })); } catch(e) {}

      if (modoLixeira) {
        const listaBruta = await produtoService.buscarLixeira();
        const listaInativos = Array.isArray(listaBruta) ? listaBruta : [];
        const filtrados = termo ? listaInativos.filter(p => (p.descricao && p.descricao.toLowerCase().includes(termo.toLowerCase())) || (p.codigoBarras && p.codigoBarras.includes(termo))) : listaInativos;
        setDados(d => ({ ...d, produtos: filtrados }));
        setPageState({ page: 0, totalPages: 1, totalElements: filtrados.length });
      } else {
              const res = await produtoService.listar(pagina, 50, termo, filtros);
              let listaProdutos = Array.isArray(res) ? res : (res?.content || res?.itens || []);

              setDados(d => ({ ...d, produtos: listaProdutos }));

              // 🔥 CORREÇÃO AQUI: Adicionado os mapeamentos corretos do Java (totalPaginas e totalElementos)
              setPageState({
                  page: pagina,
                  totalPages: res?.totalPages || res?.totalPaginas || 1,
                  totalElements: res?.totalElements || res?.totalElementos || listaProdutos.length
              });

              try {
                  const responseIa = await api.get('/produtos/dashboard-ia');
                  setDados(d => ({ ...d, raioX: responseIa.data }));
              } catch (e) {}
            }
    } catch (error) { toast.error("Erro ao carregar lista de produtos."); }
    finally { setUi(prev => ({ ...prev, loading: false })); }
  }, [modoLixeira, filtros]);

  useEffect(() => { if (pageState.page !== 0) setPageState(p => ({...p, page: 0})); else carregarProdutos(0, termoBusca); }, [termoBusca, filtros, modoLixeira]);
  useEffect(() => { carregarProdutos(pageState.page, termoBusca); }, [pageState.page, carregarProdutos]);
  useEffect(() => { setSelectedIds([]); }, [modoLixeira]);

  // 🔥 UX/A11Y: GESTÃO GLOBAL DA TECLA ESC E SCROLL TRANCADO
  useEffect(() => {
      const hasOpenModal = ui.modalDivergencia || ui.zoomImg !== null || confirmModal.isOpen;
      document.body.style.overflow = hasOpenModal ? 'hidden' : 'auto';

      const handleGlobalEsc = (e) => {
          if (e.key === 'Escape') {
              if (ui.zoomImg) setUi(prev => ({ ...prev, zoomImg: null }));
              else if (ui.modalDivergencia) setUi(prev => ({ ...prev, modalDivergencia: false }));
              else if (ui.filtrosOpen) setUi(prev => ({ ...prev, filtrosOpen: false }));
          }
      };

      window.addEventListener('keydown', handleGlobalEsc);
      return () => {
          document.body.style.overflow = 'auto';
          window.removeEventListener('keydown', handleGlobalEsc);
      };
  }, [ui.modalDivergencia, ui.zoomImg, confirmModal.isOpen, ui.filtrosOpen]);

  const handleFiltroChange = (key, value) => { setFiltros(prev => ({ ...prev, [key]: value })); setPageState(p => ({...p, page: 0})); };
  const limparFiltros = () => { setFiltros({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false }); setPageState(p => ({...p, page: 0})); };

  const handleSelectAll = useCallback((e) => setSelectedIds(e.target.checked ? dados.produtos.map(p => p.id) : []), [dados.produtos]);
  const handleSelectOne = useCallback((id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]), []);

  const applyCurrencyMask = (value) => {
    if (value === undefined || value === null) return '0,00';
    let strVal = value.toString().replace(/\D/g, '');
    if (!strVal || strVal === '') return '0,00';
    return (parseInt(strVal) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const iniciarEdicaoInline = useCallback((e, id, field, currentValue) => {
      e.stopPropagation();
      let val = currentValue;
      if (field === 'precoVenda') val = currentValue ? currentValue.toFixed(2).replace('.', ',') : '0,00';
      setEditingCell({ id, field, value: val || '' });
  }, []);

  const handleEditChange = useCallback((value) => setEditingCell(prev => ({ ...prev, value })), []);
  const cancelarEdicao = useCallback(() => setEditingCell({ id: null, field: null, value: '' }), []);

  const salvarEdicaoInline = useCallback(async () => {
        if (!editingCell.id) return;
        const { id, field, value } = editingCell;
        try {
            if (field === 'precoVenda') {
                const precoNum = parseFloat((value || '0').toString().replace(/\./g, '').replace(',', '.'));
                if (isNaN(precoNum) || precoNum < 0) throw new Error("Preço inválido");
                await api.patch(`/produtos/${id}/preco-venda?valor=${precoNum}`);
            } else if (field === 'quantidadeEmEstoque') {
                const qtdNum = parseInt(value || 0, 10);
                if (isNaN(qtdNum) || qtdNum < 0) throw new Error("Quantidade inválida");
                await api.patch(`/produtos/${id}/estoque?quantidade=${qtdNum}`);
            }
            toast.success("Atualizado!", { autoClose: 800, hideProgressBar: true });
            carregarProdutos(pageState.page, termoBusca);
        } catch (error) { toast.error("Valor inválido. Gravação cancelada."); }
        finally { setEditingCell({ id: null, field: null, value: '' }); }
  }, [editingCell, pageState.page, termoBusca, carregarProdutos]);

  // 🔥 AÇÕES EM MASSA (LOTE)
  const handleBulkAction = (actionType) => {
      if (selectedIds.length === 0) return;
      const prodsSelecionados = dados.produtos.filter(p => selectedIds.includes(p.id));

      if (actionType === 'print') {
          const toastId = toast.loading(`Gerando ${selectedIds.length} etiquetas...`);
          Promise.all(selectedIds.map(id => produtoService.imprimirEtiqueta(id)))
              .then(zpls => {
                  const w = window.open('', '_blank', 'width=500,height=500');
                  w.document.write(`<pre>${zpls.join('\n')}</pre>`);
                  w.document.close();
                  toast.update(toastId, { render: "Etiquetas geradas em lote!", type: "success", isLoading: false, autoClose: 2000 });
                  setSelectedIds([]);
              })
              .catch(() => toast.update(toastId, { render: "Erro na impressão em lote.", type: "error", isLoading: false, autoClose: 3000 }));
          return;
      }

      const isDelete = actionType === 'delete';
      setConfirmModal({
          isOpen: true, type: isDelete ? 'danger' : 'success',
          title: isDelete ? 'Excluir Lote' : 'Restaurar Lote',
          message: `Deseja ${isDelete ? 'inativar' : 'restaurar'} os ${selectedIds.length} produtos selecionados?`,
          confirmText: isDelete ? 'Excluir Todos' : 'Restaurar Todos',
          onConfirm: async () => {
              const toastId = toast.loading(`A processar ${selectedIds.length} itens...`);
              try {
                  if (isDelete) await Promise.all(prodsSelecionados.map(p => produtoService.excluir(p.codigoBarras)));
                  else await Promise.all(prodsSelecionados.map(p => produtoService.restaurar(p.codigoBarras)));
                  toast.update(toastId, { render: "Lote processado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
                  setSelectedIds([]); carregarProdutos(pageState.page, termoBusca);
              } catch (e) { toast.update(toastId, { render: "Falha ao processar alguns itens do lote.", type: "error", isLoading: false, autoClose: 4000 }); }
          }
      });
  };

  const handleImportar = async (e) => {
      const file = e.target.files[0];
      if (!file) return; e.target.value = null;

      const allowedExt = ['csv', 'xls', 'xlsx', 'xml'];
      if (!allowedExt.includes(file.name.split('.').pop().toLowerCase())) return toast.error("Arquivo inválido. Envie apenas planilhas ou XML.");

      const formData = new FormData(); formData.append("arquivo", file);
      const toastId = toast.loading("A importar base de dados...");

      try {
        const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        if (response.data.sucesso || response.status === 200 || response.status === 201) {
            const qtd = response.data.quantidade || response.data.total || response.data.registosProcessados || response.data.linhasLidas || '';
            toast.update(toastId, { render: qtd ? `Importação concluída! ${qtd} produtos importados/atualizados.` : "Importação concluída com sucesso!", type: "success", isLoading: false, autoClose: 5000 });
            limparFiltros(); carregarProdutos(0, termoBusca);
        } else throw new Error(response.data.mensagem || "Formato de retorno não reconhecido.");
      } catch (error) { toast.update(toastId, { render: error.message || "Erro ao comunicar com o servidor.", type: "error", isLoading: false, autoClose: 5000 }); }
  };

  const handleExportar = async (tipo) => {
    const toastId = toast.loading(`Gerando arquivo ${tipo}...`);
    try {
      const res = await api.get(`/produtos/exportar/${tipo}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `estoque_exportado.${tipo === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.update(toastId, { render: "Download iniciado!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (err) { toast.update(toastId, { render: "Falha na geração do arquivo.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  const handleSingleAction = useCallback((type, prod) => {
    const isDelete = type === 'delete';
    setConfirmModal({
      isOpen: true, type: isDelete ? 'danger' : 'success', title: isDelete ? 'Mover para Lixeira' : 'Restaurar',
      message: `${isDelete ? 'Inativar' : 'Restaurar'} "${prod.descricao}"?`, confirmText: 'Confirmar',
      onConfirm: async () => {
        try {
            if (isDelete) await produtoService.excluir(prod.codigoBarras);
            else await produtoService.restaurar(prod.codigoBarras);
            toast.success("Sucesso!"); carregarProdutos(isDelete ? pageState.page : 0, termoBusca);
        } catch (e) { toast.error("Ação recusada pelo servidor."); }
      }
    });
  }, [pageState.page, termoBusca, carregarProdutos]);

  const handlePrint = useCallback(async (id) => {
    setUi(prev => ({ ...prev, loadingPrint: id }));
    try {
        const zpl = await produtoService.imprimirEtiqueta(id);
        const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${zpl}</pre>`); w.document.close();
    } catch (e) { toast.error("Serviço de impressão indisponível."); }
    finally { setUi(prev => ({ ...prev, loadingPrint: null })); }
  }, []);

    const handleQuickFix = (acao, mensagemConfirmacao, nomeCorrecao) => {
        setConfirmModal({
          isOpen: true, type: 'robot', title: `Auditoria: ${nomeCorrecao}`, message: mensagemConfirmacao, confirmText: 'Executar Varredura',
          onConfirm: async () => {
            const toastId = toast.loading(`A varrer a base de dados...`);
            try {
              const response = await api.post(`/produtos/quick-fix-ia/${acao}`);
              let mensagemRetorno = typeof response.data === 'string' ? response.data : (response.data.mensagem || response.data.message || "Correção aplicada!");
              toast.update(toastId, { render: String(mensagemRetorno), type: "success", isLoading: false, autoClose: 6000 });
              carregarProdutos(pageState.page, termoBusca);
            } catch (e) {
              toast.update(toastId, { render: String(e.response?.data?.message || "Falha na comunicação com o servidor."), type: "error", isLoading: false, autoClose: 5000 });
            }
          }
        });
    };

  const abrirModalDivergencia = async () => {
    toast.dismiss(); const toastId = toast.loading("Extraindo alertas de gôndola...");
    try {
        const response = await api.get('/produtos/divergencias-gondola');
        setDados(d => ({ ...d, divergentes: response.data }));
        setUi(prev => ({ ...prev, modalDivergencia: true }));
        toast.update(toastId, { render: "Lista carregada!", type: "success", isLoading: false, autoClose: 800 });
    } catch (e) { toast.dismiss(toastId); toast.error("Servidor indisponível para esta operação."); }
  };

  const resolverItemDivergente = async (id) => {
        const precoStr = newPrices[id];
        if (!precoStr) return toast.error("Informe o preço real da gôndola.");
        const precoFloat = parseFloat(precoStr.replace(/\./g, '').replace(',', '.'));
        if (isNaN(precoFloat) || precoFloat <= 0) return toast.error("Valor bloqueado (Inválido).");

        toast.dismiss(); const loadId = toast.loading("Aproximando sistema com a gôndola...");
        try {
            await api.post(`/produtos/${id}/resolver-divergencia?novoPreco=${precoFloat}`);
            toast.update(loadId, { render: "Divergência eliminada!", type: "success", isLoading: false, autoClose: 1500 });
            setDados(d => ({ ...d, divergentes: d.divergentes.filter(p => p.id !== id) }));
            carregarProdutos(pageState.page, termoBusca);
        } catch (e) { toast.dismiss(loadId); toast.error("Não foi possível persistir a correção."); }
  };

  return (
    <>
      <div className="modern-layout-container fade-in">
        <header className="page-header-modern">
          <div className="header-titles">
            <h1 className="title-gradient">{modoLixeira ? 'Lixeira de Produtos' : 'Catálogo de Produtos'}</h1>
            <p className="subtitle text-muted">Gestão integrada • {pageState.totalElements} registos</p>
          </div>
          <div className="header-actions-group">
            <div className="tab-switcher-modern">
              <button className={`tab-btn ${!modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(false)}>Base Ativa</button>
              <button className={`tab-btn ${modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(true)}>
                Lixeira {dados.lixeiraCount > 0 && <span className="ping-dot-danger"></span>}
              </button>
            </div>
            {!modoLixeira && (
              <button className="btn-blue-shadow" onClick={() => navigate('/produtos/novo')}>
                <Plus size={18} strokeWidth={3} /> <span>Cadastrar Produto</span>
              </button>
            )}
          </div>
        </header>

        {!modoLixeira && (
          <div className="ai-dashboard-premium">
            <div className="ai-header-row">
              <div className="ai-title-wrapper">
                <div className="ai-pulse-ring"><Bot size={24} className="text-white" /></div>
                <div>
                  <h3 className="ai-title">Assistente de Catálogo (IA)</h3>
                  <p className="ai-subtitle">Deteção contínua de anomalias no estoque.</p>
                </div>
              </div>
              <div className="ai-buttons-group">
                 <button className="btn-glass-outline" onClick={() => handleQuickFix('NORMALIZAR_EAN', 'Deseja padronizar EANs internos?', 'Normalização de EANs')}><Barcode size={16}/> <span>Calcular EANs</span></button>
                 <button className="btn-glass-outline" onClick={() => handleQuickFix('CORRIGIR_NCM', 'Corrigir NCMs inválidos com base nos padrões?', 'Correção Rápida de NCM')}><Zap size={16}/> <span>Validar NCMs</span></button>
              </div>
            </div>
            {dados.raioX.totalAnomalias > 0 ? (
              <div className="ai-cards-container">
                 {dados.raioX.precoVendaZerado > 0 && (
                   <div className="ai-anomaly-card danger">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><AlertTriangle size={14}/> {dados.raioX.precoVendaZerado} Falhas</span>
                       <span className="anomaly-title">Venda Zerada Detectada</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('PRECO_VENDA_ZERADO', 'Deseja gerar preços automáticos?', 'Ajuste de Margem Seguro')}>Reparar Preços</button>
                   </div>
                 )}
                 {dados.raioX.divergenciaGondola > 0 && (
                   <div className="ai-divergence-siren-card slide-up">
                        <div className="siren-content">
                            <div className="siren-icon-wrapper"><AlertTriangle size={24} /></div>
                            <div className="siren-text">
                                <h4>{dados.raioX.divergenciaGondola} Alertas Físicos</h4>
                                <p>Preços da prateleira não batem com o sistema.</p>
                            </div>
                        </div>
                        <button className="btn-siren-action" onClick={abrirModalDivergencia}>Auditar Gôndola</button>
                    </div>
                 )}
              </div>
            ) : (
              <div className="ai-success-bar"><Check size={18} /> O seu banco de dados está íntegro e sem inconsistências críticas.</div>
            )}
          </div>
        )}

        <div className="data-card-modern">
          <div className="toolbar-modern">
            <SearchBar onSearch={setTermoBusca} />
            <div className="toolbar-actions">
                <button className={`btn-icon-soft ${ui.filtrosOpen || activeFiltersCount > 0 ? 'active' : ''}`} onClick={() => setUi(p => ({...p, filtrosOpen: !p.filtrosOpen}))}>
                    <Filter size={18}/>
                    {activeFiltersCount > 0 && <span className="filter-badge">{activeFiltersCount}</span>}
                </button>
                {!modoLixeira && (
                   <>
                       <button className="btn-icon-soft text-green" onClick={() => handleExportar('excel')} title="Exportar para Excel"><FileSpreadsheet size={18}/></button>
                       <div className="divider-v"></div>
                       <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                       <button className="btn-icon-text" onClick={() => fileInputRef.current.click()}><Upload size={18}/> <span className="hide-mobile">Importar Excel</span></button>
                   </>
                )}
            </div>
          </div>

          {ui.filtrosOpen && (
              <div className="filters-panel-modern">
                  <div className="filter-group">
                      <label>Volume em Estoque</label>
                      <select className="filter-select" value={filtros.estoque} onChange={(e) => handleFiltroChange('estoque', e.target.value)}>
                          <option value="todos">Mostrar Todos</option>
                          <option value="baixo">Estoque Baixo / Perigo</option>
                          <option value="zerado">Totalmente Zerados</option>
                          <option value="positivo">Em Estoque (Positivos)</option>
                      </select>
                  </div>
                  <div className="filter-group">
                      <label>Auditoria do Sistema</label>
                      <div className="checkbox-group">
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.revisaoPendente} onChange={(e) => handleFiltroChange('revisaoPendente', e.target.checked)} /> Pendentes de Revisão (Novos)</label>
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.semNcm} onChange={(e) => handleFiltroChange('semNcm', e.target.checked)} /> Bloqueio Fiscal (Sem NCM)</label>
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.semImagem} onChange={(e) => handleFiltroChange('semImagem', e.target.checked)} /> Design (Sem Imagem)</label>
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.precoZerado} onChange={(e) => handleFiltroChange('precoZerado', e.target.checked)} /> Erro Operacional (Preço Zerado)</label>
                      </div>
                  </div>
                  <div className="filter-group" style={{justifyContent: 'flex-end', alignItems: 'flex-end'}}>
                      <button className="btn-clear-filter" onClick={limparFiltros} style={{padding: '10px 20px', background:'#f1f5f9', borderRadius:'8px', color:'#475569', fontWeight: 'bold', cursor: 'pointer', border: 'none'}}>Remover Filtros</button>
                  </div>
              </div>
          )}

          {dados.produtos.length > 0 && (
             <div className="mobile-select-all">
                <label>
                   <input type="checkbox" onChange={handleSelectAll} checked={dados.produtos.length > 0 && selectedIds.length === dados.produtos.length} />
                   <span>Selecionar Todos</span>
                </label>
                {selectedIds.length > 0 && <span className="selected-count-badge">{selectedIds.length} selecionados</span>}
             </div>
          )}

          <div className="table-responsive sticky-header-wrapper custom-scrollbar" style={{marginTop: '20px'}}>
            <table className="ux-table">
              <thead>
                <tr>
                  <th className="checkbox-cell" width="40px"><input type="checkbox" onChange={handleSelectAll} checked={dados.produtos.length > 0 && selectedIds.length === dados.produtos.length}/></th>
                  <th width="35%">Identificação do Item</th>
                  <th className="hide-mobile" width="15%">Marca</th>
                  <th width="15%">Preço Venda</th>
                  <th width="15%">Físico (Qtd)</th>
                  <th className="hide-mobile" width="10%">Status</th>
                  <th className="align-right" width="10%">Ações</th>
                </tr>
              </thead>
              <tbody>
                  {ui.loading ? (<TableSkeleton />) : dados.produtos.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state-modern"><h3>Nenhum item cruzou as barreiras dos filtros.</h3></td></tr>
                  ) : (
                    dados.produtos.map((prod) => (
                        <ProdutoRow
                            key={prod.id}
                            prod={prod}
                            isSelected={selectedIds.includes(prod.id)}
                            onSelectOne={handleSelectOne}
                            getImageUrl={getImageUrl}
                            onZoom={(url) => setUi(p => ({...p, zoomImg: url}))}
                            editingCell={editingCell}
                            onStartEdit={iniciarEdicaoInline}
                            onEditChange={handleEditChange}
                            onSaveEdit={salvarEdicaoInline}
                            onCancelEdit={cancelarEdicao}
                            applyCurrencyMask={applyCurrencyMask}
                            navigate={navigate}
                            onSingleAction={handleSingleAction}
                            onPrint={handlePrint}
                            loadingPrint={ui.loadingPrint}
                        />
                    ))
                  )}
              </tbody>
            </table>
          </div>
          {!ui.loading && dados.produtos.length > 0 && <Pagination page={pageState.page} totalPages={pageState.totalPages} setPage={(p) => setPageState(prev => ({...prev, page: p}))} />}
        </div>
      </div>

      {ui.modalDivergencia && (
          <div className="modal-overlay">
             <div className="modal-content-resolution slide-up">
                <div className="modal-header-resolution">
                   <div className="header-title"><AlertTriangle size={24} style={{color: '#2563eb'}} /><h2>Gestão de Auditoria de Gôndola</h2></div>
                   <button onClick={() => setUi(p => ({...p, modalDivergencia: false}))} className="btn-close-modal"><X size={24}/></button>
                </div>
                <div className="modal-body-resolution custom-scrollbar">
                    <div className="resolution-list">
                        {dados.divergentes.map((p, index) => (
                            <div key={p.id} className="resolution-item">
                                <div className="res-info">
                                    <span className="res-ean"><Barcode size={14}/> {p.codigoBarras}</span>
                                    <strong className="res-title">{p.descricao}</strong>
                                    <div className="res-price-old">Etiqueta Anterior: <span className="line-through">R$ {p.precoVenda?.toFixed(2)}</span></div>
                                </div>
                                <div className="res-action">
                                    <div className="res-input-group">
                                        <span className="currency">R$</span>
                                        <input type="text" placeholder="Preço Real" autoFocus={index === 0} value={newPrices[p.id] || ''} onChange={(e) => setNewPrices(prev => ({...prev, [p.id]: applyCurrencyMask(e.target.value)}))} onFocus={(e) => e.target.select()} />
                                    </div>
                                    <button onClick={() => resolverItemDivergente(p.id)} className="btn-save-blue"><CheckCircle2 size={18} /> Aplicar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
      )}

      {ui.zoomImg && (
        <div className="lightbox-overlay fade-in" onClick={() => setUi(p => ({...p, zoomImg: null}))}>
            <div className="lightbox-content">
               <button onClick={() => setUi(p => ({...p, zoomImg: null}))} className="lightbox-close"><X size={28}/></button>
               <img src={ui.zoomImg} alt="Inspeção" />
            </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }} onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} isDanger={confirmModal.type === 'danger'} />
      )}

      {selectedIds.length > 0 && (
          <div className="bulk-action-bar slide-up">
              <div className="bulk-count"><span className="count-number">{selectedIds.length}</span> itens selecionados</div>
              <div className="bulk-actions">
                  {!modoLixeira ? (
                      <>
                          <button className="btn-bulk print" onClick={() => handleBulkAction('print')}><Printer size={18} /> <span className="hide-mobile">Imprimir Etiquetas</span></button>
                          <button className="btn-bulk delete" onClick={() => handleBulkAction('delete')}><Trash2 size={18} /> <span className="hide-mobile">Mover para Lixeira</span></button>
                      </>
                  ) : (
                      <button className="btn-bulk restore" onClick={() => handleBulkAction('restore')}><RotateCcw size={18} /> Restaurar Lote</button>
                  )}
                  <div className="bulk-divider"></div>
                  <button className="btn-bulk cancel" onClick={() => setSelectedIds([])}><X size={18} /> <span className="hide-mobile">Cancelar</span></button>
              </div>
          </div>
      )}
    </>
  );
}