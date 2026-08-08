import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { OrcamentosService, ORCAMENTO_VALIDADE_DIAS_UTEIS } from '../../../services/orcamentos';
import { AparelhosService } from '../../../services/aparelhos';
import {
  BlingOrcamento,
  BlingOrcamentoItem,
  BlingContato,
  PecaValorInfo,
  VariacaoServico,
} from '../../../models/bling.models';
import { ClienteAutocomplete } from '../../../components/cliente-autocomplete/cliente-autocomplete';
import { NovoClienteModal } from '../../../components/novo-cliente-modal/novo-cliente-modal';
import { AutocompleteCriavel, AutocompleteItem } from '../../../components/autocomplete-criavel/autocomplete-criavel';
import { modeloParaAutocomplete } from '../../../utils/modelo-autocomplete.util';
import { TIPOS_DISPOSITIVO } from '../../../config/aparelhos.config';
import {
  adicionarDiasUteisBrasil,
  agoraDataBrasil,
} from '../../../utils/horario-brasil.util';
import {
  agruparPecasPorCategoria,
  labelPecaCatalogo,
} from '../../../config/peca-categoria.config';
import {
  ESTOQUE_NIVEL_CLASSES,
  nivelEstoqueDeQuantidade,
} from '../../../config/estoque.config';
import { OrcamentoSalvoModal } from '../../../components/orcamento-salvo-modal/orcamento-salvo-modal';
import { LOJAS_OS, normalizarLojaOs } from '../../../config/os-loja.config';
import { AppAuthService } from '../../../services/app-auth';
import { AcrescimoEstoqueConfigService } from '../../../services/acrescimo-estoque-config.service';
import {
  ORCAMENTO_TIPOS_CONTATO,
  normalizarTipoContatoOrcamento,
} from '../../../config/orcamento-contato.config';
import {
  ORCAMENTO_FOLLOWUP_CICLO,
  ORCAMENTO_RESPONSAVEIS,
  orcamentoConvertido,
  orcamentoNaoRealizado,
} from '../../../config/orcamento-followup.config';

@Component({
  selector: 'app-orcamentos-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ClienteAutocomplete,
    NovoClienteModal,
    AutocompleteCriavel,
    OrcamentoSalvoModal,
  ],
  templateUrl: './form.html',
  styles: `
    .orc-hint { font-size: 13px; color: #64748b; margin: 0 0 16px; }
    .orc-form-readonly { opacity: 0.95; }
    .orc-servicos-ref {
      margin: 12px 0 16px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .orc-servicos-cabeca {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
    }
    .orc-servicos-cabeca h4 { margin: 0; font-size: 13px; }
    .orc-servicos-lista {
      max-height: 280px;
      overflow: auto;
      padding-right: 4px;
    }
    .orc-cat-grupo { margin-bottom: 12px; }
    .orc-cat-titulo {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .4px;
      color: #64748b;
      margin: 0 0 6px;
      position: sticky;
      top: 0;
      background: #f8fafc;
      padding: 2px 0;
      z-index: 1;
    }
    .orc-servico-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 8px;
      padding: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }
    .orc-servico-topo {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
    }
    .orc-servico-topo strong { font-size: 13px; color: #0f172a; }
    .orc-servico-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
    .orc-estoque-badge {
      display: inline-block;
      margin-top: 4px;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 999px;
    }
    .orc-estoque-badge.estoque-nivel-verde { background: #dcfce7; color: #166534; }
    .orc-estoque-badge.estoque-nivel-amarelo { background: #fef9c3; color: #854d0e; }
    .orc-estoque-badge.estoque-nivel-laranja { background: #ffedd5; color: #9a3412; }
    .orc-estoque-badge.estoque-nivel-vermelho { background: #fee2e2; color: #991b1b; }
    .orc-cores-ref {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .orc-cor-chip {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
    }
    .orc-servico-vars { display: flex; flex-wrap: wrap; gap: 6px; }
    .orc-estoque-cel { font-size: 12px; white-space: nowrap; }
    .orc-servico-btn {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      text-align: left;
      max-width: 260px;
      font-size: 12px;
      color: #0f172a;
    }
    .orc-servico-btn:hover { border-color: #2563eb; background: #eff6ff; }
    .orc-servico-btn span { font-size: 11px; color: #64748b; }
    .orc-itens-wrap { overflow-x: auto; margin-bottom: 8px; }
    .orc-itens-grid input { max-width: 100%; box-sizing: border-box; }
    .orc-pagamento { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .orc-pagamento-titulo { margin: 0 0 4px; font-size: 14px; color: #0f172a; }
    .orc-pagamento-ops {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-top: 6px;
    }
    .orc-pagamento-ops label { display: flex; gap: 6px; align-items: center; }
    .orc-pag-resumo {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: stretch;
      margin-top: 12px;
    }
    .orc-pag-chip {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 160px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #fff;
    }
    .orc-pag-chip span { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .orc-pag-chip strong { font-size: 15px; color: #0f172a; }
    .orc-pag-chip.avista { border-color: #bbf7d0; background: #f0fdf4; }
    .orc-pag-chip.prazo { border-color: #bfdbfe; background: #eff6ff; }
    .orc-pag-chip.garantia { border-color: #fde68a; background: #fffbeb; }
    .orc-convertido {
      padding: 10px 12px;
      margin-bottom: 14px;
      border-radius: 8px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      font-size: 13px;
    }
    .orc-nao-realizado {
      padding: 10px 12px;
      margin-bottom: 14px;
      border-radius: 8px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      font-size: 13px;
    }
    .badge-catalogo, .badge-livre {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .3px;
      padding: 2px 6px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .badge-catalogo { background: #dbeafe; color: #1e40af; }
    .badge-livre { background: #f1f5f9; color: #475569; }
    .orc-itens-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .orc-add-catalogo { margin-top: 10px; max-width: 420px; }
    .orc-form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .btn-salvar {
      background: #2563eb !important;
      color: #fff !important;
      border-color: #2563eb !important;
    }
    .orc-followup-box {
      margin: 12px 0 16px;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
    }
    .orc-followup-box h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: #0f172a;
    }
    .orc-followup-meta {
      font-size: 12px;
      color: #475569;
      margin: 0 0 10px;
    }
    .orc-followup-meta strong { color: #0f172a; }
    .orc-followup-hist {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      max-height: 180px;
      overflow: auto;
    }
    .orc-followup-hist li {
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      margin-bottom: 6px;
      font-size: 12px;
      color: #334155;
    }
    .orc-followup-hist .fu-cabeca {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .orc-contatos-view {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      min-height: 36px;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f1f5f9;
      color: #64748b;
      font-size: 14px;
      box-sizing: border-box;
      user-select: none;
      pointer-events: none;
    }
    .orc-contatos-view strong {
      color: #0f172a;
      font-size: 16px;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class OrcamentosForm implements OnInit {
  orcamento: BlingOrcamento = {
    itens: [],
    parcelasPagamento: 2,
    garantiaMeses: 3,
    vezesContato: 0,
    followUps: [],
  };
  editando = false;
  salvando = false;
  erro = '';
  modalNovoClienteAberto = false;
  modalSalvoAberto = false;
  orcamentoSalvo?: BlingOrcamento;
  imprimindo = false;
  tipoDispositivo = 'Celular';
  readonly tiposDispositivo = TIPOS_DISPOSITIVO;
  readonly validadeDiasUteis = ORCAMENTO_VALIDADE_DIAS_UTEIS;
  readonly garantiaMesesPadrao = 3;
  readonly lojasOs = LOJAS_OS;
  readonly tiposContato = ORCAMENTO_TIPOS_CONTATO;
  readonly responsaveis = ORCAMENTO_RESPONSAVEIS;
  readonly followUpCiclo = ORCAMENTO_FOLLOWUP_CICLO;
  pecasDisponiveis: PecaValorInfo[] = [];
  gruposServicos: { categoria: string; pecas: PecaValorInfo[] }[] = [];
  carregandoPecas = false;
  mostrarBuscaCatalogo = false;

  /** Valor de cada parcela (espelha total ÷ qtd; editável). */
  valorParcelaEditavel: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: OrcamentosService,
    private aparelhosService: AparelhosService,
    private appAuth: AppAuthService,
    private acrescimoEstoque: AcrescimoEstoqueConfigService,
  ) {}

  /** Assistência vinculada: campo travado (só Admin/Root escolhe livremente). */
  get lojaCriacaoTravada(): boolean {
    return !!this.appAuth?.restringeCriacaoPorLoja();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'novo') {
      this.editando = true;
      this.service.obter(+id).subscribe({
        next: (o) => {
          this.aplicarOrcamentoCarregado(o);
          this.sincronizarValorAcordado(false);
          if (o.modeloId) this.carregarServicosModelo(o.modeloId);
        },
        error: () => (this.erro = 'Erro ao carregar orçamento.'),
      });
      return;
    }

    this.orcamento = {
      itens: [],
      parcelasPagamento: 2,
      garantiaMeses: this.garantiaMesesPadrao,
      lojaOrigem: this.appAuth.lojaPadraoCriacao(),
      tipoContato: 'whatsapp_internet',
      data: agoraDataBrasil(),
      validade: adicionarDiasUteisBrasil(ORCAMENTO_VALIDADE_DIAS_UTEIS),
      situacao: 'Em aberto',
      vezesContato: 0,
      followUps: [],
    };
  }

  private aplicarOrcamentoCarregado(o: BlingOrcamento): void {
    this.orcamento = {
      ...o,
      itens: o.itens ?? [],
      followUps: o.followUps ?? [],
      vezesContato: o.vezesContato ?? o.followUps?.length ?? 0,
      lojaOrigem: normalizarLojaOs(o.lojaOrigem),
      tipoContato: normalizarTipoContatoOrcamento(o.tipoContato),
      justificativaAguardo: o.justificativaAguardo ?? '',
      dataRetornoMensagem: o.dataRetornoMensagem?.slice(0, 10),
      dataFollowUp: o.dataFollowUp?.slice(0, 10),
      validade: o.validade?.slice(0, 10),
      data: o.data?.slice(0, 10),
      parcelasPagamento: o.parcelasPagamento && o.parcelasPagamento >= 2
        ? o.parcelasPagamento
        : 2,
      garantiaMeses: o.garantiaMeses && o.garantiaMeses > 0
        ? o.garantiaMeses
        : this.garantiaMesesPadrao,
    };
    this.sincronizarValorParcelaEditavel();
  }

  get vezesContatoExibido(): number {
    return this.orcamento.vezesContato ?? this.orcamento.followUps?.length ?? 0;
  }

  get historicoFollowUps(): NonNullable<BlingOrcamento['followUps']> {
    return [...(this.orcamento.followUps ?? [])].sort((a, b) =>
      (b.data ?? '').localeCompare(a.data ?? '') || (b.criadoEm ?? '').localeCompare(a.criadoEm ?? ''));
  }

  get mensagemCicloFollowUp(): string {
    const n = this.vezesContatoExibido;
    if (n < this.followUpCiclo - 1) {
      return `Follow-ups feitos: ${n} de ${this.followUpCiclo}. No ${this.followUpCiclo}º o orçamento será Não realizado.`;
    }
    if (n === this.followUpCiclo - 1) {
      return `Próximo follow-up (${this.followUpCiclo}º) encerra o orçamento como Não realizado.`;
    }
    return `Ciclo de ${this.followUpCiclo} follow-ups concluído — status Não realizado.`;
  }

  get jaConvertido(): boolean {
    return orcamentoConvertido(this.orcamento) || orcamentoNaoRealizado(this.orcamento.situacao);
  }

  get orcamentoNaoRealizado(): boolean {
    return orcamentoNaoRealizado(this.orcamento.situacao);
  }

  get orcamentoConvertidoOs(): boolean {
    return orcamentoConvertido(this.orcamento);
  }

  get valorInicialModelo(): string {
    return this.orcamento.modeloNome || '';
  }

  get totalItens(): number {
    return (this.orcamento.itens ?? []).reduce((acc, item) => {
      const unit = Number(item.valorAcontado ?? item.valorUnitario ?? 0) || 0;
      const qtd = Number(item.quantidade) > 0 ? Number(item.quantidade) : 1;
      const desc = Math.min(100, Math.max(0, Number(item.desconto) || 0));
      return acc + qtd * unit * (1 - desc / 100);
    }, 0);
  }

  get totalItensLabel(): string {
    return this.totalItens.toFixed(2);
  }

  get valorAcordadoExibido(): number {
    return this.totalItens;
  }

  trackItem(index: number): number {
    return index;
  }

  get valorParcela(): number | null {
    const n = this.orcamento.parcelasPagamento;
    if (!n || n < 2) return null;
    const base = Number(this.orcamento.valorAPrazo ?? this.valorAcordadoExibido) || 0;
    return Math.round((base / n) * 100) / 100;
  }

  get resumoParcelado(): string {
    const n = this.orcamento.parcelasPagamento;
    const parc = this.valorParcela;
    if (!n || n < 2 || parc == null) return '';
    const total = Number(this.orcamento.valorAPrazo ?? this.valorAcordadoExibido) || 0;
    return `${n}x de ${parc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (total ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
  }

  private sincronizarValorParcelaEditavel(): void {
    this.valorParcelaEditavel = this.valorParcela;
  }

  onValorAPrazoChange(): void {
    this.onOpcaoPagamentoChange();
    this.sincronizarValorParcelaEditavel();
  }

  onParcelasChange(): void {
    this.onOpcaoPagamentoChange();
    this.sincronizarValorParcelaEditavel();
  }

  onValorParcelaChange(valor: number | string | null): void {
    const n = Math.max(2, Number(this.orcamento.parcelasPagamento) || 2);
    this.orcamento.parcelasPagamento = n;
    const parcela = Number(valor);
    if (!Number.isFinite(parcela) || parcela < 0) return;
    this.valorParcelaEditavel = parcela;
    this.orcamento.valorAPrazo = Math.round(parcela * n * 100) / 100;
    this.onOpcaoPagamentoChange();
  }

  buscarModelosFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhosService.buscarModelos(termo, undefined, this.tipoDispositivo).pipe(
      map(ms => ms.map(modeloParaAutocomplete)),
    );

  buscarServicosCatalogoFn = (termo: string): Observable<AutocompleteItem[]> => {
    const t = termo.trim().toLowerCase();
    const lista = this.pecasDisponiveis
      .map(p => ({
        id: p.pecaId,
        nome: labelPecaCatalogo(p.nome, p.categoria, p.marcaPeca),
        extra: this.metaServico(p),
      }))
      .filter(p =>
        !t
        || p.nome.toLowerCase().includes(t)
        || (p.extra ?? '').toLowerCase().includes(t),
      );
    return of(lista.slice(0, 30));
  };

  onClienteSelecionado(cliente: BlingContato | null): void {
    if (this.jaConvertido) return;
    if (!cliente?.id) {
      this.orcamento.contato = undefined;
      return;
    }
    this.orcamento.contato = {
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      celular: cliente.celular,
    };
  }

  onClienteCriado(cliente: BlingContato): void {
    this.modalNovoClienteAberto = false;
    this.onClienteSelecionado(cliente);
  }

  onModeloSelecionado(item: AutocompleteItem | null): void {
    if (this.jaConvertido) return;
    if (!item?.id) {
      this.orcamento.modeloId = undefined;
      this.orcamento.modeloNome = undefined;
      this.orcamento.marcaId = undefined;
      this.orcamento.marcaNome = undefined;
      this.orcamento.equipamento = undefined;
      this.pecasDisponiveis = [];
      this.gruposServicos = [];
      this.mostrarBuscaCatalogo = false;
      return;
    }
    this.orcamento.modeloId = String(item.id);
    this.orcamento.modeloNome = item.nome;
    this.orcamento.marcaId = item.marcaId;
    this.orcamento.marcaNome = item.marcaNome;
    this.orcamento.equipamento = [item.marcaNome, item.nome].filter(Boolean).join(' ');
    this.carregarServicosModelo(this.orcamento.modeloId);
  }

  private carregarServicosModelo(modeloId: string): void {
    this.carregandoPecas = true;
    this.aparelhosService.consultarServicosValores(modeloId).subscribe({
      next: (res) => {
        this.pecasDisponiveis = res?.pecas ?? [];
        this.gruposServicos = agruparPecasPorCategoria(this.pecasDisponiveis);
        this.carregandoPecas = false;
      },
      error: () => {
        this.pecasDisponiveis = [];
        this.gruposServicos = [];
        this.carregandoPecas = false;
      },
    });
  }

  metaServico(peca: PecaValorInfo): string {
    const loja = this.orcamento.lojaOrigem;
    const min = this.acrescimoEstoque.aplicarNoSugerido(peca.valorSugeridoMinimo, loja);
    const sug = this.acrescimoEstoque.aplicarNoSugerido(peca.valorSugeridoTroca, loja);
    const qtd = peca.quantidadeEstoque ?? 0;
    const partes = [
      min != null ? `mín ${this.formatarMoeda(min)}` : null,
      sug != null ? `sug ${this.formatarMoeda(sug)}` : null,
      `${qtd} em estoque`,
      peca.garantia ? peca.garantia : null,
    ].filter(Boolean);
    return partes.join(' · ');
  }

  classeEstoque(peca: PecaValorInfo): string {
    const nivel = nivelEstoqueDeQuantidade(peca.quantidadeEstoque ?? 0, peca.nivelEstoque);
    return ESTOQUE_NIVEL_CLASSES[nivel];
  }

  rotuloEstoque(peca: PecaValorInfo): string {
    const qtd = peca.quantidadeEstoque ?? 0;
    return qtd > 0 ? `${qtd} em estoque` : 'Sem estoque';
  }

  estoqueDoItem(item: BlingOrcamentoItem): PecaValorInfo | undefined {
    if (!item.pecaId) return undefined;
    return this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
  }

  temVariacoes(peca: PecaValorInfo): boolean {
    return (peca.variacoes?.length ?? 0) > 0;
  }

  variacoesOrdenadas(peca: PecaValorInfo): VariacaoServico[] {
    return [...(peca.variacoes ?? [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  adicionarServicoCatalogo(peca: PecaValorInfo, variacao?: VariacaoServico): void {
    const loja = this.orcamento.lojaOrigem;
    const min = this.acrescimoEstoque.aplicarNoSugerido(
      variacao?.valorSugeridoMinimo ?? peca.valorSugeridoMinimo,
      loja,
    );
    const sug = this.acrescimoEstoque.aplicarNoSugerido(
      variacao?.valorSugeridoTroca ?? peca.valorSugeridoTroca,
      loja,
    );
    const valor = sug ?? min ?? 0;
    const base = labelPecaCatalogo(peca.nome, peca.categoria, peca.marcaPeca);
    const descricao = variacao?.rotulo ? `${base} — ${variacao.rotulo}` : base;

    this.adicionarItem({
      descricao,
      quantidade: 1,
      valorUnitario: valor,
      valorAcontado: valor,
      tipoItem: 'servico',
      pecaId: peca.pecaId,
      variacaoRotulo: variacao?.rotulo,
      valorSugeridoMinimo: min,
      valorSugeridoTroca: sug,
    });
  }

  onCatalogoAutocomplete(sel: AutocompleteItem | null): void {
    if (!sel?.id) return;
    const peca = this.pecasDisponiveis.find(p => p.pecaId === sel.id);
    if (!peca) return;
    // Se houver variações, adiciona a primeira (usuário pode refinar pelos botões do catálogo).
    if (this.temVariacoes(peca)) {
      this.adicionarServicoCatalogo(peca, this.variacoesOrdenadas(peca)[0]);
    } else {
      this.adicionarServicoCatalogo(peca);
    }
    this.mostrarBuscaCatalogo = false;
  }

  itemDoCatalogo(item: BlingOrcamentoItem): boolean {
    return !!item.pecaId;
  }

  adicionarItem(parcial?: Partial<BlingOrcamentoItem>): void {
    this.orcamento.itens = this.orcamento.itens ?? [];
    this.orcamento.itens.push({
      descricao: '',
      quantidade: 1,
      valorUnitario: 0,
      valorAcontado: 0,
      tipoItem: 'servico',
      ...parcial,
    });
    this.sincronizarValorAcordado();
  }

  removerItem(index: number): void {
    this.orcamento.itens?.splice(index, 1);
    this.sincronizarValorAcordado();
  }

  onValorLinhaChange(item: BlingOrcamentoItem): void {
    item.valorUnitario = item.valorAcontado ?? item.valorUnitario ?? 0;
    this.sincronizarValorAcordado();
  }

  onLojaOrigemChange(loja: string): void {
    if (this.lojaCriacaoTravada || this.jaConvertido) return;
    this.orcamento.lojaOrigem = normalizarLojaOs(loja);
    this.reaplicarAcrescimoEstoqueNosItens();
  }

  onJustificativaAguardoChange(texto: string): void {
    if (!(texto ?? '').trim()) {
      this.orcamento.dataRetornoMensagem = undefined;
    }
  }

  get temJustificativaAguardo(): boolean {
    return !!(this.orcamento.justificativaAguardo ?? '').trim();
  }

  private reaplicarAcrescimoEstoqueNosItens(): void {
    const loja = this.orcamento.lojaOrigem;
    for (const item of this.orcamento.itens ?? []) {
      if (!item.pecaId) continue;
      const peca = this.estoqueDoItem(item);
      if (!peca) continue;
      const variacao = item.variacaoRotulo
        ? peca.variacoes?.find(v => v.rotulo === item.variacaoRotulo)
        : undefined;
      const min = this.acrescimoEstoque.aplicarNoSugerido(
        variacao?.valorSugeridoMinimo ?? peca.valorSugeridoMinimo,
        loja,
      );
      const sug = this.acrescimoEstoque.aplicarNoSugerido(
        variacao?.valorSugeridoTroca ?? peca.valorSugeridoTroca,
        loja,
      );
      item.valorSugeridoMinimo = min;
      item.valorSugeridoTroca = sug;
      const valor = sug ?? min ?? 0;
      item.valorAcontado = valor;
      item.valorUnitario = valor;
    }
    this.sincronizarValorAcordado();
  }

  /**
   * Valor combinado = soma dos valores desejados.
   * À vista / a prazo acompanham a soma enquanto estiverem vazios ou iguais ao combinado anterior.
   */
  sincronizarValorAcordado(forcarOpcoes = false): void {
    const soma = this.totalItens;
    const previo = this.orcamento.valorTotalAcordado;
    const syncOpcao = (atual?: number | null): number | undefined => {
      if (forcarOpcoes) return soma || undefined;
      if (atual == null || atual === 0) return soma || undefined;
      if (previo != null && Math.abs(atual - previo) < 0.005) return soma || undefined;
      return atual;
    };

    this.orcamento.valorAVista = syncOpcao(this.orcamento.valorAVista);
    this.orcamento.valorAPrazo = syncOpcao(this.orcamento.valorAPrazo);
    this.orcamento.valorTotalAcordado = soma || undefined;
    if (!this.orcamento.parcelasPagamento || this.orcamento.parcelasPagamento < 2) {
      this.orcamento.parcelasPagamento = 2;
    }
    this.sincronizarValorParcelaEditavel();
  }

  onOpcaoPagamentoChange(): void {
    // Mantém edição livre; parcelas sempre disponíveis.
    if (!this.orcamento.parcelasPagamento || this.orcamento.parcelasPagamento < 2) {
      this.orcamento.parcelasPagamento = 2;
    }
  }

  formatarMoeda(valor?: number | null): string {
    if (valor == null) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private montarPayload(): BlingOrcamento {
    this.sincronizarValorAcordado();
    const valorAcordado = Number(this.totalItens) || 0;
    const aVista = Number(this.orcamento.valorAVista ?? valorAcordado) || 0;
    const aPrazo = Number(this.orcamento.valorAPrazo ?? valorAcordado) || 0;
    const parcelas = Math.max(2, Number(this.orcamento.parcelasPagamento) || 2);
    return {
      ...this.orcamento,
      tipoContato: normalizarTipoContatoOrcamento(this.orcamento.tipoContato),
      justificativaAguardo: (this.orcamento.justificativaAguardo ?? '').trim() || undefined,
      dataRetornoMensagem: (this.orcamento.justificativaAguardo ?? '').trim()
        ? (this.orcamento.dataRetornoMensagem || undefined)
        : undefined,
      responsavelOrcamento: (this.orcamento.responsavelOrcamento ?? '').trim() || undefined,
      dataFollowUp: this.orcamento.dataFollowUp || undefined,
      vezesContato: this.orcamento.followUps?.length ?? this.orcamento.vezesContato ?? 0,
      followUps: this.orcamento.followUps ?? [],
      valorTotalAcordado: valorAcordado,
      valorTotal: valorAcordado,
      valorAVista: aVista,
      valorAPrazo: aPrazo,
      parcelasPagamento: parcelas,
      garantiaMeses: Math.max(1, Number(this.orcamento.garantiaMeses) || this.garantiaMesesPadrao),
      formaPagamento: undefined,
      validade: this.orcamento.validade || adicionarDiasUteisBrasil(ORCAMENTO_VALIDADE_DIAS_UTEIS),
      itens: (this.orcamento.itens ?? []).map(i => {
        const unit = Number(i.valorAcontado ?? i.valorUnitario ?? 0) || 0;
        const qtd = Number(i.quantidade) > 0 ? Number(i.quantidade) : 1;
        return {
          descricao: (i.descricao || '').trim() || 'Serviço',
          quantidade: qtd,
          valorUnitario: unit,
          valorAcontado: unit,
          desconto: i.desconto,
          pecaId: i.pecaId,
          variacaoRotulo: i.variacaoRotulo,
          valorSugeridoMinimo: i.valorSugeridoMinimo,
          valorSugeridoTroca: i.valorSugeridoTroca,
          // Pré-orçamento: sempre serviço — pecaId só referencia o catálogo.
          tipoItem: 'servico',
        };
      }),
    };
  }

  salvar(): void {
    if (this.jaConvertido || this.salvando) return;
    if (!this.orcamento.contato?.id) {
      this.erro = 'Informe o cliente.';
      return;
    }
    if (!(this.orcamento.responsavelOrcamento ?? '').trim()) {
      this.erro = 'Informe quem fez o orçamento.';
      return;
    }
    if (!(Number(this.orcamento.valorAVista) > 0) && !(Number(this.valorAcordadoExibido) > 0)) {
      this.erro = 'Informe o valor à vista.';
      return;
    }
    if (!(Number(this.orcamento.valorAPrazo) > 0) && !(Number(this.valorAcordadoExibido) > 0)) {
      this.erro = 'Informe o valor parcelado combinado.';
      return;
    }
    if (!(this.orcamento.itens?.length)) {
      this.erro = 'Inclua ao menos um serviço com valor.';
      return;
    }

    this.salvando = true;
    this.erro = '';

    const payload = this.montarPayload();
    const op = this.editando
      ? this.service.atualizar(this.orcamento.id!, payload)
      : this.service.criar(payload);

    op.subscribe({
      next: (salvo) => {
        this.salvando = false;
        this.editando = true;
        this.aplicarOrcamentoCarregado(salvo);
        this.sincronizarValorAcordado(false);
        this.orcamentoSalvo = { ...this.orcamento };
        this.modalSalvoAberto = true;
        // Mantém a URL correta após o primeiro cadastro.
        if (salvo.id) {
          void this.router.navigate(['/orcamentos', salvo.id], { replaceUrl: true });
        }
      },
      error: (err) => {
        this.erro = err?.error?.erro
          ?? err?.error?.message
          ?? err?.message
          ?? 'Erro ao salvar orçamento.';
        this.salvando = false;
      },
    });
  }

  imprimirAposSalvar(): void {
    if (!this.orcamentoSalvo?.id) return;
    this.imprimindo = true;
    this.service.imprimir(this.orcamentoSalvo);
    setTimeout(() => { this.imprimindo = false; }, 800);
  }

  novoOrcamentoAposSalvar(): void {
    this.modalSalvoAberto = false;
    this.orcamentoSalvo = undefined;
    this.tipoDispositivo = 'Celular';
    this.orcamento = {
      itens: [],
      parcelasPagamento: 2,
      garantiaMeses: this.garantiaMesesPadrao,
      lojaOrigem: this.appAuth.lojaPadraoCriacao(),
      tipoContato: 'whatsapp_internet',
      vezesContato: 0,
      followUps: [],
      data: agoraDataBrasil(),
      validade: adicionarDiasUteisBrasil(ORCAMENTO_VALIDADE_DIAS_UTEIS),
      situacao: 'Em aberto',
    };
    this.editando = false;
    this.pecasDisponiveis = [];
    this.gruposServicos = [];
    this.mostrarBuscaCatalogo = false;
    this.erro = '';
    void this.router.navigate(['/orcamentos/novo'], { replaceUrl: true });
  }

  irParaListaAposSalvar(): void {
    this.modalSalvoAberto = false;
    this.orcamentoSalvo = undefined;
    void this.router.navigate(['/orcamentos']);
  }

  cancelar(): void {
    this.router.navigate(['/orcamentos']);
  }

  abrirOsGerada(): void {
    if (!this.orcamento.osGeradaBlingId) return;
    this.router.navigate(['/ordens-servico', this.orcamento.osGeradaBlingId, 'editar']);
  }
}
