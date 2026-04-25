import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { maskCNPJ } from '../../utils/masks';
import {
  Search, RefreshCw, ArrowRight, CheckCircle,
  FileText, Calendar, DollarSign, Building,
  DownloadCloud, Filter, Inbox, Package,
  X, AlertTriangle, Link as LinkIcon, Wand2, Save, Barcode, ChevronRight, Plus
} from 'lucide-react';

import FornecedorForm from '../Fornecedores/FornecedorForm';
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

  // --- ESTADOS DA LISTA BASE ---
  const [todasNotas, setTodasNotas] = useState([]);
  const [notasExibidas, setNotasExibidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [listaProdutosDb, setListaProdutosDb] = useState([]);
  const [listaFornecedores, setListaFornecedores] = useState([]);

  const itensPorPagina = 15;
  const [paginaAtual, setPaginaAtual] = useState(0);

  // --- ESTADOS DE FILTROS E BUSCA ---
  const [chaveBusca, setChaveBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [buscaLocalAtiva, setBuscaLocalAtiva] = useState(false); // Feedback visual

  // --- ESTADOS DO MODAL DE IMPORTAÇÃO ---
  const [modalAberto, setModalAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [itensImportacao, setItensImportacao] = useState([]);
  const [cabecalhoModal, setCabecalhoModal] = useState({ fornecedorId: '', numeroDocumento: '', dataEmissao: '' });

  // Controle de Cadastro de Fornecedor Manual (Fallback)
  const [modalFornecedorAberto, setModalFornecedorAberto] = useState(false);
  const [dadosPreForn, setDadosPreForn] = useState(null);

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    const init = async () => {
        try {
            const [resProd, resForn] = await Promise.all([
                api.get('/produtos?size=5000'),
                api.get('/fornecedores/dropdown').catch(() => api.get('/fornecedores?size=500'))
            ]);
            setListaProdutosDb(resProd.data?.content || resProd.data || []);
            setListaFornecedores(Array.isArray(resForn.data) ? resForn.data : (resForn.data?.content || []));
        } catch(e) { console.error("Erro ao carregar bases:", e); }
        carregarNotasDoBackend();
    };
    init();
    // eslint-disable-next-line
  }, []);

  // 2. PAGINAÇÃO E FILTRO EM TEMPO REAL (O RADAR)
  useEffect(() => {
      if (!Array.isArray(todasNotas)) return;

      let notasFiltradas = todasNotas;
      let isSearching = false;

      if (chaveBusca && chaveBusca.length > 5) {
          const chaveLimpa = chaveBusca.replace(/\D/g, '');
          notasFiltradas = todasNotas.filter(n => n.chaveAcesso?.replace(/\D/g, '').includes(chaveLimpa));
          isSearching = true;
      }

      setBuscaLocalAtiva(isSearching);
      const inicio = paginaAtual * itensPorPagina;
      const fim = inicio + itensPorPagina;
      setNotasExibidas(notasFiltradas.slice(inicio, fim));
  }, [todasNotas, paginaAtual, chaveBusca]);


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
      toast.error("Não foi possível carregar as notas.");
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltroDatas = () => {
      if(!dataInicio || !dataFim) return toast.warn("Selecione data de início e fim.");
      carregarNotasDoBackend();
  };

  const limparFiltros = () => {
      setDataInicio(''); setDataFim(''); setChaveBusca('');
      setTimeout(() => carregarNotasDoBackend(), 100);
  };

  const sincronizarSefaz = async () => {
    setSyncing(true);
    toast.dismiss();
    const toastId = toast.loading("Consultando a SEFAZ...");
    try {
      await api.post('/estoque/notas-pendentes/sincronizar');
      toast.update(toastId, { render: "Sincronização concluída com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
      carregarNotasDoBackend();
    } catch (error) {
      toast.update(toastId, { render: error.response?.data || "Bloqueio temporário da SEFAZ. Tente mais tarde.", type: "warning", isLoading: false, autoClose: 5000 });
      carregarNotasDoBackend();
    } finally {
      setSyncing(false);
    }
  };

  // BUSCA REMOTA NA SEFAZ
  const buscarNaSefazForcado = async () => {
    const chaveLimpa = chaveBusca.replace(/\D/g, '');
    if (chaveLimpa.length !== 44) return toast.warn("A Chave deve conter 44 números.");

    setLoading(true);
    try {
      await api.post(`/estoque/notas-pendentes/buscar-chave/${chaveLimpa}`);
      toast.success("Nota localizada na SEFAZ com sucesso!");
      setChaveBusca('');
      carregarNotasDoBackend();
    } catch (error) {
      toast.error(error.response?.data || "Nota não encontrada na Base Nacional da SEFAZ.");
    } finally {
      setLoading(false);
    }
  };


  // ============================================================================
  // 🔥 A MÁGICA: O AUTO-CADASTRO SILENCIOSO DO FORNECEDOR
  // ============================================================================
  const buscarFornecedorLocal = (cnpj) => {
      if (!cnpj) return null;
      const limpo = cnpj.replace(/\D/g, '');
      const forn = listaFornecedores.find(f => (f.cnpj || f.documento || '').replace(/\D/g, '') === limpo);
      return (forn && !forn.razaoSocial?.toUpperCase().includes('FORNECEDOR NOVO')) ? forn : null;
  };

  const autoCadastrarFornecedor = async (cnpjDescoberto, razaoNome) => {
      const docLimpo = cnpjDescoberto.replace(/\D/g, '');

      // Monta o payload perfeitinho para a sua API aceitar de primeira
      let payload = {
          cnpj: docLimpo,
          razaoSocial: razaoNome ? razaoNome.substring(0, 200) : `FORNECEDOR ${docLimpo}`,
          nomeFantasia: razaoNome ? razaoNome.substring(0, 200) : `FORNECEDOR ${docLimpo}`,
          inscricaoEstadual: "ISENTO",
          email: "contato@fornecedor.com.br",
          telefone: "81900000000",
          cep: "50000000",
          logradouro: "DADOS IMPORTADOS DA NOTA",
          numero: "SN",
          bairro: "CENTRO",
          cidade: "RECIFE",
          uf: "PE",
          ativo: true
      };

      // Tenta enriquecer com dados reais da Receita
      try {
          const resApi = await fetchWithTimeout(`https://brasilapi.com.br/api/cnpj/v1/${docLimpo}`, { timeout: 3000 });
          if (resApi.ok) {
              const data = await resApi.json();
              payload.razaoSocial = data.razao_social || payload.razaoSocial;
              payload.nomeFantasia = data.nome_fantasia || data.razao_social || payload.nomeFantasia;
              payload.cep = data.cep ? data.cep.replace(/\D/g, '') : payload.cep;
              payload.logradouro = data.logradouro || payload.logradouro;
              payload.numero = data.numero || payload.numero;
              payload.bairro = data.bairro || payload.bairro;
              payload.cidade = data.municipio || payload.cidade;
              payload.uf = data.uf || payload.uf;
              payload.telefone = data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, '') : payload.telefone;
          }
      } catch (e) {
          console.log("Integração BrasilAPI lenta, usando dados base da nota.");
      }

      try {
          const result = await api.post('/fornecedores', payload);
          if (result.data && result.data.id) {
              setListaFornecedores(prev => [...prev, result.data].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '')));
              return result.data.id;
          }
          return null;
      } catch(e) {
          console.error("Falha no Auto-Cadastro (Possível regra de negócio do Backend):", e);
          return null;
      }
  };

  const abrirModalImportacao = async (nota) => {
      setModalAberto(true);
      setLoadingModal(true);
      setNotaSelecionada(nota);
      setItensImportacao([]);
      setCabecalhoModal({ fornecedorId: '', numeroDocumento: '', dataEmissao: '' });

      let idTratar = nota.id;

      if (nota.status === 'PENDENTE_MANIFESTACAO') {
          try {
              toast.info("Baixando XML completo na SEFAZ...");
              await api.post(`/estoque/notas-pendentes/${nota.id}/manifestar`);
          } catch (e) {
              setModalAberto(false);
              return toast.error("A SEFAZ não libertou o XML agora. Tente mais tarde.");
          }
      }

      try {
          const res = await api.get(`/estoque/notas-pendentes/${idTratar}/xml-parse`);
          const { cnpjFornecedor, razaoSocialFornecedor, itensXml, dataEmissao } = res.data;

          // 🔥 A IMPLEMENTAÇÃO EXTRAORDINÁRIA 🔥
          const fornecedorExistente = buscarFornecedorLocal(cnpjFornecedor);
          let fornecedorSalvoId = '';

          if (fornecedorExistente) {
               fornecedorSalvoId = fornecedorExistente.id;
          } else if (cnpjFornecedor) {
               // Fornecedor não existe! Auto-Cadastro em ação...
               const idNovoFornecedor = await autoCadastrarFornecedor(cnpjFornecedor, razaoSocialFornecedor || nota.nomeFornecedor);
               if (idNovoFornecedor) {
                   fornecedorSalvoId = idNovoFornecedor;
               } else {
                   // Fallback seguro se o auto-cadastro for bloqueado por alguma regra severa do DB
                   setDadosPreForn({ cnpj: cnpjFornecedor, razaoSocial: razaoSocialFornecedor });
               }
          }

          const itensProcessados = processarInteligenciaProdutos(itensXml || [], razaoSocialFornecedor || nota.nomeFornecedor);

          setCabecalhoModal({
              fornecedorId: fornecedorSalvoId,
              numeroDocumento: extrairNumeroNota(nota.chaveAcesso),
              dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : (nota.dataEmissao?.split('T')[0] || new Date().toISOString().split('T')[0])
          });
          setItensImportacao(itensProcessados);

      } catch (err) {
          toast.error("Erro crítico ao ler o XML.");
          setModalAberto(false);
      } finally {
          setLoadingModal(false);
      }
  };

  // Sucesso no Cadastro Manual do Fornecedor (O Fallback)
  const handleFornecedorCriado = (novoForn) => {
      setListaFornecedores(prev => [...prev, novoForn].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '')));
      setCabecalhoModal(prev => ({ ...prev, fornecedorId: novoForn.id }));
      setModalFornecedorAberto(false);
      toast.success("Fornecedor vinculado com sucesso!");
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
      } catch(e) { toast.error("Erro ao gerar EAN."); }
  };

  const vincularSugestao = (index, dbProd) => {
      const lista = [...itensImportacao];
      lista[index] = { ...lista[index], idProduto: dbProd.id, descricao: dbProd.descricao, codigoBarras: dbProd.codigoBarras, status: 'vinculado', estoqueAtual: dbProd.quantidadeEmEstoque || 0 };
      setItensImportacao(lista);
  };

  const confirmarEntradaModal = async () => {
      if (!cabecalhoModal.fornecedorId) {
          toast.warn("O Fornecedor não está selecionado. Preencha antes de continuar.");
          document.getElementById('fornecedor-modal-select')?.focus();
          return;
      }
      if (itensImportacao.some(i => i.status === 'semelhante')) return toast.warn("Verifique os itens marcados em ATENÇÃO.");
      if (itensImportacao.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) return toast.warn("Produtos novos precisam de um Código EAN.");

      const toastId = toast.loading("Salvando Estoque e Financeiro...");
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

          toast.update(toastId, { render: "Estoque Atualizado com Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
          setModalAberto(false);
          carregarNotasDoBackend();
      } catch(e) {
          toast.update(toastId, { render: e.response?.data?.message || "Erro Crítico ao salvar estoque.", type: "error", isLoading: false, autoClose: 5000 });
      }
  };

  const getStatusBadge = (status) => {
      switch(status) {
          case 'IMPORTADA':
          case 'CONCLUIDA': return <span className="badge-status importada"><CheckCircle size={14}/> REGISTRADA</span>;
          case 'PENDENTE_MANIFESTACAO': return <span className="badge-status resumo"><DownloadCloud size={14}/> BAIXAR XML</span>;
          case 'PENDENTE': default: return <span className="badge-status pendente"><Package size={14}/> PRONTA</span>;
      }
  };

  const totalPaginasCalculado = Math.max(1, Math.ceil((todasNotas.filter(n => chaveBusca ? n.chaveAcesso?.replace(/\D/g, '').includes(chaveBusca.replace(/\D/g, '')) : true)).length / itensPorPagina));
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
            <h3><Search size={18} color="#3b82f6"/> Filtro Inteligente (Local)</h3>
            <div className="form-busca">
              <div className="input-wrapper">
                <Search size={18} className="icon-busca" />
                <input
                    type="text" placeholder="Comece a digitar a chave..."
                    value={chaveBusca} onChange={(e) => setChaveBusca(e.target.value)}
                    maxLength={44} className="search-input"
                />
              </div>
            </div>
          </div>

          <div className="filter-card">
            <div className="filter-header">
                <h3><Filter size={18} color="#f59e0b"/> Filtrar por Emissão (Local)</h3>
                {(dataInicio || dataFim) && (<button onClick={limparFiltros} className="btn-clear-filter">Limpar</button>)}
            </div>
            <div className="date-inputs-wrapper">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="date-input" />
                <span className="date-separator">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="date-input" />
                <button onClick={aplicarFiltroDatas} className="btn-aplicar-filtro">Filtrar</button>
            </div>
          </div>
      </div>

      {/* 🔥 ALERTA VISUAL DO RADAR (BUSCA INTELIGENTE) 🔥 */}
      {buscaLocalAtiva && (
          <div className="busca-inteligente-alert fade-in">
              <div className="pulse-dot"></div>
              <span>Busca em Tempo Real: <strong>{notasExibidas.length}</strong> nota(s) localizada(s) na tela.</span>
          </div>
      )}

      {/* LISTAGEM DE NOTAS */}
      {loading ? (
        <div className="state-container loading">
          <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto 15px', color: '#3b82f6' }} />
          <h2>Lendo Base de Dados...</h2>
        </div>
      ) : notasExibidas.length === 0 ? (
        <div className="state-container empty fade-in">
          <FileText size={48} style={{ color: '#cbd5e1', margin: '0 auto 20px' }} />
          <h2>Nenhuma nota encontrada na tela.</h2>
          {chaveBusca.length === 44 ? (
             <button onClick={buscarNaSefazForcado} className="btn-aplicar-filtro" style={{marginTop: '15px'}}>
                 🔍 Buscar esta Chave na SEFAZ Nacional
             </button>
          ) : (
             <p>Se tem faturamentos recentes, clique em <strong>"Puxar Novas Notas"</strong> no topo.</p>
          )}
        </div>
      ) : (
        <div className="notas-list">
          {notasExibidas.map((nota) => {
            const isImportada = nota.status === 'IMPORTADA' || nota.status === 'CONCLUIDA';
            const isResumo = nota.status === 'PENDENTE_MANIFESTACAO';

            return (
              <div key={nota.id} className={`nota-card-ui ${isImportada ? 'importada' : isResumo ? 'resumo' : 'pendente'} ${buscaLocalAtiva ? 'glow-card' : ''}`}>

                <div className="ncu-fornecedor">
                    <div className="ncu-title-row">
                        <Building size={20} color={isImportada ? '#10b981' : '#64748b'}/>
                        <h3>{nota.nomeFornecedor || "FORNECEDOR NÃO IDENTIFICADO"}</h3>
                        <div className="ncu-badge-mobile">{getStatusBadge(nota.status)}</div>
                    </div>
                    <span className="ncu-cnpj">CNPJ: {maskCNPJ(nota.cnpjFornecedor)}</span>
                </div>

                <div className="ncu-body">
                    <div className="ncu-fiscal">
                        <div className="ncu-item">
                            <span className="ncu-label">Documento</span>
                            <strong className="ncu-value"><FileText size={14}/> NF-e {extrairNumeroNota(nota.chaveAcesso)}</strong>
                        </div>
                        <div className="ncu-item full-width">
                            <span className="ncu-label">Chave de Acesso</span>
                            <span className="ncu-chave">{nota.chaveAcesso}</span>
                        </div>
                    </div>

                    <div className="ncu-financeiro">
                        <div className="ncu-item">
                            <span className="ncu-label">Data de Emissão</span>
                            <span className="ncu-value"><Calendar size={14}/> {nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString('pt-BR') : 'N/A'}</span>
                        </div>
                        <div className="ncu-item">
                            <span className="ncu-label">Faturamento Total</span>
                            <strong className="ncu-valor-destaque">R$ {nota.valorTotal ? nota.valorTotal.toFixed(2).replace('.',',') : '0,00'}</strong>
                        </div>
                    </div>

                    <div className="ncu-acao">
                        {isImportada ? (
                          <button disabled className="btn-acao disabled"><CheckCircle size={18} /> Cadastrada</button>
                        ) : (
                          <button onClick={() => abrirModalImportacao(nota)} className={`btn-acao ${isResumo ? 'resumo' : 'importar'}`}>
                            {isResumo ? <DownloadCloud size={18} /> : <Package size={18} />}
                            {isResumo ? "Baixar XML Sefaz" : "Processar Entrada"} <ChevronRight size={18} />
                          </button>
                        )}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINAÇÃO INFERIOR */}
      {!loading && totalPaginasCalculado > 1 && !buscaLocalAtiva && (
        <div className="paginacao">
            <button onClick={() => setPaginaAtual(p => Math.max(0, p - 1))} disabled={paginaAtual === 0} className={`btn-page ${paginaAtual === 0 ? '' : 'active'}`}>Anterior</button>
            <span className="paginacao-info">Página {paginaAtual + 1} de {totalPaginasCalculado}</span>
            <button onClick={() => setPaginaAtual(p => Math.min(totalPaginasCalculado - 1, p + 1))} disabled={paginaAtual >= totalPaginasCalculado - 1} className={`btn-page ${paginaAtual >= totalPaginasCalculado - 1 ? '' : 'active'}`}>Próxima</button>
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL GIGANTE PREMIUM REFORMULADO (UI/UX) */}
      {/* ============================================================================ */}
      {modalAberto && (
          <div className="modal-overlay fade-in">
              <div className="import-modal scale-in">

                  <div className="modal-header-premium">
                      <div>
                          <h2>Importação de Estoque</h2>
                          <p>Auditoria Fiscal e Inteligência Artificial</p>
                      </div>
                      <button className="btn-close-modal" onClick={() => setModalAberto(false)}><X size={24}/></button>
                  </div>

                  <div className="modal-body-premium">
                      {loadingModal ? (
                          <div className="state-container loading">
                              <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto 15px', color: '#3b82f6' }} />
                              <h3>Lendo Arquivo e Identificando Mercadorias...</h3>
                          </div>
                      ) : (
                          <div className="modal-content-wrapper">

                              <div className="stepper-header">Passo 1: Identificação</div>
                              <div className="dashboard-panel-glass">
                                  <div className="dp-col dp-col-fornecedor">
                                      <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom: '6px'}}>
                                          <label style={{margin:0}}>Fornecedor</label>
                                          {/* Fallback caso a API da Receita falhe */}
                                          {!cabecalhoModal.fornecedorId && (
                                              <button onClick={() => setModalFornecedorAberto(true)} className="btn-add-forn"><Plus size={12}/> NOVO</button>
                                          )}
                                      </div>
                                      <select
                                          id="fornecedor-modal-select"
                                          className="dp-select-premium"
                                          value={cabecalhoModal.fornecedorId}
                                          onChange={(e) => setCabecalhoModal({...cabecalhoModal, fornecedorId: e.target.value})}
                                          style={{border: !cabecalhoModal.fornecedorId ? '2px solid #f59e0b' : '1px solid #cbd5e1'}}
                                      >
                                          <option value="">{cabecalhoModal.fornecedorId ? "Selecione..." : "⚠️ FORNECEDOR AUSENTE - CLIQUE EM NOVO"}</option>
                                          {listaFornecedores.map(f => (
                                              <option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div className="dp-col dp-col-small">
                                      <label>NF-e</label>
                                      <input className="dp-input-premium" value={cabecalhoModal.numeroDocumento} readOnly />
                                  </div>
                                  <div className="dp-col dp-col-small">
                                      <label>Data Faturamento</label>
                                      <input type="date" className="dp-input-premium" value={cabecalhoModal.dataEmissao} onChange={(e) => setCabecalhoModal({...cabecalhoModal, dataEmissao: e.target.value})} />
                                  </div>
                              </div>

                              <div className="stepper-header" style={{marginTop: '10px'}}>Passo 2: Mercadorias</div>
                              <div className="modal-table-area">
                                  <table className="modern-table">
                                      <thead>
                                          <tr>
                                              <th width="15%">Auditoria IA</th>
                                              <th width="45%">Mercadoria</th>
                                              <th width="20%">Custo / Volume</th>
                                              <th width="20%">Ação Requerida</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {itensImportacao.map((item, idx) => (
                                              <tr key={idx} className={`tr-${item.status}`}>
                                                  <td className="td-status">
                                                      {item.status === 'vinculado' && <span className="badge-status importada"><CheckCircle size={14}/> VINCULADO</span>}
                                                      {item.status === 'semelhante' && <span className="badge-status resumo"><AlertTriangle size={14}/> REVISAR</span>}
                                                      {item.status === 'novo' && <span className="badge-status pendente"><Package size={14}/> CRIAR</span>}
                                                  </td>

                                                  <td>
                                                      {item.status === 'novo' ? (
                                                          <div className="novo-produto-form">
                                                              <input value={item.descricao} onChange={(e) => atualizarCampoItem(idx, 'descricao', e.target.value)} className="input-elegante focus-blue" placeholder="Nome no seu sistema"/>
                                                              <div className="ean-generator">
                                                                  <input value={item.codigoBarras} onChange={(e) => atualizarCampoItem(idx, 'codigoBarras', e.target.value)} className="input-elegante" placeholder="EAN / Cód. Barras"/>
                                                                  <button onClick={() => gerarEanNoModal(idx)} className="btn-magic" title="Gerar EAN Automático"><Wand2 size={16}/></button>
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
                                                      <span className="qtd-badge">{item.quantidade} UN</span>
                                                      <span className="unit-cost">R$ {Number(item.precoCusto).toFixed(2)} / un</span>
                                                      <strong className="total-cost">Tot: R$ {item.total?.toFixed(2)}</strong>
                                                  </td>

                                                  <td>
                                                      {item.status === 'semelhante' && (
                                                          <div className="card-sugestao-ia">
                                                              <span className="ia-label">Identificado ({item.confianca})</span>
                                                              <strong title={item.match?.descricao}>{item.match?.descricao?.substring(0,35)}...</strong>
                                                              <button onClick={() => vincularSugestao(idx, item.match)} className="btn-aceitar-sugestao pulse-btn"><LinkIcon size={14}/> Vincular Agora</button>
                                                          </div>
                                                      )}
                                                      {item.status === 'vinculado' && (
                                                          <div className="txt-sucesso-ia"><CheckCircle size={16}/> <span>Tudo Certo</span></div>
                                                      )}
                                                      {item.status === 'novo' && (
                                                          <div className="txt-info-novo"><Package size={16}/> <span>Registar Estoque</span></div>
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

                  {!loadingModal && (
                      <div className="modal-footer-premium">
                          <div className="resumo-financeiro">
                              <span>Investimento Líquido</span>
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

      {/* ============================================================================ */}
      {/* MODAL DE CADASTRO MANUAL DE FORNECEDOR (BYPASS SEGURO) */}
      {/* ============================================================================ */}
      {modalFornecedorAberto && (
          <div className="modal-overlay" style={{zIndex: 99999}}>
              <div className="modal-card scale-in" style={{ maxWidth: '800px', width: '95%', padding: '0', background: '#fff' }}>
                  <div className="modal-header-premium" style={{ padding: '15px 20px' }}>
                      <h3 style={{margin:0}}>Completar Registo do Fornecedor</h3>
                      <button onClick={() => setModalFornecedorAberto(false)} className="btn-close-modal"><X size={20}/></button>
                  </div>
                  <div style={{ padding: '20px' }}>
                      <p style={{marginBottom: '20px', color: '#64748b'}}>A SEFAZ não devolveu dados completos para Auto-Cadastro. Por favor, confirme os dados para continuar a importação.</p>
                      <FornecedorForm
                          isModal={true}
                          prefillData={dadosPreForn}
                          onSuccess={handleFornecedorCriado}
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GestaoNotasSefaz;