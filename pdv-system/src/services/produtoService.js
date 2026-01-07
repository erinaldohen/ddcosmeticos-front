import axios from 'axios';

// -----------------------------------------------------------------------------
// CONFIGURAÇÃO DA API
// Se o seu backend estiver em outra porta (ex: 3000, 5000), altere aqui.
// -----------------------------------------------------------------------------
const API_URL = 'http://localhost:8080/api/v1/produtos';

export const produtoService = {

  /**
   * Lista produtos com paginação e filtro
   * @param {number} pagina - Número da página (começa em 0)
   * @param {number} tamanho - Itens por página
   * @param {string} filtro - Texto para busca (Nome, EAN, etc)
   */
  listar: async (pagina = 0, tamanho = 10, filtro = '') => {
    try {
      // Configura os parâmetros da URL
      const params = new URLSearchParams();
      params.append('page', pagina);
      params.append('size', tamanho);

      // IMPORTANTE: Aqui definimos o nome do campo de busca.
      // Se seu backend espera "nome", "q", ou "termo", altere a string 'descricao' abaixo.
      if (filtro) {
        params.append('descricao', filtro);
      }

      // Faz a chamada: http://localhost:8080/api/produtos?page=0&size=10&descricao=...
      const response = await axios.get(`${API_URL}`, { params });
      const data = response.data;

      // Normaliza a resposta (Aceita padrão Spring Boot ou Lista Simples)
      return {
        itens: data.content || data.itens || (Array.isArray(data) ? data : []),
        totalPaginas: data.totalPages || 0,
        totalElementos: data.totalElements || 0,
        paginaAtual: data.number || pagina
      };
    } catch (error) {
      console.error("Erro no serviço de listagem:", error);
      throw error;
    }
  },

  /**
   * Busca um único produto pelo ID (Para edição)
   */
  buscarPorId: async (id) => {
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar produto ${id}:`, error);
      throw error;
    }
  },

  /**
   * Salva um produto (Cria se não tiver ID, Atualiza se tiver ID)
   */
  salvar: async (produto) => {
    try {
      if (produto.id) {
        // Atualizar (PUT)
        const response = await axios.put(`${API_URL}/${produto.id}`, produto);
        return response.data;
      } else {
        // Criar Novo (POST)
        const response = await axios.post(API_URL, produto);
        return response.data;
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      throw error;
    }
  },

  /**
   * Exclui (ou inativa) um produto pelo ID
   */
  excluir: async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
    } catch (error) {
      console.error(`Erro ao excluir produto ${id}:`, error);
      throw error;
    }
  }
};