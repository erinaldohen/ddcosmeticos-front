import React, { useState, useEffect } from 'react';
import {
  Activity, Search, Trash2, RefreshCw,
  AlertTriangle, CheckCircle, User, Calendar, Clock,
  FileText, Download, ShieldAlert
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

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
        // Endpoint: AuditoriaController.listarEventos()
        const res = await api.get('/auditoria/eventos');
        setLogs(res.data || []);
      } else {
        // Endpoint: AuditoriaController.listarLixeira()
        const res = await api.get('/auditoria/lixeira');
        setLixeira(res.data || []);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados de auditoria.");
    } finally {
      setLoading(false);
    }
  };

  // --- AÇÕES ---
  const restaurarItem = async (id, nome) => {
    if(!window.confirm(`Deseja restaurar "${nome}" ao estoque?`)) return;

    try {
      // Endpoint: POST /api/v1/auditoria/restaurar/{id}
      await api.post(`/auditoria/restaurar/${id}`);
      toast.success("Item restaurado com sucesso!");
      carregarDados();
    } catch (error) {
      toast.error("Erro ao restaurar item.");
    }
  };

  const baixarPDF = async () => {
    try {
      const res = await api.get('/auditoria/relatorio/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `auditoria_dd_${new Date().toLocaleDateString()}.pdf`);
      document.body.appendChild(link);
      link.click();
      toast.success("Relatório gerado!");
    } catch (error) {
      toast.error("Erro ao gerar PDF.");
    }
  };

  // --- FILTRAGEM (Frontend) ---
  const logsFiltrados = logs.filter(log =>
    log.mensagem?.toLowerCase().includes(filtro.toLowerCase()) ||
    log.usuarioResponsavel?.toLowerCase().includes(filtro.toLowerCase()) ||
    log.tipoEvento?.toLowerCase().includes(filtro.toLowerCase())
  );

  const lixeiraFiltrada = lixeira.filter(item =>
    item.descricao?.toLowerCase().includes(filtro.toLowerCase()) ||
    item.codigoBarras?.includes(filtro)
  );

  // --- RENDERIZAÇÃO ---
  return (
    <div className="dashboard-container fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={32} color="#F22998" /> {/* Magenta da marca */}
            <h1>Auditoria & Segurança</h1>
          </div>
          <p className="text-muted" style={{ marginTop: '4px' }}>Rastreabilidade total das operações do sistema.</p>
        </div>

        <div style={{display:'flex', gap:'10px'}}>
           <button className="btn-cancel" onClick={carregarDados}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar
          </button>
          <button className="btn-confirm" onClick={baixarPDF}>
            <FileText size={18} /> Baixar Relatório PDF
          </button>
        </div>
      </header>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="chart-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              flex: 1, padding: '15px', background: activeTab === 'timeline' ? '#fff' : '#f8fafc',
              borderBottom: activeTab === 'timeline' ? '3px solid #F22998' : 'none',
              fontWeight: '600', color: activeTab === 'timeline' ? '#F22998' : '#64748b',
              display: 'flex', justifyContent: 'center', gap: '8px'
            }}
          >
            <ShieldAlert size={18} /> Log de Eventos
          </button>
          <button
            onClick={() => setActiveTab('lixeira')}
            style={{
              flex: 1, padding: '15px', background: activeTab === 'lixeira' ? '#fff' : '#f8fafc',
              borderBottom: activeTab === 'lixeira' ? '3px solid #F22998' : 'none',
              fontWeight: '600', color: activeTab === 'lixeira' ? '#F22998' : '#64748b',
              display: 'flex', justifyContent: 'center', gap: '8px'
            }}
          >
            <Trash2 size={18} /> Lixeira de Produtos
          </button>
        </div>

        {/* BARRA DE BUSCA */}
        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
          <div className="filter-bar" style={{margin:0, width: '100%'}}>
            <Search size={20} className="text-muted" />
            <input
              type="text"
              className="form-control"
              style={{ width: '100%', border: 'none', boxShadow: 'none', padding: 0 }}
              placeholder={activeTab === 'timeline' ? "Buscar por evento, usuário ou mensagem..." : "Buscar produto excluído..."}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div style={{ padding: '20px', background: '#fdfdfd', minHeight: '400px' }}>
          {loading ? (
            <div className="text-center p-5 text-muted">Carregando registros...</div>
          ) : (
            <>
              {/* --- ABA TIMELINE --- */}
              {activeTab === 'timeline' && (
                <div className="timeline">
                  {logsFiltrados.length === 0 ? (
                    <div className="text-center p-5 text-muted">Nenhum evento de segurança encontrado.</div>
                  ) : (
                    logsFiltrados.map((log) => (
                      <div key={log.id} className="timeline-item">
                        <div className="timeline-marker">
                          <div className={`dot ${log.tipoEvento === 'ESTOQUE_NEGATIVO' || log.tipoEvento === 'CANCELAMENTO_VENDA' ? 'EXCLUÍDO' : 'ALTERADO'}`}></div>
                        </div>

                        <div className="timeline-content">
                          <div className="timeline-date">
                            <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                                <Calendar size={14} />
                                {new Date(log.dataHora).toLocaleString('pt-BR')}
                            </div>
                            {/* Tags Coloridas baseadas no tipo de evento */}
                            <span className={`badge-sm ${
                                log.tipoEvento === 'ESTOQUE_NEGATIVO' ? 'EXCLUÍDO' :
                                log.tipoEvento === 'CANCELAMENTO_VENDA' ? 'EXCLUÍDO' : 'ALTERADO'
                            }`}>
                                {log.tipoEvento.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div style={{ marginBottom: '10px', color: '#334155', fontWeight: '500' }}>
                             {log.tipoEvento === 'ESTOQUE_NEGATIVO' && <AlertTriangle size={16} color="#ef4444" style={{verticalAlign:'text-bottom', marginRight:'5px'}} />}
                             {log.mensagem}
                          </div>

                          <div className="timeline-footer">
                            <User size={14} /> Responsável: <strong>{log.usuarioResponsavel || 'Sistema'}</strong>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* --- ABA LIXEIRA --- */}
              {activeTab === 'lixeira' && (
                 <table className="modern-table">
                   <thead>
                     <tr>
                       <th>Código</th>
                       <th>Descrição</th>
                       <th>Preço Antigo</th>
                       <th className="text-right">Ação</th>
                     </tr>
                   </thead>
                   <tbody>
                     {lixeiraFiltrada.length === 0 ? (
                        <tr><td colSpan="4" className="text-center text-muted p-4">Lixeira vazia.</td></tr>
                     ) : (
                        lixeiraFiltrada.map(item => (
                            <tr key={item.id}>
                                <td style={{fontFamily:'monospace'}}>{item.codigoBarras || 'N/A'}</td>
                                <td>{item.descricao}</td>
                                <td>{item.precoVenda?.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                                <td className="text-right">
                                    <button className="btn-confirm success" onClick={() => restaurarItem(item.id, item.descricao)} style={{fontSize:'0.8rem', padding:'4px 10px'}}>
                                        <RefreshCw size={14} /> Restaurar
                                    </button>
                                </td>
                            </tr>
                        ))
                     )}
                   </tbody>
                 </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auditoria;