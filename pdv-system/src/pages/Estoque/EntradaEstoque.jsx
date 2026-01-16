import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Truck, FileText, Calendar, Plus, Save,
  Search, Trash2, ArrowLeft, User, Barcode,
  AlertCircle, DollarSign
} from 'lucide-react';
import './EntradaEstoque.css'; // Vamos criar o CSS abaixo

const EntradaEstoque = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  // --- ESTADOS DO CABEÇALHO (AUDITORIA) ---
  const [cabecalho, setCabecalho] = useState({
    fornecedorId: '',
    tipoEntrada: 'NOTA_FISCAL', // NOTA_FISCAL ou RECIBO
    numeroDocumento: '',
    dataEmissao: new Date().toISOString().split('T')[0],
    observacao: ''
  });

  const [fornecedores, setFornecedores] = useState([]);

  // --- ESTADOS DOS ITENS ---
  const [itens, setItens] = useState([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);

  // Dados temporários do item sendo adicionado
  const [qtdItem, setQtdItem] = useState(1);
  const [custoItem, setCustoItem] = useState('');

  // Carrega fornecedores ao abrir
  useEffect(() => {
    carregarFornecedores();
  }, []);

  const carregarFornecedores = async () => {
    try {
      const res = await api.get('/fornecedores'); // Certifique-se de ter esse endpoint
      setFornecedores(res.data.content || res.data);
    } catch (e) {
      // Mock para teste visual caso não tenha backend de fornecedores ainda
      setFornecedores([
        { id: 1, razaoSocial: 'Natura Cosméticos S.A.' },
        { id: 2, razaoSocial: 'Distribuidora Beleza Total' },
        { id: 3, razaoSocial: 'Avon Brasil' }
      ]);
    }
  };

  const handleBuscaProduto = async (e) => {
    if (e.key === 'Enter') {
      try {
        // Busca por EAN ou Nome
        const res = await api.get(`/produtos?termo=${termoBusca}`);
        const lista = res.data.content || [];

        if (lista.length === 1) {
          selecionarProduto(lista[0]);
        } else if (lista.length > 1) {
          toast.info("Vários produtos encontrados. Refine a busca.");
        } else {
          toast.warning("Produto não encontrado.");
        }
      } catch (err) { toast.error("Erro ao buscar produto."); }
    }
  };

  const selecionarProduto = (prod) => {
    setProdutoSelecionado(prod);
    setCustoItem(formatarMoeda(prod.precoCusto)); // Sugere o último custo
    setQtdItem(1);
    // Foca no campo de quantidade
    setTimeout(() => document.getElementById('input-qtd').focus(), 100);
  };

  const adicionarItem = () => {
    if (!produtoSelecionado) return;

    const custoFloat = parseMoeda(custoItem);
    if (custoFloat <= 0) {
      return toast.warning("Informe o custo unitário (Valor da Nota).");
    }

    const novoItem = {
      idProduto: produtoSelecionado.id,
      codigoBarras: produtoSelecionado.codigoBarras,
      descricao: produtoSelecionado.descricao,
      quantidade: Number(qtdItem),
      precoCusto: custoFloat,
      total: Number(qtdItem) * custoFloat
    };

    setItens([...itens, novoItem]);

    // Limpa seleção para próximo item
    setProdutoSelecionado(null);
    setTermoBusca('');
    setQtdItem(1);
    setCustoItem('');
    searchInputRef.current.focus();
  };

  const removerItem = (index) => {
    const novaLista = [...itens];
    novaLista.splice(index, 1);
    setItens(novaLista);
  };

  const finalizarEntrada = async () => {
    if (!cabecalho.fornecedorId) return toast.warning("Selecione o Fornecedor.");
    if (itens.length === 0) return toast.warning("Adicione pelo menos um produto.");

    try {
      // Envia item a item (ou em lote, dependendo do seu Backend)
      // Aqui vamos simular o envio em lote para o EstoqueService
      for (const item of itens) {
        const payload = {
          codigoBarras: item.codigoBarras,
          quantidade: item.quantidade,
          precoCusto: item.precoCusto,
          numeroNotaFiscal: cabecalho.tipoEntrada === 'NOTA_FISCAL' ? cabecalho.numeroDocumento : null,
          fornecedorId: cabecalho.fornecedorId, // Envia ID do fornecedor para auditoria
          observacao: cabecalho.observacao || `Entrada Manual (${cabecalho.tipoEntrada})`,
          tipoDocumento: cabecalho.tipoEntrada // Passa se é Recibo ou Nota
        };

        await api.post('/produtos/estoque', null, { params: payload });
      }

      toast.success("Estoque atualizado com sucesso!");
      navigate('/produtos');
    } catch (e) {
      toast.error("Erro ao processar entrada.");
      console.error(e);
    }
  };

  // Helpers de Moeda (Iguais ao Form)
  const parseMoeda = (v) => v ? parseFloat(v.toString().replace(/\./g, '').replace(',', '.')) : 0;
  const formatarMoeda = (v) => v ? Number(v).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '';
  const mascaraMoeda = (v) => {
    const n = v.replace(/\D/g, "");
    return n ? (Number(n)/100).toLocaleString('pt-BR', {minimumFractionDigits: 2}) : "";
  };

  const totalGeral = itens.reduce((acc, item) => acc + item.total, 0);

  return (
    <div className="container-fluid">
      <div className="page-header">
        <div className="page-title">
          <h1>Nova Entrada de Mercadoria</h1>
          <p>Registro auditável de compras e ajustes de estoque</p>
        </div>
        <button className="btn-secondary" onClick={() => navigate('/produtos')}>
          <ArrowLeft size={18} /> Voltar
        </button>
      </div>

      <div className="entrada-layout">

        {/* PAINEL ESQUERDO: CABEÇALHO E PRODUTOS */}
        <div className="painel-principal">

          {/* 1. DADOS DA ORIGEM (AUDITORIA) */}
          <div className="card-entrada">
            <h3 className="card-title"><FileText size={18}/> Dados do Documento</h3>
            <div className="form-row">
              <div className="form-group flex-2">
                <label>Fornecedor *</label>
                <select
                  value={cabecalho.fornecedorId}
                  onChange={(e) => setCabecalho({...cabecalho, fornecedorId: e.target.value})}
                  className={!cabecalho.fornecedorId ? 'input-warning' : ''}
                >
                  <option value="">Selecione o Fornecedor...</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>{f.razaoSocial}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo Doc.</label>
                <select
                  value={cabecalho.tipoEntrada}
                  onChange={(e) => setCabecalho({...cabecalho, tipoEntrada: e.target.value})}
                >
                  <option value="NOTA_FISCAL">Nota Fiscal (NF-e)</option>
                  <option value="RECIBO">Recibo / Pedido</option>
                  <option value="AJUSTE">Ajuste Manual</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Nº Documento</label>
                <input
                  type="text"
                  placeholder={cabecalho.tipoEntrada === 'NOTA_FISCAL' ? "Ex: 12345" : "Opcional"}
                  value={cabecalho.numeroDocumento}
                  onChange={(e) => setCabecalho({...cabecalho, numeroDocumento: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Data Emissão</label>
                <input
                  type="date"
                  value={cabecalho.dataEmissao}
                  onChange={(e) => setCabecalho({...cabecalho, dataEmissao: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* 2. INSERÇÃO DE ITENS */}
          <div className="card-entrada destaque">
            <h3 className="card-title"><Barcode size={18}/> Adicionar Produtos</h3>

            <div className="search-box-entrada">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Bipe o código de barras ou digite o nome e tecle Enter..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={handleBuscaProduto}
                disabled={!!produtoSelecionado}
              />
              <button className="btn-search-icon"><Search size={18}/></button>
            </div>

            {produtoSelecionado && (
              <div className="item-editor">
                <div className="produto-info">
                  <span className="prod-nome">{produtoSelecionado.descricao}</span>
                  <span className="prod-ean">{produtoSelecionado.codigoBarras}</span>
                </div>

                <div className="inputs-valores">
                  <div className="form-group">
                    <label>Quantidade</label>
                    <input
                      id="input-qtd"
                      type="number"
                      min="1"
                      value={qtdItem}
                      onChange={(e) => setQtdItem(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Custo Unit. (R$)</label>
                    <input
                      type="text"
                      value={custoItem}
                      onChange={(e) => setCustoItem(mascaraMoeda(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Total Item</label>
                    <input
                      type="text"
                      disabled
                      value={formatarMoeda(qtdItem * parseMoeda(custoItem))}
                      style={{backgroundColor: '#e0e7ff', fontWeight: 'bold'}}
                    />
                  </div>
                  <button className="btn-add-item" onClick={adicionarItem}>
                    <Plus size={18}/> Adicionar
                  </button>
                  <button className="btn-cancel-item" onClick={() => {
                    setProdutoSelecionado(null);
                    setTermoBusca('');
                  }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* PAINEL DIREITO: LISTA E TOTAIS */}
        <div className="painel-resumo">
          <div className="lista-itens">
            <h3>Itens Lançados ({itens.length})</h3>
            {itens.length === 0 ? (
              <div className="empty-state">
                <Truck size={40} color="#cbd5e1"/>
                <p>Nenhum item adicionado.</p>
              </div>
            ) : (
              <ul>
                {itens.map((item, idx) => (
                  <li key={idx} className="item-row">
                    <div className="item-desc">
                      <strong>{item.descricao}</strong>
                      <small>{item.codigoBarras}</small>
                    </div>
                    <div className="item-values">
                      <span>{item.quantidade} x R$ {formatarMoeda(item.precoCusto)}</span>
                      <strong>R$ {formatarMoeda(item.total)}</strong>
                    </div>
                    <button className="btn-trash" onClick={() => removerItem(idx)}>
                      <Trash2 size={16}/>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="resumo-footer">
            <div className="total-geral">
              <span>Total da Nota</span>
              <h2>R$ {formatarMoeda(totalGeral)}</h2>
            </div>

            <div className="audit-info">
              <User size={14}/>
              <span>Registrado por: <strong>Usuário Logado</strong></span>
            </div>

            <button className="btn-finalizar" onClick={finalizarEntrada}>
              <Save size={20}/> Confirmar Entrada
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EntradaEstoque;