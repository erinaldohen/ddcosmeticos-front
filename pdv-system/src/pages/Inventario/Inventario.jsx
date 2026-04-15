import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// 🔥 IMPORTANTE: Adicionei a importação do ProdutoForm aqui para o renderizar no Modal
import ProdutoForm from '../Produtos/ProdutoForm';
import {
  Package, AlertTriangle, ShoppingCart, Calendar, Search,
  RefreshCw, Download, MoreVertical, Filter, ArrowRight,
  CheckCircle, XCircle, AlertOctagon, Sparkles, TrendingUp, DollarSign,
  TrendingDown, Minus, BarChart3, ClipboardList, FileText, MessageCircle,
  Flame, Zap, Snowflake, Truck, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Inventario.css';

const isValidadeAtiva = (dataStr) => {
    if (!dataStr) return false;
    const d = new Date(dataStr);
    if (isNaN(d.getTime()) || d.getFullYear() <= 1970) return false;
    return true;
};

const formatCurrency = (valor) => {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- NOVOS COMPONENTES VISUAIS (LEGENDAS INTELIGENTES) ---
const RenderizarTendencia = ({ tendencia }) => {
    if (tendencia === 'ALTA') return <span className="tendencia-badge alta" data-tooltip="Crescimento de vendas > 20%"><TrendingUp size={14}/> Em Alta</span>;
    if (tendencia === 'QUEDA') return <span className="tendencia-badge queda" data-tooltip="Queda de vendas > 20%"><TrendingDown size={14}/> Em Queda</span>;
    return <span className="tendencia-badge estavel"><Minus size={14}/> Estável</span>;
};

const RenderizarCurvaABC = ({ curva }) => {
    const classes = { 'A': 'abc-a', 'B': 'abc-b', 'C': 'abc-c' };
    const dicas = { 'A': 'Curva A: Altíssimo Lucro (80%)', 'B': 'Curva B: Lucro Médio (15%)', 'C': 'Curva C: Baixo Giro (5%)' };
    return <span className={`curva-badge ${classes[curva] || 'abc-c'}`} data-tooltip={dicas[curva] || 'Baixo impacto'}>Classe {curva}</span>;
};

const RenderizarGiro = ({ giro }) => {
    if (giro >= 2.0) return <span className="giro-badge hot" data-tooltip="Produto de Saída Rápida"><Flame size={14}/> {giro.toFixed(1)}/dia</span>;
    if (giro >= 0.5) return <span className="giro-badge warm" data-tooltip="Saída Constante"><Zap size={14}/> {giro.toFixed(1)}/dia</span>;
    if (giro > 0) return <span className="giro-badge cool" data-tooltip="Saída Lenta"> {giro.toFixed(1)}/dia</span>;
    return <span className="giro-badge cold" data-tooltip="Alerta de Estoque Parado"><Snowflake size={14}/> Parado</span>;
};

const InventoryIntelligence = ({ produtos, onAcao }) => {
  const insight = useMemo(() => {
    if (!produtos.length) return null;

    const valorTotalEstoque = produtos.reduce((acc, p) => acc + ((p.precoCusto || 0) * (p.quantidade || 0)), 0);
    const itensVencidos = produtos.filter(p => isValidadeAtiva(p.validade) && new Date(p.validade) < new Date()).length;
    const itensCurvaA_Risco = produtos.filter(p => p.curvaABC === 'A' && p.quantidade <= (p.estoqueMinimo || 1) * 1.5).length;
    const comprasSugeridas = produtos.filter(p => p.sugestaoCompra > 0).length;

    if (itensVencidos > 0) {
      return { tipo: 'danger', titulo: 'Risco de Conformidade', msg: `Detectamos ${itensVencidos} itens vencidos. Baixe-os imediatamente para evitar multas.`, acaoTexto: 'Resolver Vencidos', acaoCodigo: 'VENCIDOS', icon: <AlertOctagon size={20} /> };
    }
    if (itensCurvaA_Risco > 0) {
      return { tipo: 'warning', titulo: 'Risco na Curva A', msg: `Atenção: ${itensCurvaA_Risco} produtos de altíssimo lucro estão a esgotar. O fluxo de caixa está em risco.`, acaoTexto: 'Gerar Pedido Urgente', acaoCodigo: 'COMPRAS', icon: <TrendingUp size={20} /> };
    }
    if (comprasSugeridas > 0) {
      return { tipo: 'info', titulo: 'Ciclo de Reposição', msg: `Identificamos ${comprasSugeridas} itens que precisam de reposição baseados no ritmo de vendas dos últimos 30 dias.`, acaoTexto: 'Ver Compras Sugeridas', acaoCodigo: 'COMPRAS', icon: <ShoppingCart size={20} /> };
    }
    return { tipo: 'success', titulo: 'Estoque Saudável', msg: `O seu inventário está otimizado. Valor total em custódia: ${formatCurrency(valorTotalEstoque)}.`, acaoTexto: 'Exportar Relatório', acaoCodigo: 'EXPORTAR', icon: <Sparkles size={20} /> };
  }, [produtos]);

  if (!insight) return null;

  return (
    <div className={`ai-insight-bar ${insight.tipo}`}>
      <div className="ai-icon-pulse">{insight.icon}</div>
      <div className="ai-content">
        <strong>Inteligência do Sistema: {insight.titulo}</strong>
        <p>{insight.msg}</p>
      </div>
      <button className="ai-action-btn" onClick={() => onAcao(insight.acaoCodigo)}>
        {insight.acaoTexto} <ArrowRight size={16} />
      </button>
    </div>
  );
};

const Inventario = () => {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, vencidos: 0, baixoEstoque: 0, sugestoesCompra: 0 });
  const [filtro, setFiltro] = useState({ busca: '', status: 'todos' });
  const [abaAtiva, setAbaAtiva] = useState('MATRIZ');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('TODOS');

  // 🔥 NOVO: Estado para controlar o Modal de Edição de Produto
  const [produtoEmEdicaoId, setProdutoEmEdicaoId] = useState(null);
  const [isModalAberto, setIsModalAberto] = useState(false);

  const mainRef = useRef(null);
  useEffect(() => { mainRef.current?.focus(); }, []);

  const carregarInventario = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const res = await api.get('/inventario/inteligente', { signal: controller.signal });
      let dados = res.data || [];

      if (filtro.busca) {
          const termo = filtro.busca.toLowerCase();
          dados = dados.filter(p => (p.descricao || '').toLowerCase().includes(termo) || (p.codigoBarras || '').includes(termo));
      }

      const hoje = new Date();
      if (filtro.status === 'vencidos') {
          dados = dados.filter(p => isValidadeAtiva(p.validade) && new Date(p.validade) < hoje);
      } else if (filtro.status === 'baixo_estoque') {
          dados = dados.filter(p => p.quantidade <= (p.estoqueMinimo || 0));
      } else if (filtro.status === 'curva_a') {
          dados = dados.filter(p => p.curvaABC === 'A');
      }

      setProdutos(dados);

      setStats({
        total: dados.length,
        vencidos: dados.filter(p => isValidadeAtiva(p.validade) && new Date(p.validade) < hoje).length,
        baixoEstoque: dados.filter(p => p.quantidade <= (p.estoqueMinimo || 0)).length,
        sugestoesCompra: dados.filter(p => p.sugestaoCompra > 0).length
      });

    } catch (error) {
      if (error.name !== 'CanceledError') toast.error("Erro ao sincronizar inteligência de estoque.");
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [filtro]);

  useEffect(() => {
    const timeout = setTimeout(() => { carregarInventario(); }, 500);
    return () => clearTimeout(timeout);
  }, [carregarInventario]);

  const handleExport = async () => {
    const toastId = toast.loading("A gerar relatório PDF...");
    try {
      const res = await api.get('/inventario/exportar', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Inventario_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.update(toastId, { render: "Exportado com sucesso!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (e) {
      toast.update(toastId, { render: "Erro na exportação.", type: "error", isLoading: false, autoClose: 2000 });
    }
  };

  const handleAcaoIA = (codigo) => {
      if (codigo === 'VENCIDOS') {
          setAbaAtiva('MATRIZ');
          setFiltro({ ...filtro, status: 'vencidos' });
      } else if (codigo === 'COMPRAS') {
          setAbaAtiva('COMPRAS');
      } else if (codigo === 'EXPORTAR') {
          handleExport();
      }
  };

  // 🔥 CORREÇÃO: Abre o Modal de Edição na mesma página
  const handleAcessoProduto = (produto) => {
      setProdutoEmEdicaoId(produto.id);
      setIsModalAberto(true);
  };

  // Função para fechar o Modal e atualizar o inventário caso tenha havido alterações
  const fecharModal = (houveAlteracao) => {
      setIsModalAberto(false);
      setProdutoEmEdicaoId(null);
      if (houveAlteracao === true) {
          carregarInventario(); // Recarrega a lista se salvou o produto no modal
      }
  };

  const todosParaComprar = produtos.filter(p => p.sugestaoCompra > 0).sort((a,b) => a.curvaABC.localeCompare(b.curvaABC));
  const fornecedoresDisponiveis = [...new Set(todosParaComprar.map(p => p.fornecedorNome))].filter(Boolean);
  const produtosParaComprar = todosParaComprar.filter(p => fornecedorSelecionado === 'TODOS' || p.fornecedorNome === fornecedorSelecionado);
  const investimentoSugerido = produtosParaComprar.reduce((acc, p) => acc + (p.sugestaoCompra * (p.precoCusto || 0)), 0);

  const handleGerarPedidoWhatsApp = () => {
      if (produtosParaComprar.length === 0) return toast.info("Não há produtos sugeridos para o fornecedor selecionado.");

      const nomeFornecedor = fornecedorSelecionado === 'TODOS' ? 'Diversos' : fornecedorSelecionado;
      let texto = `*📋 PEDIDO DE COMPRAS - DD COSMÉTICOS*\nFornecedor: ${nomeFornecedor}\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n`;

      produtosParaComprar.forEach((p, idx) => {
          texto += `*${idx + 1}.* ${p.descricao}\n`;
          texto += `   ↳ EAN: ${p.codigoBarras || 'S/N'}\n`;
          texto += `   ↳ *Qtd Solicitada: ${p.sugestaoCompra} un*\n\n`;
      });

      texto += `_Custo Estimado da Ordem: ${formatCurrency(investimentoSugerido)}_\n\nPor favor, confirmem o recebimento do pedido e a previsão de entrega.`;

      const link = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(link, '_blank');
      toast.success("Pedido pronto para envio via WhatsApp!");
  };

  return (
    <main className="inv-full-container animate-fade" ref={mainRef} tabIndex="-1" role="main">

      <header className="inv-header-hero">
        <div className="hero-left">
          <div className="hero-icon-box"><Package size={32} /></div>
          <div>
            <h1>Inventário Inteligente</h1>
            <p>Gestão Preditiva e Controle de Reposição</p>
          </div>
        </div>

        <div className="inv-stats-row">
          <div className="stat-pill">
            <BarChart3 size={18} className="text-primary"/>
            <span><strong>{stats.total}</strong> SKUs Mapeados</span>
          </div>
          <div className={`stat-pill ${stats.vencidos > 0 ? 'stat-danger' : ''}`}>
            <AlertOctagon size={18} className={stats.vencidos > 0 ? "text-danger" : "text-muted"}/>
            <span><strong>{stats.vencidos}</strong> Vencidos</span>
          </div>
          <div className="stat-pill stat-success">
            <ShoppingCart size={18} color="#059669"/>
            <span><strong>{stats.sugestoesCompra}</strong> Pedidos Sugeridos</span>
          </div>
        </div>
      </header>

      <section className="inv-ai-section">
         <InventoryIntelligence produtos={produtos} onAcao={handleAcaoIA} />
      </section>

      <section className="inv-toolbar-wrapper">
        <div className="inv-tabs-group">
            <button className={`inv-tab ${abaAtiva === 'MATRIZ' ? 'active' : ''}`} onClick={() => setAbaAtiva('MATRIZ')}>
                <Package size={18}/> Matriz de Estoque
            </button>
            <button className={`inv-tab ${abaAtiva === 'COMPRAS' ? 'active' : ''}`} onClick={() => setAbaAtiva('COMPRAS')}>
                <ClipboardList size={18}/> Smart Compras
                {stats.sugestoesCompra > 0 && <span className="tab-badge">{stats.sugestoesCompra}</span>}
            </button>
        </div>

        {abaAtiva === 'MATRIZ' && (
            <div className="filters-area animate-fade">
              <div className="search-area">
                <Search size={20} className="search-icon" />
                <input type="text" placeholder="Pesquisar produto, EAN..." value={filtro.busca} onChange={(e) => setFiltro({...filtro, busca: e.target.value})} />
              </div>
              <div className="select-wrapper">
                <Filter size={18} className="select-icon" />
                <select value={filtro.status} onChange={(e) => setFiltro({...filtro, status: e.target.value})}>
                  <option value="todos">Todos os Status</option>
                  <option value="curva_a">Ouro (Curva A)</option>
                  <option value="baixo_estoque">Abaixo do Mínimo</option>
                  <option value="vencidos">Vencidos</option>
                </select>
              </div>
              <div className="action-buttons">
                <button className="btn-icon" onClick={() => carregarInventario()} data-tooltip="Atualizar Lista"><RefreshCw size={20} className={loading ? 'spin' : ''} /></button>
                <button className="btn-primary-glow" onClick={handleExport}><Download size={18} /> <span className="hide-mobile">Exportar PDF</span></button>
              </div>
            </div>
        )}
      </section>

      {/* TELA 1: MATRIZ DE ESTOQUE COMPLETA */}
      {abaAtiva === 'MATRIZ' && (
          <section className="inv-content-area">
            {loading ? ( <div className="loading-state"><RefreshCw className="spin" size={32}/><p>Sincronizando dados...</p></div>
            ) : produtos.length === 0 ? (
              <div className="empty-state-full">
                <Package size={64} opacity={0.1} />
                <h3>Nenhum produto atende aos filtros</h3>
              </div>
            ) : (
              <div className="table-responsive-card">
                <table className="inv-table">
                  <thead>
                    <tr>
                      <th style={{width: '10%'}}>Ranking</th>
                      <th style={{width: '35%'}}>Produto</th>
                      <th style={{width: '15%'}}>Estoque</th>
                      <th style={{width: '15%'}}>Giro Diário</th>
                      <th style={{width: '15%'}}>Validade</th>
                      <th style={{width: '10%', textAlign: 'center'}}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((p) => {
                        const isVencido = isValidadeAtiva(p.validade) && new Date(p.validade) < new Date();
                        return (
                        <tr key={p.id}>
                          <td><RenderizarCurvaABC curva={p.curvaABC} /></td>
                          <td>
                            <div className="prod-cell">
                              <strong>{p.descricao}</strong>
                              <span className="sku-code">EAN: {p.codigoBarras || 'S/N'}</span>
                            </div>
                          </td>
                          <td>
                            <div className="stock-info">
                              <span className={`qty-badge ${p.quantidade <= (p.estoqueMinimo || 0) ? 'low' : ''}`} data-tooltip={`Mínimo de Segurança: ${p.estoqueMinimo || 0}`}>
                                  {p.quantidade} {p.unidade || 'un'}
                              </span>
                            </div>
                          </td>
                          <td>
                              <div className="giro-cell">
                                  <RenderizarGiro giro={p.giroDiario} />
                                  <RenderizarTendencia tendencia={p.tendencia} />
                              </div>
                          </td>
                          <td>
                              <div className="date-cell" style={{ color: isVencido ? '#ef4444' : (isValidadeAtiva(p.validade) ? '#475569' : '#94a3b8'), fontWeight: isVencido ? '700' : '500' }}>
                                <Calendar size={14} />
                                {isValidadeAtiva(p.validade) ? new Date(p.validade).toLocaleDateString('pt-BR') : 'N/A'}
                              </div>
                          </td>
                          <td className="actions-cell">
                            <button className="action-btn" data-tooltip="Editar Cadastro" onClick={() => handleAcessoProduto(p)}>
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
      )}

      {/* TELA 2: SMART COMPRAS (SUGESTÕES POR FORNECEDOR) */}
      {abaAtiva === 'COMPRAS' && (
          <section className="smart-compras-area animate-fade">
              <div className="compras-header-alert">
                  <div className="compras-header-text">
                      <div className="icon-circle"><ShoppingCart size={24} color="#059669"/></div>
                      <div>
                          <h3>Inteligência de Compras</h3>
                          <p>Selecione o fornecedor que está a atender no momento para gerar a lista filtrada.</p>
                      </div>
                  </div>

                  <div className="compras-header-actions">
                      <div className="fornecedor-selector" data-tooltip="Visão Isolada de Compras">
                          <Truck size={18} color="#64748b"/>
                          <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)}>
                              <option value="TODOS">Todos os Fornecedores</option>
                              {fornecedoresDisponiveis.map(f => (
                                  <option key={f} value={f}>{f}</option>
                              ))}
                          </select>
                      </div>

                      <div className="investimento-badge">
                          <span>Capital Necessário</span>
                          <strong>{formatCurrency(investimentoSugerido)}</strong>
                      </div>
                      <button className="btn-gerar-pedido-zap" onClick={handleGerarPedidoWhatsApp}>
                          <MessageCircle size={18}/> Compartilhar Lista
                      </button>
                  </div>
              </div>

              {produtosParaComprar.length === 0 ? (
                  <div className="empty-state-full">
                    <Sparkles size={64} color="#10b981" opacity={0.2} />
                    <h3>Nenhum pedido pendente</h3>
                    <p>O seu estoque para este fornecedor está perfeitamente alinhado com as vendas.</p>
                  </div>
              ) : (
                  <div className="compras-grid">
                      {produtosParaComprar.map(p => (
                          <div key={p.id} className={`compra-card curva-${p.curvaABC.toLowerCase()}`}>
                              <div className="compra-card-head">
                                  <RenderizarCurvaABC curva={p.curvaABC} />
                                  <span className="sugestao-num">Pedir: {p.sugestaoCompra} un</span>
                              </div>
                              <div className="compra-card-body">
                                  <h4 title={p.descricao}>{p.descricao.length > 40 ? p.descricao.substring(0, 40) + '...' : p.descricao}</h4>
                                  <p className="fornecedor-label">🏭 {p.fornecedorNome}</p>

                                  <div className="compra-math">
                                      <div className="math-box">
                                          <span>Estoque Físico</span>
                                          <strong>{p.quantidade} un</strong>
                                      </div>
                                      <div className="math-box">
                                          <span>Giro</span>
                                          <strong style={{display:'flex', gap:'4px', alignItems:'center', justifyContent:'center'}}>
                                              {p.giroDiario >= 2.0 ? <Flame size={14} color="#ef4444"/> : (p.giroDiario >= 0.5 ? <Zap size={14} color="#f59e0b"/> : <Snowflake size={14} color="#3b82f6"/>)}
                                              {p.giroDiario.toFixed(1)}/dia
                                          </strong>
                                      </div>
                                  </div>

                                  <div className="compra-cost">
                                      <span>Custo Estimado</span>
                                      <strong>{formatCurrency(p.sugestaoCompra * (p.precoCusto || 0))}</strong>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </section>
      )}

      {/* 🔥 ATUALIZADO: MODAL FLUTUANTE COM CHAVE ÚNICA (KEY) */}
            {isModalAberto && produtoEmEdicaoId && (
              <div className="modal-overlay" onClick={() => fecharModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                          <h2>Auditoria Rápida de Produto</h2>
                          <button className="btn-close-modal" onClick={() => fecharModal(false)}><X size={24} /></button>
                      </div>
                      <div className="modal-body-scroll">
                          {/* A prop 'key' é o segredo: toda vez que o 'produtoEmEdicaoId' mudar,
                            o React limpa o formulário anterior e carrega o novo produto.
                          */}
                          <ProdutoForm
                              key={produtoEmEdicaoId}
                              id={produtoEmEdicaoId}
                              onSave={() => fecharModal(true)}
                          />
                      </div>
                  </div>
              </div>
            )}

          </main>
        );
      };

      export default Inventario;