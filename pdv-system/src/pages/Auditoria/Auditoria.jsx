import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Search, Trash2, RefreshCw,
  AlertTriangle, User, Calendar,
  FileText, ShieldAlert, History, RotateCcw,
  ArrowDownCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Auditoria.css';

// Hook de Debounce (Evita chamadas excessivas na API enquanto digita)
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const Auditoria = () => {
  const [activeTab, setActiveTab] = useState('timeline');
  const [logs, setLogs] = useState([]);
  const [lixeira, setLixeira] = useState([]);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Aplica o delay na busca de texto (500ms)
  const termoBusca = useDebounce(filtroTexto, 500);

  const ITENS_POR_PAGINA = 20;

  // 1. Resetar e Recarregar quando mudar filtros principais (Aba, Texto, Datas)
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    // Limpa a lista visualmente antes de buscar para dar feedback de "nova busca"
    if (activeTab === 'timeline') setLogs([]);
    else setLixeira([]);

    carregarDados(0, true);
  // eslint-disable-next-line
  }, [activeTab, termoBusca, dataInicio, dataFim]);

  const carregarDados = async (pagina = 0, resetList = false) => {
    if (loading && pagina > 0) return; // Evita duplicidade apenas na paginação
    setLoading(true);

    try {
      const params = {
        page: pagina,
        size: ITENS_POR_PAGINA,
        sort: 'dataHora,desc',
        search: termoBusca, // Agora enviamos a busca para o backend!
        inicio: dataInicio || null,
        fim: dataFim || null
      };

      // Remove chaves nulas/vazias
      Object.keys(params).forEach(key => !params[key] && delete params[key]);

      let novosDados = [];

      if (activeTab === 'timeline') {
        const res = await api.get('/auditoria/eventos', { params });
        novosDados = res.data.content || res.data || [];

        setLogs(prev => resetList ? novosDados : [...prev, ...novosDados]);
      } else {
        const res = await api.get('/auditoria/lixeira', { params });
        novosDados = res.data.content || res.data || [];

        setLixeira(prev => resetList ? novosDados : [...prev, ...novosDados]);
      }

      setHasMore(novosDados.length >= ITENS_POR_PAGINA);

    } catch (error) {
      console.error("Erro busca:", error);
      // Opcional: toast.error("Erro ao buscar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleCarregarMais = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    carregarDados(nextPage, false);
  };

  const handleAtualizarManual = () => {
    setPage(0);
    carregarDados(0, true);
  };

  // --- AÇÕES ---
  const restaurarItem = async (id, nome) => {
    if(!window.confirm(`Restaurar "${nome}"?`)) return;
    try {
      await api.post(`/auditoria/restaurar/${id}`);
      toast.success("Item restaurado!");
      handleAtualizarManual();
    } catch (error) {
      toast.error("Erro ao restaurar.");
    }
  };

  const baixarPDF = async () => {
    try {
      const params = { inicio: dataInicio, fim: dataFim, search: termoBusca };
      const res = await api.get('/auditoria/relatorio/pdf', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Auditoria_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF gerado!");
    } catch (error) {
      toast.error("Erro ao gerar PDF.");
    }
  };

  // Helpers UI
  const getIconForEvent = (tipo) => {
      if (tipo?.includes('ESTOQUE_NEGATIVO') || tipo?.includes('CANCELAMENTO')) return <AlertTriangle size={20} />;
      if (tipo?.includes('RESTORE')) return <RotateCcw size={20} />;
      return <Activity size={20} />;
  };

  const getIconClass = (tipo) => {
      if (tipo?.includes('ESTOQUE_NEGATIVO') || tipo?.includes('CANCELAMENTO')) return 'warning';
      return 'info';
  };

  return (
    <div className="auditoria-container fade-in">
      <div className="auditoria-header">
        <div className="header-title">
          <h1><ShieldAlert size={32} color="#6366f1" /> Auditoria & Segurança</h1>
          <p>Monitoramento inteligente de operações</p>
        </div>

        <div className="header-tabs">
            <button className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
                <History size={18} /> Timeline
            </button>
            <button className={`tab-btn ${activeTab === 'lixeira' ? 'active' : ''}`} onClick={() => setActiveTab('lixeira')}>
                <Trash2 size={18} /> Lixeira
            </button>
        </div>
      </div>

      <div className="auditoria-toolbar">
        <div className="search-box">
            <Search size={20} />
            <input
                type="text"
                placeholder={activeTab === 'timeline' ? "Buscar eventos (Enter para buscar)..." : "Buscar produtos..."}
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
            />
        </div>

        {activeTab === 'timeline' && (
            <div className="date-filter-group">
                <input type="date" className="date-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                <span className="date-separator">até</span>
                <input type="date" className="date-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
        )}

        <button className="btn-filter" onClick={handleAtualizarManual} title="Atualizar">
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
        <button className="btn-filter" onClick={baixarPDF} title="Baixar PDF">
            <FileText size={18} /> <span className="mobile-hide">PDF</span>
        </button>
      </div>

      <div className="content-area">
        {activeTab === 'timeline' && (
            <div className="timeline-wrapper">
                {logs.length === 0 && !loading ? (
                    <div className="empty-state">Nenhum evento encontrado.</div>
                ) : (
                    logs.map((log, index) => (
                        <div key={log.id || index} className="timeline-item">
                            <div className="timeline-line"></div>
                            <div className={`timeline-icon ${getIconClass(log.tipoEvento)}`}>
                                {getIconForEvent(log.tipoEvento)}
                            </div>
                            <div className="timeline-card">
                                <div className="card-header">
                                    <span className="action-tag">{log.tipoEvento?.replace(/_/g, ' ') || 'LOG'}</span>
                                    <div className="time-tag">
                                        <Calendar size={14} />
                                        {log.dataHora ? new Date(log.dataHora).toLocaleString('pt-BR') : '--/--'}
                                    </div>
                                </div>
                                <p className="card-details">{log.mensagem}</p>
                                <div className="card-footer">
                                    <User size={14} />
                                    <span>Resp: <strong>{log.usuarioResponsavel || 'Sistema'}</strong></span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {activeTab === 'lixeira' && (
            <div className="trash-grid">
                {lixeira.length === 0 && !loading ? (
                    <div className="empty-state" style={{gridColumn: '1/-1'}}>Lixeira vazia.</div>
                ) : (
                    lixeira.map((item) => (
                        <div key={item.id} className="trash-card">
                            <div style={{display:'flex', gap:15, alignItems:'flex-start', width:'100%'}}>
                                <div className="trash-icon"><Trash2 size={24} /></div>
                                <div className="trash-info">
                                    <h4>{item.descricao}</h4>
                                    <p>Cod: {item.codigoBarras || 'S/N'}</p>
                                    <p style={{marginTop:4, fontWeight:600}}>
                                        {item.precoVenda?.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}
                                    </p>
                                </div>
                            </div>
                            <button className="btn-restore" onClick={() => restaurarItem(item.id, item.descricao)}>
                                <RotateCcw size={18} /> Restaurar
                            </button>
                        </div>
                    ))
                )}
            </div>
        )}

        {/* Loading / Carregar Mais */}
        {loading && (
            <div className="empty-state" style={{padding: 20}}>
                <RefreshCw size={24} className="spin" color="#6366f1" />
            </div>
        )}

        {!loading && hasMore && (logs.length > 0 || lixeira.length > 0) && (
            <div className="load-more-container">
                <button className="btn-load-more" onClick={handleCarregarMais}>
                    <ArrowDownCircle size={18} /> Carregar Mais
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default Auditoria;