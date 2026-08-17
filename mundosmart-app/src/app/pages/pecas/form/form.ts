import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { PecasService } from '../../../services/pecas';
import { AparelhosService } from '../../../services/aparelhos';
import { CategoriasPecaService } from '../../../services/categorias-peca';
import { CATEGORIAS_PECA, categoriaUsaCoresPorModelo, inferirCategoriaPeca } from '../../../config/peca-categoria.config';
import { formatarDataCadastroModelo } from '../../../utils/modelo-autocomplete.util';
import { CorEstoqueModelo, ModeloAparelho, ModeloCompativel, PecaEstoque, VariacaoServico } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA } from '../../../config/aparelhos.config';

@Component({
  selector: 'app-pecas-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './form.html',
  styles: `
    .preco-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 0;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .preco-toggle label { margin: 0; font-weight: 600; cursor: pointer; }
    .compat-add { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 12px; }
    .compat-add .form-group { margin: 0; min-width: 140px; }
    .compat-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .compat-table th, .compat-table td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 13px; vertical-align: middle; }
    .compat-table th { background: #f5f7fa; }
    .compat-table input[type="number"] { width: 100%; max-width: 110px; }
    .compat-hint { font-size: 12px; color: #64748b; margin: 8px 0; }
    .compat-aviso { font-size: 12px; color: #b45309; margin: 6px 0; }
    .compat-erro { font-size: 12px; color: #b91c1c; margin: 6px 0; }
    .secao-precos { margin-bottom: 20px; }
    .nome-exemplo { font-size: 12px; color: #475569; margin-top: 4px; }
    .resultados-modelos {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      max-height: 220px;
      overflow-y: auto;
      margin: 8px 0 12px;
    }
    .resultado-modelo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
    }
    .resultado-modelo:last-child { border-bottom: none; }
    .resultado-modelo button { white-space: nowrap; }
    .resultado-modelo.ja-vinculado { opacity: 0.55; }
    .cores-modelo {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .cores-modelo-titulo {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin: 0 0 2px;
    }
    .cor-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .cor-linha input[type="text"] { flex: 1 1 120px; min-width: 100px; }
    .cor-linha input[type="number"] { width: 72px; }
    .cor-linha button {
      width: 28px;
      height: 28px;
      padding: 0;
      line-height: 1;
    }
    .btn-add-cor {
      align-self: flex-start;
      font-size: 12px;
      padding: 4px 10px;
    }
    .estoque-total-hint { font-size: 12px; color: #166534; margin: 4px 0 0; font-weight: 600; }
    .variacoes-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .variacoes-table th, .variacoes-table td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; font-size: 13px; vertical-align: middle; }
    .variacoes-table th { background: #f5f7fa; }
    .variacoes-table input[type="number"] { width: 100%; max-width: 110px; }
    .exemplos-nome { font-size: 12px; color: #64748b; margin: 4px 0 0; }
    .exemplos-nome span { display: inline-block; margin: 2px 6px 2px 0; padding: 2px 8px; background: #f1f5f9; border-radius: 4px; }
  `,
})
export class PecasForm implements OnInit, OnDestroy {
  categoriasPeca: string[] = [...CATEGORIAS_PECA];

  peca: PecaEstoque = {
    nome: '',
    quantidadeEstoque: 0,
    estoqueNaLoja: true,
    ignorarAlertaEstoque: false,
    modelosCompativeis: [],
    variacoes: [],
  };

  precoUnico = true;
  editando = false;
  salvando = false;
  erro = '';

  buscaModelo = '';
  filtroMarcaModelo = '';
  modelosBusca: ModeloAparelho[] = [];
  marcasCatalogo: string[] = [];
  buscandoModelos = false;
  avisoModelo = '';

  private readonly buscaModelo$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pecasService: PecasService,
    private aparelhosService: AparelhosService,
    private categoriasPecaService: CategoriasPecaService,
  ) {}

  ngOnInit(): void {
    this.buscaModelo$.pipe(
      debounceTime(150),
      takeUntil(this.destroy$),
    ).subscribe(() => this.buscarModelos());

    this.categoriasPecaService.nomes().subscribe(nomes => {
      this.categoriasPeca = nomes;
    });
    this.carregarMarcasCatalogo();

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'novo') {
      this.editando = true;
      this.pecasService.obter(id).subscribe({
        next: p => {
          this.peca = {
            ...p,
            estoqueNaLoja: p.estoqueNaLoja !== false,
            ignorarAlertaEstoque: !!p.ignorarAlertaEstoque,
            modelosCompativeis: (p.modelosCompativeis ?? []).map(m => ({
              ...m,
              cores: m.cores?.length ? m.cores : (categoriaUsaCoresPorModelo(p.categoria) ? [{ cor: '', quantidade: 0 }] : undefined),
            })),
            variacoes: p.variacoes ?? [],
          };
          this.atualizarModoPreco();
          this.sincronizarFiltroMarca();
        },
        error: () => { this.erro = 'Erro ao carregar peça.'; },
      });
    } else {
      this.buscarModelos();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get marcasModeloDisponiveis(): string[] {
    if (this.marcasCatalogo.length > 0) return this.marcasCatalogo;

    const marcas = new Set<string>();
    for (const m of this.modelosBusca) {
      if (m.marcaNome?.trim()) marcas.add(m.marcaNome.trim());
    }
    for (const m of this.peca.modelosCompativeis ?? []) {
      if (m.marcaNome?.trim()) marcas.add(m.marcaNome.trim());
    }
    return [...marcas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  get marcaVinculada(): string {
    return (this.peca.modelosCompativeis ?? [])
      .map(m => m.marcaNome?.trim())
      .find(Boolean) ?? '';
  }

  carregarMarcasCatalogo(): void {
    this.aparelhosService.listarMarcas().subscribe({
      next: marcas => {
        this.marcasCatalogo = marcas
          .map(m => m.nome?.trim())
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      },
      error: () => { this.marcasCatalogo = []; },
    });
  }

  onBuscaModeloChange(): void {
    this.avisoModelo = '';
    this.buscaModelo$.next();
  }

  onFiltroMarcaChange(): void {
    this.avisoModelo = '';
    this.buscarModelos();
  }

  onBuscaModeloFocus(): void {
    if (this.modelosBusca.length === 0) this.buscarModelos();
  }

  buscarModelos(): void {
    this.buscandoModelos = true;
    this.aparelhosService.listarModelos({
      termo: this.buscaModelo.trim() || undefined,
      marcaNome: this.filtroMarcaModelo.trim() || this.marcaVinculada || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).subscribe({
      next: lista => {
        this.modelosBusca = lista;
        this.buscandoModelos = false;
      },
      error: () => {
        this.modelosBusca = [];
        this.buscandoModelos = false;
        this.avisoModelo = 'Erro ao buscar modelos.';
      },
    });
  }

  modeloJaVinculado(modeloId?: string): boolean {
    if (!modeloId) return false;
    return (this.peca.modelosCompativeis ?? []).some(m => m.modeloId === modeloId);
  }

  formatarCadastro(m: ModeloAparelho): string {
    return formatarDataCadastroModelo(m.criadoEm);
  }

  get usaCoresPorModelo(): boolean {
    return categoriaUsaCoresPorModelo(this.peca.categoria);
  }

  get totalEstoqueCores(): number {
    let total = 0;
    for (const m of this.peca.modelosCompativeis ?? []) {
      for (const c of m.cores ?? []) {
        total += Math.max(0, Number(c.quantidade) || 0);
      }
    }
    return total;
  }

  onCategoriaChange(): void {
    if (this.usaCoresPorModelo) {
      for (const m of this.peca.modelosCompativeis ?? []) {
        if (!m.cores?.length) {
          m.cores = [{ cor: '', quantidade: 0 }];
        }
      }
    }
  }

  totalCoresModelo(m: ModeloCompativel): number {
    return (m.cores ?? []).reduce((s, c) => s + Math.max(0, Number(c.quantidade) || 0), 0);
  }

  adicionarCor(modeloIndex: number): void {
    const modelo = this.peca.modelosCompativeis?.[modeloIndex];
    if (!modelo) return;
    modelo.cores = modelo.cores ?? [];
    modelo.cores.push({ cor: '', quantidade: 0 });
  }

  removerCor(modeloIndex: number, corIndex: number): void {
    const modelo = this.peca.modelosCompativeis?.[modeloIndex];
    if (!modelo?.cores) return;
    modelo.cores.splice(corIndex, 1);
    if (modelo.cores.length === 0) {
      modelo.cores.push({ cor: '', quantidade: 0 });
    }
  }

  private normalizarCoresModelo(m: ModeloCompativel): CorEstoqueModelo[] | undefined {
    if (!this.usaCoresPorModelo) return undefined;
    return (m.cores ?? [])
      .map(c => ({
        cor: (c.cor ?? '').trim(),
        quantidade: Math.max(0, Math.floor(Number(c.quantidade) || 0)),
      }))
      .filter(c => c.cor);
  }

  adicionarModelo(ref?: ModeloAparelho): void {
    this.avisoModelo = '';
    if (!ref?.id) {
      this.avisoModelo = 'Selecione um modelo na lista e clique em Adicionar.';
      return;
    }
    if (this.modeloJaVinculado(ref.id)) {
      this.avisoModelo = 'Este modelo já está vinculado à peça.';
      return;
    }

    const marcaNova = ref.marcaNome?.trim();
    const marcaAtual = this.marcaVinculada;
    if (marcaAtual && marcaNova && !this.mesmaMarca(marcaAtual, marcaNova)) {
      this.avisoModelo = `Esta peça já está vinculada à marca ${marcaAtual}. Cadastre outra peça para ${marcaNova}.`;
      return;
    }

    const item: ModeloCompativel = {
      modeloId: ref.id,
      modeloNome: ref.nome,
      marcaNome: ref.marcaNome,
      cores: this.usaCoresPorModelo ? [{ cor: '', quantidade: 0 }] : undefined,
    };

    this.peca.modelosCompativeis = [...(this.peca.modelosCompativeis ?? []), item];
    if (!this.filtroMarcaModelo && marcaNova) {
      this.filtroMarcaModelo = marcaNova;
    }
  }

  removerModelo(index: number): void {
    this.peca.modelosCompativeis?.splice(index, 1);
    if (!this.marcaVinculada) {
      this.filtroMarcaModelo = '';
    }
    this.avisoModelo = '';
  }

  adicionarVariacao(): void {
    this.peca.variacoes = this.peca.variacoes ?? [];
    const ordem = this.peca.variacoes.length + 1;
    this.peca.variacoes.push({ rotulo: '', ordem });
  }

  removerVariacao(index: number): void {
    this.peca.variacoes?.splice(index, 1);
    this.reordenarVariacoes();
  }

  private reordenarVariacoes(): void {
    for (let i = 0; i < (this.peca.variacoes?.length ?? 0); i++) {
      this.peca.variacoes![i].ordem = i + 1;
    }
  }

  onPrecoUnicoChange(): void {
    if (this.precoUnico) {
      for (const m of this.peca.modelosCompativeis ?? []) {
        m.valorSugeridoTroca = undefined;
        m.valorSugeridoMinimo = undefined;
      }
    }
  }

  salvar(): void {
    if (!this.peca.categoria?.trim()) {
      this.erro = 'Selecione a categoria da peça.';
      return;
    }
    if (!this.peca.nome?.trim()) {
      this.peca.nome = this.peca.categoria.trim();
    }
    if (!this.peca.nome?.trim()) {
      this.erro = 'Nome da peça é obrigatório.';
      return;
    }

    if (this.usaCoresPorModelo) {
      const semCor = (this.peca.modelosCompativeis ?? []).some(m =>
        !(m.cores ?? []).some(c => (c.cor ?? '').trim()));
      if ((this.peca.modelosCompativeis?.length ?? 0) > 0 && semCor) {
        this.erro = 'Informe ao menos uma cor para cada modelo (Tampa traseira / Vidro Traseiro).';
        return;
      }
      this.peca.quantidadeEstoque = this.totalEstoqueCores;
    }

    if (this.precoUnico) {
      for (const m of this.peca.modelosCompativeis ?? []) {
        m.valorSugeridoTroca = undefined;
        m.valorSugeridoMinimo = undefined;
      }
    }

    const payload: PecaEstoque = {
      ...this.peca,
      nome: this.peca.nome.trim(),
      categoria: this.peca.categoria?.trim() || inferirCategoriaPeca(this.peca.nome),
      descricao: this.peca.descricao?.trim() || undefined,
      marcaPeca: this.peca.marcaPeca?.trim() || undefined,
      garantia: this.peca.garantia?.trim() || undefined,
      quantidadeEstoque: this.usaCoresPorModelo ? this.totalEstoqueCores : this.peca.quantidadeEstoque,
      variacoes: (this.peca.variacoes ?? [])
        .map((v, i) => ({
          rotulo: v.rotulo?.trim() ?? '',
          detalhe: v.detalhe?.trim() || undefined,
          valorSugeridoTroca: v.valorSugeridoTroca ?? undefined,
          valorSugeridoMinimo: v.valorSugeridoMinimo ?? undefined,
          garantia: v.garantia?.trim() || undefined,
          ordem: v.ordem ?? i + 1,
        }))
        .filter(v => v.rotulo),
      modelosCompativeis: (this.peca.modelosCompativeis ?? []).map(m => ({
        modeloId: m.modeloId,
        modeloNome: m.modeloNome,
        marcaNome: m.marcaNome,
        valorSugeridoTroca: m.valorSugeridoTroca ?? undefined,
        valorSugeridoMinimo: m.valorSugeridoMinimo ?? undefined,
        cores: this.normalizarCoresModelo(m),
      })),
    };

    this.salvando = true;
    this.erro = '';
    this.pecasService.salvar(payload).subscribe({
      next: () => this.router.navigate(['/pecas']),
      error: err => {
        this.erro = err?.error?.erro ?? err?.error ?? 'Erro ao salvar peça.';
        this.salvando = false;
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/pecas']);
  }

  labelModelo(m: ModeloCompativel): string {
    return m.marcaNome ? `${m.marcaNome} ${m.modeloNome ?? ''}`.trim() : (m.modeloNome ?? m.modeloId);
  }

  private atualizarModoPreco(): void {
    this.precoUnico = !(this.peca.modelosCompativeis ?? []).some(
      m => m.valorSugeridoTroca != null || m.valorSugeridoMinimo != null,
    );
  }

  private sincronizarFiltroMarca(): void {
    if (this.marcaVinculada) {
      this.filtroMarcaModelo = this.marcaVinculada;
      this.buscarModelos();
    }
  }

  private mesmaMarca(a: string, b: string): boolean {
    return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'accent' }) === 0;
  }
}
