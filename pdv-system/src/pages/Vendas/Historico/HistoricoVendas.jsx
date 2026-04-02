import React, { useState, useEffect } from 'react';
import { Search, Eye, X, FileText, Package, CreditCard, ChevronLeft, ChevronRight, User, Hash, Printer, MessageCircle } from 'lucide-react';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import './HistoricoVendas.css';

const mascaraTelefone = (v) => {
    if (!v) return ''; let val = v.replace(/\D/g, '');
    if (val.length <= 10) return val.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return val.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
};

const getBackendUrl = () => api.defaults.baseURL ? api.defaults.baseURL.split('/api')[0] : "";

const HistoricoVendas = () => {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [configLoja, setConfigLoja] = useState(null);

  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 50;

  const [modalOpen, setModalOpen] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Estados para o Modal do WhatsApp
  const [showZapModal, setShowZapModal] = useState(false);
  const [zapNumber, setZapNumber] = useState('');

  useEffect(() => {
    carregarVendas();
    api.get('/configuracoes').then(res => setConfigLoja(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca]);

  const carregarVendas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vendas?size=1000&sort=dataVenda,desc');
      const dados = response.data.content || response.data || [];
      setVendas(dados);
    } catch (error) {
      setVendas([]);
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalhes = async (venda, e) => {
    e.preventDefault();
    e.stopPropagation();

    setVendaSelecionada(venda);
    setModalOpen(true);

    if (!venda.itens || venda.itens.length === 0) {
        setLoadingDetalhes(true);
        try {
            const idReal = venda.idVenda || venda.id;
            const res = await api.get(`/vendas/${idReal}`);
            setVendaSelecionada(res.data);
        } catch (err) {} finally { setLoadingDetalhes(false); }
    }
  };

  const fecharModal = () => {
    setModalOpen(false);
    setTimeout(() => setVendaSelecionada(null), 200);
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const imprimirCupomFrontend = (vendaBase) => {
          const dataVenda = new Date(vendaBase?.dataVenda || new Date());
          const idVenda = vendaBase?.idVenda || vendaBase?.id || '0000';
          const numNfce = vendaBase?.numeroNfce || idVenda;
          const serieNfce = vendaBase?.serieNfce || configLoja?.fiscal?.serieProducao || '1';

          // 🚨 CORREÇÃO DA CHAVE: Tenta buscar em várias propriedades do banco
          const chaveAcessoRaw = vendaBase?.chaveAcessoNfce || vendaBase?.chaveAcesso || vendaBase?.chaveNfce || vendaBase?.chave || '00000000000000000000000000000000000000000000';
          const chaveAcessoFormatada = chaveAcessoRaw !== '00000000000000000000000000000000000000000000'
               ? chaveAcessoRaw.replace(/(\d{4})/g, '$1 ').trim()
               : 'Aguardando Emissão SEFAZ';

          const protocolo = vendaBase?.protocolo || 'N/A';

          const loja = configLoja?.loja || {};
          const end = configLoja?.endereco || {};
          const sys = configLoja?.sistema || {};

          const razaoSocial = loja.razaoSocial || 'DD COSMÉTICOS';
          const cnpj = loja.cnpj ? loja.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '00.000.000/0000-00';
          const ie = loja.ie || 'ISENTO';
          const enderecoCompleto = `${end.logradouro || 'Rua'}, ${end.numero || 'S/N'} - ${end.bairro || 'Centro'}, ${end.cidade || 'Cidade'}-${end.uf || 'UF'}`;

          let logoHTML = '';
          if (sys.imprimirLogoCupom && loja.logoUrl) {
              const rawUrl = loja.logoUrl;
              const logoSrc = rawUrl.startsWith('http') || rawUrl.startsWith('data:image') ? rawUrl : `${getBackendUrl()}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
              logoHTML = `<div class="center"><img src="${logoSrc}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;" /></div>`;
          }

          const isHomologacao = configLoja?.fiscal?.ambiente === 'HOMOLOGACAO';
          const watermark = isHomologacao ? `<div class="homologacao-watermark">AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL</div>` : '';

          const carrinhoLista = vendaBase.itens || [];
          const pagamentosLista = vendaBase.pagamentos || [];
          const subtotal = carrinhoLista.reduce((acc, item) => acc + ((item.precoUnitario || item.valorUnitario || item.preco || 0) * (item.quantidade || 1)), 0);
          const descontoTotal = vendaBase.descontoTotal || 0;
          const totalPagar = vendaBase.valorTotal || 0;
          const totalQuantidade = carrinhoLista.reduce((acc, item) => acc + (item.quantidade || 1), 0);
          const totalPago = pagamentosLista.reduce((acc, p) => acc + (p.valor || 0), 0);
          const troco = Math.max(0, totalPago - totalPagar);

          // 🚨 CORREÇÃO DO PRODUTO: Busca em profundidade o nome real do produto
          const itensHTML = carrinhoLista.map((i, index) => {
              const desc = i.nomeProduto || i.nome || i.produtoNome || i.descricao || i.produto?.nome || i.produto?.descricao || `Produto #${i.produtoId || i.produto?.id || 'Sem Nome'}`;
              const cod = i.codigoBarras || i.ean || i.produto?.codigoBarras || i.produto?.ean || 'S/N';
              const unit = i.precoUnitario || i.valorUnitario || i.preco || 0;
              const q = i.quantidade || 1;
              return `
              <tr><td colspan="4" class="item-desc">${String(index + 1).padStart(3, '0')} ${cod} ${desc}</td></tr>
              <tr><td class="item-det">${q} UN X R$ ${unit.toFixed(2)}</td><td class="right item-det">R$ ${(q * unit).toFixed(2)}</td></tr>
          `}).join('');

          const pagamentosHTML = pagamentosLista.map(p => `<tr><td>${p.formaPagamento || p.tipo}</td><td class="right">R$ ${(p.valor).toFixed(2)}</td></tr>`).join('');

          const docCliente = vendaBase.clienteDocumento ? `CPF/CNPJ: ${vendaBase.clienteDocumento}` : 'CONSUMIDOR NÃO IDENTIFICADO';
          const nomeCliente = vendaBase.clienteNome ? `Nome: ${vendaBase.clienteNome}` : '';
          const impostoMes = (vendaBase.valorTotal || 0) * 0.04;

          const html = `
            <html>
            <head>
              <title>DANFE NFC-e #${idVenda}</title>
              <style>
                @page { margin: 0; size: 80mm auto; }
                body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 80mm; margin: 0; padding: 4mm; color: #000; background: #fff;}
                h2, h3, h4 { text-align: center; margin: 2px 0; font-size: 12px;}
                table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 5px;}
                th, td { padding: 2px 0; }
                .border-top { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;}
                .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 5px; padding-bottom: 5px;}
                .right { text-align: right; } .center { text-align: center; } .bold { font-weight: bold; }
                .item-desc { font-size: 10px; } .item-det { font-size: 10px; padding-left: 15px;}
                .chave { font-size: 9px; word-break: break-all; text-align: center; letter-spacing: 1px; margin: 10px 0;}
                .homologacao-watermark { text-align: center; font-size: 14px; font-weight: bold; padding: 10px; border: 2px dashed #000; margin: 10px 0; text-transform: uppercase; }
                .msg-rodape { text-align: center; font-size: 10px; margin-top: 15px;}
              </style>
            </head>
            <body onload="window.print(); setTimeout(()=>window.close(), 500);">
               ${logoHTML}
               <div class="center bold">${razaoSocial}</div>
               <div class="center">CNPJ: ${cnpj} IE: ${ie}</div>
               <div class="center">${enderecoCompleto}</div>
               <div class="border-top border-bottom center bold">
                 DANFE NFC-e - Documento Auxiliar da Nota Fiscal<br>de Consumidor Eletrônica
               </div>
               <div class="center" style="font-size: 9px; margin-bottom: 5px;">Não permite aproveitamento de crédito de ICMS</div>
               ${watermark}
               <table class="border-bottom">
                 <tr><th class="left">CÓDIGO DESCRIÇÃO</th></tr>
                 <tr><th class="left" style="padding-left:15px;">QTD UN X VL UNIT (R$)</th><th class="right">VL TOTAL (R$)</th></tr>
                 ${itensHTML}
               </table>
               <table>
                 <tr><td>QTD. TOTAL DE ITENS</td><td class="right">${totalQuantidade}</td></tr>
                 <tr><td>VALOR TOTAL R$</td><td class="right">${subtotal.toFixed(2)}</td></tr>
                 ${descontoTotal > 0 ? `<tr><td>DESCONTOS R$</td><td class="right">- ${descontoTotal.toFixed(2)}</td></tr>` : ''}
                 <tr><td class="bold" style="font-size: 12px;">VALOR A PAGAR R$</td><td class="right bold" style="font-size: 12px;">${totalPagar.toFixed(2)}</td></tr>
                 <tr><td colspan="2">FORMA DE PAGAMENTO</td></tr>
                 ${pagamentosHTML}
                 <tr><td>TROCO R$</td><td class="right">${troco.toFixed(2)}</td></tr>
               </table>
               <div class="border-top border-bottom center">${docCliente}<br>${nomeCliente}</div>
               <div class="center bold mt-2">
                 NFC-e Nº ${numNfce} Série ${serieNfce} ${dataVenda.toLocaleDateString('pt-BR')} ${dataVenda.toLocaleTimeString('pt-BR')}
               </div>
               <div class="center" style="font-size: 9px; margin-top:5px;">Protocolo de Autorização: ${protocolo}</div>
               <div class="center mt-2" style="font-size: 10px;">Consulte pela Chave de Acesso em<br>http://nfce.sefaz.pe.gov.br/</div>
               <div class="chave">${chaveAcessoFormatada}</div>
               <div class="border-top msg-rodape">
                  Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ ${impostoMes.toFixed(2)}<br><br>
                  ${sys.rodape || 'Obrigado pela preferência! Volte sempre.'}
               </div>
            </body>
            </html>
          `;
          const printWindow = window.open('', '_blank', 'width=400,height=600'); printWindow.document.write(html); printWindow.document.close();
      };

    const enviarWhatsAppBodyCompleto = () => {
        if(!zapNumber || zapNumber.length < 10) return toast.warning("Digite um número válido com DDD.");

        const vendaBase = vendaSelecionada;
        const dataVenda = new Date(vendaBase?.dataVenda || new Date());
        const numNfce = vendaBase?.numeroNfce || vendaBase?.idVenda || vendaBase?.id || '0000';
        const serieNfce = vendaBase?.serieNfce || configLoja?.fiscal?.serieProducao || '1';

        const chaveAcessoRaw = vendaBase?.chaveAcesso || vendaBase?.chaveNfce || vendaBase?.chave || '00000000000000000000000000000000000000000000';
        const chaveAcessoFormatada = chaveAcessoRaw !== '00000000000000000000000000000000000000000000'
             ? chaveAcessoRaw.replace(/(\d{4})/g, '$1 ').trim()
             : 'Aguardando Emissão SEFAZ';

        const protocolo = vendaBase?.protocolo || 'N/A';

        const loja = configLoja?.loja || {};
        const sys = configLoja?.sistema || {};
        const razaoSocial = loja.razaoSocial || 'DD COSMÉTICOS';
        const cnpj = loja.cnpj ? loja.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '00.000.000/0000-00';

        const carrinhoLista = vendaBase.itens || [];
        const pagamentosLista = vendaBase.pagamentos || [];
        const subtotal = carrinhoLista.reduce((acc, item) => acc + ((item.precoUnitario || item.valorUnitario || item.preco || 0) * (item.quantidade || 1)), 0);
        const descontoTotal = vendaBase.descontoTotal || 0;
        const totalPagar = vendaBase.valorTotal || 0;
        const totalQuantidade = carrinhoLista.reduce((acc, item) => acc + (item.quantidade || 1), 0);
        const totalPago = pagamentosLista.reduce((acc, p) => acc + (p.valor || 0), 0);
        const troco = Math.max(0, totalPago - totalPagar);

        let listaItens = carrinhoLista.map((i, index) => {
            const desc = i.nomeProduto || i.nome || i.produtoNome || i.descricao || i.produto?.nome || i.produto?.descricao || `Produto #${i.produtoId || i.produto?.id || 'Sem Nome'}`;
            const cod = i.codigoBarras || i.ean || i.produto?.codigoBarras || i.produto?.ean || 'S/N';
            const unit = i.precoUnitario || i.valorUnitario || i.preco || 0;
            const q = i.quantidade || 1;
            return `▪️ ${String(index + 1).padStart(3, '0')} ${cod} ${desc}\n   ↳ ${q} UN x R$ ${unit.toFixed(2)} = R$ ${(q * unit).toFixed(2)}`;
        }).join('\n');

        const descontosStr = descontoTotal > 0 ? `\n*Descontos:* - R$ ${descontoTotal.toFixed(2)}` : '';
        let pagamentosStr = pagamentosLista.map(p => `▪️ ${p.formaPagamento || p.tipo}: R$ ${(p.valor || 0).toFixed(2)}`).join('\n');

        const docCliente = vendaBase.clienteDocumento ? `\nCPF/CNPJ: ${vendaBase.clienteDocumento}` : '\nCONSUMIDOR NÃO IDENTIFICADO';
        const nomeCliente = vendaBase.clienteNome ? `\nNome: ${vendaBase.clienteNome}` : '';
        const impostoMes = totalPagar * 0.04;
        const urlConsultaSefaz = 'http://nfce.sefaz.pe.gov.br/nfce/consulta';

        const isHomologacao = configLoja?.fiscal?.ambiente === 'HOMOLOGACAO';
        const alertaHomologacao = isHomologacao ? `\n\n⚠️ *AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL* ⚠️` : '';

        const texto = `*${razaoSocial}*\nCNPJ: ${cnpj}${alertaHomologacao}\n\n*DANFE NFC-e*\nDocumento Auxiliar da Nota Fiscal de Consumidor Eletrônica\n\n🛒 *RESUMO DOS ITENS:*\n${listaItens}\n\n*Qtd. Total de Itens:* ${totalQuantidade}\n*Subtotal:* R$ ${subtotal.toFixed(2)}${descontosStr}\n*VALOR A PAGAR:* R$ ${totalPagar.toFixed(2)}\n\n💳 *FORMA DE PAGAMENTO:*\n${pagamentosStr}\n*Troco:* R$ ${troco.toFixed(2)}\n------------------------${docCliente}${nomeCliente}\n\n*NFC-e Nº ${numNfce} Série ${serieNfce}*\n📅 ${dataVenda.toLocaleDateString('pt-BR')} às ${dataVenda.toLocaleTimeString('pt-BR')}\nProtocolo: ${protocolo}\n\n🔗 *Consulte pela Chave de Acesso em:*\n${urlConsultaSefaz}\n\n🔑 *Chave de Acesso:*\n${chaveAcessoFormatada}\n\n⚖️ Tributos Totais (Lei 12.741/2012): R$ ${impostoMes.toFixed(2)}\n\n💖 _${sys.rodape || 'Obrigado pela preferência! Volte sempre.'}_`;

        window.open(`https://api.whatsapp.com/send?phone=55${zapNumber.replace(/\D/g, '')}&text=${encodeURIComponent(texto)}`, '_blank');
        setShowZapModal(false);
    };

  const vendasFiltradas = vendas.filter(v =>
    (v.clienteNome || '').toLowerCase().includes(busca.toLowerCase()) ||
    String(v.id || v.idVenda).includes(busca)
  );

  const indexUltimo = paginaAtual * itensPorPagina;
  const indexPrimeiro = indexUltimo - itensPorPagina;
  const vendasPaginadas = vendasFiltradas.slice(indexPrimeiro, indexUltimo);
  const totalPaginas = Math.ceil(vendasFiltradas.length / itensPorPagina);

  return (
    <div className="hist-container">
      <div className="hist-header">
        <h2>Histórico de Vendas</h2>
        <div className="hist-search">
          <Search size={18} color="#94a3b8" />
          <input type="text" placeholder="Buscar por cliente ou cupom..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="hist-table-container">
        {loading ? (
          <div className="hist-loading"><div className="hist-spinner"></div> Carregando histórico...</div>
        ) : (
          <>
            <table className="hist-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data / Hora</th>
                  <th>Cliente</th>
                  <th>Status Fiscal</th>
                  <th>Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendasPaginadas.length > 0 ? (
                  vendasPaginadas.map((venda, index) => {
                    const statusReal = venda.statusNfce || venda.status || 'PENDENTE';
                    const isSucesso = statusReal === 'AUTORIZADA' || statusReal === 'CONCLUIDA';
                    const idReal = venda.idVenda || venda.id;

                    return (
                      <tr key={idReal || index}>
                        <td>#{idReal}</td>
                        <td>{venda.dataVenda ? new Date(venda.dataVenda).toLocaleString('pt-BR') : '-'}</td>
                        <td>{venda.clienteNome || 'Consumidor Final'}</td>
                        <td>
                          <span className={`hist-status-badge ${statusReal === 'CANCELADA' ? 'cancelada' : (isSucesso ? 'autorizada' : 'pendente')}`}>
                            {statusReal}
                          </span>
                        </td>
                        <td className="hist-fw-bold text-main">{formatCurrency(venda.valorTotal)}</td>
                        <td>
                          <button className="hist-btn-icon" onClick={(e) => abrirDetalhes(venda, e)} title="Ver Detalhes">
                            <Eye size={18} color="#3b82f6" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan="6" className="hist-text-center" style={{padding: '30px', color: '#94a3b8'}}>Nenhuma venda encontrada.</td></tr>
                )}
              </tbody>
            </table>

            {totalPaginas > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', padding: '15px' }}>
                <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                  Mostrando {indexPrimeiro + 1} a {Math.min(indexUltimo, vendasFiltradas.length)} de {vendasFiltradas.length}
                </span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))} disabled={paginaAtual === 1} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: paginaAtual === 1 ? '#f1f5f9' : 'white', cursor: paginaAtual === 1 ? 'not-allowed' : 'pointer' }}><ChevronLeft size={18} /></button>
                  <button onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))} disabled={paginaAtual === totalPaginas} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: paginaAtual === totalPaginas ? '#f1f5f9' : 'white', cursor: paginaAtual === totalPaginas ? 'not-allowed' : 'pointer' }}><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && vendaSelecionada && (
        <div className="hist-modal-overlay" onClick={fecharModal}>
          <div className="hist-modal-content" onClick={e => e.stopPropagation()}>
            <div className="hist-modal-header">
              <h3>Detalhes da Venda #{vendaSelecionada.idVenda || vendaSelecionada.id}</h3>
              <button className="hist-btn-close" onClick={fecharModal}><X size={20} /></button>
            </div>

            <div className="hist-modal-body">
              <div className="hist-modal-info-grid">
                <div className="hist-info-box">
                  <span className="label"><User size={14}/> Cliente</span>
                  <strong>{vendaSelecionada.clienteNome || 'Consumidor Final'}</strong>
                  {vendaSelecionada.clienteDocumento && <span className="text-small text-muted block mt-1">Doc: {vendaSelecionada.clienteDocumento}</span>}
                </div>
                <div className="hist-info-box">
                  <span className="label"><Hash size={14}/> Status Fiscal</span>
                  <strong className={vendaSelecionada.statusNfce === 'AUTORIZADA' ? 'text-success' : 'text-warning'}>
                      {vendaSelecionada.statusNfce || vendaSelecionada.status || 'PENDENTE'}
                  </strong>
                  {vendaSelecionada.chaveAcesso && (
                      <span className="text-small text-muted block mt-1" title="Chave SEFAZ" style={{fontSize:'10px', wordBreak: 'break-all'}}>
                         {vendaSelecionada.chaveAcesso}
                      </span>
                  )}
                </div>
                <div className="hist-info-box">
                  <span className="label">Vendedor(a)</span>
                  <strong>{vendaSelecionada.usuario ? vendaSelecionada.usuario.nome : (vendaSelecionada.nomeOperador || 'Sistema')}</strong>
                </div>
              </div>

              {loadingDetalhes ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}><div className="hist-spinner" style={{display: 'inline-block', marginBottom: '10px'}}></div><br/>Carregando cupom fiscal...</div>
              ) : (
                <>
                  <h4 className="mt-4 border-bottom pb-2"><Package size={16} className="mr-2 text-main"/> Produtos Adquiridos</h4>
                  <ul className="hist-modal-lista-itens mt-3">
                    {vendaSelecionada.itens && vendaSelecionada.itens.length > 0 ? (
                      vendaSelecionada.itens.map((item, idx) => {
                        const nomeProduto = item.nomeProduto || item.nome || item.produtoNome || item.descricao || item.produto?.nome || item.produto?.descricao || `Produto ID: ${item.produtoId || item.produto?.id || '?'}`;
                        const eanProduto = item.codigoBarras || item.ean || item.produto?.codigoBarras || item.produto?.ean || 'S/N';
                        const precoUnit = item.precoUnitario || item.valorUnitario || item.preco || 0;
                        const qtd = item.quantidade || 1;

                        return (
                          <li key={idx} className="hist-produto-detalhado">
                            <div className="hist-item-main-row flex-between">
                              <div className="hist-item-desc">
                                <span className="hist-item-qtd bg-gray-100 px-2 py-1 rounded text-sm font-bold">{qtd}x</span>
                                <span className="hist-item-nome ml-2 font-medium">{nomeProduto}</span>
                              </div>
                              <span className="hist-item-preco font-bold">{formatCurrency(precoUnit * qtd)}</span>
                            </div>
                            <div className="hist-item-sub-row flex-between text-muted text-sm mt-1">
                              <span className="hist-item-ean">EAN: {eanProduto}</span>
                              <span className="hist-item-unit">Unitário: {formatCurrency(precoUnit)}</span>
                            </div>
                          </li>
                        );
                      })
                    ) : (
                       <li style={{color: '#94a3b8', fontSize: '0.9rem', padding: '10px 0'}}>Nenhum item encontrado neste cupom.</li>
                    )}
                  </ul>

                  <h4 className="mt-4 border-bottom pb-2"><CreditCard size={16} className="mr-2 text-main"/> Pagamentos</h4>
                  <ul className="hist-modal-lista-pgto mt-3">
                    {vendaSelecionada.pagamentos && vendaSelecionada.pagamentos.length > 0 ? (
                       vendaSelecionada.pagamentos.map((pg, idx) => {
                         let corPgto = '#64748b';
                         const f = String(pg.formaPagamento).toUpperCase();
                         if(f.includes('PIX')) corPgto = '#059669';
                         if(f.includes('DINHEIRO')) corPgto = '#4ade80';
                         if(f.includes('CREDITO') || f.includes('CRÉDITO')) corPgto = '#3b82f6';

                         return (
                          <li key={idx} className="hist-pgto-detalhado flex-between bg-gray-50 p-2 rounded mb-2">
                            <span className="font-medium" style={{color: corPgto}}>
                               {pg.formaPagamento} {pg.parcelas > 1 ? `(${pg.parcelas}x)` : ''}
                            </span>
                            <strong className="text-gray-800">{formatCurrency(pg.valor)}</strong>
                          </li>
                         );
                       })
                    ) : (
                       <li style={{color: '#94a3b8', fontSize: '0.9rem', padding: '10px 0'}}>Transação sem registo financeiro.</li>
                    )}
                  </ul>
                </>
              )}

              <div className="hist-modal-totais mt-4 p-3 bg-gray-100 rounded-lg">
                <div className="hist-total-linha flex-between mb-1 text-gray-600"><span>Subtotal dos Itens</span> <span>{formatCurrency((vendaSelecionada.valorTotal || 0) + (vendaSelecionada.descontoTotal || 0))}</span></div>
                <div className="hist-total-linha flex-between mb-2 text-red-500"><span>Descontos Aplicados</span> <span>- {formatCurrency(vendaSelecionada.descontoTotal)}</span></div>
                <div className="hist-total-linha destaque flex-between font-bold text-lg border-top pt-2 border-gray-300">
                    <span>Total Final</span>
                    <span className="text-main">{formatCurrency(vendaSelecionada.valorTotal)}</span>
                </div>
              </div>
            </div>

            <div className="hist-modal-footer">
              <button className="hist-btn-secondary" onClick={fecharModal}>Fechar</button>
              <button className="hist-btn-success" style={{padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', cursor: 'pointer'}} onClick={() => { setZapNumber(vendaSelecionada.clienteTelefone || ''); setShowZapModal(true); }}>
                <MessageCircle size={18}/> Enviar WhatsApp
              </button>
              <button className="hist-btn-primary" onClick={() => imprimirCupomFrontend(vendaSelecionada)}>
                <Printer size={18}/> Imprimir Cupom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO WHATSAPP */}
      {showZapModal && (
          <div className="hist-modal-overlay z-max">
              <div className="hist-modal-content" style={{maxWidth: '400px', padding: '30px', textAlign: 'center'}}>
                  <h2 style={{margin: '0 0 10px 0', color: '#1e293b'}}>Enviar Recibo</h2>
                  <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '20px'}}>O cliente receberá a DANFE NFC-e completa no WhatsApp.</p>

                  <div style={{textAlign: 'left', marginBottom: '20px'}}>
                      <label style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '5px'}}>NÚMERO DO WHATSAPP</label>
                      <input
                          style={{width: '100%', padding: '12px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '1.1rem', outline: 'none'}}
                          placeholder="(DDD) 90000-0000"
                          value={zapNumber}
                          onChange={e => setZapNumber(mascaraTelefone(e.target.value))}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && enviarWhatsAppBodyCompleto()}
                      />
                  </div>

                  <div style={{display: 'flex', gap: '10px'}}>
                      <button className="hist-btn-secondary" style={{flex: 1}} onClick={() => setShowZapModal(false)}>Voltar</button>
                      <button className="hist-btn-success" style={{flex: 1, padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}} onClick={enviarWhatsAppBodyCompleto}>Enviar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default HistoricoVendas;