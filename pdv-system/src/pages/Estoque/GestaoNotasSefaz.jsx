import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { maskCNPJ } from '../../utils/masks';
import {
  Search, RefreshCw, ArrowRight, CheckCircle,
  FileText, Calendar, DollarSign, Building,
  DownloadCloud, Filter, Inbox, Package
} from 'lucide-react';

import './GestaoNotasSefaz.css';

const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 4000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
  } catch (error) {
      clearTimeout(id);
      throw error;
  }
};

const GestaoNotasSefaz = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Estados Base
  const [todasNotas, setTodasNotas] = useState([]);
  const [notasExibidas, setNotasExibidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Paginação Local Segura
  const itensPorPagina = 15;
  const [paginaAtual, setPaginaAtual] = useState(0);

  // Filtros
  const [chaveBusca, setChaveBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // 1. CARREGAMENTO INICIAL
  useEffect(() => {
    carregarNotasDoBackend();
  }, [dataInicio, dataFim]);

  // 2. EFETIVA A PAGINAÇÃO LOCAL
  useEffect(() => {
      if (!Array.isArray(todasNotas)) return;
      const inicio = paginaAtual * itensPorPagina;
      const fim = inicio + itensPorPagina;
      setNotasExibidas(todasNotas.slice(inicio, fim));
  }, [todasNotas, paginaAtual]);


  // 🔥 O MOTOR DE EXTRAÇÃO RESILIENTE (Ignora o formato problemático do Backend)
  const carregarNotasDoBackend = async () => {
    setLoading(true);
    try {
      let url = `/estoque/notas-pendentes`;

      if (dataInicio && dataFim) {
          url += `?dataInicio=${dataInicio}&dataFim=${dataFim}`;
      }

      const res = await api.get(url);

      // A Extração Mágica: Tenta ler todos os formatos possíveis que o Java possa cuspir
      let dadosExtraidos = [];
      if (Array.isArray(res.data)) {
          dadosExtraidos = res.data;
      } else if (res.data && Array.isArray(res.data.content)) {
          dadosExtraidos = res.data.content;
      } else if (res.data && Array.isArray(res.data.data)) {
          dadosExtraidos = res.data.data;
      } else if (res.data && typeof res.data === 'object' && res.data.id) {
          dadosExtraidos = [res.data]; // Devolveu só um objeto? Põe num array!
      }

      setTodasNotas(dadosExtraidos);
      setPaginaAtual(0);

    } catch (error) {
      console.error("Erro ao carregar notas:", error);
      toast.error("Não foi possível carregar o histórico de notas locais.");
      setTodasNotas([]);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarSefaz = async () => {
    setSyncing(true);
    toast.dismiss();
    const toastId = toast.loading("Consultando a SEFAZ... (Atenção ao limite de uso)");

    try {
      await api.post('/estoque/notas-pendentes/sincronizar');
      toast.update(toastId, { render: "Sincronização concluída! Atualizando lista...", type: "success", isLoading: false, autoClose: 3000 });
      carregarNotasDoBackend();
    } catch (error) {
      const msg = error.response?.data || "A SEFAZ bloqueou a comunicação temporariamente (Consumo Indevido).";
      toast.update(toastId, { render: msg, type: "warning", isLoading: false, autoClose: 6000 });
      carregarNotasDoBackend();
    } finally {
      setSyncing(false);
    }
  };

  const buscarPorChave = async (e) => {
    e.preventDefault();
    const chaveLimpa = chaveBusca.replace(/\D/g, '');

    if (!chaveLimpa) {
      carregarNotasDoBackend();
      return;
    }

    if (chaveLimpa.length !== 44) {
      return toast.warn("A Chave de Acesso deve conter exatamente 44 números.");
    }

    setLoading(true);
    try {
      const res = await api.get(`/estoque/notas-pendentes/chave/${chaveLimpa}`);

      if (res.data) {
        setTodasNotas([res.data]);
        setPaginaAtual(0);
        toast.success("Nota localizada com sucesso!");
      } else {
        setTodasNotas([]);
        toast.info("Esta nota ainda não foi sincronizada no sistema.");
      }
    } catch (error) {
      toast.error("Erro ao buscar a nota específica. Verifique a chave.");
      setTodasNotas([]);
    } finally {
      setLoading(false);
    }
  };

  const limparFiltros = () => {
      setDataInicio('');
      setDataFim('');
      setChaveBusca('');
  };

  const handleAcaoNota = async (nota) => {
      if (nota.status === 'PENDENTE_MANIFESTACAO') {
          const toastId = toast.loading(`Autorizando a SEFAZ a libertar o XML...`);
          try {
              await api.post(`/estoque/notas-pendentes/${nota.id}/manifestar`);
              toast.update(toastId, { render: "XML libertado! A abrir o painel...", type: "success", isLoading: false, autoClose: 2000 });
              navigate('/estoque/entrada', { state: { notaPendenteId: nota.id } });
          } catch (error) {
              toast.update(toastId, { render: "A SEFAZ negou ou demorou. Tente novamente mais tarde.", type: "error", isLoading: false, autoClose: 5000 });
          }
      } else {
          navigate('/estoque/entrada', { state: { notaPendenteId: nota.id } });
      }
  };

  const getStatusBadge = (status) => {
      switch(status) {
          case 'IMPORTADA':
          case 'CONCLUIDA':
              return <span className="badge-status importada"><CheckCircle size={14}/> ESTOQUE ATUALIZADO</span>;
          case 'PENDENTE_MANIFESTACAO':
              return <span className="badge-status resumo"><DownloadCloud size={14}/> AGUARDANDO DOWNLOAD (SEFAZ)</span>;
          case 'PENDENTE':
          default:
              return <span className="badge-status pendente"><Package size={14}/> PRONTA PARA IMPORTAR</span>;
      }
  };

  const totalPaginasCalculado = Math.max(1, Math.ceil(todasNotas.length / itensPorPagina));

  return (
    <div className="gestao-notas-container">

      {/* HEADER DA PÁGINA */}
      <div className="gns-header">
        <div className="gns-header-left">
            <div className="gns-icon-box">
                <Inbox size={36} color="#60a5fa" />
            </div>
            <div>
              <h1>Caixa de Entrada Fiscal</h1>
              <p>Painel unificado de faturamentos emitidos para o seu CNPJ.</p>
            </div>
        </div>

        <button
          onClick={sincronizarSefaz}
          disabled={syncing}
          className={`btn-sync ${!syncing ? 'active' : ''}`}
        >
          <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          {syncing ? "A Sincronizar Fila..." : "Puxar Novas Notas (SEFAZ)"}
        </button>
      </div>

      {/* ÁREA DE FILTROS E BUSCA */}
      <div className="gns-filters-grid">

          <div className="filter-card">
            <h3><Search size={18} color="#3b82f6"/> Busca Rápida (Chave de Acesso)</h3>
            <form onSubmit={buscarPorChave} className="form-busca">
              <div className="input-wrapper">
                <Search size={18} className="icon-busca" />
                <input
                    type="text"
                    placeholder="Ex: 262301123..."
                    value={chaveBusca}
                    onChange={(e) => setChaveBusca(e.target.value)}
                    maxLength={44}
                    className="search-input"
                />
              </div>
              <button type="submit" className="btn-search">Localizar</button>
            </form>
          </div>

          <div className="filter-card">
            <div className="filter-header">
                <h3><Filter size={18} color="#f59e0b"/> Filtrar por Emissão</h3>
                {(dataInicio || dataFim) && (
                    <button onClick={limparFiltros} className="btn-clear-filter">Limpar</button>
                )}
            </div>
            <div className="date-inputs-wrapper">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="date-input" />
                <span className="date-separator">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="date-input" />
            </div>
          </div>
      </div>

      {/* LISTAGEM DE NOTAS */}
      {loading ? (
        <div className="state-container loading">
          <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', marginBottom: '15px', color: '#3b82f6' }} />
          <h2>Processando Histórico...</h2>
          <p>Buscando os registros mais recentes da base de dados.</p>
        </div>
      ) : notasExibidas.length === 0 ? (
        <div className="state-container empty">
          <FileText size={48} style={{ color: '#cbd5e1', margin: '0 auto', marginBottom: '20px' }} />
          <h2>Nenhuma nota encontrada no período.</h2>
          <p>Não encontramos registros locais para este filtro. Se você sabe que existem faturamentos recentes, clique em <strong>"Puxar Novas Notas"</strong>.</p>
        </div>
      ) : (
        <div className="notas-list">
          {notasExibidas.map((nota) => {
            const isImportada = nota.status === 'IMPORTADA' || nota.status === 'CONCLUIDA';
            const isResumo = nota.status === 'PENDENTE_MANIFESTACAO';

            const cardClass = `nota-card ${isImportada ? 'importada' : isResumo ? 'resumo' : 'pendente'}`;

            return (
              <div key={nota.id} className={cardClass}>

                {/* Info Fornecedor */}
                <div className="nota-info">
                  <div className="nota-info-header">
                    <span className="badge-nfe">NF-e {nota.numeroNota || "S/N"}</span>
                    {getStatusBadge(nota.status)}
                  </div>
                  <strong className="fornecedor-nome">
                    <Building size={18} color="#64748b"/>
                    {nota.razaoSocialFornecedor || "FORNECEDOR NÃO IDENTIFICADO"}
                  </strong>
                  <div className="nota-meta">
                    <span className="meta-cnpj">CNPJ: {maskCNPJ(nota.cnpjFornecedor)}</span>
                    <span className="meta-chave">{nota.chaveAcesso}</span>
                  </div>
                </div>

                {/* Valores e Datas */}
                <div className="nota-valores">
                  <div className="valor-box">
                    <div className="icon-box-gray"><Calendar size={16} color="#64748b"/></div>
                    <div>
                      <span className="valor-label">Emissão</span>
                      <span className="valor-data">{nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    </div>
                  </div>
                  <div className="valor-box">
                    <div className="icon-box-green"><DollarSign size={16} color="#10b981"/></div>
                    <div>
                      <span className="valor-label">Valor Total</span>
                      <span className="valor-monetario">R$ {nota.valorTotal ? nota.valorTotal.toFixed(2).replace('.',',') : '0,00'}</span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="nota-acoes">
                  {isImportada ? (
                    <button disabled className="btn-acao disabled">
                      <CheckCircle size={18} /> Cadastrada
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAcaoNota(nota)}
                      className={`btn-acao ${isResumo ? 'resumo' : 'importar'}`}
                    >
                      {isResumo ? <DownloadCloud size={18} /> : <Package size={18} />}
                      {isResumo ? "Solicitar XML" : "Processar Entrada"} <ArrowRight size={16} />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* PAGINAÇÃO INFERIOR */}
      {!loading && totalPaginasCalculado > 1 && (
        <div className="paginacao">
            <button
                onClick={() => setPaginaAtual(p => Math.max(0, p - 1))}
                disabled={paginaAtual === 0}
                className={`btn-page ${paginaAtual === 0 ? '' : 'active'}`}
            >
                Anterior
            </button>
            <span className="paginacao-info">
                Página {paginaAtual + 1} de {totalPaginasCalculado}
            </span>
            <button
                onClick={() => setPaginaAtual(p => Math.min(totalPaginasCalculado - 1, p + 1))}
                disabled={paginaAtual >= totalPaginasCalculado - 1}
                className={`btn-page ${paginaAtual >= totalPaginasCalculado - 1 ? '' : 'active'}`}
            >
                Próxima
            </button>
        </div>
      )}

    </div>
  );
};

export default GestaoNotasSefaz;