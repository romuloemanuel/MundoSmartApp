import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { OsIntakeService } from '../../services/os-intake';
import { OsIntakeToken } from '../../models/bling.models';
import {
  intakeUrlEditavel,
  obterUrlAppIntake,
  salvarUrlAppIntake,
  urlAppIntakePadrao,
} from '../../config/intake-app-url.config';

@Component({
  selector: 'app-os-intake-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="intake-qr" *ngIf="osId">
      <div class="intake-qr-header">
        <strong>Recepção no celular</strong>
        <button type="button" class="intake-qr-btn" (click)="gerar()" [disabled]="gerando">
          {{ token ? 'Atualizar QR' : 'Gerar QR' }}
        </button>
      </div>

      <p class="intake-qr-hint">
        Escaneie com o celular — abre a recepção (fotos e senha) e entra com a mesma conta do balcão, sem digitar login.
      </p>

      <div class="intake-qr-url-row" *ngIf="urlEditavel">
        <label class="intake-qr-url-label" for="intake-url-app">URL na rede (celular)</label>
        <input
          id="intake-url-app"
          class="intake-qr-url-input"
          [(ngModel)]="urlApp"
          (blur)="persistirUrl()"
          placeholder="http://192.168.0.14:4200"
        />
      </div>

      <div class="intake-qr-body" *ngIf="token">
        <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="QR Code recepção" class="intake-qr-img" />
        <p class="intake-qr-link" *ngIf="token.url">{{ token.url }}</p>
        <p class="intake-qr-exp" *ngIf="token.expiraEm">Válido até {{ token.expiraEm | date:'dd/MM/yyyy HH:mm' }}</p>
      </div>

      <p class="intake-qr-erro" *ngIf="erro">{{ erro }}</p>
    </div>
  `,
  styles: [`
    .intake-qr {
      margin-top: 12px;
      padding: 12px;
      border: 1px dashed #93c5fd;
      border-radius: 8px;
      background: #f0f9ff;
    }
    .intake-qr-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }
    .intake-qr-header strong { font-size: 13px; color: #1e40af; }
    .intake-qr-btn {
      font-size: 12px;
      padding: 5px 12px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .intake-qr-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .intake-qr-hint {
      margin: 0 0 8px;
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
    }
    .intake-qr-url-row { margin-bottom: 8px; }
    .intake-qr-url-label {
      display: block;
      font-size: 10px;
      color: #64748b;
      margin-bottom: 3px;
    }
    .intake-qr-url-input {
      width: 100%;
      font-size: 12px;
      padding: 6px 8px;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      box-sizing: border-box;
    }
    .intake-qr-body { text-align: center; }
    .intake-qr-img {
      width: 160px;
      height: 160px;
      border-radius: 8px;
      background: #fff;
      padding: 6px;
    }
    .intake-qr-link {
      font-size: 10px;
      color: #1d4ed8;
      word-break: break-all;
      margin: 6px 0 0;
    }
    .intake-qr-exp { font-size: 10px; color: #94a3b8; margin: 6px 0 0; }
    .intake-qr-erro { color: #b91c1c; font-size: 12px; margin: 6px 0 0; }
  `],
})
export class OsIntakeQr implements OnChanges {
  @Input() osId?: number;
  /** Gera o QR assim que o componente recebe um osId (ex.: modal pós-salvar). */
  @Input() gerarAutomaticamente = false;
  @Output() intakeAtualizado = new EventEmitter<void>();

  token?: OsIntakeToken;
  qrDataUrl = '';
  gerando = false;
  erro = '';
  urlApp = '';
  readonly urlEditavel = intakeUrlEditavel();

  constructor(private intakeService: OsIntakeService) {
    if (this.urlEditavel) {
      this.urlApp = obterUrlAppIntake() || urlAppIntakePadrao();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['osId']?.currentValue && this.gerarAutomaticamente && !this.gerando) {
      this.gerar();
    }
  }

  persistirUrl(): void {
    if (!this.urlEditavel) return;
    if (this.urlApp.trim()) salvarUrlAppIntake(this.urlApp);
  }

  gerar(): void {
    if (!this.osId) return;
    if (this.urlEditavel) this.persistirUrl();
    this.gerando = true;
    this.erro = '';
    this.intakeService.gerarToken(this.osId).subscribe({
      next: async t => {
        this.token = t;
        this.gerando = false;
        // URL já traz ?h=código curto da sessão (API).
        this.qrDataUrl = await QRCode.toDataURL(t.url, { width: 280, margin: 1, errorCorrectionLevel: 'M' });
        this.intakeAtualizado.emit();
      },
      error: err => {
        this.erro = err.error?.erro || 'Não foi possível gerar o QR. Salve a OS e tente novamente.';
        this.gerando = false;
      },
    });
  }
}
