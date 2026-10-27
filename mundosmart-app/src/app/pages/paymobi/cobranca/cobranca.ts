import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import {
  PaymobiCobrancaAcao,
  PaymobiCobrancaItem,
  PaymobiCobrancaLista,
  PaymobiCobrancaResumo,
  PaymobiTipoCobranca,
  PaymobiVendasService,
  TIPOS_COBRANCA,
} from '../../../services/paymobi-vendas.service';
import { abrirWhatsapp, podeEnviarWhatsapp } from '../../../utils/whatsapp.util';

const RESUMO_VAZIO: PaymobiCobrancaResumo = {
  contratos: 0,
  acaoHoje: 0,
  alertaHoje: 0,
  cobrancaHoje: 0,
  soneca: 0,
  naoCobrar: 0,
  atrasados: 0,
  pendenteEnvio: 0,
};

const ROTULO_ACAO: Record<string, string> = {
  alerta_vencimento: 'Alerta de vencimento',
  cobranca: 'Cobrança',
  soneca: 'Soneca',
  limpar_soneca: 'Soneca removida',
  nao_cobrar: 'Não cobrar mais',
  retomar_cobranca: 'Cobrança retomada',
  status: 'Status',
};

@Component({
  selector: 'app-paymobi-cobranca',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, GridPaginator],
  templateUrl: './cobranca.html',
  styleUrl: './cobranca.scss',
})
export class PaymobiCobrancaPage implements OnInit {
  readonly tipos = TIPOS_COBRANCA;
  readonly grid = new GridPaginationState();
  itens: PaymobiCobrancaItem[] = [];
  resumo: PaymobiCobrancaResumo = { ...RESUMO_VAZIO };
  carregando = false;
  erro = '';
  termo = '';
  fila = 'todos';
  tipoFiltro = '';
  historico: PaymobiCobrancaItem | null = null;
  sonecaItem: PaymobiCobrancaItem | null = null;
  sonecaData = '';
  sonecaObs = '';
  salvandoId = '';

  constructor(private api: PaymobiVendasService) {}

  ngOnInit(): void {
    this.carregar();
  }

  get visiveis(): PaymobiCobrancaItem[] {
    return this.grid.paginate(this.itens);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.api.cobranca({
      fila: this.fila === 'todos' ? undefined : this.fila,
      tipo: this.tipoFiltro || undefined,
      termo: this.termo,
    }).subscribe({
      next: (lista: PaymobiCobrancaLista) => {
        this.itens = lista.itens ?? [];
        this.resumo = lista.resumo ?? { ...RESUMO_VAZIO };
        this.grid.reset();
        this.carregando = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível carregar a cobrança.';
        avisarErroUsuario(this.erro);
      },
    });
  }

  aplicarFiltro(): void {
    this.carregar();
  }

  limparFiltros(): void {
    this.termo = '';
    this.fila = 'todos';
    this.tipoFiltro = '';
    this.carregar();
  }

  alterarTipo(item: PaymobiCobrancaItem, tipo: PaymobiTipoCobranca | ''): void {
    this.patch(item, { tipoCobranca: tipo || '' });
  }

  alterarNaoCobrar(item: PaymobiCobrancaItem, valor: boolean): void {
    this.patch(item, { naoCobrarMais: valor });
  }

  abrirSoneca(item: PaymobiCobrancaItem): void {
    this.sonecaItem = item;
    this.sonecaData = this.isoData(item.sonecaAte) || this.hojeIso();
    this.sonecaObs = '';
  }

  salvarSoneca(): void {
    if (!this.sonecaItem) return;
    if (!this.sonecaData) {
      avisarErroUsuario('Informe a data em que a cobrança deve voltar.');
      return;
    }
    const id = this.sonecaItem.id;
    this.sonecaItem = null;
    this.patchPorId(id, {
      sonecaAte: this.sonecaData,
      observacao: this.sonecaObs.trim() || undefined,
    }, 'Soneca salva. A cobrança fica pausada até essa data.');
  }

  limparSoneca(item: PaymobiCobrancaItem): void {
    this.patch(item, { limparSoneca: true }, 'Soneca removida.');
  }

  enviarWhatsapp(item: PaymobiCobrancaItem): void {
    const msg = (item.mensagemSugerida ?? '').trim();
    if (!podeEnviarWhatsapp(item.clienteTelefone)) {
      avisarErroUsuario('Informe um celular com DDD (9 após o DDD) neste contrato.');
      return;
    }
    if (!msg) {
      avisarErroUsuario('Não há mensagem sugerida para este contrato.');
      return;
    }
    if (!abrirWhatsapp(item.clienteTelefone, msg)) {
      avisarErroUsuario('Não foi possível abrir o WhatsApp.');
      return;
    }
    const tipo = item.filaAlerta ? 'alerta_vencimento' : 'cobranca';
    this.salvandoId = item.id;
    this.api.registrarAcaoCobranca(item.id, { tipo, enviada: true, observacao: msg }).subscribe({
      next: (atual: PaymobiCobrancaItem) => {
        this.substituir(atual);
        this.salvandoId = '';
        avisarSucessoUsuario(tipo === 'alerta_vencimento' ? 'Alerta registrado.' : 'Cobrança registrada.');
      },
      error: (err: { error?: { erro?: string } }) => {
        this.salvandoId = '';
        avisarErroUsuario(err?.error?.erro || 'WhatsApp aberto, mas não deu para registrar a ação.');
      },
    });
  }

  abrirHistorico(item: PaymobiCobrancaItem): void {
    this.historico = item;
  }

  fecharHistorico(): void {
    this.historico = null;
  }

  get historicoInteracoes(): PaymobiCobrancaAcao[] {
    const acoes = this.historico?.acoes ?? [];
    return [...acoes].sort((a, b) => (b.em ?? '').localeCompare(a.em ?? ''));
  }

  numeroInteracao(indice: number): number {
    return this.historicoInteracoes.length - indice;
  }

  rotuloAcao(tipo?: string): string {
    return ROTULO_ACAO[tipo ?? ''] || tipo || 'Interação';
  }

  classeAcao(tipo?: string): string {
    switch (tipo) {
      case 'alerta_vencimento': return 'alerta';
      case 'cobranca': return 'cobranca';
      case 'soneca': return 'soneca';
      case 'limpar_soneca':
      case 'retomar_cobranca': return 'retomar';
      case 'nao_cobrar': return 'pausa';
      default: return 'status';
    }
  }

  rotuloModo(modo?: string): string {
    const m = (modo ?? '').trim().toLowerCase();
    if (m === 'auto' || m === 'automatico' || m === 'automático') return 'Automático';
    return 'Manual';
  }

  canalInteracao(acao: PaymobiCobrancaAcao): string {
    return acao.enviada ? 'WhatsApp enviado' : 'Registro interno';
  }

  textoInteracao(acao: PaymobiCobrancaAcao): string {
    const obs = (acao.observacao ?? '').trim();
    if (obs) return obs;
    if (acao.enviada && acao.tipo === 'alerta_vencimento') {
      return 'Alerta de vencimento enviado pelo WhatsApp.';
    }
    if (acao.enviada && acao.tipo === 'cobranca') {
      return 'Cobrança enviada pelo WhatsApp.';
    }
    return 'Interação registrada neste contrato.';
  }

  trackAcao(_i: number, acao: PaymobiCobrancaAcao): string {
    return acao.id || `${acao.em}-${acao.tipo}`;
  }

  dataCurta(iso?: string): string {
    if (!iso) return '—';
    const d = iso.slice(0, 10);
    const [a, m, dia] = d.split('-');
    return a && m && dia ? `${dia}/${m}/${a}` : iso;
  }

  moeda(n?: number): string {
    return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  trackItem(_i: number, item: PaymobiCobrancaItem): string {
    return item.id;
  }

  private patch(
    item: PaymobiCobrancaItem,
    body: Parameters<PaymobiVendasService['atualizarGestaoCobranca']>[1],
    ok?: string,
  ): void {
    this.patchPorId(item.id, body, ok);
  }

  private patchPorId(
    id: string,
    body: Parameters<PaymobiVendasService['atualizarGestaoCobranca']>[1],
    ok?: string,
  ): void {
    this.salvandoId = id;
    this.api.atualizarGestaoCobranca(id, body).subscribe({
      next: (atual: PaymobiCobrancaItem) => {
        this.substituir(atual);
        this.salvandoId = '';
        if (ok) avisarSucessoUsuario(ok);
      },
      error: (err: { error?: { erro?: string } }) => {
        this.salvandoId = '';
        this.carregar();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível atualizar a cobrança.');
      },
    });
  }

  private substituir(atual: PaymobiCobrancaItem): void {
    this.itens = this.itens.map(x => x.id === atual.id ? atual : x);
    if (this.historico?.id === atual.id) this.historico = atual;
    if (this.sonecaItem?.id === atual.id) this.sonecaItem = atual;
    this.api.cobrancaResumo().subscribe({
      next: (resumo: PaymobiCobrancaResumo) => { this.resumo = resumo; },
      error: () => { /* a grade já foi atualizada */ },
    });
  }

  private isoData(iso?: string): string {
    return iso ? iso.slice(0, 10) : '';
  }

  private hojeIso(): string {
    const n = new Date();
    const p = (v: number) => String(v).padStart(2, '0');
    return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
  }
}
