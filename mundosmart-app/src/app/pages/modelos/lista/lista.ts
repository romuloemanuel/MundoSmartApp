import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AparelhosService } from '../../../services/aparelhos';
import { MarcaAparelho, ModeloAparelho } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA, TIPOS_DISPOSITIVO } from '../../../config/aparelhos.config';
import { formatarDataCadastroModelo } from '../../../utils/modelo-autocomplete.util';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginationState } from '../../../utils/grid-pagination.state';

@Component({
  selector: 'app-modelos-lista',
  imports: [CommonModule, FormsModule, GridPaginator, GridAcao],
  templateUrl: './lista.html',
})
export class ModelosLista implements OnInit, OnDestroy {
  modelos: ModeloAparelho[] = [];
  marcas: MarcaAparelho[] = [];
  busca = '';
  marcaNome = '';
  tipoDispositivo = '';
  carregando = false;
  erro = '';
  resultadoLimitado = false;
  readonly tiposDispositivo = TIPOS_DISPOSITIVO;
  readonly limiteLista = MODELO_LIMITE_LISTA;
  readonly grid = new GridPaginationState();

  private readonly filtros$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private service: AparelhosService, private router: Router) {}

  ngOnInit(): void {
    this.filtros$.pipe(
      debounceTime(80),
      takeUntil(this.destroy$),
    ).subscribe(() => this.carregar());

    this.carregarMarcas();
    this.carregar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFiltroChange(): void {
    this.filtros$.next();
  }

  selecionarMarca(nome: string): void {
    this.marcaNome = this.marcaNome === nome ? '' : nome;
    this.onFiltroChange();
  }

  get modelosPaginados(): ModeloAparelho[] {
    return this.grid.paginate(this.modelos);
  }

  carregarMarcas(): void {
    this.service.listarMarcas().subscribe({
      next: (dados) => { this.marcas = dados; },
      error: () => { this.marcas = []; },
    });
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.resultadoLimitado = false;
    this.service.listarModelos({
      termo: this.busca.trim() || undefined,
      marcaNome: this.marcaNome.trim() || undefined,
      tipoDispositivo: this.tipoDispositivo || undefined,
      limite: this.limiteLista,
    }).subscribe({
      next: (dados) => {
        this.modelos = dados;
        this.resultadoLimitado = dados.length >= this.limiteLista;
        this.grid.reset();
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar modelos.';
        this.carregando = false;
      },
    });
  }

  novo(): void {
    this.router.navigate(['/modelos/novo']);
  }

  editar(id: string): void {
    this.router.navigate(['/modelos', id]);
  }

  qtdCompativeis(m: ModeloAparelho): number {
    return m.aparelhosCompativeis?.length ?? 0;
  }

  formatarCadastro(m: ModeloAparelho): string {
    return formatarDataCadastroModelo(m.criadoEm);
  }
}
