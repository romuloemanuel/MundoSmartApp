import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AparelhoLojaService } from '../../../services/aparelho-loja.service';

@Component({
  selector: 'app-aparelho-fotos-celular',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagina">
      <header>
        <span class="marca">MUNDO SMART</span>
        <strong>Fotos e vídeos do aparelho</strong>
      </header>

      <p class="aviso" *ngIf="erro">{{ erro }}</p>
      <p class="ok" *ngIf="sucesso">{{ sucesso }}</p>

      <ng-container *ngIf="!erro || fotos.length">
        <p class="texto">
          Tire fotos do aparelho ou grave vídeos. Os vídeos vão com o áudio do celular.
        </p>
        <button type="button" class="camera" (click)="camera.click()" [disabled]="enviando || !token">
          {{ enviando ? 'Enviando…' : 'Tirar fotos' }}
        </button>
        <button type="button" class="camera video" (click)="filmadora.click()" [disabled]="enviando || !token">
          Gravar vídeos com áudio
        </button>
        <button type="button" class="camera galeria" (click)="galeria.click()" [disabled]="enviando || !token">
          Escolher da galeria
        </button>
        <input #camera type="file" accept="image/*" capture="environment" hidden (change)="enviar($event)" />
        <input #filmadora type="file" accept="video/*" capture="environment" hidden (change)="enviar($event)" />
        <input #galeria type="file" accept="image/*,video/*" hidden (change)="enviar($event)" />
        <p class="contagem" *ngIf="fotos.length">{{ resumo }}</p>
        <div class="grade">
          <ng-container *ngFor="let f of fotos">
            <video *ngIf="ehVideo(f)" [src]="f.url" controls playsinline preload="metadata"></video>
            <img *ngIf="!ehVideo(f)" [src]="f.url" alt="Foto enviada" />
          </ng-container>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .pagina { min-height: 100%; padding: 20px 16px 32px; color: #e2e8f0; font-family: inherit; }
    header { margin-bottom: 18px; }
    .marca { display: block; font-size: 11px; letter-spacing: .14em; color: #93c5fd; }
    header strong { font-size: 22px; }
    .texto { margin: 0 0 16px; line-height: 1.45; color: #cbd5e1; }
    .camera {
      width: 100%;
      border: 0;
      border-radius: 12px;
      background: #2563eb;
      color: #fff;
      font-size: 18px;
      font-weight: 700;
      padding: 16px;
    }
    .camera:disabled { opacity: .6; }
    .camera.video { background: #0f766e; margin-top: 10px; }
    .camera.galeria { background: transparent; color: #e2e8f0; border: 1px solid #475569; margin-top: 10px; font-size: 16px; }
    .contagem { margin: 14px 0 8px; color: #86efac; }
    .grade { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .grade img, .grade video { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; background: #0f172a; }
    .aviso, .ok { border-radius: 10px; padding: 10px 12px; }
    .aviso { background: #7f1d1d; }
    .ok { background: #14532d; }
  `],
})
export class AparelhoFotosCelularPage implements OnInit {
  token = '';
  fotos: { id: string; url: string; tipo?: string }[] = [];
  enviando = false;
  erro = '';
  sucesso = '';

  constructor(
    private route: ActivatedRoute,
    private api: AparelhoLojaService,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.erro = 'Link inválido.';
      return;
    }
    this.api.sessaoFotos(this.token).subscribe({
      next: sessao => { this.fotos = sessao.fotos ?? []; },
      error: () => { this.erro = 'Este QR expirou. Peça outro no balcão.'; },
    });
  }

  enviar(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (!arquivo || !this.token) return;
    const video = arquivo.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(arquivo.name);
    const limite = video ? 40 * 1024 * 1024 : 8 * 1024 * 1024;
    if (arquivo.size > limite) {
      this.erro = video ? 'Cada vídeo pode ter no máximo 40 MB.' : 'Cada foto pode ter no máximo 8 MB.';
      input.value = '';
      return;
    }
    this.enviando = true;
    this.erro = '';
    this.sucesso = '';
    this.api.enviarFotoSessao(this.token, arquivo).subscribe({
      next: foto => {
        this.fotos = [...this.fotos, foto];
        this.enviando = false;
        this.sucesso = this.ehVideo(foto) ? 'Vídeo com áudio enviado.' : 'Foto enviada.';
        input.value = '';
      },
      error: (err: { error?: { erro?: string } }) => {
        this.enviando = false;
        this.erro = err?.error?.erro || 'Não foi possível enviar.';
        input.value = '';
      },
    });
  }

  get resumo(): string {
    const videos = this.fotos.filter(f => this.ehVideo(f)).length;
    const fotos = this.fotos.length - videos;
    const partes: string[] = [];
    if (fotos === 1) partes.push('1 foto');
    else if (fotos > 1) partes.push(`${fotos} fotos`);
    if (videos === 1) partes.push('1 vídeo');
    else if (videos > 1) partes.push(`${videos} vídeos`);
    return partes.join(' e ') + ' enviado(s)';
  }

  ehVideo(item: { tipo?: string; url?: string }): boolean {
    if (item.tipo === 'video') return true;
    return /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(item.url ?? '');
  }
}
