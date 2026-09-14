import { Injectable } from '@angular/core';
import { PaymobiBoleto, PaymobiStatus, PaymobiStatusCobranca, PaymobiVenda, statusCobrancaDe } from './paymobi-vendas.service';

export interface PaymobiCalculoConfig {
  acrescimoAparelho: number;
  custoChave: number;
  custoPlataformaMensal: number;
  margemErroLucro: number;
  percentualLucro: number;
  percentualLucroMinimo: number;
}

export type PaymobiTipoEncerramento = 'previsto' | 'concluido' | 'prematuro';
export type PaymobiTipoResultado = 'aguardando' | 'lucro' | 'prejuizo' | 'empate' | 'margem';

export interface PaymobiLinhaView {
  venda: PaymobiVenda;
  chaveCliente: string;
  qtdAparelhosCliente: number;
  aparelho: string;
  dataVenda: string;
  encerradoEm: string;
  tipoEncerramento: PaymobiTipoEncerramento;
  rotuloEncerramento: string;
  contrato: string;
  status: PaymobiStatus;
  rotuloStatus: string;
  statusCobranca: PaymobiStatusCobranca;
  rotuloStatusCobranca: string;
  bloqueado: boolean;
  parcelasAtraso: number;
  parcelasPagas: number;
  parcelasErro: number;
  boletosImei: PaymobiBoleto[];
  boletosContabeis: PaymobiBoleto[];
  semBoletosPaymobi: boolean;
  concretizada: boolean;
  precisaInformarBoletosPagos: boolean;
  valorParcela: number;
  valorEntrada: number;
  valorDevido: number;
  faltaPagar: number;
  valorVenda: number;
  totalBoletosPagos: number;
  totalRecebido: number;
  valorRevenda: number;
  custoManutencao: number;
  valorCompra: number;
  custoAcrescimo: number;
  custoChave: number;
  custoAparelhoTotal: number;
  custoPlataforma: number;
  mesesPlataforma: number;
  deuLucroParaRateio: boolean;
  faltaEmpate: number;
  faltaLucroMinimo: number;
  lucroLiquido: number;
  lucroAntesPlataforma: number;
  /** Custo do aparelho − já recebido, sem saldo de parcela. Só conta se o custo foi informado. */
  prejuizoAparelho: number;
  receita: number;
  despesa: number;
  tipoResultado: PaymobiTipoResultado;
  rotuloResultado: string;
  contaCusto: boolean;
}

export interface PaymobiResumoView {
  qtd: number;
  emAndamento: number;
  pagos: number;
  cancelados: number;
  concretizadas: number;
  rateio: number;
  compra: number;
  acrescimos: number;
  chaves: number;
  entradas: number;
  custoLiquido: number;
  custoAparelhosOperacao: number;
  valorPrejuizoCancelamentos: number;
  valorLucroCancelamentos: number;
  valorPrejuizoPerdidos: number;
  valorLucroPerdidos: number;
  resultadoPerdidos: number;
  plataformaMensal: number;
  plataforma: number;
  operacional: number;
  venda: number;
  recebido: number;
  receita: number;
  despesa: number;
  lucroLiquido: number;
  resultadoPagos: number;
  resultadoCancelamentos: number;
  comLucro: number;
  prejuizoPagos: number;
  prejuizoCancelamentos: number;
  bloqueados: number;
  comAtraso: number;
  inicio?: string;
  meses: number;
  plataformaTotal: number;
  custoPlataformaMensalPorAparelho: number;
  contratosAtivos: number;
  boletosPagos: number;
  boletosAtrasados: number;
  boletosAReceber: number;
  contratosPerdidos: number;
  devidoAtivos: number;
  devidoPerdido: number;
  devidoEsperado: number;
  percentualPerdido: number;
  lucroPrevisto: number;
  receitaAtivos: number;
  despesaAtivos: number;
  lucroAtivos: number;
  contratosBons: number;
  devidoBomPagante: number;
  percentualBomPagante: number;
  receitaMensalBomPagante: number;
  receitaAteFimMesBomPagante: number;
  boletosAteFimMesBomPagante: number;
  contratosOtimistas: number;
  percentualOtimista: number;
  receitaMensalOtimista: number;
  hoje: string;
  fimMes: string;
  retornoHojePercentual: number;
  retornoPrevistoPercentual: number;
  retornoPrevistoOtimistaPercentual: number;
  aparelhosVendidos: number;
  aparelhosConsideradosVendidos: number;
  valorTotalVendido: number;
}

export interface PaymobiPainelView {
  linhas: PaymobiLinhaView[];
  resumo: PaymobiResumoView;
}

const ROTULO_STATUS: Record<string, string> = {
  aberta: 'Em cobrança',
  atrasada: 'Atrasada',
  quitada: 'Pago (fim do contrato)',
  cancelada: 'Cancelado / devolução',
};

const ROTULO_COBRANCA: Record<PaymobiStatusCobranca, string> = {
  ok: 'OK',
  negociacao: 'Em Negociação',
  recuperacao: 'Em Recuperação',
  perdido: 'Perdido',
};

export const PAYMOBI_RESUMO_VAZIO: PaymobiResumoView = {
  qtd: 0,
  emAndamento: 0,
  pagos: 0,
  cancelados: 0,
  concretizadas: 0,
  rateio: 0,
  compra: 0,
  acrescimos: 0,
  chaves: 0,
  entradas: 0,
  custoLiquido: 0,
  custoAparelhosOperacao: 0,
  valorPrejuizoCancelamentos: 0,
  valorLucroCancelamentos: 0,
  valorPrejuizoPerdidos: 0,
  valorLucroPerdidos: 0,
  resultadoPerdidos: 0,
  plataformaMensal: 0,
  plataforma: 0,
  operacional: 0,
  venda: 0,
  recebido: 0,
  receita: 0,
  despesa: 0,
  lucroLiquido: 0,
  resultadoPagos: 0,
  resultadoCancelamentos: 0,
  comLucro: 0,
  prejuizoPagos: 0,
  prejuizoCancelamentos: 0,
  bloqueados: 0,
  comAtraso: 0,
  meses: 0,
  plataformaTotal: 0,
  custoPlataformaMensalPorAparelho: 0,
  contratosAtivos: 0,
  boletosPagos: 0,
  boletosAtrasados: 0,
  boletosAReceber: 0,
  contratosPerdidos: 0,
  devidoAtivos: 0,
  devidoPerdido: 0,
  devidoEsperado: 0,
  percentualPerdido: 0,
  lucroPrevisto: 0,
  receitaAtivos: 0,
  despesaAtivos: 0,
  lucroAtivos: 0,
  contratosBons: 0,
  devidoBomPagante: 0,
  percentualBomPagante: 0,
  receitaMensalBomPagante: 0,
  receitaAteFimMesBomPagante: 0,
  boletosAteFimMesBomPagante: 0,
  contratosOtimistas: 0,
  percentualOtimista: 0,
  receitaMensalOtimista: 0,
  hoje: '',
  fimMes: '',
  retornoHojePercentual: 0,
  retornoPrevistoPercentual: 0,
  retornoPrevistoOtimistaPercentual: 0,
  aparelhosVendidos: 0,
  aparelhosConsideradosVendidos: 0,
  valorTotalVendido: 0,
};

@Injectable({ providedIn: 'root' })
export class PaymobiCalculoService {
  readonly resumoVazio = PAYMOBI_RESUMO_VAZIO;

  montar(vendas: PaymobiVenda[], cfg: PaymobiCalculoConfig): PaymobiPainelView {
    const hoje = hojeBrasil();
    const porCliente = new Map<string, number>();
    for (const v of vendas) {
      const chave = chaveCliente(v);
      porCliente.set(chave, (porCliente.get(chave) || 0) + 1);
    }

    const bases = vendas.map(v => this.baseLinha(v, cfg, hoje, false));
    const noRateio = bases.filter(b => b.deuLucroParaRateio).length;
    const plataformaPorAparelho = noRateio > 0 ? cfg.custoPlataformaMensal / noRateio : 0;

    const linhas = bases.map(b => this.fecharLinha(b, cfg, porCliente, plataformaPorAparelho));
    const atrasoGrupo = new Map<string, number>();
    for (const l of linhas) {
      atrasoGrupo.set(l.chaveCliente, Math.max(atrasoGrupo.get(l.chaveCliente) || 0, l.parcelasAtraso));
    }
    linhas.sort((a, b) => {
      const atrasoGrupoDiff = (atrasoGrupo.get(b.chaveCliente) || 0) - (atrasoGrupo.get(a.chaveCliente) || 0);
      if (atrasoGrupoDiff !== 0) return atrasoGrupoDiff;
      if (a.chaveCliente !== b.chaveCliente) return a.chaveCliente.localeCompare(b.chaveCliente, 'pt-BR');
      const atraso = b.parcelasAtraso - a.parcelasAtraso;
      if (atraso !== 0) return atraso;
      return (b.venda.dataVenda ?? '').localeCompare(a.venda.dataVenda ?? '');
    });

    return { linhas, resumo: this.montarResumo(vendas, linhas, cfg, plataformaPorAparelho, hoje) };
  }

  preview(editando: PaymobiVenda, vendas: PaymobiVenda[], cfg: PaymobiCalculoConfig): PaymobiLinhaView {
    const lista = editando.id
      ? vendas.map(v => (v.id === editando.id ? editando : v))
      : [...vendas, editando];
    const painel = this.montarRascunho(lista, editando, cfg);
    return painel.linhas.find(l => l.venda === editando) ?? painel.linhas[painel.linhas.length - 1];
  }

  rotuloBoleto(b: PaymobiBoleto, hoje = hojeBrasil()): string {
    const s = situacaoBoleto(b, hoje);
    if (s === 'erro') return 'Não veio da PayMobi';
    if (s === 'pago') return b.manual ? 'Pago na loja' : 'Pago';
    if (s === 'atrasado') return 'Em atraso';
    if (s === 'aberto') return 'Em aberto';
    return b.status || '—';
  }

  classeBoleto(b: PaymobiBoleto, hoje = hojeBrasil()): string {
    const s = situacaoBoleto(b, hoje);
    if (s === 'erro') return 'Erro';
    if (s === 'pago') return b.manual ? 'Pago na loja' : 'Pago';
    if (s === 'atrasado') return 'Em atraso';
    if (s === 'aberto') return 'Em aberto';
    return 'outro';
  }

  boletoEmErro(b: PaymobiBoleto, hoje = hojeBrasil()): boolean {
    return situacaoBoleto(b, hoje) === 'erro';
  }

  boletoDaLoja(b: PaymobiBoleto): boolean {
    return !!b.manual;
  }

  moeda(n: number): string {
    return formatarMoeda(n);
  }

  dataCurta(iso: string | undefined): string {
    return formatarData(iso);
  }

  rotuloStatus(status: string): string {
    return ROTULO_STATUS[status] ?? status;
  }

  private montarRascunho(vendas: PaymobiVenda[], rascunho: PaymobiVenda, cfg: PaymobiCalculoConfig): PaymobiPainelView {
    const hoje = hojeBrasil();
    const porCliente = new Map<string, number>();
    for (const v of vendas) {
      const chave = chaveCliente(v);
      porCliente.set(chave, (porCliente.get(chave) || 0) + 1);
    }
    const bases = vendas.map(v => this.baseLinha(v, cfg, hoje, v === rascunho));
    const noRateio = bases.filter(b => b.deuLucroParaRateio).length;
    const plataformaPorAparelho = noRateio > 0 ? cfg.custoPlataformaMensal / noRateio : 0;
    const linhas = bases.map(b => this.fecharLinha(b, cfg, porCliente, plataformaPorAparelho));
    return { linhas, resumo: PAYMOBI_RESUMO_VAZIO };
  }

  private baseLinha(v: PaymobiVenda, cfg: PaymobiCalculoConfig, hoje: string, rascunho: boolean): LinhaBase {
    const boletosImei = completarAgenda(v, boletosDoImei(v));
    const boletos = boletosContabeis(boletosImei, hoje);
    const conta = !!v.concretizada || (rascunho && (Number(v.valorInvestido) || 0) > 0);
    const valorCompra = conta ? (Number(v.valorInvestido) || 0) : 0;
    const custoAcrescimo = conta ? cfg.acrescimoAparelho : 0;
    const custoChave = conta ? (Number(cfg.custoChave) || 0) : 0;
    const custoAparelhoTotal = valorCompra + custoAcrescimo + custoChave;
    const custoManutencao = Number(v.custoManutencao) || 0;
    const despesaAparelho = conta ? custoAparelhoTotal + custoManutencao : 0;
    const valorEntrada = Number(v.valorEntrada) || 0;
    const valorParcela = Number(v.valorParcela) || 0;
    const valorFinanciado = Math.max(0, (Number(v.valorVenda) || 0) - valorEntrada);
    const devidoGuardado = valorDevidoGuardado(v, valorParcela);
    const semBoletos = boletos.length === 0;
    const totalBoletosPagos = totalBoletosPagosDe(v, boletos, semBoletos, devidoGuardado, valorFinanciado, hoje);
    const agenda = atrasoPeloContrato(v, boletos, valorParcela, totalBoletosPagos, hoje);
    const quitou = v.status !== 'cancelada' && agenda.quitou;
    const valorDevido = semBoletos
      ? devidoGuardado
      : boletos
          .filter(b => {
            const s = situacaoBoleto(b, hoje);
            return s !== 'pago' && s !== 'erro';
          })
          .reduce((acc, b) => acc + (Number(b.valor) || 0), 0);
    const parcelasAtraso = agenda.parcelasAtraso;
    const faltaPagar = agenda.faltaPagar;
    const parcelasPagas = agenda.parcelasPagas;
    const parcelasErro = boletos.filter(b => situacaoBoleto(b, hoje) === 'erro').length;
    const totalRecebido = valorEntrada + totalBoletosPagos;
    const valorRevenda = Number(v.valorRevenda) || 0;
    const receita = v.status === 'cancelada' ? valorEntrada + totalBoletosPagos + valorRevenda : totalRecebido;
    const lucroAntes = receita - despesaAparelho;
    const limiar = Math.max(cfg.margemErroLucro, custoAparelhoTotal * cfg.percentualLucro);
    const deuLucroParaRateio = conta && lucroAntes >= limiar;
    const meses = mesesPlataforma(v, conta);

    return {
      venda: v,
      boletosImei,
      boletos,
      conta,
      valorCompra,
      custoAcrescimo,
      custoChave,
      custoAparelhoTotal,
      custoManutencao,
      despesaAparelho,
      valorEntrada,
      valorParcela,
      valorDevido,
      faltaPagar,
      semBoletos,
      totalBoletosPagos,
      totalRecebido,
      valorRevenda,
      receita,
      lucroAntes,
      deuLucroParaRateio,
      meses,
      parcelasAtraso,
      parcelasPagas,
      parcelasErro,
      quitou,
    };
  }

  private fecharLinha(
    b: LinhaBase,
    cfg: PaymobiCalculoConfig,
    porCliente: Map<string, number>,
    plataformaPorAparelho: number,
  ): PaymobiLinhaView {
    const v = b.venda;
    const custoPlataforma = b.deuLucroParaRateio ? plataformaPorAparelho * b.meses : 0;
    const despesa = b.conta ? b.despesaAparelho + custoPlataforma : 0;
    const lucroLiquido = b.conta ? b.receita - despesa : 0;
    const custoEmpate = b.conta
      ? (v.status === 'cancelada' ? b.custoAparelhoTotal + b.custoManutencao : b.custoAparelhoTotal)
      : 0;
    const faltaEmpate = b.conta ? Math.max(0, custoEmpate - b.receita) : 0;
    const faltaLucroMinimo = b.conta ? Math.max(0, custoEmpate * (1 + cfg.percentualLucroMinimo) - b.receita) : 0;
    const tipo = tipoResultado(v, b.conta, lucroLiquido, b.lucroAntes, b.deuLucroParaRateio);
    const status: PaymobiStatus = v.status === 'cancelada'
      ? 'cancelada'
      : (b.quitou || v.status === 'quitada')
        ? 'quitada'
        : b.parcelasAtraso > 0
          ? 'atrasada'
          : 'aberta';
    const enc = encerramentoContrato(v, b.boletos, status, hojeBrasil());
    const statusCobranca = statusCobrancaDe(v.statusCobranca, b.parcelasAtraso, status);

    return {
      venda: v,
      chaveCliente: chaveCliente(v),
      qtdAparelhosCliente: porCliente.get(chaveCliente(v)) || 1,
      aparelho: [v.aparelhoMarca, v.aparelhoModelo, v.aparelhoCor].filter(Boolean).join(' ') || '—',
      dataVenda: formatarData(v.dataVenda),
      encerradoEm: enc.data,
      tipoEncerramento: enc.tipo,
      rotuloEncerramento: enc.rotulo,
      contrato: rotuloContrato(v),
      status,
      rotuloStatus: ROTULO_STATUS[status] ?? status,
      statusCobranca,
      rotuloStatusCobranca: ROTULO_COBRANCA[statusCobranca],
      bloqueado: !!v.aparelhoBloqueado,
      parcelasAtraso: b.parcelasAtraso,
      parcelasPagas: b.parcelasPagas,
      parcelasErro: b.parcelasErro,
      boletosImei: b.boletosImei,
      boletosContabeis: b.boletos,
      semBoletosPaymobi: b.semBoletos,
      concretizada: !!v.concretizada,
      precisaInformarBoletosPagos: b.semBoletos && !(Number(v.valorBoletosPagos) > 0),
      valorParcela: b.valorParcela,
      valorEntrada: b.valorEntrada,
      valorDevido: b.valorDevido,
      faltaPagar: b.faltaPagar,
      valorVenda: Number(v.valorVenda) || 0,
      totalBoletosPagos: b.totalBoletosPagos,
      totalRecebido: b.totalRecebido,
      valorRevenda: b.valorRevenda,
      custoManutencao: b.custoManutencao,
      valorCompra: b.valorCompra,
      custoAcrescimo: b.custoAcrescimo,
      custoChave: b.custoChave,
      custoAparelhoTotal: b.custoAparelhoTotal,
      custoPlataforma,
      mesesPlataforma: b.meses,
      deuLucroParaRateio: b.deuLucroParaRateio,
      faltaEmpate,
      faltaLucroMinimo,
      lucroLiquido,
      lucroAntesPlataforma: b.lucroAntes,
      prejuizoAparelho: prejuizoRealAparelho(b.conta, b.custoAparelhoTotal, b.custoManutencao, b.receita),
      receita: b.receita,
      despesa,
      tipoResultado: tipo,
      rotuloResultado: rotuloResultado(v, !!v.concretizada, lucroLiquido, b.deuLucroParaRateio),
      contaCusto: b.conta,
    };
  }

  private montarResumo(
    vendas: PaymobiVenda[],
    linhas: PaymobiLinhaView[],
    cfg: PaymobiCalculoConfig,
    plataformaPorAparelho: number,
    hoje: string,
  ): PaymobiResumoView {
    const inicio = vendas
      .map(v => (v.dataVenda ?? '').slice(0, 10))
      .filter(d => d.length === 10)
      .sort()[0];
    const meses = inicio ? mesesEntre(inicio, new Date().toISOString()) : 0;
    let emAndamento = 0;
    let pagos = 0;
    let cancelados = 0;
    let concretizadas = 0;
    let rateio = 0;
    let compra = 0;
    let acrescimos = 0;
    let chaves = 0;
    let entradas = 0;
    let custoLiquido = 0;
    let custoAparelhosOperacao = 0;
    let resultadoPerdidos = 0;
    let plataforma = 0;
    let operacional = 0;
    let vendaPaga = 0;
    let recebido = 0;
    let receitaOperacao = 0;
    let receitaAtivos = 0;
    let despesaAtivos = 0;
    let resultadoPagos = 0;
    let resultadoCancelamentos = 0;
    let prejuizoPagos = 0;
    let prejuizoCancelamentos = 0;
    let bloqueados = 0;
    let comAtraso = 0;
    let aparelhosVendidos = 0;
    let valorTotalVendido = 0;

    for (const l of linhas) {
      const ativo = l.status === 'aberta' || l.status === 'atrasada';
      const perdido = cobrancaPerdida(l);
      if (ativo) emAndamento++;
      else if (l.status === 'quitada') {
        pagos++;
        vendaPaga += l.valorVenda;
        if (l.contaCusto) {
          resultadoPagos += l.lucroLiquido;
          if (l.lucroLiquido < 0) prejuizoPagos++;
        }
      } else if (l.status === 'cancelada') {
        cancelados++;
        const custoCancel = l.contaCusto ? l.custoAparelhoTotal + l.custoManutencao : 0;
        const resultadoCancel = l.receita - custoCancel;
        resultadoCancelamentos += resultadoCancel;
        if (resultadoCancel < 0 && l.contaCusto) prejuizoCancelamentos++;
      }
      if ((Number(l.venda.valorInvestido) || 0) > 0) concretizadas++;
      if (l.contaCusto) {
        compra += l.valorCompra;
        acrescimos += l.custoAcrescimo;
        chaves += l.custoChave;
        custoLiquido += l.custoAparelhoTotal;
        plataforma += l.custoPlataforma;
        operacional += l.despesa;
        if (l.status !== 'cancelada' && !perdido) {
          custoAparelhosOperacao += l.custoAparelhoTotal + l.custoManutencao;
        }
        if (ativo && !perdido) despesaAtivos += l.despesa;
      }
      if (perdido) {
        const custoPerdido = l.contaCusto ? l.custoAparelhoTotal + l.custoManutencao : 0;
        resultadoPerdidos += l.receita - custoPerdido;
      }
      if (l.deuLucroParaRateio) rateio++;
      entradas += l.valorEntrada;
      recebido += l.totalRecebido;
      if (l.status !== 'cancelada' && !perdido) receitaOperacao += l.receita;
      if (ativo && !perdido) receitaAtivos += l.receita;
      if (l.bloqueado) bloqueados++;
      if (l.parcelasAtraso > 0) comAtraso++;
      aparelhosVendidos++;
      valorTotalVendido += valorVendidoLinha(l);
    }

    const cobranca = totaisBoletosAtivos(linhas, hoje);
    const previsao = previsaoCobranca(linhas, hoje);
    const plataformaTotal = inicio ? cfg.custoPlataformaMensal * meses : 0;
    const lucroCancelamentosLiquido = Math.max(0, resultadoCancelamentos);
    const prejuizoCancelamentosLiquido = Math.max(0, -resultadoCancelamentos);
    const lucroPerdidosLiquido = Math.max(0, resultadoPerdidos);
    const prejuizoPerdidosLiquido = Math.max(0, -resultadoPerdidos);
    const receita = receitaOperacao + lucroCancelamentosLiquido + lucroPerdidosLiquido;
    const despesa = custoAparelhosOperacao
      + plataformaTotal
      + prejuizoCancelamentosLiquido
      + prejuizoPerdidosLiquido;
    const lucroLiquido = receita - despesa;
    const lucroAtivos = receitaAtivos - despesaAtivos;
    const ativos = cobranca.contratosAtivos;

    return {
      qtd: vendas.length,
      emAndamento,
      pagos,
      cancelados,
      concretizadas,
      rateio,
      compra,
      acrescimos,
      chaves,
      entradas,
      custoLiquido,
      custoAparelhosOperacao,
      valorPrejuizoCancelamentos: prejuizoCancelamentosLiquido,
      valorLucroCancelamentos: lucroCancelamentosLiquido,
      valorPrejuizoPerdidos: prejuizoPerdidosLiquido,
      valorLucroPerdidos: lucroPerdidosLiquido,
      resultadoPerdidos,
      plataformaMensal: cfg.custoPlataformaMensal,
      plataforma,
      operacional,
      venda: vendaPaga,
      recebido,
      receita,
      despesa,
      lucroLiquido,
      receitaAtivos,
      despesaAtivos,
      lucroAtivos,
      resultadoPagos,
      resultadoCancelamentos,
      comLucro: rateio,
      prejuizoPagos,
      prejuizoCancelamentos,
      bloqueados,
      comAtraso,
      inicio,
      meses,
      plataformaTotal,
      custoPlataformaMensalPorAparelho: plataformaPorAparelho,
      ...cobranca,
      ...previsao,
      percentualPerdido: percentualSobre(previsao.contratosPerdidos, ativos),
      percentualBomPagante: percentualSobre(previsao.contratosBons, ativos),
      percentualOtimista: percentualSobre(previsao.contratosOtimistas, ativos),
      lucroPrevisto: lucroLiquido + previsao.devidoEsperado,
      retornoHojePercentual: percentualSobre(lucroLiquido, despesa),
      retornoPrevistoPercentual: percentualSobre(receita + previsao.devidoBomPagante - despesa, despesa),
      retornoPrevistoOtimistaPercentual: percentualSobre(receita + previsao.devidoEsperado - despesa, despesa),
      aparelhosVendidos,
      aparelhosConsideradosVendidos: emAndamento + pagos,
      valorTotalVendido,
    };
  }
}

interface LinhaBase {
  venda: PaymobiVenda;
  boletosImei: PaymobiBoleto[];
  boletos: PaymobiBoleto[];
  conta: boolean;
  valorCompra: number;
  custoAcrescimo: number;
  custoChave: number;
  custoAparelhoTotal: number;
  custoManutencao: number;
  despesaAparelho: number;
  valorEntrada: number;
  valorParcela: number;
  valorDevido: number;
  faltaPagar: number;
  semBoletos: boolean;
  totalBoletosPagos: number;
  totalRecebido: number;
  valorRevenda: number;
  receita: number;
  lucroAntes: number;
  deuLucroParaRateio: boolean;
  meses: number;
  parcelasAtraso: number;
  parcelasPagas: number;
  parcelasErro: number;
  quitou: boolean;
}

export function soDigitos(valor?: string): string {
  return (valor ?? '').replace(/\D+/g, '');
}

export function chaveCliente(v: PaymobiVenda): string {
  const cpf = soDigitos(v.clienteCpf);
  if (cpf.length >= 11) return `cpf:${cpf}`;
  return `nome:${(v.clienteNome ?? '').trim().toLowerCase()}`;
}

function hojeBrasil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function formatarMoeda(n: number): string {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso: string | undefined): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const [a, m, dia] = d.split('-');
  return a && m && dia ? `${dia}/${m}/${a}` : iso;
}

function boletoGerado(b: PaymobiBoleto): boolean {
  return !!(b.link && String(b.link).trim());
}

function situacaoBoleto(b: PaymobiBoleto, hoje: string): 'pago' | 'atrasado' | 'aberto' | 'erro' | 'outro' {
  const s = (b.status ?? '').toLowerCase();
  if (s === 'ausente' || s === 'erro' || s === 'missing') return 'erro';
  if (s === 'paid' || s === 'pago') return 'pago';
  const vencido = !!b.vencimento && b.vencimento.slice(0, 10) < hoje;
  if (s === 'overdue' || s === 'late' || s === 'atrasado' || s === 'atrasada' || vencido) return 'atrasado';
  if (s === 'pending' || s === 'aberto' || s === 'open' || !s) return 'aberto';
  return 'outro';
}

function escolherBoleto(a: PaymobiBoleto, b: PaymobiBoleto, hoje: string): PaymobiBoleto {
  const pagoA = situacaoBoleto(a, hoje) === 'pago';
  const pagoB = situacaoBoleto(b, hoje) === 'pago';
  if (pagoA && !pagoB) return a;
  if (pagoB && !pagoA) return b;
  const gerA = boletoGerado(a);
  const gerB = boletoGerado(b);
  if (gerA && !gerB) return a;
  if (gerB && !gerA) return b;
  return (b.vencimento ?? '') >= (a.vencimento ?? '') ? b : a;
}

function boletosDoImei(v: PaymobiVenda): PaymobiBoleto[] {
  const imei = soDigitos(v.aparelhoImei);
  const lista = v.boletos ?? [];
  if (!imei) return lista;
  const doImei = lista.filter(b => soDigitos(b.imei) === imei || !soDigitos(b.imei));
  return doImei.length ? doImei : lista;
}

function atrasoPeloContrato(
  v: PaymobiVenda,
  boletos: PaymobiBoleto[],
  valorParcela: number,
  totalBoletosPagos: number,
  hoje: string,
): { parcelasAtraso: number; faltaPagar: number; parcelasPagas: number; quitou: boolean } {
  const qtd = Number(v.parcelas) || 0;
  const porNumero = new Map<number, PaymobiBoleto>();
  for (const b of boletos) {
    const n = Number(b.numero) || 0;
    if (n > 0) porNumero.set(n, b);
  }
  const paga = (n: number): boolean => {
    const atual = porNumero.get(n);
    if (atual) return situacaoBoleto(atual, hoje) === 'pago';
    const ant = porNumero.get(n - 1);
    const prox = porNumero.get(n + 1);
    return !!ant && !!prox
      && situacaoBoleto(ant, hoje) === 'pago'
      && situacaoBoleto(prox, hoje) === 'pago';
  };
  const pagasLista = boletos.filter(b => situacaoBoleto(b, hoje) === 'pago').length;
  const pagasValor = valorParcela > 0 ? Math.round(totalBoletosPagos / valorParcela) : 0;
  let parcelasPagas = Math.max(pagasLista, pagasValor);
  if (qtd > 0) {
    let efetivas = 0;
    for (let n = 1; n <= qtd; n++) if (paga(n)) efetivas++;
    parcelasPagas = Math.max(parcelasPagas, efetivas);
  }
  if (v.status === 'cancelada') {
    return { parcelasAtraso: 0, faltaPagar: 0, parcelasPagas, quitou: false };
  }
  const quitou = v.status === 'quitada' || (qtd > 0 && parcelasPagas >= qtd);
  if (quitou) {
    return { parcelasAtraso: 0, faltaPagar: 0, parcelasPagas: Math.max(parcelasPagas, qtd), quitou: true };
  }
  const primeira = (porNumero.get(1)?.vencimento ?? '').slice(0, 10)
    || somarMeses(v.dataVenda, 1);
  let parcelasAtraso = 0;
  for (let n = 1; n <= qtd; n++) {
    if (paga(n)) continue;
    const atual = porNumero.get(n);
    if (atual && situacaoBoleto(atual, hoje) === 'erro') continue;
    const venc = (atual?.vencimento ?? '').slice(0, 10) || somarMeses(primeira, n - 1);
    if (venc && venc < hoje) parcelasAtraso++;
  }
  const faltaPagar = valorParcela > 0
    ? parcelasAtraso * valorParcela
    : boletos
        .filter(b => situacaoBoleto(b, hoje) === 'atrasado')
        .reduce((acc, b) => acc + (Number(b.valor) || 0), 0);
  return { parcelasAtraso, faltaPagar, parcelasPagas, quitou: false };
}

function encerramentoContrato(
  v: PaymobiVenda,
  boletos: PaymobiBoleto[],
  status: PaymobiStatus,
  hoje: string,
): { tipo: PaymobiTipoEncerramento; data: string; rotulo: string } {
  const qtd = Number(v.parcelas) || 0;
  const primeira = (boletos.find(b => Number(b.numero) === 1)?.vencimento ?? '').slice(0, 10)
    || somarMeses(v.dataVenda, 1);
  const ultimaAgenda = (boletos.find(b => Number(b.numero) === qtd)?.vencimento ?? '').slice(0, 10)
    || (qtd > 0 ? somarMeses(primeira, qtd - 1) : '');
  if (status === 'cancelada') {
    return {
      tipo: 'prematuro',
      data: formatarData(v.canceladoEm || v.encerradoEm),
      rotulo: 'Encerrado antecipado',
    };
  }
  if (status === 'quitada') {
    return {
      tipo: 'concluido',
      data: formatarData(v.encerradoEm || ultimoPagamento(boletos, hoje) || ultimaAgenda),
      rotulo: 'Concluído',
    };
  }
  return {
    tipo: 'previsto',
    data: formatarData(ultimaAgenda),
    rotulo: 'Previsão',
  };
}

function ultimoPagamento(boletos: PaymobiBoleto[], hoje: string): string {
  let best = '';
  for (const b of boletos) {
    if (situacaoBoleto(b, hoje) !== 'pago') continue;
    const d = (b.pagoEm ?? b.vencimento ?? '').slice(0, 10);
    if (d > best) best = d;
  }
  return best;
}

function completarAgenda(v: PaymobiVenda, lista: PaymobiBoleto[]): PaymobiBoleto[] {
  if (v.status === 'cancelada' || v.status === 'quitada') return lista;
  const qtd = Number(v.parcelas) || 0;
  const valor = Number(v.valorParcela) || 0;
  if (qtd <= 0 || valor <= 0) return lista;
  const porNumero = new Map<number, PaymobiBoleto>();
  for (const b of lista) {
    const n = Number(b.numero) || 0;
    if (n > 0) porNumero.set(n, b);
  }
  const primeira = (porNumero.get(1)?.vencimento ?? '').slice(0, 10)
    || somarMeses(v.dataVenda, 1);
  if (!primeira) return lista;
  const imei = soDigitos(v.aparelhoImei);
  const out = [...lista];
  const paga = (n: number): boolean => {
    const b = porNumero.get(n);
    if (!b) return false;
    const s = (b.status ?? '').toLowerCase();
    return s === 'paid' || s === 'pago';
  };
  for (let n = 1; n <= qtd; n++) {
    if (porNumero.has(n)) continue;
    if (paga(n - 1) && paga(n + 1)) {
      out.push({
        numero: n,
        vencimento: somarMeses(primeira, n - 1),
        valor,
        status: 'ausente',
        imei,
      });
      continue;
    }
    out.push({
      numero: n,
      vencimento: somarMeses(primeira, n - 1),
      valor,
      status: 'pending',
      imei,
    });
  }
  out.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
  return out;
}

function somarMeses(iso: string | undefined, meses: number): string {
  const d = (iso ?? '').slice(0, 10);
  const [a, m, dia] = d.split('-').map(Number);
  if (!a || !m || !dia) return '';
  const dt = new Date(a, m - 1 + meses, 1);
  const ultimo = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const day = Math.min(dia, ultimo);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function boletosContabeis(lista: PaymobiBoleto[], hoje: string): PaymobiBoleto[] {
  const seen = new Set<string>();
  const porNumero = new Map<number, PaymobiBoleto>();
  const semNumero: PaymobiBoleto[] = [];
  for (const b of lista) {
    const id = (b.id ?? '').trim();
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    const n = Number(b.numero) || 0;
    if (n <= 0) {
      semNumero.push(b);
      continue;
    }
    const atual = porNumero.get(n);
    porNumero.set(n, atual ? escolherBoleto(atual, b, hoje) : b);
  }
  return [...porNumero.values(), ...semNumero]
    .sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
}

function valorDevidoGuardado(v: PaymobiVenda, parcela: number): number {
  const devido = Number(v.valorDevido);
  if (Number.isFinite(devido) && devido > 0) return devido;
  const atrasadas = Math.max(0, Number(v.parcelasAtraso) || 0);
  if (atrasadas > 0 && parcela > 0) return atrasadas * parcela;
  return 0;
}

function totalBoletosPagosDe(
  v: PaymobiVenda,
  boletos: PaymobiBoleto[],
  semBoletos: boolean,
  devidoGuardado: number,
  valorFinanciado: number,
  hoje: string,
): number {
  const paymobi = boletos
    .filter(b => situacaoBoleto(b, hoje) === 'pago')
    .reduce((acc, b) => acc + (Number(b.valor) || 0), 0);
  if (paymobi > 0) return paymobi;
  const informado = Number(v.valorBoletosPagos) || 0;
  if (informado > 0) return informado;
  const manuais = (v.cobrancas ?? []).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  if (manuais > 0) return manuais;
  if (semBoletos && (devidoGuardado > 0 || (Number(v.parcelasAtraso) || 0) > 0)) {
    return Math.max(0, valorFinanciado - devidoGuardado);
  }
  return 0;
}

function mesesPlataforma(v: PaymobiVenda, conta: boolean): number {
  if (!conta) return 0;
  if (v.status === 'cancelada') return mesesEntre(v.dataVenda, v.canceladoEm);
  const parcelas = Number(v.parcelas) || 0;
  if (parcelas > 0) return parcelas;
  return mesesEntre(v.dataVenda, v.encerradoEm);
}

function mesesEntre(inicio?: string, fim?: string): number {
  const a = parseDataLocal(inicio);
  const b = parseDataLocal(fim) ?? new Date();
  if (!a) return 1;
  const meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  return Math.max(1, meses);
}

function parseDataLocal(iso?: string): Date | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  const [a, m, dia] = d.split('-').map(Number);
  if (!a || !m || !dia) return null;
  return new Date(a, m - 1, dia);
}

function rotuloContrato(v: PaymobiVenda): string {
  if (v.contratoNumero) return v.contratoNumero;
  if (v.encerradoEm) return 'Encerrado';
  if (v.contratoAssinado) return 'Assinado';
  return '—';
}

function tipoResultado(
  v: PaymobiVenda,
  conta: boolean,
  lucro: number,
  bruto: number,
  rateio: boolean,
): PaymobiTipoResultado {
  if (!conta || !v.concretizada) return 'aguardando';
  if (v.status === 'cancelada') {
    if (lucro > 0) return 'lucro';
    if (lucro < 0) return 'prejuizo';
    return 'empate';
  }
  if (rateio) return 'lucro';
  if (bruto > 0) return 'margem';
  if (bruto < 0 || lucro < 0) return 'prejuizo';
  return 'empate';
}

function rotuloResultado(v: PaymobiVenda, concretizada: boolean, lucro: number, rateio: boolean): string {
  if (!concretizada) {
    return v.status === 'cancelada' ? 'Informe o custo da devolução' : 'Aguardando custo';
  }
  if (v.status === 'cancelada') {
    if (lucro > 0) return 'Lucro líquido da devolução';
    if (lucro < 0) return 'Prejuízo da devolução';
    return 'Empate na devolução';
  }
  if (rateio) return lucro >= 0 ? 'Lucro líquido' : 'Prejuízo';
  if (lucro > 0) return 'Abaixo da margem';
  if (lucro < 0) return 'Prejuízo';
  return 'Empate';
}

function totaisBoletosAtivos(linhas: PaymobiLinhaView[], hoje: string): {
  contratosAtivos: number;
  boletosPagos: number;
  boletosAtrasados: number;
  boletosAReceber: number;
} {
  let contratosAtivos = 0;
  let boletosPagos = 0;
  let boletosAtrasados = 0;
  let boletosAReceber = 0;
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (l.status !== 'aberta' && l.status !== 'atrasada') continue;
    contratosAtivos++;
    const perdido = cobrancaPerdida(l);
    if (l.boletosContabeis.length) {
      for (const b of l.boletosContabeis) {
        const id = (b.id ?? '').trim();
        if (id) {
          if (vistos.has(id)) continue;
          vistos.add(id);
        }
        const valor = Number(b.valor) || 0;
        const sit = situacaoBoleto(b, hoje);
        if (sit === 'pago') {
          boletosPagos += valor;
          continue;
        }
        if (perdido) continue;
        if (sit === 'atrasado') boletosAtrasados += valor;
        else boletosAReceber += valor;
      }
      continue;
    }
    boletosPagos += Math.max(0, Math.max(0, l.valorVenda - l.valorEntrada) - l.valorDevido);
    if (perdido) continue;
    if (l.parcelasAtraso > 0) boletosAtrasados += l.valorDevido;
    else boletosAReceber += l.valorDevido;
  }
  return { contratosAtivos, boletosPagos, boletosAtrasados, boletosAReceber };
}

function percentualSobre(parte: number, total: number): number {
  if (!(total > 0)) return 0;
  return (parte / total) * 100;
}

function previsaoCobranca(linhas: PaymobiLinhaView[], hoje: string): {
  contratosPerdidos: number;
  devidoAtivos: number;
  devidoPerdido: number;
  devidoEsperado: number;
  percentualPerdido: number;
  contratosBons: number;
  devidoBomPagante: number;
  percentualBomPagante: number;
  receitaMensalBomPagante: number;
  receitaAteFimMesBomPagante: number;
  boletosAteFimMesBomPagante: number;
  contratosOtimistas: number;
  percentualOtimista: number;
  receitaMensalOtimista: number;
  hoje: string;
  fimMes: string;
} {
  const fimMes = ultimoDiaDoMes(hoje);
  let contratosPerdidos = 0;
  let contratosBons = 0;
  let contratosOtimistas = 0;
  let devidoAtivos = 0;
  let devidoPerdido = 0;
  let devidoEsperado = 0;
  let devidoBomPagante = 0;
  let receitaMensalBomPagante = 0;
  let receitaAteFimMesBomPagante = 0;
  let boletosAteFimMesBomPagante = 0;
  let receitaMensalOtimista = 0;
  const vistos = new Set<string>();
  for (const l of linhas) {
    if (l.status !== 'aberta' && l.status !== 'atrasada') continue;
    if (cobrancaPerdida(l)) {
      contratosPerdidos++;
      devidoPerdido += l.prejuizoAparelho;
      continue;
    }
    devidoAtivos += l.valorDevido;
    contratosOtimistas++;
    receitaMensalOtimista += parcelaMensal(l, hoje);
    devidoEsperado += l.valorDevido;
    if (!ehBomPagante(l)) continue;
    contratosBons++;
    devidoBomPagante += l.valorDevido;
    receitaMensalBomPagante += parcelaMensal(l, hoje);
    const ateFimMes = receitaBoletosAteFimMes(l, hoje, fimMes, vistos);
    receitaAteFimMesBomPagante += ateFimMes.valor;
    boletosAteFimMesBomPagante += ateFimMes.qtd;
  }
  const ativos = contratosPerdidos + contratosOtimistas;
  return {
    contratosPerdidos,
    devidoAtivos,
    devidoPerdido,
    devidoEsperado,
    percentualPerdido: percentualSobre(contratosPerdidos, ativos),
    contratosBons,
    devidoBomPagante,
    percentualBomPagante: percentualSobre(contratosBons, ativos),
    receitaMensalBomPagante,
    receitaAteFimMesBomPagante,
    boletosAteFimMesBomPagante,
    contratosOtimistas,
    percentualOtimista: percentualSobre(contratosOtimistas, ativos),
    receitaMensalOtimista,
    hoje,
    fimMes,
  };
}

function valorVendidoLinha(l: PaymobiLinhaView): number {
  if (l.valorVenda > 0) return l.valorVenda;
  const original = Number(l.venda.valorOriginal) || 0;
  if (original > 0) return original;
  const base = Number(l.venda.valorBaseAparelho) || 0;
  if (base > 0) return base + l.valorEntrada;
  return 0;
}

function ehBomPagante(l: PaymobiLinhaView): boolean {
  return l.parcelasAtraso <= 0 && l.statusCobranca !== 'perdido';
}

function cobrancaPerdida(l: PaymobiLinhaView): boolean {
  const definido = (l.venda.statusCobranca ?? '').trim().toLowerCase() === 'perdido';
  return (l.status === 'aberta' || l.status === 'atrasada') && definido;
}

/** Prejuízo do aparelho se nada mais entrar: custo (compra + acréscimo + chave + manutenção) − já recebido. */
function prejuizoRealAparelho(conta: boolean, custoAparelho: number, manutencao: number, receita: number): number {
  if (!conta) return 0;
  return Math.max(0, custoAparelho + manutencao - receita);
}

function parcelaMensal(l: PaymobiLinhaView, hoje: string): number {
  if (l.valorParcela > 0) return l.valorParcela;
  const aberto = l.boletosContabeis.find(b => situacaoBoleto(b, hoje) === 'aberto');
  if (aberto) return Number(aberto.valor) || 0;
  const atrasado = l.boletosContabeis.find(b => situacaoBoleto(b, hoje) === 'atrasado');
  return Number(atrasado?.valor) || 0;
}

function receitaBoletosAteFimMes(
  l: PaymobiLinhaView,
  hoje: string,
  fimMes: string,
  vistos: Set<string>,
): { valor: number; qtd: number } {
  if (l.boletosContabeis.length) {
    let valor = 0;
    let qtd = 0;
    for (const b of l.boletosContabeis) {
      const id = (b.id ?? '').trim();
      if (id) {
        if (vistos.has(id)) continue;
        vistos.add(id);
      }
      if (situacaoBoleto(b, hoje) !== 'aberto') continue;
      const venc = (b.vencimento ?? '').slice(0, 10);
      if (!venc || venc < hoje || venc > fimMes) continue;
      valor += Number(b.valor) || 0;
      qtd++;
    }
    return { valor, qtd };
  }
  if (l.valorParcela <= 0) return { valor: 0, qtd: 0 };
  const diaVenda = diaDoIso(l.venda.dataVenda);
  const diaHoje = diaDoIso(hoje);
  const diaFim = diaDoIso(fimMes);
  if (diaVenda == null || diaHoje == null || diaFim == null) return { valor: 0, qtd: 0 };
  const dia = Math.min(diaVenda, diaFim);
  if (dia < diaHoje || dia > diaFim) return { valor: 0, qtd: 0 };
  return { valor: l.valorParcela, qtd: 1 };
}

function ultimoDiaDoMes(hoje: string): string {
  const [ano, mes] = hoje.split('-').map(Number);
  if (!ano || !mes) return hoje;
  const ultimo = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
}

function diaDoIso(iso?: string): number | null {
  if (!iso) return null;
  const dia = Number(iso.slice(8, 10));
  return Number.isFinite(dia) && dia > 0 ? dia : null;
}
