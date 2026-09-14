import { apenasDigitos } from './contato-validacao';

/** IMEI padrão (GSM) tem 15 dígitos. */
export const IMEI_DIGITOS = 15;

export function mensagemAlertaImei(valor?: string | null): string {
  const d = apenasDigitos(valor ?? '');
  if (!d) return '';
  if (d.length === IMEI_DIGITOS) return '';
  return `IMEI costuma ter ${IMEI_DIGITOS} dígitos. Este tem ${d.length}.`;
}
