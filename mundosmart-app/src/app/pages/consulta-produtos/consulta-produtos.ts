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
import { GridPaginator } from '../../components/grid-paginator/grid-paginator';
import { GridPaginationState } from '../../utils/grid-pagination.state';
import { consultaTextoCombina } from '../../utils/consulta-alias.util';

@Component({
  selector: 'app-consulta-produtos',
  standalone: true,
  imports: [CommonModule, FormsModule, GridPaginator],
  templateUrl: './consulta-produtos.html',
  styleUrl: './consulta-produtos.scss',
})
export class ConsultaProdutosPage implements OnInit, OnDestroy {
  readonly categorias: Array<{ id: ConsultaProdutoCategoria; label: string; hint: string }> = [
    { id: 'capinhas', label: 'Capinhas', hint: 'SM Samsung · MT Motorola · MI Poco/Redmi — ou o modelo' },
    { id: 'peliculas', label: 'Películas', hint: 'SM Samsung · MT Motorola · MI Poco/Redmi — ou o modelo' },
    { id: 'termicos', label: 'Térmicos', hint: 'Digite a marca ou o modelo' },
  ];

  categoria: ConsultaProdutoCategoria = 'capinhas';
  termo = '';
    /// <summary>No balcão, o padrão é mostrar o que tem para vender.</summary>
  incluirZerados = false;
  /** Filtra só itens com «Permite Personalização» ativo no Bling. */
  soPersonalizaveis = true;
  carregando = false;
  erro = '';
  aviso = '';
  origem = '';
  atualizadoEm: string | null = null;
  syncIntervaloMinutos = 15;
  sincronizando = false;
  grupos: ConsultaProdutoGrupo[] = [];
  buscou = false;
  readonly grid = new GridPaginationState();

  constructor(
    private service: ConsultaProdutosService,
    public blingAuth: BlingAuthService,
  ) {
    // No celular, páginas menores = menos rolagem e consulta mais rápida.
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
    this.grid.pageSize = mobile ? 10 : 50;
  }

  /** Catálogo completo da categoria (sem filtro de texto). */
  private catalogo: ConsultaProdutoGrupo[] = [];
  private readonly catalogo$ = new Subject<string>();
  private readonly filtro$ = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = new Subscription();

    this.sub.add(
      this.catalogo$
        .pipe(
          debounceTime(120),
          distinctUntilChanged(),
          switchMap(chave => {
            const [categoria, zerados] = chave.split('\t');
            this.carregando = true;
            this.erro = '';
            this.aviso = '';
            return this.blingAuth.syncTokenToApi().pipe(
              switchMap(() =>
                this.service.consultar(
                  categoria as ConsultaProdutoCategoria,
                  '',
                  zerados === '1',
                ),
              ),
              catchError(err => {
                this.carregando = false;
                this.buscou = true;
                this.catalogo = [];
                this.grupos = [];
                this.grid.reset();
                this.erro = this.mensagemErroHttp(err);
                return of(null);
              }),
            );
          }),
        )
        .subscribe({
          next: resp => {
            if (!resp) return;
            try {
              this.carregando = false;
              this.buscou = true;
              this.catalogo = Array.isArray(resp.grupos) ? resp.grupos : [];
              this.origem = resp.origem ?? '';
              this.aviso = resp.aviso ?? '';
              this.atualizadoEm = resp.atualizadoEm ?? null;
              this.syncIntervaloMinutos = resp.syncIntervaloMinutos ?? 15;
              this.aplicarFiltroLocal();
            } catch (e) {
              console.error(e);
              this.carregando = false;
              this.buscou = true;
              this.catalogo = [];
              this.grupos = [];
              this.grid.reset();
              this.erro = 'Consulta de produtos falhou inesperadamente. Tente novamente.';
            }
          },
          error: err => {
            console.error(err);
            this.carregando = false;
            this.buscou = true;
            this.catalogo = [];
            this.grupos = [];
            this.grid.reset();
            this.erro = 'Consulta de produtos falhou inesperadamente. Tente novamente.';
          },
        }),
    );

    this.sub.add(
      this.filtro$.pipe(debounceTime(160), distinctUntilChanged()).subscribe(() => {
        try {
          this.aplicarFiltroLocal();
        } catch (e) {
          console.error(e);
        }
      }),
    );

    this.recarregarCatalogo();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get hintCategoria(): string {
    return this.categorias.find(c => c.id === this.categoria)?.hint ?? 'Modelo (opcional)';
  }

  get placeholder(): string {
    return this.categoria === 'termicos'
      ? 'Ex.: Stanley, 500ml…'
      : 'Ex.: SM, MT, MI, G84, A54…';
  }

  get tituloOrigem(): string {
    if (this.origem === 'cache' || this.origem === 'bling') {
      const quando = this.textoAtualizadoEm;
      return quando ? `Atualizado ${quando}` : 'Estoque local';
    }
    return '';
  }

  get textoAtualizadoEm(): string {
    if (!this.atualizadoEm) return '';
    const d = new Date(this.atualizadoEm);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get precisaConectarBling(): boolean {
    return !this.blingAuth.isAuthenticated()
      || (!!this.aviso && /conecte o bling|não conectado|expirado|desabilitada|insufficient_scope|403|permiss/i.test(this.aviso));
  }

  get gruposPaginados(): ConsultaProdutoGrupo[] {
    return this.grid.paginate(this.grupos);
  }

  /** Linhas de lista com cabeçalhos de marca/tipo intercalados. */
  get linhasPaginadas(): Array<
    | { kind: 'marca'; label: string }
    | { kind: 'tipo'; label: string }
    | { kind: 'item'; grupo: ConsultaProdutoGrupo }
  > {
    const linhas: Array<
      | { kind: 'marca'; label: string }
      | { kind: 'tipo'; label: string }
      | { kind: 'item'; grupo: ConsultaProdutoGrupo }
    > = [];
    let marcaAtual = '';
    let tipoAtual = '';

    for (const g of this.gruposPaginados) {
      const marca = (g.marca || 'Outras').trim();
      const tipo = (g.nome || 'Capinha').trim();
      if (marca.toLowerCase() !== marcaAtual.toLowerCase()) {
        marcaAtual = marca;
        tipoAtual = '';
        linhas.push({ kind: 'marca', label: marca });
      }
      if (tipo.toLowerCase() !== tipoAtual.toLowerCase()) {
        tipoAtual = tipo;
        linhas.push({ kind: 'tipo', label: tipo });
      }
      linhas.push({ kind: 'item', grupo: g });
    }
    return linhas;
  }

  conectarBling(): void {
    this.blingAuth.getAuthorizationUrl().subscribe({
      next: ({ authorizationUrl }) => {
        window.location.href = authorizationUrl;
      },
      error: () => {
        this.erro = 'Não foi possível iniciar a conexão com o Bling.';
      },
    });
  }

  atualizarDoBling(): void {
    if (this.sincronizando) return;
    this.sincronizando = true;
    this.erro = '';
    this.blingAuth.syncTokenToApi().pipe(
      switchMap(() => this.service.sincronizar(this.categoria)),
      catchError(err => {
        this.sincronizando = false;
        this.aviso = this.mensagemErroHttp(err);
        return of(null);
      }),
    ).subscribe(result => {
      this.sincronizando = false;
      if (!result) return;
      if (result.atualizadoEm) this.atualizadoEm = result.atualizadoEm;
      if (result.aviso) this.aviso = result.aviso;
      else if (result.ok) this.aviso = `Sincronizado: ${result.itens} itens do Bling.`;
      this.recarregarCatalogo();
    });
  }

  selecionarCategoria(cat: ConsultaProdutoCategoria): void {
    if (this.categoria === cat) return;
    this.categoria = cat;
    this.catalogo = [];
    this.grupos = [];
    this.grid.reset();
    this.buscou = false;
    this.aviso = '';
    this.erro = '';
    this.recarregarCatalogo();
  }

  onTermoChange(): void {
    this.filtro$.next(this.termo.trim().toLowerCase());
  }

  limparBusca(): void {
    this.termo = '';
    this.filtro$.next('');
  }

  buscar(): void {
    this.recarregarCatalogo();
  }

  toggleZerados(): void {
    this.incluirZerados = !this.incluirZerados;
    this.recarregarCatalogo();
  }

  togglePersonalizaveis(): void {
    this.soPersonalizaveis = !this.soPersonalizaveis;
    this.aplicarFiltroLocal();
  }

  onPaginaChange(pagina: number): void {
    this.grid.onPageChange(pagina);
    this.rolarParaResultados();
  }

  onTamanhoPaginaChange(tamanho: number): void {
    this.grid.onPageSizeChange(tamanho);
    this.rolarParaResultados();
  }

  private recarregarCatalogo(): void {
    this.catalogo$.next(`${this.categoria}\t${this.incluirZerados ? '1' : '0'}`);
  }

  private aplicarFiltroLocal(): void {
    const lista = Array.isArray(this.catalogo) ? this.catalogo : [];
    const t = this.normalizar(this.termo);
    let filtrada = lista;
    if (this.soPersonalizaveis) {
      filtrada = filtrada.filter(g => !!g.permitePersonalizacao);
    }
    // No celular, 1 caractere já filtra (ex.: "A", "G") — mais ágil no balcão.
    if (t.length >= 1) {
      filtrada = filtrada.filter(g => this.grupoCombina(g, t));
    }
    this.grupos = filtrada;
    this.grid.reset();
  }

  private rolarParaResultados(): void {
    if (typeof document === 'undefined') return;
    document.getElementById('consulta-resultados')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  rolarParaTopo(): void {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private grupoCombina(g: ConsultaProdutoGrupo, termo: string): boolean {
    const perso = g?.permitePersonalizacao ? 'personalizavel personalizacao personalizado' : '';
    const hay = this.normalizar(
      [g?.modelo, g?.marca, g?.nome, perso, ...(g?.cores ?? []).map(c => c?.cor)]
        .filter(Boolean)
        .join(' '),
    );
    return consultaTextoCombina(hay, termo);
  }

  private normalizar(valor: string | undefined | null): string {
    return (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mensagemErroHttp(err: unknown): string {
    const anyErr = err as { error?: { erro?: string; message?: string }; message?: string; status?: number };
    const doBody = anyErr?.error?.erro || anyErr?.error?.message;
    if (typeof doBody === 'string' && doBody.trim()) return doBody.trim();
    if (anyErr?.status === 0) {
      return 'Não foi possível conectar à API. Verifique a rede e se o servidor está no ar.';
    }
    return 'Consulta de produtos falhou inesperadamente. Tente novamente.';
  }

  saldoClass(saldo: number): string {
    if (saldo <= 0) return 'zerado';
    if (saldo <= 2) return 'baixo';
    return 'ok';
  }
}
