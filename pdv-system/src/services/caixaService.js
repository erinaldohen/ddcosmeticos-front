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
    return await api.get('/caixas/status');
  },

  // Busca lista de motivos únicos já salvos no banco (Histórico de Observações)
  // Requisito para o autocomplete inteligente funcionar via sistema
  getMotivosFrequentes: async () => {
    return await api.get('/caixas/motivos');
  },

  // Busca dados completos de um fechamento específico
  buscarDetalhes: async (idCaixa) => {
    return await api.get(`/caixas/${idCaixa}`);
  },

  // Busca movimentações do dia
  getHistoricoDiario: async (data) => {
    return await api.get('/caixas/diario', { params: { data } });
  },

  // Busca lista paginada de caixas (Histórico)
  buscarHistorico: async (inicio, fim) => {
      const params = {};
      const hoje = new Date().toISOString().split('T')[0];

      const dataInicio = inicio || hoje;
      const dataFim = fim || dataInicio;

      params.inicio = dataInicio;
      params.fim = dataFim;

      return await api.get('/caixas', { params });
  },

  // --- OPERAÇÕES (ABERTURA / FECHAMENTO) ---

  abrir: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoInicial : dados;
    return await api.post('/caixas/abrir', { saldoInicial: tratarValor(valor) });
  },

  fechar: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoFinalInformado : dados;
    return await api.post('/caixas/fechar', { saldoFinalInformado: tratarValor(valor) });
  },

  // --- MOVIMENTAÇÕES (SANGRIA / SUPRIMENTO) ---

  sangria: async (dados) => {
    return await api.post('/caixas/movimentacao', {
      tipo: 'SANGRIA',
      valor: tratarValor(dados.valor),
      observacao: dados.observacao || 'Sangria'
    });
  },

  suprimento: async (dados) => {
    return await api.post('/caixas/movimentacao', {
      tipo: 'SUPRIMENTO',
      valor: tratarValor(dados.valor),
      observacao: dados.observacao || 'Suprimento'
    });
  },

  // Método genérico caso precise movimentar passando string
  movimentar: async (tipo, valor, descricao) => {
    const tipoEnum = tipo.toUpperCase().includes('SANGRIA') ? 'SANGRIA' : 'SUPRIMENTO';

    return await api.post('/caixas/movimentacao', {
      tipo: tipoEnum,
      valor: tratarValor(valor),
      observacao: descricao
    });
  }
};

export default caixaService;