import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { PecasService } from '../../services/pecas';
import { DisponibilidadePecaResponse } from '../../models/bling.models';
import {
  classeCardPorNivel,
  ESTOQUE_NIVEL_CLASSES,
  getEstoqueConfig,
  labelNivelEstoque as textoNivelEstoque,
  nivelEstoqueDeQuantidade,
  NivelEstoque,
} from '../../config/estoque.config';

@Component({
  selector: 'app-disponibilidade-peca',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <div class="disp-panel" *ngIf="modeloId && pecaId">
      <div class="disp-loading" *ngIf="carregando">
        <span class="disp-spinner">⏳</span> Consultando estoque...
      </div>

      <ng-container *ngIf="!carregando && dados">
        <div class="disp-card" [ngClass]="classeCardEstoque()">
          <div class="disp-header">
            <span class="disp-peca-nome">{{ dados.pecaNome }}</span>
            <span [ngClass]="classeNivelEstoque()" class="disp-badge-nivel">
              {{ labelNivelEstoque() }}
            </span>
          </div>

          <div class="disp-metricas">
            <div class="disp-metrica">
              <span class="disp-metrica-valor disp-metrica-destaque" [ngClass]="classeNivelEstoque()">
                {{ dados.quantidadeEstoque }}
              </span>
              <span class="disp-metrica-label">Em estoque</span>
            </div>
            <div class="disp-metrica disp-metrica-execucao" *ngIf="dados.emExecucao > 0">
              <span class="disp-metrica-valor">{{ dados.emExecucao }}</span>
              <span class="disp-metrica-label">OS em andamento</span>
            </div>
          </div>

          <div class="disp-valores" *ngIf="dados.valorSugeridoTroca || dados.valorSugeridoMinimo">
            <div class="disp-valor" *ngIf="dados.valorSugeridoTroca">
              <span class="disp-valor-label">Valor sugerido para troca</span>
              <span class="disp-valor-num">{{ dados.valorSugeridoTroca | currency:'BRL' }}</span>
              <span class="disp-valor-parcela" *ngIf="dados.parcelamento && dados.parcelamento > 1">
                em até {{ dados.parcelamento }}x de
                {{ valorParcela(dados.valorSugeridoTroca, dados.parcelamento) | currency:'BRL' }}
              </span>
            </div>
            <div class="disp-valor disp-valor-min" *ngIf="dados.valorSugeridoMinimo">
              <span class="disp-valor-label">Valor sugerido mínimo</span>
              <span class="disp-valor-num">{{ dados.valorSugeridoMinimo | currency:'BRL' }}</span>
            </div>
          </div>

          <div class="disp-compativel" *ngIf="dados.modelosCompativeis?.length">
            <span class="disp-compat-label">Compatível com:</span>
            <span *ngFor="let m of dados.modelosCompativeis" class="disp-chip-compat">{{ m }}</span>
          </div>

          <div class="disp-aviso-critico" *ngIf="dados.alerta" [ngClass]="classeCardEstoque()">
            <strong>{{ labelNivelEstoque() }}:</strong>
            Restam <strong>{{ dados.quantidadeEstoque }}</strong>
            {{ dados.quantidadeEstoque === 1 ? 'unidade em estoque' : 'unidades em estoque' }}
            (limites: sem estoque · abaixo do mínimo · estoque mínimo · estoque normal).
            A baixa é feita ao salvar a OS.
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .disp-panel { margin-top: 10px; }
    .disp-loading {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: #9ca3af; padding: 8px 0;
    }
    .disp-card {
      border-radius: 10px; padding: 14px 16px;
      border: 1.5px solid #86efac;
      background: #f0fdf4;
    }
    .disp-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
      gap: 8px;
    }
    .disp-peca-nome {
      font-size: 14px; font-weight: 700; color: #1a1a1a;
    }
    .disp-badge-nivel {
      font-size: 11px; font-weight: 700; padding: 3px 10px;
      border-radius: 999px; border: 1px solid transparent;
      white-space: nowrap;
    }
    .disp-metricas {
      display: flex; align-items: center; gap: 16px;
      background: rgba(0,0,0,0.03); border-radius: 8px;
      padding: 10px 14px; margin-bottom: 12px;
    }
    .disp-metrica {
      display: flex; flex-direction: column; align-items: center; min-width: 52px;
    }
    .disp-metrica-valor {
      font-size: 22px; font-weight: 800; color: #0d0d0d; line-height: 1;
    }
    .disp-metrica-destaque { font-size: 26px; }
    .disp-metrica-label {
      font-size: 10px; color: #6b7280; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px;
    }
    .disp-metrica-execucao .disp-metrica-valor { color: #d97706; font-size: 18px; }
    .disp-valores { display: flex; gap: 16px; margin-bottom: 10px; }
    .disp-valor { display: flex; flex-direction: column; }
    .disp-valor-label {
      font-size: 10px; font-weight: 700; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .disp-valor-num { font-size: 15px; font-weight: 700; color: #2563EB; }
    .disp-valor-parcela { font-size: 11px; font-weight: 600; color: #6b7280; margin-top: 2px; }
    .disp-valor-min .disp-valor-num { color: #6b7280; }
    .disp-compativel {
      display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
      margin-bottom: 10px;
    }
    .disp-compat-label { font-size: 11px; font-weight: 600; color: #6b7280; }
    .disp-chip-compat {
      background: rgba(37,99,235,0.07); color: #2563EB;
      border: 1px solid rgba(37,99,235,0.2);
      font-size: 11px; font-weight: 600; padding: 2px 8px;
      border-radius: 999px;
    }
    .disp-aviso-critico {
      border-radius: 6px; padding: 10px 12px;
      font-size: 13px; margin-top: 4px;
      border: 1px solid transparent;
    }
  `]
})
export class DisponibilidadePecaPanel implements OnChanges {
  @Input() modeloId?: string;
  @Input() pecaId?: string;

  dados?: DisponibilidadePecaResponse;
  carregando = false;

  get limites() {
    return getEstoqueConfig();
  }

  constructor(private pecasService: PecasService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['modeloId'] || changes['pecaId']) && this.modeloId && this.pecaId) {
      this.consultar();
    }
    if (!this.pecaId || !this.modeloId) {
      this.dados = undefined;
    }
  }

  consultar(): void {
    if (!this.modeloId || !this.pecaId) return;
    this.carregando = true;
    this.dados = undefined;
    this.pecasService.consultarDisponibilidade(this.modeloId, this.pecaId).subscribe({
      next: lista => { this.dados = lista[0]; this.carregando = false; },
      error: () => { this.carregando = false; }
    });
  }

  nivelEstoque(): NivelEstoque {
    if (!this.dados) return 'verde';
    return nivelEstoqueDeQuantidade(this.dados.quantidadeEstoque, this.dados.nivelEstoque);
  }

  classeNivelEstoque(): string {
    return ESTOQUE_NIVEL_CLASSES[this.nivelEstoque()];
  }

  classeCardEstoque(): string {
    return classeCardPorNivel(this.nivelEstoque());
  }

  labelNivelEstoque(): string {
    return textoNivelEstoque(this.nivelEstoque());
  }

  valorParcela(valor: number, parcelas: number): number {
    return parcelas > 0 ? valor / parcelas : valor;
  }
}
