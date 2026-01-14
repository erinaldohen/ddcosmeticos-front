import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { History, Search, FileText, Printer, Calendar, Download, TrendingUp, X, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import caixaService from '../../services/caixaService'; // <--- IMPORTAÇÃO DO SERVICE
import ResumoFechamento from './ResumoFechamento';
import { toast } from 'react-toastify';

const HistoricoCaixa = () => {
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Utiliza o useCallback para evitar recriação da função e permitir dependências no useEffect
  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      // Substituído pela chamada ao Service centralizado
      const res = await caixaService.buscarHistorico(dataInicio, dataFim);
      setCaixas(res.data);
    } catch (error) {
      toast.error("Erro ao carregar histórico de caixas");
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]); // Dependências para garantir dados frescos se chamado

  // Carrega apenas na montagem inicial (sem filtros)
  useEffect(() => {
    // Para a carga inicial, podemos chamar sem argumentos ou com os estados vazios
    // Aqui optamos por uma chamada limpa inicial
    caixaService.buscarHistorico('', '').then(res => {
        setCaixas(res.data);
        setLoading(false);
    });
  }, []);

  // Gráfico de evolução financeira (Memorizado para performance)
  const dadosGrafico = useMemo(() => {
    return caixas
      .filter(c => c.status === 'FECHADO')
      .map(c => ({
        data: new Date(c.dataAbertura).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0)
      })).reverse();
  }, [caixas]);

  const exportarCSV = () => {
    const cabecalho = "ID;Abertura;Fechamento;Operador;Status;Diferenca;Total\n";
    const linhas = caixas.map(c => {
      const total = (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0);
      return `${c.id};${new Date(c.dataAbertura).toLocaleString()};${c.dataFechamento ? new Date(c.dataFechamento).toLocaleString() : 'Aberto'};${c.usuarioAbertura?.nome || 'N/A'};${c.status};${c.diferenca || 0};${total}`;
    }).join('\n');

    const blob = new Blob(["\ufeff" + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `historico_caixas_${new Date().toLocaleDateString()}.csv`);
    link.click();
  };

  return (
    <div className="caixa-container fade-in">
      <header className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <History size={28} color="#2563eb" />
          <h1>Gestão de Caixas</h1>
        </div>
        <button className="btn-confirm success" onClick={exportarCSV}>
          <Download size={18} /> Exportar Relatório
        </button>
      </header>



      {dadosGrafico.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '20px', height: '300px', padding: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', marginBottom: '15px' }}>
            <TrendingUp size={18} color="#2563eb" /> Evolução de Faturamento por Turno
          </label>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={dadosGrafico}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value) => [`R$ ${value.toFixed(2)}`, 'Total Vendido']}
              />
              <Area type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorValor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="filter-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={18} className="text-muted" />
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="form-control" />
          <span className="text-muted">até</span>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="form-control" />
        </div>
        <button className="btn-confirm" onClick={carregarHistorico} style={{ padding: '8px 20px' }}>
          <Search size={18} /> Filtrar
        </button>
      </div>

      <main className="chart-card">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Abertura</th>
              <th>Operador</th>
              <th>Status</th>
              <th>Diferença</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center">Carregando dados...</td></tr>
            ) : caixas.map(c => (
              <tr key={c.id}>
                <td>
                  <div style={{fontWeight: '500'}}>{new Date(c.dataAbertura).toLocaleDateString('pt-BR')}</div>
                  <small className="text-muted">{new Date(c.dataAbertura).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</small>
                </td>
                <td>{c.usuarioAbertura?.nome || 'N/A'}</td>
                <td>
                  <span className={`badge ${c.status === 'ABERTO' ? 'success' : 'neutral'}`}>
                    {c.status}
                  </span>
                </td>
                <td>
                  <span style={{
                    color: c.diferenca < 0 ? '#ef4444' : c.diferenca > 0 ? '#10b981' : '#64748b',
                    fontWeight: '600'
                  }}>
                    R$ {(c.diferenca || 0).toFixed(2)}
                  </span>
                  {c.diferenca !== 0 && c.status === 'FECHADO' && (
                    <AlertCircle size={14} style={{marginLeft: '5px', verticalAlign: 'middle'}} title="Caixa com quebra" />
                  )}
                </td>
                <td className="text-right">
                  <button className="btn-action-view" onClick={() => setCaixaSelecionado(c)} title="Ver Resumo">
                    <FileText size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {caixaSelecionado && (
        <div className="modal-overlay">
          <div className="modal-content modal-large">
            <div className="modal-header">
              <h2>Detalhes do Caixa #{caixaSelecionado.id}</h2>
              <button onClick={() => setCaixaSelecionado(null)} className="btn-close-modal"><X /></button>
            </div>
            <div className="modal-body" id="print-area">
              <ResumoFechamento dados={caixaSelecionado} />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => window.print()}>
                <Printer size={18} /> Imprimir Resumo
              </button>
              <button className="btn-confirm" onClick={() => setCaixaSelecionado(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoCaixa;