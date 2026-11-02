import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { BlingContato, BlingOrdemServico } from '../models/bling.models';
import { isImpressaoTermica, OsImpressaoTipo, OsImpressaoTipoHtml, OsImpressaoTipoTermico } from '../config/os-impressao.config';
import { montarHtmlImpressaoOs } from '../utils/os-impressao.templates';
import { montarEscPosImpressaoOs, montarHtmlCupomTermico } from '../utils/os-impressao.thermal';
import { formatarEnderecoCliente } from '../utils/endereco-format.util';
import { OrdensServicoService } from './ordens-servico';
import { ClientesService } from './clientes';
import { OsImpressaoConfigService } from './os-impressao-config.service';
import { ImpressoraTermicaService } from './impressora-termica.service';
import { avisarErroSistema, avisarErroUsuario } from './user-feedback.service';

@Injectable({ providedIn: 'root' })
export class OsImpressaoService {
  constructor(
    private ordensService: OrdensServicoService,
    private clientesService: ClientesService,
    private impressaoConfigService: OsImpressaoConfigService,
    private impressoraTermica: ImpressoraTermicaService,
  ) {}

  private filaImpressao: { tipo: OsImpressaoTipo; os: BlingOrdemServico }[] = [];
  private impressaoOcupada = false;

  imprimir(tipo: OsImpressaoTipo, osResumo: BlingOrdemServico): void {
    if (osResumo.id == null) return;
    this.filaImpressao.push({ tipo, os: osResumo });
    this.processarFilaImpressao();
  }

  private processarFilaImpressao(): void {
    if (this.impressaoOcupada || this.filaImpressao.length === 0) return;
    const atual = this.filaImpressao.shift();
    if (!atual) return;
    this.impressaoOcupada = true;
    const liberar = () => {
      this.impressaoOcupada = false;
      this.processarFilaImpressao();
    };

    if (isImpressaoTermica(atual.tipo)) {
      this.imprimirTermico(atual.tipo, atual.os, liberar);
      return;
    }

    this.carregarDadosImpressao(atual.os).subscribe({
      next: ({ os, enderecoCliente }) => {
        try {
          const html = montarHtmlImpressaoOs(atual.tipo as OsImpressaoTipoHtml, os, {
            enderecoCliente,
            textos: this.impressaoConfigService.textosAtuais(),
          });
          const titulo = `Impressão OS #${os.numero ?? os.id}`;
          this.abrirJanelaImpressao(html, titulo, liberar);
        } catch (err) {
          console.error('[impressão OS] falha ao montar HTML', err);
          avisarErroSistema('Não foi possível montar a impressão da OS.');
          liberar();
        }
      },
      error: (err) => {
        console.error('[impressão OS] falha ao carregar dados', err);
        avisarErroSistema('Não foi possível carregar os dados da OS para impressão.');
        liberar();
      },
    });
  }

  private imprimirTermico(tipo: OsImpressaoTipoTermico, osResumo: BlingOrdemServico, aoTerminar?: () => void): void {
    this.carregarDadosImpressao(osResumo).subscribe({
      next: async ({ os }) => {
        try {
          const cfg = this.impressoraTermica.configAtual();
          const ctx = {
            empresa: this.impressaoConfigService.empresaAtual(),
            larguraLinha: cfg.larguraLinha,
          };

          if (this.impressoraTermica.conectada()) {
            const dados = await montarEscPosImpressaoOs(tipo, os, ctx);
            this.impressoraTermica.imprimir(dados).catch(() => {
              avisarErroUsuario('Falha ao enviar para a impressora USB. Tente reconectar ou use impressão pelo navegador.');
            }).finally(() => aoTerminar?.());
            return;
          }

          const html = montarHtmlCupomTermico(tipo, os, ctx);
          const titulo = tipo === 'comprovante-loja-termico' ? 'Deixado na loja' : 'Garantia';
          this.abrirJanelaImpressao(html, `${titulo} OS #${os.numero ?? os.id}`, aoTerminar);
        } catch (err) {
          console.error('[impressão térmica] falha ao montar', err);
          avisarErroSistema('Não foi possível montar a impressão da OS.');
          aoTerminar?.();
        }
      },
      error: (err) => {
        console.error('[impressão térmica] falha ao carregar dados', err);
        avisarErroSistema('Não foi possível carregar os dados da OS para impressão térmica.');
        aoTerminar?.();
      },
    });
  }

  private carregarDadosImpressao(osResumo: BlingOrdemServico): Observable<{
    os: BlingOrdemServico;
    enderecoCliente: string;
  }> {
    const id = osResumo.id!;
    const local = this.ordensService.peekObter(id) ?? osResumo;

    return this.ordensService.obter(id).pipe(
      catchError(err => {
        console.warn('[impressão OS] obter falhou — usando dados em memória', err);
        return of(local);
      }),
      switchMap(os => {
        const mesclada: BlingOrdemServico = { ...local, ...os };
        const clienteId = mesclada.contato?.id;
        const cliente$ = clienteId
          ? this.clientesService.obter(clienteId).pipe(catchError(() => of(null)))
          : of(null);

        return cliente$.pipe(
          map(cliente => {
            const osImpressao = this.enriquecerContatoParaImpressao(mesclada, cliente);
            return {
              os: osImpressao,
              enderecoCliente: formatarEnderecoCliente(cliente?.endereco),
            };
          }),
        );
      }),
    );
  }

  /** Garante telefones do cliente (e, se faltar na OS, do cadastro) na impressão. */
  private enriquecerContatoParaImpressao(
    os: BlingOrdemServico,
    cliente: BlingContato | null,
  ): BlingOrdemServico {
    if (!os.contato && !cliente) return os;

    const contato = {
      ...(os.contato ?? { id: cliente?.id ?? 0, nome: cliente?.nome ?? '' }),
      nome: os.contato?.nome?.trim() || cliente?.nome || os.contato?.nome,
      telefone: os.contato?.telefone?.trim() || cliente?.telefone || os.contato?.telefone,
      celular: os.contato?.celular?.trim() || cliente?.celular || os.contato?.celular,
    };

    return { ...os, contato };
  }

  /**
   * Imprime via iframe oculto para não substituir a aba do Angular
   * (window.open('about:blank') em alguns browsers navega a própria página).
   */
  abrirJanelaImpressao(html: string, titulo: string, aoFechar?: () => void): void {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', titulo);
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) {
      iframe.remove();
      avisarErroSistema('Não foi possível preparar a impressão. Tente novamente.');
      aoFechar?.();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
    doc.title = titulo;

    let encerrou = false;
    const encerrar = () => {
      if (encerrou) return;
      encerrou = true;
      try { iframe.remove(); } catch { /* ignore */ }
      aoFechar?.();
    };

    const disparar = () => {
      try {
        win.focus();
        win.print();
      } catch {
        encerrar();
      }
    };
    win.addEventListener('afterprint', () => setTimeout(encerrar, 300));
    setTimeout(encerrar, 120000);

    const aguardarImagens = (): Promise<void> => {
      const imgs = Array.from(doc.images ?? []);
      if (!imgs.length) return Promise.resolve();
      return Promise.all(
        imgs.map(
          img =>
            new Promise<void>(resolve => {
              if (img.complete) {
                resolve();
                return;
              }
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
        ),
      ).then(() => undefined);
    };

    const iniciar = () => {
      void aguardarImagens().then(() => setTimeout(disparar, 80));
    };

    if (doc.readyState === 'complete') {
      iniciar();
    } else {
      iframe.onload = () => iniciar();
    }
  }
}
