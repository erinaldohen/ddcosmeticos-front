import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box, ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, ImageOff, Filter, Copy, Check, Upload, FileSpreadsheet, Bot, AlertTriangle,
  Barcode, ChevronDown, ZoomIn, Edit2, CheckCircle2, Tag, Package, DownloadCloud, FileUp
} from 'lucide-react';
import './ProdutoList.css';

// =========================================================================
// 🧩 COMPONENTES AUXILIARES (Alta Performance)
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
      <input type="text" placeholder="Pesquisar Produto, Marca ou EAN..." value={localTerm} onChange={(e) => setLocalTerm(e.target.value)} />
      {localTerm && <button className="clear-search-btn" onClick={() => setLocalTerm('')}><X size={14}/></button>}
    </div>
  );
});

const Pagination = memo(({ page, totalPages, setPage }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-modern">
      <button className="btn-page" disabled={page === 0} onClick={() => setPage(page - 1)}>
        <ChevronLeft size={18} /> <span className="action-text">Anterior</span>
      </button>
      <div className="page-indicator">Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong></div>
      <button className="btn-page" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
        <span className="action-text">Próxima</span> <ChevronRight size={18} />
      </button>
    </div>
  );
});

const TableSkeleton = memo(() => (
  <>{[1, 2, 3, 4, 5, 6].map((i) => (
      <tr key={i} className="ux-table-row skeleton-row">
        <td className="checkbox-cell"><div className="sk-box sm"></div></td>
        <td className="product-main-cell">
          <div className="flex-center" style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <div className="sk-box lg"></div>
            <div className="sk-col" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div className="sk-line w-150"></div><div className="sk-line w-80"></div>
            </div>
          </div>
        </td>
        <td className="hide-mobile-col"><div className="sk-line w-80"></div></td>
        <td className="td-metric"><div className="sk-line w-100"></div></td>
        <td className="td-metric"><div className="sk-line w-80"></div></td>
        <td className="hide-mobile-col"><div className="sk-badge"></div></td>
        <td className="align-right actions-cell"><div className="sk-line w-80 ml-auto"></div></td>
      </tr>
  ))}</>
));

const ProductImage = memo(({ src, alt, onZoom }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
      return <div className="img-zoom-wrapper img-empty" data-tooltip="Sem imagem"><ImageOff size={20} /></div>;
  }
  return (
    <div className="img-zoom-wrapper" onClick={(e) => { e.stopPropagation(); onZoom(src); }} data-tooltip="Ampliar Foto">
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
    <button className="code-wrapper" onClick={handleCopy} data-tooltip="Copiar Código">
      <span className="product-code">{code || 'S/GTIN'}</span>
      {code && (copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="icon-copy" />)}
    </button>
  );
});

const StockHealthBar = memo(({ estoque, minimo }) => {
    // Usa o valor exato do backend (se vier nulo, assume 0 para não quebrar a barra)
    const minVal = minimo ?? 0;
    const maxBar = minVal > 0 ? minVal * 3 : 20;
    const percent = Math.min(100, Math.max(0, (estoque / maxBar) * 100));
    const colorClass = estoque === 0 ? 'bg-rose-500' : estoque <= minVal ? 'bg-amber-500' : 'bg-emerald-500';

    return (
        <div className="stock-health-container" data-tooltip={`Estoque Mínimo Exigido: ${minVal}`}>
            <span className={`stock-number ${estoque <= minVal ? 'text-danger' : 'text-success'}`}>{estoque} un.</span>
            <div className="stock-health-track"><div className={`stock-health-fill ${colorClass}`} style={{ width: `${percent}%` }}></div></div>
        </div>
    );
});

const DiagnosticoAlertas = memo(({ prod }) => {
    const alertas = [];
    let temErroGrave = false;

    const ncmStr = prod.ncm ? String(prod.ncm) : '';
    const eanStr = prod.codigoBarras ? String(prod.codigoBarras) : '';

    if (prod.alertaGondola) { alertas.push({ id: 'gondola', texto: "🚨 DIVERGÊNCIA", classe: "badge-divergence-glow" }); temErroGrave = true; }
    if (!prod.precoVenda || prod.precoVenda <= 0) { alertas.push({ id: 'preco', texto: "Preço Zerado", classe: "badge-error" }); temErroGrave = true; }
    if (!ncmStr || ncmStr.length < 8 || ncmStr === '00000000') { alertas.push({ id: 'ncm', texto: "Sem NCM", classe: "badge-warning" }); temErroGrave = true; }
    if (!eanStr || eanStr.length < 8 || eanStr === 'S/N') { alertas.push({ id: 'ean', texto: "Sem EAN", classe: "badge-warning" }); temErroGrave = true; }

    if (prod.revisaoPendente && !temErroGrave && !prod.alertaGondola) {
        alertas.push({ id: 'revisao', texto: "⚠️ Revisar Cadastro", classe: "badge-info" });
    }

    if (alertas.length === 0) return null;

    return (
        <div className="alert-tags-container">
            {alertas.map(a => <span key={a.id} className={`badge-tag ${a.classe}`}>{a.texto}</span>)}
        </div>
    );
});

const ActionMenu = memo(({ prod, onEdit, onDelete, onPrint, onHistory, loadingPrint }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
        const handleEsc = (e) => { if (e.key === 'Escape') setIsOpen(false); };
        if (isOpen) { document.addEventListener('mousedown', handleClickOutside); document.addEventListener('keydown', handleEsc); }
        return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEsc); };
    }, [isOpen]);

    const exec = (e, fn) => { e.stopPropagation(); setIsOpen(false); fn(); };
    return (
        <div className="action-menu-container" ref={menuRef}>
            <button className={`btn-manage ${isOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                <span>Ações</span> <ChevronDown size={14} className={`dropdown-icon ${isOpen ? 'rotated' : ''}`} />
            </button>
            {isOpen && (
                <div className="action-dropdown fade-in-fast">
                    <button className="dropdown-item primary" onClick={(e) => exec(e, () => onEdit(prod.id))}><Edit3 size={16} /> Editar Produto</button>
                    <button className="dropdown-item" onClick={(e) => exec(e, () => onPrint(prod.id))} disabled={loadingPrint === prod.id}>
                        {loadingPrint === prod.id ? <div className="spinner-micro dark"></div> : <Printer size={16} />} Etiqueta ZPL
                    </button>
                    <button className="dropdown-item" onClick={(e) => exec(e, () => onHistory(prod.id))}><History size={16} /> Ver Histórico</button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item text-danger" onClick={(e) => exec(e, () => onDelete(prod))}><Trash2 size={16} /> Mover p/ Lixeira</button>
                </div>
            )}
        </div>
    );
});

// =========================================================================
// 🔥 LINHA DA TABELA (Optimizada para Desktop & Mobile)
// =========================================================================
const rowPropsAreEqual = (prev, next) => {
    if (prev.isSelected !== next.isSelected || prev.prod !== next.prod || prev.loadingPrint === prev.prod.id || next.loadingPrint === next.prod.id) return false;
    const wasEditing = prev.editingCell.id === prev.prod.id;
    const isEditing = next.editingCell.id === next.prod.id;
    if (wasEditing || isEditing) return prev.editingCell.field === next.editingCell.field && prev.editingCell.value === next.editingCell.value;
    return true;
};

const ProdutoRow = memo(({ prod, isSelected, onSelectOne, getImageUrl, onZoom, editingCell, onStartEdit, onEditChange, onSaveEdit, onCancelEdit, applyCurrencyMask, navigate, onSingleAction, onPrint, loadingPrint }) => {

    const handleFocus = (e) => e.target.select();
    const handleKeyDown = (e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); };

    const isEditingPreco = editingCell.id === prod.id && editingCell.field === 'precoVenda';
    const isEditingEstoque = editingCell.id === prod.id && editingCell.field === 'quantidadeEmEstoque';

    return (
        <tr className={`ux-table-row ${isSelected ? 'selected' : ''}`} onClick={() => onSelectOne(prod.id)}>
            <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={isSelected} onChange={() => onSelectOne(prod.id)} />
            </td>

            <td className="product-main-cell">
                            <div className="product-info-modern">
                                <h4 className="product-title-modern">{prod.descricao}</h4>
                                <CopyableCode code={prod.codigoBarras} />
                                <DiagnosticoAlertas prod={prod} />
                            </div>
                        </td>

            <td className="hide-mobile-col">{prod.marca || 'S/ Marca'}</td>

            {/* Bloco de Preço Adaptável */}
            <td className="font-numeric editable-cell-modern td-metric" onDoubleClick={(e) => onStartEdit(e, prod.id, 'precoVenda', prod.precoVenda)}>
                <div className="mobile-metric-header hide-desktop"><Tag size={14}/> <span>Preço</span></div>
                {isEditingPreco ? (
                    <div className="inline-edit-wrapper safe-mode">
                        <span className="currency-prefix">R$</span>
                        <input autoFocus type="text" className="inline-input" value={editingCell.value} onFocus={handleFocus} onChange={(e) => onEditChange(applyCurrencyMask(e.target.value))} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                        <div className="inline-actions">
                            <button className="btn-inline-save" onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}><Check size={16}/></button>
                            <button className="btn-inline-cancel" onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}><X size={16}/></button>
                        </div>
                    </div>
                ) : (
                    <button className="editable-content-display" data-tooltip="Duplo clique p/ editar">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda || 0)} <Edit2 size={12} className="edit-hint-icon" />
                    </button>
                )}
            </td>

            {/* Bloco de Estoque Adaptável */}
            <td className="editable-cell-modern td-metric" onDoubleClick={(e) => onStartEdit(e, prod.id, 'quantidadeEmEstoque', prod.quantidadeEmEstoque)}>
                <div className="mobile-metric-header hide-desktop"><Package size={14}/> <span>Estoque</span></div>
                {isEditingEstoque ? (
                    <div className="inline-edit-wrapper safe-mode">
                        <input autoFocus type="number" className="inline-input text-center" value={editingCell.value} onFocus={handleFocus} onChange={(e) => onEditChange(e.target.value)} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                        <div className="inline-actions">
                            <button className="btn-inline-save" onClick={(e) => { e.stopPropagation(); onSaveEdit(); }}><Check size={16}/></button>
                            <button className="btn-inline-cancel" onClick={(e) => { e.stopPropagation(); onCancelEdit(); }}><X size={16}/></button>
                        </div>
                    </div>
                ) : (
                    <button className="editable-content-display" data-tooltip="Duplo clique p/ editar">
                        <StockHealthBar estoque={prod.quantidadeEmEstoque || 0} minimo={prod.estoqueMinimo} /> <Edit2 size={12} className="edit-hint-icon" />
                    </button>
                )}
            </td>

            <td className="hide-mobile-col">
                {!prod.ativo ? <span className="badge badge-inactive">Inativo</span> :
                 (prod.quantidadeEmEstoque || 0) === 0 ? <span className="badge badge-danger">Zerado</span> : <span className="badge badge-active">Ativo</span>}
            </td>

            <td className="align-right actions-cell" onClick={(e) => e.stopPropagation()}>
                <ActionMenu prod={prod} onEdit={(id) => navigate(`/produtos/editar/${id}`)} onDelete={(p) => onSingleAction('delete', p)} onPrint={onPrint} onHistory={(id) => navigate(`/produtos/historico/${id}`)} loadingPrint={loadingPrint} />
            </td>
        </tr>
    );
}, rowPropsAreEqual);

// ==================================================================================
// 🚀 COMPONENTE PRINCIPAL (Cockpit)
// ==================================================================================
export default function ProdutoList() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [data, setData] = useState({ produtos: [], lixeiraCount: 0, raioX: { totalAnomalias: 0 }, divergentes: [] });
  const [ui, setUi] = useState({ loading: true, loadingPrint: null, filtrosOpen: false, modalDiverg: false, zoomImg: null });
  const [pageState, setPageState] = useState({ page: 0, totalPages: 0, totalElements: 0 });
  const [selection, setSelection] = useState({ modoLixeira: false, selectedIds: [], termoBusca: '' });
  const [filtros, setFiltros] = useState({ estoque: 'todos', marca: '', semNcm: false, precoZerado: false, revisaoPendente: false });
  const [editingCell, setEditingCell] = useState({ id: null, field: null, value: '' });
  const [newPrices, setNewPrices] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', type: 'danger', confirmText: 'Confirmar', onConfirm: () => {} });

  const activeFiltersCount = Object.keys(filtros).filter(k => (typeof filtros[k] === 'boolean' && filtros[k]) || (typeof filtros[k] === 'string' && filtros[k] !== '' && filtros[k] !== 'todos')).length;

  const getImageUrl = useCallback((url) => {
    if (!url || url === 'null' || url === 'undefined') return null;
    return url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`;
  }, []);

  const loadData = useCallback(async (pagina, termo) => {
    setUi(prev => ({ ...prev, loading: true }));
    try {
        const [lixRes, prodRes, iaRes] = await Promise.allSettled([
            produtoService.buscarLixeira(),
            !selection.modoLixeira ? produtoService.listar(pagina, 50, termo, filtros) : Promise.resolve(null),
            api.get('/produtos/dashboard-ia')
        ]);

        const lixeira = lixRes.status === 'fulfilled' ? lixRes.value : [];
        const iaData = iaRes.status === 'fulfilled' ? iaRes.value.data : { totalAnomalias: 0 };

        let listaProdutos = [];
        let totalP = 1, totalE = 0;

        if (selection.modoLixeira) {
            listaProdutos = termo ? lixeira.filter(p => p.descricao?.toLowerCase().includes(termo.toLowerCase()) || p.codigoBarras?.includes(termo)) : lixeira;
            totalE = listaProdutos.length;
        } else {
            const res = prodRes.value;
            listaProdutos = Array.isArray(res) ? res : (res?.content || res?.itens || []);
            totalP = res?.totalPages || res?.totalPaginas || 1;
            totalE = res?.totalElements || res?.totalElementos || listaProdutos.length;
        }

        setData(d => ({ ...d, produtos: listaProdutos, lixeiraCount: Array.isArray(lixeira) ? lixeira.length : 0, raioX: iaData }));
        setPageState({ page: pagina, totalPages: totalP, totalElements: totalE });
    } catch (error) { toast.error("Falha ao sincronizar com a base de dados."); }
    finally { setUi(prev => ({ ...prev, loading: false })); }
  }, [selection.modoLixeira, filtros]);

  useEffect(() => { loadData(pageState.page, selection.termoBusca); }, [pageState.page, loadData, selection.termoBusca]);
  useEffect(() => { setSelection(s => ({ ...s, selectedIds: [] })); setPageState(p => ({...p, page: 0})); }, [selection.modoLixeira]);

  useEffect(() => {
      const hasOpenModal = ui.modalDiverg || ui.zoomImg !== null || confirmModal.isOpen;
      document.body.style.overflow = hasOpenModal ? 'hidden' : 'auto';
      const handleGlobalEsc = (e) => {
          if (e.key === 'Escape') {
              if (ui.zoomImg) setUi(p => ({ ...p, zoomImg: null }));
              else if (ui.modalDiverg) setUi(p => ({ ...p, modalDiverg: false }));
              else if (ui.filtrosOpen) setUi(p => ({ ...p, filtrosOpen: false }));
          }
      };
      window.addEventListener('keydown', handleGlobalEsc);
      return () => { document.body.style.overflow = 'auto'; window.removeEventListener('keydown', handleGlobalEsc); };
  }, [ui.modalDiverg, ui.zoomImg, confirmModal.isOpen, ui.filtrosOpen]);

  const applyCurrencyMask = (value) => {
      let strVal = (value || '').toString().replace(/\D/g, '');
      if (!strVal) return '0,00';
      return (parseInt(strVal) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleSelectAll = useCallback((e) => setSelection(s => ({...s, selectedIds: e.target.checked ? data.produtos.map(p => p.id) : []})), [data.produtos]);
  const handleSelectOne = useCallback((id) => setSelection(s => ({...s, selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter(i => i !== id) : [...s.selectedIds, id]})), []);

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
        const produtoOriginal = data.produtos.find(p => p.id === id);
        if (!produtoOriginal) return cancelarEdicao();
        const valorAntigo = produtoOriginal[field];

        try {
            if (field === 'precoVenda') {
                const precoNum = parseFloat((value || '0').toString().replace(/\./g, '').replace(',', '.'));
                if (isNaN(precoNum) || precoNum < 0) throw new Error();
                setData(d => ({...d, produtos: d.produtos.map(p => p.id === id ? {...p, precoVenda: precoNum} : p)}));
                await api.patch(`/produtos/${id}/preco-venda?valor=${precoNum}`);
            } else if (field === 'quantidadeEmEstoque') {
                const qtdNum = parseInt(value || 0, 10);
                if (isNaN(qtdNum) || qtdNum < 0) throw new Error();
                setData(d => ({...d, produtos: d.produtos.map(p => p.id === id ? {...p, quantidadeEmEstoque: qtdNum} : p)}));
                await api.patch(`/produtos/${id}/estoque?quantidade=${qtdNum}`);
            }
            toast.success("Atualizado!", { autoClose: 500, hideProgressBar: true });
        } catch (error) {
            toast.error("Falha ao salvar. Valor revertido.");
            setData(d => ({...d, produtos: d.produtos.map(p => p.id === id ? {...p, [field]: valorAntigo} : p)}));
        }
        finally { setEditingCell({ id: null, field: null, value: '' }); }
  }, [editingCell, data.produtos, cancelarEdicao]);

  const handleBulkAction = (actionType) => {
      if (selection.selectedIds.length === 0) return;
      const selecionados = data.produtos.filter(p => selection.selectedIds.includes(p.id));

      if (actionType === 'print') {
          const toastId = toast.loading(`Processando impressões...`);
          Promise.all(selection.selectedIds.map(id => produtoService.imprimirEtiqueta(id)))
              .then(zpls => {
                  const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${zpls.join('\n')}</pre>`); w.document.close();
                  toast.update(toastId, { render: "Etiquetas geradas!", type: "success", isLoading: false, autoClose: 2000 });
                  setSelection(s => ({...s, selectedIds: []}));
              })
              .catch(() => toast.update(toastId, { render: "Erro na impressão.", type: "error", isLoading: false, autoClose: 3000 }));
          return;
      }

      const isDelete = actionType === 'delete';
      setConfirmModal({
          isOpen: true, type: isDelete ? 'danger' : 'success', title: isDelete ? 'Excluir Lote' : 'Restaurar Lote',
          message: `Confirmar ação para ${selection.selectedIds.length} produtos?`, confirmText: isDelete ? 'Excluir' : 'Restaurar',
          onConfirm: async () => {
              const toastId = toast.loading(`Processando...`);
              try {
                  if (isDelete) await Promise.all(selecionados.map(p => produtoService.excluir(p.codigoBarras)));
                  else await Promise.all(selecionados.map(p => produtoService.restaurar(p.codigoBarras)));
                  toast.update(toastId, { render: "Concluído!", type: "success", isLoading: false, autoClose: 2000 });
                  setSelection(s => ({...s, selectedIds: []})); loadData(pageState.page, selection.termoBusca);
              } catch (e) { toast.update(toastId, { render: "Falha na operação.", type: "error", isLoading: false, autoClose: 3000 }); }
          }
      });
  };

  const handleQuickFix = (acao, msg, titulo) => {
      setConfirmModal({
        isOpen: true, type: 'robot', title: titulo, message: msg, confirmText: 'Executar Auditoria',
        onConfirm: async () => {
          const toastId = toast.loading(`Processando base de dados...`);
          try {
            const res = await api.post(`/produtos/quick-fix-ia/${acao}`);
            toast.update(toastId, { render: typeof res.data === 'string' ? res.data : (res.data.mensagem || "Sucesso!"), type: "success", isLoading: false, autoClose: 4000 });
            loadData(pageState.page, selection.termoBusca);
          } catch (e) { toast.update(toastId, { render: "Erro na execução.", type: "error", isLoading: false, autoClose: 4000 }); }
        }
      });
  };

  const abrirModalDivergencia = async () => {
    toast.dismiss(); const toastId = toast.loading("Carregando prateleiras...");
    try {
        const res = await api.get('/produtos/divergencias-gondola');
        setData(d => ({ ...d, divergentes: res.data }));
        setUi(prev => ({ ...prev, modalDiverg: true }));
        toast.update(toastId, { render: "Pronto!", type: "success", isLoading: false, autoClose: 500 });
    } catch (e) { toast.dismiss(toastId); toast.error("Falha ao carregar."); }
  };

  const resolverItemDivergente = async (id) => {
        const precoFloat = parseFloat((newPrices[id] || '').replace(/\./g, '').replace(',', '.'));
        if (isNaN(precoFloat) || precoFloat <= 0) return toast.error("Preço inválido.");
        toast.dismiss(); const loadId = toast.loading("Sincronizando...");
        try {
            await api.post(`/produtos/${id}/resolver-divergencia?novoPreco=${precoFloat}`);
            toast.update(loadId, { render: "Divergência resolvida!", type: "success", isLoading: false, autoClose: 1500 });
            setData(d => ({ ...d, divergentes: d.divergentes.filter(p => p.id !== id) }));
            loadData(pageState.page, selection.termoBusca);
        } catch (e) { toast.dismiss(loadId); toast.error("Erro na sincronização."); }
  };

  const handleImportar = async (e) => {
      const file = e.target.files[0];
      if (!file) return; e.target.value = null;
      if (!['csv', 'xls', 'xlsx', 'xml'].includes(file.name.split('.').pop().toLowerCase())) return toast.error("Formato não suportado.");

      const formData = new FormData(); formData.append("arquivo", file);
      const toastId = toast.loading("Processando ficheiro...");

      try {
        const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        if (response.data.sucesso || response.status === 200 || response.status === 201) {
            const qtd = response.data.quantidade || response.data.total || response.data.registosProcessados || response.data.linhasLidas || '';
            toast.update(toastId, { render: qtd ? `Importados: ${qtd} produtos.` : "Importação concluída!", type: "success", isLoading: false, autoClose: 5000 });
            setFiltros({ estoque: 'todos', marca: '', semNcm: false, precoZerado: false, revisaoPendente: false });
            loadData(0, selection.termoBusca);
        } else throw new Error(response.data.mensagem || "Erro na estrutura do ficheiro.");
      } catch (error) { toast.update(toastId, { render: error.message || "Servidor indisponível.", type: "error", isLoading: false, autoClose: 5000 }); }
  };

  const handleExportar = async (tipo) => {
    const toastId = toast.loading(`A gerar documento de Inventário...`);
    try {
      const res = await api.get(`/produtos/exportar/${tipo}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Inventario_DD_${new Date().getTime()}.${tipo === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.update(toastId, { render: "Download iniciado com sucesso.", type: "success", isLoading: false, autoClose: 2000 });
    } catch (err) { toast.update(toastId, { render: "Falha ao compilar os dados.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  return (
    <>
      <main className="modern-layout-container fade-in">
        <header className="page-header-modern">
          <div className="header-titles">
            <h1 className="title-gradient">{selection.modoLixeira ? 'Lixeira' : 'Catálogo de Produtos'}</h1>
            <p className="subtitle text-muted">Gestão centralizada • {pageState.totalElements} registos</p>
          </div>
          <div className="header-actions-group">
            <div className="tab-switcher-modern">
              <button className={`tab-btn ${!selection.modoLixeira ? 'active' : ''}`} onClick={() => setSelection(s => ({...s, modoLixeira: false}))}>Estoque Atual</button>
              <button className={`tab-btn ${selection.modoLixeira ? 'active' : ''}`} onClick={() => setSelection(s => ({...s, modoLixeira: true}))}>
                Inativos {data.lixeiraCount > 0 && <span className="ping-dot-danger"></span>}
              </button>
            </div>
            {!selection.modoLixeira && (
              <button className="btn-solid-primary" onClick={() => navigate('/produtos/novo')}>
                <Plus size={20} /> <span className="action-text">Novo Produto</span>
              </button>
            )}
          </div>
        </header>

        {!selection.modoLixeira && (
          <section className="ai-dashboard-premium">
            <div className="ai-header-row">
              <div className="ai-title-wrapper">
                <div className="ai-pulse-ring"><Bot size={22} /></div>
                <div><h3 className="ai-title">Assistente de IA</h3><p className="ai-subtitle">Manutenção e Integridade</p></div>
              </div>
              <div className="ai-buttons-group">
                 <button className="btn-glass-outline" onClick={() => handleQuickFix('NORMALIZAR_EAN', 'Padronizar EANs internos baseados em código local?', 'Auditoria EAN')} data-tooltip="Corrigir Dígito Verificador">
                   <Barcode size={18}/> <span className="action-text">Auditar EANs</span>
                 </button>
                 <button className="btn-glass-outline" onClick={() => handleQuickFix('CORRIGIR_NCM', 'Preencher NCMs em branco pela descrição?', 'Auditoria NCM')} data-tooltip="Saneamento de Impostos">
                   <Zap size={18}/> <span className="action-text">Auditar NCMs</span>
                 </button>
              </div>
            </div>

            {data.raioX.totalAnomalias > 0 ? (
                <div className="ai-cards-container">
                {data.raioX.precoVendaZerado > 0 && (
                    <div className="ai-anomaly-card danger slide-up">
                        <div className="anomaly-header"><span className="anomaly-badge"><AlertTriangle size={14}/> {data.raioX.precoVendaZerado} Falhas</span><span className="anomaly-title">Venda Zerada (Risco de Prejuízo)</span></div>
                        <button className="btn-fix-action" onClick={() => handleQuickFix('PRECO_VENDA_ZERADO', 'Gerar preços baseados no custo?', 'Ajuste de Margem')}>Reparar</button>
                    </div>
                )}
                {data.raioX.divergenciaGondola > 0 && (
                    <div className="ai-divergence-siren-card slide-up">
                        <div className="siren-content">
                            <div className="siren-icon-wrapper"><AlertTriangle size={24} /></div>
                            <div className="siren-text"><h4>{data.raioX.divergenciaGondola} Alertas Físicos</h4><p className="hide-mobile-col">Divergência entre prateleira e sistema.</p></div>
                        </div>
                        <button className="btn-siren-action" onClick={abrirModalDivergencia}>Resolver</button>
                    </div>
                )}
                </div>
            ) : (
                <div className="ai-success-bar slide-up">
                    <CheckCircle2 size={18} /> Base de dados consolidada. Nenhuma anomalia crítica encontrada.
                </div>
            )}
          </section>
        )}

        <section className="data-card-modern">
          <div className="toolbar-modern">
            <SearchBar onSearch={(t) => setSelection(s => ({...s, termoBusca: t}))} />

            <div className="toolbar-actions">
                            <button aria-label="Filtrar produtos" aria-expanded={ui.filtrosOpen} className={`btn-toolbar btn-outline-secondary ${ui.filtrosOpen || activeFiltersCount > 0 ? 'active' : ''}`} onClick={() => setUi(p => ({...p, filtrosOpen: !p.filtrosOpen}))}>
                                <Filter size={18} aria-hidden="true" />
                                <span className="action-text font-bold">Filtrar</span>
                                {activeFiltersCount > 0 && <span className="filter-badge">{activeFiltersCount}</span>}
                            </button>

                            {!selection.modoLixeira && (
                               <>
                                   <div className="divider-v hide-mobile-col"></div>

                                   <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                                   <button className="btn-toolbar btn-outline-primary" onClick={() => fileInputRef.current.click()}>
                                       <FileUp size={18} aria-hidden="true" />
                                       <span className="action-text font-bold">Importar XLS</span>
                                   </button>

                                   <button className="btn-toolbar btn-solid-success" onClick={() => handleExportar('excel')}>
                                       <DownloadCloud size={18} aria-hidden="true" />
                                       <span className="action-text font-bold">Exportar Excel</span>
                                   </button>
                               </>
                            )}
                        </div>
          </div>

          {ui.filtrosOpen && (
              <div className="filters-panel-modern">
                  <div className="filter-group">
                      <label htmlFor="estoque-filter">Volume de Estoque</label>
                      <select id="estoque-filter" className="filter-select" value={filtros.estoque} onChange={(e) => { setFiltros(f => ({...f, estoque: e.target.value})); setPageState(p => ({...p, page: 0})); }}>
                          <option value="todos">Todos</option><option value="baixo">Baixo (Alerta)</option><option value="zerado">Esgotado</option><option value="positivo">Em Estoque</option>
                      </select>
                  </div>
                  <div className="filter-group">
                      <label>Auditoria de Fichas</label>
                      <div className="checkbox-group">
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.revisaoPendente} onChange={(e) => setFiltros(f => ({...f, revisaoPendente: e.target.checked}))} /> Fichas Pendentes</label>
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.semNcm} onChange={(e) => setFiltros(f => ({...f, semNcm: e.target.checked}))} /> Sem NCM</label>
                          <label className="checkbox-label"><input type="checkbox" checked={filtros.precoZerado} onChange={(e) => setFiltros(f => ({...f, precoZerado: e.target.checked}))} /> Risco (Preço Zerado)</label>
                      </div>
                  </div>
              </div>
          )}

          {data.produtos.length > 0 && (
             <div className="mobile-select-all"></div>
          )}

          <div className="table-responsive sticky-header-wrapper custom-scrollbar">
            <table className="ux-table">
              <thead>
                <tr>
                  <th className="checkbox-cell" width="40px" data-tooltip="Marcar todos"><input type="checkbox" onChange={handleSelectAll} checked={data.produtos.length > 0 && selection.selectedIds.length === data.produtos.length}/></th>
                  <th width="35%">Produto</th>
                  <th className="hide-mobile-col" width="15%">Marca</th>
                  <th width="15%">Preço de Venda</th>
                  <th width="15%">Estoque</th>
                  <th className="hide-mobile-col" width="10%">Status</th>
                  <th className="align-right" width="10%">Gestão</th>
                </tr>
              </thead>
              <tbody>
                  {ui.loading ? (<TableSkeleton />) : data.produtos.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state-modern"><Box size={40} className="empty-icon"/><h3>A base de dados está vazia</h3><p>Altere os filtros ou importe uma planilha.</p></td></tr>
                  ) : (
                    data.produtos.map((prod) => (
                        <ProdutoRow key={prod.id} prod={prod} isSelected={selection.selectedIds.includes(prod.id)} onSelectOne={handleSelectOne} getImageUrl={getImageUrl} onZoom={(url) => setUi(p => ({...p, zoomImg: url}))} editingCell={editingCell} onStartEdit={iniciarEdicaoInline} onEditChange={(val) => setEditingCell(prev => ({ ...prev, value: val }))} onSaveEdit={salvarEdicaoInline} onCancelEdit={cancelarEdicao} applyCurrencyMask={applyCurrencyMask} navigate={navigate} onSingleAction={(type, p) => handleSingleAction(type === 'delete' ? 'delete' : 'restore', p)} onPrint={(id) => handlePrint(id)} loadingPrint={ui.loadingPrint} />
                    ))
                  )}
              </tbody>
            </table>
          </div>
          {!ui.loading && data.produtos.length > 0 && <Pagination page={pageState.page} totalPages={pageState.totalPages} setPage={(p) => setPageState(prev => ({...prev, page: p}))} />}
        </section>
      </main>

      {/* MODAL DIVERGÊNCIAS GÔNDOLA */}
      {ui.modalDiverg && (
          <div className="modal-overlay">
             <div className="modal-content-resolution slide-up">
                <div className="modal-header-resolution"><div className="header-title"><AlertTriangle size={24} className="text-danger" /><h2>Corrigir Preços Físicos</h2></div><button onClick={() => setUi(p => ({...p, modalDiverg: false}))} className="btn-close-modal"><X size={24}/></button></div>
                <div className="modal-body-resolution custom-scrollbar">
                    <div className="resolution-list">
                        {data.divergentes.map((p, idx) => (
                            <div key={p.id} className="resolution-item">
                                <div className="res-info"><span className="res-ean"><Barcode size={14}/> {p.codigoBarras}</span><strong className="res-title">{p.descricao}</strong><div className="res-price-old">Sistema: <span className="line-through">R$ {p.precoVenda?.toFixed(2)}</span></div></div>
                                <div className="res-action"><div className="res-input-group"><span className="currency">R$</span><input type="text" placeholder="Gôndola" autoFocus={idx === 0} value={newPrices[p.id] || ''} onChange={(e) => setNewPrices(pr => ({...pr, [p.id]: applyCurrencyMask(e.target.value)}))} onFocus={(e)=>e.target.select()} /></div><button onClick={() => resolverItemDivergente(p.id)} className="btn-solid-success"><CheckCircle2 size={18}/> Salvar</button></div>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* ZOOM DA IMAGEM */}
      {ui.zoomImg && (
        <div className="lightbox-overlay fade-in" onClick={() => setUi(p => ({...p, zoomImg: null}))}>
            <div className="lightbox-content"><button onClick={() => setUi(p => ({...p, zoomImg: null}))} className="lightbox-close"><X size={28}/></button><img src={ui.zoomImg} alt="Visualização Expandida" /></div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      {confirmModal.isOpen && (
        <ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(p => ({...p, isOpen: false})); }} onCancel={() => setConfirmModal(p => ({...p, isOpen: false}))} isDanger={confirmModal.type === 'danger'} />
      )}

      {/* BARRA FLUTUANTE (OPERAÇÕES EM LOTE) */}
      {selection.selectedIds.length > 0 && (
          <div className="bulk-action-bar slide-up">
              <div className="bulk-count"><span className="count-number">{selection.selectedIds.length}</span> itens marcados</div>
              <div className="bulk-actions">
                  {!selection.modoLixeira ? (
                      <><button className="btn-bulk print" onClick={() => handleBulkAction('print')}><Printer size={18} /> <span className="action-text">Etiquetas ZPL</span></button><button className="btn-bulk delete" onClick={() => handleBulkAction('delete')}><Trash2 size={18} /> <span className="action-text">Inativar</span></button></>
                  ) : (<button className="btn-bulk restore" onClick={() => handleBulkAction('restore')}><RotateCcw size={18} /> <span className="action-text">Restaurar</span></button>)}
                  <div className="bulk-divider"></div><button className="btn-bulk cancel" onClick={() => setSelection(s => ({...s, selectedIds: []}))}><X size={18} /></button>
              </div>
          </div>
      )}
    </>
  );
}