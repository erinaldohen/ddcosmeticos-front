import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
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

// 🔥 O NOVO "JUIZ" DO FRONTEND: Ignora a flag cega do Backend e atua pelos dados reais.
const DiagnosticoAlertas = memo(({ prod }) => {
    const alertas = [];

    // 1. O Frontend inspeciona a integridade real do produto
    const temPrecoVenda = prod.precoVenda && prod.precoVenda > 0;
    const temNcmValido = prod.ncm && prod.ncm.length >= 8 && prod.ncm !== '00000000';
    const temEanValido = prod.codigoBarras && prod.codigoBarras.length >= 8 && prod.codigoBarras !== 'S/N';
    const temImagem = !!prod.urlImagem;

    // Apenas se faltar NCM, Preço ou EAN é que o produto tem uma falha grave
    const possuiFalhaGrave = !temPrecoVenda || !temNcmValido || !temEanValido;

    // 2. Disparo de Alertas Específicos
    if (prod.alertaGondola) {
        alertas.push({ id: 'gondola', texto: "🚨 DIVERGÊNCIA FÍSICA", classe: "badge-divergence-glow" });
    }

    if (!temPrecoVenda) {
        alertas.push({ id: 'preco', texto: "Preço Zerado", classe: "bg-rose-100 text-rose-700 border-rose-200" });
    }

    if (!temNcmValido) {
        alertas.push({ id: 'ncm', texto: "NCM Pendente/Inválido", classe: "bg-amber-100 text-amber-700 border-amber-200" });
    }

    if (!temEanValido) {
        alertas.push({ id: 'ean', texto: "Sem EAN GS1", classe: "bg-orange-100 text-orange-700 border-orange-200" });
    }

    if (!temImagem) {
        alertas.push({ id: 'img', texto: "Sem Imagem", classe: "bg-purple-100 text-purple-700 border-purple-200" });
    }

    // 3. A GRANDE JOGADA: A "Revisão Pendente" só aparece se o backend mandou E o frontend concorda.
    if (prod.revisaoPendente && possuiFalhaGrave && !prod.alertaGondola) {
        alertas.push({ id: 'revisao', texto: "⚠️ Revisão Pendente", classe: "bg-blue-100 text-blue-700 border-blue-200" });
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
});

// ==================================================================================
// 🚀 COMPONENTE PRINCIPAL
// ==================================================================================
export default function ProdutoList() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Estados Base
  const [produtos, setProdutos] = useState([]);
  const [raioXIa, setRaioXIa] = useState({ totalAnomalias: 0, semCusto: 0, precoVendaZerado: 0, semNcm: 0, ncmInvalido: 0, semDescricao: 0, semMarca: 0, divergenciaGondola: 0 });
  const [qtdLixeira, setQtdLixeira] = useState(0);

  // Estados de UI e Modais
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(null);
  const [modoLixeira, setModoLixeira] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [editingCell, setEditingCell] = useState({ id: null, field: null, value: '' });

  // Estados de Divergência
  const [showDivergenceModal, setShowDivergenceModal] = useState(false);
  const [divergentProducts, setDivergentProducts] = useState([]);
  const [newPrices, setNewPrices] = useState({});

  // Paginação e Filtros
  const [filtros, setFiltros] = useState({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, type: 'danger', confirmText: 'Confirmar' });

  // Conta filtros ativos para o Badge UI
  const activeFiltersCount = Object.keys(filtros).filter(k => (typeof filtros[k] === 'boolean' && filtros[k]) || (typeof filtros[k] === 'string' && filtros[k] !== '' && filtros[k] !== 'todos')).length;

  const getImageUrl = useCallback((url) => url ? (url.startsWith('blob:') || url.startsWith('http') ? url : `http://localhost:8080${url}`) : null, []);

  // 🔄 CARREGAMENTO DE DADOS (Otimizado)
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
        let listaProdutos = Array.isArray(dados) ? dados : (dados?.content || dados?.itens || []);

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

  useEffect(() => { if (page !== 0) setPage(0); else carregarProdutos(0, termoBusca); }, [termoBusca, filtros, modoLixeira]);
  useEffect(() => { carregarProdutos(page, termoBusca); }, [page, carregarProdutos]);
  useEffect(() => { setSelectedIds([]); }, [modoLixeira]);

  const handleFiltroChange = (key, value) => { setFiltros(prev => ({ ...prev, [key]: value })); setPage(0); };
  const limparFiltros = () => { setFiltros({ estoque: 'todos', marca: '', categoria: '', semImagem: false, semNcm: false, precoZerado: false, revisaoPendente: false }); setPage(0); };

  const handleSelectAll = (e) => e.target.checked ? setSelectedIds(produtos.map(p => p.id)) : setSelectedIds([]);
  const handleSelectOne = (id) => selectedIds.includes(id) ? setSelectedIds(selectedIds.filter(itemId => itemId !== id)) : setSelectedIds([...selectedIds, id]);

  // 🔥 MÁSCARA BLINDADA PARA EDIÇÃO INLINE
  const applyCurrencyMask = (value) => {
    if (value === undefined || value === null) return '0,00';
    let strVal = value.toString().replace(/\D/g, '');
    if (!strVal || strVal === '') return '0,00';
    strVal = (parseInt(strVal) / 100).toFixed(2);
    strVal = strVal.replace('.', ',');
    strVal = strVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return strVal;
  };

  const handleFocus = (e) => e.target.select();

  const iniciarEdicaoInline = (e, id, field, currentValue) => {
      e.stopPropagation();
      let val = currentValue;
      if (field === 'precoVenda') {
          val = currentValue ? currentValue.toFixed(2).replace('.', ',') : '0,00';
      }
      setEditingCell({ id, field, value: val || '' });
  };

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
            carregarProdutos(page, termoBusca);
        } catch (error) {
            toast.error("Valor inválido. Gravação cancelada.");
        } finally {
            setEditingCell({ id: null, field: null, value: '' });
        }
  }, [editingCell, page, termoBusca, carregarProdutos]);

  const handleInlineKeyDown = (e) => {
      if (e.key === 'Enter') salvarEdicaoInline();
      if (e.key === 'Escape') setEditingCell({ id: null, field: null, value: '' });
  };

  // 🔥 SEGURANÇA: VALIDAÇÃO DE ARQUIVO NO UPLOAD
  const handleImportar = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = null;

      const allowedExt = ['csv', 'xls', 'xlsx', 'xml'];
      const fileExt = file.name.split('.').pop().toLowerCase();
      if (!allowedExt.includes(fileExt)) return toast.error("Arquivo inválido. Envie apenas planilhas ou XML.");
      if (file.size > 5 * 1024 * 1024) return toast.error("O arquivo excede o limite de segurança de 5MB.");

      const formData = new FormData();
      formData.append("arquivo", file);
      const toastId = toast.loading("Importando base de dados...");

      try {
        const response = await api.post('/produtos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
        if (response.data.sucesso) {
            toast.update(toastId, { render: "Importação concluída!", type: "success", isLoading: false, autoClose: 4000 });
            limparFiltros();
        } else {
            throw new Error(response.data.mensagem);
        }
      } catch (error) {
          toast.update(toastId, { render: "Erro ao comunicar com o servidor.", type: "error", isLoading: false, autoClose: 5000 });
      }
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

  const handleSingleAction = (type, prod) => {
    const isDelete = type === 'delete';
    setConfirmModal({
      isOpen: true, type: isDelete ? 'danger' : 'success', title: isDelete ? 'Mover para Lixeira' : 'Restaurar', message: `${isDelete ? 'Inativar' : 'Restaurar'} "${prod.descricao}"?`, confirmText: 'Confirmar',
      onConfirm: async () => {
        try {
            if (isDelete) await produtoService.excluir(prod.codigoBarras);
            else await produtoService.restaurar(prod.codigoBarras);
            toast.success("Sucesso!");
            carregarProdutos(isDelete ? page : 0, termoBusca);
        } catch (e) { toast.error("Ação recusada pelo servidor."); }
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
    } catch (e) { toast.error("Serviço de impressão indisponível."); }
    finally { setLoadingPrint(null); }
  };

  // 🔥 FERRAMENTAS DA IA E AUDITORIA EM MASSA
    const handleQuickFix = (acao, mensagemConfirmacao, nomeCorrecao) => {
        setConfirmModal({
          isOpen: true, type: 'robot', title: `Auditoria: ${nomeCorrecao}`, message: mensagemConfirmacao, confirmText: 'Executar Varredura',
          onConfirm: async () => {
            const toastId = toast.loading(`A varrer a base de dados...`);
            try {
              const response = await api.post(`/produtos/quick-fix-ia/${acao}`);

              // 🔥 A CORREÇÃO: Captura a mensagem real retornada pelo Java!
              // O Backend devolve algo como: "Foram corrigidos 45 NCMs com sucesso."
              let mensagemRetorno = "Correção aplicada com sucesso!";
              if (response.data) {
                  mensagemRetorno = typeof response.data === 'string'
                      ? response.data
                      : (response.data.mensagem || response.data.message || mensagemRetorno);
              }

              toast.update(toastId, { render: String(mensagemRetorno), type: "success", isLoading: false, autoClose: 6000 });

              // Recarrega a tabela imediatamente para exibir as novas etiquetas verdes (corrigidas)
              carregarProdutos(page, termoBusca);
            } catch (e) {
              const msgErro = e.response?.data?.message || e.response?.data || "Falha na comunicação com o servidor.";
              toast.update(toastId, { render: String(msgErro), type: "error", isLoading: false, autoClose: 5000 });
            }
          }
        });
    };

    const handleCorrigirNcms = () => {
      handleQuickFix('CORRIGIR_NCM', 'O sistema irá varrer todos os produtos cadastrados e corrigir NCMs em branco ou inválidos com base nos padrões. Confirmar?', 'Correção Rápida de NCM');
    };

    const handleCorrigirEANsInternos = () => {
      handleQuickFix('NORMALIZAR_EAN', 'Deseja varrer a base para recalcular e padronizar o dígito verificador GS1 para todos os códigos internos?', 'Normalização de EANs');
    };

  // 🔥 MODAL DE DIVERGÊNCIA DE GÔNDOLA
  const abrirModalDivergencia = async () => {
    toast.dismiss();
    const toastId = toast.loading("Extraindo alertas de gôndola...");
    try {
        const response = await api.get('/produtos/divergencias-gondola');
        setDivergentProducts(response.data);
        setShowDivergenceModal(true);
        toast.update(toastId, { render: "Lista carregada!", type: "success", isLoading: false, autoClose: 800 });
    } catch (e) {
        toast.dismiss(toastId); toast.error("Servidor indisponível para esta operação.");
    }
  };

  const resolverItemDivergente = async (id) => {
        const precoStr = newPrices[id];
        if (!precoStr) return toast.error("Informe o preço real da gôndola.");
        const precoFloat = parseFloat(precoStr.replace(/\./g, '').replace(',', '.'));
        if (isNaN(precoFloat) || precoFloat <= 0) return toast.error("Valor bloqueado (Inválido).");

        toast.dismiss();
        const loadId = toast.loading("Aproximando sistema com a gôndola...");

        try {
            await api.post(`/produtos/${id}/resolver-divergencia?novoPreco=${precoFloat}`);
            toast.update(loadId, { render: "Divergência eliminada!", type: "success", isLoading: false, autoClose: 1500 });
            setDivergentProducts(prev => prev.filter(p => p.id !== id));
            carregarProdutos(page, termoBusca);
        } catch (e) {
            toast.dismiss(loadId); toast.error("Não foi possível persistir a correção.");
        }
  };

  const handlePriceMaskForDivergence = (e, id) => {
      setNewPrices(prev => ({...prev, [id]: applyCurrencyMask(e.target.value)}));
  };

  return (
    <>
      <div className="modern-layout-container fade-in">
        <header className="page-header-modern">
          <div className="header-titles">
            <h1 className="title-gradient">{modoLixeira ? 'Lixeira de Produtos' : 'Catálogo de Produtos'}</h1>
            <p className="subtitle text-muted">Gestão integrada • {totalElements} registos</p>
          </div>
          <div className="header-actions-group">
            <div className="tab-switcher-modern">
              <button className={`tab-btn ${!modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(false)}>Base Ativa</button>
              <button className={`tab-btn ${modoLixeira ? 'active' : ''}`} onClick={() => setModoLixeira(true)}>
                Lixeira {qtdLixeira > 0 && <span className="ping-dot-danger"></span>}
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
                 <button className="btn-glass-outline" onClick={handleCorrigirEANsInternos}><Barcode size={16}/> <span>Calcular EANs</span></button>
                 <button className="btn-glass-outline" onClick={handleCorrigirNcms}><Zap size={16}/> <span>Validar NCMs</span></button>
              </div>
            </div>
            {raioXIa.totalAnomalias > 0 ? (
              <div className="ai-cards-container">
                 {raioXIa.precoVendaZerado > 0 && (
                   <div className="ai-anomaly-card danger">
                     <div className="anomaly-header">
                       <span className="anomaly-badge"><AlertTriangle size={14}/> {raioXIa.precoVendaZerado} Falhas</span>
                       <span className="anomaly-title">Venda Zerada Detectada</span>
                     </div>
                     <button className="btn-fix-action" onClick={() => handleQuickFix('PRECO_VENDA_ZERADO', 'Deseja que a IA gere preços de venda automáticos baseados no custo?', 'Ajuste de Margem Seguro')}>Reparar Preços</button>
                   </div>
                 )}
                 {raioXIa.divergenciaGondola > 0 && (
                   <div className="ai-divergence-siren-card slide-up">
                        <div className="siren-content">
                            <div className="siren-icon-wrapper"><AlertTriangle size={24} /></div>
                            <div className="siren-text">
                                <h4>{raioXIa.divergenciaGondola} Alertas Físicos</h4>
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
                <button className={`btn-icon-soft ${showFilters || activeFiltersCount > 0 ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
                    <Filter size={18}/>
                    {activeFiltersCount > 0 && <span className="filter-badge">{activeFiltersCount}</span>}
                </button>
                {!modoLixeira && (
                   <>
                       <button className="btn-icon-soft text-green" onClick={() => handleExportar('excel')} title="Exportar Tabela para Excel"><FileSpreadsheet size={18}/></button>
                       <div className="divider-v"></div>
                       <input type="file" ref={fileInputRef} onChange={handleImportar} accept=".csv, .xls, .xlsx, .xml" style={{display: 'none'}} />
                       <button className="btn-icon-text" onClick={() => fileInputRef.current.click()}><Upload size={18}/> <span className="hide-mobile">Importar Excel</span></button>
                   </>
                )}
            </div>
          </div>

          {/* PAINEL DE FILTROS */}
          {showFilters && (
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
                      <button className="btn-clear-filter" onClick={limparFiltros} style={{padding: '10px 20px', background:'#f1f5f9', borderRadius:'8px', color:'#475569', fontWeight: 'bold'}}>Remover Filtros</button>
                  </div>
              </div>
          )}

          <div className="table-responsive sticky-header-wrapper custom-scrollbar" style={{marginTop: '20px'}}>
            <table className="ux-table">
              <thead>
                <tr>
                  <th className="checkbox-cell" width="40px"><input type="checkbox" onChange={handleSelectAll} checked={produtos.length > 0 && selectedIds.length === produtos.length}/></th>
                  <th width="35%">Identificação do Item</th>
                  <th className="hide-mobile" width="15%">Marca</th>
                  <th width="15%">Preço Venda</th>
                  <th width="15%">Físico (Qtd)</th>
                  <th className="hide-mobile" width="10%">Status</th>
                  <th className="align-right" width="10%">Ações</th>
                </tr>
              </thead>
              <tbody>
                  {loading ? (<TableSkeleton />) : produtos.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state-modern"><h3>Nenhum item cruzou as barreiras dos filtros.</h3></td></tr>
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
                                    <DiagnosticoAlertas prod={prod} />
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
                   <div className="header-title"><AlertTriangle size={24} style={{color: '#2563eb'}} /><h2>Gestão de Auditoria de Gôndola</h2></div>
                   <button onClick={() => setShowDivergenceModal(false)} className="btn-close-modal"><X size={24}/></button>
                </div>
                <div className="modal-body-resolution custom-scrollbar">
                    <div className="resolution-list">
                        {divergentProducts.map(p => (
                            <div key={p.id} className="resolution-item">
                                <div className="res-info">
                                    <span className="res-ean"><Barcode size={14}/> {p.codigoBarras}</span>
                                    <strong className="res-title">{p.descricao}</strong>
                                    <div className="res-price-old">Etiqueta Anterior: <span className="line-through">R$ {p.precoVenda?.toFixed(2)}</span></div>
                                </div>
                                <div className="res-action">
                                    <div className="res-input-group">
                                        <span className="currency">R$</span>
                                        <input type="text" placeholder="Preço Real Físico" value={newPrices[p.id] || ''} onChange={(e) => handlePriceMaskForDivergence(e, p.id)} onFocus={handleFocus} />
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

      {zoomedImage && (
        <div className="lightbox-overlay fade-in" onClick={() => setZoomedImage(null)}>
            <div className="lightbox-content">
               <button onClick={() => setZoomedImage(null)} className="lightbox-close"><X size={28}/></button>
               <img src={zoomedImage} alt="Inspeção" />
            </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <ConfirmModal title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({...prev, isOpen: false})); }} onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} isDanger={confirmModal.type === 'danger'} />
      )}
    </>
  );
}