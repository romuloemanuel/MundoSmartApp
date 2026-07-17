import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  OrdensServicoService,
  OsHistoricoConsulta,
  OsHistoricoDetalhe,
  OsHistoricoResumo,
} from '../../services/ordens-servico';
import { BlingOrdemServico } from '../../models/bling.models';
import { AppAuthService } from '../../services/app-auth';
import { LOJAS_OS_FILTRO, labelLojaOs } from '../../config/os-loja.config';

@Component({
  selector: 'app-historico-alteracoes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './historico-alteracoes.html',
  styleUrl: './historico-alteracoes.scss',
})
export class HistoricoAlteracoesPage implements OnInit {
  readonly tz = 'America/Sao_Paulo';
  readonly acoes = [
    { id: '', label: 'Todas as ações' },
    { id: 'criar', label: 'Criação' },
    { id: 'atualizar', label: 'Edição' },
    { id: 'situacao', label: 'Situação' },
    { id: 'excluir', label: 'Exclusão' },
  ];

  filtroOs = '';
  filtroAcao = '';
  filtroUsuario = '';
  filtroLoja = '';
  filtroDataInicio = '';
  filtroDataFim = '';
  pagina = 1;
  tamanhoPagina = 30;
  readonly lojasFiltro = LOJAS_OS_FILTRO;

  carregando = false;
  carregandoDetalhe = false;
  erro = '';
  consulta?: OsHistoricoConsulta;
  selecionada?: OsHistoricoDetalhe;
  snapshot?: BlingOrdemServico | null;

  get lojaFiltroTravada(): boolean {
    return this.appAuth.restringeCriacaoPorLoja();
  }

  get rotuloLojaRestrita(): string {
    return labelLojaOs(this.appAuth.lojaPadraoCriacao());
  }

  constructor(
    private service: OrdensServicoService,
    private appAuth: AppAuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.lojaFiltroTravada) {
      this.filtroLoja = this.appAuth.lojaPadraoCriacao();
    }
    this.buscar();
  }

  get totalPaginas(): number {
    if (!this.consulta?.total) return 1;
    return Math.max(1, Math.ceil(this.consulta.total / this.consulta.tamanhoPagina));
  }

  rotuloAcao(acao: string): string {
    switch (acao) {
      case 'criar': return 'Criação';
      case 'atualizar': return 'Edição';
      case 'situacao': return 'Situação';
      case 'excluir': return 'Exclusão';
      default: return acao || '—';
    }
  }

  classeAcao(acao: string): string {
    return `acao-${acao || 'outro'}`;
  }

  buscar(resetPagina = true): void {
    if (resetPagina) this.pagina = 1;
    this.carregando = true;
    this.erro = '';
    this.selecionada = undefined;
    this.snapshot = undefined;

    this.service.consultarHistorico({
      osNumero: this.filtroOs.trim() || undefined,
      acao: this.filtroAcao || undefined,
      usuario: this.filtroUsuario.trim() || undefined,
      lojaOrigem: this.filtroLoja || undefined,
      dataInicio: this.filtroDataInicio || undefined,
      dataFim: this.filtroDataFim || undefined,
      pagina: this.pagina,
      tamanhoPagina: this.tamanhoPagina,
    }).subscribe({
      next: c => {
        this.consulta = c;
        this.carregando = false;
        if (c.itens.length) this.abrirDetalhe(c.itens[0]);
      },
      error: () => {
        this.erro = 'Não foi possível carregar os históricos.';
        this.carregando = false;
      },
    });
  }

  limparFiltros(): void {
    this.filtroOs = '';
    this.filtroAcao = '';
    this.filtroUsuario = '';
    this.filtroLoja = this.lojaFiltroTravada ? this.appAuth.lojaPadraoCriacao() : '';
    this.filtroDataInicio = '';
    this.filtroDataFim = '';
    this.buscar(true);
  }

  paginaAnterior(): void {
    if (this.pagina <= 1) return;
    this.pagina -= 1;
    this.buscar(false);
  }

  proximaPagina(): void {
    if (this.pagina >= this.totalPaginas) return;
    this.pagina += 1;
    this.buscar(false);
  }

  abrirDetalhe(item: OsHistoricoResumo): void {
    this.carregandoDetalhe = true;
    this.service.obterHistoricoVersao(item.osBlingId, item.versao).subscribe({
      next: d => {
        this.selecionada = d;
        this.snapshot = d.snapshot;
        this.carregandoDetalhe = false;
      },
      error: () => {
        this.erro = 'Não foi possível abrir o detalhe da versão.';
        this.carregandoDetalhe = false;
      },
    });
  }

  verTodasDaOs(item: OsHistoricoResumo): void {
    void this.router.navigate(['/ordens-servico', item.osBlingId, 'historico']);
  }

  irParaOs(item: OsHistoricoResumo): void {
    void this.router.navigate(['/ordens-servico', item.osBlingId]);
  }
}
