import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { maskCNPJ } from '../../utils/masks';
import {
  Search, RefreshCw, CheckCircle, FileText, Calendar, Building,
  DownloadCloud, Filter, Inbox, Package, X, AlertTriangle, Link as LinkIcon,
  Wand2, Save, Barcode, ChevronRight, Plus, Loader2, Hash, Edit3, Sparkles, Eye
} from 'lucide-react';

import FornecedorForm from '../Fornecedores/FornecedorForm';
import './GestaoNotasSefaz.css';

// ============================================================================
// 🧠 HELPERS E MÁSCARAS
// ============================================================================
const extrairNumeroNota = (chave) => {
    if (!chave || chave.length !== 44) return "S/N";
    return parseInt(chave.substring(25, 34), 10).toString();
};

const limparTexto = (str) => {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase().replace(/\s+/g, ' ').trim();
};

const parseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleanStr = String(val).replace(',', '.');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatMoney = (num) => Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseMoneyInput = (str) => Number(String(str).replace(/\D/g, '')) / 100;

const formatarDataBR = (dataIso) => {
    if (!dataIso) return '';
    if (dataIso.includes('/')) return dataIso;
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const formatarDataHora = (dataStr) => {
    if (!dataStr) return "---";
    try {
        return new Date(dataStr).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return "---"; }
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

const findDictionaryMatch = (texto, listaAlvo) => {
    if (!listaAlvo || listaAlvo.length === 0) return '';
    const descUpper = texto.toUpperCase();
    const sortedList = [...listaAlvo].sort((a, b) => b.length - a.length);
    for (const item of sortedList) {
        if (new RegExp(`\\b${item.toUpperCase()}\\b`).test(descUpper)) return item;
    }
    return '';
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const GestaoNotasSefaz = () => {
  const navigate = useNavigate();

  const [todasNotas, setTodasNotas] = useState([]);
  const [notasExibidas, setNotasExibidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [listaProdutosDb, setListaProdutosDb] = useState([]);
  const [listaFornecedores, setListaFornecedores] = useState([]);

  const itensPorPagina = 15;
  const [paginaAtual, setPaginaAtual] = useState(0);

  const [chaveBusca, setChaveBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [buscaLocalAtiva, setBuscaLocalAtiva] = useState(false);

  const [verImportadas, setVerImportadas] = useState(() => {
      const salvo = localStorage.getItem('ddcosmeticos_ver_importadas');
      return salvo !== null ? JSON.parse(salvo) : true;
  });

  useEffect(() => {
      localStorage.setItem('ddcosmeticos_ver_importadas', JSON.stringify(verImportadas));
  }, [verImportadas]);

  // Estados do Modal de Auditoria e Importação
  const [modalAberto, setModalAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState(null);
  const [itensImportacao, setItensImportacao] = useState([]);
  const [cabecalhoModal, setCabecalhoModal] = useState({ fornecedorId: '', numeroDocumento: '', dataEmissao: '' });
  const [editingPriceIndex, setEditingPriceIndex] = useState(null);

  // Estados do Modal de Cadastro Rápido de Fornecedor
  const [modalFornecedorAberto, setModalFornecedorAberto] = useState(false);
  const [dadosPreForn, setDadosPreForn] = useState(null);

  // Estados do Modal Quick Edit (Criar Produto)
  const [quickEditIndex, setQuickEditIndex] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({
      descricao: '', codigoBarras: '', marca: '', categoria: '', subcategoria: '', precoCusto: 0, margem: 50.00, precoVenda: 0
  });

  // Estados do Modal de Visualização de Notas Já Registradas
  const [modalRegistroAberto, setModalRegistroAberto] = useState(false);
  const [detalhesRegistro, setDetalhesRegistro] = useState([]);

  // 🧠 DICIONÁRIO DINÂMICO
  const dicionarios = useMemo(() => {
      const defMarcas = ["EUDORA", "O BOTICÁRIO", "NATURA", "AVON", "VULT", "QUEM DISSE BERENICE", "RUBY ROSE", "GENERICA"];
      const defCat = ["PERFUMARIA", "MAQUIAGEM", "CABELOS", "CORPO E BANHO", "ROSTO", "INFANTIL", "SKINCARE", "GERAL"];
      const defSub = ["COLÔNIA", "SHAMPOO", "SABONETE", "CREME", "BATOM", "MÁSCARA", "SÉRUM", "CONDICIONADOR", "GERAL"];

      const dbMarcas = (listaProdutosDb || []).map(p => p.marca).filter(Boolean);
      const dbCat = (listaProdutosDb || []).map(p => p.categoria).filter(Boolean);
      const dbSub = (listaProdutosDb || []).map(p => p.subcategoria).filter(Boolean);

      return {
          marcas: [...new Set([...defMarcas, ...dbMarcas])].sort(),
          categorias: [...new Set([...defCat, ...dbCat])].sort(),
          subcategorias: [...new Set([...defSub, ...dbSub])].sort()
      };
  }, [listaProdutosDb]);

  useEffect(() => {
    const init = async () => {
        try {
            const [resProd, resForn] = await Promise.all([
                api.get('/produtos?size=5000'),
                api.get('/fornecedores?size=2000')
            ]);
            setListaProdutosDb(resProd.data?.content || resProd.data || []);
            setListaFornecedores(Array.isArray(resForn.data) ? resForn.data : (resForn.data?.content || []));
        } catch(e) { console.error("Erro ao carregar bases:", e); }
        carregarNotasDoBackend();
    };
    init();
  }, []);

  useEffect(() => {
      carregarNotasDoBackend();
  }, [verImportadas]);

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
      setNotasExibidas(notasFiltradas.slice(paginaAtual * itensPorPagina, (paginaAtual + 1) * itensPorPagina));
  }, [todasNotas, paginaAtual, chaveBusca]);

  const carregarNotasDoBackend = async () => {
    setLoading(true);
    try {
      let url = `/estoque/notas-pendentes?incluirImportadas=${verImportadas}`;
      if (dataInicio && dataFim) url += `&dataInicio=${dataInicio}&dataFim=${dataFim}`;
      const res = await api.get(url);
      let dadosExtraidos = [];
      if (Array.isArray(res.data)) dadosExtraidos = res.data;
      else if (res.data?.content) dadosExtraidos = res.data.content;
      else if (res.data?.data) dadosExtraidos = res.data.data;
      else if (res.data?.id) dadosExtraidos = [res.data];
      setTodasNotas(dadosExtraidos);
      setPaginaAtual(0);
    } catch (error) { toast.error("Não foi possível carregar as notas."); }
    finally { setLoading(false); }
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
      toast.update(toastId, { render: error.response?.data || "Bloqueio temporário da SEFAZ.", type: "warning", isLoading: false, autoClose: 5000 });
      carregarNotasDoBackend();
    } finally { setSyncing(false); }
  };

  const buscarNaSefazForcado = async () => {
    const chaveLimpa = chaveBusca.replace(/\D/g, '');
    if (chaveLimpa.length !== 44) return toast.warn("A Chave deve conter 44 números.");
    setLoading(true);
    try {
      await api.post(`/estoque/notas-pendentes/buscar-chave/${chaveLimpa}`);
      toast.success("Nota localizada na SEFAZ com sucesso!");
      setChaveBusca(''); carregarNotasDoBackend();
    } catch (error) { toast.error("Nota não encontrada na Base Nacional da SEFAZ."); }
    finally { setLoading(false); }
  };

  const handleFornecedorCriado = (novoFornecedor) => {
      setListaFornecedores(prev => [...prev, novoFornecedor].sort((a, b) => (a.razaoSocial || '').localeCompare(b.razaoSocial || '')));
      setCabecalhoModal(prev => ({ ...prev, fornecedorId: String(novoFornecedor.id) }));
      setModalFornecedorAberto(false);
  };

  // 🔥 ESPELHO DE CONFERÊNCIA (Rico, visual, com checklist)
  const gerarEspelhoConferencia = () => {
      const printWindow = window.open('', '_blank');
      const html = `
          <!DOCTYPE html>
          <html>
          <head>
              <title>Espelho de Conferência - NF-e ${cabecalhoModal.numeroDocumento}</title>
              <style>
                  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
                  body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: #fff; margin: 0; }
                  .header { text-align: center; border-bottom: 3px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                  .header h1 { margin: 0; font-size: 24px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
                  .header p { margin: 8px 0 0 0; color: #64748b; font-size: 14px; }
                  .info-box { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
                  .info-box div { flex: 1; }
                  .info-box strong { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
                  .info-box span { font-size: 16px; font-weight: 600; color: #0f172a; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                  th { background: #f1f5f9; color: #475569; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
                  td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; vertical-align: middle; }
                  .checkbox { width: 20px; height: 20px; border: 2px solid #94a3b8; border-radius: 4px; display: inline-block; }
                  .total-section { text-align: right; font-size: 20px; font-weight: 800; color: #0f172a; padding-top: 20px; border-top: 2px solid #e2e8f0; }
                  .total-section small { display: block; font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 8px; }
                  .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding-top: 40px; }
                  .sign-line { width: 45%; border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px; font-size: 14px; color: #475569; font-weight: 600; }
                  @media print { body { padding: 0; } }
              </style>
          </head>
          <body>
              <div class="header">
                  <h1>Espelho de Conferência Física de Estoque</h1>
                  <p>Documento Interno Auxiliar (Para uso do Estoquista)</p>
                  <p style="font-family: monospace; font-size: 12px; margin-top: 10px;">CHAVE: ${notaSelecionada?.chaveAcesso || 'N/A'}</p>
              </div>
              <div class="info-box">
                  <div><strong>Fornecedor</strong><span>${notaSelecionada?.nomeFornecedor || 'N/A'}</span></div>
                  <div><strong>CNPJ</strong><span>${maskCNPJ(notaSelecionada?.cnpjFornecedor || '')}</span></div>
                  <div><strong>NF-e</strong><span>${cabecalhoModal.numeroDocumento}</span></div>
                  <div><strong>Emissão</strong><span>${formatarDataBR(cabecalhoModal.dataEmissao)}</span></div>
              </div>
              <table>
                  <thead>
                      <tr>
                          <th width="5%" style="text-align: center;">Conf</th>
                          <th width="20%">EAN / Código</th>
                          <th width="45%">Descrição do Produto</th>
                          <th width="10%">Qtd NF</th>
                          <th width="20%">Custo Unit. (NF)</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${itensImportacao.map(i => {
                          const q = parseNumber(i.quantidade || i.qCom);
                          const v = parseNumber(i.precoCusto || i.valorUnitario || i.vUnCom);
                          return `<tr>
                              <td style="text-align: center;"><div class="checkbox"></div></td>
                              <td style="font-family: monospace;">${i.codigoBarras || 'S/N'}</td>
                              <td><strong>${i.descricao}</strong></td>
                              <td><strong>${q} UN</strong></td>
                              <td>R$ ${formatMoney(v)}</td>
                          </tr>`;
                      }).join('')}
                  </tbody>
              </table>
              <div class="total-section">
                  <small>Total de Volumes Físicos a Conferir: ${totalQuantidadeModal} UN</small>
                  Total Financeiro: R$ ${(notaSelecionada?.valorTotal || totalGeralModal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
              </div>
              <div class="signatures">
                  <div class="sign-line">Assinatura do Conferente</div>
                  <div class="sign-line">Data e Hora da Conferência</div>
              </div>
              <script>window.onload = () => window.print();</script>
          </body>
          </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
  };

  const iniciarProcessamento = async (nota) => {
        setChaveBusca('');
        setLoadingCardId(nota.id);

        try {
            if (nota.status === 'PENDENTE_MANIFESTACAO') {
                toast.info("Autorizando download na SEFAZ...");
                await api.post(`/estoque/notas-pendentes/${nota.id}/manifestar`);
            }

            const res = await api.get(`/estoque/notas-pendentes/${nota.id}/xml-parse`);
            const parsed = res.data || {};

            const cnpjReal = parsed.cnpjFornecedor || nota.cnpjFornecedor || '';
            const nomeReal = parsed.razaoSocialFornecedor || nota.nomeFornecedor || 'FORNECEDOR DESCONHECIDO';
            const itensXml = parsed.itensXml || [];
            const dataEmissao = parsed.dataEmissao || nota.dataEmissao;

            let fornecedorFinalId = parsed.fornecedorId || nota.fornecedorId || '';
            const cnpjLimpoTarget = String(cnpjReal).replace(/\D/g, '');
            const localMatch = listaFornecedores.find(f => f.cnpj && f.cnpj.replace(/\D/g, '') === cnpjLimpoTarget);

            if (localMatch) {
                fornecedorFinalId = localMatch.id;
            }

            const itensProcessados = await processarInteligenciaProdutos(itensXml);

            setCabecalhoModal({
                fornecedorId: fornecedorFinalId ? String(fornecedorFinalId) : '',
                numeroDocumento: extrairNumeroNota(nota.chaveAcesso),
                dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : new Date().toISOString().split('T')[0]
            });

            setItensImportacao(itensProcessados);
            setNotaSelecionada(nota);
            setModalAberto(true);

            if(!fornecedorFinalId) {
                setDadosPreForn({ cnpj: maskCNPJ(cnpjLimpoTarget), razaoSocial: nomeReal.toUpperCase() });
                setModalFornecedorAberto(true);
            }

        } catch (err) {
            toast.error("Falha ao preparar importação de mercadorias.");
        } finally {
            setLoadingCardId(null);
        }
    };

    // 🔥 VISUALIZAR NOTA JÁ REGISTRADA
    const visualizarNotaRegistrada = async (nota) => {
        setLoadingCardId(nota.id);
        try {
            const numeroDoc = extrairNumeroNota(nota.chaveAcesso);
            const res = await api.get(`/estoque/historico-entradas/${numeroDoc}/itens`);
            setDetalhesRegistro(Array.isArray(res.data) ? res.data : []);
            setNotaSelecionada(nota);
            setModalRegistroAberto(true);
        } catch (e) {
            toast.error("Não foi possível carregar os detalhes do registro.");
        } finally {
            setLoadingCardId(null);
        }
    };

    const processarInteligenciaProdutos = async (itensXml) => {
        const dbSearch = listaProdutosDb || [];

        const resultadoPromessas = itensXml.map(async (xmlItem, idx) => {
            const custoXml = parseNumber(xmlItem.vUnCom || xmlItem.valorUnitario || xmlItem.precoCusto || 0);

            if (dbSearch.length > 0) {
                const matchEan = dbSearch.find(db => db.codigoBarras && xmlItem.codigoBarras && db.codigoBarras.length > 7 && String(db.codigoBarras) === String(xmlItem.codigoBarras));

                if (matchEan) {
                    const precoVendaAtual = parseNumber(matchEan.precoVenda || (custoXml * 1.5));
                    const margemCalculada = custoXml > 0 ? (((precoVendaAtual - custoXml) / custoXml) * 100).toFixed(2) : '50.00';
                    // 🔥 CORREÇÃO: Se for zero no banco, o custo médio real é o da nota atual.
                    const custoMedioBanco = parseNumber(matchEan.precoMedioPonderado || matchEan.precoCusto) || custoXml;

                    return {
                        ...xmlItem, idProduto: matchEan.id, descricao: matchEan.descricao, status: 'vinculado', match: matchEan,
                        precoCusto: custoXml, custoMedioAtual: custoMedioBanco, precoVenda: precoVendaAtual, margem: margemCalculada, confianca: '100% (EAN)'
                    };
                }

                let melhor = null; let maiorScore = 0;
                dbSearch.forEach(db => {
                    let score = calcularSimilaridade(xmlItem.descricao, db.descricao);
                    if (score > 0.4 && db.ncm === xmlItem.ncm) score += 0.2;
                    if (score > maiorScore) { maiorScore = score; melhor = db; }
                });

                if (maiorScore >= 0.65 && melhor) {
                    return { ...xmlItem, idProduto: null, status: 'semelhante', match: melhor, precoCusto: custoXml, confianca: `${Math.round(maiorScore * 100)}% (IA)` };
                }
            }

            let eanGerado = xmlItem.codigoBarras || '';
            if (!eanGerado || eanGerado.trim() === '' || eanGerado === 'S/N') {
                try {
                    const base = await produtoService.gerarEanInterno();
                    eanGerado = String(BigInt(base) + BigInt(idx));
                } catch (e) { eanGerado = 'S/N'; }
            }

            const marcaInferida = findDictionaryMatch(xmlItem.descricao, dicionarios.marcas) || 'GENERICA';
            const catInferida = findDictionaryMatch(xmlItem.descricao, dicionarios.categorias) || 'GERAL';
            const subcatInferida = findDictionaryMatch(xmlItem.descricao, dicionarios.subcategorias) || '';

            return {
                ...xmlItem, codigoBarras: eanGerado, idProduto: null, status: 'novo', match: null,
                precoCusto: custoXml, marca: marcaInferida, categoria: catInferida, subcategoria: subcatInferida, preenchidoViaIA: false
            };
        });

        return Promise.all(resultadoPromessas);
    };

  const atualizarCampoItem = (index, campo, valor) => {
      const lista = [...itensImportacao];
      if (campo === 'precoCusto') {
          lista[index][campo] = parseNumber(valor);
      } else {
          lista[index][campo] = campo === 'descricao' ? valor.toUpperCase() : valor;
      }
      setItensImportacao(lista);
  };

  const handleInlineEditValores = (index, campo, valorNumerico) => {
      const lista = [...itensImportacao];
      const item = lista[index];
      item[campo] = valorNumerico;

      const custo = parseNumber(item.precoCusto);

      if (campo === 'precoVenda') {
          const pv = parseNumber(valorNumerico);
          item.margem = custo > 0 ? (((pv - custo) / custo) * 100).toFixed(2) : "0.00";
      } else if (campo === 'margem') {
          const mg = parseNumber(valorNumerico);
          item.precoVenda = (custo * (1 + (mg / 100))).toFixed(2);
      }
      setItensImportacao(lista);
  };

  const vincularSugestao = (index, dbProd) => {
      const lista = [...itensImportacao];
      const custoXml = parseNumber(lista[index].precoCusto || lista[index].valorUnitario || lista[index].vUnCom);
      const precoVendaAtual = parseNumber(dbProd.precoVenda || (custoXml * 1.5));
      const margemCalc = custoXml > 0 ? (((precoVendaAtual - custoXml) / custoXml) * 100).toFixed(2) : '50.00';
      const custoMedioBanco = parseNumber(dbProd.precoMedioPonderado || dbProd.precoCusto) || custoXml;

      lista[index] = {
          ...lista[index], idProduto: dbProd.id, descricao: dbProd.descricao, codigoBarras: dbProd.codigoBarras,
          status: 'vinculado', precoCusto: custoXml, custoMedioAtual: custoMedioBanco, precoVenda: precoVendaAtual, margem: margemCalc
      };
      setItensImportacao(lista);
  };

  const abrirEdicaoRapida = async (idx, item) => {
      const custo = parseNumber(item.precoCusto);
      const margemInicial = 50.00;
      const precoVenda = custo * (1 + (margemInicial / 100));

      setQuickEditIndex(idx);
      setQuickEditForm({
          descricao: item.descricao || '', codigoBarras: item.codigoBarras || '',
          marca: item.marca || 'GENERICA', categoria: item.categoria || 'GERAL', subcategoria: item.subcategoria || '',
          precoCusto: custo, margem: margemInicial, precoVenda: precoVenda
      });
  };

  const handlePrecificacaoQuickEdit = (campo, valorNumerico) => {
      const form = { ...quickEditForm, [campo]: valorNumerico };
      const custo = parseFloat(form.precoCusto) || 0;
      const margem = parseFloat(form.margem) || 0;
      const venda = parseFloat(form.precoVenda) || 0;

      if (campo === 'precoCusto' || campo === 'margem') form.precoVenda = custo * (1 + (margem / 100));
      else if (campo === 'precoVenda') form.margem = custo > 0 ? ((venda - custo) / custo) * 100 : 0;

      setQuickEditForm(form);
  };

  const salvarEdicaoRapida = () => {
      const lista = [...itensImportacao];
      lista[quickEditIndex] = {
          ...lista[quickEditIndex],
          descricao: quickEditForm.descricao.toUpperCase(),
          codigoBarras: quickEditForm.codigoBarras,
          marca: quickEditForm.marca.toUpperCase(),
          categoria: quickEditForm.categoria.toUpperCase(),
          subcategoria: quickEditForm.subcategoria.toUpperCase(),
          precoCusto: parseNumber(quickEditForm.precoCusto),
          precoVenda: parseNumber(quickEditForm.precoVenda),
          margem: quickEditForm.margem,
          preenchidoViaIA: true
      };
      setItensImportacao(lista);
      setQuickEditIndex(null);
  };

  const confirmarEntradaModal = async () => {
      if (loadingModal) return;

      if (!cabecalhoModal.fornecedorId) {
          toast.warn("O campo Fornecedor é obrigatório!");
          document.getElementById('fornecedor-modal-select')?.focus();
          return;
      }
      if (itensImportacao.some(i => i.status === 'semelhante')) return toast.warn("Verifique os itens marcados em ATENÇÃO.");
      if (itensImportacao.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) return toast.warn("Produtos novos precisam de um Código EAN.");

      setLoadingModal(true);
      const toastId = toast.loading("A Efetivar Estoque e Financeiro...");

      try {
          const payload = {
              fornecedorId: Number(cabecalhoModal.fornecedorId),
              numeroDocumento: String(cabecalhoModal.numeroDocumento || "S/N"),
              dataEntrada: cabecalhoModal.dataEmissao,
              chaveAcesso: String(notaSelecionada.chaveAcesso || ""),
              itens: itensImportacao.map(i => ({
                  produtoId: i.idProduto ? Number(i.idProduto) : null,
                  codigoBarras: String(i.codigoBarras || "S/N"),
                  descricao: String(i.descricao || "PRODUTO SEM NOME"),
                  quantidade: parseNumber(i.quantidade || i.qCom || 0),
                  valorUnitario: parseNumber(i.precoCusto || 0),
                  ncm: String(i.ncm || "00000000"),
                  origem: "0", cst: "102",
                  marca: String(i.marca || "GENERICA"),
                  categoria: String(i.categoria || "GERAL"),
                  subcategoria: String(i.subcategoria || "GERAL"),
                  unidade: "UN"
              }))
          };

          await api.post('/estoque/entrada', payload);

          if (notaSelecionada && notaSelecionada.id !== 'MANUAL') {
              await api.post(`/estoque/notas-pendentes/${notaSelecionada.id}/importar`);
          }

          toast.update(toastId, { render: "Estoque Atualizado com Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
          setModalAberto(false);
          carregarNotasDoBackend();
      } catch(e) {
          console.error(e);
          toast.update(toastId, { render: "Erro Crítico ao salvar estoque. Verifique a formatação.", type: "error", isLoading: false, autoClose: 5000 });
      } finally {
          setLoadingModal(false);
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
  const totalQuantidadeModal = itensImportacao.reduce((acc, curr) => acc + parseNumber(curr.quantidade || curr.qCom || 0), 0);
  const totalItensModal = itensImportacao.length;
  const totalGeralModal = itensImportacao.reduce((acc, curr) => acc + (parseNumber(curr.quantidade || curr.qCom || 0) * parseNumber(curr.precoCusto || 0)), 0);

  return (
    <div className="gestao-notas-container">

      <div className="gns-header">
        <div className="gns-header-left">
            <div className="gns-icon-box"><Inbox size={36} color="#60a5fa" /></div>
            <div>
              <h1>Caixa de Entrada Fiscal</h1>
              <p>Gestão unificada de faturamentos da SEFAZ.</p>
            </div>
        </div>
        <div className="gns-header-actions">
            <button onClick={sincronizarSefaz} disabled={syncing} className={`btn-sync ${!syncing ? 'active' : ''}`}>
                <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? "Consultando SEFAZ..." : "Puxar Novas Notas"}
            </button>
        </div>
      </div>

      <div className="gns-filters-grid">
          <div className="filter-card">
            <h3><Search size={18} color="#3b82f6"/> Filtro Inteligente (Chave)</h3>
            <div className="form-busca">
              <div className="input-wrapper">
                <Search size={18} className="icon-busca" />
                <input type="text" placeholder="Cole a chave ou digite..." value={chaveBusca} onChange={(e) => setChaveBusca(e.target.value)} maxLength={44} className="search-input" />
              </div>
            </div>
          </div>

          <div className="filter-card">
            <div className="filter-header">
                <h3><Filter size={18} color="#f59e0b"/> Filtros da Base de Dados</h3>
                {(dataInicio || dataFim) && (<button onClick={limparFiltros} className="btn-clear-filter">Limpar</button>)}
            </div>
            <div className="date-inputs-wrapper">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="date-input" />
                <span className="date-separator">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="date-input" />
                <button onClick={aplicarFiltroDatas} className="btn-aplicar-filtro">Filtrar</button>
            </div>
            <div className="toggle-view">
                <label className="switch-ui">
                    <input type="checkbox" checked={verImportadas} onChange={(e) => setVerImportadas(e.target.checked)} />
                    <span className="switch-text">Exibir Histórico de Notas Já Registradas</span>
                </label>
            </div>
          </div>
      </div>

      {loading ? (
        <div className="state-container loading"><RefreshCw size={40} className="animate-spin" /><h2>Lendo Base de Dados...</h2></div>
      ) : notasExibidas.length === 0 ? (
        <div className="state-container empty fade-in">
          <FileText size={48} color="#cbd5e1" />
          <h2>Nenhuma nota encontrada na tela.</h2>
          {chaveBusca.length === 44 && <button onClick={buscarNaSefazForcado} className="btn-aplicar-filtro">🔍 Buscar Chave na SEFAZ Nacional</button>}
        </div>
      ) : (
        <div className="notas-list">
          {notasExibidas.map((nota) => {
            const isImportada = nota.status === 'IMPORTADA' || nota.status === 'CONCLUIDA';
            const isResumo = nota.status === 'PENDENTE_MANIFESTACAO';
            const isLoadingThis = loadingCardId === nota.id;

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
                        <div className="ncu-item"><span className="ncu-label">Documento</span><strong className="ncu-value"><FileText size={14}/> NF-e {extrairNumeroNota(nota.chaveAcesso)}</strong></div>
                        <div className="ncu-item"><span className="ncu-label">Chave de Acesso</span><span className="ncu-chave">{nota.chaveAcesso}</span></div>
                    </div>
                    <div className="ncu-financeiro">
                        <div className="ncu-item"><span className="ncu-label">Data de Emissão</span><span className="ncu-value"><Calendar size={14}/> {nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                        <div className="ncu-item"><span className="ncu-label">Faturamento Total</span><strong className="ncu-valor-destaque">R$ {nota.valorTotal ? nota.valorTotal.toFixed(2).replace('.',',') : '0,00'}</strong></div>
                    </div>
                    <div className="ncu-acao">
                        {/* 🔥 SE ESTIVER IMPORTADA, MOSTRA BOTÃO DE VER REGISTRO */}
                        {isImportada ? (
                          <button onClick={() => visualizarNotaRegistrada(nota)} disabled={isLoadingThis} className={`btn-acao importada-view`}>
                              {isLoadingThis ? <RefreshCw size={18} className="animate-spin" /> : <Eye size={18} />}
                              Ver Registro <ChevronRight size={18} />
                          </button>
                        ) : (
                          <button onClick={() => iniciarProcessamento(nota)} disabled={isLoadingThis} className={`btn-acao ${isResumo ? 'resumo' : 'importar'}`}>
                            {isLoadingThis ? <RefreshCw size={18} className="animate-spin" /> : isResumo ? <DownloadCloud size={18} /> : <Package size={18} />}
                            {isLoadingThis ? "A Preparar..." : isResumo ? "Baixar Sefaz" : "Processar Entrada"} <ChevronRight size={18} />
                          </button>
                        )}
                    </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL PRINCIPAL: IMPORTAÇÃO E AUDITORIA */}
      {/* ============================================================================ */}
      {modalAberto && (
          <div className="modal-overlay fade-in">
              <div className="import-modal scale-in">

                  <div className="mi-header-top">
                      <div className="mi-title-box">
                          <div className="mi-icon"><FileText size={32}/></div>
                          <div>
                              <h2>Importação de NF-e {cabecalhoModal.numeroDocumento}</h2>
                              <span className="mi-chave"><Hash size={14}/> Chave: {notaSelecionada?.chaveAcesso || "S/N"}</span>
                          </div>
                      </div>

                      <div className="mi-actions">
                          <button onClick={gerarEspelhoConferencia} className="btn-baixar-danfe">
                              <DownloadCloud size={18} /> Imprimir Espelho de Conferência
                          </button>
                          <button onClick={() => setModalAberto(false)} className="btn-close-modal"><X size={24}/></button>
                      </div>
                  </div>

                  <div className="mi-info-grid">
                      <div className="mi-info-item">
                          <span className="mi-label"><Building size={12}/> Razão Social do Fornecedor</span>
                          <strong className="mi-value">{notaSelecionada?.nomeFornecedor || "Fornecedor da Nota Manual"}</strong>
                      </div>
                      <div className="mi-info-item">
                          <span className="mi-label">CNPJ Identificado</span>
                          <strong className="mi-value monospace">{maskCNPJ(notaSelecionada?.cnpjFornecedor || dadosPreForn?.cnpj)}</strong>
                      </div>
                      <div className="mi-info-item">
                          <span className="mi-label"><Calendar size={12}/> Emissão</span>
                          <strong className="mi-value">{formatarDataBR(cabecalhoModal.dataEmissao)}</strong>
                      </div>
                      <div className="mi-info-item">
                          <span className="mi-label"><Package size={12}/> Volumes da Nota</span>
                          <strong className="mi-value">{totalItensModal} Itens ({totalQuantidadeModal} UN)</strong>
                      </div>
                      <div className="mi-info-item highlight">
                          <span className="mi-label">Valor Total da Nota</span>
                          <strong className="mi-value valor-total">R$ {(notaSelecionada?.valorTotal || totalGeralModal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
                      </div>
                  </div>

                  <div className="modal-body-premium custom-scrollbar">

                      <div className="panel-fornecedor">
                          <div className="dp-col dp-col-large">
                              <div className="filter-header">
                                  <label>Fornecedor (Vínculo no Sistema)</label>
                                  {!cabecalhoModal.fornecedorId && (
                                      <button onClick={() => setModalFornecedorAberto(true)} className="btn-add-forn"><Plus size={12}/> Cadastrar Manual</button>
                                  )}
                              </div>
                              <select
                                  id="fornecedor-modal-select"
                                  className="dp-select-premium"
                                  value={cabecalhoModal.fornecedorId ? String(cabecalhoModal.fornecedorId) : ""}
                                  onChange={(e) => setCabecalhoModal({...cabecalhoModal, fornecedorId: e.target.value})}
                              >
                                  <option value="">Selecione para Vincular...</option>
                                  {listaFornecedores.map(f => (
                                      <option key={f.id} value={String(f.id)}>{f.razaoSocial || f.nomeFantasia}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="stepper-header">Auditoria e Vínculo de Mercadorias</div>
                      <div className="modal-table-area">
                          <table className="modern-table">
                              <thead>
                                  <tr>
                                      <th width="15%">Auditoria IA</th>
                                      <th width="40%">Mercadoria no XML</th>
                                      <th width="25%">Custo Unitário / Volume</th>
                                      <th width="20%">Ação Requerida</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {itensImportacao.map((item, idx) => {
                                      const qtdNum = parseNumber(item.quantidade || item.qCom || 0);
                                      const custoNum = parseNumber(item.precoCusto || 0);
                                      const subtotalLinha = qtdNum * custoNum;

                                      return (
                                          <tr key={idx} className={`tr-${item.status}`}>
                                              <td className="td-status">
                                                  {item.status === 'vinculado' && <span className="badge-status importada"><CheckCircle size={14}/> VINCULADO</span>}
                                                  {item.status === 'semelhante' && <span className="badge-status resumo"><AlertTriangle size={14}/> REVISAR</span>}
                                                  {item.status === 'novo' && <span className="badge-status pendente"><Package size={14}/> NOVO (CRIAR)</span>}
                                              </td>

                                              <td>
                                                  <div className="produto-leitura">
                                                      <strong>{item.descricao}</strong>
                                                      <div className="prod-meta">
                                                          <span className="pill-gray"><Barcode size={12}/> {item.codigoBarras || "S/ GTIN"}</span>
                                                          <span className="pill-gray"><FileText size={12}/> NCM: {item.ncm}</span>
                                                          {item.preenchidoViaIA && <span className="pill-gray pill-ia"><Sparkles size={12}/> Atributos Prontos</span>}
                                                      </div>
                                                  </div>
                                              </td>

                                              <td className="td-valores" onDoubleClick={() => setEditingPriceIndex(idx)}>
                                                  <span className="qtd-badge">{qtdNum} UN</span>

                                                  {editingPriceIndex === idx ? (
                                                      <input
                                                          type="number" step="0.01" autoFocus defaultValue={custoNum}
                                                          onBlur={(e) => {
                                                              atualizarCampoItem(idx, 'precoCusto', e.target.value);
                                                              setEditingPriceIndex(null);
                                                          }}
                                                          onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                  atualizarCampoItem(idx, 'precoCusto', e.target.value);
                                                                  setEditingPriceIndex(null);
                                                              }
                                                          }}
                                                          className="input-elegante focus-blue"
                                                      />
                                                  ) : (
                                                      <span className="unit-cost" title="Duplo clique para editar">Custo NF: R$ {formatMoney(custoNum)} / un</span>
                                                  )}

                                                  {item.status === 'vinculado' && (
                                                      <span className="custo-medio-label" title="Puxado do banco de dados (Ou NF atual se era inédito)">
                                                          Custo Médio DB: R$ {formatMoney(item.custoMedioAtual)}
                                                      </span>
                                                  )}

                                                  <strong className="total-cost text-primary" style={{marginTop: '4px'}}>Subtotal: R$ {formatMoney(subtotalLinha)}</strong>

                                                  {item.status === 'vinculado' && (
                                                      <div className="inline-edit-container">
                                                          <div className="inline-form-group">
                                                              <label className="inline-label">Margem (%)</label>
                                                              <input type="text" value={formatMoney(item.margem)} onChange={(e) => handleInlineEditValores(idx, 'margem', parseMoneyInput(e.target.value))} className="inline-input margem" />
                                                          </div>
                                                          <div className="inline-form-group">
                                                              <label className="inline-label">Venda (R$)</label>
                                                              <input type="text" value={formatMoney(item.precoVenda)} onChange={(e) => handleInlineEditValores(idx, 'precoVenda', parseMoneyInput(e.target.value))} className="inline-input venda" />
                                                          </div>
                                                      </div>
                                                  )}
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
                                                      <div className="txt-sucesso-ia"><CheckCircle size={16}/> <span>Tudo Certo. +{qtdNum} no estoque.</span></div>
                                                  )}
                                                  {item.status === 'novo' && (
                                                      <button onClick={() => abrirEdicaoRapida(idx, item)} className="btn-completar-cadastro">
                                                          <Edit3 size={16}/> {item.preenchidoViaIA ? "Revisar Atributos" : "Completar Cadastro"}
                                                      </button>
                                                  )}
                                              </td>
                                          </tr>
                                      )
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {!loadingModal && (
                      <div className="modal-footer-premium">
                          <button className="btn-confirmar-gigante" onClick={confirmarEntradaModal} disabled={loadingModal}>
                              <Save size={22}/> Confirmar Atualização do Estoque
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL DE LEITURA (VER NOTA JÁ REGISTRADA) */}
      {/* ============================================================================ */}
      {modalRegistroAberto && (
          <div className="modal-overlay fade-in">
              <div className="import-modal scale-in" style={{maxWidth: '900px', height: 'auto', maxHeight: '85vh'}}>
                  <div className="mi-header-top">
                      <div className="mi-title-box">
                          <div className="mi-icon" style={{background: '#dcfce7', color: '#10b981'}}><CheckCircle size={32}/></div>
                          <div>
                              <h2 style={{color: '#064e3b'}}>Registro Finalizado: {notaSelecionada?.numeroNota || extrairNumeroNota(notaSelecionada?.chaveAcesso)}</h2>
                              <span className="mi-chave"><Hash size={14}/> Chave: {notaSelecionada?.chaveAcesso}</span>
                          </div>
                      </div>
                      <button onClick={() => setModalRegistroAberto(false)} className="btn-close-modal"><X size={24}/></button>
                  </div>

                  <div className="modal-body-premium custom-scrollbar" style={{background: '#fff'}}>
                      <p style={{color: '#64748b', marginBottom: '20px'}}>Esta nota já foi processada, os produtos já somaram ao estoque e o financeiro já foi provisionado.</p>

                      <table className="modern-table" style={{border: '1px solid #e2e8f0'}}>
                          <thead style={{background: '#f8fafc'}}>
                              <tr><th>Produto (No Sistema)</th><th>Qtd Entrou</th><th>Custo Lançado</th><th>Subtotal</th></tr>
                          </thead>
                          <tbody>
                              {detalhesRegistro.map((item, idx) => {
                                  const partes = (item.infoParaFront || item.produtoDescricao || "").split('|');
                                  const nome = partes[0] || "Produto";
                                  const q = parseNumber(item.quantidade || item.quantidadeMovimentada);
                                  const c = parseNumber(item.custoUnitario || item.custoMovimentado);
                                  return (
                                      <tr key={idx}>
                                          <td><strong>{nome}</strong></td>
                                          <td><span className="qtd-badge">{q} UN</span></td>
                                          <td>R$ {formatMoney(c)}</td>
                                          <td style={{fontWeight: 'bold', color: '#3b82f6'}}>R$ {formatMoney(q * c)}</td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* ============================================================================ */}
      {/* MODAL QUICK EDIT (CRIAR PRODUTO NOVO NO MESMO CONTEXTO) */}
      {/* ============================================================================ */}
      {quickEditIndex !== null && (
          <div className="qe-overlay">
              <div className="qe-card scale-in">
                  <div className="qe-header">
                      <h3><Sparkles size={18} className="text-primary"/> Configurar Atributos do Novo Produto</h3>
                      <button onClick={() => setQuickEditIndex(null)} className="btn-close-modal"><X size={20}/></button>
                  </div>

                  <div className="qe-body">
                      <div className="qe-form-group">
                          <label>Descrição Oficial (Como ficará no sistema)</label>
                          <input type="text" value={quickEditForm.descricao} onChange={e => setQuickEditForm({...quickEditForm, descricao: e.target.value})} className="qe-input" />
                      </div>

                      <div className="qe-grid-2">
                          <div className="qe-form-group">
                              <label>EAN / Código de Barras</label>
                              <div className="qe-ean-row">
                                  <input type="text" value={quickEditForm.codigoBarras} onChange={e => setQuickEditForm({...quickEditForm, codigoBarras: e.target.value})} className="qe-input" style={{flex: 1}} />
                                  <button onClick={async () => {
                                      try { const base = await produtoService.gerarEanInterno(); setQuickEditForm({...quickEditForm, codigoBarras: String(base)}); } catch(e){}
                                  }} className="btn-qe-magic" title="Gerar Novo Sequencial"><Wand2 size={18}/></button>
                              </div>
                          </div>
                          <div className="qe-form-group">
                              <label>Marca <span style={{fontSize: '0.65rem', textTransform: 'none'}}>(Duplo clique p/ listar)</span></label>
                              <input list="lista-marcas-qe" value={quickEditForm.marca} onChange={e => setQuickEditForm({...quickEditForm, marca: e.target.value})} onDoubleClick={() => setQuickEditForm({...quickEditForm, marca: ''})} className="qe-input" placeholder="Selecione ou digite..." />
                              <datalist id="lista-marcas-qe">{dicionarios.marcas.map((m, i) => <option key={i} value={m} />)}</datalist>
                          </div>
                      </div>

                      <div className="qe-grid-2">
                          <div className="qe-form-group">
                              <label>Categoria <span style={{fontSize: '0.65rem', textTransform: 'none'}}>(Duplo clique p/ listar)</span></label>
                              <input list="lista-cat-qe" value={quickEditForm.categoria} onChange={e => setQuickEditForm({...quickEditForm, categoria: e.target.value})} onDoubleClick={() => setQuickEditForm({...quickEditForm, categoria: ''})} className="qe-input" placeholder="Selecione ou digite..." />
                              <datalist id="lista-cat-qe">{dicionarios.categorias.map((c, i) => <option key={i} value={c} />)}</datalist>
                          </div>
                          <div className="qe-form-group">
                              <label>Subcategoria <span style={{fontSize: '0.65rem', textTransform: 'none'}}>(Duplo clique p/ listar)</span></label>
                              <input list="lista-subcat-qe" value={quickEditForm.subcategoria} onChange={e => setQuickEditForm({...quickEditForm, subcategoria: e.target.value})} onDoubleClick={() => setQuickEditForm({...quickEditForm, subcategoria: ''})} className="qe-input" placeholder="Selecione ou digite..." />
                              <datalist id="lista-subcat-qe">{dicionarios.subcategorias.map((s, i) => <option key={i} value={s} />)}</datalist>
                          </div>
                      </div>

                      <div className="qe-grid-3">
                          <div className="qe-form-group">
                              <label>Custo Base (R$)</label>
                              <input type="text" value={formatMoney(quickEditForm.precoCusto)} onChange={e => handlePrecificacaoQuickEdit('precoCusto', parseMoneyInput(e.target.value))} className="qe-input" style={{fontFamily:'monospace'}} />
                          </div>
                          <div className="qe-form-group">
                              <label>Margem Lícita (%)</label>
                              <input type="text" value={formatMoney(quickEditForm.margem)} onChange={e => handlePrecificacaoQuickEdit('margem', parseMoneyInput(e.target.value))} className="qe-input" style={{color:'#047857', borderColor:'#6ee7b7', fontFamily:'monospace'}} />
                          </div>
                          <div className="qe-form-group">
                              <label>Preço Venda (R$)</label>
                              <input type="text" value={formatMoney(quickEditForm.precoVenda)} onChange={e => handlePrecificacaoQuickEdit('precoVenda', parseMoneyInput(e.target.value))} className="qe-input" style={{color:'#1e40af', background:'#eff6ff', borderColor:'#bfdbfe', fontFamily:'monospace'}} />
                          </div>
                      </div>
                  </div>

                  <div className="qe-footer">
                      <button onClick={() => setQuickEditIndex(null)} className="btn-qe-cancel">Cancelar</button>
                      <button onClick={salvarEdicaoRapida} className="btn-qe-save"><CheckCircle size={18}/> Salvar Atributos</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL FORNECEDOR MANUAL */}
      {modalFornecedorAberto && (
          <div className="modal-overlay" style={{zIndex: 99999}}>
              <div className="modal-card scale-in" style={{ maxWidth: '800px', width: '95%', padding: '0', background: '#fff', borderRadius: '16px', overflow: 'hidden' }}>
                  <div className="modal-header-premium">
                      <h2 style={{margin:0}}>Completar Registo do Fornecedor</h2>
                      <button onClick={() => setModalFornecedorAberto(false)} className="btn-close-modal"><X size={20}/></button>
                  </div>
                  <div style={{ padding: '20px' }}>
                      <FornecedorForm isModal={true} prefillData={dadosPreForn} onSuccess={handleFornecedorCriado} />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GestaoNotasSefaz;