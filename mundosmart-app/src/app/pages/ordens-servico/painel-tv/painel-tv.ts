import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, interval, startWith, switchMap, catchError, of } from 'rxjs';
import { OrdensServicoService } from '../../../services/ordens-servico';
import { BlingOrdemServico } from '../../../models/bling.models';
import {
  formatarTempoDecorrido,
  minutosDesdeEntrada,
  nivelUrgenciaDaOs,
  percentualSla,
  dataBaseUrgenciaOs,
  osTemJustificativaAtraso,
  categoriaPainelTvOs,
  modeloAparelhoOs,
  resumirProblemaOs,
  diasDesde,
  dataRastreioComumOs,
} from '../../../utils/os-painel-tv.util';
import {
  OS_PAINEL_TV_COLUNAS,
  OS_PAINEL_TV_FAIXAS,
  OS_PAINEL_TV_PRAZO_COMUM_DIAS,
  OS_PAINEL_TV_REFRESH_MS,
  OS_PAINEL_TV_RETIRADA_MAX_DIAS,
  OS_PAINEL_TV_SLA_MINUTOS,
  OS_PAINEL_TV_TICK_MS,
  OsPainelTvCategoria,
  OsPainelTvNivel,
} from '../../../config/os-painel-tv.config';
import { LOJAS_OS, LOJAS_OS_FILTRO, normalizarLojaOs, siglaLojaOs } from '../../../config/os-loja.config';

interface CardPainelTv {
  os: BlingOrdemServico;
  minutos: number;
  nivel: OsPainelTvNivel;
  categoria: OsPainelTvCategoria;
  tempoLabel: string;
  percentual: number;
  modelo: string;
  problema: string;
  cliente: string;
  loja: string;
  avisarCliente: boolean;
  diasRastreio: number;
}

@Component({
  selector: 'app-ordens-servico-painel-tv',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="tv-board">
      <header class="tv-header">
        <div class="tv-brand">
          <span class="tv-brand-name">Mundo Smart</span>
          <span class="tv-brand-sub">
            Painel TV · comum até {{ prazoComumDias }}d · retirada até {{ retiradaMaxDias }}d
          </span>
        </div>
        <div class="tv-filtros">
          <button
            type="button"
            class="tv-loja-chip"
            [class.tv-loja-chip--ativo]="filtroLoja === ''"
            (click)="setFiltroLoja('')"
          >Todas</button>
          <button
            type="button"
            *ngFor="let l of lojas"
            class="tv-loja-chip"
            [class.tv-loja-chip--ativo]="filtroLoja === l.codigo"
            (click)="setFiltroLoja(l.codigo)"
          >{{ l.sigla }}</button>
        </div>
        <div class="tv-relogio">
          <span class="tv-hora">{{ agora | date:'HH:mm' }}</span>
          <span class="tv-data">{{ agora | date:'dd/MM/yyyy' }}</span>
          <a class="tv-sair" routerLink="/ordens-servico">Sair do painel</a>
        </div>
      </header>

      <div class="tv-legenda">
        <span *ngFor="let f of faixas" class="tv-legenda-item" [attr.data-nivel]="f.id">
          <i></i>{{ f.label }} · {{ f.descricao }}
        </span>
      </div>

      <p class="tv-status" *ngIf="carregando && !totalVisivel">Carregando OS…</p>
      <p class="tv-status tv-status--erro" *ngIf="erro">{{ erro }}</p>
      <p class="tv-status" *ngIf="!carregando && !erro && !totalVisivel">
        Nenhuma OS para exibir{{ filtroLoja ? ' nesta loja' : '' }}.
      </p>

      <div class="tv-colunas" *ngIf="totalVisivel">
        <section
          *ngFor="let col of colunas"
          class="tv-coluna"
          [attr.data-col]="col.id"
          [style.flex]="col.fracao + ' 1 0'"
        >
          <header class="tv-coluna-head">
            <h2>{{ col.titulo }}</h2>
            <span class="tv-coluna-count">{{ cardsDaCategoria(col.id).length }}</span>
          </header>
          <div class="tv-coluna-lista">
            <article
              *ngFor="let c of cardsDaCategoria(col.id)"
              class="tv-card"
              [attr.data-nivel]="c.nivel"
              [class.tv-card--avisar]="c.avisarCliente"
            >
              <div class="tv-card-top">
                <span class="tv-os">#{{ c.os.numero || c.os.id }}</span>
                <span class="tv-loja" *ngIf="c.loja">{{ c.loja }}</span>
                <span class="tv-tempo">{{ c.tempoLabel }}</span>
              </div>
              <div class="tv-modelo">{{ c.modelo }}</div>
              <div class="tv-problema" [title]="c.os.defeito || c.problema">{{ c.problema }}</div>
              <div class="tv-meta">
                <span class="tv-cliente">{{ c.cliente }}</span>
                <span class="tv-sla" *ngIf="c.avisarCliente">Avisar cliente</span>
                <span class="tv-sla" *ngIf="!c.avisarCliente && col.id === 'especial'">{{ c.diasRastreio }}d</span>
                <span class="tv-sla" *ngIf="!c.avisarCliente && col.id !== 'especial' && c.nivel === 'vermelho'">SLA</span>
              </div>
            </article>
            <p class="tv-coluna-vazia" *ngIf="!cardsDaCategoria(col.id).length">—</p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }

    .tv-board {
      min-height: 100vh;
      padding: 14px 18px 20px;
      box-sizing: border-box;
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, #1e293b 0%, transparent 55%),
        linear-gradient(180deg, #0f172a 0%, #111827 100%);
      color: #e2e8f0;
      font-family: "Segoe UI", system-ui, sans-serif;
    }

    .tv-header {
      display: grid;
      grid-template-columns: 1.1fr 1.2fr auto;
      gap: 12px;
      align-items: end;
      margin-bottom: 10px;
    }

    .tv-brand-name {
      display: block;
      font-size: clamp(22px, 2.6vw, 34px);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #f8fafc;
      line-height: 1;
    }
    .tv-brand-sub {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      color: #94a3b8;
    }

    .tv-filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
    }
    .tv-loja-chip {
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(15, 23, 42, 0.55);
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .tv-loja-chip--ativo {
      background: #f8fafc;
      color: #0f172a;
      border-color: #f8fafc;
    }

    .tv-relogio { text-align: right; }
    .tv-hora {
      display: block;
      font-size: clamp(26px, 3.2vw, 40px);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      color: #f8fafc;
    }
    .tv-data { display: block; font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .tv-sair {
      display: inline-block;
      margin-top: 6px;
      font-size: 11px;
      color: #64748b;
      text-decoration: none;
    }
    .tv-sair:hover { color: #94a3b8; }

    .tv-legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.15);
    }
    .tv-legenda-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #cbd5e1;
    }
    .tv-legenda-item i {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      display: inline-block;
    }
    .tv-legenda-item[data-nivel="branco"] i { background: #f8fafc; border: 1px solid #cbd5e1; }
    .tv-legenda-item[data-nivel="amarelo"] i { background: #facc15; }
    .tv-legenda-item[data-nivel="laranja"] i { background: #fb923c; }
    .tv-legenda-item[data-nivel="vermelho"] i { background: #ef4444; }

    .tv-status {
      margin: 32px 0;
      text-align: center;
      font-size: 18px;
      color: #94a3b8;
    }
    .tv-status--erro { color: #fca5a5; }

    .tv-colunas {
      display: flex;
      gap: 12px;
      align-items: stretch;
      min-height: calc(100vh - 160px);
    }
    .tv-coluna {
      min-width: 0;
      display: flex;
      flex-direction: column;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.4);
      border: 2px solid rgba(148, 163, 184, 0.35);
      overflow: hidden;
    }
    .tv-coluna[data-col="retirada"] {
      background: rgba(30, 41, 59, 0.35);
      border-color: rgba(148, 163, 184, 0.28);
    }
    .tv-coluna-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-bottom: 2px solid rgba(148, 163, 184, 0.28);
    }
    .tv-coluna-head h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    .tv-coluna[data-col="retirada"] .tv-coluna-head h2 { font-size: 12px; }
    .tv-coluna-count {
      min-width: 24px;
      padding: 2px 7px;
      border-radius: 999px;
      background: #334155;
      color: #f8fafc;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
    }
    .tv-coluna-lista {
      flex: 1;
      overflow: auto;
      padding: 10px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      align-content: start;
    }
    .tv-coluna[data-col="retirada"] .tv-coluna-lista {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 8px;
    }
    .tv-coluna-vazia {
      grid-column: 1 / -1;
      margin: 12px 0;
      text-align: center;
      color: #64748b;
      font-size: 13px;
    }

    .tv-card {
      border-radius: 10px;
      padding: 10px 11px 9px;
      box-shadow: none;
      color: #0f172a;
      border: 2px solid #94a3b8;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-height: 0;
      min-width: 0;
    }
    .tv-coluna[data-col="retirada"] .tv-card {
      padding: 8px 9px 7px;
      border-width: 2px;
    }
    .tv-card[data-nivel="branco"] {
      background: #f8fafc;
      border-color: #64748b;
    }
    .tv-card[data-nivel="amarelo"] {
      background: linear-gradient(165deg, #fef08a 0%, #facc15 100%);
      border-color: #a16207;
    }
    .tv-card[data-nivel="laranja"] {
      background: linear-gradient(165deg, #fdba74 0%, #fb923c 100%);
      border-color: #c2410c;
    }
    .tv-card[data-nivel="vermelho"],
    .tv-card--avisar {
      background: linear-gradient(165deg, #f87171 0%, #ef4444 100%);
      color: #fff;
      border-color: #7f1d1d;
    }
    .tv-card--avisar {
      animation: tv-pulse 2.4s ease-in-out infinite;
      border-color: #fff;
      box-shadow: 0 0 0 1px #7f1d1d;
    }

    @keyframes tv-pulse {
      0%, 100% { box-shadow: 0 0 0 1px #7f1d1d; }
      50% { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.55); }
    }

    .tv-card-top {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }
    .tv-os {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .tv-coluna[data-col="retirada"] .tv-os { font-size: 13px; }
    .tv-loja {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      opacity: 0.75;
    }
    .tv-tempo {
      margin-left: auto;
      font-size: 13px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .tv-modelo {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tv-coluna[data-col="retirada"] .tv-modelo { font-size: 12px; }
    .tv-problema {
      font-size: 12px;
      line-height: 1.25;
      opacity: 0.92;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .tv-coluna[data-col="retirada"] .tv-problema {
      font-size: 11px;
      -webkit-line-clamp: 2;
    }
    .tv-meta {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-top: 2px;
      font-size: 11px;
      font-weight: 600;
      opacity: 0.9;
    }
    .tv-cliente {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .tv-sla { flex-shrink: 0; }

    @media (max-width: 1100px) {
      .tv-colunas { flex-direction: column; }
      .tv-coluna { flex: 1 1 auto !important; max-height: 42vh; }
      .tv-header { grid-template-columns: 1fr; }
      .tv-relogio { text-align: left; }
      .tv-filtros { justify-content: flex-start; }
    }
  `],
})
export class OrdensServicoPainelTv implements OnInit, OnDestroy {
  readonly faixas = OS_PAINEL_TV_FAIXAS;
  readonly colunas = OS_PAINEL_TV_COLUNAS;
  readonly lojas = LOJAS_OS;
  readonly lojasFiltro = LOJAS_OS_FILTRO;
  readonly prazoComumDias = OS_PAINEL_TV_PRAZO_COMUM_DIAS;
  readonly retiradaMaxDias = OS_PAINEL_TV_RETIRADA_MAX_DIAS;
  readonly slaHoras = OS_PAINEL_TV_SLA_MINUTOS / 60;

  cards: CardPainelTv[] = [];
  filtroLoja = '';
  agora = new Date();
  carregando = true;
  erro = '';

  private raw: BlingOrdemServico[] = [];
  private sub?: Subscription;
  private tickSub?: Subscription;

  constructor(private service: OrdensServicoService) {}

  get totalVisivel(): number {
    return this.cards.length;
  }

  ngOnInit(): void {
    this.sub = interval(OS_PAINEL_TV_REFRESH_MS).pipe(
      startWith(0),
      switchMap(() =>
        this.service.listar({
          pagina: 1,
          tamanhoPagina: 300,
          ordenarPor: 'data',
          direcao: 'asc',
          lojaOrigem: this.filtroLoja || undefined,
        }).pipe(
          catchError(() => {
            this.erro = 'Falha ao carregar OS. Tentando novamente…';
            this.carregando = false;
            return of(null);
          }),
        ),
      ),
    ).subscribe(res => {
      this.carregando = false;
      if (!res) return;
      this.erro = '';
      this.raw = res.itens ?? [];
      this.recalcular();
    });

    this.tickSub = interval(OS_PAINEL_TV_TICK_MS).subscribe(() => {
      this.agora = new Date();
      this.recalcular();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.tickSub?.unsubscribe();
  }

  setFiltroLoja(codigo: string): void {
    this.filtroLoja = codigo;
    this.carregando = true;
    this.service.listar({
      pagina: 1,
      tamanhoPagina: 300,
      ordenarPor: 'data',
      direcao: 'asc',
      lojaOrigem: codigo || undefined,
    }).subscribe({
      next: res => {
        this.carregando = false;
        this.erro = '';
        this.raw = res.itens ?? [];
        this.recalcular();
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Falha ao filtrar por loja.';
      },
    });
  }

  cardsDaCategoria(categoria: OsPainelTvCategoria): CardPainelTv[] {
    return this.cards.filter(c => c.categoria === categoria);
  }

  private recalcular(): void {
    const agora = this.agora;
    const cards: CardPainelTv[] = [];

    for (const os of this.raw) {
      if (this.filtroLoja && normalizarLojaOs(os.lojaOrigem) !== this.filtroLoja) continue;

      const categoria = categoriaPainelTvOs(os, agora);
      if (!categoria) continue;

      const urgencia = nivelUrgenciaDaOs(os, agora);
      const nivel: OsPainelTvNivel =
        urgencia === 'finalizada' || urgencia === 'pre' || urgencia === 'peca'
          ? (urgencia === 'peca' ? 'amarelo' : 'branco')
          : urgencia;
      const base = dataBaseUrgenciaOs(os);
      const minutos = minutosDesdeEntrada(base, agora);
      const avisarCliente = osTemJustificativaAtraso(os);
      const diasRastreio = diasDesde(dataRastreioComumOs(os), agora);

      cards.push({
        os,
        minutos,
        nivel,
        categoria,
        tempoLabel: avisarCliente
          ? 'Avisar'
          : formatarTempoDecorrido(minutos),
        percentual: percentualSla(minutos),
        modelo: modeloAparelhoOs(os),
        problema: resumirProblemaOs(os, categoria === 'retirada' ? 48 : 72),
        cliente: (os.contato?.nome || 'Cliente').trim(),
        loja: siglaLojaOs(os.lojaOrigem),
        avisarCliente,
        diasRastreio,
      });
    }

    const ordemNivel: Record<OsPainelTvNivel, number> = {
      vermelho: 0,
      laranja: 1,
      amarelo: 2,
      branco: 3,
    };
    cards.sort((a, b) => {
      if (a.avisarCliente !== b.avisarCliente) return a.avisarCliente ? -1 : 1;
      const d = ordemNivel[a.nivel] - ordemNivel[b.nivel];
      if (d !== 0) return d;
      return b.minutos - a.minutos;
    });

    this.cards = cards;
  }
}
