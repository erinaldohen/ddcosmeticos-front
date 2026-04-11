import React, { useState, useEffect } from 'react';
import {
    Users, Phone, UserCheck, HeartHandshake,
    MessageCircle, AlertCircle, ShoppingBag, Calendar,
    CheckCircle2, Edit3, Building2, User, AlertTriangle,
    History, FileText, ChevronDown, ChevronUp, Search, TrendingUp,
    Info, Download, FileCode, Receipt, CreditCard, Printer, ExternalLink,
    Package, Hash, X
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './CRM.css';

const maskCPFCNPJ = (v) => {
    if (!v) return '';
    v = v.replace(/\D/g, "");
    if (v.length <= 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
};
const maskTelefone = (v) => {
    if (!v) return '';
    v = v.replace(/\D/g, "");
    return v.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
};
const maskCEP = (v) => {
    if (!v) return '';
    v = v.replace(/\D/g, "");
    return v.replace(/^(\d{5})(\d{1,3})/, "$1-$2");
};

const getRankingTier = (total) => {
    const valor = Number(total) || 0;
    if (valor >= 1000) return { label: 'Premium', class: 'tier-premium', icon: '🌟', width: '100%' };
    if (valor >= 100) return { label: 'Standard', class: 'tier-standard', icon: '⭐', width: '60%' };
    if (valor > 0) return { label: 'Basic', class: 'tier-basic', icon: '✨', width: '25%' };
    return { label: 'Novo', class: 'tier-novo', icon: '🌱', width: '5%' };
};

const validarCadastroSefaz = (cliente, tipoAba) => {
    const erros = [];
    if (!cliente.cep || !cliente.logradouro || !cliente.numero || !cliente.bairro || !cliente.cidade || !cliente.uf) erros.push("Endereço Incompleto");
    if (tipoAba === 'PJ') {
        if (!cliente.inscricaoEstadual) erros.push("IE Ausente");
        const doc = cliente.documento ? cliente.documento.replace(/\D/g, '') : '';
        if (doc.length !== 14) erros.push("CNPJ Inválido");
    }
    return erros;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const CRM = () => {
    const [loading, setLoading] = useState(true);
    const [abaAtiva, setAbaAtiva] = useState('TAREFAS');
    const [searchTerm, setSearchTerm] = useState('');

    const [resumo, setResumo] = useState({ clientesAtivos: 0, clientesEmRisco: 0, recuperadosMes: 0, ticketMedioCRM: 0 });
    const [tarefas, setTarefas] = useState([]);
    const [clientesPF, setClientesPF] = useState([]);
    const [clientesPJ, setClientesPJ] = useState([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [clienteEdit, setClienteEdit] = useState(null);
    const [modalAba, setModalAba] = useState('CADASTRO');

    const [historicoCompras, setHistoricoCompras] = useState([]);
    const [vendaExpandida, setVendaExpandida] = useState(null);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [detalhesVenda, setDetalhesVenda] = useState(null);
    const [configLoja, setConfigLoja] = useState(null);

    const [vendaRealSelecionada, setVendaRealSelecionada] = useState(null);
    const [showZapModal, setShowZapModal] = useState(false);
    const [zapNumber, setZapNumber] = useState('');

    useEffect(() => {
        carregarDashboard();
        carregarClientes('FISICA');
        carregarClientes('JURIDICA');
        api.get('/configuracoes').then(res => setConfigLoja(res.data)).catch(() => {});
    }, []);

    const carregarDashboard = async () => {
        try {
            const { data } = await api.get('/crm/dashboard');
            if (data) {
                setResumo(data.resumo || { clientesAtivos: 0, clientesEmRisco: 0, recuperadosMes: 0, ticketMedioCRM: 0 });
                setTarefas(data.tarefas || []);
            }
        } catch (error) {
            console.error("Erro Dashboard CRM", error);
        } finally {
            setLoading(false);
        }
    };

    const carregarClientes = async (tipo) => {
        try {
            const { data } = await api.get(`/clientes?tipo=${tipo}&size=200`);
            const lista = data.content || [];
            lista.sort((a, b) => (Number(b.totalGasto) || 0) - (Number(a.totalGasto) || 0));
            if (tipo === 'FISICA') setClientesPF(lista);
            else setClientesPJ(lista);
        } catch (error) {
            toast.error(`Falha ao carregar a base ${tipo}.`);
        }
    };

    const chamarNoWhatsapp = (telefone, nome) => {
        const num = telefone ? telefone.replace(/\D/g, '') : '';
        if (num.length < 10) return toast.warning(`Telefone inválido.`);
        window.open(`https://wa.me/55${num}`, '_blank');
    };

    const abrirModalAcao = async (cliente, acao) => {
        setClienteEdit({ ...cliente, documento: maskCPFCNPJ(cliente.documento), telefone: maskTelefone(cliente.telefone), cep: maskCEP(cliente.cep) });
        setModalAba(acao);
        setVendaExpandida(null);
        setDetalhesVenda(null);
        setIsModalOpen(true);

        if (acao === 'HISTORICO') {
            setLoadingHistorico(true);
            try {
                const { data } = await api.get(`/vendas/cliente/${cliente.id}`);
                setHistoricoCompras(data || []);
            } catch (error) {
                setHistoricoCompras([]);
            } finally {
                setLoadingHistorico(false);
            }
        }
    };

    const handleSalvarEdicao = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/clientes/${clienteEdit.id}`, clienteEdit);
            toast.success("Cadastro atualizado com sucesso!");
            carregarClientes('FISICA');
            carregarClientes('JURIDICA');
            setIsModalOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.message || "Erro ao atualizar.");
        }
    };

    const handleInputChange = (e) => {
        let { name, value } = e.target;
        if (name === 'documento') value = maskCPFCNPJ(value);
        if (name === 'telefone') value = maskTelefone(value);
        if (name === 'cep') value = maskCEP(value);
        setClienteEdit(prev => ({ ...prev, [name]: value }));
    };

    const expandirDetalhesVenda = async (idVenda) => {
        if (vendaExpandida === idVenda) {
            setVendaExpandida(null);
            setDetalhesVenda(null);
            return;
        }
        setVendaExpandida(idVenda);
        try {
            const { data } = await api.get(`/vendas/${idVenda}`);
            setDetalhesVenda(data);
        } catch (error) {
            toast.error("Erro ao carregar os detalhes completos da venda.");
            setVendaExpandida(null);
        }
    };

    const acessarVendaReal = async (vendaResumo) => {
        try {
            const idVenda = vendaResumo.idVenda || vendaResumo.id;
            const { data } = await api.get(`/vendas/${idVenda}`);
            setVendaRealSelecionada(data);
        } catch (error) {
            toast.error("Erro ao abrir os detalhes da venda.");
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

    // 🔥 IMPRESSÃO INTELIGENTE: Lê a venda, verifica o CNPJ e gera DANFE ou Cupom
    const imprimirDocumentoFiscal = async (vendaBase) => {
        if (!vendaBase) return toast.warning("Detalhes da venda não carregados.");

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) {
            return toast.error("O bloqueador de Pop-ups impediu a impressão. Permita pop-ups neste site.");
        }

        printWindow.document.write("<html><body><h2 style='font-family: sans-serif; text-align: center; margin-top: 50px; color: #64748b;'>Preparando documento, por favor aguarde...</h2></body></html>");

        const docRaw = vendaBase?.clienteDocumento ? String(vendaBase.clienteDocumento).replace(/\D/g, '') : '';
        const isNfe = vendaBase?.tipoNota === 'NFE' || docRaw.length === 14;

        const loja = configLoja?.loja || {};
        const fiscal = configLoja?.fiscal || {};
        const end = configLoja?.endereco || {};

        const razaoSocial = loja.razaoSocial || "DD COSMÉTICOS LTDA";
        const cnpj = loja.cnpj ? loja.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : "57.648.950/0001-44";
        const enderecoFormatado = end.logradouro ? `${end.logradouro}, ${end.numero} - ${end.bairro}` : "Rua não informada";
        const cidadeUFFormatado = end.cidade ? `${end.cidade} - ${end.uf}` : "Cidade - UF";
        const telefone = loja.telefone || "(81) 99999-9999";

        const numDoc = vendaBase?.numeroNfce || vendaBase?.idVenda || vendaBase?.id || "000000";
        const serieDoc = vendaBase?.serieNfce || fiscal?.serieProducao || "1";

        const chaveAcessoRaw = vendaBase?.chaveAcessoNfce || vendaBase?.chaveAcesso || vendaBase?.chaveNfce || vendaBase?.chave || '00000000000000000000000000000000000000000000';
        const chaveFormatada = chaveAcessoRaw !== '00000000000000000000000000000000000000000000' ? chaveAcessoRaw.replace(/(\d{4})/g, '$1 ').trim() : 'Aguardando SEFAZ';

        const protocolo = vendaBase?.protocolo || 'N/A';
        const dataVendaStr = vendaBase?.dataVenda ? new Date(vendaBase.dataVenda).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
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

        let logradouroDest = "Não Informado";
        let bairroDest = "Não Informado";
        let cepDest = "";

        if (vendaBase?.xmlNota) {
            const destBlockRegex = /<[a-zA-Z0-9_]*:?dest[^>]*>([\s\S]*?)<\/[a-zA-Z0-9_]*:?dest>/i;
            const destMatch = vendaBase.xmlNota.match(destBlockRegex);
            const xmlAlvo = destMatch ? destMatch[1] : vendaBase.xmlNota;

            const extractTag = (xml, tag) => {
                const regex = new RegExp(`<[a-zA-Z0-9_]*:?${tag}[^>]*>(.*?)<\\/[a-zA-Z0-9_]*:?${tag}>`, 'i');
                const match = xml.match(regex);
                return match ? match[1].trim() : '';
            };

            const xLgr = extractTag(xmlAlvo, "xLgr");
            const nro = extractTag(xmlAlvo, "nro");
            const xBairro = extractTag(xmlAlvo, "xBairro");
            const cepRaw = extractTag(xmlAlvo, "CEP");

            if (xLgr) {
                logradouroDest = (nro && nro.toUpperCase() !== 'SN' && nro.toUpperCase() !== 'S/N')
                                 ? `${xLgr}, ${nro}`
                                 : xLgr;
            }
            if (xBairro) bairroDest = xBairro;
            if (cepRaw) cepDest = cepRaw.length === 8 ? cepRaw.replace(/(\d{5})(\d{3})/, "$1-$2") : cepRaw;
        }

        if (logradouroDest === "Não Informado" && vendaBase?.clienteDocumento) {
            try {
                const docL = vendaBase.clienteDocumento.replace(/\D/g, '');
                const resCli = await api.get(`/clientes/documento/${docL}`);
                const cli = resCli.data;

                if (cli && cli.endereco) {
                    const endCompleto = cli.endereco;
                    logradouroDest = endCompleto;
                    bairroDest = "Centro";
                    if (endCompleto.includes('-') && endCompleto.includes('|')) {
                        bairroDest = endCompleto.substring(endCompleto.indexOf('-') + 1, endCompleto.indexOf('|')).trim();
                    }
                    if (endCompleto.includes('CEP:')) {
                        cepDest = endCompleto.substring(endCompleto.indexOf('CEP:') + 4).trim();
                        cepDest = cepDest.length === 8 ? cepDest.replace(/(\d{5})(\d{3})/, "$1-$2") : cepDest;
                    }
                }
            } catch (e) {}
        }

        if (logradouroDest === "Não Informado" && vendaBase?.cliente?.endereco) {
             logradouroDest = vendaBase.cliente.endereco;
        }

        const tribFederal = (totalVenda * 0.15).toFixed(2);
        const tribEstadual = (totalVenda * 0.18).toFixed(2);
        const tribMunicipal = "0.00";

        let printHtml = '';

        if (isNfe) {
            printHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>DANFE NF-e - ${razaoSocial}</title>
                    <style>
                        @page { size: A4 landscape; margin: 5mm; }
                        body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; width: 100%; }
                        .danfe-container { width: 100%; border: 1px solid #000; padding: 5px; box-sizing: border-box;}
                        table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
                        td, th { border: 1px solid #000; padding: 4px; vertical-align: top; }
                        .label { display: block; font-size: 8px; text-transform: uppercase; color: #333; margin-bottom: 2px;}
                        .val { font-size: 12px; font-weight: bold; }
                        .center { text-align: center; } .right { text-align: right; }
                        .title-box { font-size: 12px; font-weight: bold; margin: 10px 0 5px 0; text-transform: uppercase;}
                        .barcode { letter-spacing: 2px; font-size: 14px; text-align: center; margin-top: 10px;}
                    </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <td style="width: 80%;"><span class="label">RECEBEMOS DE ${razaoSocial} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</span><span class="val">&nbsp;</span></td>
                            <td rowspan="2" class="center" style="width: 20%;"><span class="label">NF-e</span><span class="val" style="font-size:16px;">Nº ${numDoc}</span><br><span class="val">Série ${serieDoc}</span></td>
                        </tr>
                        <tr>
                            <td>
                               <div style="display: flex; justify-content: space-between;">
                                  <div style="width: 30%; border-right: 1px solid #000; padding-right: 5px;"><span class="label">DATA DE RECEBIMENTO</span><span class="val">&nbsp;</span></div>
                                  <div style="width: 70%; padding-left: 5px;"><span class="label">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span><span class="val">&nbsp;</span></div>
                               </div>
                            </td>
                        </tr>
                    </table>

                    <div style="border-bottom: 1px dashed #000; margin: 15px 0;"></div>

                    <div class="danfe-container">
                        <table>
                            <tr>
                                <td style="width: 40%; text-align: center; vertical-align: middle;">
                                    <h3 style="margin:5px 0; font-size: 16px;">${razaoSocial}</h3>
                                    <p style="margin:0; font-size: 11px;">${enderecoFormatado}<br>${cidadeUFFormatado}<br>Fone: ${telefone}</p>
                                </td>
                                <td style="width: 20%; text-align: center; vertical-align: middle;">
                                    <h2 style="margin:0; font-size: 20px;">DANFE</h2>
                                    <p style="margin:0; font-size: 9px;">Documento Auxiliar da Nota Fiscal Eletrônica</p>
                                    <p style="margin:10px 0 0 0; font-size: 12px;">0 - ENTRADA<br>1 - SAÍDA <strong>[ 1 ]</strong></p>
                                    <h3 style="margin:5px 0; font-size: 16px;">Nº ${numDoc}</h3>
                                    <p style="margin:0; font-size: 12px;">SÉRIE: ${serieDoc}</p>
                                </td>
                                <td style="width: 40%; vertical-align: middle;">
                                    <div class="barcode">|| |||| || ||||| ||||| ||| ||</div>
                                    <div class="center" style="margin-top: 5px;">
                                        <span class="label">CHAVE DE ACESSO</span>
                                        <span class="val" style="font-size: 14px;">${chaveFormatada}</span>
                                    </div>
                                    <div class="center" style="margin-top: 15px;">
                                        <span class="label">Consulta de autenticidade no portal nacional da NF-e</span>
                                        <span style="font-size:10px;">www.nfe.fazenda.gov.br/portal</span>
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <table>
                            <tr>
                                <td style="width: 60%;"><span class="label">NATUREZA DA OPERAÇÃO</span><span class="val">VENDA DE MERCADORIAS</span></td>
                                <td style="width: 40%;"><span class="label">PROTOCOLO DE AUTORIZAÇÃO DE USO</span><span class="val">${protocolo} - ${dataVendaStr}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 33%;"><span class="label">INSCRIÇÃO ESTADUAL</span><span class="val">${fiscal.inscricaoEstadual || 'ISENTO'}</span></td>
                                <td style="width: 33%;"><span class="label">INSC. ESTADUAL DO SUBST. TRIB.</span><span class="val"></span></td>
                                <td style="width: 34%;"><span class="label">CNPJ</span><span class="val">${cnpj}</span></td>
                            </tr>
                        </table>

                        <div class="title-box">DESTINATÁRIO / REMETENTE</div>
                        <table>
                            <tr>
                                <td style="width: 60%;"><span class="label">NOME / RAZÃO SOCIAL</span><span class="val">${nomeClienteImp || 'CONSUMIDOR'}</span></td>
                                <td style="width: 25%;"><span class="label">CNPJ / CPF</span><span class="val">${docClienteImp}</span></td>
                                <td style="width: 15%;"><span class="label">DATA DA EMISSÃO</span><span class="val">${dataVendaStr.split(' ')[0]}</span></td>
                            </tr>
                        </table>
                        <table>
                            <tr>
                                <td style="width: 45%;"><span class="label">ENDEREÇO</span><span class="val" style="font-size: 10px;">${logradouroDest}</span></td>
                                <td style="width: 25%;"><span class="label">BAIRRO / DISTRITO</span><span class="val" style="font-size: 10px;">${bairroDest}</span></td>
                                <td style="width: 15%;"><span class="label">CEP</span><span class="val">${cepDest}</span></td>
                                <td style="width: 15%;"><span class="label">DATA DA SAÍDA</span><span class="val">${dataVendaStr.split(' ')[0]}</span></td>
                            </tr>
                        </table>

                        <div class="title-box">DADOS DO PRODUTO / SERVIÇOS</div>
                        <table>
                            <tr>
                                <th style="width: 8%;">CÓD.</th>
                                <th style="width: 44%;">DESCRIÇÃO DO PRODUTO</th>
                                <th style="width: 8%;">NCM/SH</th>
                                <th style="width: 5%;">CST</th>
                                <th style="width: 5%;">CFOP</th>
                                <th style="width: 5%;">UN.</th>
                                <th style="width: 5%;">QTD.</th>
                                <th style="width: 10%;">V. UNIT.</th>
                                <th style="width: 10%;">V. TOTAL</th>
                            </tr>
                            ${itensImpressao.map((i, index) => {
                                const unit = i.precoUnitario || i.valorUnitario || i.preco || 0;
                                const ncmProduto = i.ncm || i.produto?.ncm || '33049990';
                                const eanProduto = i.codigoBarras || i.ean || i.produto?.codigoBarras || i.produto?.ean || 'SEM GTIN';
                                return `
                                <tr>
                                    <td class="center">${String(i.produtoId || i.id || index + 1).padStart(3, '0')}</td>
                                    <td>${i.produtoNome || i.nomeProduto || i.nome || i.descricao || 'Produto'}<br><span style="font-size: 7px; color: #555;">EAN: ${eanProduto}</span></td>
                                    <td class="center">${ncmProduto}</td>
                                    <td class="center">102</td>
                                    <td class="center">5102</td>
                                    <td class="center">UN</td>
                                    <td class="right">${i.quantidade}</td>
                                    <td class="right">${unit.toFixed(2)}</td>
                                    <td class="right">${(i.quantidade * unit).toFixed(2)}</td>
                                </tr>
                                `
                            }).join('')}
                        </table>

                        <div class="title-box">CÁLCULO DO IMPOSTO</div>
                        <table>
                            <tr>
                                <td style="width: 20%;"><span class="label">BASE DE CÁLCULO DO ICMS</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">VALOR DO ICMS</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">BASE CÁLC. ICMS SUBST.</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">VALOR ICMS SUBST.</span><span class="val right">0,00</span></td>
                                <td style="width: 20%;"><span class="label">VALOR TOTAL DOS PRODUTOS</span><span class="val right">${subtotalBase.toFixed(2)}</span></td>
                            </tr>
                            <tr>
                                <td><span class="label">VALOR DO FRETE</span><span class="val right">0,00</span></td>
                                <td><span class="label">VALOR DO SEGURO</span><span class="val right">0,00</span></td>
                                <td><span class="label">DESCONTO</span><span class="val right">${descontosImpressao.toFixed(2)}</span></td>
                                <td><span class="label">OUTRAS DESP. ACESSÓRIAS</span><span class="val right">0,00</span></td>
                                <td><span class="label">VALOR TOTAL DA NOTA</span><span class="val right">${totalVenda.toFixed(2)}</span></td>
                            </tr>
                        </table>

                        <div class="title-box">DADOS ADICIONAIS</div>
                        <table style="height: 60px;">
                            <tr>
                                <td><span class="label">INFORMAÇÕES COMPLEMENTARES</span><span class="val" style="font-size: 10px;">Documento emitido por ME ou EPP optante pelo Simples Nacional.<br>Trib aprox R$ ${tribFederal} Fed e R$ ${tribEstadual} Est. Fonte: IBPT.</span></td>
                            </tr>
                        </table>
                    </div>

                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 500);
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
                    <div class="center" style="font-size:9px;">${enderecoFormatado}</div>
                    <div class="center" style="font-size:9px;">${cidadeUFFormatado} - Tel: ${telefone}</div>
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
                            const unit = i.precoUnitario || 0;
                            const eanProd = i.codigoBarras || i.ean || 'SEM GTIN';
                            return `
                            <tr>
                                <td class="left">${String(i.produtoId || index + 1).padStart(3, '0')}</td>
                                <td class="left">${i.produtoNome || 'Produto'}<br><span style="font-size:7px;">EAN:${eanProd}</span></td>
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

                    <div class="center bold" style="font-size:10px;">Emissão: ${dataVendaStr}</div>
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

        const vendaBase = vendaRealSelecionada;
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

    if (loading) return <div className="crm-loader"><div className="spinner"></div><h2>A inicializar Inteligência...</h2></div>;

    const baseClientes = abaAtiva === 'PF' ? clientesPF : clientesPJ;
    const clientesFiltrados = baseClientes.filter(c =>
        c.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || c.documento?.includes(searchTerm.replace(/\D/g, ''))
    );

    return (
        <div className="crm-container animate-fade">

            <div className="crm-header-cards">
                <div className="kpi-card crm-primary" data-tooltip-down="Compraram nos últimos 30 dias">
                    <div className="kpi-icon"><Users size={24}/></div>
                    <div className="kpi-data"><span>Ativos <Info size={14}/></span><h3>{resumo.clientesAtivos}</h3></div>
                </div>
                <div className="kpi-card crm-danger" data-tooltip-down="Sem comprar há mais de 60 dias">
                    <div className="kpi-icon"><AlertCircle size={24}/></div>
                    <div className="kpi-data"><span>Risco de Fuga <Info size={14}/></span><h3>{resumo.clientesEmRisco}</h3></div>
                </div>
                <div className="kpi-card crm-success" data-tooltip-down="Inativos que voltaram a comprar">
                    <div className="kpi-icon"><TrendingUp size={24}/></div>
                    <div className="kpi-data"><span>Recuperados <Info size={14}/></span><h3>{resumo.recuperadosMes}</h3></div>
                </div>
                <div className="kpi-card crm-warning" data-tooltip-down="Média de dinheiro deixado por cliente">
                    <div className="kpi-icon"><ShoppingBag size={24}/></div>
                    <div className="kpi-data"><span>LTV Médio <Info size={14}/></span><h3>R$ {Number(resumo.ticketMedioCRM || 0).toFixed(2)}</h3></div>
                </div>
            </div>

            <div className="crm-toolbar">
                <div className="crm-tabs">
                    <button className={abaAtiva === 'TAREFAS' ? 'active' : ''} onClick={() => setAbaAtiva('TAREFAS')}>
                        <MessageCircle size={18}/> Funil de Vendas {tarefas.length > 0 && <span className="badge-count">{tarefas.length}</span>}
                    </button>
                    <button className={abaAtiva === 'PF' ? 'active' : ''} onClick={() => setAbaAtiva('PF')}><User size={18}/> B2C (Física)</button>
                    <button className={abaAtiva === 'PJ' ? 'active' : ''} onClick={() => setAbaAtiva('PJ')}><Building2 size={18}/> B2B (Jurídica)</button>
                </div>
                {(abaAtiva === 'PF' || abaAtiva === 'PJ') && (
                    <div className="crm-search-box">
                        <Search size={18} color="#64748b"/>
                        <input type="text" placeholder="Buscar por nome ou documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                )}
            </div>

            {abaAtiva === 'TAREFAS' && (
                <div className="crm-tarefas-grid">
                     {tarefas.length === 0 ? (
                        <div className="crm-empty-state"><CheckCircle2 size={60} color="#10b981" /><h3>Funil Limpo!</h3></div>
                    ) : (
                        tarefas.map(tarefa => (
                            <div key={tarefa.id} className="tarefa-card">
                                <div className={`tarefa-badge ${tarefa.tipo.toLowerCase()}`}>
                                    {tarefa.tipo === 'REPOSICAO' ? '♻️ Reposição' : tarefa.tipo === 'CHURN' ? '⚠️ Risco' : '✨ Upsell'}
                                </div>
                                <h3 className="tarefa-cliente">{tarefa.clienteNome}</h3>
                                <div className="tarefa-info">
                                    <span><Calendar size={14}/> Última vez: {tarefa.diasUltimaCompra} dias</span>
                                    <span><ShoppingBag size={14}/> Foco: {tarefa.produtoFoco}</span>
                                </div>
                                <div className="tarefa-mensagem"><strong>Sugerido:</strong><p>"{tarefa.mensagemSugerida}"</p></div>
                                <button className="btn-whatsapp" onClick={() => chamarNoWhatsapp(tarefa.telefone, tarefa.clienteNome)}><Phone size={18}/> Enviar Proposta</button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {(abaAtiva === 'PF' || abaAtiva === 'PJ') && (
                <div className="crm-table-container">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th>Ranking</th>
                                <th>{abaAtiva === 'PJ' ? 'Razão Social' : 'Nome'}</th>
                                <th className="hide-mobile">Documento</th>
                                {abaAtiva === 'PJ' && <th className="hide-mobile">Inscrição Est.</th>}
                                <th>Engajamento</th>
                                <th className="hide-mobile">Sefaz</th>
                                <th>Ações Rápidas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientesFiltrados.length === 0 ? (
                                <tr><td colSpan="8" style={{textAlign:'center', padding:'3rem'}}>Nenhum cliente atende aos filtros.</td></tr>
                            ) : (
                                clientesFiltrados.map(cliente => {
                                    const tier = getRankingTier(cliente.totalGasto);
                                    const errosSefaz = validarCadastroSefaz(cliente, abaAtiva);
                                    return (
                                        <tr key={cliente.id}>
                                            <td><span className={`tier-badge ${tier.class}`}>{tier.icon} {tier.label}</span></td>
                                            <td><strong>{cliente.nome}</strong></td>
                                            <td className="nowrap-text hide-mobile">{maskCPFCNPJ(cliente.documento) || '-'}</td>

                                            {abaAtiva === 'PJ' && <td className="hide-mobile">
                                                <span className={`badge-ie ${!cliente.inscricaoEstadual || cliente.inscricaoEstadual === 'ISENTO' ? 'isento' : 'ativo'}`}>
                                                    {cliente.inscricaoEstadual || 'ISENTO'}
                                                </span>
                                            </td>}

                                            <td>
                                                <div className="engajamento-container">
                                                    <strong>R$ {Number(cliente.totalGasto || 0).toFixed(2)}</strong>
                                                    <div className="progress-bg"><div className="progress-bar" style={{width: tier.width, backgroundColor: tier.class.includes('premium') ? '#f59e0b' : tier.class.includes('standard') ? '#3b82f6' : '#94a3b8'}}></div></div>
                                                </div>
                                            </td>

                                            <td className="hide-mobile">
                                                {errosSefaz.length > 0 ? (
                                                    <span className="sefaz-alert"><AlertTriangle size={16}/> Ajustar</span>
                                                ) : (
                                                    <span className="sefaz-ok"><CheckCircle2 size={16}/> OK</span>
                                                )}
                                            </td>

                                            <td>
                                                <div className="quick-actions">
                                                    <button className="btn-action whatsapp" data-tooltip="WhatsApp" onClick={() => chamarNoWhatsapp(cliente.telefone, cliente.nome)}><Phone size={16} /></button>
                                                    <button className="btn-action edit" data-tooltip="Corrigir Fiscal" onClick={() => abrirModalAcao(cliente, 'CADASTRO')}><Edit3 size={16} /></button>
                                                    <button className="btn-action history" data-tooltip="Ver Histórico" onClick={() => abrirModalAcao(cliente, 'HISTORICO')}><History size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL CONDICIONAL DE CORREÇÃO FISCAL E HISTÓRICO RÁPIDO */}
            {isModalOpen && clienteEdit && (
                <div className="crm-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="crm-modal-content animate-popIn" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div>
                                <h2>{modalAba === 'CADASTRO' ? `Correção Fiscal: ${clienteEdit.nome}` : `Faturamento: ${clienteEdit.nome}`}</h2>
                                <p>{modalAba === 'CADASTRO' ? 'Ajuste os dados rejeitados pela SEFAZ.' : 'Visualize o histórico de notas.'}</p>
                            </div>
                            <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        {modalAba === 'CADASTRO' && (
                            <form onSubmit={handleSalvarEdicao} className="crm-modal-form">
                                {validarCadastroSefaz(clienteEdit, abaAtiva).length > 0 && (
                                    <div className="alert-box-sefaz">
                                        <AlertTriangle size={20}/>
                                        <div><strong>Risco de Rejeição SEFAZ</strong><p>Preencha: {validarCadastroSefaz(clienteEdit, abaAtiva).join(', ')}.</p></div>
                                    </div>
                                )}
                                <div className="form-section">
                                    <div className="form-grid-crm">
                                        <div className="form-group-crm full-width"><label>Razão Social / Nome</label><input type="text" name="nome" value={clienteEdit.nome || ''} onChange={handleInputChange} required/></div>
                                        <div className="form-group-crm"><label>CPF / CNPJ</label><input type="text" name="documento" value={clienteEdit.documento || ''} onChange={handleInputChange}/></div>
                                        <div className="form-group-crm"><label>WhatsApp</label><input type="text" name="telefone" value={clienteEdit.telefone || ''} onChange={handleInputChange}/></div>
                                    </div>
                                </div>
                                {abaAtiva === 'PJ' && (
                                    <div className="form-section ie-section">
                                        <div className="form-group-crm ie-input-group">
                                            <label className="title-alert">Inscrição Estadual (SEFAZ) ⚠️</label>
                                            <input type="text" name="inscricaoEstadual" value={clienteEdit.inscricaoEstadual || ''} onChange={handleInputChange} className="input-ie-master"/>
                                            <small className="ie-help-text">Rejeitou? Digite <b>ISENTO</b>.</small>
                                        </div>
                                    </div>
                                )}
                                <div className="form-section">
                                    <h4 className="section-title">Endereço</h4>
                                    <div className="form-grid-crm address-grid">
                                        <div className="form-group-crm cep-group"><label>CEP</label><input type="text" name="cep" value={clienteEdit.cep || ''} onChange={handleInputChange} maxLength={9}/></div>
                                        <div className="form-group-crm uf-group"><label>UF</label><input type="text" name="uf" value={clienteEdit.uf || ''} onChange={handleInputChange} maxLength={2} style={{textTransform: 'uppercase'}}/></div>
                                        <div className="form-group-crm full-width"><label>Logradouro</label><input type="text" name="logradouro" value={clienteEdit.logradouro || ''} onChange={handleInputChange}/></div>
                                        <div className="form-group-crm num-group"><label>Nº</label><input type="text" name="numero" value={clienteEdit.numero || ''} onChange={handleInputChange}/></div>
                                        <div className="form-group-crm bairro-group"><label>Bairro</label><input type="text" name="bairro" value={clienteEdit.bairro || ''} onChange={handleInputChange}/></div>
                                        <div className="form-group-crm full-width"><label>Cidade</label><input type="text" name="cidade" value={clienteEdit.cidade || ''} onChange={handleInputChange}/></div>
                                    </div>
                                </div>
                                <div className="crm-modal-footer">
                                    <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Sair</button>
                                    <button type="submit" className="btn-modal-save">Salvar Cadastro</button>
                                </div>
                            </form>
                        )}

                        {modalAba === 'HISTORICO' && (
                            <div className="historico-compras-container">
                                {loadingHistorico ? (
                                    <p style={{padding:'20px', textAlign:'center', color:'#64748b'}}>Lendo XMLs...</p>
                                ) : historicoCompras.length === 0 ? (
                                    <div className="historico-empty">Nenhum registo fiscal emitido para este cliente.</div>
                                ) : (
                                    historicoCompras.map((venda) => (
                                        <div key={venda.id} className="historico-item">
                                            <div className="historico-header" onClick={() => expandirDetalhesVenda(venda.id)}>
                                                <div className="hist-info">
                                                    <strong>Venda #{venda.id}</strong>
                                                    <span>{new Date(venda.dataVenda).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="hist-valores">
                                                    <span className={`status-nfce ${venda.statusNfce?.toLowerCase()}`}>{venda.statusNfce}</span>
                                                    <strong>R$ {Number(venda.valorTotal).toFixed(2)}</strong>
                                                    <button className="hist-btn-icon" onClick={(e) => { e.stopPropagation(); acessarVendaReal(detalhesVenda || venda); }}>
                                                        <ExternalLink size={18} color="#3b82f6" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* =========================================================================
                🔥 O MODAL GIGANTE DE DETALHES (O MESMO DO HISTÓRICO DE VENDAS)
            ========================================================================= */}
            {vendaRealSelecionada && (
                <div className="hist-modal-overlay" onClick={() => setVendaRealSelecionada(null)}>
                  <div className="hist-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="hist-modal-header">
                      <h3>Detalhes da Venda #{vendaRealSelecionada.idVenda || vendaRealSelecionada.id}</h3>
                      <button className="hist-btn-close" onClick={() => setVendaRealSelecionada(null)}><X size={20} /></button>
                    </div>

                    <div className="hist-modal-body">
                      <div className="hist-modal-info-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                        <div className="hist-info-box">
                          <span className="label"><User size={14}/> Cliente</span>
                          <strong>{vendaRealSelecionada.clienteNome || 'Consumidor Final'}</strong><br />
                          {vendaRealSelecionada.clienteDocumento && (
                              <span className="text-small text-muted block mt-1">
                                  {vendaRealSelecionada.clienteDocumento.replace(/\D/g, '').length === 14 ? 'CNPJ: ' : 'CPF: '}
                                  {vendaRealSelecionada.clienteDocumento.replace(/\D/g, '')
                                      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                                      .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                                  }
                              </span>
                          )}
                        </div>
                        <div className="hist-info-box">
                          <span className="label"><Calendar size={14}/> Data / Hora</span>
                          <strong>{vendaRealSelecionada.dataVenda ? new Date(vendaRealSelecionada.dataVenda).toLocaleString('pt-BR') : '-'}</strong>
                        </div>
                        <div className="hist-info-box">
                          <span className="label"><Hash size={14}/> Status Fiscal</span>
                          <strong className={vendaRealSelecionada.statusNfce === 'AUTORIZADA' ? 'text-success' : 'text-warning'}>
                              {vendaRealSelecionada.statusNfce || vendaRealSelecionada.status || 'PENDENTE'}
                          </strong>
                          {vendaRealSelecionada.chaveAcesso && (
                              <span className="text-small text-muted block mt-1" title="Chave SEFAZ" style={{fontSize:'10px', wordBreak: 'break-all'}}>
                                 {vendaRealSelecionada.chaveAcesso}
                              </span>
                          )}
                        </div>
                      </div>

                        <>
                          <h4 className="mt-4 border-bottom pb-2"><Package size={16} className="mr-2 text-main"/> Produtos Adquiridos</h4>
                          <ul className="hist-modal-lista-itens mt-3">
                            {vendaRealSelecionada.itens && vendaRealSelecionada.itens.length > 0 ? (
                              vendaRealSelecionada.itens.map((item, idx) => {
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
                            {vendaRealSelecionada.pagamentos && vendaRealSelecionada.pagamentos.length > 0 ? (
                               vendaRealSelecionada.pagamentos.map((pg, idx) => {
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

                      <div className="hist-modal-totais mt-4 p-3 bg-gray-100 rounded-lg">
                        <div className="hist-total-linha flex-between mb-1 text-gray-600"><span>Subtotal dos Itens</span> <span>{formatCurrency((vendaRealSelecionada.valorTotal || 0) + (vendaRealSelecionada.descontoTotal || 0))}</span></div>
                        <div className="hist-total-linha flex-between mb-2 text-red-500"><span>Descontos Aplicados</span> <span>- {formatCurrency(vendaRealSelecionada.descontoTotal)}</span></div>
                        <div className="hist-total-linha destaque flex-between font-bold text-lg border-top pt-2 border-gray-300">
                            <span>Total Final</span>
                            <span className="text-main">{formatCurrency(vendaRealSelecionada.valorTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hist-modal-footer">
                      <button className="hist-btn-secondary" onClick={() => baixarArquivoXML(vendaRealSelecionada.idVenda || vendaRealSelecionada.id)}>
                          <FileCode size={18}/> XML
                      </button>

                      <button className="hist-btn-success" style={{marginLeft: 'auto'}} onClick={() => { setZapNumber(vendaRealSelecionada.clienteTelefone || ''); setShowZapModal(true); }}>
                        <MessageCircle size={18}/> WhatsApp
                      </button>

                      {/* 🔥 O BOTÃO DETETA CNPJ 14 DIGITOS OU NFE E MUDA PARA DANFE */}
                      <button className="hist-btn-primary" onClick={() => imprimirDocumentoFiscal(vendaRealSelecionada)}>
                        <Printer size={18}/> {(vendaRealSelecionada.tipoNota === 'NFE' || (vendaRealSelecionada.clienteDocumento && String(vendaRealSelecionada.clienteDocumento).replace(/\D/g, '').length === 14)) ? 'DANFE' : 'Cupom'}
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
                            <button className="hist-btn-secondary" style={{flex: 1, justifyContent:'center'}} onClick={() => setShowZapModal(false)}>Voltar</button>
                            <button className="hist-btn-success" style={{flex: 1, justifyContent:'center'}} onClick={enviarWhatsAppBodyCompleto}>Enviar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRM;