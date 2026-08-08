import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlingOrcamento } from '../../models/bling.models';
import {
  ORCAMENTO_FOLLOWUP_CICLO,
  ORCAMENTO_RESPONSAVEIS,
  diasUteisProximoFollowUp,
  sugerirDataFollowUp,
} from '../../config/orcamento-followup.config';

export interface OrcamentoFollowUpModalPayload {
  anotacao: string;
  responsavel: string;
  dataFollowUpProxima?: string;
}

@Component({
  selector: 'app-orcamento-followup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="backdrop" (click)="onCancelar()">
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="orc-fu-titulo" (click)="$event.stopPropagation()">
        <header class="card-head">
          <p class="eyebrow">Follow-up</p>
          <h3 id="orc-fu-titulo">Registrar contato</h3>
          <p class="sub" *ngIf="orcamento as o">
            Orçamento <strong>#{{ o.numero || o.id }}</strong>
            · {{ o.contato?.nome || 'Cliente' }}
            · contato {{ vezes + 1 }} de {{ ciclo }}
          </p>
        </header>

        <p class="hint-ciclo" *ngIf="vezes + 1 >= ciclo">
          Este será o <strong>{{ ciclo }}º follow-up</strong>. O orçamento será marcado como
          <strong>Não realizado</strong> e as justificativas ficam salvas para análise.
        </p>

        <div class="form-group">
          <label>Quem fez o contato <span class="req">*</span></label>
          <select [(ngModel)]="responsavel" name="fuResponsavel">
            <option value="">Selecione...</option>
            <option *ngFor="let r of responsaveis" [value]="r">{{ r }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Justificativa / anotação <span class="req">*</span></label>
          <textarea
            [(ngModel)]="anotacao"
            name="fuAnotacao"
            rows="3"
            placeholder="Ex.: Cliente sem resposta no WhatsApp / pediu para ligar no dia 12…"
          ></textarea>
          <span class="campo-hint">Fica no histórico para avaliar motivos no futuro.</span>
        </div>

        <div class="form-group" *ngIf="vezes + 1 < ciclo">
          <label>Próxima data para revisitar</label>
          <input type="date" [(ngModel)]="proximaData" name="fuProximaData" />
          <span class="campo-hint">
            Sugestão: +{{ diasUteis }} dias úteis — altere se o cliente retornou outra data.
          </span>
        </div>

        <ul class="hist" *ngIf="historico.length">
          <li *ngFor="let f of historico">
            <strong>{{ f.data | date:'dd/MM/yyyy' }} · {{ f.responsavel || '—' }}</strong>
            <span>{{ f.anotacao }}</span>
          </li>
        </ul>

        <p class="erro" *ngIf="erroLocal || erro">{{ erroLocal || erro }}</p>

        <footer class="acoes">
          <button type="button" class="btn-sec" (click)="onCancelar()" [disabled]="salvando">Cancelar</button>
          <button type="button" class="btn-pri" (click)="onConfirmar()" [disabled]="salvando">
            {{ salvando ? 'Salvando…' : (vezes + 1 >= ciclo ? 'Registrar e concluir (Não realizado)' : 'Registrar follow-up') }}
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
      width: min(480px, 100%);
      background: #fff;
      border-radius: 12px;
      padding: 20px 22px 16px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
    }
    .eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #059669; }
    h3 { margin: 4px 0 6px; font-size: 18px; color: #0f172a; }
    .sub { margin: 0 0 12px; font-size: 13px; color: #64748b; line-height: 1.4; }
    .hint-ciclo {
      margin: 0 0 12px; padding: 10px 12px; font-size: 12px; line-height: 1.4;
      background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; color: #92400e;
    }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px; }
    .req { color: #b91c1c; }
    .form-group select, .form-group input, .form-group textarea {
      width: 100%; box-sizing: border-box; padding: 8px 10px;
      border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: inherit;
    }
    .campo-hint { display: block; margin-top: 4px; font-size: 11px; color: #64748b; }
    .hist {
      list-style: none; margin: 0 0 12px; padding: 0; max-height: 140px; overflow: auto;
    }
    .hist li {
      padding: 8px 10px; margin-bottom: 6px; border: 1px solid #e2e8f0; border-radius: 6px;
      background: #f8fafc; font-size: 12px; color: #334155;
    }
    .hist strong { display: block; margin-bottom: 2px; color: #0f172a; }
    .erro { color: #b91c1c; font-size: 13px; margin: 0 0 10px; }
    .acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .btn-sec, .btn-pri {
      padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-sec { background: #fff; border: 1px solid #cbd5e1; color: #475569; }
    .btn-pri { background: #059669; border: 1px solid #059669; color: #fff; }
    .btn-pri:disabled, .btn-sec:disabled { opacity: 0.55; cursor: not-allowed; }
  `],
})
export class OrcamentoFollowupModal implements OnChanges {
  @Input({ required: true }) orcamento!: BlingOrcamento;
  @Input() salvando = false;
  @Input() erro = '';
  @Output() confirmar = new EventEmitter<OrcamentoFollowUpModalPayload>();
  @Output() cancelar = new EventEmitter<void>();

  readonly responsaveis = ORCAMENTO_RESPONSAVEIS;
  readonly ciclo = ORCAMENTO_FOLLOWUP_CICLO;

  anotacao = '';
  responsavel = '';
  proximaData = '';
  erroLocal = '';

  get vezes(): number {
    return this.orcamento?.vezesContato ?? this.orcamento?.followUps?.length ?? 0;
  }

  get diasUteis(): number {
    return diasUteisProximoFollowUp(this.vezes + 1);
  }

  get historico() {
    return [...(this.orcamento?.followUps ?? [])].sort((a, b) =>
      (b.data ?? '').localeCompare(a.data ?? ''));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orcamento'] && this.orcamento) {
      this.anotacao = '';
      this.erroLocal = '';
      this.responsavel = this.orcamento.responsavelOrcamento ?? '';
      this.proximaData = sugerirDataFollowUp(this.vezes + 1);
    }
  }

  onCancelar(): void {
    if (this.salvando) return;
    this.cancelar.emit();
  }

  onConfirmar(): void {
    const anotacao = this.anotacao.trim();
    const responsavel = this.responsavel.trim();
    if (!responsavel) {
      this.erroLocal = 'Informe quem fez o contato.';
      return;
    }
    if (!anotacao) {
      this.erroLocal = 'Informe a justificativa / anotação.';
      return;
    }
    this.erroLocal = '';
    this.confirmar.emit({
      anotacao,
      responsavel,
      dataFollowUpProxima: this.vezes + 1 >= this.ciclo ? undefined : (this.proximaData || undefined),
    });
  }
}
