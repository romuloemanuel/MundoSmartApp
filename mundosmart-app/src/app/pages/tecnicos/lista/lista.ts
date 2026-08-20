import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TecnicosService, Tecnico } from '../../../services/tecnicos';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { avisarErroUsuario } from '../../../services/user-feedback.service';

@Component({
  selector: 'app-tecnicos-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, GridAcao],
  templateUrl: './lista.html',
})
export class TecnicosLista implements OnInit {
  tecnicos: Tecnico[] = [];
  carregando = false;
  salvando = false;
  erro = '';
  novoNome = '';
  editandoId?: string;
  editNome = '';
  editAtivo = true;

  constructor(private service: TecnicosService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listar().subscribe({
      next: (dados) => {
        this.tecnicos = dados;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar técnicos.';
        this.carregando = false;
      },
    });
  }

  adicionar(): void {
    const nome = this.novoNome.trim();
    if (!nome) {
      this.erro = 'Informe o nome do técnico.';
      avisarErroUsuario(this.erro);
      return;
    }
    this.salvando = true;
    this.erro = '';
    this.service.criar(nome).subscribe({
      next: () => {
        this.novoNome = '';
        this.salvando = false;
        this.carregar();
      },
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao cadastrar técnico.';
        this.salvando = false;
      },
    });
  }

  iniciarEdicao(t: Tecnico): void {
    this.editandoId = t.id;
    this.editNome = t.nome;
    this.editAtivo = t.ativo;
  }

  cancelarEdicao(): void {
    this.editandoId = undefined;
  }

  salvarEdicao(): void {
    if (!this.editandoId) return;
    const nome = this.editNome.trim();
    if (!nome) {
      this.erro = 'Informe o nome do técnico.';
      avisarErroUsuario(this.erro);
      return;
    }
    this.salvando = true;
    this.erro = '';
    this.service.atualizar(this.editandoId, nome, this.editAtivo).subscribe({
      next: () => {
        this.editandoId = undefined;
        this.salvando = false;
        this.carregar();
      },
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao atualizar técnico.';
        this.salvando = false;
      },
    });
  }

  excluir(t: Tecnico): void {
    if (!t.id) return;
    if (!confirm(`Excluir o técnico "${t.nome}"?`)) return;
    this.service.excluir(t.id).subscribe({
      next: () => this.carregar(),
      error: () => (this.erro = 'Erro ao excluir técnico.'),
    });
  }
}
