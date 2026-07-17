import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  OrdensServicoService,
  OsHistoricoDetalhe,
  OsHistoricoResumo,
} from '../../../services/ordens-servico';
import { BlingOrdemServico } from '../../../models/bling.models';

@Component({
  selector: 'app-os-historico',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './historico.html',
  styleUrl: './historico.scss',
})
export class OsHistoricoPage implements OnInit {
  osId = 0;
  osNumero = '';
  carregando = true;
  carregandoDetalhe = false;
  erro = '';
  versoes: OsHistoricoResumo[] = [];
  selecionada?: OsHistoricoDetalhe;
  snapshot?: BlingOrdemServico | null;

  readonly tz = 'America/Sao_Paulo';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: OrdensServicoService,
  ) {}

  ngOnInit(): void {
    this.osId = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.osId) {
      this.erro = 'OS inválida.';
      this.carregando = false;
      return;
    }
    this.carregarLista();
  }

  rotuloAcao(acao: string): string {
    switch (acao) {
      case 'criar': return 'Criação';
      case 'atualizar': return 'Edição';
      case 'situacao': return 'Situação';
      case 'excluir': return 'Exclusão';
      default: return acao;
    }
  }

  classeAcao(acao: string): string {
    return `acao-${acao || 'outro'}`;
  }

  selecionar(v: OsHistoricoResumo): void {
    this.carregandoDetalhe = true;
    this.erro = '';
    this.service.obterHistoricoVersao(this.osId, v.versao).subscribe({
      next: d => {
        this.selecionada = d;
        this.snapshot = d.snapshot;
        this.osNumero = d.osNumero || String(this.osId);
        this.carregandoDetalhe = false;
      },
      error: () => {
        this.erro = 'Não foi possível carregar a versão.';
        this.carregandoDetalhe = false;
      },
    });
  }

  voltar(): void {
    void this.router.navigate(['/ordens-servico', this.osId]);
  }

  private carregarLista(): void {
    this.carregando = true;
    this.service.listarHistorico(this.osId).subscribe({
      next: lista => {
        this.versoes = lista;
        this.osNumero = lista[0]?.osNumero || String(this.osId);
        this.carregando = false;
        if (lista.length) this.selecionar(lista[0]);
      },
      error: () => {
        this.erro = 'Não foi possível carregar o histórico.';
        this.carregando = false;
      },
    });
  }
}
