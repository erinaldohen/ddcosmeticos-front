import api from './api';

const RESOURCE_URL = '/produtos';

export const produtoService = {

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
        // 🔥 CORREÇÃO: Agora passa o filtro de revisão pendente para o Backend!
        if (filtros.revisaoPendente) params.revisaoPendente = true;
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

  // 🔥 NOVO: Busca a contagem rapidamente no Backend sem carregar os produtos
  contarPendentesRevisao: async () => {
    try {
      const response = await api.get(`${RESOURCE_URL}/alertas/pendentes-revisao`);
      return response.data;
    } catch (error) {
      return 0;
    }
  },

  obterPorId: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar produto ${id}:`, error);
      throw error;
    }
  },

  salvar: async (produto) => {
    try {
      const response = await api.post(RESOURCE_URL, produto);
      return response.data;
    } catch (error) {
      console.error("Erro ao salvar produto:", error);
      throw error;
    }
  },

  atualizar: async (id, produto) => {
    try {
      const response = await api.put(`${RESOURCE_URL}/${id}`, produto);
      return response.data;
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      throw error;
    }
  },

  excluir: async (ean) => {
    try {
      await api.delete(`${RESOURCE_URL}/${ean}`);
    } catch (error) {
      console.error(`Erro ao excluir produto ${ean}:`, error);
      throw error;
    }
  },

  corrigirNcmsIA: async () => {
    try {
      const response = await api.post(`${RESOURCE_URL}/corrigir-ncms-ia`);
      return response.data;
    } catch (error) {
      console.error("Erro ao rodar IA Fiscal:", error);
      throw error;
    }
  },

  saneamentoFiscal: async () => {
    try {
      const response = await api.post(`${RESOURCE_URL}/saneamento-fiscal`);
      return response.data;
    } catch (error) {
      console.error("Erro ao executar saneamento fiscal:", error);
      throw error;
    }
  },

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

  validarDadosFiscais: async (descricao, ncm) => {
    try {
      const response = await api.post('/fiscal/validar', { descricao, ncm });
      return response.data;
    } catch (error) {
      return null;
    }
  },

  consultarEan: async (ean) => {
    try {
      const response = await api.get(`${RESOURCE_URL}?termo=${ean}&size=1`);
      if (response.data && response.data.content && response.data.content.length > 0) {
         const produto = response.data.content[0];
         if (produto.codigoBarras === ean) return produto;
      }
      return null;
    } catch (error) {
      return null;
    }
  },

  imprimirEtiqueta: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/etiqueta`);
      return response.data;
    } catch (error) {
      console.error("Erro ao obter etiqueta:", error);
      throw error;
    }
  },

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

  buscarHistorico: async (id) => {
    try {
      const response = await api.get(`${RESOURCE_URL}/${id}/historico`);
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      throw error;
    }
  },

  buscarLixeira: async () => {
    try {
      const response = await api.get(`${RESOURCE_URL}/lixeira`);
      return response.data;
    } catch (error) {
      console.error("Erro ao buscar lixeira:", error);
      throw error;
    }
  },

  restaurar: async (ean) => {
    try {
      await api.put(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      console.error("Erro ao restaurar produto:", error);
      throw error;
    }
  },

  reativar: async (ean) => {
    try {
      await api.put(`${RESOURCE_URL}/${ean}/reativar`);
    } catch (error) {
      throw error;
    }
  },

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

  gerarEanInterno: async () => {
      const response = await api.get(`${RESOURCE_URL}/proximo-sequencial`);
      return response.data;
  }
};

export default produtoService;