export interface ImpressoraTermicaConfig {
  baudRate: number;
  larguraLinha: number;
}

export const IMPRESSORA_TERMICA_PADRAO: ImpressoraTermicaConfig = {
  baudRate: 9600,
  larguraLinha: 48,
};

const STORAGE_KEY = 'mundosmart.impressora-termica';

export function getImpressoraTermicaConfig(): ImpressoraTermicaConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...IMPRESSORA_TERMICA_PADRAO };
    const parsed = JSON.parse(raw) as Partial<ImpressoraTermicaConfig>;
    return {
      baudRate: parsed.baudRate && parsed.baudRate > 0 ? parsed.baudRate : IMPRESSORA_TERMICA_PADRAO.baudRate,
      larguraLinha: parsed.larguraLinha && parsed.larguraLinha >= 32
        ? parsed.larguraLinha
        : IMPRESSORA_TERMICA_PADRAO.larguraLinha,
    };
  } catch {
    return { ...IMPRESSORA_TERMICA_PADRAO };
  }
}

export function salvarImpressoraTermicaConfig(config: ImpressoraTermicaConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    baudRate: config.baudRate > 0 ? config.baudRate : IMPRESSORA_TERMICA_PADRAO.baudRate,
    larguraLinha: config.larguraLinha >= 32 ? config.larguraLinha : IMPRESSORA_TERMICA_PADRAO.larguraLinha,
  }));
}

export const IMPRESSORA_TERMICA_BAUD_RATES = [9600, 19200, 38400, 115200] as const;

export interface DiagnosticoImpressoraTermica {
  serialDisponivel: boolean;
  contextoSeguro: boolean;
  urlAtual: string;
  motivoBloqueio?: string;
  sugestao?: string;
  podeImprimirPeloNavegador: boolean;
}

export function diagnosticoImpressoraTermica(): DiagnosticoImpressoraTermica {
  const serialDisponivel = typeof navigator !== 'undefined' && 'serial' in navigator;
  const contextoSeguro = typeof window !== 'undefined' && window.isSecureContext;
  const urlAtual = typeof window !== 'undefined' ? window.location.href : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  let motivoBloqueio: string | undefined;
  let sugestao: string | undefined;

  if (!serialDisponivel) {
    const porIpRede = hostname && hostname !== 'localhost' && hostname !== '127.0.0.1';
    if (!contextoSeguro || porIpRede) {
      motivoBloqueio =
        'Conexão USB direta não está disponível porque o sistema foi aberto por IP na rede ' +
        `(ex.: http://${hostname}:4200).`;
      sugestao =
        'No PC do balcão use http://localhost:4200 (com front e API rodando neste PC) ' +
        'ou imprima pelo navegador na Epson já instalada no Windows.';
    } else {
      motivoBloqueio = 'Este navegador não expõe a API Web Serial.';
      sugestao = 'Use Chrome ou Edge atualizado no Windows, ou imprima pelo navegador.';
    }
  }

  return {
    serialDisponivel,
    contextoSeguro,
    urlAtual,
    motivoBloqueio,
    sugestao,
    podeImprimirPeloNavegador: true,
  };
}

/** USB direto (Web Serial) — só em localhost/https. */
export function impressoraTermicaSuportada(): boolean {
  return diagnosticoImpressoraTermica().serialDisponivel;
}
