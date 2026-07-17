import { LOJA_IMPRESSAO_NOME } from '../config/os-impressao.config';
import { LOGO_MUNDO_SMART_DATA_URI } from './logo-mundo-smart.data';

/**
 * Cabeçalho visual compacto para impressão A4.
 * Usa data URI embutida (não depende de /public no serve).
 * Não usar em térmica (ESC/POS / cupom estreito).
 */
export function htmlLogoCabecalhoImpressao(): string {
  return `<div class="logo-impressao">
    <img src="${LOGO_MUNDO_SMART_DATA_URI}" alt="${LOJA_IMPRESSAO_NOME}" width="280" height="70" />
  </div>`;
}
