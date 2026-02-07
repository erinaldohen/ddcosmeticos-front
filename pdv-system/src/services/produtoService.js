import api from './api';

const RESOURCE_URL = '/produtos';

export const produtoService = {

  /**
   * [ATUALIZADO] Lista produtos com paginação e filtro NO SERVIDOR
   */
  listar: async (pagina = 0, tamanho = 10, termo = '', filtros = {}) => {
    try {
      const params = {
        page: pagina,
        size: tamanho,
        termo: termo || ''
      };

      if (filtros) {
        if (filtros.marca) params.marca = filtros.marca;
        if (filtros.categoria) params.categoria = filtros.categoria;

        if (filtros.estoque && filtros.estoque !== 'todos') {
          params.statusEstoque = filtros.estoque === 'com-estoque' ? 'ok' : 'baixo';
        }

        if (filtros.semImagem) params.semImagem = true;
        if (filtros.semNcm) params.semNcm = true;
        if (filtros.precoZerado) params.precoZero = true;
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
      return { itens: [], totalPaginas: 0, totalElementos: 0 };
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

  /**
   * Executa o Robô de IA para corrigir NCMs
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
   * Importação de Arquivo
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
   * Exportação de Arquivo
   */
  exportarProdutos: async (tipo) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/exportar/${tipo}`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      console.error("Erro na exportação:", error);
      throw error;
    }
  },

  /**
   * Validação Fiscal no Formulário
   */
  validarDadosFiscais: async (descricao, ncm) => {
    try {
      const response = await api.post('/fiscal/validar', { descricao, ncm });
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Consulta se um EAN já existe
   */
  consultarEan: async (ean) => {
    try {
      // Ajuste para usar a busca por termo, que é mais segura para validação prévia
      const response = await api.get(`${RESOURCE_URL}?termo=${ean}&size=1`);
      // Se retornar lista vazia, não existe. Se retornar item e o EAN bater, existe.
      if (response.data && response.data.content && response.data.content.length > 0) {
         const produto = response.data.content[0];
         if (produto.codigoBarras === ean) return produto;
      }
      return null;
    } catch (error) {
      return null;
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
   * Busca itens da Lixeira (Inativos)
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
   * Restaurar da lixeira
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
   * [CORRIGIDO] Gera EAN interno chamando o Backend
   * Removemos a lógica manual antiga que estava causando erro de sintaxe.
   */
  gerarEanInterno: async () => {
      const response = await api.get(`${RESOURCE_URL}/proximo-sequencial`);
      // O backend retorna o número direto (String)
      return response.data;
  }
};

export default produtoService;