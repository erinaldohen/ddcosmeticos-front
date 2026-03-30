import React, { useState, useEffect } from 'react';
import { Search, Eye, X, FileText, Package, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../services/api';
import './HistoricoVendas.css';

const HistoricoVendas = () => {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Estados de Paginação do Frontend
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 50;

  // Modal de Detalhes
  const [modalOpen, setModalOpen] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  useEffect(() => {
    carregarVendas();
  }, []);

  // Quando o usuário digita na busca, volta para a página 1
  useEffect(() => {
    setPaginaAtual(1);
  }, [busca]);

  const carregarVendas = async () => {
    setLoading(true);
    try {
      // Traz as 1000 vendas mais recentes para busca ultrarrápida em memória
      const response = await api.get('/vendas?size=1000&sort=dataVenda,desc');
      const dados = response.data.content || response.data || [];
      setVendas(dados);
    } catch (error) {
      console.error("Erro ao buscar vendas:", error);
      setVendas([]);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhes = async (venda, e) => {
    e.preventDefault();
    e.stopPropagation();

    // Abre o modal imediatamente com os dados básicos
    setVendaSelecionada(venda);
    setModalOpen(true);

    // Estratégia "Lazy Load": Busca os itens pesados apenas quando clica no olho
    if (!venda.itens || venda.itens.length === 0) {
        setLoadingDetalhes(true);
        try {
            const idReal = venda.idVenda || venda.id;
            const res = await api.get(`/vendas/${idReal}`);
            setVendaSelecionada(res.data);
        } catch (err) {
            console.error("Falha ao buscar detalhes completos da venda");
        } finally {
            setLoadingDetalhes(false);
        }
    }
  };

  const fecharModal = () => {
    setModalOpen(false);
    setTimeout(() => setVendaSelecionada(null), 200);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // 1. Aplica o Filtro de Busca
  const vendasFiltradas = vendas.filter(v =>
    (v.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) ||
    String(v.id || v.idVenda).includes(busca)
  );

  // 2. Calcula a Paginação Matemática
  const indexUltimo = paginaAtual * itensPorPagina;
  const indexPrimeiro = indexUltimo - itensPorPagina;
  const vendasPaginadas = vendasFiltradas.slice(indexPrimeiro, indexUltimo);
  const totalPaginas = Math.ceil(vendasFiltradas.length / itensPorPagina);

  return (
    <div className="hist-container">
      <div className="hist-header">
        <h2>Histórico de Vendas</h2>
        <div className="hist-search">
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Buscar por cliente ou cupom..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className="hist-table-container">
        {loading ? (
          <div className="hist-loading"><div className="spinner"></div> Carregando histórico...</div>
        ) : (
          <>
            <table className="hist-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data / Hora</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendasPaginadas.length > 0 ? (
                  vendasPaginadas.map((venda, index) => {
                    const statusReal = venda.statusNfce || venda.status || 'PENDENTE';
                    const idReal = venda.idVenda || venda.id;

                    return (
                      <tr key={idReal || index}>
                        <td>#{idReal}</td>
                        <td>{venda.dataVenda ? new Date(venda.dataVenda).toLocaleString('pt-BR') : '-'}</td>
                        <td>{venda.clienteNome || 'Consumidor Final'}</td>
                        <td>
                          <span className={`status-badge ${statusReal === 'CANCELADA' ? 'cancelada' : (statusReal === 'AUTORIZADA' ? 'autorizada' : 'pendente')}`}>
                            {statusReal}
                          </span>
                        </td>
                        <td className="fw-bold">{formatCurrency(venda.valorTotal)}</td>
                        <td>
                          <button className="btn-icon" onClick={(e) => abrirDetalhes(venda, e)} data-tooltip="Ver Detalhes">
                            <Eye size={18} color="#3b82f6" style={{ pointerEvents: 'none' }} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan="6" className="text-center">Nenhuma venda encontrada.</td></tr>
                )}
              </tbody>
            </table>

            {/* CONTROLES DE PAGINAÇÃO */}
            {totalPaginas > 1 && (
              <div className="pagination-controls" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', padding: '15px' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  Mostrando {indexPrimeiro + 1} a {Math.min(indexUltimo, vendasFiltradas.length)} de {vendasFiltradas.length}
                </span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                    disabled={paginaAtual === 1}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: paginaAtual === 1 ? '#f1f5f9' : 'white', cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer' }}>
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaAtual === totalPaginas}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: paginaAtual === totalPaginas ? '#f1f5f9' : 'white', cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer' }}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL DE DETALHES */}
      {modalOpen && vendaSelecionada && (
        <div className="hist-modal-overlay" onClick={fecharModal}>
          <div className="hist-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes da Venda #{vendaSelecionada.idVenda || vendaSelecionada.id}</h3>
              <button className="btn-close" onClick={fecharModal}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="modal-info-grid">
                <div className="info-box">
                  <span className="label">Cliente</span>
                  <strong>{vendaSelecionada.clienteNome || 'Consumidor Final'}</strong>
                </div>
                <div className="info-box">
                  <span className="label">Data</span>
                  <strong>{vendaSelecionada.dataVenda ? new Date(vendaSelecionada.dataVenda).toLocaleString('pt-BR') : '-'}</strong>
                </div>
                <div className="info-box">
                  <span className="label">Status Fiscal</span>
                  <strong>{vendaSelecionada.statusNfce || vendaSelecionada.status || 'PENDENTE'}</strong>
                </div>
              </div>

              {loadingDetalhes ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Carregando itens da venda...</div>
              ) : (
                <>
                  <h4><Package size={16}/> Produtos Adquiridos</h4>
                  <ul className="modal-lista-itens">
                    {vendaSelecionada.itens && vendaSelecionada.itens.length > 0 ? (
                      vendaSelecionada.itens.map((item, idx) => {
                        const nomeProduto = item.nomeProduto || item.nome || item.produtoNome || item.descricao || item.produto?.nome || item.produto?.descricao || `Produto ID: ${item.produtoId || item.produto?.id || '?'}`;
                        const eanProduto = item.codigoBarras || item.ean || item.produto?.codigoBarras || item.produto?.ean || 'Não informado';
                        const precoUnit = item.precoUnitario || item.valorUnitario || item.preco || 0;
                        const qtd = item.quantidade || 1;

                        return (
                          <li key={idx} className="produto-detalhado">
                            <div className="item-main-row">
                              <div className="item-desc">
                                <span className="item-qtd">{qtd}x</span>
                                <span className="item-nome">{nomeProduto}</span>
                              </div>
                              <span className="item-preco">{formatCurrency(precoUnit * qtd)}</span>
                            </div>
                            <div className="item-sub-row">
                              <span className="item-ean">EAN: {eanProduto}</span>
                              <span className="item-unit">Unit: {formatCurrency(precoUnit)}</span>
                            </div>
                          </li>
                        );
                      })
                    ) : (
                       <li style={{color: '#94a3b8', fontSize: '0.9rem'}}>Nenhum item detalhado encontrado.</li>
                    )}
                  </ul>

                  <h4><CreditCard size={16}/> Pagamentos</h4>
                  <ul className="modal-lista-pgto">
                    {vendaSelecionada.pagamentos && vendaSelecionada.pagamentos.length > 0 ? (
                       vendaSelecionada.pagamentos.map((pg, idx) => (
                        <li key={idx} className="pgto-detalhado">
                          <span>{pg.formaPagamento} {pg.parcelas > 1 ? `(${pg.parcelas}x)` : ''}</span>
                          <strong>{formatCurrency(pg.valor)}</strong>
                        </li>
                      ))
                    ) : (
                       <li style={{color: '#94a3b8', fontSize: '0.9rem'}}>Dados de pagamento não encontrados.</li>
                    )}
                  </ul>
                </>
              )}

              <div className="modal-totais">
                <div className="total-linha"><span>Subtotal</span> <span>{formatCurrency((vendaSelecionada.valorTotal || 0) + (vendaSelecionada.descontoTotal || 0))}</span></div>
                <div className="total-linha text-red"><span>Descontos</span> <span>- {formatCurrency(vendaSelecionada.descontoTotal)}</span></div>
                <div className="total-linha destaque"><span>Total Pago</span> <span>{formatCurrency(vendaSelecionada.valorTotal)}</span></div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={fecharModal}>Fechar</button>
              <button className="btn-primary" onClick={() => window.open(`/api/v1/fiscal/nfce/imprimir/${vendaSelecionada.idVenda || vendaSelecionada.id}`, '_blank')}>
                <FileText size={16}/> Reimprimir Recibo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoVendas;