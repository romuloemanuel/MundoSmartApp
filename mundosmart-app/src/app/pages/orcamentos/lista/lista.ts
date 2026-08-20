import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrcamentosService } from '../../../services/orcamentos';
import {
  ORCAMENTO_OS_PREFILL_STATE_KEY,
  OrcamentoOsPrefillService,
} from '../../../services/orcamento-os-prefill.service';
import { BlingOrcamento } from '../../../models/bling.models';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import { agoraDataBrasil } from '../../../utils/horario-brasil.util';
import { OrcamentoConverterModal } from '../../../components/orcamento-converter-modal/orcamento-converter-modal';
import {
  LOJAS_OS_FILTRO,
  labelLojaOs,
  normalizarLojaOs,
  siglaLojaOs,
} from '../../../config/os-loja.config';
import { AppAuthService } from '../../../services/app-auth';
import { labelTipoContatoOrcamento } from '../../../config/orcamento-contato.config';
import {
  ORCAMENTO_FOLLOWUP_CICLO,
  ORCAMENTO_RESPONSAVEIS,
  ORCAMENTO_SITUACAO_DESISTENCIA,
  ORCAMENTO_SITUACAO_NAO_REALIZADO,
  labelStatusFollowUp,
  orcamentoConvertido,
  orcamentoDesistencia,
  orcamentoEmAberto,
  orcamentoNaoRealizado,
  statusFollowUpOrcamento,
  StatusFollowUpOrcamento,
} from '../../../config/orcamento-followup.config';
import {
  OrcamentoFollowupModal,
  OrcamentoFollowUpModalPayload,
} from '../../../components/orcamento-followup-modal/orcamento-followup-modal';
import { OrcamentoHistoricoModal } from '../../../components/orcamento-historico-modal/orcamento-historico-modal';
import {
  OrcamentoDesistenciaModal,
  OrcamentoDesistenciaPayload,
} from '../../../components/orcamento-desistencia-modal/orcamento-desistencia-modal';
import { avisarErroUsuario } from '../../../services/user-feedback.service';

type FiltroValidade = '' | 'normal' | 'a-vencer' | 'vencidos';
type FiltroSituacao = '' | 'Em aberto' | 'Convertido' | 'Não realizado' | 'Desistência';
type FiltroFollowUpStatus = '' | StatusFollowUpOrcamento;

@Component({
  selector: 'app-orcamentos-lista',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GridPaginator,
    GridAcao,
    OrcamentoConverterModal,
    OrcamentoFollowupModal,
    OrcamentoHistoricoModal,
    OrcamentoDesistenciaModal,
  ],
  templateUrl: './lista.html',
  styles: `
    .orc-vencido { color: #b91c1c; font-weight: 600; }
    .orc-convertido-badge { background: #d1fae5; color: #065f46; }
    .orc-nao-realizado-badge { background: #fee2e2; color: #991b1b; }
    .orc-desistencia-badge { background: #fef3c7; color: #92400e; }
    .orc-grid-acoes { gap: 6px; flex-wrap: nowrap; }
    .data-grid .col-cliente {
      width: 240px;
      min-width: 220px;
      max-width: 280px;
    }
    .data-grid .col-cliente-nome {
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
    .orc-revisitar-data {
      display: block;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
    }
    .data-grid .col-hist {
      width: 72px;
      min-width: 64px;
      max-width: 80px;
      text-align: center;
    }
    .btn-hist-just {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 36px;
      height: 28px;
      padding: 0;
      border: 1px solid #c7d2fe;
      border-radius: 6px;
      background: #eef2ff;
      color: #4338ca;
      cursor: pointer;
    }
    .btn-hist-just:hover {
      background: #e0e7ff;
      border-color: #a5b4fc;
    }
    .btn-hist-just svg {
      width: 15px;
      height: 15px;
      flex-shrink: 0;
    }
    .btn-hist-count {
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .data-grid .col-urgencia {
      width: 36px;
      min-width: 36px;
      max-width: 36px;
      text-align: center;
      padding-left: 4px;
      padding-right: 4px;
    }
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
    .urgencia-dot-btn:hover { background: #f1f5f9; }
    .urgencia-dot--branco { background: #f8fafc; box-shadow: inset 0 0 0 1px #cbd5e1; }
    .urgencia-dot--verde { background: #22c55e; }
    .urgencia-dot--laranja { background: #fb923c; }
    .urgencia-dot--vermelho { background: #ef4444; }
    .urgencia-dot--vermelho.urgencia-dot--pulse {
      box-shadow: 0 0 0 2px #fecaca, inset 0 0 0 1px rgba(15, 23, 42, 0.12);
      animation: orc-urgencia-pulse 1.6s ease-in-out infinite;
    }
    @keyframes orc-urgencia-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.25); }
    }
    .urgencia-dot--finalizada { background: #cbd5e1; }
    tr.orc-row-atrasado {
      background: #fef2f2;
    }
    tr.orc-row-atrasado:hover {
      background: #fee2e2;
    }
    tr.orc-row-proximo {
      background: #fff7ed;
    }
    .filtros-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 16px;
    }
    .filtros-bar input,
    .filtros-bar select {
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      background: #fff;
      min-width: 160px;
    }
    .filtros-bar input.filtro-cliente { min-width: 220px; flex: 1; }
    .filtros-bar input[type="date"] {
      min-width: 150px;
    }
    .filtros-bar .btn-limpar {
      background: #fff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }
    .filtros-bar button.ativa {
      border-color: #b91c1c;
      background: #fef2f2;
      color: #991b1b;
      font-weight: 700;
    }
    .orc-filtro-resumo {
      font-size: 12px;
      color: #64748b;
      margin: -8px 0 14px;
    }
    .orc-filtro-resumo strong { color: #0f172a; }
    .grid-loja-sigla {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #334155;
    }
    .orc-retorno-cell {
      max-width: 220px;
      font-size: 12px;
      line-height: 1.35;
      color: #334155;
    }
    .orc-retorno-data {
      font-weight: 700;
      color: #1d4ed8;
      white-space: nowrap;
    }
    .orc-retorno-data.hoje { color: #b45309; }
    .orc-retorno-data.atrasado { color: #b91c1c; }
    .orc-retorno-just {
      display: block;
      margin-top: 2px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 220px;
    }
    .orc-tipo-contato {
      font-size: 11px;
      color: #475569;
      white-space: nowrap;
    }
    .orc-followup-cell {
      font-size: 12px;
      line-height: 1.35;
      min-width: 110px;
    }
    .orc-followup-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .orc-followup-badge.em-dia {
      background: #dcfce7;
      color: #166534;
    }
    .orc-followup-badge.proximo {
      background: #ffedd5;
      color: #9a3412;
    }
    .orc-followup-badge.atrasado {
      background: #fee2e2;
      color: #991b1b;
    }
    .orc-followup-badge.sem-data {
      background: #f1f5f9;
      color: #64748b;
    }
    .orc-followup-data {
      display: block;
      margin-top: 3px;
      font-weight: 600;
      color: #334155;
    }
    .orc-contatos {
      font-weight: 700;
      color: #0f172a;
    }
    .orc-resp {
      font-size: 12px;
      color: #334155;
      white-space: nowrap;
    }
    .orc-valor-prazo {
      font-size: 12px;
      color: #334155;
      white-space: nowrap;
    }
  `,
})
export class OrcamentosLista implements OnInit {
  orcamentos: BlingOrcamento[] = [];
  orcamentosFiltrados: BlingOrcamento[] = [];
  carregando = false;
  convertendoId?: number;
  converterOrcamento?: BlingOrcamento;
  followUpOrcamento?: BlingOrcamento;
  historicoOrcamento?: BlingOrcamento;
  desistenciaOrcamento?: BlingOrcamento;
  salvandoFollowUp = false;
  salvandoDesistencia = false;
  erroFollowUp = '';
  erroDesistencia = '';
  sucesso = '';
  erro = '';
  erroConverter = '';
  readonly grid = new GridPaginationState();
  readonly followUpCiclo = ORCAMENTO_FOLLOWUP_CICLO;

  filtroCliente = '';
  filtroSituacao: FiltroSituacao = 'Em aberto';
  filtroValidade: FiltroValidade = '';
  filtroLoja = '';
  filtroFollowUpStatus: FiltroFollowUpStatus = '';
  filtroFollowUpData = '';
  filtroResponsavel = '';
  readonly lojasFiltro = LOJAS_OS_FILTRO;
  readonly responsaveisFiltro = ORCAMENTO_RESPONSAVEIS;
  readonly followUpStatusFiltro: Array<{ id: FiltroFollowUpStatus; label: string }> = [
    { id: '', label: 'Todo follow-up' },
    { id: 'atrasado', label: 'Follow-up atrasado / hoje' },
    { id: 'proximo', label: 'Follow-up a vencer' },
    { id: 'em-dia', label: 'Follow-up em dia' },
    { id: 'sem-data', label: 'Sem data de revisita' },
  ];

  /** Lista aberta; só a criação fica restrita à loja do usuário. */
  get lojaFiltroTravada(): boolean {
    return false;
  }

  readonly situacoes: Array<{ id: FiltroSituacao; label: string }> = [
    { id: 'Em aberto', label: 'Em aberto' },
    { id: '', label: 'Todas as situações' },
    { id: 'Convertido', label: 'Convertido' },
    { id: 'Não realizado', label: 'Não realizado' },
    { id: 'Desistência', label: 'Desistência' },
  ];

  readonly validades: Array<{ id: FiltroValidade; label: string }> = [
    { id: '', label: 'Toda validade' },
    { id: 'normal', label: 'Validade normal' },
    { id: 'a-vencer', label: 'Validade a vencer' },
    { id: 'vencidos', label: 'Validade vencida' },
  ];

  constructor(
    private service: OrcamentosService,
    private prefillOs: OrcamentoOsPrefillService,
    private appAuth: AppAuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  get orcamentosPaginados(): BlingOrcamento[] {
    return this.grid.paginate(this.orcamentosFiltrados);
  }

  get filtrosAtivos(): number {
    let n = 0;
    if (this.filtroCliente.trim()) n += 1;
    if (this.filtroSituacao && this.filtroSituacao !== 'Em aberto') n += 1;
    if (this.filtroValidade) n += 1;
    if (this.filtroLoja) n += 1;
    if (this.filtroFollowUpStatus) n += 1;
    if (this.filtroFollowUpData) n += 1;
    if (this.filtroResponsavel) n += 1;
    return n;
  }

  siglaLoja(o: BlingOrcamento): string {
    return siglaLojaOs(o.lojaOrigem);
  }

  tituloLoja(o: BlingOrcamento): string {
    return labelLojaOs(o.lojaOrigem);
  }

  labelTipoContato(o: BlingOrcamento): string {
    return labelTipoContatoOrcamento(o.tipoContato);
  }

  temRetorno(o: BlingOrcamento): boolean {
    return !!(o.dataRetornoMensagem || (o.justificativaAguardo ?? '').trim());
  }

  classeDataRetorno(o: BlingOrcamento): string {
    const raw = o.dataRetornoMensagem?.slice(0, 10);
    if (!raw) return '';
    const hoje = agoraDataBrasil();
    if (raw < hoje) return 'atrasado';
    if (raw === hoje) return 'hoje';
    return '';
  }

  statusFollowUp(o: BlingOrcamento): StatusFollowUpOrcamento {
    if (!this.emAberto(o)) return 'sem-data';
    return statusFollowUpOrcamento(o.dataFollowUp);
  }

  labelFollowUp(o: BlingOrcamento): string {
    if (this.desistencia(o)) return ORCAMENTO_SITUACAO_DESISTENCIA;
    if (this.naoRealizado(o)) return ORCAMENTO_SITUACAO_NAO_REALIZADO;
    if (this.jaConvertido(o)) return 'Convertido';
    return labelStatusFollowUp(this.statusFollowUp(o));
  }

  /** Bolinha de urgência (mesmo padrão visual da OS). */
  nivelUrgenciaFollowUp(o: BlingOrcamento): string {
    if (!this.emAberto(o)) return 'finalizada';
    switch (this.statusFollowUp(o)) {
      case 'atrasado':
        return 'vermelho';
      case 'proximo':
        return 'laranja';
      case 'em-dia':
        return 'verde';
      default:
        return 'branco';
    }
  }

  tituloUrgenciaFollowUp(o: BlingOrcamento): string {
    if (this.desistencia(o)) return 'Desistência do cliente';
    if (this.naoRealizado(o)) return 'Não realizado após ciclo de follow-ups';
    if (this.jaConvertido(o)) return 'Orçamento convertido em OS';
    const status = this.statusFollowUp(o);
    const data = o.dataFollowUp?.slice(0, 10);
    const dataFmt = data
      ? new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR')
      : '';
    const acao = this.podeRegistrarFollowUp(o)
      ? ' · Clique para registrar follow-up'
      : ' · Clique para editar';
    switch (status) {
      case 'atrasado':
        return (
          (dataFmt
            ? `Follow-up atrasado / no dia · ${dataFmt}`
            : 'Follow-up atrasado') + acao
        );
      case 'proximo':
        return (
          (dataFmt
            ? `Follow-up prestes a vencer · ${dataFmt}`
            : 'Follow-up prestes a vencer') + acao
        );
      case 'em-dia':
        return (
          (dataFmt ? `Follow-up em dia · ${dataFmt}` : 'Follow-up em dia') + acao
        );
      default:
        return 'Sem data de follow-up' + acao;
    }
  }

  followUpAtrasado(o: BlingOrcamento): boolean {
    return this.emAberto(o) && this.statusFollowUp(o) === 'atrasado';
  }

  classeLinhaOrcamento(o: BlingOrcamento): string {
    if (!this.emAberto(o)) return '';
    const s = this.statusFollowUp(o);
    if (s === 'atrasado') return 'orc-row-atrasado';
    if (s === 'proximo') return 'orc-row-proximo';
    return '';
  }

  temHistoricoFollowUp(o: BlingOrcamento): boolean {
    return (o.followUps?.length ?? 0) > 0
      || !!(o.justificativaAguardo ?? '').trim()
      || !!(o.motivoDesistencia ?? '').trim();
  }

  tituloHistoricoFollowUp(o: BlingOrcamento): string {
    const n = this.vezesContato(o);
    const ultima = this.ultimaJustificativa(o);
    if (ultima) {
      return `Ver histórico (${n} contato${n === 1 ? '' : 's'}). Última: ${ultima}`;
    }
    if ((o.justificativaAguardo ?? '').trim()) {
      return 'Ver motivo de aguardo e histórico de follow-ups';
    }
    return 'Ver histórico de follow-ups';
  }

  ultimaJustificativa(o: BlingOrcamento): string {
    const hist = [...(o.followUps ?? [])].sort((a, b) =>
      (b.data ?? '').localeCompare(a.data ?? '') || (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));
    return (hist[0]?.anotacao ?? '').trim();
  }

  podeRegistrarFollowUp(o: BlingOrcamento): boolean {
    return this.emAberto(o) && this.vezesContato(o) < this.followUpCiclo;
  }

  vezesContato(o: BlingOrcamento): number {
    return o.vezesContato ?? o.followUps?.length ?? 0;
  }

  get totalVencidos(): number {
    return this.orcamentos.filter(o => this.vencido(o)).length;
  }

  get totalFollowUpAtrasado(): number {
    return this.orcamentos.filter(o => this.followUpAtrasado(o)).length;
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listar().subscribe({
      next: (dados) => {
        this.orcamentos = dados;
        this.aplicarFiltros();
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar orçamentos.';
        this.carregando = false;
      },
    });
  }

  aplicarFiltros(): void {
    const cliente = this.filtroCliente.trim().toLowerCase();
    const hoje = agoraDataBrasil();

    this.orcamentosFiltrados = this.orcamentos.filter(o => {
      if (cliente) {
        const nome = (o.contato?.nome || '').toLowerCase();
        const numero = (o.numero || '').toLowerCase();
        const aparelho = (
          o.equipamento
          || `${o.marcaNome || ''} ${o.modeloNome || ''}`.trim()
        ).toLowerCase();
        if (!nome.includes(cliente) && !numero.includes(cliente) && !aparelho.includes(cliente)) {
          return false;
        }
      }

      if (this.filtroSituacao === 'Convertido') {
        if (!this.jaConvertido(o)) return false;
      } else if (this.filtroSituacao === 'Não realizado') {
        if (!this.naoRealizado(o)) return false;
      } else if (this.filtroSituacao === 'Desistência') {
        if (!this.desistencia(o)) return false;
      } else if (this.filtroSituacao === 'Em aberto') {
        if (!this.emAberto(o)) return false;
      }

      if (this.filtroValidade === 'vencidos') {
        if (!this.vencido(o, hoje)) return false;
      } else if (this.filtroValidade === 'a-vencer') {
        if (this.statusValidade(o, hoje) !== 'a-vencer') return false;
      } else if (this.filtroValidade === 'normal') {
        if (this.statusValidade(o, hoje) !== 'normal') return false;
      }

      if (this.filtroLoja) {
        if (normalizarLojaOs(o.lojaOrigem) !== normalizarLojaOs(this.filtroLoja)) {
          return false;
        }
      }

      if (this.filtroFollowUpStatus) {
        if (this.statusFollowUp(o) !== this.filtroFollowUpStatus) return false;
      }

      if (this.filtroFollowUpData) {
        const dataFu = (o.dataFollowUp ?? '').slice(0, 10);
        if (dataFu !== this.filtroFollowUpData.slice(0, 10)) return false;
      }

      if (this.filtroResponsavel) {
        if ((o.responsavelOrcamento ?? '').trim() !== this.filtroResponsavel) return false;
      }

      return true;
    });

    // Atrasados de follow-up primeiro (como urgência na OS).
    this.orcamentosFiltrados = [...this.orcamentosFiltrados].sort((a, b) => {
      const rank = (o: BlingOrcamento) => {
        if (!this.emAberto(o)) return 4;
        switch (this.statusFollowUp(o)) {
          case 'atrasado': return 0;
          case 'proximo': return 1;
          case 'em-dia': return 2;
          default: return 3;
        }
      };
      return rank(a) - rank(b);
    });

    this.grid.reset();
  }

  limparFiltros(): void {
    this.filtroCliente = '';
    this.filtroSituacao = 'Em aberto';
    this.filtroValidade = '';
    this.filtroLoja = '';
    this.filtroFollowUpStatus = '';
    this.filtroFollowUpData = '';
    this.filtroResponsavel = '';
    this.aplicarFiltros();
  }

  filtrarVencidos(): void {
    this.filtroValidade = 'vencidos';
    this.filtroSituacao = 'Em aberto';
    this.aplicarFiltros();
  }

  filtrarFollowUpAtrasado(): void {
    this.filtroFollowUpStatus = 'atrasado';
    this.filtroSituacao = 'Em aberto';
    this.aplicarFiltros();
  }

  /** normal | a-vencer | vencido | sem-data */
  statusValidade(o: BlingOrcamento, hoje = agoraDataBrasil()): 'normal' | 'a-vencer' | 'vencido' | 'sem-data' {
    if (!this.emAberto(o)) return 'sem-data';
    const raw = (o.validade ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'sem-data';
    if (raw < hoje) return 'vencido';
    const [y, m, d] = raw.split('-').map(Number);
    const [hy, hm, hd] = hoje.split('-').map(Number);
    const dias = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 86_400_000);
    if (dias <= 2) return 'a-vencer';
    return 'normal';
  }

  novo(): void {
    this.router.navigate(['/orcamentos/novo']);
  }

  editar(id: number): void {
    this.router.navigate(['/orcamentos', id]);
  }

  imprimir(o: BlingOrcamento): void {
    if (!o.id) return;
    this.service.imprimir(o);
  }

  jaConvertido(o: BlingOrcamento): boolean {
    return orcamentoConvertido(o);
  }

  naoRealizado(o: BlingOrcamento): boolean {
    return orcamentoNaoRealizado(o.situacao);
  }

  desistencia(o: BlingOrcamento): boolean {
    return orcamentoDesistencia(o.situacao);
  }

  emAberto(o: BlingOrcamento): boolean {
    return orcamentoEmAberto(o);
  }

  vencido(o: BlingOrcamento, hoje = agoraDataBrasil()): boolean {
    if (!o.validade || !this.emAberto(o)) return false;
    return o.validade.slice(0, 10) < hoje;
  }

  valorExibido(o: BlingOrcamento): number | null | undefined {
    return o.valorTotalAcordado ?? o.valorTotal;
  }

  valorAVista(o: BlingOrcamento): number {
    return Number(o.valorAVista ?? this.valorExibido(o) ?? 0) || 0;
  }

  labelParcelado(o: BlingOrcamento): string {
    const total = Number(o.valorAPrazo ?? this.valorExibido(o) ?? 0) || 0;
    const n = o.parcelasPagamento && o.parcelasPagamento >= 2 ? o.parcelasPagamento : 0;
    const fmt = (v: number) =>
      v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (n >= 2 && total > 0) {
      const parcela = Math.round((total / n) * 100) / 100;
      return `${n}x ${fmt(parcela)}`;
    }
    return total > 0 ? fmt(total) : '—';
  }

  abrirConverter(o: BlingOrcamento): void {
    if (!o.id || !this.emAberto(o) || this.convertendoId) return;
    if (this.vencido(o)) {
      this.erro = 'Orçamento vencido. Abra o cadastro e renove a validade antes de transformar em OS.';
      avisarErroUsuario(this.erro);
      return;
    }
    this.erro = '';
    this.erroConverter = '';
    this.converterOrcamento = o;
  }

  abrirFollowUp(o: BlingOrcamento): void {
    if (!o.id || !this.podeRegistrarFollowUp(o)) return;
    this.erro = '';
    this.sucesso = '';
    this.erroFollowUp = '';
    this.followUpOrcamento = o;
  }

  abrirHistorico(o: BlingOrcamento): void {
    if (!this.temHistoricoFollowUp(o)) return;
    this.historicoOrcamento = o;
  }

  fecharHistorico(): void {
    this.historicoOrcamento = undefined;
  }

  fecharFollowUp(): void {
    if (this.salvandoFollowUp) return;
    this.followUpOrcamento = undefined;
    this.erroFollowUp = '';
  }

  abrirDesistencia(o: BlingOrcamento): void {
    if (!o.id || !this.emAberto(o) || this.salvandoDesistencia) return;
    this.erro = '';
    this.sucesso = '';
    this.erroDesistencia = '';
    this.desistenciaOrcamento = o;
  }

  fecharDesistencia(): void {
    if (this.salvandoDesistencia) return;
    this.desistenciaOrcamento = undefined;
    this.erroDesistencia = '';
  }

  confirmarDesistencia(payload: OrcamentoDesistenciaPayload): void {
    const o = this.desistenciaOrcamento;
    if (!o?.id || this.salvandoDesistencia) return;

    this.salvandoDesistencia = true;
    this.erroDesistencia = '';
    this.service.registrarDesistencia(o.id, { motivo: payload.motivo }).subscribe({
      next: salvo => {
        this.salvandoDesistencia = false;
        const idx = this.orcamentos.findIndex(x => x.id === salvo.id);
        if (idx >= 0) this.orcamentos[idx] = salvo;
        else this.orcamentos = [salvo, ...this.orcamentos];
        this.aplicarFiltros();
        this.desistenciaOrcamento = undefined;
        this.sucesso = `Orçamento #${salvo.numero ?? salvo.id} marcado como Desistência.`;
      },
      error: err => {
        this.salvandoDesistencia = false;
        this.erroDesistencia = err.error?.erro ?? 'Erro ao registrar desistência.';
      },
    });
  }

  confirmarFollowUp(payload: OrcamentoFollowUpModalPayload): void {
    const o = this.followUpOrcamento;
    if (!o?.id || this.salvandoFollowUp) return;

    this.salvandoFollowUp = true;
    this.erroFollowUp = '';
    this.service.registrarFollowUp(o.id, payload).subscribe({
      next: salvo => {
        this.salvandoFollowUp = false;
        const idx = this.orcamentos.findIndex(x => x.id === salvo.id);
        if (idx >= 0) this.orcamentos[idx] = salvo;
        else this.orcamentos = [salvo, ...this.orcamentos];
        this.aplicarFiltros();
        this.followUpOrcamento = undefined;
        const n = salvo.vezesContato ?? salvo.followUps?.length ?? 0;
        this.sucesso = this.naoRealizado(salvo)
          ? `Follow-up #${n} registrado. Orçamento #${salvo.numero ?? salvo.id} marcado como Não realizado.`
          : `Follow-up #${n} registrado. Próxima revisita: ${
              salvo.dataFollowUp
                ? new Date(`${salvo.dataFollowUp.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
                : '—'
            }.`;
      },
      error: err => {
        this.salvandoFollowUp = false;
        this.erroFollowUp = err.error?.erro ?? 'Erro ao registrar follow-up.';
      },
    });
  }

  fecharConverter(): void {
    if (this.convertendoId) return;
    this.converterOrcamento = undefined;
    this.erroConverter = '';
  }

  confirmarConversao(): void {
    const o = this.converterOrcamento;
    if (!o?.id || this.convertendoId) return;

    this.convertendoId = o.id;
    this.erroConverter = '';

    const abrirNovaOs = (orc: BlingOrcamento) => {
      if (orc.id == null) {
        this.convertendoId = undefined;
        this.erroConverter = 'Orçamento sem identificador — não é possível abrir a OS.';
        return;
      }
      this.prefillOs.preparar(orc);
      void this.router.navigate(
        ['/ordens-servico/de-orcamento', orc.id],
        { state: { [ORCAMENTO_OS_PREFILL_STATE_KEY]: orc } },
      ).then(ok => {
        this.convertendoId = undefined;
        if (ok) {
          this.converterOrcamento = undefined;
        } else {
          this.prefillOs.limpar();
          this.erroConverter = 'Não foi possível abrir a tela de nova OS.';
        }
      });
    };

    this.service.obter(o.id).subscribe({
      next: abrirNovaOs,
      error: () => abrirNovaOs(o),
    });
  }

  abrirOs(o: BlingOrcamento): void {
    if (!o.osGeradaBlingId) return;
    this.router.navigate(['/ordens-servico', o.osGeradaBlingId, 'editar']);
  }
}
