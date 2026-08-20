import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlingOrcamento } from '../../models/bling.models';
import { avisarErroUsuario } from '../../services/user-feedback.service';

export interface OrcamentoDesistenciaPayload {
  motivo: string;
}

@Component({
  selector: 'app-orcamento-desistencia-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="backdrop" (click)="onCancelar()">
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="orc-des-titulo" (click)="$event.stopPropagation()">
        <header class="card-head">
          <p class="eyebrow">Orçamento</p>
          <h3 id="orc-des-titulo">Desistência do cliente</h3>
          <p class="sub" *ngIf="orcamento as o">
            Orçamento <strong>#{{ o.numero || o.id }}</strong>
            · {{ o.contato?.nome || 'Cliente' }}
          </p>
        </header>

        <p class="hint">
          Encerra o orçamento sem gerar OS. Não entra no ciclo de
          <strong>Não realizado</strong> (follow-ups sem resposta).
        </p>

        <div class="form-group">
          <label>Motivo <span class="req">*</span></label>
          <textarea
            [(ngModel)]="motivo"
            name="desMotivo"
            rows="3"
            placeholder="Ex.: Cliente recusou o valor / vai fazer em outra assistência…"
          ></textarea>
        </div>

        <p class="erro" *ngIf="erroLocal || erro">{{ erroLocal || erro }}</p>

        <footer class="acoes">
          <button type="button" class="btn-sec" (click)="onCancelar()" [disabled]="salvando">Cancelar</button>
          <button type="button" class="btn-pri" (click)="onConfirmar()" [disabled]="salvando">
            {{ salvando ? 'Salvando…' : 'Confirmar desistência' }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed; inset: 0; z-index: 1200;
      background: rgba(15, 23, 42, 0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .card {
      width: min(460px, 100%);
      background: #fff;
      border-radius: 12px;
      padding: 20px 22px 16px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
    }
    .eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #b45309; }
    h3 { margin: 4px 0 6px; font-size: 18px; color: #0f172a; }
    .sub { margin: 0 0 12px; font-size: 13px; color: #64748b; line-height: 1.4; }
    .hint {
      margin: 0 0 12px; padding: 10px 12px; font-size: 12px; line-height: 1.4;
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #92400e;
    }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px; }
    .req { color: #b91c1c; }
    .form-group textarea {
      width: 100%; box-sizing: border-box; padding: 8px 10px;
      border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: inherit;
    }
    .erro { margin: 0 0 10px; color: #b91c1c; font-size: 13px; }
    .acoes { display: flex; justify-content: flex-end; gap: 8px; }
    .btn-sec, .btn-pri {
      padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-sec { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
    .btn-pri { border: none; background: #b45309; color: #fff; }
    .btn-pri:hover:not(:disabled) { background: #92400e; }
    .btn-pri:disabled, .btn-sec:disabled { opacity: .6; cursor: default; }
  `],
})
export class OrcamentoDesistenciaModal {
  @Input({ required: true }) orcamento!: BlingOrcamento;
  @Input() salvando = false;
  @Input() erro = '';
  @Output() confirmar = new EventEmitter<OrcamentoDesistenciaPayload>();
  @Output() cancelar = new EventEmitter<void>();

  motivo = '';
  erroLocal = '';

  onCancelar(): void {
    if (this.salvando) return;
    this.cancelar.emit();
  }

  onConfirmar(): void {
    const motivo = this.motivo.trim();
    if (!motivo) {
      this.erroLocal = 'Informe o motivo da desistência.';
      avisarErroUsuario(this.erroLocal);
      return;
    }
    this.erroLocal = '';
    this.confirmar.emit({ motivo });
  }
}
