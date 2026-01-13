import api from './api'; // Usa a instância configurada com o Token

// O baseURL já está configurado no api.js (geralmente http://localhost:8080/api/v1)
const RESOURCE_URL = '/produtos';

export const produtoService = {

  /**
   * Lista produtos com paginação e filtro
   */
  listar: async (pagina = 0, tamanho = 10, filtro = '') => {
    try {
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
   * Busca um único produto pelo ID (Para edição)
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
   * Salva um novo produto (POST)
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
   * Atualiza um produto existente (PUT)
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
   * Exclui (ou inativa) um produto pelo ID/EAN
   */
  excluir: async (ean) => {
    try {
      await api.delete(`${RESOURCE_URL}/${ean}`);
    } catch (error) {
      console.error(`Erro ao excluir produto ${ean}:`, error);
      throw error;
    }
  },

  /**
   * Consulta externa (COSMOS) para preenchimento automático via EAN
   */
  consultarEan: async (ean) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/consulta-externa/${ean}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Saneamento fiscal em massa
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
   * Obtém string ZPL para impressão de etiqueta
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
   * Upload de imagem do produto
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
   * Histórico de alterações do produto (Auditoria)
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
   * Lista produtos na lixeira (Excluídos/Inativos)
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
   * Restaura um produto da lixeira
   */
  restaurar: async (ean) => {
    try {
      await api.patch(`${RESOURCE_URL}/${ean}/reativar`);
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
      await api.patch(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Busca NCM via BrasilAPI por código ou descrição
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
   * Gera um código de barras interno padrão EAN-13
   */
  gerarEanInterno: async () => {
    try {
      const response = await api.get(`${RESOURCE_URL}/proximo-sequencial`);
      return response.data.ean;
    } catch (error) {
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