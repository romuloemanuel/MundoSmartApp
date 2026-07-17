/** Fuso operacional da assistência (não usar UTC na UI). */
export const FUSO_BRASIL = 'America/Sao_Paulo';

function partesBrasil(data: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASIL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(
    fmt.formatToParts(data)
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value]),
  );
}

/** Agora no formato datetime-local (YYYY-MM-DDTHH:mm) em horário de Brasília. */
export function agoraDatetimeLocalBrasil(base: Date = new Date()): string {
  const p = partesBrasil(base);
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
}

/** Converte ISO/UTC da API para datetime-local em horário de Brasília. */
export function formatarDatetimeLocalBrasil(valor?: string | null): string | undefined {
  if (!valor?.trim()) return undefined;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return undefined;
  return agoraDatetimeLocalBrasil(d);
}

/** Data YYYY-MM-DD em horário de Brasília. */
export function agoraDataBrasil(base: Date = new Date()): string {
  return agoraDatetimeLocalBrasil(base).slice(0, 10);
}

/** Soma N dias úteis (seg–sex) a partir da data base (YYYY-MM-DD ou Date). */
export function adicionarDiasUteisBrasil(diasUteis: number, base: Date | string = new Date()): string {
  let data: Date;
  if (typeof base === 'string') {
    const [y, m, d] = base.slice(0, 10).split('-').map(Number);
    data = new Date(y, (m || 1) - 1, d || 1);
  } else {
    const p = partesBrasil(base);
    data = new Date(Number(p['year']), Number(p['month']) - 1, Number(p['day']));
  }

  let restantes = Math.max(0, diasUteis);
  while (restantes > 0) {
    data.setDate(data.getDate() + 1);
    const dia = data.getDay();
    if (dia !== 0 && dia !== 6) restantes--;
  }

  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
