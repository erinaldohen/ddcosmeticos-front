import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { maskCNPJ } from '../../utils/masks';
import {
  Search, RefreshCw, CheckCircle, FileText, Calendar, Building,
  DownloadCloud, Filter, Inbox, Package, X, AlertTriangle, Link as LinkIcon,
  Wand2, Save, Barcode, ChevronRight, Hash, Edit3, Sparkles, Eye, Clock, User
} from 'lucide-react';

import './GestaoNotasSefaz.css';

// ============================================================================
// HELPERS, MÁSCARAS E MOTOR DE INTELIGÊNCIA ARTIFICIAL FRONTEND
// ============================================================================
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
    const partes = dataIso.split('T')[0].split('-');
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const formatarDataHoraCompleta = (dataObj) => {
    if (!dataObj) return "---";
    try {
        let data;
        if (Array.isArray(dataObj)) {
            data = new Date(dataObj[0], dataObj[1] - 1, dataObj[2], dataObj[3] || 0, dataObj[4] || 0, dataObj[5] || 0);
        } else {
            data = new Date(dataObj);
        }
        if (isNaN(data.getTime())) return "---";
        return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch(e) { return "---"; }
};

const extrairNumeroNota = (chave) => {
    if (!chave || chave.length !== 44) return "S/N";
    return parseInt(chave.substring(25, 34), 10).toString();
};

const calcularSemelhancaTokens = (str1, str2) => {
    if (!str1 || !str2) return 0;
    const limpa = s => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, '');
    const extrairTokens = texto => limpa(texto).split(/\s+/).filter(w => w.length > 2 || /\d/.test(w));

    const tokens1 = extrairTokens(str1);
    const tokens2 = extrairTokens(str2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    let matches = 0;
    tokens1.forEach(t1 => {
        const hit = tokens2.some(t2 => t1 === t2 || (t1.length >= 3 && t2.length >= 3 && (t1.includes(t2) || t2.includes(t1))));
        if (hit) matches++;
    });
    return matches / Math.max(tokens1.length, tokens2.length);
};

export default function GestaoNotasSefaz() {
  const navigate = useNavigate();

  // ==========================================================================
  // ESTADOS PRINCIPAIS
  // ==========================================================================
  const [todasNotas, setTodasNotas] = useState([]);
  const [notasExibidas, setNotasExibidas] = useState([]);
  const [listaProdutosDb, setListaProdutosDb] = useState([]);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [modalType, setModalType] = useState(null);

  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [itensImportacao, setItensImportacao] = useState([]);
  const [detalhesRegistro, setDetalhesRegistro] = useState([]);
  const [cabecalhoModal, setCabecalhoModal] = useState({ numeroDocumento: '', dataEmissao: '' });
  const [loadingModal, setLoadingModal] = useState(false);
  const [loadingCardId, setLoadingCardId] = useState(null);

  const [editingPriceIndex, setEditingPriceIndex] = useState(null);
  const [editingQtyIndex, setEditingQtyIndex] = useState(null); // 🔥 NOVO: Controle de edição de pacotes

  const [linkManualIndex, setLinkManualIndex] = useState(null);
  const [buscaManual, setBuscaManual] = useState('');

  const [quickEditIndex, setQuickEditIndex] = useState(null);
  const [quickEditForm, setQuickEditForm] = useState({
      descricao: '', codigoBarras: '', marca: '', categoria: '', subcategoria: '', precoCusto: 0, margem: 50.00, precoVenda: 0
  });

  const [verImportadas, setVerImportadas] = useState(() => {
      try { const salvo = localStorage.getItem('ddcosmeticos_ver_importadas'); return salvo !== null ? JSON.parse(salvo) : true; } catch { return true; }
  });

  useEffect(() => { localStorage.setItem('ddcosmeticos_ver_importadas', JSON.stringify(verImportadas)); }, [verImportadas]);

  // ==========================================================================
  // DICIONÁRIO DINÂMICO E FILTRAGEM
  // ==========================================================================
  const dicionarios = useMemo(() => {
      const db = listaProdutosDb || [];
      const extrair = (prop1, prop2) => {
          const valores = db.map(p => p[prop1] || p[prop2]).filter(Boolean);
          return [...new Set(valores)].map(v => String(v).toUpperCase()).sort();
      };
      return {
          marcas: extrair('marca', 'marcaProduto'),
          categorias: extrair('categoria', 'categoriaProduto'),
          subcategorias: extrair('subcategoria', 'subCategoriaProduto')
      };
  }, [listaProdutosDb]);

  const produtosFiltradosManual = useMemo(() => {
      if (!buscaManual || buscaManual.length < 2) return [];
      const term = buscaManual.toUpperCase();
      return listaProdutosDb.filter(p => (p.descricao && p.descricao.toUpperCase().includes(term)) || (p.codigoBarras && p.codigoBarras.includes(term))).slice(0, 10);
  }, [buscaManual, listaProdutosDb]);

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================
  useEffect(() => {
    const init = async () => {
        try {
            const resP = await api.get('/produtos?size=5000');
            setListaProdutosDb(resP.data?.content || resP.data || []);
            buscarNotasBackend();
        } catch(e) { console.error("Erro inicialização:", e); }
    };
    init();
  }, []);

  useEffect(() => { buscarNotasBackend(); }, [verImportadas]);

  useEffect(() => {
      if (!Array.isArray(todasNotas)) return;
      let notasFiltradas = todasNotas;
      if (busca && busca.length > 3) {
          const buscaLimpa = busca.replace(/\D/g, '');
          notasFiltradas = todasNotas.filter(n => (n.chaveAcesso && n.chaveAcesso.includes(buscaLimpa)) || (n.nomeFornecedor && n.nomeFornecedor.toUpperCase().includes(busca.toUpperCase())));
      }
      setNotasExibidas(notasFiltradas);
  }, [todasNotas, busca]);

  const buscarNotasBackend = async () => {
    setLoading(true);
    try {
      let url = `/estoque/notas-pendentes?incluirImportadas=${verImportadas}`;
      if (dataInicio && dataFim) url += `&dataInicio=${dataInicio}&dataFim=${dataFim}`;
      const res = await api.get(url);
      setTodasNotas(Array.isArray(res.data) ? res.data : res.data?.content || []);
    } catch (e) { toast.error("Falha ao carregar notas."); } finally { setLoading(false); }
  };

  const aplicarFiltroDatas = () => { if(!dataInicio || !dataFim) return toast.warn("Selecione data de início e fim."); buscarNotasBackend(); };
  const limparFiltros = () => { setDataInicio(''); setDataFim(''); setBusca(''); setTimeout(() => buscarNotasBackend(), 100); };

  const sincronizarSefaz = async () => {
    setSyncing(true); toast.loading("Consultando a SEFAZ...", { toastId: 'sync' });
    try {
      await api.post('/estoque/notas-pendentes/sincronizar');
      toast.update('sync', { render: "Sincronização concluída!", type: "success", isLoading: false, autoClose: 3000 });
      buscarNotasBackend();
    } catch (e) {
      toast.update('sync', { render: "Bloqueio temporário da SEFAZ.", type: "warning", isLoading: false, autoClose: 5000 });
      buscarNotasBackend();
    } finally { setSyncing(false); }
  };

  // ==========================================================================
  // PROCESSAMENTO DE NOTA E ANÁLISE IA
  // ==========================================================================
  const iniciarProcessamento = async (nota) => {
        setBusca('');
        const toastId = toast.loading("Processando XML e Inteligência Artificial...");
        setLoadingCardId(nota.id);

        try {
            if (nota.status === 'PENDENTE_MANIFESTACAO') await api.post(`/estoque/notas-pendentes/${nota.id}/manifestar`);
            const res = await api.get(`/estoque/notas-pendentes/${nota.id}/xml-parse`);
            const parsed = res.data || {};

            const itensProcessados = parsed.itensXml.map((xmlItem, idx) => {
                const custoXml = parseNumber(xmlItem.vUnCom || xmlItem.valorUnitario || xmlItem.precoCusto || 0);

                let eanValido = xmlItem.codigoBarras && xmlItem.codigoBarras.length > 7;
                const dbMatchEan = eanValido ? listaProdutosDb.find(db => db.codigoBarras === xmlItem.codigoBarras) : null;

                if (dbMatchEan) {
                    const precoVendaAtual = parseNumber(dbMatchEan.precoVenda || (custoXml * 1.5));
                    const margemCalc = custoXml > 0 ? (((precoVendaAtual - custoXml) / custoXml) * 100) : 50;
                    const custoMedioReal = parseNumber(dbMatchEan.precoMedioPonderado) || parseNumber(dbMatchEan.precoCusto) || custoXml;
                    return { ...xmlItem, idProduto: dbMatchEan.id, descricao: dbMatchEan.descricao, status: 'vinculado', match: dbMatchEan, precoCusto: custoXml, custoMedioAtual: custoMedioReal, precoVenda: precoVendaAtual, margem: margemCalc };
                }

                let bestMatch = null;
                let maxScore = 0;
                listaProdutosDb.forEach(dbProd => {
                    const score = calcularSemelhancaTokens(xmlItem.descricao, dbProd.descricao);
                    if (score > maxScore) { maxScore = score; bestMatch = dbProd; }
                });

                if (bestMatch && maxScore >= 0.75) {
                    return { ...xmlItem, idProduto: null, status: 'semelhante', match: bestMatch, confianca: `${Math.round(maxScore * 100)}%`, precoCusto: custoXml };
                }

                let eanGerado = xmlItem.codigoBarras || '';
                if (!eanGerado || eanGerado === 'S/N') eanGerado = `200000000000${idx}`.slice(-13);

                return { ...xmlItem, codigoBarras: eanGerado, idProduto: null, status: 'novo', precoCusto: custoXml, marca: '', categoria: '', subcategoria: '' };
            });

            setCabecalhoModal({ numeroDocumento: extrairNumeroNota(nota.chaveAcesso), dataEmissao: (parsed.dataEmissao || nota.dataEmissao || new Date().toISOString()).split('T')[0] });
            setNotaSelecionada({ ...nota, cnpjFornecedor: parsed.cnpjFornecedor || nota.cnpjFornecedor, nomeFornecedor: parsed.razaoSocialFornecedor || nota.nomeFornecedor });
            setItensImportacao(itensProcessados);
            setModalType('IMPORT');
            toast.update(toastId, { render: "Análise Concluída!", type: "success", isLoading: false, autoClose: 1500 });
        } catch (err) {
            toast.update(toastId, { render: "Falha ao ler mercadorias.", type: "error", isLoading: false, autoClose: 4000 });
        } finally { setLoadingCardId(null); }
  };

  const visualizarRegistroFinalizado = async (nota) => {
        setLoadingCardId(nota.id);
        const toastId = toast.loading("Carregando registro...");
        try {
            const numDoc = extrairNumeroNota(nota.chaveAcesso);
            const res = await api.get(`/estoque/historico-entradas/${numDoc}/itens`);
            setDetalhesRegistro(Array.isArray(res.data) ? res.data : []);
            setNotaSelecionada(nota);
            setModalType('VIEW');
            toast.dismiss(toastId);
        } catch (e) {
            toast.update(toastId, { render: "Erro ao abrir registro.", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setLoadingCardId(null);
        }
  };

  const confirmarEntradaModal = async () => {
      if (loadingModal) return;
      if (!notaSelecionada?.cnpjFornecedor) return toast.warn("A nota fiscal não possui o CNPJ do fornecedor. Não é possível continuar.");
      if (itensImportacao.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) return toast.warn("Produtos novos precisam de EAN válido.");

      setLoadingModal(true);
      const toastId = toast.loading("Registando Fornecedor e Processando Estoque...");

      try {
          const payload = {
              fornecedorCnpj: String(notaSelecionada.cnpjFornecedor).replace(/\D/g, ''),
              fornecedorNome: String(notaSelecionada.nomeFornecedor || 'FORNECEDOR NF'),
              numeroDocumento: String(cabecalhoModal.numeroDocumento || "S/N"),
              dataEntrada: cabecalhoModal.dataEmissao,
              chaveAcesso: String(notaSelecionada.chaveAcesso || ""),
              itens: itensImportacao.map(i => ({
                  produtoId: i.idProduto ? Number(i.idProduto) : null, codigoBarras: String(i.codigoBarras || "S/N"),
                  descricao: String(i.descricao || "PRODUTO SEM NOME"), quantidade: parseNumber(i.quantidade || i.qCom || 0),
                  valorUnitario: parseNumber(i.precoCusto || 0), ncm: String(i.ncm || "00000000"), origem: "0", cst: "102",
                  marca: String(i.marca || "GENERICA"), categoria: String(i.categoria || "GERAL"), subcategoria: String(i.subcategoria || "GERAL"), unidade: "UN"
              }))
          };

          await api.post('/estoque/entrada', payload);
          if (notaSelecionada && notaSelecionada.id !== 'MANUAL') {
              await api.post(`/estoque/notas-pendentes/${notaSelecionada.id}/importar`);
          }

          setTodasNotas(prev => prev.map(n => n.id === notaSelecionada.id ? { ...n, status: 'IMPORTADA' } : n));
          toast.update(toastId, { render: "Entrada Concluída com Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
          setModalType(null);
          buscarNotasBackend();
      } catch(e) {
          toast.update(toastId, { render: "Erro Crítico ao salvar estoque.", type: "error", isLoading: false, autoClose: 5000 });
      } finally {
          setLoadingModal(false);
      }
  };

  const atualizarCampoItem = (index, campo, valor) => {
      const lista = [...itensImportacao];
      if (campo === 'precoCusto') lista[index][campo] = parseNumber(valor);
      else lista[index][campo] = campo === 'descricao' ? valor.toUpperCase() : valor;
      setItensImportacao(lista);
  };

  const handleInlineEditValores = (index, campo, valorNumerico) => {
      const lista = [...itensImportacao]; const item = lista[index]; item[campo] = valorNumerico;
      const custo = parseNumber(item.precoCusto);
      if (campo === 'precoVenda') item.margem = custo > 0 ? (((valorNumerico - custo) / custo) * 100) : 0;
      else if (campo === 'margem') item.precoVenda = custo * (1 + (valorNumerico / 100));
      setItensImportacao(lista);
  };

  // 🔥 NOVO: Lógica Matemática para Quebra de Pacotes
  const handleAlterarQuantidade = (index, novaQtd) => {
      const num = parseNumber(novaQtd);
      if (num <= 0) return;

      const lista = [...itensImportacao];
      const item = lista[index];

      const qtdAntiga = parseNumber(item.quantidade || item.qCom || 1);
      const custoAntigo = parseNumber(item.precoCusto || 0);

      // Mantém o subtotal original pago na nota
      const subtotal = qtdAntiga * custoAntigo;

      // Divide o subtotal pelas novas unidades (Ex: 27.00 / 12 unidades = 2.25/unidade)
      const novoCusto = subtotal / num;

      item.quantidade = num;
      item.qCom = num;
      item.precoCusto = novoCusto;

      if (item.precoVenda) {
          item.margem = novoCusto > 0 ? (((item.precoVenda - novoCusto) / novoCusto) * 100) : 0;
      }

      setItensImportacao(lista);
  };

  const vincularSugestao = (index, dbProd) => {
      const lista = [...itensImportacao];
      const custoXml = parseNumber(lista[index].precoCusto || 0);
      const precoVendaAtual = parseNumber(dbProd.precoVenda || (custoXml * 1.5));
      const margemCalc = custoXml > 0 ? (((precoVendaAtual - custoXml) / custoXml) * 100) : 50;
      const custoMedioBanco = parseNumber(dbProd.precoMedioPonderado || dbProd.precoCusto) || custoXml;

      lista[index] = { ...lista[index], idProduto: dbProd.id, descricao: dbProd.descricao, codigoBarras: dbProd.codigoBarras, status: 'vinculado', precoCusto: custoXml, custoMedioAtual: custoMedioBanco, precoVenda: precoVendaAtual, margem: margemCalc };
      setItensImportacao(lista);
  };

  const abrirVinculoManual = (idx) => { setLinkManualIndex(idx); setBuscaManual(''); setModalType('LINK_MANUAL'); };
  const confirmarVinculoManual = (dbProd) => { vincularSugestao(linkManualIndex, dbProd); setLinkManualIndex(null); setModalType('IMPORT'); };

  const abrirEdicaoRapida = async (idx, item) => {
      const custo = parseNumber(item.precoCusto);
      const mInicial = 50.00;
      const precoVenda = custo * (1 + (mInicial / 100));

      let guessedMarca = 'GENERICA';
      let guessedCat = '';
      let guessedSub = '';
      let bestScore = 0;
      let bestDbMatch = null;

      listaProdutosDb.forEach(dbProd => {
          const score = calcularSemelhancaTokens(item.descricao, dbProd.descricao);
          if (score > bestScore) { bestScore = score; bestDbMatch = dbProd; }
      });

      if (bestDbMatch && bestScore >= 0.35) {
          guessedMarca = bestDbMatch.marca || guessedMarca;
          guessedCat = bestDbMatch.categoria || guessedCat;
          guessedSub = bestDbMatch.subcategoria || guessedSub;
      }

      setQuickEditIndex(idx);
      setQuickEditForm({
          descricao: item.descricao || '', codigoBarras: item.codigoBarras || '',
          marca: guessedMarca, categoria: guessedCat, subcategoria: guessedSub,
          precoCusto: custo, margem: mInicial, precoVenda: precoVenda
      });
      setModalType('QUICK');
  };

  const handlePrecificacaoQuickEdit = (campo, valorNumerico) => {
      const form = { ...quickEditForm, [campo]: valorNumerico };
      const custo = parseFloat(form.precoCusto) || 0; const marg = parseFloat(form.margem) || 0; const vend = parseFloat(form.precoVenda) || 0;
      if (campo === 'precoCusto' || campo === 'margem') form.precoVenda = custo * (1 + (marg / 100));
      else if (campo === 'precoVenda') form.margem = custo > 0 ? ((vend - custo) / custo) * 100 : 0;
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
      setItensImportacao(lista); setQuickEditIndex(null); setModalType('IMPORT');
  };

  const gerarEspelhoConferencia = () => {
      const win = window.open('', '_blank');
      const html = `<html><head><title>Espelho - NF-e ${cabecalhoModal.numeroDocumento}</title><style>body{font-family:Arial;padding:40px}.header{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:30px}.info-box{display:flex;justify-content:space-between;background:#f8fafc;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-bottom:30px}th{background:#f1f5f9;padding:12px;text-align:left;border-bottom:2px solid #cbd5e1}td{padding:12px;border-bottom:1px solid #e2e8f0;font-size:14px}.checkbox{width:18px;height:18px;border:2px solid #94a3b8;display:inline-block}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}</style></head><body><div class="header"><h2>Espelho de Conferência Física</h2><p>Chave: ${notaSelecionada?.chaveAcesso}</p></div><div class="info-box"><div><strong>Fornecedor:</strong> ${notaSelecionada?.nomeFornecedor}</div><div><strong>CNPJ:</strong> ${maskCNPJ(notaSelecionada?.cnpjFornecedor)}</div><div><strong>NF-e:</strong> ${cabecalhoModal.numeroDocumento}</div></div><table><thead><tr><th>Conf</th><th>Código</th><th>Descrição</th><th>Qtd</th><th>Custo Unit.</th></tr></thead><tbody>${itensImportacao.map(i => `<tr><td><div class="checkbox"></div></td><td>${i.codigoBarras}</td><td>${i.descricao}</td><td>${parseNumber(i.quantidade||i.qCom)}</td><td>R$ ${formatMoney(i.precoCusto)}</td></tr>`).join('')}</tbody></table><div class="total">Total Valor: R$ ${formatMoney(notaSelecionada?.valorTotal)}</div><script>window.onload=()=>window.print();</script></body></html>`;
      win.document.write(html); win.document.close();
  };

  const getStatusBadge = (status) => {
      switch(status) {
          case 'IMPORTADA': case 'CONCLUIDA': return <span className="badge-status importada"><CheckCircle size={14}/> REGISTRADA</span>;
          case 'PENDENTE_MANIFESTACAO': return <span className="badge-status resumo"><DownloadCloud size={14}/> BAIXAR XML</span>;
          case 'PENDENTE': default: return <span className="badge-status pendente"><Package size={14}/> PRONTA</span>;
      }
  };

  // 🔥 OBTENÇÃO PRECISA DA HORA DO CADASTRO (Prioriza a Data Real do Sistema sobre o "00:00:00" do movimento)
  const getDataCadastroReal = () => {
        // 1º Prioridade: A data exata em que a mercadoria entrou no estoque (tem hora, minuto e segundo)
        if (detalhesRegistro && detalhesRegistro.length > 0) {
            const item = detalhesRegistro[0];
            // Procura pelas propriedades mais comuns que o Backend pode enviar
            const dataMovimentoReal = item.dataMovimento || item.dataHora || item.dataCriacao || item.dataMovimentacao;
            if (dataMovimentoReal) {
                return formatarDataHoraCompleta(dataMovimentoReal);
            }
        }

        // 2º Prioridade: Fallback para a data de cadastro da Nota no banco
        if (notaSelecionada && notaSelecionada.dataCadastro) {
            return formatarDataHoraCompleta(notaSelecionada.dataCadastro);
        }

        return "---";
    };

  const totalQuantidadeModal = itensImportacao.reduce((acc, curr) => acc + parseNumber(curr.quantidade || curr.qCom || 0), 0);
  const totalItensModal = itensImportacao.length;
  const totalGeralModal = itensImportacao.reduce((acc, curr) => acc + (parseNumber(curr.quantidade || curr.qCom || 0) * parseNumber(curr.precoCusto || 0)), 0);

  const detalhesQtdItens = detalhesRegistro.reduce((acc, i) => acc + parseNumber(i.quantidade || i.quantidadeMovimentada), 0);
  const detalhesValorTotal = detalhesRegistro.reduce((acc, i) => acc + (parseNumber(i.quantidade || i.quantidadeMovimentada) * parseNumber(i.custoUnitario || i.custoMovimentado)), 0);
  const dataCadastroNota = getDataCadastroReal();

  return (
    <div className="gestao-notas-container">
      <div className="gns-header">
        <div className="gns-header-left">
            <div className="gns-icon-box"><Inbox size={36} color="#60a5fa" /></div>
            <div><h1>Caixa de Entrada Fiscal</h1><p>Gestão unificada de faturamentos da SEFAZ.</p></div>
        </div>
        <div className="gns-header-actions">
            <button onClick={sincronizarSefaz} disabled={syncing} className={`btn-sync ${!syncing ? 'active' : ''}`}>
                <RefreshCw size={18} className={syncing ? "animate-spin" : ""} /> {syncing ? "Consultando SEFAZ..." : "Puxar Novas Notas"}
            </button>
        </div>
      </div>

      <div className="gns-filters-grid">
          <div className="filter-card">
            <h3><Search size={18} color="#3b82f6"/> Filtro Inteligente</h3>
            <div className="form-busca">
                <div className="input-wrapper">
                    <Search size={18} className="icon-busca" />
                    <input type="text" placeholder="Chave ou Fornecedor..." value={busca} onChange={(e) => setBusca(e.target.value)} className="search-input" />
                </div>
            </div>
          </div>
          <div className="filter-card">
            <div className="filter-header">
                <h3><Filter size={18} color="#f59e0b"/> Filtros da Base</h3>
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
                    <span className="switch-text">Exibir Notas Já Registradas</span>
                </label>
            </div>
          </div>
      </div>

      {loading ? (
          <div className="state-container loading"><RefreshCw size={40} className="animate-spin" /><h2>Lendo Base de Dados...</h2></div>
      ) : notasExibidas.length === 0 ? (
          <div className="state-container empty fade-in"><FileText size={48} color="#cbd5e1" /><h2>Nenhuma nota encontrada na tela.</h2></div>
      ) : (
        <div className="notas-list">
          {notasExibidas.map((nota) => {
            const isImportada = nota.status === 'IMPORTADA' || nota.status === 'CONCLUIDA';
            const isResumo = nota.status === 'PENDENTE_MANIFESTACAO';
            const isLoadingThis = loadingCardId === nota.id;

            return (
              <div key={nota.id} className={`nota-card-ui ${isImportada ? 'importada' : isResumo ? 'resumo' : 'pendente'}`}>
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
                        <div className="ncu-item"><span className="ncu-label">Chave</span><span className="ncu-chave">{nota.chaveAcesso}</span></div>
                    </div>
                    <div className="ncu-financeiro">
                        <div className="ncu-item"><span className="ncu-label">Emissão</span><span className="ncu-value"><Calendar size={14}/> {formatarDataBR(nota.dataEmissao)}</span></div>
                        <div className="ncu-item"><span className="ncu-label">Valor Total</span><strong className="ncu-valor-destaque">R$ {formatMoney(nota.valorTotal)}</strong></div>
                    </div>
                    <div className="ncu-acao">
                        {isImportada ? (
                          <button onClick={() => visualizarRegistroFinalizado(nota)} disabled={isLoadingThis} className="btn-acao importada-view">
                              {isLoadingThis ? <RefreshCw size={18} className="animate-spin" /> : <Eye size={18} />} Ver Registro <ChevronRight size={18} />
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

      {/* ============================================================================
          MODAL PRINCIPAL: IMPORTAÇÃO E AUDITORIA DE MERCADORIAS
      ============================================================================ */}
      {modalType === 'IMPORT' && (
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
                          <button onClick={gerarEspelhoConferencia} className="btn-baixar-danfe"><DownloadCloud size={18} /> Imprimir Espelho</button>
                          <button onClick={() => setModalType(null)} className="btn-close-modal"><X size={24}/></button>
                      </div>
                  </div>

                  <div className="mi-info-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                      <div className="mi-info-item"><span className="mi-label"><Building size={12}/> Razão Social</span><strong className="mi-value">{notaSelecionada?.nomeFornecedor || "Fornecedor da Nota Manual"}</strong></div>
                      <div className="mi-info-item"><span className="mi-label">CNPJ Identificado</span><strong className="mi-value monospace">{maskCNPJ(notaSelecionada?.cnpjFornecedor)}</strong></div>
                      <div className="mi-info-item"><span className="mi-label"><Calendar size={12}/> Emissão</span><strong className="mi-value">{formatarDataBR(cabecalhoModal.dataEmissao)}</strong></div>
                      <div className="mi-info-item"><span className="mi-label"><Package size={12}/> Volumes da Nota</span><strong className="mi-value">{totalItensModal} Ref ({totalQuantidadeModal} UN)</strong></div>
                      <div className="mi-info-item highlight"><span className="mi-label">Valor Total NF-e</span><strong className="mi-value valor-total">R$ {formatMoney(notaSelecionada?.valorTotal || totalGeralModal)}</strong></div>
                  </div>

                  <div className="modal-body-premium custom-scrollbar">
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px 20px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <CheckCircle size={28} color="#16a34a" />
                          <div><strong style={{ color: '#166534', display: 'block', fontSize: '1rem', marginBottom: '4px' }}>Fornecedor será vinculado automaticamente!</strong><span style={{ color: '#15803d', fontSize: '0.9rem' }}>O sistema detectou o CNPJ <b>{maskCNPJ(notaSelecionada?.cnpjFornecedor)}</b>. Ao confirmar a entrada, o fornecedor será criado ou vinculado nos bastidores de forma invisível.</span></div>
                      </div>

                      <div className="stepper-header">Auditoria e Vínculo de Mercadorias</div>
                      <div className="modal-table-area">
                          <table className="modern-table">
                              <thead><tr><th width="15%">Auditoria IA</th><th width="40%">Mercadoria no XML</th><th width="25%">Custo Unitário / Volume</th><th width="20%">Ação Requerida</th></tr></thead>
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
                                              <td className="td-valores">

                                                  {/* 🔥 NOVO CÓDIGO DA QUANTIDADE: Permite edição para desmembrar pacotes */}
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                      {editingQtyIndex === idx ? (
                                                          <input
                                                              type="number" step="0.01" autoFocus defaultValue={qtdNum}
                                                              onBlur={(e) => { handleAlterarQuantidade(idx, e.target.value); setEditingQtyIndex(null); }}
                                                              onKeyDown={(e) => { if (e.key === 'Enter') { handleAlterarQuantidade(idx, e.target.value); setEditingQtyIndex(null); } }}
                                                              className="input-elegante focus-blue" style={{ width: '70px', padding: '4px' }}
                                                          />
                                                      ) : (
                                                          <span className="qtd-badge" onDoubleClick={() => setEditingQtyIndex(idx)} title="Duplo clique para converter/desmembrar pacote (Ex: Mudar de 1 para 12)" style={{ cursor: 'pointer', border: '1px dashed #94a3b8' }}>
                                                              {qtdNum} UN
                                                          </span>
                                                      )}
                                                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>(Duplo clique p/ desmembrar)</span>
                                                  </div>

                                                  <div onDoubleClick={() => setEditingPriceIndex(idx)}>
                                                      {editingPriceIndex === idx ? (
                                                          <input type="number" step="0.01" autoFocus defaultValue={custoNum} onBlur={(e) => { atualizarCampoItem(idx, 'precoCusto', e.target.value); setEditingPriceIndex(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { atualizarCampoItem(idx, 'precoCusto', e.target.value); setEditingPriceIndex(null); } }} className="input-elegante focus-blue" />
                                                      ) : (
                                                          <span className="unit-cost" title="Duplo clique para editar o custo da nota" style={{ cursor: 'pointer' }}>Custo NF: R$ {formatMoney(custoNum)} / un</span>
                                                      )}
                                                  </div>

                                                  {item.status === 'vinculado' && (<span className="custo-medio-label" title="Custo histórico baseado no BD.">Custo Médio DB: R$ {formatMoney(item.custoMedioAtual)}</span>)}
                                                  <strong className="total-cost text-primary" style={{marginTop: '4px'}}>Subtotal: R$ {formatMoney(subtotalLinha)}</strong>

                                                  {item.status === 'vinculado' && (
                                                      <div className="inline-edit-container">
                                                          <div className="inline-form-group"><label className="inline-label">Margem (%)</label><input type="text" value={formatMoney(item.margem)} onChange={(e) => handleInlineEditValores(idx, 'margem', parseMoneyInput(e.target.value))} className="inline-input margem" /></div>
                                                          <div className="inline-form-group"><label className="inline-label">Venda (R$)</label><input type="text" value={formatMoney(item.precoVenda)} onChange={(e) => handleInlineEditValores(idx, 'precoVenda', parseMoneyInput(e.target.value))} className="inline-input venda" /></div>
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
                                                  {item.status === 'vinculado' && (<div className="txt-sucesso-ia"><CheckCircle size={16}/> <span>Pronto. +{qtdNum} UN no estoque.</span></div>)}
                                                  {item.status === 'novo' && (
                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                          <button onClick={() => abrirEdicaoRapida(idx, item)} className="btn-completar-cadastro"><Edit3 size={14}/> {item.preenchidoViaIA ? "Revisar Atributos" : "Novo Cadastro"}</button>
                                                          <button onClick={() => abrirVinculoManual(idx)} className="btn-vincular-manual" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                              <Search size={14}/> Buscar e Vincular
                                                          </button>
                                                      </div>
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

      {/* ============================================================================
          MODAL DE LEITURA (VIEW) - AGORA COM A HORA EXATA CORRIGIDA
      ============================================================================ */}
      {modalType === 'VIEW' && (
          <div className="modal-overlay fade-in">
              <div className="import-modal scale-in" style={{maxWidth: '1200px', height: '90vh'}}>

                  <div className="mi-header-top">
                      <div className="mi-title-box">
                          <div className="mi-icon" style={{background: '#dcfce7', color: '#10b981'}}>
                              <CheckCircle size={32}/>
                          </div>
                          <div>
                              <h2 style={{color: '#064e3b'}}>
                                  Registro Finalizado: NF-e {notaSelecionada?.numeroNota || extrairNumeroNota(notaSelecionada?.chaveAcesso)}
                              </h2>
                              <span className="mi-chave"><Hash size={14}/> Chave: {notaSelecionada?.chaveAcesso}</span>
                          </div>
                      </div>
                      <button onClick={() => setModalType(null)} className="btn-close-modal"><X size={24}/></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '15px', padding: '15px 30px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                      <div className="mi-info-item" style={{ borderRight: 'none', padding: 0 }}>
                          <span className="mi-label"><Building size={12}/> Razão Social</span>
                          <strong className="mi-value" style={{fontSize: '1.2rem'}}>{notaSelecionada?.nomeFornecedor || "N/A"}</strong>
                      </div>
                      <div className="mi-info-item" style={{ borderRight: 'none', padding: 0 }}>
                          <span className="mi-label">CNPJ Identificado</span>
                          <strong className="mi-value monospace">{maskCNPJ(notaSelecionada?.cnpjFornecedor)}</strong>
                      </div>
                  </div>

                  <div className="mi-info-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', padding: '15px 30px', gap: '15px', background: '#f8fafc' }}>
                      <div className="mi-info-item" style={{background:'#fff', borderRadius:'8px', padding:'15px', border:'1px solid #e2e8f0'}}>
                          <span className="mi-label"><Calendar size={12}/> Emissão NF</span>
                          <strong className="mi-value">{formatarDataBR(notaSelecionada?.dataEmissao)}</strong>
                      </div>
                      <div className="mi-info-item" style={{background:'#fff', borderRadius:'8px', padding:'15px', border:'1px solid #e2e8f0'}}>
                          <span className="mi-label"><Clock size={12}/> Cadastrado em</span>
                          <strong className="mi-value" style={{color: '#3b82f6'}}>{dataCadastroNota}</strong>
                      </div>
                      <div className="mi-info-item" style={{background:'#fff', borderRadius:'8px', padding:'15px', border:'1px solid #e2e8f0'}}>
                          <span className="mi-label"><User size={12}/> Responsável</span>
                          <strong className="mi-value">{notaSelecionada?.usuarioCadastro || "Administrador"}</strong>
                      </div>
                      <div className="mi-info-item" style={{background:'#fff', borderRadius:'8px', padding:'15px', border:'1px solid #e2e8f0'}}>
                          <span className="mi-label"><Package size={12}/> Volumes Lançados</span>
                          <strong className="mi-value">{detalhesRegistro.length} Ref. / {detalhesQtdItens} UN</strong>
                      </div>
                      <div className="mi-info-item highlight" style={{background:'#ecfdf5', borderRadius:'8px', padding:'15px', border:'1px solid #a7f3d0'}}>
                          <span className="mi-label" style={{color:'#065f46'}}>Custo Total Lançado</span>
                          <strong className="mi-value valor-total" style={{color:'#059669'}}>R$ {formatMoney(detalhesValorTotal || notaSelecionada?.valorTotal)}</strong>
                      </div>
                  </div>

                  <div className="modal-body-premium custom-scrollbar" style={{background: '#fff', borderTop:'1px solid #e2e8f0'}}>
                      <table className="modern-table" style={{border: '1px solid #e2e8f0'}}>
                          <thead style={{background: '#f1f5f9'}}>
                              <tr>
                                  <th width="50%">Produto Registrado no Sistema</th>
                                  <th width="15%">Qtd Entrou</th>
                                  <th width="15%">Custo Lançado</th>
                                  <th width="20%">Subtotal Calculado</th>
                              </tr>
                          </thead>
                          <tbody>
                              {detalhesRegistro.map((item, idx) => {
                                  const partes = (item.infoParaFront || item.produtoDescricao || "").split('|');
                                  const nome = partes[0] || "Produto Desconhecido";
                                  const eanVal = partes.length >= 5 ? partes[4] : (item.codigoBarras || "S/ GTIN");
                                  const q = parseNumber(item.quantidade || item.quantidadeMovimentada);
                                  const c = parseNumber(item.custoUnitario || item.custoMovimentado);

                                  return (
                                      <tr key={idx}>
                                          <td>
                                              <strong style={{color: '#0f172a', fontSize: '0.95rem'}}>{nome}</strong>
                                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#64748b', marginTop: '6px', fontFamily: 'monospace', background:'#f1f5f9', padding:'2px 6px', borderRadius:'4px', width:'fit-content' }}>
                                                  <Barcode size={12}/> {eanVal}
                                              </span>
                                          </td>
                                          <td><span className="qtd-badge">{q} UN</span></td>
                                          <td style={{color: '#475569', fontWeight: '600'}}>R$ {formatMoney(c)}</td>
                                          <td style={{fontWeight: '900', color: '#10b981', fontSize: '1.05rem'}}>R$ {formatMoney(q * c)}</td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* ============================================================================
          MODAL VÍNCULO MANUAL
      ============================================================================ */}
      {modalType === 'LINK_MANUAL' && linkManualIndex !== null && (
          <div className="modal-overlay" style={{zIndex: 10000}}>
              <div className="modal-card scale-in" style={{ maxWidth: '600px', width: '95%', background: '#fff', borderRadius: '12px', padding: '20px' }}>
                  <div className="modal-header-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}><LinkIcon size={20} color="#3b82f6"/> Vincular Produto Manualmente</h3>
                      <button onClick={() => setModalType('IMPORT')} className="btn-close-modal"><X size={20}/></button>
                  </div>
                  <div style={{ marginBottom: '15px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <strong style={{ display: 'block', color: '#475569', fontSize: '0.85rem' }}>Produto lido na Nota Fiscal:</strong>
                      <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{itensImportacao[linkManualIndex]?.descricao}</span>
                  </div>
                  <div className="input-wrapper" style={{ marginBottom: '20px' }}>
                      <Search size={18} className="icon-busca" />
                      <input autoFocus type="text" placeholder="Digite o nome correto ou EAN do seu estoque..." value={buscaManual} onChange={(e) => setBuscaManual(e.target.value)} className="search-input" style={{ width: '100%', padding: '10px 10px 10px 40px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                  </div>
                  <div className="resultados-busca-manual custom-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      {buscaManual.length < 2 ? (
                          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Digite pelo menos 2 letras para buscar.</div>
                      ) : produtosFiltradosManual.length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#ef4444', padding: '20px' }}>Nenhum produto correspondente no seu estoque.</div>
                      ) : (
                          produtosFiltradosManual.map(p => (
                              <div key={p.id} onClick={() => confirmarVinculoManual(p)} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                  <div>
                                      <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.9rem' }}>{p.descricao}</strong>
                                      <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}><Barcode size={12}/> {p.codigoBarras || 'S/N'}</span>
                                  </div>
                                  <button style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>Vincular Este</button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ============================================================================
          MODAL QUICK EDIT (QUICK)
      ============================================================================ */}
      {modalType === 'QUICK' && quickEditIndex !== null && (
          <div className="qe-overlay">
              <div className="qe-card scale-in">
                  <div className="qe-header">
                      <h3><Sparkles size={18} className="text-primary"/> Configurar Atributos do Novo Produto</h3>
                      <button onClick={() => setModalType('IMPORT')} className="btn-close-modal"><X size={20}/></button>
                  </div>
                  <div className="qe-body">
                      <div className="qe-form-group"><label>Descrição Oficial</label><input type="text" value={quickEditForm.descricao} onChange={e => setQuickEditForm({...quickEditForm, descricao: e.target.value.toUpperCase()})} className="qe-input" /></div>

                      <div className="qe-grid-2">
                          <div className="qe-form-group"><label>EAN / Código de Barras</label><div className="qe-ean-row"><input type="text" value={quickEditForm.codigoBarras} onChange={e => setQuickEditForm({...quickEditForm, codigoBarras: e.target.value})} className="qe-input" style={{flex: 1}} /><button onClick={async () => { try { const base = await produtoService.gerarEanInterno(); setQuickEditForm({...quickEditForm, codigoBarras: String(base)}); } catch(e){} }} className="btn-qe-magic" title="Gerar Novo Sequencial"><Wand2 size={18}/></button></div></div>
                          <div className="qe-form-group"><label>Marca <span style={{fontSize: '0.65rem', textTransform: 'none'}}>(Selecione na lista ou digite a nova)</span></label><input list="lista-marcas-qe" value={quickEditForm.marca} onChange={e => setQuickEditForm({...quickEditForm, marca: e.target.value.toUpperCase()})} onDoubleClick={() => setQuickEditForm({...quickEditForm, marca: ''})} className="qe-input" placeholder="Selecione ou digite..." /><datalist id="lista-marcas-qe">{dicionarios.marcas.map((m, i) => <option key={`m-${i}`} value={m} />)}</datalist></div>
                      </div>

                      <div className="qe-grid-2">
                          <div className="qe-form-group"><label>Categoria <span style={{fontSize: '0.65rem', textTransform: 'none'}}>(Selecione na lista ou digite a nova)</span></label><input list="lista-cat-qe" value={quickEditForm.categoria} onChange={e => setQuickEditForm({...quickEditForm, categoria: e.target.value.toUpperCase()})} onDoubleClick={() => setQuickEditForm({...quickEditForm, categoria: ''})} className="qe-input" placeholder="Selecione ou digite..." /><datalist id="lista-cat-qe">{dicionarios.categorias.map((c, i) => <option key={`c-${i}`} value={c} />)}</datalist></div>
                          <div className="qe-form-group"><label>Subcategoria <span style={{fontSize: '0.65rem', textTransform: 'none'}}>(Selecione na lista ou digite a nova)</span></label><input list="lista-subcat-qe" value={quickEditForm.subcategoria} onChange={e => setQuickEditForm({...quickEditForm, subcategoria: e.target.value.toUpperCase()})} onDoubleClick={() => setQuickEditForm({...quickEditForm, subcategoria: ''})} className="qe-input" placeholder="Selecione ou digite..." /><datalist id="lista-subcat-qe">{dicionarios.subcategorias.map((s, i) => <option key={`s-${i}`} value={s} />)}</datalist></div>
                      </div>

                      <div className="qe-grid-3">
                          <div className="qe-form-group"><label>Custo Base (R$)</label><input type="text" value={formatMoney(quickEditForm.precoCusto)} onChange={e => handlePrecificacaoQuickEdit('precoCusto', parseMoneyInput(e.target.value))} className="qe-input" style={{fontFamily:'monospace'}} /></div>
                          <div className="qe-form-group"><label>Margem Lícita (%)</label><input type="text" value={formatMoney(quickEditForm.margem)} onChange={e => handlePrecificacaoQuickEdit('margem', parseMoneyInput(e.target.value))} className="qe-input" style={{color:'#047857', borderColor:'#6ee7b7', fontFamily:'monospace'}} /></div>
                          <div className="qe-form-group"><label>Preço Venda (R$)</label><input type="text" value={formatMoney(quickEditForm.precoVenda)} onChange={e => handlePrecificacaoQuickEdit('precoVenda', parseMoneyInput(e.target.value))} className="qe-input" style={{color:'#1e40af', background:'#eff6ff', borderColor:'#bfdbfe', fontFamily:'monospace'}} /></div>
                      </div>
                  </div>
                  <div className="qe-footer"><button onClick={() => setModalType('IMPORT')} className="btn-qe-cancel">Cancelar</button><button onClick={salvarEdicaoRapida} className="btn-qe-save"><CheckCircle size={18}/> Salvar Atributos</button></div>
              </div>
          </div>
      )}

    </div>
  );
}