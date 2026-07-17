import { BlingContato, BlingContatoPrincipal } from '../models/bling.models';

export const PARENTESCO_OUTROS = 'Outros';

export const PARENTESCO_OPCOES = [
  'Amigo',
  'Irmão(ã)',
  'Namorado(a)',
  'Esposo(a)',
  'Mãe',
  'Pai',
  'Tio(a)',
  PARENTESCO_OUTROS,
] as const;

export const PARENTESCO_PREDEFINIDOS = PARENTESCO_OPCOES.filter(
  (o): o is Exclude<typeof o, typeof PARENTESCO_OUTROS> => o !== PARENTESCO_OUTROS,
);

export function ehParentescoCustomizado(valor?: string): boolean {
  const v = valor?.trim();
  if (!v) return false;
  return !PARENTESCO_PREDEFINIDOS.includes(v as (typeof PARENTESCO_PREDEFINIDOS)[number]);
}

export interface ErrosContatoForm {
  geral?: string;
  cpfCnpj?: string;
  contato?: string;
  parentesco?: string;
  telefone2?: string;
  contatosAlt?: Record<number, { nome?: string; parentesco?: string; contato?: string }>;
}

export function apenasDigitos(valor?: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

export function formatarCpfCnpj(valor?: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatarTelefone(valor?: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;

  const ddd = d.slice(0, 2);
  const resto = d.slice(2);

  if (resto.startsWith('9')) {
    if (resto.length <= 5) return `(${ddd}) ${resto}`;
    return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5, 9)}`;
  }

  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4, 8)}`;
}

export function formatarCep(valor?: string): string {
  const d = apenasDigitos(valor).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function ehCelularValido(valor?: string): boolean {
  const d = apenasDigitos(valor);
  return d.length === 11 && d[2] === '9';
}

export function ehTelefoneFixoValido(valor?: string): boolean {
  const d = apenasDigitos(valor);
  return d.length === 10 && d[2] !== '9';
}

export function temTelefoneContatoValido(celular?: string, telefone?: string): boolean {
  const c = apenasDigitos(celular);
  const t = apenasDigitos(telefone);
  if (c.length > 0 && ehCelularValido(c)) return true;
  if (t.length > 0 && (ehCelularValido(t) || ehTelefoneFixoValido(t))) return true;
  return false;
}

export function validarCpf(cpf: string): boolean {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(d[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(d[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(d[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(d[10]);
}

export function validarCnpj(cnpj: string): boolean {
  const d = apenasDigitos(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;

  const calc = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((acc, p, i) => acc + Number(base[i]) * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dig1 = calc(d, pesos1);
  if (dig1 !== Number(d[12])) return false;
  const dig2 = calc(d.slice(0, 12) + dig1, pesos2);
  return dig2 === Number(d[13]);
}

export function validarCpfCnpj(valor?: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}

export function validarFormularioCliente(contato: BlingContato): ErrosContatoForm {
  const erros: ErrosContatoForm = {};

  if (!contato.nome?.trim()) {
    erros.geral = 'Nome é obrigatório.';
  }

  const doc = contato.cpfCnpj?.trim();
  if (doc && !validarCpfCnpj(doc)) {
    erros.cpfCnpj = 'CPF ou CNPJ inválido.';
  }

  if (!temTelefoneContatoValido(contato.celular, contato.telefone)) {
    erros.contato = 'Informe celular (9 dígitos após o DDD) ou telefone válido.';
  }

  const t2 = apenasDigitos(contato.telefone2);
  if (t2.length > 0 && !ehCelularValido(t2) && !ehTelefoneFixoValido(t2)) {
    erros.telefone2 = 'Telefone 2 inválido.';
  }

  const altErros: Record<number, { nome?: string; parentesco?: string; contato?: string }> = {};
  (contato.contatos ?? []).forEach((c, i) => {
    const item: { nome?: string; parentesco?: string; contato?: string } = {};
    if (!c.nome?.trim()) item.nome = 'Nome obrigatório.';
    if (!c.parentesco?.trim()) item.parentesco = 'Selecione o parentesco.';
    if (!temTelefoneContatoValido(c.celular, c.telefone)) {
      item.contato = 'Informe celular ou telefone válido.';
    }
    if (Object.keys(item).length > 0) altErros[i] = item;
  });

  if (Object.keys(altErros).length > 0) erros.contatosAlt = altErros;
  return erros;
}

export function formularioClienteValido(erros: ErrosContatoForm): boolean {
  return !erros.geral
    && !erros.cpfCnpj
    && !erros.contato
    && !erros.telefone2
    && (!erros.contatosAlt || Object.keys(erros.contatosAlt).length === 0);
}

export function validarContatoAlternativo(contato: BlingContatoPrincipal): ErrosContatoForm {
  const erros: ErrosContatoForm = {};
  if (!contato.nome?.trim()) erros.geral = 'Nome é obrigatório.';
  if (!contato.parentesco?.trim()) erros.parentesco = 'Selecione o parentesco.';
  if (!temTelefoneContatoValido(contato.celular, contato.telefone)) {
    erros.contato = 'Informe celular ou telefone válido.';
  }
  return erros;
}

export function contatoAlternativoValido(erros: ErrosContatoForm): boolean {
  return !erros.geral && !erros.parentesco && !erros.contato;
}

function normalizarTelefoneSalvar(valor?: string): string | undefined {
  const d = apenasDigitos(valor);
  return d.length > 0 ? d : undefined;
}

export function aplicarMascarasContato(contato: BlingContato): BlingContato {
  return {
    ...contato,
    cpfCnpj: contato.cpfCnpj ? formatarCpfCnpj(contato.cpfCnpj) : contato.cpfCnpj,
    celular: contato.celular ? formatarTelefone(contato.celular) : contato.celular,
    telefone: contato.telefone ? formatarTelefone(contato.telefone) : contato.telefone,
    telefone2: contato.telefone2 ? formatarTelefone(contato.telefone2) : contato.telefone2,
    contatos: (contato.contatos ?? []).map(c => ({
      ...c,
      celular: c.celular ? formatarTelefone(c.celular) : c.celular,
      telefone: c.telefone ? formatarTelefone(c.telefone) : c.telefone,
    })),
  };
}

export function normalizarContatoParaSalvar(contato: BlingContato): BlingContato {
  return {
    ...contato,
    nome: contato.nome?.trim() ?? '',
    cpfCnpj: normalizarTelefoneSalvar(contato.cpfCnpj),
    celular: normalizarTelefoneSalvar(contato.celular),
    telefone: normalizarTelefoneSalvar(contato.telefone),
    telefone2: normalizarTelefoneSalvar(contato.telefone2),
    contatos: (contato.contatos ?? []).map(c => ({
      nome: c.nome?.trim(),
      parentesco: c.parentesco?.trim(),
      celular: normalizarTelefoneSalvar(c.celular),
      telefone: normalizarTelefoneSalvar(c.telefone),
    })),
  };
}
