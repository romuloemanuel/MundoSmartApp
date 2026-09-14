import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  forwardRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  corpoDocumentoParaHtml,
  escapeHtml,
} from '../../utils/documento-template.util';

@Component({
  selector: 'app-documento-corpo-editor',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DocumentoCorpoEditor),
      multi: true,
    },
  ],
  template: `
    <div class="doc-editor">
      <div class="doc-toolbar" role="toolbar" aria-label="Formatação do contrato">
        <button type="button" (mousedown)="$event.preventDefault()" (click)="bloco('h1')">Título</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="bloco('h2')">Seção</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="bloco('p')">Parágrafo</button>
        <span class="sep"></span>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('bold')" title="Negrito"><b>N</b></button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('italic')" title="Itálico"><i>I</i></button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('underline')" title="Sublinhado"><u>S</u></button>
        <span class="sep"></span>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('justifyLeft')" title="Esquerda">⟸</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('justifyCenter')" title="Centro">⇔</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('justifyFull')" title="Justificar">☰</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('insertUnorderedList')">Lista</button>
        <span class="sep"></span>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="inserirAssinaturas()">Assinaturas</button>
      </div>
      <p class="hint">
        Formate o texto como no papel. Variáveis ficam como
        <code>{{ exemploVar }}</code> — use Inserir no texto na tabela abaixo.
      </p>
      <div class="doc-mesa">
        <div
          #area
          class="doc-folha doc-folha-edit"
          contenteditable="true"
          role="textbox"
          aria-label="Texto do contrato"
          (input)="onInput()"
          (paste)="onPaste($event)"
        ></div>
      </div>
    </div>
  `,
  styleUrl: './documento-corpo-editor.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DocumentoCorpoEditor implements ControlValueAccessor, AfterViewInit {
  @ViewChild('area') area?: ElementRef<HTMLDivElement>;
  readonly exemploVar = '{{chave}}';

  private valor = '';
  private onChange: (v: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngAfterViewInit(): void {
    this.escreverNoEditor(this.htmlAtual());
  }

  writeValue(valor: string | null): void {
    this.valor = valor ?? '';
    const el = this.area?.nativeElement;
    if (el && el !== document.activeElement) {
      this.escreverNoEditor(this.htmlAtual());
    }
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  inserirTexto(texto: string): void {
    const el = this.area?.nativeElement;
    el?.focus();
    if (!document.execCommand('insertHTML', false, escapeHtml(texto))) {
      this.valor = (this.valor || '') + texto;
      this.escreverNoEditor(this.htmlAtual());
    }
    this.sincronizar();
  }

  cmd(comando: string): void {
    this.area?.nativeElement.focus();
    document.execCommand(comando, false);
    this.sincronizar();
  }

  bloco(tag: 'h1' | 'h2' | 'p'): void {
    this.area?.nativeElement.focus();
    document.execCommand('formatBlock', false, `<${tag}>`);
    this.sincronizar();
  }

  inserirAssinaturas(): void {
    const html = `<div class="assinaturas">
      <div>
        <p class="ass-rotulo">Vendedor(a)</p>
        <p class="ass-nome">{{vendedora_nome}}</p>
        <p class="ass-linha">_____________________________</p>
        <p>CPF: {{vendedora_cpf}}</p>
      </div>
      <div>
        <p class="ass-rotulo">Compradora</p>
        <p class="ass-nome">{{compradora_razao_social}}</p>
        <p class="ass-linha">_____________________________</p>
        <p>CNPJ: {{compradora_cnpj}}</p>
      </div>
    </div>`;
    this.area?.nativeElement.focus();
    document.execCommand('insertHTML', false, html);
    this.sincronizar();
  }

  onPaste(ev: ClipboardEvent): void {
    ev.preventDefault();
    const texto = ev.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, texto);
    this.sincronizar();
  }

  onInput(): void {
    this.onTouched();
    this.sincronizar();
  }

  private htmlAtual(): string {
    return corpoDocumentoParaHtml(this.valor);
  }

  private escreverNoEditor(html: string): void {
    const el = this.area?.nativeElement;
    if (!el || el.innerHTML === html) return;
    el.innerHTML = html;
  }

  private sincronizar(): void {
    const html = this.area?.nativeElement.innerHTML ?? this.valor;
    this.valor = html;
    this.onChange(html);
  }
}
