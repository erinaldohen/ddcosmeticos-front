import React, { useState, useEffect } from 'react';
import { Search, Eye, X, FileText, Calendar, Filter, CreditCard, Package } from 'lucide-react';
import api from '../../../services/api';
import './HistoricoVendas.css';

const HistoricoVendas = () => {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Modal de Detalhes
  const [modalOpen, setModalOpen] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState(null);

  useEffect(() => {
    carregarVendas();
  }, []);

  const carregarVendas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vendas');
      // Lida tanto com paginação do Spring (content) quanto lista direta
      const dados = response.data.content || response.data || [];
      setVendas(dados);
    } catch (error) {
      console.error("Erro ao buscar vendas:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhes = (venda, e) => {
    e.preventDefault();
    e.stopPropagation();
    setVendaSelecionada(venda);
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setTimeout(() => setVendaSelecionada(null), 200);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const vendasFiltradas = vendas.filter(v =>
    (v.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) ||
    String(v.id || v.idVenda).includes(busca)
  );

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
          <table className="hist-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Data / Hora</th>
                <th>Cliente</th>
                <th>Status (NFC-e)</th>
                <th>Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasFiltradas.length > 0 ? (
                vendasFiltradas.map((venda, index) => {
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
                        <button className="btn-icon" onClick={(e) => abrirDetalhes(venda, e)} data-tooltip="Ver Detalhes completos">
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
        )}
      </div>

      {/* MODAL DE DETALHES DA VENDA AMPLIADO */}
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

              <h4><Package size={16}/> Produtos Adquiridos</h4>
              <ul className="modal-lista-itens">
                {vendaSelecionada.itens && vendaSelecionada.itens.length > 0 ? (
                  vendaSelecionada.itens.map((item, idx) => {
                    // REDE DE ARRASTO: Busca o nome, EAN e preço independente de como o Java enviou
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

                        {/* Sub-linha com EAN e Valor Unitário */}
                        <div className="item-sub-row">
                          <span className="item-ean" title="Código de Barras">
                            EAN: {eanProduto}
                          </span>
                          <span className="item-unit">Unit: {formatCurrency(precoUnit)}</span>
                        </div>
                      </li>
                    );
                  })
                ) : (
                   <li style={{color: '#94a3b8', fontSize: '0.9rem'}}>Itens não detalhados nesta visualização.</li>
                )}
              </ul>

              <h4><CreditCard size={16}/> Pagamentos (Split)</h4>
              <ul className="modal-lista-pgto">
                {vendaSelecionada.pagamentos && vendaSelecionada.pagamentos.length > 0 ? (
                   vendaSelecionada.pagamentos.map((pg, idx) => (
                    <li key={idx} className="pgto-detalhado">
                      <span>{pg.formaPagamento} {pg.parcelas > 1 ? `(${pg.parcelas}x)` : ''}</span>
                      <strong>{formatCurrency(pg.valor)}</strong>
                    </li>
                  ))
                ) : (
                   <li style={{color: '#94a3b8', fontSize: '0.9rem'}}>Pagamento processado (dados legados).</li>
                )}
              </ul>

              {vendaSelecionada.observacao && (
                <div className="modal-obs">
                  <strong>Observação: </strong> {vendaSelecionada.observacao}
                </div>
              )}

              <div className="modal-totais">
                <div className="total-linha"><span>Subtotal</span> <span>{formatCurrency((vendaSelecionada.valorTotal || 0) + (vendaSelecionada.descontoTotal || 0))}</span></div>
                <div className="total-linha text-red"><span>Descontos</span> <span>- {formatCurrency(vendaSelecionada.descontoTotal)}</span></div>
                <div className="total-linha destaque"><span>Total Pago</span> <span>{formatCurrency(vendaSelecionada.valorTotal)}</span></div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={fecharModal}>Fechar</button>
              <button className="btn-primary"><FileText size={16}/> Reimprimir Recibo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoVendas;