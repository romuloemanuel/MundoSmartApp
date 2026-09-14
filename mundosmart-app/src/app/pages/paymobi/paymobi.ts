import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PaymobiBoleto,
  PaymobiCobranca,
  PaymobiConfig,
  PaymobiStatus,
  PaymobiStatusCobranca,
  PaymobiVenda,
  PaymobiVendasService,
  STATUS_COBRANCA,
} from '../../services/paymobi-vendas.service';
import {
  PaymobiCalculoConfig,
  PaymobiCalculoService,
  PaymobiLinhaView,
  PaymobiResumoView,
  PAYMOBI_RESUMO_VAZIO,
} from '../../services/paymobi-calculo.service';
import {
  FILTROS_VAZIOS,
  PaymobiFiltrosEstado,
  PaymobiFiltrosService,
} from '../../services/paymobi-filtros.service';
import { AppAuthService } from '../../services/app-auth';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../services/user-feedback.service';

const STATUS: { id: PaymobiStatus | 'todos' | 'ativos'; rotulo: string }[] = [
  { id: 'ativos', rotulo: 'Contratos ativos' },
  { id: 'aberta', rotulo: 'Em cobrança' },
  { id: 'atrasada', rotulo: 'Atrasada' },
  { id: 'quitada', rotulo: 'Pago (fim do contrato)' },
  { id: 'cancelada', rotulo: 'Cancelado / devolução' },
  { id: 'todos', rotulo: 'Todas' },
];

@Component({
  selector: 'app-paymobi-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './paymobi.html',
  styleUrl: './paymobi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymobiPage implements OnInit {
  readonly statusOpcoes = STATUS;
  readonly statusFormulario = STATUS.filter(s => s.id !== 'todos' && s.id !== 'ativos');
  readonly statusCobrancaOpcoes = STATUS_COBRANCA;
  readonly margemErroLucro = 100;
  readonly percentualLucro = 0.25;
  readonly percentualLucroMinimo = 0.3;
  acrescimoAparelho = 20;

  vendas: PaymobiVenda[] = [];
  linhas: PaymobiLinhaView[] = [];
  linhasVisiveis: PaymobiLinhaView[] = [];
  resumo: PaymobiResumoView = { ...PAYMOBI_RESUMO_VAZIO };
  preview: PaymobiLinhaView | null = null;
  filtros: PaymobiFiltrosEstado = { ...FILTROS_VAZIOS };

  carregando = false;
  salvando = false;
  erro = '';
  editando: PaymobiVenda | null = null;
  abertaId: string | null = null;
  novaCobrancaValor: number | null = null;
  novaCobrancaData = '';
  novaCobrancaObs = '';
  sincronizando = false;
  senhaConfigurada = false;
  ultimaSincronizacao = '';
  ultimoTotalImportado = 0;
  custoChave = 80;
  custoPlataformaMensal = 200;
  painelAtivosAberto = false;
  painelRetornoAberto = false;

  constructor(
    private api: PaymobiVendasService,
    private calculo: PaymobiCalculoService,
    private filtrosApi: PaymobiFiltrosService,
    private cdr: ChangeDetectorRef,
    readonly appAuth: AppAuthService,
  ) {}

  ngOnInit(): void {
    this.carregar();
    this.carregarConfig();
  }

  get filtrosAtivos(): number {
    return this.filtrosApi.contarAtivos(this.filtros);
  }

  get custoAparelhosVisiveis(): number {
    return this.linhasVisiveis.reduce(
      (acc, l) => acc + (l.contaCusto ? l.custoAparelhoTotal : 0),
      0,
    );
  }

  trackLinha(_: number, linha: PaymobiLinhaView): string {
    return linha.venda.id || linha.chaveCliente + linha.venda.aparelhoImei;
  }

  trackBoleto(_: number, b: PaymobiBoleto): string {
    return b.id || `n-${b.numero ?? 0}-${b.vencimento ?? ''}`;
  }

  rotuloBoleto(b: PaymobiBoleto): string {
    return this.calculo.rotuloBoleto(b);
  }

  classeBoleto(b: PaymobiBoleto): string {
    return this.calculo.classeBoleto(b);
  }

  boletoEmErro(b: PaymobiBoleto): boolean {
    return this.calculo.boletoEmErro(b);
  }

  boletoDaLoja(b: PaymobiBoleto): boolean {
    return this.calculo.boletoDaLoja(b);
  }

  get linhaParcelas(): PaymobiLinhaView | null {
    if (!this.abertaId) return null;
    return this.linhas.find(l => l.venda.id === this.abertaId) ?? null;
  }

  @HostListener('document:keydown.escape')
  fecharModalTecla(): void {
    if (this.editando) this.cancelar();
    else if (this.abertaId) this.fecharParcelas();
  }

  moeda(n: number): string {
    return this.calculo.moeda(n);
  }

  dataCurta(iso: string | undefined): string {
    return this.calculo.dataCurta(iso);
  }

  dataHora(iso: string | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return this.calculo.dataCurta(iso);
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  percentual(n: number): string {
    return `${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  alternarPainel(painel: 'ativos' | 'retorno'): void {
    if (painel === 'ativos') this.painelAtivosAberto = !this.painelAtivosAberto;
    else this.painelRetornoAberto = !this.painelRetornoAberto;
    this.cdr.markForCheck();
  }

  aplicarFiltro(): void {
    this.linhasVisiveis = this.filtrosApi.aplicar(this.linhas, this.filtros);
    this.cdr.markForCheck();
  }

  atualizarPreview(): void {
    this.preview = this.editando
      ? this.calculo.preview(this.editando, this.vendas, this.configCalculo())
      : null;
    this.cdr.markForCheck();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.cdr.markForCheck();
    this.api.listar().subscribe({
      next: lista => {
        this.vendas = lista ?? [];
        this.carregando = false;
        this.atualizarPainel();
      },
      error: err => {
        this.carregando = false;
        this.erro = msgApi(err, 'Não foi possível carregar as vendas no boleto.');
        this.cdr.markForCheck();
      },
    });
  }

  carregarConfig(): void {
    this.api.config().subscribe({
      next: cfg => {
        this.senhaConfigurada = !!cfg.senhaConfigurada;
        this.ultimaSincronizacao = cfg.ultimaSincronizacao ?? '';
        this.ultimoTotalImportado = cfg.ultimoTotalImportado ?? 0;
        this.acrescimoAparelho = lerCustoPorAparelho(cfg);
        this.custoChave = Number(cfg.custoFixoAparelho) > 0 ? Number(cfg.custoFixoAparelho) : 80;
        this.custoPlataformaMensal = lerCustoMensal(cfg);
        this.atualizarPainel();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  buscarNaPaymobi(): void {
    if (!this.senhaConfigurada) {
      avisarErroUsuario('Configure o e-mail e a senha da PayMobi em Configurações → Vendas boleto.');
      return;
    }
    this.sincronizando = true;
    this.cdr.markForCheck();
    this.api.sincronizar({ salvarCredenciais: false }).subscribe({
      next: res => {
        this.sincronizando = false;
        this.ultimaSincronizacao = res.sincronizadoEm;
        this.ultimoTotalImportado = res.importadas;
        avisarSucessoUsuario(`${res.importadas} vendas importadas da PayMobi.`);
        this.carregarConfig();
        this.carregar();
      },
      error: err => {
        this.sincronizando = false;
        this.cdr.markForCheck();
        avisarErroUsuario(msgApi(err, 'Não foi possível buscar as vendas na PayMobi.'));
      },
    });
  }

  concretizar(linha: PaymobiLinhaView): void {
    const v = linha.venda;
    if (!v.id) return;
    const custo = Number(v.valorInvestido) || 0;
    this.api.atualizar(v.id, {
      ...v,
      valorInvestido: custo,
      concretizada: true,
      concretizadaEm: v.concretizadaEm || new Date().toISOString(),
    }).subscribe({
      next: atual => {
        this.substituir(atual);
        avisarSucessoUsuario('Venda concretizada. Informe o custo de compra do aparelho; a chave entra à parte.');
      },
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível concretizar a venda.')),
    });
  }

  salvarModeloAparelho(linha: PaymobiLinhaView): void {
    const v = linha.venda;
    if (!v.id) return;
    const modelo = (v.aparelhoModelo ?? '').trim();
    v.aparelhoModelo = modelo;
    this.api.atualizar(v.id, { ...v, aparelhoModelo: modelo }).subscribe({
      next: atual => this.substituir(atual),
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível salvar o modelo do aparelho.')),
    });
  }

  salvarCustoAparelho(linha: PaymobiLinhaView): void {
    const v = linha.venda;
    if (!v.id || !linha.concretizada) return;
    const custo = Number(v.valorInvestido) || 0;
    this.api.atualizar(v.id, {
      ...v,
      valorInvestido: custo,
      concretizada: true,
      concretizadaEm: v.concretizadaEm || new Date().toISOString(),
    }).subscribe({
      next: atual => this.substituir(atual),
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível salvar o custo do aparelho.')),
    });
  }

  salvarDevolucao(linha: PaymobiLinhaView): void {
    const v = linha.venda;
    if (!v.id) return;
    this.api.atualizar(v.id, {
      ...v,
      valorRevenda: Number(v.valorRevenda) || 0,
      custoManutencao: Number(v.custoManutencao) || 0,
      valorBoletosPagos: Number(v.valorBoletosPagos) || 0,
    }).subscribe({
      next: atual => this.substituir(atual),
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível salvar os valores da devolução.')),
    });
  }

  salvarStatusCobranca(linha: PaymobiLinhaView, status: PaymobiStatusCobranca): void {
    const v = linha.venda;
    if (!v.id) return;
    v.statusCobranca = status;
    this.api.atualizar(v.id, { ...v, statusCobranca: status }).subscribe({
      next: atual => this.substituir(atual),
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível salvar o status da cobrança.')),
    });
  }

  nova(): void {
    this.abertaId = null;
    const hoje = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    this.editando = {
      clienteNome: '',
      clienteCpf: '',
      clienteTelefone: '',
      aparelhoMarca: '',
      aparelhoModelo: '',
      aparelhoCor: '',
      aparelhoImei: '',
      valorInvestido: 0,
      custoPlataforma: 0,
      valorVenda: 0,
      parcelas: 0,
      valorParcela: 0,
      dataVenda: `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`,
      status: 'aberta',
      observacoes: '',
      cobrancas: [],
      concretizada: false,
      valorEntrada: 0,
      valorDevido: 0,
      aparelhoBloqueado: false,
      parcelasAtraso: 0,
      statusCobranca: 'ok',
      valorRevenda: 0,
      custoManutencao: 0,
      valorBoletosPagos: 0,
    };
    this.atualizarPreview();
  }

  editar(linha: PaymobiLinhaView): void {
    this.abertaId = null;
    const v = linha.venda;
    this.editando = {
      ...v,
      dataVenda: (v.dataVenda ?? '').slice(0, 10),
      cobrancas: [...(v.cobrancas ?? [])],
      valorInvestido: linha.concretizada ? (Number(v.valorInvestido) || 0) : 0,
      statusCobranca: linha.statusCobranca,
    };
    this.atualizarPreview();
  }

  cancelar(): void {
    this.editando = null;
    this.preview = null;
    this.cdr.markForCheck();
  }

  salvar(): void {
    if (!this.editando) return;
    const body = this.editando;
    if (!body.clienteNome.trim()) {
      avisarErroUsuario('Informe o nome do cliente.');
      return;
    }
    const custo = Number(body.valorInvestido) || 0;
    if (custo > 0) {
      body.concretizada = true;
      body.concretizadaEm = body.concretizadaEm || new Date().toISOString();
    }
    this.salvando = true;
    this.cdr.markForCheck();
    const req = body.id ? this.api.atualizar(body.id, body) : this.api.criar(body);
    req.subscribe({
      next: () => {
        this.salvando = false;
        avisarSucessoUsuario('Venda salva.');
        this.editando = null;
        this.preview = null;
        this.carregar();
      },
      error: err => {
        this.salvando = false;
        this.cdr.markForCheck();
        avisarErroUsuario(msgApi(err, 'Não foi possível salvar.'));
      },
    });
  }

  excluir(linha: PaymobiLinhaView): void {
    const v = linha.venda;
    if (!v.id) return;
    if (!confirm(`Excluir a venda no boleto de ${v.clienteNome}?`)) return;
    this.api.excluir(v.id).subscribe({
      next: () => {
        avisarSucessoUsuario('Venda excluída.');
        if (this.editando?.id === v.id) {
          this.editando = null;
          this.preview = null;
        }
        this.carregar();
      },
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível excluir.')),
    });
  }

  abrirParcelas(linha: PaymobiLinhaView): void {
    this.cancelar();
    this.abertaId = linha.venda.id ?? null;
    this.novaCobrancaValor = null;
    this.novaCobrancaObs = '';
    const hoje = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    this.novaCobrancaData = `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`;
    this.cdr.markForCheck();
  }

  fecharParcelas(): void {
    this.abertaId = null;
    this.cdr.markForCheck();
  }

  confirmarParcelaPaga(linha: PaymobiLinhaView, b: PaymobiBoleto): void {
    const v = linha.venda;
    if (!v.id) return;
    const numero = Number(b.numero) || 0;
    const valor = Number(b.valor);
    if (numero <= 0) {
      avisarErroUsuario('Parcela sem número.');
      return;
    }
    if (!(valor > 0)) {
      avisarErroUsuario('Informe o valor pago nesta parcela.');
      return;
    }
    this.salvando = true;
    this.cdr.markForCheck();
    this.api.confirmarParcelaPaga(v.id, {
      numero,
      valor,
      vencimento: (b.vencimento ?? '').slice(0, 10) || undefined,
      imei: v.aparelhoImei,
    }).subscribe({
      next: atual => {
        this.salvando = false;
        avisarSucessoUsuario(`Parcela ${numero} marcada como paga.`);
        this.substituir(atual);
      },
      error: err => {
        this.salvando = false;
        this.cdr.markForCheck();
        avisarErroUsuario(msgApi(err, 'Não foi possível marcar a parcela como paga.'));
      },
    });
  }

  desfazerParcelaLoja(linha: PaymobiLinhaView, b: PaymobiBoleto): void {
    const v = linha.venda;
    if (!v.id || !b.id) return;
    this.api.removerParcelaManual(v.id, b.id).subscribe({
      next: atual => {
        avisarSucessoUsuario('Pagamento informado na loja removido.');
        this.substituir(atual);
      },
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível desfazer.')),
    });
  }

  registrarCobranca(linha: PaymobiLinhaView): void {
    const v = linha.venda;
    if (!v.id) return;
    const valor = Number(this.novaCobrancaValor);
    if (!(valor > 0)) {
      avisarErroUsuario('Informe o valor recebido.');
      return;
    }
    this.salvando = true;
    this.cdr.markForCheck();
    this.api.adicionarCobranca(v.id, {
      data: this.novaCobrancaData || new Date().toISOString(),
      valor,
      observacao: this.novaCobrancaObs.trim(),
    }).subscribe({
      next: atual => {
        this.salvando = false;
        avisarSucessoUsuario('Cobrança registrada.');
        this.novaCobrancaValor = null;
        this.novaCobrancaObs = '';
        this.substituir(atual);
      },
      error: err => {
        this.salvando = false;
        this.cdr.markForCheck();
        avisarErroUsuario(msgApi(err, 'Não foi possível registrar a cobrança.'));
      },
    });
  }

  removerCobranca(linha: PaymobiLinhaView, c: PaymobiCobranca): void {
    const v = linha.venda;
    if (!v.id || !c.id) return;
    this.api.removerCobranca(v.id, c.id).subscribe({
      next: atual => {
        avisarSucessoUsuario('Cobrança removida.');
        this.substituir(atual);
      },
      error: err => avisarErroUsuario(msgApi(err, 'Não foi possível remover.')),
    });
  }

  limparFiltros(): void {
    this.filtros = { ...FILTROS_VAZIOS };
    this.aplicarFiltro();
  }

  private configCalculo(): PaymobiCalculoConfig {
    return {
      acrescimoAparelho: this.acrescimoAparelho,
      custoChave: this.custoChave,
      custoPlataformaMensal: this.custoPlataformaMensal,
      margemErroLucro: this.margemErroLucro,
      percentualLucro: this.percentualLucro,
      percentualLucroMinimo: this.percentualLucroMinimo,
    };
  }

  private atualizarPainel(): void {
    const painel = this.calculo.montar(this.vendas, this.configCalculo());
    this.linhas = painel.linhas;
    this.resumo = painel.resumo;
    this.aplicarFiltro();
    if (this.editando) this.atualizarPreview();
    else this.cdr.markForCheck();
  }

  private substituir(atual: PaymobiVenda): void {
    this.vendas = this.vendas.map(x => x.id === atual.id ? atual : x);
    if (this.editando?.id === atual.id) {
      this.editando = {
        ...atual,
        dataVenda: (atual.dataVenda ?? '').slice(0, 10),
      };
    }
    this.atualizarPainel();
  }
}

function lerCustoMensal(cfg: PaymobiConfig): number {
  const bruto = cfg.custoPlataformaMensal ?? cfg.custoPlataformaTotal;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? n : 200;
}

function lerCustoPorAparelho(cfg: PaymobiConfig): number {
  const n = Number(cfg.custoPorAparelho);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

function msgApi(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error?.erro ?? err.error?.message ?? '').toString().trim();
    if (msg) return msg;
  }
  return fallback;
}
