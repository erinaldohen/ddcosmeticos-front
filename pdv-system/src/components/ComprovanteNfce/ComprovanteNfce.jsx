import React from 'react';
import './ComprovanteNfce.css';

// Componente que recebe os dados da venda para renderizar o cupom
export const ComprovanteNfce = React.forwardRef(({ venda, loja }, ref) => {
  if (!venda) return null;

  const isFiscal = venda.chaveAcessoNfce && !venda.chaveAcessoNfce.includes("SIMULADA");
  const dataEmissao = new Date(venda.dataVenda).toLocaleString('pt-BR');

  return (
    <div ref={ref} className="cupom-fiscal-container">
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
               <img
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(venda.urlQrCode || "")}`}
                 alt="QR Code NFC-e"
               />
            </div>
          </>
        ) : (
          <p>*** É VEDA A AUTENTICAÇÃO DESTE CUPOM ***</p>
        )}
        <p className="sistema-info">DD Cosméticos System v1.0</p>
      </div>
    </div>
  );
});