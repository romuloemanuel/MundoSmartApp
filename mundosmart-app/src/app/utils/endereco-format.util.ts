import { BlingContatoEndereco } from '../models/bling.models';

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
