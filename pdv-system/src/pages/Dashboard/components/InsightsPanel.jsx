import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Clock, ShieldAlert, CheckCircle, Zap } from 'lucide-react';
import api from '../../../services/api';
import { toast } from 'react-toastify';
import './InsightsPanel.css';

const InsightsPanel = () => {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchInsights = async () => {
        try {
            const response = await api.get('/dashboard/insights');
            setInsights(response.data);
        } catch (error) {
            console.error("Erro ao buscar insights da IA:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights();
    }, []);

    const handleResolver = async (id) => {
        try {
            await api.put(`/dashboard/insights/${id}/resolver`);
            setInsights(insights.filter(i => i.id !== id));
            toast.success("Ação concluída e alerta dispensado!");
        } catch (error) {
            toast.error("Erro ao dispensar o alerta.");
        }
    };

    const getIcon = (tipo) => {
        switch (tipo) {
            case 'VALIDADE': return <Clock size={28} />;
            case 'RUPTURA': return <TrendingDown size={28} />;
            case 'FRAUDE': return <ShieldAlert size={28} />;
            default: return <AlertTriangle size={28} />;
        }
    };

    const getColorClass = (criticidade) => {
        switch (criticidade) {
            case 'ALTA': return 'insight-danger';
            case 'MEDIA': return 'insight-warning';
            default: return 'insight-info';
        }
    };

    if (loading || insights.length === 0) return null; // Mantém a tela limpa se não houver problemas

    return (
        <div className="insights-container">
            <div className="insights-header">
                <Zap size={24} className="text-warning" fill="currentColor" />
                <h2>Consultora IA - Ações Estratégicas</h2>
            </div>
            <div className="insights-grid">
                {insights.map(insight => (
                    <div key={insight.id} className={`insight-card ${getColorClass(insight.criticidade)}`}>
                        <div className="insight-icon">
                            {getIcon(insight.tipo)}
                        </div>
                        <div className="insight-content">
                            <h3>{insight.titulo}</h3>
                            <p className="insight-msg">{insight.mensagem}</p>
                            {insight.acaoSugerida && (
                                <div className="insight-action">
                                    <strong>💡 Sugestão de Ação:</strong> {insight.acaoSugerida}
                                </div>
                            )}
                        </div>
                        <button
                            className="insight-resolve-btn"
                            onClick={() => handleResolver(insight.id)}
                            title="Já resolvi isso / Dispensar alerta"
                        >
                            <CheckCircle size={28} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InsightsPanel;