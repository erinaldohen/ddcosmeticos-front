import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Package, AlertTriangle, ShoppingCart, Calendar, Search,
  RefreshCw, Download, MoreVertical, Filter, ArrowRight,
  CheckCircle, XCircle, AlertOctagon, Sparkles, TrendingUp, DollarSign
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Inventario.css';

// --- SUB-COMPONENTE: INTELIGÊNCIA ARTIFICIAL LOCAL (EDGE AI) ---
const InventoryIntelligence = ({ produtos }) => {
  const insight = useMemo(() => {
    if (!produtos.length) return null;

    const totalItens = produtos.length;
    const valorTotalEstoque = produtos.reduce((acc, p) => acc + (p.precoCusto * p.quantidade), 0);
    const itensVencidos = produtos.filter(p => new Date(p.validade) < new Date()).length;
    const itensBaixoEstoque = produtos.filter(p => p.quantidade <= p.estoqueMinimo).length;
    const itensExcesso = produtos.filter(p => p.quantidade > p.estoqueMinimo * 3).length;

    // Heurística de Decisão
    if (itensVencidos > 0) {
      return {
        tipo: 'danger',
        titulo: 'Risco de Conformidade',
        msg: `Detectamos ${itensVencidos} itens vencidos. Baixe-os imediatamente para evitar multas.`,
        acao: 'Resolver Vencidos',
        icon: <AlertOctagon size={18} />
      };
    }

    if (itensBaixoEstoque > totalItens * 0.15) {
      return {
        tipo: 'warning',
        titulo: 'Risco de Ruptura',
        msg: `Atenção: ${itensBaixoEstoque} produtos estão no nível crítico. O fluxo de vendas pode parar.`,
        acao: 'Gerar Pedido',
        icon: <TrendingUp size={18} />
      };
    }

    if (itensExcesso > totalItens * 0.2) {
      return {
        tipo: 'info',
        titulo: 'Oportunidade de Caixa',
        msg: `Há ${itensExcesso} produtos com estoque excessivo. Considere uma promoção para liberar capital.`,
        acao: 'Criar Promoção',
        icon: <DollarSign size={18} />
      };
    }

    return {
      tipo: 'success',
      titulo: 'Estoque Saudável',
      msg: `Seu inventário está otimizado. Valor total em custódia: ${valorTotalEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      acao: 'Ver Relatório',
      icon: <Sparkles size={18} />
    };
  }, [produtos]);

  if (!insight) return null;

  return (
    <div className={`ai-insight-bar ${insight.tipo}`}>
      <div className="ai-icon-pulse">{insight.icon}</div>
      <div className="ai-content">
        <strong>IA Analysis: {insight.titulo}</strong>
        <p>{insight.msg}</p>
      </div>
      <button className="ai-action-btn">{insight.acao}</button>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const Inventario = () => {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, vencidos: 0, baixoEstoque: 0 });
  const [filtro, setFiltro] = useState({ busca: '', status: 'todos' });

  const mainRef = useRef(null);

  // Acessibilidade: Foco inicial
  useEffect(() => { mainRef.current?.focus(); }, []);

  const carregarInventario = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);

    try {
      const res = await api.get('/inventario', {
        params: filtro,
        signal: controller.signal
      });

      const dados = res.data.content || res.data || [];
      setProdutos(dados);

      // BI em Tempo Real
      const hoje = new Date();
      setStats({
        total: dados.length,
        vencidos: dados.filter(p => new Date(p.validade) < hoje).length,
        baixoEstoque: dados.filter(p => p.quantidade <= p.estoqueMinimo).length
      });

    } catch (error) {
      if (error.name !== 'CanceledError') toast.error("Erro ao sincronizar estoque.");
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [filtro]);

  // Debounce
  useEffect(() => {
    const timeout = setTimeout(() => carregarInventario(), 500);
    return () => clearTimeout(timeout);
  }, [carregarInventario]);

  const handleExport = async () => {
    const toastId = toast.loading("Gerando inventário...");
    try {
      const res = await api.get('/inventario/exportar', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Inventario_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.update(toastId, { render: "Exportado com sucesso!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (e) {
      toast.update(toastId, { render: "Erro na exportação.", type: "error", isLoading: false, autoClose: 2000 });
    }
  };

  const getStatusConfig = (produto) => {
    const hoje = new Date();
    const validade = new Date(produto.validade);

    if (validade < hoje) return { label: 'VENCIDO', class: 'status-danger', icon: <XCircle size={14} /> };
    if (produto.quantidade <= produto.estoqueMinimo) return { label: 'REPOR', class: 'status-warning', icon: <AlertTriangle size={14} /> };
    return { label: 'REGULAR', class: 'status-success', icon: <CheckCircle size={14} /> };
  };

  return (
    <main className="inv-full-container" ref={mainRef} tabIndex="-1" role="main">

      {/* 1. HERO HEADER (BI) */}
      <header className="inv-header-hero">
        <div className="hero-left">
          <div className="hero-icon-box"><Package size={32} /></div>
          <div>
            <h1>Gestão de Inventário</h1>
            <p>Controle de validade e níveis de estoque</p>
          </div>
        </div>

        <div className="inv-stats-row">
          <div className="stat-pill" data-tooltip="Total de SKUs">
            <Package size={16} className="text-primary"/>
            <span>{stats.total} Itens</span>
          </div>
          <div className="stat-pill" data-tooltip="Produtos vencidos">
            <AlertOctagon size={16} className="text-danger"/>
            <span>{stats.vencidos} Vencidos</span>
          </div>
          <div className="stat-pill" data-tooltip="Estoque crítico">
            <ShoppingCart size={16} className="text-warning"/>
            <span>{stats.baixoEstoque} Repor</span>
          </div>
        </div>
      </header>

      {/* 2. INTELIGÊNCIA ARTIFICIAL LOCAL */}
      <section className="inv-ai-section" aria-label="Análise Inteligente">
         <InventoryIntelligence produtos={produtos} />
      </section>

      {/* 3. ALERTAS DE AÇÃO IMEDIATA */}
      {(stats.vencidos > 0 || stats.baixoEstoque > 0) && (
        <section className="inv-alerts-area" aria-label="Alertas Críticos">
          {stats.vencidos > 0 && (
            <div className="alert-ribbon danger">
              <div className="alert-content">
                <AlertOctagon size={20} />
                <span><strong>Ação Crítica:</strong> {stats.vencidos} produtos vencidos. Remova-os imediatamente.</span>
              </div>
              <button className="btn-alert-action" onClick={() => setFiltro({...filtro, status: 'vencidos'})}>
                Filtrar Vencidos <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      )}

      {/* 4. TOOLBAR DE CONTROLE */}
      <section className="inv-toolbar-wrapper">
        <div className="search-area">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, marca ou código..."
            value={filtro.busca}
            onChange={(e) => setFiltro({...filtro, busca: e.target.value})}
          />
        </div>

        <div className="filters-area">
          <div className="select-wrapper" data-tooltip="Filtrar por Status">
            <Filter size={18} className="select-icon" />
            <select
              value={filtro.status}
              onChange={(e) => setFiltro({...filtro, status: e.target.value})}
            >
              <option value="todos">Todos os Status</option>
              <option value="vencidos">Apenas Vencidos</option>
              <option value="baixo_estoque">Estoque Baixo</option>
              <option value="regular">Estoque Regular</option>
            </select>
          </div>

          <div className="action-buttons">
            <button className="btn-icon" onClick={() => carregarInventario()} data-tooltip="Atualizar Dados">
              <RefreshCw size={20} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-primary-glow" onClick={handleExport} data-tooltip="Exportar Relatório">
              <Download size={18} /> <span>Exportar</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. TABELA INTELIGENTE (RESPONSIVA) */}
      <section className="inv-content-area" aria-live="polite">
        {loading && <div className="loading-state"><RefreshCw className="spin" size={32}/><p>Sincronizando estoque...</p></div>}

        {!loading && produtos.length === 0 && (
          <div className="empty-state-full">
            <Package size={64} opacity={0.1} />
            <h3>Nenhum produto encontrado</h3>
            <p>Tente ajustar os filtros de busca.</p>
          </div>
        )}

        {!loading && produtos.length > 0 && (
          <div className="table-responsive-card">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Estoque Atual</th>
                  <th>Validade</th>
                  <th>Status</th>
                  <th style={{textAlign: 'right'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const status = getStatusConfig(p);
                  return (
                    <tr key={p.id} className={`row-${status.class.split('-')[1]}`}>
                      <td data-label="Produto">
                        <div className="prod-cell">
                          <strong>{p.descricao}</strong>
                          <span className="sku-code">SKU: {p.sku || '---'}</span>
                        </div>
                      </td>
                      <td data-label="Categoria">
                        <span className="cat-pill">{p.categoria}</span>
                      </td>
                      <td data-label="Estoque">
                        <div className="stock-info">
                          <span className={`qty-badge ${p.quantidade <= p.estoqueMinimo ? 'low' : ''}`}>
                            {p.quantidade} {p.unidade}
                          </span>
                          {p.quantidade <= p.estoqueMinimo && <span className="min-alert">(Min: {p.estoqueMinimo})</span>}
                        </div>
                      </td>
                      <td data-label="Validade">
                        <div className="date-cell">
                          <Calendar size={14} /> {new Date(p.validade).toLocaleDateString()}
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={`status-badge ${status.class}`}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td data-label="Ações" className="actions-cell">
                        <button className="action-btn" data-tooltip="Editar/Detalhes">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

export default Inventario;