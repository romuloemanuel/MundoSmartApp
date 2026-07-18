import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { combineLatest, Observable, of, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { OrdensServicoService } from '../../../services/ordens-servico';
import { AparelhosService } from '../../../services/aparelhos';
import { ClientesService } from '../../../services/clientes';
import { EstoqueService } from '../../../services/estoque';
import {
  BlingOrdemServico, BlingContato, BlingOrdemServicoItem, BlingOrcamento,
  CorEstoqueModelo, ModeloAparelho, PecaValorInfo, VariacaoServico,
} from '../../../models/bling.models';
import { OrcamentosService } from '../../../services/orcamentos';
import {
  ORCAMENTO_OS_PREFILL_STATE_KEY,
  OrcamentoOsPrefillService,
} from '../../../services/orcamento-os-prefill.service';
import { ClienteAutocomplete } from '../../../components/cliente-autocomplete/cliente-autocomplete';
import { NovoClienteModal } from '../../../components/novo-cliente-modal/novo-cliente-modal';
import { AutocompleteCriavel, AutocompleteItem } from '../../../components/autocomplete-criavel/autocomplete-criavel';
import { modeloParaAutocomplete } from '../../../utils/modelo-autocomplete.util';
import { PesquisaOsModal } from '../../../components/pesquisa-os-modal/pesquisa-os-modal';
import { ModeloReferenciaPanel } from '../../../components/modelo-referencia-panel/modelo-referencia-panel';
import { CadastroAparelhoModal } from '../../../components/cadastro-aparelho-modal/cadastro-aparelho-modal';
import { ContatoAlternativoModal } from '../../../components/contato-alternativo-modal/contato-alternativo-modal';
import { SenhaDispositivoField, SenhaDispositivoTipo } from '../../../components/senha-dispositivo-field/senha-dispositivo-field';
import { OsIntakeModal } from '../../../components/os-intake-modal/os-intake-modal';
import { OsFotosPanel } from '../../../components/os-fotos-panel/os-fotos-panel';
import { TIPOS_DISPOSITIVO } from '../../../config/aparelhos.config';
import { TIPOS_SERVICO_OS, obterTipoServicoOs, labelTipoServicoOs } from '../../../config/os-servico.config';
import {
  formaPagamentoPermiteParcelas,
  normalizarFormaPagamentoOs,
} from '../../../config/os-pagamento.config';
import {
  FORNECEDORES_EXTERNOS_PECA,
  ORIGENS_PECA_OS,
  fornecedorPermiteRastreio,
  labelOrigemPeca,
} from '../../../config/os-peca-origem.config';
import {
  ajustarSituacaoParaLoja,
  situacaoPadraoPorLoja,
  situacoesDisponiveisPorLoja,
  osSituacaoAguardandoPeca,
  osSituacaoExigeTecnico,
  osPrecisaEscolherTecnico,
  prazoPecaPadraoDatetimeLocal,
  PRAZO_AGUARDANDO_PECA_DIAS_PADRAO,
  SITUACAO_OS_AGUARDANDO_CLIENTE,
} from '../../../config/os-situacao.config';
import {
  LOJA_OS_PADRAO,
  LOJAS_OS,
  normalizarLojaOs,
} from '../../../config/os-loja.config';
import {
  osSituacaoConcluida,
  osSituacaoCancelada,
} from '../os-situacao.util';
import { TecnicosService, Tecnico } from '../../../services/tecnicos';
import { TecnicoSelectDialogService } from '../../../services/tecnico-select-dialog';
import { OsSituacaoDialogService } from '../../../services/os-situacao-dialog';
import { OsImpressaoService } from '../../../services/os-impressao.service';
import { AppAuthService } from '../../../services/app-auth';
import {
  OS_IMPRESSAO_OPCOES_POS_CADASTRO,
  OS_IMPRESSAO_PADRAO_POS_CADASTRO,
  OsImpressaoTipoHtml,
} from '../../../config/os-impressao.config';
import { agruparPecasPorCategoria, categoriaUsaCoresPorModelo, labelPecaCatalogo } from '../../../config/peca-categoria.config';
import { agoraDatetimeLocalBrasil, formatarDatetimeLocalBrasil } from '../../../utils/horario-brasil.util';
import { AcrescimoEstoqueConfigService } from '../../../services/acrescimo-estoque-config.service';

type ContatoAlternativoOpcao = {
  indice: number;
  nome: string;
  telefone?: string;
  celular?: string;
  parentesco?: string;
};

@Component({
  selector: 'app-ordens-servico-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    ClienteAutocomplete, NovoClienteModal,
    AutocompleteCriavel, PesquisaOsModal,
    ModeloReferenciaPanel, CadastroAparelhoModal, ContatoAlternativoModal,
    SenhaDispositivoField, OsIntakeModal, OsFotosPanel,
  ],
  templateUrl: './form.html',
  styles: [`
    .campo-invalido :is(input, select, textarea),
    .campo-invalido .autocomplete-input,
    .campo-invalido .ac-input {
      border-color: #dc2626 !important;
      box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.12);
    }
    .os-form-resumo-erros {
      margin: 0 0 16px;
      padding: 12px 14px;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 13px;
    }
    .os-form-resumo-erros ul {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    .os-form-resumo-erros li { margin: 4px 0; }
    .modal-impressao-pos-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10050;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-impressao-pos-box {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border-radius: 12px;
      padding: 20px 22px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28);
    }
    .modal-impressao-pos-box h3 {
      margin: 0 0 6px;
      font-size: 16px;
      color: #0f172a;
    }
    .modal-impressao-pos-hint {
      margin: 0 0 14px;
      font-size: 13px;
      color: #64748b;
    }
    .modal-impressao-pos-opcoes {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 18px;
    }
    .modal-impressao-pos-opcao {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      color: #334155;
    }
    .modal-impressao-pos-opcao:has(input:checked) {
      border-color: #2563eb;
      background: #eff6ff;
      color: #1e40af;
      font-weight: 600;
    }
    .modal-impressao-pos-acoes {
      display: flex;
      justify-content: flex-end;
    }
    .btn-modal-continuar {
      padding: 9px 18px;
      border: none;
      border-radius: 8px;
      background: #2563eb;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-modal-continuar:hover { background: #1d4ed8; }
    .os-form-fieldset {
      border: none;
      margin: 0;
      padding: 0;
      min-width: 0;
    }
    .pagamento-acordado-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }
    .pagamento-acordado-radios {
      display: flex;
      flex-wrap: wrap;
      gap: 14px 20px;
    }
    .pagamento-acordado-opcao {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #374151;
      cursor: pointer;
    }
    .os-form--readonly fieldset:disabled :is(input, select, textarea) {
      opacity: 1;
      color: #0f172a;
      background: #f8fafc;
      cursor: default;
    }
    .os-form-acoes-topo {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .os-form-acoes-topo .btn-sec-topo {
      padding: 7px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
    }
    .os-form-acoes-topo .btn-excluir-topo {
      border-color: #fecaca;
      color: #b91c1c;
    }
    .os-form-acoes-topo .btn-excluir-topo:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    select.situacao-aguardando-cliente {
      background: #fef9c3;
      border-color: #fde047;
      color: #854d0e;
      font-weight: 600;
    }
    select.situacao-aguardando-peca {
      background: #ffedd5;
      border-color: #fdba74;
      color: #9a3412;
      font-weight: 600;
    }
    .os-itens-acoes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .os-item-estoque-ok { font-size: 11px; color: #166534; }
    .os-item-estoque-pendente { font-size: 11px; color: #b45309; }
    .os-item-estoque-sem { font-size: 11px; color: #b91c1c; }
    .os-item-origem-externo { font-size: 11px; color: #1d4ed8; }
    .os-itens-table select { min-width: 0; }
    .os-itens-table-wrap { overflow-x: auto; overflow-y: visible; margin-bottom: 4px; }
    .os-itens-table { width: 100%; table-layout: auto; overflow: visible; }
    .os-itens-table th, .os-itens-table td { vertical-align: top; overflow: visible; }
    .os-itens-table .col-origem { width: 118px; white-space: nowrap; }
    .os-itens-table .col-descricao { min-width: 200px; max-width: 280px; position: relative; z-index: 2; }
    .os-itens-table .col-cor { width: 132px; min-width: 120px; }
    .os-itens-table .col-qtd { width: 56px; }
    .os-itens-table ::ng-deep .ac-input {
      padding: 6px 26px 6px 8px;
      font-size: 12px;
    }
    .os-itens-table ::ng-deep .ac-lista { z-index: 50; }
    .os-peca-cor-hint {
      display: block;
      margin-top: 4px;
      font-size: 10px;
      color: #b45309;
    }
    .os-cor-input {
      width: 100%;
      max-width: 120px;
      box-sizing: border-box;
      padding: 6px 8px;
      font-size: 12px;
    }
    .os-itens-table .col-parc { width: 52px; }
    .os-itens-table .col-valor { width: 168px; }
    .os-itens-table .col-ref { width: 88px; }
    .os-itens-table .col-situacao { width: 108px; }
    .os-itens-table .col-acao { width: 72px; }
    .os-itens-table :is(select, input) { max-width: 100%; box-sizing: border-box; }
    .os-peca-nome-livre { width: 100%; min-width: 0; }
    .os-item-extra td {
      padding: 0 8px 8px;
      background: #f8fafc;
      border-top: none;
    }
    .os-item-extra-campos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
      font-size: 12px;
      color: #475569;
    }
    .os-item-extra-campos label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 0;
    }
    .os-item-extra-campos select { width: 132px; }
    .os-item-extra-campos input { width: 150px; }
    .os-itens-hint { font-size: 12px; color: #64748b; margin: 0 0 10px; }
    .os-item-ref-preco { font-size: 11px; color: #64748b; margin-top: 2px; }
    .os-item-parcela { font-size: 11px; color: #1d4ed8; margin-top: 2px; }
    .os-itens-total { margin-top: 12px; font-size: 14px; text-align: right; }
    .os-aviso-modelo-peca {
      margin: 0 0 12px;
      padding: 10px 12px;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      background: #fffbeb;
      color: #92400e;
      font-size: 13px;
    }
    .os-aviso-modelo-peca a { color: #b45309; cursor: pointer; text-decoration: underline; }
    .os-aviso-orcamento {
      margin: 0 0 16px;
      padding: 12px 14px;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      background: #eff6ff;
      color: #1e3a8a;
      font-size: 13px;
      line-height: 1.45;
    }
    .os-aviso-orcamento strong { color: #1d4ed8; }
    .justificativas-atraso-lista {
      list-style: none;
      margin: 0 0 10px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .justificativa-atraso-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      background: #fef2f2;
      border: 1px solid #fecaca;
    }
    .justificativa-atraso-texto { flex: 1; white-space: pre-wrap; }
    .justificativa-atraso-add {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .justificativa-atraso-add textarea { width: 100%; }
    .os-section-fotos {
      margin-top: 18px;
    }
    .os-fotos-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      margin-left: 8px;
      padding: 0 6px;
      border-radius: 999px;
      background: #2563eb;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      vertical-align: middle;
    }
  `],
})
export class OrdensServicoForm implements OnInit, OnDestroy {
  os: BlingOrdemServico = {
    itens: [],
    acessorios: [],
    justificativasAtraso: [],
    dataEntrada: agoraDatetimeLocalBrasil(),
    lojaOrigem: LOJA_OS_PADRAO,
    situacao: situacaoPadraoPorLoja(LOJA_OS_PADRAO),
  };
  editando = false;
  somenteLeitura = false;
  salvando = false;
  erro = '';
  tentouSalvar = false;
  errosApiPorCampo: Record<string, string> = {};
  modalNovoClienteAberto = false;
  modalEditarClienteAberto = false;
  modalPesquisaOsAberto = false;
  retornoOrigemFixo = false;
  modalCadastroModeloAberto = false;
  tipoDispositivoOs = 'Celular';
  readonly tiposDispositivo = TIPOS_DISPOSITIVO;
  readonly tiposServico = TIPOS_SERVICO_OS;
  readonly formasPagamentoAcordado: Array<'avista' | 'parcelado'> = ['avista', 'parcelado'];
  readonly origensPecaOs = ORIGENS_PECA_OS;
  readonly fornecedoresExternosPeca = FORNECEDORES_EXTERNOS_PECA;
  readonly fornecedorPermiteRastreio = fornecedorPermiteRastreio;
  readonly labelTipoServicoOs = labelTipoServicoOs;
  dataEntradaMax = agoraDatetimeLocalBrasil();
  novoAcessorio = '';
  novaJustificativaAtraso = '';
  clienteCompleto?: BlingContato;
  modalContatoAlternativoAberto = false;
  modalIntakeAberto = false;
  /** Após criar OS: ao fechar o intake, pergunta impressão e nova OS. */
  pendenteFluxoPosCriacao = false;
  modalImpressaoPosCriacao = false;
  tipoImpressaoPosCriacao: OsImpressaoTipoHtml | 'nenhuma' = OS_IMPRESSAO_PADRAO_POS_CADASTRO;
  readonly opcoesImpressaoPosCadastro = OS_IMPRESSAO_OPCOES_POS_CADASTRO;
  carregandoOs = false;
  osCarregada = false;
  excluindoOs = false;
  indiceContatoAlternativoEdicao?: number;
  contatosAlternativosDisponiveis: ContatoAlternativoOpcao[] = [];
  pecasDisponiveis: PecaValorInfo[] = [];
  carregandoPecas = false;
  bloqueioPecaSemModelo = false;
  tecnicosAtivos: Tecnico[] = [];
  /** Prefill vindo da lista de orçamentos. */
  orcamentoOrigemId?: number;
  orcamentoOrigemNumero?: string;
  /**
   * Chave do *ngFor do form — muda a cada prefill para recriar inputs/autocompletes
   * já com os valores de `this.os`.
   */
  prefillFormKey = 0;
  /** Snapshot do orçamento passado via Router state (só disponível no constructor). */
  private readonly orcamentoDoRouterState?: BlingOrcamento;
  private modoRota: 'nova' | 'editar' | 'visualizar' | null = null;
  private chavePrefillNova = '';
  private osRequestSub?: Subscription;
  private situacaoAoCarregar = '';
  private conclusaoConfirmada = false;
  /** Evita que combineLate overwrite um prefill já aplicado. */
  private prefillOrcamentoAplicadoId?: number;

  get tituloPagina(): string {
    if (this.somenteLeitura) return 'Visualizar Ordem de Serviço';
    if (this.editando) return 'Editar Ordem de Serviço';
    return 'Nova Ordem de Serviço';
  }

  get breadcrumbAtual(): string {
    if (this.somenteLeitura) {
      return this.os.numero ? `Visualizar #${this.os.numero}` : 'Visualizar';
    }
    if (this.editando) {
      return this.os.numero ? `Editar #${this.os.numero}` : 'Editar';
    }
    return 'Nova OS';
  }

  get podeIncluirContatoAlternativo(): boolean {
    return (this.clienteCompleto?.contatos?.length ?? 0) < 2;
  }

  get telefoneClienteCadastro(): string {
    const c = this.clienteCompleto;
    if (!c) return '—';
    return c.celular || c.telefone || c.telefone2 || 'Sem telefone no cadastro';
  }

  get contatoAlternativoSelecionado(): ContatoAlternativoOpcao | undefined {
    if (this.os.contatoPrincipalIndice === undefined) return undefined;
    return this.contatosAlternativosDisponiveis.find(c => c.indice === this.os.contatoPrincipalIndice);
  }

  get telefoneContatoAlternativo(): string {
    const c = this.contatoAlternativoSelecionado;
    if (!c) return '—';
    return c.celular || c.telefone || 'Sem telefone';
  }

  readonly lojasOs = LOJAS_OS;
  readonly lojaPadrao = LOJA_OS_PADRAO;
  readonly prazoPecaDiasPadrao = PRAZO_AGUARDANDO_PECA_DIAS_PADRAO;
  readonly situacaoAguardandoCliente = SITUACAO_OS_AGUARDANDO_CLIENTE;

  get situacoesDisponiveis(): string[] {
    return situacoesDisponiveisPorLoja(this.os.lojaOrigem);
  }

  get situacaoPadraoAtual(): string {
    return situacaoPadraoPorLoja(this.os.lojaOrigem);
  }

  private readonly rotulosCampos: Record<string, string> = {
    cliente: 'Cliente',
    modelo: 'Modelo do aparelho',
    tipoServico: 'Tipo de serviço',
    estadoTela: 'Estado da tela',
    condicoesAparelho: 'Condições gerais do aparelho',
    defeito: 'Defeito relatado pelo cliente',
    riscoAcordado: 'Risco acordado',
    formaPagamento: 'Forma de pagamento',
    senhaDispositivo: 'Tipo de senha do aparelho',
    tecnicoNome: 'Técnico responsável',
    motivoRetorno: 'Motivo do retorno',
    osOriginal: 'OS original',
  };

  private readonly mensagensPadraoCampos: Record<string, string> = {
    cliente: 'Selecione o cliente.',
    modelo: 'Selecione o modelo do aparelho.',
    tipoServico: 'Informe o tipo de serviço.',
    estadoTela: 'Informe o estado da tela.',
    condicoesAparelho: 'Descreva as condições gerais do aparelho.',
    defeito: 'Informe o defeito relatado pelo cliente.',
    riscoAcordado: 'Informe o risco acordado com o cliente.',
    formaPagamento: 'Informe a forma de pagamento combinada.',
    senhaDispositivo: 'Selecione o tipo de senha do aparelho.',
    tecnicoNome: 'Selecione um técnico cadastrado.',
    motivoRetorno: 'Informe o motivo do retorno.',
    osOriginal: 'Selecione a OS original do retorno.',
  };

  private readonly ordemCamposValidacao = [
    'cliente', 'modelo', 'tipoServico', 'senhaDispositivo', 'estadoTela', 'condicoesAparelho', 'defeito', 'riscoAcordado', 'formaPagamento',
    'tecnicoNome', 'motivoRetorno', 'osOriginal',
  ] as const;

  get errosCampos(): Record<string, boolean> {
    if (this.bloqueioPecaSemModelo && !this.os.modeloId) {
      return { modelo: true };
    }
    if (!this.tentouSalvar) return {};
    const erros: Record<string, boolean> = {
      cliente: this.os.contato?.id == null,
      modelo: !this.os.modeloId,
      tipoServico: !this.os.tipoServico?.trim(),
      senhaDispositivo: !this.senhaDispositivoInformada(),
      estadoTela: !this.os.estadoTela?.trim(),
      condicoesAparelho: !this.os.condicoesAparelho?.trim(),
      defeito: !this.os.defeito?.trim(),
      riscoAcordado: !!this.os.temRisco && !this.os.riscoAcordado?.trim(),
      formaPagamento: !this.os.formaPagamento?.trim(),
    };
    if (this.tecnicoObrigatorio) {
      erros['tecnicoNome'] = !this.tecnicoSelecionadoValido();
    }
    if (this.os.retorno) {
      erros['motivoRetorno'] = !this.os.motivoRetorno?.trim();
      erros['osOriginal'] = !this.os.osOriginalBlingId && !this.os.osOriginalNumero?.trim();
    }
    return erros;
  }

  get tecnicoObrigatorio(): boolean {
    return osSituacaoExigeTecnico(this.os.situacao);
  }

  /** Ativos + valor atual da OS se ainda não estiver na lista (legado). */
  get opcoesTecnico(): Tecnico[] {
    const lista = [...this.tecnicosAtivos];
    const atual = this.os.tecnicoNome?.trim();
    if (atual && !lista.some(t => t.nome.toLowerCase() === atual.toLowerCase())) {
      lista.unshift({ nome: atual, ativo: false });
    }
    return lista;
  }

  get podeAdicionarPeca(): boolean {
    return !!this.os.modeloId?.trim();
  }

  get pecasPorCategoria(): { categoria: string; pecas: PecaValorInfo[] }[] {
    return agruparPecasPorCategoria(this.pecasDisponiveis);
  }

  get temItensPeca(): boolean {
    return (this.os.itens ?? []).some(i => this.isItemPeca(i));
  }

  get camposComErro(): { id: string; label: string; mensagem: string }[] {
    if (!this.tentouSalvar) return [];
    return this.ordemCamposValidacao
      .filter((id) => this.temErroCampo(id))
      .map((id) => ({
        id,
        label: this.rotulosCampos[id],
        mensagem: this.mensagemErroCampo(id),
      }));
  }

  temErroCampo(campo: string): boolean {
    return !!(this.errosCampos[campo] || this.errosApiPorCampo[campo]);
  }

  mensagemErroCampo(campo: string): string {
    if (campo === 'modelo' && this.bloqueioPecaSemModelo && !this.os.modeloId) {
      return 'Selecione o modelo do aparelho antes de adicionar peças.';
    }
    if (campo === 'senhaDispositivo') {
      return this.errosApiPorCampo[campo] || this.mensagemErroSenha();
    }
    return this.errosApiPorCampo[campo] || this.mensagensPadraoCampos[campo] || 'Campo obrigatório.';
  }

  readonly estadosTela = [
    'Sem arranhões', 'Arranhões leves', 'Arranhões moderados',
    'Trincada', 'Quebrada', 'Manchas', 'Sem tela', 'Outro',
  ];

  get valorInicialModelo(): string {
    return this.os.modeloNome || '';
  }

  buscarModelosFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhosService.buscarModelos(termo, undefined, this.tipoDispositivoOs).pipe(
      map(ms => ms.map(modeloParaAutocomplete)),
    );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: OrdensServicoService,
    private aparelhosService: AparelhosService,
    private clientesService: ClientesService,
    private estoqueService: EstoqueService,
    private tecnicosService: TecnicosService,
    private tecnicoDialog: TecnicoSelectDialogService,
    private situacaoDialog: OsSituacaoDialogService,
    private impressao: OsImpressaoService,
    private orcamentosService: OrcamentosService,
    private orcamentoPrefill: OrcamentoOsPrefillService,
    private appAuth: AppAuthService,
    private acrescimoEstoque: AcrescimoEstoqueConfigService,
    private cdr: ChangeDetectorRef,
  ) {
    // getCurrentNavigation() só funciona no constructor (em ngOnInit já é null).
    this.orcamentoDoRouterState = this.lerOrcamentoDoRouterState();
    if (this.orcamentoDoRouterState) {
      this.orcamentoPrefill.preparar(this.orcamentoDoRouterState);
    }
  }

  ngOnInit(): void {
    this.carregarTecnicos();

    // Bootstrap síncrono: aplica prefill antes do combineLatest (evita form vazio).
    const snapOrcId = this.lerOrcamentoIdDaRota(this.route.snapshot.paramMap);
    if (snapOrcId) {
      this.modoRota = 'nova';
      this.chavePrefillNova = `orcamento:${snapOrcId}`;
      this.somenteLeitura = false;
      this.editando = false;
      this.iniciarDeOrcamento(snapOrcId, this.orcamentoDoRouterState);
    }

    combineLatest([
      this.route.paramMap,
      this.route.data,
      this.route.queryParamMap,
    ]).subscribe(([params, data, query]) => {
      const orcamentoIdParam = this.lerOrcamentoIdDaRota(params);
      if (orcamentoIdParam) {
        const chave = `orcamento:${orcamentoIdParam}`;
        if (this.prefillOrcamentoAplicadoId === orcamentoIdParam && this.osCarregada) {
          this.modoRota = 'nova';
          this.chavePrefillNova = chave;
          return;
        }
        if (this.modoRota !== 'nova' || this.chavePrefillNova !== chave) {
          this.modoRota = 'nova';
          this.chavePrefillNova = chave;
          this.somenteLeitura = false;
          this.editando = false;
          this.iniciarDeOrcamento(orcamentoIdParam, this.orcamentoDoRouterState);
        }
        return;
      }

      const idParam = params.get('id');
      if (idParam && idParam !== 'nova') {
        const id = Number(idParam);
        if (!Number.isFinite(id) || id <= 0) return;

        this.somenteLeitura = !!data['somenteLeitura'];
        this.modoRota = this.somenteLeitura ? 'visualizar' : 'editar';
        this.editando = !this.somenteLeitura;
        this.tentouSalvar = false;
        this.errosApiPorCampo = {};
        this.retornoOrigemFixo = false;
        this.orcamentoOrigemId = undefined;
        this.orcamentoOrigemNumero = undefined;
        this.prefillOrcamentoAplicadoId = undefined;
        this.chavePrefillNova = '';

        const abrirModalIntake = !this.somenteLeitura && this.consumirFlagAbrirModalIntake();
        this.pendenteFluxoPosCriacao = this.consumirFlagFluxoPosCriacao();
        this.carregarOs(id, { abrirModalIntake });
        return;
      }

      // Já veio de orçamento (bootstrap sync) — não zera o form.
      if (this.prefillOrcamentoAplicadoId || this.orcamentoOrigemId) {
        return;
      }

      const retornoDe = Number(query.get('retornoDe'));
      const deOrcamentoQuery = Number(query.get('deOrcamento'));
      const chave = `orc:${Number.isFinite(deOrcamentoQuery) && deOrcamentoQuery > 0 ? deOrcamentoQuery : 0}`
        + `|ret:${Number.isFinite(retornoDe) && retornoDe > 0 ? retornoDe : 0}`;

      if (this.modoRota !== 'nova' || this.chavePrefillNova !== chave) {
        this.modoRota = 'nova';
        this.somenteLeitura = false;
        this.editando = false;
        if (Number.isFinite(retornoDe) && retornoDe > 0) {
          this.chavePrefillNova = chave;
          this.iniciarRetornoAPartirDe(retornoDe);
        } else if (Number.isFinite(deOrcamentoQuery) && deOrcamentoQuery > 0) {
          this.chavePrefillNova = chave;
          this.iniciarDeOrcamento(deOrcamentoQuery);
        } else {
          const pending = this.orcamentoPrefill.peek();
          if (pending?.id) {
            this.chavePrefillNova = `orc:${pending.id}|ret:0`;
            this.iniciarDeOrcamento(pending.id);
          } else {
            this.chavePrefillNova = chave;
            this.inicializarNovaOs();
          }
        }
      }
    });
  }

  private lerOrcamentoIdDaRota(params: { get(name: string): string | null }): number | undefined {
    const raw = params.get('orcamentoId');
    if (!raw) return undefined;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : undefined;
  }

  private lerOrcamentoDoRouterState(): BlingOrcamento | undefined {
    const nav = this.router.getCurrentNavigation();
    const fromNav = nav?.extras?.state?.[ORCAMENTO_OS_PREFILL_STATE_KEY] as BlingOrcamento | undefined;
    if (fromNav?.id != null) return fromNav;

    try {
      const hist = history.state?.[ORCAMENTO_OS_PREFILL_STATE_KEY] as BlingOrcamento | undefined;
      if (hist?.id != null) return hist;
    } catch {
      /* ignore */
    }
    return undefined;
  }

  ngOnDestroy(): void {
    this.osRequestSub?.unsubscribe();
  }

  /** Assistência vinculada: campo travado (só Admin/Root escolhe livremente). */
  get lojaCriacaoTravada(): boolean {
    return !!this.appAuth?.restringeCriacaoPorLoja();
  }

  private novaOsVazia(): BlingOrdemServico {
    const loja = normalizarLojaOs(this.appAuth?.lojaPadraoCriacao() || LOJA_OS_PADRAO);
    return {
      itens: [],
      acessorios: [],
      justificativasAtraso: [],
      dataEntrada: agoraDatetimeLocalBrasil(),
      lojaOrigem: loja,
      situacao: situacaoPadraoPorLoja(loja),
      senhaDispositivoTipo: undefined,
      senhaDispositivo: undefined,
    };
  }

  private inicializarNovaOs(): void {
    this.osRequestSub?.unsubscribe();
    this.editando = false;
    this.tentouSalvar = false;
    this.errosApiPorCampo = {};
    this.erro = '';
    this.salvando = false;
    this.carregandoOs = false;
    this.osCarregada = true;
    this.modalIntakeAberto = false;
    this.pendenteFluxoPosCriacao = false;
    this.modalImpressaoPosCriacao = false;
    this.tipoImpressaoPosCriacao = OS_IMPRESSAO_PADRAO_POS_CADASTRO;
    this.retornoOrigemFixo = false;
    this.orcamentoOrigemId = undefined;
    this.orcamentoOrigemNumero = undefined;
    this.novoAcessorio = '';
    this.tipoDispositivoOs = 'Celular';
    this.os = this.novaOsVazia();
    const padrao = situacaoPadraoPorLoja(this.os.lojaOrigem);
    this.os.situacao = padrao;
    this.situacaoAoCarregar = padrao;
    this.conclusaoConfirmada = false;
    this.limparContatosAlternativos();
  }

  private iniciarDeOrcamento(orcamentoId: number, jaCarregado?: BlingOrcamento): void {
    // Não chama inicializarNovaOs() (evita piscar formulário vazio).
    this.osRequestSub?.unsubscribe();
    this.editando = false;
    this.tentouSalvar = false;
    this.errosApiPorCampo = {};
    this.erro = '';
    this.salvando = false;
    this.carregandoOs = true;
    this.osCarregada = false;
    this.modalIntakeAberto = false;
    this.pendenteFluxoPosCriacao = false;
    this.modalImpressaoPosCriacao = false;
    this.retornoOrigemFixo = false;
    this.orcamentoOrigemId = orcamentoId;
    this.orcamentoOrigemNumero = undefined;
    this.prefillOrcamentoAplicadoId = undefined;
    this.novoAcessorio = '';
    this.pecasDisponiveis = [];
    this.limparContatosAlternativos();

    const cached = this.orcamentoPrefill.obterParaPrefill(orcamentoId, jaCarregado);
    if (cached) {
      this.finalizarPrefillOrcamento(cached);
      return;
    }

    this.osRequestSub = this.orcamentosService.obter(orcamentoId).subscribe({
      next: (orc) => this.finalizarPrefillOrcamento(orc),
      error: () => {
        this.erro = 'Não foi possível carregar o orçamento para preencher a OS.';
        this.orcamentoOrigemId = undefined;
        this.prefillOrcamentoAplicadoId = undefined;
        this.inicializarNovaOs();
        this.cdr.detectChanges();
      },
    });
  }

  private finalizarPrefillOrcamento(orc: BlingOrcamento): void {
    if (orc.id == null) {
      this.erro = 'Orçamento inválido para preencher a OS.';
      this.orcamentoOrigemId = undefined;
      this.inicializarNovaOs();
      this.cdr.detectChanges();
      return;
    }

    if (orc.osGeradaBlingId) {
      this.erro = `Este orçamento já foi convertido na OS #${orc.osGeradaNumero || orc.osGeradaBlingId}.`;
      this.orcamentoOrigemId = undefined;
      this.prefillOrcamentoAplicadoId = undefined;
      this.orcamentoPrefill.limpar();
      this.inicializarNovaOs();
      this.cdr.detectChanges();
      return;
    }

    this.aplicarOrcamentoNaNovaOs(orc);
    this.prefillOrcamentoAplicadoId = Number(orc.id);
    this.orcamentoPrefill.limpar();
    this.prefillFormKey += 1;
    this.carregandoOs = false;
    this.osCarregada = true;
    // detectChanges: monta o form no mesmo turno, já com this.os preenchido.
    this.cdr.detectChanges();
  }

  private aplicarOrcamentoNaNovaOs(orc: BlingOrcamento): void {
    this.os = this.novaOsVazia();
    this.orcamentoOrigemId = orc.id != null ? Number(orc.id) : undefined;
    this.orcamentoOrigemNumero = orc.numero;

    if (orc.contato?.id != null) {
      this.os.contato = {
        id: orc.contato.id,
        nome: orc.contato.nome || '',
        telefone: orc.contato.telefone,
        celular: orc.contato.celular,
      };
      this.carregarClienteParaAviso(orc.contato.id);
    }

    // Mantém a loja do orçamento; operador restrito preserva a sua.
    if (!this.lojaCriacaoTravada && orc.lojaOrigem) {
      const loja = normalizarLojaOs(orc.lojaOrigem);
      this.os.lojaOrigem = loja;
      this.os.situacao = situacaoPadraoPorLoja(loja);
      this.situacaoAoCarregar = this.os.situacao;
    }

    this.os.marcaId = orc.marcaId;
    this.os.marcaNome = orc.marcaNome;
    this.os.modeloId = orc.modeloId;
    this.os.modeloNome = orc.modeloNome;
    this.os.equipamento = orc.equipamento
      || [orc.marcaNome, orc.modeloNome].filter(Boolean).join(' ')
      || undefined;
    this.os.tipoServico = 'orcamento';
    this.os.defeito = orc.observacoes?.trim()
      || `Serviço conforme orçamento ${orc.numero || orc.id}`;
    this.os.observacoesInternas = `Origem: orçamento ${orc.numero || orc.id} (id ${orc.id})`;
    this.os.valorTotalAcordado = orc.valorAVista ?? orc.valorTotalAcordado ?? orc.valorTotal;
    this.os.valorTotal = this.os.valorTotalAcordado;
    // Cliente escolhe na OS: deixa forma vazia; mantém qtd de parcelas da proposta.
    this.os.formaPagamento = undefined;
    this.os.parcelasPagamento = orc.parcelasPagamento && orc.parcelasPagamento >= 2
      ? orc.parcelasPagamento
      : undefined;
    const opcVista = orc.valorAVista ?? orc.valorTotalAcordado;
    const opcPrazo = orc.valorAPrazo ?? orc.valorTotalAcordado;
    const nParc = orc.parcelasPagamento && orc.parcelasPagamento >= 2 ? orc.parcelasPagamento : null;
    this.os.observacoes = [
      `Pré-orçamento ${orc.numero || orc.id}`,
      opcVista != null || opcPrazo != null
        ? `Opções: à vista ${this.formatarMoeda(opcVista ?? undefined)} / a prazo ${this.formatarMoeda(opcPrazo ?? undefined)}${nParc ? ` em ${nParc}x` : ''}`
        : null,
    ].filter(Boolean).join(' · ');

    this.os.itens = (orc.itens ?? [])
      .filter(i => !!(i.descricao?.trim()) || (i.valorAcontado ?? i.valorUnitario ?? 0) > 0)
      .map(i => {
        const valor = Number(i.valorAcontado ?? i.valorUnitario ?? 0) || 0;
        const qtd = Number(i.quantidade) > 0 ? Number(i.quantidade) : 1;
        return {
          descricao: (i.descricao || '').trim() || 'Serviço',
          quantidade: qtd,
          valorUnitario: valor,
          valorAcontado: valor,
          tipoItem: 'servico' as const,
          pecaId: i.pecaId,
          variacaoRotulo: i.variacaoRotulo,
          valorSugeridoMinimo: i.valorSugeridoMinimo,
          valorSugeridoTroca: i.valorSugeridoTroca,
          quantidadeEstoqueBaixada: 0,
        };
      });

    if (orc.modeloId) {
      this.carregarPecasModelo(orc.modeloId, () => this.ajustarItensOrcamentoComEstoque());
      this.aparelhosService.obterModelo(orc.modeloId).subscribe({
        next: (modelo) => {
          if (modelo?.tipoDispositivo) this.tipoDispositivoOs = modelo.tipoDispositivo;
          this.cdr.markForCheck();
        },
      });
    }
  }

  /** Com estoque suficiente, promove item do orçamento a peça (baixa ao salvar a OS). */
  private ajustarItensOrcamentoComEstoque(): void {
    if (!this.os.itens?.length || !this.pecasDisponiveis.length) return;

    this.os.itens = this.os.itens.map(item => {
      if (!item.pecaId) return item;
      const peca = this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
      if (!peca) return item;

      const qtd = Math.max(1, Math.ceil(Number(item.quantidade) || 1));
      if ((peca.quantidadeEstoque ?? 0) < qtd) return item;

      const cores = (peca.cores ?? []).filter(c => (c.quantidade ?? 0) > 0 && c.cor?.trim());
      const cor = cores.length === 1 ? cores[0].cor.trim() : undefined;

      return {
        ...item,
        tipoItem: 'peca' as const,
        origemPeca: 'estoque',
        marcaPeca: peca.marcaPeca,
        parcelamento: peca.parcelamento,
        cor,
        descricao: item.descricao?.trim() && item.descricao !== 'Serviço'
          ? item.descricao
          : (item.variacaoRotulo
            ? `${peca.nome} — ${item.variacaoRotulo}${cor ? ` (${cor})` : ''}`
            : `${peca.nome}${cor ? ` (${cor})` : ''}`),
      };
    });
    this.cdr.markForCheck();
  }

  private iniciarRetornoAPartirDe(origemId: number): void {
    this.inicializarNovaOs();
    this.retornoOrigemFixo = true;
    this.carregandoOs = true;
    this.osCarregada = false;
    this.erro = '';

    this.osRequestSub?.unsubscribe();
    this.osRequestSub = this.service.obter(origemId).subscribe({
      next: (origem) => {
        this.aplicarOsComoRetorno(origem);
        this.carregandoOs = false;
        this.osCarregada = true;
      },
      error: () => {
        this.erro = 'Não foi possível carregar a OS de origem para criar o retorno.';
        this.carregandoOs = false;
        this.osCarregada = true;
      },
    });
  }

  private aplicarOsComoRetorno(origem: BlingOrdemServico): void {
    this.os = this.novaOsVazia();
    this.os.retorno = true;
    this.os.osOriginalBlingId = origem.id;
    this.os.osOriginalNumero = origem.numero ?? (origem.id != null ? String(origem.id) : undefined);
    this.os.motivoRetorno = '';

    if (origem.contato?.id != null) {
      this.os.contato = { ...origem.contato };
      this.os.cpfCnpj = origem.cpfCnpj;
      this.os.contatoAviso = origem.contatoAviso ? { ...origem.contatoAviso } : undefined;
      this.os.contatoPrincipalIndice = origem.contatoPrincipalIndice;
      this.os.preferenciaContatoSelecionado = origem.preferenciaContatoSelecionado ?? false;
      this.carregarClienteParaAviso(origem.contato.id, {
        indiceSalvo: origem.contatoPrincipalIndice,
        preferenciaSalva: origem.preferenciaContatoSelecionado ?? false,
      });
    }

    this.os.marcaId = origem.marcaId;
    this.os.marcaNome = origem.marcaNome;
    this.os.modeloId = origem.modeloId;
    this.os.modeloNome = origem.modeloNome;
    this.os.equipamento = origem.equipamento;
    this.os.imei = origem.imei;
    this.os.numeroSerie = origem.numeroSerie;
    this.os.estadoTela = origem.estadoTela;
    this.os.condicoesAparelho = origem.condicoesAparelho;
    this.os.acessorios = [...(origem.acessorios ?? [])];
    this.os.tipoServico = origem.tipoServico;
    this.os.testeEntrada = origem.testeEntrada;
    this.os.testeSaida = origem.testeSaida;
    this.os.senhaDispositivoTipo = origem.senhaDispositivoTipo;
    this.os.senhaDispositivo = origem.senhaDispositivo;
    this.os.lojaOrigem = normalizarLojaOs(origem.lojaOrigem);
    this.os.situacao = situacaoPadraoPorLoja(this.os.lojaOrigem);

    if (origem.modeloId) {
      this.carregarPecasModelo(origem.modeloId);
      this.aparelhosService.obterModelo(origem.modeloId).subscribe({
        next: (modelo) => {
          if (modelo?.tipoDispositivo) this.tipoDispositivoOs = modelo.tipoDispositivo;
        },
      });
    }
  }

  private consumirFlagAbrirModalIntake(): boolean {
    if (history.state?.['abrirModalIntake'] !== true) return false;
    const { abrirModalIntake: _, ...resto } = history.state as Record<string, unknown>;
    history.replaceState(resto, '');
    return true;
  }

  private consumirFlagFluxoPosCriacao(): boolean {
    if (history.state?.['fluxoPosCriacao'] !== true) return false;
    const { fluxoPosCriacao: _, ...resto } = history.state as Record<string, unknown>;
    history.replaceState(resto, '');
    return true;
  }

  /** Fecha o QR de intake e, após criar OS, abre escolha de impressão (padrão: Ordem de serviço com teste). */
  onFecharModalIntake(): void {
    this.modalIntakeAberto = false;
    if (!this.pendenteFluxoPosCriacao) return;
    this.pendenteFluxoPosCriacao = false;
    this.tipoImpressaoPosCriacao = OS_IMPRESSAO_PADRAO_POS_CADASTRO;
    this.modalImpressaoPosCriacao = true;
    this.cdr.markForCheck();
  }

  async confirmarImpressaoPosCriacao(): Promise<void> {
    this.modalImpressaoPosCriacao = false;
    const tipo = this.tipoImpressaoPosCriacao;
    const osParaImprimir = (tipo !== 'nenhuma' && this.os.id != null) ? { ...this.os } : null;

    // Pergunta/navega antes de imprimir — evita a aba do app sumir atrás do print.
    const querNova = window.confirm('Deseja incluir uma nova OS?');
    if (querNova) {
      // Permite reinicializar mesmo se a rota reutilizar este componente.
      this.modoRota = null;
      await this.router.navigateByUrl('/ordens-servico/nova');
      this.modoRota = 'nova';
      this.somenteLeitura = false;
      this.editando = false;
      this.inicializarNovaOs();
      this.cdr.markForCheck();
    } else {
      await this.router.navigateByUrl('/ordens-servico');
    }

    if (tipo !== 'nenhuma' && osParaImprimir) {
      this.service.seedObter(osParaImprimir);
      this.impressao.imprimir(tipo, osParaImprimir);
    }
  }

  private carregarOs(id: number, opts?: { abrirModalIntake?: boolean }): void {
    this.osRequestSub?.unsubscribe();
    this.erro = '';

    const preview = this.service.peekObter(id);
    if (preview) {
      this.aplicarOsNaForm(preview);
      this.osCarregada = true;
      this.carregandoOs = false;
    } else {
      this.carregandoOs = true;
      this.osCarregada = false;
    }

    this.osRequestSub = this.service.obter(id).subscribe({
      next: (os) => {
        this.aplicarOsNaForm(os);
        this.osCarregada = true;
        this.carregandoOs = false;
        if (opts?.abrirModalIntake) this.modalIntakeAberto = true;
        if (os.contato?.id != null) {
          this.carregarClienteParaAviso(os.contato.id, {
            indiceSalvo: os.contatoPrincipalIndice,
            preferenciaSalva: os.preferenciaContatoSelecionado ?? false,
          });
        } else {
          this.limparContatosAlternativos();
        }
      },
      error: () => {
        if (!this.osCarregada) {
          this.erro = 'Erro ao carregar OS.';
          this.osCarregada = false;
        }
        this.carregandoOs = false;
      },
    });
  }

  private aplicarOsNaForm(os: BlingOrdemServico): void {
    this.os = {
      ...os,
      acessorios: os.acessorios ?? [],
      itens: (os.itens ?? []).map(i => this.normalizarItemOs(i)),
      situacao: ajustarSituacaoParaLoja(os.situacao, os.lojaOrigem),
      lojaOrigem: normalizarLojaOs(os.lojaOrigem),
      dataEntrada: this.formatarDataParaInput(os.dataEntrada ?? os.data),
      dataInicioAssistencia: this.formatarDataParaInput(os.dataInicioAssistencia),
      dataPrazoPeca: this.formatarDataParaInput(os.dataPrazoPeca),
      dataUltimaAlteracaoSituacao: this.formatarDataParaInput(os.dataUltimaAlteracaoSituacao),
      justificativasAtraso: [...(os.justificativasAtraso ?? [])],
      dataPrevistaTermino: this.formatarDataParaInput(os.dataPrevistaTermino ?? os.dataPrevista),
      dataAtualizacao: this.formatarDataParaInput(os.dataAtualizacao),
      dataSaida: this.formatarDataParaInput(os.dataSaida),
      dataConclusao: this.formatarDataParaInput(os.dataConclusao),
      valorTotalAcordado: os.valorTotalAcordado ?? os.valorTotal,
      formaPagamento: normalizarFormaPagamentoOs(os.formaPagamento) || undefined,
      juros: os.juros ?? 0,
      // Sem pré-seleção: tipo vazio/legado exige escolha explícita.
      senhaDispositivoTipo: this.normalizarTipoSenhaCarregado(os.senhaDispositivoTipo),
      senhaDispositivo: os.senhaDispositivo,
      fotosAparelho: [...(os.fotosAparelho ?? [])],
    };
    this.situacaoAoCarregar = this.os.situacao || situacaoPadraoPorLoja(this.os.lojaOrigem);
    this.conclusaoConfirmada = osSituacaoConcluida(this.situacaoAoCarregar);
    if (this.os.modeloId) this.carregarPecasModelo(this.os.modeloId);
  }

  private normalizarItemOs(item: BlingOrdemServicoItem): BlingOrdemServicoItem {
    // Respeita tipoItem=servico mesmo com pecaId (referência de catálogo / sem estoque).
    const base = item.tipoItem === 'servico'
      ? { ...item, tipoItem: 'servico' as const }
      : item.tipoItem === 'peca' || !!item.pecaId
        ? { ...item, tipoItem: 'peca' as const }
        : { ...item, tipoItem: item.tipoItem ?? 'servico' as const };

    if (base.valorAcontado == null && base.valorUnitario) {
      base.valorAcontado = base.valorUnitario;
    }
    if (base.valorUnitario == null && base.valorAcontado != null) {
      base.valorUnitario = base.valorAcontado;
    }
    if (base.tipoItem === 'peca' && !base.origemPeca) {
      base.origemPeca = 'estoque';
    }
    return base;
  }

  private formatarDataParaInput(valor?: string): string | undefined {
    return formatarDatetimeLocalBrasil(valor);
  }

  private agoraDatetimeLocal(): string {
    return agoraDatetimeLocalBrasil();
  }

  onClienteSelecionado(cliente: BlingContato | null): void {
    this.os.contato = cliente?.id != null
      ? { id: cliente.id, nome: cliente.nome }
      : undefined;

    if (cliente?.id != null) {
      this.os.preferenciaContatoSelecionado = false;
      this.aplicarClienteParaAviso(cliente);
    } else {
      this.limparContatosAlternativos();
    }
  }

  onClienteCriado(cliente: BlingContato): void {
    this.onClienteSalvo(cliente);
    this.modalNovoClienteAberto = false;
  }

  onClienteAtualizado(cliente: BlingContato): void {
    this.onClienteSalvo(cliente);
    this.modalEditarClienteAberto = false;
  }

  onClienteSalvo(cliente: BlingContato): void {
    this.os.contato = cliente.id != null
      ? { id: cliente.id, nome: cliente.nome }
      : undefined;
    if (cliente.id != null) {
      this.aplicarClienteParaAviso(cliente, {
        indiceSalvo: this.os.contatoPrincipalIndice,
        preferenciaSalva: this.os.preferenciaContatoSelecionado,
      });
    }
  }

  abrirEditarCliente(): void {
    const id = this.os.contato?.id;
    if (id == null) return;

    if (this.clienteCompleto?.id === id) {
      this.modalEditarClienteAberto = true;
      return;
    }

    this.clientesService.obter(id).subscribe({
      next: cliente => {
        this.aplicarClienteParaAviso(cliente, {
          indiceSalvo: this.os.contatoPrincipalIndice,
          preferenciaSalva: this.os.preferenciaContatoSelecionado,
        });
        this.modalEditarClienteAberto = true;
      },
      error: () => {
        this.erro = 'Não foi possível carregar o cliente para edição.';
      },
    });
  }

  /** Usa dados já disponíveis; só busca na API ao editar OS ou se faltar cadastro completo. */
  private carregarClienteParaAviso(
    clienteId: number,
    opts?: { indiceSalvo?: number; preferenciaSalva?: boolean },
  ): void {
    if (this.clienteCompleto?.id === clienteId) {
      this.aplicarClienteParaAviso(this.clienteCompleto, opts);
      return;
    }

    this.clientesService.obter(clienteId).subscribe({
      next: cliente => this.aplicarClienteParaAviso(cliente, opts),
      error: () => {
        this.erro = 'Não foi possível carregar os contatos do cliente.';
      },
    });
  }

  private aplicarClienteParaAviso(
    cliente: BlingContato,
    opts?: { indiceSalvo?: number; preferenciaSalva?: boolean },
  ): void {
    this.clienteCompleto = cliente;
    this.contatosAlternativosDisponiveis = this.montarOpcoesContato(cliente);

    const indice = this.resolverIndiceContato(opts?.indiceSalvo);
    if (indice !== undefined) {
      this.preencherContatoAlternativo(indice);
    } else {
      this.os.contatoPrincipalIndice = undefined;
      this.os.contatoAviso = undefined;
    }

    if (opts?.preferenciaSalva !== undefined) {
      this.os.preferenciaContatoSelecionado = opts.preferenciaSalva;
    }
  }

  private resolverIndiceContato(indiceSalvo?: number): number | undefined {
    if (indiceSalvo !== undefined && this.contatosAlternativosDisponiveis.some(c => c.indice === indiceSalvo)) {
      return indiceSalvo;
    }
    return this.contatosAlternativosDisponiveis[0]?.indice;
  }

  onPreferenciaContatoChange(): void {
    if (this.os.preferenciaContatoSelecionado) {
      const indice = this.os.contatoPrincipalIndice
        ?? this.contatosAlternativosDisponiveis[0]?.indice;
      if (indice !== undefined) {
        this.selecionarContatoAlternativo(indice);
      }
    }
  }

  selecionarContatoAlternativo(indice: number): void {
    this.preencherContatoAlternativo(indice);
  }

  abrirIncluirContatoAlternativo(): void {
    this.abrirModalContatoAlternativo();
  }

  abrirEditarContatoAlternativo(indice: number): void {
    this.abrirModalContatoAlternativo(indice);
  }

  private abrirModalContatoAlternativo(indiceEdicao?: number): void {
    const id = this.os.contato?.id;
    if (id == null) return;

    const abrir = () => {
      this.indiceContatoAlternativoEdicao = indiceEdicao;
      this.modalContatoAlternativoAberto = true;
    };

    if (this.clienteCompleto?.id === id) {
      abrir();
      return;
    }

    this.clientesService.obter(id).subscribe({
      next: cliente => {
        this.aplicarClienteParaAviso(cliente, {
          indiceSalvo: this.os.contatoPrincipalIndice,
          preferenciaSalva: this.os.preferenciaContatoSelecionado,
        });
        abrir();
      },
      error: () => {
        this.erro = 'Não foi possível carregar o cliente.';
      },
    });
  }

  onContatoAlternativoSalvo({ cliente, indice }: { cliente: BlingContato; indice: number }): void {
    this.modalContatoAlternativoAberto = false;
    this.indiceContatoAlternativoEdicao = undefined;
    this.aplicarClienteParaAviso(cliente, {
      indiceSalvo: indice,
      preferenciaSalva: this.os.preferenciaContatoSelecionado,
    });
    this.selecionarContatoAlternativo(indice);
  }

  private montarOpcoesContato(cliente: BlingContato): ContatoAlternativoOpcao[] {
    return (cliente.contatos ?? [])
      .map((c, indice) => ({
        indice,
        nome: (c.nome ?? '').trim(),
        telefone: c.telefone,
        celular: c.celular,
        parentesco: c.parentesco,
      }))
      .filter(c => c.nome.length > 0);
  }

  private preencherContatoAlternativo(indice: number): void {
    const contato = this.contatosAlternativosDisponiveis.find(c => c.indice === indice);
    if (!contato) return;

    this.os.contatoPrincipalIndice = indice;
    this.os.contatoAviso = {
      id: 0,
      nome: contato.nome,
      telefone: contato.telefone,
      celular: contato.celular,
      parentesco: contato.parentesco,
      autorizadoRetirada: true,
    };
  }

  onAutorizadoRetiradaChange(autorizado: boolean): void {
    if (!this.os.contatoAviso) return;
    this.os.contatoAviso = {
      ...this.os.contatoAviso,
      autorizadoRetirada: !!autorizado,
    };
  }

  limparContatosAlternativos(): void {
    this.clienteCompleto = undefined;
    this.contatosAlternativosDisponiveis = [];
    this.os.contatoPrincipalIndice = undefined;
    this.os.contatoAviso = undefined;
    this.os.preferenciaContatoSelecionado = false;
  }

  onModeloSelecionado(item: AutocompleteItem | null): void {
    this.os.modeloId = item?.id;
    this.os.modeloNome = item?.nome;
    this.os.marcaId = item?.marcaId;
    this.os.marcaNome = item?.marcaNome;
    if (!item) {
      this.os.marcaId = undefined;
      this.os.marcaNome = undefined;
      this.pecasDisponiveis = [];
      return;
    }
    this.bloqueioPecaSemModelo = false;
    this.carregarPecasModelo(item.id);
  }

  private carregarPecasModelo(modeloId?: string, aposCarregar?: () => void): void {
    if (!modeloId) {
      this.pecasDisponiveis = [];
      return;
    }
    this.carregandoPecas = true;
    this.aparelhosService.consultarServicosValores(modeloId).subscribe({
      next: res => {
        this.pecasDisponiveis = res?.pecas ?? [];
        this.carregandoPecas = false;
        aposCarregar?.();
      },
      error: () => {
        this.pecasDisponiveis = [];
        this.carregandoPecas = false;
      },
    });
  }

  onModeloSalvoModal(modelo: ModeloAparelho): void {
    this.modalCadastroModeloAberto = false;
    this.tipoDispositivoOs = modelo.tipoDispositivo ?? this.tipoDispositivoOs;
    this.onModeloSelecionado({
      id: modelo.id,
      nome: modelo.nome,
      marcaId: modelo.marcaId,
      marcaNome: modelo.marcaNome,
    });
  }

  onRetornoChange(): void {
    if (!this.os.retorno) {
      this.os.osOriginalNumero = undefined;
      this.os.osOriginalBlingId = undefined;
      this.os.motivoRetorno = undefined;
      if (this.retornoOrigemFixo) {
        this.os.retorno = true;
      }
    } else if (!this.retornoOrigemFixo && !this.os.osOriginalBlingId) {
      this.modalPesquisaOsAberto = true;
    }
  }

  onOsOriginalSelecionada(os: BlingOrdemServico): void {
    this.os.osOriginalNumero = os.numero;
    this.os.osOriginalBlingId = os.id;
    this.modalPesquisaOsAberto = false;
  }

  adicionarAcessorio(): void {
    const v = this.novoAcessorio.trim();
    if (!v) return;
    this.os.acessorios = this.os.acessorios ?? [];
    if (!this.os.acessorios.includes(v)) this.os.acessorios.push(v);
    this.novoAcessorio = '';
  }

  removerAcessorio(i: number): void { this.os.acessorios?.splice(i, 1); }

  adicionarPecaItem(): void {
    if (!this.exigirModeloParaPeca()) return;
    this.erro = '';
    this.os.itens = this.os.itens ?? [];
    this.os.itens.push({
      tipoItem: 'peca',
      pecaId: '',
      descricao: '',
      quantidade: 1,
      valorUnitario: 0,
      valorAcontado: 0,
      quantidadeEstoqueBaixada: 0,
      origemPeca: 'estoque',
    });
  }

  adicionarServicoItem(): void {
    this.os.itens = this.os.itens ?? [];
    this.os.itens.push({
      tipoItem: 'servico',
      descricao: '',
      quantidade: 1,
      valorUnitario: 0,
      valorAcontado: 0,
    });
  }

  /** @deprecated use adicionarPecaItem ou adicionarServicoItem */
  adicionarItem(): void {
    this.adicionarServicoItem();
  }

  /** Sugestão de peças compatíveis com o modelo (estoque local). */
  buscarPecasOsFn = (termo: string): Observable<AutocompleteItem[]> => {
    const t = termo.trim().toLowerCase();
    const lista = this.pecasDisponiveis
      .map(p => ({
        id: p.pecaId,
        nome: this.labelPecaOs(p),
        extra: [p.categoria, p.marcaPeca].filter(Boolean).join(' · ') || undefined,
      }))
      .filter(p =>
        !t
        || p.nome.toLowerCase().includes(t)
        || (p.extra ?? '').toLowerCase().includes(t),
      );
    return of(lista.slice(0, 25));
  };

  valorInicialPecaItem(item: BlingOrdemServicoItem): string {
    if (item.pecaId) {
      const peca = this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
      if (peca) return this.labelPecaOs(peca);
    }
    return item.descricao?.replace(/\s*\([^)]*\)\s*$/, '').trim() || '';
  }

  labelPecaSelecionada(item: BlingOrdemServicoItem): string {
    if (!item.pecaId) return '';
    const peca = this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
    return peca ? this.labelPecaOs(peca) : (item.descricao || '');
  }

  onPecaAutocomplete(item: BlingOrdemServicoItem, sel: AutocompleteItem | null): void {
    if (!sel?.id) {
      if (this.itemUsaCatalogo(item)) {
        this.onItemPecaChange(item, '');
      }
      return;
    }
    this.onItemPecaChange(item, sel.id);
    this.cdr.markForCheck();
  }

  /** Sugestões rápidas para linhas de serviço (datalist). */
  readonly sugestoesServicoOs = [
    'Mão de obra',
    'Diagnóstico',
    'Limpeza',
    'Reparo de solda',
    'Atualização de software',
    'Desbloqueio',
    'Troca de conector',
  ];

  onItemPecaChange(item: BlingOrdemServicoItem, pecaId: string): void {
    if (!pecaId?.trim()) {
      item.pecaId = undefined;
      item.variacaoRotulo = undefined;
      item.cor = undefined;
      return;
    }
    const peca = this.pecasDisponiveis.find(p => p.pecaId === pecaId);
    if (!peca) return;
    item.pecaId = pecaId;
    item.tipoItem = 'peca';
    item.variacaoRotulo = undefined;
    item.cor = undefined;
    item.descricao = peca.nome;
    item.marcaPeca = peca.marcaPeca;
    this.preencherValoresSugeridosEstoque(item, peca.valorSugeridoMinimo, peca.valorSugeridoTroca);
    item.parcelamento = peca.parcelamento;
    item.origemPeca = 'estoque';
    item.fornecedorExterno = undefined;
    item.codigoRastreio = undefined;
    item.estoqueInsuficiente = false;
    this.atualizarCustoPecaReferencia(item, pecaId);

    const cores = this.coresDaPeca(item).filter(c => c.quantidade > 0);
    if (cores.length === 1) {
      this.onCorItemChange(item, cores[0].cor);
    }
  }

  onCorItemChange(item: BlingOrdemServicoItem, cor: string): void {
    item.cor = cor?.trim() || undefined;
    const peca = this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
    if (!peca) return;

    const base = item.variacaoRotulo
      ? `${peca.nome} — ${item.variacaoRotulo}`
      : peca.nome;
    item.descricao = item.cor ? `${base} (${item.cor})` : base;
  }

  pecaDoItem(item: BlingOrdemServicoItem): PecaValorInfo | undefined {
    if (!item.pecaId) return undefined;
    return this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
  }

  coresDaPeca(item: BlingOrdemServicoItem): CorEstoqueModelo[] {
    const peca = this.pecaDoItem(item);
    if (!peca?.cores?.length) return [];
    return peca.cores
      .filter(c => (c.cor ?? '').trim())
      .map(c => ({
        cor: c.cor.trim(),
        quantidade: Math.max(0, Number(c.quantidade) || 0),
      }))
      .sort((a, b) => {
        if (a.quantidade > 0 && b.quantidade <= 0) return -1;
        if (a.quantidade <= 0 && b.quantidade > 0) return 1;
        return a.cor.localeCompare(b.cor, 'pt-BR');
      });
  }

  corItemDisponivel(item: BlingOrdemServicoItem): boolean {
    if (!item.cor?.trim()) return false;
    const c = this.coresDaPeca(item).find(
      x => x.cor.toLowerCase() === item.cor!.trim().toLowerCase(),
    );
    return (c?.quantidade ?? 0) > 0;
  }

  /** Peça de catálogo que exige escolha de cor (tampa, vidro ou com estoque por cor). */
  precisaCorItem(item: BlingOrdemServicoItem): boolean {
    if (!this.isItemPeca(item) || !this.itemUsaCatalogo(item) || !item.pecaId) return false;
    const peca = this.pecaDoItem(item);
    if (!peca) return false;
    if (this.coresDaPeca(item).length > 0) return true;
    return categoriaUsaCoresPorModelo(peca.categoria);
  }

  temCoresItem(item: BlingOrdemServicoItem): boolean {
    return this.precisaCorItem(item);
  }

  onVariacaoChange(item: BlingOrdemServicoItem, rotulo: string): void {
    item.variacaoRotulo = rotulo?.trim() || undefined;
    const peca = this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
    if (!peca) return;

    if (!item.variacaoRotulo) {
      item.descricao = item.cor ? `${peca.nome} (${item.cor})` : peca.nome;
      this.preencherValoresSugeridosEstoque(item, peca.valorSugeridoMinimo, peca.valorSugeridoTroca);
      return;
    }

    const variacao = peca.variacoes?.find(v => v.rotulo === item.variacaoRotulo);
    if (!variacao) return;

    item.descricao = `${peca.nome} — ${variacao.rotulo}`;
    if (item.cor) item.descricao += ` (${item.cor})`;
    this.preencherValoresSugeridosEstoque(
      item,
      variacao.valorSugeridoMinimo ?? peca.valorSugeridoMinimo,
      variacao.valorSugeridoTroca ?? peca.valorSugeridoTroca,
    );
  }

  variacoesDaPeca(item: BlingOrdemServicoItem): VariacaoServico[] {
    const peca = this.pecasDisponiveis.find(p => p.pecaId === item.pecaId);
    if (!peca?.variacoes?.length) return [];
    return [...peca.variacoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  temVariacoesItem(item: BlingOrdemServicoItem): boolean {
    return this.itemUsaCatalogo(item) && this.variacoesDaPeca(item).length > 0;
  }

  labelPecaOs(p: PecaValorInfo): string {
    return labelPecaCatalogo(p.nome, p.categoria, p.marcaPeca, {
      estoque: p.quantidadeEstoque,
      variacoes: p.variacoes?.length,
    });
  }

  detalheVariacaoSelecionada(item: BlingOrdemServicoItem): string | undefined {
    if (!item.variacaoRotulo) return undefined;
    return this.variacoesDaPeca(item).find(v => v.rotulo === item.variacaoRotulo)?.detalhe;
  }

  private atualizarCustoPecaReferencia(item: BlingOrdemServicoItem, pecaId: string): void {
    if (!pecaId?.trim() || item.origemPeca === 'externo') {
      item.custoPeca = undefined;
      return;
    }
    this.estoqueService.obterCustoReferenciaPeca(pecaId).subscribe({
      next: ref => { item.custoPeca = ref.custoUnitario; },
      error: () => {},
    });
  }

  diferencaPecaServico(item: BlingOrdemServicoItem): number | null {
    const total = item.valorAcontado ?? item.valorUnitario;
    if (total == null || item.custoPeca == null) return null;
    return total - item.custoPeca;
  }

  onOrigemPecaChange(item: BlingOrdemServicoItem): void {
    if (item.origemPeca === 'externo') {
      item.pecaId = undefined;
      item.marcaPeca = undefined;
      item.variacaoRotulo = undefined;
      item.cor = undefined;
      item.valorSugeridoMinimo = undefined;
      item.valorSugeridoTroca = undefined;
      item.quantidadeEstoqueBaixada = 0;
      item.estoqueInsuficiente = false;
      item.custoPeca = undefined;
      return;
    }

    item.fornecedorExterno = undefined;
    item.codigoRastreio = undefined;
    item.estoqueInsuficiente = false;
    if (!item.pecaId) {
      item.descricao = '';
    }
  }

  onFornecedorExternoChange(item: BlingOrdemServicoItem): void {
    if (!fornecedorPermiteRastreio(item.fornecedorExterno)) {
      item.codigoRastreio = undefined;
    }
  }

  isItemFornecedorExterno(item: BlingOrdemServicoItem): boolean {
    return this.isItemPeca(item) && item.origemPeca === 'externo';
  }

  itemUsaCatalogo(item: BlingOrdemServicoItem): boolean {
    return this.isItemPeca(item) && item.origemPeca !== 'externo';
  }

  itemMostraRastreio(item: BlingOrdemServicoItem): boolean {
    return this.isItemFornecedorExterno(item)
      && fornecedorPermiteRastreio(item.fornecedorExterno);
  }

  onValorAcontadoChange(item: BlingOrdemServicoItem): void {
    item.valorUnitario = item.valorAcontado ?? 0;
  }

  /** Aplica o % da loja sobre os preços base do estoque (mín./sugerido → cobrado). */
  private preencherValoresSugeridosEstoque(
    item: BlingOrdemServicoItem,
    minimo?: number | null,
    troca?: number | null,
  ): void {
    const loja = this.os.lojaOrigem;
    item.valorSugeridoMinimo = this.acrescimoEstoque.aplicarNoSugerido(minimo, loja);
    item.valorSugeridoTroca = this.acrescimoEstoque.aplicarNoSugerido(troca, loja);
    const cobrado = item.valorSugeridoTroca ?? item.valorSugeridoMinimo ?? 0;
    item.valorAcontado = cobrado;
    item.valorUnitario = cobrado;
  }

  private reaplicarAcrescimoEstoqueNosItens(): void {
    for (const item of this.os.itens ?? []) {
      if (!this.itemUsaCatalogo(item) || !item.pecaId) continue;
      const peca = this.pecaDoItem(item);
      if (!peca) continue;
      if (item.variacaoRotulo) {
        const v = peca.variacoes?.find(x => x.rotulo === item.variacaoRotulo);
        this.preencherValoresSugeridosEstoque(
          item,
          v?.valorSugeridoMinimo ?? peca.valorSugeridoMinimo,
          v?.valorSugeridoTroca ?? peca.valorSugeridoTroca,
        );
      } else {
        this.preencherValoresSugeridosEstoque(item, peca.valorSugeridoMinimo, peca.valorSugeridoTroca);
      }
    }
  }

  valorParcelaItem(item: BlingOrdemServicoItem): number | null {
    const valor = item.valorAcontado ?? item.valorUnitario;
    const parc = item.parcelamento;
    if (valor == null || !parc || parc < 2) return null;
    return valor / parc;
  }

  subtotalItem(item: BlingOrdemServicoItem): number {
    const unit = item.valorAcontado ?? item.valorUnitario ?? 0;
    return unit * (item.quantidade ?? 1);
  }

  get totalOsItens(): number {
    return (this.os.itens ?? []).reduce((s, i) => s + this.subtotalItem(i), 0);
  }

  formatarMoeda(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private prepararItensParaSalvar(): void {
    for (const item of this.os.itens ?? []) {
      if (item.valorAcontado != null) {
        item.valorUnitario = item.valorAcontado;
      } else if (item.valorUnitario != null) {
        item.valorAcontado = item.valorUnitario;
      }
      if (!this.isItemPeca(item)) continue;
      if (item.pecaId?.trim()) {
        item.tipoItem = 'peca';
        if (item.origemPeca !== 'externo') {
          item.origemPeca = 'estoque';
        }
      }
      if (item.origemPeca === 'externo') {
        item.pecaId = undefined;
        item.marcaPeca = undefined;
        item.valorSugeridoMinimo = undefined;
        item.valorSugeridoTroca = undefined;
        item.quantidadeEstoqueBaixada = 0;
        item.estoqueInsuficiente = false;
        if (!fornecedorPermiteRastreio(item.fornecedorExterno)) {
          item.codigoRastreio = undefined;
        }
      } else {
        item.fornecedorExterno = undefined;
        item.codigoRastreio = undefined;
      }
    }
    if (this.os.valorTotalAcordado == null) {
      this.os.valorTotalAcordado = this.totalOsItens;
    }
    this.os.valorTotal = this.os.valorTotalAcordado;
    this.os.formaPagamento = normalizarFormaPagamentoOs(this.os.formaPagamento) || undefined;
    if (!this.exigeParcelasPagamento()) {
      this.os.parcelasPagamento = undefined;
    }
  }

  onFormaPagamentoChange(forma: string): void {
    if (forma !== 'avista' && forma !== 'parcelado') return;
    this.onFormaPagamentoChangeInterno(forma);
  }

  private onFormaPagamentoChangeInterno(forma: 'avista' | 'parcelado'): void {
    this.os.formaPagamento = forma;
    if (forma === 'avista') {
      this.os.parcelasPagamento = undefined;
    } else if (!this.os.parcelasPagamento || this.os.parcelasPagamento < 2) {
      this.os.parcelasPagamento = 2;
    }
  }

  onTemRiscoChange(): void {
    if (!this.os.temRisco) {
      this.os.riscoAcordado = undefined;
    }
    this.cdr.markForCheck();
  }

  recalcularValorTotalAcordado(): void {
    this.os.valorTotalAcordado = this.totalOsItens;
  }

  exigeParcelasPagamento(): boolean {
    return formaPagamentoPermiteParcelas(this.os.formaPagamento);
  }

  valorParcelaPagamento(): number | null {
    const total = this.os.valorTotalAcordado ?? this.totalOsItens;
    const parc = this.os.parcelasPagamento;
    if (total == null || !parc || parc < 2) return null;
    return total / parc;
  }

  labelEstoqueItem(item: BlingOrdemServicoItem): string {
    if (!this.isItemPeca(item)) return '';
    return labelOrigemPeca(item);
  }

  estoqueItemClasse(item: BlingOrdemServicoItem): string {
    if (!this.isItemPeca(item)) return '';
    if (item.origemPeca === 'externo') return 'os-item-origem-externo';
    if ((item.quantidadeEstoqueBaixada ?? 0) >= item.quantidade) return 'os-item-estoque-ok';
    if (item.estoqueInsuficiente) return 'os-item-estoque-sem';
    return 'os-item-estoque-pendente';
  }

  isItemPeca(item: BlingOrdemServicoItem): boolean {
    // pecaId em linha de serviço = só referência de catálogo (ex.: convertido de pré-orçamento).
    if (item.tipoItem === 'servico') return false;
    return item.tipoItem === 'peca' || !!item.pecaId;
  }

  removerItem(index: number): void { this.os.itens?.splice(index, 1); }

  onFotosAlteradas(fotos: BlingOrdemServico['fotosAparelho']): void {
    this.os.fotosAparelho = fotos;
  }

  /** Só atualiza fotos — não sobrescreve campos em edição. */
  recarregarFotos(): void {
    if (!this.os.id) return;
    this.service.invalidarObterCache(this.os.id);
    this.service.obter(this.os.id).subscribe({
      next: os => {
        const novas = [...(os.fotosAparelho ?? [])];
        const antigas = this.os.fotosAparelho ?? [];
        const chave = (lista: typeof novas) =>
          lista
            .map(f => `${f.id}:${f.categoria ?? ''}:${f.descricaoFoco ?? ''}`)
            .sort()
            .join('|');
        if (chave(novas) === chave(antigas)) return;
        this.os.fotosAparelho = novas;
        this.cdr.markForCheck();
      },
    });
  }

  get tipoServicoSelecionado() {
    return obterTipoServicoOs(this.os.tipoServico);
  }

  onTipoServicoChange(id: string): void {
    this.os.tipoServico = id?.trim() || undefined;
    const tipo = obterTipoServicoOs(this.os.tipoServico);
    if (tipo) {
      this.os.testeEntrada = tipo.testeEntrada;
      this.os.testeSaida = tipo.testeSaida;
      if (!tipo.testeEntrada) this.os.testeEntradaRealizado = false;
      if (!tipo.testeSaida) this.os.testeSaidaRealizado = false;
    } else {
      this.os.testeEntrada = false;
      this.os.testeSaida = false;
      this.os.testeEntradaRealizado = false;
      this.os.testeSaidaRealizado = false;
    }
  }

  onSenhaTipoChange(tipo: SenhaDispositivoTipo): void {
    this.os.senhaDispositivoTipo = tipo === '' ? undefined : tipo;
    if (tipo === 'nao_deixou') {
      this.os.senhaDispositivo = 'nao_deixou';
    } else if (tipo === 'sem_senha') {
      this.os.senhaDispositivo = 'sem_senha';
    } else if (this.os.senhaDispositivo === 'nao_deixou' || this.os.senhaDispositivo === 'sem_senha') {
      this.os.senhaDispositivo = undefined;
    }
  }

  onSenhaValorChange(valor: string): void {
    this.os.senhaDispositivo = valor || undefined;
  }

  /** Tipo escolhido; se for senha/desenho, também exige o valor. */
  private senhaDispositivoInformada(): boolean {
    const tipo = this.os.senhaDispositivoTipo?.trim();
    if (tipo === 'sem_senha' || tipo === 'nao_deixou') return true;
    if (tipo === 'numerica' || tipo === 'desenho') {
      const valor = this.os.senhaDispositivo?.trim();
      return !!valor && valor !== 'nao_deixou' && valor !== 'sem_senha';
    }
    return false;
  }

  private normalizarTipoSenhaCarregado(
    tipo?: string | null,
  ): '' | 'numerica' | 'desenho' | 'nao_deixou' | 'sem_senha' | undefined {
    const t = tipo?.trim();
    if (t === 'numerica' || t === 'desenho' || t === 'nao_deixou' || t === 'sem_senha') return t;
    return undefined;
  }

  private mensagemErroSenha(): string {
    const tipo = this.os.senhaDispositivoTipo?.trim();
    if (!tipo) return 'Selecione o tipo de senha do aparelho.';
    if (tipo === 'numerica') return 'Informe a senha (números e/ou letras).';
    if (tipo === 'desenho') return 'Registre o desenho de desbloqueio.';
    return 'Selecione o tipo de senha do aparelho.';
  }

  async onSituacaoChange(novaSituacao: string): Promise<void> {
    const anterior = this.os.situacao || situacaoPadraoPorLoja(this.os.lojaOrigem);
    const situacaoNormalizada = ajustarSituacaoParaLoja(novaSituacao, this.os.lojaOrigem);
    const tecnicoAnterior = this.os.tecnicoNome;
    const osLabel = this.os.numero
      ? `OS #${this.os.numero}`
      : (this.os.id ? `OS #${this.os.id}` : 'Nova OS');

    if (osSituacaoCancelada(situacaoNormalizada) && !osSituacaoCancelada(anterior)) {
      const motivo = await this.situacaoDialog.openCancelar({
        osLabel,
        motivoAtual: this.os.motivoCancelamento,
      });
      if (!motivo) {
        this.os.situacao = anterior;
        this.cdr.markForCheck();
        return;
      }
      this.os.motivoCancelamento = motivo;
    } else if (!osSituacaoCancelada(situacaoNormalizada)) {
      this.os.motivoCancelamento = undefined;
    }

    if (osSituacaoConcluida(situacaoNormalizada) && !osSituacaoConcluida(anterior)) {
      const ok = await this.situacaoDialog.openConcluir({ osLabel });
      if (!ok) {
        this.os.situacao = anterior;
        this.cdr.markForCheck();
        return;
      }
      this.conclusaoConfirmada = true;
    } else if (!osSituacaoConcluida(situacaoNormalizada)) {
      this.conclusaoConfirmada = false;
    }

    if (osPrecisaEscolherTecnico(situacaoNormalizada, this.os.tecnicoNome, this.tecnicosAtivos)) {
      const escolhido = await this.tecnicoDialog.open({
        tecnicos: this.tecnicosAtivos,
        tecnicoAtual: this.os.tecnicoNome,
        situacao: situacaoNormalizada,
        osLabel,
      });
      if (!escolhido) {
        this.os.situacao = anterior;
        this.os.tecnicoNome = tecnicoAnterior;
        this.cdr.markForCheck();
        return;
      }
      this.os.tecnicoNome = escolhido;
    }

    this.os.situacao = situacaoNormalizada;

    if (situacaoNormalizada !== anterior) {
      this.os.justificativasAtraso = [];
      this.novaJustificativaAtraso = '';
    }

    if (osSituacaoAguardandoPeca(situacaoNormalizada) && !this.dataValida(this.os.dataPrazoPeca)) {
      this.os.dataPrazoPeca = prazoPecaPadraoDatetimeLocal();
    }

    if (!osSituacaoConcluida(situacaoNormalizada)) return;

    const agora = this.agoraDatetimeLocal();
    if (!this.dataValida(this.os.dataSaida)) this.os.dataSaida = agora;
    if (!this.dataValida(this.os.dataConclusao)) this.os.dataConclusao = agora;
  }

  adicionarJustificativaAtraso(): void {
    if (this.somenteLeitura) return;
    const texto = this.novaJustificativaAtraso.trim();
    if (texto.length < 5) {
      alert('Informe a justificativa do atraso (mínimo 5 caracteres).');
      return;
    }
    this.os.justificativasAtraso = [
      ...(this.os.justificativasAtraso ?? []),
      { texto, criadoEm: new Date().toISOString() },
    ];
    this.novaJustificativaAtraso = '';
  }

  removerJustificativaAtraso(indice: number): void {
    if (this.somenteLeitura) return;
    const lista = [...(this.os.justificativasAtraso ?? [])];
    lista.splice(indice, 1);
    this.os.justificativasAtraso = lista;
  }

  onLojaOrigemChange(loja: string): void {
    if (this.lojaCriacaoTravada) return;
    this.os.lojaOrigem = normalizarLojaOs(loja);
    this.os.situacao = ajustarSituacaoParaLoja(this.os.situacao, this.os.lojaOrigem);
    this.reaplicarAcrescimoEstoqueNosItens();
  }

  private carregarTecnicos(): void {
    this.tecnicosService.listar(true).subscribe({
      next: (lista) => {
        this.tecnicosAtivos = lista;
        this.cdr.markForCheck();
      },
      error: () => {
        this.tecnicosAtivos = [];
      },
    });
  }

  private tecnicoSelecionadoValido(): boolean {
    const nome = this.os.tecnicoNome?.trim();
    if (!nome) return false;
    return this.tecnicosAtivos.some(t => t.nome.toLowerCase() === nome.toLowerCase());
  }

  private dataValida(valor?: string): boolean {
    if (!valor?.trim()) return false;
    const d = new Date(valor);
    return !Number.isNaN(d.getTime()) && d.getFullYear() >= 2000;
  }

  private validarOs(): string | null {
    const faltando: string[] = [];
    if (this.os.contato?.id == null) faltando.push('cliente');
    if (!this.os.modeloId) faltando.push('modelo do aparelho');
    if (!this.os.tipoServico?.trim()) faltando.push('tipo de serviço');
    if (!this.os.estadoTela?.trim()) faltando.push('estado da tela');
    if (!this.os.condicoesAparelho?.trim()) faltando.push('condições gerais do aparelho');
    if (!this.os.defeito?.trim()) faltando.push('defeito relatado pelo cliente');
    if (this.os.temRisco && !this.os.riscoAcordado?.trim()) faltando.push('risco acordado');
    if (!this.os.formaPagamento?.trim()) faltando.push('forma de pagamento combinada');
    if (!this.senhaDispositivoInformada()) faltando.push('tipo de senha do aparelho');

    const pecaEstoqueSemCatalogo = (this.os.itens ?? []).some(
      i => this.isItemPeca(i) && i.origemPeca !== 'externo' && !i.pecaId?.trim(),
    );
    if (pecaEstoqueSemCatalogo) faltando.push('peça do catálogo nos itens');
    const pecaSemCor = (this.os.itens ?? []).some(
      i => this.isItemPeca(i) && this.precisaCorItem(i) && !i.cor?.trim(),
    );
    if (pecaSemCor) faltando.push('cor da peça (tampa/vidro traseiro)');
    const pecaCorSemEstoque = (this.os.itens ?? []).some(
      i => this.isItemPeca(i) && this.precisaCorItem(i) && !!i.cor?.trim()
        && this.coresDaPeca(i).length > 0 && !this.corItemDisponivel(i)
        && (i.quantidadeEstoqueBaixada ?? 0) === 0,
    );
    if (pecaCorSemEstoque) faltando.push('cor com estoque disponível');
    const pecaExternaSemNome = (this.os.itens ?? []).some(
      i => this.isItemPeca(i) && i.origemPeca === 'externo' && !i.descricao?.trim(),
    );
    if (pecaExternaSemNome) faltando.push('nome da peça externa');
    const externoSemFornecedor = (this.os.itens ?? []).some(
      i => this.isItemPeca(i) && i.origemPeca === 'externo' && !i.fornecedorExterno?.trim(),
    );
    if (externoSemFornecedor) faltando.push('fornecedor da peça externa');
    if (this.temItensPeca && !this.os.modeloId) {
      faltando.push('modelo do aparelho (obrigatório para peças)');
    }
    if (this.os.retorno) {
      if (!this.os.motivoRetorno?.trim()) faltando.push('motivo do retorno');
      if (!this.os.osOriginalBlingId && !this.os.osOriginalNumero?.trim()) {
        faltando.push('OS original do retorno');
      }
    }

    if (formaPagamentoPermiteParcelas(this.os.formaPagamento)) {
      if (!this.os.parcelasPagamento || this.os.parcelasPagamento < 2) {
        faltando.push('quantidade de parcelas');
      }
    }

    if (osSituacaoCancelada(this.os.situacao) && !this.os.motivoCancelamento?.trim()) {
      faltando.push('motivo do cancelamento');
    }

    if (osSituacaoAguardandoPeca(this.os.situacao) && !this.dataValida(this.os.dataPrazoPeca)) {
      faltando.push('prazo da peça');
    }

    if (this.tecnicoObrigatorio && !this.tecnicoSelecionadoValido()) {
      faltando.push('técnico responsável');
    }

    if (faltando.length === 0) return null;
    return `Preencha os campos obrigatórios: ${faltando.join(', ')}.`;
  }

  async salvar(event?: Event): Promise<void> {
    if (this.somenteLeitura) return;
    event?.preventDefault();
    this.tentouSalvar = true;
    this.errosApiPorCampo = {};
    const validacao = this.validarOs();
    if (validacao) {
      this.erro = validacao;
      this.cdr.markForCheck();
      this.scrollParaPrimeiroErro();
      return;
    }

    if (
      osSituacaoConcluida(this.os.situacao)
      && !osSituacaoConcluida(this.situacaoAoCarregar)
      && !this.conclusaoConfirmada
    ) {
      const osLabel = this.os.numero
        ? `OS #${this.os.numero}`
        : (this.os.id ? `OS #${this.os.id}` : 'esta OS');
      const ok = await this.situacaoDialog.openConcluir({ osLabel });
      if (!ok) return;
      this.conclusaoConfirmada = true;
      const agora = this.agoraDatetimeLocal();
      if (!this.dataValida(this.os.dataSaida)) this.os.dataSaida = agora;
      if (!this.dataValida(this.os.dataConclusao)) this.os.dataConclusao = agora;
    }

    this.salvando = true;
    this.erro = '';
    if (this.novaJustificativaAtraso.trim().length >= 5) {
      this.adicionarJustificativaAtraso();
    }
    this.prepararItensParaSalvar();
    const op = this.editando
      ? this.service.atualizar(this.os.id!, this.os)
      : this.service.criar(this.os);

    op.subscribe({
      next: (salva) => {
        this.salvando = false;
        this.tentouSalvar = false;
        this.errosApiPorCampo = {};
        if (!this.editando && salva.id) {
          const orcId = this.orcamentoOrigemId;
          if (orcId) {
            this.orcamentosService.vincularOs(orcId, salva.id, salva.numero).subscribe({
              error: err => console.warn('[orçamento] falha ao vincular OS', err),
            });
            this.orcamentoOrigemId = undefined;
            this.orcamentoOrigemNumero = undefined;
          }
          this.service.seedObter(salva);
          if (salva.modeloId) this.carregarPecasModelo(salva.modeloId);
          this.router.navigate(['/ordens-servico', salva.id, 'editar'], {
            replaceUrl: true,
            state: { abrirModalIntake: true, fluxoPosCriacao: true },
          });
          return;
        }
        // Normaliza datas/itens como no carregamento — evita datetime-local quebrado na edição.
        this.aplicarOsNaForm(salva);
        this.service.seedObter(this.os);
        this.aparelhosService.limparCacheReferencia();
        if (this.os.modeloId) this.carregarPecasModelo(this.os.modeloId);
        const semEstoque = (this.os.itens ?? []).some(i => i.estoqueInsuficiente);
        if (semEstoque) {
          this.erro = 'OS salva, mas uma ou mais peças não tiveram baixa no estoque (saldo insuficiente).';
        }
        if (this.os.id) this.modalIntakeAberto = true;
        this.cdr.markForCheck();
      },
      error: (err) => {
        const msg = err.error?.erro || 'Erro ao salvar OS.';
        this.erro = msg;
        this.mapearErroApi(msg);
        this.tentouSalvar = true;
        this.salvando = false;
        this.cdr.markForCheck();
        this.scrollParaPrimeiroErro();
      },
    });
  }

  private mapearErroApi(mensagem: string): void {
    this.errosApiPorCampo = {};
    const regras: [RegExp, string][] = [
      [/cliente/i, 'cliente'],
      [/modelo/i, 'modelo'],
      [/tipo de servi[cç]o/i, 'tipoServico'],
      [/estado da tela/i, 'estadoTela'],
      [/condi[cç][oõ]es gerais/i, 'condicoesAparelho'],
      [/defeito/i, 'defeito'],
      [/risco/i, 'riscoAcordado'],
      [/forma de pagamento/i, 'formaPagamento'],
      [/motivo do retorno/i, 'motivoRetorno'],
      [/os original/i, 'osOriginal'],
    ];
    for (const [re, campo] of regras) {
      if (re.test(mensagem)) {
        this.errosApiPorCampo[campo] = mensagem;
        return;
      }
    }
  }

  cancelar(): void { this.router.navigate(['/ordens-servico']); }

  editarOs(): void {
    if (this.os.id) this.router.navigate(['/ordens-servico', this.os.id, 'editar']);
  }

  abrirHistorico(): void {
    if (this.os.id) void this.router.navigate(['/ordens-servico', this.os.id, 'historico']);
  }

  excluirOs(): void {
    if (!this.os.id || this.excluindoOs) return;
    const num = this.os.numero || this.os.id;
    if (!confirm(`Excluir a OS #${num}?\n\nEla sai da lista, mas permanece no histórico de versões.`)) return;

    this.excluindoOs = true;
    this.erro = '';
    this.service.excluir(this.os.id).subscribe({
      next: () => {
        this.excluindoOs = false;
        void this.router.navigate(['/ordens-servico']);
      },
      error: err => {
        this.excluindoOs = false;
        this.erro = err.error?.erro || 'Não foi possível excluir a OS.';
        this.cdr.markForCheck();
      },
    });
  }

  private scrollParaPrimeiroErro(): void {
    setTimeout(() => {
      for (const id of this.ordemCamposValidacao) {
        if (!this.temErroCampo(id)) continue;
        this.scrollParaCampo(id);
        break;
      }
    });
  }

  scrollParaModelo(): void {
    this.scrollParaCampo('modelo');
  }

  private scrollParaCampo(campo: string): void {
    const alvo = document.querySelector(`.os-form [data-campo="${campo}"]`);
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private exigirModeloParaPeca(): boolean {
    if (this.os.modeloId?.trim()) return true;
    this.bloqueioPecaSemModelo = true;
    this.erro = 'Selecione o modelo do aparelho na seção Equipamento antes de adicionar peças.';
    this.cdr.markForCheck();
    this.scrollParaCampo('modelo');
    return false;
  }
}
