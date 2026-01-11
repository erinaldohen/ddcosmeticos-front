import api from './api'; // Usa a instância configurada com o Token

// O baseURL já está configurado no api.js (geralmente http://localhost:8080/api/v1)
// Então aqui usamos apenas o recurso relativo.
const RESOURCE_URL = '/produtos';

export const produtoService = {

  /**
   * Lista produtos com paginação e filtro
   */
  listar: async (pagina = 0, tamanho = 10, filtro = '') => {
    try {
      const params = new URLSearchParams();
      params.append('page', pagina);
      params.append('size', tamanho);

      if (filtro) {
        params.append('descricao', filtro);
      }

      const response = await api.get(RESOURCE_URL, { params });
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
   * Exclui (ou inativa) um produto pelo ID
   */
  excluir: async (id) => {
    try {
      await api.delete(`${RESOURCE_URL}/${id}`);
    } catch (error) {
      console.error(`Erro ao excluir produto ${id}:`, error);
      throw error;
    }
  },

  // --- CONSULTA EXTERNA (COSMOS) ---
  consultarEan: async (ean) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/consulta-externa/${ean}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // --- SANEAMENTO FISCAL EM MASSA ---
  saneamentoFiscal: async () => {
    try {
      const response = await api.post(`${RESOURCE_URL}/saneamento-fiscal`);
      return response.data;
    } catch (error) {
      console.error("Erro ao executar saneamento fiscal:", error);
      throw error;
    }
  },

  // --- [NOVO] IMPRESSÃO DE ETIQUETA ---
  imprimirEtiqueta: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/etiqueta`);
      return response.data; // Retorna a string ZPL
    } catch (error) {
      console.error("Erro ao obter etiqueta:", error);
      throw error;
    }
  }
};

export default produtoService;