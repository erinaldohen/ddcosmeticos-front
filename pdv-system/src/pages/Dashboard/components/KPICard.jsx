import React from 'react';
import { TrendingUp, TrendingDown, Info, CheckCircle, AlertTriangle } from 'lucide-react';

const KPICard = ({
    title,
    icon,
    value,
    loading,
    className = "",
    insight = null, // { type: 'positive'|'negative'|'neutral', text: '', value: number }
    progress = null // number (0-100)
}) => {

    // Renderiza o ícone de insight correto
    const renderInsightIcon = (type) => {
        if (type === 'positive') return <TrendingUp size={14} />;
        if (type === 'negative') return <TrendingDown size={14} />;
        if (type === 'neutral') return <Info size={14} />;
        if (type === 'meta') return <CheckCircle size={14} />;
        if (type === 'alert') return <AlertTriangle size={14} />;
        return null;
    };

    return (
        <div className={`kpi-card ${className}`}>
            <div className="kpi-header">
                <label>{title}</label>
                {icon}
            </div>

            {loading ? (
                <div className="skeleton skeleton-title"></div>
            ) : (
                <strong>{value}</strong>
            )}

            {!loading && insight && (
                <div className={`kpi-insight ${insight.type}`}>
                    {renderInsightIcon(insight.type)}
                    <span>{insight.text}</span>
                </div>
            )}

            {!loading && progress !== null && (
                <div className="kpi-progress">
                    <div className="fill" style={{ width: `${Math.min(progress, 100)}%` }}></div>
                </div>
            )}
        </div>
    );
};

export default KPICard;