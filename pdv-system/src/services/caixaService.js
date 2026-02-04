import api from './api';

// Helper para garantir que o valor seja um número válido (BigDecimal no Java)
const tratarValor = (valor) => {
  if (valor === undefined || valor === null) return 0;
  if (typeof valor === 'number') return valor;
  // Remove pontos de milhar e troca vírgula por ponto
  const formatado = String(valor).replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(formatado);
  return isNaN(numero) ? 0 : numero;
};

const caixaService = {

  // --- CONSULTAS ---

  // Verifica se existe caixa aberto (usado no PDV e Dashboard)
  getStatus: async () => {
    return await api.get('/caixas/status'); // Rota corrigida (plural)
  },

  // Alias para getStatus (mantido para compatibilidade)
  verificarStatus: async () => {
    return await api.get('/caixas/status');
  },

  // Busca dados completos de um fechamento específico (usado no Modal)
  buscarDetalhes: async (idCaixa) => {
    return await api.get(`/caixas/${idCaixa}`); // Rota corrigida: /caixas/{id}
  },

  // Busca movimentações do dia (Entradas/Saídas)
  getHistoricoDiario: async (data) => {
    return await api.get('/caixas/diario', { params: { data } });
  },

  // Busca lista paginada de caixas (usado na tela Histórico de Caixa)
  buscarHistorico: async (inicio, fim) => {
      const params = {};
      const hoje = new Date().toISOString().split('T')[0];

      const dataInicio = inicio || hoje;
      const dataFim = fim || dataInicio;

      // Parâmetros exatos que o CaixaController espera
      params.inicio = dataInicio;
      params.fim = dataFim;

      // Rota corrigida: /caixas (Raiz do controller listagem)
      return await api.get('/caixas', { params });
  },

  // --- OPERAÇÕES ---

  abrir: async (dados) => {
    // Aceita tanto objeto quanto valor direto
    const valor = typeof dados === 'object' ? dados.saldoInicial : dados;
    return await api.post('/caixas/abrir', { saldoInicial: tratarValor(valor) });
  },

  fechar: async (dados) => {
    const valor = typeof dados === 'object' ? dados.saldoFinalInformado : dados;
    return await api.post('/caixas/fechar', { saldoFinalInformado: tratarValor(valor) });
  },

  // --- MOVIMENTAÇÕES (SANGRIA / SUPRIMENTO) ---
  // O Backend agora usa um único endpoint /movimentacao com o campo "tipo"

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

  // Método genérico
  movimentar: async (tipo, valor, descricao) => {
    // Backend espera o enum: 'SANGRIA' ou 'SUPRIMENTO'
    const tipoEnum = tipo.toUpperCase().includes('SANGRIA') ? 'SANGRIA' : 'SUPRIMENTO';

    return await api.post('/caixas/movimentacao', {
      tipo: tipoEnum,
      valor: tratarValor(valor),
      observacao: descricao
    });
  }
};

export default caixaService;