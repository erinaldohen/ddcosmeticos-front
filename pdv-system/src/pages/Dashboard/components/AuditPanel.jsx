import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, MessageCircle } from 'lucide-react';

const AuditPanel = ({ loading, alertas, onNavigate }) => {
    return (
        <div className="chart-card audit-panel">
            <div className="audit-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3><ShieldAlert size={20} /> Auditoria & Alertas</h3>
                    <span className="pulse-dot"></span>
                </div>
            </div>

            <div className="audit-legend-container">
                <div className="legend-row">
                    <span className="dot alto"></span>
                    <span><strong>Crítico:</strong> Ação Imediata (Zap).</span>
                </div>
                <div className="legend-row">
                    <span className="dot medio"></span>
                    <span><strong>Atenção:</strong> Revisar processo.</span>
                </div>
            </div>

            <div className="audit-list">
                {loading ? (
                    <div style={{ padding: 20 }}>
                        <div className="skeleton skeleton-text" style={{ marginBottom: 10 }}></div>
                        <div className="skeleton skeleton-text"></div>
                    </div>
                ) : alertas.length > 0 ? (
                    alertas.map((alerta) => (
                        <div key={alerta.id} className={`audit-item ${alerta.nivel}`}>
                            <div className="audit-icon-area">
                                <AlertTriangle size={18} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <strong>
                                    {alerta.msg}
                                    {alerta.notificado && (
                                        <span className="whatsapp-sent" title="Mensagem enviada">
                                            <MessageCircle size={10} fill="white" /> Enviado
                                        </span>
                                    )}
                                </strong>
                                <p className="audit-meta">
                                    {alerta.nivel === 'alto' ? 'Risco Financeiro' : 'Conformidade'}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="audit-empty">
                        <CheckCircle size={40} color="#10b981" />
                        <p>Tudo certo!</p>
                    </div>
                )}
            </div>

            <div className="audit-footer">
                <button className="btn-audit-action" onClick={onNavigate}>
                    Ver Logs Completos
                </button>
            </div>
        </div>
    );
};

export default AuditPanel;