import api from './api';

// Helper para garantir que o valor seja um número válido e processável
const tratarValor = (valor) => {
  if (valor === undefined || valor === null || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  // Remove R$, pontos de milhar e troca vírgula por ponto (ex: "1.250,50" -> 1250.50)
  const formatado = String(valor).replace("R$", "").replace(/\./g, '').replace(',', '.').trim();
  const numero = parseFloat(formatado);
  return isNaN(numero) ? 0 : numero;
};

const caixaService = {

  // ==========================================================
  // --- CONSULTAS E HISTÓRICO ---
  // ==========================================================

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

      params.inicio = inicio || hoje;
      params.fim = fim || params.inicio;

      const response = await api.get('/caixas', { params });
      return response.data;
  },

  // ==========================================================
  // --- OPERAÇÕES CORE (ABERTURA E FECHAMENTO) ---
  // ==========================================================

  abrir: async (valor) => {
    // Flexível: aceita um objeto ou o valor direto enviado pela tela
    const saldo = typeof valor === 'object' ? valor.saldoInicial : valor;

    const response = await api.post('/caixas/abrir', {
      saldoInicial: tratarValor(saldo)
    });
    return response.data;
  },

  fechar: async (valorFisicoInformado, justificativa = '') => {
    // ATUALIZAÇÃO CRÍTICA: Payload agora mapeia perfeitamente com o FechamentoCaixaRequestDTO do Java
    const payload = {
        valorFisicoInformado: tratarValor(valorFisicoInformado),
        justificativaDiferenca: justificativa
    };

    const response = await api.post('/caixas/fechar', payload);
    return response.data; // Retorna o ConfirmacaoFechamentoDTO para a tela montar o resumo
  },

  // ==========================================================
  // --- MOVIMENTAÇÕES MANUAIS ---
  // ==========================================================

  sangria: async (dados) => {
    const response = await api.post('/caixas/sangria', {
      tipo: 'SANGRIA',
      valor: tratarValor(dados.valor),
      motivo: dados.observacao || 'Sangria de rotina'
    });
    return response.data;
  },

  suprimento: async (dados) => {
    const response = await api.post('/caixas/suprimento', {
      tipo: 'SUPRIMENTO',
      valor: tratarValor(dados.valor),
      motivo: dados.observacao || 'Fundo de troco adicional'
    });
    return response.data;
  }, // <--- A VÍRGULA QUE ESTAVA FALTANDO ESTÁ AQUI

  // ==========================================================
  // --- ALERTAS E AUDITORIA IA ---
  // ==========================================================
  getAlertas: async () => {
    const response = await api.get('/caixas/alertas');
    return response.data;
  }

};

export default caixaService;