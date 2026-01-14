import React, { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import api from '../../services/api';

const AlertasAuditoria = () => {
    const [alertas, setAlertas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState(false);

    useEffect(() => {
        const fetchAlertas = async () => {
            try {
                // Busca os últimos eventos
                const res = await api.get('/auditoria/eventos');

                // Filtra apenas o que é crítico para o Dashboard (Estoque Negativo e Cancelamentos)
                const criticos = res.data.filter(a =>
                    a.tipoEvento === 'ESTOQUE_NEGATIVO' ||
                    a.tipoEvento === 'CANCELAMENTO_VENDA'
                ).slice(0, 5); // Pega apenas os top 5 recentes

                setAlertas(criticos);
            } catch (error) {
                console.error("Falha ao buscar alertas", error);
                setErro(true);
            } finally {
                setLoading(false);
            }
        };
        fetchAlertas();
    }, []);

    if (erro) return null; // Se der erro, não exibe nada para não quebrar o layout

    return (
        <div className="chart-card" style={{ height: '100%', minHeight: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <ShieldAlert size={20} color="#F22998" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>Alertas de Segurança</h3>
            </div>

            <div className="alertas-list">
                {loading ? (
                    <p className="text-muted text-center" style={{marginTop: '20px'}}>Verificando sistema...</p>
                ) : alertas.length === 0 ? (
                    <div className="empty-state text-center" style={{ padding: '20px' }}>
                        <div style={{
                            background: '#dcfce7', width: '40px', height: '40px',
                            borderRadius: '50%', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', margin: '0 auto 10px'
                        }}>
                            <ShieldAlert size={20} color="#166534" />
                        </div>
                        <p className="text-muted" style={{ fontSize: '0.9rem' }}>Sistema operando normalmente.</p>
                    </div>
                ) : (
                    alertas.map((alerta, index) => (
                        <div key={alerta.id || index} className={`alerta-item ${alerta.tipoEvento}`}>
                            <div className="alerta-icon">
                                {alerta.tipoEvento === 'ESTOQUE_NEGATIVO'
                                    ? <AlertTriangle size={18} />
                                    : <XCircle size={18} />
                                }
                            </div>
                            <div className="alerta-texto">
                                <div style={{display:'flex', justifyContent:'space-between'}}>
                                    <strong>
                                        {alerta.tipoEvento === 'ESTOQUE_NEGATIVO' ? 'Estoque Negativo' : 'Venda Cancelada'}
                                    </strong>
                                    <small className="text-muted">
                                        {alerta.dataHora ? new Date(alerta.dataHora).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
                                    </small>
                                </div>
                                <span title={alerta.mensagem}>{alerta.mensagem}</span>
                                <small style={{display:'block', marginTop:'4px', color:'#64748b'}}>
                                    Por: {alerta.usuario || alerta.usuarioResponsavel || 'Sistema'}
                                </small>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default AlertasAuditoria;