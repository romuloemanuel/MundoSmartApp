import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  OsSituacaoDialogService,
  OsSituacaoDialogRequest,
} from '../../services/os-situacao-dialog';
import {
  PRAZO_AGUARDANDO_PECA_DIAS_PADRAO,
  prazoPecaPadraoDatetimeLocal,
} from '../../config/os-situacao.config';

@Component({
  selector: 'app-os-situacao-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="aberto" (click)="cancelar()">
      <div
        class="modal-box"
        [class.modal-box--cancelar]="kind === 'cancelar'"
        [class.modal-box--concluir]="kind === 'concluir'"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'os-sit-modal-titulo'"
        (click)="$event.stopPropagation()"
      >
        <div class="modal-header" [ngClass]="'modal-header--' + kind">
          <h3 id="os-sit-modal-titulo">{{ titulo }}</h3>
          <button type="button" class="modal-close" (click)="cancelar()" aria-label="Fechar">✕</button>
        </div>

        <div class="modal-body">
          <p class="modal-hint" *ngIf="osLabel || situacao">
            <span *ngIf="osLabel">{{ osLabel }}</span>
            <span *ngIf="osLabel && situacao"> · </span>
            <span *ngIf="situacao">Situação: <strong>{{ situacao }}</strong></span>
          </p>

          <ng-container [ngSwitch]="kind">
            <ng-container *ngSwitchCase="'cancelar'">
              <p class="modal-hint">
                Informe o motivo do cancelamento. Essa informação fica registrada na OS.
              </p>
              <div class="form-group">
                <label for="os-sit-motivo">
                  Motivo <span class="campo-obrigatorio" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="os-sit-motivo"
                  name="motivoCancelamento"
                  rows="4"
                  [(ngModel)]="motivo"
                  placeholder="Ex.: cliente desistiu do reparo, orçamento não aprovado…"
                  autofocus
                ></textarea>
                <p class="campo-erro" *ngIf="erro">{{ erro }}</p>
              </div>
            </ng-container>

            <ng-container *ngSwitchCase="'concluir'">
              <div class="modal-destaque modal-destaque--ok">
                <p>
                  Ao confirmar, a OS será marcada como <strong>Concluído</strong>
                  e a <strong>data de saída</strong> será registrada automaticamente.
                </p>
              </div>
              <p class="modal-hint">
                Confira se o serviço, as peças e o pagamento estão corretos antes de continuar.
              </p>
            </ng-container>

            <ng-container *ngSwitchCase="'prazo'">
              <p class="modal-hint">
                Informe em quantos dias a peça deve chegar. O prazo será calculado a partir de hoje.
              </p>
              <div class="form-group">
                <label for="os-sit-prazo">
                  Prazo (dias) <span class="campo-obrigatorio" aria-hidden="true">*</span>
                </label>
                <input
                  id="os-sit-prazo"
                  type="number"
                  name="prazoDias"
                  min="1"
                  step="1"
                  [(ngModel)]="prazoDias"
                  autofocus
                />
                <p class="campo-hint-inline">Sugestão padrão: {{ prazoDiasPadrao }} dias.</p>
                <p class="campo-erro" *ngIf="erro">{{ erro }}</p>
              </div>
            </ng-container>
          </ng-container>
        </div>

        <div class="modal-footer">
          <button type="button" (click)="cancelar()">Voltar</button>
          <button
            type="button"
            [class.btn-salvar]="kind !== 'cancelar'"
            [class.btn-perigo]="kind === 'cancelar'"
            (click)="confirmar()"
          >
            {{ textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1210;
      padding: 16px;
    }
    .modal-box {
      width: 100%;
      max-width: 460px;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.28);
      overflow: hidden;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      background: #0d0d0d;
    }
    .modal-header--cancelar { background: #7f1d1d; }
    .modal-header--concluir { background: #14532d; }
    .modal-header--prazo { background: #0d0d0d; }
    .modal-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .modal-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
    }
    .modal-close:hover { color: #fff; }
    .modal-body { padding: 18px 20px; }
    .modal-hint {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 14px;
      line-height: 1.45;
    }
    .modal-hint strong { color: #0f172a; font-weight: 600; }
    .modal-destaque {
      border-radius: 10px;
      padding: 12px 14px;
      margin: 0 0 14px;
      font-size: 13px;
      line-height: 1.5;
      color: #14532d;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .modal-destaque p { margin: 0; }
    .form-group { margin: 0; }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    .campo-obrigatorio { color: #dc2626; }
    textarea, input[type="number"] {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #0f172a;
      box-sizing: border-box;
      font-family: inherit;
      resize: vertical;
    }
    textarea:focus, input[type="number"]:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .campo-hint-inline {
      margin: 6px 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .campo-erro {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      color: #dc2626;
    }
    .modal-footer {
      padding: 12px 20px 16px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .modal-footer button {
      padding: 8px 18px;
      font-size: 13px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
    }
    .modal-footer button:hover { background: #f1f5f9; }
    .btn-salvar {
      background: #16a34a !important;
      border-color: #16a34a !important;
      color: #fff !important;
    }
    .btn-salvar:hover { background: #15803d !important; }
    .btn-perigo {
      background: #dc2626 !important;
      border-color: #dc2626 !important;
      color: #fff !important;
    }
    .btn-perigo:hover { background: #b91c1c !important; }
  `,
})
export class OsSituacaoModal implements OnInit, OnDestroy {
  aberto = false;
  kind: 'cancelar' | 'concluir' | 'prazo' = 'concluir';
  osLabel = '';
  situacao = '';
  motivo = '';
  prazoDias = PRAZO_AGUARDANDO_PECA_DIAS_PADRAO;
  prazoDiasPadrao = PRAZO_AGUARDANDO_PECA_DIAS_PADRAO;
  erro = '';

  private sub?: Subscription;

  constructor(private dialog: OsSituacaoDialogService) {}

  get titulo(): string {
    switch (this.kind) {
      case 'cancelar': return 'Cancelar ordem de serviço';
      case 'concluir': return 'Concluir ordem de serviço';
      case 'prazo': return 'Prazo da peça';
    }
  }

  get textoConfirmar(): string {
    switch (this.kind) {
      case 'cancelar': return 'Confirmar cancelamento';
      case 'concluir': return 'Concluir OS';
      case 'prazo': return 'Definir prazo';
    }
  }

  ngOnInit(): void {
    this.sub = this.dialog.requests$.subscribe((req) => this.abrir(req));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.aberto) this.cancelar();
  }

  private abrir(req: OsSituacaoDialogRequest): void {
    this.kind = req.kind;
    this.osLabel = req.osLabel?.trim() || '';
    this.situacao = req.situacao?.trim() || '';
    this.motivo = req.motivoAtual?.trim() || '';
    this.prazoDiasPadrao = req.prazoDiasPadrao ?? PRAZO_AGUARDANDO_PECA_DIAS_PADRAO;
    this.prazoDias = this.prazoDiasPadrao;
    this.erro = '';
    this.aberto = true;
  }

  confirmar(): void {
    if (this.kind === 'cancelar') {
      const texto = this.motivo.trim();
      if (!texto) {
        this.erro = 'Informe o motivo do cancelamento.';
        return;
      }
      this.aberto = false;
      this.dialog.complete({ kind: 'cancelar', motivo: texto });
      return;
    }

    if (this.kind === 'prazo') {
      const dias = Number(this.prazoDias);
      if (!Number.isFinite(dias) || dias < 1) {
        this.erro = 'Informe um prazo válido em dias (mínimo 1).';
        return;
      }
      this.aberto = false;
      this.dialog.complete({
        kind: 'prazo',
        dataPrazoPeca: prazoPecaPadraoDatetimeLocal(Math.floor(dias)),
      });
      return;
    }

    this.aberto = false;
    this.dialog.complete({ kind: 'concluir' });
  }

  cancelar(): void {
    if (!this.aberto) return;
    this.aberto = false;
    this.dialog.complete(null);
  }
}
