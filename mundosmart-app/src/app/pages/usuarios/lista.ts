import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../services/usuarios';
import { AppUsuario } from '../../services/app-auth';
import { TecnicosService, Tecnico } from '../../services/tecnicos';
import { LOJAS_OS, labelLojaOs } from '../../config/os-loja.config';

@Component({
  selector: 'app-usuarios-lista',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Usuários do sistema</h1>
        <button type="button" (click)="novo()">Novo usuário</button>
      </div>

      <p class="hint">
        Operador com loja: cria OS só da loja dele, mas vê todas as OS do dia.
        Root: comissões. Admin/Root: cadastros e usuários.
      </p>

      <p class="erro" *ngIf="erro">{{ erro }}</p>

      <table class="grid" *ngIf="usuarios.length">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Login</th>
            <th>Perfil</th>
            <th>Loja (criação OS)</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of usuarios">
            <td>{{ u.nome }}</td>
            <td>{{ u.usuario }}</td>
            <td>{{ u.role }}</td>
            <td>{{ u.lojaOrigem ? labelLoja(u.lojaOrigem) : 'Todas' }}</td>
            <td>{{ u.ativo ? 'Ativo' : 'Inativo' }}</td>
            <td class="acoes">
              <button type="button" (click)="editar(u)">Editar</button>
              <button type="button" (click)="reset(u)">Reset senha</button>
              <button type="button" class="danger" (click)="excluir(u)" [disabled]="u.role === 'Root'">Excluir</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="modal" *ngIf="formAberto">
        <div class="modal-box">
          <h2>{{ editandoId ? 'Editar usuário' : 'Novo usuário' }}</h2>
          <label>Nome</label>
          <input [(ngModel)]="form.nome" name="nome" />
          <label *ngIf="!editandoId">Login</label>
          <input *ngIf="!editandoId" [(ngModel)]="form.usuario" name="usuario" />
          <label *ngIf="!editandoId">Senha inicial</label>
          <input *ngIf="!editandoId" type="password" [(ngModel)]="form.senha" name="senha" />
          <label>Perfil</label>
          <select [(ngModel)]="form.role" name="role" [disabled]="editandoRoot">
            <option value="Operador">Operador</option>
            <option value="Admin">Admin</option>
            <option *ngIf="editandoRoot" value="Root">Root</option>
          </select>
          <label>Loja vinculada</label>
          <select [(ngModel)]="form.lojaOrigem" name="lojaOrigem" [disabled]="editandoRoot || form.role === 'Admin'">
            <option [ngValue]="null">{{ form.role === 'Admin' ? 'Todas (Admin — padrão Mococa no cadastro)' : 'Selecione…' }}</option>
            <option *ngFor="let l of lojas" [ngValue]="l.codigo">{{ l.sigla }} — {{ l.nome }}</option>
          </select>
          <p class="campo-hint" *ngIf="form.role === 'Operador'">
            Obrigatório: só cria/edita OS e orçamentos dessa loja. Pode ver a fila de todas
            (ex.: Mococa) para combinar prazo. Comissões e histórico geral ficam no escopo da loja.
          </p>
          <p class="campo-hint" *ngIf="form.role === 'Admin'">
            Admin cria e edita em todas as lojas; padrão de cadastro é Mococa (assistência).
          </p>
          <label>Técnico vinculado (opcional)</label>
          <select [(ngModel)]="form.tecnicoId" name="tecnicoId">
            <option [ngValue]="null">—</option>
            <option *ngFor="let t of tecnicos" [ngValue]="t.id">{{ t.nome }}</option>
          </select>
          <label class="check"><input type="checkbox" [(ngModel)]="form.ativo" name="ativo" [disabled]="editandoRoot" /> Ativo</label>
          <p class="erro" *ngIf="formErro">{{ formErro }}</p>
          <div class="modal-acoes">
            <button type="button" (click)="fechar()">Cancelar</button>
            <button type="button" class="primary" (click)="salvar()">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 16px 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    h1 { margin: 0; font-size: 20px; }
    .hint { font-size: 13px; color: #64748b; margin: 8px 0 0; }
    .campo-hint { font-size: 12px; color: #64748b; margin: 4px 0 0; }
    .grid { width: 100%; margin-top: 16px; border-collapse: collapse; background: #fff; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
    .acoes { display: flex; gap: 6px; flex-wrap: wrap; }
    button { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
    button.primary, .page-header button { background: #0f172a; color: #fff; border-color: #0f172a; }
    button.danger { color: #b91c1c; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .erro { color: #b91c1c; margin-top: 10px; }
    .modal {
      position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
    }
    .modal-box { background: #fff; border-radius: 12px; padding: 18px; width: 100%; max-width: 420px; }
    label { display: block; margin: 10px 0 6px; font-size: 13px; font-weight: 600; }
    label.check { font-weight: 500; display: flex; gap: 8px; align-items: center; }
    input, select { width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .modal-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  `],
})
export class UsuariosLista implements OnInit {
  usuarios: AppUsuario[] = [];
  tecnicos: Tecnico[] = [];
  readonly lojas = LOJAS_OS;
  erro = '';
  formAberto = false;
  formErro = '';
  editandoId: string | null = null;
  editandoRoot = false;
  form = {
    usuario: '',
    nome: '',
    senha: '',
    role: 'Operador',
    tecnicoId: null as string | null,
    lojaOrigem: null as string | null,
    ativo: true,
  };

  constructor(
    private service: UsuariosService,
    private tecnicosService: TecnicosService,
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.tecnicosService.listar().subscribe({
      next: t => (this.tecnicos = t),
      error: () => (this.tecnicos = []),
    });
  }

  labelLoja(cod: string): string {
    return labelLojaOs(cod);
  }

  carregar(): void {
    this.service.listar().subscribe({
      next: lista => (this.usuarios = lista),
      error: err => (this.erro = err?.error?.erro || 'Erro ao listar usuários.'),
    });
  }

  novo(): void {
    this.editandoId = null;
    this.editandoRoot = false;
    this.form = {
      usuario: '',
      nome: '',
      senha: '',
      role: 'Operador',
      tecnicoId: null,
      lojaOrigem: 'MCC',
      ativo: true,
    };
    this.formErro = '';
    this.formAberto = true;
  }

  editar(u: AppUsuario): void {
    this.editandoId = u.id;
    this.editandoRoot = u.role === 'Root';
    this.form = {
      usuario: u.usuario,
      nome: u.nome,
      senha: '',
      role: u.role,
      tecnicoId: u.tecnicoId ?? null,
      lojaOrigem: u.lojaOrigem ?? null,
      ativo: u.ativo,
    };
    this.formErro = '';
    this.formAberto = true;
  }

  fechar(): void {
    this.formAberto = false;
  }

  salvar(): void {
    this.formErro = '';
    const loja = this.form.role === 'Admin' || this.editandoRoot ? null : this.form.lojaOrigem;
    if (this.form.role === 'Operador' && !loja) {
      this.formErro = 'Operador precisa de uma loja vinculada.';
      return;
    }

    if (this.editandoId) {
      this.service.atualizar(this.editandoId, {
        nome: this.form.nome,
        role: this.form.role,
        tecnicoId: this.form.tecnicoId,
        lojaOrigem: loja,
        ativo: this.form.ativo,
      }).subscribe({
        next: () => { this.fechar(); this.carregar(); },
        error: err => (this.formErro = err?.error?.erro || 'Erro ao salvar.'),
      });
      return;
    }
    this.service.criar({
      usuario: this.form.usuario,
      nome: this.form.nome,
      senha: this.form.senha,
      role: this.form.role,
      tecnicoId: this.form.tecnicoId,
      lojaOrigem: loja,
      ativo: this.form.ativo,
    }).subscribe({
      next: () => { this.fechar(); this.carregar(); },
      error: err => (this.formErro = err?.error?.erro || 'Erro ao criar.'),
    });
  }

  reset(u: AppUsuario): void {
    const senha = prompt(`Nova senha temporária para ${u.usuario} (mín. 8, com letras e números):`);
    if (!senha) return;
    this.service.resetSenha(u.id, senha).subscribe({
      next: () => alert('Senha redefinida. O usuário deverá trocar no próximo acesso.'),
      error: err => alert(err?.error?.erro || 'Erro ao resetar senha.'),
    });
  }

  excluir(u: AppUsuario): void {
    if (u.role === 'Root') return;
    if (!confirm(`Excluir o usuário ${u.usuario}?`)) return;
    this.service.excluir(u.id).subscribe({
      next: () => this.carregar(),
      error: err => alert(err?.error?.erro || 'Erro ao excluir.'),
    });
  }
}
