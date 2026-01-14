import api from './api';

// Função auxiliar para garantir que números sejam enviados corretamente (ex: "1.200,50" -> 1200.50)
const tratarValor = (valor) => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;

  // Remove pontos de milhar e troca vírgula decimal por ponto
  const formatado = valor.replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(formatado);

  return isNaN(numero) ? 0 : numero;
};

const caixaService = {

  // 1. Verifica se o caixa está ABERTO ou FECHADO
  verificarStatus: async () => {
    return await api.get('/caixa/status');
  },

  // 2. Abre o caixa com saldo inicial (Fundo de Troco)
  abrir: async (saldoInicial) => {
    return await api.post('/caixa/abrir', {
      saldoInicial: tratarValor(saldoInicial)
    });
  },

  // 3. Realiza o Fechamento Cego (Operador informa o que tem na gaveta)
  fechar: async (saldoFinalInformado) => {
    return await api.post('/caixa/fechar', {
      saldoFinalInformado: tratarValor(saldoFinalInformado)
    });
  },

  // 4. Registra Sangrias (Retiradas) ou Suprimentos (Aportes)
  movimentar: async (tipo, valor, descricao) => {
    // Garante que o tipo esteja em Uppercase para o Enum do Java
    const tipoMovimentacao = tipo.toUpperCase();

    return await api.post('/caixa/movimentacao', {
      tipo: tipoMovimentacao,
      valor: tratarValor(valor),
      descricao: descricao || (tipoMovimentacao === 'SANGRIA' ? 'Retirada de valor' : 'Reforço de caixa')
    });
  },

  // 5. Busca o histórico filtrado (Usado no HistoricoCaixa.jsx)
  buscarHistorico: async (inicio, fim) => {
    let url = '/caixa/historico';
    const params = new URLSearchParams();

    // Adiciona filtros se existirem
    if (inicio) params.append('inicio', `${inicio}T00:00:00`);
    if (fim) params.append('fim', `${fim}T23:59:59`);

    return await api.get(url, { params });
  },

  // 6. Busca detalhes de um caixa específico para a Modal de Resumo
  buscarDetalhes: async (idCaixa) => {
    return await api.get(`/caixa/${idCaixa}/resumo`);
  }
};

export default caixaService;