import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as QRCode from 'qrcode';
import { AparelhosService } from '../../../services/aparelhos';
import { AparelhoLojaItem, AparelhoLojaPainel, AparelhoLojaService } from '../../../services/aparelho-loja.service';
import { MarcaAparelho, ModeloAparelho } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA } from '../../../config/aparelhos.config';
import { avisarAvisoUsuario, avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import { apenasDigitos } from '../../../utils/contato-validacao';
import { urlArquivoOs } from '../../../services/os-intake';
import {
  FotoAngulo,
  FotosAngulo,
  FotosAnguloEnvio,
  FotosAnguloSubstituir,
} from '../../../components/fotos-angulo/fotos-angulo';
import { OsFotoCategoriaId } from '../../../config/os-foto-categoria.config';

@Component({
  selector: 'app-editar-aparelho-loja-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FotosAngulo],
  template: `
    <div class="modal-backdrop" (click)="cancelar()">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="titulo-edicao-aparelho" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 id="titulo-edicao-aparelho">Editar {{ aparelho.codigo || 'cadastro' }}</h3>
          <button type="button" class="modal-close" (click)="cancelar()" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">
          <p class="codigo-etiqueta" *ngIf="aparelho.codigo">{{ aparelho.codigo }}</p>
          <p class="hint">{{ aparelho.marca }} {{ aparelho.modelo }}{{ aparelho.cor ? ' · ' + aparelho.cor : '' }}. Este código o sistema gerou na entrada e não muda.</p>
          <div class="form-row">
            <div class="form-group">
              <label>Marca</label>
              <select data-campo="marca" (change)="onMarca(valor($event))">
                <option value="">Selecione…</option>
                <option *ngFor="let m of marcas; trackBy: trackMarca" [value]="m.id">{{ m.nome }}</option>
              </select>
            </div>
            <div class="form-group grow">
              <label>Modelo</label>
              <select data-campo="modelo" (change)="onModelo(valor($event))">
                <option value="">Selecione…</option>
                <option *ngFor="let m of modelos; trackBy: trackModelo" [value]="m.id">{{ m.nome }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>IMEI</label>
              <input data-campo="imei" (input)="imei = valor($event)" inputmode="numeric" placeholder="Opcional, 15 dígitos" />
              <p class="hint">Deixe em branco se o aparelho ainda estiver quebrado.</p>
            </div>
            <div class="form-group">
              <label>Cor</label>
              <input data-campo="cor" (input)="cor = valor($event)" />
            </div>
            <div class="form-group">
              <label>Configuração</label>
              <select data-campo="configuracao" (change)="configuracao = valor($event)">
                <option value="">Selecione…</option>
                <option *ngFor="let c of configuracoes" [value]="c">{{ c }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>Estado</label>
              <select data-campo="condicao" (change)="condicao = valor($event)">
                <option value="usado">Usado</option>
                <option value="novo">Novo</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Valor pago</label>
              <input data-campo="valorPago" type="number" min="0" step="0.01" (input)="definirPago($event)" />
            </div>
            <div class="form-group">
              <label>Valor p/ compra</label>
              <input data-campo="valorParaCompra" type="number" min="0" step="0.01" (input)="definirParaCompra($event)" />
              <p class="hint">Preço do fornecedor para comprar outro igual.</p>
            </div>
            <div class="form-group">
              <label>Valor de venda</label>
              <input data-campo="valorVenda" type="number" min="0" step="0.01" (input)="definirVenda($event)" />
            </div>
            <div class="form-group">
              <label>Valor mínimo</label>
              <input data-campo="valorMinimo" type="number" min="0" step="0.01" (input)="definirMinimo($event)" />
            </div>
            <div class="form-group">
              <label>Saúde da bateria (%)</label>
              <input data-campo="saudeBateria" type="number" min="0" max="100" (input)="saudeBateria = numero($event)" />
            </div>
          </div>
          <div class="margens" *ngIf="lucroDe(valorVenda) != null || lucroDe(valorMinimo) != null">
            <p class="margem" [class.positiva]="(lucroDe(valorVenda) ?? 0) > 0" [class.negativa]="(lucroDe(valorVenda) ?? 0) < 0">
              Margem no preço real: {{ textoMargem(valorVenda) }}
            </p>
            <p class="margem" [class.positiva]="(lucroDe(valorMinimo) ?? 0) > 0" [class.negativa]="(lucroDe(valorMinimo) ?? 0) < 0">
              Margem no preço com desconto: {{ textoMargem(valorMinimo) }}
            </p>
            <p class="hint">A margem é o preço menos o valor pago.</p>
          </div>
          <div class="form-group" *ngIf="ehIphone">
            <label>Bateria em perfeitas condições</label>
            <select data-campo="bateriaPerfeita" (change)="onBateriaPerfeita(valor($event))">
              <option value="">Selecione…</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>
          <div class="form-group" *ngIf="ehIphone">
            <label>Peças trocadas</label>
            <div class="peca-linha" *ngFor="let p of pecas; let i = index">
              <input [attr.data-peca]="i" (input)="p.nome = valor($event)" placeholder="Nome da peça" />
              <label><input type="checkbox" [attr.data-peca-msg]="i" (change)="p.apareceMensagem = marcado($event)" /> Aparece mensagem</label>
            </div>
            <button type="button" class="secundario" (click)="incluirPeca()">Incluir peça</button>
          </div>
          <label>Informações<textarea data-campo="observacoes" (input)="observacoes = valor($event)" rows="3"></textarea></label>
          <label>Alerta permanente<textarea data-campo="alerta" (input)="alerta = valor($event)" rows="2"></textarea></label>

          <section class="fotos-edicao">
            <h4>Fotos deste aparelho</h4>
            <p class="hint" *ngIf="carregandoFotos">Carregando fotos…</p>
            <p class="hint" *ngIf="!carregandoFotos && fotos.length">{{ fotos.length }} foto(s) já neste cadastro.</p>

            <div class="fotos-escolha" *ngIf="!meioFotos">
              <p class="hint">Escolha como as fotos entram. Os ângulos são os mesmos da ordem de serviço.</p>
              <div class="fotos-meios">
                <button type="button" class="meio" (click)="escolherMeio('computador')">
                  <strong>Neste computador</strong>
                  <span>Os ângulos aparecem aqui. Em cada um, use Câmera ou Galeria.</span>
                </button>
                <button type="button" class="meio" (click)="escolherMeio('qr')">
                  <strong>QR code — celular</strong>
                  <span>O celular abre o site e pede as fotos por ângulo.</span>
                </button>
              </div>
            </div>

            <ng-container *ngIf="meioFotos === 'computador'">
              <button type="button" class="secundario troca-meio" (click)="escolherMeio('qr')">Usar QR code no celular</button>
              <div class="fotos-angulo-caixa">
                <app-fotos-angulo
                  [fotos]="fotos"
                  [enviandoCategoria]="enviandoCategoria"
                  [excluindoId]="excluindoFotoId"
                  [descricaoOutra]="descricaoOutra"
                  (descricaoOutraChange)="definirDescricaoOutra($event)"
                  [pendentes]="pendentesFotos"
                  [previewUrl]="previewFotoUrl"
                  [previewCategoria]="previewCategoria"
                  [resolverUrl]="urlFoto"
                  (enviar)="enviarAngulo($event)"
                  (excluir)="excluirFoto($event)"
                  (substituir)="substituirAngulo($event)"
                  (vazio)="avisarFotoVazia()"
                />
              </div>
            </ng-container>

            <div class="qr-box" *ngIf="meioFotos === 'qr'">
              <button type="button" class="secundario troca-meio" (click)="escolherMeio('computador')">Usar este computador</button>
              <p class="hint">Escaneie com o celular. Lá estão os ângulos, com Câmera e Galeria.</p>
              <p class="hint" *ngIf="!qrDataUrl">Gerando o QR…</p>
              <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="QR code das fotos" class="qr" />
            </div>
          </section>
        </div>
        <div class="modal-footer">
          <button type="button" class="perigo" *ngIf="podeExcluir" [disabled]="salvando" (click)="excluir()">Excluir aparelho</button>
          <span class="espaco"></span>
          <button type="button" class="secundario" (click)="cancelar()">Cancelar</button>
          <button type="button" [disabled]="salvando" (click)="salvar()">{{ salvando ? 'Salvando…' : 'Salvar cadastro' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 10100;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-box {
      background: #fff; border-radius: 12px; width: 100%; max-width: 760px; max-height: 90vh;
      display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25); overflow: hidden;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; background: #0d0d0d; color: #fff;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #fff; }
    .modal-close { background: transparent; border: 0; color: rgba(255,255,255,0.75); font-size: 18px; cursor: pointer; }
    .modal-close:hover { color: #fff; }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .modal-body .hint { color: #64748b; font-size: 13px; margin: 0 0 12px; line-height: 1.45; }
    .codigo-etiqueta { font-size: 36px; font-weight: 800; letter-spacing: 1px; margin: 0 0 8px; line-height: 1; }
    .modal-body label { display: block; margin: 8px 0; font-size: 13px; }
    .modal-body textarea, .modal-body input, .modal-body select { width: 100%; box-sizing: border-box; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .form-group { flex: 1 1 160px; min-width: 140px; }
    .form-group.grow { flex: 1 1 220px; min-width: 220px; }
    .peca-linha { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: flex-end; margin-bottom: 8px; }
    .margens { margin: 0 0 8px; }
    .margem { margin: 0 0 4px; font-size: 13px; font-weight: 700; }
    .margem.positiva { color: #166534; }
    .margem.negativa { color: #9a3412; }
    .secundario { background: #fff; color: #0d0d0d; border: 1px solid #cbd5e1; }
    .perigo { background: #fff; color: #9a3412; border: 1px solid #fecaca; }
    .fotos-edicao { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .fotos-edicao h4 { margin: 0 0 8px; font-size: 14px; }
    .fotos-meios { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .meio {
      display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
      text-align: left; padding: 14px; border-radius: 12px; cursor: pointer;
      background: #fff; color: #0f172a; border: 1px solid #cbd5e1;
    }
    .meio:hover { border-color: #0f172a; }
    .meio strong { font-size: 14px; }
    .meio span { font-size: 12px; color: #64748b; line-height: 1.4; font-weight: 400; }
    .troca-meio { margin: 0 0 10px; }
    .fotos-angulo-caixa { background: #0b1220; border-radius: 12px; padding: 12px; margin: 8px 0 12px; }
    .qr-box { margin: 8px 0 0; }
    .qr { width: 200px; height: 200px; display: block; background: #fff; border-radius: 8px; }
    @media (max-width: 640px) { .fotos-meios { grid-template-columns: 1fr; } }
    .modal-footer {
      display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid #e2e8f0;
    }
    .espaco { flex: 1; }
  `],
})
export class EditarAparelhoLojaModal implements OnInit, OnDestroy {
  @Input({ required: true }) aparelho!: AparelhoLojaItem;
  @Input() marcas: MarcaAparelho[] = [];
  @Input() podeExcluir = false;
  @Output() fechou = new EventEmitter<void>();
  @Output() salvou = new EventEmitter<AparelhoLojaPainel>();
  @Output() atualizou = new EventEmitter<AparelhoLojaPainel>();
  @Output() excluiu = new EventEmitter<AparelhoLojaPainel>();

  configuracoes = ['16 GB', '32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];
  modelos: ModeloAparelho[] = [];
  marcaId = '';
  modeloId = '';
  imei = '';
  cor = '';
  configuracao = '';
  condicao = 'usado';
  valorPago: number | null = null;
  valorParaCompra: number | null = null;
  valorVenda: number | null = null;
  valorMinimo: number | null = null;
  saudeBateria: number | null = null;
  bateriaPerfeita: '' | 'sim' | 'nao' = '';
  observacoes = '';
  alerta = '';
  pecas: { nome: string; apareceMensagem: boolean }[] = [{ nome: '', apareceMensagem: false }];
  ehIphone = false;
  salvando = false;
  carregandoFotos = false;
  excluindoFotoId = '';
  fotos: FotoAngulo[] = [];
  enviandoCategoria: OsFotoCategoriaId | null = null;
  pendentesFotos = 0;
  descricaoOutra = '';
  previewFotoUrl = '';
  previewCategoria: OsFotoCategoriaId | null = null;
  readonly urlFoto = urlArquivoOs;
  meioFotos: '' | 'computador' | 'qr' = '';
  qrAberto = false;
  qrDataUrl = '';
  private sessaoToken = '';
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor(
    private api: AparelhoLojaService,
    private aparelhos: AparelhosService,
    private cdr: ChangeDetectorRef,
    private host: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    const a = this.aparelho;
    const marca = this.marcas.find(m => m.id === a.marcaId) || this.marcas.find(m => this.igual(m.nome, a.marca));
    this.marcaId = marca?.id || a.marcaId || '';
    this.modeloId = a.modeloId || '';
    this.imei = a.imei || '';
    this.cor = a.cor || '';
    this.configuracao = a.configuracao || '';
    this.condicao = a.condicao === 'novo' ? 'novo' : 'usado';
    const pago = Number(a.valorPago) > 0 ? Number(a.valorPago) : Number(a.custo);
    this.valorPago = pago > 0 ? pago : null;
    this.valorParaCompra = Number(a.valorParaCompra) > 0 ? Number(a.valorParaCompra) : null;
    this.valorVenda = a.valorVenda ?? null;
    this.valorMinimo = a.valorMinimoVenda ?? null;
    this.saudeBateria = a.saudeBateria ?? null;
    this.bateriaPerfeita = a.bateriaPerfeita === true ? 'sim' : a.bateriaPerfeita === false ? 'nao' : '';
    this.observacoes = a.observacoes || '';
    this.alerta = a.alertaPermanente || '';
    this.pecas = (a.pecasTrocadas?.length ? a.pecasTrocadas : [{ nome: '', apareceMensagem: false }])
      .map(p => ({ nome: p.nome, apareceMensagem: !!p.apareceMensagem }));
    if (this.configuracao && !this.configuracoes.includes(this.configuracao)) {
      this.configuracoes = [this.configuracao, ...this.configuracoes];
    }
    if (this.modeloId) {
      this.modelos = [{
        id: this.modeloId,
        nome: a.modelo,
        marcaId: this.marcaId,
        marcaNome: marca?.nome || a.marca,
      }];
    }
    this.atualizarIphone();
    this.cdr.detach();
    this.carregarFotos();
    this.carregarModelos(this.marcaId);
    queueMicrotask(() => this.pintar());
  }

  ngOnDestroy(): void {
    this.pararPoll();
    this.limparPreviewFoto();
  }

  trackMarca = (_: number, m: MarcaAparelho) => m.id;
  trackModelo = (_: number, m: ModeloAparelho) => m.id;

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  numero(evento: Event): number | null {
    const texto = this.valor(evento);
    if (texto === '') return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : null;
  }

  definirPago(evento: Event): void {
    this.valorPago = this.numero(evento);
    this.cdr.detectChanges();
  }

  definirParaCompra(evento: Event): void {
    this.valorParaCompra = this.numero(evento);
    this.cdr.detectChanges();
  }

  definirVenda(evento: Event): void {
    this.valorVenda = this.numero(evento);
    this.cdr.detectChanges();
  }

  definirMinimo(evento: Event): void {
    this.valorMinimo = this.numero(evento);
    this.cdr.detectChanges();
  }

  lucroDe(preco: number | null): number | null {
    const venda = Number(preco);
    const pago = Number(this.valorPago);
    if (!(venda > 0) || !(pago > 0)) return null;
    return Math.round((venda - pago) * 100) / 100;
  }

  textoMargem(preco: number | null): string {
    const lucro = this.lucroDe(preco);
    if (lucro == null) return '—';
    const pct = Math.round((lucro / Number(preco)) * 1000) / 10;
    const percentual = pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${this.dinheiro(lucro)} (${percentual}%)`;
  }

  dinheiro(valor: number): string {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  marcado(evento: Event): boolean {
    return (evento.target as HTMLInputElement).checked;
  }

  ehVideo(item: FotoAngulo): boolean {
    if (item.tipo === 'video') return true;
    return /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(item.url ?? '');
  }

  definirDescricaoOutra(valor: string): void {
    this.descricaoOutra = valor;
    this.cdr.detectChanges();
  }

  avisarFotoVazia(): void {
    avisarAvisoUsuario('Nenhuma foto selecionada. Tente novamente (câmera ou galeria).');
  }

  excluirFoto(foto: FotoAngulo): void {
    const id = this.aparelho.id;
    if (!id || !foto.id || this.excluindoFotoId || this.enviandoCategoria) return;
    if (!confirm('Excluir esta foto?')) return;
    this.excluindoFotoId = foto.id;
    this.pintar();
    this.api.excluirFoto(id, foto.id).subscribe({
      next: painel => {
        this.excluindoFotoId = '';
        this.fotos = this.fotos.filter(f => f.id !== foto.id);
        this.carregarFotos();
        this.pintar();
        avisarSucessoUsuario(this.ehVideo(foto) ? 'Vídeo excluído.' : 'Imagem excluída.');
        this.atualizou.emit(painel);
      },
      error: err => {
        this.excluindoFotoId = '';
        this.pintar();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível excluir a imagem.');
      },
    });
  }

  substituirAngulo(ev: FotosAnguloSubstituir): void {
    const id = this.aparelho.id;
    if (!id || !ev.foto.id || this.excluindoFotoId || this.enviandoCategoria) return;
    this.excluindoFotoId = ev.foto.id;
    this.pintar();
    this.api.excluirFoto(id, ev.foto.id).subscribe({
      next: painel => {
        this.excluindoFotoId = '';
        this.fotos = this.fotos.filter(f => f.id !== ev.foto.id);
        this.pintar();
        avisarSucessoUsuario('Foto removida. Escolha a nova imagem.');
        this.atualizou.emit(painel);
        ev.abrirCamera();
      },
      error: err => {
        this.excluindoFotoId = '';
        this.pintar();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível remover a foto para substituir.');
      },
    });
  }

  cancelar(): void {
    this.pararPoll();
    this.fechou.emit();
  }

  onMarca(id: string): void {
    if (id === this.marcaId) return;
    this.marcaId = id;
    this.modeloId = '';
    this.modelos = [];
    this.atualizarIphone();
    this.carregarModelos(id);
    this.pintar();
  }

  onModelo(id: string): void {
    if (id === this.modeloId) return;
    this.modeloId = id;
    this.atualizarIphone();
    this.pintar();
  }

  onBateriaPerfeita(valor: string): void {
    this.bateriaPerfeita = valor === 'sim' || valor === 'nao' ? valor : '';
  }

  incluirPeca(): void {
    if (this.pecas.length >= 8) return;
    this.pecas = [...this.pecas, { nome: '', apareceMensagem: false }];
    this.pintar();
  }

  async enviarAngulo(envio: FotosAnguloEnvio): Promise<void> {
    const id = this.aparelho.id;
    if (!id || !envio.arquivos.length || this.enviandoCategoria) return;
    this.enviandoCategoria = envio.categoria;
    this.pendentesFotos = envio.arquivos.length;
    this.limparPreviewFoto();
    const primeiro = envio.arquivos[0];
    if (primeiro && primeiro.size <= 4 * 1024 * 1024) {
      this.previewFotoUrl = URL.createObjectURL(primeiro);
      this.previewCategoria = envio.categoria;
    }
    this.pintar();
    try {
      for (const arquivo of envio.arquivos) {
        const preparado = await this.prepararFoto(arquivo);
        const video = preparado.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(preparado.name);
        if (preparado.size > (video ? 40 : 8) * 1024 * 1024) {
          throw new Error('Cada foto pode ter no máximo 8 MB e cada vídeo 40 MB.');
        }
        const painel = await new Promise<AparelhoLojaPainel>((resolve, reject) => {
          this.api.fotos(id, [preparado], envio.categoria, envio.descricao).subscribe({
            next: resolve,
            error: reject,
          });
        });
        this.pendentesFotos = Math.max(0, this.pendentesFotos - 1);
        this.atualizou.emit(painel);
        this.pintar();
      }
      this.carregarFotos();
      avisarSucessoUsuario('Foto incluída neste aparelho.');
    } catch (err) {
      const mensagem = err instanceof Error
        ? err.message
        : (err as { error?: { erro?: string } })?.error?.erro || 'Não foi possível incluir as fotos.';
      avisarErroUsuario(mensagem);
    } finally {
      this.enviandoCategoria = null;
      this.pendentesFotos = 0;
      this.limparPreviewFoto();
      this.pintar();
    }
  }

  escolherMeio(meio: '' | 'computador' | 'qr'): void {
    this.meioFotos = meio;
    if (meio === 'qr') this.abrirQr();
    if (meio === 'computador') this.carregarFotos();
    this.pintar();
  }

  abrirQr(): void {
    const id = this.aparelho.id;
    if (!id) return;
    if (this.qrAberto && this.sessaoToken) {
      this.iniciarPoll();
      return;
    }
    this.qrAberto = true;
    this.qrDataUrl = '';
    this.pintar();
    this.api.criarSessaoFotos(id).subscribe({
      next: async sessao => {
        this.sessaoToken = sessao.token;
        this.qrDataUrl = await QRCode.toDataURL(sessao.url, { width: 220, margin: 1, errorCorrectionLevel: 'M' });
        this.iniciarPoll();
        this.pintar();
      },
      error: (err: { error?: { erro?: string } }) => {
        this.qrAberto = false;
        if (this.meioFotos === 'qr') this.meioFotos = '';
        this.pintar();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível gerar o QR.');
      },
    });
  }

  excluir(): void {
    const id = this.aparelho.id;
    if (!id || !this.podeExcluir || this.salvando) return;
    if (!confirm('Excluir este aparelho do estoque? Se ele entrou por compra, a compra some junto. Aparelho de troca precisa excluir a troca nas transações.')) return;
    this.salvando = true;
    this.pintar();
    this.api.excluirAparelho(id).subscribe({
      next: painel => {
        this.salvando = false;
        this.pararPoll();
        avisarSucessoUsuario('Aparelho excluído.');
        this.excluiu.emit(painel);
      },
      error: err => {
        this.salvando = false;
        this.pintar();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível excluir o aparelho.');
      },
    });
  }

  salvar(): void {
    const id = this.aparelho.id;
    if (!id || this.salvando) return;
    const modelo = this.modelos.find(m => m.id === this.modeloId);
    const marca = this.marcas.find(m => m.id === this.marcaId);
    const marcaNome = marca?.nome || modelo?.marcaNome || '';
    const modeloNome = modelo?.nome || '';
    if (!marcaNome.trim() || !modeloNome.trim()) {
      avisarErroUsuario('Selecione a marca e o modelo.');
      return;
    }
    const valorPago = Number(this.valorPago);
    const valorVenda = Number(this.valorVenda);
    const valorMinimo = Number(this.valorMinimo);
    if (!(valorPago > 0)) {
      avisarErroUsuario('Informe o valor pago.');
      return;
    }
    if (!(valorVenda > 0) || !(valorMinimo > 0)) {
      avisarErroUsuario('Informe o valor de venda e o mínimo.');
      return;
    }
    if (valorMinimo > valorVenda) {
      avisarErroUsuario('O valor mínimo não pode passar do valor de venda.');
      return;
    }
    if (this.ehIphone && this.bateriaPerfeita !== 'sim' && this.bateriaPerfeita !== 'nao') {
      avisarErroUsuario('Informe se a saúde da bateria do iPhone está em perfeitas condições.');
      return;
    }
    this.salvando = true;
    this.pintar();
    this.api.editarCadastro(id, {
      imei: this.imeiParaEntrada(this.imei),
      marca: marcaNome,
      modelo: modeloNome,
      marcaId: this.marcaId,
      modeloId: this.modeloId,
      cor: this.cor,
      configuracao: this.configuracao,
      condicao: this.condicao,
      valorVenda,
      valorMinimoVenda: valorMinimo,
      valorPago,
      valorParaCompra: Number(this.valorParaCompra) > 0 ? Number(this.valorParaCompra) : 0,
      observacoes: this.observacoes,
      alertaPermanente: this.alerta,
      saudeBateria: this.saudeBateria,
      bateriaPerfeita: this.ehIphone ? this.bateriaPerfeita === 'sim' : null,
      pecasTrocadas: this.ehIphone ? this.pecasPreenchidas() : [],
    }).subscribe({
      next: painel => {
        this.salvando = false;
        avisarSucessoUsuario('Cadastro atualizado.');
        this.salvou.emit(painel);
      },
      error: err => {
        this.salvando = false;
        avisarErroUsuario(err?.error?.erro || 'Não foi possível salvar o cadastro.');
        this.pintar();
      },
    });
  }

  pintar(): void {
    this.cdr.detectChanges();
    this.aplicarCampos();
  }

  private aplicarCampos(): void {
    const root = this.host.nativeElement;
    const campo = (nome: string) => root.querySelector(`[data-campo="${nome}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    const setar = (nome: string, valor: string) => {
      const el = campo(nome);
      if (el && el.value !== valor) el.value = valor;
    };
    setar('marca', this.marcaId);
    setar('modelo', this.modeloId);
    setar('imei', this.imei);
    setar('cor', this.cor);
    setar('configuracao', this.configuracao);
    setar('condicao', this.condicao);
    setar('valorPago', this.valorPago == null ? '' : String(this.valorPago));
    setar('valorParaCompra', this.valorParaCompra == null ? '' : String(this.valorParaCompra));
    setar('valorVenda', this.valorVenda == null ? '' : String(this.valorVenda));
    setar('valorMinimo', this.valorMinimo == null ? '' : String(this.valorMinimo));
    setar('saudeBateria', this.saudeBateria == null ? '' : String(this.saudeBateria));
    setar('bateriaPerfeita', this.bateriaPerfeita);
    setar('observacoes', this.observacoes);
    setar('alerta', this.alerta);
    this.pecas.forEach((p, i) => {
      const nome = root.querySelector(`[data-peca="${i}"]`) as HTMLInputElement | null;
      if (nome && nome.value !== p.nome) nome.value = p.nome;
      const msg = root.querySelector(`[data-peca-msg="${i}"]`) as HTMLInputElement | null;
      if (msg && msg.checked !== p.apareceMensagem) msg.checked = p.apareceMensagem;
    });
  }

  private carregarFotos(): void {
    const id = this.aparelho.id;
    if (!id) return;
    this.carregandoFotos = true;
    this.pintar();
    this.api.listarFotos(id).subscribe({
      next: fotos => {
        this.carregandoFotos = false;
        this.fotos = fotos ?? [];
        this.pintar();
      },
      error: () => {
        this.carregandoFotos = false;
        this.pintar();
      },
    });
  }

  private iniciarPoll(): void {
    this.pararPoll();
    this.poll = setInterval(() => this.puxarSessao(), 2500);
  }

  private pararPoll(): void {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  private puxarSessao(): void {
    if (!this.sessaoToken) return;
    this.api.sessaoFotos(this.sessaoToken).subscribe({
      next: sessao => {
        const recebidas = sessao.fotos ?? [];
        if (recebidas.length <= this.fotos.length) return;
        this.api.painel().subscribe({
          next: painel => {
            this.carregarFotos();
            this.atualizou.emit(painel);
          },
        });
      },
    });
  }

  private limparPreviewFoto(): void {
    if (this.previewFotoUrl) URL.revokeObjectURL(this.previewFotoUrl);
    this.previewFotoUrl = '';
    this.previewCategoria = null;
  }

  private async prepararFoto(arquivo: File): Promise<File> {
    const video = arquivo.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(arquivo.name);
    if (video) return arquivo;
    try {
      const bitmap = await createImageBitmap(arquivo);
      const maximo = 2000;
      const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
      const largura = Math.max(1, Math.round(bitmap.width * escala));
      const altura = Math.max(1, Math.round(bitmap.height * escala));
      const tela = document.createElement('canvas');
      tela.width = largura;
      tela.height = altura;
      const ctx = tela.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return arquivo;
      }
      ctx.drawImage(bitmap, 0, 0, largura, altura);
      bitmap.close();
      const blob = await new Promise<Blob | null>(resolve => tela.toBlob(resolve, 'image/jpeg', 0.82));
      if (!blob?.size) return arquivo;
      const base = (arquivo.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
      return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
    } catch {
      const compativel = /jpe?g|png|webp|gif/i.test(arquivo.type) || /\.(jpe?g|png|webp|gif)$/i.test(arquivo.name);
      if (compativel) return arquivo;
      throw new Error('Esta foto não abriu neste computador. Envie JPG ou PNG, ou use o QR no celular.');
    }
  }

  private carregarModelos(marcaId: string): void {
    if (!marcaId) {
      this.modelos = [];
      this.pintar();
      return;
    }
    this.aparelhos.listarModelos({ marcaId, tipoDispositivo: 'Celular', limite: MODELO_LIMITE_LISTA }).subscribe({
      next: lista => {
        if (this.marcaId !== marcaId) return;
        const modelos = lista ?? [];
        const atual = this.modelos.find(m => m.id === this.modeloId);
        this.modelos = atual?.id && !modelos.some(m => m.id === atual.id)
          ? [atual, ...modelos]
          : modelos;
        this.atualizarIphone();
        this.pintar();
      },
      error: () => this.pintar(),
    });
  }

  private atualizarIphone(): void {
    const marca = this.marcas.find(m => m.id === this.marcaId);
    const modelo = this.modelos.find(m => m.id === this.modeloId);
    const nome = `${marca?.nome || modelo?.marcaNome || this.aparelho.marca} ${modelo?.nome || this.aparelho.modelo}`;
    this.ehIphone = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('iphone');
  }

  private imeiParaEntrada(valor: string): string {
    const digitos = apenasDigitos(valor);
    if (digitos.length === 15 && new Set(digitos).size > 1) return digitos;
    if (digitos.length > 0) {
      avisarAvisoUsuario('IMEI incompleto. O aparelho entra sem IMEI. Informe depois do conserto.');
    }
    return '';
  }

  private pecasPreenchidas(): { nome: string; apareceMensagem: boolean }[] {
    return this.pecas
      .map(p => ({ nome: p.nome.trim(), apareceMensagem: !!p.nome.trim() && p.apareceMensagem }))
      .filter(p => p.nome.length > 0);
  }

  private igual(a?: string | null, b?: string | null): boolean {
    return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  }
}
