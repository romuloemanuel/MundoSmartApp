import { BlingContatoEndereco } from '../models/bling.models';
import { apenasDigitos } from './contato-validacao';

export function formatarEnderecoCliente(endereco?: BlingContatoEndereco | null): string {
  if (!endereco) return '—';

  const linha1 = [endereco.logradouro?.trim(), endereco.numero?.trim()].filter(Boolean).join(', ');
  const linha2 = [
    endereco.complemento?.trim(),
    endereco.bairro?.trim(),
    [endereco.municipio?.trim(), endereco.uf?.trim()].filter(Boolean).join(' - '),
    endereco.cep?.trim() ? `CEP ${endereco.cep.trim()}` : '',
  ].filter(Boolean).join(' · ');

  const partes = [linha1, linha2].filter(Boolean);
  return partes.length ? partes.join(' — ') : '—';
}

export function enderecoClientePreenchido(endereco?: BlingContatoEndereco | null): boolean {
  return formatarEnderecoCliente(endereco) !== '—';
}

/** Linha única para contrato / documentos. */
export function formatarEnderecoCompleto(e?: BlingContatoEndereco | null): string {
  if (!e) return '';
  const rua = [e.logradouro?.trim(), e.numero?.trim()].filter(Boolean).join(', ');
  const cidadeUf = [e.municipio?.trim(), e.uf?.trim()].filter(Boolean).join(' - ');
  const cep = e.cep?.trim() ? `CEP ${e.cep.trim()}` : '';
  return [rua, e.complemento?.trim(), e.bairro?.trim(), cidadeUf, cep].filter(Boolean).join(', ');
}

export function enderecoMinimoPreenchido(e?: BlingContatoEndereco | null): boolean {
  if (!e) return false;
  if (apenasDigitos(e.cep).length === 8) return true;
  return !!(e.logradouro?.trim() && e.municipio?.trim());
}
