import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_GLOBAL_ERROR_ALERT } from '../interceptors/error-alert.interceptor';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { obterUrlAppIntake } from '../config/intake-app-url.config';

export interface OsAbertaConsulta {
  encontrada: boolean;
  aberta: boolean;
  numero: string;
  situacao: string;
  cliente: string;
  aparelho: string;
  imei: string;
  defeito: string;
}

export interface AparelhoEntradaPayload {
  imei: string;
  marca?: string;
  modelo?: string;
  marcaId?: string;
  modeloId?: string;
  cor?: string;
  configuracao?: string;
  condicao: string;
  valorVenda?: number;
  valorMinimoVenda?: number;
  observacoes?: string;
  alertaPermanente?: string;
  saudeBateria?: number | null;
  bateriaPerfeita?: boolean | null;
  pecaTrocada?: string;
  mensagemPecaTrocada?: boolean;
  pecasTrocadas?: { nome: string; apareceMensagem: boolean }[];
  testes?: { nome: string; ok: boolean; observacao?: string }[];
  passaPorAssistencia?: boolean;
  osNumero?: string;
  desagio?: number;
}

export interface AparelhoLojaItem {
  id?: string;
  imei: string;
  marca: string;
  modelo: string;
  marcaId?: string;
  modeloId?: string;
  cor: string;
  configuracao: string;
  condicao: string;
  valorVenda?: number;
  valorMinimoVenda?: number;
  formaNegociacao?: string;
  financiadoraNome?: string;
  custo: number;
  /** Compra ou avaliação mais o custo das peças da assistência. */
  custoTotal?: number;
  status: string;
  origem: string;
  clienteOrigemNome: string;
  clienteVendaNome: string;
  descontoVigente: boolean;
  dataEntrada: string;
  dataSaida?: string | null;
  saudeBateria?: number | null;
  bateriaPerfeita?: boolean | null;
  pecaTrocada?: string;
  mensagemPecaTrocada?: boolean;
  pecasTrocadas?: { nome: string; apareceMensagem: boolean }[];
  vendedorEntradaNome?: string;
  vendedorSaidaNome?: string;
  observacoes?: string;
  alertaPermanente?: string;
  osEntradaId?: number;
  osEntradaNumero?: string;
  desagio?: number;
  testesNaOs?: boolean;
  testes?: { nome: string; ok: boolean; observacao?: string }[];
  fotos?: { id: string; url: string; tipo?: string }[];
  custosOs?: { osId: number; numero: string; pecas: number; maoDeObra: number }[];
  custoPecas?: number;
  custoMaoDeObra?: number;
}

export interface AparelhoOperacao {
  id?: string;
  tipo: string;
  status: string;
  data: string;
  clienteNome: string;
  clienteCpf: string;
  fornecedorNome: string;
  entradaResumo: string;
  saidaResumo: string;
  valorAvaliado: number;
  precoSaida: number;
  dinheiroRecebido: number;
  dinheiroPago: number;
  formaNegociacao?: string;
  financiadoraNome?: string;
  entradaLoja?: number;
  repasseFinanciadora?: number;
  observacoes: string;
  vendedorNome?: string;
  podeEstornar: boolean;
}

export interface AparelhoLojaResumo {
  emEstoque: number;
  emAssistencia?: number;
  custoEstoque: number;
  dinheiroRecebido: number;
  dinheiroPago: number;
  saldoCaixa: number;
  compras: number;
  vendas: number;
  trocas: number;
  custoPecas?: number;
  custoMaoDeObra?: number;
  porVendedor?: AparelhoVendedorResumo[];
}

export interface AparelhoVendedorResumo {
  nome: string;
  entradas: number;
  vendas: number;
  trocas: number;
  dinheiroRecebido: number;
  dinheiroPago: number;
  custoPecas: number;
  custoMaoDeObra: number;
}

export interface AparelhoCadeiaItem {
  nome: string;
  imei: string;
  cor?: string;
  configuracao?: string;
  condicao?: string;
  custo?: number;
  valor: number;
}

export interface AparelhoCadeiaPasso {
  operacaoId?: string;
  tipo: string;
  data: string;
  pessoa: string;
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteEndereco?: string;
  forma?: string;
  financiadora?: string;
  entrou: AparelhoCadeiaItem[];
  saiu: AparelhoCadeiaItem[];
  dinheiroEntrou: number;
  dinheiroSaiu: number;
  resultado: number;
}

export interface AparelhoCadeia {
  id: string;
  titulo: string;
  aberta: boolean;
  inicio: string;
  fim?: string | null;
  valorEntrada: number;
  valorSaida: number;
  dinheiroEntrou: number;
  dinheiroSaiu: number;
  custoPecas: number;
  investido: number;
  resultadoAteAgora: number;
  lucroFinal?: number | null;
  pendentes: string[];
  passos: AparelhoCadeiaPasso[];
}

export interface AparelhoCadeiaUnidade {
  data: string;
  nome: string;
  imei: string;
  movimento: string;
  operacaoId?: string;
  valor: number;
  cadeiaId: string;
  cadeiaTitulo: string;
  cadeiaAberta: boolean;
  resultadoCadeia: number;
  pessoa: string;
}

export interface AparelhoCadeiaMes {
  ano: number;
  mes: number;
  rotulo: string;
  dinheiroEntrou: number;
  dinheiroSaiu: number;
  resultado: number;
  unidades: AparelhoCadeiaUnidade[];
}

export interface AparelhoLojaPainel {
  resumo: AparelhoLojaResumo;
  estoque: AparelhoLojaItem[];
  custosAssistencia?: AparelhoLojaItem[];
  operacoes: AparelhoOperacao[];
  cadeias?: AparelhoCadeia[];
  meses?: AparelhoCadeiaMes[];
  descontoVendaMaxPercentual?: number;
  acrescimoFinanciadoraMaxPercentual?: number;
}

@Injectable({ providedIn: 'root' })
export class AparelhoLojaService {
  private readonly apiUrl = `${environment.apiUrl}/aparelhos-loja`;

  constructor(private http: HttpClient) {}

  informarImei(id: string, imei: string): Observable<AparelhoLojaPainel> {
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/${id}/imei`, { imei });
  }

  painel(): Observable<AparelhoLojaPainel> {
    return this.http.get<AparelhoLojaPainel>(this.apiUrl);
  }

  importarEstoqueBling(): Observable<{
    ok: boolean;
    produtosLidos: number;
    importados: number;
    jaNoEstoque: number;
    semImei: number;
    semSaldo: number;
    semCusto: number;
    aviso?: string;
  }> {
    return this.http.post<{
      ok: boolean;
      produtosLidos: number;
      importados: number;
      jaNoEstoque: number;
      semImei: number;
      semSaldo: number;
      semCusto: number;
      aviso?: string;
    }>(`${this.apiUrl}/importar-bling`, {});
  }

  comprar(body: {
    aparelho: AparelhoEntradaPayload;
    valorPago: number;
    clienteId?: number | null;
    fornecedorNome?: string;
    observacoes?: string;
    sessaoToken?: string;
  }): Observable<AparelhoLojaPainel> {
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/compra`, body);
  }

  vender(body: {
    aparelhoId: string;
    clienteId: number;
    preco: number;
    precoTabela?: number;
    desconto?: number;
    acrescimo?: number;
    forma?: string;
    financiadoraNome?: string;
    entradaLoja?: number;
    repasse?: number;
    observacoes?: string;
  }): Observable<AparelhoLojaPainel> {
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/venda`, body);
  }

  trocar(body: {
    aparelhoSaidaId: string;
    precoSaida: number;
    precoTabela?: number;
    desconto?: number;
    acrescimo?: number;
    entrada?: AparelhoEntradaPayload;
    entradas?: { aparelho: AparelhoEntradaPayload; valorAvaliado: number; sessaoToken?: string }[];
    valorAvaliado: number;
    sentidoDiferenca?: string;
    diferencaInformada?: number;
    forma?: string;
    financiadoraNome?: string;
    entradaLoja?: number;
    repasse?: number;
    clienteId: number;
    observacoes?: string;
    sessaoToken?: string;
  }): Observable<AparelhoLojaPainel> {
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/troca`, body);
  }

  liberar(id: string): Observable<AparelhoLojaPainel> {
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/${id}/liberar`, {});
  }

  estornar(id: string): Observable<AparelhoLojaPainel> {
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/operacoes/${id}/estornar`, {});
  }

  consultarOs(numero: string): Observable<OsAbertaConsulta> {
    return this.http.get<OsAbertaConsulta>(`${this.apiUrl}/os`, { params: { numero } });
  }

  criarSessaoFotos(aparelhoId?: string): Observable<{ token: string; url: string; expiraEm: string }> {
    const urlApp = obterUrlAppIntake();
    const params: Record<string, string> = {};
    if (urlApp) params['appUrl'] = urlApp;
    if (aparelhoId) params['aparelhoId'] = aparelhoId;
    return this.http.post<{ token: string; url: string; expiraEm: string }>(
      `${this.apiUrl}/fotos-sessao`,
      null,
      { params },
    );
  }

  sessaoFotos(token: string): Observable<{ fotos: { id: string; url: string; tipo?: string }[] }> {
    return this.http.get<{ fotos: { id: string; url: string; tipo?: string }[] }>(
      `${environment.apiUrl}/aparelho-fotos/${token}`,
      { context: new HttpContext().set(SKIP_GLOBAL_ERROR_ALERT, true) },
    );
  }

  enviarFotoSessao(token: string, arquivo: File): Observable<{ id: string; url: string; tipo?: string }> {
    const form = new FormData();
    const video = arquivo.type.startsWith('video/');
    form.append('arquivo', arquivo, arquivo.name?.trim() || (video ? `video-${Date.now()}.mp4` : `foto-${Date.now()}.jpg`));
    return this.http.post<{ id: string; url: string; tipo?: string }>(
      `${environment.apiUrl}/aparelho-fotos/${token}`,
      form,
      { context: new HttpContext().set(SKIP_GLOBAL_ERROR_ALERT, true) },
    );
  }

  fotos(id: string, arquivos: File[]): Observable<AparelhoLojaPainel> {
    const form = new FormData();
    for (const arquivo of arquivos) form.append('arquivos', arquivo, arquivo.name);
    return this.http.post<AparelhoLojaPainel>(`${this.apiUrl}/${id}/fotos`, form);
  }
}
