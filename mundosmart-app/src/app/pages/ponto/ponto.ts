import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LOJAS_OS, labelLojaOs } from '../../config/os-loja.config';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../services/user-feedback.service';
import {
  PontoAparelho,
  PontoBatida,
  PontoService,
  PontoStatus,
} from '../../services/ponto.service';

@Component({
  selector: 'app-ponto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Ponto eletrônico</h1>
          <p class="hint">
            Só Admin/Root. Até 3 aparelhos liberados. A senha vale até meia-noite (Brasília).
            Bater ponto: colaborador + senha do dia + selfie + GPS.
          </p>
        </div>
      </div>

      <p class="erro" *ngIf="erro">{{ erro }}</p>

      <section class="card" *ngIf="status">
        <h2>Este aparelho</h2>
        <p class="ok" *ngIf="status.esteAparelhoLiberado">
          Liberado para bater ponto ({{ status.vagasUsadas }}/{{ status.maximoAparelhos }} vagas).
        </p>
        <p class="aviso" *ngIf="!status.esteAparelhoLiberado">
          Este navegador ainda não está liberado.
          {{ status.vagasLivres }} vaga(s) livre(s) de {{ status.maximoAparelhos }}.
        </p>
        <div class="form-row" *ngIf="!status.esteAparelhoLiberado">
          <label>Apelido</label>
          <input [(ngModel)]="apelido" name="apelido" placeholder="Celular da loja — Mococa" />
          <label>Loja</label>
          <select [(ngModel)]="lojaOrigem" name="lojaOrigem">
            <option [ngValue]="null">Selecione…</option>
            <option *ngFor="let l of lojas" [ngValue]="l.codigo">{{ l.sigla }} — {{ l.nome }}</option>
          </select>
          <button type="button" class="primary" [disabled]="liberando" (click)="liberar()">
            {{ liberando ? 'Liberando…' : 'Liberar este aparelho' }}
          </button>
        </div>
      </section>

      <section class="card" *ngIf="status">
        <h2>Aparelhos (máx. {{ status.maximoAparelhos }})</h2>
        <table class="grid" *ngIf="status.aparelhos.length">
          <thead>
            <tr>
              <th>Apelido</th>
              <th>Loja</th>
              <th>Status</th>
              <th>GPS da loja</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of status.aparelhos" [class.inativo]="!a.ativo">
              <td>
                {{ a.apelido }}
                <span class="este" *ngIf="a.id === status.esteAparelhoId">este</span>
              </td>
              <td>{{ a.lojaOrigem ? labelLoja(a.lojaOrigem) : '—' }}</td>
              <td>{{ a.ativo ? 'Liberado' : 'Revogado' }}</td>
              <td>{{ a.temGps ? 'Sim' : 'Não' }}</td>
              <td>
                <button
                  *ngIf="a.ativo"
                  type="button"
                  class="danger"
                  (click)="revogar(a)"
                >Revogar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="hint" *ngIf="!status.aparelhos.length">Nenhum aparelho ainda.</p>
      </section>

      <section class="card" *ngIf="status">
        <h2>Senha do dia</h2>
        <p class="senha" *ngIf="status.senhaDoDia">{{ status.senhaDoDia }}</p>
        <p class="aviso" *ngIf="!status.senhaDoDia">Ainda não gerada para hoje.</p>
        <button type="button" class="primary" [disabled]="gerandoSenha" (click)="gerarSenha()">
          {{ status.senhaDoDia ? 'Trocar senha do dia' : 'Gerar senha do dia' }}
        </button>
      </section>

      <section class="card kiosk" *ngIf="status?.esteAparelhoLiberado">
        <h2>Bater ponto</h2>
        <label>Colaborador</label>
        <select [(ngModel)]="usuarioId" name="usuarioId">
          <option value="">Selecione…</option>
          <option *ngFor="let c of status?.colaboradores" [value]="c.id">{{ c.nome }}</option>
        </select>
        <label>Senha do dia</label>
        <input [(ngModel)]="senha" name="senha" inputmode="numeric" maxlength="8" autocomplete="off" />
        <label>Selfie</label>
        <input type="file" accept="image/*" capture="user" (change)="aoFoto($event)" />
        <p class="hint" *ngIf="fotoNome">Foto: {{ fotoNome }}</p>
        <div class="tipos">
          <button type="button" [disabled]="batendo" (click)="bater('entrada')">Entrada</button>
          <button type="button" [disabled]="batendo" (click)="bater('almoco')">Almoço</button>
          <button type="button" [disabled]="batendo" (click)="bater('volta')">Volta</button>
          <button type="button" [disabled]="batendo" (click)="bater('saida')">Saída</button>
        </div>
      </section>

      <section class="card" *ngIf="status">
        <h2>Batidas de hoje</h2>
        <table class="grid" *ngIf="batidas.length">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Colaborador</th>
              <th>Tipo</th>
              <th>GPS</th>
              <th>Foto</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of batidas">
              <td>{{ b.horario | date:'HH:mm':'UTC' }}</td>
              <td>{{ b.usuarioNome }}</td>
              <td>{{ labelTipo(b.tipo) }}</td>
              <td>
                <span *ngIf="b.semGps">sem GPS</span>
                <span *ngIf="!b.semGps && b.foraDaLoja">longe da loja{{ dist(b) }}</span>
                <span *ngIf="!b.semGps && !b.foraDaLoja">ok{{ dist(b) }}</span>
              </td>
              <td>
                <a *ngIf="b.fotoUrl" [href]="fotoUrl(b.fotoUrl)" target="_blank" rel="noopener">ver</a>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="hint" *ngIf="!batidas.length">Nenhuma batida hoje.</p>
      </section>
    </div>
  `,
  styles: [`
    .page { padding: 16px 20px; max-width: 920px; }
    .page-header h1 { margin: 0; font-size: 20px; }
    .hint { font-size: 13px; color: #64748b; margin: 8px 0 0; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 16px; }
    h2 { margin: 0 0 10px; font-size: 15px; }
    .grid { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
    .inativo { opacity: 0.55; }
    .este { font-size: 11px; background: #0f172a; color: #fff; border-radius: 999px; padding: 1px 7px; margin-left: 6px; }
    button { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px; }
    button.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
    button.danger { color: #b91c1c; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    label { display: block; margin: 10px 0 6px; font-size: 13px; font-weight: 600; }
    input, select { width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .form-row { display: grid; gap: 4px; }
    .ok { color: #047857; font-size: 14px; }
    .aviso { color: #b45309; font-size: 14px; }
    .erro { color: #b91c1c; }
    .senha { font-size: 32px; letter-spacing: 6px; font-weight: 700; margin: 8px 0 12px; }
    .tipos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
    .tipos button { padding: 14px; font-weight: 600; background: #0f172a; color: #fff; border-color: #0f172a; }
    .kiosk { max-width: 420px; }
  `],
})
export class PontoPage implements OnInit {
  readonly lojas = LOJAS_OS;
  status: PontoStatus | null = null;
  batidas: PontoBatida[] = [];
  erro = '';
  apelido = 'Celular da loja';
  lojaOrigem: string | null = 'MCC';
  usuarioId = '';
  senha = '';
  foto: File | null = null;
  fotoNome = '';
  liberando = false;
  gerandoSenha = false;
  batendo = false;

  constructor(private ponto: PontoService) {}

  ngOnInit(): void {
    this.carregar();
  }

  labelLoja(cod: string): string {
    return labelLojaOs(cod);
  }

  labelTipo(tipo: string): string {
    switch (tipo) {
      case 'entrada': return 'Entrada';
      case 'almoco': return 'Almoço';
      case 'volta': return 'Volta';
      case 'saida': return 'Saída';
      default: return tipo;
    }
  }

  dist(b: PontoBatida): string {
    if (b.distanciaLojaMetros == null) return '';
    return ` (${Math.round(b.distanciaLojaMetros)} m)`;
  }

  fotoUrl(path: string): string {
    return this.ponto.urlFoto(path);
  }

  carregar(): void {
    this.erro = '';
    this.ponto.status().subscribe({
      next: s => {
        this.status = s;
        if (!s.esteAparelhoLiberado && this.ponto.tokenLocal()) {
          this.ponto.limparToken();
        }
      },
      error: e => {
        this.erro = e?.error?.erro || 'Não foi possível carregar o ponto.';
      },
    });
    this.ponto.batidas().subscribe({
      next: lista => (this.batidas = lista),
      error: () => (this.batidas = []),
    });
  }

  private geo(): Promise<{ latitude: number | null; longitude: number | null; precisao: number | null }> {
    const vazio = { latitude: null as number | null, longitude: null as number | null, precisao: null as number | null };
    if (!navigator.geolocation) return Promise.resolve(vazio);
    const pedido = new Promise<typeof vazio>(resolve => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precisao: p.coords.accuracy,
        }),
        () => resolve(vazio),
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 },
      );
    });
    const limite = new Promise<typeof vazio>(resolve => setTimeout(() => resolve(vazio), 4500));
    return Promise.race([pedido, limite]);
  }

  async liberar(): Promise<void> {
    this.liberando = true;
    const g = await this.geo();
    this.ponto.liberar({
      apelido: this.apelido,
      lojaOrigem: this.lojaOrigem,
      tokenExistente: this.ponto.tokenLocal(),
      latitude: g.latitude,
      longitude: g.longitude,
    }).subscribe({
      next: () => {
        this.liberando = false;
        avisarSucessoUsuario('Aparelho liberado. Pode gerar a senha do dia e bater ponto.');
        this.carregar();
      },
      error: e => {
        this.liberando = false;
        avisarErroUsuario(e?.error?.erro || 'Não foi possível liberar este aparelho.');
      },
    });
  }

  revogar(a: PontoAparelho): void {
    if (!confirm(`Revogar “${a.apelido}”? A vaga fica livre para outro celular.`)) return;
    this.ponto.revogar(a.id).subscribe({
      next: () => {
        if (this.status?.esteAparelhoId === a.id) this.ponto.limparToken();
        avisarSucessoUsuario('Aparelho revogado.');
        this.carregar();
      },
      error: e => avisarErroUsuario(e?.error?.erro || 'Não foi possível revogar.'),
    });
  }

  gerarSenha(): void {
    this.gerandoSenha = true;
    this.ponto.gerarSenha().subscribe({
      next: r => {
        this.gerandoSenha = false;
        if (this.status) this.status = { ...this.status, senhaDoDia: r.senha };
        avisarSucessoUsuario('Senha do dia gerada. Vale até meia-noite.');
      },
      error: e => {
        this.gerandoSenha = false;
        avisarErroUsuario(e?.error?.erro || 'Não foi possível gerar a senha.');
      },
    });
  }

  aoFoto(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.foto = input.files?.[0] ?? null;
    this.fotoNome = this.foto?.name ?? '';
  }

  async bater(tipo: string): Promise<void> {
    if (!this.usuarioId) {
      avisarErroUsuario('Selecione o colaborador.');
      return;
    }
    if (!this.senha.trim()) {
      avisarErroUsuario('Informe a senha do dia.');
      return;
    }
    if (!this.foto) {
      avisarErroUsuario('Tire a selfie para bater o ponto.');
      return;
    }
    this.batendo = true;
    const g = await this.geo();
    const form = new FormData();
    form.append('usuarioId', this.usuarioId);
    form.append('tipo', tipo);
    form.append('senha', this.senha.trim());
    if (g.latitude != null) form.append('latitude', String(g.latitude));
    if (g.longitude != null) form.append('longitude', String(g.longitude));
    if (g.precisao != null) form.append('precisaoMetros', String(g.precisao));
    form.append('foto', this.foto, 'selfie.jpg');
    this.ponto.bater(form).subscribe({
      next: () => {
        this.batendo = false;
        this.senha = '';
        this.foto = null;
        this.fotoNome = '';
        avisarSucessoUsuario('Ponto registrado.');
        this.carregar();
      },
      error: e => {
        this.batendo = false;
        avisarErroUsuario(e?.error?.erro || 'Não foi possível bater o ponto.');
      },
    });
  }
}
