import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ControleCustoSetor {
  id: string;
  nome: string;
  origem?: string;
  faturamento: number;
  custos: number;
  lucro: number;
  reinvestimento: number;
  disponivel: number;
}

export interface ControleCustoColaborador {
  id?: string;
  nome: string;
  cargo?: string | null;
  setores: string[];
  ativo: boolean;
}

export interface ControleCustoRateio {
  setor: string;
  percentual: number;
}

export interface ControleCustoLancamento {
  id?: string;
  competencia: string;
  tipo: string;
  categoria?: string | null;
  colaboradorId?: string | null;
  colaboradorNome?: string | null;
  descricao: string;
  valor: number;
  recorrencia?: string | null;
  meses?: number | null;
  valorNoMes?: number;
  parcela?: number | null;
  totalParcelas?: number | null;
  setor?: string | null;
  rateio: ControleCustoRateio[];
}

export interface ControleCustoPainel {
  competencia: string;
  setores: ControleCustoSetor[];
  colaboradores: ControleCustoColaborador[];
  custos: ControleCustoLancamento[];
  reinvestimentos: ControleCustoLancamento[];
  faturamento: number;
  custosTotal: number;
  lucro: number;
  reinvestimento: number;
  disponivel: number;
}

export interface ControleCustoComparativoLinha {
  id: string;
  nome: string;
  grupo: string;
  valores: number[];
  saldo?: number;
}

export interface ControleCustoComparativo {
  ate: string;
  meses: string[];
  linhas: ControleCustoComparativoLinha[];
}

export interface ControleCustoPrevisaoParcela {
  mes: string;
  numero: number;
  total: number;
  valor: number;
}

export interface ControleCustoPrevisaoConta {
  id: string;
  nome: string;
  categoria: string;
  recorrencia: string;
  topicos: string[];
  valorTotal: number;
  valorMensal: number;
  inicio: string;
  fim?: string | null;
  saldo: number;
  parcelas: ControleCustoPrevisaoParcela[];
}

export interface ControleCustoPrevisao {
  inicio: string;
  meses: string[];
  limitada: boolean;
  totalAQuitar: number;
  quitacao?: string | null;
  linhas: ControleCustoComparativoLinha[];
  contas: ControleCustoPrevisaoConta[];
}

export const SETORES_CUSTO: { id: string; nome: string }[] = [
  { id: 'brindes-online', nome: 'Brindes/Online' },
  { id: 'loja', nome: 'Loja' },
  { id: 'assistencia', nome: 'Assistência' },
  { id: 'smartphones', nome: 'Venda/Troca Smartphones' },
];

export const RECORRENCIAS_CUSTO: { id: string; nome: string; dica: string }[] = [
  { id: 'unico', nome: 'Único', dica: 'Entra só no mês de início.' },
  { id: 'fixo', nome: 'Fixo', dica: 'O mesmo valor todo mês, sem prazo para acabar.' },
  { id: 'parcelado', nome: 'Parcelado', dica: 'O valor total dividido pela quantidade de meses.' },
  { id: 'anual', nome: 'Anual', dica: 'Uma vez por ano, pela quantidade de anos.' },
];

export const CATEGORIAS_CUSTO: { id: string; nome: string }[] = [
  { id: 'colaborador', nome: 'Colaborador' },
  { id: 'energia', nome: 'Energia' },
  { id: 'agua', nome: 'Água' },
  { id: 'aluguel', nome: 'Aluguel' },
  { id: 'trafego-pago', nome: 'Tráfego pago' },
  { id: 'infraestrutura', nome: 'Infraestrutura' },
  { id: 'outro', nome: 'Outro' },
];

@Injectable({ providedIn: 'root' })
export class ControleCustoService {
  private readonly apiUrl = `${environment.apiUrl}/controle-custo`;

  constructor(private http: HttpClient) {}

  painel(competencia: string): Observable<ControleCustoPainel> {
    const params = new HttpParams().set('competencia', competencia);
    return this.http.get<ControleCustoPainel>(`${this.apiUrl}/painel`, { params });
  }

  comparativo(ate: string, quantidade = 6): Observable<ControleCustoComparativo> {
    const params = new HttpParams().set('ate', ate).set('quantidade', quantidade);
    return this.http.get<ControleCustoComparativo>(`${this.apiUrl}/comparativo`, { params });
  }

  previsao(): Observable<ControleCustoPrevisao> {
    return this.http.get<ControleCustoPrevisao>(`${this.apiUrl}/previsao`);
  }

  contasFixas(): Observable<ControleCustoLancamento[]> {
    return this.http.get<ControleCustoLancamento[]>(`${this.apiUrl}/contas-fixas`);
  }

  salvarFaturamento(competencia: string, setor: string, valor: number): Observable<ControleCustoPainel> {
    return this.http.put<ControleCustoPainel>(`${this.apiUrl}/faturamento`, { competencia, setor, valor });
  }

  lancarCusto(body: {
    competencia: string;
    categoria: string;
    colaboradorId?: string;
    descricao: string;
    valor: number;
    recorrencia: string;
    meses?: number;
    rateio: ControleCustoRateio[];
  }): Observable<ControleCustoPainel> {
    return this.http.post<ControleCustoPainel>(`${this.apiUrl}/custos`, body);
  }

  atualizarCusto(id: string, competenciaVista: string, body: {
    competencia: string;
    categoria: string;
    colaboradorId?: string;
    descricao: string;
    valor: number;
    recorrencia: string;
    meses?: number;
    rateio: ControleCustoRateio[];
  }): Observable<ControleCustoPainel> {
    const params = new HttpParams().set('competencia', competenciaVista);
    return this.http.put<ControleCustoPainel>(`${this.apiUrl}/custos/${id}`, body, { params });
  }

  lancarReinvestimento(body: {
    competencia: string;
    setor: string;
    descricao: string;
    valor: number;
    recorrencia?: string;
    meses?: number;
  }): Observable<ControleCustoPainel> {
    return this.http.post<ControleCustoPainel>(`${this.apiUrl}/reinvestimentos`, body);
  }

  excluirLancamento(id: string, competencia: string): Observable<ControleCustoPainel> {
    const params = new HttpParams().set('competencia', competencia);
    return this.http.delete<ControleCustoPainel>(`${this.apiUrl}/lancamentos/${id}`, { params });
  }

  salvarColaborador(body: {
    id?: string;
    nome: string;
    cargo?: string;
    setores: string[];
    competencia: string;
  }): Observable<ControleCustoPainel> {
    const payload = { nome: body.nome, cargo: body.cargo ?? '', setores: body.setores, competencia: body.competencia };
    return body.id
      ? this.http.put<ControleCustoPainel>(`${this.apiUrl}/colaboradores/${body.id}`, payload)
      : this.http.post<ControleCustoPainel>(`${this.apiUrl}/colaboradores`, payload);
  }

  excluirColaborador(id: string, competencia: string): Observable<ControleCustoPainel> {
    const params = new HttpParams().set('competencia', competencia);
    return this.http.delete<ControleCustoPainel>(`${this.apiUrl}/colaboradores/${id}`, { params });
  }
}
