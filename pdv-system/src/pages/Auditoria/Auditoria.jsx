import React, { useState, useEffect } from 'react';
import {
  Activity, Search, Trash2, RefreshCw,
  AlertTriangle, User, Calendar,
  FileText, ShieldAlert, History, RotateCcw,
  ArrowDownCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import './Auditoria.css';

// Hook de Debounce
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

  const termoBusca = useDebounce(filtroTexto, 600);
  const ITENS_POR_PAGINA = 20;

  // Estado para Modal de Confirmação
  const [modalConfig, setModalConfig] = useState({
    open: false,
    id: null,
    titulo: '',
    mensagem: '',
    acao: null
  });

  // Efeito de Carga Inicial
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    if (activeTab === 'timeline') setLogs([]);
    else setLixeira([]);

    carregarDados(0, true);
    // eslint-disable-next-line
  }, [activeTab, termoBusca, dataInicio, dataFim]);

  const carregarDados = async (pagina = 0, resetList = false) => {
    if (loading && pagina > 0) return;
    setLoading(true);
    try {
      const params = {
        page: pagina,
        size: ITENS_POR_PAGINA,
        sort: 'dataHora,desc',
        search: termoBusca || null,
        inicio: dataInicio || null,
        fim: dataFim || null
      };

      // CORREÇÃO CRÍTICA: Removido o prefixo /api/v1 que já vem do api.js
      const endpoint = activeTab === 'timeline' ? '/auditoria/eventos' : '/auditoria/lixeira';

      const res = await api.get(endpoint, { params });
      const novosDados = res.data.content || res.data || [];

      if (activeTab === 'timeline') {
        setLogs(prev => resetList ? novosDados : [...prev, ...novosDados]);
      } else {
        setLixeira(prev => resetList ? novosDados : [...prev, ...novosDados]);
      }

      setHasMore(novosDados.length >= ITENS_POR_PAGINA);

    } catch (error) {
      console.error("Erro auditoria:", error);
      // Evita flood de toast se for apenas cancelamento de request ou erro menor
      if (resetList && error.response?.status !== 404) {
          toast.error("Não foi possível carregar os dados de auditoria.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Abertura do Modal Seguro
  const solicitarRestauracao = (item) => {
    setModalConfig({
      open: true,
      id: item.id,
      titulo: 'Confirmar Restauração',
      mensagem: `Deseja realmente restaurar o produto "${item.descricao}" ao estoque?`,
      acao: confirmarRestauracao
    });
  };

  // Ação real após confirmação
  const confirmarRestauracao = async (id) => {
    try {
      // CORREÇÃO: Endpoint limpo
      await api.post(`/auditoria/restaurar/${id}`);
      toast.success("Item restaurado com sucesso! 🎉");
      setModalConfig({ ...modalConfig, open: false });
      carregarDados(0, true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Erro ao restaurar item.");
    }
  };

  const baixarPDF = async () => {
    const toastId = toast.loading("Gerando PDF...");
    try {
      const params = { inicio: dataInicio, fim: dataFim, search: termoBusca };
      // CORREÇÃO: Endpoint limpo
      const res = await api.get('/auditoria/relatorio/pdf', { params, responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Auditoria_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.update(toastId, { render: "PDF baixado!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (error) {
      toast.update(toastId, { render: "Erro ao gerar PDF.", type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  // Helpers UI
  const getEventStyle = (tipo) => {
      if (tipo?.includes('EXCLUSAO') || tipo?.includes('CANCELAMENTO'))
          return { icon: <Trash2 size={18} />, color: 'danger' };
      if (tipo?.includes('ESTOQUE_NEGATIVO') || tipo?.includes('ERRO'))
          return { icon: <AlertTriangle size={18} />, color: 'warning' };
      if (tipo?.includes('RESTORE'))
          return { icon: <RotateCcw size={18} />, color: 'success' };
      return { icon: <Activity size={18} />, color: 'default' };
  };

  return (
    <div className="auditoria-container fade-in">
      <div className="auditoria-header">
        <div className="header-title">
          <h1><ShieldAlert size={28} className="text-primary"/> Auditoria & Segurança</h1>
          <p>Rastreabilidade completa de operações sensíveis</p>
        </div>

        <div className="header-tabs">
            <button className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
                <History size={18} /> Histórico
            </button>
            <button className={`tab-btn ${activeTab === 'lixeira' ? 'active' : ''}`} onClick={() => setActiveTab('lixeira')}>
                <Trash2 size={18} /> Lixeira
            </button>
        </div>
      </div>

      <div className="auditoria-toolbar">
        <div className="search-wrapper-audit">
            <Search size={18} className="search-icon"/>
            <input
                type="text"
                placeholder={activeTab === 'timeline' ? "Buscar eventos..." : "Buscar produto excluído..."}
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
            />
        </div>

        {activeTab === 'timeline' && (
            <div className="date-range-audit">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                <span>até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
        )}

        <div className="audit-actions">
            <button className="btn-icon-audit" onClick={() => carregarDados(0, true)} data-tooltip="Atualizar Lista">
                <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-icon-audit primary" onClick={baixarPDF} data-tooltip="Exportar Relatório PDF">
                <FileText size={18} /> <span className="mobile-hide">Exportar</span>
            </button>
        </div>
      </div>

      <div className="audit-content">
        {activeTab === 'timeline' && (
            <div className="timeline-feed">
                {logs.length === 0 && !loading ? (
                    <div className="empty-audit"><Activity size={48} opacity={0.2} /><p>Nenhum registro encontrado.</p></div>
                ) : (
                    logs.map((log, idx) => {
                        const style = getEventStyle(log.tipoEvento);
                        return (
                            <div key={log.id || idx} className={`timeline-entry ${style.color}`}>
                                <div className="entry-marker">{style.icon}</div>
                                <div className="entry-card">
                                    <div className="entry-header">
                                        <span className="entry-type">{log.tipoEvento?.replace(/_/g, ' ')}</span>
                                        <span className="entry-date"><Calendar size={12}/> {new Date(log.dataHora).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <p className="entry-msg">{log.mensagem}</p>
                                    <div className="entry-meta">
                                        <User size={12}/> {log.usuarioResponsavel || 'Sistema'}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        )}

        {activeTab === 'lixeira' && (
            <div className="trash-grid-view">
                {lixeira.length === 0 && !loading ? (
                    <div className="empty-audit"><Trash2 size={48} opacity={0.2} /><p>A lixeira está vazia.</p></div>
                ) : (
                    lixeira.map((item) => (
                        <div key={item.id} className="trash-item-card">
                            <div className="trash-img-placeholder"><Trash2 size={24} color="#ef4444"/></div>
                            <div className="trash-details">
                                <strong>{item.descricao}</strong>
                                <small>Cód: {item.codigoBarras || 'N/A'}</small>
                                <span className="deleted-info">Por: {item.usuarioExclusao || '?'}</span>
                            </div>

                            <button
                                className="btn-restore-action"
                                onClick={() => solicitarRestauracao(item)}
                                data-tooltip="Restaurar ao Estoque"
                            >
                                <RotateCcw size={16}/> Restaurar
                            </button>
                        </div>
                    ))
                )}
            </div>
        )}

        {loading && <div className="loading-spinner-audit"><RefreshCw className="spin"/> Carregando...</div>}

        {!loading && hasMore && (logs.length > 0 || lixeira.length > 0) && (
            <button className="btn-audit-loadmore" onClick={() => { setPage(page+1); carregarDados(page+1, false); }}>
                <ArrowDownCircle size={18}/> Ver Mais
            </button>
        )}
      </div>

      {modalConfig.open && (
        <ConfirmModal
          title={modalConfig.titulo}
          message={modalConfig.mensagem}
          onConfirm={() => modalConfig.acao(modalConfig.id)}
          onCancel={() => setModalConfig({ ...modalConfig, open: false })}
        />
      )}
    </div>
  );
};

export default Auditoria;