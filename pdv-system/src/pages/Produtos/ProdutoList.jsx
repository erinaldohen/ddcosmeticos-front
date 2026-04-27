import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import api from '../../services/api';
import { produtoService } from '../../services/produtoService';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import {
  Search, Plus, Edit3, Trash2, Box, ChevronLeft, ChevronRight, Zap, Printer, History, X,
  RotateCcw, ImageOff, Filter, XCircle, Copy, Check, Upload, FileText, FileSpreadsheet,
  Bot, AlertTriangle, Barcode, ChevronDown, ZoomIn, Edit2
} from 'lucide-react';
import './ProdutoList.css';

// =========================================================================
// 🧩 COMPONENTES AUXILIARES
// =========================================================================

const SearchBar = ({ onSearch }) => {
  const [localTerm, setLocalTerm] = useState('');
  useEffect(() => { const handler = setTimeout(() => { onSearch(localTerm); }, 500); return () => clearTimeout(handler); }, [localTerm, onSearch]);
  return (
    <div className="input-group">
      <Search className="input-icon" size={18} />
      <input type="text" placeholder="Pesquisar produto, marca ou EAN..." value={localTerm} onChange={(e) => setLocalTerm(e.target.value)} />
      {localTerm && <button className="clear-btn" onClick={() => setLocalTerm('')}><X size={14}/></button>}
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
    e.stopPropagation(); if (!code) return; navigator.clipboard.writeText(code); setCopied(true);
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
            <button className="btn-manage" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>Gerenciar <ChevronDown size={16} /></button>
            {isOpen && (
                <div className="action-dropdown fade-in-fast">
                    <button className="dropdown-item primary" onClick={(e) => handleAction(e, () => onEdit(prod.id))}><Edit3 size={18} /> <span>Editar Produto</span></button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item" onClick={(e) => handleAction(e, () => onPrint(prod.id))} disabled={loadingPrint === prod.id}>
                        {loadingPrint === prod.id ? <div className="spinner-micro dark"></div> : <Printer size={18} />} <span>Imprimir Etiqueta</span>
                    </button>
                    <button className="dropdown-item" onClick={(e) => handleAction(e, () => onHistory(prod.id))}><History size={18} /> <span>Ver Histórico</span></button>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item text-danger" onClick={(e) => handleAction(e, () => onDelete(prod))}><Trash2 size={18} /> <span>Mover para Lixeira</span></button>
                </div>
            )}
        </div>
    );
};

// 🔥 NOVO: Barra de Saúde do Estoque
const StockHealthBar = ({ estoque, minimo }) => {
    const maxBar = minimo > 0 ? minimo * 3 : 20; // Uma estimativa para o "cheio"
    const percent = Math.min(100, Math.max(0, (estoque / maxBar) * 100));

    let colorClass = 'bg-emerald-500';
    if (estoque === 0) colorClass = 'bg-rose-500';
    else if (estoque <= minimo) colorClass = 'bg-amber-500';

    return (
        <div className="stock-health-container" title={`Mínimo exigido: ${minimo || 5}`}>
            <div className="stock-health-text">
                <span className={`stock-number ${estoque <= minimo ? 'text-danger' : ''}`}>{estoque} un.</span>
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

  // 🔥 ESTADOS DA EDIÇÃO INLINE (MODO EXCEL) 🔥
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
  const marcasDisponiveis = useMemo(() => Array.from(new Set(produtos.map(p => p.marca).filter(Boolean))).sort(), [produtos]);
  const categoriasDisponiveis = useMemo(() => Array.from(new Set(produtos.map(p => p.categoria).filter(Boolean))).sort(), [produtos]);

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

  // 🔥 LÓGICA DE EDIÇÃO INLINE (MODO EXCEL) 🔥
  const iniciarEdicaoInline = (e, id, field, currentValue) => {
      e.stopPropagation(); // Evita selecionar a linha da tabela
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

          toast.success("Atualizado rapidamente!", { autoClose: 1000, hideProgressBar: true });
          carregarProdutos(page, termoBusca); // Recarrega para mostrar o novo valor
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

  // Funções de Import/Export mantidas...
  const handleImportar = async (e) => {
      const file = e.target.files[0]; if (!file) return; e.target.value = null;
      const formData = new FormData(); formData.append("arquivo", file);
      const toastId = toast.loading("Importando base de dados...");
      try {
        const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        if (response.data.sucesso) { toast.update(toastId, { render: "Importação fail-safe concluída!", type: "success", isLoading: false, autoClose: 4000 }); setPage(0); carregarProdutos(0, ''); }
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
        try { if (isDelete) await produtoService.excluir(prod.codigoBarras); else await produtoService.restaurar(prod.codigoBarras); toast.success("Sucesso."); carregarProdutos(isDelete ? page : 0, termoBusca); }
        catch (e) { toast.error("Falha."); }
      }
    });
  };

  const handlePrint = async (id) => {
    setLoadingPrint(id);
    try { const zpl = await produtoService.imprimirEtiqueta(id); const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${zpl}</pre>`); w.document.close(); }
    catch (e) { toast.error("Erro na impressão."); } finally { setLoadingPrint(null); }
  };

  const handleQuickFix = (tipo, mensagemConfirmacao, nomeCorrecao) => {
      setConfirmModal({
        isOpen: true, type: 'robot', title: `Resolução Inteligente: ${nomeCorrecao}`, message: mensagemConfirmacao, confirmText: 'Aplicar e Resolver',
        onConfirm: async () => {
          const toastId = toast.loading(`🤖 Aplicando: ${nomeCorrecao}...`);
          try {
            const res = await api.post(`/produtos/quick-fix-ia/${tipo}`);

            // 🔥 LÓGICA DE FEEDBACK HONESTA IMPLEMENTADA AQUI
            if (res.data.qtdCorrigidos > 0) {
                toast.update(toastId, {
                    render: `Resolvido! ${res.data.qtdCorrigidos} produtos atualizados com sucesso.`,
                    type: "success",
                    isLoading: false,
                    autoClose: 4000
                });
            } else {
                let motivo = "Nenhum produto precisava de correção.";
                if (tipo === 'SEM_CUSTO' || tipo === 'PRECO_VENDA_ZERADO') {
                    motivo = "Impasse detetado: Custo e Venda estão ambos a R$ 0,00. Digite um dos valores na tabela primeiro!";
                }

                toast.update(toastId, {
                    render: `Aviso: ${motivo}`,
                    type: "warning",
                    isLoading: false,
                    autoClose: 6000
                });
            }

            // Se houver ZPL (da divergência de gôndola), imprime
            if (res.data && res.data.zpl) {
                const w = window.open('', '_blank', 'width=500,height=500');
                w.document.write(`<pre>${res.data.zpl}</pre>`);
                w.document.close();
            }

            carregarProdutos(page, termoBusca);
          } catch (e) {
              toast.update(toastId, { render: "Falha na comunicação com o robô.", type: "error", isLoading: false, autoClose: 3000 });
          }
        }
      });
    };

  // 🔥 RESTAURAÇÃO DOS BOTÕES MANUAIS DE SANEAMENTO 🔥
  const handleCorrigirNcms = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'Auditoria Fiscal IA', message: 'O Robô irá corrigir NCMs inválidos em toda a base.', confirmText: 'Iniciar Auditoria',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Analisando...");
        try { const res = await api.post('/produtos/corrigir-ncms-ia'); toast.update(toastId, { render: `Concluído! ${res.data.qtdCorrigidos || 0} NCMs corrigidos.`, type: "success", isLoading: false, autoClose: 4000 }); carregarProdutos(page, termoBusca); }
        catch (e) { toast.update(toastId, { render: "Erro na auditoria.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  const handleCorrigirEANsInternos = () => {
    setConfirmModal({
      isOpen: true, type: 'robot', title: 'Matemática GS1', message: 'Recalcular o dígito verificador de todos os códigos de barra?', confirmText: 'Corrigir EANs',
      onConfirm: async () => {
        const toastId = toast.loading("🤖 Calculando...");
        try { const res = await api.post('/produtos/corrigir-eans-internos-ia'); toast.update(toastId, { render: `Concluído! ${res.data.qtdCorrigidos || 0} EANs ajustados.`, type: "success", isLoading: false, autoClose: 4000 }); carregarProdutos(page, termoBusca); }
        catch (e) { toast.update(toastId, { render: "Erro no cálculo.", type: "error", isLoading: false, autoClose: 3000 }); }
      }
    });
  };

  const abrirModalDivergencia = async () => {
    const toastId = toast.loading("Buscando produtos divergentes...");
    try {
        const response = await api.get('/produtos/divergencias-gondola');
        setDivergentProducts(response.data); setShowDivergenceModal(true); toast.dismiss(toastId);
    } catch (e) { toast.update(toastId, { render: "Erro ao buscar.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  const resolverItemDivergente = async (id) => {
      const preco = newPrices[id];
      if (!preco || isNaN(preco) || preco <= 0) { toast.error("Insira um valor válido."); return; }
      const toastId = toast.loading("Salvando e gerando etiqueta...");
      try {
          const res = await api.post(`/produtos/${id}/resolver-divergencia?novoPreco=${preco}`);
          toast.update(toastId, { render: "Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
          if (res.data && res.data.zpl) { const w = window.open('', '_blank', 'width=500,height=500'); w.document.write(`<pre>${res.data.zpl}</pre>`); w.document.close(); }
          setDivergentProducts(prev => prev.filter(p => p.id !== id)); carregarProdutos(page, termoBusca);
      } catch (e) { toast.update(toastId, { render: "Erro ao atualizar.", type: "error", isLoading: false, autoClose: 3000 }); }
  };

  return (
    <>
      <div className="modern-layout-container fade-in">
        <header className="page-header">
          <div className="header-titles">
            <h1 className="title-gradient">{modoLixeira ? 'Lixeira de Produtos' : 'Gestão de Inventário'}</h1>
            <p className="subtitle">{totalElements} itens encontrados na sua base de dados</p>
          </div>

          <div className="header-buttons-main">
            <div className="tab-switcher">
              <button className={`tab-btn ${!modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(false)}>Catálogo</button>
              <button className={`tab-btn ${modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(true)}>
                Lixeira {qtdLixeira > 0 && <span className="ping-dot"></span>}
              </button>
            </div>

            {!modoLixeira && (
              <button className="btn-primary-glow" onClick={() => navigate('/produtos/novo')} style={{ width: window.innerWidth <= 768 ? '100%' : 'auto' }}>
                <Plus size={20} /> <span>Cadastrar Produto</span>
              </button>
            )}
          </div>
        </header>

        {!modoLixeira && (
          <div className="ai-dashboard-glass" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="ai-info" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div className="ai-icon-pulse"><Bot size={28} /></div>
                <div>
                  <h3>Auditoria de Catálogo Guiada por IA</h3>
                  <p>Anomalias e alertas que necessitam da sua atenção.</p>
                </div>
              </div>

              {/* 🔥 BOTÕES RESTAURADOS AQUI 🔥 */}
              <div className="ai-actions-grid" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <button className="btn-outline-ai" onClick={handleCorrigirEANsInternos}><Barcode size={18}/> <span>Saneamento EAN</span></button>
                 <button className="btn-outline-ai" onClick={handleCorrigirNcms}><Zap size={18}/> <span>Auditoria Fiscal (NCM)</span></button>
              </div>
            </div>

            {raioXIa.totalAnomalias > 0 ? (
              <div className="ai-anomalies-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>

                 {raioXIa.semCusto > 0 && (
                   <div className="anomaly-card" style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                       <strong style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16}/> Sem Custo: {raioXIa.semCusto}</strong>
                     </div>
                     <button onClick={() => handleQuickFix('SEM_CUSTO', 'A IA vai deduzir o custo calculando 50% do valor da Venda. Continuar?', 'Deduzir Custo')} style={{ width: '100%', padding: '6px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Deduzir pela Venda ✨</button>
                   </div>
                 )}

                 {raioXIa.precoVendaZerado > 0 && (
                   <div className="anomaly-card" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                       <strong style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16}/> Venda a R$ 0,00: {raioXIa.precoVendaZerado}</strong>
                     </div>
                     <button onClick={() => handleQuickFix('PRECO_VENDA_ZERADO', 'A IA vai aplicar +50% de margem sobre o preço de custo. Continuar?', 'Aplicar Margem')} style={{ width: '100%', padding: '6px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Aplicar Margem 50% ✨</button>
                   </div>
                 )}

                 {(raioXIa.semNcm > 0 || raioXIa.ncmInvalido > 0) && (
                   <div className="anomaly-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                       <strong style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={16}/> NCM Inválido: {(raioXIa.semNcm + raioXIa.ncmInvalido)}</strong>
                     </div>
                     <button onClick={() => handleQuickFix('SEM_NCM', 'A IA vai aplicar o NCM Genérico (33049990) e Monofásico (CST 04). Continuar?', 'NCM Padrão')} style={{ width: '100%', padding: '6px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Usar Genérico ✨</button>
                   </div>
                 )}

                 {raioXIa.semMarca > 0 && (
                   <div className="anomaly-card" style={{ background: '#f5f3ff', border: '1px solid #e9d5ff', padding: '12px', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                       <strong style={{ color: '#9333ea', display: 'flex', alignItems: 'center', gap: '6px' }}><Box size={16}/> Sem Marca: {raioXIa.semMarca}</strong>
                     </div>
                     <button onClick={() => handleQuickFix('SEM_MARCA', 'A IA vai preencher a marca com "DIVERSOS". Continuar?', 'Marca Padrão')} style={{ width: '100%', padding: '6px', background: '#a855f7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Classificar DIVERSOS ✨</button>
                   </div>
                 )}

                 {raioXIa.divergenciaGondola > 0 && (
                   <div className="anomaly-card" style={{ background: '#fdf2f8', border: '1px solid #fbcfe8', padding: '12px', borderRadius: '8px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 8px 0' }}>
                       <strong style={{ color: '#db2777', display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <Search size={16}/> Divergência Loja: {raioXIa.divergenciaGondola}
                       </strong>
                     </div>
                     <p style={{fontSize: '0.8rem', color: '#831843', margin: '0 0 8px 0', lineHeight: '1.2'}}>Alertas disparados do telemóvel.</p>
                     <button onClick={abrirModalDivergencia} style={{ width: '100%', padding: '6px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                       Ajustar e Imprimir 🖨️
                     </button>
                   </div>
                 )}

              </div>
            ) : (
              <div style={{ padding: '12px', background: '#dcfce7', color: '#166534', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={20} /> O seu catálogo está 100% íntegro. Nenhuma anomalia crítica encontrada!
              </div>
            )}
          </div>
        )}

        <div className="data-card">
          <div className="data-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <SearchBar onSearch={setTermoBusca} />
                <div className="toolbar-right">
                    <button className={`btn-outline ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                      <Filter size={18}/> <span>Filtros</span>
                    </button>

                    {!modoLixeira && (
                       <div className="catalog-actions-group">
                         <button className="btn-modern-export green" onClick={() => handleExportar('excel')} title="Baixar planilha Excel">
                           <FileSpreadsheet size={18}/> <span className="hide-mobile">Baixar Excel</span>
                         </button>
                         <button className="btn-modern-export purple" onClick={() => handleExportar('csv')} title="Baixar ficheiro CSV">
                           <FileText size={18}/> <span className="hide-mobile">Baixar CSV</span>
                         </button>

                         <div className="action-divider"></div>

                         <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                         <button className="btn-modern-import" onClick={() => fileInputRef.current.click()} title="Importar novos produtos">
                           <Upload size={18}/> <span className="hide-mobile">Importar Planilha</span>
                         </button>
                       </div>
                    )}
                </div>
            </div>

            {!modoLixeira && (
                <div className="smart-chips-container">
                    <span style={{fontSize:'0.85rem', fontWeight:'700', color:'#64748b', marginRight:'8px'}}>Acesso Rápido:</span>
                    <button className={`smart-chip ${filtros.estoque === 'todos' && !filtros.revisaoPendente && !filtros.semImagem ? 'active' : ''}`} onClick={limparFiltros}>
                        Todos
                    </button>
                    <button className={`smart-chip ${filtros.estoque === 'zerado' ? 'active-danger' : ''}`} onClick={() => handleFiltroChange('estoque', 'zerado')}>
                        Estoque Zerado
                    </button>
                    <button className={`smart-chip ${filtros.estoque === 'baixo' ? 'active-warning' : ''}`} onClick={() => handleFiltroChange('estoque', 'baixo')}>
                        Estoque Baixo
                    </button>
                    <button className={`smart-chip ${filtros.revisaoPendente ? 'active-danger' : ''}`} onClick={() => handleFiltroChange('revisaoPendente', true)}>
                        Pendentes de Revisão
                    </button>
                    <button className={`smart-chip ${filtros.semImagem ? 'active-info' : ''}`} onClick={() => handleFiltroChange('semImagem', true)}>
                        Sem Imagem
                    </button>
                </div>
            )}
          </div>

          <div className="table-responsive sticky-header-wrapper">
            <table className="ux-table">
              <thead>
                <tr>
                  <th className="checkbox-cell"><input type="checkbox" onChange={handleSelectAll} checked={produtos.length > 0 && selectedIds.length === produtos.length}/></th>
                  <th>Produto e Detalhes</th>
                  <th className="hide-mobile">Marca</th>
                  <th>Preço de Venda <Edit2 size={12} style={{display:'inline', marginLeft:'4px', color:'#94a3b8'}} title="Duplo clique para editar"/></th>
                  <th>Estoque Físico <Edit2 size={12} style={{display:'inline', marginLeft:'4px', color:'#94a3b8'}} title="Duplo clique para editar"/></th>
                  <th className="hide-mobile">Status</th>
                  <th className="align-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (<TableSkeleton />) : produtos.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state"><Box size={48} /><h3>Nenhum resultado para a sua pesquisa</h3></td></tr>
                  ) : (
                    produtos.map((prod) => {
                      const isSelected = selectedIds.includes(prod.id);
                      return (
                        <tr key={prod.id} className={`ux-table-row ${isSelected ? 'selected' : ''}`} onClick={() => handleSelectOne(prod.id)}>

                          <td className="checkbox-cell" onClick={(e) => e.stopPropagation()} data-label="Selecionar">
                              <input type="checkbox" checked={isSelected} onChange={() => handleSelectOne(prod.id)} />
                          </td>

                          <td className="product-main-cell" data-label="Produto">
                            <ProductImage src={getImageUrl(prod.urlImagem)} alt={prod.descricao} onZoom={setZoomedImage} />

                            <div className="product-info">
                                <h4 className="product-title">
                                  {prod.descricao}
                                  {prod.revisaoPendente && <span className="tag-urgent">Alerta</span>}
                                </h4>
                                <CopyableCode code={prod.codigoBarras} />
                                <span className="mobile-only-info text-muted">{prod.marca || 'Sem Marca Registada'}</span>
                            </div>
                          </td>

                          <td className="hide-mobile" data-label="Marca">{prod.marca || '-'}</td>

                          <td className="font-numeric price-cell editable-cell" data-label="Preço" onDoubleClick={(e) => iniciarEdicaoInline(e, prod.id, 'precoVenda', prod.precoVenda)}>
                              {editingCell.id === prod.id && editingCell.field === 'precoVenda' ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    className="inline-edit-input"
                                    value={editingCell.value}
                                    onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                                    onBlur={salvarEdicaoInline}
                                    onKeyDown={handleInlineKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                              ) : (
                                  <div className="editable-content" title="Duplo clique para editar">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.precoVenda || 0)}
                                  </div>
                              )}
                          </td>

                          <td data-label="Estoque" className="editable-cell" onDoubleClick={(e) => iniciarEdicaoInline(e, prod.id, 'quantidadeEmEstoque', prod.quantidadeEmEstoque)}>
                              {editingCell.id === prod.id && editingCell.field === 'quantidadeEmEstoque' ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    className="inline-edit-input"
                                    value={editingCell.value}
                                    onChange={(e) => setEditingCell({...editingCell, value: e.target.value})}
                                    onBlur={salvarEdicaoInline}
                                    onKeyDown={handleInlineKeyDown}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                              ) : (
                                  <div className="editable-content" title="Duplo clique para editar">
                                      <StockHealthBar estoque={prod.quantidadeEmEstoque || 0} minimo={prod.estoqueMinimo || 5} />
                                  </div>
                              )}
                          </td>

                          <td className="hide-mobile" data-label="Status"><StatusIndicator prod={prod} /></td>

                          <td className="align-right actions-cell" onClick={(e) => e.stopPropagation()} data-label="Ações">
                              {modoLixeira ? (
                                <button className="btn-restore" onClick={() => handleSingleAction('restore', prod)}>
                                   <RotateCcw size={18}/> Restaurar
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
        </div>
      </div>

      {confirmModal.isOpen && (
        <ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }} onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} isDanger={confirmModal.type === 'danger'} />
      )}

      {zoomedImage && (
        <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => setZoomedImage(null)}>
            <div style={{position:'relative', maxWidth:'90vw', maxHeight:'90vh'}}>
               <button onClick={() => setZoomedImage(null)} style={{position:'absolute', top:'-40px', right:'0', background:'none', border:'none', color:'white', cursor:'pointer'}}><X size={32}/></button>
               <img src={zoomedImage} alt="Zoom" style={{maxWidth:'100%', maxHeight:'85vh', objectFit:'contain', borderRadius:'12px', boxShadow:'0 25px 50px -12px rgba(0, 0, 0, 0.5)'}} />
            </div>
        </div>
      )}

      {showDivergenceModal && (
          <div className="modal-overlay" style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center'}}>
             <div className="modal-content fade-in" style={{background:'white', padding:'24px', borderRadius:'16px', width:'90%', maxWidth:'600px', maxHeight:'80vh', overflowY:'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                   <h2 style={{margin:0, color:'#db2777', display:'flex', alignItems:'center', gap:'8px'}}><AlertTriangle /> Resolução de Divergências</h2>
                   <button onClick={() => setShowDivergenceModal(false)} style={{background:'none', border:'none', cursor:'pointer'}}><X size={24}/></button>
                </div>

                {divergentProducts.length === 0 ? (
                    <p style={{textAlign:'center', color:'#64748b'}}>Nenhuma divergência pendente.</p>
                ) : (
                    <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                        {divergentProducts.map(p => (
                            <div key={p.id} style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:'16px', borderRadius:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px'}}>
                                <div style={{flex:'1 1 250px'}}>
                                    <strong style={{display:'block', fontSize:'1.1rem'}}>{p.descricao}</strong>
                                    <span style={{color:'#64748b', fontSize:'0.9rem'}}>EAN: {p.codigoBarras}</span>
                                    <div style={{color:'#ef4444', fontWeight:'bold', marginTop:'4px'}}>Preço Antigo: R$ {p.precoVenda?.toFixed(2)}</div>
                                </div>
                                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                                    <span style={{fontWeight:'bold'}}>R$</span>
                                    <input
                                        type="number"
                                        placeholder="Novo Preço"
                                        style={{padding:'8px', borderRadius:'6px', border:'1px solid #cbd5e1', width:'100px'}}
                                        onChange={(e) => setNewPrices(prev => ({...prev, [p.id]: e.target.value}))}
                                    />
                                    <button
                                        onClick={() => resolverItemDivergente(p.id)}
                                        style={{background:'#ec4899', color:'white', border:'none', padding:'8px 12px', borderRadius:'6px', fontWeight:'bold', cursor:'pointer'}}
                                    >
                                        Salvar & Imprimir
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          </div>
      )}
    </>
  );
};

export default ProdutoList;