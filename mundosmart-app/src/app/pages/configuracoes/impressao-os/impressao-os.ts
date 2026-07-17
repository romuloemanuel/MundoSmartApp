import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IMPRESSAO_OS_CONFIG_PADRAO,
  ImpressaoOsConfig,
} from '../../../config/os-impressao-textos.config';
import {
  DiagnosticoImpressoraTermica,
  diagnosticoImpressoraTermica,
  IMPRESSORA_TERMICA_BAUD_RATES,
  IMPRESSORA_TERMICA_PADRAO,
  ImpressoraTermicaConfig,
} from '../../../config/impressora-termica.config';
import { OsImpressaoConfigService } from '../../../services/os-impressao-config.service';
import { ImpressoraTermicaService } from '../../../services/impressora-termica.service';
import { OsImpressaoService } from '../../../services/os-impressao.service';
import {
  montarHtmlTesteImpressoraTermica,
  montarTesteImpressoraTermica,
} from '../../../utils/os-impressao.thermal';

@Component({
  selector: 'app-config-impressao-os',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [`
    .page-hint { color: #64748b; font-size: 13px; margin: 0 0 16px; }
    .sucesso { color: #15803d; background: #f0fdf4; border: 1px solid #86efac; padding: 8px 10px; border-radius: 6px; }
    .secao { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .secao h3 { margin: 0 0 8px; font-size: 15px; color: #1e293b; }
    textarea, input, select { width: 100%; font-family: inherit; font-size: 13px; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; }
    textarea { min-height: 80px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .impressora-status { font-size: 13px; margin: 8px 0; }
    .impressora-status.ok { color: #15803d; }
    .impressora-status.off { color: #b45309; }
    .impressora-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .impressora-acoes button { width: auto; }
    .aviso-navegador { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 8px 10px; border-radius: 6px; font-size: 12px; margin: 8px 0; }
    .aviso-navegador strong { display: block; margin-bottom: 4px; }
    .info-navegador { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 8px 10px; border-radius: 6px; font-size: 12px; margin: 8px 0; }
  `],
  templateUrl: './impressao-os.html',
})
export class ConfigImpressaoOsPage implements OnInit {
  config: ImpressaoOsConfig = { ...IMPRESSAO_OS_CONFIG_PADRAO };
  impressora: ImpressoraTermicaConfig = { ...IMPRESSORA_TERMICA_PADRAO };
  baudRates = IMPRESSORA_TERMICA_BAUD_RATES;
  diagnostico: DiagnosticoImpressoraTermica = diagnosticoImpressoraTermica();

  salvando = false;
  carregando = true;
  conectando = false;
  testando = false;
  erro = '';
  sucesso = '';
  impressoraConectada = false;

  constructor(
    private configService: OsImpressaoConfigService,
    private impressoraTermica: ImpressoraTermicaService,
    private osImpressao: OsImpressaoService,
  ) {}

  ngOnInit(): void {
    this.diagnostico = diagnosticoImpressoraTermica();
    this.impressora = this.impressoraTermica.configAtual();
    this.impressoraConectada = this.impressoraTermica.conectada();

    this.configService.carregar().subscribe({
      next: () => {
        this.config = { ...this.configService.configAtual() };
        this.carregando = false;
      },
      error: () => {
        this.config = { ...IMPRESSAO_OS_CONFIG_PADRAO };
        this.carregando = false;
      },
    });
  }

  restaurarPadrao(): void {
    this.config = { ...IMPRESSAO_OS_CONFIG_PADRAO };
    this.sucesso = '';
    this.erro = '';
  }

  salvarConfigImpressora(): void {
    this.impressoraTermica.salvarConfig(this.impressora);
    this.sucesso = 'Configuração da impressora salva neste computador.';
    this.erro = '';
  }

  async conectarImpressora(): Promise<void> {
    this.erro = '';
    this.sucesso = '';
    this.conectando = true;
    try {
      this.impressoraTermica.salvarConfig(this.impressora);
      await this.impressoraTermica.conectar();
      this.impressoraConectada = true;
      this.sucesso = 'Impressora Epson conectada via USB direto.';
    } catch (err: unknown) {
      this.impressoraConectada = false;
      this.erro = err instanceof Error
        ? err.message
        : 'Não foi possível conectar. Verifique o cabo USB e selecione a porta Epson.';
    } finally {
      this.conectando = false;
    }
  }

  async desconectarImpressora(): Promise<void> {
    await this.impressoraTermica.desconectar();
    this.impressoraConectada = false;
    this.sucesso = 'Impressora desconectada.';
  }

  async testarImpressora(): Promise<void> {
    this.erro = '';
    this.sucesso = '';
    this.testando = true;

    try {
      if (this.impressoraTermica.conectada()) {
        const dados = montarTesteImpressoraTermica(
          this.configService.empresaAtual(),
          this.impressora.larguraLinha,
        );
        await this.impressoraTermica.imprimir(dados);
        this.sucesso = 'Cupom de teste enviado via USB direto.';
      } else {
        const html = montarHtmlTesteImpressoraTermica(this.configService.empresaAtual());
        this.osImpressao.abrirJanelaImpressao(html, 'Teste impressora');
        this.sucesso = 'Abra o diálogo e selecione a Epson instalada no Windows.';
      }
    } catch {
      this.erro = 'Falha ao imprimir teste.';
    } finally {
      this.testando = false;
    }
  }

  salvar(): void {
    this.erro = '';
    this.sucesso = '';
    if (!this.config.avisoPreOrcamento.trim() || !this.config.termosCondicoes.trim()) {
      this.erro = 'Preencha os textos da OS A4 antes de salvar.';
      return;
    }
    if (!this.config.nomeEmpresa.trim()) {
      this.erro = 'Informe o nome da empresa para os cupons térmicos.';
      return;
    }

    this.salvando = true;
    this.configService.salvar(this.config).subscribe({
      next: (salvo) => {
        this.config = { ...salvo };
        this.sucesso = 'Configurações salvas.';
        this.salvando = false;
      },
      error: (err: { error?: { erro?: string } }) => {
        this.erro = err?.error?.erro || 'Não foi possível salvar as configurações.';
        this.salvando = false;
      },
    });
  }
}
