import { Injectable } from '@angular/core';
import {
  diagnosticoImpressoraTermica,
  getImpressoraTermicaConfig,
  ImpressoraTermicaConfig,
  salvarImpressoraTermicaConfig,
} from '../config/impressora-termica.config';

@Injectable({ providedIn: 'root' })
export class ImpressoraTermicaService {
  private porta: SerialPort | null = null;
  private gravador: WritableStreamDefaultWriter<Uint8Array> | null = null;

  suportada(): boolean {
    return diagnosticoImpressoraTermica().serialDisponivel;
  }

  conectada(): boolean {
    return !!this.porta?.readable && !!this.porta?.writable;
  }

  configAtual(): ImpressoraTermicaConfig {
    return getImpressoraTermicaConfig();
  }

  salvarConfig(config: ImpressoraTermicaConfig): void {
    salvarImpressoraTermicaConfig(config);
  }

  async conectar(): Promise<void> {
    if (!this.suportada()) {
      const d = diagnosticoImpressoraTermica();
      throw new Error(d.motivoBloqueio || 'Conexao USB direta indisponivel neste endereco.');
    }

    await this.desconectar();

    const port = await navigator.serial!.requestPort();
    const { baudRate } = getImpressoraTermicaConfig();
    await port.open({ baudRate });

    this.porta = port;
    this.gravador = port.writable!.getWriter();
  }

  async desconectar(): Promise<void> {
    try {
      await this.gravador?.close();
    } catch {
      // porta ja fechada
    }
    this.gravador = null;

    if (this.porta) {
      try {
        await this.porta.close();
      } catch {
        // ignorar
      }
    }
    this.porta = null;
  }

  async imprimir(dados: Uint8Array): Promise<void> {
    if (!this.conectada() || !this.gravador) {
      throw new Error('Impressora nao conectada. Configure a Epson em Configuracoes > Impressao.');
    }

    await this.gravador.write(dados);
  }
}
