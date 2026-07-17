import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AparelhosService } from '../../services/aparelhos';
import { ModeloAparelho } from '../../models/bling.models';
import { TIPOS_DISPOSITIVO } from '../../config/aparelhos.config';

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
            <label>Observações</label>
            <textarea [(ngModel)]="modelo.observacoes" name="observacoes" rows="2"
              placeholder="Telas/baterias compartilhadas, variantes..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" (click)="fechar()">Cancelar</button>
          <button type="button" (click)="salvar()" [disabled]="salvando">
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .modal-box-wide { max-width: 520px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e7eb; }
  `,
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

  constructor(private service: AparelhosService) {}

  ngOnInit(): void {
    this.modelo.nome = this.nomeInicial;
    this.modelo.tipoDispositivo = this.tipoDispositivoInicial || 'Celular';
  }

  salvar(): void {
    this.erro = '';
    if (!this.modelo.marcaNome?.trim() || !this.modelo.nome?.trim()) {
      this.erro = 'Marca e nome do modelo são obrigatórios.';
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
