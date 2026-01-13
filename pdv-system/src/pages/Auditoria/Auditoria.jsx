import React, { useState, useEffect } from 'react';
import {
  Activity, Search, Filter, Trash2, RefreshCw,
  AlertTriangle, CheckCircle, User, Calendar, Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api'; // Ajuste o caminho conforme sua estrutura
import './Auditoria.css';

const Auditoria = () => {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' ou 'lixeira'
  const [logs, setLogs] = useState([]);
  const [lixeira, setLixeira] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('');

  // --- CARREGAR DADOS ---
  useEffect(() => {
    carregarDados();
  }, [activeTab]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (activeTab === 'timeline') {
        // Ajuste o endpoint conforme seu backend real
        // Exemplo: GET /api/auditoria ou /api/auditoria/timeline/{idProduto} se for específico
        // Aqui assumimos um endpoint geral ou simulamos dados para a UI
        const res = await api.get('/auditoria');
        setLogs(res.data || []);
      } else {
        const res = await api.get('/auditoria/lixeira');
        setLixeira(res.data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar auditoria", error);
      // Dados de exemplo para visualização se a API falhar (Remover em produção)
      if (activeTab === 'timeline') {
        setLogs([
          { id: 1, acao: 'VENDA_SEM_ESTOQUE', detalhes: 'Venda forçada ID 123 (Shampoo)', usuario: 'Admin', dataHora: new Date().toISOString() },
          { id: 2, acao: 'ALTERACAO_PRECO', detalhes: 'Produto 55 alterado de R$ 10 para R$ 12', usuario: 'Gerente', dataHora: new Date(Date.now() - 3600000).toISOString() },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES ---
  const restaurarItem = async (id) => {
    try {
      await api.put(`/auditoria/restaurar/${id}`);
      toast.success("Item restaurado com sucesso!");
      carregarDados(); // Recarrega a lixeira
    } catch (error) {
      toast.error("Erro ao restaurar item.");
    }
  };

  // --- FILTRAGEM ---
  const logsFiltrados = logs.filter(log =>
    log.detalhes.toLowerCase().includes(filtro.toLowerCase()) ||
    log.usuario?.toLowerCase().includes(filtro.toLowerCase()) ||
    log.acao?.toLowerCase().includes(filtro.toLowerCase())
  );

  // --- RENDERIZAÇÃO ---
  return (
    <div className="auditoria-container fade-in">
      <header className="auditoria-header">
        <div className="header-title">
          <h1><Activity size={28} /> Auditoria & Segurança</h1>
          <p>Monitorização de eventos e recuperação de dados</p>
        </div>

        <div className="header-tabs">
          <button
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <Clock size={18} /> Timeline
          </button>
          <button
            className={`tab-btn ${activeTab === 'lixeira' ? 'active' : ''}`}
            onClick={() => setActiveTab('lixeira')}
          >
            <Trash2 size={18} /> Lixeira
          </button>
        </div>
      </header>

      {/* BARRA DE FERRAMENTAS */}
      <div className="auditoria-toolbar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Filtrar por ação, usuário ou detalhe..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <button className="btn-filter" onClick={carregarDados}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar
        </button>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="auditoria-content">
        {loading ? (
          <div className="loading-state">Carregando registros...</div>
        ) : (
          <>
            {activeTab === 'timeline' && (
              <div className="timeline-wrapper">
                {logsFiltrados.length === 0 ? (
                  <div className="empty-state">Nenhum registro encontrado.</div>
                ) : (
                  logsFiltrados.map((log, idx) => (
                    <div key={log.id || idx} className="timeline-item">
                      <div className="timeline-line"></div>
                      <div className={`timeline-icon ${log.acao === 'VENDA_SEM_ESTOQUE' ? 'warning' : 'info'}`}>
                        {log.acao === 'VENDA_SEM_ESTOQUE' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                      </div>
                      <div className="timeline-card">
                        <div className="card-header">
                          <span className="action-tag">{log.acao?.replace(/_/g, ' ')}</span>
                          <span className="time-tag">
                            <Calendar size={12} /> {new Date(log.dataHora).toLocaleDateString()}
                            <Clock size={12} style={{marginLeft: 8}}/> {new Date(log.dataHora).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="card-details">{log.detalhes}</p>
                        <div className="card-footer">
                          <User size={14} /> Operador: <strong>{log.usuario || 'Sistema'}</strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'lixeira' && (
              <div className="trash-grid">
                {lixeira.length === 0 ? (
                  <div className="empty-state">A lixeira está vazia.</div>
                ) : (
                  lixeira.map((item) => (
                    <div key={item.id} className="trash-card">
                      <div className="trash-icon"><Trash2 size={24} /></div>
                      <div className="trash-info">
                        <h4>{item.nome || item.descricao}</h4>
                        <p>Excluído em: {new Date(item.dataExclusao || Date.now()).toLocaleDateString()}</p>
                      </div>
                      <button className="btn-restore" onClick={() => restaurarItem(item.id)}>
                        <RefreshCw size={16} /> Restaurar
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Auditoria;