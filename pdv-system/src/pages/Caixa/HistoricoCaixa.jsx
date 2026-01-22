import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  History, Search, FileText, Printer, Calendar, Download,
  TrendingUp, X, AlertCircle, ArrowRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import caixaService from '../../services/caixaService';
import ResumoFechamento from './ResumoFechamento'; // Certifique-se que este arquivo existe
import { toast } from 'react-toastify';
import './HistoricoCaixa.css'; // Importação do novo CSS

const HistoricoCaixa = () => {
  const [caixas, setCaixas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [caixaSelecionado, setCaixaSelecionado] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Carrega dados do backend
  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const res = await caixaService.buscarHistorico(dataInicio, dataFim);
      setCaixas(res.data || []);
    } catch (error) {
      toast.error("Erro ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  // Carga inicial
  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // Prepara dados para o gráfico (apenas caixas fechados)
  const dadosGrafico = useMemo(() => {
    return caixas
      .filter(c => c.status === 'FECHADO')
      .map(c => ({
        data: new Date(c.dataAbertura).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0)
      }))
      // Reverte para mostrar do mais antigo para o mais novo no gráfico
      .reverse();
  }, [caixas]);

  const exportarCSV = () => {
    const cabecalho = "ID;Abertura;Fechamento;Operador;Status;Diferenca;Total\n";
    const linhas = caixas.map(c => {
      const total = (c.totalVendasDinheiro || 0) + (c.totalVendasPix || 0) + (c.totalVendasCartao || 0);
      const dataFechamento = c.dataFechamento ? new Date(c.dataFechamento).toLocaleString() : 'Aberto';
      return `${c.id};${new Date(c.dataAbertura).toLocaleString()};${dataFechamento};${c.usuarioAbertura?.nome || 'N/A'};${c.status};${c.diferenca || 0};${total}`;
    }).join('\n');

    const blob = new Blob(["\ufeff" + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `historico_caixas_${new Date().toLocaleDateString()}.csv`);
    link.click();
  };

  return (
    <div className="historico-container fade-in">

      {/* HEADER */}
      <header className="page-header-clean">
        <div className="header-title">
          <div className="icon-wrapper"><History size={24} /></div>
          <div>
            <h1>Gestão de Caixas</h1>
            <p>Histórico de aberturas, fechamentos e conferências.</p>
          </div>
        </div>
        <button className="btn-export" onClick={exportarCSV}>
          <Download size={18} /> Exportar CSV
        </button>
      </header>

      {/* FILTROS */}
      <div className="filters-card">
        <div className="date-inputs">
          <div className="input-group">
            <Calendar size={18} />
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="date-field"
            />
          </div>
          <span className="separator">até</span>
          <div className="input-group">
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="date-field"
            />
          </div>
        </div>
        <button className="btn-filter" onClick={carregarHistorico}>
          <Search size={18} /> Filtrar Resultados
        </button>
      </div>

      {/* GRÁFICO */}
      {dadosGrafico.length > 0 && (
        <div className="chart-section">
          <div className="chart-header">
            <TrendingUp size={20} className="chart-icon" />
            <h3>Evolução de Faturamento</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dadosGrafico} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(value) => `R$${value}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`R$ ${value.toFixed(2)}`, 'Total']}
                />
                <Area type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TABELA */}
      <div className="table-card">
        <table className="clean-table">
          <thead>
            <tr>
              <th width="10%">ID</th>
              <th width="25%">Data Abertura</th>
              <th width="20%">Operador</th>
              <th width="15%">Status</th>
              <th width="15%" className="text-right">Diferença</th>
              <th width="15%" className="text-center">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center py-5">Carregando dados...</td></tr>
            ) : caixas.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-5 text-muted">Nenhum registro encontrado.</td></tr>
            ) : (
              caixas.map(c => (
                <tr key={c.id} className="row-hover">
                  <td className="font-mono text-muted">#{c.id}</td>
                  <td>
                    <div className="date-cell">
                      <span className="date-main">{new Date(c.dataAbertura).toLocaleDateString('pt-BR')}</span>
                      <small className="date-sub">{new Date(c.dataAbertura).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</small>
                    </div>
                  </td>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar-small">{c.usuarioAbertura?.nome?.charAt(0) || 'U'}</div>
                      <span>{c.usuarioAbertura?.nome || 'Sistema'}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${c.status.toLowerCase()}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="text-right">
                    {c.status === 'FECHADO' ? (
                        <span className={`diff-value ${c.diferenca < 0 ? 'neg' : c.diferenca > 0 ? 'pos' : 'neutral'}`}>
                            {c.diferenca !== 0 && <AlertCircle size={14} />}
                            R$ {(c.diferenca || 0).toFixed(2)}
                        </span>
                    ) : (
                        <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="text-center">
                    <button className="btn-icon-soft" onClick={() => setCaixaSelecionado(c)} title="Ver Detalhes">
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DETALHES */}
      {caixaSelecionado && (
        <div className="modal-overlay-backdrop">
          <div className="modal-clean">
            <div className="modal-clean-header">
              <div>
                <h2>Resumo do Caixa #{caixaSelecionado.id}</h2>
                <span className="modal-subtitle">{new Date(caixaSelecionado.dataAbertura).toLocaleDateString()}</span>
              </div>
              <button onClick={() => setCaixaSelecionado(null)} className="btn-close-clean"><X size={20} /></button>
            </div>

            <div className="modal-clean-body">
              <ResumoFechamento dados={caixaSelecionado} />
            </div>

            <div className="modal-clean-footer">
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={18} /> Imprimir
              </button>
              <button className="btn-primary" onClick={() => setCaixaSelecionado(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoCaixa;