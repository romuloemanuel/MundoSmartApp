import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AparelhosService } from '../../services/aparelhos';
import {
  AlertaOperacionalInfo,
  ModeloOperacaoResponse,
  ModeloServicosValoresResponse,
  PecaEstoqueOperacaoInfo,
  PecaValorInfo,
  VariacaoServico,
} from '../../models/bling.models';
import { ESTOQUE_NIVEL_CLASSES, NivelEstoque, getEstoqueConfig, nivelEstoqueDeQuantidade } from '../../config/estoque.config';
import { osSituacaoFinalizada } from '../../pages/ordens-servico/os-situacao.util';

@Component({
  selector: 'app-modelo-referencia-panel',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <aside class="ref-panel" [class.ref-panel-inline]="inline">
      <div class="ref-panel-header">
        <span class="ref-panel-titulo">Painel do aparelho</span>
        <span class="ref-panel-subtitulo" *ngIf="marcaNome || modeloNome">
          {{ marcaNome }} {{ modeloNome }}
        </span>
      </div>

      <div class="ref-aguardando" *ngIf="!modeloId">
        Selecione o <strong>modelo</strong> acima para ver serviços, fila na assistência e alertas do dia.
      </div>

      <div class="ref-estoque-legenda" *ngIf="modeloId">
        <span [ngClass]="ESTOQUE_NIVEL_CLASSES.vermelho">0 Sem estoque</span>
        <span [ngClass]="ESTOQUE_NIVEL_CLASSES.laranja">{{ limitesEstoque.limiteLaranja }} Estoque abaixo do mínimo</span>
        <span [ngClass]="ESTOQUE_NIVEL_CLASSES.amarelo">{{ limitesEstoque.limiteAmarelo }} Estoque mínimo</span>
        <span [ngClass]="ESTOQUE_NIVEL_CLASSES.verde">{{ limitesEstoque.limiteAmarelo }} Estoque normal</span>
      </div>

      <div class="ref-split" *ngIf="modeloId">
          <!-- Coluna esquerda: valores para orçamento -->
          <section class="ref-col ref-col-servicos">
            <h3 class="ref-secao-titulo">Serviços disponíveis</h3>

            <div class="ref-loading ref-loading-col" *ngIf="carregandoValores && !valores">
              Carregando valores...
            </div>

            <div class="ref-erro ref-erro-col" *ngIf="erroValores && !valores">{{ erroValores }}</div>

            <ng-container *ngIf="valores">
              <div class="ref-vazio" *ngIf="!valores.pecas.length">
                Nenhum serviço cadastrado.
              </div>

              <div class="ref-servicos-scroll" *ngIf="valores.pecas.length">
                <div
                  *ngFor="let peca of valores.pecas"
                  class="ref-servico-grupo"
                  [ngClass]="classeBordaServico(peca.pecaId, peca.quantidadeEstoque)"
                >
                  <div class="ref-servico-grupo-topo">
                    <span class="ref-servico-grupo-nome">{{ peca.nome }}</span>
                    <span class="ref-servico-grupo-estoque">
                      <span [ngClass]="classeNivel(peca.nivelEstoque, peca.quantidadeEstoque)">
                        {{ peca.quantidadeEstoque }} est.
                      </span>
                      <ng-container *ngIf="resumoPeca(peca.pecaId) as resumo">
                        <span *ngIf="resumo.emExecucao > 0" class="ref-servico-grupo-exec">· {{ resumo.emExecucao }} srv</span>
                      </ng-container>
                    </span>
                  </div>

                  <div class="ref-produto-precos" *ngIf="!temVariacoesServico(peca)">
                    <span class="ref-preco-min" *ngIf="peca.valorSugeridoMinimo != null">
                      mín {{ peca.valorSugeridoMinimo | currency:'BRL':'symbol':'1.0-0' }}
                    </span>
                    <span class="ref-preco-sug" *ngIf="peca.valorSugeridoTroca != null">
                      sug {{ peca.valorSugeridoTroca | currency:'BRL':'symbol':'1.0-0' }}
                    </span>
                    <span class="ref-variacao-gar" *ngIf="peca.garantia">{{ peca.garantia }}</span>
                  </div>

                  <div class="ref-cores" *ngIf="peca.cores?.length">
                    <span class="ref-cor-chip" *ngFor="let c of peca.cores">
                      {{ c.cor }} · {{ c.quantidade }}
                    </span>
                  </div>

                  <div class="ref-variacoes" *ngIf="temVariacoesServico(peca)">
                    <div class="ref-variacoes-cabeca">
                      <span>Procedimento</span>
                      <span>Preços</span>
                      <span>Gar.</span>
                    </div>
                    <div
                      *ngFor="let v of variacoesServico(peca)"
                      class="ref-variacao-linha"
                      [class.ref-variacao-com-obs]="v.detalhe"
                    >
                      <div class="ref-variacao-rotulo-linha">
                        <span class="ref-variacao-alerta" *ngIf="v.detalhe" aria-hidden="true" title="Lembrete para o atendimento">!</span>
                        <span class="ref-variacao-rotulo">{{ v.rotulo }}</span>
                      </div>
                      <span class="ref-variacao-precos">
                        <span class="ref-preco-min" *ngIf="precoMinimo(v, peca) != null">
                          mín {{ precoMinimo(v, peca) | currency:'BRL':'symbol':'1.0-0' }}
                        </span>
                        <span class="ref-preco-sug" *ngIf="precoSugerido(v, peca) != null">
                          sug {{ precoSugerido(v, peca) | currency:'BRL':'symbol':'1.0-0' }}
                        </span>
                      </span>
                      <span class="ref-variacao-gar" *ngIf="v.garantia || peca.garantia">
                        {{ v.garantia || peca.garantia }}
                      </span>
                      <p class="ref-variacao-lembrete" *ngIf="v.detalhe">{{ v.detalhe }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>
          </section>

          <!-- Coluna direita: fila e operação do dia -->
          <section class="ref-col ref-col-operacao">
            <div class="ref-loading ref-loading-col" *ngIf="carregandoOperacao && !operacao">
              Consultando fila na assistência...
            </div>

            <div class="ref-erro ref-erro-col" *ngIf="erroOperacao && !operacao">{{ erroOperacao }}</div>

            <ng-container *ngIf="operacao">
            <div class="ref-resumo">
              <div class="ref-resumo-card">
                <span class="ref-resumo-valor">{{ operacao.osAbertasHoje }}</span>
                <span class="ref-resumo-label">OS abertas hoje</span>
              </div>
              <div class="ref-resumo-card">
                <span class="ref-resumo-valor">{{ operacao.osModeloEmAssistencia }}</span>
                <span class="ref-resumo-label">{{ modeloNome || 'Modelo' }} na assistência</span>
              </div>
            </div>

            <div class="ref-alertas" *ngIf="alertasVisiveis.length">
              <h3 class="ref-secao-titulo">Alertas para o atendimento</h3>
              <div
                *ngFor="let alerta of alertasVisiveis"
                class="ref-alerta-card"
                [class.ref-alerta-critico]="alerta.severidade === 'critico'"
                [class.ref-alerta-atencao]="alerta.severidade === 'atencao'"
                [class.ref-alerta-aviso]="alerta.severidade === 'aviso'"
                [class.ref-alerta-destaque-tela]="alerta.relacionadoTela && alertaTelaCliente"
              >
                <strong>{{ alerta.titulo }}</strong>
                <p>{{ alerta.mensagem }}</p>
              </div>
            </div>

            <div class="ref-alerta-cliente-tela" *ngIf="alertaTelaCliente && !temAlertaTelaBackend">
              <strong>Possível problema na tela nesta OS</strong>
              <p>Verifique a fila e o estoque de telas antes de prometer prazo curto ao cliente.</p>
            </div>

            <h3 class="ref-secao-titulo ref-secao-titulo-fila">
              Na assistência ({{ operacao.osModeloEmAssistencia }})
            </h3>
            <p class="ref-secao-desc">Mesmo modelo — serviço e reclamação do cliente.</p>

            <div class="ref-vazio" *ngIf="!operacao.osEmAndamento.length">
              Nenhuma OS em andamento para este modelo.
            </div>

            <div class="ref-os-lista" *ngIf="operacao.osEmAndamento.length">
              <div *ngFor="let os of operacao.osEmAndamento" class="ref-os-card">
                <div class="ref-os-topo">
                  <a class="ref-os-num" [routerLink]="['/ordens-servico', os.blingId]">
                    OS #{{ os.osNumero || os.blingId }}
                  </a>
                  <span class="ref-os-situacao" [class]="situacaoClass(os.situacao)">
                    {{ os.situacao || 'Aberto' }}
                  </span>
                </div>
                <div class="ref-os-servico" *ngIf="os.tipoPecaProblemaNome">
                  <span class="ref-label">Serviço:</span> {{ os.tipoPecaProblemaNome }}
                </div>
                <div class="ref-os-defeito" *ngIf="os.defeito">
                  <span class="ref-label">Reclamação:</span> {{ os.defeito }}
                </div>
                <div class="ref-os-defeito" *ngIf="os.estadoTela">
                  <span class="ref-label">Tela:</span> {{ os.estadoTela }}
                </div>
                <div class="ref-os-data" *ngIf="os.dataEntrada">
                  Entrada: {{ os.dataEntrada | date:'dd/MM/yyyy' }}
                </div>
              </div>
            </div>
            </ng-container>
          </section>
        </div>
    </aside>
  `,
  styles: [`
    .ref-panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .ref-panel-inline {
      border: 2px solid #2563EB;
      background: #f8fbff;
    }

    .ref-aguardando {
      font-size: 13px;
      color: #6b7280;
      background: #fff;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      line-height: 1.5;
    }

    .ref-erro {
      font-size: 13px;
      color: #b91c1c;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      padding: 12px 14px;
    }

    .ref-panel-header {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid #2563EB;
    }

    .ref-panel-titulo {
      display: block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #2563EB;
    }

    .ref-panel-subtitulo {
      display: block;
      font-size: 15px;
      font-weight: 700;
      color: #1a1a1a;
      margin-top: 2px;
    }

    .ref-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #9ca3af;
      padding: 8px 0;
    }

    .ref-loading-col {
      font-size: 12px;
      padding: 10px 8px;
      color: #6b7280;
    }

    .ref-erro-col {
      font-size: 12px;
      margin-bottom: 8px;
    }

    .ref-split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }

    @media (max-width: 860px) {
      .ref-split { grid-template-columns: 1fr; }
    }

    .ref-col {
      min-width: 0;
    }

    .ref-col-servicos {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .ref-col-operacao {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
    }

    .ref-secao-titulo {
      font-size: 12px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 2px;
    }

    .ref-secao-titulo-fila { margin-top: 8px; }

    .ref-secao-desc {
      font-size: 10px;
      color: #6b7280;
      margin: 0 0 6px;
      line-height: 1.3;
    }

    .ref-vazio {
      font-size: 12px;
      color: #9ca3af;
      font-style: italic;
      padding: 8px;
      background: #f9fafb;
      border-radius: 6px;
      text-align: center;
    }

    .ref-servicos-scroll {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 420px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .ref-estoque-legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
      font-size: 10px;
    }

    .ref-estoque-legenda span {
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-weight: 600;
    }

    .ref-servico-grupo {
      border: 1px solid #eef2f7;
      border-radius: 6px;
      background: #fafbfc;
      padding: 3px 8px 4px;
    }

    .ref-servico-nivel-vermelho {
      border-color: #fca5a5 !important;
      background: #fef2f2 !important;
    }

    .ref-servico-nivel-laranja {
      border-color: #fdba74 !important;
      background: #fff7ed !important;
    }

    .ref-servico-nivel-amarelo {
      border-color: #fde047 !important;
      background: #fefce8 !important;
    }

    .ref-servico-grupo-topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 1px;
    }

    .ref-servico-grupo-nome {
      font-size: 10px;
      font-weight: 800;
      color: #1f2937;
      line-height: 1.2;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      flex: 1;
      min-width: 0;
      white-space: normal;
      word-break: break-word;
    }

    .ref-servico-grupo-estoque {
      font-size: 9px;
      color: #6b7280;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .ref-servico-grupo-estoque span {
      font-weight: 600;
      padding: 0 4px;
      border-radius: 999px;
      border: 1px solid transparent;
    }

    .ref-servico-grupo-exec { font-weight: 500; }

    .ref-servico-grupo-disp { font-weight: 700; }

    .ref-variacoes {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-top: 1px;
    }

    .ref-variacoes-cabeca {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #9ca3af;
      padding: 0 0 1px;
    }

    .ref-produto-precos {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: baseline;
      font-size: 13px;
      padding-top: 0;
      line-height: 1.1;
    }

    .ref-cores {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }

    .ref-cor-chip {
      font-size: 11px;
      padding: 2px 7px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      color: #334155;
      white-space: nowrap;
    }

    .ref-preco-min {
      font-size: 12px;
      font-weight: 700;
      color: #b45309;
      white-space: nowrap;
    }

    .ref-preco-sug {
      font-size: 15px;
      font-weight: 800;
      color: #16a34a;
      white-space: nowrap;
    }

    .ref-variacao-linha {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 2px 8px;
      align-items: start;
      font-size: 11px;
      line-height: 1.25;
      padding: 2px 0;
      border-top: 1px dashed #e5e7eb;
      min-height: 0;
    }

    .ref-variacao-linha:first-child { border-top: none; }

    .ref-variacao-com-obs .ref-variacao-rotulo {
      font-weight: 600;
    }

    .ref-variacao-rotulo-linha {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      min-width: 0;
    }

    .ref-variacao-alerta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ffedd5;
      color: #ea580c;
      font-size: 9px;
      font-weight: 800;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .ref-variacao-lembrete {
      grid-column: 1 / -1;
      margin: 0;
      padding: 2px 5px 3px 7px;
      font-size: 10px;
      line-height: 1.35;
      color: #9a3412;
      font-weight: 500;
      background: #fff7ed;
      border-radius: 3px;
      border-left: 2px solid #f97316;
      width: 100%;
      box-sizing: border-box;
      white-space: normal;
      word-break: break-word;
    }

    .ref-variacao-rotulo {
      color: #374151;
      font-weight: 500;
      font-size: 11px;
      line-height: 1.25;
      white-space: normal;
      word-break: break-word;
    }

    .ref-variacao-precos {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
      line-height: 1.1;
      white-space: nowrap;
      padding-top: 1px;
    }

    .ref-variacao-valor {
      font-weight: 800;
      color: #16a34a;
      white-space: nowrap;
    }

    .ref-variacao-sem-valor { color: #9ca3af; font-weight: 600; }

    .ref-variacao-gar {
      font-size: 9px;
      font-weight: 600;
      color: #7c3aed;
      background: #f5f3ff;
      padding: 0 5px;
      border-radius: 999px;
      white-space: nowrap;
      justify-self: end;
    }

    .ref-resumo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 8px;
    }

    .ref-resumo-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      text-align: center;
    }

    .ref-resumo-valor {
      display: block;
      font-size: 20px;
      font-weight: 800;
      color: #2563EB;
      line-height: 1;
    }

    .ref-resumo-label {
      display: block;
      margin-top: 2px;
      font-size: 9px;
      font-weight: 600;
      color: #6b7280;
      line-height: 1.2;
    }

    .ref-alertas { margin-bottom: 6px; }

    .ref-alerta-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 3px solid #f59e0b;
      border-radius: 6px;
      padding: 6px 8px;
      margin-bottom: 5px;
      font-size: 11px;
      line-height: 1.35;
    }

    .ref-alerta-card strong {
      display: block;
      font-size: 11px;
      margin-bottom: 2px;
      color: #92400e;
    }

    .ref-alerta-card p { margin: 0; color: #78350f; }

    .ref-alerta-atencao {
      background: #fff7ed;
      border-color: #fdba74;
      border-left-color: #ea580c;
    }

    .ref-alerta-atencao strong { color: #9a3412; }
    .ref-alerta-atencao p { color: #7c2d12; }

    .ref-alerta-aviso {
      background: #fefce8;
      border-color: #fde047;
      border-left-color: #ca8a04;
    }

    .ref-alerta-aviso strong { color: #a16207; }
    .ref-alerta-aviso p { color: #854d0e; }

    .ref-alerta-critico {
      background: #fef2f2;
      border-color: #fca5a5;
      border-left-color: #dc2626;
    }

    .ref-alerta-critico strong { color: #991b1b; }
    .ref-alerta-critico p { color: #7f1d1d; }

    .ref-alerta-destaque-tela {
      box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.25);
    }

    .ref-alerta-cliente-tela {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 6px;
      padding: 6px 8px;
      margin-bottom: 6px;
      font-size: 11px;
      line-height: 1.35;
    }

    .ref-alerta-cliente-tela strong {
      display: block;
      color: #991b1b;
      margin-bottom: 4px;
    }

    .ref-alerta-cliente-tela p { margin: 0; color: #7f1d1d; }

    .ref-os-lista {
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: 220px;
      overflow-y: auto;
    }

    .ref-os-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 11px;
    }

    .ref-os-topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 3px;
    }

    .ref-os-num {
      font-weight: 700;
      color: #2563EB;
      text-decoration: none;
      font-size: 12px;
    }

    .ref-os-num:hover { text-decoration: underline; }

    .ref-os-situacao {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }

    .ref-sit-aberto { background: #dbeafe; color: #1d4ed8; }
    .ref-sit-andamento { background: #fef3c7; color: #b45309; }
    .ref-sit-outro { background: #f3f4f6; color: #4b5563; }

    .ref-label { font-weight: 600; color: #6b7280; }

    .ref-os-servico, .ref-os-defeito {
      margin-top: 2px;
      color: #374151;
      line-height: 1.35;
      white-space: normal;
      word-break: break-word;
    }

    .ref-os-data {
      margin-top: 3px;
      font-size: 10px;
      color: #9ca3af;
    }
  `]
})
export class ModeloReferenciaPanel implements OnChanges, OnDestroy {
  readonly ESTOQUE_NIVEL_CLASSES = ESTOQUE_NIVEL_CLASSES;

  @Input() inline = false;
  @Input() marcaNome?: string;
  @Input() modeloNome?: string;
  @Input() excluirOsId?: number;
  @Input() defeitoAtual?: string;
  @Input() estadoTelaAtual?: string;

  private _modeloId?: string;
  private readonly destroy$ = new Subject<void>();
  private readonly cancelarConsulta$ = new Subject<void>();

  @Input()
  set modeloId(value: string | undefined) {
    if (value === this._modeloId) return;
    this._modeloId = value;
    if (value) {
      this.iniciarConsultas(value);
    } else {
      this.limpar();
    }
  }
  get modeloId(): string | undefined {
    return this._modeloId;
  }

  valores?: ModeloServicosValoresResponse;
  operacao?: ModeloOperacaoResponse;
  carregandoValores = false;
  carregandoOperacao = false;
  erroValores = '';
  erroOperacao = '';
  alertasVisiveis: AlertaOperacionalInfo[] = [];
  alertaTelaCliente = false;
  temAlertaTelaBackend = false;
  private resumoPorPeca = new Map<string, PecaEstoqueOperacaoInfo>();

  constructor(
    private aparelhosService: AparelhosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['excluirOsId'] && this._modeloId) {
      this.consultarOperacao(this._modeloId);
    }

    if (changes['defeitoAtual'] || changes['estadoTelaAtual']) {
      this.atualizarContextoCliente();
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.cancelarConsulta$.next();
    this.cancelarConsulta$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private iniciarConsultas(modeloId: string): void {
    this.cancelarConsulta$.next();
    this.erroValores = '';
    this.erroOperacao = '';

    const cacheValores = this.aparelhosService.obterValoresEmCache(modeloId);
    if (cacheValores) {
      this.aplicarValores(cacheValores);
    } else {
      this.valores = undefined;
      this.carregandoValores = true;
    }

    const cacheOperacao = this.aparelhosService.obterOperacaoEmCache(modeloId, this.excluirOsId);
    if (cacheOperacao) {
      this.aplicarOperacao(cacheOperacao);
    } else {
      this.operacao = undefined;
      this.resumoPorPeca.clear();
      this.alertasVisiveis = [];
      this.carregandoOperacao = true;
    }

    this.cdr.markForCheck();
    this.consultarValores(modeloId);
    this.consultarOperacao(modeloId);
  }

  resumoPeca(pecaId: string): PecaEstoqueOperacaoInfo | undefined {
    return this.resumoPorPeca.get(pecaId);
  }

  temVariacoesServico(peca: PecaValorInfo): boolean {
    return (peca.variacoes?.length ?? 0) > 0;
  }

  variacoesServico(peca: PecaValorInfo): VariacaoServico[] {
    if (!peca.variacoes?.length) return [];
    return [...peca.variacoes].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }

  precoMinimo(v: VariacaoServico, peca: PecaValorInfo): number | undefined {
    return v.valorSugeridoMinimo ?? peca.valorSugeridoMinimo;
  }

  precoSugerido(v: VariacaoServico, peca: PecaValorInfo): number | undefined {
    return v.valorSugeridoTroca ?? peca.valorSugeridoTroca;
  }

  private consultarValores(modeloId: string): void {
    this.aparelhosService.consultarServicosValores(modeloId).pipe(
      takeUntil(this.cancelarConsulta$),
      takeUntil(this.destroy$),
    ).subscribe({
      next: dados => {
        this.aplicarValores(dados);
        this.carregandoValores = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.carregandoValores = false;
        if (!this.valores) {
          this.erroValores = 'Não foi possível carregar os valores. Verifique se a API está em http://localhost:5276';
        }
        this.cdr.markForCheck();
      },
    });
  }

  private consultarOperacao(modeloId: string): void {
    this.aparelhosService.consultarOperacaoModelo(modeloId, this.excluirOsId).pipe(
      takeUntil(this.cancelarConsulta$),
      takeUntil(this.destroy$),
    ).subscribe({
      next: dados => {
        this.aplicarOperacao(dados);
        this.carregandoOperacao = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.carregandoOperacao = false;
        if (!this.operacao) {
          this.erroOperacao = 'Não foi possível consultar a fila na assistência.';
        }
        this.cdr.markForCheck();
      },
    });
  }

  private aplicarValores(dados: ModeloServicosValoresResponse): void {
    this.valores = { pecas: dados?.pecas ?? [] };
    this.erroValores = '';
  }

  private aplicarOperacao(dados: ModeloOperacaoResponse): void {
    const osEmAndamento = (dados?.osEmAndamento ?? []).filter(
      os => !osSituacaoFinalizada(os.situacao),
    );
    this.operacao = {
      ...dados,
      osAbertasHoje: dados?.osAbertasHoje ?? 0,
      osEmAndamento,
      osModeloEmAssistencia: osEmAndamento.length,
      pecasResumo: dados?.pecasResumo ?? [],
      alertas: dados?.alertas ?? [],
    };
    this.resumoPorPeca = new Map(this.operacao.pecasResumo.map(p => [p.pecaId, p]));
    this.alertasVisiveis = this.operacao.alertas ?? [];
    this.temAlertaTelaBackend = this.alertasVisiveis.some(a => a.relacionadoTela);
    this.atualizarContextoCliente();
    this.erroOperacao = '';
  }

  situacaoClass(situacao?: string): string {
    if (!situacao) return 'ref-sit-aberto';
    const s = situacao.toLowerCase();
    if (s.includes('andamento')) return 'ref-sit-andamento';
    if (s.includes('aberto')) return 'ref-sit-aberto';
    return 'ref-sit-outro';
  }

  classeNivel(nivelApi: string | undefined, quantidade: number): string {
    const nivel = nivelEstoqueDeQuantidade(quantidade, nivelApi);
    return ESTOQUE_NIVEL_CLASSES[nivel];
  }

  classeBordaServico(pecaId: string, quantidadeEstoque: number): string {
    const nivel = this.nivelPeca(pecaId, quantidadeEstoque);
    if (nivel === 'verde') return '';
    return `ref-servico-nivel-${nivel}`;
  }

  nivelPeca(pecaId: string, quantidadeEstoque: number): NivelEstoque {
    const resumo = this.resumoPeca(pecaId);
    const qtd = resumo?.quantidadeEstoque ?? quantidadeEstoque;
    return nivelEstoqueDeQuantidade(qtd, resumo?.nivelDisponivel);
  }

  get limitesEstoque() {
    return getEstoqueConfig();
  }

  private limpar(): void {
    this.valores = undefined;
    this.operacao = undefined;
    this.resumoPorPeca.clear();
    this.alertasVisiveis = [];
    this.erroValores = '';
    this.erroOperacao = '';
    this.carregandoValores = false;
    this.carregandoOperacao = false;
    this.alertaTelaCliente = false;
    this.temAlertaTelaBackend = false;
  }

  private atualizarContextoCliente(): void {
    this.alertaTelaCliente = this.indicaProblemaTela(this.defeitoAtual)
      || this.indicaProblemaTela(this.estadoTelaAtual);
  }

  private indicaProblemaTela(texto?: string): boolean {
    if (!texto?.trim()) return false;
    const t = texto.toLowerCase();
    return t.includes('tela')
      || t.includes('display')
      || t.includes('touch')
      || t.includes('quebrad')
      || t.includes('trincad')
      || t.includes('manchad')
      || t.includes('apagad');
  }
}
