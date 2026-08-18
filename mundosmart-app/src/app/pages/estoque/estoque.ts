import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, of, TimeoutError, timeout } from 'rxjs';
import { map } from 'rxjs/operators';
import { modeloParaAutocomplete } from '../../utils/modelo-autocomplete.util';
import { EstoqueService } from '../../services/estoque';
import { AparelhosService } from '../../services/aparelhos';
import { CategoriasPecaService } from '../../services/categorias-peca';
import {
  calcularNivelEstoque,
  ESTOQUE_NIVEL_CLASSES,
  getEstoqueConfig,
  labelNivelEstoque as textoNivelEstoque,
  NivelEstoque,
  opcoesFiltroNivelEstoque as montarOpcoesFiltroNivelEstoque,
} from '../../config/estoque.config';
import {
  carregarPeriodoReposicaoSalvo,
  labelPeriodoReposicao,
  normalizarStatusRelatorioReposicao,
  PERIODOS_REPOSICAO,
  PeriodoReposicao,
  RELATORIO_REPOSICAO_HISTORICO_LIMITE,
  RELATORIO_REPOSICAO_STATUS,
  RelatorioReposicaoStatusFiltro,
  salvarPeriodoReposicao,
} from '../../config/estoque-reposicao.config';
import {
  CaixaRetornoAdicaoResponse,
  CaixaRetornoGarantiaResponse,
  ItemPedidoCompraRequest,
  ItemPedidoCompraUi,
  LIMITE_ITENS_PEDIDO_COMPRA,
  LoteDevolucaoGarantiaDocumento,
  LoteEstoque,
  LoteGarantiaItem,
  MovimentacaoEstoque,
  PedidoCompraDetalhe,
  PedidoCompraEstoque,
  PecaCatalogo,
  RelatorioFinanceiroEstoque,
  RelatorioReposicaoHistorico,
  ReposicaoResumoModelo,
  ReposicaoSemanalItem,
  ReposicaoSemanalResponse,
} from '../../models/estoque.models';
import { ModeloAparelho, ModeloCompativel, PecaEstoque } from '../../models/bling.models';
import { MODELO_LIMITE_LISTA, TIPOS_TELA, mesmoTipoTelaArquitetura } from '../../config/aparelhos.config';
import { NovaPecaPedidoModal } from '../../components/nova-peca-pedido-modal/nova-peca-pedido-modal';
import { AutocompleteCriavel, AutocompleteItem } from '../../components/autocomplete-criavel/autocomplete-criavel';
import { GridPaginator } from '../../components/grid-paginator/grid-paginator';
import { GridPaginationState } from '../../utils/grid-pagination.state';
import {
  agruparPecasPorCategoria,
  CATEGORIAS_PECA,
  categoriaUsaCoresPorModelo,
  inferirCategoriaPeca,
  labelPecaCatalogo,
} from '../../config/peca-categoria.config';
import { abrirJanelaReposicaoPdf, montarHtmlReposicaoPdf } from '../../utils/reposicao-pdf.util';
import {
  abrirJanelaLoteDevolucaoGarantia,
  montarHtmlLoteDevolucaoGarantia,
} from '../../utils/garantia-devolucao-pdf.util';
import { FORNECEDORES_ESTOQUE_PRECADASTRO } from '../../config/os-peca-origem.config';

type AbaEstoque =
  | 'estoque'
  | 'pedidos'
  | 'saidas'
  | 'reposicao'
  | 'financeiro'
  | 'garantia'
  | 'novo-pedido'
  | 'nova-saida';

interface EstoqueGrupoMarca {
  marca: string;
  pecas: PecaCatalogo[];
}

@Component({
  selector: 'app-estoque',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NovaPecaPedidoModal, AutocompleteCriavel, GridPaginator],
  templateUrl: './estoque.html',
  styles: [`
    .estoque-abas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .estoque-abas button {
      padding: 8px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .estoque-abas button.ativa {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }
    .estoque-aba-link {
      display: inline-flex;
      align-items: center;
      padding: 8px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .estoque-aba-link:hover {
      border-color: #93c5fd;
      color: #1d4ed8;
    }
    .estoque-painel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }
    .saida-estornada td { color: #94a3b8; }
    .badge-estorno {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      background: #e2e8f0;
      color: #475569;
      white-space: nowrap;
    }
    .badge-estorno.parcial {
      background: #fef3c7;
      color: #92400e;
    }
    .saidas-filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: flex-end;
      margin-bottom: 14px;
    }
    .saidas-filtros .form-group {
      margin: 0;
      min-width: 140px;
    }
    .saidas-filtros .form-group.busca {
      flex: 1 1 220px;
      min-width: 200px;
    }
    .saidas-filtros label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 4px;
    }
    .saidas-filtros input,
    .saidas-filtros select {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      background: #fff;
    }
    .saidas-filtros .btn-limpar {
      background: #fff;
      border: 1px solid #cbd5e1;
      color: #475569;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .saidas-resumo {
      font-size: 12px;
      color: #64748b;
      margin: 0 0 10px;
    }
    .filtro-modelo-ac {
      min-width: 180px;
      flex: 1 1 180px;
      max-width: 260px;
    }
    .estoque-form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .item-pedido-wrapper {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
      overflow: visible;
      position: relative;
    }
    .itens-pedido-lista {
      max-height: min(70vh, 920px);
      overflow-y: auto;
      padding-right: 4px;
      margin-bottom: 4px;
    }
    .item-pedido-num {
      flex: 0 0 28px;
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      padding-top: 22px;
      text-align: center;
    }
    .item-pedido-linha {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: flex-end;
      overflow: visible;
    }
    .item-pedido-linha .form-group {
      margin: 0;
      flex: 0 0 auto;
      min-width: 0;
    }
    .item-pedido-linha label {
      font-size: 10px;
      white-space: nowrap;
      display: block;
      margin-bottom: 3px;
    }
    .item-pedido-linha input,
    .item-pedido-linha select {
      font-size: 12px;
      padding: 6px 8px;
      width: 100%;
      box-sizing: border-box;
    }
    .item-pedido-linha ::ng-deep .ac-input {
      padding: 6px 26px 6px 8px;
      font-size: 12px;
    }
    .item-pedido-aviso {
      font-size: 11px;
      color: #b91c1c;
      margin: 4px 0 0;
    }
    .item-pedido-aviso.ok { color: #166534; }
    .item-pedido-sugestao {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 6px 0 0;
      padding: 8px 10px;
      border: 1px solid #fde68a;
      border-radius: 8px;
      background: #fffbeb;
      font-size: 12px;
      color: #92400e;
    }
    .btn-sugestao-cadastro {
      border: 1px solid #2563eb;
      background: #2563eb;
      color: #fff;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-sugestao-cadastro:hover { background: #1d4ed8; }
    .item-pedido-remover {
      flex: 0 0 28px;
      width: 28px;
      height: 30px;
      padding: 0;
      align-self: flex-end;
      margin-bottom: 1px;
    }
    .campo-com-acao {
      display: flex;
      gap: 4px;
      align-items: stretch;
    }
    .campo-com-acao select { flex: 1; min-width: 0; }
    .btn-icon-mais {
      width: 28px;
      min-width: 28px;
      height: 30px;
      border: 1px solid #2563eb;
      background: #eff6ff;
      color: #2563eb;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      padding: 0;
    }
    .btn-icon-mais:hover { background: #dbeafe; }
    .form-group-cat { width: 128px; }
    .form-group-modelo {
      flex: 1 1 180px;
      min-width: 160px;
      max-width: 260px;
      overflow: visible;
      position: relative;
    }
    .form-group-modelo:focus-within { z-index: 50; }
    .item-pedido-linha ::ng-deep .ac-lista { z-index: 100; }
    .form-group-cor { width: 100px; }
    .form-group-qual { width: 100px; }
    .form-group-forn { width: 88px; }
    .form-group-marca { width: 76px; }
    .form-group-qtd { width: 56px; }
    .form-group-custo { width: 100px; }
    .form-group-gar { width: 56px; }
    .input-bloqueado {
      background: #f8fafc;
      color: #94a3b8;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      height: 30px;
    }
    .badge-entrada { background: #dcfce7; color: #166534; }
    .badge-saida { background: #fee2e2; color: #991b1b; }
    .badge-tipo {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .reposicao-alerta { color: #b45309; font-weight: 600; }
    .detalhe-pedido { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .lote-edit-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin-top: 10px;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .lote-edit-acoes {
      display: flex;
      gap: 8px;
      align-items: end;
      flex-wrap: wrap;
    }
    .estoque-resumo {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
      padding: 12px 14px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .estoque-resumo strong { font-size: 1.25rem; color: #1e40af; }
    .estoque-busca { max-width: 320px; margin-bottom: 12px; }
    .estoque-filtros { margin-bottom: 12px; }
    .estoque-resumo-alerta {
      cursor: pointer;
      font: inherit;
    }
    .estoque-resumo-alerta.ativo {
      outline: 2px solid #2563eb;
      outline-offset: 1px;
    }
    .estoque-modelos-col { max-width: 280px; font-size: 12px; line-height: 1.4; color: #475569; }
    .estoque-marca-header td {
      background: #f1f5f9;
      font-weight: 700;
      color: #1e40af;
      padding: 10px 12px;
      border-top: 2px solid #cbd5e1;
    }
    .estoque-grupo-marca:first-child .estoque-marca-header td { border-top: none; }
    .reposicao-filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .reposicao-periodos {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .reposicao-periodos button {
      padding: 6px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .reposicao-periodos button.ativo {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }
    .reposicao-resumo-modelo { margin-bottom: 20px; }
    .reposicao-resumo-modelo h4 { margin: 0 0 8px; font-size: 14px; color: #1e40af; }
    .btn-exportar-pdf {
      background: #1e40af;
      color: #fff;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-exportar-pdf:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .btn-gerar-relatorio {
      background: #0f766e;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 9px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-gerar-relatorio:disabled { opacity: 0.45; cursor: not-allowed; }
    .historico-relatorios {
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
    }
    .historico-relatorios h4 { margin: 0 0 8px; font-size: 14px; }
    .historico-filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }
    .historico-filtros select {
      min-width: 180px;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      font-size: 13px;
    }
    .historico-status-select {
      min-width: 170px;
      padding: 4px 6px;
      font-size: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
    }
    .historico-status-select.status-nao_concluido { border-color: #f59e0b; }
    .historico-status-select.status-parcial { border-color: #3b82f6; }
    .historico-status-select.status-concluido { border-color: #10b981; }
    .garantia-acoes { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .garantia-acoes input[type="number"] { width: 72px; }
    .fin-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .fin-kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .fin-kpi .campo-hint { margin: 0 0 4px; font-size: 12px; }
    .fin-kpi strong {
      display: block;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .fin-kpi.destaque {
      background: #eff6ff;
      border-color: #bfdbfe;
    }
    .fin-kpi.destaque strong { color: #1d4ed8; }
    .fin-meses-opts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .fin-meses-opts button {
      padding: 6px 12px !important;
      min-width: unset;
      font-size: 13px !important;
    }
    .fin-meses-opts button.ativo {
      background: #2563eb !important;
      border-color: #2563eb !important;
      color: #fff !important;
    }
  `],
})
export class EstoquePage implements OnInit {
  aba: AbaEstoque = 'estoque';
  carregando = false;
  erro = '';
  sucesso = '';
  salvandoRelatorio = false;

  pedidos: PedidoCompraEstoque[] = [];
  pedidoDetalhe?: PedidoCompraDetalhe;
  loteEditandoId = '';
  loteEdit: {
    fornecedor: string;
    marcaPeca: string;
    custoUnitario: number;
    garantiaMeses: number;
    quantidadeInicial: number;
    unidadesJaSaidas: number;
  } | null = null;
  salvandoLote = false;
  excluindoLoteId = '';
  incluindoItem = false;
  itemPedidoExtra: ItemPedidoCompraUi = this.itemVazio();
  movimentacoes: MovimentacaoEstoque[] = [];
  movimentacoesTotal = 0;
  readonly gridSaidas = new GridPaginationState();
  saidaFiltroBusca = '';
  saidaFiltroInicio = '';
  saidaFiltroFim = '';
  saidaFiltroOrigem: '' | 'os' | 'manual' = '';
  saidaFiltroStatus: '' | 'ativas' | 'estornadas' | 'parciais' = '';
  relatorio?: ReposicaoSemanalResponse;
  financeiro?: RelatorioFinanceiroEstoque;
  financeiroMeses = 12;
  readonly opcoesMesesFinanceiro = [6, 12, 24];
  historicoRelatorios: RelatorioReposicaoHistorico[] = [];
  filtroStatusHistorico: RelatorioReposicaoStatusFiltro = '';
  readonly statusRelatorioOpcoes = RELATORIO_REPOSICAO_STATUS;
  readonly historicoLimite = RELATORIO_REPOSICAO_HISTORICO_LIMITE;
  atualizandoStatusId = '';
  lotesGarantia: LoteGarantiaItem[] = [];
  filtroOsGarantia = '';
  filtroLoteGarantia = '';
  filtroFornecedorGarantia = '';
  garantiaOsLabel = '';
  garantiaLoteLabel = '';
  garantiaFornecedorLabel = '';
  /** Só muda no limpar — evita *ngFor com array literal que trava o CD. */
  garantiaOsTrack: number[] = [0];
  garantiaLoteTrack: number[] = [0];
  garantiaFornecedorTrack: number[] = [0];
  lotesGarantiaAgrupados: { fornecedor: string; itens: LoteGarantiaItem[] }[] = [];
  devolucaoQtd: Record<string, number> = {};
  devolucaoMotivo: Record<string, string> = {};
  devolvendoLoteId = '';
  caixaRetorno?: CaixaRetornoGarantiaResponse;
  carregandoCaixaRetorno = false;
  gerandoLoteFornecedor = '';
  removendoCaixaId = '';
  categoriasPecaPedido: string[] = CATEGORIAS_PECA.filter(c => c !== 'Outros');
  readonly fornecedoresPedidoPrecadastro = [...FORNECEDORES_ESTOQUE_PRECADASTRO];
  readonly buscarOsGarantiaFn = (termo: string) =>
    this.service.sugerirOsGarantia(termo).pipe(
      map(itens => itens.map(i => ({
        id: i.id,
        nome: i.nome,
        extra: i.extra,
      }))),
    );
  readonly buscarLoteGarantiaFn = (termo: string) =>
    this.service.sugerirLoteGarantia(termo).pipe(
      map(itens => itens.map(i => ({
        id: i.id,
        nome: i.nome,
        extra: i.extra,
      }))),
    );
  readonly buscarFornecedorGarantiaFn = (termo: string) =>
    this.service.sugerirFornecedorGarantia(termo).pipe(
      map(itens => itens.map(i => ({
        id: i.id,
        nome: i.nome,
        extra: i.extra,
      }))),
    );

  pecas: PecaCatalogo[] = [];
  modelosPedido: ModeloAparelho[] = [];
  filtrosEstoqueAbertos = false;
  filtroEstoque = '';
  filtroMarca = '';
  filtroModeloId = '';
  filtroModeloLabel = '';
  filtroCategoriaEstoque = '';
  filtroTipoTelaEstoque = '';
  modeloFiltroEstoqueKey = 0;
  categoriasFiltroEstoque: string[] = [...CATEGORIAS_PECA];
  /** '' | vermelho | laranja | amarelo | verde */
  filtroNivelEstoque: '' | NivelEstoque = '';
  modelos: ModeloAparelho[] = [];
  marcasCatalogo: string[] = [];
  modelosReposicao: ModeloAparelho[] = [];
  pecaLotesExpandida = '';
  lotesPeca: LoteEstoque[] = [];
  carregandoLotes = false;

  readonly periodosReposicao = PERIODOS_REPOSICAO;
  readonly tiposTelaFiltro = TIPOS_TELA.filter(t => !!t.valor);
  periodoReposicao: PeriodoReposicao = carregarPeriodoReposicaoSalvo();
  reposicaoInicio = this.dataInputDiasAtras(6);
  reposicaoFim = this.hojeInput();
  reposicaoModeloId = '';

  // Novo pedido
  readonly limiteItensPedido = LIMITE_ITENS_PEDIDO_COMPRA;
  private proximoUidItemPedido = 1;
  private modeloIdsPorCategoriaCache = new Map<string, Set<string>>();
  pedidoNumero = '';
  pedidoFornecedor = '';
  pedidoNf = '';
  pedidoData = this.hojeInput();
  pedidoObs = '';
  itensPedido: ItemPedidoCompraUi[] = [this.itemVazio()];
  modalNovaPecaAberto = false;
  itemPedidoNovaPeca?: ItemPedidoCompraUi;

  // Nova saída
  saidaPecaId = '';
  saidaPecaLabel = '';
  saidaMarca = '';
  saidaModeloId = '';
  saidaModeloLabel = '';
  saidaModeloNome = '';
  saidaQtd = 1;
  saidaOsNumero = '';
  saidaObs = '';
  saidaFormKey = 0;
  saidaPecaAcKey = 0;

  constructor(
    private service: EstoqueService,
    private aparelhosService: AparelhosService,
    private categoriasPecaService: CategoriasPecaService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.categoriasPecaService.nomes().subscribe(nomes => {
      this.categoriasPecaPedido = nomes.filter(c => c !== 'Outros');
      this.categoriasFiltroEstoque = nomes;
    });
    this.carregarMarcasCatalogo();
    const abaQuery = this.route.snapshot.queryParamMap.get('aba') as AbaEstoque | null;
    const abasValidas: AbaEstoque[] = [
      'estoque', 'pedidos', 'saidas', 'reposicao', 'financeiro', 'garantia', 'novo-pedido', 'nova-saida',
    ];
    this.irPara(abaQuery && abasValidas.includes(abaQuery) ? abaQuery : 'estoque');
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

  irPara(aba: AbaEstoque): void {
    this.aba = aba;
    this.erro = '';
    this.sucesso = '';
    this.pedidoDetalhe = undefined;
    this.loteEditandoId = '';
    this.loteEdit = null;
    this.excluindoLoteId = '';
    this.incluindoItem = false;
    this.itemPedidoExtra = this.itemVazio();
    this.pecaLotesExpandida = '';
    this.lotesPeca = [];

    if (aba === 'estoque') this.carregarEstoque();
    if (aba === 'pedidos') this.carregarPedidos();
    if (aba === 'saidas') this.carregarSaidas();
    if (aba === 'reposicao') {
      this.carregarModelosReposicao();
      this.carregarHistoricoRelatorios();
      if (this.periodoReposicao !== 'personalizado') {
        this.selecionarPeriodoReposicao(this.periodoReposicao);
      } else {
        this.pesquisarReposicao();
      }
    }
    if (aba === 'financeiro') this.carregarFinanceiro();
    if (aba === 'garantia') {
      this.carregarFornecedoresEstoqueGarantia();
      this.carregarLotesGarantia();
      this.carregarCaixaRetorno();
    }
    if (aba === 'nova-saida') {
      this.carregarPecas();
      this.limparFormularioSaida();
    }
    if (aba === 'novo-pedido') {
      this.carregarPecas();
      this.carregarModelosPedido();
      this.itensPedido = this.itensPedido.map(i => this.prepararItemPedido(i));
      this.garantirNumeroPedidoAutomatico();
    }
  }

  get pecasEstoqueLocal(): PecaCatalogo[] {
    return this.pecas.filter(p => p.estoqueNaLoja !== false);
  }

  get pecasEstoquePorCategoria(): { categoria: string; pecas: PecaCatalogo[] }[] {
    return agruparPecasPorCategoria(this.pecasEstoqueLocal);
  }

  labelPecaPedido(p: PecaCatalogo): string {
    return labelPecaCatalogo(p.nome, p.categoria, p.marcaPeca);
  }

  get marcasDisponiveis(): string[] {
    if (this.marcasCatalogo.length > 0) return this.marcasCatalogo;

    // Fallback: marcas já presentes nas peças em estoque
    const marcas = new Set<string>();
    for (const p of this.pecas) {
      const marca = this.marcaDaPeca(p);
      if (marca !== 'Sem marca') marcas.add(marca);
    }
    return [...marcas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  get modelosFiltrados(): ModeloAparelho[] {
    if (!this.filtroMarca) return this.modelos;
    return this.modelos.filter(m => this.mesmaMarca(m.marcaNome, this.filtroMarca));
  }

  get filtrosEstoqueAvancadosAtivos(): number {
    let n = 0;
    if (this.filtroMarca) n++;
    if (this.filtroModeloId) n++;
    if (this.filtroNivelEstoque) n++;
    if (this.filtroCategoriaEstoque) n++;
    if (this.filtroTipoTelaEstoque) n++;
    return n;
  }

  get filtrosEstoqueAtivos(): number {
    let n = this.filtrosEstoqueAvancadosAtivos;
    if (this.filtroEstoque.trim()) n++;
    return n;
  }

  get pecasFiltradas(): PecaCatalogo[] {
    return this.filtrarPecasEstoque(this.filtroNivelEstoque);
  }

  /** Sem nível = só texto/marca/modelo (para a barra de contagens). */
  private filtrarPecasEstoque(nivel?: '' | NivelEstoque): PecaCatalogo[] {
    const termo = this.filtroEstoque.trim().toLowerCase();
    const nivelFiltro = nivel ?? '';
    return this.pecas.filter(p => {
      if (termo) {
        const textoModelos = this.modelosDaPeca(p).join(' ').toLowerCase();
        const marcaAparelho = this.marcaDaPeca(p).toLowerCase();
        const bateTexto =
          p.nome.toLowerCase().includes(termo)
          || (p.marcaPeca ?? '').toLowerCase().includes(termo)
          || (p.descricao ?? '').toLowerCase().includes(termo)
          || marcaAparelho.includes(termo)
          || textoModelos.includes(termo);
        if (!bateTexto) return false;
      }

      if (this.filtroMarca && !this.pecaCompativelComMarca(p, this.filtroMarca)) return false;

      if (this.filtroCategoriaEstoque) {
        const cat = inferirCategoriaPeca(p.nome, p.categoria);
        if (cat !== this.filtroCategoriaEstoque) return false;
      }
      if (this.filtroTipoTelaEstoque && !this.pecaCompativelComTipoTela(p, this.filtroTipoTelaEstoque)) {
        return false;
      }

      if (this.filtroModeloId) {
        const temModelo = (p.modelosCompativeis ?? []).some(mc => mc.modeloId === this.filtroModeloId);
        if (!temModelo) return false;
      }

      if (nivelFiltro) {
        const nivelPeca = calcularNivelEstoque(p.quantidadeEstoque ?? 0);
        if (nivelPeca !== nivelFiltro) return false;
      }

      return true;
    });
  }

  get totalUnidadesEstoqueFiltrado(): number {
    return this.pecasFiltradas.reduce((s, p) => s + (p.quantidadeEstoque ?? 0), 0);
  }

  get pecasComSaldoFiltrado(): number {
    return this.pecasFiltradas.filter(p => (p.quantidadeEstoque ?? 0) > 0).length;
  }

  get contagemNiveisEstoque(): Record<NivelEstoque, number> {
    const contagem: Record<NivelEstoque, number> = {
      vermelho: 0,
      laranja: 0,
      amarelo: 0,
      verde: 0,
    };
    for (const p of this.filtrarPecasEstoque('')) {
      if (p.ignorarAlertaEstoque) continue;
      const nivel = calcularNivelEstoque(p.quantidadeEstoque ?? 0);
      contagem[nivel]++;
    }
    return contagem;
  }

  get limitesEstoque() {
    return getEstoqueConfig();
  }

  get opcoesFiltroNivelEstoque(): Array<{ id: '' | NivelEstoque; label: string }> {
    return montarOpcoesFiltroNivelEstoque();
  }

  labelNivel(nivel: NivelEstoque): string {
    return textoNivelEstoque(nivel);
  }

  filtrarPorNivelEstoque(nivel: '' | NivelEstoque): void {
    this.filtroNivelEstoque = this.filtroNivelEstoque === nivel ? '' : nivel;
  }

  get pecasAgrupadasPorMarca(): EstoqueGrupoMarca[] {
    const mapa = new Map<string, PecaCatalogo[]>();

    for (const peca of this.pecasFiltradas) {
      const marca = this.marcaDaPeca(peca);
      const lista = mapa.get(marca) ?? [];
      lista.push(peca);
      mapa.set(marca, lista);
    }

    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([marca, pecas]) => ({
        marca,
        pecas: pecas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      }));
  }

  get totalUnidadesEstoque(): number {
    return this.pecas.reduce((s, p) => s + (p.quantidadeEstoque ?? 0), 0);
  }

  get pecasComSaldo(): number {
    return this.pecas.filter(p => (p.quantidadeEstoque ?? 0) > 0).length;
  }

  carregarEstoque(): void {
    this.carregando = true;
    this.service.listarPecas().subscribe({
      next: p => {
        this.pecas = p.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        this.modeloIdsPorCategoriaCache.clear();
        this.carregando = false;
        this.carregarModelos();
      },
      error: err => {
        this.erro = err.status === 404
          ? 'Serviço de estoque indisponível. Reinicie a API ou tente novamente.'
          : 'Erro ao carregar estoque.';
        this.carregando = false;
      },
    });
  }

  carregarModelos(): void {
    this.aparelhosService.listarModelos({
      marcaNome: this.filtroMarca || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).subscribe({
      next: m => { this.modelos = m; },
      error: () => {},
    });
  }

  onFiltroMarcaChange(): void {
    if (this.filtroModeloId) {
      const modelo = this.modelos.find(m => m.id === this.filtroModeloId);
      if (modelo && this.filtroMarca && !this.mesmaMarca(modelo.marcaNome, this.filtroMarca)) {
        this.filtroModeloId = '';
        this.filtroModeloLabel = '';
        this.modeloFiltroEstoqueKey++;
      }
    }
    this.carregarModelos();
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
      return;
    }
    this.filtroModeloId = String(item.id);
    this.filtroModeloLabel = item.marcaNome ? `${item.marcaNome} · ${item.nome}` : item.nome;
    if (item.marcaNome && !this.filtroMarca) {
      this.filtroMarca = item.marcaNome;
      this.carregarModelos();
    }
  }

  onFiltroModeloChange(): void {
    if (!this.filtroModeloId) return;
    const modelo = this.modelos.find(m => m.id === this.filtroModeloId);
    if (modelo?.marcaNome && !this.filtroMarca) {
      this.filtroMarca = modelo.marcaNome;
      this.carregarModelos();
    }
  }

  limparFiltrosEstoque(): void {
    this.filtroEstoque = '';
    this.filtroMarca = '';
    this.filtroModeloId = '';
    this.filtroModeloLabel = '';
    this.filtroCategoriaEstoque = '';
    this.filtroTipoTelaEstoque = '';
    this.filtroNivelEstoque = '';
    this.modeloFiltroEstoqueKey++;
    this.carregarModelos();
  }

  labelModeloFiltro(modelo: ModeloAparelho): string {
    return modelo.nome;
  }

  modelosDaPeca(peca: PecaCatalogo): string[] {
    const nomes = (peca.modelosCompativeis ?? [])
      .map(mc => (mc.modeloNome ?? mc.modeloId).trim())
      .filter(Boolean);

    return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  tooltipModelosCompativeis(peca: PecaCatalogo): string {
    const modelos = this.modelosDaPeca(peca);
    return modelos.length ? modelos.join(', ') : '—';
  }

  private marcaDaPeca(peca: PecaCatalogo): string {
    const marca = (peca.modelosCompativeis ?? [])
      .map(mc => mc.marcaNome?.trim())
      .find(Boolean);
    return marca || 'Sem marca';
  }

  private pecaCompativelComMarca(peca: PecaCatalogo, marca: string): boolean {
    return this.mesmaMarca(this.marcaDaPeca(peca), marca);
  }

  private pecaCompativelComTipoTela(peca: PecaCatalogo, tipoTela: string): boolean {
    return (peca.modelosCompativeis ?? []).some(mc => {
      const modelo = this.modelos.find(m => m.id === mc.modeloId);
      return this.modeloBateTipoTela(modelo, tipoTela);
    });
  }

  private modeloBateTipoTela(modelo: ModeloAparelho | undefined, filtro: string): boolean {
    return mesmoTipoTelaArquitetura(modelo?.tipoTela, filtro);
  }

  private mesmaMarca(a?: string, b?: string): boolean {
    return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
  }

  carregarPecas(onLoaded?: () => void): void {
    this.service.listarPecas().subscribe({
      next: p => {
        this.pecas = p.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        this.modeloIdsPorCategoriaCache.clear();
        onLoaded?.();
      },
      error: () => { onLoaded?.(); },
    });
  }

  itemSemPecaCadastrada(item: ItemPedidoCompraUi): boolean {
    return !!(item.categoria?.trim()
      && item.modeloId?.trim()
      && !item.pecaId
      && (item.pecasCandidatas?.length ?? 0) === 0);
  }

  pecasReferenciaCadastro(item?: ItemPedidoCompraUi): PecaCatalogo[] {
    if (!item?.categoria?.trim()) return [];
    const cat = item.categoria.trim();
    const modeloId = item.modeloId?.trim() ?? '';
    const modeloAtual = this.modelosPedido.find(m => m.id === modeloId);
    const marcaAtual = (modeloAtual?.marcaNome ?? '').trim().toLowerCase();

    return this.pecasEstoqueLocal
      .filter(p => {
        if (inferirCategoriaPeca(p.nome, p.categoria) !== cat) return false;
        if (!modeloId) return true;
        return !(p.modelosCompativeis ?? []).some(mc => mc.modeloId === modeloId);
      })
      .sort((a, b) => {
        const marcaA = this.marcaDaPeca(a).toLowerCase();
        const marcaB = this.marcaDaPeca(b).toLowerCase();
        const aMesmaMarca = marcaAtual && marcaA === marcaAtual ? 0 : 1;
        const bMesmaMarca = marcaAtual && marcaB === marcaAtual ? 0 : 1;
        if (aMesmaMarca !== bMesmaMarca) return aMesmaMarca - bMesmaMarca;
        return labelPecaCatalogo(a.nome, a.categoria, a.marcaPeca)
          .localeCompare(labelPecaCatalogo(b.nome, b.categoria, b.marcaPeca), 'pt-BR');
      })
      .slice(0, 6);
  }

  pecasReferenciaNovaPeca(): PecaCatalogo[] {
    return this.pecasReferenciaCadastro(this.itemPedidoNovaPeca);
  }

  labelReferenciaPeca(p: PecaCatalogo): string {
    const modelos = this.modelosDaPeca(p);
    const modeloTxt = modelos.length ? modelos[0] : 'outro modelo';
    return `${modeloTxt} · ${labelPecaCatalogo(p.nome, p.categoria, p.marcaPeca)}`;
  }

  abrirNovaPecaPedido(item: ItemPedidoCompraUi): void {
    this.itemPedidoNovaPeca = item;
    this.modalNovaPecaAberto = true;
  }

  fecharModalNovaPeca(): void {
    this.modalNovaPecaAberto = false;
    this.itemPedidoNovaPeca = undefined;
  }

  modeloContextoNovaPeca(): ModeloAparelho | undefined {
    const item = this.itemPedidoNovaPeca;
    if (!item?.modeloId) return undefined;
    return this.modelosPedido.find(m => m.id === item.modeloId);
  }

  onPecaPedidoSalva(peca: PecaEstoque): void {
    const item = this.itemPedidoNovaPeca;
    this.fecharModalNovaPeca();
    if (!item) return;

    this.carregarPecas(() => {
      item.categoria = peca.categoria ?? inferirCategoriaPeca(peca.nome, peca.categoria);
      if (peca.marcaPeca) item.marcaPeca = peca.marcaPeca;
      if (this.pedidoFornecedor.trim() && !item.fornecedor) {
        item.fornecedor = this.pedidoFornecedor.trim();
      }

      const compat = peca.modelosCompativeis?.[0];
      if (!item.modeloId && compat?.modeloId) {
        item.modeloId = compat.modeloId;
        item.modeloNome = compat.modeloNome;
        const modelo = this.modelosPedido.find(m => m.id === compat.modeloId);
        if (modelo) item.buscaModelo = this.labelModeloFiltro(modelo);
      }

      item.pecaId = peca.id ?? '';
      this.resolverPecaPedido(item);
      if (item.pecaId) {
        item.avisoResolucao = `Peça cadastrada e vinculada: ${labelPecaCatalogo(peca.nome, peca.categoria, peca.marcaPeca)}`;
      }
      this.sucesso = 'Peça cadastrada e incluída na linha do pedido.';
    });
  }

  verLotesPeca(pecaId: string): void {
    if (this.pecaLotesExpandida === pecaId) {
      this.pecaLotesExpandida = '';
      this.lotesPeca = [];
      return;
    }

    this.pecaLotesExpandida = pecaId;
    this.carregandoLotes = true;
    this.service.listarLotes(pecaId, true).subscribe({
      next: lotes => {
        this.lotesPeca = lotes;
        this.carregandoLotes = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar lotes da peça.';
        this.carregandoLotes = false;
      },
    });
  }

  classeNivelEstoque(qtd: number): string {
    return ESTOQUE_NIVEL_CLASSES[calcularNivelEstoque(qtd)];
  }

  labelNivelEstoque(nivel: NivelEstoque): string {
    return textoNivelEstoque(nivel);
  }

  carregarPedidos(): void {
    this.carregando = true;
    this.service.listarPedidos().subscribe({
      next: p => { this.pedidos = p; this.carregando = false; },
      error: () => { this.erro = 'Erro ao carregar pedidos.'; this.carregando = false; },
    });
  }

  verPedido(id: string): void {
    this.loteEditandoId = '';
    this.loteEdit = null;
    this.excluindoLoteId = '';
    this.incluindoItem = false;
    this.itemPedidoExtra = this.itemVazio();
    this.carregarPecas();
    this.carregarModelosPedido();
    this.service.obterPedido(id).subscribe({
      next: d => { this.pedidoDetalhe = d; },
      error: () => { this.erro = 'Erro ao carregar pedido.'; },
    });
  }

  iniciarEdicaoLote(l: LoteEstoque): void {
    if (!l.id) return;
    this.erro = '';
    this.sucesso = '';
    this.loteEditandoId = l.id;
    const jaSaidas = Math.max(0, (l.quantidadeInicial ?? 0) - (l.quantidadeRestante ?? 0));
    this.loteEdit = {
      fornecedor: l.fornecedor || '',
      marcaPeca: l.marcaPeca || '',
      custoUnitario: l.custoUnitario ?? 0,
      garantiaMeses: l.garantiaMeses ?? 12,
      quantidadeInicial: l.quantidadeInicial ?? 0,
      unidadesJaSaidas: jaSaidas,
    };
  }

  cancelarEdicaoLote(): void {
    this.loteEditandoId = '';
    this.loteEdit = null;
  }

  salvarEdicaoLote(): void {
    if (!this.loteEditandoId || !this.loteEdit || this.salvandoLote) return;

    const edit = this.loteEdit;
    if (!edit.fornecedor.trim()) {
      this.erro = 'Informe o fornecedor do lote.';
      return;
    }
    if (edit.quantidadeInicial <= 0) {
      this.erro = 'Quantidade inicial deve ser maior que zero.';
      return;
    }
    if (edit.quantidadeInicial < edit.unidadesJaSaidas) {
      this.erro = `Não é possível reduzir abaixo de ${edit.unidadesJaSaidas} (já saíram do lote).`;
      return;
    }
    if (edit.garantiaMeses <= 0) {
      this.erro = 'Garantia em meses deve ser maior que zero.';
      return;
    }
    if (edit.custoUnitario < 0) {
      this.erro = 'Custo unitário não pode ser negativo.';
      return;
    }

    this.salvandoLote = true;
    this.erro = '';
    this.sucesso = '';
    const pedidoId = this.pedidoDetalhe?.pedido.id;

    this.service.atualizarLote(this.loteEditandoId, {
      fornecedor: edit.fornecedor.trim(),
      marcaPeca: edit.marcaPeca.trim() || undefined,
      custoUnitario: edit.custoUnitario,
      garantiaMeses: edit.garantiaMeses,
      quantidadeInicial: edit.quantidadeInicial,
    }).subscribe({
      next: () => {
        this.salvandoLote = false;
        this.loteEditandoId = '';
        this.loteEdit = null;
        this.sucesso = 'Lote atualizado.';
        if (pedidoId) this.verPedido(pedidoId);
        this.carregarPedidos();
      },
      error: err => {
        this.salvandoLote = false;
        this.erro = err?.error?.erro
          ?? (err?.status === 404
            ? 'Edição de lote indisponível. Reinicie a API e tente novamente.'
            : 'Erro ao atualizar lote.');
      },
    });
  }

  lotePodeExcluir(l: LoteEstoque): boolean {
    return !!l.id
      && (l.quantidadeRestante ?? 0) === (l.quantidadeInicial ?? 0)
      && this.excluindoLoteId !== l.id;
  }

  tituloExcluirLote(l: LoteEstoque): string {
    if (this.excluindoLoteId === l.id) return 'Excluindo…';
    if ((l.quantidadeRestante ?? 0) !== (l.quantidadeInicial ?? 0)) {
      return 'Não é possível excluir: já houve saída deste lote';
    }
    return 'Excluir item do pedido';
  }

  excluirLotePedido(l: LoteEstoque): void {
    if (!l.id || !this.lotePodeExcluir(l)) return;
    const rotulo = l.pecaNome || 'item';
    if (!confirm(`Excluir o item "${rotulo}" deste pedido?\n\nO lote e a entrada de estoque serão removidos.`)) {
      return;
    }

    this.excluindoLoteId = l.id;
    this.erro = '';
    this.sucesso = '';
    const pedidoId = this.pedidoDetalhe?.pedido.id;

    this.service.excluirLote(l.id).subscribe({
      next: () => {
        this.excluindoLoteId = '';
        this.sucesso = 'Item excluído do pedido.';
        if (pedidoId) this.verPedido(pedidoId);
        this.carregarPedidos();
      },
      error: err => {
        this.excluindoLoteId = '';
        this.erro = err?.error?.erro ?? 'Erro ao excluir item do pedido.';
      },
    });
  }

  abrirIncluirItemPedido(): void {
    this.erro = '';
    this.sucesso = '';
    this.loteEditandoId = '';
    this.loteEdit = null;
    this.incluindoItem = true;
    this.itemPedidoExtra = this.itemVazio();
    if (this.pedidoDetalhe?.pedido.fornecedor) {
      this.itemPedidoExtra.fornecedor = this.pedidoDetalhe.pedido.fornecedor;
    }
    this.carregarPecas();
    this.carregarModelosPedido();
  }

  cancelarIncluirItemPedido(): void {
    this.incluindoItem = false;
    this.itemPedidoExtra = this.itemVazio();
  }

  salvarIncluirItemPedido(): void {
    const pedidoId = this.pedidoDetalhe?.pedido.id;
    if (!pedidoId || this.salvandoLote) return;

    const item = this.itemPedidoExtra;
    if (!item.categoria?.trim() || !item.modeloId?.trim() || !item.pecaId?.trim()) {
      this.erro = 'Informe categoria, modelo e peça do novo item.';
      return;
    }
    if (this.itemUsaCor(item) && !item.cor?.trim()) {
      this.erro = 'Informe a cor do item.';
      return;
    }
    if ((item.quantidade ?? 0) <= 0) {
      this.erro = 'Quantidade deve ser maior que zero.';
      return;
    }
    if ((item.custoUnitario ?? 0) < 0) {
      this.erro = 'Custo unitário não pode ser negativo.';
      return;
    }

    this.salvandoLote = true;
    this.erro = '';
    this.sucesso = '';

    this.service.adicionarItemPedido(pedidoId, {
      pecaId: item.pecaId,
      fornecedor: item.fornecedor?.trim() || this.pedidoDetalhe?.pedido.fornecedor,
      marcaPeca: item.marcaPeca?.trim() || undefined,
      modeloId: item.modeloId,
      modeloNome: item.modeloNome,
      cor: item.cor?.trim() || undefined,
      quantidade: item.quantidade,
      custoUnitario: item.custoUnitario,
      garantiaMeses: item.garantiaMeses > 0 ? item.garantiaMeses : 12,
    }).subscribe({
      next: () => {
        this.salvandoLote = false;
        this.incluindoItem = false;
        this.itemPedidoExtra = this.itemVazio();
        this.sucesso = 'Item incluído no pedido.';
        this.verPedido(pedidoId);
        this.carregarPedidos();
      },
      error: err => {
        this.salvandoLote = false;
        this.erro = err?.error?.erro ?? 'Erro ao incluir item no pedido.';
      },
    });
  }

  carregarSaidas(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listarMovimentacoes({
      tipo: 'saida',
      busca: this.saidaFiltroBusca.trim() || undefined,
      inicio: this.saidaFiltroInicio || undefined,
      fim: this.saidaFiltroFim || undefined,
      origem: this.saidaFiltroOrigem || undefined,
      statusEstorno: this.saidaFiltroStatus || undefined,
      pagina: this.gridSaidas.page,
      tamanhoPagina: this.gridSaidas.pageSize,
    }).subscribe({
      next: res => {
        this.movimentacoes = res.itens ?? [];
        this.movimentacoesTotal = res.total ?? 0;
        if (res.pagina > 0) this.gridSaidas.page = res.pagina;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar saídas.';
        this.carregando = false;
      },
    });
  }

  aplicarFiltrosSaidas(): void {
    this.gridSaidas.reset();
    this.carregarSaidas();
  }

  limparFiltrosSaidas(): void {
    this.saidaFiltroBusca = '';
    this.saidaFiltroInicio = '';
    this.saidaFiltroFim = '';
    this.saidaFiltroOrigem = '';
    this.saidaFiltroStatus = '';
    this.aplicarFiltrosSaidas();
  }

  get filtrosSaidasAtivos(): number {
    let n = 0;
    if (this.saidaFiltroBusca.trim()) n += 1;
    if (this.saidaFiltroInicio) n += 1;
    if (this.saidaFiltroFim) n += 1;
    if (this.saidaFiltroOrigem) n += 1;
    if (this.saidaFiltroStatus) n += 1;
    return n;
  }

  onSaidasPageChange(page: number): void {
    this.gridSaidas.onPageChange(page);
    this.carregarSaidas();
  }

  onSaidasPageSizeChange(size: number): void {
    this.gridSaidas.onPageSizeChange(size);
    this.carregarSaidas();
  }

  saidaTemEstorno(m: MovimentacaoEstoque): boolean {
    return (m.quantidadeEstornada ?? 0) > 0;
  }

  saidaTotalmenteEstornada(m: MovimentacaoEstoque): boolean {
    const est = m.quantidadeEstornada ?? 0;
    return est > 0 && est >= (m.quantidade ?? 0);
  }

  saidaParcialmenteEstornada(m: MovimentacaoEstoque): boolean {
    const est = m.quantidadeEstornada ?? 0;
    return est > 0 && est < (m.quantidade ?? 0);
  }

  /** Pesquisa as peças utilizadas no período (não persiste). */
  pesquisarReposicao(): void {
    this.erro = '';
    this.sucesso = '';
    if (this.periodoReposicao === 'personalizado' && !this.reposicaoInicio) {
      this.erro = 'Informe a data inicial do período.';
      return;
    }
    if (this.periodoReposicao === 'personalizado' && !this.reposicaoFim) {
      this.erro = 'Informe a data final do período.';
      return;
    }

    salvarPeriodoReposicao(this.periodoReposicao);
    this.carregando = true;
    this.relatorio = undefined;

    this.service.relatorioReposicao({
      periodo: this.periodoReposicao,
      inicio: this.periodoReposicao === 'personalizado' ? this.reposicaoInicio : undefined,
      fim: this.reposicaoFim,
      modeloId: this.reposicaoModeloId || undefined,
    }).subscribe({
      next: r => {
        this.relatorio = {
          ...r,
          resumoPorModelo: r.resumoPorModelo ?? this.montarResumoPorModeloLocal(r.itens ?? []),
        };
        this.carregando = false;
        if (this.periodoReposicao !== 'semanal' && !r.periodo) {
          this.erro = 'Período avançado disponível após reiniciar a API. Exibindo relatório semanal por enquanto.';
        }
      },
      error: err => {
        this.erro = err.error?.erro ?? 'Erro ao pesquisar peças utilizadas. Reinicie a API e tente novamente.';
        this.carregando = false;
      },
    });
  }

  /** @deprecated use pesquisarReposicao */
  carregarRelatorio(): void {
    this.pesquisarReposicao();
  }

  private montarResumoPorModeloLocal(itens: ReposicaoSemanalItem[]): ReposicaoResumoModelo[] {
    const mapa = new Map<string, ReposicaoResumoModelo>();
    for (const item of itens) {
      const chave = item.modeloId ?? item.modeloNome ?? 'sem-modelo';
      const nome = item.modeloNome ?? item.modeloId ?? 'Sem modelo';
      const atual = mapa.get(chave) ?? {
        modeloId: item.modeloId,
        modeloNome: nome,
        quantidadeSaida: 0,
        itensComReposicao: 0,
        sugestaoTotal: 0,
      };
      atual.quantidadeSaida += item.quantidadeSaida;
      if (item.sugestaoReposicao > 0) atual.itensComReposicao += 1;
      atual.sugestaoTotal += item.sugestaoReposicao;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => b.quantidadeSaida - a.quantidadeSaida);
  }

  selecionarPeriodoReposicao(periodo: PeriodoReposicao): void {
    this.periodoReposicao = periodo;
    if (periodo !== 'personalizado') {
      const op = PERIODOS_REPOSICAO.find(p => p.id === periodo);
      const dias = op?.dias ?? 7;
      this.reposicaoFim = this.hojeInput();
      this.reposicaoInicio = this.dataInputDiasAtras(dias - 1);
      this.pesquisarReposicao();
    }
  }

  labelPeriodoReposicaoAtual(): string {
    return labelPeriodoReposicao(this.relatorio?.periodo ?? this.periodoReposicao);
  }

  /**
   * Gera relatório de reposição: salva o snapshot da tela (para consulta futura)
   * e abre o PDF para imprimir/salvar.
   */
  gerarRelatorioReposicao(): void {
    if (!this.relatorio?.itens?.length) {
      this.erro = 'Pesquise primeiro um período com peças utilizadas.';
      return;
    }
    const itens = this.relatorio.itens.filter(i => (i.quantidadeSaida ?? 0) > 0);
    if (!itens.length) {
      this.erro = 'Nenhuma peça utilizada neste período para gerar relatório.';
      return;
    }

    const periodoLabel = this.labelPeriodoReposicaoAtual();
    const html = montarHtmlReposicaoPdf(this.relatorio, {
      periodoLabel,
      labelModelo: (nome, id) => this.labelModeloMovimentacao(nome, id),
      rodapeExtra: 'Relatório registrado para controle de pedido de reposição.',
    });

    this.salvandoRelatorio = true;
    this.erro = '';
    this.sucesso = '';
    this.service.salvarRelatorioReposicao({
      titulo: `Peças utilizadas ${this.formatarData(this.relatorio.inicio)} a ${this.formatarData(this.relatorio.fim)}`,
      periodo: this.relatorio.periodo || this.periodoReposicao,
      periodoLabel,
      inicio: this.relatorio.inicio,
      fim: this.relatorio.fim,
      modeloIdFiltro: this.relatorio.modeloIdFiltro,
      modeloNomeFiltro: this.relatorio.modeloNomeFiltro,
      totalSaidas: this.relatorio.totalSaidas,
      itens,
      html,
    }).subscribe({
      next: salvo => {
        this.salvandoRelatorio = false;
        this.sucesso =
          `Relatório salvo (${this.formatarData(salvo.inicio)} a ${this.formatarData(salvo.fim)}). ` +
          'Consulte abaixo para não pedir peças duplicadas.';
        this.carregarHistoricoRelatorios();
        abrirJanelaReposicaoPdf(
          html,
          `Peças utilizadas ${this.formatarData(salvo.inicio)} a ${this.formatarData(salvo.fim)}`,
        );
      },
      error: err => {
        this.salvandoRelatorio = false;
        this.erro = err?.error?.erro ?? 'Erro ao salvar o relatório. Reinicie a API e tente novamente.';
      },
    });
  }

  carregarFinanceiro(): void {
    this.carregando = true;
    this.erro = '';
    this.financeiro = undefined;
    this.service.relatorioFinanceiro(this.financeiroMeses).subscribe({
      next: dados => {
        this.financeiro = dados;
        this.carregando = false;
      },
      error: err => {
        this.carregando = false;
        this.erro = err?.error?.erro
          ?? (err?.status === 404
            ? 'Relatório financeiro indisponível. Reinicie a API e tente novamente.'
            : 'Erro ao carregar investimento de estoque.');
      },
    });
  }

  selecionarMesesFinanceiro(meses: number): void {
    this.financeiroMeses = meses;
    this.carregarFinanceiro();
  }

  get mesesFinanceiroOrdenados() {
    const lista = this.financeiro?.porMes ?? [];
    return [...lista].reverse();
  }

  carregarHistoricoRelatorios(): void {
    this.service.listarRelatoriosReposicao(
      this.historicoLimite,
      this.filtroStatusHistorico || undefined,
    ).subscribe({
      next: lista => {
        this.historicoRelatorios = (lista ?? []).map(h => ({
          ...h,
          statusConclusao: normalizarStatusRelatorioReposicao(h.statusConclusao),
        }));
      },
      error: () => { this.historicoRelatorios = []; },
    });
  }

  onFiltroStatusHistoricoChange(): void {
    this.carregarHistoricoRelatorios();
  }

  statusRelatorio(h: RelatorioReposicaoHistorico): string {
    return normalizarStatusRelatorioReposicao(h.statusConclusao);
  }

  onStatusRelatorioChange(h: RelatorioReposicaoHistorico, status: string): void {
    if (!h.id) return;
    const anterior = normalizarStatusRelatorioReposicao(h.statusConclusao);
    const novo = normalizarStatusRelatorioReposicao(status);
    if (anterior === novo) return;

    h.statusConclusao = novo;
    this.atualizandoStatusId = h.id;
    this.erro = '';
    this.service.atualizarStatusRelatorioReposicao(h.id, novo).subscribe({
      next: salvo => {
        this.atualizandoStatusId = '';
        h.statusConclusao = normalizarStatusRelatorioReposicao(salvo.statusConclusao);
        // Reordena / reaplica filtro (não concluído primeiro).
        this.carregarHistoricoRelatorios();
      },
      error: err => {
        this.atualizandoStatusId = '';
        h.statusConclusao = anterior;
        this.erro = err?.error?.erro ?? 'Não foi possível atualizar o status do relatório.';
      },
    });
  }

  consultarRelatorioSalvo(item: RelatorioReposicaoHistorico): void {
    if (!item.id) return;
    this.service.obterRelatorioReposicao(item.id).subscribe({
      next: doc => {
        if (doc.html) {
          abrirJanelaReposicaoPdf(doc.html, doc.titulo || 'Relatório de reposição');
          return;
        }
        // Fallback: reconstroi a partir dos itens
        const html = montarHtmlReposicaoPdf(
          {
            inicio: doc.inicio,
            fim: doc.fim,
            periodo: doc.periodo,
            modeloIdFiltro: doc.modeloIdFiltro,
            modeloNomeFiltro: doc.modeloNomeFiltro,
            itens: doc.itens,
            totalSaidas: doc.totalSaidas,
          },
          {
            periodoLabel: doc.periodoLabel || labelPeriodoReposicao(doc.periodo),
            labelModelo: (nome, id) => this.labelModeloMovimentacao(nome, id),
            autoPrint: false,
            rodapeExtra: `Salvo em ${this.formatarDataHora(doc.geradoEm)}`,
          },
        );
        abrirJanelaReposicaoPdf(html, doc.titulo);
      },
      error: () => { this.erro = 'Não foi possível abrir o relatório salvo.'; },
    });
  }

  carregarLotesGarantia(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listarLotesEmGarantia({
      fornecedor: this.filtroFornecedorGarantia || undefined,
      osNumero: this.filtroOsGarantia || undefined,
      lote: this.filtroLoteGarantia || undefined,
    }).subscribe({
      next: lotes => {
        this.lotesGarantia = lotes;
        this.agruparLotesGarantiaPorFornecedor(lotes);
        for (const l of lotes) {
          if (!l.id) continue;
          const max = Math.max(1, l.quantidadeDisponivelRetorno || l.quantidadeRestante || 1);
          if (this.devolucaoQtd[l.id] == null) this.devolucaoQtd[l.id] = Math.min(max, l.quantidadeUsadaOs || 1);
          else this.devolucaoQtd[l.id] = Math.min(this.devolucaoQtd[l.id], max);
        }
        this.carregando = false;
      },
      error: err => {
        this.erro = err?.error?.erro ?? 'Erro ao carregar lotes em garantia. Reinicie a API.';
        this.lotesGarantia = [];
        this.lotesGarantiaAgrupados = [];
        this.carregando = false;
      },
    });
  }

  onOsGarantiaSelecionada(item: AutocompleteItem | null): void {
    if (!item) {
      this.filtroOsGarantia = '';
      this.garantiaOsLabel = '';
      return;
    }
    const num = (item.id || item.nome || '').replace(/^OS\s*#?/i, '').trim();
    this.filtroOsGarantia = num;
    this.garantiaOsLabel = item.nome || `OS #${num}`;
    this.carregarLotesGarantia();
  }

  onLoteGarantiaSelecionado(item: AutocompleteItem | null): void {
    if (!item) {
      this.filtroLoteGarantia = '';
      this.garantiaLoteLabel = '';
      return;
    }
    this.filtroLoteGarantia = (item.nome || item.id || '').trim();
    this.garantiaLoteLabel = item.nome || this.filtroLoteGarantia;
    this.carregarLotesGarantia();
  }

  onFornecedorGarantiaSelecionado(item: AutocompleteItem | null): void {
    if (!item) {
      this.filtroFornecedorGarantia = '';
      this.garantiaFornecedorLabel = '';
      return;
    }
    this.filtroFornecedorGarantia = (item.nome || item.id || '').trim();
    this.garantiaFornecedorLabel = this.filtroFornecedorGarantia;
    this.carregarLotesGarantia();
    this.carregarCaixaRetorno();
  }

  limparFiltrosGarantia(): void {
    this.filtroOsGarantia = '';
    this.filtroLoteGarantia = '';
    this.filtroFornecedorGarantia = '';
    this.garantiaOsLabel = '';
    this.garantiaLoteLabel = '';
    this.garantiaFornecedorLabel = '';
    this.garantiaOsTrack = [this.garantiaOsTrack[0] + 1];
    this.garantiaLoteTrack = [this.garantiaLoteTrack[0] + 1];
    this.garantiaFornecedorTrack = [this.garantiaFornecedorTrack[0] + 1];
    this.lotesGarantia = [];
    this.lotesGarantiaAgrupados = [];
    this.carregarLotesGarantia();
    this.carregarCaixaRetorno();
  }

  trackByNum(_: number, v: number): number {
    return v;
  }

  trackByFornecedorGrupo(_: number, g: { fornecedor: string }): string {
    return g.fornecedor;
  }

  private agruparLotesGarantiaPorFornecedor(lotes: LoteGarantiaItem[]): void {
    const mapa = new Map<string, LoteGarantiaItem[]>();
    for (const l of lotes) {
      const key = (l.fornecedor || '(sem fornecedor)').trim();
      const lista = mapa.get(key) ?? [];
      lista.push(l);
      mapa.set(key, lista);
    }
    this.lotesGarantiaAgrupados = [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([fornecedor, itens]) => ({ fornecedor, itens }));
  }

  carregarFornecedoresEstoqueGarantia(): void {
    this.service.sugerirFornecedorGarantia('').subscribe({
      next: itens => {
        this.fornecedoresEstoqueGarantia = itens
          .map(i => i.nome?.trim())
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      },
      error: () => { this.fornecedoresEstoqueGarantia = []; },
    });
  }

  carregarCaixaRetorno(): void {
    this.carregandoCaixaRetorno = true;
    this.service.listarCaixaRetornoGarantia(this.filtroFornecedorGarantia || undefined).subscribe({
      next: res => {
        this.caixaRetorno = res;
        this.carregandoCaixaRetorno = false;
      },
      error: err => {
        this.carregandoCaixaRetorno = false;
        this.erro = err?.error?.erro ?? 'Erro ao carregar caixa de retorno.';
      },
    });
  }

  labelPrazoEnvio(dias: number, prazoVencido: boolean): string {
    if (prazoVencido || dias < 0) {
      const atraso = Math.abs(dias);
      return atraso === 0 ? 'Prazo vence hoje' : `Prazo vencido há ${atraso} dia(s)`;
    }
    if (dias === 0) return 'Prazo máximo: hoje';
    if (dias === 1) return 'Prazo máximo: amanhã';
    return `Prazo máximo em ${dias} dias`;
  }

  gerarLoteCaixaFornecedor(fornecedor: string): void {
    if (!fornecedor?.trim()) return;
    this.gerandoLoteFornecedor = fornecedor;
    this.erro = '';
    this.sucesso = '';
    this.service.gerarLoteDevolucaoGarantia({
      fornecedor: fornecedor.trim(),
      motivo: 'Lote retorno garantia — problema da peça',
    }).subscribe({
      next: (doc: LoteDevolucaoGarantiaDocumento) => {
        this.gerandoLoteFornecedor = '';
        this.sucesso =
          `Lote baixado: ${doc.totalUnidades} un. → ${doc.fornecedor}. Removido da caixa (consulta em tela de lotes de retorno).`;
        const html = montarHtmlLoteDevolucaoGarantia(doc);
        abrirJanelaLoteDevolucaoGarantia(html);
        this.carregarCaixaRetorno();
        this.carregarLotesGarantia();
      },
      error: err => {
        this.gerandoLoteFornecedor = '';
        this.erro = err?.error?.erro ?? 'Erro ao gerar lote de retorno.';
      },
    });
  }

  removerDaCaixa(itemId?: string): void {
    if (!itemId) return;
    this.removendoCaixaId = itemId;
    this.service.removerCaixaRetornoGarantia(itemId).subscribe({
      next: () => {
        this.removendoCaixaId = '';
        this.sucesso = 'Peça removida da caixa de retorno.';
        this.carregarCaixaRetorno();
        this.carregarLotesGarantia();
      },
      error: err => {
        this.removendoCaixaId = '';
        this.erro = err?.error?.erro ?? 'Erro ao remover da caixa.';
      },
    });
  }

  get temContextoOsGarantia(): boolean {
    return !!this.filtroOsGarantia.trim()
      || this.lotesGarantia.some(l => !!(l.osNumero || (l.osBlingId && l.osBlingId > 0)));
  }

  /** Fornecedores de estoque atuais (dinâmico — novos pedidos entram na lista). */
  fornecedoresEstoqueGarantia: string[] = [];

  maxRetornoGarantia(lote: LoteGarantiaItem): number {
    return Math.max(0, lote.quantidadeDisponivelRetorno ?? lote.quantidadeRestante ?? 0);
  }

  labelGarantiaRestante(lote: LoteGarantiaItem): string {
    const data = this.formatarData(lote.dataVencimentoGarantia);
    const dias = lote.diasGarantiaRestantes ?? 0;
    if (dias <= 0) return `${data} (vence hoje)`;
    if (dias === 1) return `${data} (1 dia restante)`;
    return `${data} (${dias} dias restantes)`;
  }

  gerarRetornoGarantia(lote: LoteGarantiaItem): void {
    if (!lote.id) return;
    const max = this.maxRetornoGarantia(lote);
    if (max <= 0) {
      this.erro = 'Nenhuma quantidade disponível para retorno neste lote.';
      return;
    }
    const qtd = Math.max(1, Math.min(max, Number(this.devolucaoQtd[lote.id]) || 1));
    const origemOs = !!(lote.osNumero || (lote.osBlingId && lote.osBlingId > 0) || (lote.quantidadeUsadaOs && lote.quantidadeUsadaOs > 0));
    this.devolvendoLoteId = lote.id;
    this.erro = '';
    this.sucesso = '';
    this.service.adicionarCaixaRetornoGarantia({
      loteId: lote.id,
      quantidade: qtd,
      motivo: this.devolucaoMotivo[lote.id]?.trim() || 'Defeito / problema da peça',
      osNumero: lote.osNumero || (origemOs ? this.filtroOsGarantia.trim() : '') || undefined,
      osBlingId: lote.osBlingId && lote.osBlingId > 0 ? lote.osBlingId : undefined,
      origemOs,
    }).subscribe({
      next: (res: CaixaRetornoAdicaoResponse) => {
        this.devolvendoLoteId = '';
        const item = res.item;
        const refOs = item.osNumero ? ` (OS #${item.osNumero})` : '';
        const prazoTxt = this.labelPrazoEnvio(res.diasRestantesPrazo, res.diasRestantesPrazo < 0);
        this.sucesso =
          `${item.quantidade}x ${item.pecaNome} → caixa ${item.fornecedor}${refOs}. ${prazoTxt} (até ${this.formatarData(res.dataPrazoMaximoEnvioFornecedor)}).`;
        this.carregarLotesGarantia();
        this.carregarCaixaRetorno();
      },
      error: err => {
        this.devolvendoLoteId = '';
        this.erro = err?.error?.erro ?? 'Erro ao colocar peça na caixa de retorno.';
      },
    });
  }

  formatarDataHora(valor?: string): string {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  carregarModelosReposicao(): void {
    this.aparelhosService.listarModelos({ limite: MODELO_LIMITE_LISTA }).subscribe({
      next: m => {
        this.modelosReposicao = m.sort((a, b) =>
          this.labelModeloFiltro(a).localeCompare(this.labelModeloFiltro(b), 'pt-BR'));
      },
      error: () => { this.modelosReposicao = []; },
    });
  }

  trackByItemPedidoUid(_index: number, item: ItemPedidoCompraUi): number {
    return item.uid;
  }

  adicionarItemPedido(quantidade = 1): void {
    this.erro = '';
    const faltam = this.limiteItensPedido - this.itensPedido.length;
    if (faltam <= 0) {
      this.erro = `Limite de ${this.limiteItensPedido} itens por pedido.`;
      return;
    }
    const n = Math.min(Math.max(1, quantidade), faltam);
    // push (não recria o array) + trackBy: evita destruir todos os autocompletes
    for (let i = 0; i < n; i++) {
      this.itensPedido.push(this.itemVazio());
    }
    if (quantidade > faltam) {
      this.erro = `Só foi possível adicionar ${n} linha(s) (limite ${this.limiteItensPedido}).`;
    }
  }

  removerItemPedido(i: number): void {
    if (this.itensPedido.length <= 1) return;
    this.itensPedido.splice(i, 1);
  }

  buscarModelosPedidoFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhosService.listarModelos({
      termo: termo.trim() || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).pipe(
      map(ms => ms.map(modeloParaAutocomplete)),
    );

  private prepararItemPedido(item: ItemPedidoCompraUi): ItemPedidoCompraUi {
    if (!item.uid) item.uid = this.proximoUidItemPedido++;
    item.buscarModelosFn = (termo: string) => this.buscarModelosParaItemPedido(termo, item);
    return item;
  }

  private modeloIdsDaCategoria(categoria: string): Set<string> {
    const cat = categoria.trim();
    const cached = this.modeloIdsPorCategoriaCache.get(cat);
    if (cached) return cached;

    const ids = new Set<string>();
    for (const p of this.pecasEstoqueLocal) {
      if (inferirCategoriaPeca(p.nome, p.categoria) !== cat) continue;
      for (const mc of p.modelosCompativeis ?? []) {
        if (mc.modeloId) ids.add(mc.modeloId);
      }
    }
    this.modeloIdsPorCategoriaCache.set(cat, ids);
    return ids;
  }

  private buscarModelosParaItemPedido(termo: string, item: ItemPedidoCompraUi): Observable<AutocompleteItem[]> {
    const categoria = item.categoria?.trim() ?? '';
    const idsCompat = categoria ? this.modeloIdsDaCategoria(categoria) : null;

    return this.aparelhosService.listarModelos({
      termo: termo.trim() || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).pipe(
      map(ms => {
        let lista = ms;
        if (idsCompat && idsCompat.size > 0) {
          const filtrados = ms.filter(m => m.id && idsCompat.has(m.id));
          lista = filtrados.length > 0 ? filtrados : ms;
        }
        return lista.map(modeloParaAutocomplete);
      }),
    );
  }

  trackAutocompleteKey(_index: number, value: number): number {
    return value;
  }

  valorInicialModeloPedido(item: ItemPedidoCompraUi): string {
    if (item.buscaModelo?.trim()) return item.buscaModelo.trim();
    if (!item.modeloId) return '';
    const modelo = this.modelosPedido.find(m => m.id === item.modeloId);
    if (modelo) return this.labelModeloFiltro(modelo);
    return item.modeloNome ?? '';
  }

  onModeloPedidoAutocomplete(item: ItemPedidoCompraUi, selecionado: AutocompleteItem | null): void {
    if (!selecionado?.id) {
      item.modeloId = '';
      item.modeloNome = undefined;
      item.buscaModelo = '';
      item.cor = undefined;
      item.pecaId = '';
      item.avisoResolucao = '';
      return;
    }

    item.modeloId = selecionado.id;
    item.modeloNome = selecionado.nome;
    item.buscaModelo = selecionado.marcaNome
      ? `${selecionado.marcaNome} · ${selecionado.nome}`
      : selecionado.nome;
    if (!this.itemUsaCor(item)) item.cor = undefined;
    this.resolverPecaPedido(item);
  }

  carregarModelosPedido(): void {
    this.aparelhosService.listarModelos({ limite: MODELO_LIMITE_LISTA }).subscribe({
      next: m => {
        this.modelosPedido = m.sort((a, b) =>
          this.labelModeloFiltro(a).localeCompare(this.labelModeloFiltro(b), 'pt-BR'));
      },
      error: () => { this.modelosPedido = []; },
    });
  }

  pecasCandidatasItem(item: ItemPedidoCompraUi): PecaCatalogo[] {
    if (!item.categoria?.trim() || !item.modeloId?.trim()) return [];
    const cat = item.categoria.trim();
    return this.pecasEstoqueLocal
      .filter(p =>
        inferirCategoriaPeca(p.nome, p.categoria) === cat
        && (p.modelosCompativeis ?? []).some(mc => mc.modeloId === item.modeloId))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  onCategoriaItemChange(item: ItemPedidoCompraUi): void {
    item.modeloId = '';
    item.modeloNome = undefined;
    item.buscaModelo = '';
    item.cor = undefined;
    item.pecaId = '';
    item.marcaPeca = '';
    item.avisoResolucao = '';
    item.pecasCandidatas = [];
    item.coresSugeridas = [];
    item.modeloAutocompleteKey = (item.modeloAutocompleteKey ?? 0) + 1;
    this.prepararItemPedido(item);
  }

  itemUsaCor(item: ItemPedidoCompraUi): boolean {
    return categoriaUsaCoresPorModelo(item.categoria);
  }

  coresSugeridasItem(item: ItemPedidoCompraUi): string[] {
    if (!item.pecaId || !item.modeloId) return [];
    const peca = this.pecas.find(p => p.id === item.pecaId);
    const compat = (peca?.modelosCompativeis ?? []).find(m => m.modeloId === item.modeloId);
    const cores = (compat?.cores ?? [])
      .map(c => (c.cor ?? '').trim())
      .filter(Boolean);
    return [...new Set(cores)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  onCorItemChange(item: ItemPedidoCompraUi): void {
    if (item.cor?.trim() && item.pecaId) {
      item.avisoResolucao = item.avisoResolucao?.startsWith('Peça:')
        ? `${item.avisoResolucao} · Cor: ${item.cor.trim()}`
        : item.avisoResolucao;
    }
  }

  onPecaQualidadeItemChange(item: ItemPedidoCompraUi): void {
    const peca = this.pecas.find(p => p.id === item.pecaId);
    if (!peca) return;
    this.aplicarPecaResolvida(item, peca);
    item.coresSugeridas = this.coresSugeridasItem(item);
  }

  resolverPecaPedido(item: ItemPedidoCompraUi): void {
    item.avisoResolucao = '';
    item.pecasCandidatas = [];
    item.coresSugeridas = [];
    if (!item.categoria?.trim() || !item.modeloId?.trim()) {
      item.pecaId = '';
      return;
    }

    const candidatas = this.pecasCandidatasItem(item);
    item.pecasCandidatas = candidatas;
    if (candidatas.length === 0) {
      item.pecaId = '';
      item.avisoResolucao = `Nenhuma peça "${item.categoria}" cadastrada para este modelo.`;
      return;
    }

    if (candidatas.length === 1) {
      this.aplicarPecaResolvida(item, candidatas[0]);
      item.avisoResolucao = `Peça: ${labelPecaCatalogo(candidatas[0].nome, candidatas[0].categoria, candidatas[0].marcaPeca)}`;
      item.coresSugeridas = this.coresSugeridasItem(item);
      return;
    }

    if (item.pecaId && candidatas.some(p => p.id === item.pecaId)) {
      const peca = candidatas.find(p => p.id === item.pecaId)!;
      this.aplicarPecaResolvida(item, peca);
      item.coresSugeridas = this.coresSugeridasItem(item);
      return;
    }

    item.pecaId = '';
    item.avisoResolucao = 'Várias peças desta categoria para o modelo — escolha a qualidade.';
  }

  private aplicarPecaResolvida(item: ItemPedidoCompraUi, peca: PecaCatalogo): void {
    item.pecaId = peca.id ?? '';
    if (peca.marcaPeca && !item.marcaPeca) item.marcaPeca = peca.marcaPeca;
    if (this.pedidoFornecedor.trim() && !item.fornecedor) {
      item.fornecedor = this.pedidoFornecedor.trim();
    }
  }

  onSaidaModeloSugestao(item: AutocompleteItem | null): void {
    if (!item?.id) {
      this.saidaModeloId = '';
      this.saidaModeloLabel = '';
      this.saidaModeloNome = '';
      this.limparSaidaPeca();
      return;
    }

    this.saidaModeloId = String(item.id);
    this.saidaModeloNome = item.nome;
    this.saidaModeloLabel = item.marcaNome ? `${item.marcaNome} · ${item.nome}` : item.nome;
    if (item.marcaNome) this.saidaMarca = item.marcaNome;

    // Troca de modelo invalida peça anterior se não for compatível.
    if (this.saidaPecaId && !this.pecaCompativelComModelo(this.saidaPecaId, this.saidaModeloId)) {
      this.limparSaidaPeca();
    }

    const compat = this.pecasCompativeisModelo(this.saidaModeloId);
    if (compat.length === 1 && !this.saidaPecaId) {
      this.aplicarSaidaPeca(compat[0]);
      this.saidaPecaAcKey++;
    }
  }

  buscarModelosSaidaFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhosService.listarModelos({
      termo: termo.trim() || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).pipe(
      map(ms => ms.map(modeloParaAutocomplete)),
    );

  buscarPecasSaidaFn = (termo: string): Observable<AutocompleteItem[]> => {
    if (!this.saidaModeloId) return of([]);

    const t = termo.trim().toLowerCase();
    const lista = this.pecasCompativeisModelo(this.saidaModeloId)
      .filter(p => {
        if (!t) return true;
        const label = this.labelPecaPedido(p).toLowerCase();
        return label.includes(t)
          || (p.nome ?? '').toLowerCase().includes(t)
          || (p.categoria ?? '').toLowerCase().includes(t)
          || (p.marcaPeca ?? '').toLowerCase().includes(t);
      })
      .map(p => ({
        id: p.id,
        nome: `${this.labelPecaPedido(p)} (est: ${p.quantidadeEstoque ?? 0})`,
        extra: p.categoria ?? undefined,
        marcaNome: p.marcaPeca ?? undefined,
      } as AutocompleteItem));

    return of(lista);
  };

  onSaidaPecaSugestao(item: AutocompleteItem | null): void {
    if (!item?.id) {
      this.limparSaidaPeca();
      return;
    }
    const peca = this.pecas.find(p => p.id === item.id);
    if (!peca) {
      this.limparSaidaPeca();
      return;
    }
    this.aplicarSaidaPeca(peca);
  }

  pecasCompativeisModelo(modeloId: string): PecaCatalogo[] {
    if (!modeloId) return [];
    return this.pecasEstoqueLocal
      .filter(p => this.pecaCompativelComModelo(p.id ?? '', modeloId))
      .sort((a, b) => this.labelPecaPedido(a).localeCompare(this.labelPecaPedido(b), 'pt-BR'));
  }

  private pecaCompativelComModelo(pecaId: string, modeloId: string): boolean {
    if (!pecaId || !modeloId) return false;
    const peca = this.pecas.find(p => p.id === pecaId);
    return (peca?.modelosCompativeis ?? []).some(mc => mc.modeloId === modeloId);
  }

  private aplicarSaidaPeca(peca: PecaCatalogo): void {
    this.saidaPecaId = peca.id ?? '';
    this.saidaPecaLabel = `${this.labelPecaPedido(peca)} (est: ${peca.quantidadeEstoque ?? 0})`;
    if (peca.marcaPeca && !this.saidaMarca) this.saidaMarca = peca.marcaPeca;
  }

  private limparSaidaPeca(): void {
    this.saidaPecaId = '';
    this.saidaPecaLabel = '';
    this.saidaPecaAcKey++;
  }

  private limparFormularioSaida(): void {
    this.saidaPecaId = '';
    this.saidaPecaLabel = '';
    this.saidaMarca = '';
    this.saidaModeloId = '';
    this.saidaModeloLabel = '';
    this.saidaModeloNome = '';
    this.saidaQtd = 1;
    this.saidaOsNumero = '';
    this.saidaObs = '';
    this.saidaFormKey++;
    this.saidaPecaAcKey++;
  }

  onSaidaPecaChange(): void {
    // Mantido por compatibilidade — fluxo atual usa suggestion.
  }

  modelosCompativeisPeca(pecaId: string): ModeloCompativel[] {
    if (!pecaId) return [];
    const peca = this.pecas.find(p => p.id === pecaId);
    return (peca?.modelosCompativeis ?? []).slice().sort((a, b) =>
      this.labelModeloCompat(a).localeCompare(this.labelModeloCompat(b), 'pt-BR'));
  }

  labelModeloCompat(mc: ModeloCompativel): string {
    const nome = (mc.modeloNome ?? mc.modeloId).trim();
    return mc.marcaNome ? `${mc.marcaNome} · ${nome}` : nome;
  }

  labelModeloMovimentacao(modeloNome?: string, modeloId?: string): string {
    return (modeloNome ?? modeloId ?? '').trim() || '—';
  }

  salvarPedido(): void {
    this.erro = '';
    this.sucesso = '';

    for (const item of this.itensPedido) {
      this.resolverPecaPedido(item);
    }

    const incompletos = this.itensPedido.filter(i =>
      (i.categoria || i.modeloId || i.quantidade > 0 || i.custoUnitario > 0)
      && (!i.categoria || !i.modeloId || !i.pecaId));
    if (incompletos.length > 0) {
      this.erro = incompletos[0].avisoResolucao
        ?? 'Preencha categoria, modelo e aguarde a peça ser encontrada em cada linha.';
      return;
    }

    const semCor = this.itensPedido.filter(i =>
      i.pecaId && i.modeloId && this.itemUsaCor(i) && !i.cor?.trim());
    if (semCor.length > 0) {
      this.erro = 'Em Tampa traseira / Vidro Traseiro, informe a cor em cada linha (quantidade por cor e modelo).';
      return;
    }

    if (this.itensPedido.length > this.limiteItensPedido) {
      this.erro = `Limite de ${this.limiteItensPedido} itens por pedido.`;
      return;
    }

    const itens = this.itensPedido
      .filter(i => i.pecaId && i.modeloId && i.quantidade > 0)
      .map(({
        categoria, buscaModelo, avisoResolucao, modeloAutocompleteKey, buscarModelosFn,
        uid, pecasCandidatas, coresSugeridas, ...item
      }) => {
        if (!item.modeloNome && item.modeloId) {
          item.modeloNome = this.modelosPedido.find(m => m.id === item.modeloId)?.nome;
        }
        if (item.cor) item.cor = item.cor.trim();
        else delete item.cor;
        return item;
      });
    if (!this.pedidoFornecedor.trim()) {
      this.erro = 'Informe o fornecedor.';
      return;
    }
    if (itens.length === 0) {
      this.erro = 'Adicione ao menos um item válido.';
      return;
    }

    const numeroPedido = this.pedidoNumero.trim() || this.gerarNumeroPedido();
    this.pedidoNumero = numeroPedido;

    this.carregando = true;
    this.sucesso = `Salvando pedido com ${itens.length} item(ns)…`;
    this.service.registrarPedido({
      numeroPedido,
      fornecedor: this.pedidoFornecedor.trim(),
      numeroNf: this.pedidoNf.trim() || undefined,
      dataPedido: this.pedidoData ? new Date(this.pedidoData).toISOString() : undefined,
      observacoes: this.pedidoObs.trim() || undefined,
      itens,
    }).pipe(
      timeout(180_000),
    ).subscribe({
      next: () => {
        this.carregando = false;
        this.sucesso = `Pedido ${numeroPedido} registrado e estoque atualizado (${itens.length} lotes).`;
        this.pedidoNumero = '';
        this.pedidoFornecedor = '';
        this.pedidoNf = '';
        this.pedidoObs = '';
        this.itensPedido = [this.itemVazio()];
        this.irPara('pedidos');
      },
      error: err => {
        this.carregando = false;
        this.sucesso = '';
        if (err instanceof TimeoutError || err?.name === 'TimeoutError') {
          this.erro = 'Tempo esgotado ao salvar o pedido. Verifique a conexão e tente novamente.';
          return;
        }
        this.erro = err.error?.erro
          ?? err.error?.message
          ?? err.message
          ?? 'Erro ao registrar pedido.';
      },
    });
  }

  /** Preenche o número se estiver vazio (ao abrir o formulário). */
  private garantirNumeroPedidoAutomatico(): void {
    if (this.pedidoNumero.trim()) return;

    if (this.pedidos.length > 0) {
      this.pedidoNumero = this.gerarNumeroPedido(this.pedidos);
      return;
    }

    this.service.listarPedidos().subscribe({
      next: p => {
        this.pedidos = p;
        if (!this.pedidoNumero.trim()) {
          this.pedidoNumero = this.gerarNumeroPedido(p);
        }
      },
      error: () => {
        if (!this.pedidoNumero.trim()) {
          this.pedidoNumero = this.gerarNumeroPedido();
        }
      },
    });
  }

  /** Novos pedidos: AA-N (ex.: 26-1). Não reaproveita a sequência PC-AAAA-NNN. */
  private gerarNumeroPedido(lista: PedidoCompraEstoque[] = this.pedidos): string {
    const yy = new Date().getFullYear() % 100;
    const re = new RegExp(`^${yy}-(\\d+)$`);
    let maxSeq = 0;

    for (const p of lista) {
      const m = re.exec((p.numeroPedido ?? '').trim());
      if (!m) continue;
      const seq = Number.parseInt(m[1], 10);
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }

    return `${yy}-${maxSeq + 1}`;
  }

  salvarSaida(): void {
    this.erro = '';
    this.sucesso = '';
    if (!this.saidaModeloId) {
      this.erro = 'Selecione o modelo do aparelho.';
      return;
    }
    if (!this.saidaPecaId) {
      this.erro = 'Selecione a peça compatível.';
      return;
    }
    if (!this.pecaCompativelComModelo(this.saidaPecaId, this.saidaModeloId)) {
      this.erro = 'A peça selecionada não é compatível com o modelo.';
      return;
    }

    this.carregando = true;
    const modeloNome = this.saidaModeloNome
      || this.modelos.find(m => m.id === this.saidaModeloId)?.nome
      || this.pecas.find(p => p.id === this.saidaPecaId)
        ?.modelosCompativeis?.find(m => m.modeloId === this.saidaModeloId)?.modeloNome;

    this.service.registrarSaida({
      pecaId: this.saidaPecaId,
      marcaPeca: this.saidaMarca.trim() || undefined,
      modeloId: this.saidaModeloId || undefined,
      modeloNome: modeloNome || undefined,
      quantidade: this.saidaQtd,
      osNumero: this.saidaOsNumero.trim() || undefined,
      observacao: this.saidaObs.trim() || undefined,
    }).subscribe({
      next: () => {
        this.carregando = false;
        this.sucesso = 'Saída registrada (FIFO — lote mais antigo).';
        this.limparFormularioSaida();
        this.carregarPecas();
        this.irPara('saidas');
      },
      error: err => {
        this.carregando = false;
        this.erro = err.error?.erro ?? 'Erro ao registrar saída.';
      },
    });
  }

  labelPeca(id: string): string {
    return this.pecas.find(p => p.id === id)?.nome ?? id;
  }

  formatarData(valor?: string): string {
    if (!valor) return '—';
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
  }

  formatarMoeda(v?: number): string {
    return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private hojeInput(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  private dataInputDiasAtras(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  private itemVazio(): ItemPedidoCompraUi {
    return this.prepararItemPedido({
      uid: this.proximoUidItemPedido++,
      categoria: '',
      buscaModelo: '',
      avisoResolucao: '',
      modeloAutocompleteKey: 0,
      pecasCandidatas: [],
      coresSugeridas: [],
      pecaId: '',
      fornecedor: '',
      marcaPeca: '',
      modeloId: '',
      modeloNome: undefined,
      quantidade: 1,
      custoUnitario: 0,
      garantiaMeses: 12,
    });
  }
}
