import React, { useEffect, useState } from 'react';
import {
    Users, Phone, MessageCircle, Clock, AlertTriangle,
    TrendingUp, ShoppingBag, Star, X, Search, ChevronRight,
    Calendar, RefreshCcw, Send
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './CRM.css';

const CRM = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [abaAtiva, setAbaAtiva] = useState('tarefas'); // 'tarefas' ou 'base'
    const [busca, setBusca] = useState('');
    const [clienteSelecionado, setClienteSelecionado] = useState(null);

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const res = await api.get('/crm/dashboard');
            setData(res.data);
        } catch (error) {
            toast.error("Erro ao carregar inteligência de clientes.");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

    const abrirWhatsApp = (telefone, mensagem) => {
        const telLimpo = telefone.replace(/\D/g, '');
        const msgEncoded = encodeURIComponent(mensagem);
        window.open(`https://wa.me/${telLimpo}?text=${msgEncoded}`, '_blank');
        toast.success("Redirecionando para o WhatsApp...");
    };

    if (loading || !data) return (
        <div className="crm-loader">
            <div className="crm-spinner"></div>
            <h2>Carregando Central de Clientes...</h2>
        </div>
    );

    const { resumo, tarefas, clientes } = data;

    const clientesFiltrados = clientes.filter(c =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.telefone.includes(busca)
    );

    return (
        <div className="crm-wrapper">
            <header className="crm-header">
                <div>
                    <h1 className="crm-title">Gestão de Clientes (CRM)</h1>
                    <p className="crm-subtitle">Inteligência de Vendas e Relacionamento DD Cosméticos</p>
                </div>
                <button className="crm-btn-refresh" onClick={carregarDados}><RefreshCcw size={16}/> Sincronizar</button>
            </header>

            {/* KPIs de Topo */}
            <div className="crm-kpi-grid">
                <div className="crm-kpi-card blue">
                    <div className="ck-top"><Users size={20} className="ck-icon"/> <span className="ck-label">Clientes Ativos</span></div>
                    <h2 className="ck-value">{resumo.clientesAtivos}</h2>
                </div>
                <div className="crm-kpi-card red">
                    <div className="ck-top"><AlertTriangle size={20} className="ck-icon"/> <span className="ck-label">Risco de Perda (+90d)</span></div>
                    <h2 className="ck-value">{resumo.clientesEmRisco}</h2>
                </div>
                <div className="crm-kpi-card green">
                    <div className="ck-top"><TrendingUp size={20} className="ck-icon"/> <span className="ck-label">Recuperados no Mês</span></div>
                    <h2 className="ck-value">{resumo.recuperadosMes}</h2>
                </div>
                <div className="crm-kpi-card purple">
                    <div className="ck-top"><ShoppingBag size={20} className="ck-icon"/> <span className="ck-label">Ticket Médio (Clube)</span></div>
                    <h2 className="ck-value">{formatCurrency(resumo.ticketMedioCRM)}</h2>
                </div>
            </div>

            {/* Abas */}
            <div className="crm-tabs">
                <button className={abaAtiva === 'tarefas' ? 'active' : ''} onClick={() => setAbaAtiva('tarefas')}>🔥 Ações de Hoje (Funil)</button>
                <button className={abaAtiva === 'base' ? 'active' : ''} onClick={() => setAbaAtiva('base')}>📇 Base de Clientes</button>
            </div>

            {/* ABA: TAREFAS DE HOJE */}
            {abaAtiva === 'tarefas' && (
                <div className="crm-tasks-container animate-fade-in">
                    <div className="crm-tasks-header">
                        <h2>Sua lista de contatos para faturar hoje</h2>
                        <p>O sistema identificou estas oportunidades baseadas no comportamento de compra.</p>
                    </div>

                    <div className="crm-tasks-grid">
                        {tarefas.map(tarefa => (
                            <div key={tarefa.id} className={`crm-task-card border-${tarefa.tipo.toLowerCase()}`}>
                                <div className="ctc-header">
                                    <span className={`ctc-badge badge-${tarefa.tipo.toLowerCase()}`}>
                                        {tarefa.tipo === 'REPOSICAO' && '♻️ Reposição Preditiva'}
                                        {tarefa.tipo === 'CHURN' && '🚨 Recuperação'}
                                        {tarefa.tipo === 'UPSELL' && '✨ Oportunidade VIP'}
                                    </span>
                                    <span className="ctc-time"><Clock size={14}/> {tarefa.diasUltimaCompra} dias atrás</span>
                                </div>

                                <div className="ctc-body">
                                    <h3>{tarefa.clienteNome}</h3>
                                    <p className="ctc-phone"><Phone size={14}/> {tarefa.telefone}</p>
                                    <div className="ctc-product">
                                        <strong>Foco:</strong> {tarefa.produtoFoco}
                                    </div>
                                </div>

                                <div className="ctc-msg-box">
                                    <div className="ctc-msg-header"><MessageCircle size={14}/> Sugestão de Abordagem</div>
                                    <p>{tarefa.mensagemSugerida}</p>
                                </div>

                                <div className="ctc-footer">
                                    <button className="crm-btn-whatsapp" onClick={() => abrirWhatsApp(tarefa.telefone, tarefa.mensagemSugerida)}>
                                        <Send size={16}/> Enviar WhatsApp
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ABA: BASE DE CLIENTES */}
            {abaAtiva === 'base' && (
                <div className="crm-base-container animate-fade-in">
                    <div className="crm-search-bar">
                        <Search className="csb-icon" size={20}/>
                        <input
                            type="text"
                            placeholder="Buscar cliente por nome ou telefone..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                        />
                    </div>

                    <div className="crm-table-wrapper">
                        <table className="crm-table">
                            <thead>
                                <tr>
                                    <th>Nome do Cliente</th>
                                    <th>Telefone</th>
                                    <th>Status</th>
                                    <th>Última Compra</th>
                                    <th className="text-right">Total Gasto</th>
                                    <th className="text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientesFiltrados.map(c => (
                                    <tr key={c.id}>
                                        <td><strong>{c.nome}</strong></td>
                                        <td>{c.telefone}</td>
                                        <td>
                                            <span className={`crm-status-tag st-${c.status.toLowerCase()}`}>
                                                {c.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>{c.ultimaCompra}</td>
                                        <td className="text-right font-bold text-main">{formatCurrency(c.totalGasto)}</td>
                                        <td className="text-center">
                                            <button className="crm-btn-view" onClick={() => setClienteSelecionado(c)}>
                                                Ver Perfil <ChevronRight size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL 360 DO CLIENTE */}
            {clienteSelecionado && (
                <div className="crm-modal-glass">
                    <div className="crm-modal-card">
                        <button className="crm-modal-close" onClick={() => setClienteSelecionado(null)}><X size={24}/></button>

                        <div className="cmc-header">
                            <div className="cmc-avatar">{clienteSelecionado.nome.charAt(0)}</div>
                            <div>
                                <h2>{clienteSelecionado.nome}</h2>
                                <p><Phone size={14}/> {clienteSelecionado.telefone}</p>
                            </div>
                        </div>

                        <div className="cmc-tags">
                            {clienteSelecionado.tags.map((tag, idx) => (
                                <span key={idx} className="cmc-tag"><Star size={12}/> {tag}</span>
                            ))}
                        </div>

                        <div className="cmc-stats">
                            <div className="cmc-stat-box">
                                <span>Total Gasto na DD</span>
                                <strong>{formatCurrency(clienteSelecionado.totalGasto)}</strong>
                            </div>
                            <div className="cmc-stat-box">
                                <span>Última Visita</span>
                                <strong>{clienteSelecionado.ultimaCompra}</strong>
                            </div>
                        </div>

                        <div className="cmc-actions">
                            <button className="crm-btn-whatsapp full" onClick={() => abrirWhatsApp(clienteSelecionado.telefone, `Oi ${clienteSelecionado.nome.split(' ')[0]}, tudo bem? Aqui é da DD Cosméticos!`)}>
                                <MessageCircle size={20}/> Chamar no WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRM;