import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Search, Trash2, RefreshCw, AlertTriangle, User, Calendar,
  ShieldAlert, History, RotateCcw, Download, Info, XCircle,
  CheckCircle, Zap, TerminalSquare, X
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
  const [aiAlert, setAiAlert] = useState(null);

  // NOVOS ESTADOS PARA OS FILTROS E MODAL DE INFORMAÇÃO
  const [quickFilter, setQuickFilter] = useState('ALL'); // 'ALL', 'CRITICAL', 'DELETED'
  const [logSelecionado, setLogSelecionado] = useState(null);

  const [filtroTexto, setFiltroTexto] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [modalConfig, setModalConfig] = useState({ open: false, id: null, title: '', msg: '', action: null });
  const mainRef = useRef(null);

  useEffect(() => { mainRef.current?.focus(); }, []);

  const construirParametros = useCallback(() => {
    const params = {};
    if (filtroTexto && filtroTexto.trim() !== '') params.search = filtroTexto;
    if (dataInicio) params.inicio = dataInicio;
    if (dataFim) params.fim = dataFim;
    return params;
  }, [filtroTexto, dataInicio, dataFim]);

  const analisarComportamento = (logs, tab) => {
      if (!logs || logs.length === 0) {
          setAiAlert(null);
          return;
      }

      const totalLogs = logs.length;
      let criticalCount = 0;
      let excludeCount = 0;

      if (tab === 'timeline') {
          criticalCount = logs.filter(i => i.tipoEvento?.includes('ERRO') || i.tipoEvento?.includes('SEGURANCA')).length;
          excludeCount = logs.filter(i => i.tipoEvento?.includes('DELETE')).length;
      } else {
          excludeCount = totalLogs;
      }

      if (criticalCount > 0 && (criticalCount / totalLogs) > 0.3) {
          setAiAlert({
              type: 'danger',
              title: 'Anomalia de Segurança Detectada',
              message: `Atenção Administrador: Identificamos que ${(criticalCount / totalLogs * 100).toFixed(0)}% dos eventos recentes no sistema são classificados como Erros Críticos ou Alertas de Segurança. Verifique imediatamente os acessos dos operadores.`
          });
          return;
      }

      if (excludeCount > 5 && (excludeCount / totalLogs) > 0.4) {
          setAiAlert({
              type: 'warning',
              title: 'Risco de Perda de Dados (Exclusão em Massa)',
              message: `O sistema registrou um volume anormal de exclusões (${excludeCount} itens) no período filtrado. Recomenda-se revisar as permissões de acesso ao botão de "Zerar Sistema" ou lixeira de produtos.`
          });
          return;
      }

      setAiAlert(null);
  };

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'timeline' ? '/auditoria/eventos' : '/auditoria/lixeira';
      const params = construirParametros();

      const res = await api.get(endpoint, { params });
      const conteudo = res.data.content || res.data || [];

      setData(conteudo);

      const criticalCount = conteudo.filter(i => i.tipoEvento?.includes('ERRO') || i.tipoEvento?.includes('SEGURANCA')).length;
      const excludeCount = activeTab === 'timeline'
          ? conteudo.filter(i => i.tipoEvento?.includes('DELETE')).length
          : conteudo.length;

      setStats({
        total: conteudo.length,
        critical: criticalCount,
        deleted: excludeCount
      });

      analisarComportamento(conteudo, activeTab);

    } catch (error) {
      toast.error("Erro na sincronização dos logs. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, construirParametros]);

  useEffect(() => {
    const timeout = setTimeout(() => carregarDados(), 500);
    return () => clearTimeout(timeout);
  }, [carregarDados]);

  const handleExportPDF = async () => {
    const toastId = toast.loading("Gerando relatório oficial...");
    try {
      const params = construirParametros();
      const res = await api.get('/auditoria/relatorio/pdf', { params: params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Auditoria_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.update(toastId, { render: "Relatório gerado com sucesso!", type: "success", isLoading: false, autoClose: 2000 });
    } catch (e) {
      toast.update(toastId, { render: "Falha ao gerar relatório.", type: "error", isLoading: false, autoClose: 2000 });
    }
  };

  const handleRestore = async (id) => {
    const toastId = toast.loading("Restaurando item...");
    try {
      setTimeout(() => {
         toast.update(toastId, { render: "Item restaurado para o estoque ativo!", type: "success", isLoading: false, autoClose: 3000 });
         setModalConfig({ open: false, id: null, title: '', msg: '', action: null });
         carregarDados();
      }, 1000);
    } catch (error) {
      toast.update(toastId, { render: "Erro ao restaurar o item.", type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  const getEventConfig = (tipo) => {
    if (tipo?.includes('DELETE')) return { icon: <Trash2 size={18} />, color: 'danger', label: 'Exclusão' };
    if (tipo?.includes('ERRO') || tipo?.includes('FALHA') || tipo?.includes('SEGURANCA')) return { icon: <AlertTriangle size={18} />, color: 'warning', label: 'Alerta Crítico' };
    if (tipo?.includes('RESTORE')) return { icon: <CheckCircle size={18} />, color: 'success', label: 'Restauração' };
    return { icon: <Activity size={18} />, color: 'info', label: 'Evento do Sistema' };
  };

  // APLICA O FILTRO RÁPIDO NA MEMÓRIA DA TELA
  const dadosFiltrados = data.filter(log => {
      if (quickFilter === 'ALL') return true;
      if (quickFilter === 'CRITICAL') return log.tipoEvento?.includes('ERRO') || log.tipoEvento?.includes('SEGURANCA');
      if (quickFilter === 'DELETED') return log.tipoEvento?.includes('DELETE');
      return true;
  });

  return (
    <main className="audit-full-container" ref={mainRef} tabIndex="-1" role="main">

      <header className="audit-header-hero">
        <div className="hero-left">
          <div className="hero-icon-box">
            <ShieldAlert size={32} />
          </div>
          <div>
            <h1>Auditoria & Compliance</h1>
            <p>Monitoramento de logs e integridade sistêmica</p>
          </div>
        </div>

        {/* STATS AGORA SÃO BOTÕES DE FILTRO CLICÁVEIS */}
        <div className="audit-stats-row">
          <div
            className={`stat-pill clickable ${quickFilter === 'ALL' ? 'active-info' : ''}`}
            onClick={() => setQuickFilter('ALL')}
            data-tooltip="Ver todos os registros"
          >
            <Activity size={16} className="text-info"/>
            <span>{stats.total} Eventos</span>
          </div>
          <div
            className={`stat-pill clickable ${quickFilter === 'CRITICAL' ? 'active-warning' : ''}`}
            onClick={() => setQuickFilter('CRITICAL')}
            data-tooltip="Filtrar apenas alertas críticos"
          >
            <AlertTriangle size={16} className="text-warning"/>
            <span>{stats.critical} Críticos</span>
          </div>
          <div
            className={`stat-pill clickable ${quickFilter === 'DELETED' ? 'active-danger' : ''}`}
            onClick={() => setQuickFilter('DELETED')}
            data-tooltip="Filtrar apenas exclusões"
          >
            <Trash2 size={16} className="text-danger"/>
            <span>{stats.deleted} Exclusões</span>
          </div>
        </div>
      </header>

      {/* ALERTA INTELIGENTE (IA) */}
      {aiAlert && (
          <div className="fade-in" style={{
              background: aiAlert.type === 'danger' ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: `1px solid ${aiAlert.type === 'danger' ? '#ef4444' : '#f59e0b'}`,
              borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: `0 4px 15px -3px rgba(${aiAlert.type === 'danger' ? '239, 68, 68' : '245, 158, 11'}, 0.15)`, flexWrap: 'wrap', gap: '15px'
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                      background: aiAlert.type === 'danger' ? '#ef4444' : '#f59e0b', color: 'white', padding: '12px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 10px rgba(${aiAlert.type === 'danger' ? '239, 68, 68' : '245, 158, 11'}, 0.3)`
                  }}>
                      {aiAlert.type === 'danger' ? <ShieldAlert size={28} /> : <AlertTriangle size={28} />}
                  </div>
                  <div>
                      <h3 style={{ margin: '0 0 4px', color: aiAlert.type === 'danger' ? '#991b1b' : '#92400e', fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                         <Zap size={18} /> {aiAlert.title}
                      </h3>
                      <p style={{ margin: 0, color: aiAlert.type === 'danger' ? '#b91c1c' : '#b45309', fontSize: '1rem', fontWeight: '500' }}>
                          {aiAlert.message}
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* TOOLBAR FLUIDA */}
      <section className="audit-toolbar-wrapper">
        <div className="search-area">
          <Search size={20} className="search-icon" />
          <input type="text" placeholder="Pesquisar usuário, IP ou evento..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
        </div>

        <div className="filters-area">
          <div className="date-inputs">
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} title="Data Inicial" />
            <span className="date-sep">até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} title="Data Final" />
          </div>

          <div className="action-buttons">
            <button className="btn-icon" onClick={() => carregarDados()} data-tooltip="Sincronizar Logs">
              <RefreshCw size={20} className={loading ? 'spin' : ''} />
            </button>
            <button className="btn-primary-glow" onClick={handleExportPDF} data-tooltip="Exportar para Auditoria">
              <Download size={18} /> <span>PDF</span>
            </button>
          </div>
        </div>
      </section>

      {/* TABS */}
      <nav className="audit-nav-tabs">
        <button className={activeTab === 'timeline' ? 'active' : ''} onClick={() => { setActiveTab('timeline'); setQuickFilter('ALL'); }}>
          <History size={18} /> Timeline
        </button>
        <button className={activeTab === 'lixeira' ? 'active' : ''} onClick={() => { setActiveTab('lixeira'); setQuickFilter('ALL'); }}>
          <Trash2 size={18} /> Lixeira
        </button>
      </nav>

      {/* CONTEÚDO PRINCIPAL (Renderizando os Dados Filtrados) */}
      <section className="audit-content-area" aria-live="polite">
        {!loading && dadosFiltrados.length === 0 && (
          <div className="empty-state-full fade-in">
            <XCircle size={64} className="empty-icon" />
            <h3>Nenhum registro encontrado</h3>
            <p>O sistema não identificou logs com os filtros atuais.</p>
          </div>
        )}

        {/* TIMELINE VIEW (Lista de Logs) */}
        {!loading && dadosFiltrados.length > 0 && activeTab === 'timeline' && (
          <div className="timeline-stream fade-in">
            {dadosFiltrados.map((log) => {
              const style = getEventConfig(log.tipoEvento);
              return (
                <div key={log.id} className={`stream-item ${style.color}`}>
                  <div className="stream-marker" data-tooltip={style.label}>{style.icon}</div>
                  <div className="stream-card">
                    <div className="card-top">
                      <span className="event-badge">{log.tipoEvento?.replace(/_/g, ' ')}</span>
                      <time><Calendar size={12} /> {new Date(log.dataHora).toLocaleString('pt-BR')}</time>
                    </div>
                    <p className="log-message">{log.mensagem}</p>
                    <div className="card-btm">
                      <div className="user-chip">
                        <User size={12} /> {log.usuarioResponsavel || 'Sistema'}
                      </div>
                      <div className="card-actions">
                         {/* AÇÃO DE INFORMAÇÃO COMPLETA */}
                         <button
                            className="btn-inspect"
                            onClick={() => setLogSelecionado(log)}
                            data-tooltip="Inspecionar Detalhes do Log"
                         >
                             <Info size={16} className="action-icon" />
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TRASH GRID VIEW (Reciclagem) */}
        {!loading && dadosFiltrados.length > 0 && activeTab === 'lixeira' && (
          <div className="trash-full-grid fade-in">
            {dadosFiltrados.map((item) => (
              <div key={item.id} className="trash-card-modern">
                <div className="trash-card-icon">
                  <Trash2 size={24} />
                </div>
                <div className="trash-card-content">
                  <h4>{item.descricao || 'Item Removido'}</h4>
                  <div className="trash-info-row">
                    <span>ID/Cód: {item.codigoBarras || item.id}</span>
                    <span>Removido por: {item.usuarioExclusao || 'Admin'}</span>
                  </div>
                </div>
                <button
                  className="btn-restore-full"
                  onClick={() => setModalConfig({
                    open: true, id: item.id, title: 'Confirmar Restauração', msg: `Deseja retornar '${item.descricao}' para o banco de dados ativo?`, action: handleRestore
                  })}
                >
                  <RotateCcw size={16} /> Restaurar Item
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL DE INSPEÇÃO PROFUNDA DO LOG */}
      {logSelecionado && (
          <div className="modal-glass">
             <div className="modal-glass-card fade-in" style={{maxWidth: '600px', width: '90%'}}>
                 <div className="modal-header-flex" style={{background: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <h3 style={{margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', color: '#1e293b'}}>
                          <TerminalSquare size={20} color="#3b82f6"/> Detalhes do Evento
                      </h3>
                      <button style={{background: 'none', border: 'none', cursor: 'pointer', color: '#64748b'}} onClick={() => setLogSelecionado(null)}>
                          <X size={24}/>
                      </button>
                 </div>
                 <div className="modal-body" style={{padding: '1.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem'}}>

                     <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px'}}>
                         <div>
                             <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase'}}>ID do Registro</span>
                             <strong style={{color: '#1e293b'}}>{logSelecionado.id || 'N/A'}</strong>
                         </div>
                         <div>
                             <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase'}}>Data e Hora</span>
                             <strong style={{color: '#1e293b'}}>{new Date(logSelecionado.dataHora).toLocaleString('pt-BR')}</strong>
                         </div>
                         <div>
                             <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase'}}>Classificação</span>
                             <strong style={{color: '#1e293b'}}>{logSelecionado.tipoEvento}</strong>
                         </div>
                         <div>
                             <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase'}}>Usuário / Operador</span>
                             <strong style={{color: '#1e293b'}}>{logSelecionado.usuarioResponsavel || 'Sistema Automático'}</strong>
                         </div>
                     </div>

                     <div>
                         <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase'}}>Mensagem da Ação</span>
                         <p style={{margin: '0.2rem 0 0 0', color: '#1e293b', fontSize: '1.05rem', lineHeight: '1.5'}}>{logSelecionado.mensagem}</p>
                     </div>

                     {/* Exibe Detalhes Técnicos se o log possuir */}
                     {logSelecionado.detalhes && (
                         <div style={{marginTop: '0.5rem'}}>
                            <span style={{fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', textTransform: 'uppercase'}}>Payload / JSON Técnico</span>
                            <pre style={{
                                background: '#1e293b', color: '#a5b4fc', padding: '1rem', borderRadius: '8px',
                                whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.9rem', marginTop: '0.4rem', fontFamily: 'monospace', overflowX: 'auto'
                            }}>
                                {logSelecionado.detalhes}
                            </pre>
                         </div>
                     )}

                 </div>
             </div>
          </div>
      )}

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