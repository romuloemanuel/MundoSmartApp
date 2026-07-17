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

type FiltroValidade = '' | 'vigentes' | 'vencidos';
type FiltroSituacao = '' | 'Em aberto' | 'Convertido';

@Component({
  selector: 'app-orcamentos-lista',
  standalone: true,
  imports: [CommonModule, FormsModule, GridPaginator, GridAcao, OrcamentoConverterModal],
  templateUrl: './lista.html',
  styles: `
    .orc-vencido { color: #b91c1c; font-weight: 600; }
    .orc-convertido-badge { background: #d1fae5; color: #065f46; }
    .orc-grid-acoes { gap: 8px; }
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
    .filtros-bar .btn-limpar {
      background: #fff;
      border: 1px solid #cbd5e1;
      color: #475569;
    }
    .orc-filtro-resumo {
      font-size: 12px;
      color: #64748b;
      margin: -8px 0 14px;
    }
    .orc-filtro-resumo strong { color: #0f172a; }
    .btn-transformar-os {
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border: 1px solid #2563eb;
      background: #2563eb;
      color: #fff;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-transformar-os:hover:not(:disabled) { background: #1d4ed8; }
    .btn-transformar-os:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-abrir-os {
      font-size: 12px;
      font-weight: 600;
      padding: 6px 10px;
      border: 1px solid #059669;
      background: #ecfdf5;
      color: #047857;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
    }
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
  `,
})
export class OrcamentosLista implements OnInit {
  orcamentos: BlingOrcamento[] = [];
  orcamentosFiltrados: BlingOrcamento[] = [];
  carregando = false;
  convertendoId?: number;
  converterOrcamento?: BlingOrcamento;
  erro = '';
  erroConverter = '';
  readonly grid = new GridPaginationState();

  filtroCliente = '';
  filtroSituacao: FiltroSituacao = '';
  filtroValidade: FiltroValidade = '';
  filtroLoja = '';
  readonly lojasFiltro = LOJAS_OS_FILTRO;

  /** Lista aberta; só a criação fica restrita à loja do usuário. */
  get lojaFiltroTravada(): boolean {
    return false;
  }

  readonly situacoes: Array<{ id: FiltroSituacao; label: string }> = [
    { id: '', label: 'Todas as situações' },
    { id: 'Em aberto', label: 'Em aberto' },
    { id: 'Convertido', label: 'Convertido' },
  ];

  readonly validades: Array<{ id: FiltroValidade; label: string }> = [
    { id: '', label: 'Todas as validades' },
    { id: 'vigentes', label: 'Vigentes' },
    { id: 'vencidos', label: 'Vencidos' },
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
    if (this.filtroSituacao) n += 1;
    if (this.filtroValidade) n += 1;
    if (this.filtroLoja) n += 1;
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

  get totalVencidos(): number {
    return this.orcamentos.filter(o => this.vencido(o)).length;
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
      } else if (this.filtroSituacao === 'Em aberto') {
        if (this.jaConvertido(o)) return false;
      }

      if (this.filtroValidade === 'vencidos') {
        if (!this.vencido(o, hoje)) return false;
      } else if (this.filtroValidade === 'vigentes') {
        // Vigente = não convertido e com validade >= hoje (ou sem validade)
        if (this.jaConvertido(o)) return false;
        if (this.vencido(o, hoje)) return false;
      }

      if (this.filtroLoja) {
        if (normalizarLojaOs(o.lojaOrigem) !== normalizarLojaOs(this.filtroLoja)) {
          return false;
        }
      }

      return true;
    });

    this.grid.reset();
  }

  limparFiltros(): void {
    this.filtroCliente = '';
    this.filtroSituacao = '';
    this.filtroValidade = '';
    this.filtroLoja = '';
    this.aplicarFiltros();
  }

  filtrarVencidos(): void {
    this.filtroValidade = 'vencidos';
    this.filtroSituacao = 'Em aberto';
    this.aplicarFiltros();
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
    return !!o.osGeradaBlingId || o.situacao === 'Convertido';
  }

  vencido(o: BlingOrcamento, hoje = agoraDataBrasil()): boolean {
    if (!o.validade || this.jaConvertido(o)) return false;
    return o.validade.slice(0, 10) < hoje;
  }

  valorExibido(o: BlingOrcamento): number | null | undefined {
    return o.valorTotalAcordado ?? o.valorTotal;
  }

  abrirConverter(o: BlingOrcamento): void {
    if (!o.id || this.jaConvertido(o) || this.convertendoId) return;
    if (this.vencido(o)) {
      this.erro = 'Orçamento vencido. Abra o cadastro e renove a validade antes de transformar em OS.';
      return;
    }
    this.erro = '';
    this.erroConverter = '';
    this.converterOrcamento = o;
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
