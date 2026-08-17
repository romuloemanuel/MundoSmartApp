import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {
  ConsultaProdutoCategoria,
  ConsultaProdutoGrupo,
  ConsultaProdutosService,
} from '../../services/consulta-produtos';

@Component({
  selector: 'app-consulta-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulta-produtos.html',
  styleUrl: './consulta-produtos.scss',
})
export class ConsultaProdutosPage implements OnInit, OnDestroy {
  readonly categorias: Array<{ id: ConsultaProdutoCategoria; label: string; hint: string }> = [
    { id: 'capinhas', label: 'Capinhas', hint: 'Digite o modelo do aparelho' },
    { id: 'peliculas', label: 'Películas', hint: 'Digite o modelo do aparelho' },
    { id: 'termicos', label: 'Térmicos', hint: 'Digite o modelo da garrafa/copo' },
  ];

  categoria: ConsultaProdutoCategoria = 'capinhas';
  termo = '';
  incluirZerados = false;
  carregando = false;
  erro = '';
  aviso = '';
  origem = '';
  grupos: ConsultaProdutoGrupo[] = [];
  buscou = false;

  private readonly busca$ = new Subject<string>();
  private sub?: Subscription;

  constructor(private service: ConsultaProdutosService) {}

  ngOnInit(): void {
    this.sub = this.busca$
      .pipe(
        debounceTime(280),
        distinctUntilChanged(),
        switchMap(chave => {
          const [categoria, termo, zerados] = chave.split('\t');
          this.carregando = true;
          this.erro = '';
          this.aviso = '';
          return this.service
            .consultar(categoria as ConsultaProdutoCategoria, termo, zerados === '1')
            .pipe(
              catchError(err => {
                this.carregando = false;
                this.buscou = true;
                this.grupos = [];
                this.erro = err.error?.erro ?? 'Não foi possível consultar o estoque.';
                return of(null);
              }),
            );
        }),
      )
      .subscribe(resp => {
        if (!resp) return;
        this.carregando = false;
        this.buscou = true;
        this.grupos = resp.grupos ?? [];
        this.origem = resp.origem ?? '';
        this.aviso = resp.aviso ?? '';
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get hintCategoria(): string {
    return this.categorias.find(c => c.id === this.categoria)?.hint ?? 'Digite o modelo';
  }

  get placeholder(): string {
    return this.categoria === 'termicos'
      ? 'Ex: 500ml, 473ml, Stanley…'
      : 'Ex: A54, iPhone 15, A15…';
  }

  get tituloOrigem(): string {
    if (this.origem === 'bling') return 'Estoque Bling';
    if (this.origem === 'cache') return 'Catálogo local';
    return '';
  }

  selecionarCategoria(cat: ConsultaProdutoCategoria): void {
    if (this.categoria === cat) return;
    this.categoria = cat;
    this.grupos = [];
    this.buscou = false;
    this.aviso = '';
    this.erro = '';
    if (this.termo.trim().length >= 2) this.dispararBusca();
  }

  onTermoChange(): void {
    if (this.termo.trim().length >= 2) {
      this.dispararBusca();
      return;
    }
    this.grupos = [];
    this.buscou = false;
    this.erro = '';
    this.aviso = '';
  }

  buscar(): void {
    if (this.termo.trim().length < 2) {
      this.erro = 'Digite pelo menos 2 caracteres do modelo.';
      return;
    }
    this.dispararBusca();
  }

  toggleZerados(): void {
    this.incluirZerados = !this.incluirZerados;
    if (this.termo.trim().length >= 2) this.dispararBusca();
  }

  private dispararBusca(): void {
    this.busca$.next(`${this.categoria}\t${this.termo.trim()}\t${this.incluirZerados ? '1' : '0'}`);
  }

  saldoClass(saldo: number): string {
    if (saldo <= 0) return 'zerado';
    if (saldo <= 2) return 'baixo';
    return 'ok';
  }
}
