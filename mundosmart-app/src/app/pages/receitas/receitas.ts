import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridAcao } from '../../components/grid-acao/grid-acao';
import {
  ReceitaBlingVenda,
  ReceitaFaixa,
  ReceitaPainel,
  ReceitaPeriodo,
  ReceitasService,
} from '../../services/receitas.service';

type CategoriaId = 'bling' | 'celulares' | 'assistencia';
type LeituraId = 'bruto' | 'depoisItem' | 'resultado';

interface Categoria {
  id: CategoriaId;
  nome: string;
  cor: string;
  explicacao: string;
}

interface Leitura {
  id: LeituraId;
  nome: string;
  cor: string;
}

interface Barra {
  x: number;
  y: number;
  w: number;
  h: number;
  cor: string;
  titulo: string;
}

interface Ponto {
  x: number;
  y: number;
}

const FAIXA_VAZIA: ReceitaFaixa = { bruto: 0, custoItem: 0, custoLoja: 0, quantidade: 0 };

@Component({
  selector: 'app-receitas',
  standalone: true,
  imports: [CommonModule, FormsModule, GridAcao],
  template: `
    <div class="page-header">
      <h1>Receitas</h1>
    </div>
    <p class="intro">
      Bling, celulares e assistência técnica. Em cada origem, leia nesta ordem:
      o faturamento bruto, o que sobra depois do custo do item, e o que sobra depois também do custo da loja.
    </p>

    <div class="filtros">
      <div class="form-group">
        <label>Recorte</label>
        <select [(ngModel)]="agrupamento" (ngModelChange)="carregar()">
          <option value="mensal">Mensal</option>
          <option value="quinzenal">Quinzenal</option>
          <option value="semanal">Semanal</option>
        </select>
      </div>
      <div class="form-group">
        <label>Quantidade</label>
        <select [(ngModel)]="quantidade" (ngModelChange)="carregar()">
          <option [ngValue]="4">4</option>
          <option [ngValue]="6">6</option>
          <option [ngValue]="12">12</option>
        </select>
      </div>
      <div class="categorias">
        <label *ngFor="let c of categorias" class="chip" [class.ligada]="ligada(c.id)">
          <input type="checkbox" [checked]="ligada(c.id)" (change)="alternar(c.id)" />
          <span class="bolinha" [style.background]="c.cor"></span>
          {{ c.nome }}
        </label>
      </div>
    </div>

    <p class="aviso" *ngIf="aviso">{{ aviso }}</p>
    <p class="erro" *ngIf="erro">{{ erro }}</p>
    <p class="vazio" *ngIf="carregando">Carregando…</p>

    <div class="cards" *ngIf="dados && !carregando && ativas.length">
      <div class="card" *ngFor="let leitura of leituras">
        <div class="card-nome"><span class="bolinha" [style.background]="leitura.cor"></span>{{ leitura.nome }}</div>
        <div class="card-valor">{{ moeda(leituraDe(ultimo, leitura.id)) }}</div>
        <div class="card-comp" [class.sobe]="leituraDe(ultimo, leitura.id) > leituraDe(penultimo, leitura.id)" [class.desce]="leituraDe(ultimo, leitura.id) < leituraDe(penultimo, leitura.id)">
          {{ textoVariacao(leituraDe(ultimo, leitura.id), leituraDe(penultimo, leitura.id)) }} vs {{ penultimo?.rotulo || 'anterior' }}
        </div>
        <div class="card-quebra">
          <span *ngFor="let c of ativas">{{ c.nome }} {{ moeda(leituraFaixa(faixa(ultimo, c.id), leitura.id)) }}</span>
        </div>
      </div>
    </div>

    <section class="painel conta" *ngIf="dados && !carregando && ativas.length && ultimo">
      <h2>Como se chega no número · {{ ultimo.rotulo }}</h2>
      <p class="legenda-grafico">Soma só das origens ligadas. O custo do item sai primeiro. O custo da loja sai em seguida.</p>
      <ol class="escada">
        <li>
          <span>Faturamento bruto</span>
          <strong>{{ moeda(somaFaixa(ultimo).bruto) }}</strong>
        </li>
        <li class="menos">
          <span>Custo do item</span>
          <strong>− {{ moeda(somaFaixa(ultimo).custoItem) }}</strong>
        </li>
        <li class="igual">
          <span>Bruto − custo do item</span>
          <strong>{{ moeda(depoisItem(somaFaixa(ultimo))) }}</strong>
        </li>
        <li class="menos">
          <span>Custo da loja</span>
          <strong>− {{ moeda(somaFaixa(ultimo).custoLoja) }}</strong>
        </li>
        <li class="igual final">
          <span>Bruto − custo do item − custo da loja</span>
          <strong>{{ moeda(resultado(somaFaixa(ultimo))) }}</strong>
        </li>
      </ol>
      <p class="info" *ngIf="ligada('celulares') && (ultimo.celularesEstoqueEntrou || 0) > 0">
        Neste período entrou {{ moeda(ultimo.celularesEstoqueEntrou) }} em aparelho de troca.
        Esse valor ficou no estoque. Não entra no faturamento.
      </p>
    </section>

    <p class="vazio" *ngIf="dados && !carregando && !ativas.length">Ligue ao menos uma origem para ver os números.</p>

    <section class="painel" *ngIf="dados && !carregando && ativas.length">
      <h2>As três leituras no tempo</h2>
      <p class="legenda-grafico">Cada linha é a soma das origens ligadas. A distância entre elas é o custo que saiu.</p>
      <svg [attr.viewBox]="'0 0 ' + linhas.w + ' ' + linhas.h" class="grafico" role="img" aria-label="Bruto, depois do item e resultado">
        <line [attr.x1]="linhas.padL" [attr.x2]="linhas.w - 8" [attr.y1]="linhas.zero" [attr.y2]="linhas.zero" class="zero" />
        <line *ngFor="let g of linhas.grades" [attr.x1]="linhas.padL" [attr.x2]="linhas.w - 8" [attr.y1]="g.y" [attr.y2]="g.y" class="grade" />
        <text *ngFor="let g of linhas.grades" [attr.x]="4" [attr.y]="g.y + 4" class="eixo">{{ g.texto }}</text>
        <polyline *ngFor="let l of linhas.series" [attr.points]="l.pontos" fill="none" [attr.stroke]="l.cor" stroke-width="2.5" />
        <circle *ngFor="let p of linhas.pontos" [attr.cx]="p.x" [attr.cy]="p.y" r="3.5" [attr.fill]="p.cor">
          <title>{{ p.titulo }}</title>
        </circle>
        <text *ngFor="let r of linhas.rotulos" [attr.x]="r.x" [attr.y]="linhas.h - 8" text-anchor="middle" class="eixo">{{ r.texto }}</text>
      </svg>
      <div class="categorias legenda">
        <span *ngFor="let l of leituras"><span class="bolinha" [style.background]="l.cor"></span>{{ l.nome }}</span>
      </div>
    </section>

    <section class="painel" *ngIf="dados && !carregando && ativas.length">
      <h2>Origens lado a lado</h2>
      <div class="leituras">
        <label *ngFor="let l of leituras">
          <input type="radio" name="leitura" [value]="l.id" [(ngModel)]="leituraGrafico" />
          {{ l.nome }}
        </label>
      </div>
      <p class="legenda-grafico">Cada grupo é um período. As barras são as origens ligadas, na leitura escolhida.</p>
      <svg [attr.viewBox]="'0 0 ' + barras.w + ' ' + barras.h" class="grafico" role="img" aria-label="Origens por período">
        <line [attr.x1]="barras.padL" [attr.x2]="barras.w - 8" [attr.y1]="barras.zero" [attr.y2]="barras.zero" class="zero" />
        <line *ngFor="let g of barras.grades" [attr.x1]="barras.padL" [attr.x2]="barras.w - 8" [attr.y1]="g.y" [attr.y2]="g.y" class="grade" />
        <text *ngFor="let g of barras.grades" [attr.x]="4" [attr.y]="g.y + 4" class="eixo">{{ g.texto }}</text>
        <rect *ngFor="let b of barras.itens" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" [attr.fill]="b.cor" rx="2">
          <title>{{ b.titulo }}</title>
        </rect>
        <text *ngFor="let r of barras.rotulos" [attr.x]="r.x" [attr.y]="barras.h - 8" text-anchor="middle" class="eixo">{{ r.texto }}</text>
      </svg>
    </section>

    <section class="painel" *ngIf="dados && !carregando && ativas.length">
      <h2>Tabela</h2>
      <p class="legenda-grafico">A variação é do resultado contra o período anterior, na mesma origem.</p>
      <div class="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Período</th>
              <th>Origem</th>
              <th>Faturamento bruto</th>
              <th>Custo do item</th>
              <th>Bruto − item</th>
              <th>Custo da loja</th>
              <th>Bruto − item − loja</th>
              <th>Vs anterior</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let p of dados.periodos; let i = index">
              <tr *ngFor="let c of ativas">
                <td>{{ c === ativas[0] ? p.rotulo : '' }}</td>
                <td><span class="bolinha" [style.background]="c.cor"></span> {{ c.nome }}</td>
                <td>{{ moeda(faixa(p, c.id).bruto) }}</td>
                <td>{{ moeda(faixa(p, c.id).custoItem) }}</td>
                <td>{{ moeda(depoisItem(faixa(p, c.id))) }}</td>
                <td>{{ moeda(faixa(p, c.id).custoLoja) }}</td>
                <td>{{ moeda(resultado(faixa(p, c.id))) }}</td>
                <td [class.sobe]="i > 0 && resultado(faixa(p, c.id)) > resultado(faixa(dados.periodos[i - 1], c.id))" [class.desce]="i > 0 && resultado(faixa(p, c.id)) < resultado(faixa(dados.periodos[i - 1], c.id))">
                  {{ i === 0 ? '—' : textoVariacao(resultado(faixa(p, c.id)), resultado(faixa(dados.periodos[i - 1], c.id))) }}
                </td>
              </tr>
              <tr class="total-linha">
                <td></td>
                <td>Total</td>
                <td>{{ moeda(somaFaixa(p).bruto) }}</td>
                <td>{{ moeda(somaFaixa(p).custoItem) }}</td>
                <td>{{ moeda(depoisItem(somaFaixa(p))) }}</td>
                <td>{{ moeda(somaFaixa(p).custoLoja) }}</td>
                <td>{{ moeda(resultado(somaFaixa(p))) }}</td>
                <td [class.sobe]="i > 0 && resultado(somaFaixa(p)) > resultado(somaFaixa(dados.periodos[i - 1]))" [class.desce]="i > 0 && resultado(somaFaixa(p)) < resultado(somaFaixa(dados.periodos[i - 1]))">
                  {{ i === 0 ? '—' : textoVariacao(resultado(somaFaixa(p)), resultado(somaFaixa(dados.periodos[i - 1]))) }}
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>
    </section>

    <section class="painel" *ngIf="dados && !carregando">
      <h2>Vendas do Bling</h2>
      <p class="legenda-grafico">
        Tire do relatório a venda que não deve contar — ela não volta. Informe o custo do item e o custo da loja quando o Bling não trouxer.
      </p>
      <div class="filtros">
        <div class="form-group">
          <label>Período</label>
          <select [(ngModel)]="periodoBlingChave" (ngModelChange)="carregarBling()">
            <option *ngFor="let p of dados.periodos" [ngValue]="p.chave">{{ p.rotulo }}</option>
          </select>
        </div>
      </div>
      <p class="aviso" *ngIf="avisoBlingLista">{{ avisoBlingLista }}</p>
      <p class="erro" *ngIf="erroBling">{{ erroBling }}</p>
      <p class="vazio" *ngIf="carregandoBling">Carregando vendas…</p>
      <div class="tabela-wrap" *ngIf="!carregandoBling">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
              <th>Cliente</th>
              <th>Faturamento</th>
              <th>Custo do item</th>
              <th>Custo da loja</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of vendasBling">
              <td>{{ v.numero || v.pedidoId }}</td>
              <td>{{ dataBr(v.data) }}</td>
              <td>{{ v.clienteNome || '—' }}</td>
              <td>{{ moeda(v.bruto) }}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  [(ngModel)]="v.custoItem"
                  [name]="'custoItem' + v.pedidoId"
                  [disabled]="salvandoId === v.pedidoId"
                />
                <span class="editado" *ngIf="v.custoItemEditado">editado</span>
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  [(ngModel)]="v.custoLoja"
                  [name]="'custoLoja' + v.pedidoId"
                  [disabled]="salvandoId === v.pedidoId"
                />
                <span class="editado" *ngIf="v.custoLojaEditado">editado</span>
              </td>
              <td class="acoes">
                <app-grid-acao
                  tipo="editar"
                  titulo="Salvar custos desta venda"
                  [disabled]="salvandoId === v.pedidoId"
                  (acao)="salvarCustos(v)"
                />
                <app-grid-acao
                  tipo="excluir"
                  titulo="Tirar esta venda dos relatórios"
                  [disabled]="salvandoId === v.pedidoId"
                  (acao)="excluirVenda(v)"
                />
              </td>
            </tr>
            <tr *ngIf="!vendasBling.length">
              <td colspan="7">Nenhuma venda do Bling neste período.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ul class="notas" *ngIf="dados && !carregando">
      <li *ngFor="let c of categorias"><strong>{{ c.nome }}.</strong> {{ c.explicacao }}</li>
    </ul>
  `,
  styles: [`
    .intro, .legenda-grafico, .notas, .info { color: #475569; font-size: 14px; }
    .intro { margin: 0 0 16px; max-width: 820px; }
    .filtros, .leituras, .legenda { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; margin-bottom: 16px; }
    .legenda { align-items: center; gap: 14px; margin-top: 8px; font-size: 13px; color: #475569; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label, .leituras label { font-size: 12px; font-weight: 600; color: #475569; }
    .leituras label { font-size: 14px; font-weight: 500; display: inline-flex; gap: 6px; align-items: center; }
    select { height: 36px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 8px; background: #fff; }
    .categorias { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #cbd5e1; border-radius: 999px; padding: 6px 12px; background: #fff; cursor: pointer; font-size: 14px; }
    .chip.ligada { border-color: #0f172a; background: #f8fafc; }
    .chip input { margin: 0; }
    .bolinha { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .aviso { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; padding: 10px 12px; border-radius: 8px; }
    .erro { color: #b91c1c; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 16px 0; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
    .card-nome { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; }
    .card-valor { font-size: 22px; font-weight: 700; margin: 6px 0 2px; }
    .card-comp, .card-quebra { font-size: 13px; color: #64748b; }
    .card-quebra { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
    .sobe { color: #047857; }
    .desce { color: #b91c1c; }
    .painel { margin-top: 22px; }
    .painel h2 { font-size: 16px; margin: 0 0 4px; }
    .conta { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
    .escada { list-style: none; margin: 12px 0 0; padding: 0; max-width: 560px; }
    .escada li { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .escada .menos { color: #9a3412; }
    .escada .igual { background: #f8fafc; padding: 8px 10px; border-radius: 8px; border-bottom: none; margin-top: 4px; }
    .escada .final { background: #ecfdf5; }
    .info { margin: 12px 0 0; }
    .grafico { width: 100%; height: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; }
    .grade { stroke: #e2e8f0; stroke-width: 1; }
    .zero { stroke: #94a3b8; stroke-width: 1; }
    .eixo { font-size: 11px; fill: #64748b; }
    .tabela-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; white-space: nowrap; }
    th { font-size: 12px; color: #475569; }
    .total-linha td { font-weight: 700; background: #f8fafc; }
    .notas { padding-left: 18px; max-width: 860px; }
    .notas li { margin-bottom: 8px; }
    td input[type=number] { width: 110px; height: 32px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 8px; }
    .acoes { display: flex; gap: 6px; align-items: center; }
    .editado { display: block; font-size: 11px; color: #0369a1; }
  `],
})
export class ReceitasPage implements OnInit {
  categorias: Categoria[] = [
    {
      id: 'bling',
      nome: 'Bling',
      cor: '#1d4ed8',
      explicacao: 'Faturamento bruto é o total dos pedidos de acessórios e eletrônicos que não foram cancelados e que continuam no relatório. O custo do item e o custo da loja vêm do pedido, ou do valor informado na lista de vendas abaixo.',
    },
    {
      id: 'celulares',
      nome: 'Celulares',
      cor: '#0f766e',
      explicacao: 'Faturamento bruto é só o dinheiro que entrou. Custo do item é o valor de estoque do aparelho que saiu. Custo da loja é o dinheiro devolvido na troca e a peça gasta nesse aparelho. Peça que já entrou na assistência técnica deste recorte não entra de novo. O aparelho que o cliente deixou fica no estoque e não é faturamento.',
    },
    {
      id: 'assistencia',
      nome: 'Assistência técnica',
      cor: '#b45309',
      explicacao: 'Faturamento bruto é o valor cobrado na ordem concluída. Custo do item é o custo da peça, não o preço cobrado dela nem a mão de obra. Custo da loja é o juro. A mão de obra cobrada do cliente fica no bruto.',
    },
  ];

  leituras: Leitura[] = [
    { id: 'bruto', nome: 'Faturamento bruto', cor: '#0f172a' },
    { id: 'depoisItem', nome: 'Bruto − custo do item', cor: '#0369a1' },
    { id: 'resultado', nome: 'Bruto − item − loja', cor: '#047857' },
  ];

  ligadasIds = new Set<CategoriaId>(['bling', 'celulares', 'assistencia']);
  leituraGrafico: LeituraId = 'resultado';
  agrupamento = 'mensal';
  quantidade = 6;
  dados: ReceitaPainel | null = null;
  carregando = false;
  erro = '';
  aviso = '';
  periodoBlingChave = '';
  vendasBling: ReceitaBlingVenda[] = [];
  carregandoBling = false;
  avisoBlingLista = '';
  erroBling = '';
  salvandoId: number | null = null;

  constructor(private receitas: ReceitasService) {}

  ngOnInit(): void {
    this.carregar();
  }

  get ativas(): Categoria[] {
    return this.categorias.filter(c => this.ligadasIds.has(c.id));
  }

  get ultimo(): ReceitaPeriodo | null {
    const lista = this.dados?.periodos ?? [];
    return lista.length ? lista[lista.length - 1] : null;
  }

  get penultimo(): ReceitaPeriodo | null {
    const lista = this.dados?.periodos ?? [];
    return lista.length > 1 ? lista[lista.length - 2] : null;
  }

  ligada(id: CategoriaId): boolean {
    return this.ligadasIds.has(id);
  }

  alternar(id: CategoriaId): void {
    if (this.ligadasIds.has(id)) this.ligadasIds.delete(id);
    else this.ligadasIds.add(id);
    this.ligadasIds = new Set(this.ligadasIds);
  }

  carregar(silencioso = false): void {
    if (!silencioso) this.carregando = true;
    this.erro = '';
    this.receitas.painel(this.agrupamento, this.quantidade).subscribe({
      next: painel => {
        this.dados = painel;
        this.aviso = painel.avisoBling || '';
        this.carregando = false;
        const chaves = painel.periodos.map(p => p.chave);
        if (!chaves.includes(this.periodoBlingChave)) {
          this.periodoBlingChave = this.ultimo?.chave || chaves[chaves.length - 1] || '';
        }
        if (!silencioso) this.carregarBling();
      },
      error: () => {
        this.erro = 'Não foi possível carregar as receitas.';
        this.carregando = false;
      },
    });
  }

  faixa(periodo: ReceitaPeriodo | null, id: CategoriaId): ReceitaFaixa {
    if (!periodo) return FAIXA_VAZIA;
    const faixa = id === 'bling' ? periodo.bling : id === 'celulares' ? periodo.celulares : periodo.assistencia;
    return faixa || FAIXA_VAZIA;
  }

  somaFaixa(periodo: ReceitaPeriodo | null): ReceitaFaixa {
    return this.ativas.reduce((acc, c) => {
      const f = this.faixa(periodo, c.id);
      return {
        bruto: acc.bruto + (f.bruto || 0),
        custoItem: acc.custoItem + (f.custoItem || 0),
        custoLoja: acc.custoLoja + (f.custoLoja || 0),
        quantidade: acc.quantidade + (f.quantidade || 0),
      };
    }, { ...FAIXA_VAZIA });
  }

  depoisItem(faixa: ReceitaFaixa): number {
    return this.centavos((faixa?.bruto || 0) - (faixa?.custoItem || 0));
  }

  resultado(faixa: ReceitaFaixa): number {
    return this.centavos((faixa?.bruto || 0) - (faixa?.custoItem || 0) - (faixa?.custoLoja || 0));
  }

  leituraFaixa(faixa: ReceitaFaixa, leitura: LeituraId): number {
    if (leitura === 'bruto') return faixa?.bruto || 0;
    if (leitura === 'depoisItem') return this.depoisItem(faixa);
    return this.resultado(faixa);
  }

  leituraDe(periodo: ReceitaPeriodo | null, leitura: LeituraId): number {
    return this.leituraFaixa(this.somaFaixa(periodo), leitura);
  }

  textoVariacao(atual: number, anterior: number): string {
    if (!anterior) return atual ? 'sem base anterior' : '0%';
    const p = ((atual - anterior) / Math.abs(anterior)) * 100;
    const sinal = p > 0 ? '+' : '';
    return `${sinal}${p.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
  }

  moeda(valor: number): string {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  dataBr(iso: string): string {
    const partes = (iso || '').split('-');
    if (partes.length !== 3) return iso || '—';
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  carregarBling(): void {
    const periodo = this.dados?.periodos.find(p => p.chave === this.periodoBlingChave);
    if (!periodo) {
      this.vendasBling = [];
      return;
    }
    this.carregandoBling = true;
    this.erroBling = '';
    this.receitas.vendasBling(periodo.inicio, periodo.fim).subscribe({
      next: lista => {
        this.vendasBling = lista.vendas || [];
        this.avisoBlingLista = lista.aviso || '';
        this.carregandoBling = false;
      },
      error: () => {
        this.erroBling = 'Não foi possível carregar as vendas do Bling.';
        this.carregandoBling = false;
      },
    });
  }

  salvarCustos(venda: ReceitaBlingVenda): void {
    this.aplicarBling(venda.pedidoId, {
      custoItem: Number(venda.custoItem) || 0,
      custoLoja: Number(venda.custoLoja) || 0,
    });
  }

  excluirVenda(venda: ReceitaBlingVenda): void {
    if (!confirm('Esta venda sai das receitas, da comissão da loja e dos demais relatórios. Não volta. Continuar?'))
      return;
    this.aplicarBling(venda.pedidoId, { excluida: true });
  }

  private aplicarBling(pedidoId: number, body: { excluida?: boolean; custoItem?: number; custoLoja?: number }): void {
    this.salvandoId = pedidoId;
    this.erroBling = '';
    this.receitas.atualizarBling(pedidoId, body).subscribe({
      next: atual => {
        this.vendasBling = this.vendasBling
          .map(v => v.pedidoId === atual.pedidoId ? atual : v)
          .filter(v => !v.excluida);
        this.salvandoId = null;
        this.carregar(true);
      },
      error: () => {
        this.erroBling = 'Não foi possível atualizar esta venda.';
        this.salvandoId = null;
      },
    });
  }

  get barras() {
    return this.montar(true);
  }

  get linhas() {
    return this.montar(false);
  }

  private montar(modoBarras: boolean) {
    const periodos = this.dados?.periodos ?? [];
    const seriesFonte = modoBarras
      ? this.ativas.map(c => ({
          nome: c.nome,
          cor: c.cor,
          valor: (p: ReceitaPeriodo) => this.leituraFaixa(this.faixa(p, c.id), this.leituraGrafico),
        }))
      : this.leituras.map(l => ({
          nome: l.nome,
          cor: l.cor,
          valor: (p: ReceitaPeriodo) => this.leituraDe(p, l.id),
        }));
    const w = 760;
    const h = 280;
    const padL = 72;
    const padB = 42;
    const padT = 16;
    const plotW = w - padL - 12;
    const plotH = h - padT - padB;
    const valores = periodos.flatMap(p => seriesFonte.map(s => s.valor(p)));
    const max = Math.max(0, ...valores, 1);
    const min = Math.min(0, ...valores);
    const amplitude = Math.max(max - min, 1);
    const yDe = (v: number) => padT + ((max - v) / amplitude) * plotH;
    const zero = yDe(0);
    const grupo = periodos.length ? plotW / periodos.length : plotW;
    const largura = seriesFonte.length ? Math.min(18, (grupo - 20) / seriesFonte.length) : 12;
    const itens: Barra[] = [];
    const series: { cor: string; pontos: string }[] = [];
    const pontos: (Ponto & { cor: string; titulo: string })[] = [];

    seriesFonte.forEach((serie, serieIndex) => {
      const coords: string[] = [];
      periodos.forEach((p, i) => {
        const v = serie.valor(p);
        const yTopo = yDe(Math.max(v, 0));
        const yBase = yDe(Math.min(v, 0));
        const xGrupo = padL + i * grupo;
        const x = modoBarras
          ? xGrupo + (grupo - seriesFonte.length * largura) / 2 + serieIndex * largura
          : xGrupo + grupo / 2;
        if (modoBarras) {
          itens.push({
            x,
            y: yTopo,
            w: Math.max(4, largura - 3),
            h: Math.max(v === 0 ? 0 : 2, yBase - yTopo),
            cor: serie.cor,
            titulo: `${p.rotulo} · ${serie.nome}: ${this.moeda(v)}`,
          });
        } else {
          const y = yDe(v);
          coords.push(`${x},${y}`);
          pontos.push({ x, y, cor: serie.cor, titulo: `${p.rotulo} · ${serie.nome}: ${this.moeda(v)}` });
        }
      });
      if (!modoBarras) series.push({ cor: serie.cor, pontos: coords.join(' ') });
    });

    const grades = [min, min + amplitude / 2, max].map(v => ({
      y: yDe(v),
      texto: this.eixo(v),
    }));
    const rotulos = periodos.map((p, i) => ({
      x: padL + i * grupo + grupo / 2,
      texto: p.rotulo,
    }));
    return { w, h, padL, zero, grades, rotulos, itens, series, pontos };
  }

  private centavos(valor: number): number {
    return Math.round((valor || 0) * 100) / 100;
  }

  private eixo(n: number): string {
    const abs = Math.abs(n);
    const sinal = n < 0 ? '−' : '';
    if (abs >= 1000) {
      return `${sinal}${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    }
    return `${sinal}${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  }
}
