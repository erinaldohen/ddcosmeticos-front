import React, { useState, useEffect } from 'react';
import { Search, Eye, X, FileText, Package, CreditCard, ChevronLeft, ChevronRight, User, Hash, Printer, MessageCircle, Calendar, Download } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import './HistoricoVendas.css';
import axios from 'axios';

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

  const [filtroRapido, setFiltroRapido] = useState('7dias');

  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 50;

  const [modalOpen, setModalOpen] = useState(false);
  const [vendaSelecionada, setVendaSelecionada] = useState(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  const [emitindoNfe, setEmitindoNfe] = useState(false);

  const [showZapModal, setShowZapModal] = useState(false);
  const [zapNumber, setZapNumber] = useState('');

  const [showNfeModal, setShowNfeModal] = useState(false);
  const [cnpjInput, setCnpjInput] = useState('');
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [companyData, setCompanyData] = useState(null);

  useEffect(() => {
    api.get('/configuracoes').then(res => setConfigLoja(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    carregarVendas(filtroRapido);
  }, [filtroRapido]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca]);

  const obterDatasFiltro = (tipo) => {
      const hoje = new Date();
      const formata = (d) => d.toISOString().split('T')[0];
      let inicio, fim = formata(hoje);

      if (tipo === 'hoje') {
          inicio = formata(hoje);
      } else if (tipo === 'ontem') {
          const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
          inicio = formata(ontem); fim = formata(ontem);
      } else if (tipo === '7dias') {
          const d7 = new Date(hoje); d7.setDate(d7.getDate() - 7);
          inicio = formata(d7);
      } else if (tipo === 'mes') {
          inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
      } else {
          return { inicio: null, fim: null }; // 'todos'
      }
      return { inicio, fim };
  };

  const carregarVendas = async (tipoFiltro = '7dias') => {
    setLoading(true);
    try {
      const { inicio, fim } = obterDatasFiltro(tipoFiltro);
      let url = `/vendas?size=500&sort=dataVenda,desc`;

      if (inicio && fim) {
          url += `&inicio=${inicio}&fim=${fim}`;
      }

      const response = await api.get(url);
      const dados = response.data.content || response.data || [];
      setVendas(dados);
    } catch (error) {
      setVendas([]);
      toast.error("Falha ao carregar histórico.");
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

  // =========================================================================
  // EMISSÃO DE NF-E (MODELO 55) REFERENCIADA
  // =========================================================================
  const buscarDadosCnpj = async () => {
        const num = cnpjInput.replace(/\D/g, '');
        if(num.length !== 14) return toast.warning("O CNPJ deve conter 14 dígitos.");

        setLoadingCnpj(true);
        const toastId = toast.loading("Buscando dados na Receita Federal...");

        // 1. Tentativa Primária: CNPJ.ws
        try {
            const resPrincipal = await fetch(`https://publica.cnpj.ws/cnpj/${num}`);

            if (resPrincipal.ok) {
                const data = await resPrincipal.json();
                const est = data.estabelecimento;

                let ieEncontrada = 'ISENTO';
                if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
                    const ieAtiva = est.inscricoes_estaduais.find(i => i.ativa);
                    ieEncontrada = ieAtiva ? ieAtiva.inscricao_estadual : est.inscricoes_estaduais[0].inscricao_estadual;
                }

                setCompanyData({
                    cnpj: num,
                    razaoSocial: data.razao_social?.toUpperCase() || '',
                    cep: est.cep ? est.cep.replace(/^(\d{5})(\d{3})/, "$1-$2") : '',
                    logradouro: est.logradouro?.toUpperCase() || '',
                    numero: est.numero || 'SN',
                    bairro: est.bairro?.toUpperCase() || '',
                    municipio: est.cidade?.nome?.toUpperCase() || '',
                    uf: est.estado?.sigla?.toUpperCase() || '',
                    ie: ieEncontrada,
                    email: (est.email || '').toLowerCase()
                });

                toast.dismiss(toastId);
                toast.success("Dados da empresa importados com sucesso!");
                setLoadingCnpj(false);
                return;
            }
        } catch (e) {
            console.warn("CNPJ.ws falhou, tentando fallback na BrasilAPI...");
        }

        // 2. Fallback de Segurança: BrasilAPI
        try {
            const resFallback = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${num}`);
            if (!resFallback.ok) throw new Error();
            const dados = await resFallback.json();

            setCompanyData({
                cnpj: num,
                razaoSocial: dados.razao_social?.toUpperCase() || '',
                cep: dados.cep ? dados.cep.replace(/^(\d{5})(\d{3})/, "$1-$2") : '',
                logradouro: dados.logradouro?.toUpperCase() || '',
                numero: dados.numero || 'SN',
                bairro: dados.bairro?.toUpperCase() || '',
                municipio: dados.municipio?.toUpperCase() || '',
                uf: dados.uf?.toUpperCase() || '',
                ie: 'ISENTO',
                email: (dados.email || '').toLowerCase()
            });

            toast.dismiss(toastId);
            toast.info("Dados importados! Preencha a Inscrição Estadual manualmente.");
        } catch (error) {
            toast.dismiss(toastId);
            toast.error("CNPJ não localizado. Verifique se o número está correto.");
            setCompanyData(null);
        } finally {
            setLoadingCnpj(false);
        }
    };

    const confirmarEmissaoNfeB2B = async () => {
              setEmitindoNfe(true);
              const idReal = vendaSelecionada.idVenda || vendaSelecionada.id;
              const toastId = toast.loading("A transmitir NF-e para a SEFAZ...");

              try {
                  // 1. Envia o comando de emissão
                  await api.post(`/fiscal/nfe/emitir/${idReal}`, companyData);
                  toast.update(toastId, { render: "NF-e (Mod. 55) Autorizada!", type: "success", isLoading: false, autoClose: 3000 });

                  // 2. 🔥 CORREÇÃO: Força a busca da venda atualizada para trazer o NOVO XML da SEFAZ
                  try {
                      const resVendaAtualizada = await api.get(`/vendas/${idReal}`);
                      setVendaSelecionada(resVendaAtualizada.data);
                  } catch (errAtualizacao) {
                      console.warn("Não foi possível atualizar a venda em tempo real.", errAtualizacao);
                  }

                  setShowNfeModal(false);
                  carregarVendas(filtroRapido);

              } catch (error) {
                  let msgErro = "Falha ao emitir NF-e.";
                  if (error.response && error.response.data) {
                      msgErro = typeof error.response.data === 'string'
                                ? error.response.data
                                : (error.response.data.message || error.response.data.error || msgErro);
                  } else if (error.message) {
                      msgErro = error.message;
                  }
                  toast.update(toastId, { render: "Recusado: " + msgErro, type: "error", isLoading: false, autoClose: 8000 });
              } finally {
                  setEmitindoNfe(false);
              }
          };

  const baixarXML = async (venda) => {
      try {
          let xmlContent = venda.xmlNota;

          if (!xmlContent) {
              const res = await api.get(`/vendas/${venda.idVenda || venda.id}`);
              xmlContent = res.data.xmlNota;
          }

          if (!xmlContent) {
              return toast.warning("O arquivo XML ainda não foi disponibilizado pela SEFAZ.");
          }

          const blob = new Blob([xmlContent], { type: 'application/xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `NFe_${venda.chaveAcessoNfce || venda.numeroNfce || venda.idVenda || venda.id}.xml`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (error) {
          toast.error("Erro ao tentar baixar o XML.");
      }
  };

  const imprimirCupomFrontend = async (vendaBase) => {
        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        if (!printWindow) {
            toast.error("O bloqueador de Pop-ups do navegador impediu a impressão!");
            return;
        }

        printWindow.document.write("<html><body><h2 style='font-family: sans-serif; text-align: center; margin-top: 50px; color: #64748b;'>A preparar documento fiscal, por favor aguarde...</h2></body></html>");

        const docRaw = vendaBase?.clienteDocumento ? vendaBase.clienteDocumento.replace(/\D/g, '') : '';
        const isNfe = vendaBase?.tipoNota === 'NFE' || docRaw.length === 14;

        const loja = configLoja?.loja || {};
        const fiscal = configLoja?.fiscal || {};
        const end = configLoja?.endereco || {};

        const razaoSocial = loja.razaoSocial || "DD COSMÉTICOS LTDA";
        const cnpj = loja.cnpj ? loja.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : "57.648.950/0001-44";
        const logradouroEmit = end.logradouro || "Rua Arquiteto Luiz Nunes";
        const numEmit = end.numero || "63";
        const bairroEmit = end.bairro || "Imbiribeira";
        const cepEmit = end.cep ? end.cep.replace(/^(\d{5})(\d{3})/, '$1-$2') : "51170-435";
        const munEmit = end.cidade || "Recife";
        const ufEmit = end.uf || "PE";
        const telefone = loja.telefone || "(81) 99999-9999";
        const ieEmit = fiscal.inscricaoEstadual || "120159465";

        const numDoc = vendaBase?.numeroNfce || vendaBase?.idVenda || vendaBase?.id || "1";
        const serieDoc = vendaBase?.serieNfce || fiscal?.serieProducao || "1";

        const chaveAcessoRaw = vendaBase?.chaveAcessoNfce || vendaBase?.chaveAcesso || vendaBase?.chaveNfce || vendaBase?.chave || '00000000000000000000000000000000000000000000';
        const chaveFormatada = chaveAcessoRaw !== '00000000000000000000000000000000000000000000' ? chaveAcessoRaw.replace(/(\d{4})/g, '$1 ').trim() : 'Aguardando Processamento SEFAZ';

        const protocolo = vendaBase?.protocolo || '';
        const dataVendaObj = vendaBase?.dataVenda ? new Date(vendaBase.dataVenda) : new Date();
        const dataEmissao = dataVendaObj.toLocaleDateString('pt-BR');
        const horaEmissao = dataVendaObj.toLocaleTimeString('pt-BR');

        const qrCodeUrl = vendaBase?.urlQrCode || `http://nfce.sefaz.pe.gov.br/nfce/consulta?chNFe=${chaveAcessoRaw}`;

        const itensImpressao = vendaBase?.itens || [];
        const totalQtd = itensImpressao.reduce((acc, i) => acc + (i.quantidade || 1), 0);
        const subtotalBase = itensImpressao.reduce((acc, i) => acc + ((i.precoUnitario || i.valorUnitario || i.preco || 0) * (i.quantidade || 1)), 0);
        const descontosImpressao = vendaBase?.descontoTotal || 0;
        const pagamentosImpressao = vendaBase?.pagamentos || [];
        const totalVenda = vendaBase?.valorTotal || 0;
        const trocoImpressao = vendaBase?.troco || 0;

        let docClienteImp = vendaBase?.clienteDocumento || '';
        if (docClienteImp) {
            const docL = docClienteImp.replace(/\D/g, '');
            if (docL.length === 11) {
                docClienteImp = docL.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            } else if (docL.length === 14) {
                docClienteImp = docL.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
            }
        }

        const nomeClienteImp = vendaBase?.clienteNome || '';

        let logradouroDest = "";
                let bairroDest = "";
                let cepDest = "";
                let munDest = "";
                let ufDest = "";
                let foneDest = "";
                let ieDest = "ISENTO";

                // 🔥 EXTRAÇÃO SEGURA E LEGAL: Lê apenas a verdade contida no XML autorizado
                if (vendaBase?.xmlNota) {
                    try {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(vendaBase.xmlNota, "text/xml");

                        // 🔥 CORREÇÃO: Foca a pesquisa EXCLUSIVAMENTE dentro do nó <dest> (Destinatário)
                        let destNode = xmlDoc.getElementsByTagName("dest")[0];
                        if (!destNode) destNode = xmlDoc.getElementsByTagNameNS("*", "dest")[0];

                        if (destNode) {
                            const getDestTag = (tagName) => {
                                let elements = destNode.getElementsByTagName(tagName);
                                if (elements.length === 0) elements = destNode.getElementsByTagNameNS("*", tagName);
                                return elements.length > 0 ? elements[0].textContent.trim() : "";
                            };

                            const xLgr = getDestTag("xLgr");
                            const nro = getDestTag("nro");
                            const xBairro = getDestTag("xBairro");
                            const cepRaw = getDestTag("CEP");

                            munDest = getDestTag("xMun");
                            ufDest = getDestTag("UF");
                            foneDest = getDestTag("fone");
                            const extIe = getDestTag("IE");

                            if (extIe && extIe.toUpperCase() !== "ISENTO" && extIe !== "") ieDest = extIe;
                            if (xLgr) logradouroDest = (nro && nro.toUpperCase() !== 'SN' && nro.toUpperCase() !== 'S/N') ? `${xLgr}, ${nro}` : xLgr;
                            if (xBairro) bairroDest = xBairro;
                            if (cepRaw) cepDest = cepRaw.length === 8 ? cepRaw.replace(/(\d{5})(\d{3})/, "$1-$2") : cepRaw;
                            if (foneDest) foneDest = foneDest.length >= 10 ? foneDest.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : foneDest;
                        }

                    } catch (e) {
                        console.error("Falha ao analisar a estrutura do XML da SEFAZ.", e);
                    }
                }

                // 🔥 PROTEÇÃO FISCAL: Se não está no XML, não se pode inventar dados baseados no cadastro interno
                if (!logradouroDest) logradouroDest = "Não Informado";
                if (!bairroDest) bairroDest = "Não Informado";
        const tribFederal = (totalVenda * 0.15).toFixed(2);
        const tribEstadual = (totalVenda * 0.18).toFixed(2);
        const tribMunicipal = "0.00";

        const isReferenciada = isNfe && (vendaBase?.chaveAcessoNfce && vendaBase.chaveAcessoNfce.length === 44);

        let printHtml = '';

        if (isNfe) {
            printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>DANFE NF-e - ${razaoSocial}</title>
                    <style>
                        @page { size: A4 portrait; margin: 5mm; }
                        body { font-family: "Times New Roman", Times, serif; font-size: 10px; margin: 0; padding: 0; background: #fff; color: #000; }
                        .container { width: 100%; max-width: 200mm; margin: 0 auto; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 3px; table-layout: fixed; }
                        td, th { border: 1px solid #000; padding: 2px 4px; vertical-align: top; overflow: hidden; }
                        .lbl { display: block; font-size: 6px; text-transform: uppercase; color: #000; font-family: Arial, sans-serif; }
                        .val { display: block; font-size: 10px; font-weight: bold; font-family: Arial, sans-serif; margin-top: 1px; white-space: nowrap; text-overflow: ellipsis; }
                        .val-wrap { white-space: normal; }
                        .title-sec { font-size: 9px; font-weight: bold; text-transform: uppercase; margin: 6px 0 2px 0; font-family: Arial, sans-serif; }
                        .center { text-align: center; } .right { text-align: right; } .left { text-align: left; }
                        .barcode-box { text-align: center; padding-top: 5px; height: 38px; display: flex; justify-content: center; align-items: center; }
                        .dashed-line { border-bottom: 1px dashed #000; margin: 10px 0; }

                        .tb-itens th { font-size: 6px; text-align: left; background: #fff; padding: 3px 2px; border: 1px solid #000; }
                        .tb-itens td { font-size: 8px; font-family: Arial, sans-serif; font-weight: normal; border-top: none; border-bottom: 1px dotted #ccc; padding: 4px 2px; }
                        .tb-itens tr:last-child td { border-bottom: 1px solid #000; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <table>
                            <tr>
                                <td colspan="2" style="width: 80%;">
                                    <span class="lbl">RECEBEMOS DE ${razaoSocial} OS PRODUTOS E SERVIÇOS CONSTANTES NA NOTA FISCAL INDICADA AO LADO</span>
                                </td>
                                <td rowspan="2" class="center" style="width: 20%; vertical-align: middle;">
                                    <span class="val" style="font-size: 14px;">NF-e</span>
                                    <span class="val" style="font-size: 12px;">Nº ${numDoc}</span>
                                    <span class="val">Série ${serieDoc}</span>
                                </td>
                            </tr>
                            <tr>
                                <td style="width: 20%;"><span class="lbl">DATA DE RECEBIMENTO</span><span class="val">&nbsp;</span></td>
                                <td style="width: 60%;"><span class="lbl">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span><span class="val">&nbsp;</span></td>
                            </tr>
                        </table>

                        <div class="dashed-line"></div>

                        <table>
                            <tr>
                                <td style="width: 40%; vertical-align: middle; padding: 10px 5px;">
                                    <strong style="font-size: 12px; display: block; margin-bottom: 5px; font-family: Arial, sans-serif;">${razaoSocial}</strong>
                                    <span style="font-size: 9px; display: block; font-family: Arial, sans-serif;">${logradouroEmit}, ${numEmit}<br>${bairroEmit} - ${cepEmit}<br>${munEmit} - ${ufEmit} Fone: ${telefone}</span>
                                </td>
                                <td class="center" style="width: 15%; vertical-align: middle; padding: 5px;">
                                    <h2 style="margin:0; font-size: 18px; font-family: Arial, sans-serif;">DANFE</h2>
                                    <span class="lbl" style="font-size:7px; margin-top:2px;">DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA</span>
                                    <div style="margin-top: 8px; font-size: 10px; font-family: Arial, sans-serif; text-align: left; padding-left: 10px;">
                                        0 - ENTRADA<br>1 - SAÍDA &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>[ 1 ]</strong>
                                    </div>
                                    <div style="margin-top: 8px;">
                                        <strong style="font-size: 12px; font-family: Arial, sans-serif;">Nº ${numDoc}</strong><br>
                                        <strong style="font-size: 10px; font-family: Arial, sans-serif;">SÉRIE: ${serieDoc}</strong><br>
                                        <span style="font-size: 8px; font-family: Arial, sans-serif;">PÁGINA 1 DE 1</span>
                                    </div>
                                </td>
                                <td style="width: 45%; vertical-align: middle; padding: 5px;">
                                    <div class="lbl">CONTROLE DO FISCO</div>

                                    <div class="barcode-box">
                                        <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${chaveAcessoRaw}&scale=2&height=10&includetext=false" style="max-width: 100%; height: 35px; object-fit: contain;" alt="Código de Barras" />
                                    </div>

                                    <div style="margin-top: 8px;">
                                        <span class="lbl">CHAVE DE ACESSO</span>
                                        <span class="val center" style="font-size: 11px;">${chaveFormatada}</span>
                                    </div>
                                    <div class="center" style="margin-top: 6px; font-size: 8px; font-family: Arial, sans-serif;">
                                        Consulta de autenticidade no portal nacional da NF-e<br>
                                        www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora.
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <table>
                            <tr>
                                <td style="width: 55%;"><span class="lbl">NATUREZA DA OPERAÇÃO</span><span class="val val-wrap">Venda Dentro do Estado</span></td>
                                <td style="width: 45%;"><span class="lbl">PROTOCOLO DE AUTORIZAÇÃO DE USO</span><span class="val">${protocolo ? protocolo + ' ' + dataEmissao + ' ' + horaEmissao : ''}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 33%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val">${ieEmit}</span></td>
                                <td style="width: 33%;"><span class="lbl">INSCRIÇÃO ESTADUAL DO SUBST. TRIB.</span><span class="val"></span></td>
                                <td style="width: 34%;"><span class="lbl">CNPJ</span><span class="val">${cnpj}</span></td>
                            </tr>
                        </table>

                        <div class="title-sec">DESTINATÁRIO / REMETENTE</div>
                        <table>
                            <tr>
                                <td style="width: 60%;"><span class="lbl">NOME / RAZÃO SOCIAL</span><span class="val val-wrap">${nomeClienteImp || 'CONSUMIDOR'}</span></td>
                                <td style="width: 25%;"><span class="lbl">CNPJ / CPF</span><span class="val">${docClienteImp}</span></td>
                                <td style="width: 15%;"><span class="lbl">DATA DE EMISSÃO</span><span class="val">${dataEmissao}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 45%;"><span class="lbl">ENDEREÇO</span><span class="val val-wrap">${logradouroDest}</span></td>
                                <td style="width: 20%;"><span class="lbl">BAIRRO / DISTRITO</span><span class="val val-wrap">${bairroDest}</span></td>
                                <td style="width: 12%;"><span class="lbl">CEP</span><span class="val">${cepDest}</span></td>
                                <td style="width: 23%;"><span class="lbl">DATA DE ENTR. / SAÍDA</span><span class="val">${dataEmissao}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 40%;"><span class="lbl">MUNICÍPIO</span><span class="val">${munDest}</span></td>
                                <td style="width: 15%;"><span class="lbl">FONE / FAX</span><span class="val">${foneDest}</span></td>
                                <td style="width: 7%;"><span class="lbl">UF</span><span class="val">${ufDest}</span></td>
                                <td style="width: 23%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val">${ieDest}</span></td>
                                <td style="width: 15%;"><span class="lbl">HORA ENTR. / SAÍDA</span><span class="val">${horaEmissao}</span></td>
                            </tr>
                        </table>

                        <div class="title-sec">CÁLCULO DO IMPOSTO</div>
                        <table>
                            <tr>
                                <td style="width: 16%;"><span class="lbl">BASE DE CÁLC. DO ICMS</span><span class="val right">0,00</span></td>
                                <td style="width: 14%;"><span class="lbl">VALOR DO ICMS</span><span class="val right">0,00</span></td>
                                <td style="width: 17%;"><span class="lbl">BASE DE CÁLC DO ICMS ST</span><span class="val right">0,00</span></td>
                                <td style="width: 15%;"><span class="lbl">VALOR DO ICMS ST</span><span class="val right">0,00</span></td>
                                <td style="width: 16%;"><span class="lbl">V. APROX. TRIBUTOS</span><span class="val right">${(parseFloat(tribFederal) + parseFloat(tribEstadual)).toFixed(2)}</span></td>
                                <td style="width: 22%;"><span class="lbl">VALOR TOTAL DOS PRODUTOS</span><span class="val right">${subtotalBase.toFixed(2)}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 16%;"><span class="lbl">VALOR DO FRETE</span><span class="val right">0,00</span></td>
                                <td style="width: 14%;"><span class="lbl">VALOR DO SEGURO</span><span class="val right">0,00</span></td>
                                <td style="width: 17%;"><span class="lbl">DESCONTO</span><span class="val right">${descontosImpressao.toFixed(2)}</span></td>
                                <td style="width: 15%;"><span class="lbl">OUTRAS DESPESAS</span><span class="val right">0,00</span></td>
                                <td style="width: 16%;"><span class="lbl">VALOR DO IPI</span><span class="val right">0,00</span></td>
                                <td style="width: 22%;"><span class="lbl">VALOR TOTAL DA NOTA</span><span class="val right">${totalVenda.toFixed(2)}</span></td>
                            </tr>
                        </table>

                        <div class="title-sec">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
                        <table>
                            <tr>
                                <td style="width: 40%;"><span class="lbl">RAZÃO SOCIAL</span><span class="val">0 - Emitente</span></td>
                                <td style="width: 15%;"><span class="lbl">FRETE POR CONTA<br>0-Emitente 1-Dest</span><span class="val">9 - Sem Frete</span></td>
                                <td style="width: 10%;"><span class="lbl">CÓDIGO ANTT</span><span class="val"></span></td>
                                <td style="width: 10%;"><span class="lbl">PLACA</span><span class="val"></span></td>
                                <td style="width: 5%;"><span class="lbl">UF</span><span class="val"></span></td>
                                <td style="width: 20%;"><span class="lbl">CNPJ / CPF</span><span class="val"></span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 35%;"><span class="lbl">ENDEREÇO</span><span class="val"></span></td>
                                <td style="width: 25%;"><span class="lbl">MUNICÍPIO</span><span class="val"></span></td>
                                <td style="width: 5%;"><span class="lbl">UF</span><span class="val"></span></td>
                                <td style="width: 35%;"><span class="lbl">INSCRIÇÃO ESTADUAL</span><span class="val"></span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 15%;"><span class="lbl">QUANTIDADE</span><span class="val">${totalQtd}</span></td>
                                <td style="width: 25%;"><span class="lbl">ESPÉCIE</span><span class="val">VOLUMES</span></td>
                                <td style="width: 20%;"><span class="lbl">MARCA</span><span class="val"></span></td>
                                <td style="width: 15%;"><span class="lbl">NUMERAÇÃO</span><span class="val"></span></td>
                                <td style="width: 12%;"><span class="lbl">PESO BRUTO</span><span class="val">0,000</span></td>
                                <td style="width: 13%;"><span class="lbl">PESO LÍQUIDO</span><span class="val">0,000</span></td>
                            </tr>
                        </table>

                        <div class="title-sec">DADOS DO PRODUTO / SERVIÇO</div>
                        <table class="tb-itens">
                            <thead>
                                <tr>
                                    <th style="width: 12%;">CÓDIGO</th>
                                    <th style="width: 26%;">DESCRIÇÃO DO PRODUTO/SERVIÇO</th>
                                    <th style="width: 8%;">NCM/SH</th>
                                    <th style="width: 4%;">CST</th>
                                    <th style="width: 4%;">CFOP</th>
                                    <th style="width: 4%;">UN</th>
                                    <th style="width: 7%; text-align:right;">QTD.</th>
                                    <th style="width: 7%; text-align:right;">VLR.<br>UNIT</th>
                                    <th style="width: 8%; text-align:right;">VLR.<br>TOTAL</th>
                                    <th style="width: 7%; text-align:right;">BC<br>ICMS</th>
                                    <th style="width: 5%; text-align:right;">VLR.<br>ICMS</th>
                                    <th style="width: 5%; text-align:right;">VLR.<br>IPI</th>
                                    <th style="width: 5%; text-align:right;">ALIQ.<br>ICMS</th>
                                    <th style="width: 5%; text-align:right;">ALIQ.<br>IPI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itensImpressao.map((i, index) => {
                                    const unit = i.precoUnitario || i.valorUnitario || i.preco || 0;
                                    const ncmProduto = i.ncm || i.produto?.ncm || '33049990';
                                    const eanProduto = i.codigoBarras || i.ean || i.produto?.codigoBarras || i.produto?.ean || 'S/N';
                                    const desc = i.produtoNome || i.nomeProduto || i.nome || i.descricao || 'Produto';
                                    const cst = "0102";
                                    const cfop = isReferenciada ? "5929" : "5102";

                                    return `
                                    <tr>
                                        <td>${eanProduto}</td>
                                        <td>${desc}</td>
                                        <td class="center">${ncmProduto}</td>
                                        <td class="center">${cst}</td>
                                        <td class="center">${cfop}</td>
                                        <td class="center">UN</td>
                                        <td class="right">${parseFloat(i.quantidade).toFixed(4)}</td>
                                        <td class="right">${unit.toFixed(2)}</td>
                                        <td class="right">${(i.quantidade * unit).toFixed(2)}</td>
                                        <td class="right">0,00</td>
                                        <td class="right">0,00</td>
                                        <td class="right">0,00</td>
                                        <td class="right">0,00</td>
                                        <td class="right">0,00</td>
                                    </tr>
                                    `
                                }).join('')}
                            </tbody>
                        </table>

                        <div class="title-sec">CÁLCULO DO ISSQN</div>
                        <table>
                            <tr>
                                <td style="width: 25%;"><span class="lbl">INSCRIÇÃO MUNICIPAL</span><span class="val"></span></td>
                                <td style="width: 25%;"><span class="lbl">VALOR TOTAL DOS SERVIÇOS</span><span class="val right">0,00</span></td>
                                <td style="width: 25%;"><span class="lbl">BASE DE CÁLCULO DO ISSQN</span><span class="val right">0,00</span></td>
                                <td style="width: 25%;"><span class="lbl">VALOR DO ISSQN</span><span class="val right">0,00</span></td>
                            </tr>
                        </table>

                        <div class="title-sec">DADOS ADICIONAIS</div>
                        <table style="height: 100px;">
                            <tr>
                                <td style="width: 65%;">
                                    <span class="lbl">INFORMAÇÕES COMPLEMENTARES</span>
                                    <span class="val val-wrap" style="font-size: 8px; font-weight: normal;">
                                        DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.<br>
                                        NAO GERA DIREITO A CREDITO FISCAL DE ICMS, ISS E IPI.<br>
                                        Trib aprox R$ ${tribFederal} Fed e R$ ${tribEstadual} Est. Fonte: IBPT.
                                    </span>
                                </td>
                                <td style="width: 35%;">
                                    <span class="lbl">RESERVADO AO FISCO</span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 800);
                        };
                    </script>
                </body>
                </html>
            `;
        } else {
            printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>CUPOM FISCAL</title>
                    <style>
                        @page { margin: 0; size: 80mm auto; }
                        body { font-family: 'Courier New', Courier, monospace; font-size: 9.5px; width: 71mm; margin: 0; padding: 4mm 2mm 4mm 4mm; color: #000; line-height: 1.15; box-sizing: border-box; }
                        .center { text-align: center; } .left { text-align: left; } .right { text-align: right; }
                        .bold { font-weight: bold; }
                        .line { border-bottom: 1px dashed #000; margin: 4px 0; }
                        .double-line { border-bottom: 2px solid #000; margin: 4px 0; }
                        table { width: 100%; border-collapse: collapse; font-size: 8.5px; table-layout: fixed; }
                        th, td { padding: 1.5px 0; vertical-align: top; word-wrap: break-word; }
                        .col-cod { width: 13%; } .col-desc { width: 44%; } .col-qtd { width: 12%; text-align: right; } .col-vlun { width: 15%; text-align: right; } .col-vltot { width: 16%; text-align: right; }
                        .qr-code { display: block; margin: 8px auto; width: 110px; height: 110px; }
                        p { margin: 2px 0; }
                    </style>
                </head>
                <body>
                    <div class="center bold" style="font-size:12px; text-transform:uppercase;">${razaoSocial}</div>
                    <div class="center">CNPJ: ${cnpj} ${fiscal.inscricaoEstadual ? ' IE: '+fiscal.inscricaoEstadual : ''}</div>
                    <div class="center" style="font-size:9px;">${logradouroEmit}, ${numEmit} - ${bairroEmit}</div>
                    <div class="center" style="font-size:9px;">${munEmit} - ${ufEmit} - Tel: ${telefone}</div>
                    <div class="double-line"></div>

                    <div class="center bold" style="font-size:10px;">DANFE NFC-e - Documento Auxiliar da<br>Nota Fiscal de Consumidor Eletrônica</div>
                    <div class="center" style="font-size:9px;">Não permite aproveitamento de crédito de ICMS</div>
                    <div class="double-line"></div>

                    <table style="margin-bottom: 4px;">
                        <tr style="border-bottom: 1px dashed #000;">
                            <th class="left col-cod">CÓD</th>
                            <th class="left col-desc">DESCRIÇÃO</th>
                            <th class="right col-qtd">QTD</th>
                            <th class="right col-vlun">VL.UN</th>
                            <th class="right col-vltot">TOTAL</th>
                        </tr>
                        ${itensImpressao.map((i, index) => {
                            const unit = i.precoUnitario || i.valorUnitario || i.preco || 0;
                            const eanProduto = i.codigoBarras || i.ean || i.produto?.codigoBarras || i.produto?.ean || 'SEM GTIN';
                            return `
                            <tr>
                                <td class="left">${String(i.produtoId || i.id || index + 1).padStart(3, '0')}</td>
                                <td class="left">${i.produtoNome || i.nomeProduto || i.nome || i.descricao || 'Produto'}<br><span style="font-size:7px;">EAN:${eanProduto}</span></td>
                                <td class="right">${i.quantidade}</td>
                                <td class="right">${unit.toFixed(2)}</td>
                                <td class="right">${(i.quantidade * unit).toFixed(2)}</td>
                            </tr>
                        `}).join('')}
                    </table>

                    <div class="line"></div>
                    <div style="display:flex; justify-content:space-between;"><span>Qtd. Total de Itens:</span><span>${totalQtd}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>R$ ${subtotalBase.toFixed(2)}</span></div>
                    ${descontosImpressao > 0 ? `<div style="display:flex; justify-content:space-between;"><span>Descontos:</span><span>- R$ ${descontosImpressao.toFixed(2)}</span></div>` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:11px;" class="bold"><span>VALOR TOTAL R$</span><span>${totalVenda.toFixed(2)}</span></div>
                    <div class="line"></div>

                    <div class="bold" style="margin-bottom: 3px;">FORMA DE PAGAMENTO</div>
                    <table style="margin-bottom: 4px;">
                        ${pagamentosImpressao.map(p => `
                            <tr><td class="left">${p.formaPagamento || p.tipo}</td><td class="right">R$ ${(p.valor||0).toFixed(2)}</td></tr>
                        `).join('')}
                    </table>
                    <div style="display:flex; justify-content:space-between;"><span>Troco:</span><span>R$ ${trocoImpressao.toFixed(2)}</span></div>

                    <div class="line"></div>
                    <div class="center" style="font-size:9px;">Valores Aprox. Tributos (Lei 12.741/12):<br>Federal R$ ${tribFederal} | Estadual R$ ${tribEstadual} | Municipal R$ ${tribMunicipal}</div>
                    <div class="line"></div>

                    <div class="center bold" style="margin-bottom:2px;">CONSUMIDOR</div>
                    <div class="center" style="font-size:9px;">
                        ${docClienteImp ? `CNPJ/CPF: ${docClienteImp}<br>` : 'CONSUMIDOR NÃO IDENTIFICADO<br>'}
                        ${nomeClienteImp ? `${nomeClienteImp}<br>` : ''}
                        ${logradouroDest !== 'Não Informado' ? `${logradouroDest}<br>${bairroDest} - CEP: ${cepDest}` : ''}
                    </div>
                    <div class="line"></div>

                    <div class="center bold" style="font-size:10px;">Emissão: ${dataEmissao} ${horaEmissao}</div>
                    <div class="center" style="font-size:10px;">NFC-e Nº ${numDoc} - Série ${serieDoc}</div>
                    <div class="center" style="margin-top:2px;">Protocolo de Autorização: ${protocolo}</div>
                    <div class="center" style="margin-top:6px; font-size:9px;">Consulte pela Chave de Acesso em:</div>
                    <div class="center" style="font-size:9px; word-break:break-all;">http://nfce.sefaz.pe.gov.br/nfce/consulta</div>

                    <div class="center bold" style="margin-top:8px; font-size:10.5px; letter-spacing:1px; word-break:break-all;">
                        ${chaveFormatada}
                    </div>

                    <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}" alt="QR Code" />

                    <div class="center bold" style="margin-top:8px; font-size:10px;">Obrigado e volte sempre!</div>
                    <br><br><br>

                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 800);
                        };
                    </script>
                </body>
                </html>
            `;
        }

        printWindow.document.open();
        printWindow.document.write(printHtml);
        printWindow.document.close();
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
        <div className="hist-header-top">
            <h2>Histórico de Vendas</h2>
            <div className="hist-search">
              <Search size={18} color="#94a3b8" />
              <input type="text" placeholder="Buscar por cliente ou cupom..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
        </div>
        <div className="hist-filtros-rapidos">
             {['hoje', 'ontem', '7dias', 'mes', 'todos'].map(f => (
                <button
                    key={f}
                    className={`hist-btn-filtro ${filtroRapido === f ? 'ativo' : ''}`}
                    onClick={() => setFiltroRapido(f)}
                >
                    {f === 'hoje' ? 'Hoje' : f === 'ontem' ? 'Ontem' : f === '7dias' ? 'Últimos 7 Dias' : f === 'mes' ? 'Mês Atual' : 'Todo o Histórico'}
                </button>
            ))}
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
                                  const isNfe = venda.tipoNota === 'NFE';
                                  const isSucesso = statusReal === 'AUTORIZADA' || statusReal === 'CONCLUIDA';
                                  const idReal = venda.idVenda || venda.id;

                                  return (
                                    <tr key={idReal || index}>
                                      <td data-label="ID">#{idReal}</td>
                                      <td data-label="Data / Hora">{venda.dataVenda ? new Date(venda.dataVenda).toLocaleString('pt-BR') : '-'}</td>
                                      <td data-label="Cliente" style={{ fontWeight: '500', color: '#1e293b' }}>
                                          {venda.clienteNome || 'Consumidor Final'}<br/>
                                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>
                                              {isNfe ? 'Pessoa Jurídica' : (venda.clienteDocumento ? 'Pessoa Física' : 'Não Identificado')}
                                          </span>
                                      </td>
                                      <td data-label="Documento Fiscal">
                                        <span className={`hist-status-badge ${statusReal === 'CANCELADA' ? 'cancelada' : (isSucesso ? 'autorizada' : 'pendente')}`}>
                                          {isNfe ? 'NF-e (Mod. 55)' : 'NFC-e (Cupom)'} • {statusReal}
                                        </span>
                                      </td>
                                      <td data-label="Total" className="hist-fw-bold text-main">{formatCurrency(venda.valorTotal)}</td>
                                      <td data-label="Ações">
                                        <button className="hist-btn-icon" onClick={(e) => abrirDetalhes(venda, e)} data-tooltip="Ver Detalhes">
                                          <Eye size={18} color="#3b82f6" />
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })
                              ) : (
                                <tr><td colSpan="6" className="hist-text-center" style={{padding: '30px', color: '#94a3b8'}}>Nenhuma transação atende aos critérios do filtro.</td></tr>
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

      {/* MODAL DE DETALHES E EMISSÃO DE NF-E */}
            {modalOpen && vendaSelecionada && (
              <div className="hist-modal-overlay" onClick={fecharModal}>
                <div className="hist-modal-content" onClick={e => e.stopPropagation()}>

                  <div className="hist-modal-header">
                    <div className="hist-modal-header-top">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: '800' }}>
                            <div className="hist-icon-badge"><Package size={20} /></div>
                            Detalhes da Venda #{vendaSelecionada.idVenda || vendaSelecionada.id}
                        </h3>
                        <button className="hist-btn-close" onClick={fecharModal}><X size={24} strokeWidth={2.5} /></button>
                    </div>

                    {(vendaSelecionada.chaveAcessoNfce || vendaSelecionada.chaveAcesso) && (
                       <div className="hist-chave-wrapper" title="Chave de Acesso SEFAZ">
                          <span className="chave-label">CHAVE DE ACESSO</span>
                          <span className="chave-valor">{(vendaSelecionada.chaveAcessoNfce || vendaSelecionada.chaveAcesso).replace(/(\d{4})/g, '$1 ').trim()}</span>
                       </div>
                    )}
                  </div>

                  <div className="hist-modal-body custom-scrollbar">

                    <div className="hist-modal-info-grid">
                      <div className="hist-info-card theme-blue">
                        <div className="label-row"><div className="icon-round"><User size={16}/></div> Perfil Fiscal</div>
                        <strong>{vendaSelecionada.clienteNome || 'Consumidor Final'}</strong>
                        {vendaSelecionada.clienteDocumento && (
                            <span className="text-small text-muted block mt-1">
                                {vendaSelecionada.clienteDocumento.replace(/\D/g, '').length === 14 ? 'CNPJ: ' : 'CPF: '}
                                {vendaSelecionada.clienteDocumento.replace(/\D/g, '')
                                    .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                                    .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                                }
                            </span>
                        )}
                      </div>

                      <div className="hist-info-card theme-emerald">
                        <div className="label-row"><div className="icon-round"><Calendar size={16}/></div> Transação</div>
                        <strong>{vendaSelecionada.dataVenda ? new Date(vendaSelecionada.dataVenda).toLocaleString('pt-BR') : '-'}</strong>
                        <span className="text-small text-muted block mt-1">Operador: {vendaSelecionada.usuario ? vendaSelecionada.usuario.nome : (vendaSelecionada.nomeOperador || 'Sistema')}</span>
                      </div>

                      <div className="hist-info-card theme-purple">
                        <div className="label-row"><div className="icon-round"><FileText size={16}/></div> Autorização</div>
                        <strong className={vendaSelecionada.statusNfce === 'AUTORIZADA' ? 'text-success' : 'text-warning'}>
                            {vendaSelecionada.tipoNota || 'NFCE'} • {vendaSelecionada.statusNfce || vendaSelecionada.status || 'PENDENTE'}
                        </strong>
                        <span className="text-small text-muted block mt-1">
                           {vendaSelecionada.protocolo ? `Prot: ${vendaSelecionada.protocolo}` : 'Sem protocolo'}
                        </span>
                      </div>
                    </div>
                    {loadingDetalhes ? (
                      <div className="hist-loading"><div className="hist-spinner"></div> Carregando espelho da nota...</div>
                    ) : (
                      <>
                        <h4 className="hist-section-title"><Package size={20} className="text-main"/> Grade de Produtos</h4>
                        <ul className="hist-modal-lista-itens">
                          {vendaSelecionada.itens && vendaSelecionada.itens.length > 0 ? (
                            vendaSelecionada.itens.map((item, idx) => {
                              const nomeProduto = item.nomeProduto || item.nome || item.produtoNome || item.descricao || item.produto?.nome || item.produto?.descricao || `Produto #${item.produtoId || '?'}`;
                              const eanProduto = item.codigoBarras || item.ean || item.produto?.codigoBarras || item.produto?.ean || 'S/N';
                              const precoUnit = item.precoUnitario || item.valorUnitario || item.preco || 0;
                              const qtd = item.quantidade || 1;
                              return (
                                <li key={idx} className="hist-produto-detalhado">
                                  <div className="flex-between">
                                    <div className="hist-item-desc flex-align-center" style={{gap: '12px'}}>
                                      <span className="hist-item-qtd bg-gray-100 rounded text-sm font-bold" style={{padding: '4px 8px'}}>{qtd}x</span>
                                      <div style={{display: 'flex', flexDirection: 'column'}}>
                                         <span className="hist-item-nome font-bold text-gray-800">{nomeProduto}</span>
                                         <span className="hist-item-ean text-muted text-sm mt-1" style={{fontFamily:'monospace'}}>EAN: {eanProduto} • Unit: {formatCurrency(precoUnit)}</span>
                                      </div>
                                    </div>
                                    <span className="hist-item-preco font-bold text-gray-800" style={{fontSize: '1.1rem'}}>{formatCurrency(precoUnit * qtd)}</span>
                                  </div>
                                </li>
                              );
                            })
                          ) : (
                             <li className="text-muted p-3 text-center">Nenhum item detalhado neste cupom.</li>
                          )}
                        </ul>

                        <h4 className="hist-section-title mt-4"><CreditCard size={20} className="text-main"/> Meios de Pagamento</h4>
                        <ul className="hist-modal-lista-pgto">
                          {vendaSelecionada.pagamentos && vendaSelecionada.pagamentos.length > 0 ? (
                             vendaSelecionada.pagamentos.map((pg, idx) => {
                               let corPgto = '#3b82f6';
                               const f = String(pg.formaPagamento).toUpperCase();
                               if(f.includes('PIX')) corPgto = '#059669';
                               if(f.includes('DINHEIRO')) corPgto = '#10b981';

                               return (
                                <li key={idx} className="hist-pgto-detalhado flex-between" style={{borderLeftColor: corPgto}}>
                                  <span className="font-bold flex-align-center" style={{gap: '8px', color: '#1e293b'}}>
                                     <CreditCard size={18} color={corPgto} />
                                     {pg.formaPagamento} {pg.parcelas > 1 ? `(${pg.parcelas}x)` : ''}
                                  </span>
                                  <strong className="text-gray-800" style={{fontSize: '1.1rem'}}>{formatCurrency(pg.valor)}</strong>
                                </li>
                               );
                             })
                          ) : (
                             <li className="text-muted p-3 text-center">Transação sem registo financeiro.</li>
                          )}
                        </ul>
                      </>
                    )}

                    <div className="hist-modal-totais">
                      <div className="hist-total-linha flex-between mb-1 text-gray-600 font-medium"><span>Subtotal dos Itens</span> <span>{formatCurrency((vendaSelecionada.valorTotal || 0) + (vendaSelecionada.descontoTotal || 0))}</span></div>
                      <div className="hist-total-linha flex-between mb-2 text-rose-500 font-medium"><span>Descontos Aplicados</span> <span>- {formatCurrency(vendaSelecionada.descontoTotal)}</span></div>
                      <div className="hist-total-linha destaque flex-between font-bold border-top border-gray-300">
                          <span style={{color: '#0f172a'}}>Total Final</span>
                          <span className="text-main" style={{fontSize: '1.5rem'}}>{formatCurrency(vendaSelecionada.valorTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hist-modal-footer">

                                <div className="hist-footer-left">
                                    <button className="hist-btn-secondary xml-btn" onClick={() => baixarXML(vendaSelecionada)} data-tooltip="Extrair Arquivo XML Original">
                                        <Download size={18} />
                                        <span>Baixar XML</span>
                                    </button>
                                    <button className="hist-btn-secondary whatsapp-btn" onClick={() => { setZapNumber(vendaSelecionada.clienteTelefone || ''); setShowZapModal(true); }} data-tooltip="Enviar recibo via WhatsApp">
                                        <MessageCircle size={18} color="#10b981" />
                                        <span>WhatsApp</span>
                                    </button>
                                </div>

                                <div className="hist-footer-right">
                                    {vendaSelecionada.tipoNota !== 'NFE' &&
                                                       (vendaSelecionada.statusNfce === 'AUTORIZADA' || vendaSelecionada.status === 'AUTORIZADA' || vendaSelecionada.statusNfce === 'CONCLUIDA') && (
                                                          <button
                                                              className="hist-btn-nfe"
                                                              onClick={() => { setCnpjInput(''); setCompanyData(null); setShowNfeModal(true); }}
                                                              data-tooltip="Gera uma NF-e (Mod. 55) referenciando este Cupom"
                                                          >
                                                              <FileText size={18} />
                                                              <span>Gerar NF-e (B2B)</span>
                                                          </button>
                                                      )}

                                    <button className="hist-btn-primary" onClick={() => imprimirCupomFrontend(vendaSelecionada)} data-tooltip="Imprimir documento fiscal">
                                        <Printer size={18} />
                                        <span>{(vendaSelecionada.tipoNota === 'NFE' || (vendaSelecionada.clienteDocumento && vendaSelecionada.clienteDocumento.replace(/\D/g, '').length === 14)) ? 'Imprimir DANFE' : 'Imprimir Cupom'}</span>
                                    </button>
                                </div>
                              </div>
                </div>
              </div>
            )}

      {/* MODAL DO WHATSAPP */}
      {showZapModal && (
          <div className="hist-modal-overlay z-max">
              <div className="hist-modal-content" style={{maxWidth: '400px', padding: '30px', textAlign: 'center'}}>
                  <h2 style={{margin: '0 0 10px 0', color: '#1e293b'}}>Enviar Recibo</h2>
                  <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '20px'}}>O cliente receberá a nota completa no WhatsApp.</p>

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
  {/* MODAL MÁGICO: PESQUISA CNPJ (CONCIERGE) */}
        {showNfeModal && (
            <div className="hist-modal-overlay z-max">
                <div className="hist-modal-content" style={{maxWidth: '480px', padding: '30px', animation: 'modalScaleUp 0.3s'}}>
                    <h2 style={{margin: '0 0 10px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px'}}><FileText size={24} color="#3b82f6"/> Emitir NF-e (B2B)</h2>
                    <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '20px'}}>Informe o CNPJ da empresa cliente. O sistema preencherá os dados automaticamente.</p>

                    <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                        <input
                            style={{flex: 1, padding: '12px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '1.1rem', outline: 'none', color: '#1e293b', fontWeight: 'bold'}}
                            placeholder="Digite o CNPJ..."
                            value={cnpjInput}
                            onChange={e => setCnpjInput(e.target.value.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").substring(0, 18))}
                            onKeyDown={e => e.key === 'Enter' && !companyData && buscarDadosCnpj()}
                            autoFocus
                        />
                        <button
                                                  onClick={buscarDadosCnpj}
                                                  disabled={loadingCnpj}
                                                  style={{padding: '0 20px', background: '#f8fafc', border: '2px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', transition: '0.2s'}}
                                              >
                            {loadingCnpj ? <div className="hist-spinner-sm" style={{borderColor:'#cbd5e1', borderTopColor:'#475569'}}></div> : 'Buscar'}
                        </button>
                    </div>

                    {companyData && (
                                          <div className="hist-info-card theme-blue" style={{marginBottom: '20px', animation: 'fadeIn 0.3s'}}>
                                              <div style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', marginBottom: '4px'}}>EMPRESA LOCALIZADA</div>
                                              <strong style={{display: 'block', color: '#1e3a8a', fontSize: '1.1rem', marginBottom: '4px'}}>{companyData.razaoSocial}</strong>
                                              <span style={{fontSize: '0.85rem', color: '#475569', display: 'block'}}>{companyData.logradouro}, {companyData.numero} - {companyData.municipio}/{companyData.uf}</span>

                                              <div style={{ display: 'flex', gap: '12px', marginTop: '15px' }}>
                                                  <div style={{ flex: 1 }}>
                                                      <label style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#3b82f6', display: 'block', marginBottom: '4px'}}>INSC. ESTADUAL</label>
                                                      <input
                                                          style={{width: '100%', padding: '8px 10px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.9rem', color: '#1e3a8a', outline: 'none', background: '#ffffff'}}
                                                          value={companyData.ie || ''}
                                                          onChange={e => setCompanyData({...companyData, ie: e.target.value})}
                                                          placeholder="ISENTO ou IE"
                                                      />
                                                  </div>
                                                  <div style={{ flex: 1.5 }}>
                                                      <label style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#3b82f6', display: 'block', marginBottom: '4px'}}>E-MAIL P/ ENVIO (XML/PDF)</label>
                                                      <input
                                                          type="email"
                                                          style={{width: '100%', padding: '8px 10px', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.9rem', color: '#1e3a8a', outline: 'none', background: '#ffffff'}}
                                                          value={companyData.email || ''}
                                                          onChange={e => setCompanyData({...companyData, email: e.target.value})}
                                                          placeholder="email@empresa.com.br"
                                                      />
                                                  </div>
                                              </div>
                                          </div>
                                      )}

                    <div style={{display: 'flex', gap: '10px'}}>
                        <button className="hist-btn-secondary" style={{flex: 1}} onClick={() => { setShowNfeModal(false); setCompanyData(null); }}>Cancelar</button>
                        <button
                           className="hist-btn-primary"
                           style={{flex: 1, padding: '12px'}}
                           onClick={confirmarEmissaoNfeB2B}
                           disabled={!companyData || emitindoNfe}
                        >
                           {emitindoNfe ? <div className="hist-spinner-sm"></div> : 'Confirmar Emissão'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default HistoricoVendas;