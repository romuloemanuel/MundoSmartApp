import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoriasPecaService, CategoriaPecaCadastro } from '../../../services/categorias-peca';
import { GridAcao } from '../../../components/grid-acao/grid-acao';

@Component({
  selector: 'app-categorias-peca-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridAcao],
  templateUrl: './lista.html',
  styles: `
    .cat-form {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }
    .cat-form input[type="text"] { flex: 1; min-width: 220px; }
    .cat-check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #334155;
      white-space: nowrap;
    }
    .cat-ordem { width: 72px; }
    .cat-cores { font-size: 12px; color: #1d4ed8; font-weight: 600; }
  `,
})
export class CategoriasPecaLista implements OnInit {
  categorias: CategoriaPecaCadastro[] = [];
  carregando = false;
  salvando = false;
  erro = '';
  novoNome = '';
  novoUsaCores = false;
  editandoId?: string;
  editNome = '';
  editUsaCores = false;
  editOrdem = 0;

  constructor(private service: CategoriasPecaService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listar(true).subscribe({
      next: (dados) => {
        this.categorias = dados;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar categorias.';
        this.carregando = false;
      },
    });
  }

  adicionar(): void {
    const nome = this.novoNome.trim();
    if (!nome) {
      this.erro = 'Informe o nome da categoria.';
      return;
    }
    this.salvando = true;
    this.erro = '';
    this.service.criar({ nome, usaCoresPorModelo: this.novoUsaCores }).subscribe({
      next: () => {
        this.novoNome = '';
        this.novoUsaCores = false;
        this.salvando = false;
        this.carregar();
      },
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao cadastrar categoria.';
        this.salvando = false;
      },
    });
  }

  iniciarEdicao(c: CategoriaPecaCadastro): void {
    this.editandoId = c.id;
    this.editNome = c.nome;
    this.editUsaCores = c.usaCoresPorModelo;
    this.editOrdem = c.ordem;
  }

  cancelarEdicao(): void {
    this.editandoId = undefined;
  }

  salvarEdicao(): void {
    if (!this.editandoId) return;
    const nome = this.editNome.trim();
    if (!nome) {
      this.erro = 'Informe o nome da categoria.';
      return;
    }
    this.salvando = true;
    this.erro = '';
    this.service.atualizar(this.editandoId, {
      nome,
      usaCoresPorModelo: this.editUsaCores,
      ordem: this.editOrdem,
    }).subscribe({
      next: () => {
        this.editandoId = undefined;
        this.salvando = false;
        this.carregar();
      },
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao atualizar categoria.';
        this.salvando = false;
      },
    });
  }

  mover(c: CategoriaPecaCadastro, delta: number): void {
    if (!c.id) return;
    const idx = this.categorias.findIndex(x => x.id === c.id);
    const alvo = idx + delta;
    if (alvo < 0 || alvo >= this.categorias.length) return;
    const outro = this.categorias[alvo];
    this.service.atualizar(c.id, {
      nome: c.nome,
      usaCoresPorModelo: c.usaCoresPorModelo,
      ordem: outro.ordem,
    }).subscribe({
      next: () => {
        if (!outro.id) return;
        this.service.atualizar(outro.id, {
          nome: outro.nome,
          usaCoresPorModelo: outro.usaCoresPorModelo,
          ordem: c.ordem,
        }).subscribe({ next: () => this.carregar() });
      },
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao reordenar.';
      },
    });
  }

  excluir(c: CategoriaPecaCadastro): void {
    if (!c.id) return;
    if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
    this.service.excluir(c.id).subscribe({
      next: () => this.carregar(),
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao excluir categoria.';
      },
    });
  }
}
