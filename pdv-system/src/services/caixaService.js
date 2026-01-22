import api from './api';

const tratarValor = (valor) => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === 'number') return valor;
  const formatado = String(valor).replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(formatado);
  return isNaN(numero) ? 0 : numero;
};

const caixaService = {

  // --- CONSULTAS ---

  getStatus: async () => {
    return await api.get('/caixa/status');
  },

  verificarStatus: async () => {
    return await api.get('/caixa/status');
  },

  buscarDetalhes: async (idCaixa) => {
    return await api.get(`/caixa/${idCaixa}/resumo`);
  },

  getHistorico: async (params) => {
    return await api.get('/caixa/diario', { params });
  },

  // CORREÇÃO AQUI: Tratamento para evitar erro 500
  buscarHistorico: async (inicio, fim) => {
      const params = {};
      const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Lógica Defensiva:
      // 1. Se tem inicio, usa inicio. Se não, usa hoje.
      const dataInicio = inicio || hoje;

      // 2. Se tem fim, usa fim. Se não, repete o inicio (intervalo de 1 dia).
      const dataFim = fim || dataInicio;

      // 3. Envia params explícitos que funcionam na maioria dos Controllers Java
      params.inicio = dataInicio;
      params.fim = dataFim;

      // Opcional: Envia 'data' também para garantir retrocompatibilidade se o backend usar
      if (dataInicio === dataFim) {
          params.data = dataInicio;
      }

      // A URL final ficará algo como: /caixa/diario?inicio=2026-01-22&fim=2026-01-22&data=2026-01-22
      // Isso "cerca" o backend por todos os lados.
      return await api.get('/caixa/diario', { params });
    },

  // --- OPERAÇÕES ---

  abrir: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoInicial : dados;
    return await api.post('/caixa/abrir', { saldoInicial: tratarValor(valor) });
  },

  fechar: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoFinalInformado : dados;
    return await api.post('/caixa/fechar', { saldoFinalInformado: tratarValor(valor) });
  },

  sangria: async (dados) => {
    return await api.post('/caixa/sangria', {
      valor: tratarValor(dados.valor),
      observacao: dados.observacao || 'Sangria'
    });
  },

  suprimento: async (dados) => {
    return await api.post('/caixa/suprimento', {
      valor: tratarValor(dados.valor),
      observacao: dados.observacao || 'Suprimento'
    });
  },

  movimentar: async (tipo, valor, descricao) => {
    const endpoint = tipo.toUpperCase() === 'SANGRIA' ? '/caixa/sangria' : '/caixa/suprimento';
    return await api.post(endpoint, {
      valor: tratarValor(valor),
      observacao: descricao
    });
  }
};

export default caixaService;