export interface BlingTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  expiresAt: string;
}

export interface BlingContatoEndereco {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

export interface BlingContatoPrincipal {
  nome?: string;
  telefone?: string;
  celular?: string;
  parentesco?: string;
}

export interface BlingContato {
  id?: number;
  nome: string;
  email?: string;
  telefone?: string;
  celular?: string;
  telefone2?: string;
  cpfCnpj?: string;
  ie?: string;
  rg?: string;
  fantasia?: string;
  tipo?: string;
  endereco?: BlingContatoEndereco;
  contatos?: BlingContatoPrincipal[];
  /** local = base MundoSmart; bling = API Bling (quando integração ativa) */
  origem?: 'local' | 'bling';
}

export interface BlingContatoRef {
  id: number;
  nome?: string;
  telefone?: string;
  celular?: string;
  parentesco?: string;
  /** True = pode retirar o aparelho além do proprietário. */
  autorizadoRetirada?: boolean;
}

export interface BlingOrdemServicoItem {
  id?: number;
  descricao?: string;
  quantidade: number;
  valorUnitario: number;
  /** peca = peça do catálogo; servico = mão de obra / item livre */
  tipoItem?: 'peca' | 'servico';
  pecaId?: string;
  marcaPeca?: string;
  /** Variação escolhida — ex: Calibrada, Troca Premium */
  variacaoRotulo?: string;
  /** Cor escolhida (Tampa traseira) — estoque por modelo + cor */
  cor?: string;
  /** Quantidade já baixada do estoque para esta linha */
  quantidadeEstoqueBaixada?: number;
  /** Referência do catálogo */
  valorSugeridoMinimo?: number;
  valorSugeridoTroca?: number;
  /** Valor acordado com o cliente (preço total — peça + serviço) */
  valorAcontado?: number;
  /** Custo da peça (lote de compra / FIFO) */
  custoPeca?: number;
  parcelamento?: number;
  /** estoque | externo */
  origemPeca?: 'estoque' | 'externo';
  /** carlos | paulo | vic | mercado_livre | shopee */
  fornecedorExterno?: string;
  codigoRastreio?: string;
  estoqueInsuficiente?: boolean;
}

export interface BlingOrdemServico {
  id?: number;
  numero?: string;
  situacao?: string;
  motivoCancelamento?: string;
  data?: string;
  dataPrevista?: string;
  dataAtualizacao?: string;
  dataConclusao?: string;
  contato?: BlingContatoRef;
  contatoAviso?: BlingContatoRef;
  descricao?: string;
  equipamento?: string;
  numeroSerie?: string;
  imei?: string;
  cpfCnpj?: string;
  defeito?: string;
  /** Cliente aceitou risco no reparo. */
  temRisco?: boolean;
  /** Descrição do risco acordado (obrigatório se temRisco). */
  riscoAcordado?: string;
  observacoes?: string;
  valorTotal?: number;
  /** Valor à vista (exibido na grid). */
  valorTotalAcordado?: number;
  /** Valor à vista combinado (preferencial para a grid). */
  valorAVista?: number;
  /** Valor total parcelado (controle interno / combinado). */
  valorAPrazo?: number;
  /** dinheiro | pix | debito | credito_vista | credito_parcelado | na_retirada | a_combinar | avista | parcelado */
  formaPagamento?: string;
  parcelasPagamento?: number;
  /** Juros/taxas do pagamento — base de comissão: total − juros − custo peças */
  juros?: number;
  retorno?: boolean;
  motivoRetorno?: string;
  observacoesInternas?: string;
  /** Loja de origem: MCC | ARCE | SJ | CJR */
  lojaOrigem?: string;
  itens?: BlingOrdemServicoItem[];
  // ── Campos locais (MongoDB) ───────────────────────────────
  marcaId?: string;
  marcaNome?: string;
  modeloId?: string;
  modeloNome?: string;
  dataEntrada?: string;
  /** Quando chegou na assistência — início do SLA/urgência. */
  dataInicioAssistencia?: string;
  /** Prazo esperado da peça (obrigatório em Aguardando Peça). */
  dataPrazoPeca?: string;
  /** Última alteração de situação — base do SLA/urgência. */
  dataUltimaAlteracaoSituacao?: string;
  /** Justificativas de atraso — força vermelho (avisar cliente). */
  justificativasAtraso?: JustificativaAtrasoItem[];
  dataPrevistaTermino?: string;
  dataSaida?: string;
  estadoTela?: string;
  condicoesAparelho?: string;
  acessorios?: string[];
  tecnicoNome?: string;
  tecnicoObservacoes?: string;
  osOriginalNumero?: string;
  osOriginalBlingId?: number;
  tipoPecaProblemaId?: string;
  tipoPecaProblemaNome?: string;
  /** Tipo de serviço na assistência (reparo, orçamento, etc.) */
  tipoServico?: string;
  /** Inclui teste funcional na entrada do aparelho */
  testeEntrada?: boolean;
  /** Inclui teste funcional na saída do aparelho */
  testeSaida?: boolean;
  /** Técnico marcou teste de entrada como realizado */
  testeEntradaRealizado?: boolean;
  /** Técnico marcou teste de saída como realizado */
  testeSaidaRealizado?: boolean;
  /** Prazo de garantia acordado com o cliente, em dias (legado / cupom térmico) */
  garantiaDias?: number;
  /** Prazo de garantia combinado com o cliente, em meses */
  garantiaMeses?: number | null;
  contatoPrincipalIndice?: number;
  preferenciaContatoSelecionado?: boolean;
  /** numerica | desenho | nao_deixou | sem_senha — senha para teste do aparelho */
  senhaDispositivoTipo?: '' | 'numerica' | 'desenho' | 'nao_deixou' | 'sem_senha';
  /** PIN/senha alfanumérica, índices do desenho, ou marcadores sem_senha/nao_deixou */
  senhaDispositivo?: string;
  fotosAparelho?: OsFotoAparelho[];
}

export interface JustificativaAtrasoItem {
  texto: string;
  criadoEm?: string;
}

export interface OsListaPaginada {
  itens: BlingOrdemServico[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface OsFotoAparelho {
  id: string;
  nomeArquivo: string;
  url: string;
  criadoEm?: string;
  categoria?: string;
  descricaoFoco?: string;
}

export interface OsIntakeToken {
  token: string;
  url: string;
  expiraEm?: string;
  osId: number;
  osNumero?: string;
}

export interface OsIntakeSessao {
  osId: number;
  osNumero?: string;
  marcaNome?: string;
  modeloNome?: string;
  clienteNome?: string;
  precisaSenha: boolean;
  senhaPreenchida: boolean;
  senhaDispositivoTipo?: string;
  totalFotos: number;
  fotos: OsFotoAparelho[];
  expiraEm?: string;
}

export interface PecaEstoque {
  id?: string;
  nome: string;
  categoria?: string;
  descricao?: string;
  quantidadeEstoque: number;
  valorSugeridoTroca?: number;
  valorSugeridoMinimo?: number;
  parcelamento?: number;
  marcaPeca?: string;
  garantia?: string;
  modelosCompativeis?: ModeloCompativel[];
  variacoes?: VariacaoServico[];
  /** False = só fornecedor externo; não entra na reposição da loja. */
  estoqueNaLoja?: boolean;
  /** True = não alerta falta/estoque baixo (aparelho obsoleto / fora de linha). */
  ignorarAlertaEstoque?: boolean;
}

export interface VariacaoServico {
  rotulo: string;
  detalhe?: string;
  valorSugeridoTroca?: number;
  valorSugeridoMinimo?: number;
  garantia?: string;
  ordem?: number;
}

export interface ModeloCompativel {
  modeloId: string;
  modeloNome?: string;
  marcaNome?: string;
  valorSugeridoTroca?: number;
  valorSugeridoMinimo?: number;
  /** Cores e quantidades por modelo (Tampa traseira). */
  cores?: CorEstoqueModelo[];
}

export interface CorEstoqueModelo {
  cor: string;
  quantidade: number;
}

export interface OsExecucaoInfo {
  blingId: number;
  osNumero?: string;
  modeloNome?: string;
  marcaNome?: string;
}

export interface DisponibilidadePecaResponse {
  pecaId: string;
  pecaNome: string;
  descricao?: string;
  quantidadeEstoque: number;
  emExecucao: number;
  disponiveis: number;
  valorSugeridoTroca?: number;
  valorSugeridoMinimo?: number;
  parcelamento?: number;
  alerta: boolean;
  nivelEstoque?: string;
  nivelDisponivel?: string;
  modelosCompativeis: string[];
  osEmExecucao: OsExecucaoInfo[];
}

export interface MarcaAparelho {
  id?: string;
  nome: string;
  tipoDispositivo?: string;
}

export interface AparelhoCompativel {
  modeloId: string;
  modeloNome?: string;
  marcaNome?: string;
  tipoDispositivo?: string;
  tipoCompatibilidade: string;
  observacao?: string;
}

export interface ModeloAparelho {
  id?: string;
  nome: string;
  marcaId?: string;
  marcaNome?: string;
  tipoDispositivo?: string;
  tipoTela?: string;
  observacoes?: string;
  aparelhosCompativeis?: AparelhoCompativel[];
  criadoEm?: string;
  atualizadoEm?: string;
}


export interface OsEmAndamentoInfo {
  blingId: number;
  osNumero?: string;
  situacao?: string;
  tipoPecaProblemaNome?: string;
  defeito?: string;
  estadoTela?: string;
  dataEntrada?: string;
  dataPrevistaTermino?: string;
}

export interface PecaReferenciaInfo {
  pecaId: string;
  nome: string;
  marcaPeca?: string;
  valorSugeridoTroca?: number;
  valorSugeridoMinimo?: number;
  parcelamento?: number;
  garantia?: string;
  descricao?: string;
  quantidadeEstoque: number;
  emExecucao: number;
  disponiveis: number;
  temEstoque: boolean;
  alerta: boolean;
  nivelEstoque: string;
  nivelDisponivel?: string;
}

export interface ModeloReferenciaResponse {
  marcaNome?: string;
  modeloNome?: string;
  osEmAndamento: OsEmAndamentoInfo[];
  pecas: PecaReferenciaInfo[];
  alertas?: AlertaOperacionalInfo[];
}

export interface ModeloServicosValoresResponse {
  pecas: PecaValorInfo[];
}

export interface PecaValorInfo {
  pecaId: string;
  nome: string;
  categoria?: string;
  marcaPeca?: string;
  valorSugeridoTroca?: number;
  valorSugeridoMinimo?: number;
  parcelamento?: number;
  garantia?: string;
  quantidadeEstoque: number;
  nivelEstoque: string;
  variacoes?: VariacaoServico[];
  /** Cores do modelo consultado (Tampa traseira). */
  cores?: CorEstoqueModelo[];
}

export interface ModeloOperacaoResponse {
  marcaNome?: string;
  modeloNome?: string;
  osAbertasHoje: number;
  osModeloEmAssistencia: number;
  osEmAndamento: OsEmAndamentoInfo[];
  pecasResumo: PecaEstoqueOperacaoInfo[];
  alertas?: AlertaOperacionalInfo[];
}

export interface PecaEstoqueOperacaoInfo {
  pecaId: string;
  nome: string;
  quantidadeEstoque: number;
  emExecucao: number;
  disponiveis: number;
  alerta: boolean;
  nivelDisponivel?: string;
}

export interface AlertaOperacionalInfo {
  tipo: string;
  severidade: 'aviso' | 'atencao' | 'critico' | string;
  titulo: string;
  mensagem: string;
  pecaNome?: string;
  relacionadoTela?: boolean;
}

export interface BlingOrcamentoItem {
  id?: number;
  descricao?: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
  /** No pré-orçamento é sempre serviço — pecaId é só referência de valor. */
  tipoItem?: 'peca' | 'servico' | string;
  pecaId?: string;
  variacaoRotulo?: string;
  valorSugeridoMinimo?: number;
  valorSugeridoTroca?: number;
  valorAcontado?: number;
}

export interface OrcamentoFollowUpItem {
  data: string;
  anotacao: string;
  responsavel?: string;
  criadoEm?: string;
}

export interface BlingOrcamento {
  id?: number;
  numero?: string;
  situacao?: string;
  data?: string;
  validade?: string;
  contato?: BlingContatoRef;
  /** Loja de origem: MCC (Mococa/assistência), ARCE, SJ, CJR. */
  lojaOrigem?: string;
  /** whatsapp_internet | atendimento_local */
  tipoContato?: string;
  /** Motivo de o cliente não trazer o aparelho agora. */
  justificativaAguardo?: string;
  /** Dia para retomar contato / mandar mensagem (yyyy-MM-dd). */
  dataRetornoMensagem?: string;
  /** Quem fez o orçamento. */
  responsavelOrcamento?: string;
  /** Próxima data agendada de follow-up (yyyy-MM-dd). */
  dataFollowUp?: string;
  /** Quantidade de follow-ups já registrados. */
  vezesContato?: number;
  /** Histórico de follow-ups com anotação. */
  followUps?: OrcamentoFollowUpItem[];
  observacoes?: string;
  valorTotal?: number;
  /** Soma dos valores desejados dos itens (sempre recalculada). */
  valorTotalAcordado?: number;
  /** Opção à vista oferecida ao cliente. */
  valorAVista?: number;
  /** Opção a prazo oferecida ao cliente. */
  valorAPrazo?: number;
  formaPagamento?: string;
  /** Quantidade de parcelas da opção a prazo. */
  parcelasPagamento?: number | null;
  /** Prazo de garantia acordado com o cliente (meses). Sugestão: 3. */
  garantiaMeses?: number | null;
  marcaId?: string;
  marcaNome?: string;
  modeloId?: string;
  modeloNome?: string;
  equipamento?: string;
  osGeradaBlingId?: number;
  osGeradaNumero?: string;
  /** Motivo informado ao marcar desistência do cliente. */
  motivoDesistencia?: string;
  itens?: BlingOrcamentoItem[];
}
