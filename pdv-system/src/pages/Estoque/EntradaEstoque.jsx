import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Truck, FileText, Plus, Save,
  Search, Trash2, ArrowLeft, User, Barcode,
  UploadCloud, X, Package
} from 'lucide-react';
import './EntradaEstoque.css';

const EntradaEstoque = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const qtdInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const listaSugestoesRef = useRef(null);

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const [loading, setLoading] = useState(false);
  const [cabecalho, setCabecalho] = useState({
    fornecedorId: '',
    tipoEntrada: 'NOTA_FISCAL',
    numeroDocumento: '',
    dataEmissao: new Date().toISOString().split('T')[0],
    observacao: ''
  });

  const [fornecedores, setFornecedores] = useState([]);
  const [itens, setItens] = useState([]);

  // --- ESTADOS DA BUSCA INTELIGENTE ---
  const [termoBusca, setTermoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);

  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [qtdItem, setQtdItem] = useState(1);
  const [custoItem, setCustoItem] = useState('');

  useEffect(() => {
    carregarFornecedores();
  }, []);

  const carregarFornecedores = async () => {
    try {
      const res = await api.get('/fornecedores');
      setFornecedores(res.data || []);
    } catch (e) { toast.error("Erro ao carregar fornecedores."); }
  };

  // --- HELPERS ---
  const parseMoeda = (v) => v ? parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) : 0;
  const formatarMoeda = (v) => v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
  const aplicarMascara = (v) => {
    const n = v.replace(/\D/g, "");
    return n ? (Number(n) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : "";
  };

  // --- BUSCA COM DEBOUNCE ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (termoBusca.length >= 2 && !produtoSelecionado) {
        try {
          const res = await api.get(`/produtos?termo=${termoBusca}`);
          const lista = res.data.content || [];
          setSugestoes(lista);
          setMostrarSugestoes(true);
          setIndiceAtivo(0);
        } catch (err) { console.error(err); }
      } else {
        setSugestoes([]);
        setMostrarSugestoes(false);
        setIndiceAtivo(-1);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [termoBusca, produtoSelecionado]);

  // --- AUTO-SCROLL DA LISTA ---
  useEffect(() => {
    if (mostrarSugestoes && listaSugestoesRef.current && indiceAtivo >= 0) {
      const itemAtivo = listaSugestoesRef.current.children[indiceAtivo];
      if (itemAtivo) {
        itemAtivo.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [indiceAtivo, mostrarSugestoes]);

  // --- NAVEGAÇÃO POR TECLADO ---
  const handleKeyDownBusca = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceAtivo(prev => (prev < sugestoes.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceAtivo(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mostrarSugestoes && sugestoes.length > 0 && indiceAtivo >= 0) {
        selecionarProduto(sugestoes[indiceAtivo]);
      }
    } else if (e.key === 'Escape') {
      setMostrarSugestoes(false);
    }
  };

  const selecionarProduto = (prod) => {
    if (!prod) return;
    setProdutoSelecionado(prod);
    setCustoItem(formatarMoeda(prod.precoCusto));
    setQtdItem(1);

    setTermoBusca('');
    setMostrarSugestoes(false);
    setSugestoes([]);
    setIndiceAtivo(-1);

    setTimeout(() => qtdInputRef.current?.focus(), 100);
  };

  // --- IMPORTAÇÃO XML (ATUALIZADA PARA MAPEAR NOVOS CAMPOS) ---
  const handleImportarXmlClick = () => fileInputRef.current.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("arquivo", file);
    setLoading(true);
    const toastId = toast.loading("Processando XML...");

    try {
       const res = await api.post('/estoque/importar-xml', formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
       });
       const { fornecedorId, numeroNota, itensXml } = res.data;

       setCabecalho(prev => ({
         ...prev,
         fornecedorId: fornecedorId || prev.fornecedorId,
         numeroDocumento: numeroNota || prev.numeroDocumento,
         tipoEntrada: 'NOTA_FISCAL'
       }));

       // ATUALIZAÇÃO IMPORTANTE: Mapear NCM e Unidade
       const itensMapeados = itensXml.map(item => ({
           idProduto: item.idProduto,
           codigoBarras: item.codigoBarras,
           descricao: item.descricao,
           quantidade: item.quantidade,
           precoCusto: item.precoCusto,
           total: item.total,
           // Novos campos essenciais para Auto-Cadastro
           ncm: item.ncm,
           unidade: item.unidade,
           novoProduto: item.novoProduto
       }));

       setItens(prev => [...prev, ...itensMapeados]);
       toast.update(toastId, { render: "XML Importado!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (error) {
       console.error(error);
       toast.update(toastId, { render: "Erro ao ler XML", type: "error", isLoading: false, autoClose: 3000 });
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  // --- CRUD ITENS (ATUALIZADO PARA INCLUIR DADOS DO PRODUTO SELECIONADO) ---
  const adicionarItem = () => {
    if (!produtoSelecionado) return;
    const custoFloat = parseMoeda(custoItem);
    if (custoFloat <= 0) return toast.warning("Custo deve ser maior que zero.");

    setItens([...itens, {
      idProduto: produtoSelecionado.id,
      codigoBarras: produtoSelecionado.codigoBarras,
      descricao: produtoSelecionado.descricao,
      // Se estamos adicionando manual, pegamos os dados do produto selecionado
      ncm: produtoSelecionado.ncm,
      unidade: produtoSelecionado.unidade,

      quantidade: Number(qtdItem),
      precoCusto: custoFloat,
      total: Number(qtdItem) * custoFloat
    }]);

    setProdutoSelecionado(null);
    setQtdItem(1);
    setCustoItem('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const removerItem = (idx) => setItens(prev => prev.filter((_, i) => i !== idx));

  // --- FINALIZAR ENTRADA (ATUALIZADO PARA ENVIAR DADOS COMPLETOS) ---
  const finalizarEntrada = async () => {
    if (!cabecalho.fornecedorId) return toast.warning("Selecione o Fornecedor.");
    if (itens.length === 0) return toast.warning("Adicione produtos.");

    setLoading(true);
    try {
      for (const item of itens) {
        await api.post('/estoque/entrada', {
          codigoBarras: item.codigoBarras,
          quantidade: item.quantidade,
          precoCusto: item.precoCusto,

          // DADOS PARA AUTO-CADASTRO (Se não existirem, o backend cria)
          descricao: item.descricao,
          ncm: item.ncm,
          unidade: item.unidade,

          numeroNotaFiscal: cabecalho.tipoEntrada === 'NOTA_FISCAL' ? cabecalho.numeroDocumento : null,
          fornecedorId: cabecalho.fornecedorId,
          observacao: `Entrada Manual: ${cabecalho.observacao}`
        });
      }
      toast.success("Entrada realizada e Produtos Atualizados!");
      navigate('/produtos');
    } catch (e) {
        toast.error("Erro ao processar.");
        console.error(e);
    }
    finally { setLoading(false); }
  };

  const totalGeral = itens.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="container-fluid">
      <div className="page-header">
        <div className="page-title">
          <h1>Entrada de Mercadoria</h1>
          <p>Manual ou Importação via XML (NFe)</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/produtos')}><ArrowLeft size={18}/> Voltar</button>
      </div>

      <div className="entrada-layout">
        <div className="painel-principal">
          <div className="card-entrada">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 15}}>
                <h3 className="card-title" style={{margin:0, border:0, padding:0}}><Truck size={18}/> Origem</h3>
                <div style={{display: 'flex', gap: 10}}>
                    <input type="file" accept=".xml" ref={fileInputRef} style={{display: 'none'}} onChange={handleFileChange} />
                    <button className="btn-xml" onClick={handleImportarXmlClick} data-label="Importar Nota Fiscal (XML)">
                        <UploadCloud size={16}/> Importar XML
                    </button>
                </div>
            </div>
            <div className="form-row">
              <div className="form-group flex-2">
                <label>Fornecedor *</label>
                <select value={cabecalho.fornecedorId} onChange={(e) => setCabecalho({...cabecalho, fornecedorId: e.target.value})} className={!cabecalho.fornecedorId ? 'input-warning' : ''}>
                  <option value="">Selecione...</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Nº Doc</label><input value={cabecalho.numeroDocumento} onChange={(e) => setCabecalho({...cabecalho, numeroDocumento: e.target.value})} placeholder="Ex: 12345" /></div>
            </div>
          </div>

          <div className="card-entrada destaque" style={{overflow: 'visible'}}>
            <h3 className="card-title"><Barcode size={18}/> Incluir Itens</h3>

            {!produtoSelecionado && (
              <div className="search-box-container" style={{position: 'relative', zIndex: 100}}>
                <div className="search-box-entrada">
                    <input ref={searchInputRef} type="text" placeholder="Digite EAN ou Nome..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} onKeyDown={handleKeyDownBusca} autoFocus autoComplete="off" />
                    <button className="btn-search-icon"><Search size={18}/></button>
                </div>

                {/* LISTA FLUTUANTE ELEGANTE (DESIGN NOVO) */}
                {mostrarSugestoes && sugestoes.length > 0 && (
                    <div className="dropdown-sugestoes" ref={listaSugestoesRef}>
                        {sugestoes.map((prod, index) => (
                            <div
                                key={prod.id}
                                className={`sugestao-item ${index === indiceAtivo ? 'ativo' : ''}`}
                                onClick={() => selecionarProduto(prod)}
                                onMouseEnter={() => setIndiceAtivo(index)}
                            >
                                {/* Ícone Ilustrativo */}
                                <div className="sugestao-icon-wrapper">
                                    <Package size={20} strokeWidth={1.5} />
                                </div>

                                {/* Texto */}
                                <div className="sugestao-conteudo">
                                    <span className="sugestao-nome">{prod.descricao}</span>
                                    <div className="sugestao-sublinha">
                                        <Barcode size={14} style={{marginRight: 4}}/>
                                        <span className="sugestao-ean">{prod.codigoBarras}</span>
                                    </div>
                                </div>

                                {/* Dica Visual de Enter */}
                                {index === indiceAtivo && (
                                    <div className="sugestao-enter-hint">↵</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
              </div>
            )}

            {produtoSelecionado && (
              <div className="item-editor">
                <div className="produto-header" style={{display: 'flex', justifyContent: 'space-between'}}>
                  <div><span className="prod-nome">{produtoSelecionado.descricao}</span><span className="prod-ean">{produtoSelecionado.codigoBarras}</span></div>
                  <button onClick={() => { setProdutoSelecionado(null); setTimeout(()=>searchInputRef.current?.focus(), 100)}} style={{background:'none', border:'none', cursor:'pointer'}}><X size={18} color="#ef4444"/></button>
                </div>
                <div className="inputs-valores-row">
                  <div className="form-group"><label>Qtd.</label><input ref={qtdInputRef} type="number" min="1" value={qtdItem} onChange={(e) => setQtdItem(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && document.getElementById('input-custo').focus()}/></div>
                  <div className="form-group"><label>Custo (R$)</label><input id="input-custo" type="text" value={custoItem} onChange={(e) => setCustoItem(aplicarMascara(e.target.value))} onKeyDown={(e)=>e.key==='Enter' && adicionarItem()}/></div>
                  <div className="form-group"><label>Total</label><input type="text" disabled value={formatarMoeda(qtdItem * parseMoeda(custoItem))} style={{backgroundColor: '#e0e7ff', fontWeight: 'bold'}}/></div>
                  <div className="actions-row"><button className="btn-add-item" onClick={adicionarItem}><Plus size={18}/> Inserir</button></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="painel-resumo">
          <div className="lista-itens">
            <h3>Itens ({itens.length})</h3>
            <ul className="itens-scroll">
              {itens.map((item, idx) => (
                <li key={idx} className="item-row">
                  <div className="item-desc">
                      <strong>{item.descricao}</strong>
                      <small>{item.quantidade} x R$ {formatarMoeda(item.precoCusto)}</small>
                      {/* Indicador visual se for produto novo (opcional) */}
                      {item.novoProduto && <span style={{fontSize: '0.7rem', color: '#059669', fontWeight:'bold'}}>✨ Novo Cadastro</span>}
                  </div>
                  <div className="item-total"><strong>R$ {formatarMoeda(item.total)}</strong><button className="btn-trash" onClick={() => removerItem(idx)}><Trash2 size={16}/></button></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="resumo-footer">
            <div className="audit-info"><User size={14}/><span>Resp: <strong>{usuario.nome}</strong></span></div>
            <div className="total-block"><span>Total Nota</span><h2>R$ {formatarMoeda(totalGeral)}</h2></div>
            <button className="btn-finalizar" onClick={finalizarEntrada} disabled={loading}>{loading ? '...' : <><Save size={20}/> Confirmar</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EntradaEstoque;