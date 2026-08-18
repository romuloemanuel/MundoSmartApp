import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PecasService } from '../../../services/pecas';
import { AparelhosService } from '../../../services/aparelhos';
import { CategoriasPecaService } from '../../../services/categorias-peca';
import { ModeloAparelho, PecaEstoque } from '../../../models/bling.models';
import {
  CATEGORIAS_PECA,
  inferirCategoriaPeca,
  indiceCategoriaPeca,
  modeloElegivelParaCategoriaPeca,
} from '../../../config/peca-categoria.config';
import {
  calcularNivelEstoque,
  ESTOQUE_NIVEL_CLASSES,
  getEstoqueConfig,
  NivelEstoque,
  opcoesFiltroNivelEstoque as montarOpcoesFiltroNivelEstoque,
} from '../../../config/estoque.config';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { AutocompleteCriavel, AutocompleteItem } from '../../../components/autocomplete-criavel/autocomplete-criavel';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import { formatarDataCadastroModelo, modeloParaAutocomplete } from '../../../utils/modelo-autocomplete.util';
import { MODELO_LIMITE_LISTA, TIPOS_TELA, mesmoTipoTelaArquitetura } from '../../../config/aparelhos.config';

type PecaOrdenacaoCampo = 'peca' | 'categoria' | 'modelo' | 'preco' | 'estoque';

@Component({
  selector: 'app-pecas-lista',
  imports: [CommonModule, FormsModule, RouterLink, GridPaginator, GridAcao, AutocompleteCriavel],
  templateUrl: './lista.html',
  styles: [`
    .pecas-estoque-qtd { font-weight: 600; }
    .pecas-abas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 12px;
    }
    .pecas-abas button {
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #334155;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .pecas-abas button.ativa {
      border-color: #2563eb;
      background: #2563eb;
      color: #fff;
    }
    .cobertura-painel {
      margin: 14px 0;
      padding: 14px;
      border: 1px solid #dbeafe;
      border-radius: 10px;
      background: #f8fbff;
    }
    .cobertura-topo {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .cobertura-topo h3 {
      margin: 0 0 4px;
      font-size: 16px;
      color: #1e3a8a;
    }
    .cobertura-lista-topo {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .cobertura-bloco {
      margin-top: 12px;
    }
    .cobertura-bloco h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: #1e3a8a;
    }
    .cobertura-cards {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .cobertura-card {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 6px 10px;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      background: #fff;
      color: #1e3a8a;
      cursor: pointer;
      text-align: left;
    }
    .cobertura-card:hover {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .cobertura-card.ativa {
      border-color: #2563eb;
      background: #dbeafe;
    }
    .cobertura-card-num {
      flex: 0 0 auto;
      min-width: 2.2ch;
      font-size: 16px;
      font-weight: 800;
      line-height: 1;
    }
    .cobertura-card-nome {
      font-size: 12px;
      font-weight: 600;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cobertura-count {
      margin: 0 0 10px;
      font-size: 14px;
      color: #1e3a8a;
    }
    .cobertura-count strong {
      font-size: 18px;
      font-weight: 800;
    }
    @media (max-width: 900px) {
      .cobertura-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
})
export class PecasLista implements OnInit {
  abaPecas: 'cadastro' | 'pendencias' = 'cadastro';
  pecas: PecaEstoque[] = [];
  modelosCatalogo: ModeloAparelho[] = [];
  busca = '';
  filtrosAbertos = false;
  coberturaCategoriaSelecionada = '';
  coberturaMarcaSelecionada = '';
  coberturaBuscaModelo = '';
  coberturaDataInicio = '';
  coberturaDataFim = '';
  coberturaTipoTela = '';
  /** '' | vermelho | laranja | amarelo | verde */
  filtroNivel: '' | NivelEstoque = '';
  filtroMarca = '';
  filtroCategoria = '';
  filtroTipoTela = '';
  filtroModeloId = '';
  filtroModeloLabel = '';
  modeloFiltroKey = 0;
  ordenacao: { campo: PecaOrdenacaoCampo; direcao: 'asc' | 'desc' } = {
    campo: 'categoria',
    direcao: 'asc',
  };
  categoriasFiltro: string[] = [...CATEGORIAS_PECA];
  marcasCatalogo: string[] = [];
  carregando = false;
  erro = '';
  excluindoId = '';
  readonly grid = new GridPaginationState();
  readonly gridPendencias = new GridPaginationState();
  readonly nivelClasses = ESTOQUE_NIVEL_CLASSES;
  readonly tiposTelaFiltro = TIPOS_TELA.filter(t => !!t.valor);
  readonly formatarDataCadastroModelo = formatarDataCadastroModelo;

  constructor(
    private service: PecasService,
    private aparelhosService: AparelhosService,
    private categoriasPecaService: CategoriasPecaService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.categoriasPecaService.nomes().subscribe(nomes => {
      this.categoriasFiltro = nomes;
      if (!this.coberturaCategoriaSelecionada && nomes.length > 0) {
        this.coberturaCategoriaSelecionada = nomes[0];
      }
    });
    this.carregarMarcasCatalogo();
    this.carregar();
  }

  get limitesEstoque() {
    return getEstoqueConfig();
  }

  get opcoesFiltroNivel(): Array<{ id: '' | NivelEstoque; label: string }> {
    return montarOpcoesFiltroNivelEstoque();
  }

  get marcasDisponiveis(): string[] {
    if (this.marcasCatalogo.length > 0) return this.marcasCatalogo;

    const set = new Set<string>();
    for (const p of this.pecas) {
      for (const mc of p.modelosCompativeis ?? []) {
        const m = mc.marcaNome?.trim();
        if (m) set.add(m);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  carregarMarcasCatalogo(): void {
    this.aparelhosService.listarMarcas().subscribe({
      next: marcas => {
        this.marcasCatalogo = marcas
          .map(m => m.nome?.trim())
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        this.carregarModelosCatalogo();
      },
      error: () => {
        this.marcasCatalogo = [];
        this.carregarModelosCatalogo();
      },
    });
  }

  carregarModelosCatalogo(): void {
    const requisicoes = this.marcasCatalogo.length > 0
      ? this.marcasCatalogo.map(marca =>
          this.aparelhosService.listarModelos({ marcaNome: marca, limite: MODELO_LIMITE_LISTA }))
      : [this.aparelhosService.listarModelos({ limite: MODELO_LIMITE_LISTA })];

    forkJoin(requisicoes).subscribe({
      next: listas => {
        const porId = new Map<string, ModeloAparelho>();
        for (const lista of listas) {
          for (const modelo of lista) {
            if (modelo.id) porId.set(modelo.id, modelo);
          }
        }
        this.modelosCatalogo = [...porId.values()].sort((a, b) =>
          this.labelModeloCobertura(a).localeCompare(this.labelModeloCobertura(b), 'pt-BR'));
      },
      error: () => { this.modelosCatalogo = []; },
    });
  }

  get pecasFiltradas(): PecaEstoque[] {
    return this.pecas.filter(p => {
      if (this.filtroNivel && calcularNivelEstoque(p.quantidadeEstoque ?? 0) !== this.filtroNivel) {
        return false;
      }
      if (this.filtroMarca && !this.pecaCompativelComMarcaAparelho(p, this.filtroMarca)) {
        return false;
      }
      if (this.filtroModeloId) {
        const temModelo = (p.modelosCompativeis ?? []).some(mc => mc.modeloId === this.filtroModeloId);
        if (!temModelo) return false;
      }
      if (this.filtroTipoTela && !this.pecaCompativelComTipoTela(p, this.filtroTipoTela)) {
        return false;
      }
      if (this.filtroCategoria) {
        const cat = inferirCategoriaPeca(p.nome, p.categoria);
        if (cat !== this.filtroCategoria) return false;
      }
      return true;
    });
  }

  get modelosCoberturaBase(): ModeloAparelho[] {
    const inicio = this.coberturaDataInicio ? new Date(`${this.coberturaDataInicio}T00:00:00`) : null;
    const fim = this.coberturaDataFim ? new Date(`${this.coberturaDataFim}T23:59:59`) : null;
    return this.modelosCatalogo.filter(modelo => {
      if (!modelo.id) return false;
      if (this.coberturaMarcaSelecionada && !this.mesmaMarca(modelo.marcaNome, this.coberturaMarcaSelecionada)) {
        return false;
      }
      if (this.coberturaTipoTela && !this.modeloBateTipoTela(modelo, this.coberturaTipoTela)) {
        return false;
      }
      if (inicio || fim) {
        const data = this.dataCadastroModelo(modelo);
        if (!data) return false;
        if (inicio && data < inicio) return false;
        if (fim && data > fim) return false;
      }
      return true;
    });
  }

  modelosElegiveisDaCategoria(categoria: string): ModeloAparelho[] {
    return this.modelosCoberturaBase.filter(modelo =>
      modeloElegivelParaCategoriaPeca(modelo.tipoTela, categoria));
  }

  get resumoPendenciasPorCategoria(): Array<{ categoria: string; pendentes: number }> {
    const categorias = this.categoriasFiltro.filter(c => c !== 'Outros');
    return categorias.map(categoria => {
      const idsCobertos = this.idsModeloCobertosPorCategoria(categoria);
      let pendentes = 0;
      for (const modelo of this.modelosElegiveisDaCategoria(categoria)) {
        const modeloId = modelo.id?.trim();
        if (!modeloId) continue;
        if (!idsCobertos.has(modeloId)) pendentes++;
      }
      return { categoria, pendentes };
    }).sort((a, b) => {
      const porPendentes = b.pendentes - a.pendentes;
      return porPendentes !== 0 ? porPendentes : a.categoria.localeCompare(b.categoria, 'pt-BR');
    });
  }

  get modelosSemCadastroSelecionado(): ModeloAparelho[] {
    const categoria = this.coberturaCategoriaSelecionada.trim();
    if (!categoria) return [];
    const idsCobertos = this.idsModeloCobertosPorCategoria(categoria);
    const termo = this.coberturaBuscaModelo.trim().toLowerCase();
    return this.modelosElegiveisDaCategoria(categoria).filter(modelo => {
      if (!modelo.id || idsCobertos.has(modelo.id)) return false;
      if (!termo) return true;
      return this.labelModeloCobertura(modelo).toLowerCase().includes(termo);
    });
  }

  get modelosPendenciasPaginados(): ModeloAparelho[] {
    return this.gridPendencias.paginate(this.modelosSemCadastroSelecionado);
  }

  labelModeloCobertura(modelo: ModeloAparelho): string {
    return modelo.marcaNome ? `${modelo.marcaNome} · ${modelo.nome}` : modelo.nome;
  }

  get pecasOrdenadas(): PecaEstoque[] {
    const copia = [...this.pecasFiltradas];
    copia.sort((a, b) => this.compararPecas(a, b));
    return copia;
  }

  get pecasPaginadas(): PecaEstoque[] {
    return this.grid.paginate(this.pecasOrdenadas);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.buscar(this.busca.trim() || undefined).subscribe({
      next: dados => {
        this.pecas = dados;
        this.grid.reset();
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar peças.';
        this.carregando = false;
      },
    });
  }

  onFiltroNivelChange(): void {
    this.grid.reset();
  }

  onFiltroLocalChange(): void {
    this.grid.reset();
  }

  ordenar(campo: PecaOrdenacaoCampo): void {
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

  iconeOrdenacao(campo: PecaOrdenacaoCampo): string {
    if (this.ordenacao.campo !== campo) return '↕';
    return this.ordenacao.direcao === 'asc' ? '↑' : '↓';
  }

  colunaOrdenada(campo: PecaOrdenacaoCampo): boolean {
    return this.ordenacao.campo === campo;
  }

  onFiltroMarcaChange(): void {
    if (this.filtroModeloId) {
      this.filtroModeloId = '';
      this.filtroModeloLabel = '';
      this.modeloFiltroKey++;
    }
    this.grid.reset();
  }

  selecionarCategoriaCobertura(categoria: string): void {
    this.coberturaCategoriaSelecionada = categoria;
    this.gridPendencias.reset();
  }

  onFiltroPendenciasChange(): void {
    this.gridPendencias.reset();
  }

  limparFiltroCoberturaModelos(): void {
    this.coberturaBuscaModelo = '';
    this.gridPendencias.reset();
  }

  limparFiltrosPendencias(): void {
    this.coberturaMarcaSelecionada = '';
    this.coberturaBuscaModelo = '';
    this.coberturaDataInicio = '';
    this.coberturaDataFim = '';
    this.coberturaTipoTela = '';
    this.gridPendencias.reset();
  }

  buscarModelosFiltroFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhosService.listarModelos({
      termo: termo.trim() || undefined,
      marcaNome: this.filtroMarca || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).pipe(
      map(ms => ms.map(modeloParaAutocomplete)),
    );

  onFiltroModeloSugestao(item: AutocompleteItem | null): void {
    if (!item?.id) {
      this.filtroModeloId = '';
      this.filtroModeloLabel = '';
      this.grid.reset();
      return;
    }
    this.filtroModeloId = String(item.id);
    this.filtroModeloLabel = item.marcaNome ? `${item.marcaNome} · ${item.nome}` : item.nome;
    if (item.marcaNome && !this.filtroMarca) this.filtroMarca = item.marcaNome;
    this.grid.reset();
  }

  limparFiltros(): void {
    this.busca = '';
    this.filtroNivel = '';
    this.filtroMarca = '';
    this.filtroCategoria = '';
    this.filtroTipoTela = '';
    this.filtroModeloId = '';
    this.filtroModeloLabel = '';
    this.modeloFiltroKey++;
    this.carregar();
  }

  get filtrosAvancadosAtivos(): number {
    let n = 0;
    if (this.filtroNivel) n++;
    if (this.filtroMarca) n++;
    if (this.filtroCategoria) n++;
    if (this.filtroTipoTela) n++;
    if (this.filtroModeloId) n++;
    return n;
  }

  get filtrosAtivos(): boolean {
    return !!this.busca.trim() || this.filtrosAvancadosAtivos > 0;
  }

  private compararPecas(a: PecaEstoque, b: PecaEstoque): number {
    const dir = this.ordenacao.direcao === 'asc' ? 1 : -1;
    let cmp = 0;

    switch (this.ordenacao.campo) {
      case 'peca':
        cmp = a.nome.localeCompare(b.nome, 'pt-BR');
        break;
      case 'categoria': {
        const catA = inferirCategoriaPeca(a.nome, a.categoria);
        const catB = inferirCategoriaPeca(b.nome, b.categoria);
        const diff = indiceCategoriaPeca(catA) - indiceCategoriaPeca(catB);
        cmp = diff !== 0 ? diff : catA.localeCompare(catB, 'pt-BR');
        if (cmp === 0) cmp = a.nome.localeCompare(b.nome, 'pt-BR');
        break;
      }
      case 'modelo':
        cmp = this.chaveOrdenacaoModelo(a).localeCompare(this.chaveOrdenacaoModelo(b), 'pt-BR');
        break;
      case 'preco':
        cmp = (a.valorSugeridoTroca ?? 0) - (b.valorSugeridoTroca ?? 0);
        break;
      case 'estoque':
        cmp = (a.quantidadeEstoque ?? 0) - (b.quantidadeEstoque ?? 0);
        break;
    }

    if (cmp === 0 && this.ordenacao.campo !== 'peca' && this.ordenacao.campo !== 'categoria') {
      cmp = a.nome.localeCompare(b.nome, 'pt-BR');
    }

    return cmp * dir;
  }

  nivelDaPeca(p: PecaEstoque): NivelEstoque {
    return calcularNivelEstoque(p.quantidadeEstoque ?? 0);
  }

  novo(): void {
    this.router.navigate(['/pecas/novo']);
  }

  editar(id: string): void {
    this.router.navigate(['/pecas', id]);
  }

  excluir(p: PecaEstoque): void {
    if (!p.id || this.excluindoId) return;

    const rotulo = p.nome?.trim() || inferirCategoriaPeca(p.nome, p.categoria);
    if (!confirm(`Excluir a peça "${rotulo}"?\n\nO cadastro será removido permanentemente.`)) return;

    this.excluindoId = p.id;
    this.erro = '';
    this.service.excluir(p.id).subscribe({
      next: () => {
        this.excluindoId = '';
        this.carregar();
      },
      error: err => {
        this.excluindoId = '';
        this.erro = this.mensagemErroExcluir(err);
      },
    });
  }

  tituloExcluirPeca(p: PecaEstoque): string {
    const qtd = p.quantidadeEstoque ?? 0;
    if (this.excluindoId === p.id) return 'Excluindo…';
    if (qtd > 0) return `Não é possível excluir: ${qtd} un. em estoque`;
    return 'Excluir peça';
  }

  podeExcluirPeca(p: PecaEstoque): boolean {
    return !!p.id && this.excluindoId !== p.id && (p.quantidadeEstoque ?? 0) <= 0;
  }

  modelosDaPeca(p: PecaEstoque): string[] {
    const nomes = (p.modelosCompativeis ?? [])
      .map(mc => (mc.modeloNome ?? mc.modeloId).trim())
      .filter(Boolean);

    return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  tooltipModelosCompativeis(p: PecaEstoque): string {
    const modelos = (p.modelosCompativeis ?? [])
      .map(mc => {
        const nome = (mc.modeloNome ?? mc.modeloId).trim();
        if (!nome) return '';
        return mc.marcaNome ? `${mc.marcaNome} ${nome}` : nome;
      })
      .filter(Boolean);

    return modelos.length ? [...new Set(modelos)].join(', ') : '—';
  }

  temPrecoPorModelo(p: PecaEstoque): boolean {
    return (p.modelosCompativeis ?? []).some(
      m => m.valorSugeridoTroca != null || m.valorSugeridoMinimo != null,
    );
  }

  formatarMoeda(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  inferirCategoria(p: PecaEstoque): string {
    return inferirCategoriaPeca(p.nome, p.categoria);
  }

  private pecaCompativelComMarcaAparelho(peca: PecaEstoque, marca: string): boolean {
    return (peca.modelosCompativeis ?? []).some(mc =>
      this.mesmaMarca(mc.marcaNome, marca),
    );
  }

  private mesmaMarca(a?: string, b?: string): boolean {
    return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
  }

  private dataCadastroModelo(modelo: ModeloAparelho): Date | null {
    const base = modelo.criadoEm ?? modelo.atualizadoEm;
    if (!base) return null;
    const d = new Date(base);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private pecaCompativelComTipoTela(peca: PecaEstoque, tipoTela: string): boolean {
    return (peca.modelosCompativeis ?? []).some(mc => {
      const modelo = this.modelosCatalogo.find(m => m.id === mc.modeloId);
      return this.modeloBateTipoTela(modelo, tipoTela);
    });
  }

  private modeloBateTipoTela(modelo: ModeloAparelho | undefined, filtro: string): boolean {
    return mesmoTipoTelaArquitetura(modelo?.tipoTela, filtro);
  }

  private idsModeloCobertosPorCategoria(categoria: string): Set<string> {
    const ids = new Set<string>();
    for (const p of this.pecas) {
      if (inferirCategoriaPeca(p.nome, p.categoria) !== categoria) continue;
      for (const mc of p.modelosCompativeis ?? []) {
        if (mc.modeloId?.trim()) ids.add(mc.modeloId.trim());
      }
    }
    return ids;
  }

  private chaveOrdenacaoModelo(p: PecaEstoque): string {
    const rotulos = (p.modelosCompativeis ?? [])
      .map(mc => {
        const nome = (mc.modeloNome ?? mc.modeloId).trim();
        if (!nome) return '';
        const marca = mc.marcaNome?.trim();
        return marca ? `${marca} ${nome}` : nome;
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return rotulos[0] ?? '';
  }

  private mensagemErroExcluir(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Sem conexão com a API. Verifique se o backend está rodando.';
      }
      if (err.status === 404 || err.status === 405) {
        return 'Exclusão indisponível na API. Reinicie o backend e tente novamente.';
      }
      const body = err.error;
      if (body && typeof body === 'object' && 'erro' in body && typeof (body as { erro: unknown }).erro === 'string') {
        return (body as { erro: string }).erro;
      }
      if (typeof body === 'string' && body.trim()) return body.trim();
    }
    return 'Erro ao excluir peça.';
  }
}
