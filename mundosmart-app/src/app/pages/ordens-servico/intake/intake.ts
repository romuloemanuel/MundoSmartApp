import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { timeout, catchError, throwError, TimeoutError } from 'rxjs';
import { OsIntakeService, urlArquivoOs } from '../../../services/os-intake';
import { AppAuthService } from '../../../services/app-auth';
import { OsFotoAparelho, OsIntakeSessao } from '../../../models/bling.models';
import { SenhaDispositivoField, SenhaDispositivoTipo } from '../../../components/senha-dispositivo-field/senha-dispositivo-field';
import {
  CATEGORIA_FOTO_OUTRA,
  CATEGORIAS_FOTO_GUIADAS,
  OsFotoCategoriaId,
  normalizarCategoriaFoto,
  rotuloCategoriaFoto,
} from '../../../config/os-foto-categoria.config';
import { prepararArquivoParaUpload } from '../../../utils/preparar-arquivo-foto';
import { avisarErroUsuario } from '../../../services/user-feedback.service';

const UPLOAD_TIMEOUT_MS = 90_000;

@Component({
  selector: 'app-os-intake-mobile',
  standalone: true,
  imports: [CommonModule, FormsModule, SenhaDispositivoField],
  templateUrl: './intake.html',
  styleUrl: './intake.scss',
})
export class OsIntakeMobile implements OnInit, OnDestroy {
  readonly categoriasGuiadas = CATEGORIAS_FOTO_GUIADAS;
  readonly categoriaOutra = CATEGORIA_FOTO_OUTRA;
  readonly rotuloFoto = rotuloCategoriaFoto;
  readonly tz = 'America/Sao_Paulo';

  token = '';
  sessao?: OsIntakeSessao;
  carregando = true;
  erro = '';
  sucesso = '';
  enviandoCategoria: OsFotoCategoriaId | null = null;
  fotosPendentes = 0;
  salvandoSenha = false;
  excluindoId = '';
  senhaTipo: SenhaDispositivoTipo = 'desenho';
  senhaValor = '';
  descricaoOutraNova = '';
  lightboxFoto?: OsFotoAparelho;
  etapaAtiva: 'fotos' | 'senha' | 'concluido' = 'fotos';
  /** Preview local enquanto o upload corre (object URL). */
  previewLocalUrl = '';
  previewCategoria: OsFotoCategoriaId | null = null;
  /**
   * Se true, não força a tela de "concluído" (poll/reload).
   * O usuário pediu para voltar e continuar anexando.
   */
  editandoFotos = false;

  private sucessoTimer?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setInterval>;
  private primeiraCarga = true;

  constructor(
    private route: ActivatedRoute,
    private intakeService: OsIntakeService,
    private title: Title,
    private appAuth: AppAuthService,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Recepção do aparelho — Mundo Smart');
    // Sessão do QR (?h=) é aplicada no APP_INITIALIZER; aqui só garante limpeza residual.
    this.appAuth.consumirTransferenciaDaJanela();
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.erro = 'Link inválido. Peça um novo QR na loja.';
      avisarErroUsuario(this.erro);
      this.carregando = false;
      return;
    }
    this.carregar();
    this.pollTimer = setInterval(() => {
      if (this.enviandoFoto || this.carregando || document.hidden) return;
      this.recarregarSessaoSilencioso();
    }, 10000);

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    if (this.sucessoTimer) clearTimeout(this.sucessoTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.limparPreviewLocal();
  }

  private onVisibility = (): void => {
    if (!document.hidden) this.recarregarSessaoSilencioso();
  };

  get passoAtual(): number {
    if (!this.sessao) return 1;
    if (this.etapaAtiva === 'concluido') return 3;
    if (this.etapaAtiva === 'senha') return 2;
    return 1;
  }

  /** Fotos + senha — a senha pode ser informada ou editada a qualquer momento. */
  get totalPassos(): number {
    return 2;
  }

  /** Senha ok e/ou fotos — suficiente para encerrar (pode ser só senha). */
  get etapaConcluida(): boolean {
    if (!this.sessao) return false;
    return !this.sessao.precisaSenha && (this.sessao.totalFotos > 0 || this.senhaJaSalvaNestaSessao);
  }

  /** Pode tocar em Concluir quando a senha já não é mais necessária. */
  get podeConcluir(): boolean {
    return !!this.sessao && !this.sessao.precisaSenha;
  }

  /** Senha acabou de ser salva nesta visita (permite concluir sem foto). */
  senhaJaSalvaNestaSessao = false;

  get enviandoFoto(): boolean {
    return this.enviandoCategoria !== null;
  }

  urlFoto(url: string): string {
    return urlArquivoOs(url);
  }

  fotosDaCategoria(categoria: OsFotoCategoriaId): OsFotoAparelho[] {
    return (this.sessao?.fotos ?? []).filter(
      f => normalizarCategoriaFoto(f.categoria) === categoria,
    );
  }

  onSenhaTipoChange(tipo: SenhaDispositivoTipo): void {
    this.senhaTipo = tipo || 'desenho';
    this.senhaValor = '';
  }

  onFotoCategoria(event: Event, categoria: OsFotoCategoriaId): void {
    const input = event.target as HTMLInputElement;
    const selecionados = Array.from(input.files ?? []);
    input.value = '';
    if (!selecionados.length) {
      this.erro = 'Nenhuma foto selecionada. Tente novamente (câmera ou galeria).';
      avisarErroUsuario(this.erro);
      return;
    }

    const descricao =
      categoria === 'outra' ? this.descricaoOutraNova.trim() : undefined;
    if (categoria === 'outra') this.descricaoOutraNova = '';

    this.erro = '';
    this.enviandoCategoria = categoria;
    this.fotosPendentes = selecionados.length;
    this.sucesso = '';

    try {
      // Clone leve (igual espírito do PC: enviar logo, sem ler MB na memória).
      const preparados = selecionados.map(f => prepararArquivoParaUpload(f));
      this.enviarFotosSequencial(preparados, categoria, descricao);
    } catch (e: unknown) {
      this.enviandoCategoria = null;
      this.fotosPendentes = 0;
      this.limparPreviewLocal();
      this.erro = e instanceof Error
        ? e.message
        : 'Não foi possível ler a foto. Tente de novo.';
    }
  }

  abrirLightbox(foto: OsFotoAparelho): void {
    this.lightboxFoto = foto;
  }

  fecharLightbox(): void {
    this.lightboxFoto = undefined;
  }

  substituirFoto(foto: OsFotoAparelho, categoria: OsFotoCategoriaId, fileInput: HTMLInputElement): void {
    if (this.enviandoFoto || this.excluindoId) return;
    if (!confirm('Substituir esta foto? A anterior será removida.')) return;

    this.excluindoId = foto.id;
    this.erro = '';
    this.intakeService.removerFoto(this.token, foto.id).subscribe({
      next: () => {
        if (this.sessao) {
          this.sessao = {
            ...this.sessao,
            fotos: this.sessao.fotos.filter(f => f.id !== foto.id),
            totalFotos: Math.max(0, this.sessao.totalFotos - 1),
          };
        }
        if (this.lightboxFoto?.id === foto.id) this.fecharLightbox();
        this.excluindoId = '';
        this.mostrarSucesso('Foto removida. Escolha a nova imagem.');
        setTimeout(() => fileInput.click(), 120);
      },
      error: (err) => {
        this.erro = err?.error?.erro || 'Não foi possível remover a foto para substituir.';
        this.excluindoId = '';
      },
    });
  }

  excluirFoto(foto: OsFotoAparelho): void {
    if (this.enviandoFoto || this.excluindoId) return;
    if (!confirm('Excluir esta foto?')) return;

    this.excluindoId = foto.id;
    this.erro = '';
    this.intakeService.removerFoto(this.token, foto.id).subscribe({
      next: () => {
        if (this.sessao) {
          this.sessao = {
            ...this.sessao,
            fotos: this.sessao.fotos.filter(f => f.id !== foto.id),
            totalFotos: Math.max(0, this.sessao.totalFotos - 1),
          };
        }
        if (this.lightboxFoto?.id === foto.id) this.fecharLightbox();
        this.excluindoId = '';
        this.mostrarSucesso('Foto excluída.');
        if (this.sessao && this.sessao.totalFotos === 0) {
          this.editandoFotos = true;
          this.etapaAtiva = 'fotos';
        }
      },
      error: (err) => {
        this.erro = err?.error?.erro || 'Não foi possível excluir a foto.';
        this.excluindoId = '';
      },
    });
  }

  irParaSenha(): void {
    if (!this.sessao) return;
    this.editandoFotos = this.etapaAtiva === 'fotos' || this.editandoFotos;
    this.senhaTipo = 'desenho';
    this.senhaValor = '';
    this.etapaAtiva = 'senha';
    this.sucesso = '';
    this.erro = '';
    this.scrollTopo();
  }

  /** Encerra a recepção (fotos e/ou só senha). */
  concluirRecepcao(): void {
    if (!this.podeConcluir) return;
    this.editandoFotos = false;
    this.etapaAtiva = 'concluido';
    this.sucesso = '';
    this.scrollTopo();
  }

  voltarParaFotos(): void {
    this.editandoFotos = true;
    this.etapaAtiva = 'fotos';
    this.sucesso = '';
    // Após câmera/resumo, o scroll às vezes fica no topo — leva ao próximo ângulo.
    setTimeout(() => this.rolarParaProximoSlotVazio(), 80);
  }

  salvarSenha(): void {
    if (this.senhaTipo !== 'numerica' && this.senhaTipo !== 'desenho') return;
    if (!this.senhaValor) return;
    this.salvandoSenha = true;
    this.erro = '';
    this.sucesso = '';
    const eraEdicao = !!this.sessao?.senhaPreenchida;
    this.intakeService.salvarSenha(this.token, this.senhaTipo, this.senhaValor).subscribe({
      next: (s: OsIntakeSessao) => {
        this.sessao = s;
        this.salvandoSenha = false;
        this.senhaJaSalvaNestaSessao = true;
        this.senhaValor = '';
        this.mostrarSucesso(
          eraEdicao ? 'Senha atualizada com sucesso.' : 'Senha registrada com sucesso.',
        );
        // Volta às fotos se o colaborador estava no fluxo de imagens; senão mostra concluído.
        if (this.editandoFotos || (s.totalFotos > 0 && eraEdicao)) {
          this.etapaAtiva = 'fotos';
        } else {
          this.editandoFotos = false;
          this.etapaAtiva = 'concluido';
        }
        this.scrollTopo();
      },
      error: (err) => {
        this.erro = err?.error?.erro || 'Não foi possível salvar a senha. Tente novamente.';
        this.salvandoSenha = false;
      },
    });
  }

  private carregar(): void {
    this.intakeService.obterSessao(this.token).subscribe({
      next: (s: OsIntakeSessao) => {
        this.sessao = s;
        if (s.precisaSenha) this.senhaTipo = 'desenho';
        // Só na 1ª carga: se já estiver tudo pronto, mostra o resumo.
        // Depois disso o usuário controla (voltar às fotos / concluir).
        if (this.primeiraCarga && this.etapaConcluida && !this.editandoFotos) {
          this.etapaAtiva = 'concluido';
        } else if (this.etapaAtiva !== 'senha') {
          this.etapaAtiva = 'fotos';
        }
        this.primeiraCarga = false;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Link expirado ou inválido. Peça um novo QR na loja.';
        avisarErroUsuario(this.erro);
        this.carregando = false;
        this.primeiraCarga = false;
      },
    });
  }

  private recarregarSessaoSilencioso(): void {
    if (!this.token) return;
    this.intakeService.obterSessao(this.token).subscribe({
      next: (s: OsIntakeSessao) => {
        this.sessao = s;
        // Nunca força "concluído" no poll — evita pular tela ao voltar para anexar mais fotos.
      },
      error: () => { /* ignora no poll */ },
    });
  }

  private mostrarSucesso(msg: string): void {
    this.sucesso = msg;
    if (this.sucessoTimer) clearTimeout(this.sucessoTimer);
    this.sucessoTimer = setTimeout(() => {
      this.sucesso = '';
    }, 4500);
  }

  private limparPreviewLocal(): void {
    if (this.previewLocalUrl) {
      URL.revokeObjectURL(this.previewLocalUrl);
      this.previewLocalUrl = '';
    }
    this.previewCategoria = null;
  }

  private scrollTopo(): void {
    const host = document.querySelector('app-mobile-shell');
    if (host instanceof HTMLElement) host.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Rola até o próximo ângulo sem foto (ou para "outra" / contador). */
  private rolarParaProximoSlotVazio(categoriaRecemEnviada?: OsFotoCategoriaId): void {
    const ordem = [
      ...this.categoriasGuiadas.map(c => c.id),
      this.categoriaOutra.id,
    ] as OsFotoCategoriaId[];
    let idx = categoriaRecemEnviada ? ordem.indexOf(categoriaRecemEnviada) + 1 : 0;
    if (idx < 0) idx = 0;
    let alvo: OsFotoCategoriaId | null = null;
    for (let i = idx; i < ordem.length; i++) {
      if (this.fotosDaCategoria(ordem[i]).length === 0) {
        alvo = ordem[i];
        break;
      }
    }
    const sel = alvo
      ? `[data-cat="${alvo}"]`
      : '.intake-mobile-contador';
    const el = document.querySelector(sel);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private mostrarPreviewLocal(file: File, categoria: OsFotoCategoriaId): void {
    this.limparPreviewLocal();
    // Preview de arquivos muito grandes trava alguns celulares.
    if (file.size > 4 * 1024 * 1024) {
      this.previewCategoria = categoria;
      return;
    }
    this.previewLocalUrl = URL.createObjectURL(file);
    this.previewCategoria = categoria;
  }

  private enviarFotosSequencial(
    files: File[],
    categoria: OsFotoCategoriaId,
    descricaoFoco?: string,
    enviadas = 0,
  ): void {
    if (!files.length) {
      this.enviandoCategoria = null;
      this.fotosPendentes = 0;
      this.limparPreviewLocal();
      if (enviadas > 0) {
        const rotulo = this.rotuloFoto(categoria);
        this.mostrarSucesso(
          enviadas === 1
            ? `Foto de “${rotulo}” anexada com sucesso. Toque na miniatura para ver ou substituir.`
            : `${enviadas} fotos de “${rotulo}” anexadas. Toque para ver ou substituir.`,
        );
        // Permanecer nas fotos — não ir para "concluído" sozinho.
        this.editandoFotos = true;
        this.etapaAtiva = 'fotos';
        setTimeout(() => this.rolarParaProximoSlotVazio(categoria), 120);
      }
      return;
    }
    this.enviandoCategoria = categoria;
    this.fotosPendentes = files.length;
    this.erro = '';
    this.sucesso = '';
    const file = files[0];
    this.mostrarPreviewLocal(file, categoria);

    this.intakeService.enviarFoto(this.token, file, categoria, descricaoFoco).pipe(
      timeout(UPLOAD_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => ({
            error: { erro: 'Tempo esgotado ao enviar. Verifique o Wi‑Fi e tente de novo.' },
          }));
        }
        return throwError(() => err);
      }),
    ).subscribe({
      next: (foto) => {
        if (this.sessao) {
          const jaTem = this.sessao.fotos.some(f => f.id === foto.id);
          if (!jaTem) {
            this.sessao = {
              ...this.sessao,
              fotos: [...this.sessao.fotos, foto],
              totalFotos: this.sessao.totalFotos + 1,
            };
          }
        }
        // Não espera obterSessao (no PC também não) — só segue o próximo arquivo.
        this.enviarFotosSequencial(files.slice(1), categoria, descricaoFoco, enviadas + 1);
        this.recarregarSessaoSilencioso();
      },
      error: (err) => {
        this.limparPreviewLocal();
        const body = err?.error;
        this.erro = body?.erro
          || (typeof body === 'string' ? body : null)
          || body?.title
          || (err?.status === 0
            ? 'Sem conexão com a loja. Confirme o Wi‑Fi e a URL do QR (IP da rede).'
            : 'Falha ao anexar a foto. Verifique a conexão e tente novamente.');
        this.enviandoCategoria = null;
        this.fotosPendentes = 0;
        if (enviadas > 0) {
          this.mostrarSucesso(
            enviadas === 1
              ? '1 foto anterior anexada, mas a seguinte falhou.'
              : `${enviadas} fotos anexadas, mas a seguinte falhou.`,
          );
        }
      },
    });
  }
}
