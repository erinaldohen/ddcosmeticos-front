import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { maskCNPJ } from '../../utils/masks';
import {
  Search, RefreshCw, ArrowRight, CheckCircle,
  FileText, Calendar, DollarSign, Building,
  DownloadCloud, Filter, Inbox, Package,
  X, AlertTriangle, Link as LinkIcon, Edit3, Wand2, Link2
} from 'lucide-react';

import './GestaoNotasSefaz.css';

// ============================================================================
// 🧠 HELPERS & INTELIGÊNCIA ARTIFICIAL
// ============================================================================
const extrairNumeroNota = (chave) => {
    if (!chave || chave.length !== 44) return "S/N";
    return parseInt(chave.substring(25, 34), 10).toString();
};

const limparTexto = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().replace(/\s+/g, ' ').trim();
};

const calcularSimilaridade = (nomeXml, nomeDb) => {
    const tokensXml = limparTexto(nomeXml).split(' ').filter(t => t.length > 1);
    const tokensDb = limparTexto(nomeDb).split(' ').filter(t => t.length > 1);
    if (tokensXml.length === 0 || tokensDb.length === 0) return 0;
    let palavrasEmComum = 0;
    tokensXml.forEach(palavraXml => {
        const encontrou = tokensDb.some(palavraDb =>
            palavraDb === palavraXml || (palavraXml.length >= 4 && palavraDb.includes(palavraXml)) || (palavraDb.length >= 4 && palavraXml.includes(palavraDb))
        );
        if (encontrou) palavrasEmComum++;
    });
    return palavrasEmComum / Math.min(tokensXml.length, tokensDb.length);
};

const inferirDadosFiscais = (xmlItem, fornecedorNome) => {
    let marca = "GENERICA";
    const nomeUpper = fornecedorNome?.toUpperCase() || "";
    if (nomeUpper.includes("EUDORA")) marca = "EUDORA";
    else if (nomeUpper.includes("BOTICARIO")) marca = "BOTICARIO";
    else if (nomeUpper.includes("NATURA")) marca = "NATURA";
    else if (nomeUpper.includes("AVON")) marca = "AVON";

    const ncm = xmlItem.ncm ? xmlItem.ncm.replace(/\./g, '') : '00000000';
    let fiscal = { csosn: '102', pisCofins: '01' };
    if (ncm.startsWith('3401')) fiscal = { csosn: '500', pisCofins: '04' };

    const prefixo = ncm.substring(0, 4);
    const mapa = { '3303': 'PERFUMARIA', '3304': 'MAQUIAGEM', '3305': 'CAPILAR', '3307': 'CORPO E BANHO' };
    return { marca, categoria: mapa[prefixo] || "GERAL", fiscal };
};

const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 4000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
  } catch (error) {
      clearTimeout(id);
      throw error;
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const GestaoNotasSefaz = () => {

  // --- ESTADOS DA LISTA BASE ---
  const [todasNotas, setTodasNotas] = useState([]);
  const [notasExibidas, setNotasExibidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [listaProdutosDb, setListaProdutosDb] = useState([]);
  const itensPorPagina = 15;
  const [paginaAtual, setPaginaAtual] = useState(0);

  // --- ESTADOS DE FILTROS ---
  const [chaveBusca, setChaveBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // --- ESTADOS DO MODAL DE IMPORTAÇÃO ---
  const [modalAberto, setModalAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [itensImportacao, setItensImportacao] = useState([]);
  const [fornecedorResolvido, setFornecedorResolvido] = useState(null);

  // Controles de Busca no Modal
  const [searchState, setSearchState] = useState({ rowIndex: null, term: '', results: [] });

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    const init = async () => {
        try {
            const resProd = await api.get('/produtos?size=5000');
            setListaProdutosDb(resProd.data?.content || resProd.data || []);
        } catch(e) { console.error("Erro produtos:", e); }
        carregarNotasDoBackend();
    };
    init();
  }, [dataInicio, dataFim]);

  // 2. PAGINAÇÃO LOCAL
  useEffect(() => {
      if (!Array.isArray(todasNotas)) return;
      const inicio = paginaAtual * itensPorPagina;
      const fim = inicio + itensPorPagina;
      setNotasExibidas(todasNotas.slice(inicio, fim));
  }, [todasNotas, paginaAtual]);


  const carregarNotasDoBackend = async () => {
    setLoading(true);
    try {
      let url = `/estoque/notas-pendentes`;
      if (dataInicio && dataFim) url += `?dataInicio=${dataInicio}&dataFim=${dataFim}`;

      const res = await api.get(url);
      let dadosExtraidos = [];
      if (Array.isArray(res.data)) dadosExtraidos = res.data;
      else if (res.data?.content) dadosExtraidos = res.data.content;
      else if (res.data?.data) dadosExtraidos = res.data.data;
      else if (res.data?.id) dadosExtraidos = [res.data];

      setTodasNotas(dadosExtraidos);
      setPaginaAtual(0);
    } catch (error) {
      toast.error("Não foi possível carregar o histórico de notas.");
      setTodasNotas([]);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarSefaz = async () => {
    setSyncing(true);
    toast.dismiss();
    const toastId = toast.loading("Consultando a SEFAZ... (Pode demorar uns segundos)");
    try {
      await api.post('/estoque/notas-pendentes/sincronizar');
      toast.update(toastId, { render: "Sincronização concluída!", type: "success", isLoading: false, autoClose: 3000 });
      carregarNotasDoBackend();
    } catch (error) {
      toast.update(toastId, { render: error.response?.data || "Comunicação bloqueada temporariamente pela SEFAZ.", type: "warning", isLoading: false, autoClose: 6000 });
      carregarNotasDoBackend();
    } finally {
      setSyncing(false);
    }
  };

  const buscarPorChave = async (e) => {
    e.preventDefault();
    const chaveLimpa = chaveBusca.replace(/\D/g, '');
    if (!chaveLimpa) { carregarNotasDoBackend(); return; }
    if (chaveLimpa.length !== 44) return toast.warn("A Chave deve conter 44 números.");

    setLoading(true);
    try {
      const res = await api.get(`/estoque/notas-pendentes/chave/${chaveLimpa}`);
      if (res.data) {
        setTodasNotas([res.data]);
        setPaginaAtual(0);
        toast.success("Nota localizada com sucesso!");
      } else {
        setTodasNotas([]);
        toast.info("Nota não sincronizada no sistema.");
      }
    } catch (error) {
      toast.error("Erro ao buscar a nota.");
      setTodasNotas([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // FLUXO DO MODAL DE IMPORTAÇÃO
  // ============================================================================
  const abrirModalImportacao = async (nota) => {
      // 1. Abre a UI imediatamente em modo loading
      setNotaSelecionada(nota);
      setModalAberto(true);
      setLoadingModal(true);
      setItensImportacao([]);
      setFornecedorResolvido(null);

      // 2. Se a nota é resumo, pede o XML antes
      let idTratar = nota.id;
      if (nota.status === 'PENDENTE_MANIFESTACAO') {
          try {
              toast.info("A baixar o XML completo na SEFAZ...");
              await api.post(`/estoque/notas-pendentes/${nota.id}/manifestar`);
          } catch (e) {
              setModalAberto(false);
              return toast.error("A SEFAZ recusou o download do XML agora. Tente mais tarde.");
          }
      }

      // 3. Lê o Parse do Backend
      try {
          const res = await api.get(`/estoque/notas-pendentes/${idTratar}/xml-parse`);
          const { cnpjFornecedor, razaoSocialFornecedor, itensXml } = res.data;

          // 4. Resolve o Fornecedor (Proteção)
          let fornIdFinal = res.data.fornecedorId;
          if (cnpjFornecedor) {
               const novoForn = await resolverFornecedorSeguro(cnpjFornecedor, razaoSocialFornecedor || nota.nomeFornecedor);
               if(novoForn) {
                   fornIdFinal = novoForn.id;
                   setFornecedorResolvido({ id: novoForn.id, nome: novoForn.razaoSocial || novoForn.nomeFantasia, cnpj: cnpjFornecedor });
               }
          }

          // 5. Inteligência de Produtos
          const itensProcessados = processarInteligenciaProdutos(itensXml || [], razaoSocialFornecedor || nota.nomeFornecedor);
          setItensImportacao(itensProcessados);

      } catch (err) {
          console.error("Erro na abertura do modal:", err);
          toast.error("Erro ao processar os dados do XML. O arquivo pode estar corrompido.");
          setModalAberto(false);
      } finally {
          setLoadingModal(false);
      }
  };

  const resolverFornecedorSeguro = async (cnpjDescoberto, razaoNome) => {
        const docLimpo = cnpjDescoberto.replace(/\D/g, '');
        let idExistente = null;

        try {
            const resLocal = await api.get(`/fornecedores/buscar-por-cnpj/${docLimpo}`);
            if (resLocal.data?.id && !resLocal.data?.razaoSocial?.includes('FORNECEDOR NOVO')) {
                return resLocal.data;
            }
            if (resLocal.data?.id) idExistente = resLocal.data.id;
        } catch (e) {}

        let payload = {
            cnpj: docLimpo,
            razaoSocial: razaoNome ? razaoNome.substring(0, 200) : `FORNECEDOR ${docLimpo}`,
            nomeFantasia: razaoNome ? razaoNome.substring(0, 200) : `FORNECEDOR ${docLimpo}`,
            inscricaoEstadual: "ISENTO", email: "nfe@fornecedor.com", telefone: "00000000000",
            cep: "00000000", logradouro: "DADOS DA NOTA", numero: "SN", bairro: "CENTRO",
            cidade: "NÃO INFORMADA", uf: "EX", ativo: true
        };

        try {
            const resApi = await fetchWithTimeout(`https://publica.cnpj.ws/cnpj/${docLimpo}`, { timeout: 3000 });
            if (resApi.ok) {
                const data = await resApi.json();
                payload.razaoSocial = data.razao_social || payload.razaoSocial;
                payload.nomeFantasia = data.estabelecimento?.nome_fantasia || payload.nomeFantasia;
            }
        } catch (e) {}

        try {
            if (idExistente) return (await api.put(`/fornecedores/${idExistente}`, payload)).data;
            return (await api.post('/fornecedores', payload)).data;
        } catch(e) { return null; }
  };

  const processarInteligenciaProdutos = (itensXml, fornecedorNome) => {
      const dbSearch = listaProdutosDb || [];
      return itensXml.map(xmlItem => {
          const fiscal = inferirDadosFiscais(xmlItem, fornecedorNome);

          if (dbSearch.length > 0) {
              const matchEan = dbSearch.find(db => db.codigoBarras && xmlItem.codigoBarras && db.codigoBarras.length > 7 && String(db.codigoBarras) === String(xmlItem.codigoBarras));
              if (matchEan) return { ...xmlItem, idProduto: matchEan.id, descricao: matchEan.descricao, status: 'vinculado', match: matchEan, estoqueAtual: matchEan.quantidadeEmEstoque || 0, ...fiscal, confianca: '100% (EAN)' };

              let melhor = null;
              let maiorScore = 0;
              dbSearch.forEach(db => {
                  let score = calcularSimilaridade(xmlItem.descricao, db.descricao);
                  if (score > 0.4 && db.ncm === xmlItem.ncm) score += 0.2;
                  if (score > maiorScore) { maiorScore = score; melhor = db; }
              });

              if (maiorScore >= 0.65 && melhor) return { ...xmlItem, idProduto: null, status: 'semelhante', match: melhor, estoqueAtual: 0, ...fiscal, confianca: `${Math.round(maiorScore * 100)}% (IA)` };
          }
          return { ...xmlItem, idProduto: null, status: 'novo', match: null, estoqueAtual: 0, ...fiscal, confianca: '0%' };
      });
  };

  // Funções de Interação da Tabela do Modal
  const atualizarCampoItem = (index, campo, valor) => {
      const lista = [...itensImportacao];
      lista[index][campo] = campo === 'descricao' ? valor.toUpperCase() : valor;
      setItensImportacao(lista);
  };

  const gerarEanNoModal = async (index) => {
      try {
          const novoEan = await produtoService.gerarEanInterno();
          atualizarCampoItem(index, 'codigoBarras', novoEan);
          toast.info("EAN Gerado.");
      } catch(e) { toast.error("Erro ao gerar EAN."); }
  };

  const vincularSugestao = (index, dbProd) => {
      const lista = [...itensImportacao];
      lista[index] = { ...lista[index], idProduto: dbProd.id, descricao: dbProd.descricao, codigoBarras: dbProd.codigoBarras, status: 'vinculado', estoqueAtual: dbProd.quantidadeEmEstoque || 0 };
      setItensImportacao(lista);
      setSearchState({ rowIndex: null, term: '', results: [] });
  };

  const confirmarEntradaModal = async () => {
      if (!fornecedorResolvido?.id) return toast.warn("Erro: Fornecedor não estabelecido no banco.");
      if (itensImportacao.some(i => i.status === 'semelhante')) return toast.warn("Resolva os itens com ATENÇÃO primeiro.");
      if (itensImportacao.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) return toast.warn("Produtos novos precisam de EAN.");

      setLoadingModal(true);
      try {
          await api.post('/estoque/entrada', {
              fornecedorId: fornecedorResolvido.id,
              numeroDocumento: extrairNumeroNota(notaSelecionada?.chaveAcesso),
              dataVencimento: notaSelecionada?.dataEmissao?.split('T')[0] || new Date().toISOString().split('T')[0],
              itens: itensImportacao.map(i => ({
                  produtoId: i.idProduto, codigoBarras: i.codigoBarras || "S/N",
                  descricao: i.descricao, quantidade: i.quantidade || 0, valorUnitario: i.precoCusto || 0,
                  ncm: i.ncm || "00000000", origem: i.origem || '0', cst: i.fiscal?.csosn || i.cst || '102',
                  marca: i.marca || 'GENERICA', categoria: i.categoria || 'GERAL', unidade: 'UN'
              }))
          });
          await api.post(`/estoque/notas-pendentes/${notaSelecionada.id}/importar`);
          toast.success("Estoque Atualizado com Sucesso!");
          setModalAberto(false);
          carregarNotasDoBackend(); // Recarrega a lista para mostrar o novo status
      } catch(e) {
          toast.error("Erro ao registrar a entrada. Verifique sua conexão.");
      } finally {
          setLoadingModal(false);
      }
  };

  const getStatusBadge = (status) => {
      switch(status) {
          case 'IMPORTADA':
          case 'CONCLUIDA':
              return <span className="badge-status importada"><CheckCircle size={14}/> ESTOQUE ATUALIZADO</span>;
          case 'PENDENTE_MANIFESTACAO':
              return <span className="badge-status resumo"><DownloadCloud size={14}/> AGUARDANDO XML (SEFAZ)</span>;
          case 'PENDENTE':
          default:
              return <span className="badge-status pendente"><Package size={14}/> PRONTA PARA IMPORTAR</span>;
      }
  };

  const totalPaginasCalculado = Math.max(1, Math.ceil(todasNotas.length / itensPorPagina));

  // Cálculo seguro usando o ?. para não crachar se o array vier vazio ou mal formatado
  const totalGeralModal = itensImportacao?.reduce((a, b) => a + (Number(b?.total) || 0), 0) || 0;

  return (
    <div className="gestao-notas-container">

      {/* HEADER DA PÁGINA */}
      <div className="gns-header">
        <div className="gns-header-left">
            <div className="gns-icon-box">
                <Inbox size={36} color="#60a5fa" />
            </div>
            <div>
              <h1>Caixa de Entrada Fiscal</h1>
              <p>Painel unificado de faturamentos emitidos para a sua loja.</p>
            </div>
        </div>

        <button onClick={sincronizarSefaz} disabled={syncing} className={`btn-sync ${!syncing ? 'active' : ''}`}>
          <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Puxar Novas Notas (SEFAZ)"}
        </button>
      </div>

      {/* ÁREA DE FILTROS E BUSCA */}
      <div className="gns-filters-grid">
          <div className="filter-card">
            <h3><Search size={18} color="#3b82f6"/> Busca por Chave</h3>
            <form onSubmit={buscarPorChave} className="form-busca">
              <div className="input-wrapper">
                <Search size={18} className="icon-busca" />
                <input
                    type="text" placeholder="Ex: 262301123..."
                    value={chaveBusca} onChange={(e) => setChaveBusca(e.target.value)} maxLength={44}
                    className="search-input"
                />
              </div>
              <button type="submit" className="btn-search">Localizar</button>
            </form>
          </div>

          <div className="filter-card">
            <div className="filter-header">
                <h3><Filter size={18} color="#f59e0b"/> Filtrar por Emissão</h3>
                {(dataInicio || dataFim) && (<button onClick={() => { setDataInicio(''); setDataFim(''); }} className="btn-clear-filter">Limpar</button>)}
            </div>
            <div className="date-inputs-wrapper">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="date-input" />
                <span className="date-separator">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="date-input" />
            </div>
          </div>
      </div>

      {/* LISTAGEM DE NOTAS */}
      {loading ? (
        <div className="state-container loading">
          <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', marginBottom: '15px', color: '#3b82f6' }} />
          <h2>Processando Histórico...</h2>
        </div>
      ) : notasExibidas.length === 0 ? (
        <div className="state-container empty">
          <FileText size={48} style={{ color: '#cbd5e1', margin: '0 auto', marginBottom: '20px' }} />
          <h2>Nenhuma nota encontrada.</h2>
          <p>Clique em <strong>"Puxar Novas Notas"</strong> para verificar a SEFAZ.</p>
        </div>
      ) : (
        <div className="notas-list">
          {notasExibidas.map((nota) => {
            const isImportada = nota.status === 'IMPORTADA' || nota.status === 'CONCLUIDA';
            const isResumo = nota.status === 'PENDENTE_MANIFESTACAO';

            return (
              <div key={nota.id} className={`nota-card ${isImportada ? 'importada' : isResumo ? 'resumo' : 'pendente'}`}>
                <div className="nota-info">
                  <div className="nota-info-header">
                    <span className="badge-nfe">NF-e {extrairNumeroNota(nota.chaveAcesso)}</span>
                    {getStatusBadge(nota.status)}
                  </div>
                  <strong className="fornecedor-nome">
                    <Building size={18} color="#64748b"/>
                    {nota.nomeFornecedor || "FORNECEDOR NÃO IDENTIFICADO"}
                  </strong>

                  {/* 🔥 CORREÇÃO VISUAL: RÓTULOS DE CNPJ E CHAVE ALINHADOS 🔥 */}
                  <div className="nota-meta" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <span className="meta-cnpj" style={{ color: '#475569' }}><strong>CNPJ:</strong> {maskCNPJ(nota.cnpjFornecedor)}</span>
                    <span className="meta-chave" style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', wordBreak: 'break-all' }}>
                        <strong style={{ color: '#94a3b8' }}>CHAVE:</strong> {nota.chaveAcesso}
                    </span>
                  </div>

                </div>

                <div className="nota-valores">
                  <div className="valor-box">
                    <div className="icon-box-gray"><Calendar size={16} color="#64748b"/></div>
                    <div>
                      <span className="valor-label">Emissão</span>
                      <span className="valor-data">{nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="valor-box">
                    <div className="icon-box-green"><DollarSign size={16} color="#10b981"/></div>
                    <div>
                      <span className="valor-label">Total</span>
                      <span className="valor-monetario">R$ {nota.valorTotal ? nota.valorTotal.toFixed(2).replace('.',',') : '0,00'}</span>
                    </div>
                  </div>
                </div>

                <div className="nota-acoes">
                  {isImportada ? (
                    <button disabled className="btn-acao disabled"><CheckCircle size={18} /> Cadastrada</button>
                  ) : (
                    <button onClick={() => abrirModalImportacao(nota)} className={`btn-acao ${isResumo ? 'resumo' : 'importar'}`}>
                      {isResumo ? <DownloadCloud size={18} /> : <Package size={18} />}
                      {isResumo ? "Baixar XML" : "Processar Entrada"} <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && totalPaginasCalculado > 1 && (
        <div className="paginacao">
            <button onClick={() => setPaginaAtual(p => Math.max(0, p - 1))} disabled={paginaAtual === 0} className={`btn-page ${paginaAtual === 0 ? '' : 'active'}`}>Anterior</button>
            <span className="paginacao-info">Página {paginaAtual + 1} de {totalPaginasCalculado}</span>
            <button onClick={() => setPaginaAtual(p => Math.min(totalPaginasCalculado - 1, p + 1))} disabled={paginaAtual >= totalPaginasCalculado - 1} className={`btn-page ${paginaAtual >= totalPaginasCalculado - 1 ? '' : 'active'}`}>Próxima</button>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL GIGANTE DE IMPORTAÇÃO (O NOVO FLUXO ELEGANTE) */}
      {/* ============================================================================ */}
      {modalAberto && (
          <div className="modal-overlay fade-in">
              <div className="modal-card import-modal bounce-in">

                  {/* HEADER DO MODAL */}
                  <div className="modal-header-premium">
                      <div>
                          <h2>Auditoria e Importação</h2>
                          <p>NF-e {extrairNumeroNota(notaSelecionada?.chaveAcesso)} - {notaSelecionada?.nomeFornecedor || "Fornecedor"}</p>
                      </div>
                      <button className="btn-close-modal" onClick={() => setModalAberto(false)}><X size={24}/></button>
                  </div>

                  {/* BODY DO MODAL */}
                  <div className="modal-body-premium">
                      {loadingModal ? (
                          <div className="state-container loading">
                              <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto 15px', color: '#3b82f6' }} />
                              <h3>Lendo XML e Aplicando Inteligência Artificial...</h3>
                          </div>
                      ) : (
                          <div className="table-responsive modal-table-area">
                              <table className="tabela-padrao modern-table">
                                  <thead>
                                      <tr>
                                          <th width="15%">Status / IA</th>
                                          <th width="45%">Produto do Fornecedor</th>
                                          <th width="20%">Valores e Qtd</th>
                                          <th width="20%">Ação Requerida</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {itensImportacao.map((item, idx) => (
                                          <tr key={idx} className={`tr-${item.status}`}>
                                              <td className="td-status">
                                                  {item.status === 'vinculado' && <span className="badge-status importada"><CheckCircle size={14}/> VINCULADO</span>}
                                                  {item.status === 'semelhante' && <span className="badge-status resumo"><AlertTriangle size={14}/> ATENÇÃO</span>}
                                                  {item.status === 'novo' && <span className="badge-status pendente"><Package size={14}/> NOVO</span>}
                                              </td>

                                              <td>
                                                  {item.status === 'novo' ? (
                                                      <div className="novo-produto-form">
                                                          <input value={item.descricao} onChange={(e) => atualizarCampoItem(idx, 'descricao', e.target.value)} className="input-elegante" placeholder="Nome para o seu sistema"/>
                                                          <div className="ean-generator">
                                                              <input value={item.codigoBarras} onChange={(e) => atualizarCampoItem(idx, 'codigoBarras', e.target.value)} className="input-elegante" placeholder="EAN / Código"/>
                                                              <button onClick={() => gerarEanNoModal(idx)} className="btn-magic" title="Gerar Código Automático"><Wand2 size={16}/></button>
                                                          </div>
                                                      </div>
                                                  ) : (
                                                      <div className="produto-leitura">
                                                          <strong>{item.descricao}</strong>
                                                          <div className="prod-meta">
                                                              <span><Barcode size={12}/> {item.codigoBarras}</span>
                                                              <span><FileText size={12}/> NCM: {item.ncm}</span>
                                                          </div>
                                                      </div>
                                                  )}
                                              </td>

                                              <td className="td-valores">
                                                  <span className="qtd-badge">{item.quantidade} UN</span>
                                                  <span className="unit-cost">R$ {Number(item.precoCusto).toFixed(2)} / un</span>
                                                  <strong className="total-cost">Total: R$ {item.total?.toFixed(2)}</strong>
                                              </td>

                                              <td>
                                                  {item.status === 'semelhante' && (
                                                      <div className="card-sugestao-ia">
                                                          <span className="ia-label">IA Sugere ({item.confianca}):</span>
                                                          <strong>{item.match?.descricao}</strong>
                                                          <button onClick={() => vincularSugestao(idx, item.match)} className="btn-aceitar-sugestao"><LinkIcon size={14}/> Confirmar Vínculo</button>
                                                      </div>
                                                  )}
                                                  {item.status === 'vinculado' && (
                                                      <span className="txt-sucesso-ia"><CheckCircle size={14}/> Pronto ({item.confianca})</span>
                                                  )}
                                                  {item.status === 'novo' && (
                                                      <span className="txt-info-novo"><Package size={14}/> Será criado no estoque.</span>
                                                  )}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      )}
                  </div>

                  {/* FOOTER DO MODAL */}
                  {!loadingModal && (
                      <div className="modal-footer-premium">
                          <div className="resumo-financeiro">
                              <span>Total da Nota:</span>
                              <strong>R$ {totalGeralModal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                          </div>
                          <button className="btn-confirmar-gigante" onClick={confirmarEntradaModal}>
                              <Save size={20}/> Confirmar Entrada de Estoque
                          </button>
                      </div>
                  )}

              </div>
          </div>
      )}
    </div>
  );
};

export default GestaoNotasSefaz;