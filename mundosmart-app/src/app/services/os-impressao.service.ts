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

@Injectable({ providedIn: 'root' })
export class OsImpressaoService {
  constructor(
    private ordensService: OrdensServicoService,
    private clientesService: ClientesService,
    private impressaoConfigService: OsImpressaoConfigService,
    private impressoraTermica: ImpressoraTermicaService,
  ) {}

  imprimir(tipo: OsImpressaoTipo, osResumo: BlingOrdemServico): void {
    if (osResumo.id == null) return;

    if (isImpressaoTermica(tipo)) {
      this.imprimirTermico(tipo, osResumo);
      return;
    }

    this.carregarDadosImpressao(osResumo).subscribe({
      next: ({ os, enderecoCliente }) => {
        try {
          const html = montarHtmlImpressaoOs(tipo as OsImpressaoTipoHtml, os, {
            enderecoCliente,
            textos: this.impressaoConfigService.textosAtuais(),
          });
          const titulo = `Impressão OS #${os.numero ?? os.id}`;
          this.abrirJanelaImpressao(html, titulo);
        } catch (err) {
          console.error('[impressão OS] falha ao montar HTML', err);
          window.alert('Não foi possível montar a impressão da OS.');
        }
      },
      error: (err) => {
        console.error('[impressão OS] falha ao carregar dados', err);
        window.alert('Não foi possível carregar os dados da OS para impressão.');
      },
    });
  }

  private imprimirTermico(tipo: OsImpressaoTipoTermico, osResumo: BlingOrdemServico): void {
    this.carregarDadosImpressao(osResumo).subscribe({
      next: async ({ os }) => {
        const cfg = this.impressoraTermica.configAtual();
        const ctx = {
          empresa: this.impressaoConfigService.empresaAtual(),
          larguraLinha: cfg.larguraLinha,
        };

        if (this.impressoraTermica.conectada()) {
          const dados = await montarEscPosImpressaoOs(tipo, os, ctx);
          this.impressoraTermica.imprimir(dados).catch(() => {
            window.alert('Falha ao enviar para a impressora USB. Tente reconectar ou use impressão pelo navegador.');
          });
          return;
        }

        const html = montarHtmlCupomTermico(tipo, os, ctx);
        const titulo = tipo === 'comprovante-loja-termico' ? 'Deixado na loja' : 'Garantia';
        this.abrirJanelaImpressao(html, `${titulo} OS #${os.numero ?? os.id}`);
      },
      error: (err) => {
        console.error('[impressão térmica] falha ao carregar dados', err);
        window.alert('Não foi possível carregar os dados da OS para impressão térmica.');
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
  abrirJanelaImpressao(html: string, titulo: string): void {
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
      window.alert('Não foi possível preparar a impressão. Tente novamente.');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();
    doc.title = titulo;

    const limpar = () => {
      try { iframe.remove(); } catch { /* ignore */ }
    };

    const disparar = () => {
      try {
        win.focus();
        win.print();
      } finally {
        // Remove após o diálogo de impressão (ou se cancelar).
        setTimeout(limpar, 1500);
      }
    };

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
