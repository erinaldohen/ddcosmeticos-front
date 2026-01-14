import React from 'react';
import { CheckCircle, AlertCircle, Smartphone, CreditCard, ArrowDownRight, ArrowUpRight, AlertTriangle } from 'lucide-react';

const ResumoFechamento = ({ dados }) => {
  const format = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quebraCritica = Math.abs(dados.diferenca || 0) > 50;

  return (
    <div className="resumo-fechamento">
      {quebraCritica && (
        <div className="alerta-critico-banner">
          <AlertTriangle size={24} />
          <div>
            <strong>Diferença Crítica Detectada!</strong>
            <p>A divergência excede o limite de segurança (R$ 50,00). Verifique os comprovantes.</p>
          </div>
        </div>
      )}

      <div className={`status-banner ${dados.diferenca !== 0 ? 'warning' : 'success'}`}>
        {dados.diferenca !== 0 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
        <strong>{dados.diferenca !== 0 ? 'FECHAMENTO COM DIVERGÊNCIA' : 'FECHAMENTO CONFERIDO'}</strong>
      </div>

      <div className="resumo-grid">
        <div className="resumo-section">
          <h4>Fluxo de Caixa (Dinheiro)</h4>
          <div className="resumo-row"><span>Fundo Inicial:</span> <span>{format(dados.saldoInicial)}</span></div>
          <div className="resumo-row"><span>Vendas Dinheiro:</span> <span>{format(dados.totalVendasDinheiro)}</span></div>
          <div className="resumo-row"><span>Suprimentos:</span> <span>{format(dados.totalSuprimentos)}</span></div>
          <div className="resumo-row"><span>Sangrias:</span> <span>({format(dados.totalSangrias)})</span></div>
          <div className="resumo-row total">
            <strong>Saldo Esperado:</strong>
            <strong>{format(dados.saldoFinalCalculado)}</strong>
          </div>
        </div>

        <div className="resumo-section">
          <h4>Outros Meios</h4>
          <div className="resumo-row"><small>PIX:</small> <span>{format(dados.totalVendasPix)}</span></div>
          <div className="resumo-row"><small>Cartões:</small> <span>{format(dados.totalVendasCartao)}</span></div>
        </div>
      </div>

      <div className={`conferencia-final ${dados.diferenca < 0 ? 'negative' : dados.diferenca > 0 ? 'positive' : ''}`}>
        <div className="conf-item">
          <label>Informado pelo Operador</label>
          <strong>{format(dados.saldoFinalInformado)}</strong>
        </div>
        <div className="conf-item">
          <label>Diferença / Quebra</label>
          <strong className="val-diff">
            {dados.diferenca > 0 ? <ArrowUpRight size={18}/> : dados.diferenca < 0 ? <ArrowDownRight size={18}/> : null}
            {format(dados.diferenca)}
          </strong>
        </div>
      </div>

      <div className="print-footer" style={{marginTop: '20px', fontSize: '10px', textAlign: 'center'}}>
        <p>Documento gerado em: {new Date().toLocaleString()}</p>
        <p>Operador: {dados.usuarioAbertura?.nome || 'Sistema'}</p>
      </div>
    </div>
  );
};

export default ResumoFechamento;