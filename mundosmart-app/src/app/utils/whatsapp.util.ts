import { apenasDigitos, ehCelularValido } from './contato-validacao';

const LOJA = 'Mundo Smart';

export function primeiroNome(nome?: string): string {
  return (nome ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? '';
}

/** Mensagem para o próprio cliente (confirmação do número cadastrado). */
export function mensagemWhatsappConfirmarNumero(nomeCliente: string): string {
  const nome = primeiroNome(nomeCliente);
  const oi = nome ? `Olá, ${nome}` : 'Olá';
  return `${oi}, aqui é a ${LOJA}. Estou enviando esta mensagem para confirmar o seu número de contato.`;
}

/** Mensagem para contato alternativo (aviso sobre o conserto do cliente). */
export function mensagemWhatsappContatoAlternativo(nomeContato: string, nomeCliente: string): string {
  const dest = primeiroNome(nomeContato);
  const cliente = (nomeCliente ?? '').trim() || 'um cliente';
  const oi = dest ? `Olá, ${dest}` : 'Olá';
  return (
    `${oi}, aqui é a ${LOJA}. ${cliente} deixou este número para que possamos avisar ` +
    `sobre o conserto do celular deixado na loja.`
  );
}

export function podeEnviarWhatsapp(telefone?: string): boolean {
  return ehCelularValido(telefone);
}

export function telefoneWhatsappE164(telefone?: string): string | null {
  if (!ehCelularValido(telefone)) return null;
  return `55${apenasDigitos(telefone)}`;
}

export function abrirWhatsapp(telefone: string | undefined, mensagem: string): boolean {
  const e164 = telefoneWhatsappE164(telefone);
  if (!e164 || !mensagem.trim()) return false;
  const url = `https://wa.me/${e164}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, '_blank', 'noopener');
  return true;
}

/** Vazio = enviou; texto = motivo para avisar o funcionário. */
export function tentarWhatsappConfirmarNumero(nomeCliente: string, telefone?: string): string {
  if (!nomeCliente.trim()) return 'Informe o nome do cliente antes de enviar o WhatsApp.';
  if (!abrirWhatsapp(telefone, mensagemWhatsappConfirmarNumero(nomeCliente))) {
    return 'Informe um celular com DDD (9 após o DDD) para enviar no WhatsApp.';
  }
  return '';
}

export function tentarWhatsappContatoAlternativo(
  nomeContato: string,
  nomeCliente: string,
  telefone?: string,
): string {
  if (!nomeCliente.trim()) return 'Informe o nome do cliente antes de avisar o contato alternativo.';
  if (!abrirWhatsapp(telefone, mensagemWhatsappContatoAlternativo(nomeContato, nomeCliente))) {
    return 'Informe um celular com DDD (9 após o DDD) no contato alternativo.';
  }
  return '';
}
