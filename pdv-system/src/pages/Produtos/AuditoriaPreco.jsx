import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { Barcode, CheckCircle, AlertTriangle, Search, PackageX } from 'lucide-react';
import './AuditoriaPreco.css';

const AuditoriaPreco = () => {
  const [ean, setEan] = useState('');
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef(null);

  // Mantém o foco no input para o leitor Bluetooth estar sempre pronto
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [produto, notFound]);

  const buscarProduto = async (codigo) => {
    if (!codigo || codigo.trim() === '') return;
    setLoading(true);
    setNotFound(false);
    setProduto(null);

    try {
      const response = await api.get(`/produtos/codigo/${codigo.trim()}`);
      setProduto(response.data);
      // Feedback sonoro opcional de sucesso (Beep)
      const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'); // Beep curto
      audio.play().catch(() => {});
    } catch (error) {
      setNotFound(true);
      toast.error("Produto não encontrado no sistema.");
    } finally {
      setLoading(false);
      setEan(''); // Limpa o input para o próximo bip
    }
  };

  const handleKeyDown = (e) => {
    // Quando o leitor bipa, ele envia a tecla "Enter" no final
    if (e.key === 'Enter') {
      buscarProduto(ean);
    }
  };

  const reportarDivergencia = async () => {
    if (!produto) return;
    try {
      await api.post(`/produtos/${produto.id}/divergencia`);
      toast.warning("Divergência reportada! Enviado para revisão do Gerente.");
      setProduto(null); // Limpa a tela para o próximo produto
    } catch (error) {
      toast.error("Erro ao reportar divergência.");
    }
  };

  const confirmarCorreto = () => {
    // Apenas limpa a tela e volta a focar no input
    setProduto(null);
    toast.success("OK! Próximo produto.", { autoClose: 1000, hideProgressBar: true });
  };

  return (
    <div className="auditoria-container">
      <div className="auditoria-header">
        <Barcode size={32} className="text-primary" />
        <h2>Auditoria de Gôndola</h2>
        <p>Bipe o produto para conferir o preço do sistema.</p>
      </div>

      <div className="auditoria-search-box">
        <div className="input-wrapper">
          <Search size={24} className="icon-search" />
          <input
            ref={inputRef}
            type="number"
            placeholder="Bipe ou digite o código de barras..."
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoFocus
          />
        </div>
        <button
          className="btn-buscar"
          onClick={() => buscarProduto(ean)}
          disabled={loading || !ean}
        >
          {loading ? 'Buscando...' : 'Verificar'}
        </button>
      </div>

      {notFound && (
        <div className="auditoria-state-card error fade-in">
          <PackageX size={48} />
          <h3>Produto não cadastrado!</h3>
          <p>O código lido não existe no sistema. Retire o produto da gôndola.</p>
        </div>
      )}

      {produto && (
        <div className="auditoria-result-card fade-in">
          <div className="result-header">
            <span className="brand-tag">{produto.marca || 'S/ Marca'}</span>
            <span className="ean-tag">EAN: {produto.codigoBarras}</span>
          </div>

          <h3 className="product-name">{produto.descricao}</h3>

          <div className="price-display">
            <span className="price-label">PREÇO NO SISTEMA</span>
            <span className="price-value">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(produto.precoVenda || 0)}
            </span>
          </div>

          <div className="stock-info">
            Estoque atual: <strong>{produto.quantidadeEmEstoque || 0} un.</strong>
          </div>

          <div className="action-buttons">
            <button className="btn-action correct" onClick={confirmarCorreto}>
              <CheckCircle size={28} />
              <span>Etiqueta<br/>Correta</span>
            </button>

            <button className="btn-action divergent" onClick={reportarDivergencia}>
              <AlertTriangle size={28} />
              <span>Preço<br/>Divergente</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaPreco;