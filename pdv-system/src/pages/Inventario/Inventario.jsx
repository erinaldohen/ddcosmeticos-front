import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// --- COMPONENTES VISUAIS (LEGENDAS INTELIGENTES) ---
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
  // 🔥 CORREÇÃO: O estado absoluto da base de dados, sem sofrer mutações de filtro
  const [produtosRaw, setProdutosRaw] = useState([]);
  const [fornecedoresDb, setFornecedoresDb] = useState([]);

  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState({ busca: '', status: 'todos' });
  const [abaAtiva, setAbaAtiva] = useState('MATRIZ');

  // Controle de Compras Inteligentes
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('TODOS');
  const [ativarSazonalidade, setAtivarSazonalidade] = useState(true);

  // Modal de Edição de Produto
  const [produtoEmEdicaoId, setProdutoEmEdicaoId] = useState(null);
  const [isModalAberto, setIsModalAberto] = useState(false);

  const mainRef = useRef(null);
  useEffect(() => { mainRef.current?.focus(); }, []);

  // Busca Fornecedores puros do Banco
  const carregarFornecedoresDb = async () => {
      try {
          const res = await api.get('/fornecedores');
          const lista = res.data.content || res.data || [];
          const nomes = lista.map(f => f.nomeFantasia || f.razaoSocial).filter(Boolean);
          setFornecedoresDb(nomes);
      } catch (error) {
          console.warn("Aviso: Não foi possível carregar a lista mestra de fornecedores.", error);
      }
  };

  // Busca Estoque puro do Banco
  const carregarInventario = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const res = await api.get('/inventario/inteligente', { signal: controller.signal });
      setProdutosRaw(res.data || []);
    } catch (error) {
      if (error.name !== 'CanceledError') toast.error("Erro ao sincronizar inteligência de estoque.");
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, []);

  useEffect(() => {
    carregarFornecedoresDb();
    const timeout = setTimeout(() => { carregarInventario(); }, 500);
    return () => clearTimeout(timeout);
  }, [carregarInventario]);

  // 🔥 MÓDULO MATRIZ: Cálculos Exclusivos para a Aba de Matriz de Estoque
  const produtosFiltrados = useMemo(() => {
      let dados = produtosRaw;
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
      return dados;
  }, [produtosRaw, filtro]);

  const stats = useMemo(() => {
      const hoje = new Date();
      return {
          total: produtosRaw.length,
          vencidos: produtosRaw.filter(p => isValidadeAtiva(p.validade) && new Date(p.validade) < hoje).length,
          baixoEstoque: produtosRaw.filter(p => p.quantidade <= (p.estoqueMinimo || 0)).length,
          sugestoesCompra: produtosRaw.filter(p => p.sugestaoCompra > 0).length
      };
  }, [produtosRaw]);

  // Exportação e Navegação
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

  const handleAcessoProduto = (produto) => {
      setProdutoEmEdicaoId(produto.id);
      setIsModalAberto(true);
  };

  const fecharModal = (houveAlteracao) => {
      setIsModalAberto(false);
      setProdutoEmEdicaoId(null);
      if (houveAlteracao === true) {
          carregarInventario();
      }
  };

  // =======================================================================
  // 🧠 MOTOR DE SAZONALIDADE E SMART COMPRAS (CALENDÁRIO INTELIGENTE)
  // =======================================================================

  // Monta o dropdown fundindo todos os fornecedores cadastrados + nomes dos produtos
  const fornecedoresDisponiveis = useMemo(() => {
      const nomesDosProdutos = produtosRaw.map(p => p.fornecedorNome || p.fornecedor?.nome || 'Sem Fornecedor');
      const todosOsNomes = [...nomesDosProdutos, ...fornecedoresDb];
      return [...new Set(todosOsNomes)].filter(n => n !== 'Sem Fornecedor').sort();
  }, [produtosRaw, fornecedoresDb]);

  const listaParaExibirNoSelect = ['TODOS', ...fornecedoresDisponiveis, 'Sem Fornecedor'];

  const { produtosDoFornecedor, produtosParaComprar, investimentoSugerido, eventoProximo } = useMemo(() => {

      // 1. Filtra pela Base Absoluta (sem ser afetada pelo status da outra aba) à prova de Case Sensitive
      const filtradosPorFornecedor = produtosRaw.filter(p => {
          const nomeProduto = (p.fornecedorNome || p.fornecedor?.nome || '').trim().toUpperCase();
          const selecionado = fornecedorSelecionado.trim().toUpperCase();

          if (fornecedorSelecionado === 'TODOS') return true;
          if (fornecedorSelecionado === 'Sem Fornecedor') return !nomeProduto;

          return nomeProduto === selecionado || nomeProduto.includes(selecionado) || selecionado.includes(nomeProduto);
      });

      // 2. Aplica a Inteligência Sazonal
      const hoje = new Date();
      const mesAtual = hoje.getMonth() + 1;
      let eventoAtivo = null;
      let listaProcessada = filtradosPorFornecedor;

      if (ativarSazonalidade && (mesAtual === 4 || mesAtual === 5)) {
          eventoAtivo = { nome: "Dia das Mães", impacto: 1.4, categoriasAlvo: ['Skincare', 'Perfumaria', 'Kits', 'Maquiagem', 'Perfume'] };

          listaProcessada = filtradosPorFornecedor.map(p => {
              const strAlvo = (p.categoria || '') + ' ' + (p.descricao || '');
              const isProdutoAlvo = eventoAtivo.categoriasAlvo.some(cat => strAlvo.toLowerCase().includes(cat.toLowerCase()));

              if (isProdutoAlvo) {
                  const novaSugestao = Math.ceil((p.sugestaoCompra || 0) * eventoAtivo.impacto);
                  const sugestaoFinal = (novaSugestao < 6 && (p.curvaABC === 'A' || p.curvaABC === 'B')) ? 6 : novaSugestao;
                  return { ...p, sugestaoCompra: Math.max(p.sugestaoCompra || 0, sugestaoFinal), alertaSazonal: `🎁 Impulso ${eventoAtivo.nome}` };
              }
              return p;
          });
      }

      // 3. Ordenação Inteligente
      const listaOrdenada = listaProcessada.sort((a, b) => {
          const aPrecisa = a.sugestaoCompra > 0 ? 1 : 0;
          const bPrecisa = b.sugestaoCompra > 0 ? 1 : 0;
          if (aPrecisa !== bPrecisa) return bPrecisa - aPrecisa;
          return (a.curvaABC || 'C').localeCompare(b.curvaABC || 'C');
      });

      // 4. Separação para orçamento
      const listaFinalParaComprar = listaOrdenada.filter(p => p.sugestaoCompra > 0);
      const investimento = listaFinalParaComprar.reduce((acc, p) => acc + (p.sugestaoCompra * (p.precoCusto || 0)), 0);

      return {
          produtosDoFornecedor: listaOrdenada,
          produtosParaComprar: listaFinalParaComprar,
          investimentoSugerido: investimento,
          eventoProximo: eventoAtivo
      };
  }, [produtosRaw, fornecedorSelecionado, ativarSazonalidade]);

  const handleGerarPedidoWhatsApp = () => {
      if (produtosParaComprar.length === 0) return toast.info("Não há itens com necessidade de compra para este fornecedor.");

      const nomeFornecedor = fornecedorSelecionado === 'TODOS' ? 'Diversos' : fornecedorSelecionado;
      let texto = `*📋 PEDIDO DE COMPRAS - DD COSMÉTICOS*\nFornecedor: ${nomeFornecedor}\nData: ${new Date().toLocaleDateString('pt-BR')}\n\n`;

      produtosParaComprar.forEach((p, idx) => {
          const avisoSazonal = p.alertaSazonal ? ` _(${p.alertaSazonal})_` : '';
          texto += `*${idx + 1}.* ${p.descricao}${avisoSazonal}\n`;
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
            <span><strong>{stats.sugestoesCompra}</strong> Pedidos Base</span>
          </div>
        </div>
      </header>

      <section className="inv-ai-section">
         <InventoryIntelligence produtos={produtosRaw} onAcao={handleAcaoIA} />
      </section>

      <section className="inv-toolbar-wrapper">
        <div className="inv-tabs-group">
            <button className={`inv-tab ${abaAtiva === 'MATRIZ' ? 'active' : ''}`} onClick={() => setAbaAtiva('MATRIZ')}>
                <Package size={18}/> Matriz de Estoque
            </button>
            <button className={`inv-tab ${abaAtiva === 'COMPRAS' ? 'active' : ''}`} onClick={() => setAbaAtiva('COMPRAS')}>
                <ClipboardList size={18}/> Smart Compras
                {produtosParaComprar.length > 0 && <span className="tab-badge">{produtosParaComprar.length}</span>}
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
            ) : produtosFiltrados.length === 0 ? (
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
                    {produtosFiltrados.map((p) => {
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

      {/* TELA 2: SMART COMPRAS (PANORAMA DO FORNECEDOR) */}
      {abaAtiva === 'COMPRAS' && (
          <section className="smart-compras-area animate-fade">

              {/* BANNER SAZONAL */}
              {eventoProximo && ativarSazonalidade && (
                  <div style={{ background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)', border: '1px solid #fbcfe8', borderRadius: '12px', padding: '16px 24px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', boxShadow: '0 4px 6px -1px rgba(236, 72, 153, 0.1)' }}>
                      <div style={{ background: '#ec4899', color: 'white', padding: '12px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={24} />
                      </div>
                      <div>
                          <h4 style={{ margin: '0 0 4px 0', color: '#be185d', fontSize: '1.1rem', fontWeight: '800' }}>ALERTA SAZONAL: {eventoProximo.nome}</h4>
                          <p style={{ margin: 0, color: '#831843', fontSize: '0.95rem' }}>O motor de IA reajustou as sugestões de compra para <strong>{eventoProximo.categoriasAlvo.join(', ')}</strong>. O volume foi impulsionado estrategicamente para evitar ruturas de estoque na data.</p>
                      </div>
                  </div>
              )}

              <div className="compras-header-alert">
                  <div className="compras-header-text">
                      <div className="icon-circle"><ShoppingCart size={24} color="#059669"/></div>
                      <div>
                          <h3>Inteligência de Compras</h3>
                          <p>Selecione o fornecedor que está a atender no momento para analisar todo o portfólio dele.</p>
                      </div>
                  </div>

                  <div className="compras-header-actions">
                      <div className="toggle-sazonalidade" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: ativarSazonalidade ? '#fdf2f8' : '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${ativarSazonalidade ? '#fbcfe8' : '#e2e8f0'}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setAtivarSazonalidade(!ativarSazonalidade)}>
                          {ativarSazonalidade ? <Sparkles size={18} color="#ec4899" className="pulse-animation"/> : <Calendar size={18} color="#64748b"/>}
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: ativarSazonalidade ? '#be185d' : '#475569' }}>
                              {ativarSazonalidade ? 'IA Sazonal: ON' : 'IA Sazonal: OFF'}
                          </span>
                      </div>

                      <div className="fornecedor-selector" data-tooltip="Filtrar por Fornecedor">
                          <Truck size={18} color="#64748b"/>
                          <select value={fornecedorSelecionado} onChange={(e) => setFornecedorSelecionado(e.target.value)}>
                              {listaParaExibirNoSelect.map(f => (
                                  <option key={f} value={f === 'Sem Fornecedor' ? '' : f}>
                                      {f}
                                  </option>
                              ))}
                          </select>
                      </div>

                      <div className="investimento-badge" data-tooltip="Custo total dos itens sugeridos para compra">
                          <span>Capital Necessário</span>
                          <strong>{formatCurrency(investimentoSugerido)}</strong>
                      </div>
                      <button className="btn-gerar-pedido-zap" onClick={handleGerarPedidoWhatsApp}>
                          <MessageCircle size={18}/> Compartilhar Lista
                      </button>
                  </div>
              </div>

              {produtosDoFornecedor.length === 0 ? (
                  <div className="empty-state-full">
                    <Package size={64} color="#94a3b8" opacity={0.3} />
                    <h3>Nenhum produto encontrado</h3>
                    <p>Não há produtos vinculados a este fornecedor no sistema.</p>
                  </div>
              ) : (
                  <div className="compras-grid">
                      {produtosDoFornecedor.map(p => {
                          const precisaComprar = p.sugestaoCompra > 0;

                          return (
                          <div key={p.id}
                               className={`compra-card curva-${p.curvaABC.toLowerCase()}`}
                               style={!precisaComprar ? { opacity: 0.75, filter: 'grayscale(0.4)' } : { border: '2px solid #3b82f6', transform: 'scale(1.02)', zIndex: 1 }}>

                              <div className="compra-card-head" style={{ position: 'relative' }}>
                                  <RenderizarCurvaABC curva={p.curvaABC} />
                                  {precisaComprar ? (
                                      <span className="sugestao-num" style={{ background: '#3b82f6', color: 'white', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}>
                                          Pedir: {p.sugestaoCompra} un
                                      </span>
                                  ) : (
                                      <span className="sugestao-num" style={{ background: '#10b981', color: 'white' }}>
                                          <CheckCircle size={14} style={{ marginRight: '4px' }}/> Estoque OK
                                      </span>
                                  )}
                              </div>

                              <div className="compra-card-body">
                                  <h4 title={p.descricao}>{p.descricao.length > 40 ? p.descricao.substring(0, 40) + '...' : p.descricao}</h4>
                                  <p className="fornecedor-label">🏭 {p.fornecedorNome || p.fornecedor?.nome || 'Sem Fornecedor'}</p>

                                  {p.alertaSazonal && precisaComprar && (
                                      <div style={{ background: '#fce7f3', color: '#be185d', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' }}>
                                          {p.alertaSazonal}
                                      </div>
                                  )}

                                  <div className="compra-math">
                                      <div className="math-box">
                                          <span>Estoque / Mín.</span>
                                          <strong>{p.quantidade} / {p.estoqueMinimo || 0}</strong>
                                      </div>
                                      <div className="math-box">
                                          <span>Giro Médio</span>
                                          <strong style={{display:'flex', gap:'4px', alignItems:'center', justifyContent:'center'}}>
                                              {p.giroDiario >= 2.0 ? <Flame size={14} color="#ef4444"/> : (p.giroDiario >= 0.5 ? <Zap size={14} color="#f59e0b"/> : <Snowflake size={14} color="#3b82f6"/>)}
                                              {p.giroDiario.toFixed(1)}/dia
                                          </strong>
                                      </div>
                                  </div>

                                  <div className="compra-cost">
                                      <span>{precisaComprar ? 'Custo Estimado' : 'Custo da Reposição Futura'}</span>
                                      <strong>{formatCurrency((p.sugestaoCompra || 0) * (p.precoCusto || 0))}</strong>
                                  </div>
                              </div>
                          </div>
                      )})}
                  </div>
              )}
          </section>
      )}

      {/* MODAL FLUTUANTE COM CHAVE ÚNICA (KEY) */}
            {isModalAberto && produtoEmEdicaoId && (
              <div className="modal-overlay" onClick={() => fecharModal(false)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <div className="modal-header">
                          <h2>Auditoria Rápida de Produto</h2>
                          <button className="btn-close-modal" onClick={() => fecharModal(false)}><X size={24} /></button>
                      </div>
                      <div className="modal-body-scroll">
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