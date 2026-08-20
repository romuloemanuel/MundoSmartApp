import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BlingOrdemServico, JustificativaAtrasoItem } from '../../models/bling.models';
import { avisarErroUsuario } from '../../services/user-feedback.service';

@Component({
  selector: 'app-justificativa-atraso-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <div class="backdrop" (click)="onCancelar()">
      <div
        class="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="just-atraso-titulo"
        (click)="$event.stopPropagation()"
      >
        <header class="card-head">
          <div class="head-icon" aria-hidden="true">!</div>
          <div class="head-text">
            <p class="eyebrow">Aviso ao cliente</p>
            <h3 id="just-atraso-titulo">Justificar atraso</h3>
            <p class="sub" *ngIf="os as o">
              OS <strong>#{{ o.numero }}</strong>
              <span *ngIf="o.contato?.nome"> — {{ o.contato?.nome }}</span>
            </p>
          </div>
        </header>

        <div class="card-body">
          <p class="info">
            Descreva o motivo do atraso. A bolinha ficará <span class="mark-vermelho">vermelha</span>
            para indicar que o cliente precisa ser avisado. Depois do contato, use a
            bolinha azul no calendário.
          </p>

          <section class="historico" *ngIf="justificativas.length">
            <h4>Justificativas anteriores</h4>
            <ul>
              <li *ngFor="let j of justificativas">
                <time *ngIf="j.criadoEm">{{ j.criadoEm | date:'dd/MM/yyyy HH:mm' }}</time>
                <p>{{ j.texto }}</p>
              </li>
            </ul>
          </section>

          <label class="campo">
            <span>Nova justificativa <em>(mín. 5 caracteres)</em></span>
            <textarea
              [(ngModel)]="texto"
              rows="4"
              maxlength="500"
              placeholder="Ex.: Peça em atraso no fornecedor; prazo novo combinado para sexta..."
              [disabled]="salvando"
              (keydown.escape)="onCancelar()"
            ></textarea>
            <span class="contador">{{ texto.length }}/500</span>
          </label>

          <p class="erro" *ngIf="erroLocal()">{{ erroLocal() }}</p>
          <p class="erro" *ngIf="erroApi">{{ erroApi }}</p>
        </div>

        <footer class="acoes">
          <button type="button" class="btn-sec" (click)="onCancelar()" [disabled]="salvando">
            Cancelar
          </button>
          <button type="button" class="btn-pri" (click)="onConfirmar()" [disabled]="salvando || !podeSalvar">
            {{ salvando ? 'Salvando…' : 'Registrar atraso' }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1300;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(2px);
    }
    .card {
      width: min(520px, 100%);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: min(90vh, 640px);
    }
    .card-head {
      display: flex;
      gap: 14px;
      padding: 22px 22px 16px;
      background: linear-gradient(160deg, #fef2f2 0%, #fff 72%);
      border-bottom: 1px solid #fecaca;
    }
    .head-icon {
      flex-shrink: 0;
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: #dc2626;
      color: #fff;
      font-weight: 800;
      font-size: 1.25rem;
      display: grid;
      place-items: center;
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
    }
    .eyebrow {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #b91c1c;
    }
    h3 {
      margin: 0 0 4px;
      font-size: 1.25rem;
      color: #0f172a;
    }
    .sub {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .card-body {
      padding: 18px 22px;
      overflow: auto;
      flex: 1;
    }
    .info {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.45;
      color: #475569;
    }
    .mark-vermelho {
      color: #dc2626;
      font-weight: 700;
    }
    .historico {
      margin-bottom: 16px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .historico h4 {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #64748b;
    }
    .historico ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .historico li time {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 2px;
    }
    .historico li p {
      margin: 0;
      font-size: 13px;
      color: #334155;
      line-height: 1.4;
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .campo > span {
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .campo em {
      font-style: normal;
      font-weight: 500;
      color: #94a3b8;
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      font: inherit;
      font-size: 14px;
      line-height: 1.45;
      color: #0f172a;
      resize: vertical;
      min-height: 100px;
      transition: border-color .15s;
    }
    textarea:focus {
      outline: none;
      border-color: #dc2626;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.12);
    }
    textarea:disabled {
      background: #f1f5f9;
      color: #64748b;
    }
    .contador {
      align-self: flex-end;
      font-size: 11px;
      color: #94a3b8;
    }
    .erro {
      margin: 10px 0 0;
      font-size: 13px;
      color: #b91c1c;
      font-weight: 600;
    }
    .acoes {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 22px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fafafa;
    }
    .btn-sec, .btn-pri {
      border: none;
      border-radius: 10px;
      padding: 10px 18px;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-sec {
      background: #fff;
      color: #475569;
      border: 1px solid #e2e8f0;
    }
    .btn-sec:hover:not(:disabled) { background: #f1f5f9; }
    .btn-pri {
      background: #dc2626;
      color: #fff;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.28);
    }
    .btn-pri:hover:not(:disabled) { background: #b91c1c; }
    .btn-pri:disabled, .btn-sec:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  `],
})
export class JustificativaAtrasoModal {
  @Input() os: BlingOrdemServico | null = null;
  @Input() salvando = false;
  @Input() erroApi: string | null = null;
  @Output() confirmar = new EventEmitter<string>();
  @Output() cancelar = new EventEmitter<void>();

  texto = '';
  readonly erroLocal = signal<string | null>(null);

  get justificativas(): JustificativaAtrasoItem[] {
    return this.os?.justificativasAtraso ?? [];
  }

  get podeSalvar(): boolean {
    return this.texto.trim().length >= 5;
  }

  onCancelar(): void {
    if (this.salvando) return;
    this.cancelar.emit();
  }

  onConfirmar(): void {
    const t = this.texto.trim();
    if (t.length < 5) {
      const msg = 'Informe a justificativa do atraso (mínimo 5 caracteres).';
      this.erroLocal.set(msg);
      avisarErroUsuario(msg);
      return;
    }
    this.erroLocal.set(null);
    this.confirmar.emit(t);
  }
}
