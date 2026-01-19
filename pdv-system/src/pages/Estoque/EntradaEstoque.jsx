import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Truck, Save, Plus, Search, Trash2, ArrowLeft, Package, Check,
  AlertTriangle, Link as LinkIcon, Loader, Barcode, UploadCloud, X,
  ShoppingCart, FileText, Calendar // <--- ADICIONADO AQUI
} from 'lucide-react';

import FornecedorForm from '../Fornecedores/FornecedorForm';
import './EntradaEstoque.css';

const EntradaEstoque = () => {
  const navigate = useNavigate();

  // --- ESTADOS ---
  const [loading, setLoading] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);

  const [listaFornecedores, setListaFornecedores] = useState([]);
  const [itens, setItens] = useState([]);
  const [cabecalho, setCabecalho] = useState({
    fornecedorId: '',
    numeroDocumento: '',
    dataEmissao: new Date().toISOString().split('T')[0]
  });

  // Modais
  const [showModalFornecedor, setShowModalFornecedor] = useState(false);
  const [showModalProduto, setShowModalProduto] = useState(false);

  // Form Produto Rápido
  const [novoProduto, setNovoProduto] = useState({ codigoBarras: '', descricao: '', precoCusto: '', ncm: '', unidade: 'UN' });

  // Busca e Inserção
  const [termoBusca, setTermoBusca] = useState('');
  const [sugestoes, setSugestoes] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [qtdItem, setQtdItem] = useState(1);
  const [custoItem, setCustoItem] = useState('');

  const fileInputRef = useRef(null);
  const qtdInputRef = useRef(null);

  // --- INICIALIZAÇÃO ---
  useEffect(() => {
    carregarFornecedores();
  }, []);

  const carregarFornecedores = async () => {
    try {
      const res = await api.get('/fornecedores/dropdown').catch(async () => await api.get('/fornecedores?size=100'));
      setListaFornecedores(Array.isArray(res.data) ? res.data : (res.data.content || []));
    } catch (e) {
        toast.error("Não foi possível carregar a lista de fornecedores.");
    }
  };

  // --- BUSCA PRODUTO ---
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

  // --- HELPER: INTELIGÊNCIA PARA XML ---
  const inferirMarcaPeloFornecedor = (nomeFornecedor) => {
      if (!nomeFornecedor) return "GENERICA";
      const nomeUpper = nomeFornecedor.toUpperCase();
      if (nomeUpper.includes("EUDORA")) return "EUDORA";
      if (nomeUpper.includes("BOTICARIO")) return "BOTICARIO";
      if (nomeUpper.includes("NATURA")) return "NATURA";
      if (nomeUpper.includes("AVON")) return "AVON";
      return "GENERICA";
  };

  const inferirCategoriaPorNCM = (ncm) => {
      if (!ncm) return "GERAL";
      const prefixo = ncm.replace(/\./g, '').substring(0, 4);
      const mapa = {
          '3303': 'PERFUMARIA', '3304': 'MAQUIAGEM', '3305': 'CAPILAR',
          '3307': 'CORPO E BANHO', '3401': 'CORPO E BANHO'
      };
      return mapa[prefixo] || "GERAL";
  };

  // --- CALLBACKS DOS MODAIS ---
  const handleFornecedorCriado = (fornecedorCriado) => {
      setListaFornecedores(prev => [...prev, fornecedorCriado]);
      setCabecalho(prev => ({ ...prev, fornecedorId: fornecedorCriado.id }));
      setShowModalFornecedor(false);
  };

  const salvarNovoProduto = async () => {
     if(!novoProduto.descricao || !novoProduto.precoCusto) {
         toast.warn("Preencha descrição e preço de custo.");
         return;
     }
     setLoadingModal(true);
     try {
         const payload = {
             ...novoProduto,
             precoCusto: parseFloat(novoProduto.precoCusto.replace(',', '.')),
             origem: '0', cst: '102', marca: 'GENERICA', categoria: 'GERAL'
         };
         const res = await api.post('/produtos', payload);
         selecionarProduto(res.data);
         setShowModalProduto(false);
         setNovoProduto({ codigoBarras: '', descricao: '', precoCusto: '', ncm: '', unidade: 'UN' });
         toast.success("Produto criado! Informe a quantidade para adicionar.");
     } catch (e) {
         toast.error("Erro ao cadastrar produto.");
     } finally {
         setLoadingModal(false);
     }
  };

  // --- LÓGICA PRINCIPAL ---
  const selecionarProduto = (prod) => {
    setProdutoSelecionado(prod);
    setTermoBusca(prod.descricao);
    setSugestoes([]);
    setCustoItem(prod.precoCusto ? prod.precoCusto.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '');
    setQtdItem(1);
    setTimeout(() => qtdInputRef.current?.focus(), 100);
  };

  const adicionarItem = () => {
    if (!produtoSelecionado) return;
    const custo = parseFloat(custoItem.replace(/\./g, '').replace(',', '.'));

    setItens([...itens, {
        idProduto: produtoSelecionado.id,
        descricao: produtoSelecionado.descricao,
        codigoBarras: produtoSelecionado.codigoBarras,
        quantidade: Number(qtdItem),
        precoCusto: custo,
        total: Number(qtdItem) * custo,
        // Campos fiscais padrão
        origem: '0', cst: '102', marca: produtoSelecionado.marca || 'GENERICA', categoria: produtoSelecionado.categoria || 'GERAL'
    }]);

    setProdutoSelecionado(null);
    setTermoBusca('');
    setQtdItem(1);
    setCustoItem('');
  };

  const removerItem = (idx) => setItens(itens.filter((_, i) => i !== idx));

  // --- IMPORTAÇÃO XML (RESTAURADA E INTELIGENTE) ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("arquivo", file);
    setLoading(true);
    const toastId = toast.loading("Processando XML...");

    try {
       const res = await api.post('/estoque/importar-xml', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
       const { fornecedorId, razaoSocialFornecedor, numeroNota, itensXml, dataEmissao } = res.data;

       setCabecalho(prev => ({
         ...prev,
         fornecedorId: fornecedorId || prev.fornecedorId,
         numeroDocumento: numeroNota || prev.numeroDocumento,
         dataEmissao: dataEmissao || prev.dataEmissao
       }));

       // Se o fornecedor veio do XML e não estava na lista, adiciona visualmente
       if (fornecedorId && razaoSocialFornecedor) {
           setListaFornecedores(prev => {
               if (!prev.find(f => f.id === fornecedorId)) {
                   return [...prev, { id: fornecedorId, razaoSocial: razaoSocialFornecedor, nomeFantasia: razaoSocialFornecedor }];
               }
               return prev;
           });
       }

       const marcaSugerida = inferirMarcaPeloFornecedor(razaoSocialFornecedor);

       // Converte itens do XML para o formato da tela
       const novosItens = itensXml.map(xmlItem => ({
           idProduto: xmlItem.idProduto, // Pode ser null se for produto novo
           descricao: xmlItem.descricao,
           codigoBarras: xmlItem.codigoBarras,
           quantidade: Number(xmlItem.quantidade),
           precoCusto: Number(xmlItem.precoCusto),
           total: Number(xmlItem.total),

           // Inteligência: Tenta preencher campos se for novo
           marca: marcaSugerida,
           categoria: inferirCategoriaPorNCM(xmlItem.ncm),
           origem: '0',
           cst: '102'
       }));

       setItens(prev => [...prev, ...novosItens]);
       toast.update(toastId, { render: "XML Importado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });

    } catch (error) {
       const msg = error.response?.data?.message || "Erro ao ler XML";
       toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 4000 });
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  const finalizarEntrada = async (e) => {
    if(e) e.preventDefault();
    if (!cabecalho.fornecedorId) return toast.warn("Atenção: Selecione o Fornecedor antes de finalizar.");
    if (itens.length === 0) return toast.warn("A nota está vazia. Adicione produtos.");

    const payload = {
        fornecedorId: cabecalho.fornecedorId,
        numeroDocumento: cabecalho.numeroDocumento || "MANUAL",
        dataVencimento: cabecalho.dataEmissao, // Usa data emissão como base se não tiver boleto
        itens: itens.map(i => ({
            produtoId: i.idProduto,
            codigoBarras: i.codigoBarras || "SEM GTIN",
            descricao: i.descricao, // Envia descrição caso seja produto novo
            quantidade: i.quantidade,
            valorUnitario: i.precoCusto,
            origem: i.origem,
            cst: i.cst,
            marca: i.marca,
            categoria: i.categoria,
            ncm: i.ncm || "00000000",
            unidade: "UN"
        }))
    };

    setLoading(true);
    try {
        await api.post('/estoque/entrada', payload);
        toast.success("Entrada registrada com sucesso!");
        navigate('/estoque');
    } catch(e) {
        toast.error("Falha ao registrar entrada. Tente novamente.");
    } finally { setLoading(false); }
  };

  const totalGeral = itens.reduce((a, b) => a + b.total, 0);

  return (
    <div className="entrada-container">

      {/* HEADER */}
      <div className="page-header">
        <div className="page-title">
            <h1>Entrada de Mercadoria</h1>
            <p>Gerencie o estoque registrando compras e notas fiscais</p>
        </div>
        <div style={{display:'flex', gap:12}}>
            {/* TOOLTIP: VOLTAR */}
            <button className="btn-std btn-secondary" onClick={() => navigate('/produtos')} data-tooltip="Voltar para lista de produtos">
                <ArrowLeft size={18}/> Voltar
            </button>

            {/* TOOLTIP: XML */}
            <button className="btn-std btn-secondary" onClick={() => fileInputRef.current.click()} data-tooltip="Carregar arquivo XML da Nota Fiscal">
                <UploadCloud size={18}/> Importar XML
            </button>
            <input type="file" style={{display:'none'}} ref={fileInputRef} onChange={handleFileChange} />
        </div>
      </div>

      {/* BLOCO 1: DADOS DA NOTA */}
      <div className="bloco-entrada">
        <div className="titulo-sessao"><FileText size={16}/> Dados da Nota Fiscal</div>
        <div className="form-grid">

            <div className="col-6">
                <label>Fornecedor</label>
                <div className="input-group">
                    <select
                        value={cabecalho.fornecedorId}
                        onChange={e => setCabecalho({...cabecalho, fornecedorId: e.target.value})}
                    >
                        <option value="">Selecione o Fornecedor...</option>
                        {listaFornecedores.map(f => (
                            <option key={f.id} value={f.id}>{f.razaoSocial || f.nomeFantasia}</option>
                        ))}
                    </select>
                    {/* TOOLTIP: NOVO FORNECEDOR */}
                    <button className="btn-addon" onClick={() => setShowModalFornecedor(true)} data-tooltip="Cadastrar novo fornecedor">
                        <Plus size={18}/>
                    </button>
                </div>
            </div>

            <div className="col-3">
                <label>Nº Documento</label>
                <input
                    placeholder="000.000"
                    value={cabecalho.numeroDocumento}
                    onChange={e => setCabecalho({...cabecalho, numeroDocumento: e.target.value})}
                />
            </div>

            <div className="col-3">
                <label>Data Emissão</label>
                {/* WRAPPER COM TOOLTIP E CALENDÁRIO CUSTOMIZADO */}
                <div className="date-input-wrapper" data-tooltip="Clique para selecionar a data no calendário">
                    <input
                        type="date"
                        value={cabecalho.dataEmissao}
                        onChange={e => setCabecalho({...cabecalho, dataEmissao: e.target.value})}
                    />
                    {/* ÍCONE VISUAL (LUCIDE) AGORA IMPORTADO CORRETAMENTE */}
                    <Calendar size={18} className="icon-calendar"/>
                </div>
            </div>

        </div>
      </div>

      {/* BLOCO 2: INSERÇÃO DE ITEM */}
      <div className="bloco-entrada" style={{borderLeft: '4px solid #6366f1'}}>
         <div className="titulo-sessao" style={{color:'#6366f1'}}><Package size={16}/> Adicionar Produto</div>
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
                     {/* TOOLTIP: NOVO PRODUTO */}
                     <button className="btn-addon" onClick={() => setShowModalProduto(true)} data-tooltip="Cadastrar produto rápido">
                        <Plus size={18}/>
                     </button>
                 </div>

                 {sugestoes.length > 0 && !produtoSelecionado && (
                     <div className="dropdown-busca">
                         {sugestoes.map(s => (
                             <div key={s.id} className="item-busca" onClick={() => selecionarProduto(s)}>
                                 <span>{s.descricao}</span>
                                 <strong>R$ {s.precoVenda?.toFixed(2)}</strong>
                             </div>
                         ))}
                     </div>
                 )}
             </div>

             <div className="col-2">
                 <label>Quantidade</label>
                 <input
                    type="number"
                    ref={qtdInputRef}
                    value={qtdItem}
                    onChange={e => setQtdItem(e.target.value)}
                    min="1"
                 />
             </div>

             <div className="col-2">
                 <label>Custo Unit. (R$)</label>
                 <input
                    value={custoItem}
                    onChange={e => setCustoItem(e.target.value)}
                    placeholder="0,00"
                 />
             </div>

             <div className="col-2">
                 <button
                    className="btn-std btn-success"
                    style={{width:'100%'}}
                    onClick={adicionarItem}
                    disabled={!produtoSelecionado}
                    data-tooltip="Adicionar item à lista abaixo"
                 >
                     <Plus size={18}/> Incluir
                 </button>
             </div>

         </div>
      </div>

      {/* BLOCO 3: LISTA DE ITENS */}
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
                          <th style={{paddingLeft: 24}}>Descrição do Produto</th>
                          <th>Quantidade</th>
                          <th>Valor Unitário</th>
                          <th>Subtotal</th>
                          <th width="50"></th>
                      </tr>
                  </thead>
                  <tbody>
                      {itens.length === 0 ? (
                          <tr>
                              <td colSpan="5">
                                  <div className="empty-state">
                                      <Package size={48} strokeWidth={1}/>
                                      <h3>Sua nota está vazia</h3>
                                      <p>Utilize a busca acima para adicionar produtos ou importe um XML.</p>
                                  </div>
                              </td>
                          </tr>
                      ) : (
                          itens.map((item, idx) => (
                              <tr key={idx}>
                                  <td style={{paddingLeft: 24}}>
                                      <strong style={{color:'#1e293b'}}>{item.descricao}</strong>
                                      <div style={{fontSize:'0.8rem', color:'#64748b'}}>{item.codigoBarras}</div>
                                  </td>
                                  <td>{item.quantidade}</td>
                                  <td>R$ {item.precoCusto.toFixed(2)}</td>
                                  <td style={{color:'#4f46e5', fontWeight:700}}>R$ {item.total.toFixed(2)}</td>
                                  <td align="center">
                                      {/* TOOLTIP: REMOVER */}
                                      <button className="btn-icon-danger" onClick={() => removerItem(idx)} data-tooltip="Remover este item">
                                          <Trash2 size={18}/>
                                      </button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>

          <div className="footer-resumo" style={{margin:'0 24px 24px 24px'}}>
               <div>
                   <span className="total-label">VALOR TOTAL DA NOTA</span>
                   <span className="total-value">R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
               </div>
               {/* TOOLTIP: FINALIZAR */}
               <button
                  className="btn-std btn-primary"
                  style={{height: 56, fontSize: '1.1rem', padding: '0 40px'}}
                  onClick={finalizarEntrada}
                  disabled={loading || itens.length === 0}
                  data-tooltip="Salvar entrada e atualizar estoque"
               >
                   {loading ? <Loader className="animate-spin"/> : <Save size={20}/>}
                   Confirmar Entrada
               </button>
          </div>

      </div>

      {/* MODAL FORNECEDOR (REUTILIZÁVEL) */}
      {showModalFornecedor && (
          <div className="modal-overlay">
              <div className="modal-card" style={{ maxWidth: '800px', padding: '0' }}>
                  <div className="modal-header" style={{ padding: '20px 20px 0 20px' }}>
                      <h3>Novo Fornecedor</h3>
                      <button onClick={() => setShowModalFornecedor(false)}><X size={20}/></button>
                  </div>
                  <div style={{ padding: '20px' }}>
                      <FornecedorForm
                          isModal={true}
                          onSuccess={handleFornecedorCriado}
                      />
                  </div>
              </div>
          </div>
      )}

      {/* MODAL PRODUTO RÁPIDO */}
      {showModalProduto && (
          <div className="modal-overlay">
              <div className="modal-card">
                  <div className="modal-header">
                      <h3>Novo Produto Rápido</h3>
                      <button onClick={() => setShowModalProduto(false)}><X size={20}/></button>
                  </div>
                  <div className="form-grid">
                      <div className="col-12">
                          <label>Código de Barras (EAN)</label>
                          <input value={novoProduto.codigoBarras} onChange={e => setNovoProduto({...novoProduto, codigoBarras: e.target.value})} autoFocus />
                      </div>
                      <div className="col-12">
                          <label>Descrição Completa</label>
                          <input value={novoProduto.descricao} onChange={e => setNovoProduto({...novoProduto, descricao: e.target.value})} />
                      </div>
                      <div className="col-6">
                          <label>Custo (R$)</label>
                          <input value={novoProduto.precoCusto} onChange={e => setNovoProduto({...novoProduto, precoCusto: e.target.value})} placeholder="0,00" />
                      </div>
                      <div className="col-6">
                          <label>NCM</label>
                          <input value={novoProduto.ncm} onChange={e => setNovoProduto({...novoProduto, ncm: e.target.value})} placeholder="0000.00.00" />
                      </div>
                  </div>
                  <div className="modal-actions">
                      <button className="btn-std btn-secondary" onClick={() => setShowModalProduto(false)}>Cancelar</button>
                      <button className="btn-std btn-primary" onClick={salvarNovoProduto} disabled={loadingModal}>Criar Produto</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default EntradaEstoque;