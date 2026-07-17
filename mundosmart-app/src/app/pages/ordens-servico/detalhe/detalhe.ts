import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OrdensServicoService } from '../../../services/ordens-servico';
import { BlingOrdemServico, BlingOrdemServicoItem } from '../../../models/bling.models';
import { SenhaDispositivoField } from '../../../components/senha-dispositivo-field/senha-dispositivo-field';
import { OsFotosPanel } from '../../../components/os-fotos-panel/os-fotos-panel';
import { labelTipoServicoOs } from '../../../config/os-servico.config';
import { labelPagamentoAcordadoOs } from '../../../config/os-pagamento.config';
import { labelOrigemPeca } from '../../../config/os-peca-origem.config';
import {
  osSituacaoConcluida,
  osSituacaoFinalizada,
  osSituacaoCancelada,
  osSituacaoAguardandoPeca,
  osPrecisaEscolherTecnico,
  situacoesDisponiveisPorLoja,
  ajustarSituacaoParaLoja,
} from '../os-situacao.util';
import { TecnicosService, Tecnico } from '../../../services/tecnicos';
import { TecnicoSelectDialogService } from '../../../services/tecnico-select-dialog';
import { OsSituacaoDialogService } from '../../../services/os-situacao-dialog';

@Component({
  selector: 'app-ordens-servico-detalhe',
  standalone: true,
  imports: [CommonModule, SenhaDispositivoField, OsFotosPanel],
  templateUrl: './detalhe.html',
  styles: ``,
})
export class OrdensServicoDetalhe implements OnInit {
  os: BlingOrdemServico | null = null;
  carregando = false;
  erro = '';
  alterandoSituacao = false;
  private tecnicosAtivos: Tecnico[] = [];

  get situacoes(): string[] {
    return situacoesDisponiveisPorLoja(this.os?.lojaOrigem);
  }
  readonly labelTipoServico = labelTipoServicoOs;
  readonly labelPagamentoAcordado = labelPagamentoAcordadoOs;
  readonly labelOrigemPeca = labelOrigemPeca;

  isItemPeca(item: { tipoItem?: string; pecaId?: string }): boolean {
    return item.tipoItem === 'peca' || !!item.pecaId;
  }

  diferencaPecaServico(item: BlingOrdemServicoItem): number | null {
    const total = item.valorAcontado ?? item.valorUnitario;
    if (total == null || item.custoPeca == null) return null;
    return total - item.custoPeca;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: OrdensServicoService,
    private tecnicosService: TecnicosService,
    private tecnicoDialog: TecnicoSelectDialogService,
    private situacaoDialog: OsSituacaoDialogService,
  ) {}

  ngOnInit(): void {
    this.tecnicosService.listar(true).subscribe({
      next: (lista) => (this.tecnicosAtivos = lista),
      error: () => (this.tecnicosAtivos = []),
    });
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.carregando = true;
      this.service.obter(+id).subscribe({
        next: (os) => {
          this.os = os;
          this.carregando = false;
        },
        error: () => {
          this.erro = 'Erro ao carregar OS.';
          this.carregando = false;
        },
      });
    }
  }

  async alterarSituacao(situacao: string): Promise<void> {
    if (!this.os?.id || this.osConcluida()) return;
    const situacaoAjustada = ajustarSituacaoParaLoja(situacao, this.os.lojaOrigem);
    const osLabel = this.os.numero ? `OS #${this.os.numero}` : `OS #${this.os.id}`;

    if (osSituacaoConcluida(situacaoAjustada) && !osSituacaoConcluida(this.os.situacao)) {
      const ok = await this.situacaoDialog.openConcluir({ osLabel });
      if (!ok) return;
    }

    let motivoCancelamento: string | undefined;
    if (osSituacaoCancelada(situacaoAjustada) && !osSituacaoCancelada(this.os.situacao)) {
      const motivo = await this.situacaoDialog.openCancelar({ osLabel });
      if (!motivo) return;
      motivoCancelamento = motivo;
    }

    let dataPrazoPeca: string | undefined;
    if (osSituacaoAguardandoPeca(situacaoAjustada) && !osSituacaoAguardandoPeca(this.os.situacao)) {
      const prazo = await this.situacaoDialog.openPrazo({ osLabel });
      if (!prazo) return;
      dataPrazoPeca = prazo;
    }

    let tecnicoNome: string | undefined;
    if (osPrecisaEscolherTecnico(situacaoAjustada, this.os.tecnicoNome, this.tecnicosAtivos)) {
      const escolhido = await this.tecnicoDialog.open({
        tecnicos: this.tecnicosAtivos,
        tecnicoAtual: this.os.tecnicoNome,
        situacao: situacaoAjustada,
        osLabel,
      });
      if (!escolhido) return;
      tecnicoNome = escolhido;
    }

    this.alterandoSituacao = true;
    this.service.alterarSituacao(
      this.os.id,
      situacaoAjustada,
      motivoCancelamento,
      dataPrazoPeca,
      tecnicoNome,
    ).subscribe({
      next: () => {
        this.os!.situacao = situacaoAjustada;
        if (motivoCancelamento) this.os!.motivoCancelamento = motivoCancelamento;
        if (dataPrazoPeca) this.os!.dataPrazoPeca = dataPrazoPeca;
        if (tecnicoNome) this.os!.tecnicoNome = tecnicoNome;
        this.alterandoSituacao = false;
        // Recarrega a OS para o estado ficar sincronizado e permitir nova alteração sem “travar”.
        this.service.obter(this.os!.id!).subscribe({
          next: (os) => (this.os = os),
        });
      },
      error: () => (this.alterandoSituacao = false),
    });
  }

  editar(): void {
    this.router.navigate(['/ordens-servico', this.os!.id, 'editar']);
  }

  /** Atualização leve só das fotos (poll do painel). */
  recarregarFotos(): void {
    if (!this.os?.id) return;
    this.service.obter(this.os.id).subscribe({
      next: os => {
        if (!this.os) return;
        const novas = [...(os.fotosAparelho ?? [])];
        const antigas = this.os.fotosAparelho ?? [];
        if (
          novas.length === antigas.length
          && novas.every((f, i) => f.id === antigas[i]?.id && f.categoria === antigas[i]?.categoria)
        ) {
          return;
        }
        this.os = { ...this.os, fotosAparelho: novas };
      },
    });
  }

  recarregar(): void {
    if (!this.os?.id) return;
    this.service.obter(this.os.id).subscribe({
      next: (os) => (this.os = os),
    });
  }

  osConcluida(): boolean {
    return osSituacaoFinalizada(this.os?.situacao);
  }

  voltar(): void {
    this.router.navigate(['/ordens-servico']);
  }
}
