export interface ClienteDuplicadoVerificacao {
  existe: boolean;
  clienteId?: number;
  clienteNome?: string;
}

export interface ContatoAltSugestao {
  encontrado: boolean;
  nome?: string;
  clienteId?: number;
  eClientePrincipal?: boolean;
}

export const DUPLICADO_OK: ClienteDuplicadoVerificacao = { existe: false };

export const SUGESTAO_ALT_VAZIA: ContatoAltSugestao = { encontrado: false };

export function mensagemDuplicata(rotulo: string, info: ClienteDuplicadoVerificacao): string {
  if (!info.existe) return '';
  return info.clienteNome
    ? `${rotulo} já cadastrado para ${info.clienteNome}.`
    : `${rotulo} já cadastrado em outro cliente.`;
}

export function temDuplicata(...infos: ClienteDuplicadoVerificacao[]): boolean {
  return infos.some(i => i.existe);
}

export function agendarVerificacao(
  timers: Map<string, ReturnType<typeof setTimeout>>,
  chave: string,
  callback: () => void,
  delayMs = 450,
): void {
  const prev = timers.get(chave);
  if (prev) clearTimeout(prev);
  timers.set(chave, setTimeout(callback, delayMs));
}

export function cancelarVerificacao(timers: Map<string, ReturnType<typeof setTimeout>>, chave: string): void {
  const prev = timers.get(chave);
  if (prev) clearTimeout(prev);
  timers.delete(chave);
}
