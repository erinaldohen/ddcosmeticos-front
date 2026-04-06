import React from 'react';
import './ComprovanteNfce.css';
import html2pdf from 'html2pdf.js';
import api from '../../services/api'; // Ajuste o caminho se necessário
import { toast } from 'react-toastify';

// =========================================================================
// FUNÇÃO EXPORTADA: Transforma o Cupom em PDF invisível e envia pro Java
// =========================================================================
export const enviarDocumentoPorEmail = async (emailDestino, idVenda, isB2B = false) => {
  // Captura o layout perfeito que já está renderizado na tela
  const elemento = document.getElementById('area-impressao-documento');

  if (!elemento) {
      toast.error("O comprovante precisa estar visível na tela para gerar o anexo.");
      return;
  }

  const toastId = toast.loading("Gerando PDF oficial e enviando e-mail...");

  // Configuração Inteligente: B2B usa A4, B2C usa Bobina 80mm
  const opcoesPdf = {
      margin:       isB2B ? 10 : 2, // Margem maior para A4, menor para bobina
      filename:     isB2B ? `DANFE_${idVenda}.pdf` : `CupomFiscal_${idVenda}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true }, // useCORS garante que a logo e o QRCode carreguem
      jsPDF:        isB2B
                      ? { unit: 'mm', format: 'a4', orientation: 'portrait' }
                      : { unit: 'mm', format: [80, 297], orientation: 'portrait' } // Formato Bobina 80mm
  };

  try {
      // 1. html2pdf tira a "foto" do componente e converte para um Blob (arquivo em memória)
      const pdfBlob = await html2pdf().set(opcoesPdf).from(elemento).output('blob');

      // 2. Cria o formulário para enviar o Arquivo + O E-mail digitado
      const formData = new FormData();
      formData.append('pdf', pdfBlob, opcoesPdf.filename);
      formData.append('email', emailDestino);

      // 3. Dispara para o nosso novo Endpoint no Java
      await api.post(`/vendas/${idVenda}/email-documento`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.update(toastId, { render: "E-mail enviado com sucesso!", type: "success", isLoading: false, autoClose: 3000 });

  } catch (error) {
      console.error("Erro ao enviar PDF:", error);
      toast.update(toastId, { render: "Falha ao enviar o e-mail.", type: "error", isLoading: false, autoClose: 4000 });
  }
};

// =========================================================================
// COMPONENTE VISUAL DO CUPOM / DANFE
// =========================================================================
export const ComprovanteNfce = React.forwardRef(({ venda, loja }, ref) => {
  if (!venda) return null;

  const isFiscal = venda.chaveAcessoNfce && !venda.chaveAcessoNfce.includes("SIMULADA");
  const dataEmissao = new Date(venda.dataVenda).toLocaleString('pt-BR');

  return (
    // 🚨 ADICIONADO O ID AQUI PARA A FUNÇÃO ACIMA CONSEGUIR ACHAR O DESENHO
    <div ref={ref} id="area-impressao-documento" className="cupom-fiscal-container">
      {/* CABEÇALHO */}
      <div className="cupom-header">
        <h3 className="loja-nome">{loja?.razaoSocial || "LOJA DD COSMÉTICOS"}</h3>
        <p>CNPJ: {loja?.cnpj || "00.000.000/0000-00"}</p>
        <p>{loja?.endereco?.logradouro}, {loja?.endereco?.numero}</p>
        <p>{loja?.endereco?.bairro} - {loja?.endereco?.cidade}/{loja?.endereco?.uf}</p>
        <div className="separator"></div>
        <h4 className="doc-titulo">
          {isFiscal ? "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica" : "RECIBO DE VENDA - SEM VALOR FISCAL"}
        </h4>
        {!isFiscal && <p className="aviso-homologacao">AMBIENTE DE TESTES / SIMULAÇÃO</p>}
      </div>

      {/* ITENS */}
      <div className="cupom-itens">
        <table>
          <thead>
            <tr>
              <th className="col-codigo">CÓD</th>
              <th className="col-desc">DESCRIÇÃO</th>
              <th className="col-qtd">QTD</th>
              <th className="col-un">UN</th>
              <th className="col-vlun">VL. UN</th>
              <th className="col-total">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {venda.itens.map((item, idx) => (
              <tr key={idx}>
                <td>{item.produtoId || item.id}</td>
                <td>{item.produtoNome || item.descricao}</td>
                <td>{item.quantidade}</td>
                <td>UN</td>
                <td>{item.precoUnitario.toFixed(2)}</td>
                <td>{((item.precoUnitario * item.quantidade) - (item.desconto || 0)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTAIS */}
      <div className="cupom-totais">
        <div className="linha-total">
          <span>QTD. TOTAL DE ITENS</span>
          <span>{venda.itens.length}</span>
        </div>
        <div className="linha-total">
          <span>VALOR TOTAL R$</span>
          <span>{venda.valorTotal.toFixed(2)}</span>
        </div>
        {venda.descontoTotal > 0 && (
          <div className="linha-total">
            <span>DESCONTOS R$</span>
            <span>- {venda.descontoTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="linha-total destaque">
          <span>VALOR A PAGAR R$</span>
          <span>{venda.valorTotal.toFixed(2)}</span>
        </div>
        <div className="separator"></div>
        <div className="linha-total">
          <span>FORMA PAGAMENTO</span>
          <span>VALOR PAGO</span>
        </div>
        {venda.pagamentos?.map((pg, i) => (
          <div key={i} className="linha-total">
            <span>{pg.formaPagamento}</span>
            <span>{pg.valor.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* RODAPÉ FISCAL */}
      <div className="cupom-footer">
        <div className="separator"></div>
        {isFiscal ? (
          <>
            <p><strong>Consulte pela Chave de Acesso em:</strong></p>
            <p>http://nfce.sefaz.pe.gov.br</p>
            <p className="chave-acesso">{venda.chaveAcessoNfce}</p>

            <div className="info-consumidor">
              <p>CONSUMIDOR: {venda.clienteNome || "NÃO IDENTIFICADO"}</p>
              {venda.clienteDocumento && <p>CPF/CNPJ: {venda.clienteDocumento}</p>}
            </div>

            <div className="info-protocolo">
              <p>NFC-e nº {parseInt(venda.chaveAcessoNfce?.substring(25, 34) || "0")} Série 1</p>
              <p>Via Consumidor</p>
              <p>Protocolo de Autorização: {venda.protocolo}</p>
              <p>Data de Autorização: {dataEmissao}</p>
            </div>

            {/* QR CODE */}
            <div className="qr-code-box">
               {venda.urlQrCode ? (
                 <img
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(venda.urlQrCode)}`}
                   alt="QR Code NFC-e"
                 />
               ) : (
                 <p style={{ fontSize: '10px', textAlign: 'center', marginTop: '10px' }}>
                   Aguardando validação QR Code...
                 </p>
               )}
            </div>
          </>
        ) : (
          <p>*** É VEDADA A AUTENTICAÇÃO DESTE CUPOM ***</p>
        )}
        <p className="sistema-info">DD Cosméticos System v1.0</p>
      </div>
    </div>
  );
});