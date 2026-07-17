import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OsFotoAparelho } from '../../models/bling.models';
import { OsIntakeService, urlArquivoOs } from '../../services/os-intake';
import { OsIntakeQr } from '../os-intake-qr/os-intake-qr';
import {
  CATEGORIA_FOTO_OUTRA,
  CATEGORIAS_FOTO_GUIADAS,
  normalizarCategoriaFoto,
  OsFotoCategoriaId,
  rotuloCategoriaFoto,
} from '../../config/os-foto-categoria.config';

interface GrupoFoto {
  id: OsFotoCategoriaId;
  titulo: string;
  fotos: OsFotoAparelho[];
}

@Component({
  selector: 'app-os-fotos-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, OsIntakeQr],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="os-fotos-panel" [class.os-fotos-panel--readonly]="readonly">
      <div class="os-fotos-header">
        <div>
          <strong class="os-fotos-titulo">
            Fotos do aparelho
            <span class="os-fotos-count" *ngIf="fotosLocais.length">{{ fotosLocais.length }}</span>
          </strong>
          <p class="os-fotos-sub" *ngIf="!readonly">
            Fotos enviadas pelo celular (QR) ou pelo balcão. Clique para ampliar.
          </p>
          <p class="os-fotos-sub" *ngIf="readonly">
            Imagens da recepção via smartphone. Clique para ampliar.
          </p>
        </div>
        <div class="os-fotos-acoes" *ngIf="osId">
          <button type="button" class="btn-sec" (click)="pedirAtualizar()" [disabled]="atualizando">
            {{ atualizando ? 'Atualizando…' : 'Atualizar' }}
          </button>
          <ng-container *ngIf="!readonly">
            <label class="os-fotos-cat-label">
              Ângulo
              <select
                class="os-fotos-cat-select"
                [(ngModel)]="categoriaNova"
                [ngModelOptions]="{standalone: true}"
                [disabled]="enviando"
              >
                <option *ngFor="let c of categoriasEnvio" [value]="c.id">{{ c.titulo }}</option>
              </select>
            </label>
            <input
              *ngIf="categoriaNova === 'outra'"
              class="os-fotos-desc"
              type="text"
              [(ngModel)]="descricaoNova"
              [ngModelOptions]="{standalone: true}"
              maxlength="120"
              placeholder="Descrição (opcional)"
              [disabled]="enviando"
            />
            <label class="btn-prim">
              Adicionar foto
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                (change)="onArquivosSelecionados($event)"
                [disabled]="enviando"
              />
            </label>
          </ng-container>
        </div>
      </div>

      <p class="os-fotos-aviso" *ngIf="!osId">
        Salve a OS para ver/adicionar fotos ou gerar o QR de recepção no celular.
      </p>

      <p class="os-fotos-vazio" *ngIf="osId && !fotosLocais.length && !enviando">
        Nenhuma foto registrada ainda.
      </p>

      <div class="os-fotos-grupos" *ngIf="gruposComFotos.length">
        <div class="os-fotos-grupo" *ngFor="let g of gruposComFotos; trackBy: trackGrupo">
          <h4 class="os-fotos-grupo-tit">
            {{ g.titulo }}
            <span class="os-fotos-grupo-n">{{ g.fotos.length }}</span>
          </h4>
          <div class="os-fotos-grid">
            <figure class="os-foto-item" *ngFor="let f of g.fotos; trackBy: trackFoto">
              <button type="button" class="os-foto-thumb" (click)="abrirLightbox(f)">
                <img [src]="urlFoto(f.url)" [alt]="f.nomeArquivo" loading="lazy" />
              </button>
              <figcaption class="os-foto-meta">
                <label class="os-foto-cat-edit" *ngIf="!readonly; else catReadonly">
                  <select
                    [ngModel]="normalizarCat(f.categoria)"
                    (ngModelChange)="onCategoriaFotoChange(f, $event)"
                    [ngModelOptions]="{standalone: true}"
                    [name]="'cat_' + f.id"
                    [disabled]="alterandoId === f.id"
                  >
                    <option *ngFor="let c of categoriasEnvio" [value]="c.id">{{ c.titulo }}</option>
                  </select>
                </label>
                <ng-template #catReadonly>
                  <span class="os-foto-cat">{{ rotuloFoto(f.categoria, f.descricaoFoco) }}</span>
                </ng-template>
                <span *ngIf="f.criadoEm">{{ f.criadoEm | date:'dd/MM/yy HH:mm':'America/Sao_Paulo' }}</span>
              </figcaption>
              <div class="os-foto-bar">
                <a class="os-foto-link" [href]="urlFoto(f.url)" target="_blank" rel="noopener">Abrir</a>
                <button type="button" class="os-foto-link-btn" (click)="abrirLightbox(f)">Ampliar</button>
                <button
                  type="button"
                  class="os-foto-excluir"
                  *ngIf="!readonly"
                  (click)="excluir(f)"
                  [disabled]="excluindoId === f.id"
                >
                  {{ excluindoId === f.id ? '…' : 'Excluir' }}
                </button>
              </div>
            </figure>
          </div>
        </div>
      </div>

      <p class="os-fotos-erro" *ngIf="erro">{{ erro }}</p>
      <p class="os-fotos-enviando" *ngIf="enviando">Enviando foto(s)…</p>

      <app-os-intake-qr
        *ngIf="osId && !readonly && mostrarQr"
        [osId]="osId"
        (intakeAtualizado)="pedirAtualizar()"
      />
    </section>

    <div class="os-fotos-lightbox" *ngIf="lightboxFoto" (click)="fecharLightbox()">
      <div class="os-fotos-lightbox-inner" (click)="$event.stopPropagation()">
        <button type="button" class="os-fotos-lightbox-fechar" (click)="fecharLightbox()">✕</button>
        <img [src]="urlFoto(lightboxFoto.url)" [alt]="lightboxFoto.nomeArquivo" />
        <p class="os-fotos-lightbox-meta">
          {{ rotuloFoto(lightboxFoto.categoria, lightboxFoto.descricaoFoco) }}
          <span *ngIf="lightboxFoto.criadoEm"> · {{ lightboxFoto.criadoEm | date:'dd/MM/yyyy HH:mm' }}</span>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .os-fotos-panel {
      margin: 0;
      padding: 16px;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      background: #f8fbff;
    }
    .os-fotos-panel--readonly {
      border-color: #cbd5e1;
      background: #f8fafc;
    }
    .os-fotos-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .os-fotos-titulo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      color: #0f172a;
    }
    .os-fotos-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      border-radius: 999px;
      background: #2563eb;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }
    .os-fotos-sub {
      margin: 4px 0 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .os-fotos-acoes {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px;
    }
    .os-fotos-cat-label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .os-fotos-cat-select, .os-fotos-desc {
      font-size: 12px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      color: #0f172a;
    }
    .os-fotos-desc { width: 160px; }
    .os-foto-cat-edit select {
      font-size: 11px;
      padding: 2px 4px;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      max-width: 100%;
      background: #fff;
    }
    .btn-sec, .btn-prim {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      font-weight: 600;
    }
    .btn-sec {
      background: #fff;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-sec:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-prim {
      background: #2563eb;
      color: #fff;
      display: inline-flex;
      align-items: center;
    }
    .os-fotos-aviso, .os-fotos-vazio {
      margin: 0;
      font-size: 12px;
      color: #64748b;
      font-style: italic;
    }
    .os-fotos-erro { color: #b91c1c; font-size: 12px; margin: 8px 0 0; }
    .os-fotos-enviando { color: #2563eb; font-size: 12px; margin: 8px 0 0; }
    .os-fotos-grupos {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 10px;
    }
    .os-fotos-grupo-tit {
      margin: 0 0 8px;
      font-size: 12px;
      color: #1e40af;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .os-fotos-grupo-n {
      font-size: 10px;
      background: #dbeafe;
      color: #1e40af;
      padding: 1px 6px;
      border-radius: 999px;
    }
    .os-fotos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px;
    }
    .os-foto-item {
      margin: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .os-foto-thumb {
      display: block;
      width: 100%;
      padding: 0;
      border: none;
      background: #f1f5f9;
      cursor: pointer;
    }
    .os-foto-thumb img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      display: block;
    }
    .os-foto-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px 8px;
      font-size: 10px;
      color: #64748b;
    }
    .os-foto-cat { font-weight: 600; color: #334155; }
    .os-foto-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 0 6px 8px;
    }
    .os-foto-link, .os-foto-link-btn, .os-foto-excluir {
      font-size: 10px;
      padding: 3px 6px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      cursor: pointer;
      text-decoration: none;
    }
    .os-foto-excluir { color: #b91c1c; border-color: #fecaca; }
    .os-fotos-lightbox {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(15, 23, 42, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .os-fotos-lightbox-inner {
      position: relative;
      max-width: min(92vw, 900px);
      max-height: 92vh;
      text-align: center;
    }
    .os-fotos-lightbox-inner img {
      max-width: 100%;
      max-height: calc(92vh - 48px);
      border-radius: 8px;
    }
    .os-fotos-lightbox-fechar {
      position: absolute;
      top: -36px;
      right: 0;
      background: transparent;
      border: none;
      color: #fff;
      font-size: 22px;
      cursor: pointer;
    }
    .os-fotos-lightbox-meta {
      color: #e2e8f0;
      font-size: 12px;
      margin: 8px 0 0;
    }
  `],
})
export class OsFotosPanel implements OnInit, OnDestroy, OnChanges {
  @Input() osId?: number;
  @Input() fotos: OsFotoAparelho[] = [];
  @Input() readonly = false;
  @Input() mostrarQr = true;
  @Input() atualizando = false;
  @Output() atualizar = new EventEmitter<void>();
  @Output() fotosAlteradas = new EventEmitter<OsFotoAparelho[]>();

  /** Cópia local — evita remount do grid a cada keystroke do form pai. */
  fotosLocais: OsFotoAparelho[] = [];
  gruposComFotos: GrupoFoto[] = [];

  enviando = false;
  excluindoId = '';
  alterandoId = '';
  erro = '';
  lightboxFoto?: OsFotoAparelho;
  categoriaNova: OsFotoCategoriaId = 'frente';
  descricaoNova = '';

  readonly rotuloFoto = rotuloCategoriaFoto;
  readonly categoriasEnvio = [...CATEGORIAS_FOTO_GUIADAS, CATEGORIA_FOTO_OUTRA];
  readonly normalizarCat = normalizarCategoriaFoto;
  private pollTimer?: ReturnType<typeof setInterval>;
  private assinaturaFotos = '';

  constructor(
    private intakeService: OsIntakeService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sincronizarFotos(this.fotos);
    this.pollTimer = setInterval(() => {
      if (!this.osId || this.enviando || this.alterandoId || document.hidden) return;
      this.atualizar.emit();
    }, 10000);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fotos'] && !this.enviando && !this.alterandoId) {
      this.sincronizarFotos(this.fotos);
    }
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (!document.hidden && this.osId && !this.enviando && !this.alterandoId) {
      this.atualizar.emit();
    }
  };

  private sincronizarFotos(lista?: OsFotoAparelho[] | null): void {
    const fotos = [...(lista ?? [])];
    const assinatura = fotos
      .map(f => `${f.id}:${normalizarCategoriaFoto(f.categoria)}:${f.descricaoFoco ?? ''}`)
      .sort()
      .join('|');
    if (assinatura === this.assinaturaFotos) return;
    this.assinaturaFotos = assinatura;
    this.fotosLocais = fotos;
    this.gruposComFotos = this.montarGrupos(fotos);
    this.cdr.markForCheck();
  }

  private montarGrupos(lista: OsFotoAparelho[]): GrupoFoto[] {
    if (!lista.length) return [];
    const ordem = [...CATEGORIAS_FOTO_GUIADAS.map(c => c.id), CATEGORIA_FOTO_OUTRA.id];
    const mapa = new Map<OsFotoCategoriaId, OsFotoAparelho[]>();
    for (const id of ordem) mapa.set(id, []);
    for (const f of lista) {
      mapa.get(normalizarCategoriaFoto(f.categoria))!.push(f);
    }
    const titulos = new Map<OsFotoCategoriaId, string>([
      ...CATEGORIAS_FOTO_GUIADAS.map(c => [c.id, c.titulo] as const),
      [CATEGORIA_FOTO_OUTRA.id, CATEGORIA_FOTO_OUTRA.titulo],
    ]);
    return ordem
      .map(id => ({ id, titulo: titulos.get(id) ?? id, fotos: mapa.get(id) ?? [] }))
      .filter(g => g.fotos.length > 0);
  }

  private aplicarListaLocal(fotos: OsFotoAparelho[]): void {
    this.fotosLocais = [...fotos];
    this.assinaturaFotos = fotos
      .map(f => `${f.id}:${normalizarCategoriaFoto(f.categoria)}:${f.descricaoFoco ?? ''}`)
      .sort()
      .join('|');
    this.gruposComFotos = this.montarGrupos(this.fotosLocais);
    this.fotosAlteradas.emit(this.fotosLocais);
    this.cdr.markForCheck();
  }

  urlFoto(url: string): string {
    return urlArquivoOs(url);
  }

  trackFoto(_: number, f: OsFotoAparelho): string {
    return f.id;
  }

  trackGrupo(_: number, g: GrupoFoto): string {
    return g.id;
  }

  pedirAtualizar(): void {
    this.atualizar.emit();
  }

  abrirLightbox(foto: OsFotoAparelho): void {
    this.lightboxFoto = foto;
    this.cdr.markForCheck();
  }

  fecharLightbox(): void {
    this.lightboxFoto = undefined;
    this.cdr.markForCheck();
  }

  onArquivosSelecionados(event: Event): void {
    if (!this.osId || this.enviando) return;
    const input = event.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    input.value = '';
    if (!arquivos.length) return;

    const categoria = this.categoriaNova;
    const descricao = categoria === 'outra' ? this.descricaoNova.trim() || undefined : undefined;
    const osId = this.osId;

    this.enviando = true;
    this.erro = '';
    this.cdr.markForCheck();

    let pendentes = arquivos.length;
    const novas = [...this.fotosLocais];
    let houveErro = false;

    const finalizarSePronto = () => {
      if (pendentes > 0) return;
      this.enviando = false;
      this.aplicarListaLocal(novas);
      if (!houveErro && categoria === 'outra') this.descricaoNova = '';
    };

    for (const arquivo of arquivos) {
      this.intakeService.enviarFotoOs(osId, arquivo, categoria, descricao).subscribe({
        next: foto => {
          novas.push(foto);
          pendentes -= 1;
          finalizarSePronto();
        },
        error: err => {
          houveErro = true;
          this.erro = err.error?.erro || 'Não foi possível enviar a foto.';
          pendentes -= 1;
          finalizarSePronto();
        },
      });
    }
  }

  onCategoriaFotoChange(foto: OsFotoAparelho, categoria: OsFotoCategoriaId): void {
    if (!this.osId || !foto.id) return;
    const atual = normalizarCategoriaFoto(foto.categoria);
    if (atual === categoria) return;

    const anterior = foto.categoria;
    // Otimista: evita select “voltando” e remount enquanto o HTTP anda.
    foto.categoria = categoria;
    this.aplicarListaLocal(this.fotosLocais.map(f => (f.id === foto.id ? { ...f, categoria } : f)));

    this.alterandoId = foto.id;
    this.erro = '';
    this.intakeService.atualizarCategoriaFotoOs(this.osId, foto.id, categoria).subscribe({
      next: atualizada => {
        this.alterandoId = '';
        this.aplicarListaLocal(
          this.fotosLocais.map(f => (f.id === atualizada.id ? { ...f, ...atualizada } : f)),
        );
      },
      error: err => {
        this.erro = err.error?.erro || 'Não foi possível alterar o ângulo da foto.';
        this.alterandoId = '';
        this.aplicarListaLocal(
          this.fotosLocais.map(f => (f.id === foto.id ? { ...f, categoria: anterior } : f)),
        );
      },
    });
  }

  excluir(foto: OsFotoAparelho): void {
    if (!this.osId || !confirm('Excluir esta foto?')) return;
    this.excluindoId = foto.id;
    this.erro = '';
    this.cdr.markForCheck();
    this.intakeService.removerFotoOs(this.osId, foto.id).subscribe({
      next: () => {
        this.excluindoId = '';
        if (this.lightboxFoto?.id === foto.id) this.fecharLightbox();
        this.aplicarListaLocal(this.fotosLocais.filter(f => f.id !== foto.id));
      },
      error: err => {
        this.erro = err.error?.erro || 'Não foi possível excluir a foto.';
        this.excluindoId = '';
        this.cdr.markForCheck();
      },
    });
  }
}
