import api from './api';

const caixaService = {
  verificarStatus: async () => {
    // Retorna 200 com objeto se aberto, ou 204 (sem conteudo) se fechado
    return await api.get('/caixa/status');
  },

  abrir: (saldoInicial) => {
      // Verifique se está enviando exatamente assim: { "saldoInicial": 100.00 }
      return api.post('/caixa/abrir', { saldoInicial });
  },

  fechar: async (saldoFinalInformado) => {
    return await api.post('/caixa/fechar', { saldoFinalInformado });
  },

  movimentar: async (tipo, valor, descricao) => {
    // tipo: 'SANGRIA' ou 'SUPRIMENTO'
    return await api.post('/caixa/movimentacao', { tipo, valor, descricao });
  }
};

export default caixaService;