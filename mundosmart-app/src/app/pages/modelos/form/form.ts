import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AparelhosService } from '../../../services/aparelhos';
import { AparelhoCompativel, ModeloAparelho } from '../../../models/bling.models';
import { TIPOS_COMPATIBILIDADE, TIPOS_DISPOSITIVO } from '../../../config/aparelhos.config';
import { formatarDataCadastroModelo } from '../../../utils/modelo-autocomplete.util';

@Component({
  selector: 'app-modelos-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './form.html',
  styles: `
    .compat-add { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 12px; }
    .compat-add .form-group { margin: 0; min-width: 160px; }
    .compat-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .compat-table th, .compat-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
    .compat-table th { background: #f5f7fa; }
    .compat-hint { font-size: 12px; color: #666; margin: 8px 0; }
  `,
})
export class ModelosForm implements OnInit, OnDestroy {
  modelo: ModeloAparelho = {
    nome: '',
    marcaNome: '',
    tipoDispositivo: 'Celular',
    aparelhosCompativeis: [],
  };
  modelosBusca: ModeloAparelho[] = [];
  editando = false;
  salvando = false;
  erro = '';

  buscaCompativel = '';
  compatSelecionadoId = '';
  novoCompatTipo = 'Compartilhado';
  novoCompatObs = '';

  readonly tiposDispositivo = TIPOS_DISPOSITIVO;
  readonly tiposCompatibilidade = TIPOS_COMPATIBILIDADE;

  private readonly buscaCompativel$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: AparelhosService,
  ) {}

  ngOnInit(): void {
    this.buscaCompativel$.pipe(
      debounceTime(80),
      takeUntil(this.destroy$),
    ).subscribe(() => this.buscarCompativeis());

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'novo') {
      this.editando = true;
      this.service.obterModelo(id).subscribe({
        next: (m) => {
          this.modelo = {
            ...m,
            aparelhosCompativeis: m.aparelhosCompativeis ?? [],
          };
        },
        error: () => (this.erro = 'Erro ao carregar modelo.'),
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onBuscaCompativelChange(): void {
    this.buscaCompativel$.next();
  }

  buscarCompativeis(): void {
    const termo = this.buscaCompativel.trim();
    if (!termo) {
      this.modelosBusca = [];
      return;
    }
    this.service.listarModelos({
      termo,
      limite: 30,
    }).subscribe({
      next: (lista) => {
        this.modelosBusca = lista.filter((m) => m.id !== this.modelo.id);
      },
    });
  }

  adicionarCompativel(): void {
    const ref = this.modelosBusca.find((m) => m.id === this.compatSelecionadoId);
    if (!ref?.id) return;

    const jaExiste = this.modelo.aparelhosCompativeis?.some((c) => c.modeloId === ref.id);
    if (jaExiste) return;

    const item: AparelhoCompativel = {
      modeloId: ref.id,
      modeloNome: ref.nome,
      marcaNome: ref.marcaNome,
      tipoDispositivo: ref.tipoDispositivo,
      tipoCompatibilidade: this.novoCompatTipo,
      observacao: this.novoCompatObs.trim() || undefined,
    };

    this.modelo.aparelhosCompativeis = [...(this.modelo.aparelhosCompativeis ?? []), item];
    this.compatSelecionadoId = '';
    this.novoCompatObs = '';
    this.buscaCompativel = '';
    this.modelosBusca = [];
  }

  removerCompativel(index: number): void {
    this.modelo.aparelhosCompativeis?.splice(index, 1);
  }

  labelCompatibilidade(valor: string): string {
    return this.tiposCompatibilidade.find((t) => t.valor === valor)?.label ?? valor;
  }

  formatarCadastro(m: ModeloAparelho): string {
    return formatarDataCadastroModelo(m.criadoEm);
  }

  salvar(): void {
    if (!this.modelo.nome?.trim()) {
      this.erro = 'Nome do modelo é obrigatório.';
      return;
    }
    if (!this.modelo.marcaNome?.trim()) {
      this.erro = 'Informe a marca do modelo.';
      return;
    }

    this.modelo.marcaNome = this.modelo.marcaNome.trim();
    this.modelo.nome = this.modelo.nome.trim();
    this.salvando = true;
    this.erro = '';

    const op = this.editando
      ? this.service.atualizarModelo(this.modelo.id!, this.modelo)
      : this.service.criarModelo(this.modelo);

    op.subscribe({
      next: () => this.router.navigate(['/modelos']),
      error: (err) => {
        this.erro = err?.error?.erro ?? 'Erro ao salvar modelo.';
        this.salvando = false;
      },
    });
  }

  excluir(): void {
    if (!this.editando || !this.modelo.id) return;
    if (!confirm('Excluir este modelo?')) return;
    this.service.excluirModelo(this.modelo.id).subscribe({
      next: () => this.router.navigate(['/modelos']),
      error: (err) => (this.erro = err?.error?.erro ?? 'Erro ao excluir modelo.'),
    });
  }

  cancelar(): void {
    this.router.navigate(['/modelos']);
  }
}
