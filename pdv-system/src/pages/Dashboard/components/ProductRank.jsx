import React from 'react';
import { Package, Inbox } from 'lucide-react';

const ProductRank = ({ loading, produtos, formatCurrency }) => {

    // Encontrar o maior valor para calcular a barra de progresso relativa
    const maxVal = produtos?.length > 0 ? Math.max(...produtos.map(p => p.total)) : 0;

    const getRankClass = (idx) => {
        if (idx === 0) return 'gold';
        if (idx === 1) return 'silver';
        if (idx === 2) return 'bronze';
        return 'default';
    };

    return (
        <div className="chart-card" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={20} className="text-primary" /> Top Produtos (Curva A)
            </h3>

            <div className="product-rank-list">
                {loading ? (
                    // Skeleton Loading
                    <>
                        <div className="skeleton" style={{ height: 60, width: '100%', borderRadius: 12 }}></div>
                        <div className="skeleton" style={{ height: 60, width: '100%', borderRadius: 12 }}></div>
                        <div className="skeleton" style={{ height: 60, width: '100%', borderRadius: 12 }}></div>
                    </>
                ) : produtos && produtos.length > 0 ? (
                    // Lista Real
                    produtos.map((prod, idx) => (
                        <div key={idx} className="product-rank-item">
                            {/* Badge Posição */}
                            <div className={`rank-badge ${getRankClass(idx)}`}>
                                {idx + 1}º
                            </div>

                            {/* Nome e Barra Visual */}
                            <div className="product-info">
                                <span className="product-name">{prod.nome || `Produto #${prod.id}`}</span>
                                <div className="product-volume-bar">
                                    <div
                                        className="product-volume-fill"
                                        style={{ width: `${(prod.total / maxVal) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Valores */}
                            <div className="product-stats">
                                <span className="product-total">{formatCurrency(prod.total)}</span>
                                <span className="product-qtd">{prod.qtd} un.</span>
                            </div>
                        </div>
                    ))
                ) : (
                    // Estado Vazio (Sem dados do backend)
                    <div className="empty-state-container">
                        <div className="empty-icon"><Inbox size={48} /></div>
                        <span className="empty-text">Nenhum produto vendido hoje</span>
                        <span className="empty-subtext">As vendas aparecerão aqui em tempo real.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductRank;