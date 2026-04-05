import React from 'react';
import {
  CheckCircle, AlertCircle, AlertTriangle,
  ArrowDownRight, ArrowUpRight, Banknote,
  CreditCard, Smartphone, Calculator, User, FileText
} from 'lucide-react';

import './ResumoFechamento.css';

const ResumoFechamento = ({ dados }) => {
  // Proteção contra renderização prematura
  if (!dados) return <div className="text-center p-3 text-secondary">Carregando resumo do caixa...</div>;

  const format = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const diferenca = dados.diferenca || 0;
  const quebraCritica = Math.abs(diferenca) > 50;

  const isFalta = diferenca < 0;
  const isSobra = diferenca > 0;
  const isExato = diferenca === 0;

  return (
    <div className="resumo-fechamento-container">

      {/* 1. ALERTAS DE TOPO */}
      {quebraCritica && (
        <div className="alert-box danger-critico mb-3">
          <AlertTriangle size={28} />
          <div className="alert-content">
            <strong>Divergência Crítica Detectada!</strong>
            <p>A diferença excede o limite de segurança (R$ 50,00). Exija a recontagem da gaveta ou verifique os comprovantes.</p>
          </div>
        </div>
      )}

      <div className={`status-banner ${isExato ? 'success' : 'warning'} mb-4`}>
        {isExato ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
        <strong>{isExato ? 'FECHAMENTO CONFERIDO E EXATO' : 'FECHAMENTO COM DIVERGÊNCIA'}</strong>
      </div>

      {/* 2. COMPARAÇÃO DIRETA DO DINHEIRO FÍSICO */}
      <div className="conferencia-cards mb-4">
        <div className="conf-card system-calc">
          <div className="conf-header"><Calculator size={16}/> Sistema Esperava</div>
          <div className="conf-value">{format(dados.saldoFinalCalculado)}</div>
          <small>Fundo + Vendas - Sangrias</small>
        </div>

        <div className="conf-card operator-count">
          <div className="conf-header"><Banknote size={16}/> Operador Informou</div>
          <div className="conf-value">{format(dados.saldoFinalInformado)}</div>
          <small>Total contado na gaveta</small>
        </div>

        <div className={`conf-card diff-result ${isFalta ? 'is-falta' : isSobra ? 'is-sobra' : 'is-exato'}`}>
          <div className="conf-header">
            {isFalta ? 'Falta no Caixa' : isSobra ? 'Sobra no Caixa' : 'Diferença'}
          </div>
          <div className="conf-value diff">
            {isFalta ? <ArrowDownRight size={20}/> : isSobra ? <ArrowUpRight size={20}/> : null}
            {format(diferenca)}
          </div>
          <small>{isExato ? 'Tudo certo!' : 'Requer atenção'}</small>
        </div>
      </div>

      {/* 3. DETALHAMENTO DOS FLUXOS */}
      <div className="resumo-detalhado-grid">
        <div className="detalhe-section">
          <h4 className="section-title"><Banknote size={16}/> Movimentação em Dinheiro</h4>
          <div className="detalhe-row"><span>Fundo Inicial:</span> <span>{format(dados.saldoInicial)}</span></div>
          <div className="detalhe-row"><span>Vendas (Espécie):</span> <span className="text-success">+{format(dados.totalVendasDinheiro)}</span></div>
          <div className="detalhe-row"><span>Suprimentos (Entradas):</span> <span className="text-success">+{format(dados.totalSuprimentos)}</span></div>
          <div className="detalhe-row"><span>Sangrias (Retiradas):</span> <span className="text-danger">-{format(dados.totalSangrias)}</span></div>
        </div>

        <div className="detalhe-section">
          <h4 className="section-title">Digitais & A Prazo</h4>
          <div className="detalhe-row"><span className="flex items-center gap-2"><Smartphone size={14}/> PIX:</span> <span>{format(dados.totalVendasPix)}</span></div>
          {/* SEPARAÇÃO DE CRÉDITO E DÉBITO AQUI */}
          <div className="detalhe-row"><span className="flex items-center gap-2"><CreditCard size={14}/> Cartão de Crédito:</span> <span>{format(dados.totalVendasCredito)}</span></div>
          <div className="detalhe-row"><span className="flex items-center gap-2"><CreditCard size={14}/> Cartão de Débito:</span> <span>{format(dados.totalVendasDebito)}</span></div>

          <div className="detalhe-row"><span className="flex items-center gap-2 text-warning"><FileText size={14}/> Fiado (Crediário):</span> <span className="text-warning">{format(dados.totalVendasCrediario)}</span></div>

          <div className="total-digital-box mt-3">
             <span>Faturamento Extra-Caixa:</span>
             <strong>{format((dados.totalVendasPix || 0) + (dados.totalVendasCredito || 0) + (dados.totalVendasDebito || 0) + (dados.totalVendasCrediario || 0))}</strong>
          </div>
        </div>
      </div>

      {/* 4. RODAPÉ DE AUDITORIA */}
      <div className="print-footer mt-4 pt-3 border-t">
        <div className="flex items-center justify-between text-secondary" style={{fontSize: '0.85rem'}}>
          <span className="flex items-center gap-2"><User size={14}/> Operador: <strong>{dados.usuarioAbertura?.nome || 'Sistema'}</strong></span>
          <span>Fechado em: {new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>

    </div>
  );
};

export default ResumoFechamento;