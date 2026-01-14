import React, { useState, useEffect, useCallback } from 'react';
import { History, User, Calendar, Tag, Package, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const HistoricoProduto = ({ idProduto, nomeProduto }) => {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Endpoint sincronizado com AuditoriaController: /api/v1/auditoria/produto/{id}
      const res = await api.get(`/auditoria/produto/${idProduto}`);
      setHistorico(res.data);
    } catch (err) {
      console.error("Erro ao carregar histórico do produto", err);
      setError("Não foi possível carregar a linha do tempo.");
    } finally {
      setLoading(false);
    }
  }, [idProduto]);

  useEffect(() => {
    if (idProduto) {
      carregarHistorico();
    }
  }, [idProduto, carregarHistorico]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  if (loading) return <div className="text-center p-5 text-muted">Carregando linha do tempo...</div>;

  if (error) return (
    <div className="text-center p-5 text-danger">
      <AlertCircle size={24} style={{ marginBottom: '8px' }} />
      <p>{error}</p>
    </div>
  );

  return (
    <div className="historico-container fade-in">
      <div className="historico-header">
        <History size={20} color="#2563eb" />
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Linha do Tempo: {nomeProduto}</h3>
      </div>

      <div className="timeline">
        {historico.length === 0 ? (
          <div className="empty-state text-center p-4">
            <p className="text-muted">Nenhuma alteração registrada para este produto.</p>
          </div>
        ) : (
          historico.map((item) => (
            <div key={item.idRevisao} className="timeline-item">
              {/* O marcador usa a classe baseada no tipo que vem do switch do seu Java: CRIADO, ALTERADO, EXCLUÍDO */}
              <div className="timeline-marker">
                <div className={`dot ${item.tipoAlteracao}`}></div>
              </div>

              <div className="timeline-content">
                <div className="timeline-date">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={12} />
                    {/* item.dataRevisao vem do seu DTO Java (Date) */}
                    <span>{new Date(item.dataRevisao).toLocaleString('pt-BR')}</span>
                  </div>
                  <span className={`badge-sm ${item.tipoAlteracao}`}>
                    {item.tipoAlteracao}
                  </span>
                </div>

                <div className="timeline-details">
                  <div className="detail-row">
                    <Package size={14} className="text-muted" />
                    <span>Estoque: <strong>{item.quantidade}</strong></span>
                  </div>
                  <div className="detail-row">
                    <Tag size={14} className="text-muted" />
                    <span>Preço: <strong>{formatCurrency(item.precoVenda)}</strong></span>
                  </div>
                </div>

                <div className="timeline-footer">
                  <User size={12} />
                  {/* O Envers geralmente registra o usuário na revisão.
                      Se não estiver chegando, usamos 'Sistema' como fallback */}
                  <small>Responsável: {item.usuarioResponsavel || 'Sistema'}</small>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoricoProduto;