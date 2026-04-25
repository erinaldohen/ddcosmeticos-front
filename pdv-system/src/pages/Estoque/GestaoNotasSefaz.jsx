import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { maskCNPJ } from '../../utils/masks';
import {
  Search, RefreshCw, ArrowRight, CheckCircle,
  FileText, Calendar, DollarSign, Building,
  DownloadCloud, Filter, Inbox, Package,
  X, AlertTriangle, Link as LinkIcon, Wand2, Link2, Save, Barcode
} from 'lucide-react';

import './GestaoNotasSefaz.css';

// ============================================================================
// 🧠 HELPERS FISCAIS E I.A.
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

  const navigate = useNavigate();
  const location = useLocation();

  // Estados Base
  const [todasNotas, setTodasNotas] = useState([]);
  const [notasExibidas, setNotasExibidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [listaProdutosDb, setListaProdutosDb] = useState([]);
  const [listaFornecedores, setListaFornecedores] = useState([]);

  const itensPorPagina = 15;
  const [paginaAtual, setPaginaAtual] = useState(0);

  // Filtros
  const [chaveBusca, setChaveBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Modal State
  const [modalAberto, setModalAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [itensImportacao, setItensImportacao] = useState([]);
  const [cabecalhoModal, setCabecalhoModal] = useState({ fornecedorId: '', numeroDocumento: '', dataEmissao: '' });

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    const init = async () => {
        try {
            const [resProd, resForn] = await Promise.all([
                api.get('/produtos?size=5000'),
                api.get('/fornecedores/dropdown').catch(() => api.get('/fornecedores?size=100'))
            ]);
            setListaProdutosDb(resProd.data?.content || resProd.data || []);
            setListaFornecedores(Array.isArray(resForn.data) ? resForn.data : (resForn.data?.content || []));
        } catch(e) { console.error("Erro dados iniciais:", e); }
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
    const toastId = toast.loading("Consultando a SEFAZ...");
    try {
      await api.post('/estoque/notas-pendentes/sincronizar');
      toast.update(toastId, { render: "Sincronização concluída!", type: "success", isLoading: false, autoClose: 3000 });
      carregarNotasDoBackend();
    } catch (error) {
      toast.update(toastId, { render: error.response?.data || "Aguarde para sincronizar novamente (Regra Sefaz).", type: "warning", isLoading: false, autoClose: 5000 });
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
        toast.success("Nota localizada!");
      } else {
        setTodasNotas([]);
        toast.info("Nota não sincronizada.");
      }
    } catch (error) {
      toast.error("Erro ao buscar a nota.");
      setTodasNotas([]);
    } finally {
      setLoading(false);
    }
  };

  const limparFiltros = () => { setDataInicio(''); setDataFim(''); setChaveBusca(''); };

  // ============================================================================
  // 🔥 O NOVO FLUXO ABSOLUTO DE IMPORTAÇÃO E CADASTRO PRÉVIO
  // ============================================================================
  const abrirModalImportacao = async (nota) => {
      // Abre Modal em Estado de Carregamento IMEDIATO
      setModalAberto(true);
      setLoadingModal(true);
      setNotaSelecionada(nota);
      setItensImportacao([]);
      setCabecalhoModal({ fornecedorId: '', numeroDocumento: '', dataEmissao: '' });

      let idTratar = nota.id;

      // 1. Baixar XML se for Resumo
      if (nota.status === 'PENDENTE_MANIFESTACAO') {
          try {
              toast.info("A descarregar XML na SEFAZ...");
              await api.post(`/estoque/notas-pendentes/${nota.id}/manifestar`);
          } catch (e) {
              setModalAberto(false);
              return toast.error("A SEFAZ recusou o download do XML agora. Tente mais tarde.");
          }
      }

      // 2. Extrair Dados Reais do Backend
      try {
          const res = await api.get(`/estoque/notas-pendentes/${idTratar}/xml-parse`);
          const { cnpjFornecedor, razaoSocialFornecedor, itensXml, dataEmissao } = res.data;

          // 3. A MÁGICA: Salvar o Fornecedor em Background ANTES de montar a tela
          let fornecedorSalvoId = '';
          if (cnpjFornecedor) {
               toast.info(`Registando Fornecedor (${maskCNPJ(cnpjFornecedor)})...`);
               const fornBackend = await garantirFornecedorNoBanco(cnpjFornecedor, razaoSocialFornecedor || nota.nomeFornecedor);
               if (fornBackend) {
                   fornecedorSalvoId = fornBackend.id;
               }
          }

          // 4. Aplicar Inteligência de Produtos
          toast.info("Analisando Produtos com IA...");
          const itensProcessados = processarInteligenciaProdutos(itensXml || [], razaoSocialFornecedor || nota.nomeFornecedor);

          // 5. Preencher a Tela perfeitamente
          setCabecalhoModal({
              fornecedorId: fornecedorSalvoId, // Já vem preenchido e existe na DB!
              numeroDocumento: extrairNumeroNota(nota.chaveAcesso),
              dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : (nota.dataEmissao?.split('T')[0] || new Date().toISOString().split('T')[0])
          });
          setItensImportacao(itensProcessados);

      } catch (err) {
          console.error("Erro Fluxo Importação:", err);
          toast.error("Erro crítico ao processar o XML.");
          setModalAberto(false);
      } finally {
          setLoadingModal(false); // Liberta a tela com tudo pronto
      }
  };

  const garantirFornecedorNoBanco = async (cnpjLimpo, razaoNome) => {
        const docBase = cnpjLimpo.replace(/\D/g, '');
        let idExistente = null;

        // Verifica se já existe local
        try {
            const resLocal = await api.get(`/fornecedores/buscar-por-cnpj/${docBase}`);
            if (resLocal.data?.id && !resLocal.data?.razaoSocial?.includes('FORNECEDOR NOVO')) {
                // Atualiza Lista Frontend se não estiver lá
                setListaFornecedores(prev => {
                    if (!prev.some(f => f.id === resLocal.data.id)) return [...prev, resLocal.data];
                    return prev;
                });
                return resLocal.data;
            }
            if (resLocal.data?.id) idExistente = resLocal.data.id;
        } catch (e) {}

        // Payload Blindado para Insert garantido
        let payload = {
            cnpj: docBase,
            razaoSocial: razaoNome ? razaoNome.substring(0, 200) : `FORNECEDOR ${docBase}`,
            nomeFantasia: razaoNome ? razaoNome.substring(0, 200) : `FORNECEDOR ${docBase}`,
            inscricaoEstadual: "ISENTO", email: "nfe@fornecedor.com.br", telefone: "81999999999",
            cep: "50000000", logradouro: "DADOS CAPTURADOS DA NOTA", numero: "SN", bairro: "CENTRO",
            cidade: "RECIFE", uf: "PE", ativo: true
        };

        // Tenta enriquecer com Receita/BrasilAPI
        try {
            const resApi = await fetchWithTimeout(`https://publica.cnpj.ws/cnpj/${docBase}`, { timeout: 3000 });
            if (resApi.ok) {
                const data = await resApi.json();
                payload.razaoSocial = data.razao_social || payload.razaoSocial;
                payload.nomeFantasia = data.estabelecimento?.nome_fantasia || payload.nomeFantasia;
            }
        } catch (e) {}

        // Grava no Banco e Atualiza a Lista do Modal
        try {
            let result;
            if (idExistente) result = (await api.put(`/fornecedores/${idExistente}`, payload)).data;
            else result = (await api.post('/fornecedores', payload)).data;

            setListaFornecedores(prev => {
                const newList = prev.filter(p => p.id !== result.id);
                return [...newList, result].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || ''));
            });
            return result;
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
  };

  // 🔥 CONFIRMAÇÃO FINAL DE ENTRADA 🔥
  const confirmarEntradaModal = async () => {
      if (!cabecalhoModal.fornecedorId) {
          toast.warn("O campo Fornecedor é obrigatório. Selecione na barra superior.");
          document.getElementById('fornecedor-modal-select')?.focus();
          return;
      }
      if (itensImportacao.some(i => i.status === 'semelhante')) return toast.warn("Resolva os itens com ATENÇÃO primeiro.");
      if (itensImportacao.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) return toast.warn("Produtos novos precisam de EAN/Código.");

      setLoadingModal(true);
      try {
          await api.post('/estoque/entrada', {
              fornecedorId: cabecalhoModal.fornecedorId,
              numeroDocumento: cabecalhoModal.numeroDocumento || "S/N",
              dataVencimento: cabecalhoModal.dataEmissao,
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
          carregarNotasDoBackend();
      } catch(e) {
          toast.error(e.response?.data?.message || "Falha na comunicação ao registrar entrada.");
      } finally {
          setLoadingModal(false);
      }
  };

  const getStatusBadge = (status) => {
      switch(status) {
          case 'IMPORTADA':
          case 'CONCLUIDA': return <span className="badge-status importada"><CheckCircle size={14}/> ESTOQUE ATUALIZADO</span>;
          case 'PENDENTE_MANIFESTACAO': return <span className="badge-status resumo"><DownloadCloud size={14}/> XML NÃO BAIXADO</span>;
          case 'PENDENTE': default: return <span className="badge-status pendente"><Package size={14}/> PRONTA PARA IMPORTAR</span>;
      }
  };

  const totalPaginasCalculado = Math.max(1, Math.ceil(todasNotas.length / itensPorPagina));
  const totalGeralModal = itensImportacao?.reduce((a, b) => a + (Number(b?.total) || 0), 0) || 0;

  return (
    <div className="gestao-notas-container">

      {/* HEADER DA PÁGINA */}
      <div className="gns-header">
        <div className="gns-header-left">
            <div className="gns-icon-box"><Inbox size={36} color="#60a5fa" /></div>
            <div>
              <h1>Caixa de Entrada Fiscal</h1>
              <p>Gestão unificada de faturamentos e importação de XML.</p>
            </div>
        </div>
        <button onClick={sincronizarSefaz} disabled={syncing} className={`btn-sync ${!syncing ? 'active' : ''}`}>
          <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Consultando SEFAZ..." : "Puxar Novas Notas"}
        </button>
      </div>

      {/* ÁREA DE FILTROS E BUSCA */}
      <div className="gns-filters-grid">
          <div className="filter-card">
            <h3><Search size={18} color="#3b82f6"/> Buscar por Chave Exata</h3>
            <form onSubmit={buscarPorChave} className="form-busca">
              <div className="input-wrapper">
                <Search size={18} className="icon-busca" />
                <input type="text" placeholder="Cole a chave de 44 dígitos..." value={chaveBusca} onChange={(e) => setChaveBusca(e.target.value)} maxLength={44} className="search-input"/>
              </div>
              <button type="submit" className="btn-search">Localizar</button>
            </form>
          </div>

          <div className="filter-card">
            <div className="filter-header">
                <h3><Filter size={18} color="#f59e0b"/> Filtrar por Emissão (Locais)</h3>
                {(dataInicio || dataFim) && (<button onClick={limparFiltros} className="btn-clear-filter">Limpar</button>)}
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
          <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto 15px', color: '#3b82f6' }} />
          <h2>A processar o seu histórico...</h2>
        </div>
      ) : notasExibidas.length === 0 ? (
        <div className="state-container empty">
          <FileText size={48} style={{ color: '#cbd5e1', margin: '0 auto 20px' }} />
          <h2>Nenhuma nota registada no período.</h2>
          <p>Se tem faturamentos recentes, clique em <strong>"Puxar Novas Notas"</strong> no topo.</p>
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
                  <strong className="fornecedor-nome"><Building size={18} color="#64748b"/> {nota.nomeFornecedor || "FORNECEDOR NÃO IDENTIFICADO"}</strong>
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
                    <div><span className="valor-label">Emissão</span><span className="valor-data">{nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                  </div>
                  <div className="valor-box">
                    <div className="icon-box-green"><DollarSign size={16} color="#10b981"/></div>
                    <div><span className="valor-label">Total</span><span className="valor-monetario">R$ {nota.valorTotal ? nota.valorTotal.toFixed(2).replace('.',',') : '0,00'}</span></div>
                  </div>
                </div>

                <div className="nota-acoes">
                  {isImportada ? (
                    <button disabled className="btn-acao disabled"><CheckCircle size={18} /> Já Importada</button>
                  ) : (
                    <button onClick={() => abrirModalImportacao(nota)} className={`btn-acao ${isResumo ? 'resumo' : 'importar'}`}>
                      {isResumo ? <DownloadCloud size={18} /> : <Package size={18} />}
                      {isResumo ? "Baixar XML Sefaz" : "Processar Entrada"} <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINAÇÃO INFERIOR */}
      {!loading && totalPaginasCalculado > 1 && (
        <div className="paginacao">
            <button onClick={() => setPaginaAtual(p => Math.max(0, p - 1))} disabled={paginaAtual === 0} className={`btn-page ${paginaAtual === 0 ? '' : 'active'}`}>Anterior</button>
            <span className="paginacao-info">Página {paginaAtual + 1} de {totalPaginasCalculado}</span>
            <button onClick={() => setPaginaAtual(p => Math.min(totalPaginasCalculado - 1, p + 1))} disabled={paginaAtual >= totalPaginasCalculado - 1} className={`btn-page ${paginaAtual >= totalPaginasCalculado - 1 ? '' : 'active'}`}>Próxima</button>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL GIGANTE PREMIUM */}
      {/* ============================================================================ */}
      {modalAberto && (
          <div className="modal-overlay fade-in">
              <div className="import-modal bounce-in">

                  {/* HEADER DO MODAL */}
                  <div className="modal-header-premium">
                      <div>
                          <h2>Auditoria de Mercadorias</h2>
                          <p>Verifique os produtos e vínculos fiscais antes de atualizar o estoque.</p>
                      </div>
                      <button className="btn-close-modal" onClick={() => setModalAberto(false)}><X size={24}/></button>
                  </div>

                  {/* BODY DO MODAL */}
                  <div className="modal-body-premium">
                      {loadingModal ? (
                          <div className="state-container loading">
                              <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto 15px', color: '#3b82f6' }} />
                              <h3>Analisando XML com Inteligência Artificial...</h3>
                          </div>
                      ) : (
                          <div className="modal-content-wrapper">

                              {/* PAINEL ESCURO: DADOS DA NOTA */}
                              <div className="dashboard-panel-dark">
                                  <div className="dp-col dp-col-fornecedor">
                                      <label>Fornecedor Responsável</label>
                                      <select
                                          id="fornecedor-modal-select"
                                          className="dp-input"
                                          value={cabecalhoModal.fornecedorId}
                                          onChange={(e) => setCabecalhoModal({...cabecalhoModal, fornecedorId: e.target.value})}
                                      >
                                          <option value="">Selecione o Fornecedor...</option>
                                          {listaFornecedores.map(f => (
                                              <option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div className="dp-col">
                                      <label>Número da NF-e</label>
                                      <input className="dp-input" value={cabecalhoModal.numeroDocumento} onChange={(e) => setCabecalhoModal({...cabecalhoModal, numeroDocumento: e.target.value})} />
                                  </div>
                                  <div className="dp-col">
                                      <label>Data de Emissão</label>
                                      <input type="date" className="dp-input" value={cabecalhoModal.dataEmissao} onChange={(e) => setCabecalhoModal({...cabecalhoModal, dataEmissao: e.target.value})} />
                                  </div>
                              </div>

                              {/* TABELA DE PRODUTOS */}
                              <div className="modal-table-area">
                                  <table className="modern-table">
                                      <thead>
                                          <tr>
                                              <th width="15%">Ação IA</th>
                                              <th width="40%">Mercadoria e Identificação</th>
                                              <th width="20%">Custo & Quantidade</th>
                                              <th width="25%">Resolução</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {itensImportacao.map((item, idx) => (
                                              <tr key={idx} className={`tr-${item.status}`}>
                                                  <td className="td-status">
                                                      {item.status === 'vinculado' && <span className="badge-status importada"><CheckCircle size={14}/> VINCULADO</span>}
                                                      {item.status === 'semelhante' && <span className="badge-status resumo"><AlertTriangle size={14}/> ATENÇÃO</span>}
                                                      {item.status === 'novo' && <span className="badge-status pendente"><Package size={14}/> CADASTRAR</span>}
                                                  </td>

                                                  <td>
                                                      {item.status === 'novo' ? (
                                                          <div className="novo-produto-form">
                                                              <input value={item.descricao} onChange={(e) => atualizarCampoItem(idx, 'descricao', e.target.value)} className="input-elegante focus-blue" placeholder="Nome do Produto no seu sistema"/>
                                                              <div className="ean-generator">
                                                                  <input value={item.codigoBarras} onChange={(e) => atualizarCampoItem(idx, 'codigoBarras', e.target.value)} className="input-elegante" placeholder="EAN / Cód. Barras"/>
                                                                  <button onClick={() => gerarEanNoModal(idx)} className="btn-magic" title="Gerar EAN Interno Automático"><Wand2 size={16}/></button>
                                                              </div>
                                                          </div>
                                                      ) : (
                                                          <div className="produto-leitura">
                                                              <strong>{item.descricao}</strong>
                                                              <div className="prod-meta">
                                                                  <span className="pill-gray"><Barcode size={12}/> {item.codigoBarras}</span>
                                                                  <span className="pill-gray"><FileText size={12}/> NCM: {item.ncm}</span>
                                                              </div>
                                                          </div>
                                                      )}
                                                  </td>

                                                  <td className="td-valores">
                                                      <span className="qtd-badge">{item.quantidade} UNIDADES</span>
                                                      <span className="unit-cost">Custo: R$ {Number(item.precoCusto).toFixed(2)}</span>
                                                      <strong className="total-cost">T: R$ {item.total?.toFixed(2)}</strong>
                                                  </td>

                                                  <td>
                                                      {item.status === 'semelhante' && (
                                                          <div className="card-sugestao-ia">
                                                              <span className="ia-label">Encontrado ({item.confianca}):</span>
                                                              <strong title={item.match?.descricao}>{item.match?.descricao?.substring(0,35)}...</strong>
                                                              <button onClick={() => vincularSugestao(idx, item.match)} className="btn-aceitar-sugestao pulse-btn"><LinkIcon size={14}/> Vincular Agora</button>
                                                          </div>
                                                      )}
                                                      {item.status === 'vinculado' && (
                                                          <div className="txt-sucesso-ia"><CheckCircle size={16}/> <span>Vínculo OK ({item.confianca})</span></div>
                                                      )}
                                                      {item.status === 'novo' && (
                                                          <div className="txt-info-novo"><Package size={16}/> <span>Novo Registo no Estoque</span></div>
                                                      )}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* FOOTER DO MODAL */}
                  {!loadingModal && (
                      <div className="modal-footer-premium">
                          <div className="resumo-financeiro">
                              <span>Soma do Faturamento:</span>
                              <strong>R$ {totalGeralModal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                          </div>
                          <button className="btn-confirmar-gigante" onClick={confirmarEntradaModal}>
                              <Save size={22}/> Confirmar Atualização do Estoque
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