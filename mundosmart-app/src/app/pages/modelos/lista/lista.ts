import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AparelhosService } from '../../../services/aparelhos';
import { MarcaAparelho, ModeloAparelho } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA, TIPOS_DISPOSITIVO, TIPOS_TELA, mesmoTipoTelaArquitetura } from '../../../config/aparelhos.config';
import { formatarDataCadastroModelo } from '../../../utils/modelo-autocomplete.util';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginationState } from '../../../utils/grid-pagination.state';

type ModeloOrdenacaoCampo = 'modelo' | 'marca' | 'tipo' | 'tela' | 'lancamento' | 'cadastro' | 'compativeis';

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
  filtroTipoTela = '';
  lancamentoInicio = '';
  lancamentoFim = '';
  carregando = false;
  erro = '';
  resultadoLimitado = false;
  ordenacao: { campo: ModeloOrdenacaoCampo; direcao: 'asc' | 'desc' } = {
    campo: 'marca',
    direcao: 'asc',
  };
  readonly tiposDispositivo = TIPOS_DISPOSITIVO;
  readonly tiposTela = TIPOS_TELA.filter(t => !!t.valor);
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
    return this.grid.paginate(this.modelosOrdenados);
  }

  get modelosOrdenados(): ModeloAparelho[] {
    const copia = [...this.modelos];
    copia.sort((a, b) => this.compararModelos(a, b));
    return copia;
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
        this.modelos = this.aplicarFiltrosLocais(dados);
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

  ordenar(campo: ModeloOrdenacaoCampo): void {
    if (this.ordenacao.campo === campo) {
      this.ordenacao = {
        campo,
        direcao: this.ordenacao.direcao === 'asc' ? 'desc' : 'asc',
      };
    } else {
      this.ordenacao = { campo, direcao: 'asc' };
    }
    this.grid.reset();
  }

  iconeOrdenacao(campo: ModeloOrdenacaoCampo): string {
    if (this.ordenacao.campo !== campo) return '↕';
    return this.ordenacao.direcao === 'asc' ? '↑' : '↓';
  }

  colunaOrdenada(campo: ModeloOrdenacaoCampo): boolean {
    return this.ordenacao.campo === campo;
  }

  qtdCompativeis(m: ModeloAparelho): number {
    return m.aparelhosCompativeis?.length ?? 0;
  }

  formatarCadastro(m: ModeloAparelho): string {
    return formatarDataCadastroModelo(m.atualizadoEm ?? m.criadoEm);
  }

  formatarLancamento(m: ModeloAparelho): string {
    return formatarDataCadastroModelo(m.criadoEm);
  }

  private aplicarFiltrosLocais(modelos: ModeloAparelho[]): ModeloAparelho[] {
    const porTela = this.aplicarFiltroTipoTela(modelos);
    return this.aplicarFiltroLancamento(porTela);
  }

  private aplicarFiltroTipoTela(modelos: ModeloAparelho[]): ModeloAparelho[] {
    if (!this.filtroTipoTela) return modelos;
    if (this.filtroTipoTela === '__sem_tela__') {
      return modelos.filter(m => !m.tipoTela?.trim());
    }
    return modelos.filter(m => mesmoTipoTelaArquitetura(m.tipoTela, this.filtroTipoTela));
  }

  private aplicarFiltroLancamento(modelos: ModeloAparelho[]): ModeloAparelho[] {
    const inicio = this.lancamentoInicio ? new Date(`${this.lancamentoInicio}T00:00:00`) : null;
    const fim = this.lancamentoFim ? new Date(`${this.lancamentoFim}T23:59:59`) : null;
    if (!inicio && !fim) return modelos;

    return modelos.filter(modelo => {
      const data = this.dataLancamentoModelo(modelo);
      if (!data) return false;
      if (inicio && data < inicio) return false;
      if (fim && data > fim) return false;
      return true;
    });
  }

  private dataLancamentoModelo(modelo: ModeloAparelho): Date | null {
    const base = modelo.criadoEm ?? modelo.atualizadoEm;
    if (!base) return null;
    const data = new Date(base);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  private compararModelos(a: ModeloAparelho, b: ModeloAparelho): number {
    const dir = this.ordenacao.direcao === 'asc' ? 1 : -1;
    let cmp = 0;
    switch (this.ordenacao.campo) {
      case 'modelo':
        cmp = (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
        break;
      case 'marca':
        cmp = (a.marcaNome ?? '').localeCompare(b.marcaNome ?? '', 'pt-BR');
        if (cmp === 0) cmp = (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
        break;
      case 'tipo':
        cmp = (a.tipoDispositivo ?? '').localeCompare(b.tipoDispositivo ?? '', 'pt-BR');
        break;
      case 'tela':
        cmp = (a.tipoTela ?? '').localeCompare(b.tipoTela ?? '', 'pt-BR');
        break;
      case 'cadastro':
        cmp = (this.dataLancamentoModelo(a)?.getTime() ?? 0) - (this.dataLancamentoModelo(b)?.getTime() ?? 0);
        break;
      case 'lancamento':
        cmp = (this.dataLancamentoModelo(a)?.getTime() ?? 0) - (this.dataLancamentoModelo(b)?.getTime() ?? 0);
        break;
      case 'compativeis':
        cmp = this.qtdCompativeis(a) - this.qtdCompativeis(b);
        break;
    }
    if (cmp === 0 && this.ordenacao.campo !== 'modelo') {
      cmp = (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
    }
    return cmp * dir;
  }
}
