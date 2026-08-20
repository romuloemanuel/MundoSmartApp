import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AparelhosService } from '../../services/aparelhos';
import { ModeloAparelho } from '../../models/bling.models';
import { TIPOS_DISPOSITIVO, TIPOS_TELA } from '../../config/aparelhos.config';
import { avisarErroUsuario } from '../../services/user-feedback.service';

@Component({
  selector: 'app-cadastro-aparelho-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="fechar()">
      <div class="modal-box modal-box-wide" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Novo Modelo</h3>
          <button type="button" class="modal-close" (click)="fechar()">✕</button>
        </div>

        <div class="modal-body">
          <p *ngIf="erro" class="erro">{{ erro }}</p>

          <div class="form-row">
            <div class="form-group">
              <label>Marca <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
              <input [(ngModel)]="modelo.marcaNome" name="marcaNome" placeholder="Ex: Samsung, iPhone..." />
            </div>
            <div class="form-group" style="flex:2">
              <label>Nome do modelo <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
              <input [(ngModel)]="modelo.nome" name="modeloNome" placeholder="Ex: Galaxy A54" />
            </div>
          </div>

          <div class="form-group">
            <label>Tipo de dispositivo <span class="campo-obrigatorio" aria-hidden="true">*</span></label>
            <select [(ngModel)]="modelo.tipoDispositivo" name="tipoDispositivo">
              <option *ngFor="let t of tiposDispositivo" [value]="t">{{ t }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Tipo de tela</label>
            <select [(ngModel)]="modelo.tipoTela" name="tipoTela">
              <option *ngFor="let t of tiposTela" [value]="t.valor">{{ t.label }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Observações</label>
            <textarea [(ngModel)]="modelo.observacoes" name="observacoes" rows="2"
              placeholder="Telas/baterias compartilhadas, variantes..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-cancelar" (click)="fechar()">Cancelar</button>
          <button type="button" class="btn-salvar" (click)="salvar()" [disabled]="salvando">
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </button>
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
      max-width: 600px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }
    .modal-box-wide { max-width: 520px; }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border-bottom: 1px solid #f1f5f9;
      background: #0d0d0d;
      border-radius: 12px 12px 0 0;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.5px;
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
    .modal-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 24px;
      border-top: 1px solid #f1f5f9;
    }
    .modal-footer button {
      padding: 9px 20px;
      font-size: 13px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-cancelar {
      background: #f1f5f9;
      color: #374151;
      border: 1px solid #e2e8f0;
    }
    .btn-cancelar:hover { background: #e2e8f0; }
    .btn-salvar {
      background: #2563EB;
      color: #fff;
      border: none;
    }
    .btn-salvar:disabled { opacity: 0.6; cursor: not-allowed; }
    .form-group {
      display: flex;
      flex-direction: column;
      margin-bottom: 14px;
    }
    .form-group label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .form-group input,
    .form-group select,
    .form-group textarea {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .form-row { display: flex; gap: 12px; }
    .form-row .form-group { flex: 1; }
    .erro {
      color: #dc2626;
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 12px;
    }
    .campo-obrigatorio { color: #dc2626; }
  `],
})
export class CadastroAparelhoModal implements OnInit {
  @Input() nomeInicial = '';
  @Input() tipoDispositivoInicial = 'Celular';

  @Output() fechado = new EventEmitter<void>();
  @Output() modeloSalvo = new EventEmitter<ModeloAparelho>();

  modelo: ModeloAparelho = { nome: '', marcaNome: '', tipoDispositivo: 'Celular', aparelhosCompativeis: [] };
  salvando = false;
  erro = '';
  readonly tiposDispositivo = TIPOS_DISPOSITIVO;
  readonly tiposTela = TIPOS_TELA;

  constructor(private service: AparelhosService) {}

  ngOnInit(): void {
    this.modelo.nome = this.nomeInicial;
    this.modelo.tipoDispositivo = this.tipoDispositivoInicial || 'Celular';
  }

  salvar(): void {
    this.erro = '';
    if (!this.modelo.marcaNome?.trim() || !this.modelo.nome?.trim()) {
      this.erro = 'Marca e nome do modelo são obrigatórios.';
      avisarErroUsuario(this.erro);
      return;
    }

    this.salvando = true;
    this.modelo.marcaNome = this.modelo.marcaNome.trim();
    this.modelo.nome = this.modelo.nome.trim();

    this.service.criarModelo(this.modelo).subscribe({
      next: (m) => {
        this.modeloSalvo.emit(m);
        this.fechado.emit();
      },
      error: () => {
        this.erro = 'Erro ao salvar modelo.';
        this.salvando = false;
      },
    });
  }

  fechar(): void {
    this.fechado.emit();
  }
}
