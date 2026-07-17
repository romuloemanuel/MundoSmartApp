import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OsIntakeQr } from '../os-intake-qr/os-intake-qr';

@Component({
  selector: 'app-os-intake-modal',
  standalone: true,
  imports: [CommonModule, OsIntakeQr],
  template: `
    <div class="modal-backdrop" (click)="fechar()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>OS salva com sucesso</h3>
          <button type="button" class="modal-close" (click)="fechar()">✕</button>
        </div>

        <div class="modal-body">
          <p class="modal-sucesso" *ngIf="osNumero">
            Ordem de serviço <strong>#{{ osNumero }}</strong> registrada.
          </p>
          <p class="modal-sucesso" *ngIf="!osNumero">Ordem de serviço registrada.</p>
          <p class="modal-hint">
            Escaneie o QR com o celular — abre uma página exclusiva para fotografar o aparelho
            e, se necessário, o cliente desenhar a senha.
          </p>

          <app-os-intake-qr
            [osId]="osId"
            [gerarAutomaticamente]="true"
            (intakeAtualizado)="intakeAtualizado.emit()"
          />
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-modal-fechar" (click)="fechar()">{{ botaoFecharLabel }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-box {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 420px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #0d0d0d;
      border-radius: 12px 12px 0 0;
    }
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
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 20px;
    }
    .modal-sucesso {
      margin: 0 0 8px;
      font-size: 14px;
      color: #166534;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .modal-hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: #475569;
      line-height: 1.45;
    }
    .modal-footer {
      padding: 12px 20px 18px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      justify-content: flex-end;
    }
    .btn-modal-fechar {
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 7px;
      cursor: pointer;
    }
    .btn-modal-fechar:hover { background: #1d4ed8; }
  `],
})
export class OsIntakeModal {
  @Input({ required: true }) osId!: number;
  @Input() osNumero?: number | string;
  /** Texto do botão principal (ex.: "Prosseguir" após criar OS). */
  @Input() botaoFecharLabel = 'Continuar na OS';
  @Output() fecharModal = new EventEmitter<void>();
  @Output() intakeAtualizado = new EventEmitter<void>();

  fechar(): void {
    this.fecharModal.emit();
  }
}
