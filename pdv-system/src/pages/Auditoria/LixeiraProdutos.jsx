import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCcw, Package, Search, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const LixeiraProdutos = () => {
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarLixeira();
  }, []);

  const carregarLixeira = async () => {
    try {
      const res = await api.get('/auditoria/lixeira');
      setProdutos(res.data);
    } catch (error) {
      toast.error("Erro ao carregar lixeira.");
    } finally {
      setLoading(false);
    }
  };

  const restaurar = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja restaurar o produto "${nome}" ao estoque?`)) {
      try {
        await api.post(`/auditoria/restaurar/${id}`);
        toast.success("Produto restaurado com sucesso!");
        carregarLixeira();
      } catch (error) {
        toast.error("Erro ao restaurar produto.");
      }
    }
  };

  const produtosFiltrados = produtos.filter(p =>
    p.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    p.codigoBarras?.includes(busca)
  );

  return (
    <div className="dashboard-container fade-in">
      <header className="page-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Trash2 size={32} color="#ef4444" />
          <h1>Lixeira de Produtos</h1>
        </div>
        <p className="text-muted" style={{marginTop: '5px'}}>
          Visualize e restaure produtos que foram removidos do sistema.
        </p>
      </header>

      {/* BARRA DE BUSCA */}
      <div className="filter-bar" style={{ maxWidth: '500px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <Search size={20} className="text-muted" />
          <input
            type="text"
            className="form-control"
            style={{ width: '100%', border: 'none', boxShadow: 'none', padding: '0' }}
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <main className="chart-card">
        {loading ? (
          <div className="text-center p-5 text-muted">Carregando itens excluídos...</div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <Package size={64} color="#e2e8f0" style={{ marginBottom: '15px' }} />
            <h3 style={{color: '#64748b'}}>A lixeira está vazia</h3>
            <p className="text-muted">Nenhum produto excluído foi encontrado.</p>
          </div>
        ) : (
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{width: '150px'}}>Cód. Barras</th>
                <th>Descrição</th>
                <th style={{width: '150px'}}>Preço Venda</th>
                <th className="text-right" style={{width: '150px'}}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtosFiltrados.map(prod => (
                <tr key={prod.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#64748b' }}>
                    {prod.codigoBarras || 'SEM GTIN'}
                  </td>
                  <td style={{ fontWeight: '500' }}>{prod.descricao}</td>
                  <td>
                    {(prod.precoVenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="text-right">
                    <button
                      className="btn-confirm success"
                      onClick={() => restaurar(prod.id, prod.descricao)}
                      title="Restaurar ao Estoque"
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <RefreshCcw size={16} />
                      Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#fff7ed',
        border: '1px solid #ffedd5',
        borderRadius: '8px',
        display: 'flex',
        gap: '12px',
        alignItems: 'start'
      }}>
        <AlertTriangle size={20} color="#c2410c" style={{ marginTop: '2px' }} />
        <div>
          <strong style={{ color: '#9a3412', display: 'block', marginBottom: '4px' }}>Atenção Operacional</strong>
          <small style={{ color: '#9a3412', lineHeight: '1.4' }}>
            Ao restaurar um produto, ele voltará imediatamente a ficar disponível para venda no PDV e visível nos relatórios de estoque.
          </small>
        </div>
      </div>
    </div>
  );
};

export default LixeiraProdutos;