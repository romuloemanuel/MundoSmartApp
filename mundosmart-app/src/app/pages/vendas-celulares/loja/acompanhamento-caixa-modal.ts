import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AparelhoEstoqueMetrica } from '../../../services/aparelho-loja.service';

type SerieId =
  | 'caixaEntrou'
  | 'saldoCaixa'
  | 'custo'
  | 'valorVenda'
  | 'lucroEstoque'
  | 'lucroRealizado'
  | 'custoAssistencia'
  | 'orcamentoAssistencia'
  | 'capitalGiro';

type Recorte = 'dia' | 'semana' | 'quinzena';

interface SerieOpcao {
  id: SerieId;
  nome: string;
  cor: string;
}

interface PontoGrafico {
  rotulo: string;
  dia: string;
  valores: Record<SerieId, number>;
}

const CHAVE_SERIES = 'mundosmart.acompanhamento.series';
const CHAVE_RECORTE = 'mundosmart.acompanhamento.recorte';
const LARGURA = 760;
const ALTURA = 300;
const PAD = { l: 62, r: 18, t: 18, b: 40 };
const MAX_SERIES = 3;

@Component({
  selector: 'app-acompanhamento-caixa-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="fechar.emit()">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="titulo-acompanhamento" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 id="titulo-acompanhamento">Comparar no mês</h3>
          <button type="button" class="modal-close" (click)="fechar.emit()" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">
          <p class="hint">Escolha até 3 linhas para comparar em ondas. O recorte junta os dias em semana ou quinzena.</p>
          <div class="topo">
            <label>
              Mês
              <input type="month" [(ngModel)]="mes" (ngModelChange)="pintar()" name="mesAcompanhamento" />
            </label>
            <div class="recorte">
              <button type="button" *ngFor="let r of recortes" [class.ativo]="recorte === r.id" (click)="escolherRecorte(r.id)">{{ r.nome }}</button>
            </div>
          </div>
          <div class="series">
            <label
              *ngFor="let s of opcoes"
              [class.ativa]="ativa(s.id)"
              [class.cheia]="!ativa(s.id) && escolhidas.size >= maxSeries"
              [style.--cor]="s.cor"
            >
              <input type="checkbox" [checked]="ativa(s.id)" (change)="alternar(s.id)" [disabled]="!ativa(s.id) && escolhidas.size >= maxSeries" />
              <span class="bolinha"></span>
              {{ s.nome }}
            </label>
          </div>
          <p class="aviso" *ngIf="escolhidas.size >= maxSeries">Já há 3 no gráfico. Tire uma para colocar outra.</p>
          <p class="hint" *ngIf="pontos.length < 2">Ainda há {{ pontos.length === 1 ? 'só um ponto' : 'nenhum ponto' }} neste recorte. O gráfico enche conforme os dias passam.</p>
          <div class="grafico" *ngIf="pontos.length">
            <svg [attr.viewBox]="'0 0 ' + largura + ' ' + altura" role="img" aria-label="Gráfico de ondas">
              <defs>
                <linearGradient *ngFor="let o of ondas" [attr.id]="'onda-' + o.id" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" [attr.stop-color]="o.cor" stop-opacity="0.42" />
                  <stop offset="100%" [attr.stop-color]="o.cor" stop-opacity="0.04" />
                </linearGradient>
              </defs>
              <line *ngFor="let g of grades" [attr.x1]="pad.l" [attr.x2]="largura - pad.r" [attr.y1]="g.y" [attr.y2]="g.y" class="grade" />
              <text *ngFor="let g of grades" [attr.x]="pad.l - 8" [attr.y]="g.y + 4" class="eixo">{{ g.rotulo }}</text>
              <ng-container *ngFor="let o of ondas">
                <path [attr.d]="o.area" [attr.fill]="'url(#onda-' + o.id + ')'" />
                <path [attr.d]="o.linha" fill="none" [attr.stroke]="o.cor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" />
              </ng-container>
              <text *ngFor="let x of eixosX" [attr.x]="x.x" [attr.y]="altura - 12" class="eixo x">{{ x.rotulo }}</text>
            </svg>
          </div>
          <table class="mini" *ngIf="pontos.length && seriesAtivas.length">
            <thead>
              <tr>
                <th>{{ rotuloRecorte }}</th>
                <th *ngFor="let s of seriesAtivas">{{ s.nome }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of pontos">
                <td>{{ p.rotulo }}</td>
                <td *ngFor="let s of seriesAtivas">{{ dinheiro(p.valores[s.id]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 10120;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-box {
      background: #fff; border-radius: 12px; width: 100%; max-width: min(980px, 96vw); max-height: 92vh;
      display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25); overflow: hidden;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; background: #0d0d0d; color: #fff;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #fff; }
    .modal-close { background: transparent; border: 0; color: rgba(255,255,255,0.75); font-size: 18px; cursor: pointer; }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .hint { color: #64748b; font-size: 13px; margin: 0 0 12px; line-height: 1.45; }
    .aviso { color: #b45309; font-size: 13px; margin: 0 0 10px; }
    .topo { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; margin: 0 0 12px; }
    .topo label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #334155; }
    .topo input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
    .recorte { display: flex; gap: 6px; }
    .recorte button {
      padding: 8px 12px; border: 1px solid #cbd5e1; background: #fff; border-radius: 8px;
      font-size: 13px; font-weight: 600; cursor: pointer; color: #334155;
    }
    .recorte button.ativo { background: #1e3a8a; color: #fff; border-color: #1e3a8a; }
    .series { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 10px; }
    .series label {
      display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid #e2e8f0;
      border-radius: 999px; font-size: 13px; cursor: pointer; background: #f8fafc;
    }
    .series label.ativa { border-color: var(--cor); background: #fff; }
    .series label.cheia { opacity: 0.45; cursor: not-allowed; }
    .bolinha { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--cor); }
    .grafico { border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px; background: #f8fafc; margin-bottom: 14px; }
    svg { width: 100%; height: auto; display: block; }
    .grade { stroke: #e2e8f0; stroke-width: 1; }
    .eixo { fill: #64748b; font-size: 11px; text-anchor: end; }
    .eixo.x { text-anchor: middle; }
    .mini { width: 100%; border-collapse: collapse; font-size: 13px; }
    .mini th, .mini td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .mini th { color: #475569; font-weight: 700; }
  `],
})
export class AcompanhamentoCaixaModal implements OnInit {
  @Input() historico: AparelhoEstoqueMetrica[] = [];
  @Output() fechar = new EventEmitter<void>();

  readonly largura = LARGURA;
  readonly altura = ALTURA;
  readonly pad = PAD;
  readonly maxSeries = MAX_SERIES;
  readonly recortes: { id: Recorte; nome: string }[] = [
    { id: 'dia', nome: 'Dia' },
    { id: 'semana', nome: 'Semana' },
    { id: 'quinzena', nome: 'Quinzena' },
  ];
  readonly opcoes: SerieOpcao[] = [
    { id: 'caixaEntrou', nome: 'Caixa que entrou', cor: '#16a34a' },
    { id: 'saldoCaixa', nome: 'Saldo de caixa', cor: '#2563eb' },
    { id: 'custo', nome: 'Custo em estoque', cor: '#7c3aed' },
    { id: 'valorVenda', nome: 'Valor de venda', cor: '#ea580c' },
    { id: 'lucroEstoque', nome: 'Lucro em estoque', cor: '#0891b2' },
    { id: 'lucroRealizado', nome: 'Lucro realizado', cor: '#0f766e' },
    { id: 'custoAssistencia', nome: 'Parados na AT', cor: '#b45309' },
    { id: 'orcamentoAssistencia', nome: 'Orçamento na AT', cor: '#db2777' },
    { id: 'capitalGiro', nome: 'Capital de giro', cor: '#0f172a' },
  ];

  mes = '';
  recorte: Recorte = 'dia';
  escolhidas = new Set<SerieId>(['caixaEntrou', 'saldoCaixa', 'custo']);

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const agora = new Date();
    this.mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_SERIES) || '[]') as SerieId[];
      if (Array.isArray(salvo) && salvo.length) this.escolhidas = new Set(salvo.slice(0, MAX_SERIES));
      const recorte = localStorage.getItem(CHAVE_RECORTE) as Recorte | null;
      if (recorte === 'dia' || recorte === 'semana' || recorte === 'quinzena') this.recorte = recorte;
    } catch {
      /* ignora */
    }
  }

  @HostListener('document:keydown.escape')
  noEsc(): void {
    this.fechar.emit();
  }

  get rotuloRecorte(): string {
    if (this.recorte === 'semana') return 'Semana';
    if (this.recorte === 'quinzena') return 'Quinzena';
    return 'Dia';
  }

  ativa(id: SerieId): boolean {
    return this.escolhidas.has(id);
  }

  alternar(id: SerieId): void {
    if (this.escolhidas.has(id)) this.escolhidas.delete(id);
    else if (this.escolhidas.size < MAX_SERIES) this.escolhidas.add(id);
    localStorage.setItem(CHAVE_SERIES, JSON.stringify([...this.escolhidas]));
    this.pintar();
  }

  escolherRecorte(recorte: Recorte): void {
    this.recorte = recorte;
    localStorage.setItem(CHAVE_RECORTE, recorte);
    this.pintar();
  }

  pintar(): void {
    this.cdr.markForCheck();
  }

  get seriesAtivas(): SerieOpcao[] {
    return this.opcoes.filter(s => this.escolhidas.has(s.id));
  }

  get pontos(): PontoGrafico[] {
    const [ano, mes] = this.mes.split('-').map(Number);
    if (!ano || !mes) return [];
    const dias = [...this.historico]
      .filter(p => {
        const d = new Date(p.dia);
        return d.getUTCFullYear() === ano && d.getUTCMonth() + 1 === mes;
      })
      .sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());
    const grupos = new Map<string, AparelhoEstoqueMetrica[]>();
    for (const p of dias) {
      const chave = this.chaveGrupo(p.dia, ano, mes);
      const lista = grupos.get(chave) ?? [];
      lista.push(p);
      grupos.set(chave, lista);
    }
    return [...grupos.entries()].map(([chave, lista]) => {
      const ultimo = lista[lista.length - 1];
      const valores = {} as Record<SerieId, number>;
      for (const s of this.opcoes) valores[s.id] = this.valorDe(ultimo, s.id);
      return { rotulo: this.rotuloGrupo(chave, lista[0].dia), dia: ultimo.dia, valores };
    });
  }

  get ondas(): { id: SerieId; cor: string; linha: string; area: string }[] {
    const pts = this.pontos;
    const series = this.seriesAtivas;
    if (!pts.length || !series.length) return [];
    const valores = series.flatMap(s => pts.map(p => p.valores[s.id]));
    const max = Math.max(0, ...valores);
    const min = Math.min(0, ...valores);
    const span = max - min || 1;
    const innerW = LARGURA - PAD.l - PAD.r;
    const innerH = ALTURA - PAD.t - PAD.b;
    const yBase = PAD.t + innerH - ((0 - min) / span) * innerH;
    return series.map(s => {
      const coords = pts.map((p, i) => ({
        x: PAD.l + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW),
        y: PAD.t + innerH - ((p.valores[s.id] - min) / span) * innerH,
      }));
      const linha = this.curva(coords);
      const primeiro = coords[0];
      const ultimo = coords[coords.length - 1];
      const area = `${linha} L ${ultimo.x} ${yBase} L ${primeiro.x} ${yBase} Z`;
      return { id: s.id, cor: s.cor, linha, area };
    });
  }

  get grades(): { y: number; rotulo: string }[] {
    const pts = this.pontos;
    const series = this.seriesAtivas;
    const valores = series.length ? series.flatMap(s => pts.map(p => p.valores[s.id])) : [0];
    const max = Math.max(0, ...valores);
    const min = Math.min(0, ...valores);
    const span = max - min || 1;
    const innerH = ALTURA - PAD.t - PAD.b;
    return [0, 0.5, 1].map(t => {
      const v = min + span * (1 - t);
      return { y: PAD.t + innerH * t, rotulo: this.dinheiroCurto(v) };
    });
  }

  get eixosX(): { x: number; rotulo: string }[] {
    const pts = this.pontos;
    if (!pts.length) return [];
    const innerW = LARGURA - PAD.l - PAD.r;
    const passo = pts.length <= 8 ? 1 : Math.ceil(pts.length / 8);
    return pts
      .map((p, i) => ({
        x: PAD.l + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW),
        rotulo: p.rotulo,
        i,
      }))
      .filter(p => p.i % passo === 0 || p.i === pts.length - 1);
  }

  private chaveGrupo(iso: string, ano: number, mes: number): string {
    const d = new Date(iso);
    const dia = d.getUTCDate();
    if (this.recorte === 'quinzena') return `${ano}-${mes}-${dia <= 15 ? '1' : '2'}`;
    if (this.recorte === 'semana') {
      const inicio = Date.UTC(ano, mes - 1, 1);
      const atual = Date.UTC(ano, mes - 1, dia);
      const semana = Math.floor((atual - inicio) / (7 * 24 * 60 * 60 * 1000)) + 1;
      return `${ano}-${mes}-s${semana}`;
    }
    return iso.slice(0, 10);
  }

  private rotuloGrupo(chave: string, iso: string): string {
    if (this.recorte === 'quinzena') return chave.endsWith('-1') ? '1ª quinzena' : '2ª quinzena';
    if (this.recorte === 'semana') {
      const n = chave.split('-s')[1];
      return `Sem. ${n}`;
    }
    return this.dataCurta(iso);
  }

  private curva(coords: { x: number; y: number }[]): string {
    if (!coords.length) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    if (coords.length === 2) return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`;
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] ?? coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  valorDe(p: AparelhoEstoqueMetrica, id: SerieId): number {
    switch (id) {
      case 'caixaEntrou': return Number(p.caixaEntrou) || 0;
      case 'saldoCaixa': return Number(p.saldoCaixa) || 0;
      case 'custo': return Number(p.custo) || 0;
      case 'valorVenda': return Number(p.valorVenda) || 0;
      case 'lucroEstoque': return Number(p.lucroEstoque) || 0;
      case 'lucroRealizado': return Number(p.lucroRealizado) || 0;
      case 'custoAssistencia': return (Number(p.custoAssistencia) || 0) + (Number(p.orcamentoAssistencia) || 0);
      case 'orcamentoAssistencia': return Number(p.orcamentoAssistencia) || 0;
      case 'capitalGiro':
        return (Number(p.saldoCaixa) || 0)
          + (Number(p.custo) || 0)
          + (Number(p.custoAssistencia) || 0)
          + (Number(p.orcamentoAssistencia) || 0);
    }
  }

  dataCurta(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  }

  dinheiro(valor?: number | null): string {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  dinheiroCurto(valor: number): string {
    const n = Math.abs(valor);
    if (n >= 1000) return `${valor < 0 ? '-' : ''}R$ ${Math.round(n / 100) / 10} mil`;
    return this.dinheiro(valor);
  }
}
