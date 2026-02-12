import React from 'react';
import { ShieldAlert, Bell, Info, ArrowRight, ShieldCheck } from 'lucide-react';

const AuditPanel = ({ alertas, loading, onNavigate }) => {

  // Função que mapeia o evento para a gravidade visual (CSS)
  const getAlertConfig = (evento) => {
    const tipo = String(evento || '').toUpperCase();

    // NÍVEL ALTO: Ações destrutivas ou erros críticos
    if (tipo.includes('DELETE') || tipo.includes('EXCLUSAO') || tipo.includes('NEGADO') || tipo.includes('ERRO')) {
      return { class: 'alto', icon: <ShieldAlert size={18} /> };
    }

    // NÍVEL MÉDIO: Alterações sensíveis (Preço, Estoque, Desconto)
    if (tipo.includes('UPDATE') || tipo.includes('PRECO') || tipo.includes('DESCONTO') || tipo.includes('ESTOQUE')) {
      return { class: 'medio', icon: <Bell size={18} /> };
    }

    // NÍVEL BAIXO: Operações de rotina (Login, Cadastro, Consultas)
    return { class: 'baixo', icon: <Info size={18} /> };
  };

  return (
    <div className="audit-panel shadow-luxury">
      {/* HEADER */}
      <div className="audit-header">
        <h3><ShieldCheck size={20} /> Segurança & Auditoria</h3>
        {!loading && alertas.length > 0 && (
          <span className="badge-count">{alertas.length}</span>
        )}
      </div>

      {/* LEGENDA DE CORES */}
      <div className="audit-legend-container">
        <div className="legend-row"><span className="dot alto"></span> Crítico</div>
        <div className="legend-row"><span className="dot medio"></span> Atenção</div>
        <div className="legend-row"><span className="dot baixo"></span> Info</div>
      </div>

      {/* LISTA COM SCROLL INTERNO */}
      <div className="audit-list">
        {loading ? (
          <div className="p-20">
            <div className="skeleton-text" style={{ width: '80%' }}></div>
            <div className="skeleton-text" style={{ width: '60%' }}></div>
            <div className="skeleton-text" style={{ width: '90%' }}></div>
          </div>
        ) : alertas.length > 0 ? (
          alertas.map((item, idx) => {
            const config = getAlertConfig(item.tipoEvento);
            return (
              <div key={idx} className={`audit-item ${config.class}`}>
                <div className="audit-icon-area">{config.icon}</div>
                <div className="audit-info">
                  <strong>{item.mensagem}</strong>
                  <div className="audit-meta">
                    <span className="user-name">{item.usuarioResponsavel || 'Sistema'}</span>
                    <span className="meta-separator">•</span>
                    <span className="time-stamp">
                      {new Date(item.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state-container">
            <ShieldCheck size={32} opacity={0.2} />
            <span className="empty-subtext">Operação segura: Nenhum alerta.</span>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="audit-footer">
        <button className="btn-audit-action" onClick={onNavigate}>
          Ver Histórico Completo <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default AuditPanel;