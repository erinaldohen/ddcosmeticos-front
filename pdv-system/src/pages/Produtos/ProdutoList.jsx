import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box, ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, ImageOff, Filter, Copy, Check, Upload, FileText, FileSpreadsheet,
  Bot, AlertTriangle, Barcode, ChevronDown, ZoomIn, Edit2, AlertCircle
} from 'lucide-react';
import './ProdutoList.css';

// =========================================================================
// 🧩 COMPONENTES AUXILIARES (UI/UX Refinados)
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
      <input
        type="text"
        placeholder="Pesquisar produto, marca ou EAN..."
        value={localTerm}
        onChange={(e) => setLocalTerm(e.target.value)}
      />
      {localTerm && (
        <button className="clear-search-btn" onClick={() => setLocalTerm('')} title="Limpar busca">
            <X size={14}/>
        </button>
      )}
    </div>
  );
};

const Pagination = ({ page, totalPages, setPage }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-modern">
      <button
        className="btn-page"
        disabled={page === 0}
        onClick={() => setPage(page - 1)}>
        <ChevronLeft size={18} /> <span className="hide-mobile">Anterior</span>
      </button>
      <div className="page-indicator">
        Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong>
      </div>
      <button
        className="btn-page"
        disabled={page >= totalPages - 1}
        onClick={() => setPage(page + 1)}>
        <span className="hide-mobile">Próxima</span> <ChevronRight size={18} />
      </button>
    </div>
  );
};

const TableSkeleton = () => (
  <>
    {[1, 2, 3, 4, 5].map((i) => (
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
    ))}
  </>
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

  const iniciarEdicaoInline = (e, id, field, currentValue) => {
      e.stopPropagation();
      setEditingCell({ id, field, value: currentValue || '' });
  };

  const salvarEdicaoInline = async () => {
      if (!editingCell.id) return;
      const { id, field, value } = editingCell;

      try {
          if (field === 'precoVenda') {
              const precoNum = parseFloat(value.toString().replace(',', '.'));
              if (isNaN(precoNum) || precoNum < 0) throw new Error("Preço inválido");
              await api.patch(`/produtos/${id}/preco-venda?valor=${precoNum}`);
          } else if (field === 'quantidadeEmEstoque') {
              const qtdNum = parseInt(value, 10);
              if (isNaN(qtdNum) || qtdNum < 0) throw new Error("Quantidade inválida");
              await api.patch(`/produtos/${id}/estoque?quantidade=${qtdNum}`);
          }

          toast.success("Atualizado com sucesso!", { autoClose: 1000, hideProgressBar: true });
          carregarProdutos(page, termoBusca);
      } catch (error) {
          toast.error(error.message === "Preço inválido" || error.message === "Quantidade inválida" ? error.message : "Erro ao salvar alteração rápida.");
      } finally {
          setEditingCell({ id: null, field: null, value: '' });
      }
  };

  const handleInlineKeyDown = (e) => {
      if (e.key === 'Enter') salvarEdicaoInline();
      if (e.key === 'Escape') setEditingCell({ id: null, field: null, value: '' });
  };

  const handleImportar = async (e) => {
      const file = e.target.files[0]; if (!file) return; e.target.value = null;
      const formData = new FormData(); formData.append("arquivo", file);
      const toastId = toast.loading("Importando base de dados...");
      try {
        const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        if (response.data.sucesso) { toast.update(toastId, { render: "Importação concluída com sucesso!", type: "success", isLoading: false, autoClose: 4000 }); setPage(0); carregarProdutos(0, ''); }
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
        try { if (isDelete) await produtoService.excluir(prod.codigoBarras); else await produtoService.restaurar(prod.codigoBarras); toast.success("Operação realizada com sucesso."); carregarProdutos(isDelete ? page : 0, termoBusca); }
        catch (e) { toast.error("Falha ao executar ação."); }
      }
    });
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try { const zpl = await produtoService.imprimirEtiqueta(id); const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${zpl}</pre>`); w.document.close(); }
    catch (e) { toast.error("Erro na impressão."); } finally { setLoadingPrint(null); }
  };

  // 🔥 LÓGICA REFINADA PARA IMPASSES DA IA 🔥
  const handleQuickFix = (tipo, mensagemConfirmacao, nomeCorrecao) => {
      if ((tipo === 'SEM_CUSTO' || tipo === 'PRECO_VENDA_ZERADO') && raioXIa.semCusto > 0 && raioXIa.semCusto === raioXIa.precoVendaZerado) {
           toast.warn("Impasse Matemático: Não é possível usar a IA porque tanto a Venda quanto o Custo estão a R$ 0,00. Edite manualmente na tabela primeiro.", { autoClose: 6000, theme: "colored" });
           handleFiltroChange('precoZerado', true);
           return;
      }

      setConfirmModal({
        isOpen: true, type: 'robot', title: `Ação Automática: ${nomeCorrecao}`, message: mensagemConfirmacao, confirmText: 'Aplicar',
        onConfirm: async () => {
          const toastId = toast.loading(`🤖 O Robô está a aplicar: ${nomeCorrecao}...`);
          try {
            const res = await api.post(`/produtos/quick-fix-ia/${tipo}`);

            if (res.data.qtdCorrigidos > 0) {
                toast.update(toastId, { render: `Sucesso! ${res.data.qtdCorrigidos} produtos corrigidos.`, type: "success", isLoading: false, autoClose: 4000 });
            } else {
                toast.update(toastId, { render: `Nenhuma ação tomada. Verifique se os produtos necessitam de valores inseridos manualmente.`, type: "info", isLoading: false, autoClose: 5000 });
                if(tipo === 'SEM_CUSTO' || tipo === 'PRECO_VENDA_ZERADO') handleFiltroChange('precoZerado', true);
            }

            if (res.data && res.data.zpl) {
                const w = window.open('', '_blank', 'width=500,height=500');
                w.document.write(`<pre>${res.data.zpl}</pre>`); w.document.close();
            }

            carregarProdutos(page, termoBusca);
          } catch (e) {
              toast.update(toastId, { render: "Falha na comunicação com o servidor.", type: "error", isLoading: false, autoClose: 3000 });
          }
        }
      });
  };

  const handleCorrigirNcms = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'Auditoria Fiscal', message: 'O sistema irá varrer a base de dados para corrigir NCMs baseando-se na inteligência fiscal.', confirmText: 'Iniciar Correção',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Analisando NCMs...");
        try { const res = await api.post('/produtos/corrigir-ncms-ia'); toast.update(toastId, { render: `Auditoria Concluída! ${res.data.qtdCorrigidos || 0} corrigidos.`, type: "success", isLoading: false, autoClose: 4000 }); carregarProdutos(page, termoBusca); }
        catch (e) { toast.update(toastId, { render: "Erro na auditoria fiscal.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  const handleCorrigirEANsInternos = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'Normalização EAN', message: 'Deseja recalcular e padronizar o dígito verificador GS1 para todos os códigos internos?', confirmText: 'Corrigir Base',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Recalculando códigos...");
        try { const res = await api.post('/produtos/corrigir-eans-internos-ia'); toast.update(toastId, { render: `Normalização Concluída! ${res.data.qtdCorrigidos || 0} EANs ajustados.`, type: "success", isLoading: false, autoClose: 4000 }); carregarProdutos(page, termoBusca); }
        catch (e) { toast.update(toastId, { render: "Erro no recálculo.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  const abrirModalDivergencia = async () => {
    const toastId = toast.loading("Listando produtos sinalizados...");
    try {
        const response = await api.get('/produtos/divergencias-gondola');
        setDivergentProducts(response.data); setShowDivergenceModal(true); toast.dismiss(toastId);
    } catch (e) { toast.update(toastId, { render: "Erro de comunicação.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  const resolverItemDivergente = async (id) => {
      const preco = newPrices[id];
      if (!preco || isNaN(preco) || preco <= 0) { toast.error("Insira um novo preço válido."); return; }
      const toastId = toast.loading("Gravando e preparando impressão...");
      try {
          const res = await api.post(`/produtos/${id}/resolver-divergencia?novoPreco=${preco}`);
          toast.update(toastId, { render: "Preço atualizado na base!", type: "success", isLoading: false, autoClose: 2000 });
          if (res.data && res.data.zpl) { const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${res.data.zpl}</pre>`); w.document.close(); }
          setDivergentProducts(prev => prev.filter(p => p.id !== id)); carregarProdutos(page, termoBusca);
      } catch (e) { toast.update(toastId, { render: "Erro na atualização.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  return (
    <>
      <div className="modern-layout-container fade-in">
        {/* CABEÇALHO */}
        <header className="page-header-modern">
          <div className="header-titles">
            <h1 className="title-gradient">{modoLixeira ? 'Lixeira de Produtos' : 'Catálogo e Inventário'}</h1>
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
              <button className="btn-primary-shadow" onClick={() => navigate('/produtos/novo')}>
                <Plus size={18} strokeWidth={3} /> <span>Novo Produto</span>
              </button>
            )}
          </div>
        </header>

        {/* DASHBOARD IA (GLASSMORPHISM) */}
        {!modoLixeira && (
          <div className="ai-dashboard-premium">
            <div className="ai-header-row">
              <div className="ai-title-wrapper">
                <div className="ai-pulse-ring"><Bot size={24} className="text-white" /></div>
                <div>
                  <h3 className="ai-title">Assistente de Catálogo Inteligente</h3>
                  <p className="ai-subtitle">Deteção automática de anomalias financeiras e fiscais.</p>
                </div>
              </div>

              <div className="ai-buttons-group">
                 <button className="btn-glass-outline" onClick={handleCorrigirEANsInternos} title="Verifica padrões GS1">
                     <Barcode size={16}/> <span>Corrigir EANs</span>
                 </button>
                 <button className="btn-glass-outline" onClick={handleCorrigirNcms} title="Aplica regras fiscais via IA">
                     <Zap size={16}/> <span>Corrigir NCMs</span>
                 </button>
              </div>
            </div>

            {raioXIa.totalAnomalias > 0 ? (
              <div className="ai-cards-container">
                 {raioXIa.semCusto > 0 && (
                   <div className="ai-anomaly-card warning">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><AlertCircle size={14}/> {raioXIa.semCusto} Itens</span>
                       <span className="anomaly-title">Custo Ausente</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('SEM_CUSTO', 'Deduzir custo baseado em 50% do valor de venda cadastrado?', 'Deduzir Custos')}>
                         Calcular Automaticamente
                     </button>
                   </div>
                 )}

                 {raioXIa.precoVendaZerado > 0 && (
                   <div className="ai-anomaly-card danger">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><AlertTriangle size={14}/> {raioXIa.precoVendaZerado} Itens</span>
                       <span className="anomaly-title">Venda Zerada</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('PRECO_VENDA_ZERADO', 'Aplicar margem de 50% sobre os custos de fornecedor cadastrados?', 'Aplicar Margem')}>
                         Gerar Preço de Venda
                     </button>
                   </div>
                 )}

                 {(raioXIa.semNcm > 0 || raioXIa.ncmInvalido > 0) && (
                   <div className="anomaly-card primary">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><Zap size={14}/> {raioXIa.semNcm + raioXIa.ncmInvalido} Itens</span>
                       <span className="anomaly-title">NCM Pendente</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('SEM_NCM', 'Aplicar NCM Genérico Cosmético (3304.99.90)?', 'Aplicar Padrão')}>
                         Usar Padrão SEFAZ
                     </button>
                   </div>
                 )}

                 {raioXIa.semMarca > 0 && (
                   <div className="anomaly-card purple">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><Box size={14}/> {raioXIa.semMarca} Itens</span>
                       <span className="anomaly-title">Marca Ausente</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('SEM_MARCA', 'Atribuir a classificação DIVERSOS a estes itens?', 'Padronizar Marca')}>
                         Agrupar Diversos
                     </button>
                   </div>
                 )}

                 {raioXIa.divergenciaGondola > 0 && (
                   <div className="anomaly-card pink">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><Search size={14}/> {raioXIa.divergenciaGondola} Alertas</span>
                       <span className="anomaly-title">Divergência Física</span>
                     </div>
                     <button className="btn-fix-action solid" onClick={abrirModalDivergencia}>
                         Analisar e Reimprimir
                     </button>
                   </div>
                 )}
              </div>
            ) : (
              <div className="ai-success-bar">
                <Check size={18} /> Monitoramento Inteligente: Base de dados auditada e sem inconsistências.
              </div>
            )}
          </div>
        )}

        <div className="data-card-modern">
          <div className="toolbar-modern">
            <SearchBar onSearch={setTermoBusca} />

            <div className="toolbar-actions">
                <button className={`btn-icon-soft ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)} title="Mostrar filtros avançados">
                  <Filter size={18}/>
                </button>

                {!modoLixeira && (
                   <>
                     <button className="btn-icon-soft text-green" onClick={() => handleExportar('excel')} title="Exportar para Excel">
                       <FileSpreadsheet size={18}/>
                     </button>
                     <div className="divider-v"></div>
                     <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                     <button className="btn-icon-text" onClick={() => fileInputRef.current.click()} title="Importação em massa">
                       <Upload size={18}/> <span>Importar Base</span>
                     </button>
                   </>
                )}
            </div>
          </div>

          {!modoLixeira && (
            <div className="filters-row-scrollable">
                <span className="filter-label">Visualizar:</span>
                <button className={`chip ${filtros.estoque === 'todos' && !filtros.revisaoPendente && !filtros.semImagem && !filtros.precoZerado ? 'active' : ''}`} onClick={limparFiltros}>
                    Tudo
                </button>
                <button className={`chip danger ${filtros.estoque === 'zerado' ? 'active' : ''}`} onClick={() => handleFiltroChange('estoque', 'zerado')}>
                    Estoque Zerado
                </button>
                <button className={`chip warning ${filtros.estoque === 'baixo' ? 'active' : ''}`} onClick={() => handleFiltroChange('estoque', 'baixo')}>
                    Estoque Crítico
                </button>
                <button className={`chip danger ${filtros.revisaoPendente ? 'active' : ''}`} onClick={() => handleFiltroChange('revisaoPendente', true)}>
                    Alerta Revisão
                </button>
                <button className={`chip warning ${filtros.precoZerado ? 'active' : ''}`} onClick={() => handleFiltroChange('precoZerado', true)}>
                    Sem Preço Definido
                </button>
            </div>
          )}

          <div className="table-responsive sticky-header-wrapper custom-scrollbar">
            <table className="ux-table">
              <thead>
                <tr>
                  <th className="checkbox-cell" width="40px"><input type="checkbox" onChange={handleSelectAll} checked={produtos.length > 0 && selectedIds.length === produtos.length}/></th>
                  <th width="35%">Identificação do Produto</th>
                  <th className="hide-mobile" width="15%">Marca / Fornecedor</th>
                  <th width="15%">Preço Retalho <span className="tooltip-icon" title="Duplo clique numa linha para editar"><Edit2 size={12}/></span></th>
                  <th width="15%">Inventário <span className="tooltip-icon" title="Duplo clique numa linha para editar"><Edit2 size={12}/></span></th>
                  <th className="hide-mobile" width="10%">Status</th>
                  <th className="align-right" width="10%">Gerir</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (<TableSkeleton />) : produtos.length === 0 ? (
                    <tr>
                        <td colSpan="7" className="empty-state-modern">
                            <div className="empty-icon-wrapper"><Box size={40} /></div>
                            <h3>Sem resultados para exibir</h3>
                            <p>Os critérios de pesquisa atuais não devolveram nenhum produto.</p>
                            {(termoBusca || filtros.estoque !== 'todos' || filtros.revisaoPendente || filtros.semImagem || filtros.precoZerado) && (
                                <button className="btn-clear-filters" onClick={() => { setTermoBusca(''); limparFiltros(); }}>
                                    <RotateCcw size={16}/> Limpar Pesquisa e Filtros
                                </button>
                            )}
                        </td>
                    </tr>
                  ) : (
                    produtos.map((prod) => {
                      const isSelected = selectedIds.includes(prod.id);
                      return (
                        <tr key={prod.id} className={`ux-table-row ${isSelected ? 'selected' : ''}`} onClick={() => handleSelectOne(prod.id)}>

                          <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} />
                          </td>

                          <td className="product-main-cell">
                            <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} onZoom={setZoomedImage} />
                            <div className="product-info-modern">
                                <h4 className="product-title-modern">
                                  {prod.descricao}
                                  {prod.revisaoPendente && <span className="badge-urgent-mini">Rever</span>}
                                </h4>
                                <CopyableCode code={prod.codigoBarras} />
                                <span className="mobile-only-info text-muted">{prod.marca || 'S/ Marca'}</span>
                            </div>
                          </td>

                          <td className="hide-mobile text-muted font-medium">{prod.marca || 'Não classificado'}</td>

                          <td className="font-numeric editable-cell-modern" onDoubleClick={(e) => iniciarEdicaoInline(e, prod.id, 'precoVenda', prod.precoVenda)}>
                              {editingCell.id === prod.id && editingCell.field === 'precoVenda' ? (
                                  <div className="inline-edit-wrapper">
                                    <span className="currency-prefix">R$</span>
                                    <input
                                      autoFocus
                                      type="number"
                                      step="0.01"
                                      className="inline-input"
                                      value={editingCell.value}
                                      onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                                      onBlur={salvarEdicaoInline}
                                      onKeyDown={handleInlineKeyDown}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                              ) : (
                                  <div className="editable-content-display">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda || 0)}
                                  </div>
                              )}
                          </td>

                          <td className="editable-cell-modern" onDoubleClick={(e) => iniciarEdicaoInline(e, prod.id, 'quantidadeEmEstoque', prod.quantidadeEmEstoque)}>
                              {editingCell.id === prod.id && editingCell.field === 'quantidadeEmEstoque' ? (
                                  <div className="inline-edit-wrapper">
                                    <input
                                      autoFocus
                                      type="number"
                                      className="inline-input text-center"
                                      value={editingCell.value}
                                      onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                                      onBlur={salvarEdicaoInline}
                                      onKeyDown={handleInlineKeyDown}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="unit-suffix">un</span>
                                  </div>
                              ) : (
                                  <div className="editable-content-display">
                                      <StockHealthBar estoque={prod.quantidadeEmEstoque || 0} minimo={prod.estoqueMinimo || 5} />
                                  </div>
                              )}
                          </td>

                          <td className="hide-mobile"><StatusIndicator prod={prod} /></td>

                          <td className="align-right actions-cell" onClick={(e) => e.stopPropagation()}>
                              {modoLixeira ? (
                                <button className="btn-restore-modern" onClick={() => handleSingleAction('restore', prod)}>
                                   <RotateCcw size={16}/> <span>Restaurar</span>
                                </button>
                              ) : (
                                <ActionMenu prod={prod} onEdit={(id) => navigate(`/produtos/editar/${id}`)} onDelete={(p) => handleSingleAction('delete', p)} onPrint={handlePrint} onHistory={(id) => navigate(`/produtos/historico/${id}`)} loadingPrint={loadingPrint} />
                              )}
                          </td>
                        </tr>
                      );
                    })
                  )}
              </tbody>
            </table>
          </div>

          {/* 🔥 ADIÇÃO CRÍTICA: PAGINAÇÃO 🔥 */}
          {!loading && produtos.length > 0 && (
             <Pagination page={page} totalPages={totalPages} setPage={setPage} />
          )}

        </div>
      </div>

      {confirmModal.isOpen && (
        <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            confirmText={confirmModal.confirmText}
            onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }}
            onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))}
            isDanger={confirmModal.type === 'danger'}
        />
      )}

      {zoomedImage && (
        <div className="lightbox-overlay fade-in" onClick={() => setZoomedImage(null)}>
            <div className="lightbox-content">
               <button onClick={() => setZoomedImage(null)} className="lightbox-close"><X size={28}/></button>
               <img src={zoomedImage} alt="Visualização em tamanho grande" />
            </div>
        </div>
      )}

      {showDivergenceModal && (
          <div className="modal-overlay">
             <div className="modal-content-modern slide-up">
                <div className="modal-header">
                   <h2><AlertTriangle className="text-pink" /> Analisar Divergências Físicas</h2>
                   <button onClick={() => setShowDivergenceModal(false)} className="btn-close-modal"><X size={24}/></button>
                </div>

                <div className="modal-body custom-scrollbar">
                    {divergentProducts.length === 0 ? (
                        <div className="empty-state-mini">
                           <Check size={32} className="text-success mb-2" />
                           <p>Não há mais divergências para resolver.</p>
                        </div>
                    ) : (
                        <div className="divergence-list">
                            {divergentProducts.map(p => (
                                <div key={p.id} className="divergence-card">
                                    <div className="divergence-info">
                                        <strong className="div-title">{p.descricao}</strong>
                                        <span className="div-ean"><Barcode size={14}/> {p.codigoBarras}</span>
                                        <div className="div-old-price">Preço no Sistema: <b>R$ {p.precoVenda?.toFixed(2)}</b></div>
                                    </div>
                                    <div className="divergence-action">
                                        <div className="input-prefix-wrapper">
                                            <span>R$</span>
                                            <input
                                                type="number"
                                                placeholder="Preço da Etiqueta"
                                                className="input-new-price"
                                                onChange={(e) => setNewPrices(prev => ({...prev, [p.id]: e.target.value}))}
                                            />
                                        </div>
                                        <button onClick={() => resolverItemDivergente(p.id)} className="btn-save-print">
                                            <Printer size={16} /> Salvar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
             </div>
          </div>
      )}
    </>
  );
};

export default ProdutoList;