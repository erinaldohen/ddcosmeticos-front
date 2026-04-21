import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Search, Calendar, Eye,
  CheckCircle, RefreshCw, Box, X, DownloadCloud
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
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
  const [itensDetalhados, setItensDetalhados] = useState([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [baixandoDanfe, setBaixandoDanfe] = useState(false);

  const carregarNotas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/estoque/historico-entradas', { silent: true });
      setNotas(res.data.content || res.data || []);
    } catch (error) {
      console.warn("Erro ao buscar notas:", error);
      setNotas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotas();
  }, []);

  const notasFiltradas = useMemo(() => {
      if (!busca) return notas;
      const termo = busca.toLowerCase();
      return notas.filter(n => {
          const nome = (n.fornecedorNome || n.fornecedor?.nomeFantasia || n.fornecedor?.razaoSocial || '').toLowerCase();
          const numero = (n.numeroNota || '').toLowerCase();
          const chave = (n.chaveAcesso || '').toLowerCase();
          return nome.includes(termo) || numero.includes(termo) || chave.includes(termo);
      });
  }, [notas, busca]);

  const abrirDetalhes = async (nota) => {
      setNotaSelecionada(nota);
      setItensDetalhados([]);

      if (!nota.numeroNota) return;

      setLoadingDetalhes(true);
      try {
          const res = await api.get(`/estoque/historico-entradas/${nota.numeroNota}/itens`, { silent: true });
          setItensDetalhados(res.data || []);
      } catch (error) {
          toast.warning("Não foi possível carregar os itens desta nota.");
      } finally {
          setLoadingDetalhes(false);
      }
  };

  // 🔥 INTEGRAÇÃO API: Pede o PDF Oficial ao Backend Java
  const baixarDanfeOficial = async () => {
      if (!notaSelecionada || !notaSelecionada.numeroNota) return;

      setBaixandoDanfe(true);
      const toastId = toast.loading("Buscando DANFE oficial no Servidor...");

      try {
          const res = await api.get(`/estoque/historico-entradas/${notaSelecionada.numeroNota}/danfe-oficial`, {
              responseType: 'blob', // Obrigatório para lidar com ficheiros (byte[])
              silent: true
          });

          // Converte o byte[] do Java num PDF transferível
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `DANFE_${notaSelecionada.numeroNota}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();

          toast.update(toastId, { render: "DANFE baixada com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
      } catch (error) {
          console.error("Erro API DANFE:", error);
          toast.update(toastId, { render: "O Backend ainda não gerou a DANFE para esta nota.", type: "error", isLoading: false, autoClose: 4000 });
      } finally {
          setBaixandoDanfe(false);
      }
  };

  return (
    <main className="hn-container animate-fade">

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

      <div className="hn-toolbar">
          <div className="hn-search">
              <Search size={20} className="hn-search-icon" />
              <input
                  type="text"
                  placeholder="Pesquisar por Fornecedor, Nº ou Chave..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
          </div>
          <button onClick={carregarNotas} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={20} color="#475569" className={loading ? 'spin' : ''} />
          </button>
      </div>

      <section className="hn-table-card">
          <table className="hn-table">
              <thead>
                  <tr>
                      <th style={{width: '20%'}}>Data Entrada</th>
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
                      <tr><td colSpan="6" className="empty-state"><FileText size={48} opacity={0.2}/> Nenhuma nota encontrada.</td></tr>
                  ) : (
                      notasFiltradas.map((nota) => {
                          const nomeFornecedor = nota.fornecedorNome || 'Fornecedor Desconhecido';
                          const cnpjFornecedor = nota.fornecedorCnpj || '---';

                          // 🔥 Lendo Exatamente como o DTO do Java definiu
                          const qtd = nota.qtdItens || 0;
                          const dataListagem = nota.dataEntrada;

                          return (
                              <tr key={nota.numeroNota} onClick={() => abrirDetalhes(nota)}>
                                  <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 500 }}>
                                          <Calendar size={16} /> {formatDate(dataListagem)}
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
                                          {qtd} un
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
                          <p>Chave: <span style={{fontFamily: 'monospace'}}>{notaSelecionada.chaveAcesso || 'Não disponível na Base'}</span></p>
                      </div>

                      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                          <button
                              onClick={baixarDanfeOficial}
                              disabled={baixandoDanfe || !notaSelecionada.numeroNota}
                              style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '8px 16px', background: '#0f172a', color: 'white',
                                  border: 'none', borderRadius: '8px', cursor: baixandoDanfe ? 'not-allowed' : 'pointer',
                                  fontWeight: 600, opacity: baixandoDanfe ? 0.7 : 1
                              }}
                          >
                              {baixandoDanfe ? <RefreshCw size={18} className="spin" /> : <DownloadCloud size={18} />}
                              Baixar DANFE 2ª Via
                          </button>
                          <button className="hn-modal-close" onClick={() => setNotaSelecionada(null)}><X size={24}/></button>
                      </div>
                  </div>

                  <div className="hn-modal-body">
                      <div className="hn-info-grid">
                          <div className="hn-info-box">
                              <span>Fornecedor</span>
                              <strong>{notaSelecionada.fornecedorNome || 'N/A'}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Nº da Nota</span>
                              <strong>{notaSelecionada.numeroNota || 'N/A'}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Data de Entrada</span>
                              <strong>{formatDate(notaSelecionada.dataEntrada)}</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Qtd. de Itens</span>
                              <strong>{notaSelecionada.qtdItens || 0} Produtos</strong>
                          </div>
                          <div className="hn-info-box">
                              <span>Valor Total</span>
                              <strong style={{color: '#10b981'}}>{formatCurrency(notaSelecionada.valorTotal)}</strong>
                          </div>
                      </div>

                      <div className="hn-items-list">
                          <h3>Produtos Importados ({itensDetalhados.length})</h3>
                          <table className="hn-table">
                              <thead>
                                  <tr>
                                      <th>Produto / Descrição</th>
                                      <th style={{textAlign: 'right'}}>Qtd</th>
                                      <th style={{textAlign: 'right'}}>Custo Unit.</th>
                                      <th style={{textAlign: 'right'}}>Total</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {loadingDetalhes ? (
                                      <tr><td colSpan="4" className="empty-state"><RefreshCw className="spin"/> Buscando produtos...</td></tr>
                                  ) : itensDetalhados.length === 0 ? (
                                      <tr><td colSpan="4" className="empty-state">Nenhum item encontrado.</td></tr>
                                  ) : (
                                      itensDetalhados.map((item, idx) => (
                                          <tr key={idx}>
                                              <td style={{fontWeight: 600, color: '#0f172a'}}>ID {item.produtoId} - {item.produtoDescricao || item.observacao || 'Produto Indefinido'}</td>
                                              <td style={{textAlign: 'right', fontWeight: 600}}>{item.quantidadeMovimentada}</td>
                                              <td style={{textAlign: 'right'}}>{formatCurrency(item.custoMovimentado)}</td>
                                              <td style={{textAlign: 'right', fontWeight: 700}}>{formatCurrency((item.custoMovimentado || 0) * (item.quantidadeMovimentada || 0))}</td>
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