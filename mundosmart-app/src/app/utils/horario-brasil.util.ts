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

/**
 * Converte datetime-local (relógio de Brasília) para ISO com Z.
 * O Z aqui NÃO significa UTC real — marca o relógio de parede para a API/Mongo
 * não converter fuso (evita +3h/+6h).
 */
export function paraIsoOperacionalBrasil(valor?: string | null): string | undefined {
  if (!valor?.trim()) return undefined;
  const v = valor.trim();
  if (v.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(v)) return v;
  // YYYY-MM-DDTHH:mm ou YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return `${v}.000Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00.000Z`;
  return v;
}

/** Converte ISO da API (relógio de Brasília marcado como UTC) para datetime-local. */
export function formatarDatetimeLocalBrasil(valor?: string | null): string | undefined {
  if (!valor?.trim()) return undefined;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return undefined;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(
    fmt.formatToParts(d)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );
  return `${p['year']}-${p['month']}-${p['day']}T${p['hour']}:${p['minute']}`;
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

/** Data/hora operacional da OS (relógio de Brasília gravado como UTC). */
export function formatarDataHoraBrasil(valor?: string | Date | null): string {
  if (valor == null || valor === '') return '—';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  // Datas operacionais (entrada, previsão etc.) são gravadas com o horário de
  // Brasília, mas o Mongo/JSON marca como UTC — exibir o relógio sem converter.
  return d.toLocaleString('pt-BR', {
    timeZone: 'UTC',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Só data operacional da OS (mesmo critério de formatarDataHoraBrasil). */
export function formatarDataBrasil(valor?: string | Date | null): string {
  if (valor == null || valor === '') return '—';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
