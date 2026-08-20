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
import { BlingAuthService } from '../../services/bling-auth';

@Component({
  selector: 'app-consulta-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consulta-produtos.html',
  styleUrl: './consulta-produtos.scss',
})
export class ConsultaProdutosPage implements OnInit, OnDestroy {
  readonly categorias: Array<{ id: ConsultaProdutoCategoria; label: string; hint: string }> = [
    { id: 'capinhas', label: 'Capinhas', hint: 'Modelo do aparelho (opcional)' },
    { id: 'peliculas', label: 'Películas', hint: 'Modelo do aparelho (opcional)' },
    { id: 'termicos', label: 'Térmicos', hint: 'Modelo da garrafa/copo (opcional)' },
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

  constructor(
    private service: ConsultaProdutosService,
    public blingAuth: BlingAuthService,
  ) {}

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
          // Garante que o token do browser está na memória da API antes de consultar.
          return this.blingAuth.syncTokenToApi().pipe(
            switchMap(() =>
              this.service.consultar(
                categoria as ConsultaProdutoCategoria,
                termo,
                zerados === '1',
              ),
            ),
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

    this.dispararBusca();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get hintCategoria(): string {
    return this.categorias.find(c => c.id === this.categoria)?.hint ?? 'Modelo (opcional)';
  }

  get placeholder(): string {
    return this.categoria === 'termicos'
      ? 'Ex: 500ml, Stanley… ou deixe em branco'
      : 'Ex: A54, iPhone 15… ou deixe em branco';
  }

  get tituloOrigem(): string {
    if (this.origem === 'bling') return 'Estoque Bling';
    return '';
  }

  get precisaConectarBling(): boolean {
    return !this.blingAuth.isAuthenticated()
      || (!!this.aviso && /conecte o bling|não conectado|expirado/i.test(this.aviso));
  }

  conectarBling(): void {
    this.blingAuth.getAuthorizationUrl().subscribe(({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    });
  }

  selecionarCategoria(cat: ConsultaProdutoCategoria): void {
    if (this.categoria === cat) return;
    this.categoria = cat;
    this.grupos = [];
    this.buscou = false;
    this.aviso = '';
    this.erro = '';
    this.dispararBusca();
  }

  onTermoChange(): void {
    this.dispararBusca();
  }

  buscar(): void {
    this.dispararBusca();
  }

  toggleZerados(): void {
    this.incluirZerados = !this.incluirZerados;
    this.dispararBusca();
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
