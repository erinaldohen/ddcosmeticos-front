import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FileText, Eye, Calendar, Package, DollarSign, X } from 'lucide-react';
import './HistoricoEntradas.css';

const HistoricoEntradas = () => {
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);

  // Estado para o Modal de Detalhes
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [itensNota, setItensNota] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);

  useEffect(() => {
    carregarHistorico();
  }, [pagina]);

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/estoque/historico-entradas?page=${pagina}&size=10`);
      setEntradas(res.data.content || []);
      setTotalPaginas(res.data.totalPages || 0);
    } catch (error) {
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhes = async (nota) => {
    setNotaSelecionada(nota);
    setLoadingItens(true);
    try {
      // Codifica o número da nota caso tenha barras ou caracteres especiais
      const res = await api.get(`/estoque/historico-entradas/${encodeURIComponent(nota.numeroNota)}/itens`);
      setItensNota(res.data || []);
    } catch (error) {
      toast.error("Erro ao carregar itens da nota.");
      setItensNota([]);
    } finally {
      setLoadingItens(false);
    }
  };

  const fecharModal = () => {
    setNotaSelecionada(null);
    setItensNota([]);
  };

  const formatarMoeda = (valor) => {
    return valor ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  };

  const formatarData = (dataArray) => {
    if (!dataArray) return "-";
    // O backend pode enviar array [ano, mes, dia, hora...] ou string ISO
    if (Array.isArray(dataArray)) {
        const [ano, mes, dia, hora, min] = dataArray;
        return `${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}/${ano} ${String(hora).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
    }
    return new Date(dataArray).toLocaleDateString('pt-BR');
  };

  return (
    <div className="he-container">
      <header className="he-header">
        <div className="he-title">
          <FileText size={28} />
          <div>
            <h1>Histórico de Entradas</h1>
            <p>Registro auditável de notas fiscais e recebimentos</p>
          </div>
        </div>
      </header>

      <div className="he-content">
        {loading ? (
          <div className="he-loader">Carregando registros...</div>
        ) : (
          <table className="he-table">
            <thead>
              <tr>
                <th>Data Entrada</th>
                <th>Nº Nota Fiscal</th>
                <th>Fornecedor</th>
                <th>Qtd. Itens</th>
                <th>Valor Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((ent, idx) => (
                <tr key={idx}>
                  <td>{formatarData(ent.dataEntrada)}</td>
                  <td className="he-nota-tag">{ent.numeroNota}</td>
                  <td>
                    <div className="he-fornecedor">
                      <strong>{ent.fornecedorNome}</strong>
                      <small>{ent.fornecedorCnpj}</small>
                    </div>
                  </td>
                  <td>{ent.qtdItens} un</td>
                  <td className="he-valor">{formatarMoeda(ent.valorTotal)}</td>
                  <td>
                    <button
                      className="he-btn-detalhes"
                      onClick={() => abrirDetalhes(ent)}
                      title="Ver Itens Auditados"
                    >
                      <Eye size={18} /> Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {entradas.length === 0 && (
                <tr><td colSpan="6" className="he-empty">Nenhum registro de entrada encontrado.</td></tr>
              )}
            </tbody>
          </table>
        )}

        <div className="he-pagination">
          <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}>Anterior</button>
          <span>Página {pagina + 1} de {totalPaginas}</span>
          <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}>Próxima</button>
        </div>
      </div>

      {/* MODAL DE DETALHES (AUDITORIA) */}
      {notaSelecionada && (
        <div className="he-modal-overlay">
          <div className="he-modal">
            <div className="he-modal-header">
              <h2>Detalhes da Nota: {notaSelecionada.numeroNota}</h2>
              <button onClick={fecharModal}><X size={24} /></button>
            </div>
            <div className="he-modal-body">
              <div className="he-info-resumo">
                <div><strong>Fornecedor:</strong> {notaSelecionada.fornecedorNome}</div>
                <div><strong>Data:</strong> {formatarData(notaSelecionada.dataEntrada)}</div>
                <div><strong>Total:</strong> {formatarMoeda(notaSelecionada.valorTotal)}</div>
              </div>

              <div className="he-lista-itens">
                <h3>Itens da Nota</h3>
                {loadingItens ? <p>Carregando itens...</p> : (
                  <table>
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Custo Unit.</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensNota.map(item => (
                        <tr key={item.id}>
                          <td>{item.produtoNome}</td>
                          <td>{item.quantidade}</td>
                          <td>{formatarMoeda(item.valorUnitario)}</td>
                          <td>{formatarMoeda(item.quantidade * item.valorUnitario)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoEntradas;