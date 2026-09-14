import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { montarHtmlDocumento } from '../../utils/documento-template.util';

@Component({
  selector: 'app-documento-a4-preview',
  standalone: true,
  template: `
    <div class="a4-preview" #viewport>
      <p class="a4-preview-rotulo">{{ rotulo }}</p>
      <div
        class="a4-preview-zoom"
        [style.transform]="'scale(' + escala + ')'"
        [style.width.px]="larguraZoom"
        [style.height.px]="alturaZoom"
      >
        <iframe
          #frame
          class="a4-preview-frame"
          title="Pré-visualização A4"
        ></iframe>
      </div>
    </div>
  `,
  styles: [`
    .a4-preview {
      background: #d4d8de;
      border-radius: 8px;
      padding: 10px 10px 14px;
      overflow: auto;
      max-height: calc(100vh - 160px);
    }
    .a4-preview-rotulo {
      margin: 0 0 8px 4px;
      font-family: 'Segoe UI', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #64748b;
    }
    .a4-preview-zoom {
      transform-origin: top center;
      margin: 0 auto;
      overflow: hidden;
    }
    .a4-preview-frame {
      display: block;
      width: 210mm;
      min-height: 297mm;
      border: 0;
      background: transparent;
      pointer-events: none;
    }
  `],
})
export class DocumentoA4Preview implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('viewport') viewport?: ElementRef<HTMLElement>;
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>;

  @Input() titulo = '';
  @Input() corpo = '';
  @Input() duasVias = false;
  @Input() extras: string[] = [];
  @Input() rotulo = 'Pré-visualização A4';

  escala = 1;
  larguraZoom = 0;
  alturaZoom = 0;

  private resizeObs?: ResizeObserver;
  private htmlAtual = '';
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.escreverFolha(true);
    const el = this.viewport?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.ajustarEscala());
      this.resizeObs.observe(el);
    }
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.escreverFolha(false);
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.timer) clearTimeout(this.timer);
  }

  private escreverFolha(imediato: boolean): void {
    if (this.timer) clearTimeout(this.timer);
    if (imediato) {
      this.escreverAgora();
      return;
    }
    this.timer = setTimeout(() => this.escreverAgora(), 80);
  }

  private escreverAgora(): void {
    const iframe = this.frame?.nativeElement;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;

    const html = montarHtmlDocumento(
      this.titulo || 'Documento',
      this.corpo ?? '',
      this.duasVias,
      this.extras ?? [],
    );
    if (html === this.htmlAtual && doc.body?.childNodes.length) {
      this.ajustarEscala();
      return;
    }
    this.htmlAtual = html;
    doc.open();
    doc.write(html);
    doc.close();
    const medir = () => {
      const altura = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0,
        iframe.offsetHeight,
      );
      iframe.style.height = `${Math.max(altura, 1)}px`;
      this.ajustarEscala();
    };
    requestAnimationFrame(() => {
      medir();
      setTimeout(medir, 60);
    });
  }

  private ajustarEscala(): void {
    const viewport = this.viewport?.nativeElement;
    const iframe = this.frame?.nativeElement;
    if (!viewport || !iframe) return;
    const folhaLargura = iframe.offsetWidth || 1;
    const folhaAltura = iframe.offsetHeight || 1;
    const util = Math.max(120, viewport.clientWidth - 24);
    this.escala = Math.min(1, util / folhaLargura);
    this.larguraZoom = folhaLargura * this.escala;
    this.alturaZoom = folhaAltura * this.escala;
    this.cdr.markForCheck();
  }
}
