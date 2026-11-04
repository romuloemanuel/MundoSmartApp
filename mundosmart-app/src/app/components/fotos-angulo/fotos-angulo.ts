import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CATEGORIA_FOTO_OUTRA,
  CATEGORIAS_FOTO_GUIADAS,
  normalizarCategoriaFoto,
  OsFotoCategoriaId,
  rotuloCategoriaFoto,
} from '../../config/os-foto-categoria.config';

/** Foto no mesmo formato da recepção da ordem de serviço. */
export interface FotoAngulo {
  id: string;
  url: string;
  nomeArquivo?: string;
  tipo?: string;
  categoria?: string | null;
  descricaoFoco?: string | null;
  criadoEm?: string | null;
}

export interface FotosAnguloEnvio {
  categoria: OsFotoCategoriaId;
  arquivos: File[];
  descricao?: string;
}

export interface FotosAnguloSubstituir {
  foto: FotoAngulo;
  categoria: OsFotoCategoriaId;
  abrirCamera: () => void;
}

/**
 * Ângulos da recepção (frente, trás, lados, cima, baixo e outra).
 * O mesmo layout da OS, sem a etapa de senha.
 */
@Component({
  selector: 'app-fotos-angulo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../../pages/ordens-servico/intake/intake.scss'],
  styles: [`
    :host {
      min-height: 0;
      display: block;
      color: #e2e8f0;
    }
    :host .intake-mobile-thumb video,
    :host .intake-mobile-thumb img {
      width: 72px;
      height: 72px;
      object-fit: cover;
      display: block;
      border-radius: 8px;
    }
    :host .intake-mobile-lightbox video {
      max-width: 100%;
      max-height: 70dvh;
      border-radius: 8px;
    }
  `],
  template: `
    <div class="intake-foto-preview-envio" *ngIf="enviandoCategoria">
      <img *ngIf="previewUrl" [src]="previewUrl" alt="Enviando…" />
      <p>Enviando foto{{ previewCategoria ? ' (' + rotulo(previewCategoria) + ')' : '' }}…</p>
    </div>

    <div
      class="intake-foto-slot"
      *ngFor="let cat of categoriasGuiadas"
      [attr.data-cat]="cat.id"
      [class.tem-foto]="fotosDa(cat.id).length > 0"
    >
      <div class="intake-foto-slot-topo">
        <span class="intake-foto-slot-ico">{{ cat.icone }}</span>
        <div class="intake-foto-slot-info">
          <strong>{{ cat.titulo }}</strong>
          <span>{{ cat.dica }}</span>
        </div>
        <span class="intake-foto-slot-badge" *ngIf="fotosDa(cat.id).length">
          {{ fotosDa(cat.id).length }}
        </span>
      </div>

      <div class="intake-foto-slot-thumbs" *ngIf="fotosDa(cat.id).length">
        <div class="intake-mobile-thumb-wrap" *ngFor="let f of fotosDa(cat.id)">
          <button type="button" class="intake-mobile-thumb" (click)="lightbox = f">
            <video *ngIf="ehVideo(f)" [src]="resolverUrl(f.url)" muted preload="none"></video>
            <img *ngIf="!ehVideo(f)" [src]="resolverUrl(f.url)" [alt]="cat.titulo" loading="lazy" />
            <span class="intake-mobile-thumb-hora" *ngIf="f.criadoEm">
              {{ f.criadoEm | date:'dd/MM/yy HH:mm':'UTC' }}
            </span>
          </button>
          <div class="intake-mobile-thumb-acoes">
            <button type="button" (click)="lightbox = f">Ver</button>
            <button
              type="button"
              [disabled]="!!enviandoCategoria || excluindoId === f.id"
              (click)="pedirSubstituir(f, cat.id, inputCam)"
            >
              {{ excluindoId === f.id ? '…' : 'Substituir' }}
            </button>
            <button
              type="button"
              class="danger"
              [disabled]="!!enviandoCategoria || excluindoId === f.id"
              (click)="excluir.emit(f)"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      <div class="intake-foto-slot-btns" [class.enviando]="enviandoCategoria === cat.id">
        <label class="intake-foto-slot-btn intake-foto-slot-btn--cam" [class.tem-fotos]="fotosDa(cat.id).length > 0">
          <input
            #inputCam
            type="file"
            accept="image/*"
            capture="environment"
            (change)="onArquivos($event, cat.id)"
            [disabled]="!!enviandoCategoria"
          />
          {{ enviandoCategoria === cat.id ? 'Enviando…' : 'Câmera' }}
        </label>
        <label class="intake-foto-slot-btn intake-foto-slot-btn--gal" [class.tem-fotos]="fotosDa(cat.id).length > 0">
          <input
            type="file"
            accept="image/*"
            (change)="onArquivos($event, cat.id)"
            [disabled]="!!enviandoCategoria"
          />
          Galeria
        </label>
      </div>
    </div>

    <div
      class="intake-foto-slot intake-foto-slot--outra"
      data-cat="outra"
      [class.tem-foto]="fotosDa('outra').length > 0"
    >
      <div class="intake-foto-slot-topo">
        <span class="intake-foto-slot-ico">{{ categoriaOutra.icone }}</span>
        <div class="intake-foto-slot-info">
          <strong>{{ categoriaOutra.titulo }}</strong>
          <span>{{ categoriaOutra.dica }}</span>
        </div>
        <span class="intake-foto-slot-badge" *ngIf="fotosDa('outra').length">
          {{ fotosDa('outra').length }}
        </span>
      </div>

      <input
        class="intake-foto-outra-desc"
        type="text"
        [ngModel]="descricaoOutra"
        (ngModelChange)="descricaoOutraChange.emit($event)"
        maxlength="120"
        placeholder="Ex: rachadura na tela, entrada do carregador…"
        [disabled]="!!enviandoCategoria"
      />

      <div class="intake-foto-slot-thumbs" *ngIf="fotosDa('outra').length">
        <div class="intake-mobile-thumb-wrap" *ngFor="let f of fotosDa('outra')">
          <button type="button" class="intake-mobile-thumb intake-mobile-thumb--outra" (click)="lightbox = f">
            <video *ngIf="ehVideo(f)" [src]="resolverUrl(f.url)" muted preload="none"></video>
            <img *ngIf="!ehVideo(f)" [src]="resolverUrl(f.url)" [alt]="rotulo(f.categoria, f.descricaoFoco)" loading="lazy" />
            <span class="intake-mobile-thumb-leg" *ngIf="f.descricaoFoco">{{ f.descricaoFoco }}</span>
            <span class="intake-mobile-thumb-hora" *ngIf="f.criadoEm">
              {{ f.criadoEm | date:'dd/MM/yy HH:mm':'UTC' }}
            </span>
          </button>
          <div class="intake-mobile-thumb-acoes">
            <button type="button" (click)="lightbox = f">Ver</button>
            <button
              type="button"
              [disabled]="!!enviandoCategoria || excluindoId === f.id"
              (click)="pedirSubstituir(f, 'outra', inputOutraCam)"
            >
              {{ excluindoId === f.id ? '…' : 'Substituir' }}
            </button>
            <button
              type="button"
              class="danger"
              [disabled]="!!enviandoCategoria || excluindoId === f.id"
              (click)="excluir.emit(f)"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      <div class="intake-foto-slot-btns" [class.enviando]="enviandoCategoria === 'outra'">
        <label class="intake-foto-slot-btn intake-foto-slot-btn--cam intake-foto-slot-btn--outra" [class.tem-fotos]="fotosDa('outra').length > 0">
          <input
            #inputOutraCam
            type="file"
            accept="image/*"
            capture="environment"
            (change)="onArquivos($event, 'outra')"
            [disabled]="!!enviandoCategoria"
          />
          {{ enviandoCategoria === 'outra' ? 'Enviando…' : 'Câmera' }}
        </label>
        <label class="intake-foto-slot-btn intake-foto-slot-btn--gal intake-foto-slot-btn--outra" [class.tem-fotos]="fotosDa('outra').length > 0">
          <input
            type="file"
            accept="image/*"
            (change)="onArquivos($event, 'outra')"
            [disabled]="!!enviandoCategoria"
          />
          Galeria
        </label>
      </div>
    </div>

    <p class="intake-mobile-contador">{{ fotos.length }} foto(s) enviada(s)</p>
    <p class="intake-mobile-contador-sub" *ngIf="pendentes > 0">{{ pendentes }} na fila de envio…</p>

    <div class="intake-mobile-lightbox" *ngIf="lightbox as foto" (click)="lightbox = null">
      <button type="button" class="intake-mobile-lightbox-fechar" (click)="lightbox = null">✕</button>
      <p class="intake-mobile-lightbox-leg">
        {{ rotulo(foto.categoria, foto.descricaoFoco) }}
        <span *ngIf="foto.criadoEm">
          · {{ foto.criadoEm | date:'dd/MM/yyyy HH:mm':'UTC' }}
        </span>
      </p>
      <video
        *ngIf="ehVideo(foto)"
        [src]="resolverUrl(foto.url)"
        controls
        playsinline
        (click)="$event.stopPropagation()"
      ></video>
      <img
        *ngIf="!ehVideo(foto)"
        [src]="resolverUrl(foto.url)"
        [alt]="foto.nomeArquivo || 'Foto'"
        (click)="$event.stopPropagation()"
      />
      <div class="intake-mobile-lightbox-acoes" (click)="$event.stopPropagation()">
        <button type="button" class="danger" [disabled]="!!excluindoId" (click)="excluir.emit(foto)">
          Excluir foto
        </button>
      </div>
    </div>
  `,
})
export class FotosAngulo implements OnChanges {
  readonly categoriasGuiadas = CATEGORIAS_FOTO_GUIADAS;
  readonly categoriaOutra = CATEGORIA_FOTO_OUTRA;
  readonly rotulo = rotuloCategoriaFoto;

  @Input() fotos: FotoAngulo[] = [];
  @Input() enviandoCategoria: OsFotoCategoriaId | null = null;
  @Input() excluindoId = '';
  @Input() descricaoOutra = '';
  @Input() pendentes = 0;
  @Input() previewUrl = '';
  @Input() previewCategoria: OsFotoCategoriaId | null = null;
  @Input() resolverUrl: (url: string) => string = url => url;

  @Output() descricaoOutraChange = new EventEmitter<string>();
  @Output() enviar = new EventEmitter<FotosAnguloEnvio>();
  @Output() excluir = new EventEmitter<FotoAngulo>();
  @Output() substituir = new EventEmitter<FotosAnguloSubstituir>();
  @Output() vazio = new EventEmitter<void>();

  lightbox: FotoAngulo | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['fotos'] || !this.lightbox) return;
    if (!this.fotos.some(f => f.id === this.lightbox?.id)) this.lightbox = null;
  }

  fotosDa(categoria: OsFotoCategoriaId): FotoAngulo[] {
    return (this.fotos ?? []).filter(f => normalizarCategoriaFoto(f.categoria) === categoria);
  }

  ehVideo(item: FotoAngulo): boolean {
    if (item.tipo === 'video') return true;
    return /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(item.url ?? '');
  }

  onArquivos(event: Event, categoria: OsFotoCategoriaId): void {
    const input = event.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    input.value = '';
    if (!arquivos.length) {
      this.vazio.emit();
      return;
    }
    const descricao = categoria === 'outra' ? this.descricaoOutra.trim() : undefined;
    if (categoria === 'outra') this.descricaoOutraChange.emit('');
    this.enviar.emit({ categoria, arquivos, descricao });
  }

  pedirSubstituir(foto: FotoAngulo, categoria: OsFotoCategoriaId, input: HTMLInputElement): void {
    if (this.enviandoCategoria || this.excluindoId) return;
    if (!confirm('Substituir esta foto? A anterior será removida.')) return;
    if (this.lightbox?.id === foto.id) this.lightbox = null;
    this.substituir.emit({
      foto,
      categoria,
      abrirCamera: () => setTimeout(() => input.click(), 120),
    });
  }
}
