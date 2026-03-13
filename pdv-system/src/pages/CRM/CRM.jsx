import React, { useState, useEffect } from 'react';
import {
    Users, Phone, UserCheck, ArrowLeft, HeartHandshake,
    MessageCircle, AlertCircle, ShoppingBag, Calendar,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './CRM.css';

const CRM = () => {
    const [loading, setLoading] = useState(true);
    const [resumo, setResumo] = useState({ clientesAtivos: 0, clientesEmRisco: 0, recuperadosMes: 0, ticketMedioCRM: 0 });
    const [tarefas, setTarefas] = useState([]);
    const [clientes, setClientes] = useState([]);

    // Controle de UI
    const [abaAtiva, setAbaAtiva] = useState('TAREFAS'); // TAREFAS ou BASE

    useEffect(() => {
        carregarDados();
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/crm/dashboard');
            setResumo(data.resumo || { clientesAtivos: 0, clientesEmRisco: 0, recuperadosMes: 0, ticketMedioCRM: 0 });
            setTarefas(data.tarefas || []);
            setClientes(data.clientes || []);
        } catch (error) {
            console.error("Erro ao carregar CRM", error);
            // Fallback gentil se der erro, pois o CRM não deve quebrar a loja
            toast.error("Não foi possível carregar os dados de clientes.");
        } finally {
            setLoading(false);
        }
    };

    // Ação Principal: Chama o WhatsApp e avisa o Backend
    const handleContatoWhatsApp = async (tarefa) => {
        // 1. Limpa o telefone para o padrão do WhatsApp
        const telefoneNumerico = tarefa.telefone ? tarefa.telefone.replace(/\D/g, '') : '';

        if (!telefoneNumerico || telefoneNumerico.length < 10) {
            toast.error("Número de telefone inválido para o cliente " + tarefa.clienteNome);
            return;
        }

        // 2. Avisa o Java que o contato foi feito
        try {
            await api.post('/crm/interacao', {
                clienteId: tarefa.clienteId, // Importante: O DTO que criamos no Java pede o clienteId
                tipoAbordagem: tarefa.tipo,
                resultado: "ENVIADA",
                observacao: `Mensagem sugerida via sistema para produto: ${tarefa.produtoFoco}`
            });

            // 3. Remove a tarefa da tela instantaneamente para fluidez
            setTarefas(prev => prev.filter(t => t.id !== tarefa.id));
            toast.success(`Contato com ${tarefa.clienteNome} registrado!`);

            // 4. Abre a nova aba do WhatsApp Web com a mensagem pré-pronta
            const mensagemEncoded = encodeURIComponent(tarefa.mensagemSugerida);
            const urlZAP = `https://wa.me/55${telefoneNumerico}?text=${mensagemEncoded}`;
            window.open(urlZAP, '_blank');

        } catch (e) {
            toast.error("Erro ao registrar a interação no sistema.");
        }
    };

    if (loading) {
        return <div className="crm-loader"><div className="spinner"></div><h2>Carregando Máquina de Vendas...</h2></div>;
    }

    return (
        <div className="crm-container animate-fade">

            {/* CABEÇALHO KPI */}
            <div className="crm-header-cards">
                <div className="kpi-card crm-primary">
                    <div className="kpi-icon"><Users size={24}/></div>
                    <div className="kpi-data">
                        <span>Clientes Ativos</span>
                        <h3>{resumo.clientesAtivos}</h3>
                    </div>
                </div>
                <div className="kpi-card crm-danger">
                    <div className="kpi-icon"><AlertCircle size={24}/></div>
                    <div className="kpi-data">
                        <span>Risco de Fuga</span>
                        <h3>{resumo.clientesEmRisco}</h3>
                    </div>
                </div>
                <div className="kpi-card crm-success">
                    <div className="kpi-icon"><UserCheck size={24}/></div>
                    <div className="kpi-data">
                        <span>Recuperados Mês</span>
                        <h3>{resumo.recuperadosMes}</h3>
                    </div>
                </div>
                <div className="kpi-card crm-warning">
                    <div className="kpi-icon"><ShoppingBag size={24}/></div>
                    <div className="kpi-data">
                        <span>Ticket do Clube</span>
                        <h3>R$ {resumo.ticketMedioCRM.toFixed(2)}</h3>
                    </div>
                </div>
            </div>

            {/* CONTROLES DE ABA */}
            <div className="crm-tabs">
                <button className={abaAtiva === 'TAREFAS' ? 'active' : ''} onClick={() => setAbaAtiva('TAREFAS')}>
                    <MessageCircle size={18}/> Funil de Ações (Hoje)
                    {tarefas.length > 0 && <span className="badge-count">{tarefas.length}</span>}
                </button>
                <button className={abaAtiva === 'BASE' ? 'active' : ''} onClick={() => setAbaAtiva('BASE')}>
                    <HeartHandshake size={18}/> Base de Clientes VIP
                </button>
            </div>

            {/* CONTEÚDO: TAREFAS DE VENDAS */}
            {abaAtiva === 'TAREFAS' && (
                <div className="crm-tarefas-grid">
                    {tarefas.length === 0 ? (
                        <div className="crm-empty-state">
                            <CheckCircle2 size={60} color="#10b981" />
                            <h3>Tudo limpo por aqui!</h3>
                            <p>Sua equipe já contactou todos os clientes do funil hoje.</p>
                        </div>
                    ) : (
                        tarefas.map(tarefa => (
                            <div key={tarefa.id} className="tarefa-card">
                                <div className={`tarefa-badge ${tarefa.tipo.toLowerCase()}`}>
                                    {tarefa.tipo === 'REPOSICAO' ? '♻️ Reposição' : tarefa.tipo === 'CHURN' ? '⚠️ Risco de Fuga' : '✨ Upsell / Novidade'}
                                </div>
                                <h3 className="tarefa-cliente">{tarefa.clienteNome}</h3>
                                <div className="tarefa-info">
                                    <span><Calendar size={14}/> Última Compra: {tarefa.diasUltimaCompra} dias atrás</span>
                                    <span><ShoppingBag size={14}/> Foco: {tarefa.produtoFoco}</span>
                                </div>
                                <div className="tarefa-mensagem">
                                    <strong>Sugestão de Mensagem:</strong>
                                    <p>"{tarefa.mensagemSugerida}"</p>
                                </div>
                                <button className="btn-whatsapp" onClick={() => handleContatoWhatsApp(tarefa)}>
                                    <Phone size={18}/> Chamar no WhatsApp
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* CONTEÚDO: BASE DE CLIENTES (Tabela) */}
            {abaAtiva === 'BASE' && (
                <div className="crm-table-container">
                    <table className="crm-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Contato</th>
                                <th>Status</th>
                                <th>Última Visita</th>
                                <th>Total Gasto</th>
                                <th>Perfil (Tags)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientes.map(cliente => (
                                <tr key={cliente.id}>
                                    <td><strong>{cliente.nome}</strong></td>
                                    <td>{cliente.telefone}</td>
                                    <td>
                                        <span className={`status-dot ${cliente.status.toLowerCase()}`}></span>
                                        {cliente.status.replace('_', ' ')}
                                    </td>
                                    <td>{cliente.ultimaCompra}</td>
                                    <td>R$ {cliente.totalGasto.toFixed(2)}</td>
                                    <td>
                                        <div className="tags-flex">
                                            {cliente.tags.map((tag, i) => (
                                                <span key={i} className="crm-tag">{tag}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    );
};

export default CRM;