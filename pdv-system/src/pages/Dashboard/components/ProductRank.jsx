import React, { useMemo } from 'react';
import { Package, Inbox, Sparkles, TrendingUp } from 'lucide-react';

const ProductRank = ({ loading, produtos, formatCurrency }) => {

    // IA: Análise de Concentração de Vendas
    const aiInsight = useMemo(() => {
        if (!produtos || produtos.length === 0) return null;

        const top1 = produtos[0];
        const totalTop3 = produtos.slice(0, 3).reduce((acc, p) => acc + p.total, 0);

        if (top1.total > (totalTop3 * 0.7)) {
            return `O produto ${top1.nome} detém a maior fatia do faturamento hoje. Foco em reposição!`;
        }
        return "Distribuição de vendas equilibrada entre os itens do topo.";
    }, [produtos]);

    const maxVal = produtos?.length > 0 ? Math.max(...produtos.map(p => p.total)) : 0;

    const getRankClass = (idx) => {
        if (idx === 0) return 'gold';
        if (idx === 1) return 'silver';
        if (idx === 2) return 'bronze';
        return 'default';
    };

    return (
        <div className="dash-card">
            <div className="card-header">
                <h3><Package size={20} className="text-primary" /> Top Produtos (Curva A)</h3>
                <span className="badge-pill info">Faturamento Diário</span>
            </div>

            {/* MINI INSIGHT DE IA NO HEADER DO CARD */}
            {!loading && aiInsight && (
                <div className="card-ai-mini-insight" style={{ marginBottom: '20px' }}>
                    <Sparkles size={12} className="ai-spark-icon" />
                    <span>{aiInsight}</span>
                </div>
            )}

            <div className="product-rank-list">
                {loading ? (
                    <div className="p-10">
                        <div className="skeleton-text" style={{ height: 40, marginBottom: 12 }}></div>
                        <div className="skeleton-text" style={{ height: 40, marginBottom: 12 }}></div>
                        <div className="skeleton-text" style={{ height: 40 }}></div>
                    </div>
                ) : produtos && produtos.length > 0 ? (
                    produtos.map((prod, idx) => (
                        <div key={idx} className="product-rank-item">
                            <div className={`rank-medal ${getRankClass(idx)}`}>
                                {idx + 1}
                            </div>

                            <div className="product-info">
                                <div className="product-name-row">
                                    <span className="product-name">{prod.nome || `Produto #${prod.id}`}</span>
                                    {idx === 0 && <TrendingUp size={14} className="text-success" />}
                                </div>
                                <div className="product-volume-bar">
                                    <div
                                        className="product-volume-fill"
                                        style={{ width: `${(prod.total / maxVal) * 100}%` }}
                                    >
                                        <div className="bar-shine"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="product-stats">
                                <span className="product-total">{formatCurrency(prod.total)}</span>
                                <span className="product-qty">{prod.qtd} un.</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-state-container">
                        <Inbox size={48} opacity={0.2} />
                        <span className="empty-text">Nenhum produto vendido hoje</span>
                        <span className="empty-subtext">As métricas de Curva A aparecerão aqui.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductRank;