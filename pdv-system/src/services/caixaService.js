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

  getStatus: async () => {
    const response = await api.get('/caixas/status');
    return response.data;
  },

  getMotivosFrequentes: async () => {
    const response = await api.get('/caixas/motivos');
    return response.data;
  },

  buscarDetalhes: async (idCaixa) => {
    const response = await api.get(`/caixas/${idCaixa}`);
    return response.data;
  },

  getHistoricoDiario: async (data) => {
    const response = await api.get('/caixas/diario', { params: { data } });
    return response.data;
  },

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

    // CORREÇÃO: Nome do campo ajustado para o DTO do Java e removido ID da URL
    const response = await api.post('/caixas/fechar', {
        saldoFinalDinheiroEmEspecie: tratarValor(valor)
    });
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