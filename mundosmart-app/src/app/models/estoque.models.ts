import { Observable } from 'rxjs';
import { PecaEstoque } from './bling.models';
import { AutocompleteItem } from '../components/autocomplete-criavel/autocomplete-criavel';

export interface PedidoCompraEstoque {
  id?: string;
  numeroPedido: string;
  fornecedor: string;
  numeroNf?: string;
  dataPedido: string;
  observacoes?: string;
  totalItens: number;
  totalUnidades: number;
  valorTotal: number;
  criadoEm?: string;
}

export interface LoteEstoque {
  id?: string;
  pedidoCompraId: string;
  numeroPedido: string;
  fornecedor: string;
  pecaId: string;
  pecaNome: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  cor?: string;
  quantidadeInicial: number;
  quantidadeRestante: number;
  custoUnitario: number;
  garantiaMeses: number;
  dataEntrada: string;
  dataVencimentoGarantia: string;
}

export interface MovimentacaoEstoque {
  id?: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  pecaId: string;
  pecaNome: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  cor?: string;
  loteId?: string;
  pedidoCompraId?: string;
  numeroPedido?: string;
  quantidade: number;
  custoUnitario?: number;
  osBlingId?: number;
  osNumero?: string;
  observacao?: string;
  data: string;
}

export interface ItemPedidoCompraRequest {
  pecaId: string;
  fornecedor?: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  /** Obrigatório para Tampa traseira. */
  cor?: string;
  quantidade: number;
  custoUnitario: number;
  garantiaMeses: number;
}

/** Estado extra no formulário de pedido (categoria + modelo). */
export interface ItemPedidoCompraUi extends ItemPedidoCompraRequest {
  categoria?: string;
  buscaModelo?: string;
  avisoResolucao?: string;
  /** Recria o autocomplete ao trocar categoria. */
  modeloAutocompleteKey?: number;
  /** Busca de modelos vinculada à linha (categoria + peças cadastradas). */
  buscarModelosFn?: (termo: string) => Observable<AutocompleteItem[]>;
}

export interface RegistrarPedidoCompraRequest {
  numeroPedido: string;
  fornecedor: string;
  numeroNf?: string;
  dataPedido?: string;
  observacoes?: string;
  itens: ItemPedidoCompraRequest[];
}

export interface RegistrarSaidaEstoqueRequest {
  pecaId: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  quantidade: number;
  osBlingId?: number;
  osNumero?: string;
  observacao?: string;
}

export interface PedidoCompraDetalhe {
  pedido: PedidoCompraEstoque;
  lotes: LoteEstoque[];
}

export interface ReposicaoSemanalItem {
  pecaId: string;
  pecaNome: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  /** Cor da saída (tampa/vidro) — para reposição. */
  cor?: string;
  quantidadeSaida: number;
  estoqueAtual: number;
  sugestaoReposicao: number;
}

export interface ReposicaoResumoModelo {
  modeloId?: string;
  modeloNome: string;
  quantidadeSaida: number;
  itensComReposicao: number;
  sugestaoTotal: number;
}

export interface ReposicaoSemanalResponse {
  inicio: string;
  fim: string;
  periodo?: string;
  modeloIdFiltro?: string;
  modeloNomeFiltro?: string;
  itens: ReposicaoSemanalItem[];
  resumoPorModelo?: ReposicaoResumoModelo[];
  totalSaidas: number;
}

export interface RelatorioReposicaoParams {
  periodo?: string;
  inicio?: string;
  fim?: string;
  modeloId?: string;
}

export type RelatorioReposicaoStatusConclusao =
  | 'nao_concluido'
  | 'parcial'
  | 'concluido';

export interface RelatorioReposicaoHistorico {
  id?: string;
  titulo: string;
  periodo: string;
  periodoLabel: string;
  inicio: string;
  fim: string;
  modeloIdFiltro?: string;
  modeloNomeFiltro?: string;
  totalSaidas: number;
  totalItens: number;
  itens: ReposicaoSemanalItem[];
  html: string;
  geradoEm: string;
  geradoPor?: string;
  /** nao_concluido | parcial | concluido — padrão nao_concluido */
  statusConclusao?: RelatorioReposicaoStatusConclusao | string;
}

export interface SalvarRelatorioReposicaoRequest {
  titulo?: string;
  periodo: string;
  periodoLabel: string;
  inicio: string;
  fim: string;
  modeloIdFiltro?: string;
  modeloNomeFiltro?: string;
  totalSaidas: number;
  itens: ReposicaoSemanalItem[];
  html: string;
  geradoPor?: string;
}

export interface RegistrarDevolucaoGarantiaRequest {
  loteId: string;
  quantidade: number;
  motivo?: string;
  observacao?: string;
  osNumero?: string;
  osBlingId?: number;
  origemOs?: boolean;
}

/** Lote elegível a retorno de garantia (com contexto opcional da OS). */
export interface LoteGarantiaItem {
  id?: string;
  pedidoCompraId: string;
  numeroPedido: string;
  fornecedor: string;
  pecaId: string;
  pecaNome: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  cor?: string;
  quantidadeInicial: number;
  quantidadeRestante: number;
  custoUnitario: number;
  garantiaMeses: number;
  dataEntrada: string;
  dataVencimentoGarantia: string;
  diasGarantiaRestantes: number;
  osNumero?: string;
  osBlingId?: number;
  quantidadeUsadaOs?: number;
  quantidadeDisponivelRetorno: number;
}

export interface DevolucaoGarantiaDocumento {
  id: string;
  geradoEm: string;
  fornecedor: string;
  numeroPedido: string;
  pecaNome: string;
  marcaPeca?: string;
  modeloNome?: string;
  cor?: string;
  quantidade: number;
  custoUnitario: number;
  dataEntrada: string;
  dataVencimentoGarantia: string;
  motivo?: string;
  observacao?: string;
  movimentacaoId: string;
  osNumero?: string;
  osBlingId?: number;
}

export interface EstoqueSugestaoItem {
  id: string;
  nome: string;
  extra?: string;
}

export interface CaixaRetornoGarantiaItem {
  id?: string;
  status: string;
  loteId: string;
  pedidoCompraId: string;
  numeroPedido: string;
  fornecedor: string;
  pecaId: string;
  pecaNome: string;
  marcaPeca?: string;
  modeloId?: string;
  modeloNome?: string;
  cor?: string;
  quantidade: number;
  custoUnitario: number;
  dataEntrada: string;
  dataVencimentoGarantia: string;
  osNumero?: string;
  osBlingId?: number;
  origemOs?: boolean;
  motivo?: string;
  observacao?: string;
  criadoEm?: string;
}

export interface CaixaRetornoFornecedorGrupo {
  fornecedor: string;
  totalItens: number;
  totalUnidades: number;
  dataVencimentoMaisProxima: string;
  dataPrazoMaximoEnvio: string;
  diasRestantesPrazo: number;
  prazoVencido: boolean;
  itens: CaixaRetornoGarantiaItem[];
}

export interface CaixaRetornoGarantiaResponse {
  diasAntecedenciaPrazo: number;
  fornecedores: CaixaRetornoFornecedorGrupo[];
}

export interface CaixaRetornoAdicaoResponse {
  item: CaixaRetornoGarantiaItem;
  dataPrazoMaximoEnvioFornecedor: string;
  diasRestantesPrazo: number;
}

export interface GerarLoteDevolucaoGarantiaRequest {
  fornecedor: string;
  motivo?: string;
}

export interface LoteDevolucaoGarantiaDocumento {
  id: string;
  geradoEm: string;
  fornecedor: string;
  motivo?: string;
  totalUnidades: number;
  dataVencimentoMaisProxima: string;
  dataPrazoMaximoEnvio: string;
  itens: DevolucaoGarantiaDocumento[];
}

export interface LoteRetornoGarantiaHistorico {
  id?: string;
  fornecedor: string;
  motivo?: string;
  totalUnidades: number;
  totalItens: number;
  dataVencimentoMaisProxima: string;
  dataPrazoMaximoEnvio: string;
  geradoEm: string;
  itens: DevolucaoGarantiaDocumento[];
}

export interface AnaliseRetornoPecaItem {
  pecaNome: string;
  marcaPeca?: string;
  quantidade: number;
  ocorrencias: number;
  fornecedorMaisFrequente?: string;
}

export interface AnaliseRetornoFornecedorItem {
  fornecedor: string;
  totalLotes: number;
  totalUnidades: number;
  totalItensLinha: number;
  pecas: AnaliseRetornoPecaItem[];
}

export interface AnaliseRetornoGarantiaResponse {
  de?: string;
  ate?: string;
  totalLotes: number;
  totalUnidades: number;
  fornecedores: AnaliseRetornoFornecedorItem[];
  pecas: AnaliseRetornoPecaItem[];
}

export interface CustoPecaReferencia {
  pecaId: string;
  custoUnitario: number;
  fornecedor?: string;
  marcaPeca?: string;
  fonte: 'fifo' | 'media';
}

export type PecaCatalogo = PecaEstoque;
