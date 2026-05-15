import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box, ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, ImageOff, Filter, Copy, Check, Upload, FileText, FileSpreadsheet,
  Bot, AlertTriangle, Barcode, ChevronDown, ZoomIn, Edit2, AlertCircle, CheckCircle2
} from 'lucide-react';
import './ProdutoList.css';

// =========================================================================
// 🧩 COMPONENTES AUXILIARES
// =========================================================================

const SearchBar = ({ onSearch }) => {
  const [localTerm, setLocalTerm] = useState('');
  useEffect(() => {
      const handler = setTimeout(() => onSearch(localTerm), 500);
      return () => clearTimeout(handler);
  }, [localTerm, onSearch]);

  return (
    <div className="search-bar-modern">
      <Search className="search-icon" size={18} />
      <input type="text" placeholder="Pesquisar produto, marca ou EAN..." value={localTerm} onChange={(e) => setLocalTerm(e.target.value)} />
      {localTerm && <button className="clear-search-btn" onClick={() => setLocalTerm('')} title="Limpar busca"><X size={14}/></button>}
    </div>
  );
};

const Pagination = ({ page, totalPages, setPage }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-modern">
      <button className="btn-page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /> <span className="hide-mobile">Anterior</span></button>
      <div className="page-indicator">Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong></div>
      <button className="btn-page" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><span className="hide-mobile">Próxima</span> <ChevronRight size={18} /></button>
    </div>
  );
};

const TableSkeleton = () => (
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
);

const ProductImage = ({ src, alt, onZoom }) => {
  const [error, setError] = useState(false);
  if (!src || error) return <div className="img-placeholder"><ImageOff size={20} /></div>;
  return (
    <div className="img-zoom-wrapper" onClick={(e) => { e.stopPropagation(); onZoom(src); }}>
      <img src={src} alt={alt} className="img-product" onError={() => setError(true)} />
      <div className="img-zoom-overlay"><ZoomIn size={16} /></div>
    </div>
  );
};

const CopyableCode = ({ code }) => {
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
};

const ActionMenu = ({ prod, onEdit, onDelete, onPrint, onHistory, loadingPrint }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
};

const StockHealthBar = ({ estoque, minimo }) => {
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
};

const StatusIndicator = ({ prod }) => {
  const isAtivo = prod.ativo !== undefined ? prod.ativo : true;
  if (!isAtivo) return <span className="badge badge-inactive">Inativo</span>;
  if ((prod.quantidadeEmEstoque || 0) === 0) return <span className="badge badge-danger">Zerado</span>;
  if ((prod.quantidadeEmEstoque || 0) <= (prod.estoqueMinimo || 5)) return <span className="badge badge-warning">Baixo</span>;
  return <span className="badge badge-active">Ativo</span>;
};

const DiagnosticoAlertas = ({ prod, filtroAtivo }) => {
    const alertas = [];
    if (prod.alertaGondola || prod.revisaoPendente) {
        alertas.push({ id: 'gondola', texto: "🚨 DIVERGÊNCIA FÍSICA", classe: "badge-divergence-glow" });
    }
    if (filtroAtivo || prod.alertaGondola || prod.revisaoPendente) {
        if (!prod.precoVenda || prod.precoVenda <= 0) {
            alertas.push({ id: 'preco', texto: "Preço Zerado", classe: "bg-rose-100 text-rose-700 border-rose-200" });
        }
        if (!prod.ncm || prod.ncm.length < 8 || prod.ncm === '00000000') {
            alertas.push({ id: 'ncm', texto: "NCM Pendente/Inválido", classe: "bg-amber-100 text-amber-700 border-amber-200" });
        }
        if (!prod.urlImagem) {
            alertas.push({ id: 'img', texto: "Sem Imagem", classe: "bg-purple-100 text-purple-700 border-purple-200" });
        }
    }
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
};

// ==================================================================================
// 🚀 COMPONENTE PRINCIPAL
// ==================================================================================
const ProdutoList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [produtos, setProdutos] = useState([]);
  const [raioXIa, setRaioXIa] = useState({ totalAnomalias: 0, semCusto: 0, precoVendaZerado: 0, semNcm: 0, ncmInvalido: 0, semDescricao: 0, semMarca: 0, divergenciaGondola: 0 });
  const [qtdLixeira, setQtdLixeira] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(null);
  const [modoLixeira, setModoLixeira] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);

  const [editingCell, setEditingCell] = useState({ id: null, field: null, value: '' });

  const [showDivergenceModal, setShowDivergenceModal] = useState(false);
  const [divergentProducts, setDivergentProducts] = useState([]);
  const [newPrices, setNewPrices] = useState({});

  const [filtros, setFiltros] = useState({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger', confirmText: 'Confirmar' });

  const getImageUrl = (url) => url ? (url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`) : null;

  const carregarProdutos = useCallback(async (pagina, termo) => {
    setLoading(true);
    try {
      try { const lix = await produtoService.buscarLixeira(); setQtdLixeira(Array.isArray(lix) ? lix.length : 0); } catch(e) {}
      if (modoLixeira) {
        const listaBruta = await produtoService.buscarLixeira();
        const listaInativos = Array.isArray(listaBruta) ? listaBruta : [];
        const filtrados = termo ? listaInativos.filter(p => (p.descricao && p.descricao.toLowerCase().includes(termo.toLowerCase())) || (p.codigoBarras && p.codigoBarras.includes(termo))) : listaInativos;
        setProdutos(filtrados); setTotalPages(1); setTotalElements(filtrados.length);
      } else {
        const dados = await produtoService.listar(pagina, 50, termo, filtros);
        let listaProdutos = [];
        if (Array.isArray(dados)) listaProdutos = dados;
        else if (dados && dados.content && Array.isArray(dados.content)) listaProdutos = dados.content;
        else if (dados && dados.itens && Array.isArray(dados.itens)) listaProdutos = dados.itens;

        setProdutos(listaProdutos);
        setTotalPages(dados?.totalPages || dados?.totalPaginas || 1);
        setTotalElements(dados?.totalElements || dados?.totalElementos || listaProdutos.length);

        try {
            const responseIa = await api.get('/produtos/dashboard-ia');
            setRaioXIa(responseIa.data);
        } catch (e) {}
      }
    } catch (error) { toast.error("Erro ao carregar lista de produtos."); }
    finally { setLoading(false); }
  }, [modoLixeira, filtros]);

  useEffect(() => { if (page !== 0) setPage(0); carregarProdutos(0, termoBusca); }, [termoBusca, filtros, modoLixeira]);
  useEffect(() => { carregarProdutos(page, termoBusca); }, [page]);
  useEffect(() => { setSelectedIds([]); }, [modoLixeira]);

  const handleFiltroChange = (key, value) => { setFiltros(prev => ({ ...prev, [key]: value })); setPage(0); };
  const limparFiltros = () => { setFiltros({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false }); setPage(0); };
  const handleSelectAll = (e) => e.target.checked ? setSelectedIds(produtos.map(p => p.id)) : setSelectedIds([]);
  const handleSelectOne = (id) => selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(itemId => itemId !== id)) : setSelectedIds([...selectedIds, id]);

  // 🔥 MÁSCARAS E FUNÇÕES AUXILIARES
  const applyCurrencyMask = (value) => {
    let valor = value.toString().replace(/\D/g, '');
    if (!valor) return '0,00';
    valor = (parseInt(valor) / 100).toFixed(2);
    valor = valor.replace('.', ',');
    valor = valor.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return valor;
  };

  const handleFocus = (e) => e.target.select();

  const handlePriceMask = (e, id) => {
      setNewPrices(prev => ({...prev, [id]: applyCurrencyMask(e.target.value)}));
  };

  // 🔥 EDIÇÃO INLINE NA TABELA
  const iniciarEdicaoInline = (e, id, field, currentValue) => {
      e.stopPropagation();
      let val = currentValue;
      if (field === 'precoVenda') {
          val = currentValue.toFixed(2).replace('.', ',');
      }
      setEditingCell({ id, field, value: val || '' });
  };

  const salvarEdicaoInline = async () => {
        if (!editingCell.id) return;
        const { id, field, value } = editingCell;

        try {
            if (field === 'precoVenda') {
                const precoNum = parseFloat(value.toString().replace(/\./g, '').replace(',', '.'));
                if (isNaN(precoNum) || precoNum < 0) throw new Error("Preço inválido");
                await api.patch(`/produtos/${id}/preco-venda?valor=${precoNum}`);
            } else if (field === 'quantidadeEmEstoque') {
                const qtdNum = parseInt(value, 10);
                if (isNaN(qtdNum) || qtdNum < 0) throw new Error("Quantidade inválida");
                await api.patch(`/produtos/${id}/estoque?quantidade=${qtdNum}`);
            }

            toast.success("Atualizado!", { autoClose: 800, hideProgressBar: true });
            carregarProdutos(page, termoBusca);
        } catch (error) {
            toast.error("Erro ao salvar.");
        } finally {
            setEditingCell({ id: null, field: null, value: '' });
        }
    };

  const handleInlineKeyDown = (e) => {
      if (e.key === 'Enter') salvarEdicaoInline();
      if (e.key === 'Escape') setEditingCell({ id: null, field: null, value: '' });
  };

  // 🔥 AÇÕES DE PRODUTO
  const handleImportar = async (e) => {
      const file = e.target.files[0]; if (!file) return; e.target.value = null;
      const formData = new FormData(); formData.append("arquivo", file);
      const toastId = toast.loading("Importando base de dados...");
      try {
        const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        if (response.data.sucesso) { toast.update(toastId, { render: "Importação concluída!", type: "success", isLoading: false, autoClose: 4000 }); setPage(0); carregarProdutos(0, ''); }
        else { throw new Error(response.data.mensagem); }
      } catch (error) { toast.update(toastId, { render: "Erro na importação.", type: "error", isLoading: false, autoClose: 5000 }); }
  };

  const handleExportar = async (tipo) => {
    const toastId = toast.loading(`Gerando exportação...`);
    try {
      const res = await api.get(`/produtos/exportar/${tipo}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `estoque.${tipo === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.update(toastId, { render: "Download iniciado!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (err) { toast.update(toastId, { render: "Erro na exportação.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  const handleSingleAction = (type, prod) => {
    const isDelete = type === 'delete';
    setConfirmModal({
      isOpen: true, type: isDelete ? 'danger' : 'success', title: isDelete ? 'Mover para Lixeira' : 'Restaurar', message: `${isDelete ? 'Inativar' : 'Restaurar'} "${prod.descricao}"?`, confirmText: 'Confirmar',
      onConfirm: async () => {
        try { if (isDelete) await produtoService.excluir(prod.codigoBarras); else await produtoService.restaurar(prod.codigoBarras); toast.success("Sucesso!"); carregarProdutos(isDelete ? page : 0, termoBusca); }
        catch (e) { toast.error("Falha na ação."); }
      }
    });
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try { const zpl = await produtoService.imprimirEtiqueta(id); const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${zpl}</pre>`); w.document.close(); }
    catch (e) { toast.error("Erro na impressão."); } finally { setLoadingPrint(null); }
  };

  // 🔥 FERRAMENTAS DA IA
  const handleQuickFix = (tipo, mensagemConfirmacao, nomeCorrecao) => {
      if ((tipo === 'SEM_CUSTO' || tipo === 'PRECO_VENDA_ZERADO') && raioXIa.semCusto > 0 && raioXIa.semCusto === raioXIa.precoVendaZerado) {
           toast.warn("Impasse: Venda e Custo zerados. Edite manualmente primeiro.", { autoClose: 6000 });
           handleFiltroChange('precoZerado', true);
           return;
      }
      setConfirmModal({
        isOpen: true, type: 'robot', title: `IA: ${nomeCorrecao}`, message: mensagemConfirmacao, confirmText: 'Aplicar',
        onConfirm: async () => {
          const toastId = toast.loading(`🤖 Aplicando...`);
          try {
            await api.post(`/produtos/quick-fix-ia/${tipo}`);
            toast.update(toastId, { render: "Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
            carregarProdutos(page, termoBusca);
          } catch (e) { toast.update(toastId, { render: "Erro na IA.", type: "error", isLoading: false, autoClose: 3000 }); }
        }
      });
  };

  const handleCorrigirNcms = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'Auditoria Fiscal', message: 'O sistema irá varrer a base de dados para corrigir NCMs baseando-se na inteligência fiscal.', confirmText: 'Iniciar Correção',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Analisando NCMs...");
        try { await api.post('/produtos/corrigir-ncms-ia'); toast.update(toastId, { render: `Auditoria Concluída!`, type: "success", isLoading: false, autoClose: 4000 }); carregarProdutos(page, termoBusca); }
        catch (e) { toast.update(toastId, { render: "Erro na auditoria fiscal.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  const handleCorrigirEANsInternos = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'Normalização EAN', message: 'Deseja recalcular e padronizar o dígito verificador GS1 para todos os códigos internos?', confirmText: 'Corrigir Base',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Recalculando códigos...");
        try { await api.post('/produtos/corrigir-eans-internos-ia'); toast.update(toastId, { render: `Normalização Concluída!`, type: "success", isLoading: false, autoClose: 4000 }); carregarProdutos(page, termoBusca); }
        catch (e) { toast.update(toastId, { render: "Erro no recálculo.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  // 🔥 MODAL DE DIVERGÊNCIA DE GÔNDOLA
  const abrirModalDivergencia = async () => {
    toast.dismiss(); // Reseta os toasts travados
    const toastId = toast.loading("Listando alertas...");
    try {
        const response = await api.get('/produtos/divergencias-gondola');
        setDivergentProducts(response.data);
        setShowDivergenceModal(true);
        toast.update(toastId, { render: "Carregado!", type: "success", isLoading: false, autoClose: 800 });
    } catch (e) {
        toast.dismiss(toastId);
        toast.error("Erro ao carregar divergências.");
    }
  };

  const resolverItemDivergente = async (id) => {
        const precoStr = newPrices[id];
        if (!precoStr) { toast.error("Insira um novo preço."); return; }
        const precoFloat = parseFloat(precoStr.replace(/\./g, '').replace(',', '.'));
        if (isNaN(precoFloat) || precoFloat <= 0) { toast.error("Preço inválido."); return; }

        toast.dismiss(); // Garante a limpeza visual
        const loadId = toast.loading("Corrigindo...");

        try {
            await api.post(`/produtos/${id}/resolver-divergencia?novoPreco=${precoFloat}`);
            toast.update(loadId, { render: "Divergência resolvida!", type: "success", isLoading: false, autoClose: 1500 });
            setDivergentProducts(prev => prev.filter(p => p.id !== id));
            carregarProdutos(page, termoBusca);
        } catch (e) {
            toast.dismiss(loadId);
            toast.error("Erro ao atualizar o preço.");
        }
  };

  return (
    <>
      <div className="modern-layout-container fade-in">
        <header className="page-header-modern">
          <div className="header-titles">
            <h1 className="title-gradient">{modoLixeira ? 'Lixeira de Produtos' : 'Produtos'}</h1>
            <p className="subtitle text-muted">Gestão integrada • {totalElements} registos</p>
          </div>
          <div className="header-actions-group">
            <div className="tab-switcher-modern">
              <button className={`tab-btn ${!modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(false)}>Catálogo Ativo</button>
              <button className={`tab-btn ${modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(true)}>
                Lixeira {qtdLixeira > 0 && <span className="ping-dot-danger"></span>}
              </button>
            </div>
            {!modoLixeira && (
              <button className="btn-blue-shadow" onClick={() => navigate('/produtos/novo')}>
                <Plus size={18} strokeWidth={3} /> <span>Novo Produto</span>
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
                  <h3 className="ai-title">Assistente de Catálogo Inteligente</h3>
                  <p className="ai-subtitle">Deteção automática de anomalias.</p>
                </div>
              </div>
              <div className="ai-buttons-group">
                 <button className="btn-glass-outline" onClick={handleCorrigirEANsInternos}><Barcode size={16}/> <span>EANs</span></button>
                 <button className="btn-glass-outline" onClick={handleCorrigirNcms}><Zap size={16}/> <span>NCMs</span></button>
              </div>
            </div>
            {raioXIa.totalAnomalias > 0 ? (
              <div className="ai-cards-container">
                 {raioXIa.precoVendaZerado > 0 && (
                   <div className="ai-anomaly-card danger">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><AlertTriangle size={14}/> {raioXIa.precoVendaZerado} Itens</span>
                       <span className="anomaly-title">Venda Zerada</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('PRECO_VENDA_ZERADO', 'Gerar preços baseados no custo?', 'Margem IA')}>Gerar Preços</button>
                   </div>
                 )}
                 {raioXIa.divergenciaGondola > 0 && (
                   <div className="ai-divergence-siren-card slide-up">
                        <div className="siren-content">
                            <div className="siren-icon-wrapper"><AlertTriangle size={24} /></div>
                            <div className="siren-text">
                                <h4>{raioXIa.divergenciaGondola} Alertas de Gôndola</h4>
                                <p>Preços físicos divergentes do sistema.</p>
                            </div>
                        </div>
                        <button className="btn-siren-action" onClick={abrirModalDivergencia}>Resolver Agora</button>
                    </div>
                 )}
              </div>
            ) : (
              <div className="ai-success-bar"><Check size={18} /> Base de dados auditada e sem inconsistências.</div>
            )}
          </div>
        )}

        <div className="data-card-modern">
          <div className="toolbar-modern">
            <SearchBar onSearch={setTermoBusca} />
            <div className="toolbar-actions">
                <button className={`btn-icon-soft ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}><Filter size={18}/></button>
                {!modoLixeira && (
                   <>
                       <button className="btn-icon-soft text-green" onClick={() => handleExportar('excel')}><FileSpreadsheet size={18}/></button>
                       <div className="divider-v"></div>
                       <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                       <button className="btn-icon-text" onClick={() => fileInputRef.current.click()}><Upload size={18}/> <span className="hide-mobile">Importar</span></button>
                   </>
                )}
            </div>
          </div>

          <div className="table-responsive sticky-header-wrapper custom-scrollbar">
            <table className="ux-table">
              <thead>
                <tr>
                  <th className="checkbox-cell" width="40px"><input type="checkbox" onChange={handleSelectAll} checked={produtos.length > 0 && selectedIds.length === produtos.length}/></th>
                  <th width="35%">Identificação</th>
                  <th className="hide-mobile" width="15%">Marca</th>
                  <th width="15%">Preço</th>
                  <th width="15%">Estoque</th>
                  <th className="hide-mobile" width="10%">Status</th>
                  <th className="align-right" width="10%">Gerir</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (<TableSkeleton />) : produtos.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state-modern"><h3>Nenhum produto encontrado</h3></td></tr>
                  ) : (
                    produtos.map((prod) => {
                      const isSelected = selectedIds.includes(prod.id);
                      return (
                        <tr key={prod.id} className={`ux-table-row ${isSelected ? 'selected' : ''}`} onClick={() => handleSelectOne(prod.id)}>
                          <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} /></td>
                          <td className="product-main-cell">
                            <div className="flex-center" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} onZoom={setZoomedImage} />
                                <div className="product-info-modern">
                                    <h4 className="product-title-modern">{prod.descricao}</h4>
                                    <CopyableCode code={prod.codigoBarras} />
                                    <DiagnosticoAlertas prod={prod} filtroAtivo={filtros.revisaoPendente} />
                                </div>
                            </div>
                          </td>
                          <td className="hide-mobile">{prod.marca || 'S/ Marca'}</td>
                          <td className="font-numeric editable-cell-modern" onDoubleClick={(e) => iniciarEdicaoInline(e, prod.id, 'precoVenda', prod.precoVenda)}>
                              {editingCell.id === prod.id && editingCell.field === 'precoVenda' ? (
                                  <div className="inline-edit-wrapper">
                                    <span className="currency-prefix">R$</span>
                                    <input
                                      autoFocus
                                      type="text"
                                      className="inline-input"
                                      value={editingCell.value}
                                      onFocus={handleFocus}
                                      onChange={(e) => setEditingCell({...editingCell, value: applyCurrencyMask(e.target.value)})}
                                      onBlur={salvarEdicaoInline}
                                      onKeyDown={handleInlineKeyDown}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                              ) : (
                                  <div className="editable-content-display">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda || 0)}</div>
                              )}
                          </td>
                          <td className="editable-cell-modern" onDoubleClick={(e) => iniciarEdicaoInline(e, prod.id, 'quantidadeEmEstoque', prod.quantidadeEmEstoque)}>
                              {editingCell.id === prod.id && editingCell.field === 'quantidadeEmEstoque' ? (
                                  <div className="inline-edit-wrapper">
                                    <input autoFocus type="number" className="inline-input text-center" value={editingCell.value} onChange={(e) => setEditingCell({...editingCell, value: e.target.value})} onBlur={salvarEdicaoInline} onKeyDown={handleInlineKeyDown} onClick={(e) => e.stopPropagation()} />
                                  </div>
                              ) : (
                                  <div className="editable-content-display"><StockHealthBar estoque={prod.quantidadeEmEstoque || 0} minimo={prod.estoqueMinimo || 5} /></div>
                              )}
                          </td>
                          <td className="hide-mobile"><StatusIndicator prod={prod} /></td>
                          <td className="align-right actions-cell" onClick={(e) => e.stopPropagation()}>
                              <ActionMenu prod={prod} onEdit={(id) => navigate(`/produtos/editar/${id}`)} onDelete={(p) => handleSingleAction('delete', p)} onPrint={handlePrint} onHistory={(id) => navigate(`/produtos/historico/${id}`)} loadingPrint={loadingPrint} />
                          </td>
                        </tr>
                      );
                    })
                  )}
              </tbody>
            </table>
          </div>
          {!loading && produtos.length > 0 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
        </div>
      </div>

      {showDivergenceModal && (
          <div className="modal-overlay">
             <div className="modal-content-resolution slide-up">
                <div className="modal-header-resolution">
                   <div className="header-title"><AlertTriangle size={24} style={{color: '#2563eb'}} /><h2>Resolver Divergências</h2></div>
                   <button onClick={() => setShowDivergenceModal(false)} className="btn-close-modal"><X size={24}/></button>
                </div>
                <div className="modal-body-resolution custom-scrollbar">
                    <div className="resolution-list">
                        {divergentProducts.map(p => (
                            <div key={p.id} className="resolution-item">
                                <div className="res-info">
                                    <span className="res-ean"><Barcode size={14}/> {p.codigoBarras}</span>
                                    <strong className="res-title">{p.descricao}</strong>
                                    <div className="res-price-old">Gôndola: <span className="line-through">R$ {p.precoVenda?.toFixed(2)}</span></div>
                                </div>
                                <div className="res-action">
                                    <div className="res-input-group">
                                        <span className="currency">R$</span>
                                        <input type="text" placeholder="Novo valor" value={newPrices[p.id] || ''} onChange={(e) => handlePriceMask(e, p.id)} onFocus={handleFocus} />
                                    </div>
                                    <button onClick={() => resolverItemDivergente(p.id)} className="btn-save-blue"><CheckCircle2 size={18} /> Salvar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
      )}

      {zoomedImage && (
        <div className="lightbox-overlay fade-in" onClick={() => setZoomedImage(null)}>
            <div className="lightbox-content">
               <button onClick={() => setZoomedImage(null)} className="lightbox-close"><X size={28}/></button>
               <img src={zoomedImage} alt="Zoom" />
            </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }} onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} isDanger={confirmModal.type === 'danger'} />
      )}
    </>
  );
};

export default ProdutoList;