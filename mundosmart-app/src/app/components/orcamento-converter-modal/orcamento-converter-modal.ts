import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { BlingOrcamento } from '../../models/bling.models';

@Component({
  selector: 'app-orcamento-converter-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <div class="backdrop" (click)="onCancelar()">
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="orc-conv-titulo" (click)="$event.stopPropagation()">
        <header class="card-head">
          <p class="eyebrow">Pré-orçamento → OS</p>
          <h3 id="orc-conv-titulo">Transformar em Ordem de Serviço</h3>
          <p class="sub">
            Vamos abrir a tela de <strong>nova OS</strong> já com cliente, aparelho,
            serviços e valores deste pré-orçamento. Você completa os campos obrigatórios
            (senha, estado da tela etc.) e só então salva a OS.
          </p>
        </header>

        <section class="resumo" *ngIf="orcamento as o">
          <div class="resumo-linha">
            <span>Orçamento</span>
            <strong>#{{ o.numero || o.id }}</strong>
          </div>
          <div class="resumo-linha">
            <span>Cliente</span>
            <strong>{{ o.contato?.nome || '—' }}</strong>
          </div>
          <div class="resumo-linha">
            <span>Aparelho</span>
            <strong>{{ aparelho(o) }}</strong>
          </div>
          <div class="resumo-linha">
            <span>Validade</span>
            <strong>{{ o.validade | date:'dd/MM/yyyy' }}</strong>
          </div>
          <div class="resumo-linha destaque">
            <span>Valor combinado</span>
            <strong>{{ valor(o) | currency:'BRL' }}</strong>
          </div>
          <div class="resumo-linha" *ngIf="o.valorAVista != null">
            <span>À vista (vai para a grid da OS)</span>
            <strong>{{ o.valorAVista | currency:'BRL' }}</strong>
          </div>
          <div class="resumo-linha" *ngIf="o.valorAPrazo != null">
            <span>Parcelado{{ o.parcelasPagamento && o.parcelasPagamento >= 2 ? ' (' + o.parcelasPagamento + 'x)' : '' }}</span>
            <strong>{{ o.valorAPrazo | currency:'BRL' }}</strong>
          </div>
          <div class="resumo-linha" *ngIf="o.garantiaMeses">
            <span>Garantia combinada</span>
            <strong>{{ o.garantiaMeses }} meses</strong>
          </div>
        </section>

        <ul class="lista-efeitos">
          <li>Cliente, modelo, valores (à vista/parcelado), garantia e itens são copiados</li>
          <li>A OS só é criada quando você salvar na tela de inclusão</li>
          <li>Com peça em estoque no item, a baixa ocorre ao salvar a OS</li>
        </ul>

        <p class="erro" *ngIf="erro">{{ erro }}</p>

        <footer class="acoes">
          <button type="button" class="btn-sec" (click)="onCancelar()" [disabled]="convertendo">
            Cancelar
          </button>
          <button type="button" class="btn-pri" (click)="onConfirmar()" [disabled]="convertendo">
            {{ convertendo ? 'Abrindo…' : 'Continuar para nova OS' }}
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1200;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(2px);
    }
    .card {
      width: min(480px, 100%);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      overflow: hidden;
    }
    .card-head {
      padding: 22px 22px 8px;
      background: linear-gradient(160deg, #eff6ff 0%, #fff 70%);
      border-bottom: 1px solid #e2e8f0;
    }
    .eyebrow {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: #2563eb;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 1.25rem;
      color: #0f172a;
    }
    .sub {
      margin: 0 0 14px;
      font-size: 13px;
      color: #64748b;
      line-height: 1.45;
    }
    .resumo {
      padding: 16px 22px;
      display: grid;
      gap: 10px;
    }
    .resumo-linha {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
    }
    .resumo-linha span { color: #64748b; }
    .resumo-linha strong { color: #0f172a; text-align: right; }
    .resumo-linha.destaque {
      margin-top: 4px;
      padding-top: 12px;
      border-top: 1px dashed #e2e8f0;
      font-size: 15px;
    }
    .resumo-linha.destaque strong { color: #1d4ed8; }
    .lista-efeitos {
      margin: 0;
      padding: 0 22px 16px 42px;
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }
    .lista-efeitos li { margin-bottom: 4px; }
    .erro {
      margin: 0 22px 12px;
      color: #b91c1c;
      font-size: 13px;
    }
    .acoes {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 22px 20px;
      border-top: 1px solid #f1f5f9;
      background: #f8fafc;
    }
    .btn-sec, .btn-pri {
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-sec {
      background: #fff;
      border: 1px solid #cbd5e1;
      color: #334155;
    }
    .btn-pri {
      background: #2563eb;
      color: #fff;
    }
    .btn-pri:disabled, .btn-sec:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class OrcamentoConverterModal {
  @Input({ required: true }) orcamento!: BlingOrcamento;
  @Input() convertendo = false;
  @Input() erro = '';
  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  aparelho(o: BlingOrcamento): string {
    if (o.equipamento?.trim()) return o.equipamento.trim();
    return [o.marcaNome, o.modeloNome].filter(Boolean).join(' ') || '—';
  }

  valor(o: BlingOrcamento): number {
    return o.valorTotalAcordado ?? o.valorTotal ?? 0;
  }

  onConfirmar(): void {
    if (this.convertendo) return;
    this.confirmar.emit();
  }

  onCancelar(): void {
    if (this.convertendo) return;
    this.cancelar.emit();
  }
}
