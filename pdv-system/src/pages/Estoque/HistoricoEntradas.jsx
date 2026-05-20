import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
    FileText, Eye, UploadCloud, X, Package,
    Sparkles, Loader2, User, Calendar,
    Search, RefreshCw, DownloadCloud, Hash, Edit3, Save, Info
} from 'lucide-react';
import './HistoricoEntradas.css';

const HistoricoEntradas = () => {
  const [entradas, setEntradas] = useState([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [itensNota, setItensNota] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [baixandoDanfe, setBaixandoDanfe] = useState(false);

  const [quickEditForm, setQuickEditForm] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [dicionarios, setDicionarios] = useState({ marcas: [], categorias: [], subcategorias: [], relacaoSubCat: {} });

  // Memória do navegador para resolver a "Fotografia do XML"
  const eansAuditados = JSON.parse(localStorage.getItem('eansAuditadosLocal') || '[]');

  useEffect(() => {
    carregarHistorico();
    carregarDicionarios();
  }, [pagina]);

  useEffect(() => {
    if (notaSelecionada || quickEditForm) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [notaSelecionada, quickEditForm]);

  const carregarDicionarios = async () => {
      try {
          const res = await api.get('/produtos/quick-edit/dicionarios');
          setDicionarios({
              marcas: res.data.marcas || [],
              categorias: res.data.categorias || [],
              subcategorias: res.data.subcategorias || [],
              relacaoSubCat: res.data.relacaoSubCat || {}
          });
      } catch (e) { console.error("Erro ao carregar dicionários."); }
  };

  const getMargemColor = (margem) => {
      const m = parseFloat(margem) || 0;
      if (m < 20) return '#ef4444';
      if (m < 40) return '#f59e0b';
      return '#10b981';
  };

  // 🔥 Formatador de Máscara Financeira
  const formatarParaInput = (valorFloat) => {
      if (valorFloat === null || valorFloat === undefined || isNaN(valorFloat)) return "0,00";
      return parseFloat(valorFloat).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const extrairDadosDaDescricao = (nomeXML) => {
      if (!nomeXML) return { marca: '', categoria: '', subcategoria: '' };
      const descUpper = nomeXML.toUpperCase();
      const descTokens = descUpper.split(/\s+/);

      const findSmarterMatch = (lista) => {
          if (!lista || !Array.isArray(lista)) return '';
          const sortedList = [...lista].filter(Boolean).sort((a, b) => b.length - a.length);

          for (const item of sortedList) {
              if (new RegExp(`\\b${item.toUpperCase()}\\b`).test(descUpper)) return item;
          }
          for (const item of sortedList) {
              const itemTokens = item.toUpperCase().split(/\s+/).filter(t => t.length > 3);
              for (const token of itemTokens) {
                  if (descTokens.includes(token)) return item;
              }
          }
          return '';
      };

      const subcatEncontrada = findSmarterMatch(dicionarios.subcategorias);
      let catEncontrada = '';
      if (subcatEncontrada && dicionarios.relacaoSubCat) {
          catEncontrada = dicionarios.relacaoSubCat[subcatEncontrada.toUpperCase()] || '';
      }
      if (!catEncontrada) catEncontrada = findSmarterMatch(dicionarios.categorias);

      return {
          marca: findSmarterMatch(dicionarios.marcas),
          categoria: catEncontrada,
          subcategoria: subcatEncontrada
      };
  };

  const iniciarAuditoria = (item) => {
      const partes = (item.produtoDescricao || "").split('|');
      const nomeXML = partes[0] || "";
      const eanReal = partes[4] || item.ean || "";

      const custo = parseFloat(item.custoMovimentado ?? item.custoUnitario ?? item.vUnCom ?? item.valorUnitario ?? 0) || 0.00;
      const margemInicial = 50.00;
      const precoSugerido = custo * (1 + (margemInicial / 100));

      const inferido = extrairDadosDaDescricao(nomeXML);

      // O estado guarda SEMPRE Float para facilitar os cálculos
      setQuickEditForm({
          idItemNota: item.id || item.ean,
          ean: eanReal,
          descricao: nomeXML,
          marca: inferido.marca,
          categoria: inferido.categoria,
          subcategoria: inferido.subcategoria,
          precoCusto: custo,
          margem: margemInicial,
          precoVenda: precoSugerido
      });
  };

  const handlePrecificacao = (campo, valorDigitado) => {
      // Máscara: Converte o que o usuário digita (ex: "10,505") num número real (105.05)
      const apenasNumeros = valorDigitado.toString().replace(/\D/g, '');
      const valorReal = parseFloat(apenasNumeros) / 100;

      const formAtual = { ...quickEditForm, [campo]: valorReal };

      const custo = formAtual.precoCusto || 0;
      const margem = formAtual.margem || 0;
      const venda = formAtual.precoVenda || 0;

      if (campo === 'precoCusto' || campo === 'margem') {
          formAtual.precoVenda = custo * (1 + (margem / 100));
      } else if (campo === 'precoVenda') {
          formAtual.margem = custo > 0 ? (((venda - custo) / custo) * 100) : 0;
      }
      setQuickEditForm(formAtual);
  };

  const salvarItemAuditoria = async () => {
      setSalvandoEdicao(true);
      try {
          await api.put(`/produtos/quick-edit/ean/${quickEditForm.ean}`, quickEditForm);
          toast.success("Produto auditado com sucesso!");

          // 🔥 RESOLUÇÃO DO BUG: Salva o EAN na memória para não depender da string [NOVO] do Backend
          const novosAuditados = [...eansAuditados, quickEditForm.ean];
          localStorage.setItem('eansAuditadosLocal', JSON.stringify(novosAuditados));

          setItensNota(prev => prev.map(i => {
              if ((i.id || i.ean) === quickEditForm.idItemNota) return { ...i, auditadoVisual: true };
              return i;
          }));

          setQuickEditForm(null);
          carregarDicionarios();
      } catch (error) { toast.error("Erro ao salvar o produto."); }
      finally { setSalvandoEdicao(false); }
  };

  const carregarHistorico = async () => {
      setLoading(true);
      try {
        const res = await api.get(`estoque/historico-entradas?page=${pagina}&size=10`);

        // Ajuste: Se o seu backend não enviar mais o objeto 'content', altere aqui:
        setEntradas(res.data.content || res.data || []);
        setTotalPaginas(res.data.totalPages || 0);

      } catch (error) {
        toast.error(`Erro: ${error.message}`);
      }
      finally { setLoading(false); }
    };

  const processarArquivo = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xml')) { toast.error("Formato inválido. Selecione um XML."); return; }
    setIsUploading(true);
    const formData = new FormData(); formData.append("arquivo", file);
    try {
      await api.post('importacao-xml/receber-nota', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      toast.success("Importação concluída!", { icon: "✨" });
      setPagina(0); carregarHistorico();
    } catch (error) { toast.error("Erro no processamento da Nota Fiscal."); }
    finally { setIsUploading(false); if(fileInputRef.current) fileInputRef.current.value = null; }
  };

  const abrirDetalhes = async (nota) => {
    setNotaSelecionada(nota);
    setLoadingItens(true);
    try {
      const res = await api.get(`estoque/historico-entradas/${encodeURIComponent(nota.numeroNota)}/itens`);
      const itensComFlag = (res.data || []).map(i => ({...i, auditadoVisual: false}));
      setItensNota(itensComFlag);
    } catch (error) { setItensNota([]); toast.error("Falha ao carregar itens."); }
    finally { setLoadingItens(false); }
  };

  const fecharModalSecundario = () => { setQuickEditForm(null); };
  const fecharModalPrincipal = () => { setNotaSelecionada(null); setItensNota([]); setQuickEditForm(null); };

  const baixarDanfeOficial = async () => {
      if (!notaSelecionada || !notaSelecionada.numeroNota) return;
      setBaixandoDanfe(true);
      const toastId = toast.loading("Buscando DANFE no Servidor...");
      try {
          const res = await api.get(`estoque/historico-entradas/${notaSelecionada.numeroNota}/danfe-oficial`, { responseType: 'blob' });
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const link = document.createElement('a'); link.href = url; link.setAttribute('download', `DANFE_${notaSelecionada.numeroNota}.pdf`);
          document.body.appendChild(link); link.click(); link.remove();
          toast.update(toastId, { render: "DANFE baixada com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
      } catch (error) { toast.update(toastId, { render: "O Servidor não gerou a DANFE.", type: "error", isLoading: false, autoClose: 4000 }); }
      finally { setBaixandoDanfe(false); }
  };

  const formatarMoeda = (v) => v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
  const formatarCnpj = (cnpj) => cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") || '---';
  const formatarData = (d) => {
    if (!d) return "---";
    if (Array.isArray(d)) return `${String(d[2]).padStart(2,'0')}/${String(d[1]).padStart(2,'0')}/${d[0]} ${String(d[3]).padStart(2,'0')}:${String(d[4]||0).padStart(2,'0')}`;
    try { return new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch(e) { return "---"; }
  };

  const getDataEmissaoReal = () => {
      if (itensNota.length > 0 && itensNota[0].produtoDescricao && itensNota[0].produtoDescricao.includes('|')) {
          const partes = itensNota[0].produtoDescricao.split('|');
          if (partes.length >= 4) return partes[3];
      }
      return notaSelecionada?.dataEmissao || notaSelecionada?.dataEntrada;
  };

  const renderIABadge = (statusIA, vinculoIA, item, eanReal) => {
    // Cruza a informação visual e a memória do navegador
    const isAuditadoLocal = eansAuditados.includes(eanReal);

    if (item.auditadoVisual || isAuditadoLocal) return <span className="ai-badge badge-ok">✅ Auditado</span>;
    if (!statusIA) return <span className="ai-badge badge-ok">✅ Estoque Atualizado</span>;

    if (statusIA.includes('[IA_DUPLICADA')) {
        return (
            <div className="tooltip-ia">
                <span className="ai-badge badge-warn">🤖 IA Detectou Semelhança:</span>
                <span className="text-xs font-semibold mobile-truncate">{vinculoIA}</span>
            </div>
        );
    }
    if (statusIA.includes('[NOVO]')) {
        return (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start'}}>
                <span className="ai-badge badge-new">✨ Cadastro Imediato</span>
                <button
                    className="btn-quick-edit"
                    onClick={() => iniciarAuditoria(item)}
                    title="Auditar & Precificar"
                >
                    <Edit3 size={14} />
                </button>
            </div>
        );
    }
    return <span className="ai-badge badge-ok">✅ Estoque Atualizado</span>;
  };

  const entradasFiltradas = entradas.filter(n => {
      if (!busca) return true;
      const termo = busca.toLowerCase();
      return (n.fornecedorNome || '').toLowerCase().includes(termo) || (n.numeroNota || '').toLowerCase().includes(termo) || (n.chaveAcesso || '').toLowerCase().includes(termo) || (n.fornecedorCnpj || '').toLowerCase().includes(termo);
  });

  const pendencias = itensNota.filter(i => {
      const ean = (i.produtoDescricao || "").split('|')[4] || i.ean;
      return (i.produtoDescricao || "").includes('[NOVO]') && !i.auditadoVisual && !eansAuditados.includes(ean);
  }).length;

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
             <div className={`dropzone-area ${isDragging ? 'drag-active' : ''}`} onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); processarArquivo(e.dataTransfer.files[0]); }} onClick={() => fileInputRef.current?.click()} >
                <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => processarArquivo(e.target.files[0])} />
                <div className="dropzone-content">
                    <div className="icon-circle"><UploadCloud size={40} /></div>
                    <h2>Arraste o XML da Nota Fiscal</h2>
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
                    <input type="text" placeholder="Pesquisar NF, Fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                    {busca && <X size={16} color="var(--text-muted)" style={{cursor: 'pointer'}} onClick={() => setBusca('')} />}
                </div>
                <button className="btn-refresh" onClick={() => { setPagina(0); carregarHistorico(); }}><RefreshCw size={20} className={loading ? 'spin' : ''} /></button>
            </div>
        </div>

        <div className="table-wrapper custom-scrollbar">
          <table className="modern-table">
            <thead>
              <tr><th>Entrada</th><th>Número NF</th><th>Fornecedor</th><th className="text-center">Volumes</th><th className="text-right">Valor Total</th><th className="text-center">Ações</th></tr>
            </thead>
            <tbody>
              {entradasFiltradas.length === 0 && !loading ? (
                  <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>Nenhuma nota encontrada.</td></tr>
              ) : (
                  entradasFiltradas.map((ent, idx) => (
                    <tr key={idx} className="modern-table-row">
                      <td>{formatarData(ent.dataEntrada)}</td>
                      <td><span className="nfe-badge">{ent.numeroNota}</span></td>
                      <td>
                        <div className="supplier-info"><strong>{ent.fornecedorNome}</strong><span>{formatarCnpj(ent.fornecedorCnpj)}</span></div>
                      </td>
                      <td className="text-center font-bold">{ent.qtdItens} un</td>
                      <td className="text-right font-bold text-primary">{formatarMoeda(ent.valorTotal)}</td>
                      <td className="text-center"><button className="btn-view-details" onClick={() => abrirDetalhes(ent)}><Eye size={18} /></button></td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PORTAL DO MODAL PRINCIPAL DE AUDITORIA */}
      {notaSelecionada && createPortal(
        <div className="modal-overlay">
          <div className="modal-content-resolution slide-up">

            <div className="modal-header-resolution">
              <div className="header-title">
                <FileText size={26} className="text-primary" />
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <h2>Auditoria da Nota: {notaSelecionada.numeroNota}</h2>
                      {pendencias > 0 && <span className="badge-pending">{pendencias} Pendentes</span>}
                  </div>
                  <span className="text-muted text-xs"><Hash size={12}/> {notaSelecionada.chaveAcesso}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={baixarDanfeOficial} disabled={baixandoDanfe} className="btn-danfe"><DownloadCloud size={18} /><span className="hide-mobile">Baixar DANFE</span></button>
                  <button onClick={fecharModalPrincipal} className="btn-close-modal"><X size={24} /></button>
              </div>
            </div>

            <div className="modal-body-resolution custom-scrollbar">
              <div className="audit-info-grid">
                <div className="info-card-mini">
                  <label><Package size={12}/> Fornecedor</label><strong>{notaSelecionada.fornecedorNome}</strong><span>{formatarCnpj(notaSelecionada.fornecedorCnpj)}</span>
                </div>
                <div className="info-card-mini">
                  <label><Calendar size={12}/> Cronologia</label><small><b>Emissão:</b> {formatarData(getDataEmissaoReal())}</small><small><b>Entrada:</b> {formatarData(notaSelecionada.dataEntrada)}</small>
                </div>
                <div className="info-card-mini">
                  <label><User size={12}/> Responsável</label><strong>{notaSelecionada.usuarioNome || "Administrador"}</strong><span>Status: Integração Concluída</span>
                </div>
                <div className="info-card-mini highlight-blue">
                  <label>Resumo Financeiro</label><strong className="total-highlight">{formatarMoeda(notaSelecionada.valorTotal)}</strong><span>{notaSelecionada.qtdItens} volumes integrados</span>
                </div>
              </div>

              <div className="table-wrapper border-table">
                <table className="modern-table">
                  <thead><tr><th width="35%">Produto (XML)</th><th width="30%">Ação Estoque</th><th className="text-center">Qtd</th><th className="text-right">Custo Un.</th><th className="text-right">Subtotal</th></tr></thead>
                  <tbody>
                    {loadingItens ? (<tr><td colSpan="5" className="text-center py-10"><Loader2 className="spin text-primary" style={{margin: '0 auto'}}/></td></tr>) : (
                      itensNota.map((item, index) => {
                          const partes = (item.produtoDescricao || "").split('|').concat(["", "", "", "", ""]);
                          const statusIA = partes[1] || "";
                          const vinculoIA = partes[2] || "";
                          const eanReal = partes[4] || item.ean || "S/ GTIN";
                          const isGerado = eanReal.startsWith('20') && eanReal.length === 13;

                          const qtd = item.quantidadeMovimentada ?? item.quantidade ?? item.qCom ?? item.quantidadeComercial ?? 0;
                          const custoUn = item.custoMovimentado ?? item.custoUnitario ?? item.vUnCom ?? item.valorUnitario ?? 0;
                          const subtotal = qtd * custoUn;

                          return (
                              <tr key={item.id || index} style={{ background: item.auditadoVisual || eansAuditados.includes(eanReal) ? '#f8fafc' : 'inherit' }}>
                                  <td>
                                      <div className="flex-col">
                                          <span className="font-bold text-dark">{partes[0] || "Produto"}</span>
                                          <span className="text-xs text-muted">{isGerado ? `EAN Interno: ${eanReal}` : `EAN: ${eanReal}`}</span>
                                      </div>
                                  </td>
                                  <td>{renderIABadge(statusIA, vinculoIA, item, eanReal)}</td>
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

          {/* 🔥 MODAL SOBREPOSTO DE PRECIFICAÇÃO (ESTAÇÃO DE AUDITORIA) */}
          {quickEditForm && (
              <div className="quick-edit-overlay slide-up">
                  <div className="quick-edit-card shadow-lg">
                      <div className="quick-edit-header" style={{background: '#f8fafc', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between'}}>
                          <h3 style={{margin: 0, color: '#0f172a'}}>Estação de Auditoria Individual</h3>
                          <button onClick={fecharModalSecundario} style={{background:'none', border:'none', cursor:'pointer'}}><X size={18}/></button>
                      </div>

                      <div className="quick-edit-body" style={{padding: '20px'}}>
                          <div className="form-group" style={{marginBottom: '16px'}}>
                              <label>Descrição Original do XML</label>
                              <input type="text" value={quickEditForm.descricao} onChange={e => setQuickEditForm({...quickEditForm, descricao: e.target.value})} style={{background: '#f1f5f9'}} />
                          </div>

                          <div className="form-row-2">
                              <div className="form-group">
                                  <label>Marca</label>
                                  <input placeholder="Digite ou selecione..." list="lista-marcas" value={quickEditForm.marca} onChange={e => setQuickEditForm({...quickEditForm, marca: e.target.value})} onDoubleClick={e => e.target.value=''} />
                                  <span className="helper-text">💡 Dê duplo clique para ver a lista</span>
                                  <datalist id="lista-marcas">{dicionarios.marcas.map((m, i) => m && <option key={i} value={m} />)}</datalist>
                              </div>
                              <div className="form-group">
                                  <label>Categoria</label>
                                  <input placeholder="Digite ou selecione..." list="lista-categorias" value={quickEditForm.categoria} onChange={e => setQuickEditForm({...quickEditForm, categoria: e.target.value})} onDoubleClick={e => e.target.value=''} />
                                  <span className="helper-text">💡 Dê duplo clique para ver a lista</span>
                                  <datalist id="lista-categorias">{dicionarios.categorias.map((c, i) => c && <option key={i} value={c} />)}</datalist>
                              </div>
                              <div className="form-group">
                                  <label>Subcategoria</label>
                                  <input placeholder="Digite ou selecione..." list="lista-subcategorias" value={quickEditForm.subcategoria} onChange={e => setQuickEditForm({...quickEditForm, subcategoria: e.target.value})} onDoubleClick={e => e.target.value=''} />
                                  <span className="helper-text">💡 Dê duplo clique para ver a lista</span>
                                  <datalist id="lista-subcategorias">{dicionarios.subcategorias.map((s, i) => s && <option key={i} value={s} />)}</datalist>
                              </div>
                          </div>

                          <div className="form-row-3">
                              <div className="form-group">
                                  <label>Custo Unitário</label>
                                  <div className="input-masked">
                                      <span className="prefix">R$</span>
                                      <input type="text" value={formatarParaInput(quickEditForm.precoCusto)} onChange={e => handlePrecificacao('precoCusto', e.target.value)} />
                                  </div>
                              </div>
                              <div className="form-group">
                                  <label>Margem / Markup</label>
                                  <div className="input-masked">
                                      <input type="text" value={formatarParaInput(quickEditForm.margem)} onChange={e => handlePrecificacao('margem', e.target.value)} style={{color: getMargemColor(quickEditForm.margem), fontWeight: 'bold'}} />
                                      <span className="suffix">%</span>
                                  </div>
                              </div>
                              <div className="form-group">
                                  <label>Preço Venda</label>
                                  <div className="input-masked">
                                      <span className="prefix">R$</span>
                                      <input type="text" value={formatarParaInput(quickEditForm.precoVenda)} onChange={e => handlePrecificacao('precoVenda', e.target.value)} style={{color: '#2563eb', fontWeight: 'bold'}} />
                                  </div>
                              </div>
                          </div>

                          <div style={{display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px'}}>
                              <button className="btn-cancelar" onClick={fecharModalSecundario}>Cancelar</button>
                              <button className="btn-salvar" onClick={salvarItemAuditoria} disabled={salvandoEdicao}>
                                  {salvandoEdicao ? <Loader2 size={16} className="spin"/> : <Save size={16}/>}
                                  Confirmar Item
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default HistoricoEntradas;