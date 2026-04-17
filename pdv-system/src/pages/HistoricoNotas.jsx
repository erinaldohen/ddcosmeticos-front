import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Search, Calendar, Building2, Eye,
  ArrowLeft, CheckCircle, RefreshCw, Box
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './HistoricoNotas.css';

const formatCurrency = (valor) => {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dataStr) => {
    if (!dataStr) return 'N/A';
    return new Date(dataStr).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const HistoricoNotas = () => {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [notaSelecionada, setNotaSelecionada] = useState(null);

  const carregarNotas = async () => {
    setLoading(true);
    try {
      // 🔥 A FLAG 'silent' impede o redirecionamento para o login
      const res = await api.get('/notas-entrada', { silent: true });
      setNotas(res.data.content || res.data || []);
    } catch (error) {
      console.error("Backend ainda não responde na rota /notas-entrada.");
      setNotas([]); // Mantém a lista vazia para mostrar o empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotas();
  }, []);

  // Filtro de Busca (Fornecedor ou Número da Nota)
  const notasFiltradas = useMemo(() => {
      if (!busca) return notas;
      const termo = busca.toLowerCase();
      return notas.filter(n => {
          const nome = (n.fornecedorNome || n.fornecedor?.nomeFantasia || n.fornecedor?.razaoSocial || '').toLowerCase();
          const numero = (n.numeroNota || '').toLowerCase();
          return nome.includes(termo) || numero.includes(termo);
      });
  }, [notas, busca]);

  const abrirDetalhes = async (nota) => {
      // Se a nota já trouxer os itens na listagem principal, usamos direto.
      // Se não, fazemos um GET específico para a nota.
      if (nota.itens && nota.itens.length > 0) {
          setNotaSelecionada(nota);
      } else {
          try {
              const res = await api.get(`/notas-entrada/${nota.id}`);
              setNotaSelecionada(res.data);
          } catch (error) {
              // Fallback caso a rota específica não exista, mostra o que tem
              setNotaSelecionada(nota);
          }
      }
  };

  return (
    <main className="hn-container animate-fade">

      {/* Cabeçalho */}
      <header className="hn-header">
        <div className="hn-hero-left">
          <div className="hn-icon-box"><FileText size={32} /></div>
          <div>
            <h1>Histórico de Notas (XML)</h1>
            <p>Auditoria e rastreabilidade de todas as entradas de mercadoria.</p>
          </div>
        </div>
        <div className="hn-stats">
            <div style={{ background: 'white', padding: '10px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Box size={20} color="#10b981"/>
                <span style={{color: '#475569', fontWeight: 600}}>Notas Processadas: <strong style={{color: '#0f172a', fontSize: '1.1rem'}}>{notas.length}</strong></span>
            </div>
        </div>
      </header>

      {/* Barra de Pesquisa */}
      <div className="hn-toolbar">
          <div className="hn-search">
              <Search size={20} className="hn-search-icon" />
              <input
                  type="text"
                  placeholder="Pesquisar por Fornecedor ou Nº da Nota..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
          </div>
          <button onClick={carregarNotas} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} data-tooltip="Recarregar">
              <RefreshCw size={20} color="#475569" className={loading ? 'spin' : ''} />
          </button>
      </div>

      {/* Tabela Principal */}
      <section className="hn-table-card">
          <table className="hn-table">
              <thead>
                  <tr>
                      <th style={{width: '20%'}}>Data Importação</th>
                      <th style={{width: '15%'}}>Nº NFe / Série</th>
                      <th style={{width: '35%'}}>Fornecedor</th>
                      <th style={{width: '10%', textAlign: 'center'}}>Qtd. Itens</th>
                      <th style={{width: '10%', textAlign: 'right'}}>Valor Total</th>
                      <th style={{width: '10%', textAlign: 'center'}}>Ação</th>
                  </tr>
              </thead>
              <tbody>
                  {loading ? (
                      <tr><td colSpan="6" className="empty-state"><RefreshCw className="spin" size={32}/> Carregando notas...</td></tr>
                  ) : notasFiltradas.length === 0 ? (
                      <tr><td colSpan="6" className="empty-state"><FileText size={48} opacity={0.2}/> Nenhuma nota encontrada no histórico.</td></tr>
                  ) : (
                      notasFiltradas.map((nota) => {
                          const nomeFornecedor = nota.fornecedorNome || nota.fornecedor?.nomeFantasia || nota.fornecedor?.razaoSocial || 'Fornecedor Desconhecido';
                          const cnpjFornecedor = nota.fornecedorCnpj || nota.fornecedor?.cnpj || '---';
                          const qtdItens = nota.itens?.length || nota.quantidadeItens || 0;

                          return (
                              <tr key={nota.id} onClick={() => abrirDetalhes(nota)}>
                                  <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 500 }}>
                                          <Calendar size={16} /> {formatDate(nota.dataImportacao || nota.dataCriacao)}
                                      </div>
                                  </td>
                                  <td>
                                      <strong style={{ color: '#0f172a' }}>{nota.numeroNota || 'S/N'}</strong>
                                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>Série: {nota.serieNota || '1'}</span>
                                  </td>
                                  <td>
                                      <div className="hn-forn-cell">
                                          <strong>{nomeFornecedor}</strong>
                                          <span>CNPJ: {cnpjFornecedor}</span>
                                      </div>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                      <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', fontWeight: 700, color: '#475569' }}>
                                          {qtdItens} un
                                      </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                      {formatCurrency(nota.valorTotal)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                      <button style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '8px' }}>
                                          <Eye size={20} />
                                      </button>
                                  </td>
                              </tr>
                          )
                      })
                  )}
              </tbody>
          </table>
      </section>

      {/* Modal de Detalhes da Nota */}
      {notaSelecionada && (
          <div className="hn-modal-overlay" onClick={() => setNotaSelecionada(null)}>
              <div className="hn-modal-content" onClick={e => e.stopPropagation()}>
                  <div className="hn-modal-header">
                      <div className="hn-modal-title">
                          <h2><FileText size={24} color="#10b981"/> Detalhes da Nota Fiscal</h2>
                          <p>Chave: {notaSelecionada.chaveAcesso || 'Não disponível'}</p>
                      </div>
                      <button className="hn-modal-close" onClick={() => setNotaSelecionada(null)}><X size={24}/></button>
                  </div>

                  <div className="hn-modal-body">

                      <div className="hn-info-grid">
                          <div className="hn-info-box">
                              <span>Fornecedor</span>
                              <strong>{notaSelecionada.fornecedorNome || notaSelecionada.fornecedor?.nomeFantasia || 'N/A'}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>CNPJ</span>
                              <strong>{notaSelecionada.fornecedorCnpj || notaSelecionada.fornecedor?.cnpj || 'N/A'}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Nº da Nota</span>
                              <strong>{notaSelecionada.numeroNota || 'N/A'}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Data de Emissão</span>
                              <strong>{notaSelecionada.dataEmissao ? new Date(notaSelecionada.dataEmissao).toLocaleDateString('pt-BR') : 'N/A'}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Status de Importação</span>
                              <div className="hn-status-badge"><CheckCircle size={14}/> Processada</div>
                          </div>
                          <div className="hn-info-box">
                              <span>Valor Total</span>
                              <strong style={{color: '#10b981'}}>{formatCurrency(notaSelecionada.valorTotal)}</strong>
                          </div>
                      </div>

                      <div className="hn-items-list">
                          <h3>Produtos Importados ({notaSelecionada.itens?.length || 0})</h3>
                          <table className="hn-table" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                              <thead>
                                  <tr>
                                      <th>Código/EAN</th>
                                      <th>Descrição do Produto</th>
                                      <th style={{textAlign: 'right'}}>Qtd</th>
                                      <th style={{textAlign: 'right'}}>Custo Unit.</th>
                                      <th style={{textAlign: 'right'}}>Total</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {(!notaSelecionada.itens || notaSelecionada.itens.length === 0) ? (
                                      <tr><td colSpan="5" className="empty-state" style={{padding: '20px'}}>Nenhum detalhe de item encontrado para esta nota.</td></tr>
                                  ) : (
                                      notaSelecionada.itens.map((item, idx) => (
                                          <tr key={idx} style={{ cursor: 'default' }}>
                                              <td style={{fontFamily: 'monospace', color: '#64748b'}}>{item.codigoBarras || item.codigo || 'N/A'}</td>
                                              <td style={{fontWeight: 600, color: '#0f172a'}}>{item.descricao || item.nomeProduto || 'Produto Indefinido'}</td>
                                              <td style={{textAlign: 'right', fontWeight: 600}}>{item.quantidade}</td>
                                              <td style={{textAlign: 'right'}}>{formatCurrency(item.valorUnitario || item.precoCusto)}</td>
                                              <td style={{textAlign: 'right', fontWeight: 700, color: '#0f172a'}}>{formatCurrency((item.valorUnitario || item.precoCusto) * item.quantidade)}</td>
                                          </tr>
                                      ))
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </main>
  );
};

export default HistoricoNotas;