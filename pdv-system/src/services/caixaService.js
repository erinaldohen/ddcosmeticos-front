import api from './api';

// Helper para garantir que o valor seja um número válido (BigDecimal no Java)
const tratarValor = (valor) => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === 'number') return valor;
  // Remove pontos de milhar e troca vírgula por ponto (ex: "1.250,50" -> 1250.50)
  const formatado = String(valor).replace("R$", "").replace(/\./g, '').replace(',', '.').trim();
  const numero = parseFloat(formatado);
  return isNaN(numero) ? 0 : numero;
};

const caixaService = {

  // --- CONSULTAS ---

  // Verifica se existe caixa aberto
  getStatus: async () => {
    const response = await api.get('/caixas/status');
    return response.data;
  },

  // Busca lista de motivos únicos já salvos no banco (Histórico de Observações)
  getMotivosFrequentes: async () => {
    const response = await api.get('/caixas/motivos');
    return response.data;
  },

  // Busca dados completos de um fechamento específico
  buscarDetalhes: async (idCaixa) => {
    const response = await api.get(`/caixas/${idCaixa}`);
    return response.data;
  },

  // Busca movimentações do dia
  getHistoricoDiario: async (data) => {
    const response = await api.get('/caixas/diario', { params: { data } });
    return response.data;
  },

  // Busca lista paginada de caixas (Histórico)
  buscarHistorico: async (inicio, fim) => {
      const params = {};
      const hoje = new Date().toISOString().split('T')[0];

      const dataInicio = inicio || hoje;
      const dataFim = fim || dataInicio;

      params.inicio = dataInicio;
      params.fim = dataFim;

      const response = await api.get('/caixas', { params });
      return response.data;
  },

  // --- OPERAÇÕES (ABERTURA / FECHAMENTO) ---

  abrir: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoInicial : dados;
    const response = await api.post('/caixas/abrir', { saldoInicial: tratarValor(valor) });
    return response.data;
  },

  fechar: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoFinalInformado : dados;
    const response = await api.post('/caixas/fechar', { saldoFinalInformado: tratarValor(valor) });
    return response.data;
  },

  // --- MOVIMENTAÇÕES (SANGRIA / SUPRIMENTO) ---

  sangria: async (dados) => {
    const response = await api.post('/caixas/sangria', {
      tipo: 'SANGRIA',
      valor: tratarValor(dados.valor),
      motivo: dados.observacao || 'Sangria'
    });
    return response.data;
  },

  suprimento: async (dados) => {
    const response = await api.post('/caixas/suprimento', {
      tipo: 'SUPRIMENTO',
      valor: tratarValor(dados.valor),
      motivo: dados.observacao || 'Suprimento'
    });
    return response.data;
  },

  // Método genérico caso precise movimentar passando string
  movimentar: async (tipo, valor, descricao) => {
    const endpoint = tipo.toUpperCase().includes('SANGRIA') ? '/caixas/sangria' : '/caixas/suprimento';
    const response = await api.post(endpoint, {
      valor: tratarValor(valor),
      motivo: descricao
    });
    return response.data;
  }
};

export default caixaService;