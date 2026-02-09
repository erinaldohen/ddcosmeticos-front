import api from './api';

export const contasPagarService = {
  listar: async ({ status, termo }) => {
    const response = await api.get('/contas-pagar', { params: { status, termo } });
    return response.data;
  },

  obterResumo: async () => {
    const response = await api.get('/contas-pagar/resumo');
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/contas-pagar', dados);
    return response.data;
  },

  pagar: async (id, dadosPagamento) => {
    const response = await api.post(`/contas-pagar/${id}/pagar`, dadosPagamento);
    return response.data;
  }
};