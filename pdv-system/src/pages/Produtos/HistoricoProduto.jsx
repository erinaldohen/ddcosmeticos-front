import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { History, User, Calendar, Tag, Package, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../services/api';
// Reaproveita os estilos do ProdutoList para manter o padrão
import './ProdutoList.css';

const HistoricoProduto = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [produtoNome, setProdutoNome] = useState('Produto');

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/auditoria/produto/${id}`);
      setHistorico(res.data || []);

      // Tenta extrair o nome do produto da primeira revisão disponível
      if (res.data && res.data.length > 0) {
          setProdutoNome(res.data[0].descricao || 'Produto');
      }
    } catch (err) {
      console.error("Erro ao carregar histórico", err);
      setError("Não foi possível carregar a linha do tempo do produto.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) carregarHistorico();
  }, [id, carregarHistorico]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  if (loading) {
    return (
      <div className="modern-container flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
          <RefreshCw className="spin" size={40} color="#ec4899" />
          <h2 style={{ color: 'var(--text-color)' }}>A carregar auditoria...</h2>
      </div>
    );
  }

  return (
    <div className="modern-container animate-fade">
      <header className="list-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} className="btn-secondary" style={{ padding: '0.5rem 1rem', width: 'fit-content' }}>
            <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Voltar
        </button>
        <div className="header-title-row w-full">
            <div>
                <h1 className="title-gradient">Linha do Tempo</h1>
                <p className="subtitle">{produtoNome} • ID: {id}</p>
            </div>
        </div>
      </header>

      <div className="content-card" style={{ padding: '2rem' }}>
        {error ? (
          <div className="empty-state text-center">
            <AlertCircle size={48} color="#ef4444" className="mb-3" />
            <p className="text-red">{error}</p>
            <button onClick={carregarHistorico} className="btn-primary mt-3">Tentar Novamente</button>
          </div>
        ) : historico.length === 0 ? (
          <div className="empty-state text-center p-5">
            <History size={64} color="#94a3b8" className="mb-3" />
            <h3>Nenhuma alteração registada</h3>
            <p className="subtitle mt-2">Este produto ainda não sofreu alterações auditáveis desde a sua criação ou o módulo de auditoria estava desligado.</p>
          </div>
        ) : (
          <div className="timeline" style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '2rem', marginLeft: '1rem' }}>
            {historico.map((item, index) => (
              <div key={item.idRevisao || index} className="timeline-item" style={{ position: 'relative', marginBottom: '2rem' }}>
                {/* Ponto da Timeline */}
                <div style={{
                    position: 'absolute', left: '-2.45rem', top: '5px', width: '16px', height: '16px',
                    borderRadius: '50%',
                    background: item.tipoAlteracao === 'CRIADO' ? '#10b981' : item.tipoAlteracao === 'ALTERADO' ? '#3b82f6' : '#ef4444',
                    border: '3px solid #fff', boxShadow: '0 0 0 2px #e2e8f0'
                }}></div>

                <div className="cfg-card" style={{ padding: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div className="flex-between mb-3" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.95rem' }}>
                      <Calendar size={16} />
                      <strong>{item.dataRevisao ? new Date(item.dataRevisao).toLocaleString('pt-BR') : 'Data Desconhecida'}</strong>
                    </div>
                    <span className="status-badge" style={{
                         background: item.tipoAlteracao === 'CRIADO' ? '#d1fae5' : item.tipoAlteracao === 'ALTERADO' ? '#dbeafe' : '#fee2e2',
                         color: item.tipoAlteracao === 'CRIADO' ? '#065f46' : item.tipoAlteracao === 'ALTERADO' ? '#1e40af' : '#991b1b',
                         fontWeight: 'bold', padding: '4px 10px', borderRadius: '4px', fontSize: '0.8rem'
                    }}>
                      {item.tipoAlteracao || 'MODIFICADO'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} color="#64748b" />
                      <span style={{ fontSize: '0.95rem' }}>Estoque: <strong style={{ color: '#1e293b' }}>{item.quantidade !== null ? item.quantidade : '-'} un</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag size={18} color="#64748b" />
                      <span style={{ fontSize: '0.95rem' }}>Preço: <strong style={{ color: '#1e293b' }}>{formatCurrency(item.precoVenda)}</strong></span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={18} color="#64748b" />
                      <span style={{ fontSize: '0.95rem' }}>Operador: <strong style={{ color: '#1e293b' }}>{item.usuarioResponsavel || 'Sistema'}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoProduto;