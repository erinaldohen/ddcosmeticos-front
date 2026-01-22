import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import produtoService from '../../services/produtoService';
import { toast } from 'react-toastify';
import {
  Truck, Save, Plus, Search, Trash2, ArrowLeft, Package, Check,
  AlertTriangle, Link as LinkIcon, Loader, UploadCloud, X,
  ShoppingCart, FileText, Calendar, CheckCircle, Barcode, Edit3, Wand2, Link2
} from 'lucide-react';

import FornecedorForm from '../Fornecedores/FornecedorForm';
import ProdutoForm from '../Produtos/ProdutoForm';
import './EntradaEstoque.css';

const EntradaEstoque = () => {
  const navigate = useNavigate();

  // --- ESTADOS ---
  const [loading, setLoading] = useState(false);

  // Dados de Apoio
  const [listaFornecedores, setListaFornecedores] = useState([]);
  const [listaProdutosDb, setListaProdutosDb] = useState([]); // Cache local

  // Dados da Nota
  const [itens, setItens] = useState([]);
  const [cabecalho, setCabecalho] = useState({
    fornecedorId: '',
    numeroDocumento: '',
    dataEmissao: new Date().toISOString().split('T')[0]
  });

  // Estados de Controle Visual/Lógico
  const [searchState, setSearchState] = useState({ rowIndex: null, term: '', results: [] });
  const [linhasEmModoBusca, setLinhasEmModoBusca] = useState({});

  // Modais
  const [showModalFornecedor, setShowModalFornecedor] = useState(false);
  const [showModalProduto, setShowModalProduto] = useState(false);

  // Busca Manual (Topo)
  const [termoBusca, setTermoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [qtdItem, setQtdItem] = useState(1);
  const [custoItem, setCustoItem] = useState('');

  const fileInputRef = useRef(null);
  const qtdInputRef = useRef(null);

  // --- HELPER: Conversão Segura de Moeda ---
  const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove pontos de milhar e troca vírgula por ponto
    const cleanValue = value.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  const carregarDadosIniciais = async () => {
    try {
      // Tenta buscar dropdown otimizado, fallback para lista maior se falhar
      const resForn = await api.get('/fornecedores/dropdown').catch(() => api.get('/fornecedores?size=100'));
      const dadosForn = Array.isArray(resForn.data) ? resForn.data : (resForn.data.content || []);
      setListaFornecedores(dadosForn);

      // Cache de produtos para match rápido do XML
      // NOTA: Em produção com muitos produtos, isso deve mudar para busca sob demanda.
      const resProd = await api.get('/produtos?size=5000');
      setListaProdutosDb(resProd.data.content || []);
    } catch (e) {
        console.error("Erro init:", e);
        toast.error("Erro ao carregar dados de apoio.");
    }
  };

  // --- BUSCA PRODUTO (MANUAL - TOPO) ---
  useEffect(() => {
    const delay = setTimeout(async () => {
      if (termoBusca.length >= 3 && !produtoSelecionado) {
        try {
          const res = await api.get(`/produtos?termo=${termoBusca}`);
          setSugestoes(res.data.content || []);
        } catch (err) { console.error(err); }
      } else {
        setSugestoes([]);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [termoBusca, produtoSelecionado]);

  // --- LÓGICA FISCAL XML (Heurística Frontend) ---
  const inferirDadosFiscais = (xmlItem, fornecedorNome) => {
    let marca = "GENERICA";
    const nomeUpper = fornecedorNome?.toUpperCase() || "";
    if (nomeUpper.includes("EUDORA")) marca = "EUDORA";
    else if (nomeUpper.includes("BOTICARIO")) marca = "BOTICARIO";
    else if (nomeUpper.includes("NATURA")) marca = "NATURA";
    else if (nomeUpper.includes("AVON")) marca = "AVON";

    // Limpa pontuação do NCM
    const ncm = xmlItem.ncm ? xmlItem.ncm.replace(/\./g, '') : '00000000';

    // Padrões fiscais
    let fiscal = { csosn: '102', pisCofins: '01' };

    // Exemplo de regra inteligente (Sabonetes -> ST)
    if (ncm.startsWith('3401')) {
        fiscal = { csosn: '500', pisCofins: '04' };
    }

    const prefixo = ncm.substring(0, 4);
    const mapa = { '3303': 'PERFUMARIA', '3304': 'MAQUIAGEM', '3305': 'CAPILAR', '3307': 'CORPO E BANHO' };
    const categoria = mapa[prefixo] || "GERAL";

    return { marca, categoria, fiscal };
  };

  // --- ADICIONAR ITEM AVULSO ---
  const selecionarProduto = (prod) => {
    setProdutoSelecionado(prod);
    setTermoBusca(prod.descricao);
    setSugestoes([]);
    // Formata visualmente para BR (com vírgula)
    setCustoItem(prod.precoCusto ? prod.precoCusto.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '');
    setQtdItem(1);
    setTimeout(() => qtdInputRef.current?.focus(), 100);
  };

  const adicionarItem = () => {
    if (!produtoSelecionado) return;

    // Usa o helper seguro para converter
    const custo = parseCurrency(custoItem);

    setItens([...itens, {
        idProduto: produtoSelecionado.id,
        descricao: produtoSelecionado.descricao,
        codigoBarras: produtoSelecionado.codigoBarras,
        quantidade: Number(qtdItem),
        precoCusto: custo,
        total: Number(qtdItem) * custo,
        status: 'vinculado',
        estoqueAtual: produtoSelecionado.quantidadeEmEstoque || 0,
        origem: '0',
        cst: '102',
        ncm: produtoSelecionado.ncm || '00000000',
        marca: produtoSelecionado.marca || 'GENERICA',
        categoria: produtoSelecionado.categoria || 'GERAL'
    }]);

    // Reset
    setProdutoSelecionado(null);
    setTermoBusca('');
    setQtdItem(1);
    setCustoItem('');
  };

  // --- IMPORTAÇÃO XML ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("arquivo", file);
    setLoading(true);
    const toastId = toast.loading("Analisando XML...");

    try {
       const res = await api.post('/estoque/importar-xml', formData, {
           headers: { 'Content-Type': 'multipart/form-data' }
       });

       const { fornecedorId, razaoSocialFornecedor, numeroNota, itensXml, dataEmissao } = res.data;

       setCabecalho(prev => ({
         ...prev,
         fornecedorId: fornecedorId || prev.fornecedorId,
         numeroDocumento: numeroNota || prev.numeroDocumento,
         // Garante formato YYYY-MM-DD mesmo se vier timestamp completo
         dataEmissao: dataEmissao ? dataEmissao.split('T')[0] : prev.dataEmissao
       }));

       // Atualiza lista de fornecedores se vier um novo do XML
       if (fornecedorId && razaoSocialFornecedor) {
           setListaFornecedores(prev => {
               if (!prev.find(f => f.id === fornecedorId)) {
                   return [...prev, { id: fornecedorId, razaoSocial: razaoSocialFornecedor, nomeFantasia: razaoSocialFornecedor }];
               }
               return prev;
           });
       }

       // Processamento de Match (Local)
       const novosItens = itensXml.map(xmlItem => {
           const dadosFiscais = inferirDadosFiscais(xmlItem, razaoSocialFornecedor);

           // 1. Match Exato (Código de Barras)
           const matchExato = listaProdutosDb.find(db =>
               String(db.codigoBarras) === String(xmlItem.codigoBarras) && xmlItem.codigoBarras.length > 5
           );

           if (matchExato) {
               return {
                   ...xmlItem,
                   idProduto: matchExato.id,
                   descricao: matchExato.descricao, // Usa a descrição do nosso sistema
                   status: 'vinculado',
                   match: matchExato,
                   estoqueAtual: matchExato.quantidadeEmEstoque || 0,
                   ...dadosFiscais
               };
           }

           // 2. Match Semelhante (Nome)
           const matchSimilar = listaProdutosDb.find(db =>
               db.descricao && xmlItem.descricao &&
               db.descricao.toUpperCase().includes(xmlItem.descricao.toUpperCase().substring(0, 10))
           );

           if (matchSimilar) {
               return {
                   ...xmlItem,
                   idProduto: null,
                   status: 'semelhante',
                   match: matchSimilar,
                   estoqueAtual: 0,
                   ...dadosFiscais
               };
           }

           // 3. Novo Produto
           return {
               ...xmlItem,
               idProduto: null,
               status: 'novo',
               match: null,
               estoqueAtual: 0,
               ...dadosFiscais
           };
       });

       setItens(prev => [...prev, ...novosItens]);
       toast.update(toastId, { render: "XML Importado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });

    } catch (error) {
       console.error(error);
       const msg = error.response?.data?.message || "Erro ao processar o arquivo XML.";
       toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 4000 });
    } finally {
      setLoading(false);
      e.target.value = null; // Reseta o input file para permitir re-upload
    }
  };

  // --- FUNÇÕES DE MANIPULAÇÃO DA TABELA ---

  const atualizarCampoItem = (index, campo, valor) => {
      const lista = [...itens];
      lista[index][campo] = campo === 'descricao' ? valor.toUpperCase() : valor;
      setItens(lista);
  };

  const handleGerarEanInterno = async (index) => {
    try {
      const novoEan = await produtoService.gerarEanInterno();
      atualizarCampoItem(index, 'codigoBarras', novoEan);
      toast.info("Código EAN gerado!");
    } catch (err) {
      toast.error("Erro ao gerar código.");
    }
  };

  const ativarModoBusca = (index) => {
      setLinhasEmModoBusca(prev => ({ ...prev, [index]: true }));
      setSearchState({ rowIndex: index, term: '', results: [] });
  };

  const cancelarModoBusca = (index) => {
      const novaLista = { ...linhasEmModoBusca };
      delete novaLista[index];
      setLinhasEmModoBusca(novaLista);
      setSearchState({ rowIndex: null, term: '', results: [] });
  };

  const handleSearchCorrecao = (index, valor) => {
      setSearchState(prev => ({ ...prev, rowIndex: index, term: valor }));
      if(!valor || valor.length < 2) {
          setSearchState(prev => ({ ...prev, results: [] }));
          return;
      }
      const termoUpper = valor.toUpperCase();
      const matches = listaProdutosDb.filter(db =>
          db.descricao.toUpperCase().includes(termoUpper) || String(db.codigoBarras).includes(valor)
      ).slice(0, 5); // Limita resultados
      setSearchState(prev => ({ ...prev, results: matches }));
  };

  const vincularSugestao = (index, produtoDb) => {
      const lista = [...itens];
      lista[index].idProduto = produtoDb.id;
      lista[index].descricao = produtoDb.descricao;
      lista[index].codigoBarras = produtoDb.codigoBarras;
      // Se o produto do banco tem NCM, usa ele. Senão mantém o do XML.
      lista[index].ncm = produtoDb.ncm || lista[index].ncm;
      lista[index].status = 'vinculado';
      lista[index].estoqueAtual = produtoDb.quantidadeEmEstoque || 0;
      setItens(lista);

      // Limpa estados de busca
      setSearchState({ rowIndex: null, term: '', results: [] });
      const novaListaBusca = { ...linhasEmModoBusca };
      delete novaListaBusca[index];
      setLinhasEmModoBusca(novaListaBusca);

      toast.success("Produto vinculado!");
  };

  const removerItem = (idx) => setItens(itens.filter((_, i) => i !== idx));

  // --- FINALIZAR ENTRADA ---
  const finalizarEntrada = async (e) => {
    if(e) e.preventDefault();
    if (!cabecalho.fornecedorId) return toast.warn("Selecione o Fornecedor no topo.");

    // Validações
    if (itens.some(i => i.status === 'semelhante')) {
        return toast.warn("Existem itens marcados como 'ATENÇÃO'. Vincule-os ou confirme que são novos.");
    }
    if (itens.some(i => i.status === 'novo' && (!i.codigoBarras || i.codigoBarras.length < 3))) {
        return toast.warn("Existem produtos novos sem Código de Barras válido.");
    }

    const payload = {
        fornecedorId: cabecalho.fornecedorId,
        numeroDocumento: cabecalho.numeroDocumento || "S/N",
        dataVencimento: cabecalho.dataEmissao, // O Backend usa dataVencimento como data base para financeiro
        itens: itens.map(i => ({
            produtoId: i.idProduto,
            codigoBarras: i.codigoBarras || "SEM GTIN",
            descricao: i.descricao,
            quantidade: i.quantidade,
            valorUnitario: i.precoCusto,
            ncm: i.ncm || "00000000",
            origem: i.origem || '0',
            cst: i.fiscal?.csosn || i.cst || '102',
            marca: i.marca || 'GENERICA',
            categoria: i.categoria || 'GERAL',
            unidade: 'UN'
        }))
    };

    setLoading(true);
    try {
        await api.post('/estoque/entrada', payload);
        toast.success("Entrada registrada com sucesso!");
        navigate('/estoque'); // Redireciona para listagem/histórico
    } catch(e) {
        console.error(e);
        const msg = e.response?.data?.message || "Erro ao registrar entrada.";
        toast.error(msg);
    } finally { setLoading(false); }
  };

  const totalGeral = itens.reduce((a, b) => a + (Number(b.total) || 0), 0);

  const getRowStyle = (status) => {
      const base = { transition: 'all 0.2s ease' };
      switch(status) {
          case 'vinculado': return { ...base, borderLeft: '4px solid #10b981', backgroundColor: '#f0fdf4' };
          case 'semelhante': return { ...base, borderLeft: '4px solid #f59e0b', backgroundColor: '#fffbeb' };
          case 'novo': return { ...base, borderLeft: '4px solid #3b82f6', backgroundColor: '#eff6ff' };
          default: return base;
      }
  };

  return (
    <div className="entrada-container">

      {/* --- HEADER --- */}
      <div className="page-header">
        <div className="page-title">
            <h1>Entrada de Mercadoria</h1>
            <p>Gerencie o estoque registrando compras e notas fiscais</p>
        </div>
        <div style={{display:'flex', gap:12}}>
            <button className="btn-std btn-secondary" onClick={() => navigate('/produtos')}>
                <ArrowLeft size={18}/> Voltar
            </button>
            <button className="btn-std btn-secondary" onClick={() => fileInputRef.current.click()}>
                <UploadCloud size={18}/> Importar XML
            </button>
            <input type="file" style={{display:'none'}} ref={fileInputRef} onChange={handleFileChange} accept=".xml"/>
        </div>
      </div>

      {/* --- DADOS DA NOTA --- */}
      <div className="bloco-entrada">
        <div className="titulo-sessao"><FileText size={16}/> Dados da Nota Fiscal</div>
        <div className="form-grid">
            <div className="col-6">
                <label>Fornecedor *</label>
                <div className="input-group">
                    <select
                        value={cabecalho.fornecedorId}
                        onChange={e => setCabecalho({...cabecalho, fornecedorId: e.target.value})}
                        style={{ border: !cabecalho.fornecedorId ? '1px solid #f87171' : '1px solid #e2e8f0' }}
                    >
                        <option value="">Selecione o Fornecedor...</option>
                        {listaFornecedores.map(f => (<option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>))}
                    </select>
                    <button className="btn-addon" onClick={() => setShowModalFornecedor(true)}><Plus size={18}/></button>
                </div>
            </div>
            <div className="col-3">
                <label>Nº Documento</label>
                <input
                    value={cabecalho.numeroDocumento}
                    onChange={e => setCabecalho({...cabecalho, numeroDocumento: e.target.value})}
                    placeholder="S/N"
                />
            </div>
            <div className="col-3">
                <label>Data Emissão</label>
                <div className="date-input-wrapper">
                    <input
                        type="date"
                        value={cabecalho.dataEmissao}
                        onChange={e => setCabecalho({...cabecalho, dataEmissao: e.target.value})}
                    />
                    <Calendar size={18} className="icon-calendar"/>
                </div>
            </div>
        </div>
      </div>

      {/* --- ADICIONAR MANUAL --- */}
      <div className="bloco-entrada" style={{borderLeft: '4px solid #6366f1'}}>
         <div className="titulo-sessao" style={{color:'#6366f1'}}><Package size={16}/> Adicionar Produto Avulso</div>
         <div className="form-grid">
             <div className="col-6" style={{position:'relative'}}>
                 <label>Buscar Produto</label>
                 <div className="input-group">
                     <div style={{position:'relative', width:'100%'}}>
                         <Search size={16} style={{position:'absolute', left:12, top:13, color:'#94a3b8'}}/>
                         <input
                            placeholder="Digite nome, código ou barras..."
                            style={{paddingLeft: 38}}
                            value={termoBusca}
                            onChange={e => { setTermoBusca(e.target.value); setProdutoSelecionado(null); }}
                         />
                     </div>
                     <button className="btn-addon" onClick={() => setShowModalProduto(true)} title="Novo Cadastro Rápido"><Plus size={18}/></button>
                 </div>

                 {/* Sugestões Dropdown */}
                 {sugestoes.length > 0 && !produtoSelecionado && (
                     <div className="dropdown-busca">
                         {sugestoes.map(s => (
                             <div key={s.id} className="item-busca" onClick={() => selecionarProduto(s)}>
                                 <span style={{flex:1}}>{s.descricao}</span>
                                 <strong style={{color:'#16a34a'}}>R$ {s.precoVenda?.toFixed(2)}</strong>
                             </div>
                         ))}
                     </div>
                 )}
             </div>

             <div className="col-2"><label>Quantidade</label><input type="number" ref={qtdInputRef} value={qtdItem} onChange={e => setQtdItem(e.target.value)} min="1"/></div>
             <div className="col-2"><label>Custo Unit. (R$)</label><input value={custoItem} onChange={e => setCustoItem(e.target.value)} placeholder="0,00"/></div>
             <div className="col-2">
                 <button className="btn-std btn-success" style={{width:'100%'}} onClick={adicionarItem} disabled={!produtoSelecionado}>
                     <Plus size={18}/> Incluir
                 </button>
             </div>
         </div>
      </div>

      {/* --- TABELA DE ITENS --- */}
      <div className="bloco-entrada" style={{padding:0, overflow:'hidden'}}>

          <div style={{padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display:'flex', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'#334155'}}>
                  <ShoppingCart size={18}/> Itens no Carrinho ({itens.length})
              </div>
          </div>

          <div className="table-container">
              <table className="tabela-padrao">
                  <thead>
                      <tr>
                          <th style={{paddingLeft: 24, width: '15%'}}>Status</th>
                          <th style={{width: '35%'}}>Produto / Edição</th>
                          <th style={{width: '20%'}}>Valores</th>
                          <th style={{width: '25%'}}>Ação Necessária</th>
                          <th width="50"></th>
                      </tr>
                  </thead>
                  <tbody>
                      {itens.map((item, idx) => {
                          const isSearching = linhasEmModoBusca[idx];

                          return (
                              <tr key={idx} style={getRowStyle(item.status)}>

                                  {/* STATUS */}
                                  <td style={{paddingLeft: 24, verticalAlign: 'top', paddingTop: 16}}>
                                      {item.status === 'vinculado' && <span className="badge-status bg-green-100 text-green-800"><CheckCircle size={14}/> VINCULADO</span>}
                                      {item.status === 'semelhante' && <span className="badge-status bg-yellow-100 text-yellow-800"><AlertTriangle size={14}/> ATENÇÃO</span>}
                                      {item.status === 'novo' && <span className="badge-status bg-blue-100 text-blue-800"><Package size={14}/> NOVO</span>}
                                  </td>

                                  {/* PRODUTO */}
                                  <td style={{verticalAlign: 'top', paddingTop: 16}}>
                                      {item.status === 'novo' && !isSearching ? (
                                          <div style={{display:'flex', flexDirection:'column', gap:8}}>
                                              <div>
                                                  <label className="label-mini">Descrição (XML)</label>
                                                  <div className="input-icon-wrapper">
                                                      <Edit3 size={14} className="icon-left"/>
                                                      <input
                                                        value={item.descricao}
                                                        onChange={(e) => atualizarCampoItem(idx, 'descricao', e.target.value)}
                                                        className="input-elegante"
                                                      />
                                                  </div>
                                              </div>
                                              <div>
                                                  <label className="label-mini">EAN / Código</label>
                                                  <div className="input-group-elegante">
                                                      <input
                                                        value={item.codigoBarras}
                                                        onChange={(e) => atualizarCampoItem(idx, 'codigoBarras', e.target.value)}
                                                        className="input-elegante"
                                                        placeholder="Digite ou gere..."
                                                      />
                                                      <button onClick={() => handleGerarEanInterno(idx)} className="btn-magic" title="Gerar Código"><Wand2 size={16}/></button>
                                                  </div>
                                              </div>
                                              <div className="label-mini text-gray-400">NCM: {item.ncm}</div>
                                          </div>
                                      ) : (
                                          <div>
                                              <strong style={{color:'#1e293b', display:'block', marginBottom:4}}>
                                                  {isSearching ? 'Buscando vínculo...' : item.descricao}
                                              </strong>
                                              {!isSearching && (
                                                  <div style={{display:'flex', gap:12, fontSize:'0.8rem', color:'#64748b'}}>
                                                      <span style={{display:'flex', alignItems:'center', gap:4}}><Barcode size={14}/> {item.codigoBarras}</span>
                                                      <span style={{display:'flex', alignItems:'center', gap:4}}><FileText size={14}/> NCM: {item.ncm}</span>
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                  </td>

                                  {/* FINANCEIRO */}
                                  <td style={{verticalAlign: 'top', paddingTop: 16}}>
                                      <div style={{color:'#475569', fontSize:'0.9rem'}}>{item.quantidade} x R$ {Number(item.precoCusto).toFixed(2)}</div>
                                      <div style={{color:'#4f46e5', fontWeight:800, fontSize:'1rem'}}>Total: R$ {item.total.toFixed(2)}</div>
                                  </td>

                                  {/* AÇÕES */}
                                  <td style={{verticalAlign: 'top', paddingTop: 16}}>
                                      {(item.status === 'semelhante' || isSearching) && (
                                          <div style={{display:'flex', flexDirection:'column', gap:8}}>

                                              {/* Sugestão Automática */}
                                              {item.status === 'semelhante' && !isSearching && (
                                                  <div className="card-sugestao">
                                                      <div style={{fontSize:'0.7rem', color:'#854d0e', fontWeight:'bold', marginBottom:4}}>SUGESTÃO:</div>
                                                      <div style={{fontSize:'0.85rem', fontWeight:'600', color:'#451a03', marginBottom:6}}>{item.match.descricao}</div>
                                                      <button onClick={() => vincularSugestao(idx, item.match)} className="btn-aceitar-sugestao">
                                                          <LinkIcon size={14}/> É este produto
                                                      </button>
                                                  </div>
                                              )}

                                              {/* Busca de Correção */}
                                              <div style={{position:'relative'}}>
                                                  <div className="input-icon-wrapper">
                                                      <Search size={14} className="icon-left text-gray-400"/>
                                                      <input
                                                        autoFocus={isSearching}
                                                        placeholder="Pesquise Nome ou EAN..."
                                                        className="input-elegante pl-8"
                                                        value={searchState.rowIndex === idx ? searchState.term : ''}
                                                        onChange={(e) => handleSearchCorrecao(idx, e.target.value)}
                                                      />
                                                      {isSearching && (
                                                          <button onClick={() => cancelarModoBusca(idx)} className="absolute right-2 top-1.5 text-gray-400 hover:text-red-500">
                                                              <X size={14}/>
                                                          </button>
                                                      )}
                                                  </div>

                                                  {searchState.rowIndex === idx && searchState.results.length > 0 && (
                                                      <div className="dropdown-correcao">
                                                          {searchState.results.map(res => (
                                                              <div key={res.id} className="item-dropdown-correcao" onClick={() => vincularSugestao(idx, res)}>
                                                                  <span className="desc">{res.descricao}</span>
                                                                  <div style={{display:'flex', justifyContent:'space-between'}}>
                                                                      <span className="ean">{res.codigoBarras}</span>
                                                                  </div>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      )}

                                      {/* Opção para Vincular em Novo */}
                                      {item.status === 'novo' && !isSearching && (
                                          <div style={{display:'flex', flexDirection:'column', gap:6}}>
                                              <div style={{fontSize:'0.8rem', color:'#3b82f6', background:'#eff6ff', padding:8, borderRadius:6}}>
                                                  Será cadastrado como novo.
                                              </div>
                                              <button
                                                onClick={() => ativarModoBusca(idx)}
                                                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                              >
                                                  <Link2 size={12}/> Já tenho este produto
                                              </button>
                                          </div>
                                      )}

                                      {item.status === 'vinculado' && (
                                          <div style={{fontSize:'0.8rem', color:'#166534', display:'flex', alignItems:'center', gap:4}}>
                                              <CheckCircle size={14}/> Tudo certo. Estoque será atualizado.
                                          </div>
                                      )}
                                  </td>

                                  <td align="center" style={{verticalAlign: 'top', paddingTop: 16}}>
                                      <button className="btn-icon-danger" onClick={() => removerItem(idx)}><Trash2 size={18}/></button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>

          <div className="footer-resumo" style={{margin:'0 24px 24px 24px'}}>
               <div>
                   <span className="total-label">VALOR TOTAL DA NOTA</span>
                   <span className="total-value">R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
               </div>
               <button
                  className="btn-std btn-primary"
                  style={{height: 56, fontSize: '1.1rem', padding: '0 40px'}}
                  onClick={finalizarEntrada}
                  disabled={loading || itens.length === 0}
               >
                   {loading ? <Loader className="animate-spin"/> : <Save size={20}/>}
                   Confirmar Entrada
               </button>
          </div>
      </div>

      {/* --- MODAL FORNECEDOR --- */}
      {showModalFornecedor && (
          <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '800px', padding: '0' }}>
                  <div className="modal-header" style={{ padding: '20px 20px 0 20px' }}>
                      <h3>Novo Fornecedor</h3>
                      <button onClick={() => setShowModalFornecedor(false)}><X size={20}/></button>
                  </div>
                  <div style={{ padding: '20px' }}>
                      <FornecedorForm isModal={true} onSuccess={(f) => { setListaFornecedores(p => [...p, f]); setCabecalho(p => ({...p, fornecedorId: f.id})); setShowModalFornecedor(false); }} />
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL PRODUTO (NOVO) --- */}
      {showModalProduto && (
         <div className="modal-overlay">
             {/* O ProdutoForm já tem estilo próprio, encapsulamos aqui */}
             <div className="modal-card" style={{ maxWidth: '900px', padding: '0', maxHeight: '90vh', overflowY: 'auto' }}>
                  <div className="modal-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #eee' }}>
                      <h3>Novo Produto Rápido</h3>
                      <button onClick={() => setShowModalProduto(false)}><X size={20}/></button>
                  </div>
                  <div style={{ padding: '10px' }}>
                      {/* Passamos isModal para ajustar layout se necessário */}
                      <ProdutoForm isModal={true} onSuccess={(prod) => {
                          setListaProdutosDb(prev => [...prev, prod]);
                          // Já seleciona o produto criado
                          selecionarProduto(prod);
                          setShowModalProduto(false);
                      }} />
                  </div>
             </div>
         </div>
      )}

      {/* STYLES EMbutidos PARA O LOOK ELEGANTE */}
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
        .item-dropdown-correcao .ean { font-size: 0.7rem; color: #94a3b8; }
      `}</style>
    </div>
  );
};

export default EntradaEstoque;