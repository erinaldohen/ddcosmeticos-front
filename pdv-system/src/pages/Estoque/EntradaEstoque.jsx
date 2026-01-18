import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Truck, Save, Plus, Search, Trash2, ArrowLeft, User, Barcode,
  UploadCloud, X, Package, Check, AlertTriangle, Link as LinkIcon
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
      // ATUALIZAÇÃO IMPORTANTE: Usando o endpoint /dropdown para evitar erro 500 e garantir array limpo
      // Se falhar, faz fallback para o endpoint padrão tratando a paginação (.content)
      const res = await api.get('/fornecedores/dropdown')
        .catch(async () => await api.get('/fornecedores?size=100'));

      const lista = Array.isArray(res.data) ? res.data : (res.data.content || []);
      setFornecedores(lista);
    } catch (e) {
      console.error("Erro ao carregar fornecedores:", e);
      toast.error("Erro ao carregar lista de fornecedores.");
    }
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

  // --- IMPORTAÇÃO XML INTELIGENTE ---
  const handleImportarXmlClick = () => fileInputRef.current.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("arquivo", file);
    setLoading(true);
    const toastId = toast.loading("Analisando XML e buscando vínculos...");

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

       // MAPEAMENTO COMPLETO DA INTELIGÊNCIA
       const itensMapeados = itensXml.map(item => ({
           idProduto: item.idProduto, // Pode vir preenchido se achou match
           codigoBarras: item.codigoBarras,
           descricao: item.descricao, // Descrição do XML
           quantidade: item.quantidade,
           precoCusto: item.precoCusto,
           total: item.total,

           // Novos campos de Inteligência
           ncm: item.ncm,
           unidade: item.unidade,
           statusMatch: item.statusMatch, // MATCH_EXATO, SUGESTAO_FORTE, NOVO_PRODUTO
           motivoMatch: item.motivoMatch,
           nomeProdutoSugerido: item.nomeProdutoSugerido, // Nome no nosso banco
           alertaDivergencia: item.alertaDivergencia,
           codigoNoFornecedor: item.codigoNoFornecedor // Para criar vínculo futuro
       }));

       setItens(prev => [...prev, ...itensMapeados]);
       toast.update(toastId, { render: "Análise concluída!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (error) {
       console.error(error);
       toast.update(toastId, { render: "Erro ao ler XML", type: "error", isLoading: false, autoClose: 3000 });
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  // --- AÇÃO: ACEITAR SUGESTÃO (Converter Amarelo em Verde) ---
  const aceitarSugestao = (index) => {
    const novaLista = [...itens];
    const item = novaLista[index];

    // Atualiza status localmente para Verde
    item.statusMatch = 'MATCH_EXATO';
    // O idProduto já veio do backend, então ao salvar, o sistema criará o vínculo

    setItens(novaLista);
    toast.success("Vínculo confirmado! Será salvo ao finalizar.");
  };

  // --- CRUD ITENS MANUAL ---
  const adicionarItem = () => {
    if (!produtoSelecionado) return;
    const custoFloat = parseMoeda(custoItem);

    setItens([...itens, {
      idProduto: produtoSelecionado.id,
      codigoBarras: produtoSelecionado.codigoBarras,
      descricao: produtoSelecionado.descricao,
      ncm: produtoSelecionado.ncm,
      unidade: produtoSelecionado.unidade,
      quantidade: Number(qtdItem),
      precoCusto: custoFloat,
      total: Number(qtdItem) * custoFloat,

      // Item manual é sempre um Match Exato pois o usuário escolheu
      statusMatch: 'MATCH_EXATO',
      nomeProdutoSugerido: produtoSelecionado.descricao
    }]);

    setProdutoSelecionado(null);
    setQtdItem(1);
    setCustoItem('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const removerItem = (idx) => setItens(prev => prev.filter((_, i) => i !== idx));

  // --- FINALIZAR ENTRADA ---
  const finalizarEntrada = async () => {
    if (!cabecalho.fornecedorId) return toast.warning("Selecione o Fornecedor.");
    if (itens.length === 0) return toast.warning("Adicione produtos.");

    setLoading(true);
    try {
      // Envia como um POST único para o backend (Endpoint de Entrada Manual/XML)
      const payload = {
        fornecedorId: cabecalho.fornecedorId,
        numeroNfe: cabecalho.tipoEntrada === 'NOTA_FISCAL' ? cabecalho.numeroDocumento : null,
        dataEmissao: cabecalho.dataEmissao,
        observacao: cabecalho.observacao,
        itens: itens.map(item => ({
            produtoId: item.idProduto, // Se null, backend cria novo
            codigoBarras: item.codigoBarras,
            descricao: item.descricao,
            ncm: item.ncm,
            quantidade: item.quantidade,
            precoCustoUnitario: item.precoCusto,
            codigoNoFornecedor: item.codigoNoFornecedor,
            unidade: item.unidade
        }))
      };

      await api.post('/estoque/entrada/manual', payload);

      toast.success("Estoque atualizado e Vínculos aprendidos!");
      navigate('/produtos');
    } catch (e) {
        toast.error("Erro ao processar entrada. Verifique o console.");
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
          <p>Conciliação de NFe Inteligente e Entrada Manual</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/produtos')}><ArrowLeft size={18}/> Voltar</button>
      </div>

      <div className="entrada-layout">
        {/* LADO ESQUERDO: FORMULÁRIOS */}
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
                  {/* PROTEÇÃO CONTRA CRASH SE FORNECEDORES FOR NULL */}
                  {Array.isArray(fornecedores) && fornecedores.map(f => (
                    <option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Nº Doc</label><input value={cabecalho.numeroDocumento} onChange={(e) => setCabecalho({...cabecalho, numeroDocumento: e.target.value})} placeholder="Ex: 12345" /></div>
            </div>
          </div>

          <div className="card-entrada destaque" style={{overflow: 'visible'}}>
            <h3 className="card-title"><Barcode size={18}/> Incluir Manualmente</h3>

            {!produtoSelecionado && (
              <div className="search-box-container" style={{position: 'relative', zIndex: 100}}>
                <div className="search-box-entrada">
                    <input ref={searchInputRef} type="text" placeholder="Digite EAN ou Nome..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} onKeyDown={handleKeyDownBusca} autoFocus autoComplete="off" />
                    <button className="btn-search-icon"><Search size={18}/></button>
                </div>
                {mostrarSugestoes && sugestoes.length > 0 && (
                    <div className="dropdown-sugestoes" ref={listaSugestoesRef}>
                        {sugestoes.map((prod, index) => (
                            <div key={prod.id} className={`sugestao-item ${index === indiceAtivo ? 'ativo' : ''}`} onClick={() => selecionarProduto(prod)} onMouseEnter={() => setIndiceAtivo(index)}>
                                <div className="sugestao-icon-wrapper"><Package size={20} strokeWidth={1.5} /></div>
                                <div className="sugestao-conteudo">
                                    <span className="sugestao-nome">{prod.descricao}</span>
                                    <div className="sugestao-sublinha"><Barcode size={14} style={{marginRight: 4}}/><span className="sugestao-ean">{prod.codigoBarras}</span></div>
                                </div>
                                {index === indiceAtivo && <div className="sugestao-enter-hint">↵</div>}
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
                  <div className="actions-row"><button className="btn-add-item" onClick={adicionarItem}><Plus size={18}/> Inserir</button></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LADO DIREITO: LISTA INTELIGENTE (SEMÁFORO) */}
        <div className="painel-resumo">
          <div className="lista-itens">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 15}}>
                <h3>Itens ({itens.length})</h3>
                {itens.length > 0 && (
                    <div style={{display:'flex', gap:6}}>
                        <span className="badge-status badge-verde">Match</span>
                        <span className="badge-status badge-amarelo">Sugerido</span>
                        <span className="badge-status badge-azul">Novo</span>
                    </div>
                )}
            </div>

            <ul className="itens-scroll">
              {itens.map((item, idx) => {
                // LÓGICA DO SEMÁFORO
                let rowClass = '';

                if (item.alertaDivergencia) rowClass = 'match-alerta';
                else if (item.statusMatch === 'MATCH_EXATO') rowClass = 'match-verde';
                else if (item.statusMatch === 'SUGESTAO_FORTE') rowClass = 'match-amarelo';
                else rowClass = 'match-novo';

                return (
                  <li key={idx} className={`item-row ${rowClass}`}>

                    {/* ÍCONE DE STATUS */}
                    <div style={{marginRight: 12}}>
                        {item.statusMatch === 'MATCH_EXATO' ? <Check size={20} color="#10b981"/> :
                         item.statusMatch === 'SUGESTAO_FORTE' ? <AlertTriangle size={20} color="#f59e0b"/> :
                         <Plus size={20} color="#3b82f6"/>}
                    </div>

                    {/* CONTEÚDO */}
                    <div className="item-info-col">
                      <span className="xml-desc">{item.descricao}</span>

                      <div className="system-desc">
                        {item.statusMatch === 'MATCH_EXATO' ? (
                            <>
                                <LinkIcon size={12}/>
                                <span>Vinculado a: <strong>{item.nomeProdutoSugerido || item.descricao}</strong></span>
                            </>
                        ) : item.statusMatch === 'SUGESTAO_FORTE' ? (
                            <>
                                <AlertTriangle size={12}/>
                                <span>Sugerido: <strong>{item.nomeProdutoSugerido}</strong>?</span>
                            </>
                        ) : (
                            <span>{item.ncm ? `NCM: ${item.ncm}` : 'Sem NCM'} • Cadastro Novo</span>
                        )}
                      </div>

                      {item.alertaDivergencia && (
                          <div className="divergencia-box">
                              <AlertTriangle size={12}/> Preço diverge &gt; 50%
                          </div>
                      )}

                      <small style={{color: '#64748b', marginTop: 2}}>
                        {item.quantidade} {item.unidade} x R$ {formatarMoeda(item.precoCusto)}
                      </small>
                    </div>

                    {/* AÇÕES E TOTAIS */}
                    <div className="item-total">
                      <strong>R$ {formatarMoeda(item.total)}</strong>

                      {item.statusMatch === 'SUGESTAO_FORTE' && (
                          <button className="btn-action-sm btn-accept" onClick={() => aceitarSugestao(idx)} title="Confirmar Vínculo">
                              <LinkIcon size={14}/> Vincular
                          </button>
                      )}

                      <button className="btn-trash" onClick={() => removerItem(idx)}>
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="resumo-footer">
            <div className="audit-info"><User size={14}/><span>Resp: <strong>{usuario.nome}</strong></span></div>
            <div className="total-block"><span>Total Nota</span><h2>R$ {formatarMoeda(totalGeral)}</h2></div>
            <button className="btn-finalizar" onClick={finalizarEntrada} disabled={loading}>{loading ? '...' : <><Save size={20}/> Confirmar Entrada</>}</button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EntradaEstoque;