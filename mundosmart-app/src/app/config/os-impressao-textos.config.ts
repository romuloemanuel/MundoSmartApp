export interface ImpressaoOsTextos {
  avisoPreOrcamento: string;
  termosCondicoes: string;
}

export interface ImpressaoEmpresaConfig {
  nomeEmpresa: string;
  enderecoEmpresa: string;
  telefoneEmpresa: string;
  cnpjEmpresa: string;
  diasGarantiaPadrao: number;
  textoGarantiaTermica: string;
}

export interface ImpressaoOsConfig extends ImpressaoOsTextos, ImpressaoEmpresaConfig {}

export const IMPRESSAO_EMPRESA_PADRAO: ImpressaoEmpresaConfig = {
  nomeEmpresa: 'MundoSmart Assistência',
  enderecoEmpresa: '',
  telefoneEmpresa: '',
  cnpjEmpresa: '',
  diasGarantiaPadrao: 90,
  textoGarantiaTermica:
    'Garantia exclusiva da peça substituída ou do reparo executado nesta OS. ' +
    'Perde validade em caso de queda, líquido, violação de lacre ou abertura por terceiros.',
};

export const IMPRESSAO_OS_TEXTOS_PADRAO: ImpressaoOsTextos = {
  avisoPreOrcamento:
    'Este documento registra a ordem de serviço no momento da entrada do aparelho. ' +
    'Os valores e itens abaixo são um pré-orçamento, pois o equipamento ainda não foi aberto ' +
    'para diagnóstico interno. Após a análise técnica, podem ser identificados defeitos ou ' +
    'serviços adicionais, com atualização do orçamento final.',
  termosCondicoes:
    'O prazo para retirada do equipamento é de 30 (trinta) dias após a nossa notificação de conclusão ou orçamento. ' +
    'A partir do 31º dia, incidirá uma taxa de guarda e seguro de R$ 5,00 diários. Caso o valor acumulado (conserto e/ou estadia) ' +
    'ultrapasse o valor de mercado do aparelho, medidas legais poderão ser adotadas para a quitação do débito. ' +
    'Sobre o nosso serviço, oferecemos 90 (noventa) dias de garantia referentes exclusivamente à peça substituída ou ao reparo executado. ' +
    'Para mantermos essa cobertura, a garantia perde a validade se o equipamento sofrer novas quedas, forte pressão mecânica, contato com líquidos, ' +
    'violação dos selos de segurança ou for aberto por terceiros. Em caso de desistência após a aprovação do orçamento e início do serviço, ' +
    'será cobrada a taxa de hora técnica referente ao tempo de bancada para a desmontagem e reversão do procedimento.\n\n' +
    'O cliente compreende que quedas e fortes impactos causam danos internos que não podem ser dimensionados antes da abertura do aparelho. ' +
    'A real extensão do choque sofrido pelos componentes e pela placa só pode ser constatada durante a desmontagem técnica. ' +
    'Devido à fragilidade gerada pelo acidente original, as lesões ocultas podem se manifestar durante o diagnóstico, podendo o aparelho parar de funcionar. ' +
    'A assistência técnica não se responsabiliza pela evolução de defeitos que já estavam presentes no interior do equipamento.\n\n' +
    'O cliente autoriza o recebimento de notificações e a aprovação de orçamentos através do WhatsApp cadastrado, ' +
    'reconhecendo o aceite por mensagem como assinatura válida.',
};

export const IMPRESSAO_OS_CONFIG_PADRAO: ImpressaoOsConfig = {
  ...IMPRESSAO_OS_TEXTOS_PADRAO,
  ...IMPRESSAO_EMPRESA_PADRAO,
};

let _config: ImpressaoOsConfig = { ...IMPRESSAO_OS_CONFIG_PADRAO };

export function aplicarConfigImpressaoOs(partial: Partial<ImpressaoOsConfig>): void {
  _config = {
    avisoPreOrcamento: partial.avisoPreOrcamento?.trim() || IMPRESSAO_OS_TEXTOS_PADRAO.avisoPreOrcamento,
    termosCondicoes: partial.termosCondicoes?.trim() || IMPRESSAO_OS_TEXTOS_PADRAO.termosCondicoes,
    nomeEmpresa: partial.nomeEmpresa?.trim() || IMPRESSAO_EMPRESA_PADRAO.nomeEmpresa,
    enderecoEmpresa: partial.enderecoEmpresa?.trim() ?? '',
    telefoneEmpresa: partial.telefoneEmpresa?.trim() ?? '',
    cnpjEmpresa: partial.cnpjEmpresa?.trim() ?? '',
    diasGarantiaPadrao: partial.diasGarantiaPadrao && partial.diasGarantiaPadrao > 0
      ? partial.diasGarantiaPadrao
      : IMPRESSAO_EMPRESA_PADRAO.diasGarantiaPadrao,
    textoGarantiaTermica: partial.textoGarantiaTermica?.trim() || IMPRESSAO_EMPRESA_PADRAO.textoGarantiaTermica,
  };
}

/** @deprecated use aplicarConfigImpressaoOs */
export function aplicarTextosImpressaoOs(textos: Partial<ImpressaoOsTextos>): void {
  aplicarConfigImpressaoOs(textos);
}

export function getConfigImpressaoOs(): ImpressaoOsConfig {
  return { ..._config };
}

export function getTextosImpressaoOs(): ImpressaoOsTextos {
  const { avisoPreOrcamento, termosCondicoes } = _config;
  return { avisoPreOrcamento, termosCondicoes };
}

export function getEmpresaImpressaoConfig(): ImpressaoEmpresaConfig {
  const {
    nomeEmpresa,
    enderecoEmpresa,
    telefoneEmpresa,
    cnpjEmpresa,
    diasGarantiaPadrao,
    textoGarantiaTermica,
  } = _config;
  return {
    nomeEmpresa,
    enderecoEmpresa,
    telefoneEmpresa,
    cnpjEmpresa,
    diasGarantiaPadrao,
    textoGarantiaTermica,
  };
}
