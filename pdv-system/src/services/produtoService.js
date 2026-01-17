import api from './api';

const RESOURCE_URL = '/produtos';

export const produtoService = {

  /**
   * Lista produtos com paginação e filtro
   * (Mantido conforme seu original)
   */
  listar: async (pagina = 0, tamanho = 10, filtro = '') => {
    try {
      // Dica: Se o backend tiver endpoint /resumo, use ele para ser mais rápido.
      // Se não, mantemos a rota padrão.
      const response = await api.get(RESOURCE_URL, {
        params: {
          page: pagina,
          size: tamanho,
          termo: filtro || ''
        }
      });

      const data = response.data;

      return {
        itens: data.content || data.itens || [],
        totalPaginas: data.totalPages || 0,
        totalElementos: data.totalElements || 0,
        paginaAtual: data.number || 0
      };
    } catch (error) {
      console.error("Erro no serviço de listagem:", error);
      throw error;
    }
  },

  /**
   * Busca um único produto pelo ID
   */
  obterPorId: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar produto ${id}:`, error);
      throw error;
    }
  },

  /**
   * Salva um novo produto
   */
  salvar: async (produto) => {
    try {
      const response = await api.post(RESOURCE_URL, produto);
      return response.data;
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      throw error;
    }
  },

  /**
   * Atualiza um produto existente
   */
  atualizar: async (id, produto) => {
    try {
      const response = await api.put(`${RESOURCE_URL}/${id}`, produto);
      return response.data;
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      throw error;
    }
  },

  /**
   * Exclui (Inativa) um produto
   */
  excluir: async (ean) => {
    try {
      await api.delete(`${RESOURCE_URL}/${ean}`);
    } catch (error) {
      console.error(`Erro ao excluir produto ${ean}:`, error);
      throw error;
    }
  },

  // --- NOVAS IMPLEMENTAÇÕES NECESSÁRIAS ---

  /**
   * [NOVO] Executa o Robô de IA para corrigir NCMs
   * Necessário para o botão roxo funcionar
   */
  corrigirNcmsIA: async () => {
    try {
      const response = await api.post(`${RESOURCE_URL}/corrigir-ncms-ia`);
      return response.data;
    } catch (error) {
      console.error("Erro ao rodar IA Fiscal:", error);
      throw error;
    }
  },

  /**
   * [ATUALIZADO] Saneamento fiscal em massa
   * Recalcula tributos (IBS/CBS, PIS/COFINS) de todos os produtos
   */
  saneamentoFiscal: async () => {
    try {
      const response = await api.post(`${RESOURCE_URL}/saneamento-fiscal`);
      return response.data;
    } catch (error) {
      console.error("Erro ao executar saneamento fiscal:", error);
      throw error;
    }
  },

  /**
   * [NOVO] Importação de Arquivo
   */
  importarProdutos: async (formData) => {
    try {
      const response = await api.post(`${RESOURCE_URL}/importar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      console.error("Erro na importação:", error);
      throw error;
    }
  },

  /**
   * [NOVO] Exportação de Arquivo
   */
  exportarProdutos: async (tipo) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/exportar/${tipo}`, {
        responseType: 'blob' // CRÍTICO: Garante que o arquivo não venha corrompido/vazio
      });
      return response.data;
    } catch (error) {
      console.error("Erro na exportação:", error);
      throw error;
    }
  },

  /**
   * [NOVO] Validação Fiscal no Formulário
   */
  validarDadosFiscais: async (descricao, ncm) => {
    try {
      const response = await api.post('/fiscal/validar', { descricao, ncm });
      return response.data;
    } catch (error) {
      // Falha silenciosa para não travar o form
      return null;
    }
  },

  // --- FIM DAS NOVAS IMPLEMENTAÇÕES ---

  /**
   * Consulta externa (COSMOS)
   */
  consultarEan: async (ean) => {
    try {
      const response = await api.get(`/fiscal/consultar-ean/${ean}`); // Ajuste de rota comum
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Impressão de etiqueta
   */
  imprimirEtiqueta: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/etiqueta`);
      return response.data;
    } catch (error) {
      console.error("Erro ao obter etiqueta:", error);
      throw error;
    }
  },

  /**
   * Upload de imagem
   */
  uploadImagem: async (id, arquivo) => {
    try {
      const formData = new FormData();
      formData.append('file', arquivo);

      await api.post(`${RESOURCE_URL}/${id}/imagem`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      throw error;
    }
  },

  /**
   * Histórico
   */
  buscarHistorico: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/historico`);
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      throw error;
    }
  },

  /**
   * Lixeira
   */
  buscarLixeira: async () => {
    try {
      const response = await api.get(`${RESOURCE_URL}/lixeira`);
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar lixeira:", error);
      throw error;
    }
  },

  /**
   * [CORRIGIDO] Restaurar da lixeira
   * Alterado de PATCH para PUT para bater com o Controller Java
   */
  restaurar: async (ean) => {
    try {
      await api.put(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      console.error("Erro ao restaurar produto:", error);
      throw error;
    }
  },

  /**
   * Alias para restaurar
   */
  reativar: async (ean) => {
    try {
      await api.put(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Busca NCM via BrasilAPI
   */
  buscarNcms: async (termo) => {
    try {
      const isNumeric = !isNaN(termo);
      const url = isNumeric
        ? `https://brasilapi.com.br/api/ncm/v1?code=${termo}`
        : `https://brasilapi.com.br/api/ncm/v1?search=${termo}`;

      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error("Erro ao buscar NCM:", error);
      return [];
    }
  },

  /**
   * Gera EAN interno
   */
  gerarEanInterno: async () => {
    try {
      const response = await api.get(`${RESOURCE_URL}/proximo-sequencial`);
      return response.data.ean;
    } catch (error) {
      // Fallback local
      const prefix = "789";
      const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
      const base = prefix + random;
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      return base + checkDigit;
    }
  }
};

export default produtoService;