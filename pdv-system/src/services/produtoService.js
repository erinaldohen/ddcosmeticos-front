import api from './api'; // Usa a instância configurada com o Token

// O baseURL já está configurado no api.js (geralmente http://localhost:8080/api/v1)
const RESOURCE_URL = '/produtos';

export const produtoService = {

  /**
   * Lista produtos com paginação e filtro
   * CORREÇÃO: Parâmetros ajustados para 'page' e 'size' (Padrão Spring Boot)
   */
  listar: async (pagina = 0, tamanho = 10, filtro = '') => {
    try {
      // Axios serializa automaticamente o objeto 'params' para query string
      const response = await api.get(RESOURCE_URL, {
        params: {
          page: pagina,   // MUDADO DE 'pagina' PARA 'page'
          size: tamanho,  // MUDADO DE 'tamanho' PARA 'size'
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

  // --- IMPRESSÃO DE ETIQUETA ---
  imprimirEtiqueta: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/etiqueta`);
      return response.data; // Retorna a string ZPL
    } catch (error) {
      console.error("Erro ao obter etiqueta:", error);
      throw error;
    }
  },

  // --- UPLOAD DE IMAGEM ---
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

  // --- HISTÓRICO DE ALTERAÇÕES (AUDITORIA) ---
  buscarHistorico: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/historico`);
      return response.data; // Retorna lista de HistoricoProdutoDTO
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      throw error;
    }
  },

  // --- [NOVO] LIXEIRA ---
  buscarLixeira: async () => {
    try {
      const response = await api.get(`${RESOURCE_URL}/lixeira`);
      return response.data; // Retorna lista de produtos
    } catch (error) {
      console.error("Erro ao buscar lixeira:", error);
      throw error;
    }
  },

  // --- [NOVO] RESTAURAR / REATIVAR (Usa EAN) ---
  restaurar: async (ean) => {
    try {
      await api.patch(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      console.error("Erro ao restaurar produto:", error);
      throw error;
    }
  },

  // Alias para manter consistência se chamar como 'reativar'
  reativar: async (ean) => {
    try {
      await api.patch(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      throw error;
    }
  }
};

export default produtoService;