import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KPICard = ({ title, icon, value, loading, className, trend }) => {

  // Define a cor e ícone baseado na tendência
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.isNeutral) return <Minus size={16} />;
    return trend.isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
  };

  const trendClass = trend
    ? (trend.isPositive ? 'trend-positive' : (trend.isNeutral ? 'trend-neutral' : 'trend-negative'))
    : '';

  return (
    <div className={`kpi-card ${className || ''}`}>
      <div className="kpi-header">
        <label>{title}</label>
        {/* Ícone do KPI (Sacola, Hash, etc) */}
        <div style={{
            background: className?.includes('highlight') ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
            padding: 8,
            borderRadius: '8px',
            display: 'flex'
        }}>
            {icon}
        </div>
      </div>

      <div className="kpi-body">
        {loading ? (
          <div className="skeleton skeleton-title"></div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap: 4}}>
              <strong>{value}</strong>

              {/* INDICADOR DE TENDÊNCIA */}
              {trend && (
                  <div className={`kpi-trend-badge ${trendClass} ${className?.includes('highlight') ? 'white-text' : ''}`}>
                      {getTrendIcon()}
                      <span>{trend.value}%</span>
                      <span className="trend-label">{trend.label}</span>
                  </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;