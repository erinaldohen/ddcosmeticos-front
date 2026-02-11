import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Search, Trash2, RefreshCw, AlertTriangle, User, Calendar,
  FileText, ShieldAlert, History, RotateCcw, Download, Info, XCircle,
  CheckCircle, MoreVertical, Filter
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import './Auditoria.css';

const Auditoria = () => {
  const [activeTab, setActiveTab] = useState('timeline');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, critical: 0, deleted: 0 });

  const [filtroTexto, setFiltroTexto] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [modalConfig, setModalConfig] = useState({ open: false, id: null, title: '', msg: '', action: null });
  const mainRef = useRef(null);

  useEffect(() => { mainRef.current?.focus(); }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'timeline' ? '/auditoria/eventos' : '/auditoria/lixeira';
      const params = { search: filtroTexto, inicio: dataInicio, fim: dataFim };

      const res = await api.get(endpoint, { params });
      const conteudo = res.data.content || res.data || [];

      setData(conteudo);

      setStats({
        total: conteudo.length,
        critical: conteudo.filter(i => i.tipoEvento?.includes('ERRO') || i.tipoEvento?.includes('SEGURANCA')).length,
        deleted: activeTab === 'timeline'
          ? conteudo.filter(i => i.tipoEvento?.includes('EXCLUSAO')).length
          : conteudo.length
      });
    } catch (error) {
      toast.error("Erro na sincronização.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filtroTexto, dataInicio, dataFim]);

  useEffect(() => {
    const timeout = setTimeout(() => carregarDados(), 500);
    return () => clearTimeout(timeout);
  }, [carregarDados]);

  const handleExportPDF = async () => {
    const toastId = toast.loading("Gerando relatório...");
    try {
      const res = await api.get('/auditoria/relatorio/pdf', {
        params: { inicio: dataInicio, fim: dataFim, search: filtroTexto },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Auditoria_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.update(toastId, { render: "Sucesso!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (e) {
      toast.update(toastId, { render: "Erro.", type: "error", isLoading: false, autoClose: 2000 });
    }
  };

  const getEventConfig = (tipo) => {
    if (tipo?.includes('EXCLUSAO')) return { icon: <Trash2 size={18} />, color: 'danger', label: 'Exclusão' };
    if (tipo?.includes('ERRO') || tipo?.includes('FALHA')) return { icon: <AlertTriangle size={18} />, color: 'warning', label: 'Alerta' };
    if (tipo?.includes('RESTORE')) return { icon: <CheckCircle size={18} />, color: 'success', label: 'Restauração' };
    return { icon: <Activity size={18} />, color: 'info', label: 'Evento' };
  };

  return (
    <main className="audit-full-container" ref={mainRef} tabIndex="-1" role="main">

      {/* 1. HEADER EXPANDIDO */}
      <header className="audit-header-hero">
        <div className="hero-left">
          <div className="hero-icon-box">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h1>Auditoria & Compliance</h1>
            <p>Monitoramento de integridade sistêmica</p>
          </div>
        </div>

        <div className="audit-stats-row">
          <div className="stat-pill" data-tooltip="Total de registros no período">
            <Activity size={16} className="text-info"/>
            <span>{stats.total} Eventos</span>
          </div>
          <div className="stat-pill" data-tooltip="Alertas de segurança detectados">
            <AlertTriangle size={16} className="text-warning"/>
            <span>{stats.critical} Críticos</span>
          </div>
          <div className="stat-pill" data-tooltip="Itens removidos permanentemente">
            <Trash2 size={16} className="text-danger"/>
            <span>{stats.deleted} Exclusões</span>
          </div>
        </div>
      </header>

      {/* 2. TOOLBAR FLUIDA */}
      <section className="audit-toolbar-wrapper">
        <div className="search-area">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </div>

        <div className="filters-area">
          <div className="date-inputs">
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} data-tooltip="Data Inicial" />
            <span className="date-sep">a</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} data-tooltip="Data Final" />
          </div>

          <div className="action-buttons">
            <button className="btn-icon" onClick={() => carregarDados()} data-tooltip="Atualizar Lista">
              <RefreshCw size={20} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-primary-glow" onClick={handleExportPDF} data-tooltip="Baixar PDF Assinado">
              <Download size={18} /> <span>Exportar</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. TABS INTEGRADAS */}
      <nav className="audit-nav-tabs">
        <button
          className={activeTab === 'timeline' ? 'active' : ''}
          onClick={() => setActiveTab('timeline')}
        >
          <History size={18} /> Timeline
        </button>
        <button
          className={activeTab === 'lixeira' ? 'active' : ''}
          onClick={() => setActiveTab('lixeira')}
        >
          <Trash2 size={18} /> Lixeira
        </button>
      </nav>

      {/* 4. CONTEÚDO FULL WIDTH */}
      <section className="audit-content-area" aria-live="polite">
        {!loading && data.length === 0 && (
          <div className="empty-state-full">
            <XCircle size={64} opacity={0.1} />
            <h3>Nenhum registro encontrado</h3>
            <p>Tente ajustar os filtros de data ou pesquisa.</p>
          </div>
        )}

        {/* TIMELINE VIEW */}
        {!loading && data.length > 0 && activeTab === 'timeline' && (
          <div className="timeline-stream">
            {data.map((log) => {
              const style = getEventConfig(log.tipoEvento);
              return (
                <div key={log.id} className={`stream-item ${style.color}`}>
                  <div className="stream-marker" data-tooltip={style.label}>{style.icon}</div>
                  <div className="stream-card">
                    <div className="card-top">
                      <span className="event-badge">{log.tipoEvento?.replace(/_/g, ' ')}</span>
                      <time><Calendar size={12} /> {new Date(log.dataHora).toLocaleString('pt-BR')}</time>
                    </div>
                    <p>{log.mensagem}</p>
                    <div className="card-btm">
                      <div className="user-chip">
                        <User size={12} /> {log.usuarioResponsavel || 'Sistema'}
                      </div>
                      <div className="card-actions">
                         <Info size={16} className="action-icon" data-tooltip="Ver Detalhes Técnicos (JSON)" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TRASH GRID VIEW */}
        {!loading && data.length > 0 && activeTab === 'lixeira' && (
          <div className="trash-full-grid">
            {data.map((item) => (
              <div key={item.id} className="trash-card-modern">
                <div className="trash-card-icon">
                  <Trash2 size={24} />
                </div>
                <div className="trash-card-content">
                  <h4>{item.descricao}</h4>
                  <div className="trash-info-row">
                    <span>Cód: {item.codigoBarras || 'N/A'}</span>
                    <span>Por: {item.usuarioExclusao}</span>
                  </div>
                </div>
                <button
                  className="btn-restore-full"
                  onClick={() => setModalConfig({open:true, id:item.id, title:'Restaurar', msg:`Restaurar ${item.descricao}?`, action:async()=>{}})}
                  data-tooltip="Retornar ao Estoque Ativo"
                >
                  <RotateCcw size={16} /> Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {modalConfig.open && (
        <ConfirmModal
          title={modalConfig.title}
          message={modalConfig.msg}
          onConfirm={() => modalConfig.action(modalConfig.id)}
          onCancel={() => setModalConfig({ ...modalConfig, open: false })}
        />
      )}
    </main>
  );
};

export default Auditoria;