import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AcrescimoEstoqueConfigService,
  AcrescimoEstoqueLoja,
} from '../../../services/acrescimo-estoque-config.service';

@Component({
  selector: 'app-config-acrescimo-estoque',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Acréscimo no valor sugerido</h2>
        <button type="button" (click)="salvar()" [disabled]="salvando">
          {{ salvando ? 'Salvando…' : 'Salvar' }}
        </button>
      </div>

      <p class="hint">
        Percentual fixo por loja/assistência, aplicado automaticamente sobre o
        <strong>valor sugerido</strong> do estoque na OS e no orçamento.
        Só administradores alteram esta configuração. O cadastro da peça continua com o preço base.
      </p>

      <p class="erro" *ngIf="erro">{{ erro }}</p>
      <p class="ok" *ngIf="ok">Configuração salva.</p>

      <table class="data-grid" *ngIf="lojas.length">
        <thead>
          <tr>
            <th>Loja / assistência</th>
            <th>Acréscimo (%)</th>
            <th>Exemplo (sugerido R$ 200)</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let l of lojas; let i = index">
            <td>
              <strong>{{ l.lojaCodigo }}</strong>
              <div class="campo-hint">{{ l.lojaNome }}</div>
            </td>
            <td>
              <input
                type="number"
                min="0"
                step="0.01"
                [(ngModel)]="l.percentual"
                [name]="'pct_' + i"
                style="width:100px"
              />
            </td>
            <td class="exemplo">
              {{ exemplo(l.percentual) | currency:'BRL' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .hint { color: #64748b; font-size: 13px; margin: 0 0 16px; max-width: 720px; line-height: 1.45; }
    .erro { color: #b91c1c; margin-bottom: 12px; }
    .ok { color: #166534; margin-bottom: 12px; }
    .exemplo { font-variant-numeric: tabular-nums; font-weight: 600; }
    table { max-width: 640px; }
  `],
})
export class ConfigAcrescimoEstoquePage implements OnInit {
  lojas: AcrescimoEstoqueLoja[] = [];
  salvando = false;
  erro = '';
  ok = false;

  constructor(private config: AcrescimoEstoqueConfigService) {}

  ngOnInit(): void {
    this.config.carregar().subscribe({
      next: cfg => { this.lojas = cfg.lojas?.length ? [...cfg.lojas] : this.config.listarLojas(); },
      error: () => { this.lojas = this.config.listarLojas(); },
    });
  }

  exemplo(percentual: number): number {
    const pct = Number(percentual) || 0;
    return Math.round(200 * (1 + pct / 100) * 100) / 100;
  }

  salvar(): void {
    this.erro = '';
    this.ok = false;
    this.salvando = true;
    this.config.salvar({ lojas: this.lojas }).subscribe({
      next: cfg => {
        this.salvando = false;
        this.ok = true;
        this.lojas = [...(cfg.lojas ?? this.lojas)];
      },
      error: err => {
        this.salvando = false;
        this.erro = err?.error?.erro || 'Não foi possível salvar.';
      },
    });
  }
}
