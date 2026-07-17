import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export type SenhaDispositivoTipo = '' | 'numerica' | 'desenho' | 'nao_deixou' | 'sem_senha';

interface LinhaPadrao {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: 'app-senha-dispositivo-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="senha-dev" [class.senha-dev-readonly]="readonly" [class.senha-dev-invalido]="invalido">
      <label class="senha-dev-label">
        Senha do dispositivo (teste)
        <span *ngIf="obrigatorio" class="campo-obrigatorio" aria-hidden="true">*</span>
      </label>

      <ng-container *ngIf="!readonly">
        <div class="senha-dev-tipo" role="radiogroup" aria-label="Tipo de senha do aparelho">
          <label class="senha-dev-opcao" *ngIf="!ocultarSemSenha">
            <input
              type="radio"
              [name]="grupoRadio"
              [checked]="tipo === 'sem_senha'"
              (change)="alterarTipo('sem_senha')"
            />
            Sem senha
          </label>
          <label class="senha-dev-opcao">
            <input
              type="radio"
              [name]="grupoRadio"
              [checked]="tipo === 'numerica'"
              (change)="alterarTipo('numerica')"
            />
            Senha (nº / letras)
          </label>
          <label class="senha-dev-opcao">
            <input
              type="radio"
              [name]="grupoRadio"
              [checked]="tipo === 'desenho'"
              (change)="alterarTipo('desenho')"
            />
            Desenho
          </label>
          <label class="senha-dev-opcao" *ngIf="!ocultarSemSenha">
            <input
              type="radio"
              [name]="grupoRadio"
              [checked]="tipo === 'nao_deixou'"
              (change)="alterarTipo('nao_deixou')"
            />
            Cliente não deixou senha
          </label>
        </div>

        <p class="senha-dev-hint" *ngIf="!tipo">Selecione o tipo de senha do aparelho.</p>

        <input
          *ngIf="tipo === 'numerica'"
          class="senha-dev-pin"
          [class.senha-dev-pin-texto]="!valorSoDigitos"
          [ngModel]="valor"
          (ngModelChange)="alterarValor($event)"
          name="senhaDispositivoPin"
          inputmode="text"
          autocomplete="off"
          maxlength="32"
          placeholder="Ex: 1234 ou Maria"
        />

        <div *ngIf="tipo === 'desenho'" class="senha-dev-padrao-wrap">
          <p class="senha-dev-hint">Clique e arraste ligando os pontos do desenho do cliente.</p>
          <div
            class="senha-dev-grade-interativa"
            (pointermove)="moverArrasto($event)"
            (pointerup)="finalizarArrasto($event)"
            (pointercancel)="finalizarArrasto($event)"
            (pointerleave)="finalizarArrasto($event)"
          >
            <svg class="senha-dev-linhas" viewBox="0 0 156 146" aria-hidden="true">
              <line
                *ngFor="let l of linhasPadrao"
                [attr.x1]="l.x1"
                [attr.y1]="l.y1"
                [attr.x2]="l.x2"
                [attr.y2]="l.y2"
              />
            </svg>
            <button
              type="button"
              *ngFor="let cel of celulas"
              class="senha-dev-ponto"
              [attr.data-cel]="cel"
              [class.senha-dev-ponto-ativo]="indiceAtivo(cel)"
              [class.senha-dev-ponto-ultimo]="ultimoIndice === cel"
              (pointerdown)="iniciarArrasto($event, cel)"
            >{{ ordemNoPadrao(cel) || '' }}</button>
          </div>
          <button type="button" class="senha-dev-limpar" (click)="limparPadrao()">Limpar desenho</button>
        </div>

        <p *ngIf="tipo === 'nao_deixou'" class="senha-dev-hint senha-dev-nao-deixou">
          Registrado que o cliente não informou a senha do aparelho.
        </p>
        <p *ngIf="tipo === 'sem_senha'" class="senha-dev-hint">
          Aparelho sem senha de desbloqueio.
        </p>
      </ng-container>

      <div *ngIf="readonly && tipo === 'nao_deixou'" class="senha-dev-resumo">
        <span class="senha-dev-resumo-tipo">Cliente não deixou senha</span>
      </div>

      <div *ngIf="readonly && tipo === 'sem_senha'" class="senha-dev-resumo">
        <span class="senha-dev-resumo-tipo">Sem senha no aparelho</span>
      </div>

      <div *ngIf="readonly && tipo && tipo !== 'nao_deixou' && tipo !== 'sem_senha' && valor" class="senha-dev-resumo">
        <span class="senha-dev-resumo-tipo">{{ rotuloTipo }}</span>
        <span *ngIf="tipo === 'numerica'" class="senha-dev-resumo-valor">{{ valor }}</span>
        <div *ngIf="tipo === 'desenho'" class="senha-dev-grade senha-dev-grade-readonly">
          <svg class="senha-dev-linhas" viewBox="0 0 156 146" aria-hidden="true">
            <line
              *ngFor="let l of linhasPadrao"
              [attr.x1]="l.x1"
              [attr.y1]="l.y1"
              [attr.x2]="l.x2"
              [attr.y2]="l.y2"
            />
          </svg>
          <span
            *ngFor="let cel of celulas"
            class="senha-dev-ponto"
            [class.senha-dev-ponto-ativo]="indiceAtivo(cel)"
          >{{ ordemNoPadrao(cel) || '' }}</span>
        </div>
      </div>
      <p *ngIf="readonly && !tipo" class="senha-dev-vazio">—</p>
      <p class="campo-erro" *ngIf="invalido && mensagemErro">{{ mensagemErro }}</p>
    </div>
  `,
  styles: [`
    .senha-dev-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }

    .senha-dev-tipo {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-bottom: 8px;
    }

    .senha-dev-opcao {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #4b5563;
      cursor: pointer;
    }

    .senha-dev-pin {
      width: 100%;
      max-width: 260px;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 16px;
      letter-spacing: 2px;
      font-weight: 600;
    }

    .senha-dev-pin-texto {
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .senha-dev-hint {
      margin: 0 0 6px;
      font-size: 11px;
      color: #6b7280;
    }

    .senha-dev-nao-deixou {
      color: #b45309;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 4px;
    }

    .senha-dev-padrao-wrap { max-width: 180px; }

    .senha-dev-grade,
    .senha-dev-grade-interativa {
      position: relative;
      display: grid;
      grid-template-columns: repeat(3, 42px);
      gap: 10px;
      width: 156px;
      height: 146px;
      margin-bottom: 6px;
      touch-action: none;
      user-select: none;
    }

    .senha-dev-grade-interativa {
      cursor: crosshair;
    }

    .senha-dev-linhas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    }

    .senha-dev-linhas line {
      stroke: #2563eb;
      stroke-width: 3;
      stroke-linecap: round;
    }

    .senha-dev-ponto {
      position: relative;
      z-index: 1;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      background: #fff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 700;
      cursor: crosshair;
      padding: 0;
      line-height: 1;
      touch-action: none;
    }

    .senha-dev-readonly .senha-dev-ponto {
      cursor: default;
    }

    .senha-dev-ponto-ativo {
      border-color: #2563eb;
      background: #dbeafe;
    }

    .senha-dev-ponto-ultimo {
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);
    }

    .senha-dev-limpar {
      font-size: 11px;
      color: #2563eb;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-decoration: underline;
    }

    .senha-dev-resumo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }

    .senha-dev-resumo-tipo {
      font-size: 11px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
    }

    .senha-dev-resumo-valor {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #1f2937;
      word-break: break-word;
    }

    .senha-dev-grade-readonly { margin: 0; }

    .senha-dev-vazio {
      margin: 0;
      color: #9ca3af;
      font-size: 13px;
    }

    .senha-dev-invalido {
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #fca5a5;
      background: #fef2f2;
    }

    .campo-obrigatorio { color: #dc2626; margin-left: 2px; }

    .campo-erro {
      margin: 6px 0 0;
      font-size: 12px;
      color: #dc2626;
    }
  `],
})
export class SenhaDispositivoField {
  @Input() tipo: SenhaDispositivoTipo = '';
  @Input() valor = '';
  @Input() readonly = false;
  /** Oculta opção "Sem senha" (fluxo recepção mobile). */
  @Input() ocultarSemSenha = false;
  @Input() obrigatorio = false;
  @Input() invalido = false;
  @Input() mensagemErro = '';

  @Output() tipoChange = new EventEmitter<SenhaDispositivoTipo>();
  @Output() valorChange = new EventEmitter<string>();

  readonly celulas = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  /** Nome único evita pré-seleção cruzada entre instâncias do componente. */
  readonly grupoRadio = `senhaTipo_${Math.random().toString(36).slice(2, 9)}`;

  private arrastando = false;
  private containerArrasto?: HTMLElement;

  get rotuloTipo(): string {
    if (this.tipo === 'numerica') return 'Senha';
    if (this.tipo === 'desenho') return 'Desenho';
    if (this.tipo === 'nao_deixou') return 'Cliente não deixou senha';
    if (this.tipo === 'sem_senha') return 'Sem senha';
    return '';
  }

  get valorSoDigitos(): boolean {
    return !!this.valor && /^\d+$/.test(this.valor);
  }

  get ultimoIndice(): number | null {
    const pts = this.padraoIndices();
    return pts.length ? pts[pts.length - 1] : null;
  }

  get linhasPadrao(): LinhaPadrao[] {
    const pts = this.padraoIndices();
    const linhas: LinhaPadrao[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      linhas.push({
        x1: this.centroX(a),
        y1: this.centroY(a),
        x2: this.centroX(b),
        y2: this.centroY(b),
      });
    }
    return linhas;
  }

  alterarTipo(novo: SenhaDispositivoTipo): void {
    this.tipo = novo;
    if (novo === 'nao_deixou') this.valor = 'nao_deixou';
    else if (novo === 'sem_senha') this.valor = 'sem_senha';
    else this.valor = '';
    this.arrastando = false;
    this.tipoChange.emit(this.tipo);
    this.valorChange.emit(this.valor);
  }

  alterarValor(novo: string): void {
    // Aceita números e letras (PIN ou senha alfanumérica / nome).
    this.valor = (novo ?? '').replace(/[^\p{L}\p{N}\s._\-@]/gu, '').trimStart();
    this.valorChange.emit(this.valor);
  }

  iniciarArrasto(event: PointerEvent, indice: number): void {
    if (this.readonly || this.tipo !== 'desenho') return;
    event.preventDefault();
    event.stopPropagation();

    this.arrastando = true;
    this.containerArrasto = (event.currentTarget as HTMLElement).closest('.senha-dev-grade-interativa') as HTMLElement;
    this.containerArrasto?.setPointerCapture(event.pointerId);

    this.definirPadrao([indice]);
  }

  moverArrasto(event: PointerEvent): void {
    if (!this.arrastando || this.readonly || this.tipo !== 'desenho') return;

    const alvo = this.indiceSobPonteiro(event);
    if (alvo === null) return;

    this.estenderPadrao(alvo);
  }

  finalizarArrasto(event: PointerEvent): void {
    if (!this.arrastando) return;
    this.arrastando = false;
    if (this.containerArrasto?.hasPointerCapture(event.pointerId)) {
      this.containerArrasto.releasePointerCapture(event.pointerId);
    }
    this.containerArrasto = undefined;
  }

  limparPadrao(): void {
    this.arrastando = false;
    this.valor = '';
    this.valorChange.emit(this.valor);
  }

  indiceAtivo(indice: number): boolean {
    return this.padraoIndices().includes(indice);
  }

  ordemNoPadrao(indice: number): number | null {
    const pos = this.padraoIndices().indexOf(indice);
    return pos >= 0 ? pos + 1 : null;
  }

  private indiceSobPonteiro(event: PointerEvent): number | null {
    const el = document.elementFromPoint(event.clientX, event.clientY);
    const ponto = el?.closest('[data-cel]') as HTMLElement | null;
    if (!ponto?.dataset['cel']) return null;
    const indice = parseInt(ponto.dataset['cel'], 10);
    return Number.isNaN(indice) ? null : indice;
  }

  private estenderPadrao(alvo: number): void {
    const pts = [...this.padraoIndices()];
    if (!pts.length) {
      this.definirPadrao([alvo]);
      return;
    }

    const ultimo = pts[pts.length - 1];
    if (ultimo === alvo) return;

    for (const p of this.pontosEntre(ultimo, alvo)) {
      if (!pts.includes(p)) pts.push(p);
    }

    this.definirPadrao(pts);
  }

  private definirPadrao(pts: number[]): void {
    const novo = pts.join(',');
    if (novo === this.valor) return;
    this.valor = novo;
    this.valorChange.emit(this.valor);
  }

  /** Preenche pontos intermediários em linha reta (como padrão Android). */
  private pontosEntre(a: number, b: number): number[] {
    const ra = Math.floor(a / 3);
    const ca = a % 3;
    const rb = Math.floor(b / 3);
    const cb = b % 3;
    const dr = rb - ra;
    const dc = cb - ca;

    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [b];

    const passos = Math.max(Math.abs(dr), Math.abs(dc));
    if (passos <= 1) return [b];

    const resultado: number[] = [];
    const sr = dr === 0 ? 0 : dr / Math.abs(dr);
    const sc = dc === 0 ? 0 : dc / Math.abs(dc);

    for (let s = 1; s <= passos; s++) {
      resultado.push((ra + sr * s) * 3 + (ca + sc * s));
    }
    return resultado;
  }

  private padraoIndices(): number[] {
    if (!this.valor?.trim()) return [];
    return this.valor
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(n => !Number.isNaN(n) && n >= 0 && n <= 8);
  }

  private centroX(indice: number): number {
    return (indice % 3) * 52 + 21;
  }

  private centroY(indice: number): number {
    return Math.floor(indice / 3) * 52 + 21;
  }
}
