import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import { maskCNPJ, maskPhone, maskCEP } from '../../utils/masks';
import {
  Save, Plus, Search, Trash2, ArrowLeft, Package,
  AlertTriangle, Link as LinkIcon, Loader, UploadCloud, X,
  ShoppingCart, FileText, Calendar, CheckCircle, Barcode, Edit3, Wand2, Link2
} from 'lucide-react';

import FornecedorForm from '../Fornecedores/FornecedorForm';
import ProdutoForm from '../Produtos/ProdutoForm';
import './EntradaEstoque.css';

// 🧠 MOTOR DE INTELIGÊNCIA ARTIFICIAL E MÁSCARAS
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
            palavraDb === palavraXml ||
            (palavraXml.length >= 4 && palavraDb.includes(palavraXml)) ||
            (palavraDb.length >= 4 && palavraXml.includes(palavraDb))
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

const EntradaEstoque = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [listaFornecedores, setListaFornecedores] = useState([]);
  const [listaProdutosDb, setListaProdutosDb] = useState([]);

  const [itens, setItens] = useState([]);
  const [cabecalho, setCabecalho] = useState({
    fornecedorId: '', numeroDocumento: '', dataEmissao: new Date().toISOString().split('T')[0], notaPendenteId: null
  });

  const [searchState, setSearchState] = useState({ rowIndex: null, term: '', results: [] });
  const [linhasEmModoBusca, setLinhasEmModoBusca] = useState({});
  const [showModalFornecedor, setShowModalFornecedor] = useState(false);
  const [showModalProduto, setShowModalProduto] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [qtdItem, setQtdItem] = useState(1);
  const [custoItem, setCustoItem] = useState('');

  const fileInputRef = useRef(null);
  const qtdInputRef = useRef(null);

  useEffect(() => { carregarDadosIniciais(); }, []);

  const carregarDadosIniciais = async () => {
    try {
      const resForn = await api.get('/fornecedores/dropdown').catch(() => api.get('/fornecedores?size=100'));
      setListaFornecedores(Array.isArray(resForn.data) ? resForn.data : (resForn.data.content || []));
      const resProd = await api.get('/produtos?size=5000');
      setListaProdutosDb(resProd.data.content || []);
    } catch (e) { toast.error("Erro ao carregar dados.", { toastId: 'erro-carga' }); }
  };

  useEffect(() => {
      // O gatilho principal: Quando vier da caixa de entrada
      if (location.state?.notaPendenteId && listaProdutosDb.length > 0) {
          carregarNotaDaCaixaDeEntrada(location.state.notaPendenteId);
          navigate(location.pathname, { replace: true, state: {} }); // Limpa state para não recarregar no F5
      }
  }, [location.state, listaProdutosDb]);

  // 🔥 O CAÇA-FANTASMAS DEFINITIVO (Anti-Duplicação) 🔥
  const resolverFornecedor = async (cnpjDescoberto, razaoXml) => {
        if (!cnpjDescoberto) return null;
        const cnpjLimpo = cnpjDescoberto.replace(/\D/g, '');
        if (cnpjLimpo.length !== 14) return null;

        let idParaAtualizar = null;

        // 1. Busca exaustiva: O backend devolve um Fornecedor se ele tiver o CNPJ (limpo ou formatado)
        try {
            const check = await api.get(`/fornecedores/buscar-por-cnpj/${cnpjLimpo}`);
            if (check.data && check.data.id) {
                 idParaAtualizar = check.data.id; // Encontrou! Vamos apenas limpar a sujeira e atualizar.

                 // Se o nome já estiver perfeito (não for o esqueleto "FORNECEDOR NOVO"), usa logo.
                 if(check.data.razaoSocial && !check.data.razaoSocial.toUpperCase().includes('FORNECEDOR NOVO') && !check.data.razaoSocial.toUpperCase().includes('FORNECEDOR ' + cnpjLimpo)) {
                     return check.data;
                 }
            }
        } catch (e) { /* Segue o fluxo para criar novo se não achou */ }

        // 2. Monta o pacote bonito com os dados da Receita Federal
        toast.info(`Formatando dados de ${maskCNPJ(cnpjLimpo)} pela Receita Federal...`);
        let payload = { cnpj: maskCNPJ(cnpjLimpo), razaoSocial: razaoXml || `FORNECEDOR ${maskCNPJ(cnpjLimpo)}`, nomeFantasia: razaoXml || `FORNECEDOR ${maskCNPJ(cnpjLimpo)}`, ativo: true };

        try {
            const resPrincipal = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
            if (resPrincipal.ok) {
                const data = await resPrincipal.json();
                const est = data.estabelecimento;
                let ieEncontrada = 'ISENTO';
                if (est.inscricoes_estaduais?.length > 0) {
                    const ieAtiva = est.inscricoes_estaduais.find(i => i.ativa);
                    ieEncontrada = ieAtiva ? ieAtiva.inscricao_estadual : est.inscricoes_estaduais[0].inscricao_estadual;
                }
                payload = { ...payload, razaoSocial: data.razao_social?.toUpperCase() || payload.razaoSocial, nomeFantasia: (est.nome_fantasia || data.razao_social)?.toUpperCase() || payload.nomeFantasia, inscricaoEstadual: ieEncontrada, email: est.email?.toLowerCase() || '', telefone: (est.ddd1 && est.telefone1) ? maskPhone(`${est.ddd1}${est.telefone1}`) : '', cep: maskCEP(est.cep || ''), logradouro: est.logradouro?.toUpperCase() || '', numero: est.numero || 'SN', bairro: est.bairro?.toUpperCase() || '', cidade: est.cidade?.nome?.toUpperCase() || '', uf: est.estado?.sigla?.toUpperCase() || '' };
            } else { throw new Error("Fallback para BrasilAPI"); }
        } catch (e) {
             try {
                const resFallback = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
                if (resFallback.ok) {
                    const dados = await resFallback.json();
                    payload = { ...payload, razaoSocial: dados.razao_social?.toUpperCase() || payload.razaoSocial, nomeFantasia: (dados.nome_fantasia || dados.razao_social)?.toUpperCase() || payload.nomeFantasia, cep: maskCEP(dados.cep || ''), logradouro: dados.logradouro?.toUpperCase() || '', numero: dados.numero || 'SN', bairro: dados.bairro?.toUpperCase() || '', cidade: dados.municipio?.toUpperCase() || '', uf: dados.uf?.toUpperCase() || '' };
                }
            } catch (e2) { console.log("APIs indisponíveis"); }
        }

        // 3. Salva no backend: Se tinha um ID feio (esqueleto), faz PUT (atualiza). Se não, faz POST (cria um único e perfeito).
        try {
            let result;
            if(idParaAtualizar) {
                 result = (await api.put(`/fornecedores/${idParaAtualizar}`, payload)).data;
            } else {
                 result = (await api.post('/fornecedores', payload)).data;
            }

            setListaFornecedores(prev => {
                const f = prev.filter(p => p.id !== result.id);
                return [...f, {id: result.id, razaoSocial: result.razaoSocial, nomeFantasia: result.nomeFantasia}];
            });
            return result;
        } catch(e) { return null; }
  };


  const carregarNotaDaCaixaDeEntrada = async (id) => {
      setLoading(true);
      const toastIdMsg = toast.loading("A carregar nota e processar produtos...");

      try {
          const res = await api.get(`/estoque/notas-pendentes/${id}/xml-parse`);
          let { fornecedorId, razaoSocialFornecedor, cnpjFornecedor, numeroNota, itensXml, dataEmissao } = res.data;

          // Validação Suprema do Fornecedor antes de abrir a tela
          if (cnpjFornecedor) {
               const novoForn = await resolverFornecedor(cnpjFornecedor, razaoSocialFornecedor);
               if(novoForn) {
                   fornecedorId = novoForn.id;
                   razaoSocialFornecedor = novoForn.razaoSocial;
               }
          }

          setCabecalho(prev => ({
            ...prev,
            fornecedorId: fornecedorId || prev.fornecedorId,
            numeroDocumento: numeroNota || prev.numeroDocumento,
            dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : prev.dataEmissao,
            notaPendenteId: id
          }));

          processarMatchDeItens(itensXml, razaoSocialFornecedor);
          toast.update(toastIdMsg, { render: "Nota carregada e produtos listados!", type: "success", isLoading: false, autoClose: 3000 });

      } catch (error) {
          toast.update(toastIdMsg, { render: "Erro ao processar a nota da SEFAZ.", type: "error", isLoading: false, autoClose: 4000 });
      } finally { setLoading(false); }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const toastIdMsg = toast.loading("A ler e extrair dados do XML físico...");

    try {
       // O FRONTEND LÊ O XML FÍSICO PRIMEIRO
       const xmlText = await file.text();
       const emitMatch = xmlText.match(/<emit[^>]*>([\s\S]*?)<\/emit>/i) || xmlText.match(/<nfe:emit[^>]*>([\s\S]*?)<\/nfe:emit>/i);
       let fornecedorIdResolvido = null;
       let razaoResolvida = null;

       if (emitMatch) {
           const emitContent = emitMatch[1];
           const cnpjMatch = emitContent.match(/<CNPJ>([^<]+)<\/CNPJ>/i) || emitContent.match(/<CPF>([^<]+)<\/CPF>/i);
           const razaoMatch = emitContent.match(/<xNome>([^<]+)<\/xNome>/i);
           if (cnpjMatch) {
               const fornTratado = await resolverFornecedor(cnpjMatch[1], razaoMatch ? razaoMatch[1] : '');
               if(fornTratado) {
                   fornecedorIdResolvido = fornTratado.id;
                   razaoResolvida = fornTratado.razaoSocial;
               }
           }
       }

       const formData = new FormData();
       formData.append("arquivo", file);
       const res = await api.post('/estoque/importar-xml', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

       let { numeroNota, itensXml, dataEmissao } = res.data;

       setCabecalho(prev => ({
         ...prev,
         fornecedorId: fornecedorIdResolvido || res.data.fornecedorId || prev.fornecedorId,
         numeroDocumento: numeroNota || prev.numeroDocumento,
         dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : prev.dataEmissao
       }));

       processarMatchDeItens(itensXml, razaoResolvida || res.data.razaoSocialFornecedor);
       toast.update(toastIdMsg, { render: "XML Importado e Validado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });

    } catch (error) {
       const msg = error.response?.data?.message || "Erro ao processar o arquivo XML.";
       toast.update(toastIdMsg, { render: msg, type: "error", isLoading: false, autoClose: 4000 });
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  const processarMatchDeItens = (itensDoXml, razaoSocialFornecedor) => {
      const novosItens = itensDoXml.map(xmlItem => {
          const dadosFiscais = inferirDadosFiscais(xmlItem, razaoSocialFornecedor);
          const matchEan = listaProdutosDb.find(db => db.codigoBarras && xmlItem.codigoBarras && db.codigoBarras.length > 7 && String(db.codigoBarras) === String(xmlItem.codigoBarras));

          if (matchEan) return { ...xmlItem, idProduto: matchEan.id, descricao: matchEan.descricao, status: 'vinculado', match: matchEan, estoqueAtual: matchEan.quantidadeEmEstoque || 0, ...dadosFiscais, nivelConfianca: '100% (EAN)' };

          let melhorMatchSimilar = null;
          let maiorScore = 0;

          listaProdutosDb.forEach(dbProduto => {
              let score = calcularSimilaridade(xmlItem.descricao, dbProduto.descricao);
              if (score > 0.4 && dbProduto.ncm && xmlItem.ncm && dbProduto.ncm === xmlItem.ncm) score += 0.2;
              if (score > maiorScore) { maiorScore = score; melhorMatchSimilar = dbProduto; }
          });

          if (maiorScore >= 0.65 && melhorMatchSimilar) return { ...xmlItem, idProduto: null, status: 'semelhante', match: melhorMatchSimilar, estoqueAtual: 0, ...dadosFiscais, nivelConfianca: `${Math.round(maiorScore * 100)}% (Texto)` };
          return { ...xmlItem, idProduto: null, status: 'novo', match: null, estoqueAtual: 0, ...dadosFiscais, nivelConfianca: '0%' };
      });
      setItens(prev => [...prev, ...novosItens]);
  };

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (termoBusca.length >= 3 && !produtoSelecionado) {
        try { setSugestoes((await api.get(`/produtos?termo=${termoBusca}`)).data.content || []); } catch (err) { }
      } else { setSugestoes([]); }
    }, 400);
    return () => clearTimeout(delay);
  }, [termoBusca, produtoSelecionado]);

  const selecionarProduto = (prod) => {
    setProdutoSelecionado(prod); setTermoBusca(prod.descricao); setSugestoes([]);
    setCustoItem(prod.precoCusto ? prod.precoCusto.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '');
    setQtdItem(1); setTimeout(() => qtdInputRef.current?.focus(), 100);
  };

  const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  const adicionarItem = () => {
    if (!produtoSelecionado) return;
    const custo = parseCurrency(custoItem);
    setItens([...itens, { idProduto: produtoSelecionado.id, descricao: produtoSelecionado.descricao, codigoBarras: produtoSelecionado.codigoBarras, quantidade: Number(qtdItem), precoCusto: custo, total: Number(qtdItem) * custo, status: 'vinculado', estoqueAtual: produtoSelecionado.quantidadeEmEstoque || 0, origem: '0', cst: '102', ncm: produtoSelecionado.ncm || '00000000', marca: produtoSelecionado.marca || 'GENERICA', categoria: produtoSelecionado.categoria || 'GERAL' }]);
    setProdutoSelecionado(null); setTermoBusca(''); setQtdItem(1); setCustoItem('');
  };

  const atualizarCampoItem = (index, campo, valor) => {
      const lista = [...itens]; lista[index][campo] = campo === 'descricao' ? valor.toUpperCase() : valor; setItens(lista);
  };

  const handleGerarEanInterno = async (index) => {
    try { atualizarCampoItem(index, 'codigoBarras', await produtoService.gerarEanInterno()); toast.info("Código gerado!"); }
    catch (err) { toast.error("Erro ao gerar."); }
  };

  const ativarModoBusca = (index) => { setLinhasEmModoBusca(prev => ({ ...prev, [index]: true })); setSearchState({ rowIndex: index, term: '', results: [] }); };
  const cancelarModoBusca = (index) => { const n = { ...linhasEmModoBusca }; delete n[index]; setLinhasEmModoBusca(n); setSearchState({ rowIndex: null, term: '', results: [] }); };

  const handleSearchCorrecao = (index, valor) => {
      setSearchState(prev => ({ ...prev, rowIndex: index, term: valor }));
      if(!valor || valor.length < 2) return setSearchState(prev => ({ ...prev, results: [] }));
      const t = valor.toUpperCase();
      setSearchState(prev => ({ ...prev, results: listaProdutosDb.filter(db => db.descricao.toUpperCase().includes(t) || String(db.codigoBarras).includes(valor)).slice(0, 5) }));
  };

  const vincularSugestao = (index, db) => {
      const lista = [...itens];
      lista[index] = { ...lista[index], idProduto: db.id, descricao: db.descricao, codigoBarras: db.codigoBarras, ncm: db.ncm || lista[index].ncm, status: 'vinculado', estoqueAtual: db.quantidadeEmEstoque || 0 };
      setItens(lista); setSearchState({ rowIndex: null, term: '', results: [] }); const n = { ...linhasEmModoBusca }; delete n[index]; setLinhasEmModoBusca(n);
      toast.success("Vinculado!");
  };

  const removerItem = (idx) => setItens(itens.filter((_, i) => i !== idx));

  const finalizarEntrada = async (e) => {
    if(e) e.preventDefault();
    if (!cabecalho.fornecedorId) return toast.warn("Selecione o Fornecedor no topo.");
    if (itens.some(i => i.status === 'semelhante')) return toast.warn("Resolva os itens em 'ATENÇÃO'.");
    if (itens.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) return toast.warn("Produtos novos precisam de EAN válido.");

    setLoading(true);
    try {
        await api.post('/estoque/entrada', {
            fornecedorId: cabecalho.fornecedorId, numeroDocumento: cabecalho.numeroDocumento || "S/N", dataVencimento: cabecalho.dataEmissao,
            itens: itens.map(i => ({ produtoId: i.idProduto, codigoBarras: i.codigoBarras || "SEM GTIN", descricao: i.descricao, quantidade: i.quantidade, valorUnitario: i.precoCusto, ncm: i.ncm || "00000000", origem: i.origem || '0', cst: i.fiscal?.csosn || i.cst || '102', marca: i.marca || 'GENERICA', categoria: i.categoria || 'GERAL', unidade: 'UN' }))
        });
        if (cabecalho.notaPendenteId) await api.post(`/estoque/notas-pendentes/${cabecalho.notaPendenteId}/importar`);
        toast.success("Entrada registrada!"); navigate('/estoque');
    } catch(e) { toast.error(e.response?.data?.message || "Erro ao registrar."); }
    finally { setLoading(false); }
  };

  const totalGeral = itens.reduce((a, b) => a + (Number(b.total) || 0), 0);
  const getRowStyle = (s) => ({ transition: 'all 0.2s ease', borderLeft: s==='vinculado'?'4px solid #10b981':s==='semelhante'?'4px solid #f59e0b':'4px solid #3b82f6', backgroundColor: s==='vinculado'?'#f0fdf4':s==='semelhante'?'#fffbeb':'#eff6ff' });

  return (
    <div className="entrada-container">
      <div className="page-header" style={{flexWrap: 'wrap', gap: '15px'}}>
        <div className="page-title"><h1>Entrada Inteligente</h1><p>Auditoria XML da SEFAZ ou Lançamento Manual</p></div>
        <div style={{display:'flex', gap:12, flexWrap: 'wrap'}}>
            <button className="btn-std btn-secondary" onClick={() => navigate('/estoque/caixa-entrada')}><ArrowLeft size={18}/> Voltar à Fila Fiscal</button>
            <button className="btn-std btn-secondary" onClick={() => fileInputRef.current.click()}><UploadCloud size={18}/> Importar XML</button>
            <input type="file" style={{display:'none'}} ref={fileInputRef} onChange={handleFileChange} accept=".xml"/>
        </div>
      </div>

      <div className="bloco-entrada">
        <div className="titulo-sessao"><FileText size={16}/> Dados da Nota Fiscal</div>
        <div className="form-grid">
            <div className="col-12 col-md-6">
                <label>Fornecedor *</label>
                <div className="input-group">
                    <select value={cabecalho.fornecedorId} onChange={e => setCabecalho({...cabecalho, fornecedorId: e.target.value})} style={{ border: !cabecalho.fornecedorId ? '1px solid #f87171' : '1px solid #e2e8f0', flex: 1 }}>
                        <option value="">Selecione o Fornecedor...</option>
                        {listaFornecedores.map(f => (<option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>))}
                    </select>
                    <button className="btn-addon" onClick={() => setShowModalFornecedor(true)}><Plus size={18}/></button>
                </div>
            </div>
            <div className="col-6 col-md-3"><label>Nº Documento</label><input value={cabecalho.numeroDocumento} onChange={e => setCabecalho({...cabecalho, numeroDocumento: e.target.value})} placeholder="S/N" /></div>
            <div className="col-6 col-md-3"><label>Data Emissão</label><input type="date" value={cabecalho.dataEmissao} onChange={e => setCabecalho({...cabecalho, dataEmissao: e.target.value})} style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1'}} /></div>
        </div>
      </div>

      <div className="bloco-entrada" style={{borderLeft: '4px solid #6366f1'}}>
         <div className="titulo-sessao" style={{color:'#6366f1'}}><Package size={16}/> Adicionar Produto Avulso</div>
         <div className="form-grid">
             <div className="col-12 col-md-6" style={{position:'relative'}}>
                 <label>Buscar Produto</label>
                 <div className="input-group">
                     <div style={{position:'relative', width:'100%'}}>
                         <Search size={16} style={{position:'absolute', left:12, top:13, color:'#94a3b8'}}/>
                         <input placeholder="Digite nome, código ou barras..." style={{paddingLeft: 38, width: '100%'}} value={termoBusca} onChange={e => { setTermoBusca(e.target.value); setProdutoSelecionado(null); }} />
                     </div>
                     <button className="btn-addon" onClick={() => setShowModalProduto(true)}><Plus size={18}/></button>
                 </div>
                 {sugestoes.length > 0 && !produtoSelecionado && (
                     <div className="dropdown-busca">{sugestoes.map(s => (<div key={s.id} className="item-busca" onClick={() => selecionarProduto(s)}><span style={{flex:1}}>{s.descricao}</span><strong style={{color:'#16a34a'}}>R$ {s.precoVenda?.toFixed(2)}</strong></div>))}</div>
                 )}
             </div>
             <div className="col-4 col-md-2"><label>Qtd.</label><input type="number" ref={qtdInputRef} value={qtdItem} onChange={e => setQtdItem(e.target.value)} min="1"/></div>
             <div className="col-4 col-md-2"><label>Custo Unit.</label><input value={custoItem} onChange={e => setCustoItem(e.target.value)} placeholder="0,00"/></div>
             <div className="col-4 col-md-2"><button className="btn-std btn-success" style={{width:'100%', marginTop: '22px'}} onClick={adicionarItem} disabled={!produtoSelecionado}><Plus size={18}/> Add</button></div>
         </div>
      </div>

      <div className="bloco-entrada" style={{padding:0}}>
          <div style={{padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'#334155'}}><ShoppingCart size={18}/> Itens ({itens.length})</div>
          </div>
          <div className="table-responsive">
              <table className="tabela-padrao">
                  <thead><tr><th style={{paddingLeft: 24, minWidth: '100px'}}>Status</th><th style={{minWidth: '250px'}}>Produto / Edição</th><th style={{minWidth: '150px'}}>Valores</th><th style={{minWidth: '220px'}}>Ação Necessária</th><th width="50"></th></tr></thead>
                  <tbody>
                      {itens.map((item, idx) => {
                          const isSearching = linhasEmModoBusca[idx];
                          return (
                              <tr key={idx} style={getRowStyle(item.status)}>
                                  <td style={{paddingLeft: 24, verticalAlign: 'top', paddingTop: 16}}>
                                      {item.status === 'vinculado' && <span className="badge-status bg-green-100 text-green-800"><CheckCircle size={14}/> VINCULADO</span>}
                                      {item.status === 'semelhante' && <span className="badge-status bg-yellow-100 text-yellow-800"><AlertTriangle size={14}/> ATENÇÃO</span>}
                                      {item.status === 'novo' && <span className="badge-status bg-blue-100 text-blue-800"><Package size={14}/> NOVO</span>}
                                  </td>
                                  <td style={{verticalAlign: 'top', paddingTop: 16}}>
                                      {item.status === 'novo' && !isSearching ? (
                                          <div style={{display:'flex', flexDirection:'column', gap:8}}>
                                              <div><label className="label-mini">Descrição (XML)</label><div className="input-icon-wrapper"><Edit3 size={14} className="icon-left"/><input value={item.descricao} onChange={(e) => atualizarCampoItem(idx, 'descricao', e.target.value)} className="input-elegante" /></div></div>
                                              <div><label className="label-mini">EAN / Código</label><div className="input-group-elegante"><input value={item.codigoBarras} onChange={(e) => atualizarCampoItem(idx, 'codigoBarras', e.target.value)} className="input-elegante" placeholder="Digite ou gere..." /><button onClick={() => handleGerarEanInterno(idx)} className="btn-magic"><Wand2 size={16}/></button></div></div>
                                              <div className="label-mini text-gray-400">NCM: {item.ncm}</div>
                                          </div>
                                      ) : (
                                          <div><strong style={{color:'#1e293b', display:'block', marginBottom:4}}>{isSearching ? 'Buscando vínculo...' : item.descricao}</strong>{!isSearching && (<div style={{display:'flex', flexWrap:'wrap', gap:12, fontSize:'0.8rem', color:'#64748b'}}><span style={{display:'flex', alignItems:'center', gap:4}}><Barcode size={14}/> {item.codigoBarras}</span><span style={{display:'flex', alignItems:'center', gap:4}}><FileText size={14}/> NCM: {item.ncm}</span></div>)}</div>
                                      )}
                                  </td>
                                  <td style={{verticalAlign: 'top', paddingTop: 16}}>
                                      <div style={{color:'#475569', fontSize:'0.9rem'}}>{item.quantidade} x R$ {Number(item.precoCusto).toFixed(2)}</div>
                                      <div style={{color:'#4f46e5', fontWeight:800, fontSize:'1rem'}}>R$ {item.total.toFixed(2)}</div>
                                  </td>
                                  <td style={{verticalAlign: 'top', paddingTop: 16}}>
                                      {(item.status === 'semelhante' || isSearching) && (
                                          <div style={{display:'flex', flexDirection:'column', gap:8}}>
                                              {item.status === 'semelhante' && !isSearching && (
                                                  <div className="card-sugestao">
                                                      <div style={{fontSize:'0.7rem', color:'#854d0e', fontWeight:'bold', marginBottom:4, display: 'flex', justifyContent: 'space-between'}}><span>SUGESTÃO:</span><span>{item.nivelConfianca}</span></div>
                                                      <div style={{fontSize:'0.85rem', fontWeight:'600', color:'#451a03', marginBottom:6}}>{item.match.descricao}</div>
                                                      <button onClick={() => vincularSugestao(idx, item.match)} className="btn-aceitar-sugestao"><LinkIcon size={14}/> Confirmar</button>
                                                  </div>
                                              )}
                                              <div style={{position:'relative'}}>
                                                  <div className="input-icon-wrapper"><Search size={14} className="icon-left text-gray-400"/><input autoFocus={isSearching} placeholder="Vincular a outro..." className="input-elegante pl-8" value={searchState.rowIndex === idx ? searchState.term : ''} onChange={(e) => handleSearchCorrecao(idx, e.target.value)} />{isSearching && (<button onClick={() => cancelarModoBusca(idx)} className="absolute right-2 top-1.5 text-gray-400 hover:text-red-500"><X size={14}/></button>)}</div>
                                                  {searchState.rowIndex === idx && searchState.results.length > 0 && (<div className="dropdown-correcao">{searchState.results.map(res => (<div key={res.id} className="item-dropdown-correcao" onClick={() => vincularSugestao(idx, res)}><span className="desc">{res.descricao}</span></div>))}</div>)}
                                              </div>
                                          </div>
                                      )}
                                      {item.status === 'novo' && !isSearching && (
                                          <div style={{display:'flex', flexDirection:'column', gap:6}}><div style={{fontSize:'0.8rem', color:'#3b82f6', background:'#eff6ff', padding:8, borderRadius:6}}>Será cadastrado.</div><button onClick={() => ativarModoBusca(idx)} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer" style={{background:'none', border:'none'}}><Link2 size={12}/> Vincular existente</button></div>
                                      )}
                                      {item.status === 'vinculado' && (<div style={{fontSize:'0.8rem', color:'#166534', display:'flex', alignItems:'center', gap:4}}><CheckCircle size={14}/> Pronto. <span style={{fontSize: '0.7rem', color: '#64748b', marginLeft: '5px'}}>({item.nivelConfianca})</span></div>)}
                                  </td>
                                  <td align="center" style={{verticalAlign: 'top', paddingTop: 16}}><button className="btn-icon-danger" onClick={() => removerItem(idx)}><Trash2 size={18}/></button></td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
          <div className="footer-resumo" style={{margin:'20px', display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:'15px'}}>
               <div style={{background:'#f8fafc', padding:'10px 20px', borderRadius:'8px'}}><span style={{fontSize:'0.8rem', color:'#64748b', display:'block'}}>TOTAL DA NOTA</span><span style={{fontSize:'1.5rem', fontWeight:'bold', color:'#0f172a'}}>R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
               <button className="btn-std btn-primary" style={{height: 50, fontSize: '1rem', padding: '0 30px', width: '100%', maxWidth: '300px'}} onClick={finalizarEntrada} disabled={loading || itens.length === 0}>{loading ? <Loader className="animate-spin"/> : <Save size={20}/>}Confirmar Entrada</button>
          </div>
      </div>

      {showModalFornecedor && (
          <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '800px', width: '95%', padding: '0' }}>
                  <div className="modal-header" style={{ padding: '15px 20px 0 20px' }}><h3>Novo Fornecedor</h3><button onClick={() => setShowModalFornecedor(false)}><X size={20}/></button></div>
                  <div style={{ padding: '20px' }}><FornecedorForm isModal={true} onSuccess={(f) => { setListaFornecedores(p => [...p, f]); setCabecalho(p => ({...p, fornecedorId: f.id})); setShowModalFornecedor(false); }} /></div>
              </div>
          </div>
      )}
      {showModalProduto && (
         <div className="modal-overlay">
             <div className="modal-card" style={{ maxWidth: '900px', width: '95%', padding: '0', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div className="modal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #eee', padding: '15px 20px' }}><h3>Novo Produto Rápido</h3><button onClick={() => setShowModalProduto(false)}><X size={20}/></button></div>
                  <div style={{ padding: '10px' }}><ProdutoForm isModal={true} onSuccess={(prod) => { setListaProdutosDb(prev => [...prev, prod]); selecionarProduto(prod); setShowModalProduto(false); }} /></div>
             </div>
         </div>
      )}
      <style>{`
        .badge-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; }
        .label-mini { font-size: 0.7rem; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; display: block; }
        .input-elegante { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font-size: 0.85rem; color: #334155; font-weight: 600; transition: border 0.2s; }
        .input-elegante:focus { border-color: #6366f1; outline: none; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
        .input-icon-wrapper { position: relative; }
        .input-icon-wrapper .icon-left { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .input-icon-wrapper input { padding-left: 28px; }
        .input-group-elegante { display: flex; gap: 4px; }
        .btn-magic { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 6px; width: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .btn-magic:hover { background: #c7d2fe; }
        .card-sugestao { background: #fff; border: 1px solid #fde047; border-radius: 8px; padding: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .btn-aceitar-sugestao { width: 100%; background: #facc15; border: none; border-radius: 6px; padding: 6px; color: #713f12; font-weight: 700; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: background 0.2s; }
        .btn-aceitar-sugestao:hover { background: #eab308; }
        .dropdown-correcao { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); z-index: 50; max-height: 200px; overflow-y: auto; margin-top: 4px; }
        .item-dropdown-correcao { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; }
        .item-dropdown-correcao:hover { background: #f8fafc; }
        .item-dropdown-correcao .desc { font-weight: 600; font-size: 0.8rem; color: #334155; }
        .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 768px) {
            .col-md-6 { grid-column: span 6 / span 6; }
            .col-md-3 { grid-column: span 6 / span 6; }
            .col-md-2 { grid-column: span 4 / span 4; }
            .col-12 { grid-column: span 12 / span 12; }
            .col-6 { grid-column: span 6 / span 6; }
            .col-4 { grid-column: span 4 / span 4; }
            .page-header h1 { font-size: 1.5rem; }
            .tabela-padrao th, .tabela-padrao td { padding: 12px 10px !important; }
        }
      `}</style>
    </div>
  );
};

export default EntradaEstoque;