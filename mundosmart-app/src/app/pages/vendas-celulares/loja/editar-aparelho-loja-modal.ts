import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as QRCode from 'qrcode';
import { AparelhosService } from '../../../services/aparelhos';
import { AparelhoLojaItem, AparelhoLojaPainel, AparelhoLojaService } from '../../../services/aparelho-loja.service';
import { MarcaAparelho, ModeloAparelho } from '../../../models/bling.models';
import { MODELO_LIMITE_LISTA } from '../../../config/aparelhos.config';
import { avisarAvisoUsuario, avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import { apenasDigitos } from '../../../utils/contato-validacao';

type FotoAparelho = { id: string; url: string; tipo?: string };

@Component({
  selector: 'app-editar-aparelho-loja-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
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
              <label>Valor de venda</label>
              <input data-campo="valorVenda" type="number" min="0" step="0.01" (input)="valorVenda = numero($event)" />
            </div>
            <div class="form-group">
              <label>Valor mínimo</label>
              <input data-campo="valorMinimo" type="number" min="0" step="0.01" (input)="valorMinimo = numero($event)" />
            </div>
            <div class="form-group">
              <label>Saúde da bateria (%)</label>
              <input data-campo="saudeBateria" type="number" min="0" max="100" (input)="saudeBateria = numero($event)" />
            </div>
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
            <p class="hint">As fotos entram agora, sem precisar salvar o cadastro. Dá para mandar deste computador ou pelo celular.</p>
            <p class="hint" *ngIf="!fotos.length">Nenhuma foto ainda.</p>
            <div class="galeria" *ngIf="fotos.length">
              <button type="button" class="mini" *ngFor="let f of fotos; trackBy: trackFoto" (click)="ampliar(f)">
                <video *ngIf="ehVideo(f)" [src]="f.url" muted></video>
                <img *ngIf="!ehVideo(f)" [src]="f.url" alt="Foto do aparelho" />
              </button>
            </div>
            <figure class="foto-ampliada" *ngIf="fotoAmpliada as grande">
              <video *ngIf="ehVideo(grande)" [src]="grande.url" controls playsinline></video>
              <img *ngIf="!ehVideo(grande)" [src]="grande.url" alt="Foto ampliada" />
              <button type="button" class="secundario" (click)="fotoAmpliada = null; pintar()">Fechar imagem</button>
            </figure>
            <label class="secundario arquivo">
              {{ enviandoFotos ? 'Enviando fotos…' : 'Incluir fotos deste computador' }}
              <input type="file" accept="image/*,video/*" multiple hidden [disabled]="enviandoFotos" (change)="incluirFotos($event)" />
            </label>
            <button type="button" class="secundario" (click)="abrirQr()">QR code — câmera do celular</button>
            <div class="qr-box" *ngIf="qrAberto">
              <p class="hint">Escaneie para fotografar este aparelho. A foto entra neste cadastro.</p>
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
    .secundario { background: #fff; color: #0d0d0d; border: 1px solid #cbd5e1; }
    .perigo { background: #fff; color: #9a3412; border: 1px solid #fecaca; }
    .fotos-edicao { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .fotos-edicao h4 { margin: 0 0 8px; font-size: 14px; }
    .galeria { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 8px; margin: 0 0 10px; }
    .galeria .mini { width: 100%; padding: 0; border: 0; background: #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer; }
    .galeria img, .galeria video { width: 100%; height: 108px; object-fit: cover; display: block; }
    .foto-ampliada { margin: 8px 0; }
    .foto-ampliada img, .foto-ampliada video { width: 100%; max-height: 320px; object-fit: contain; background: #0f172a; border-radius: 8px; }
    .arquivo { display: inline-block; margin: 8px 8px 8px 0; cursor: pointer; width: auto; }
    .qr-box { margin: 8px 0 0; }
    .qr { width: 200px; height: 200px; display: block; }
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
  valorVenda: number | null = null;
  valorMinimo: number | null = null;
  saudeBateria: number | null = null;
  bateriaPerfeita: '' | 'sim' | 'nao' = '';
  observacoes = '';
  alerta = '';
  pecas: { nome: string; apareceMensagem: boolean }[] = [{ nome: '', apareceMensagem: false }];
  ehIphone = false;
  salvando = false;
  enviandoFotos = false;
  fotos: FotoAparelho[] = [];
  fotoAmpliada: FotoAparelho | null = null;
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
    this.valorVenda = a.valorVenda ?? null;
    this.valorMinimo = a.valorMinimoVenda ?? null;
    this.saudeBateria = a.saudeBateria ?? null;
    this.bateriaPerfeita = a.bateriaPerfeita === true ? 'sim' : a.bateriaPerfeita === false ? 'nao' : '';
    this.observacoes = a.observacoes || '';
    this.alerta = a.alertaPermanente || '';
    this.pecas = (a.pecasTrocadas?.length ? a.pecasTrocadas : [{ nome: '', apareceMensagem: false }])
      .map(p => ({ nome: p.nome, apareceMensagem: !!p.apareceMensagem }));
    this.fotos = [...(a.fotos ?? [])];
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
    this.carregarModelos(this.marcaId);
    queueMicrotask(() => this.pintar());
  }

  ngOnDestroy(): void {
    this.pararPoll();
  }

  trackMarca = (_: number, m: MarcaAparelho) => m.id;
  trackModelo = (_: number, m: ModeloAparelho) => m.id;
  trackFoto = (_: number, f: FotoAparelho) => f.id || f.url;

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  numero(evento: Event): number | null {
    const texto = this.valor(evento);
    if (texto === '') return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : null;
  }

  marcado(evento: Event): boolean {
    return (evento.target as HTMLInputElement).checked;
  }

  ehVideo(item: FotoAparelho): boolean {
    if (item.tipo === 'video') return true;
    return /\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(item.url ?? '');
  }

  ampliar(foto: FotoAparelho): void {
    this.fotoAmpliada = this.fotoAmpliada?.url === foto.url ? null : foto;
    this.pintar();
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

  async incluirFotos(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const arquivos = Array.from(input.files ?? []);
    input.value = '';
    const id = this.aparelho.id;
    if (!id || !arquivos.length || this.enviandoFotos) return;
    this.enviandoFotos = true;
    this.pintar();
    let preparados: File[];
    try {
      preparados = await Promise.all(arquivos.map(arquivo => this.prepararFoto(arquivo)));
    } catch (err) {
      this.enviandoFotos = false;
      this.pintar();
      avisarErroUsuario(err instanceof Error ? err.message : 'Não foi possível ler a foto.');
      return;
    }
    const grande = preparados.find(arquivo => {
      const video = arquivo.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(arquivo.name);
      return arquivo.size > (video ? 40 : 8) * 1024 * 1024;
    });
    if (grande) {
      this.enviandoFotos = false;
      this.pintar();
      avisarErroUsuario('Cada foto pode ter no máximo 8 MB e cada vídeo 40 MB.');
      return;
    }
    this.api.fotos(id, preparados).subscribe({
      next: painel => {
        this.enviandoFotos = false;
        this.aplicarFotosDoPainel(painel);
        this.pintar();
        avisarSucessoUsuario('Fotos incluídas neste aparelho.');
        this.atualizou.emit(painel);
      },
      error: err => {
        this.enviandoFotos = false;
        this.pintar();
        avisarErroUsuario(err?.error?.erro || 'Não foi possível incluir as fotos.');
      },
    });
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
    const valorVenda = Number(this.valorVenda);
    const valorMinimo = Number(this.valorMinimo);
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

  private aplicarFotosDoPainel(painel: AparelhoLojaPainel): void {
    const id = this.aparelho.id;
    const atual = (painel.estoque ?? []).find(x => x.id === id);
    if (atual?.fotos) this.fotos = [...atual.fotos];
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
            this.aplicarFotosDoPainel(painel);
            this.pintar();
            this.atualizou.emit(painel);
          },
        });
      },
    });
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
