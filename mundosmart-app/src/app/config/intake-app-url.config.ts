import { environment } from '../../environments/environment';

const STORAGE_KEY = 'mundosmart.intake-app-url';

function normalizarUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

/** Em produção a URL vem da API (Intake__AppBaseUrl); no FE só edita em desenvolvimento. */
export function intakeUrlEditavel(): boolean {
  return !environment.production;
}

/**
 * URL do app acessível pelo celular (QR de intake).
 * Dev: localStorage → environment.intakeAppUrl (se localhost) → origin.
 * Prod: só environment.intakeAppUrl (build); se vazio, a API usa Intake__AppBaseUrl.
 */
export function obterUrlAppIntake(): string {
  if (typeof window === 'undefined') return '';

  if (!environment.production) {
    const cfg = environment.intakeAppUrl?.trim();
    const cfgN = cfg ? normalizarUrl(cfg) : '';
    const salvo = localStorage.getItem(STORAGE_KEY)?.trim();

    // Se o IP da LAN mudou no environment, sincroniza o localStorage (QR antigo).
    if (cfgN && salvo) {
      try {
        const hSalvo = new URL(salvo).hostname;
        const hCfg = new URL(cfgN).hostname;
        if (hSalvo !== hCfg && ehIpPrivado(hSalvo) && ehIpPrivado(hCfg)) {
          localStorage.setItem(STORAGE_KEY, cfgN);
          return cfgN;
        }
      } catch {
        /* URL inválida no storage — usa cfg */
        localStorage.setItem(STORAGE_KEY, cfgN);
        return cfgN;
      }
      return normalizarUrl(salvo);
    }

    if (cfgN) return cfgN;

    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return '';
    return normalizarUrl(origin);
  }

  const cfg = environment.intakeAppUrl?.trim();
  return cfg ? normalizarUrl(cfg) : '';
}

function ehIpPrivado(hostname: string): boolean {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
}

export function salvarUrlAppIntake(url: string): void {
  if (environment.production) return;
  localStorage.setItem(STORAGE_KEY, normalizarUrl(url));
}

export function urlAppIntakePadrao(): string {
  const cfg = environment.intakeAppUrl?.trim();
  if (cfg) return normalizarUrl(cfg);
  if (typeof window !== 'undefined') return normalizarUrl(window.location.origin);
  return '';
}
