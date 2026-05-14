import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import {
  Barcode, CheckCircle2, AlertCircle, Search,
  PackageX, Camera, ChevronRight, Loader2
} from 'lucide-react';
import './AuditoriaPreco.css';

const AuditoriaPreco = () => {
  const [ean, setEan] = useState('');
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef(null);

  // Foco perpétuo no input para agilizar o processo de bipa-bipa
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
      // Feedback táctil/sonoro
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
    try {
      await api.post(`/produtos/${produto.id}/divergencia`);
      toast.warning("Divergência registada para correção.");
      setProduto(null);
    } catch (error) {
      toast.error("Falha ao comunicar divergência.");
    }
  };

  return (
    <div className="auditoria-page-layout fade-in">
      <div className="auditoria-hero">
        <h1>Auditoria de Gôndola</h1>
        <div className="status-scanner-badge">
          <div className="dot"></div>
          Pronto para escanear
        </div>
      </div>

      {/* ÁREA DO SCANNER */}
      <div className="scanner-input-container">
        <div className="icon-box">
          {loading ? <Loader2 size={24} className="spin" /> : <Search size={24} />}
        </div>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          placeholder="Bipe o código de barras..."
          value={ean}
          onChange={(e) => setEan(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="btn-scan-trigger"
          onClick={() => buscarProduto(ean)}
          disabled={!ean || loading}
        >
          {loading ? '...' : <ChevronRight size={24} />}
        </button>
      </div>

      {/* ESTADO: CARREGANDO */}
      {loading && <div className="loading-shimmer"></div>}

      {/* ESTADO: NÃO ENCONTRADO */}
      {notFound && !loading && (
        <div className="not-found-state slide-up">
          <PackageX size={64} strokeWidth={1.5} />
          <h2>Produto não encontrado</h2>
          <p>O EAN <strong>{ean}</strong> não consta na base de dados.</p>
          <button className="btn-back-soft" style={{marginTop: '20px'}} onClick={() => setNotFound(false)}>Tentar outro</button>
        </div>
      )}

      {/* ESTADO: PRODUTO ENCONTRADO */}
      {produto && !loading && (
        <div className="result-card-premium success-mode slide-up">
          <div className="res-brand">{produto.marca || 'Marca Própria'}</div>
          <h3 className="res-name">{produto.descricao}</h3>

          <div className="price-focus-zone">
            <span className="label">VALOR ATUAL NO CAIXA</span>
            <span className="value">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.precoVenda || 0)}
            </span>
          </div>

          <div className="stock-pill">
            <Barcode size={18} />
            <span>{produto.codigoBarras}</span>
            <span style={{margin: '0 8px', opacity: 0.3}}>|</span>
            <span>Estoque: <strong>{produto.quantidadeEmEstoque || 0} un.</strong></span>
          </div>

          <div className="audit-actions-grid">
            <button className="btn-audit correct" onClick={() => setProduto(null)}>
              <CheckCircle2 size={32} />
              <span>PREÇO OK</span>
            </button>

            <button className="btn-audit wrong" onClick={reportarDivergencia}>
              <AlertCircle size={32} />
              <span>DIVERGENTE</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaPreco;