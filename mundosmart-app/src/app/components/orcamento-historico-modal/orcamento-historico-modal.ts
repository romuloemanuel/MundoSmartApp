import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { BlingOrcamento, OrcamentoFollowUpItem } from '../../models/bling.models';

@Component({
  selector: 'app-orcamento-historico-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="backdrop" (click)="fechar.emit()">
      <div
        class="card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orc-hist-titulo"
        (click)="$event.stopPropagation()"
      >
        <header class="card-head">
          <p class="eyebrow">Histórico</p>
          <h3 id="orc-hist-titulo">O que rolou nos follow-ups</h3>
          <p class="sub" *ngIf="orcamento as o">
            Orçamento <strong>#{{ o.numero || o.id }}</strong>
            · {{ o.contato?.nome || 'Cliente' }}
            · {{ historico.length }} contato(s)
          </p>
        </header>

        <div class="aguardo" *ngIf="justificativaAguardo">
          <span class="aguardo-label">Motivo de aguardo (cadastro)</span>
          <p>{{ justificativaAguardo }}</p>
        </div>

        <ul class="hist" *ngIf="historico.length; else semHist">
          <li *ngFor="let f of historico; let i = index">
            <div class="fu-cabeca">
              <span class="fu-num">#{{ historico.length - i }}</span>
              <strong>{{ f.data | date:'dd/MM/yyyy' }}</strong>
              <span class="fu-resp">{{ f.responsavel || '—' }}</span>
            </div>
            <p class="fu-anotacao">{{ f.anotacao || '—' }}</p>
            <span class="fu-criado" *ngIf="f.criadoEm">
              Registrado em {{ f.criadoEm | date:'dd/MM/yyyy HH:mm' }}
            </span>
          </li>
        </ul>
        <ng-template #semHist>
          <p class="vazio">Nenhum follow-up registrado ainda.</p>
        </ng-template>

        <footer class="acoes">
          <button type="button" class="btn-pri" (click)="fechar.emit()">Fechar</button>
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
      max-height: min(86vh, 640px);
      display: flex;
      flex-direction: column;
    }
    .eyebrow {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: #6366f1;
    }
    h3 { margin: 4px 0 6px; font-size: 18px; color: #0f172a; }
    .sub { margin: 0 0 14px; font-size: 13px; color: #64748b; line-height: 1.4; }
    .aguardo {
      margin: 0 0 12px;
      padding: 10px 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
    }
    .aguardo-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 4px;
    }
    .aguardo p { margin: 0; font-size: 13px; color: #78350f; line-height: 1.4; }
    .hist {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: auto;
      flex: 1;
      min-height: 0;
    }
    .hist li {
      padding: 10px 12px;
      margin-bottom: 8px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .fu-cabeca {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      margin-bottom: 6px;
      font-size: 12px;
      color: #475569;
    }
    .fu-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      padding: 1px 6px;
      border-radius: 999px;
      background: #e0e7ff;
      color: #3730a3;
      font-size: 11px;
      font-weight: 700;
    }
    .fu-cabeca strong { color: #0f172a; }
    .fu-resp { color: #64748b; }
    .fu-anotacao {
      margin: 0;
      font-size: 13px;
      color: #1e293b;
      line-height: 1.45;
      white-space: pre-wrap;
    }
    .fu-criado {
      display: block;
      margin-top: 6px;
      font-size: 11px;
      color: #94a3b8;
    }
    .vazio {
      margin: 8px 0 16px;
      font-size: 13px;
      color: #64748b;
      text-align: center;
      padding: 20px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
    }
    .acoes {
      display: flex;
      justify-content: flex-end;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .btn-pri {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: #2563eb;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-pri:hover { background: #1d4ed8; }
  `],
})
export class OrcamentoHistoricoModal {
  @Input({ required: true }) orcamento!: BlingOrcamento;
  @Output() fechar = new EventEmitter<void>();

  get justificativaAguardo(): string {
    return (this.orcamento.justificativaAguardo ?? '').trim();
  }

  get historico(): OrcamentoFollowUpItem[] {
    return [...(this.orcamento.followUps ?? [])].sort((a, b) =>
      (b.data ?? '').localeCompare(a.data ?? '')
      || (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''),
    );
  }
}
