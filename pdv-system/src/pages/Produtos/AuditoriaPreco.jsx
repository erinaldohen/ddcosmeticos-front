import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Barcode, CheckCircle2, AlertCircle, Search,
  PackageX, ChevronRight, Loader2, Info, ShoppingCart, Tag
} from 'lucide-react';
import './AuditoriaPreco.css';

const AuditoriaPreco = () => {
  const [ean, setEan] = useState('');
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [produto, notFound, loading]);

  const buscarProduto = async (codigo) => {
    const cleanCode = codigo?.trim();
    if (!cleanCode) return;

    setLoading(true);
    setNotFound(false);
    setProduto(null);

    try {
      const response = await api.get(`/produtos/codigo/${cleanCode}`);
      setProduto(response.data);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (error) {
      setNotFound(true);
      toast.error("Código não reconhecido.");
    } finally {
      setLoading(false);
      setEan('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') buscarProduto(ean);
  };

  const reportarDivergencia = async () => {
    if (!produto) return;
    const toastId = toast.loading("Comunicando divergência...");
    try {
      await api.post(`/produtos/${produto.id}/divergencia`);
      toast.update(toastId, { render: "Divergência registada com sucesso!", type: "warning", isLoading: false, autoClose: 3000 });
      setProduto(null);
    } catch (error) {
      toast.update(toastId, { render: "Falha ao comunicar erro.", type: "error", isLoading: false, autoClose: 3000 });
    }
  };

  return (
    <div className="audit-container fade-in">
      <div className="audit-header">
        <div className="header-content">
          <h1>Auditoria de Gôndola</h1>
          <p>Validação instantânea de preços e estoque</p>
        </div>
        <div className="scanner-badge">
          <div className="pulse-blue"></div>
          <span>Scanner Ativo</span>
        </div>
      </div>

      <div className="scanner-section">
        <div className="scanner-frame">
          <div className="corner top-left"></div>
          <div className="corner top-right"></div>
          <div className="corner bottom-left"></div>
          <div className="corner bottom-right"></div>

          <div className="input-wrapper">
            <div className="input-icon">
              {loading ? <Loader2 className="spin-blue" /> : <Barcode size={28} />}
            </div>
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              placeholder="Aguardando bip..."
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="btn-trigger"
              onClick={() => buscarProduto(ean)}
              disabled={!ean || loading}
            >
              {loading ? '...' : <ChevronRight size={28} />}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="shimmer-card"></div>
        </div>
      )}

      {notFound && !loading && (
        <div className="state-card not-found-anim">
          <div className="icon-circle error">
            <PackageX size={40} />
          </div>
          <h2>Código não mapeado</h2>
          <p>O EAN <strong>{ean}</strong> não foi localizado no sistema.</p>
          <button className="btn-retry" onClick={() => setNotFound(false)}>Limpar e tentar novo</button>
        </div>
      )}

      {produto && !loading && (
        <div className="result-card-modern result-anim">
          <div className="card-top">
            <div className="brand-tag">{produto.marca || 'DD Cosméticos'}</div>
            <h3 className="product-title">{produto.descricao}</h3>
          </div>

          <div className="price-display-box">
            <div className="price-label">
               <Tag size={14} /> PREÇO DE VENDA (PDV)
            </div>
            <div className="price-value">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.precoVenda || 0)}
            </div>
          </div>

          <div className="info-row">
            <div className="info-pill">
              <Barcode size={16} />
              <span>{produto.codigoBarras}</span>
            </div>
            <div className="info-pill">
              <ShoppingCart size={16} />
              <span>Estoque: <strong>{produto.quantidadeEmEstoque || 0}</strong> un.</span>
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn-audit-action check" onClick={() => setProduto(null)}>
              <CheckCircle2 size={24} />
              <span>PREÇO CORRETO</span>
            </button>

            <button className="btn-audit-action warn" onClick={reportarDivergencia}>
              <AlertCircle size={24} />
              <span>DIVERGÊNCIA</span>
            </button>
          </div>
        </div>
      )}

      <div className="audit-footer">
        <Info size={14} />
        <span>Mantenha o cursor no campo para uso de leitores laser externos.</span>
      </div>
    </div>
  );
};

export default AuditoriaPreco;