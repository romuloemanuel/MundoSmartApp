import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { timeout, catchError, throwError, TimeoutError } from 'rxjs';
import { AparelhoLojaService } from '../../../services/aparelho-loja.service';
import { urlArquivoOs } from '../../../services/os-intake';
import {
  FotoAngulo,
  FotosAngulo,
  FotosAnguloEnvio,
  FotosAnguloSubstituir,
} from '../../../components/fotos-angulo/fotos-angulo';
import { OsFotoCategoriaId, rotuloCategoriaFoto } from '../../../config/os-foto-categoria.config';
import { prepararArquivoParaUpload } from '../../../utils/preparar-arquivo-foto';

const UPLOAD_TIMEOUT_MS = 90_000;

/** Mesmo fluxo de fotos da ordem de serviço, sem pedir senha. */
@Component({
  selector: 'app-aparelho-fotos-celular',
  standalone: true,
  imports: [CommonModule, FotosAngulo],
  template: `
    <div class="intake-mobile">
      <header class="intake-mobile-header">
        <div class="intake-mobile-brand">
          <span class="intake-mobile-logo">MUNDO SMART</span>
          <span class="intake-mobile-tag">Fotos do aparelho</span>
        </div>
        <div class="intake-mobile-os" *ngIf="!carregando && !erro">
          <span class="intake-mobile-os-num" *ngIf="codigo">{{ codigo }}</span>
          <span class="intake-mobile-os-aparelho" *ngIf="marca || modelo">{{ marca }} {{ modelo }}</span>
        </div>
      </header>

      <div class="intake-mobile-loading" *ngIf="carregando">
        <div class="intake-mobile-spinner"></div>
        <p>Carregando fotos...</p>
      </div>

      <div class="intake-mobile-toast intake-mobile-toast--erro" *ngIf="erro && !carregando" role="alert">
        <span class="intake-mobile-toast-ico">!</span>
        <p>{{ erro }}</p>
        <button type="button" class="intake-mobile-toast-fechar" (click)="erro = ''" aria-label="Fechar">✕</button>
      </div>

      <div class="intake-mobile-toast intake-mobile-toast--ok" *ngIf="sucesso && !carregando" role="status">
        <span class="intake-mobile-toast-ico">✓</span>
        <p>{{ sucesso }}</p>
        <button type="button" class="intake-mobile-toast-fechar" (click)="sucesso = ''" aria-label="Fechar">✕</button>
      </div>

      <ng-container *ngIf="!carregando && token && !linkInvalido">
        <section class="intake-mobile-card" *ngIf="!concluido">
          <h2>Fotografar o aparelho</h2>
          <p class="intake-mobile-hint">
            Em cada ângulo use <strong>Câmera</strong> para fotografar ou <strong>Galeria</strong> para escolher uma imagem. Depois, toque na miniatura para ver ou substituir.
          </p>

          <div class="intake-foto-preview-envio" *ngIf="enviandoCategoria && !previewLocalUrl">
            <p>Preparando envio…</p>
          </div>

          <app-fotos-angulo
            [fotos]="fotos"
            [enviandoCategoria]="enviandoCategoria"
            [excluindoId]="excluindoId"
            [descricaoOutra]="descricaoOutra"
            (descricaoOutraChange)="descricaoOutra = $event"
            [pendentes]="pendentes"
            [previewUrl]="previewLocalUrl"
            [previewCategoria]="previewCategoria"
            [resolverUrl]="urlFoto"
            (enviar)="onEnviar($event)"
            (excluir)="excluir($event)"
            (substituir)="substituir($event)"
            (vazio)="avisarVazio()"
          />

          <button
            type="button"
            class="intake-mobile-btn-prim"
            *ngIf="fotos.length"
            (click)="concluir()"
          >
            Concluir ✓
          </button>
        </section>

        <section class="intake-mobile-card intake-mobile-sucesso" *ngIf="concluido">
          <div class="intake-mobile-sucesso-ico">✓</div>
          <h2>Fotos registradas</h2>
          <p class="intake-mobile-hint">
            Pode fechar esta página e devolver o celular ao balcão.
          </p>
          <button type="button" class="intake-mobile-btn-sec" (click)="concluido = false">
            Voltar e editar fotos
          </button>
          <p class="intake-mobile-contador">{{ fotos.length }} foto(s)</p>
        </section>
      </ng-container>

      <footer class="intake-mobile-footer">
        <span>Mundo Smart</span>
      </footer>
    </div>
  `,
  styleUrl: '../../ordens-servico/intake/intake.scss',
})
export class AparelhoFotosCelularPage implements OnInit, OnDestroy {
  readonly urlFoto = urlArquivoOs;
  readonly rotulo = rotuloCategoriaFoto;

  token = '';
  fotos: FotoAngulo[] = [];
  codigo = '';
  marca = '';
  modelo = '';
  carregando = true;
  linkInvalido = false;
  erro = '';
  sucesso = '';
  concluido = false;
  enviandoCategoria: OsFotoCategoriaId | null = null;
  pendentes = 0;
  excluindoId = '';
  descricaoOutra = '';
  previewLocalUrl = '';
  previewCategoria: OsFotoCategoriaId | null = null;

  private sucessoTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private api: AparelhoLojaService,
    private title: Title,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Fotos do aparelho — Mundo Smart');
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.erro = 'Link inválido.';
      this.linkInvalido = true;
      this.carregando = false;
      return;
    }
    this.api.sessaoFotos(this.token).subscribe({
      next: sessao => {
        this.fotos = sessao.fotos ?? [];
        this.codigo = sessao.codigo ?? '';
        this.marca = sessao.marca ?? '';
        this.modelo = sessao.modelo ?? '';
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Este QR expirou. Peça outro no balcão.';
        this.linkInvalido = true;
        this.carregando = false;
      },
    });
  }

  ngOnDestroy(): void {
    if (this.sucessoTimer) clearTimeout(this.sucessoTimer);
    this.limparPreview();
  }

  avisarVazio(): void {
    this.erro = 'Nenhuma foto selecionada. Tente novamente (câmera ou galeria).';
  }

  onEnviar(envio: FotosAnguloEnvio): void {
    this.erro = '';
    this.sucesso = '';
    this.enviandoCategoria = envio.categoria;
    this.pendentes = envio.arquivos.length;
    try {
      const preparados = envio.arquivos.map(f => prepararArquivoParaUpload(f));
      this.enviarSequencial(preparados, envio.categoria, envio.descricao);
    } catch (e: unknown) {
      this.enviandoCategoria = null;
      this.pendentes = 0;
      this.limparPreview();
      this.erro = e instanceof Error ? e.message : 'Não foi possível ler a foto. Tente de novo.';
    }
  }

  excluir(foto: FotoAngulo): void {
    if (this.enviandoCategoria || this.excluindoId || !this.token) return;
    if (!confirm('Excluir esta foto?')) return;
    this.excluindoId = foto.id;
    this.api.removerFotoSessao(this.token, foto.id).subscribe({
      next: sessao => {
        this.fotos = sessao.fotos ?? this.fotos.filter(f => f.id !== foto.id);
        this.excluindoId = '';
        this.mostrarSucesso('Foto excluída.');
      },
      error: (err: { error?: { erro?: string } }) => {
        this.excluindoId = '';
        this.erro = err?.error?.erro || 'Não foi possível excluir a foto.';
      },
    });
  }

  substituir(ev: FotosAnguloSubstituir): void {
    if (this.enviandoCategoria || this.excluindoId || !this.token) return;
    this.excluindoId = ev.foto.id;
    this.api.removerFotoSessao(this.token, ev.foto.id).subscribe({
      next: sessao => {
        this.fotos = sessao.fotos ?? this.fotos.filter(f => f.id !== ev.foto.id);
        this.excluindoId = '';
        this.mostrarSucesso('Foto removida. Escolha a nova imagem.');
        ev.abrirCamera();
      },
      error: (err: { error?: { erro?: string } }) => {
        this.excluindoId = '';
        this.erro = err?.error?.erro || 'Não foi possível remover a foto para substituir.';
      },
    });
  }

  concluir(): void {
    this.concluido = true;
    this.sucesso = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private enviarSequencial(
    files: File[],
    categoria: OsFotoCategoriaId,
    descricao?: string,
    enviadas = 0,
  ): void {
    if (!files.length) {
      this.enviandoCategoria = null;
      this.pendentes = 0;
      this.limparPreview();
      if (enviadas > 0) {
        const rotulo = this.rotulo(categoria);
        this.mostrarSucesso(
          enviadas === 1
            ? `Foto de “${rotulo}” anexada. Toque na miniatura para ver ou substituir.`
            : `${enviadas} fotos de “${rotulo}” anexadas.`,
        );
      }
      return;
    }
    const file = files[0];
    this.limparPreview();
    if (file.size <= 4 * 1024 * 1024) this.previewLocalUrl = URL.createObjectURL(file);
    this.previewCategoria = categoria;
    this.api.enviarFotoSessao(this.token, file, categoria, descricao).pipe(
      timeout(UPLOAD_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => ({
            error: { erro: 'Tempo esgotado ao enviar. Verifique o Wi‑Fi e tente de novo.' },
          }));
        }
        return throwError(() => err);
      }),
    ).subscribe({
      next: foto => {
        this.fotos = [...this.fotos, foto];
        this.pendentes = Math.max(0, files.length - 1);
        this.enviarSequencial(files.slice(1), categoria, descricao, enviadas + 1);
      },
      error: (err: { error?: { erro?: string } }) => {
        this.enviandoCategoria = null;
        this.pendentes = 0;
        this.limparPreview();
        this.erro = err?.error?.erro || 'Não foi possível enviar a foto.';
      },
    });
  }

  private mostrarSucesso(msg: string): void {
    this.sucesso = msg;
    if (this.sucessoTimer) clearTimeout(this.sucessoTimer);
    this.sucessoTimer = setTimeout(() => { this.sucesso = ''; }, 4500);
  }

  private limparPreview(): void {
    if (this.previewLocalUrl) URL.revokeObjectURL(this.previewLocalUrl);
    this.previewLocalUrl = '';
    this.previewCategoria = null;
  }
}
