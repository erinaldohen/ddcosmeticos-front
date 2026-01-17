import React from 'react';
import { Trash2, CheckCircle, Zap, Bot, X, AlertTriangle, Info } from 'lucide-react';
import './ConfirmModal.css'; // Vamos criar esse CSS no passo 2

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, type = 'danger' }) => {
  if (!isOpen) return null;

  // Configuração Visual baseada no TIPO
  const config = {
    danger:  { icon: <Trash2 size={24}/>, style: 'danger', btn: 'red' },
    success: { icon: <CheckCircle size={24}/>, style: 'success', btn: 'green' },
    warning: { icon: <AlertTriangle size={24}/>, style: 'warning', btn: 'orange' },
    robot:   { icon: <Bot size={24}/>, style: 'robot', btn: 'purple' },
    info:    { icon: <Info size={24}/>, style: 'info', btn: 'blue' },
    zap:     { icon: <Zap size={24}/>, style: 'warning', btn: 'orange' }
  };

  const current = config[type] || config.danger;

  return (
    <div className="modal-backdrop fade-in" onClick={onClose}>
      <div className="modal-card small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-clean">
          <div className={`icon-circle ${current.style}`}>
             {current.icon}
          </div>
          <button onClick={onClose} className="btn-close-simple"><X size={20}/></button>
        </div>

        <div className="modal-body-clean">
           <h3>{title}</h3>
           <p>{message}</p>
        </div>

        <div className="modal-footer-clean">
           <button className="btn-secondary" onClick={onClose}>Cancelar</button>
           <button className={`btn-primary ${current.btn}`} onClick={() => { onConfirm(); onClose(); }}>
             {confirmText || 'Confirmar'}
           </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;