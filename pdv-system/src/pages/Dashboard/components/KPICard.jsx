import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KPICard = ({ title, value, icon, loading, trend, isCurrency, isWarning, footer }) => {
  if (loading) {
    return (
      <div className="kpi-card skeleton-container">
        <div className="skeleton-box h-140"></div>
      </div>
    );
  }

  return (
    <div className={`kpi-card ${isWarning ? 'warning-glow' : ''}`}>
      <div className="kpi-header">
        <label>{title}</label>
        <div className="kpi-icon-wrapper">
          {icon}
        </div>
      </div>

      <div className="kpi-body">
        <strong>{value}</strong>

        {trend && (
          <div className={`kpi-trend-badge ${trend.isNeutral ? 'trend-neutral' : trend.isPositive ? 'trend-positive' : 'trend-negative'}`}>
            {trend.isNeutral ? <Minus size={12} /> : trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{trend.value} {trend.label}</span>
          </div>
        )}
      </div>

      {/* FOOTER COM INSIGHT DE IA */}
      {footer ? (
        <div className="card-ai-mini-insight">
          <Sparkles size={12} className="ai-spark-icon" />
          <span>{footer}</span>
        </div>
      ) : (
        <div className="card-ai-mini-insight empty">
          <Info size={12} /> Monitoramento ativo
        </div>
      )}
    </div>
  );
};

export default KPICard;