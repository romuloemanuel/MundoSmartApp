import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  TecnicoSelectDialogService,
  TecnicoSelectDialogRequest,
} from '../../services/tecnico-select-dialog';

@Component({
  selector: 'app-tecnico-select-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="aberto" (click)="cancelar()">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="tecnico-modal-titulo" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 id="tecnico-modal-titulo">Técnico responsável</h3>
          <button type="button" class="modal-close" (click)="cancelar()" aria-label="Fechar">✕</button>
        </div>

        <div class="modal-body">
          <p class="modal-hint" *ngIf="osLabel || situacao">
            <span *ngIf="osLabel">{{ osLabel }}</span>
            <span *ngIf="osLabel && situacao"> · </span>
            <span *ngIf="situacao">Situação: <strong>{{ situacao }}</strong></span>
          </p>
          <p class="modal-hint">
            Selecione o técnico responsável por esta OS. Você pode confirmar o atual ou trocar.
          </p>

          <div class="form-group" *ngIf="tecnicos.length; else semTecnicos">
            <label for="tecnico-select">Técnico <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
            <select
              id="tecnico-select"
              [(ngModel)]="selecionado"
              name="tecnicoSelect"
              autofocus
            >
              <option value="">Selecione...</option>
              <option *ngFor="let t of tecnicos" [value]="t.nome">{{ t.nome }}</option>
            </select>
            <p class="campo-erro" *ngIf="erro">{{ erro }}</p>
          </div>

          <ng-template #semTecnicos>
            <p class="erro">
              Nenhum técnico ativo cadastrado. Cadastre em <strong>Cadastros → Técnicos</strong>.
            </p>
          </ng-template>
        </div>

        <div class="modal-footer">
          <button type="button" (click)="cancelar()">Cancelar</button>
          <button
            type="button"
            class="btn-salvar"
            (click)="confirmar()"
            [disabled]="!tecnicos.length"
          >
            Confirmar
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
      z-index: 1200;
      padding: 16px;
    }
    .modal-box {
      width: 100%;
      max-width: 420px;
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
    .form-group { margin: 0; }
    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }
    .campo-obrigatorio { color: #dc2626; }
    select {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #0f172a;
    }
    select:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .campo-erro {
      display: block;
      margin-top: 6px;
      font-size: 12px;
      color: #dc2626;
    }
    .erro {
      margin: 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 13px;
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
      background: #2563eb !important;
      border-color: #2563eb !important;
      color: #fff !important;
    }
    .btn-salvar:hover { background: #1d4ed8 !important; }
    .btn-salvar:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class TecnicoSelectModal implements OnInit, OnDestroy {
  aberto = false;
  tecnicos: Array<{ nome: string }> = [];
  selecionado = '';
  situacao = '';
  osLabel = '';
  erro = '';

  private sub?: Subscription;

  constructor(private dialog: TecnicoSelectDialogService) {}

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

  private abrir(req: TecnicoSelectDialogRequest): void {
    this.tecnicos = req.tecnicos ?? [];
    this.situacao = req.situacao?.trim() || '';
    this.osLabel = req.osLabel?.trim() || '';
    this.erro = '';

    const atual = req.tecnicoAtual?.trim() || '';
    const valido = !!atual && this.tecnicos.some(
      t => t.nome.toLowerCase() === atual.toLowerCase(),
    );
    this.selecionado = valido
      ? (this.tecnicos.find(t => t.nome.toLowerCase() === atual.toLowerCase())?.nome || '')
      : (this.tecnicos.length === 1 ? this.tecnicos[0].nome : '');

    this.aberto = true;
  }

  confirmar(): void {
    const nome = this.selecionado.trim();
    if (!nome) {
      this.erro = 'Selecione um técnico para continuar.';
      return;
    }
    this.aberto = false;
    this.dialog.complete(nome);
  }

  cancelar(): void {
    if (!this.aberto) return;
    this.aberto = false;
    this.dialog.complete(null);
  }
}
