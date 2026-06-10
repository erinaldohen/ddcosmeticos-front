import React, { useState, useEffect } from 'react';
import {
    Users, Phone, UserCheck, HeartHandshake,
    MessageCircle, AlertCircle, ShoppingBag, Calendar,
    CheckCircle2, Edit3, Building2, User, AlertTriangle,
    History, FileText, ChevronDown, ChevronUp, Search, TrendingUp,
    Info, Download, FileCode, Receipt, CreditCard, Printer, ExternalLink,
    Package, Hash, X, Mail, MapPin, RefreshCw
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
    const [loadingCnpj, setLoadingCnpj] = useState(false);

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
        setClienteEdit({
            ...cliente,
            documento: maskCPFCNPJ(cliente.documento),
            telefone: maskTelefone(cliente.telefone),
            cep: maskCEP(cliente.cep)
        });
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

    const consultarCnpjCliente = async () => {
        const cnpjLimpo = clienteEdit.documento ? clienteEdit.documento.replace(/\D/g, '') : '';
        if (cnpjLimpo.length !== 14) return toast.warning("CNPJ incompleto para busca.");

        setLoadingCnpj(true);
        const toastId = toast.loading("Buscando dados na Receita Federal...");

        try {
            const resPrincipal = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);

            if (resPrincipal.ok) {
                const data = await resPrincipal.json();
                const est = data.estabelecimento;

                let ieEncontrada = 'ISENTO';
                if (est.inscricoes_estaduais && est.inscricoes_estaduais.length > 0) {
                    const ieAtiva = est.inscricoes_estaduais.find(i => i.ativa);
                    ieEncontrada = ieAtiva ? ieAtiva.inscricao_estadual : est.inscricoes_estaduais[0].inscricao_estadual;
                }

                const telCompleto = (est.ddd1 && est.telefone1) ? `${est.ddd1}${est.telefone1}` : '';
                const emailCnpj = est.email || '';

                setClienteEdit(prev => ({
                    ...prev,
                    nome: data.razao_social?.toUpperCase() || prev.nome,
                    nomeFantasia: (est.nome_fantasia || data.razao_social)?.toUpperCase() || prev.nomeFantasia,
                    inscricaoEstadual: ieEncontrada,
                    email: emailCnpj.toLowerCase() || prev.email,
                    telefone: maskTelefone(telCompleto) || prev.telefone,
                    cep: maskCEP(est.cep || '') || prev.cep,
                    logradouro: est.logradouro?.toUpperCase() || prev.logradouro,
                    numero: est.numero || prev.numero || 'SN',
                    complemento: est.complemento?.toUpperCase() || prev.complemento,
                    bairro: est.bairro?.toUpperCase() || prev.bairro,
                    cidade: est.cidade?.nome?.toUpperCase() || prev.cidade,
                    uf: est.estado?.sigla?.toUpperCase() || prev.uf
                }));

                toast.dismiss(toastId);
                toast.success("Dados fiscais atualizados com sucesso!");
                setLoadingCnpj(false);
                return;
            }
        } catch (e) {
            console.warn("CNPJ.ws falhou, tentando fallback na BrasilAPI...");
        }

        try {
            const resFallback = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
            if (!resFallback.ok) throw new Error('CNPJ não encontrado.');
            const dados = await resFallback.json();

            setClienteEdit(prev => ({
                ...prev,
                nome: dados.razao_social?.toUpperCase() || prev.nome,
                email: dados.email?.toLowerCase() || prev.email,
                telefone: maskTelefone(dados.ddd_telefone_1 || dados.telefone || prev.telefone),
                cep: maskCEP(dados.cep || '') || prev.cep,
                logradouro: dados.logradouro?.toUpperCase() || prev.logradouro,
                numero: dados.numero || prev.numero || 'SN',
                complemento: dados.complemento?.toUpperCase() || prev.complemento,
                bairro: dados.bairro?.toUpperCase() || prev.bairro,
                cidade: dados.municipio?.toUpperCase() || prev.cidade,
                uf: dados.uf?.toUpperCase() || prev.uf
            }));

            toast.dismiss(toastId);
            toast.info("Dados atualizados. Preencha a I.E. manualmente.");
        } catch (error) {
            toast.dismiss(toastId);
            toast.error("Falha na busca. Verifique se o CNPJ é válido.");
        } finally {
            setLoadingCnpj(false);
        }
    };

    const handleSalvarEdicao = async (e) => {
            e.preventDefault();
            const toastId = toast.loading("A guardar alterações no banco de dados...");
            try {
                await api.put(`/clientes/${clienteEdit.id}`, clienteEdit);
                toast.update(toastId, { render: "Cadastro atualizado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });
                carregarClientes('FISICA');
                carregarClientes('JURIDICA');
                setIsModalOpen(false);
            } catch (error) {
                let msgErro = "Falha de comunicação com o servidor.";
                if (error.response && error.response.data) {
                    msgErro = typeof error.response.data === 'string'
                            ? error.response.data
                            : (error.response.data.message || error.response.data.error || msgErro);
                }
                toast.update(toastId, { render: "Recusado: " + msgErro, type: "error", isLoading: false, autoClose: 8000 });
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

    const baixarArquivoXML = async (idVenda) => {
        try {
            const res = await api.get(`/vendas/${idVenda}`);
            const xmlContent = res.data.xmlNota;
            if (!xmlContent) return toast.warning("O XML ainda não está disponível.");
            const blob = new Blob([xmlContent], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DocumentoFiscal_${idVenda}.xml`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            toast.error("Erro ao baixar XML.");
        }
    };

    const imprimirDocumentoFiscal = async (vendaBase) => {
        if (vendaBase?.tipoNota === 'NFE') {
            try {
                toast.info("A gerar PDF da DANFE...");
                const response = await api.get(`/fiscal/nfe/${vendaBase.idVenda || vendaBase.id}/pdf`, { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                window.open(url, '_blank');
                return;
            } catch (error) {
                return toast.error("Falha ao gerar o PDF da DANFE.");
            }
        }
        toast.info("Função de impressão acionada.");
    };

    const enviarWhatsAppBodyCompleto = () => {
        if(!zapNumber || zapNumber.length < 10) return toast.warning("Digite um número válido com DDD.");
        window.open(`https://api.whatsapp.com/send?phone=55${zapNumber.replace(/\D/g, '')}&text=DocumentoFiscal`, '_blank');
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
                                <tr><td colSpan="8" className="text-center-p3">Nenhum cliente atende aos filtros.</td></tr>
                            ) : (
                                clientesFiltrados.map(cliente => {
                                    const tier = getRankingTier(cliente.totalGasto);
                                    const errosSefaz = validarCadastroSefaz(cliente, abaAtiva);
                                    return (
                                        <tr key={cliente.id}>
                                            <td data-label="Ranking"><span className={`tier-badge ${tier.class}`}>{tier.icon} {tier.label}</span></td>
                                            <td data-label={abaAtiva === 'PJ' ? 'Razão Social' : 'Nome'}><strong>{cliente.nome}</strong></td>
                                            <td data-label="Documento" className="nowrap-text hide-mobile">{maskCPFCNPJ(cliente.documento) || '-'}</td>

                                            {abaAtiva === 'PJ' && <td data-label="Inscrição Est." className="hide-mobile">
                                                <span className={`badge-ie ${!cliente.inscricaoEstadual || cliente.inscricaoEstadual === 'ISENTO' ? 'isento' : 'ativo'}`}>
                                                    {cliente.inscricaoEstadual || 'ISENTO'}
                                                </span>
                                            </td>}

                                            <td data-label="Engajamento">
                                                <div className="engajamento-container">
                                                    <strong>R$ {Number(cliente.totalGasto || 0).toFixed(2)}</strong>
                                                    <div className="progress-bg">
                                                        <div className={`progress-bar bg-${tier.class.replace('tier-', '')}`} style={{width: tier.width}}></div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td data-label="Situação Sefaz" className="hide-mobile">
                                                {errosSefaz.length > 0 ? (
                                                    <span className="sefaz-alert"><AlertTriangle size={16}/> Ajustar</span>
                                                ) : (
                                                    <span className="sefaz-ok"><CheckCircle2 size={16}/> OK</span>
                                                )}
                                            </td>

                                            <td data-label="Ações" className="border-none">
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

            {/* MODAL CONDICIONAL: CORREÇÃO FISCAL COM NOVO DESIGN */}
            {isModalOpen && clienteEdit && (
                <div className="crm-modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="crm-modal-content animate-popIn" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div>
                                <h2>{modalAba === 'CADASTRO' ? `Dossiê Fiscal: ${clienteEdit.nome || 'Cliente'}` : `Faturamento: ${clienteEdit.nome}`}</h2>
                                <p>{modalAba === 'CADASTRO' ? 'Revise os dados cadastrais para evitar rejeições na SEFAZ.' : 'Visualize o histórico de notas.'}</p>
                            </div>
                            <button className="btn-close-modal" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
                        </div>

                        {modalAba === 'CADASTRO' && (
                            <form onSubmit={handleSalvarEdicao} className="crm-modal-form">
                                {validarCadastroSefaz(clienteEdit, abaAtiva).length > 0 && (
                                    <div className="alert-box-sefaz">
                                        <AlertTriangle size={24}/>
                                        <div>
                                            <strong>Atenção Fisco</strong>
                                            <p>Preencha os campos obrigatórios: {validarCadastroSefaz(clienteEdit, abaAtiva).join(', ')}.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="crm-cards-wrapper">
                                    {/* CARD 1: IDENTIFICAÇÃO */}
                                                                        <div className="crm-form-card theme-blue">
                                                                            <h4 className="card-title"><Building2 size={18}/> Identificação Principal</h4>
                                                                            <div className="form-grid-crm mt-15">
                                                                                <div className="form-group-crm full-width">
                                                                                    <label>Razão Social / Nome</label>
                                                                                    <input type="text" name="nome" value={clienteEdit.nome || ''} onChange={handleInputChange} required placeholder="Nome Completo"/>
                                                                                </div>

                                                                                <div className="form-group-crm cnpj-search-group">
                                                                                    <label>CPF / CNPJ</label>
                                                                                    <div className="input-with-button">
                                                                                        <input type="text" name="documento" value={clienteEdit.documento || ''} onChange={handleInputChange} placeholder="000.000.000-00"/>
                                                                                        {(abaAtiva === 'PJ' || (clienteEdit.documento && clienteEdit.documento.replace(/\D/g, '').length === 14)) && (
                                                                                            <button
                                                                                                type="button"
                                                                                                className="btn-search-cnpj"
                                                                                                onClick={consultarCnpjCliente}
                                                                                                disabled={loadingCnpj}
                                                                                                data-tooltip="Puxar dados da Receita"
                                                                                            >
                                                                                                {loadingCnpj ? <RefreshCw size={16} className="spin-anim"/> : <Search size={16}/>}
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {abaAtiva === 'PJ' && (
                                                                                    <div className="form-group-crm">
                                                                                        <label className="ie-destaque"><FileText size={14}/> Insc. Estadual (SEFAZ)</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            name="inscricaoEstadual"
                                                                                            value={clienteEdit.inscricaoEstadual || ''}
                                                                                            onChange={handleInputChange}
                                                                                            className="input-ie-destaque"
                                                                                            placeholder="ISENTO ou IE"
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* CARD 2: CONTACTO */}
                                                                        <div className="crm-form-card theme-emerald">
                                                                            <h4 className="card-title"><Phone size={18}/> Contacto e Comunicação</h4>
                                                                            <div className="form-grid-crm">
                                                                                <div className="form-group-crm">
                                                                                    <label><MessageCircle size={14}/> WhatsApp</label>
                                                                                    <input type="text" name="telefone" value={clienteEdit.telefone || ''} onChange={handleInputChange} placeholder="(00) 00000-0000"/>
                                                                                </div>
                                                                                <div className="form-group-crm">
                                                                                    <label className="label-highlight"><Mail size={14}/> E-mail para NF-e</label>
                                                                                    <input
                                                                                        type="email"
                                                                                        name="email"
                                                                                        value={clienteEdit.email || ''}
                                                                                        onChange={handleInputChange}
                                                                                        className="input-highlight"
                                                                                        placeholder="email@empresa.com"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                    {/* CARD 3: ENDEREÇO */}
                                    <div className="crm-form-card theme-purple">
                                        <h4 className="card-title"><MapPin size={18}/> Endereço de Faturamento</h4>
                                        <div className="form-grid-crm address-grid">
                                            <div className="form-group-crm cep-group">
                                                <label>CEP</label>
                                                <input type="text" name="cep" value={clienteEdit.cep || ''} onChange={handleInputChange} maxLength={9} placeholder="00000-000"/>
                                            </div>
                                            <div className="form-group-crm uf-group">
                                                <label>UF</label>
                                                <input type="text" name="uf" value={clienteEdit.uf || ''} onChange={handleInputChange} maxLength={2} className="uppercase-input" placeholder="PE"/>
                                            </div>
                                            <div className="form-group-crm full-width">
                                                <label>Logradouro</label>
                                                <input type="text" name="logradouro" value={clienteEdit.logradouro || ''} onChange={handleInputChange} placeholder="Rua / Avenida"/>
                                            </div>
                                            <div className="form-group-crm num-group">
                                                <label>Número</label>
                                                <input type="text" name="numero" value={clienteEdit.numero || ''} onChange={handleInputChange} placeholder="SN"/>
                                            </div>
                                            <div className="form-group-crm bairro-group">
                                                <label>Bairro</label>
                                                <input type="text" name="bairro" value={clienteEdit.bairro || ''} onChange={handleInputChange} placeholder="Centro"/>
                                            </div>
                                            <div className="form-group-crm full-width">
                                                <label>Cidade</label>
                                                <input type="text" name="cidade" value={clienteEdit.cidade || ''} onChange={handleInputChange} placeholder="Município"/>
                                            </div>
                                            <div className="form-group-crm full-width">
                                                <label>Complemento</label>
                                                <input type="text" name="complemento" value={clienteEdit.complemento || ''} onChange={handleInputChange} placeholder="Sala, Galpão, Apto..."/>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="crm-modal-footer">
                                    <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Sair sem Salvar</button>
                                    <button type="submit" className="btn-modal-save"><CheckCircle2 size={18}/> Confirmar Dossiê Fiscal</button>
                                </div>
                            </form>
                        )}

                        {modalAba === 'HISTORICO' && (
                            <div className="historico-compras-container">
                                {loadingHistorico ? (
                                    <div className="crm-loading-mini"><RefreshCw size={24} className="spin-anim"/> <span>Lendo histórico fiscal...</span></div>
                                ) : historicoCompras.length === 0 ? (
                                    <div className="historico-empty"><Receipt size={40} color="#cbd5e1"/> <p>Nenhum registo fiscal emitido para este cliente.</p></div>
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

            {/* O MODAL DA VENDA REAL EXPANSDIDA (MIGRADO DO PDV) */}
            {vendaRealSelecionada && (
                <div className="hist-modal-overlay" onClick={() => setVendaRealSelecionada(null)}>
                  <div className="hist-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="hist-modal-header">
                      <h3>Detalhes da Venda #{vendaRealSelecionada.idVenda || vendaRealSelecionada.id}</h3>
                      <button className="hist-btn-close" onClick={() => setVendaRealSelecionada(null)}><X size={20} /></button>
                    </div>

                    <div className="hist-modal-body">
                      <div className="hist-modal-info-grid grid-auto-fit">
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
                              <span className="text-small text-muted block mt-1 text-mini-break" title="Chave SEFAZ">
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
                               <li className="empty-list-msg">Nenhum item encontrado neste cupom.</li>
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
                               <li className="empty-list-msg">Transação sem registo financeiro.</li>
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

                      <button className="hist-btn-success ml-auto" onClick={() => { setZapNumber(vendaRealSelecionada.clienteTelefone || ''); setShowZapModal(true); }}>
                        <MessageCircle size={18}/> WhatsApp
                      </button>

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
                    <div className="hist-modal-content zap-modal-container">
                        <h2 className="zap-modal-title">Enviar Recibo</h2>
                        <p className="zap-modal-desc">O cliente receberá a nota completa no WhatsApp.</p>

                        <div className="zap-input-wrapper">
                            <label className="zap-input-label">NÚMERO DO WHATSAPP</label>
                            <input
                                className="zap-input-field"
                                placeholder="(DDD) 90000-0000"
                                value={zapNumber}
                                onChange={e => setZapNumber(mascaraTelefone(e.target.value))}
                                autoFocus
                                onKeyDown={e => e.key === 'Enter' && enviarWhatsAppBodyCompleto()}
                            />
                        </div>

                        <div className="zap-btn-wrapper">
                            <button className="hist-btn-secondary zap-btn" onClick={() => setShowZapModal(false)}>Voltar</button>
                            <button className="hist-btn-success zap-btn" onClick={enviarWhatsAppBodyCompleto}>Enviar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRM;