import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
    FileText, Eye, UploadCloud, X, Package,
    ChevronLeft, ChevronRight, Sparkles, Loader2, User, Calendar,
    Search, RefreshCw, DownloadCloud, Hash
} from 'lucide-react';
import './HistoricoEntradas.css';

const HistoricoEntradas = () => {
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);

  const [busca, setBusca] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [itensNota, setItensNota] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [baixandoDanfe, setBaixandoDanfe] = useState(false);

  useEffect(() => {
    if (notaSelecionada) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [notaSelecionada]);

  const getDataEmissaoReal = () => {
      if (itensNota.length > 0 && itensNota[0].produtoDescricao && itensNota[0].produtoDescricao.includes('|')) {
          const partes = itensNota[0].produtoDescricao.split('|');
          if (partes.length >= 4) return partes[3];
      }
      return notaSelecionada?.dataEmissao || notaSelecionada?.dataEntrada;
  };

  useEffect(() => { carregarHistorico(); }, [pagina]);

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const res = await api.get(`estoque/historico-entradas?page=${pagina}&size=10`);
      setEntradas(res.data.content || []);
      setTotalPaginas(res.data.totalPages || 0);
    } catch (error) {
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  };

  const processarArquivo = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast.error("Formato inválido. Selecione um ficheiro XML.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("arquivo", file);

    try {
      await api.post('importacao-xml/receber-nota', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      toast.success("Importação concluída com sucesso!", { icon: "✨" });
      setPagina(0);
      carregarHistorico();
    } catch (error) {
        let msg = "Erro no processamento da Nota Fiscal.";
        if (error.response?.data?.mensagem) msg = error.response.data.mensagem;
        else if (typeof error.response?.data === 'string') msg = error.response.data;
        toast.error(msg);
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const abrirDetalhes = async (nota) => {
    setNotaSelecionada(nota);
    setLoadingItens(true);
    try {
      const res = await api.get(`estoque/historico-entradas/${encodeURIComponent(nota.numeroNota)}/itens`);
      setItensNota(res.data || []);
    } catch (error) {
      setItensNota([]);
      toast.error("Não foi possível carregar os itens desta nota.");
    } finally {
      setLoadingItens(false);
    }
  };

  const fecharModal = () => {
    setNotaSelecionada(null);
    setItensNota([]);
  };

  const baixarDanfeOficial = async () => {
      if (!notaSelecionada || !notaSelecionada.numeroNota) return;
      setBaixandoDanfe(true);
      const toastId = toast.loading("Buscando DANFE no Servidor...");

      try {
          const res = await api.get(`estoque/historico-entradas/${notaSelecionada.numeroNota}/danfe-oficial`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `DANFE_Entrada_${notaSelecionada.numeroNota}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          toast.update(toastId, { render: "DANFE baixada com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
      } catch (error) {
          toast.update(toastId, { render: "O Servidor não gerou a DANFE em PDF para esta nota.", type: "error", isLoading: false, autoClose: 4000 });
      } finally {
          setBaixandoDanfe(false);
      }
  };

  const entradasFiltradas = entradas.filter(n => {
      if (!busca) return true;
      const termo = busca.toLowerCase();
      const nome = (n.fornecedorNome || '').toLowerCase();
      const numero = (n.numeroNota || '').toLowerCase();
      const chave = (n.chaveAcesso || '').toLowerCase();
      const cnpj = (n.fornecedorCnpj || '').toLowerCase();
      return nome.includes(termo) || numero.includes(termo) || chave.includes(termo) || cnpj.includes(termo);
  });

  const formatarMoeda = (v) => v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  const formatarCnpj = (cnpj) => cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") || '---';

  const formatarData = (d) => {
    if (!d) return "---";
    if (Array.isArray(d)) return `${String(d[2]).padStart(2,'0')}/${String(d[1]).padStart(2,'0')}/${d[0]} ${String(d[3]).padStart(2,'0')}:${String(d[4]||0).padStart(2,'0')}`;
    try {
      const dataObj = new Date(d);
      return dataObj.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return "---"; }
  };

  // Função auxiliar para renderizar a etiqueta da IA de forma segura
  const renderIABadge = (statusIA, vinculoIA) => {
    if (!statusIA) return <span className="ai-badge badge-ok">✅ Estoque Atualizado</span>;

    if (statusIA.includes('[IA_DUPLICADA')) {
        return (
            <div className="tooltip-ia">
                <span className="ai-badge badge-warn">🤖 IA Detectou Semelhança:</span>
                <span className="text-xs font-semibold mobile-truncate">{vinculoIA}</span>
                <div className="tooltip-text">Possível duplicação. Analise se é o mesmo produto: {vinculoIA}</div>
            </div>
        );
    }

    if (statusIA.includes('[NOVO]')) {
        return <span className="ai-badge badge-new">✨ Cadastro Imediato</span>;
    }

    return <span className="ai-badge badge-ok">✅ Estoque Atualizado</span>;
  };

  return (
    <div className="import-hub-container fade-in">
      <header className="hub-header">
         <div>
            <h1 className="hub-title">Central de Recebimento <Sparkles size={24} className="text-primary"/></h1>
            <p className="hub-subtitle">Gestão de estoque via XML com inteligência de auditoria.</p>
         </div>
      </header>

      <section className="hub-upload-section">
         {!isUploading ? (
             <div
                className={`dropzone-area ${isDragging ? 'drag-active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); processarArquivo(e.dataTransfer.files[0]); }}
                onClick={() => fileInputRef.current?.click()}
             >
                <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => processarArquivo(e.target.files[0])} />
                <div className="dropzone-content">
                    <div className="icon-circle"><UploadCloud size={40} /></div>
                    <h2>Arraste o XML da Nota Fiscal</h2>
                    <p>O sistema identificará produtos e fornecedores automaticamente.</p>
                </div>
             </div>
         ) : (
             <div className="uploading-area">
                 <Loader2 size={48} className="spin text-primary" />
                 <h2>Processando Nota Fiscal...</h2>
             </div>
         )}
      </section>

      <section className="hub-history-section">
        <div className="history-header">
            <h3><Package size={18}/> Notas Processadas</h3>
            <div className="history-tools">
                <div className="search-bar-container">
                    <Search size={18} color="var(--text-muted)" />
                    <input
                        type="text"
                        placeholder="Pesquisar Fornecedor, NF ou Chave..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                    {busca && <X size={16} color="var(--text-muted)" style={{cursor: 'pointer'}} onClick={() => setBusca('')} />}
                </div>
                <button className="btn-refresh" onClick={() => { setPagina(0); carregarHistorico(); }} title="Atualizar Lista">
                    <RefreshCw size={20} className={loading ? 'spin' : ''} />
                </button>
            </div>
        </div>

        <div className="table-wrapper custom-scrollbar">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Entrada</th>
                <th>Número NF</th>
                <th>Fornecedor</th>
                <th className="text-center">Volumes</th>
                <th className="text-right">Valor Total</th>
                <th className="text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {entradasFiltradas.length === 0 && !loading ? (
                  <tr>
                      <td colSpan="6" style={{textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontWeight: 600}}>
                          Nenhuma nota encontrada.
                      </td>
                  </tr>
              ) : (
                  entradasFiltradas.map((ent, idx) => (
                    <tr key={idx} className="modern-table-row">
                      <td>{formatarData(ent.dataEntrada)}</td>
                      <td><span className="nfe-badge">{ent.numeroNota}</span></td>
                      <td>
                        <div className="supplier-info">
                            <strong>{ent.fornecedorNome}</strong>
                            <span>{formatarCnpj(ent.fornecedorCnpj)}</span>
                        </div>
                      </td>
                      <td className="text-center font-bold">{ent.qtdItens} un</td>
                      <td className="text-right font-bold text-primary">{formatarMoeda(ent.valorTotal)}</td>
                      <td className="text-center">
                        <button className="btn-view-details" onClick={() => abrirDetalhes(ent)}><Eye size={18} /></button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && !busca && (
            <div className="hub-pagination">
                <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}><ChevronLeft size={18}/> Anterior</button>
                <span>Página {pagina + 1} de {totalPaginas}</span>
                <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}>Próxima <ChevronRight size={18}/></button>
            </div>
        )}
      </section>

      {notaSelecionada && createPortal(
        <div className="modal-overlay">
          <div className="modal-content-resolution slide-up">
            <div className="modal-header-resolution">
              <div className="header-title">
                <FileText size={26} className="text-primary" />
                <div>
                  <h2>Auditoria de Nota: {notaSelecionada.numeroNota}</h2>
                  <span className="text-muted text-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hash size={12}/> {notaSelecionada.chaveAcesso || `ID Lote Base: ${notaSelecionada.id}`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={baixarDanfeOficial} disabled={baixandoDanfe || !notaSelecionada.numeroNota} className="btn-danfe">
                      {baixandoDanfe ? <RefreshCw size={18} className="spin" /> : <DownloadCloud size={18} />}
                      <span className="hide-mobile">Baixar DANFE</span>
                  </button>
                  <button onClick={fecharModal} className="btn-close-modal"><X size={24} /></button>
              </div>
            </div>

            <div className="modal-body-resolution custom-scrollbar">
              <div className="audit-info-grid">
                <div className="info-card-mini">
                  <label><Package size={12}/> Fornecedor</label>
                  <strong>{notaSelecionada.fornecedorNome}</strong>
                  <span>{formatarCnpj(notaSelecionada.fornecedorCnpj)}</span>
                </div>
                <div className="info-card-mini">
                  <label><Calendar size={12}/> Cronologia</label>
                  <small><b>Emissão:</b> {formatarData(getDataEmissaoReal())}</small>
                  <small><b>Entrada:</b> {formatarData(notaSelecionada.dataEntrada)}</small>
                </div>
                <div className="info-card-mini">
                  <label><User size={12}/> Responsável</label>
                  <strong>{notaSelecionada.usuarioNome || "Administrador"}</strong>
                  <span>Status: Importação Concluída</span>
                </div>
                <div className="info-card-mini highlight-blue">
                  <label>Resumo Financeiro</label>
                  <strong className="total-highlight">{formatarMoeda(notaSelecionada.valorTotal)}</strong>
                  <span>{notaSelecionada.qtdItens} volumes integrados</span>
                </div>
              </div>

              <div className="table-wrapper border-table">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th width="35%">Produto Identificado (XML)</th>
                      <th width="30%">Ação no Estoque</th>
                      <th className="text-center">Qtd</th>
                      <th className="text-right">Custo Un.</th>
                      <th className="text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingItens ? (
                       <tr><td colSpan="5" className="text-center py-10"><Loader2 className="spin text-primary" style={{margin: '0 auto'}}/></td></tr>
                    ) : (
                      itensNota.map((item, index) => {
                          const descCompleta = item.produtoDescricao || item.descricaoProduto || item.descricao || "";
                          const partes = descCompleta.split('|').concat(["", "", "", "", ""]);

                          const nomeXML = partes[0] || "Produto na Nota";
                          const statusIA = partes[1] || "";
                          const vinculoIA = partes[2] || "";
                          const eanReal = partes[4] || "S/ GTIN";

                          const qtd = item.quantidadeMovimentada ?? item.quantidade ?? 0;
                          const custoUn = item.custoMovimentado ?? item.custoUnitario ?? item.valorUnitario ?? item.precoCusto ?? 0;
                          const subtotal = Number(qtd) * Number(custoUn);

                          const isGerado = eanReal.startsWith('20') && eanReal.length === 13;
                          const textoEan = isGerado ? `EAN Interno: ${eanReal}` : `EAN: ${eanReal}`;
                          const tooltipEan = isGerado ? "Código gerado automaticamente pelo sistema (Uso Interno)" : "Código Oficial do XML";

                          return (
                              <tr key={item.id || index}>
                                  <td>
                                      <div className="flex-col">
                                          <span className="font-bold text-dark">{nomeXML}</span>
                                          <span className="text-xs text-muted" title={tooltipEan}>
                                              {textoEan}
                                          </span>
                                      </div>
                                  </td>
                                  <td>
                                      {renderIABadge(statusIA, vinculoIA)}
                                  </td>
                                  <td className="text-center font-bold text-success">+ {qtd} un</td>
                                  <td className="text-right font-numeric">{formatarMoeda(custoUn)}</td>
                                  <td className="text-right font-numeric font-bold">{formatarMoeda(subtotal)}</td>
                              </tr>
                          );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HistoricoEntradas;