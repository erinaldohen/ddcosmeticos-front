import api from './api';

export const contasReceberService = {
  listar: async ({ status, termo }) => {
    const response = await api.get('/contas-receber', {
      params: { status, termo }
    });
    return response.data;
  },

  obterResumo: async () => {
    const response = await api.get('/contas-receber/resumo');
    return response.data;
  },

  baixarTitulo: async (id, dadosPagamento) => {
    // dadosPagamento: { valorPago, formaPagamento, juros, desconto }
    const response = await api.post(`/contas-receber/${id}/baixar`, dadosPagamento);
    return response.data;
  }
};