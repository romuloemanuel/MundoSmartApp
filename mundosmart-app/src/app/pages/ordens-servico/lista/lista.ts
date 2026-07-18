import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { OrdensServicoService, OsFiltros } from '../../../services/ordens-servico';
import { BlingOrdemServico } from '../../../models/bling.models';
import {
  osSituacaoConcluida,
  osSituacaoCancelada,
  osSituacaoFinalizada,
  osSituacaoAguardandoCliente,
  osSituacaoAguardandoPeca,
  osSituacaoEmTeste,
  osSituacaoAguardandoRetornoLoja,
  osPrecisaEscolherTecnico,
  situacoesDisponiveisPorLoja,
  ajustarSituacaoParaLoja,
} from '../os-situacao.util';
import {
  SITUACOES_OS_FILTRO,
  situacaoPadraoPorLoja,
} from '../../../config/os-situacao.config';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcoesOs } from '../../../components/grid-acoes-os/grid-acoes-os';
import { JustificativaAtrasoModal } from '../../../components/justificativa-atraso-modal/justificativa-atraso-modal';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import { posicionarPopoverFixo } from '../../../utils/popover-posicao.util';
import {
  OS_ORDENACAO_PADRAO,
  OsOrdenacao,
  OsOrdenacaoCampo,
} from '../../../config/os-lista.config';
import {
  LOJAS_OS_FILTRO,
  labelLojaOs,
  siglaLojaOs,
} from '../../../config/os-loja.config';
import { equipamentoGridLabel } from '../../../utils/os-grid-display.util';
import { OS_PAINEL_TV_FAIXAS, OsPainelTvNivel } from '../../../config/os-painel-tv.config';
import { TecnicosService, Tecnico } from '../../../services/tecnicos';
import { TecnicoSelectDialogService } from '../../../services/tecnico-select-dialog';
import { OsSituacaoDialogService } from '../../../services/os-situacao-dialog';
import { AparelhosService } from '../../../services/aparelhos';
import { AppAuthService } from '../../../services/app-auth';
import {
  formatarTempoDecorrido,
  formatarPrazoPecaRestante,
  minutosDesdeEntrada,
  nivelUrgenciaDaOs,
  dataBaseUrgenciaOs,
  ordemUrgenciaNivel,
  OsUrgenciaNivel,
  labelUrgenciaNivel,
  osTemJustificativaAtraso,
} from '../../../utils/os-painel-tv.util';
import { agoraDataBrasil } from '../../../utils/horario-brasil.util';

@Component({
  selector: 'app-ordens-servico-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridPaginator, GridAcoesOs, JustificativaAtrasoModal],
  templateUrl: './lista.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      min-width: 0;
    }

    :host .page {
      max-width: none;
      width: 100%;
    }

    .os-grid-scroll {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 4px;
    }

    /* Larguras fixas em px: a grade rola na horizontal em vez de esmagar/sobrepor colunas. */
    .os-grid {
      table-layout: fixed;
      width: 1224px;
      min-width: 1224px;
      max-width: none;
      border-collapse: separate;
      border-spacing: 0;
    }

    :host ::ng-deep table.os-grid tbody,
    :host ::ng-deep table.os-grid tr {
      overflow: visible;
    }

    .os-grid th,
    .os-grid td {
      box-sizing: border-box;
      vertical-align: middle;
    }

    .os-grid .col-urgencia { width: 36px; min-width: 36px; max-width: 36px; text-align: center; padding-left: 4px; padding-right: 4px; }
    .os-grid .col-num { width: 56px; min-width: 56px; max-width: 56px; }
    .os-grid .col-cliente { width: 160px; min-width: 160px; max-width: 160px; }
    .os-grid .col-aviso { width: 72px; min-width: 72px; max-width: 72px; text-align: center; }
    .os-grid .col-equip { width: 150px; min-width: 150px; max-width: 150px; }
    .os-grid .col-imei { width: 140px; min-width: 140px; max-width: 140px; font-variant-numeric: tabular-nums; font-size: 12px; }
    .os-grid .col-sit { width: 132px; min-width: 132px; max-width: 132px; }
    .os-grid .col-tecnico {
      width: 110px;
      min-width: 110px;
      max-width: 110px;
      font-size: 12px;
    }
    .os-grid .col-ret { width: 48px; min-width: 48px; max-width: 48px; text-align: center; }
    .os-grid .col-loja { width: 52px; min-width: 52px; max-width: 52px; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
    .os-grid .col-data { width: 78px; min-width: 78px; max-width: 78px; white-space: nowrap; font-size: 12px; line-height: 1.05; text-align: center; }
    .os-grid .col-data-hora {
      display: block;
      margin-top: 0;
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      line-height: 1;
      text-align: center;
    }
    .os-grid .col-valor { width: 90px; min-width: 90px; max-width: 90px; text-align: right; white-space: nowrap; font-size: 11px; font-variant-numeric: tabular-nums; padding-right: 6px; }
    .os-grid .col-acoes { width: 100px; min-width: 100px; max-width: 100px; padding-left: 4px; padding-right: 4px; }

    .os-grid .col-cliente-nome {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      word-break: break-word;
      line-height: 1.25;
      max-height: 2.5em;
    }

    .os-grid .col-equip,
    .os-grid .col-imei,
    .os-grid .col-tecnico {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .os-grid .col-sit,
    .os-grid .col-acoes,
    .os-grid .col-aviso {
      overflow: visible;
    }

    .comissao-resumo {
      margin: 0 0 12px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0c4a6e;
      font-size: 13px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
    }
    .comissao-resumo .comissao-total { font-weight: 700; color: #075985; }
    .comissao-resumo .campo-hint {
      flex: 1 1 100%;
      margin: 2px 0 0;
      color: #0369a1;
      font-size: 12px;
    }

    .grid-situacao-select {
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 3px 4px;
      font-size: 10px;
      font-weight: 600;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #fff;
      color: #1e40af;
      cursor: pointer;
    }
    .grid-situacao-select:disabled,
    .grid-situacao-badge {
      opacity: 0.85;
    }
    .grid-situacao-badge {
      display: inline-block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 3px 4px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 5px;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .grid-situacao-badge--concluida {
      background: #dcfce7;
      color: #166534;
    }
    .grid-situacao-badge--cancelada {
      background: #fee2e2;
      color: #991b1b;
    }
    .grid-situacao-badge--aguardando-cliente,
    .grid-situacao-select--aguardando-cliente {
      background: #fef9c3;
      border-color: #fde047;
      color: #854d0e;
    }
    .grid-situacao-badge--em-teste,
    .grid-situacao-select--em-teste {
      background: #ede9fe;
      border-color: #c4b5fd;
      color: #5b21b6;
    }
    .grid-situacao-badge--retorno-loja,
    .grid-situacao-select--retorno-loja {
      background: #e0f2fe;
      border-color: #7dd3fc;
      color: #075985;
    }
    .grid-situacao-badge--aguardando-peca,
    .grid-situacao-select--aguardando-peca {
      background: #ffedd5;
      border-color: #fdba74;
      color: #9a3412;
    }
    .grid-situacao-select--prazo-vencido {
      background: #fee2e2;
      border-color: #f87171;
      color: #991b1b;
    }
    .grid-prazo-peca {
      display: block;
      margin-top: 2px;
      font-size: 9px;
      font-weight: 700;
      color: #9a3412;
      line-height: 1.1;
      white-space: nowrap;
    }
    .grid-prazo-peca--vencido { color: #b91c1c; }
    .grid-situacao-select:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    .grid-retorno-badge {
      display: inline-block;
      padding: 2px 6px;
      font-size: 10px;
      line-height: 1.2;
    }

    .grid-aviso-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0 !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 6px !important;
      background: #fff !important;
      color: #2563eb !important;
      cursor: pointer;
      min-width: unset;
    }
    .grid-aviso-btn:hover,
    .grid-aviso-btn.ativo {
      background: #eff6ff !important;
      border-color: #93c5fd !important;
    }
    .grid-aviso-btn svg { width: 15px; height: 15px; }

    .grid-aviso-wrap { position: relative; display: inline-flex; justify-content: center; }

    .grid-aviso-pop {
      position: fixed;
      z-index: 10050;
      min-width: 180px;
      max-width: 260px;
      padding: 10px 12px;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      font-size: 12px;
      line-height: 1.45;
      text-align: left;
      white-space: normal;
      pointer-events: auto;
    }
    .grid-aviso-pop.abre-cima::before {
      top: auto;
      bottom: -5px;
      border-bottom: none;
      border-top: 6px solid #0f172a;
    }
    .grid-aviso-pop::before {
      content: '';
      position: absolute;
      top: -5px;
      left: 50%;
      transform: translateX(-50%);
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 6px solid #0f172a;
    }
    .grid-aviso-pop strong { display: block; margin-bottom: 4px; font-size: 13px; }
    .grid-aviso-pop span { display: block; color: #cbd5e1; }
    .grid-aviso-pop .grid-aviso-pref {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #334155;
      color: #fde68a;
      font-weight: 600;
    }
    .grid-aviso-vazio { color: #94a3b8; }

    .urgencia-dot {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      vertical-align: middle;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12);
    }
    .urgencia-dot-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: 999px;
    }
    .urgencia-dot-btn:disabled {
      cursor: default;
      opacity: 0.7;
    }
    .urgencia-dot-btn:not(:disabled):hover {
      background: #f1f5f9;
    }
    .urgencia-dot--branco { background: #f8fafc; box-shadow: inset 0 0 0 1px #cbd5e1; }
    .urgencia-dot--amarelo { background: #facc15; }
    .urgencia-dot--laranja { background: #fb923c; }
    .urgencia-dot--vermelho { background: #ef4444; }
    .urgencia-dot--vermelho.urgencia-dot--avisar {
      box-shadow: 0 0 0 2px #fecaca, inset 0 0 0 1px rgba(15, 23, 42, 0.12);
      animation: urgencia-avisar-pulse 1.6s ease-in-out infinite;
    }
    @keyframes urgencia-avisar-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.25); }
    }
    .urgencia-dot--finalizada { background: #cbd5e1; }
    .urgencia-dot--pre {
      background: transparent;
      box-shadow: inset 0 0 0 1.5px #94a3b8;
      border-style: dashed;
    }

    .filtro-urgencia {
      min-width: 128px;
      max-width: 150px;
    }
    .filtro-loja {
      min-width: 110px;
      max-width: 140px;
    }
    .grid-loja-sigla {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
    }
  `],
})
export class OrdensServicoLista implements OnInit, OnDestroy {
  /** Datas operacionais da OS: horário de Brasília gravado como UTC. */
  readonly tz = 'UTC';
  ordens: BlingOrdemServico[] = [];
  totalRegistros = 0;
  carregando = false;
  erro = '';
  filtrosAbertos = false;
  alterandoSituacaoId?: number;
  osJustificativaAtraso: BlingOrdemServico | null = null;
  salvandoJustificativaAtraso = false;
  erroJustificativaAtraso: string | null = null;
  avisoAbertoId?: number;
  avisoAbertoOs?: BlingOrdemServico;
  avisoPopStyle: Record<string, string> = {};
  avisoPopAbreCima = false;
  private avisoIgnorarProximoClick = false;
  readonly grid = new GridPaginationState();
  ordenacao: OsOrdenacao = { ...OS_ORDENACAO_PADRAO };
  private loadSub?: Subscription;
  private readonly onScrollAviso = () => this.fecharContatoAviso();
  /** Filtro local por bolinha de urgência (baseado na data de entrada). */
  filtroUrgencia: '' | OsPainelTvNivel = '';

  filtros: OsFiltros = {
    situacao: '',
    nome: '',
    telefone: '',
    imei: '',
    cpfCnpj: '',
    dataCadastroInicio: '',
    dataCadastroFim: '',
    dataAtualizacaoInicio: '',
    dataAtualizacaoFim: '',
    dataConclusaoInicio: '',
    dataConclusaoFim: '',
    retorno: null,
    lojaOrigem: '',
    tecnicoNome: '',
  };

  readonly situacoesFiltro = SITUACOES_OS_FILTRO;
  readonly faixasUrgencia = OS_PAINEL_TV_FAIXAS;
  readonly lojasFiltro = LOJAS_OS_FILTRO;

  readonly retornoOpcoes = [
    { value: null, label: 'Todos' },
    { value: true, label: 'Sim' },
    { value: false, label: 'Não' },
  ];

  private tecnicosAtivos: Tecnico[] = [];
  tecnicosFiltro: Tecnico[] = [];

  get ehRoot(): boolean {
    return this.appAuth.isRoot();
  }

  get ehAdmin(): boolean {
    return this.appAuth.isAdmin();
  }

  /**
   * Lista é aberta (ver fila da assistência / outras lojas).
   * Criação continua restrita à loja do usuário.
   */
  get lojaFiltroTravada(): boolean {
    return false;
  }

  constructor(
    private service: OrdensServicoService,
    private tecnicosService: TecnicosService,
    private tecnicoDialog: TecnicoSelectDialogService,
    private situacaoDialog: OsSituacaoDialogService,
    private aparelhosService: AparelhosService,
    private appAuth: AppAuthService,
    private router: Router,
  ) {
    document.addEventListener('scroll', this.onScrollAviso, true);
  }

  ngOnInit(): void {
    // Operador: foco no movimento do dia; ainda pode filtrar qualquer loja (ex.: Mococa).
    if (this.appAuth.restringeCriacaoPorLoja()) {
      const hoje = agoraDataBrasil();
      this.filtros.dataCadastroInicio = hoje;
      this.filtros.dataCadastroFim = hoje;
    }
    this.carregarTecnicos();
    this.carregar();
  }

  private carregarTecnicos(): void {
    this.tecnicosService.listar().subscribe({
      next: (lista) => {
        this.tecnicosFiltro = lista;
        this.tecnicosAtivos = lista.filter(t => t.ativo);
      },
      error: () => {
        this.tecnicosFiltro = [];
        this.tecnicosAtivos = [];
      },
    });
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    document.removeEventListener('scroll', this.onScrollAviso, true);
  }

  buscarComFiltros(): void {
    this.grid.reset();
    this.carregar();
  }

  onUrgenciaFiltroChange(): void {
    this.grid.reset();
    this.carregar();
  }

  onPaginaChange(pagina: number): void {
    this.grid.onPageChange(pagina);
    this.carregar();
  }

  onTamanhoPaginaChange(tamanho: number): void {
    this.grid.onPageSizeChange(tamanho);
    this.carregar();
  }

  ordenar(campo: OsOrdenacaoCampo): void {
    if (this.ordenacao.campo === campo) {
      this.ordenacao = {
        campo,
        direcao: this.ordenacao.direcao === 'asc' ? 'desc' : 'asc',
      };
    } else {
      this.ordenacao = {
        campo,
        direcao: campo === 'urgencia' ? 'asc' : 'asc',
      };
    }
    this.grid.reset();
    this.carregar();
  }

  iconeOrdenacao(campo: OsOrdenacaoCampo): string {
    if (this.ordenacao.campo !== campo) return '↕';
    return this.ordenacao.direcao === 'asc' ? '↑' : '↓';
  }

  colunaOrdenada(campo: OsOrdenacaoCampo): boolean {
    return this.ordenacao.campo === campo;
  }

  carregar(): void {
    this.loadSub?.unsubscribe();
    this.erro = '';
    const f = this.montarFiltrosRequest();

    const emCache = this.service.peekLista(f);
    if (emCache) {
      this.aplicarResposta(emCache);
      this.carregando = false;
    } else {
      this.carregando = true;
    }

    this.loadSub = this.service.listar(f).pipe(
      finalize(() => { this.carregando = false; }),
    ).subscribe({
      next: (dados) => this.aplicarResposta(dados),
      error: (err) => {
        const timeout = err?.name === 'TimeoutError';
        const msg = err?.error?.erro;
        this.erro = timeout
          ? 'A API não respondeu a tempo. Verifique se está rodando em http://localhost:5276'
          : msg
            ? `Erro ao carregar ordens de serviço: ${msg}`
            : 'Erro ao carregar ordens de serviço. Verifique se a API está rodando.';
      },
    });
  }

  private montarFiltrosRequest(): OsFiltros {
    const ordenarPor = this.ordenacao.campo === 'urgencia' ? 'urgencia' : this.ordenacao.campo;
    const direcao = this.ordenacao.campo === 'urgencia'
      ? (this.ordenacao.direcao === 'asc' ? 'asc' : 'desc')
      : this.ordenacao.direcao;

    // Com filtro de urgência, busca um lote maior e filtra/pagina no cliente.
    const filtrandoUrgencia = !!this.filtroUrgencia;
    return {
      situacao: this.filtros.situacao || undefined,
      nome: this.filtros.nome || undefined,
      telefone: this.filtros.telefone || undefined,
      imei: this.filtros.imei || undefined,
      cpfCnpj: this.filtros.cpfCnpj || undefined,
      dataCadastroInicio: this.filtros.dataCadastroInicio || undefined,
      dataCadastroFim: this.filtros.dataCadastroFim || undefined,
      dataAtualizacaoInicio: this.filtros.dataAtualizacaoInicio || undefined,
      dataAtualizacaoFim: this.filtros.dataAtualizacaoFim || undefined,
      dataConclusaoInicio: this.filtros.dataConclusaoInicio || undefined,
      dataConclusaoFim: this.filtros.dataConclusaoFim || undefined,
      retorno: this.filtros.retorno !== null && this.filtros.retorno !== undefined ? this.filtros.retorno : undefined,
      lojaOrigem: this.filtros.lojaOrigem || undefined,
      tecnicoNome: this.filtros.tecnicoNome || undefined,
      pagina: filtrandoUrgencia ? 1 : this.grid.page,
      tamanhoPagina: filtrandoUrgencia ? 100 : this.grid.pageSize,
      ordenarPor,
      direcao,
    };
  }

  private aplicarResposta(dados: { itens?: BlingOrdemServico[]; total?: number }): void {
    let itens = Array.isArray(dados.itens) ? [...dados.itens] : [];

    if (this.filtroUrgencia) {
      itens = itens.filter(os => this.nivelUrgencia(os) === this.filtroUrgencia);
    }

    if (this.ordenacao.campo === 'urgencia') {
      const asc = this.ordenacao.direcao === 'asc';
      itens.sort((a, b) => {
        const da = ordemUrgenciaNivel(this.nivelUrgencia(a));
        const db = ordemUrgenciaNivel(this.nivelUrgencia(b));
        if (da !== db) return asc ? da - db : db - da;
        const ta = new Date(this.dataEntradaLabel(a) || 0).getTime();
        const tb = new Date(this.dataEntradaLabel(b) || 0).getTime();
        return asc ? ta - tb : tb - ta;
      });
    }

    if (this.filtroUrgencia) {
      this.totalRegistros = itens.length;
      const start = (this.grid.page - 1) * this.grid.pageSize;
      this.ordens = itens.slice(start, start + this.grid.pageSize);
      return;
    }

    this.ordens = itens;
    this.totalRegistros = dados.total ?? this.ordens.length;
  }

  limparFiltros(): void {
    this.filtros = {
      situacao: '',
      nome: '',
      telefone: '',
      imei: '',
      cpfCnpj: '',
      dataCadastroInicio: '',
      dataCadastroFim: '',
      dataAtualizacaoInicio: '',
      dataAtualizacaoFim: '',
      dataConclusaoInicio: '',
      dataConclusaoFim: '',
      retorno: null,
      lojaOrigem: '',
      tecnicoNome: '',
    };
    this.filtroUrgencia = '';
    this.grid.reset();
    this.carregar();
  }

  get filtrosAtivos(): number {
    let count = 0;
    if (this.filtros.situacao) count++;
    if (this.filtros.nome) count++;
    if (this.filtros.telefone) count++;
    if (this.filtros.imei) count++;
    if (this.filtros.cpfCnpj) count++;
    if (this.filtros.dataCadastroInicio || this.filtros.dataCadastroFim) count++;
    if (this.filtros.dataAtualizacaoInicio || this.filtros.dataAtualizacaoFim) count++;
    if (this.filtros.dataConclusaoInicio || this.filtros.dataConclusaoFim) count++;
    if (this.filtros.retorno !== null && this.filtros.retorno !== undefined) count++;
    if (this.filtros.lojaOrigem) count++;
    if (this.filtros.tecnicoNome) count++;
    if (this.filtroUrgencia) count++;
    return count;
  }

  get totalValorPagina(): number {
    return this.ordens.reduce(
      (acc, os) => acc + (os.valorTotalAcordado ?? os.valorTotal ?? 0),
      0,
    );
  }

  get periodoConclusaoLabel(): string {
    const ini = this.filtros.dataConclusaoInicio;
    const fim = this.filtros.dataConclusaoFim;
    if (!ini && !fim) return '';
    if (ini && fim) return `conclusão ${ini} → ${fim}`;
    if (ini) return `conclusão a partir de ${ini}`;
    return `conclusão até ${fim}`;
  }

  nivelUrgencia(os: BlingOrdemServico): OsUrgenciaNivel {
    return nivelUrgenciaDaOs(os);
  }

  tituloUrgencia(os: BlingOrdemServico): string {
    if (osTemJustificativaAtraso(os)) {
      const textos = (os.justificativasAtraso ?? [])
        .map(j => (j.texto ?? '').trim())
        .filter(Boolean);
      return `Avisar cliente · ${textos.join(' · ')}`;
    }
    const nivel = this.nivelUrgencia(os);
    if (nivel === 'finalizada') return 'Finalizada';
    if (nivel === 'pre') return 'Tempo ainda não iniciado (só conta em Na assistência)';
    if (osSituacaoAguardandoPeca(os.situacao)) {
      return `Aguardando peça · ${formatarPrazoPecaRestante(os.dataPrazoPeca)}`;
    }
    const base = dataBaseUrgenciaOs(os);
    const mins = minutosDesdeEntrada(base);
    return `${labelUrgenciaNivel(nivel)} · ${formatarTempoDecorrido(mins)} na assistência`;
  }

  temJustificativaAtraso(os: BlingOrdemServico): boolean {
    return osTemJustificativaAtraso(os);
  }

  justificarAtraso(os: BlingOrdemServico, event?: Event): void {
    event?.stopPropagation();
    if (!os.id || this.osSituacaoFinalizada(os) || !this.podeEditarOs(os)) return;
    this.erroJustificativaAtraso = null;
    this.salvandoJustificativaAtraso = false;
    this.osJustificativaAtraso = os;
  }

  fecharJustificativaAtraso(): void {
    if (this.salvandoJustificativaAtraso) return;
    this.osJustificativaAtraso = null;
    this.erroJustificativaAtraso = null;
  }

  confirmarJustificativaAtraso(texto: string): void {
    const os = this.osJustificativaAtraso;
    if (!os?.id || !texto) return;

    const anterior = os.justificativasAtraso ? [...os.justificativasAtraso] : [];
    os.justificativasAtraso = [
      ...anterior,
      { texto, criadoEm: new Date().toISOString() },
    ];
    this.salvandoJustificativaAtraso = true;
    this.erroJustificativaAtraso = null;

    this.service.justificarAtraso(os.id, texto).subscribe({
      next: () => {
        this.salvandoJustificativaAtraso = false;
        this.osJustificativaAtraso = null;
        this.service.invalidarListaCache();
      },
      error: (err) => {
        os.justificativasAtraso = anterior;
        this.salvandoJustificativaAtraso = false;
        this.erroJustificativaAtraso =
          err?.error?.erro ?? 'Erro ao salvar justificativa de atraso.';
      },
    });
  }

  situacoesParaOs(os: BlingOrdemServico): string[] {
    return situacoesDisponiveisPorLoja(os.lojaOrigem);
  }

  situacaoExibida(os: BlingOrdemServico): string {
    return os.situacao || situacaoPadraoPorLoja(os.lojaOrigem);
  }

  siglaLoja(os: BlingOrdemServico): string {
    return siglaLojaOs(os.lojaOrigem);
  }

  tituloLoja(os: BlingOrdemServico): string {
    return labelLojaOs(os.lojaOrigem);
  }

  nova(): void {
    this.router.navigate(['/ordens-servico/nova']);
  }

  ver(id: number): void {
    const os = this.ordens.find(o => o.id === id);
    if (os) this.service.seedObter(os);
    this.router.navigate(['/ordens-servico', id]);
  }

  editar(os: BlingOrdemServico): void {
    if (!this.podeEditarOs(os)) return;
    if (os.id != null) this.service.seedObter(os);
    this.router.navigate(['/ordens-servico', os.id, 'editar']);
  }

  osSituacaoFinalizada(os: BlingOrdemServico): boolean {
    return osSituacaoFinalizada(os.situacao);
  }

  /** Ver é livre; editar/situação só na loja permitida (ou Admin). */
  podeEditarOs(os: BlingOrdemServico): boolean {
    if (this.osSituacaoFinalizada(os)) return false;
    return this.appAuth.podeAlterarOsDaLoja(os.lojaOrigem);
  }

  tituloEditarOs(os: BlingOrdemServico): string {
    if (this.osSituacaoFinalizada(os)) return 'OS finalizada — edite pela tela de detalhes';
    if (!this.appAuth.podeAlterarOsDaLoja(os.lojaOrigem)) {
      return 'Só visualização — OS de outra loja';
    }
    return 'Editar';
  }

  async onSituacaoChange(os: BlingOrdemServico, novaSituacao: string): Promise<void> {
    if (!this.podeEditarOs(os)) return;
    if (!os.id || !novaSituacao || os.situacao === novaSituacao) return;

    const situacaoAnterior = os.situacao;
    const prazoAnterior = os.dataPrazoPeca;
    const tecnicoAnterior = os.tecnicoNome;
    const situacaoNormalizada = ajustarSituacaoParaLoja(novaSituacao, os.lojaOrigem);
    const osLabel = os.numero ? `OS #${os.numero}` : `OS #${os.id}`;
    let motivoCancelamento: string | undefined;
    let dataPrazoPeca: string | undefined;
    let tecnicoNome: string | undefined;

    const reverterERecarregar = (): void => {
      os.situacao = situacaoAnterior;
      os.dataPrazoPeca = prazoAnterior;
      os.tecnicoNome = tecnicoAnterior;
      this.carregar();
    };

    if (osSituacaoCancelada(situacaoNormalizada) && !osSituacaoCancelada(situacaoAnterior)) {
      const motivo = await this.situacaoDialog.openCancelar({ osLabel });
      if (!motivo) {
        reverterERecarregar();
        return;
      }
      motivoCancelamento = motivo;
    }

    if (osSituacaoAguardandoPeca(situacaoNormalizada) && !osSituacaoAguardandoPeca(situacaoAnterior)) {
      const prazo = await this.situacaoDialog.openPrazo({ osLabel });
      if (!prazo) {
        reverterERecarregar();
        return;
      }
      dataPrazoPeca = prazo;
      os.dataPrazoPeca = prazo;
    }

    if (osSituacaoConcluida(situacaoNormalizada) && !osSituacaoConcluida(situacaoAnterior)) {
      const ok = await this.situacaoDialog.openConcluir({ osLabel });
      if (!ok) {
        reverterERecarregar();
        return;
      }
    }

    if (osPrecisaEscolherTecnico(situacaoNormalizada, os.tecnicoNome, this.tecnicosAtivos)) {
      const escolhido = await this.tecnicoDialog.open({
        tecnicos: this.tecnicosAtivos,
        tecnicoAtual: os.tecnicoNome,
        situacao: situacaoNormalizada,
        osLabel,
      });
      if (!escolhido) {
        reverterERecarregar();
        return;
      }
      tecnicoNome = escolhido;
      os.tecnicoNome = escolhido;
    }

    os.situacao = situacaoNormalizada;
    if (motivoCancelamento) os.motivoCancelamento = motivoCancelamento;
    this.erro = '';
    this.alterandoSituacaoId = os.id;

    this.service.alterarSituacao(
      os.id,
      situacaoNormalizada,
      motivoCancelamento,
      dataPrazoPeca,
      tecnicoNome,
    ).subscribe({
      next: () => {
        this.alterandoSituacaoId = undefined;
        this.service.invalidarListaCache();
        this.aparelhosService.limparCacheReferencia();
        // Refresh para o select/status ficarem sincronizados e permitirem nova alteração.
        this.carregar();
      },
      error: (err) => {
        this.alterandoSituacaoId = undefined;
        this.erro = err?.error?.erro ?? 'Erro ao alterar situação da OS.';
        reverterERecarregar();
      },
    });
  }

  equipamentoLabel(os: BlingOrdemServico): string {
    return equipamentoGridLabel(os);
  }

  temContatoAviso(os: BlingOrdemServico): boolean {
    const aviso = os.contatoAviso;
    return !!(aviso?.nome?.trim() || aviso?.celular?.trim() || aviso?.telefone?.trim());
  }

  tooltipContatoAviso(os: BlingOrdemServico): string {
    return this.linhasContatoAviso(os).join('\n');
  }

  linhasContatoAviso(os: BlingOrdemServico): string[] {
    const aviso = os.contatoAviso;
    if (!aviso) return ['Nenhuma pessoa autorizada'];
    const linhas: string[] = [];
    if (aviso.nome?.trim()) linhas.push(aviso.nome.trim());
    const tel = aviso.celular?.trim() || aviso.telefone?.trim();
    if (tel) linhas.push(tel);
    if (aviso.parentesco?.trim()) linhas.push(aviso.parentesco.trim());
    if (aviso.autorizadoRetirada !== false) linhas.push('Autorizado a retirar');
    if (os.preferenciaContatoSelecionado) linhas.push('Aviso só por este número');
    return linhas.length ? linhas : ['Sem dados do contato'];
  }

  toggleContatoAviso(os: BlingOrdemServico, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.temContatoAviso(os) || os.id == null) return;
    if (this.avisoAbertoId === os.id) {
      this.fecharContatoAviso();
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    this.avisoAbertoId = os.id;
    this.avisoAbertoOs = os;
    this.avisoPopStyle = posicionarPopoverFixo(btn, {
      width: 220,
      height: 140,
      align: 'center',
    });
    this.avisoPopAbreCima = this.avisoPopStyle['top'] === 'auto';
    // Evita o mesmo clique no document fechar o pop assim que abre.
    this.avisoIgnorarProximoClick = true;
    setTimeout(() => { this.avisoIgnorarProximoClick = false; }, 0);
  }

  @HostListener('document:click')
  fecharContatoAviso(): void {
    if (this.avisoIgnorarProximoClick) return;
    this.avisoAbertoId = undefined;
    this.avisoAbertoOs = undefined;
    this.avisoPopAbreCima = false;
  }

  valorCompacto(valor?: number | null): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  dataEntradaLabel(os: BlingOrdemServico): string | undefined {
    return os.dataEntrada || os.data;
  }

  classeBadgeSituacao(os: BlingOrdemServico): string {
    if (osSituacaoCancelada(os.situacao)) return 'grid-situacao-badge--cancelada';
    if (osSituacaoConcluida(os.situacao)) return 'grid-situacao-badge--concluida';
    if (osSituacaoEmTeste(os.situacao)) return 'grid-situacao-badge--em-teste';
    if (osSituacaoAguardandoRetornoLoja(os.situacao)) return 'grid-situacao-badge--retorno-loja';
    if (osSituacaoAguardandoCliente(os.situacao)) return 'grid-situacao-badge--aguardando-cliente';
    if (osSituacaoAguardandoPeca(os.situacao)) return 'grid-situacao-badge--aguardando-peca';
    return '';
  }

  classeSelectSituacao(os: BlingOrdemServico): string {
    if (osSituacaoAguardandoPeca(os.situacao)) {
      return this.prazoPecaVencido(os)
        ? 'grid-situacao-select--prazo-vencido'
        : 'grid-situacao-select--aguardando-peca';
    }
    if (osSituacaoEmTeste(os.situacao)) return 'grid-situacao-select--em-teste';
    if (osSituacaoAguardandoRetornoLoja(os.situacao)) return 'grid-situacao-select--retorno-loja';
    if (osSituacaoAguardandoCliente(os.situacao)) return 'grid-situacao-select--aguardando-cliente';
    return '';
  }

  prazoPecaLabel(os: BlingOrdemServico): string {
    if (!osSituacaoAguardandoPeca(os.situacao) || !os.dataPrazoPeca) return '';
    const d = new Date(os.dataPrazoPeca);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  prazoPecaVencido(os: BlingOrdemServico): boolean {
    if (!osSituacaoAguardandoPeca(os.situacao) || !os.dataPrazoPeca) return false;
    const d = new Date(os.dataPrazoPeca);
    if (Number.isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  }
}
