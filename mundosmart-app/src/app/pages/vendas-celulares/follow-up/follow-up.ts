import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import {
  ORCAMENTO_FOLLOWUP_CICLO,
  ORCAMENTO_RESPONSAVEIS,
  labelStatusFollowUp,
  statusFollowUpOrcamento,
  sugerirDataFollowUp,
  diasUteisProximoFollowUp,
  StatusFollowUpOrcamento,
} from '../../../config/orcamento-followup.config';
import { AppAuthService } from '../../../services/app-auth';
import { extrairMensagemErroHttp } from '../../../services/error-alert.service';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import {
  FollowUpCelular,
  FollowUpCelularService,
  InteresseCelular,
  SalvarFollowUpCelular,
} from '../../../services/followup-celular.service';

type FiltroStatus = '' | StatusFollowUpOrcamento;
type OrdenacaoCampo =
  | 'urgencia'
  | 'cliente'
  | 'interesse'
  | 'responsavel'
  | 'situacao'
  | 'revisitar'
  | 'contatos';

interface FormCadastro {
  clienteNome: string;
  telefone: string;
  interesse: InteresseCelular | '';
  aparelhoDesejado: string;
  aparelhoCliente: string;
  valorEstimado: number | null;
  observacao: string;
  responsavel: string;
  dataFollowUp: string;
}

@Component({
  selector: 'app-follow-up-celulares',
  standalone: true,
  imports: [CommonModule, FormsModule, GridPaginator, GridAcao],
  templateUrl: './follow-up.html',
  styleUrl: './follow-up.scss',
})
export class FollowUpCelularesPage implements OnInit {
  readonly ciclo = ORCAMENTO_FOLLOWUP_CICLO;
  readonly responsaveis = ORCAMENTO_RESPONSAVEIS;
  readonly interesses: Array<{ id: InteresseCelular; label: string }> = [
    { id: 'troca', label: 'Troca' },
    { id: 'compra', label: 'Compra' },
    { id: 'compra_boleto', label: 'Compra no boleto' },
  ];
  readonly situacoes = [
    { id: '', label: 'Toda situação' },
    { id: 'Em aberto', label: 'Em aberto' },
    { id: 'Convertido', label: 'Convertido' },
    { id: 'Não realizado', label: 'Não realizado' },
    { id: 'Desistência', label: 'Desistência' },
  ];
  readonly statusFiltro: Array<{ id: FiltroStatus; label: string }> = [
    { id: '', label: 'Todo follow-up' },
    { id: 'atrasado', label: 'Hoje / atrasado' },
    { id: 'proximo', label: 'Prestes a vencer' },
    { id: 'em-dia', label: 'Em dia' },
    { id: 'sem-data', label: 'Sem data' },
  ];

  readonly grid = new GridPaginationState();

  itens: FollowUpCelular[] = [];
  carregando = true;
  erro = '';
  sucesso = '';

  filtroTexto = '';
  filtroInteresse = '';
  filtroSituacao = '';
  filtroStatus: FiltroStatus = '';
  filtroData = '';
  filtroResponsavel = '';

  ordenacaoCampo: OrdenacaoCampo = 'urgencia';
  ordenacaoDir: 'asc' | 'desc' = 'asc';

  cadastroAberto = false;
  editando: FollowUpCelular | null = null;
  form: FormCadastro = this.formVazio();
  salvandoCadastro = false;
  erroCadastro = '';

  followUpAlvo: FollowUpCelular | null = null;
  anotacao = '';
  responsavelContato = '';
  proximaData = '';
  salvandoFollowUp = false;
  erroFollowUp = '';

  desistenciaAlvo: FollowUpCelular | null = null;
  motivoDesistencia = '';
  salvandoDesistencia = false;
  erroDesistencia = '';

  converterAlvo: FollowUpCelular | null = null;
  observacaoConversao = '';
  salvandoConversao = false;
  erroConversao = '';

  historicoAlvo: FollowUpCelular | null = null;

  constructor(
    private service: FollowUpCelularService,
    private auth: AppAuthService,
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  get filtrados(): FollowUpCelular[] {
    const q = this.filtroTexto.trim().toLowerCase();
    const lista = this.itens.filter(item => {
      if (q) {
        const blob = [
          item.numero,
          item.clienteNome,
          item.telefone,
          item.aparelhoDesejado,
          item.aparelhoCliente,
          item.observacao,
        ].join(' ').toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (this.filtroInteresse && item.interesse !== this.filtroInteresse) return false;
      if (this.filtroSituacao && item.situacao !== this.filtroSituacao) return false;
      if (this.filtroResponsavel && (item.responsavel ?? '') !== this.filtroResponsavel) return false;
      if (this.filtroStatus && (!this.emAberto(item) || this.status(item) !== this.filtroStatus)) return false;
      if (this.filtroData && (item.dataFollowUp ?? '').slice(0, 10) !== this.filtroData) return false;
      return true;
    });
    return this.ordenarLista(lista);
  }

  get pagina(): FollowUpCelular[] {
    return this.grid.paginate(this.filtrados);
  }

  get filtrosAtivos(): number {
    return [
      this.filtroTexto,
      this.filtroInteresse,
      this.filtroSituacao,
      this.filtroStatus,
      this.filtroData,
      this.filtroResponsavel,
    ].filter(v => !!v).length;
  }

  get totalAtrasado(): number {
    return this.itens.filter(item => this.emAberto(item) && this.status(item) === 'atrasado').length;
  }

  get diasUteisFollowUp(): number {
    const vezes = this.followUpAlvo
      ? (this.followUpAlvo.vezesContato ?? this.followUpAlvo.followUps?.length ?? 0)
      : 0;
    return diasUteisProximoFollowUp(vezes + 1);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listar().subscribe({
      next: lista => {
        this.itens = lista ?? [];
        this.carregando = false;
      },
      error: err => {
        this.carregando = false;
        this.erro = extrairMensagemErroHttp(err, 'Não foi possível carregar os follow-ups.');
      },
    });
  }

  aplicarFiltros(): void {
    this.grid.reset();
  }

  limparFiltros(): void {
    this.filtroTexto = '';
    this.filtroInteresse = '';
    this.filtroSituacao = '';
    this.filtroStatus = '';
    this.filtroData = '';
    this.filtroResponsavel = '';
    this.grid.reset();
  }

  filtrarAtrasados(): void {
    this.filtroStatus = this.filtroStatus === 'atrasado' ? '' : 'atrasado';
    if (this.filtroStatus) this.filtroSituacao = 'Em aberto';
    this.grid.reset();
  }

  ordenar(campo: OrdenacaoCampo): void {
    if (this.ordenacaoCampo === campo) {
      this.ordenacaoDir = this.ordenacaoDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordenacaoCampo = campo;
      this.ordenacaoDir = 'asc';
    }
  }

  colunaOrdenada(campo: OrdenacaoCampo): boolean {
    return this.ordenacaoCampo === campo;
  }

  iconeOrdenacao(campo: OrdenacaoCampo): string {
    if (this.ordenacaoCampo !== campo) return '↕';
    return this.ordenacaoDir === 'asc' ? '↑' : '↓';
  }

  abrirNovo(): void {
    this.editando = null;
    this.form = this.formVazio();
    this.form.responsavel = this.responsavelLogado();
    this.form.dataFollowUp = sugerirDataFollowUp(1);
    this.erroCadastro = '';
    this.cadastroAberto = true;
  }

  abrirEdicao(item: FollowUpCelular): void {
    this.editando = item;
    this.form = {
      clienteNome: item.clienteNome,
      telefone: item.telefone,
      interesse: this.interesseValido(item.interesse) ? item.interesse : '',
      aparelhoDesejado: item.aparelhoDesejado ?? '',
      aparelhoCliente: item.aparelhoCliente ?? '',
      valorEstimado: item.valorEstimado ?? null,
      observacao: item.observacao ?? '',
      responsavel: item.responsavel ?? '',
      dataFollowUp: (item.dataFollowUp ?? '').slice(0, 10),
    };
    this.erroCadastro = '';
    this.cadastroAberto = true;
  }

  fecharCadastro(): void {
    if (this.salvandoCadastro) return;
    this.cadastroAberto = false;
  }

  salvarCadastro(): void {
    const body = this.corpoCadastro();
    if (!body) return;
    this.salvandoCadastro = true;
    this.erroCadastro = '';
    const req = this.editando
      ? this.service.atualizar(this.editando.id, body)
      : this.service.criar(body);
    req.subscribe({
      next: salvo => {
        this.substituir(salvo);
        this.salvandoCadastro = false;
        this.cadastroAberto = false;
        this.sucesso = this.editando
          ? `Follow-up de ${salvo.clienteNome} atualizado.`
          : `${salvo.clienteNome} entrou no follow-up.`;
        avisarSucessoUsuario(this.sucesso);
      },
      error: err => {
        this.salvandoCadastro = false;
        this.erroCadastro = extrairMensagemErroHttp(err, 'Não foi possível salvar.');
      },
    });
  }

  abrirFollowUp(item: FollowUpCelular): void {
    this.followUpAlvo = item;
    this.anotacao = '';
    this.responsavelContato = item.responsavel || this.responsavelLogado();
    const vezes = item.vezesContato ?? item.followUps?.length ?? 0;
    this.proximaData = sugerirDataFollowUp(vezes + 1);
    this.erroFollowUp = '';
  }

  fecharFollowUp(): void {
    if (this.salvandoFollowUp) return;
    this.followUpAlvo = null;
  }

  confirmarFollowUp(): void {
    const alvo = this.followUpAlvo;
    if (!alvo) return;
    const anotacao = this.anotacao.trim();
    const responsavel = this.responsavelContato.trim();
    if (!responsavel) {
      this.erroFollowUp = 'Informe quem fez o contato.';
      avisarErroUsuario(this.erroFollowUp);
      return;
    }
    if (!anotacao) {
      this.erroFollowUp = 'Informe a justificativa / anotação.';
      avisarErroUsuario(this.erroFollowUp);
      return;
    }
    const vezes = alvo.vezesContato ?? alvo.followUps?.length ?? 0;
    this.salvandoFollowUp = true;
    this.erroFollowUp = '';
    this.service.registrarFollowUp(alvo.id, {
      anotacao,
      responsavel,
      dataFollowUpProxima: vezes + 1 >= this.ciclo ? undefined : (this.proximaData || undefined),
    }).subscribe({
      next: salvo => {
        this.substituir(salvo);
        this.salvandoFollowUp = false;
        this.followUpAlvo = null;
        this.sucesso = salvo.situacao === 'Não realizado'
          ? `${salvo.clienteNome} completou os 3 contatos e ficou como Não realizado.`
          : `Contato com ${salvo.clienteNome} registrado.`;
        avisarSucessoUsuario(this.sucesso);
      },
      error: err => {
        this.salvandoFollowUp = false;
        this.erroFollowUp = extrairMensagemErroHttp(err, 'Não foi possível registrar o follow-up.');
      },
    });
  }

  abrirDesistencia(item: FollowUpCelular): void {
    this.desistenciaAlvo = item;
    this.motivoDesistencia = '';
    this.erroDesistencia = '';
  }

  fecharDesistencia(): void {
    if (this.salvandoDesistencia) return;
    this.desistenciaAlvo = null;
  }

  confirmarDesistencia(): void {
    const alvo = this.desistenciaAlvo;
    if (!alvo) return;
    const motivo = this.motivoDesistencia.trim();
    if (!motivo) {
      this.erroDesistencia = 'Informe o motivo da desistência.';
      avisarErroUsuario(this.erroDesistencia);
      return;
    }
    this.salvandoDesistencia = true;
    this.erroDesistencia = '';
    this.service.registrarDesistencia(alvo.id, motivo).subscribe({
      next: salvo => {
        this.substituir(salvo);
        this.salvandoDesistencia = false;
        this.desistenciaAlvo = null;
        this.sucesso = `${salvo.clienteNome} marcado como desistência.`;
        avisarSucessoUsuario(this.sucesso);
      },
      error: err => {
        this.salvandoDesistencia = false;
        this.erroDesistencia = extrairMensagemErroHttp(err, 'Não foi possível registrar a desistência.');
      },
    });
  }

  abrirConverter(item: FollowUpCelular): void {
    this.converterAlvo = item;
    this.observacaoConversao = '';
    this.erroConversao = '';
  }

  fecharConverter(): void {
    if (this.salvandoConversao) return;
    this.converterAlvo = null;
  }

  confirmarConverter(): void {
    const alvo = this.converterAlvo;
    if (!alvo) return;
    this.salvandoConversao = true;
    this.erroConversao = '';
    this.service.converter(alvo.id, this.observacaoConversao.trim() || undefined).subscribe({
      next: salvo => {
        this.substituir(salvo);
        this.salvandoConversao = false;
        this.converterAlvo = null;
        this.sucesso = `${salvo.clienteNome} convertido: comprou ou trocou.`;
        avisarSucessoUsuario(this.sucesso);
      },
      error: err => {
        this.salvandoConversao = false;
        this.erroConversao = extrairMensagemErroHttp(err, 'Não foi possível converter.');
      },
    });
  }

  abrirHistorico(item: FollowUpCelular): void {
    this.historicoAlvo = item;
  }

  fecharHistorico(): void {
    this.historicoAlvo = null;
  }

  emAberto(item: FollowUpCelular): boolean {
    return (item.situacao ?? '').trim() === 'Em aberto';
  }

  podeFollowUp(item: FollowUpCelular): boolean {
    const vezes = item.vezesContato ?? item.followUps?.length ?? 0;
    return this.emAberto(item) && vezes < this.ciclo;
  }

  status(item: FollowUpCelular): StatusFollowUpOrcamento {
    return statusFollowUpOrcamento(item.dataFollowUp);
  }

  labelFollowUp(item: FollowUpCelular): string {
    return labelStatusFollowUp(this.status(item));
  }

  labelInteresse(item: FollowUpCelular): string {
    return this.interesses.find(i => i.id === item.interesse)?.label ?? item.interesse;
  }

  vezes(item: FollowUpCelular): number {
    return item.vezesContato ?? item.followUps?.length ?? 0;
  }

  historico(item: FollowUpCelular) {
    return [...(item.followUps ?? [])].sort((a, b) =>
      (b.data ?? '').localeCompare(a.data ?? '') || (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));
  }

  temHistorico(item: FollowUpCelular): boolean {
    return this.vezes(item) > 0 || !!item.observacao || !!item.motivoDesistencia || !!item.observacaoConversao;
  }

  tituloUrgencia(item: FollowUpCelular): string {
    if (!this.emAberto(item)) return item.situacao;
    const data = (item.dataFollowUp ?? '').slice(0, 10);
    const acao = this.podeFollowUp(item) ? ' · Clique para registrar follow-up' : '';
    if (this.status(item) === 'sem-data') return 'Sem data de follow-up' + acao;
    return `${this.labelFollowUp(item)}${data ? ' · ' + this.formatarData(data) : ''}${acao}`;
  }

  nivelUrgencia(item: FollowUpCelular): string {
    if (!this.emAberto(item)) return 'finalizada';
    switch (this.status(item)) {
      case 'atrasado': return 'vermelho';
      case 'proximo': return 'laranja';
      case 'em-dia': return 'verde';
      default: return 'branco';
    }
  }

  whatsapp(telefone: string): string | null {
    const digitos = (telefone ?? '').replace(/\D/g, '');
    if (digitos.length < 10) return null;
    const comDdi = digitos.startsWith('55') ? digitos : `55${digitos}`;
    return `https://wa.me/${comDdi}`;
  }

  private formVazio(): FormCadastro {
    return {
      clienteNome: '',
      telefone: '',
      interesse: '',
      aparelhoDesejado: '',
      aparelhoCliente: '',
      valorEstimado: null,
      observacao: '',
      responsavel: '',
      dataFollowUp: '',
    };
  }

  private corpoCadastro(): SalvarFollowUpCelular | null {
    const clienteNome = this.form.clienteNome.trim();
    const telefone = this.form.telefone.trim();
    const digitos = telefone.replace(/\D/g, '');
    const interesse = this.form.interesse;
    const aparelhoDesejado = this.form.aparelhoDesejado.trim();
    const aparelhoCliente = this.form.aparelhoCliente.trim();
    const responsavel = this.form.responsavel.trim();

    if (!clienteNome) {
      this.erroCadastro = 'Informe o nome do cliente.';
    } else if (digitos.length < 8) {
      this.erroCadastro = 'Informe o telefone do cliente.';
    } else if (!interesse) {
      this.erroCadastro = 'Informe se é troca, compra ou compra no boleto.';
    } else if (interesse === 'troca' && !aparelhoCliente) {
      this.erroCadastro = 'Na troca, informe o aparelho do cliente.';
    } else if (interesse !== 'troca' && !aparelhoDesejado) {
      this.erroCadastro = 'Informe o aparelho que o cliente quer comprar.';
    } else if (!responsavel) {
      this.erroCadastro = 'Informe quem está acompanhando o cliente.';
    } else {
      this.erroCadastro = '';
    }

    if (this.erroCadastro) {
      avisarErroUsuario(this.erroCadastro);
      return null;
    }

    return {
      clienteNome,
      telefone,
      interesse: interesse as InteresseCelular,
      aparelhoDesejado: aparelhoDesejado || undefined,
      aparelhoCliente: aparelhoCliente || undefined,
      valorEstimado: this.form.valorEstimado && this.form.valorEstimado > 0
        ? this.form.valorEstimado
        : null,
      observacao: this.form.observacao.trim() || undefined,
      responsavel,
      dataFollowUp: this.form.dataFollowUp || undefined,
    };
  }

  private substituir(salvo: FollowUpCelular): void {
    const idx = this.itens.findIndex(item => item.id === salvo.id);
    if (idx >= 0) this.itens[idx] = salvo;
    else this.itens = [salvo, ...this.itens];
    if (this.historicoAlvo?.id === salvo.id) this.historicoAlvo = salvo;
  }

  private ordenarLista(lista: FollowUpCelular[]): FollowUpCelular[] {
    const dir = this.ordenacaoDir === 'asc' ? 1 : -1;
    const campo = this.ordenacaoCampo;
    return [...lista].sort((a, b) => {
      const cmp = this.comparar(a, b, campo);
      if (cmp !== 0) return cmp * dir;
      return (b.numero ?? 0) - (a.numero ?? 0);
    });
  }

  private comparar(a: FollowUpCelular, b: FollowUpCelular, campo: OrdenacaoCampo): number {
    switch (campo) {
      case 'cliente':
        return a.clienteNome.localeCompare(b.clienteNome, 'pt-BR');
      case 'interesse':
        return this.labelInteresse(a).localeCompare(this.labelInteresse(b), 'pt-BR');
      case 'responsavel':
        return (a.responsavel ?? '').localeCompare(b.responsavel ?? '', 'pt-BR');
      case 'situacao':
        return (a.situacao ?? '').localeCompare(b.situacao ?? '', 'pt-BR');
      case 'revisitar':
        return (a.dataFollowUp ?? '').slice(0, 10).localeCompare((b.dataFollowUp ?? '').slice(0, 10));
      case 'contatos':
        return this.vezes(a) - this.vezes(b);
      default:
        return this.rank(a) - this.rank(b)
          || (a.dataFollowUp ?? '').slice(0, 10).localeCompare((b.dataFollowUp ?? '').slice(0, 10));
    }
  }

  private rank(item: FollowUpCelular): number {
    if (!this.emAberto(item)) return 5;
    switch (this.status(item)) {
      case 'atrasado': return 0;
      case 'sem-data': return 1;
      case 'proximo': return 2;
      default: return 3;
    }
  }

  private responsavelLogado(): string {
    const nome = semAcento(this.auth.usuario()?.nome ?? '');
    return this.responsaveis.find(r => semAcento(r) === nome) ?? '';
  }

  private interesseValido(valor: string): valor is InteresseCelular {
    return valor === 'troca' || valor === 'compra' || valor === 'compra_boleto';
  }

  private formatarData(iso: string): string {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }
}

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}
