import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Search, Calendar, Eye, CheckCircle, RefreshCw,
  Box, X, DownloadCloud, Building2, Briefcase, Hash, Package, DollarSign
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

const formatarCNPJ = (cnpj) => {
    if (!cnpj) return '---';
    const apenasNumeros = cnpj.toString().replace(/\D/g, '');
    if (apenasNumeros.length !== 14) return cnpj;
    return apenasNumeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
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
          const cnpj = (n.fornecedorCnpj || n.fornecedor?.cnpj || '').toLowerCase();
          return nome.includes(termo) || numero.includes(termo) || chave.includes(termo) || cnpj.includes(termo);
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

  const baixarDanfeOficial = async () => {
      if (!notaSelecionada || !notaSelecionada.numeroNota) return;

      setBaixandoDanfe(true);
      const toastId = toast.loading("Buscando DANFE oficial no Servidor...");

      try {
          const res = await api.get(`/estoque/historico-entradas/${notaSelecionada.numeroNota}/danfe-oficial`, {
              responseType: 'blob',
              silent: true
          });

          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `DANFE_Entrada_${notaSelecionada.numeroNota}.pdf`);
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
          <div className="hn-icon-box"><FileText size={28} strokeWidth={2.5} /></div>
          <div>
            <h1>Histórico de Notas (XML)</h1>
            <p>Auditoria e rastreabilidade de entradas de mercadoria.</p>
          </div>
        </div>
        <div className="hn-stats">
            <div className="hn-stat-badge">
                <CheckCircle size={20} color="#10b981"/>
                <span>Notas Processadas: <strong>{notas.length}</strong></span>
            </div>
        </div>
      </header>

      <div className="hn-toolbar">
          <div className="hn-search">
              <Search size={20} className="hn-search-icon" />
              <input
                  type="text"
                  placeholder="Pesquisar por Fornecedor, CNPJ, Nº da Nota ou Chave de Acesso..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
              />
          </div>
          <button className="hn-btn-refresh" onClick={carregarNotas} title="Atualizar Lista">
              <RefreshCw size={20} className={loading ? 'spin' : ''} />
          </button>
      </div>

      <section className="hn-table-card">
          <div className="hn-table-responsive">
              <table className="hn-table">
                  <thead>
                      <tr>
                          <th style={{width: '15%'}}>Data Entrada</th>
                          <th style={{width: '15%'}}>Nº Nota / Série</th>
                          <th style={{width: '35%'}}>Fornecedor</th>
                          <th style={{width: '10%', textAlign: 'center'}}>Qtd. Itens</th>
                          <th style={{width: '15%', textAlign: 'right'}}>Valor Total</th>
                          <th style={{width: '10%', textAlign: 'center'}}>Visualizar</th>
                      </tr>
                  </thead>
                  <tbody>
                      {loading ? (
                          <tr><td colSpan="6" className="empty-state"><RefreshCw className="spin" size={32}/> <p>Sincronizando dados...</p></td></tr>
                      ) : notasFiltradas.length === 0 ? (
                          <tr><td colSpan="6" className="empty-state"><FileText size={48} opacity={0.2}/> <p>Nenhuma nota encontrada nos filtros.</p></td></tr>
                      ) : (
                          notasFiltradas.map((nota) => {
                              const nomeFornecedor = nota.fornecedorNome || nota.fornecedor?.nomeFantasia || nota.fornecedor?.razaoSocial || 'Fornecedor Desconhecido';
                              const cnpjFornecedor = formatarCNPJ(nota.fornecedorCnpj || nota.fornecedor?.cnpj);
                              const qtd = nota.qtdItens || 0;

                              return (
                                  <tr key={nota.numeroNota || nota.id} onClick={() => abrirDetalhes(nota)} className="hn-table-row">
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                          <div className="hn-date-cell">
                                              <Calendar size={16} /> <span>{formatDate(nota.dataEntrada)}</span>
                                          </div>
                                      </td>
                                      <td style={{ whiteSpace: 'nowrap' }}>
                                          <span className="hn-nota-numero">{nota.numeroNota || 'S/N'}</span>
                                          <span className="hn-nota-serie">Série: {nota.serieNota || '1'}</span>
                                      </td>
                                      <td>
                                          <div className="hn-forn-cell">
                                              <strong>{nomeFornecedor}</strong>
                                              <span style={{ whiteSpace: 'nowrap' }}>{cnpjFornecedor}</span>
                                          </div>
                                      </td>
                                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                          <span className="hn-badge-qtd">{qtd} un</span>
                                      </td>
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                          <span className="hn-valor-total">{formatCurrency(nota.valorTotal)}</span>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                          <button className="hn-btn-view">
                                              <Eye size={20} />
                                          </button>
                                      </td>
                                  </tr>
                              )
                          })
                      )}
                  </tbody>
              </table>
          </div>
      </section>

      {notaSelecionada && (
          <div className="hn-modal-overlay animate-fade-in" onClick={() => setNotaSelecionada(null)}>
              <div className="hn-modal-content animate-slide-up" onClick={e => e.stopPropagation()}>

                  <div className="hn-modal-header">
                      <div className="hn-modal-title-group">
                          <div className="hn-modal-icon-bg">
                              <FileText size={28} color="#10b981" strokeWidth={2.5}/>
                          </div>
                          <div className="hn-modal-title-text">
                              <h2>Detalhes da Nota Fiscal</h2>
                              <div className="hn-chave-badge">
                                  <Hash size={14}/>
                                  <span>{notaSelecionada.chaveAcesso || 'Chave não registrada na Base'}</span>
                              </div>
                          </div>
                      </div>

                      <div className="hn-modal-actions">
                          <button
                              onClick={baixarDanfeOficial}
                              disabled={baixandoDanfe || !notaSelecionada.numeroNota}
                              className={`hn-btn-danfe ${baixandoDanfe ? 'loading' : ''}`}
                          >
                              {baixandoDanfe ? <RefreshCw size={18} className="spin" /> : <DownloadCloud size={18} />}
                              <span>Baixar DANFE</span>
                          </button>
                          <button className="hn-btn-close" onClick={() => setNotaSelecionada(null)}>
                              <X size={24}/>
                          </button>
                      </div>
                  </div>

                  <div className="hn-modal-body">
                      <div className="hn-info-cards-grid">
                                                {/* PRIMEIRA LINHA */}
                                                <div className="hn-info-card forn-card">
                                                    <div className="hn-card-icon"><Building2 size={20}/></div>
                                                    <div className="hn-card-data">
                                                        <label>Fornecedor</label>
                                                        <strong>{notaSelecionada.fornecedorNome || notaSelecionada.fornecedor?.nomeFantasia || notaSelecionada.fornecedor?.razaoSocial || 'N/A'}</strong>
                                                    </div>
                                                </div>
                                                <div className="hn-info-card cnpj-card">
                                                    <div className="hn-card-icon"><Briefcase size={20}/></div>
                                                    <div className="hn-card-data">
                                                        <label>CNPJ Fornecedor</label>
                                                        <strong style={{ whiteSpace: 'nowrap' }}>{formatarCNPJ(notaSelecionada.fornecedorCnpj || notaSelecionada.fornecedor?.cnpj)}</strong>
                                                    </div>
                                                </div>

                                                {/* SEGUNDA LINHA */}
                                                <div className="hn-info-card date-card">
                                                    <div className="hn-card-icon"><Calendar size={20}/></div>
                                                    <div className="hn-card-data">
                                                        <label>Data de Entrada</label>
                                                        <strong style={{ whiteSpace: 'nowrap' }}>{formatDate(notaSelecionada.dataEntrada)}</strong>
                                                    </div>
                                                </div>
                                                <div className="hn-info-card vol-card">
                                                    <div className="hn-card-icon"><Package size={20}/></div>
                                                    <div className="hn-card-data">
                                                        <label>Volume</label>
                                                        <strong style={{ whiteSpace: 'nowrap' }}>{notaSelecionada.qtdItens || 0} Itens</strong>
                                                    </div>
                                                </div>
                                                <div className="hn-info-card highlight val-card">
                                                    <div className="hn-card-icon"><DollarSign size={20}/></div>
                                                    <div className="hn-card-data">
                                                        <label>Valor Total</label>
                                                        <strong style={{ whiteSpace: 'nowrap' }}>{formatCurrency(notaSelecionada.valorTotal)}</strong>
                                                    </div>
                                                </div>
                                            </div>

                      <div className="hn-items-section">
                          <div className="hn-items-header">
                              <h3>Produtos Listados na XML</h3>
                              <span className="hn-items-count">{itensDetalhados.length} Registos</span>
                          </div>

                          <div className="hn-modal-table-wrapper">
                              <table className="hn-modal-table">
                                  <thead>
                                      <tr>
                                          {/* LARGURAS FIXAS ADICIONADAS AQUI PARA ALINHAMENTO PERFEITO */}
                                          <th style={{ width: '45%' }}>Descrição do Produto</th>
                                          <th style={{ textAlign: 'center', width: '15%' }}>Qtd</th>
                                          <th style={{ textAlign: 'right', width: '20%' }}>Custo Unit.</th>
                                          <th style={{ textAlign: 'right', width: '20%' }}>Custo Total</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {loadingDetalhes ? (
                                          <tr><td colSpan="4" className="empty-state"><RefreshCw className="spin"/> Buscando produtos...</td></tr>
                                      ) : itensDetalhados.length === 0 ? (
                                          <tr><td colSpan="4" className="empty-state">Nenhum item decodificado no XML.</td></tr>
                                      ) : (
                                          itensDetalhados.map((item, idx) => {
                                              const qtdItem = item.quantidadeMovimentada ?? item.quantidade ?? 1;
                                              const custoItem = item.custoMovimentado ?? item.valorUnitario ?? item.custoUnitario ?? 0;
                                              const totalItem = qtdItem * custoItem;
                                              const descItem = item.produto?.descricao ?? item.produtoDescricao ?? item.observacao ?? 'Produto Indefinido';

                                              return (
                                                  <tr key={idx}>
                                                      <td className="hn-product-desc">{descItem}</td>
                                                      <td style={{textAlign: 'center', whiteSpace: 'nowrap'}}><span className="hn-badge-qtd-small">{qtdItem}</span></td>
                                                      <td style={{textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap'}}>{formatCurrency(custoItem)}</td>
                                                      <td style={{textAlign: 'right', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap'}}>{formatCurrency(totalItem)}</td>
                                                  </tr>
                                              )
                                          })
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </main>
  );
};

export default HistoricoNotas;