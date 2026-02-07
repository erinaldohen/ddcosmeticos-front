import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ConfirmModal.css';

const ConfirmModal = ({ title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", isDanger = true }) => {
    return (
        <div className="modal-overlay fade-in">
            <div className="modal-confirm-box">
                <div className="modal-confirm-header">
                    <div className={`icon-warning ${isDanger ? 'danger' : 'info'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <h3>{title}</h3>
                    <button className="btn-close-icon" onClick={onCancel}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-confirm-body">
                    <p>{message}</p>
                </div>

                <div className="modal-confirm-footer">
                    <button className="btn-modal-cancel" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button
                        className={`btn-modal-confirm ${isDanger ? 'danger' : 'primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;